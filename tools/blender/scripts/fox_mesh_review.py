"""
Spirit fox review renders in the locked review scene (tools/blender/tmp/review_scene.blend).
Imports a GLB, normalises to game height (1.25, feet on z=0, centred), renders Cam_Front/Side/ThreeQ/Back.
Ref_* planes are hidden from render so the fox reads cleanly against the grid.
Usage: blender -b -P fox_mesh_review.py -- in.glb out_prefix [action[:frame] ...]
  rest pose      -> out_prefix_{front,side,three_q,back}.png
  action[:frame] -> out_prefix_<action>.png (Cam_Side) — anim spot checks
"""
import sys
import bpy
from mathutils import Vector

ROOT = "/workspace/siyu/playtest-forge"
args = sys.argv[sys.argv.index("--") + 1:]
GLB, PREFIX = args[0], args[1]
POSES = args[2:]
bpy.ops.wm.open_mainfile(filepath=f"{ROOT}/tools/blender/tmp/review_scene.blend")
sc = bpy.context.scene
for o in list(sc.objects):
    if not o.name.startswith(("Cam_", "Light_", "Ref_", "MARKER_", "GroundGrid")):
        bpy.data.objects.remove(o, do_unlink=True)
    elif o.name.startswith("Ref_"):
        o.hide_render = True
before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=GLB)
new = [o for o in bpy.data.objects if o not in before]
arm = next((o for o in new if o.type == "ARMATURE"), None)
for o in [o for o in new if o.type == "MESH" and arm and not any(m.type == "ARMATURE" for m in o.modifiers)]:
    bpy.data.objects.remove(o, do_unlink=True)
meshes = [o for o in bpy.data.objects if o.type == "MESH" and o in new and o.name in bpy.data.objects]
top = arm or meshes[0]
while top.parent: top = top.parent

def bbox():
    dg = bpy.context.evaluated_depsgraph_get(); lo = Vector((1e9,) * 3); hi = -lo
    for o in meshes:
        ev = o.evaluated_get(dg); m = ev.to_mesh()
        for v in m.vertices:
            w = ev.matrix_world @ v.co; lo = Vector(map(min, lo, w)); hi = Vector(map(max, hi, w))
        ev.to_mesh_clear()
    return lo, hi

def rest():
    if arm:
        if arm.animation_data: arm.animation_data.action = None
        for pb in arm.pose.bones: pb.matrix_basis.identity()
    bpy.context.view_layer.update()

rest()
lo, hi = bbox()
top.scale = top.scale * (1.25 / (hi.z - lo.z)); bpy.context.view_layer.update()
lo, hi = bbox()
top.location -= Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z)); bpy.context.view_layer.update()
sc.eevee.taa_render_samples = 16
sc.render.resolution_x = sc.render.resolution_y = 640
CAMS = {"front": "Cam_Front", "side": "Cam_Side", "three_q": "Cam_ThreeQ", "back": "Cam_Back"}
def shot(cam, path):
    sc.camera = bpy.data.objects[cam]; sc.render.filepath = path
    bpy.ops.render.render(write_still=True); print("WROTE", path)
if not POSES:
    for k, c in CAMS.items(): shot(c, f"{PREFIX}_{k}.png")
for pose in POSES:
    name, _, fr = pose.partition(":")
    act = next(a for a in bpy.data.actions if a.name == name or a.name.startswith(name + "_"))
    arm.animation_data_create(); arm.animation_data.action = act
    f = float(fr) if fr else sum(act.frame_range) / 2
    sc.frame_set(int(f), subframe=f % 1)
    shot("Cam_Side", f"{PREFIX}_{name}{'@' + fr if fr else ''}.png")
