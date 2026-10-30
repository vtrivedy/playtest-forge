"""
Hero v2 review renderer: import a GLB, pose an action at a frame, render locked
front/side/three_q/back cameras (fox faces -Y, i.e. glTF +Z) with fixed lights.
Usage: blender -b -P hero_v2_review.py -- in.glb out_prefix [action[:frame] ...]
Writes out_prefix_<view>[_<action>].png. Compose with tools/hero_v2_sheet.py.
"""
import sys, math
import bpy
from mathutils import Vector

args = sys.argv[sys.argv.index("--") + 1:]
GLB, PREFIX = args[0], args[1]
POSES = args[2:] or ["rest"]
VIEWS = {  # camera dir from target (unit-ish), lens
    "front":   ((0, -1, 0.12), 50),
    "side":    ((1, 0, 0.08), 50),
    "three_q": ((0.75, -0.66, 0.16), 50),
    "back":    ((0, 1, 0.14), 50),
    "face":    ((0.35, -1, 0.12), 50),
}
RES = (640, 480)

bpy.ops.wm.read_factory_settings(use_empty=True)
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)
bpy.ops.import_scene.gltf(filepath=GLB)
sc = bpy.context.scene
arm = next((o for o in sc.objects if o.type == "ARMATURE"), None)
meshes = [o for o in sc.objects if o.type == "MESH"]
if arm:  # drop stray bone-widget meshes (e.g. Icosphere) that are not skinned
    for o in [m for m in meshes if not any(md.type == "ARMATURE" for md in m.modifiers)]:
        bpy.data.objects.remove(o, do_unlink=True)
    meshes = [o for o in sc.objects if o.type == "MESH"]

def bbox():
    dg = bpy.context.evaluated_depsgraph_get()
    lo = Vector((1e9,) * 3); hi = Vector((-1e9,) * 3)
    for o in meshes:
        ev = o.evaluated_get(dg)
        for v in ev.to_mesh().vertices:
            w = ev.matrix_world @ v.co
            lo = Vector(map(min, lo, w)); hi = Vector(map(max, hi, w))
        ev.to_mesh_clear()
    return lo, hi

# normalise like the game: longest axis -> 1.35, feet on z=0 (rest pose)
lo, hi = bbox()
s = 1.35 / max(hi - lo)
root = arm or meshes[0]
top = root
while top.parent: top = top.parent
top.scale = top.scale * s
bpy.context.view_layer.update()
lo, hi = bbox()
top.location -= Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))
bpy.context.view_layer.update()

# ground + lights + world (warm parchment studio)
bpy.ops.mesh.primitive_plane_add(size=12)
g = bpy.context.active_object
gm = bpy.data.materials.new("G"); gm.use_nodes = True
bs = next(n for n in gm.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
bs.inputs["Base Color"].default_value = (0.62, 0.52, 0.40, 1); bs.inputs["Roughness"].default_value = 0.9
g.data.materials.append(gm)
w = bpy.data.worlds.new("W"); sc.world = w; w.use_nodes = True
bg = next(n for n in w.node_tree.nodes if n.type == "BACKGROUND")
bg.inputs["Color"].default_value = (0.78, 0.68, 0.54, 1); bg.inputs["Strength"].default_value = 0.55
def light(t, loc, e, size=2.0, col=(1, 1, 1)):
    bpy.ops.object.light_add(type=t, location=loc)
    l = bpy.context.active_object; l.data.energy = e; l.data.color = col
    if t == "AREA": l.data.size = size
    d = Vector((0, 0, 0.35)) - Vector(loc)
    l.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
light("SUN", (2, -3, 5), 3.0, col=(1.0, 0.92, 0.8))
light("AREA", (-2.5, -1.5, 2), 60, 3, (0.9, 0.85, 1.0))
light("AREA", (0.5, 3, 2.2), 120, 2, (1.0, 0.75, 0.5))
try: sc.render.engine = "BLENDER_EEVEE_NEXT"
except TypeError as e: print(e)
sc.eevee.taa_render_samples = 24
sc.render.resolution_x, sc.render.resolution_y = RES
sc.view_settings.view_transform = "AgX" if "AgX" in [i.identifier for i in bpy.types.ColorManagedViewSettings.bl_rna.properties["view_transform"].enum_items] else "Filmic"
try: sc.eevee.use_shadows = True
except Exception: pass

bpy.ops.object.camera_add(); cam = bpy.context.active_object; sc.camera = cam

for pose in POSES:
    name, _, fr = pose.partition(":")
    if arm and name != "rest":
        act = next((a for a in bpy.data.actions if a.name == name or a.name.startswith(name + "_") or a.name.endswith("|" + name)), None)
        if act is None:
            print("NO ACTION", name, [a.name for a in bpy.data.actions]); continue
        arm.animation_data_create(); arm.animation_data.action = act
        f = float(fr) if fr else (act.frame_range[0] + act.frame_range[1]) / 2
        sc.frame_set(int(f), subframe=f % 1)
    elif arm and arm.animation_data:
        arm.animation_data.action = None
        for pb in arm.pose.bones: pb.matrix_basis.identity()
        sc.frame_set(0)
    bpy.context.view_layer.update()
    lo, hi = bbox()
    c = (lo + hi) / 2
    print('BBOX', lo, hi)
    rad = max(hi - lo) * 0.5
    for vname, (d, lens) in VIEWS.items():
        cam.data.lens = lens
        dist = rad / math.tan(cam.data.angle / 2) * 1.25
        dv = Vector(d).normalized()
        if vname == "face":
            if name != "rest": continue
            cf = Vector((0, lo.y + (hi.y - lo.y) * 0.1, lo.z + (hi.z - lo.z) * 0.78))
            cam.location = cf + dv * dist * 0.28
            cam.rotation_euler = (-dv).to_track_quat("-Z", "Y").to_euler()
            sc.render.filepath = f"{PREFIX}_face.png"; bpy.ops.render.render(write_still=True); continue
        cam.location = c + dv * dist
        cam.rotation_euler = (-dv).to_track_quat("-Z", "Y").to_euler()
        suf = "" if name == "rest" else "_" + name + (("@" + fr) if fr else "")
        sc.render.filepath = f"{PREFIX}_{vname}{suf}.png"
        bpy.ops.render.render(write_still=True)
        print("WROTE", sc.render.filepath)
