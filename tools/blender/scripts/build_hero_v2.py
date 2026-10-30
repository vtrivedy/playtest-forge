"""
Hero v2 — Spirit Fox restyle of the CC0 Quaternius fox (assets/hero/source/fox_quaternius_raw.glb).
Stages: re-proportion rest pose to the art lock -> smooth continuous mesh -> (later) fur bake,
ember tail, tufts, eyes -> 9 game clips -> GLB.
blender -b -P build_hero_v2.py -- out.glb [stage]
"""
import sys, math
import bpy, bmesh
from mathutils import Vector, Matrix

ROOT = "/workspace/siyu/playtest-forge"
SRC = f"{ROOT}/assets/hero/source/fox_quaternius_raw.glb"
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = argv[0] if argv else f"{ROOT}/assets/hero/candidates/opus/spirit_fox_v2.glb"

bpy.ops.wm.read_factory_settings(use_empty=True)
for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
bpy.ops.import_scene.gltf(filepath=SRC)
sc = bpy.context.scene
arm = next(o for o in sc.objects if o.type == "ARMATURE")
fox = next(o for o in sc.objects if o.type == "MESH" and o.name == "Fox")
for o in [o for o in sc.objects if o.type == "MESH" and o is not fox]:
    bpy.data.objects.remove(o, do_unlink=True)
arm.name = "SpiritFox_Armature"; fox.name = "SpiritFox_Body"
SRC_ACTIONS = {a.name.split("_AnimalArmature")[0]: a for a in bpy.data.actions}
arm.animation_data_create(); arm.animation_data.action = None

def upd(): bpy.context.view_layer.update()

# ---------------------------------------------------------------- re-proportion
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode="POSE")
for pb in arm.pose.bones: pb.matrix_basis.identity()
upd()
P = arm.pose.bones

def rot_world(name, axis, deg):
    pb = P[name]
    h = pb.head.copy()
    R = Matrix.Translation(h) @ Matrix.Rotation(math.radians(deg), 4, axis) @ Matrix.Translation(-h)
    pb.matrix = R @ pb.matrix
    upd()

def scl(name, sx=1.0, sy=1.0, sz=1.0):
    P[name].scale = (sx, sy, sz); upd()

# neck up, head held level (calm, alert carriage like the turnaround)
rot_world("Neck1", "X", -22)
rot_world("Neck2", "X", -12)
rot_world("Neck3", "X", -6)
rot_world("Head", "X", 34)
scl("Head", 1.12, 1.08, 1.12)
# tall ears, more upright
for s in ("L", "R"):
    sign = 1 if s == "L" else -1
    rot_world(f"Ear1.{s}", "Y", -14 * sign)
    rot_world(f"Ear1.{s}", "X", 6)
    scl(f"Ear1.{s}", 1.05, 1.38, 1.05)
# slender, slightly longer legs
for s in ("L", "R"):
    scl(f"FrontUpperLeg.{s}", 0.93, 1.07, 0.93)
    scl(f"BackUpperLeg.{s}", 0.88, 1.07, 0.88)
# tail: droop from the rump, then sweep back/up (bushy plume rebuilt later)
rot_world("Tail1", "X", -36)
scl("Tail1", 1.32, 1.32, 1.32)
rot_world("Tail3", "X", 2)
rot_world("Tail5", "X", 14)
rot_world("Tail7", "X", 30)

bpy.ops.object.mode_set(mode="OBJECT")
# bake posed shape into mesh, then make it the rest pose
bpy.context.view_layer.objects.active = fox
mod = next(m for m in fox.modifiers if m.type == "ARMATURE")
bpy.ops.object.modifier_apply(modifier=mod.name)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode="POSE")
bpy.ops.pose.armature_apply(selected=False)
bpy.ops.object.mode_set(mode="OBJECT")
m = fox.modifiers.new("Armature", "ARMATURE"); m.object = arm

# ---------------------------------------------------------------- smooth continuous mesh
bpy.context.view_layer.objects.active = fox
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.mesh.remove_doubles(threshold=0.002)
bpy.ops.object.mode_set(mode="OBJECT")
sub = fox.modifiers.new("Sub", "SUBSURF"); sub.levels = 1; sub.render_levels = 1
bpy.ops.object.modifier_move_to_index(modifier="Sub", index=0)
bpy.ops.object.modifier_apply(modifier="Sub")
for p in fox.data.polygons: p.use_smooth = True
if hasattr(fox.data, "use_auto_smooth"): fox.data.use_auto_smooth = False

STAGE = argv[1] if len(argv) > 1 else "all"
if STAGE != "proportion":
    exec(open(f"{ROOT}/tools/blender/scripts/build_hero_v2_look.py").read())
if STAGE == "all":
    exec(open(f"{ROOT}/tools/blender/scripts/build_hero_v2_anims.py").read())

# ---------------------------------------------------------------- export
if not arm.animation_data.action and "idle" in bpy.data.actions:
    arm.animation_data.action = bpy.data.actions["idle"]
for a in list(bpy.data.actions):
    if a.name.endswith("_AnimalArmature") and STAGE != "all":
        continue
    if a.name.endswith("_AnimalArmature"):
        bpy.data.actions.remove(a)
bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_animations=True,
    export_animation_mode="ACTIONS", export_force_sampling=True, export_optimize_animation_size=True,
    export_def_bones=False, export_yup=True, export_apply=False, export_image_format="AUTO")
import os; print("EXPORTED", OUT, os.path.getsize(OUT))
