"""Hearth-fox rest clips for the finale (DESIGN-finale.md): `lieDown` (one-shot, settles from idle into a curled
sphinx-down with the tail wrapped round the paws) and `rest` (loop: slow breathing, an ear flick, tail-tip stir).

Runs the existing pipeline stages build → rig → anim on the Modal Blender (inputs: every hearth_fox_*.py), adds the two
clips to SRC, then the stock export writes just those clips on the bare armature into $BLENDER_OUT/hearth_fox_rest.glb (same rig and bone names as
assets/hero/hearth_fox.glb, so three.js binds these clips to the shipped fox's mixer by name).
  modal run tools/modal/blender_render.py --script tools/blender/scripts/hearth_fox_rest.py \
    --inputs tools/blender/scripts/hearth_fox_build.py,tools/blender/scripts/hearth_fox_rig.py,tools/blender/scripts/hearth_fox_anim.py,tools/blender/scripts/hearth_fox_export.py --out /tmp/fox-rest
"""
import os, bpy, math

HERE = os.environ.get("BLENDER_IN", os.path.dirname(os.path.abspath(__file__))) + "/"
_ns = globals()
for _stage in ("build", "rig", "anim"):
    exec(open(HERE + f"hearth_fox_{_stage}.py").read(), _ns)

# lying: hips and chest down onto the belly, fore paws out in front with the forearms flat, hind paws tucked under,
# head low on the paws, tail wrapped round the front (`wrap` = tail yaw per joint)
LIE = dict(hip_up=-0.24, hip_fwd=-0.03, hips=-0.04, spine=0.04, chest=0.1, neck=0.32, head=-0.12, tail=0.3, curl=0.25, ear=0.12,
           F=(0.2, 0.0, 1.35), H=(0.13, 0.0, 1.45))
WRAP = 0.36


def lie_pose(keys, f, wrap, breath=0.0, flick=0.0, stir=0.0):
    p = pose_at(keys, f)
    hip_offset(up=p["hip_up"] + 0.006 * breath, fwd=p["hip_fwd"])
    rot("hips", pitch=p["hips"])
    rot("spine", pitch=p["spine"] - 0.012 * breath)
    rot("chest", pitch=p["chest"] + 0.015 * breath)
    rot("neck", pitch=p["neck"])
    rot("head", pitch=p["head"] + 0.01 * breath)
    rot("ear.L", pitch=p["ear"] + 0.25 * flick, yaw=0.15 * flick)
    rot("ear.R", pitch=p["ear"])
    for i in range(1, 7):
        k = 0.4 + 0.6 * i / 6
        rot(f"tail{i}", pitch=(p["tail"] if i == 1 else 0.0) + p["curl"] * k, yaw=wrap * k + (0.05 * stir if i > 4 else 0.0))
    for s in "LR":
        for leg, (fw, up, tilt) in (("f", p["F"]), ("h", p["H"])):
            paw(f"ctl_{leg}paw.{s}", fw, up, tilt)


def author_lie_down():
    N = 40
    keys = [(0, dict()), (10, dict(LIE, hip_up=-0.08, chest=0.04, neck=0.12, head=0.04, F=(0.08, 0.04, 0.6), H=(0.05, 0.0, 0.8))), (26, LIE), (40, LIE)]
    act = bpy.data.actions.new("src_lieDown")
    rig.animation_data_create().action = act
    for fr in range(N + 1):
        clear_pose()
        lie_pose(keys, fr, WRAP * ease(min(1.0, max(0.0, (fr - 8) / 26))))
        key_all(fr)
    return act, N


def author_rest():
    N = 120
    act = bpy.data.actions.new("src_rest")
    rig.animation_data_create().action = act
    for fr in range(N + 1):
        ph = fr / N
        w = TAU * ph
        fl = ph - 0.55
        flick = (math.exp(-fl * 30) * math.sin(fl * 60)) if 0 <= fl < 0.2 else 0.0
        clear_pose()
        lie_pose([(0, LIE)], 0, WRAP, breath=math.sin(2 * w), flick=flick, stir=math.sin(w))
        key_all(fr)
    return act, N


SRC["lieDown"] = author_lie_down()
SRC["rest"] = author_rest()
print("authored rest", {k: v[1] for k, v in SRC.items()})
_src = open(HERE + "hearth_fox_export.py").read().replace(
    'OUT = os.path.normpath(HERE + "../../../assets/hero/hearth_fox.glb")', 'OUT = os.path.join(os.environ["BLENDER_OUT"], "hearth_fox_rest.glb")')
assert "BLENDER_OUT" in _src
_src = _src.replace("CLIP_SPEED.update(idle=0.0, jumpUp=0.0, fall=0.0, land=0.0)", "CLIP_SPEED.update(idle=0.0, jumpUp=0.0, fall=0.0, land=0.0, lieDown=0.0, rest=0.0)")
# ship only the two new clips on the bare armature (bone nodes keep their names; the shipped GLB has the mesh)
_src = _src.replace('o.select_set(o.name in ("fox_rig", "fox_coat", "fox_face"))', 'o.select_set(o.name == "fox_rig")')
_src = _src.replace("for name, act in baked.items():\n    tr = ad.nla_tracks.new()", "for name, act in baked.items():\n    if name not in ('lieDown', 'rest'):\n        continue\n    tr = ad.nla_tracks.new()")
assert "if name not in ('lieDown', 'rest')" in _src and 'o.name == "fox_rig"' in _src
exec(_src, _ns)
