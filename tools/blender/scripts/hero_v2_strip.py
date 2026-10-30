"""Fast side-view filmstrip of an action (Workbench). 
blender -b -P hero_v2_strip.py -- in.glb out.png action f0,f1,... [view]"""
import sys, math, bpy
from mathutils import Vector
a = sys.argv[sys.argv.index("--") + 1:]
glb, out, act_name, frames = a[0], a[1], a[2], [float(x) for x in a[3].split(",")]
view = a[4] if len(a) > 4 else "side"
bpy.ops.wm.read_factory_settings(use_empty=True)
for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
bpy.ops.import_scene.gltf(filepath=glb)
sc = bpy.context.scene
arm = next(o for o in sc.objects if o.type == "ARMATURE")
for o in [o for o in sc.objects if o.type == "MESH" and not any(m.type == "ARMATURE" for m in o.modifiers)]:
    bpy.data.objects.remove(o, do_unlink=True)
act = next(x for x in bpy.data.actions if x.name == act_name or x.name.startswith(act_name + "_"))
arm.animation_data_create(); arm.animation_data.action = act
sc.render.engine = "BLENDER_WORKBENCH"
sc.display.shading.light = "STUDIO"; sc.display.shading.color_type = "TEXTURE"
sc.display.shading.show_shadows = False
sc.render.resolution_x, sc.render.resolution_y = 360, 300
bpy.ops.object.camera_add(); cam = bpy.context.active_object; sc.camera = cam
cam.data.type = "ORTHO"
meshes = [o for o in sc.objects if o.type == "MESH"]
dg = bpy.context.evaluated_depsgraph_get()
def bb():
    lo = Vector((1e9,)*3); hi = -lo
    for o in meshes:
        e = o.evaluated_get(dg); m = e.to_mesh()
        for v in m.vertices:
            w = e.matrix_world @ v.co; lo = Vector(map(min, lo, w)); hi = Vector(map(max, hi, w))
        e.to_mesh_clear()
    return lo, hi
sc.frame_set(0); lo, hi = bb(); size = max(hi - lo) * 1.5; c = (lo + hi) / 2
cam.data.ortho_scale = size
d = Vector((1, 0, 0)) if view == "side" else Vector((0.7, -0.7, 0.2)).normalized()
cam.location = c + d * 20; cam.rotation_euler = (-d).to_track_quat("-Z", "Y").to_euler()
import subprocess, os
paths = []
for i, f in enumerate(frames):
    sc.frame_set(int(f), subframe=f % 1)
    sc.render.filepath = f"{out}.f{i:02d}.png"; bpy.ops.render.render(write_still=True)
    paths.append(sc.render.filepath)
# compose with system python (Blender's python has no PIL)
code = """
import sys
from PIL import Image, ImageDraw
out, label, frames, *paths = sys.argv[1:]
frames = frames.split(',')
ims = [Image.open(p).convert('RGB') for p in paths]
w, h = ims[0].size; cols = min(6, len(ims)); rows = (len(ims) + cols - 1) // cols
sheet = Image.new('RGB', (w * cols, h * rows), (255, 255, 255))
for i, im in enumerate(ims):
    ImageDraw.Draw(im).text((4, 4), label + ' f' + frames[i], fill=(0, 0, 0))
    sheet.paste(im, ((i % cols) * w, (i // cols) * h))
sheet.save(out)
"""
subprocess.run(["python3", "-c", code, out, act_name, a[3], *paths], check=True)
for p in paths: os.remove(p)
print("strip", out)
