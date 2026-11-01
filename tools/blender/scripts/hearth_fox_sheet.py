"""Clip contact frames: workbench side + 3/4 renders of authored source clips (headless review, no capture slot).

FOX_STAGE=anim FOX_SHEET=/tmp/out FOX_CLIPS=run,jump_up blender -b --python hearth_fox_all.py --python hearth_fox_sheet.py
Writes <FOX_SHEET>/<clip>_<view>_<frame>.png; compose with tools/blender/scripts/hearth_fox_sheet_compose.py.
"""
import bpy, os, math
from mathutils import Vector

rig = bpy.data.objects["fox_rig"]
out = os.environ.get("FOX_SHEET", "/tmp/fox_sheet")
os.makedirs(out, exist_ok=True)
clips = os.environ.get("FOX_CLIPS", "idle,walk,run").split(",")
per = int(os.environ.get("FOX_SHEET_N", "8"))
sc = bpy.context.scene
sc.render.engine = "BLENDER_WORKBENCH"
sc.display.shading.light = "STUDIO"
sc.display.shading.color_type = "VERTEX"
sc.display.shading.show_shadows = True
sc.render.resolution_x, sc.render.resolution_y = 480, 360
sc.render.film_transparent = False
sc.world = sc.world or bpy.data.worlds.new("w")
for o in list(bpy.data.objects):
    if o.name.startswith("REF_"):
        o.hide_render = True
if "sheet_floor" not in bpy.data.objects:
    bpy.ops.mesh.primitive_plane_add(size=6, location=(0, 0, 0))
    bpy.context.object.name = "sheet_floor"
cam = bpy.data.objects.get("sheet_cam") or bpy.data.objects.new("sheet_cam", bpy.data.cameras.new("sheet_cam"))
if cam.name not in sc.collection.objects:
    sc.collection.objects.link(cam)
cam.data.type = "ORTHO"
cam.data.ortho_scale = 1.3
sc.camera = cam
VIEWS = {"side": (Vector((3.0, 0.08, 0.33)), Vector((0, 0.08, 0.33))), "q": (Vector((1.5, -1.5, 0.75)), Vector((0, 0, 0.3)))}
for name in clips:
    act = bpy.data.actions[f"src_{name}"]
    rig.animation_data.action = act
    a, b = int(act.frame_range[0]), int(act.frame_range[1])
    frames = sorted({round(a + (b - a) * i / max(1, per - 1)) for i in range(per)}) if per > 1 else [a]
    for view, (pos, look) in VIEWS.items():
        cam.location = pos
        cam.rotation_euler = (look - pos).to_track_quat("-Z", "Y").to_euler()
        for f in frames:
            sc.frame_set(f)
            sc.render.filepath = f"{out}/{name}_{view}_{f:03d}.png"
            bpy.ops.render.render(write_still=True)
print("sheet", out, clips)
