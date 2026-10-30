"""Slender ember fox — natural proportions matching assets/concept/fox-turnaround.jpg."""
from __future__ import annotations
import math
from pathlib import Path
import bpy
from mathutils import Vector, Matrix

ROOT = Path("/workspace/siyu/playtest-forge")
OUT_GLB = ROOT / "assets/hero/spirit_fox.glb"
OUT_BLEND = ROOT / "tools/blender/tmp/spirit_fox.blend"
PREV = ROOT / "assets/previews/review"
REVIEW = ROOT / "tools/blender/tmp/review_scene.blend"

RUST = (0.78, 0.30, 0.08)
UMBER = (0.16, 0.09, 0.05)
CREAM = (0.90, 0.82, 0.68)
EMBER = (1.0, 0.42, 0.06)
EMBER_HOT = (1.0, 0.70, 0.18)
AMBER = (0.95, 0.50, 0.08)
NOSE_C = (0.04, 0.03, 0.03)


def mat(name, color, rough=0.6, emit=None, strength=0.0, emit_only=False):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    if emit_only:
        nt.nodes.clear()
        out = nt.nodes.new("ShaderNodeOutputMaterial")
        emis = nt.nodes.new("ShaderNodeEmission")
        emis.inputs["Color"].default_value = (*color, 1)
        emis.inputs["Strength"].default_value = max(strength, 1.0)
        nt.links.new(emis.outputs["Emission"], out.inputs["Surface"])
        return m
    b = nt.nodes.get("Principled BSDF")
    if b is None:
        nt.nodes.clear()
        out = nt.nodes.new("ShaderNodeOutputMaterial")
        b = nt.nodes.new("ShaderNodeBsdfPrincipled")
        nt.links.new(b.outputs["BSDF"], out.inputs["Surface"])
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rough
    if emit is not None and "Emission Color" in b.inputs:
        b.inputs["Emission Color"].default_value = (*emit, 1)
        b.inputs["Emission Strength"].default_value = strength
    else:
        if "Emission Strength" in b.inputs:
            b.inputs["Emission Strength"].default_value = 0.0
    return m


def apply_mat(obj, m):
    if obj.data.materials:
        obj.data.materials[0] = m
    else:
        obj.data.materials.append(m)


def capsule(name, loc, radius, depth, axis="Z", segs=12):
    """Cylinder + 2 UV spheres as a capsule, joined, oriented along axis."""
    bpy.ops.mesh.primitive_cylinder_add(vertices=segs, radius=radius, depth=depth * 0.7, location=loc)
    cyl = bpy.context.active_object
    cyl.name = name + "_cyl"
    # end caps
    half = depth * 0.35
    offsets = {
        "Z": [(0, 0, half), (0, 0, -half)],
        "Y": [(0, half, 0), (0, -half, 0)],
        "X": [(half, 0, 0), (-half, 0, 0)],
    }
    spheres = []
    for off in offsets[axis]:
        bpy.ops.mesh.primitive_uv_sphere_add(
            segments=segs, ring_count=segs // 2, radius=radius,
            location=(loc[0] + off[0], loc[1] + off[1], loc[2] + off[2]),
        )
        s = bpy.context.active_object
        spheres.append(s)
    # orient cylinder
    if axis == "Y":
        cyl.rotation_euler = (math.radians(90), 0, 0)
        bpy.ops.object.transform_apply(rotation=True)
    elif axis == "X":
        cyl.rotation_euler = (0, math.radians(90), 0)
        bpy.ops.object.transform_apply(rotation=True)
    bpy.ops.object.select_all(action="DESELECT")
    cyl.select_set(True)
    for s in spheres:
        s.select_set(True)
    bpy.context.view_layer.objects.active = cyl
    bpy.ops.object.join()
    obj = bpy.context.active_object
    obj.name = name
    bpy.ops.object.shade_smooth()
    return obj


def sphere(name, loc, scale, segs=14, rings=8):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segs, ring_count=rings, radius=1, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.scale = scale
    bpy.ops.object.transform_apply(scale=True)
    bpy.ops.object.shade_smooth()
    return o


def cone(name, loc, r1, depth, rot=(0, 0, 0), verts=8):
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r1, radius2=0.005, depth=depth, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.rotation_euler = rot
    bpy.ops.object.transform_apply(rotation=True)
    bpy.ops.object.shade_smooth()
    return o


def clear_prior_fox():
    keep = ("Cam_", "Light_", "Ref_", "MARKER_", "GroundGrid", "World")
    for obj in list(bpy.data.objects):
        if any(obj.name.startswith(p) for p in keep):
            continue
        if obj.type in {"MESH", "ARMATURE", "EMPTY"}:
            # keep review helpers
            if "Ref" in obj.name or "Grid" in obj.name or "Cam" in obj.name or "Light" in obj.name:
                continue
            bpy.data.objects.remove(obj, do_unlink=True)



def paint_materials_by_region(mesh, mats):
    """Force-correct materials after join using face world centroids."""
    m_rust, m_umber, m_cream, m_ember, m_eye, m_nose = mats
    mesh.data.materials.clear()
    for m in mats:
        mesh.data.materials.append(m)
    idx = {m.name: i for i, m in enumerate(mats)}
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(mesh.data)
    bm.faces.ensure_lookup_table()
    # World matrix
    mw = mesh.matrix_world
    for f in bm.faces:
        c = mw @ f.calc_center_median()
        x, y, z = c.x, c.y, c.z
        # Nose tip
        if y > 0.66 and z < 0.62 and abs(x) < 0.05:
            f.material_index = idx["Nose"]
        # Eyes
        elif 0.67 < z < 0.70 and 0.54 < y < 0.58 and 0.035 < abs(x) < 0.08:
            f.material_index = idx["EyeAmber"]
        # Ear tips / ember (high Z ears or anything behind y<-0.38)
        elif z > 0.90 or y < -0.38:
            f.material_index = idx["EmberWisp"]
        # Cream chest / muzzle
        elif (0.30 < z < 0.48 and 0.05 < y < 0.30) or (0.52 < z < 0.62 and y > 0.55):
            f.material_index = idx["FurCream"]
        # Umber lower legs / feet
        elif z < 0.26:
            f.material_index = idx["FurUmber"]
        else:
            f.material_index = idx["FurRust"]
    bm.to_mesh(mesh.data)
    bm.free()
    mesh.data.update()


def build_mesh(mats):
    m_rust, m_umber, m_cream, m_ember, m_eye, m_nose = mats
    parts = []

    # === BODY: slender elongated — length along Y, shoulder height ~0.48 ===
    # Torso length ~0.55, height 0.18, width 0.16
    body = sphere("Fox_Body", (0, 0.0, 0.48), (0.13, 0.32, 0.15), 18, 12)
    apply_mat(body, m_rust); parts.append(body)

    # Hips slightly thicker
    hips = sphere("Fox_Hips", (0, -0.22, 0.46), (0.12, 0.14, 0.14), 14, 10)
    apply_mat(hips, m_rust); parts.append(hips)

    # Chest cream underbelly — forward lower
    chest = sphere("Fox_Chest", (0, 0.18, 0.40), (0.10, 0.16, 0.11), 12, 8)
    apply_mat(chest, m_cream); parts.append(chest)

    # Neck slender
    neck = sphere("Fox_Neck", (0, 0.34, 0.58), (0.07, 0.10, 0.08), 12, 8)
    apply_mat(neck, m_rust); parts.append(neck)

    # Head — elongated muzzle, calm
    head = sphere("Fox_Head", (0, 0.48, 0.66), (0.11, 0.14, 0.11), 16, 10)
    apply_mat(head, m_rust); parts.append(head)
    muzzle = sphere("Fox_Muzzle", (0, 0.60, 0.58), (0.055, 0.10, 0.045), 12, 8)
    apply_mat(muzzle, m_cream); parts.append(muzzle)
    nose = sphere("Fox_Nose", (0, 0.70, 0.575), (0.02, 0.025, 0.018), 8, 6)
    apply_mat(nose, m_nose); parts.append(nose)

    # Narrow amber eyes (flattened)
    for side, sx in (("L", -1), ("R", 1)):
        eye = sphere(f"Fox_Eye_{side}", (sx * 0.055, 0.56, 0.685), (0.022, 0.006, 0.010), 10, 8)
        apply_mat(eye, m_eye); parts.append(eye)

    # Large upright ears — tips dissolve to ember
    for side, sx in (("L", -1), ("R", 1)):
        ear = cone(
            f"Fox_Ear_{side}",
            (sx * 0.08, 0.46, 0.84),
            r1=0.055, depth=0.20,
            rot=(math.radians(-20), math.radians(sx * 10), math.radians(sx * 5)),
        )
        apply_mat(ear, m_rust); parts.append(ear)
        tip = sphere(f"Fox_EarTip_{side}", (sx * 0.09, 0.43, 0.95), (0.03, 0.03, 0.045), 8, 6)
        apply_mat(tip, m_ember); parts.append(tip)

    # === LEGS: long thin — shoulder 0.48, feet at z~0.02 ===
    # Front legs at y=+0.18, back at y=-0.22
    def make_leg(tag, x, y, upper_z, knee_z, foot_z):
        # upper thigh
        u = sphere(f"Fox_Thigh_{tag}", (x, y, upper_z), (0.04, 0.04, 0.11), 10, 8)
        apply_mat(u, m_rust); parts.append(u)
        # shin umber
        s = sphere(f"Fox_Shin_{tag}", (x * 1.05, y + (0.02 if "F" in tag else -0.02), knee_z), (0.032, 0.032, 0.10), 10, 8)
        apply_mat(s, m_umber); parts.append(s)
        # foot
        f = sphere(f"Fox_Foot_{tag}", (x * 1.05, y + (0.04 if "F" in tag else -0.04), foot_z), (0.04, 0.06, 0.025), 8, 6)
        apply_mat(f, m_umber); parts.append(f)

    make_leg("FL", -0.10, 0.18, 0.36, 0.18, 0.03)
    make_leg("FR", 0.10, 0.18, 0.36, 0.18, 0.03)
    make_leg("BL", -0.10, -0.22, 0.38, 0.20, 0.03)
    make_leg("BR", 0.10, -0.22, 0.38, 0.20, 0.03)

    # === TAIL: bushy plume dissolving into ember-orange/gold ===
    # Concept: large smoky plume trailing back and up
    tail_specs = [
        # (y, z, sx, sy, sz) — growing then dissolving
        (-0.40, 0.50, 0.10, 0.14, 0.10),
        (-0.55, 0.56, 0.12, 0.16, 0.12),
        (-0.72, 0.64, 0.13, 0.18, 0.14),
        (-0.90, 0.74, 0.12, 0.18, 0.15),
        (-1.08, 0.86, 0.10, 0.16, 0.14),
        (-1.24, 0.98, 0.07, 0.12, 0.12),
        (-1.36, 1.08, 0.045, 0.08, 0.09),
    ]
    for i, (y, z, sx, sy, sz) in enumerate(tail_specs):
        t = sphere(f"Fox_Tail_{i}", (0, y, z), (sx, sy, sz), 12, 8)
        apply_mat(t, m_ember); parts.append(t)

    # Leaf-ember cards near tip
    for i, (x, y, z, rx, ry, rz) in enumerate([
        (-0.06, -1.20, 1.02, 50, 15, 20),
        (0.07, -1.28, 0.95, 40, -20, -15),
        (0.0, -1.38, 1.10, 70, 5, 40),
        (-0.04, -1.32, 1.15, 30, 25, -30),
    ]):
        bpy.ops.mesh.primitive_plane_add(size=0.07, location=(x, y, z))
        leaf = bpy.context.active_object
        leaf.name = f"Fox_Leaf_{i}"
        leaf.rotation_euler = (math.radians(rx), math.radians(ry), math.radians(rz))
        apply_mat(leaf, m_ember); parts.append(leaf)

    # Join
    bpy.ops.object.select_all(action="DESELECT")
    for o in parts:
        o.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.join()
    mesh = bpy.context.active_object
    mesh.name = "SpiritFox_Mesh"
    # Re-assign materials by face centroid (join can scramble slot mapping visually)
    paint_materials_by_region(mesh, mats)
    bpy.context.scene.cursor.location = (0, 0, 0)
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
    return mesh


def build_armature():
    bpy.ops.object.armature_add(enter_editmode=True, location=(0, 0, 0))
    arm = bpy.context.active_object
    arm.name = "SpiritFox_Armature"
    eb = arm.data.edit_bones
    root = eb[0]
    root.name = "Root"
    root.head, root.tail = (0, 0, 0), (0, 0, 0.12)

    def bone(name, head, tail, parent=None):
        b = eb.new(name)
        b.head, b.tail = head, tail
        if parent:
            b.parent = parent
            b.use_connect = False
        return b

    hips = bone("Hips", (0, -0.05, 0.35), (0, 0.05, 0.48), root)
    spine = bone("Spine", (0, 0.05, 0.48), (0, 0.20, 0.50), hips)
    chest = bone("Chest", (0, 0.20, 0.50), (0, 0.34, 0.56), spine)
    neck = bone("Neck", (0, 0.34, 0.56), (0, 0.42, 0.62), chest)
    head = bone("Head", (0, 0.42, 0.62), (0, 0.58, 0.70), neck)
    bone("Ear_L", (-0.06, 0.46, 0.78), (-0.09, 0.43, 0.96), head)
    bone("Ear_R", (0.06, 0.46, 0.78), (0.09, 0.43, 0.96), head)

    def leg(prefix, side, y):
        x = 0.10 * side
        lab = "L" if side < 0 else "R"
        thigh = bone(f"{prefix}Thigh_{lab}", (x, y, 0.42), (x, y, 0.24), hips)
        shin = bone(f"{prefix}Shin_{lab}", (x, y, 0.24), (x, y + 0.02 * (1 if prefix == "Front" else -1), 0.08), thigh)
        bone(f"{prefix}Foot_{lab}", (x, y + 0.02 * (1 if prefix == "Front" else -1), 0.08),
             (x, y + 0.06 * (1 if prefix == "Front" else -1), 0.02), shin)

    leg("Front", -1, 0.18)
    leg("Front", 1, 0.18)
    leg("Back", -1, -0.22)
    leg("Back", 1, -0.22)

    prev = hips
    pts = [
        (0, -0.35, 0.48), (0, -0.52, 0.54), (0, -0.70, 0.62),
        (0, -0.88, 0.72), (0, -1.06, 0.84), (0, -1.22, 0.96), (0, -1.36, 1.06),
    ]
    for i in range(6):
        b = bone(f"Tail{i+1}", pts[i], pts[i + 1], prev)
        prev = b

    bpy.ops.object.mode_set(mode="OBJECT")
    return arm


def parent_mesh(mesh, arm):
    # Manual vertex groups approx — use envelope for reliability after heat fail
    bpy.ops.object.select_all(action="DESELECT")
    mesh.select_set(True)
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    # Try heat; if fails envelopes still work for export structure
    bpy.ops.object.parent_set(type="ARMATURE_AUTO")
    # Ensure armature modifier uses envelopes as fallback
    for mod in mesh.modifiers:
        if mod.type == "ARMATURE":
            mod.use_bone_envelopes = True
            mod.use_vertex_groups = True


def ensure_cameras():
    if bpy.data.objects.get("Cam_Front"):
        return
    bpy.ops.mesh.primitive_grid_add(size=4, location=(0, 0, 0))
    bpy.context.active_object.name = "GroundGrid"
    bpy.ops.object.light_add(type="AREA", location=(2.5, -2.5, 3.2))
    bpy.context.active_object.data.energy = 120
    bpy.context.active_object.data.size = 3
    bpy.ops.object.light_add(type="AREA", location=(-2, -1, 2.2))
    bpy.context.active_object.data.energy = 40
    bpy.ops.object.light_add(type="AREA", location=(0, 2, 2))
    bpy.context.active_object.data.energy = 25
    look = Vector((0, -0.1, 0.55))
    for name, loc in [
        ("Cam_Front", (0, -2.8, 0.85)),
        ("Cam_Side", (2.8, 0, 0.85)),
        ("Cam_ThreeQ", (2.0, -2.0, 1.0)),
        ("Cam_Back", (0, 2.6, 0.9)),
    ]:
        bpy.ops.object.camera_add(location=loc)
        cam = bpy.context.active_object
        cam.name = name
        cam.data.lens = 50
        cam.rotation_euler = (look - Vector(loc)).to_track_quat("-Z", "Y").to_euler()


def render_views():
    PREV.mkdir(parents=True, exist_ok=True)
    sc = bpy.context.scene
    # Darker warm ground so orange reads
    if sc.world is None:
        sc.world = bpy.data.worlds.new("W")
    sc.world.use_nodes = True
    bg = sc.world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs["Color"].default_value = (0.12, 0.11, 0.10, 1)
        bg.inputs["Strength"].default_value = 0.6
    sc.render.engine = "BLENDER_EEVEE_NEXT"
    sc.view_settings.view_transform = "Standard"
    sc.view_settings.look = "None"
    sc.render.resolution_x = sc.render.resolution_y = 512
    sc.eevee.taa_render_samples = 16
    # Enable bloom if available
    if hasattr(sc.eevee, "use_bloom"):
        sc.eevee.use_bloom = True
        sc.eevee.bloom_intensity = 0.4
        sc.eevee.bloom_threshold = 0.6
    for key, cname in [("front", "Cam_Front"), ("side", "Cam_Side"),
                       ("three_q", "Cam_ThreeQ"), ("back", "Cam_Back")]:
        cam = bpy.data.objects.get(cname)
        if not cam:
            continue
        sc.camera = cam
        path = PREV / f"fox_model_{key}.png"
        sc.render.filepath = str(path)
        bpy.ops.render.render(write_still=True)
        print("Rendered", path)


def export(mesh, arm):
    OUT_GLB.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    mesh.select_set(True)
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.export_scene.gltf(
        filepath=str(OUT_GLB),
        export_format="GLB",
        use_selection=True,
        export_animations=False,
        export_skins=True,
        export_apply=False,
    )
    tris = sum(len(p.vertices) - 2 for p in mesh.data.polygons)
    print(f"Exported {OUT_GLB} tris={tris} bones={len(arm.data.bones)}")
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT_BLEND))
    try:
        bpy.ops.wm.save_as_mainfile(filepath=str(REVIEW))
    except Exception as e:
        print("review save", e)


def main():
    ensure_cameras()
    clear_prior_fox()
    mats = (
        mat("FurRust", RUST, 0.65),
        mat("FurUmber", UMBER, 0.7),
        mat("FurCream", CREAM, 0.5),
        mat("EmberWisp", (1.0, 0.25, 0.0), 0.3, strength=2.2, emit_only=True),
        mat("EyeAmber", AMBER, 0.25, emit=AMBER, strength=0.8),
        mat("Nose", NOSE_C, 0.4),
    )
    mesh = build_mesh(mats)
    arm = build_armature()
    parent_mesh(mesh, arm)
    render_views()
    export(mesh, arm)
    print("DONE build_spirit_fox_model v2 slender")


if __name__ == "__main__":
    main()
