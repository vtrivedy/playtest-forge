"""Color Fox animations — one clip at a time. Start with idle.
Run after build_spirit_fox_model.py has produced spirit_fox.blend.
blender --background tools/blender/tmp/spirit_fox.blend --python tools/blender/scripts/build_spirit_fox_anims.py -- idle
"""
from __future__ import annotations
import math
import sys
from pathlib import Path
import bpy
from mathutils import Euler

ROOT = Path("/workspace/siyu/playtest-forge")
OUT_GLB = ROOT / "assets/hero/spirit_fox.glb"
OUT_BLEND = ROOT / "tools/blender/tmp/spirit_fox.blend"
PREV = ROOT / "assets/previews/review"
FPS = 24

CLIPS = ("idle", "run", "jump_up", "jump_apex", "jump_fall", "glide", "dash", "land", "burst")


def get_arm():
    arm = bpy.data.objects.get("SpiritFox_Armature")
    if not arm:
        for o in bpy.data.objects:
            if o.type == "ARMATURE":
                return o
    return arm


def ensure_action(arm, name, frames):
    if arm.animation_data is None:
        arm.animation_data_create()
    # Remove prior action of same name
    if name in bpy.data.actions:
        bpy.data.actions.remove(bpy.data.actions[name])
    act = bpy.data.actions.new(name)
    arm.animation_data.action = act
    return act


def key_bone(arm, bone_name, frame, loc=None, rot=None, sc=None):
    """Key pose-bone in pose mode. rot = Euler radians XYZ."""
    pb = arm.pose.bones.get(bone_name)
    if not pb:
        return
    pb.rotation_mode = "XYZ"
    if loc is not None:
        pb.location = loc
        pb.keyframe_insert(data_path="location", frame=frame)
    if rot is not None:
        pb.rotation_euler = rot
        pb.keyframe_insert(data_path="rotation_euler", frame=frame)
    if sc is not None:
        pb.scale = sc
        pb.keyframe_insert(data_path="scale", frame=frame)


def set_linear(act):
    for fc in act.fcurves:
        for kp in fc.keyframe_points:
            kp.interpolation = "BEZIER"
            kp.handle_left_type = "AUTO_CLAMPED"
            kp.handle_right_type = "AUTO_CLAMPED"


def make_idle(arm):
    """Calm breathe + subtle tail ember sway. ~2s loop."""
    frames = FPS * 2  # 48
    act = ensure_action(arm, "idle", frames)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="POSE")
    # Reset all
    for pb in arm.pose.bones:
        pb.location = (0, 0, 0)
        pb.rotation_euler = (0, 0, 0)
        pb.scale = (1, 1, 1)

    # Keyframes at 1, mid, end
    for f, breathe, tail_sway, ear_tilt in [
        (1, 0.0, 0.0, 0.0),
        (frames // 4, 0.012, 0.08, 0.03),
        (frames // 2, 0.0, 0.0, 0.0),
        (3 * frames // 4, -0.008, -0.08, -0.02),
        (frames + 1, 0.0, 0.0, 0.0),  # loop
    ]:
        key_bone(arm, "Chest", f, loc=(0, 0, breathe), rot=(breathe * 2, 0, 0))
        key_bone(arm, "Spine", f, rot=(breathe, 0, 0))
        key_bone(arm, "Head", f, rot=(-breathe * 0.5, 0, ear_tilt * 0.3))
        key_bone(arm, "Ear_L", f, rot=(0, 0, ear_tilt))
        key_bone(arm, "Ear_R", f, rot=(0, 0, -ear_tilt))
        # Tail chain wave
        for i in range(1, 7):
            amp = tail_sway * (0.15 * i)
            key_bone(arm, f"Tail{i}", f, rot=(amp * 0.3, amp, 0))
        # Soft root settle
        key_bone(arm, "Hips", f, loc=(0, 0, breathe * 0.4))

    set_linear(act)
    # Manual frame range on action
    act.use_frame_range = True
    act.frame_start = 1
    act.frame_end = frames
    bpy.ops.object.mode_set(mode="OBJECT")
    print(f"idle: {frames} frames @ {FPS}fps")
    return act


def make_run(arm):
    """Quadruped trot cycle ~0.6s."""
    frames = int(FPS * 0.6)  # ~14
    act = ensure_action(arm, "run", frames)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="POSE")
    for pb in arm.pose.bones:
        pb.location = (0, 0, 0)
        pb.rotation_euler = (0, 0, 0)
        pb.scale = (1, 1, 1)

    # Diagonal gait: FL+BR together, FR+BL together
    for f in range(1, frames + 2):
        t = (f - 1) / frames * 2 * math.pi
        lift = 0.35
        key_bone(arm, "FrontThigh_L", f, rot=(math.sin(t) * lift, 0, 0))
        key_bone(arm, "FrontShin_L", f, rot=(max(0, -math.sin(t)) * 0.4, 0, 0))
        key_bone(arm, "FrontThigh_R", f, rot=(math.sin(t + math.pi) * lift, 0, 0))
        key_bone(arm, "FrontShin_R", f, rot=(max(0, -math.sin(t + math.pi)) * 0.4, 0, 0))
        key_bone(arm, "BackThigh_L", f, rot=(math.sin(t + math.pi) * lift * 0.9, 0, 0))
        key_bone(arm, "BackShin_L", f, rot=(max(0, -math.sin(t + math.pi)) * 0.35, 0, 0))
        key_bone(arm, "BackThigh_R", f, rot=(math.sin(t) * lift * 0.9, 0, 0))
        key_bone(arm, "BackShin_R", f, rot=(max(0, -math.sin(t)) * 0.35, 0, 0))
        # Body bob + tail stream
        bob = abs(math.sin(t * 2)) * 0.02
        key_bone(arm, "Hips", f, loc=(0, 0, bob), rot=(0, math.sin(t) * 0.04, 0))
        key_bone(arm, "Chest", f, rot=(0.05, 0, math.sin(t) * 0.03))
        for i in range(1, 7):
            key_bone(arm, f"Tail{i}", f, rot=(0.05, math.sin(t + i * 0.3) * 0.12 * i / 6, 0))

    set_linear(act)
    act.use_frame_range = True
    act.frame_start = 1
    act.frame_end = frames
    bpy.ops.object.mode_set(mode="OBJECT")
    print(f"run: {frames} frames")
    return act


def make_simple_pose_clip(arm, name, frames, pose_fn):
    act = ensure_action(arm, name, frames)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="POSE")
    for pb in arm.pose.bones:
        pb.location = (0, 0, 0)
        pb.rotation_euler = (0, 0, 0)
        pb.scale = (1, 1, 1)
    pose_fn(arm, frames)
    set_linear(act)
    act.use_frame_range = True
    act.frame_start = 1
    act.frame_end = frames
    bpy.ops.object.mode_set(mode="OBJECT")
    print(f"{name}: {frames} frames")
    return act


def pose_jump_up(arm, frames):
    for f, crouch, stretch in [(1, 0.15, 0), (frames // 2, -0.05, 0.1), (frames, -0.1, 0.2)]:
        key_bone(arm, "Hips", f, loc=(0, 0, crouch))
        key_bone(arm, "FrontThigh_L", f, rot=(stretch + crouch, 0, 0))
        key_bone(arm, "FrontThigh_R", f, rot=(stretch + crouch, 0, 0))
        key_bone(arm, "BackThigh_L", f, rot=(-stretch * 0.5, 0, 0))
        key_bone(arm, "BackThigh_R", f, rot=(-stretch * 0.5, 0, 0))
        for i in range(1, 7):
            key_bone(arm, f"Tail{i}", f, rot=(-0.1 * stretch, 0, 0))


def pose_jump_apex(arm, frames):
    for f in (1, frames):
        key_bone(arm, "Hips", f, loc=(0, 0, 0.05))
        key_bone(arm, "FrontThigh_L", f, rot=(0.4, 0, 0))
        key_bone(arm, "FrontThigh_R", f, rot=(0.4, 0, 0))
        key_bone(arm, "BackThigh_L", f, rot=(-0.3, 0, 0))
        key_bone(arm, "BackThigh_R", f, rot=(-0.3, 0, 0))
        for i in range(1, 7):
            key_bone(arm, f"Tail{i}", f, rot=(-0.15, 0.05 * (i % 2), 0))


def pose_jump_fall(arm, frames):
    for f in (1, frames):
        key_bone(arm, "FrontThigh_L", f, rot=(0.6, 0, 0))
        key_bone(arm, "FrontThigh_R", f, rot=(0.6, 0, 0))
        key_bone(arm, "BackThigh_L", f, rot=(0.2, 0, 0))
        key_bone(arm, "BackThigh_R", f, rot=(0.2, 0, 0))
        key_bone(arm, "Chest", f, rot=(0.1, 0, 0))


def pose_glide(arm, frames):
    for f, sway in [(1, 0), (frames // 2, 0.08), (frames + 1, 0)]:
        key_bone(arm, "FrontThigh_L", f, rot=(0.5, 0.15, 0))
        key_bone(arm, "FrontThigh_R", f, rot=(0.5, -0.15, 0))
        key_bone(arm, "BackThigh_L", f, rot=(-0.1, 0, 0))
        key_bone(arm, "BackThigh_R", f, rot=(-0.1, 0, 0))
        key_bone(arm, "Chest", f, rot=(-0.15, sway, 0))
        for i in range(1, 7):
            key_bone(arm, f"Tail{i}", f, rot=(-0.2 + sway * 0.1, sway * i * 0.05, 0))


def pose_dash(arm, frames):
    for f, stretch in [(1, 0), (frames // 3, 0.3), (frames, 0.1)]:
        key_bone(arm, "Hips", f, loc=(0, stretch * 0.05, 0))
        key_bone(arm, "Chest", f, rot=(0, 0, 0), loc=(0, stretch * 0.02, 0))
        key_bone(arm, "FrontThigh_L", f, rot=(0.2, 0, 0))
        key_bone(arm, "FrontThigh_R", f, rot=(0.2, 0, 0))
        for i in range(1, 7):
            key_bone(arm, f"Tail{i}", f, rot=(0.1, 0, 0), sc=(1, 1 + stretch * 0.15, 1))


def pose_land(arm, frames):
    for f, crouch in [(1, 0.2), (frames // 2, 0.05), (frames, 0)]:
        key_bone(arm, "Hips", f, loc=(0, 0, -crouch))
        key_bone(arm, "FrontThigh_L", f, rot=(crouch, 0, 0))
        key_bone(arm, "FrontThigh_R", f, rot=(crouch, 0, 0))
        key_bone(arm, "BackThigh_L", f, rot=(crouch * 0.8, 0, 0))
        key_bone(arm, "BackThigh_R", f, rot=(crouch * 0.8, 0, 0))


def pose_burst(arm, frames):
    """Ember swell — NOT cute cheer. Tail/ears swell with emission scale."""
    for f, swell in [(1, 0), (frames // 2, 0.35), (frames, 0.1)]:
        key_bone(arm, "Chest", f, sc=(1 + swell * 0.05, 1 + swell * 0.05, 1 + swell * 0.05))
        for i in range(1, 7):
            s = 1 + swell * (0.1 + 0.08 * i)
            key_bone(arm, f"Tail{i}", f, sc=(s, s, s), rot=(-0.05 * swell, 0, 0))
        key_bone(arm, "Ear_L", f, sc=(1, 1, 1 + swell * 0.2))
        key_bone(arm, "Ear_R", f, sc=(1, 1, 1 + swell * 0.2))
        key_bone(arm, "Head", f, rot=(-0.05 * swell, 0, 0))


def render_clip_preview(arm, clip_name, frame=1):
    PREV.mkdir(parents=True, exist_ok=True)
    sc = bpy.context.scene
    sc.frame_set(frame)
    sc.render.engine = "BLENDER_EEVEE_NEXT"
    sc.view_settings.view_transform = "Standard"
    sc.render.resolution_x = sc.render.resolution_y = 512
    sc.eevee.taa_render_samples = 12
    cam = bpy.data.objects.get("Cam_ThreeQ") or bpy.data.objects.get("Cam_Side")
    if not cam:
        bpy.ops.object.camera_add(location=(2.2, -2.2, 1.0))
        cam = bpy.context.active_object
        cam.rotation_euler = (math.radians(70), 0, math.radians(45))
    sc.camera = cam
    path = PREV / f"fox_anim_{clip_name}.png"
    sc.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    print("preview", path)


def export_all():
    arm = get_arm()
    mesh = bpy.data.objects.get("SpiritFox_Mesh")
    bpy.ops.object.select_all(action="DESELECT")
    if mesh:
        mesh.select_set(True)
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    # Push all actions into NLA so glTF exports multiple clips
    if arm.animation_data is None:
        arm.animation_data_create()
    track_map = {}
    for act in list(bpy.data.actions):
        if act.name not in CLIPS:
            continue
        # Clear existing strips for this
        track = arm.animation_data.nla_tracks.new()
        track.name = act.name
        start = 1
        track.strips.new(act.name, start, act)
    bpy.ops.export_scene.gltf(
        filepath=str(OUT_GLB),
        export_format="GLB",
        use_selection=True,
        export_animations=True,
        export_nla_strips=True,
        export_skins=True,
        export_apply=False,
    )
    actions = [a.name for a in bpy.data.actions if a.name in CLIPS]
    print(f"Exported {OUT_GLB} actions={actions}")
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT_BLEND))


def main():
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else ["idle"]
    which = args[0] if args else "idle"
    arm = get_arm()
    if not arm:
        raise SystemExit("No SpiritFox_Armature in file — run build_spirit_fox_model.py first")
    sc = bpy.context.scene
    sc.render.fps = FPS

    builders = {
        "idle": make_idle,
        "run": make_run,
        "jump_up": lambda a: make_simple_pose_clip(a, "jump_up", 10, pose_jump_up),
        "jump_apex": lambda a: make_simple_pose_clip(a, "jump_apex", 8, pose_jump_apex),
        "jump_fall": lambda a: make_simple_pose_clip(a, "jump_fall", 8, pose_jump_fall),
        "glide": lambda a: make_simple_pose_clip(a, "glide", 24, pose_glide),
        "dash": lambda a: make_simple_pose_clip(a, "dash", 8, pose_dash),
        "land": lambda a: make_simple_pose_clip(a, "land", 10, pose_land),
        "burst": lambda a: make_simple_pose_clip(a, "burst", 16, pose_burst),
    }

    if which == "all":
        for name in CLIPS:
            builders[name](arm)
            render_clip_preview(arm, name, frame=1)
    else:
        if which not in builders:
            raise SystemExit(f"unknown clip {which}; choose {CLIPS} or all")
        builders[which](arm)
        render_clip_preview(arm, which, frame=1)

    export_all()
    print("DONE anims", which)


if __name__ == "__main__":
    main()
