import math
from pathlib import Path
import bpy

ROOT = Path("/workspace/siyu/playtest-forge")
OUT = ROOT / "assets/env/procedural/ember_mote.glb"
PREV = ROOT / "assets/previews/ember_mote.png"

def emission(name, color, strength):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    e = nt.nodes.new("ShaderNodeEmission")
    e.inputs["Color"].default_value = (*color, 1)
    e.inputs["Strength"].default_value = strength
    nt.links.new(e.outputs["Emission"], out.inputs["Surface"])
    return m

def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.1, location=(0, 0, 0.1))
    gem = bpy.context.active_object
    gem.name = "EmberMote"
    gem.scale = (1, 1, 1.25)
    bpy.ops.object.transform_apply(scale=True)
    for p in gem.data.polygons:
        p.use_smooth = False
    gem.data.materials.append(emission("EmberCore", (1.0, 0.22, 0.0), 3.0))

    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.18, location=(0, 0, 0.1))
    shell = bpy.context.active_object
    shell.name = "EmberHalo"
    for p in shell.data.polygons:
        p.use_smooth = False
    shell.data.materials.append(emission("EmberHalo", (1.0, 0.35, 0.0), 1.2))

    bpy.ops.object.empty_add(location=(0, 0, 0))
    root = bpy.context.active_object
    root.name = "EmberMote_Root"
    gem.parent = root
    shell.parent = root

    OUT.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(OUT), export_format="GLB", export_apply=True)

    sc = bpy.context.scene
    world = bpy.data.worlds.new("W"); sc.world = world; world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.02, 0.015, 0.02, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.15
    bpy.ops.object.camera_add(location=(0.45, -0.55, 0.32), rotation=(math.radians(68), 0, math.radians(40)))
    sc.camera = bpy.context.active_object
    sc.render.engine = "BLENDER_EEVEE_NEXT"
    sc.view_settings.view_transform = "Standard"
    sc.view_settings.look = "None"
    sc.render.resolution_x = sc.render.resolution_y = 512
    sc.eevee.taa_render_samples = 16
    PREV.parent.mkdir(parents=True, exist_ok=True)
    sc.render.filepath = str(PREV)
    bpy.ops.render.render(write_still=True)
    print("OK", OUT)

if __name__ == "__main__":
    main()
