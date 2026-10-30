import math
from pathlib import Path
import bpy

ROOT = Path("/workspace/siyu/playtest-forge")
OUT = ROOT / "assets/enemies/ink_ashling.glb"
PREV = ROOT / "assets/previews/ink_ashling.png"

def mat(name, color, rough=0.8, emit=None, s=0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rough
    if emit and "Emission Color" in b.inputs:
        b.inputs["Emission Color"].default_value = (*emit, 1)
        b.inputs["Emission Strength"].default_value = s
    return m

def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    ink = mat("Ink", (0.04, 0.04, 0.05), 0.9)
    eye = mat("InkEye", (0.7, 0.15, 0.05), 0.3, emit=(1.0, 0.25, 0.05), s=2.0)

    # Body - tall blob
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=0.22, location=(0, 0, 0.45))
    body = bpy.context.active_object; body.name = "AshBody"
    body.scale = (0.85, 0.85, 1.3); bpy.ops.object.transform_apply(scale=True)
    body.data.materials.append(ink)

    # Head
    bpy.ops.mesh.primitive_uv_sphere_add(segments=10, ring_count=8, radius=0.16, location=(0, 0.05, 0.78))
    head = bpy.context.active_object; head.name = "AshHead"
    head.data.materials.append(ink)

    # Spiky legs (6)
    for i in range(6):
        ang = i * math.pi / 3
        x, y = math.cos(ang) * 0.22, math.sin(ang) * 0.22
        bpy.ops.mesh.primitive_cone_add(vertices=5, radius1=0.06, radius2=0.01, depth=0.28,
                                       location=(x, y, 0.14))
        leg = bpy.context.active_object; leg.name = f"AshLeg{i}"
        leg.rotation_euler = (math.radians(25), 0, ang)
        bpy.ops.object.transform_apply(rotation=True)
        leg.data.materials.append(ink)

    # Glowing eyes
    for sx in (-1, 1):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=8, ring_count=6, radius=0.035,
                                            location=(sx * 0.07, 0.16, 0.82))
        e = bpy.context.active_object; e.name = f"AshEye{'L' if sx<0 else 'R'}"
        e.scale = (1, 0.5, 0.7); bpy.ops.object.transform_apply(scale=True)
        e.data.materials.append(eye)

    # Ash wisps on top
    for i, (x, y, z) in enumerate([(-0.05, 0, 1.0), (0.06, 0.02, 1.05), (0, -0.04, 1.08)]):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=6, ring_count=4, radius=0.05, location=(x, y, z))
        w = bpy.context.active_object; w.name = f"AshWisp{i}"
        w.data.materials.append(ink)

    bpy.ops.object.select_all(action="SELECT")
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.join()
    mesh = bpy.context.active_object; mesh.name = "InkAshling"
    bpy.ops.object.shade_smooth()

    OUT.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(OUT), export_format="GLB", export_apply=True)

    sc = bpy.context.scene
    world = bpy.data.worlds.new("W"); sc.world = world; world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.18, 0.16, 0.14, 1)
    bpy.ops.object.light_add(type="AREA", location=(2, -2, 3)); bpy.context.active_object.data.energy = 60
    bpy.ops.object.camera_add(location=(1.2, -1.6, 1.0), rotation=(math.radians(72), 0, math.radians(35)))
    sc.camera = bpy.context.active_object
    sc.render.engine = "BLENDER_EEVEE_NEXT"
    sc.view_settings.view_transform = "Standard"
    sc.render.resolution_x = sc.render.resolution_y = 512
    sc.eevee.taa_render_samples = 16
    PREV.parent.mkdir(parents=True, exist_ok=True)
    sc.render.filepath = str(PREV)
    bpy.ops.render.render(write_still=True)
    print("OK", OUT)

if __name__ == "__main__":
    main()
