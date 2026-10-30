
import sys, math
from pathlib import Path
import bpy
glb, out = sys.argv[sys.argv.index("--")+1:]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=glb)
# frame
objs = [o for o in bpy.data.objects if o.type=="MESH"]
# camera
bpy.ops.object.camera_add(location=(3.5,-3.5,2.5))
cam=bpy.context.active_object
cam.rotation_euler=(math.radians(65),0,math.radians(45))
sc=bpy.context.scene; sc.camera=cam
world=bpy.data.worlds.new("W"); sc.world=world; world.use_nodes=True
world.node_tree.nodes["Background"].inputs["Color"].default_value=(0.15,0.13,0.11,1)
bpy.ops.object.light_add(type="SUN", location=(2,-2,5)); bpy.context.active_object.data.energy=2.5
bpy.ops.object.light_add(type="AREA", location=(-2,1,3)); bpy.context.active_object.data.energy=40
sc.render.engine="BLENDER_EEVEE_NEXT"; sc.render.resolution_x=sc.render.resolution_y=512
sc.eevee.taa_render_samples=16; sc.render.filepath=out
bpy.ops.render.render(write_still=True)
print("preview", out)
