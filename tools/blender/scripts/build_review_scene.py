"""
Color Fox — Blender REVIEW SCENE (rewind02-style).
Concept turnaround on reference planes + fixed cameras + grid + studio lights.
Renders contact-sheet slots for model/anim review against concept art.
Headless: blender --background --python tools/blender/scripts/build_review_scene.py
"""
from __future__ import annotations
import math
import os
from pathlib import Path

import bpy

ROOT = Path("/workspace/siyu/playtest-forge")
CONCEPT = ROOT / "assets/concept/fox-turnaround.jpg"
KEYART = ROOT / "assets/concept/world-keyart.jpg"
OUT_BLEND = ROOT / "tools/blender/tmp/review_scene.blend"
PREVIEW_DIR = ROOT / "assets/previews/review"
RES = 512  # keep small (CPU, disk)

# Approximate panels in fox-turnaround.jpg (2 rows):
# top: front | side | 3/4 | back
# bottom: run | glide | burst  (wider cells)
# UV crops as (min_x, min_y, max_x, max_y) in 0-1, Blender V bottom-up
# Image is top-down in file; Blender image V=0 at bottom.
PANELS = {
    "front":  (0.00, 0.50, 0.25, 1.00),
    "side":   (0.25, 0.50, 0.50, 1.00),
    "three_q":(0.50, 0.50, 0.75, 1.00),
    "back":   (0.75, 0.50, 1.00, 1.00),
    "run":    (0.00, 0.00, 0.33, 0.50),
    "glide":  (0.33, 0.00, 0.66, 0.50),
    "burst":  (0.66, 0.00, 1.00, 0.50),
}


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    # ensure empty
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)


def load_image(path: Path):
    img = bpy.data.images.load(str(path))
    img.colorspace_settings.name = "sRGB"
    return img


def make_ref_plane(name: str, img, size=2.4, location=(0, -2.2, 1.2)):
    """Back wall reference plane showing full turnaround sheet."""
    bpy.ops.mesh.primitive_plane_add(size=1, location=location)
    plane = bpy.context.active_object
    plane.name = name
    # scale to image aspect (~16:9-ish sheet; use ~2.4 x 1.5)
    aspect = img.size[0] / max(1, img.size[1])
    h = size / aspect
    plane.scale = (size / 2, h / 2, 1)
    # face +Y (toward character at origin looking -Y? Character faces -Y camera)
    plane.rotation_euler = (math.radians(90), 0, 0)

    mat = bpy.data.materials.new(name + "_Mat")
    mat.use_nodes = True
    nt = mat.node_tree
    nodes = nt.nodes
    links = nt.links
    nodes.clear()
    out = nodes.new("ShaderNodeOutputMaterial")
    emis = nodes.new("ShaderNodeEmission")
    tex = nodes.new("ShaderNodeTexImage")
    tex.image = img
    emis.inputs["Strength"].default_value = 1.0
    links.new(tex.outputs["Color"], emis.inputs["Color"])
    links.new(emis.outputs["Emission"], out.inputs["Surface"])
    plane.data.materials.append(mat)
    plane.hide_render = False
    return plane


def make_cropped_panel(name: str, img, uv_rect, location, width=1.1):
    """Small concept crop card for side-by-side clip review."""
    minx, miny, maxx, maxy = uv_rect
    bpy.ops.mesh.primitive_plane_add(size=1, location=location)
    plane = bpy.context.active_object
    plane.name = f"RefPanel_{name}"
    aspect = (maxx - minx) / max(1e-6, (maxy - miny))
    # image aspect overall
    img_aspect = img.size[0] / max(1, img.size[1])
    panel_aspect = aspect * img_aspect
    h = width / max(panel_aspect, 1e-6)
    plane.scale = (width / 2, h / 2, 1)
    plane.rotation_euler = (math.radians(90), 0, 0)

    # Custom UVs for crop
    mesh = plane.data
    # plane default verts order after scale still unit; UVs:
    # Blender default plane UV: (0,0),(1,0),(1,1),(0,1) depending on version
    uv = mesh.uv_layers.new(name="UVMap") if not mesh.uv_layers else mesh.uv_layers[0]
    # Map corners: bottom-left, bottom-right, top-right, top-left in loop order
    # For a default plane, loops per poly are 4.
    mapping = [
        (minx, miny),  # bl
        (maxx, miny),  # br
        (maxx, maxy),  # tr
        (minx, maxy),  # tl
    ]
    # Collect unique vertex loop UVs by polygon 0
    poly = mesh.polygons[0]
    loops = list(poly.loop_indices)
    # Sort loops by vertex position to assign consistently
    loops_sorted = sorted(
        loops,
        key=lambda li: (
            round(mesh.vertices[mesh.loops[li].vertex_index].co.x, 4),
            round(mesh.vertices[mesh.loops[li].vertex_index].co.y, 4),
        ),
    )
    # After sort by x then y: bl, tl, br, tr for default plane in XY before rot — fragile.
    # Use explicit: assign by vertex local coords before rotation (still XY plane).
    for li in loops:
        v = mesh.vertices[mesh.loops[li].vertex_index].co
        u = maxx if v.x > 0 else minx
        vv = maxy if v.y > 0 else miny
        uv.data[li].uv = (u, vv)

    mat = bpy.data.materials.new(f"RefPanel_{name}_Mat")
    mat.use_nodes = True
    nt = mat.node_tree
    nodes, links = nt.nodes, nt.links
    nodes.clear()
    out = nodes.new("ShaderNodeOutputMaterial")
    emis = nodes.new("ShaderNodeEmission")
    tex = nodes.new("ShaderNodeTexImage")
    tex.image = img
    emis.inputs["Strength"].default_value = 1.0
    links.new(tex.outputs["Color"], emis.inputs["Color"])
    links.new(emis.outputs["Emission"], out.inputs["Surface"])
    plane.data.materials.append(mat)
    return plane


def setup_ground_grid():
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=16, y_subdivisions=16, size=4, location=(0, 0, 0))
    grid = bpy.context.active_object
    grid.name = "GroundGrid"
    mat = bpy.data.materials.new("GroundGrid_Mat")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (0.55, 0.55, 0.58, 1)
        bsdf.inputs["Roughness"].default_value = 0.85
    grid.data.materials.append(mat)
    return grid


def setup_lights():
    # Key
    bpy.ops.object.light_add(type="AREA", location=(2.5, -2.0, 3.0))
    key = bpy.context.active_object
    key.name = "Light_Key"
    key.data.energy = 80
    key.data.size = 2.0
    key.rotation_euler = (math.radians(50), math.radians(20), math.radians(40))
    # Fill
    bpy.ops.object.light_add(type="AREA", location=(-2.5, -1.5, 2.2))
    fill = bpy.context.active_object
    fill.name = "Light_Fill"
    fill.data.energy = 30
    fill.data.size = 2.5
    # Rim
    bpy.ops.object.light_add(type="AREA", location=(0.5, 2.5, 2.5))
    rim = bpy.context.active_object
    rim.name = "Light_Rim"
    rim.data.energy = 50
    rim.data.size = 1.5
    # World soft gray
    world = bpy.data.worlds.new("ReviewWorld")
    bpy.context.scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs["Color"].default_value = (0.22, 0.22, 0.24, 1)
        bg.inputs["Strength"].default_value = 0.4


def add_camera(name, location, look_at=(0, 0, 0.7), lens=50):
    bpy.ops.object.camera_add(location=location)
    cam = bpy.context.active_object
    cam.name = name
    cam.data.lens = lens
    # aim
    direction = (
        look_at[0] - location[0],
        look_at[1] - location[1],
        look_at[2] - location[2],
    )
    # track to empty
    bpy.ops.object.empty_add(type="PLAIN_AXES", location=look_at)
    empty = bpy.context.active_object
    empty.name = name + "_Target"
    empty.hide_render = True
    empty.hide_viewport = True
    con = cam.constraints.new(type="TRACK_TO")
    con.target = empty
    con.track_axis = "TRACK_NEGATIVE_Z"
    con.up_axis = "UP_Y"
    return cam


def setup_cameras():
    cams = {}
    # Character at origin, facing -Y (toward Cam_Front)
    cams["front"] = add_camera("Cam_Front", (0, -3.2, 1.0), (0, 0, 0.75), 45)
    cams["side"] = add_camera("Cam_Side", (3.2, 0, 1.0), (0, 0, 0.75), 45)
    cams["three_q"] = add_camera("Cam_ThreeQ", (2.2, -2.2, 1.2), (0, 0, 0.75), 45)
    cams["back"] = add_camera("Cam_Back", (0, 3.2, 1.0), (0, 0, 0.75), 45)
    cams["beauty"] = add_camera("Cam_Beauty", (1.6, -2.8, 1.4), (0, 0, 0.7), 55)
    # Contact sheet camera: frames character slot LEFT and a RefPanel RIGHT
    cams["review"] = add_camera("Cam_Review", (0.55, -4.0, 1.1), (0.55, 0, 0.9), 40)
    bpy.context.scene.camera = cams["beauty"]
    return cams


def setup_render():
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE_NEXT" if hasattr(bpy.types, "EEVEE") or True else "BLENDER_WORKBENCH"
    # 4.2 uses BLENDER_EEVEE_NEXT
    try:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
    except Exception:
        scene.render.engine = "BLENDER_WORKBENCH"
    scene.render.resolution_x = RES
    scene.render.resolution_y = RES
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.film_transparent = False
    # Eevee quality low for CPU speed
    eevee = getattr(scene, "eevee", None)
    if eevee:
        if hasattr(eevee, "taa_render_samples"):
            eevee.taa_render_samples = 16
        if hasattr(eevee, "use_raytracing"):
            eevee.use_raytracing = False


def place_marker_empty(name, location):
    bpy.ops.object.empty_add(type="ARROWS", location=location)
    e = bpy.context.active_object
    e.name = name
    e.empty_display_size = 0.3
    return e


def main():
    assert CONCEPT.exists(), f"Missing concept: {CONCEPT}"
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
    OUT_BLEND.parent.mkdir(parents=True, exist_ok=True)

    clear_scene()
    img = load_image(CONCEPT)
    print(f"Concept loaded: {img.size[0]}x{img.size[1]}")

    setup_ground_grid()
    setup_lights()
    cams = setup_cameras()

    # Full sheet on back wall (behind character, for ambient reference)
    make_ref_plane("Ref_TurnaroundFull", img, size=3.2, location=(0, 2.8, 1.35))

    # Side-by-side review panels to the RIGHT of character (Cam_Review frames both)
    # Character stands at origin; panel at x=1.6
    make_cropped_panel("front", img, PANELS["front"], location=(1.7, 0, 1.0), width=1.2)

    # Markers for where fox / clips should stand
    place_marker_empty("MARKER_CharacterRoot", (0, 0, 0))
    place_marker_empty("MARKER_ReviewCompare", (1.7, 0, 0))

    # Collection organization
    for coll_name in ("REVIEW_REFS", "REVIEW_CAMS", "REVIEW_LIGHTS", "CHARACTER"):
        if coll_name not in bpy.data.collections:
            bpy.data.collections.new(coll_name)
            bpy.context.scene.collection.children.link(bpy.data.collections[coll_name])

    setup_render()

    # Smoke render of empty review slot (beauty cam) to verify lighting
    scene = bpy.context.scene
    scene.camera = cams["beauty"]
    out = PREVIEW_DIR / "review_scene_empty.png"
    scene.render.filepath = str(out)
    bpy.ops.render.render(write_still=True)
    print(f"Wrote {out}")

    bpy.ops.wm.save_as_mainfile(filepath=str(OUT_BLEND))
    print(f"Saved review scene: {OUT_BLEND}")
    print("CAMERAS:", [c.name for c in bpy.data.objects if c.type == "CAMERA"])
    print("DONE build_review_scene")


if __name__ == "__main__":
    main()
