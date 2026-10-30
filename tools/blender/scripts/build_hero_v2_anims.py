# Hero v2 animation stage — exec'd inside build_hero_v2.py after the look stage.
# Builds the 9 game clips (idle, run, jump_up, jump_apex, jump_fall, glide, dash, land, burst)
# by resampling CC0 Quaternius clips (re-proportioned rest) + world-axis overlays.
from mathutils import Quaternion, Euler
FPS = sc.render.fps  # 24
# drop IK / pole helper bones (no deform weights, not driven in glTF)
helpers = [b.name for b in arm.data.bones if b.name.startswith(("IK", "FF", "Pole"))]
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode="EDIT")
for n in helpers: arm.data.edit_bones.remove(arm.data.edit_bones[n])
bpy.ops.object.mode_set(mode="OBJECT")
BONES = [b.name for b in arm.data.bones]
REST = {b.name: b.matrix_local.to_3x3() for b in arm.data.bones}

TAIL_DAMP = [f"Tail{i}" for i in range(1, 9)]
def sample(act, f):
    pose = {n: [Vector((0, 0, 0)), Quaternion(), Vector((1, 1, 1))] for n in BONES}
    for fc in act.fcurves:
        try: bn = fc.data_path.split('"')[1]
        except IndexError: continue
        if bn not in pose: continue
        ch = fc.data_path.rsplit(".", 1)[1]
        slot = {"location": 0, "rotation_quaternion": 1, "scale": 2}.get(ch)
        if slot is None: continue
        pose[bn][slot][fc.array_index] = fc.evaluate(f)
    for n in pose: pose[n][1].normalize()
    for n in TAIL_DAMP:  # source tail swings were authored for a thin tail; damp for the heavy plume
        pose[n][1] = Quaternion().slerp(pose[n][1], 0.5)
    return pose
def copy(p): return {n: [v[0].copy(), v[1].copy(), v[2].copy()] for n, v in p.items()}
def blend(a, b, t):
    return {n: [a[n][0].lerp(b[n][0], t), a[n][1].slerp(b[n][1], t), a[n][2].lerp(b[n][2], t)] for n in a}
def wrot(p, bone, axis, deg):
    """rotate bone about a world/armature axis (approx, in its rest frame)."""
    ax = (REST[bone].inverted() @ Vector(axis)).normalized()
    p[bone][1] = Quaternion(ax, math.radians(deg)) @ p[bone][1]
def wloc(p, bone, vec):
    p[bone][0] += REST[bone].inverted() @ Vector(vec)
TAILS = [f"Tail{i}" for i in range(1, 9)]
EARS = [f"Ear1.{s}" for s in "LR"]
def tail_wave(p, t, amp_yaw=6, amp_pitch=3, speed=1.0, lift=0.0, per=0.0):
    for i, b in enumerate(TAILS):
        ph = t * 2 * math.pi * speed - i * 0.55
        wrot(p, b, (0, 0, 1), amp_yaw * math.sin(ph) * (0.4 + i / 8))
        wrot(p, b, (1, 0, 0), amp_pitch * math.sin(ph * 0.5 + 1.0) + (lift if i == 0 else per))

def make(name, frames):
    """frames: list of pose dicts, one per frame starting at 0."""
    act = bpy.data.actions.new(name); act.use_fake_user = True; act.id_root = "OBJECT"
    fcs = {}
    prevq = {}
    for f, pose in enumerate(frames):
        for bn in BONES:
            loc, q, s = pose[bn]
            if bn in prevq and prevq[bn].dot(q) < 0: q = -q
            prevq[bn] = q
            for path, vals in (("location", loc), ("rotation_quaternion", q), ("scale", s)):
                for i, v in enumerate(vals):
                    key = (bn, path, i)
                    if key not in fcs:
                        fcs[key] = act.fcurves.new(f'pose.bones["{bn}"].{path}', index=i, action_group=bn)
                    fcs[key].keyframe_points.insert(f, v, options={"FAST"})
    for fc in act.fcurves: fc.update()
    print("CLIP", name, len(frames), "frames")
    return act

S = {k: v for k, v in SRC_ACTIONS.items()}
def resample(src, a, b, n, ease=None, closed=False):
    out = []
    for i in range(n):
        t = i / (n if closed else max(1, n - 1))
        if ease: t = ease(t)
        out.append(sample(S[src], a + (b - a) * t))
    return out
def ease_out(t): return 1 - (1 - t) ** 2
def ease_io(t): return t * t * (3 - 2 * t)

# idle — calm breathing stance, slow tail sway, occasional ear flick
idle = resample("Idle", 0, 80, 80, closed=True); idle.append(copy(idle[0]))
for f, p in enumerate(idle):
    t = f / 80
    tail_wave(p, t, amp_yaw=7, amp_pitch=2.5, speed=2.0, lift=14, per=2)
    flick = math.exp(-((t - 0.62) * 30) ** 2)
    wrot(p, "Ear1.L", (1, 0, 0), 14 * flick)
make("idle", idle)

# run — Quaternius gallop (14f loop @24fps), tail lifted and streaming
run = resample("Gallop", 0, 13.6, 14, closed=True); run.append(copy(run[0]))
for f, p in enumerate(run):
    tail_wave(p, f / 14, amp_yaw=3, amp_pitch=5, speed=1.0, lift=10, per=-1)
    for e in EARS: wrot(p, e, (1, 0, 0), 10)
make("run", run)

# jump_up — gather -> hind-leg push off (one-shot, 10f)
ju = resample("Gallop_Jump", 7.5, 11.0, 10, ease=ease_out)
for f, p in enumerate(ju):
    k = f / 9
    wrot(p, "Body", (1, 0, 0), -8 * k)          # chest up
    tail_wave(p, 0, 0, 0, lift=6 + 8 * k)
make("jump_up", ju)

# jump_apex — tucked suspension, gentle hold (loop 12f)
a0, a1 = sample(S["Gallop_Jump"], 11.6), sample(S["Gallop_Jump"], 12.6)
ap = [blend(a0, a1, 0.5 - 0.5 * math.cos(2 * math.pi * i / 12)) for i in range(13)]
for f, p in enumerate(ap):
    tail_wave(p, f / 12, amp_yaw=4, amp_pitch=4, lift=8)
make("jump_apex", ap)

# jump_fall — forelegs reaching for the ground, nose down a touch (loop 12f)
f0_, f1_ = sample(S["Gallop_Jump"], 13.6), sample(S["Gallop_Jump"], 14.6)
fa = [blend(f0_, f1_, 0.5 - 0.5 * math.cos(2 * math.pi * i / 12)) for i in range(13)]
for f, p in enumerate(fa):
    wrot(p, "Body", (1, 0, 0), 6)
    tail_wave(p, f / 12, amp_yaw=4, amp_pitch=5, lift=20)
    for e in EARS: wrot(p, e, (1, 0, 0), 16)
make("jump_fall", fa)

# glide — full extension (gallop suspension), legs spread, tail high and fanning, slow bank (loop 24f)
g0 = sample(S["Gallop"], 0.0)
gl = []
for i in range(25):
    t = i / 24; p = copy(g0)
    for s_ in "LR":
        wrot(p, f"FrontUpperLeg.{s_}", (1, 0, 0), -14)
        wrot(p, f"BackUpperLeg.{s_}", (1, 0, 0), 12)
    wrot(p, "Body", (0, 1, 0), 4 * math.sin(2 * math.pi * t))
    wloc(p, "Body", (0, 0, 0.04 * math.sin(2 * math.pi * t + 1)))
    wrot(p, "Neck1", (1, 0, 0), -4)
    for e in EARS: wrot(p, e, (1, 0, 0), 24)
    tail_wave(p, t, amp_yaw=9, amp_pitch=5, speed=1.0, lift=6, per=-2)
    gl.append(p)
make("glide", gl)

# dash — one blistering stride (8f loop), stretched low, ears pinned, tail straight back
da = resample("Gallop", 0, 13.6, 8, closed=True); da.append(copy(da[0]))
for f, p in enumerate(da):
    wrot(p, "Neck1", (1, 0, 0), 10); wrot(p, "Head", (1, 0, 0), -6)
    for e in EARS: wrot(p, e, (1, 0, 0), 30)
    tail_wave(p, f / 8, amp_yaw=2, amp_pitch=3, lift=18, per=-2)
make("dash", da)

# land — touch-down absorb into stance (one-shot 12f)
la = resample("Jump_ToIdle", 17.0, 32.0, 12, ease=ease_out)
for f, p in enumerate(la):
    k = math.sin(min(1, f / 5) * math.pi) * (1 - f / 11)
    wloc(p, "Body", (0, 0, -0.10 * k))
    tail_wave(p, 0, 0, 0, lift=10 - 8 * k)
make("land", la)

# burst — spirit flare (shrine restore / dash-burst): crouch -> rear up & flare -> settle (one-shot 18f)
base = sample(S["Idle"], 0)
def burst_pose(c, r):
    p = copy(base)
    wloc(p, "Body", (0, 0, -0.18 * c + 0.08 * r))
    wrot(p, "Body", (1, 0, 0), 4 * c - 16 * r)
    wrot(p, "Neck1", (1, 0, 0), 10 * c - 14 * r)
    wrot(p, "Head", (1, 0, 0), -6 * r)
    for e in EARS: wrot(p, e, (1, 0, 0), 14 * c - 8 * r)
    for i, b in enumerate(TAILS): wrot(p, b, (1, 0, 0), (12 - 10 * c if i == 0 else 0) + ((30 if i == 0 else 6) * r))
    for s_ in "LR": wrot(p, f"FrontUpperLeg.{s_}", (1, 0, 0), -18 * r)
    return p
keys = [(0, 0, 0), (4, 1, 0), (6, 0.6, 0.4), (9, 0, 1), (12, 0, 1), (18, 0, 0)]
bu = []
for f in range(19):
    for (fa_, ca, ra), (fb, cb, rb) in zip(keys, keys[1:]):
        if fa_ <= f <= fb:
            t = ease_io((f - fa_) / (fb - fa_)); bu.append(burst_pose(ca + (cb - ca) * t, ra + (rb - ra) * t)); break
make("burst", bu)
arm.animation_data.action = bpy.data.actions["idle"]
