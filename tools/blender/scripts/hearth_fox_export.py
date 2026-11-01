"""Hearth-fox export: bake IK-authored clips to FK deform keys, strip controls, write GLB.

Exec'd after hearth_fox_anim.py. Output: assets/hero/hearth_fox.glb with clips idle / walk / trot / run / jumpUp / fall / land.
"""
import bpy, os

OUT = os.path.normpath(HERE + "../../../assets/hero/hearth_fox.glb")
DEFORM = [b.name for b in rig.data.bones if b.use_deform]
CLIP_SPEED = {k: g["stride"] * FPS / g["frames"] for k, g in GAITS.items()}
CLIP_SPEED.update(idle=0.0, jumpUp=0.0, fall=0.0, land=0.0)

bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode="POSE")
baked = {}
for name, (src, n) in SRC.items():
    rig.animation_data.action = src
    for b in rig.data.bones:
        b.select = b.use_deform
    bpy.ops.nla.bake(frame_start=0, frame_end=n, step=1, only_selected=True, visual_keying=True,
                     clear_constraints=False, clear_parents=False, use_current_action=False,
                     bake_types={"POSE"}, channel_types={"LOCATION", "ROTATION", "SCALE"})
    act = rig.animation_data.action
    act.name = name
    # keep only deform-bone channels
    for fc in list(act.fcurves):
        if not any(f'"{d}"' in fc.data_path for d in DEFORM):
            act.fcurves.remove(fc)
    baked[name] = act

# strip IK / damped-track constraints and control bones: the GLB is pure FK
for p in rig.pose.bones:
    for c in list(p.constraints):
        p.constraints.remove(c)
bpy.ops.object.mode_set(mode="EDIT")
for b in list(rig.data.edit_bones):
    if not b.use_deform:
        rig.data.edit_bones.remove(b)
bpy.ops.object.mode_set(mode="OBJECT")
for name, (src, n) in SRC.items():
    bpy.data.actions.remove(src)

# one NLA track per clip so the exporter emits each as its own animation
ad = rig.animation_data
ad.action = None
for t in list(ad.nla_tracks):
    ad.nla_tracks.remove(t)
for name, act in baked.items():
    tr = ad.nla_tracks.new()
    tr.name = name
    tr.strips.new(name, 0, act)
    tr.mute = True

# rest pose for the bind; clip metadata as glTF extras on the rig node
for p in rig.pose.bones:
    p.location, p.rotation_euler, p.scale = (0, 0, 0), (0, 0, 0), (1, 1, 1)
rig["clipSpeed"] = CLIP_SPEED
rig["clipFrames"] = {k: v[1] for k, v in SRC.items()}

for o in bpy.context.view_layer.objects:
    o.select_set(o.name in ("fox_rig", "fox_coat", "fox_face"))
bpy.context.view_layer.objects.active = rig
bpy.ops.export_scene.gltf(
    filepath=OUT,
    export_format="GLB",
    use_selection=True,
    use_active_scene=True,
    export_extras=True,
    export_yup=True,
    export_apply=False,
    export_skins=True,
    export_def_bones=True,
    export_animations=True,
    export_animation_mode="NLA_TRACKS",
    export_force_sampling=True,
    export_frame_step=1,
    export_optimize_animation_size=True,
    export_normals=True,
    export_texcoords=True,
    export_vertex_color="ACTIVE",
    export_all_vertex_colors=False,
    export_morph=False,
    export_materials="PLACEHOLDER",
    export_image_format="NONE",
)
print("exported", OUT, os.path.getsize(OUT), "bytes; speeds", CLIP_SPEED)
