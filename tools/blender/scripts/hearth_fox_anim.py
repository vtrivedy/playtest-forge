"""Hearth-fox clips: idle / walk / trot / lope / run / jumpUp / fall / land, authored on IK paw controls then baked to FK deform keys.

Exec'd after hearth_fox_rig.py (uses rig, BONES, ...). 30 fps. Clips are in-place; the walk/run
stance phase moves each planted paw backward at exactly CLIP_SPEED so the game/lookdev can drive
root motion at that speed with zero skating. Clip speeds are written to the rig as custom props
(exported as glTF extras) so three.js reads them instead of hard-coding.
"""
import bpy, math
from mathutils import Vector, Matrix

FPS = 30
scene.render.fps = FPS
# every paw / hip offset below is authored for a 0.4 m leg; K re-fits it to the starter fox's short sturdy legs
K = 0.52
arm = rig.data
TAU = math.pi * 2

# ------------------------------------------------------------------ control bones (non-deform)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode="EDIT")
eb = arm.edit_bones
for b in eb:
    b.use_deform = True


def ctl(name, head, parent="root", length=0.04, up=False):
    b = eb.new(name)
    b.head = head
    b.tail = head + (Vector((0, 0, length)) if up else Vector((0, -length, 0)))
    b.roll = 0
    b.parent = eb[parent]
    b.use_deform = False
    return b


for s in "LR":
    ctl(f"ctl_fpaw.{s}", eb[f"pastern.{s}"].tail)
    ctl(f"ctl_wrist.{s}", eb[f"forearm.{s}"].tail, f"ctl_fpaw.{s}", up=True)
    ctl(f"ctl_ftoe.{s}", eb[f"fpaw.{s}"].tail, f"ctl_fpaw.{s}", 0.02)
    ctl(f"pole_elbow.{s}", eb[f"forearm.{s}"].head + Vector((0, 0.2, 0)), "hips")
    ctl(f"ctl_hpaw.{s}", eb[f"meta.{s}"].tail)
    ctl(f"ctl_hock.{s}", eb[f"shin.{s}"].tail, f"ctl_hpaw.{s}", up=True)
    ctl(f"ctl_htoe.{s}", eb[f"hpaw.{s}"].tail, f"ctl_hpaw.{s}", 0.02)
    ctl(f"pole_stifle.{s}", eb[f"shin.{s}"].head + Vector((0, -0.2, 0)), "hips")
bpy.ops.object.mode_set(mode="POSE")
pb = rig.pose.bones
for b in pb:
    b.rotation_mode = "XYZ"
    for c in list(b.constraints):
        b.constraints.remove(c)


def damped(bone, target):
    c = pb[bone].constraints.new("DAMPED_TRACK")
    c.target, c.subtarget = rig, target


def ik(bone, target, pole):
    c = pb[bone].constraints.new("IK")
    c.target, c.subtarget = rig, target
    c.pole_target, c.pole_subtarget = rig, pole
    c.chain_count = 2
    return c


def rest_err(bones):
    bpy.context.view_layer.update()
    return sum((pb[b].tail - pb[b].bone.tail_local).length + (pb[b].matrix.col[0].xyz - pb[b].bone.matrix_local.col[0].xyz).length for b in bones)


for s in "LR":
    for bone, tgt, pole, chain in ((f"forearm.{s}", f"ctl_wrist.{s}", f"pole_elbow.{s}", (f"upperarm.{s}", f"forearm.{s}")),
                                    (f"shin.{s}", f"ctl_hock.{s}", f"pole_stifle.{s}", (f"thigh.{s}", f"shin.{s}"))):
        c = ik(bone, tgt, pole)
        # pick the pole angle that leaves the rest pose untouched
        best = min((rest_err(chain), a) for a in [c.pole_angle] + [math.radians(d) for d in (0, 90, -90, 180)] if not setattr(c, "pole_angle", a))
        c.pole_angle = best[1]
    damped(f"pastern.{s}", f"ctl_fpaw.{s}")
    damped(f"fpaw.{s}", f"ctl_ftoe.{s}")
    damped(f"meta.{s}", f"ctl_hpaw.{s}")
    damped(f"hpaw.{s}", f"ctl_htoe.{s}")
bpy.context.view_layer.update()


# ------------------------------------------------------------------ axis calibration: + = intent
def calib(bone, axis, probe):
    """sign so that +angle about local `axis` moves bone tail along world `probe`"""
    p = pb[bone]
    t0 = p.tail.copy()
    e = p.rotation_euler.copy()
    p.rotation_euler[axis] += 0.2
    bpy.context.view_layer.update()
    d = (p.tail - t0).dot(probe)
    p.rotation_euler = e
    bpy.context.view_layer.update()
    return 1.0 if d > 0 else -1.0


DOWN, LEFT, FWD = Vector((0, 0, -1)), Vector((1, 0, 0)), Vector((0, -1, 0))
SGN = {}
for b in ["hips", "spine", "chest", "neck", "head"] + [f"tail{i}" for i in range(1, 7)] + ["ear.L", "ear.R"]:
    SGN[b] = (calib(b, 0, DOWN if b not in ("ear.L", "ear.R") else Vector((0, 1, 0))), calib(b, 2, LEFT))
# ctl paw tilt: + = top (wrist/hock) swings forward
for s in "LR":
    for c_, child in ((f"ctl_fpaw.{s}", f"ctl_wrist.{s}"), (f"ctl_hpaw.{s}", f"ctl_hock.{s}")):
        p = pb[c_]
        h0 = pb[child].head.copy()
        p.rotation_euler.x = 0.2
        bpy.context.view_layer.update()
        SGN[c_] = 1.0 if (pb[child].head - h0).dot(FWD) > 0 else -1.0
        p.rotation_euler.x = 0
bpy.context.view_layer.update()
print("calib", SGN)


def rot(bone, pitch=0.0, yaw=0.0, roll=0.0):
    sp, sy = SGN[bone]
    pb[bone].rotation_euler = (pitch * sp, roll, yaw * sy)


def paw(name, fwd, up, tilt):
    p = pb[name]
    p.location = p.bone.matrix_local.to_3x3().inverted() @ (Vector((0.0, -fwd, up)) * K)
    p.rotation_euler = (tilt * SGN[name], 0, 0)


def hip_offset(side=0.0, up=0.0, fwd=0.0):
    """world-space hip shift (x = fox left, z = up, fwd = -Y) → bone-local location"""
    m = pb["hips"].bone.matrix_local.to_3x3().inverted()
    pb["hips"].location = m @ (Vector((side, -fwd, up)) * K)


def ease(x):
    return x * x * (3 - 2 * x)


def foot_path(ph, duty, stride, lift, reach=0.0, fold=0.6):
    """in-place paw: stance slides back linearly (no skate), swing arcs forward. Returns (fwd, up, tilt)."""
    ph %= 1.0
    if ph < duty:
        q = ph / duty
        f = stride * (0.5 - q)
        up = 0.0
        # heel/wrist peel in the last 25% of stance (toe stays planted)
        tilt = 0.55 * ease(max(0.0, (q - 0.75) / 0.25))
        return f, up, tilt
    q = (ph - duty) / (1 - duty)
    f = stride * (-0.5 + ease(q)) + reach * math.sin(math.pi * q) ** 2
    up = lift * math.sin(math.pi * q) ** 0.8
    # fold the pastern / metatarsus through the swing, unfold before contact
    tilt = 0.55 + fold * math.sin(math.pi * min(1.0, q * 1.15)) - 0.55 * ease(min(1.0, q * 1.6))
    return f, up, max(0.0, tilt)


def clear_pose():
    for b in pb:
        b.location = (0, 0, 0)
        b.rotation_euler = (0, 0, 0)
        b.scale = (1, 1, 1)


def key_all(f):
    for b in pb:
        b.keyframe_insert("location", frame=f)
        b.keyframe_insert("rotation_euler", frame=f)


GAITS = {
    # name: frames, stride per cycle (m), duty, phase offsets LH LF RH RF, lifts (front, hind)
    "walk": dict(frames=20, stride=0.6, duty=0.64, off=dict(LH=0.0, LF=0.27, RH=0.5, RF=0.77), lift=(0.06, 0.05)),
    # trot: diagonal pairs, closes the walk → run gap (~1.3 m/s)
    # short legs → quick scurrying cadence; speeds (K·stride·FPS/frames ≈ .47 / .94 / 1.85 / 3.18 m/s) form an even ladder (each ≈2× the last) so the game's stride-matched rate stays within ~0.6–1.6
    # at every gait switch; a big gap forces rate clamps and the planted paws slide
    "trot": dict(frames=11, stride=0.66, duty=0.46, off=dict(LH=0.0, RF=0.02, RH=0.5, LF=0.52), lift=(0.09, 0.07)),
    # lope: 3-beat canter (hind, diagonal pair, lead fore), half the gallop's spine flex, ~2.0 m/s
    "lope": dict(frames=9, stride=1.07, duty=0.36, off=dict(LH=0.0, RH=0.27, LF=0.31, RF=0.58), lift=(0.12, 0.1), centre=(0.02, 0.04),
                 reach=(0.08, 0.04), fold=(0.7, 0.4), flex=0.55),
    # run: long gallop stride (most distance in suspension), ~3.5 m/s gameplay top speed
    "run": dict(frames=8, stride=1.63, duty=0.27, off=dict(LH=0.0, RH=0.09, LF=0.45, RF=0.55), lift=(0.15, 0.12), centre=(0.03, 0.07),
                reach=(0.14, 0.08), fold=(0.75, 0.3)),
}


def author_gait(name):
    g = GAITS[name]
    N = g["frames"]
    act = bpy.data.actions.new(f"src_{name}")
    rig.animation_data_create().action = act
    run = name in ("run", "lope")
    fx = g.get("flex", 1.0)
    for fr in range(N + 1):
        ph = fr / N
        clear_pose()
        for leg in ("LF", "RF", "LH", "RH"):
            front = leg[1] == "F"
            s = leg[0]
            i = 0 if front else 1
            f, up, tilt = foot_path(ph + 1 - g["off"][leg], g["duty"], g["stride"] * g["duty"], g["lift"][i],
                                    reach=g.get("reach", (0.0, 0.0))[i], fold=g.get("fold", (0.6, 0.6))[i])
            c = g.get("centre", (0.0, 0.0))[0 if front else 1]
            paw(f"ctl_{'f' if front else 'h'}paw.{s}", f + c, up, tilt)
        w = TAU * ph
        if not run:
            # walk: pelvis drops at each hind contact (ph 0, .5) and rises on push-off; shoulders do the
            # same a quarter-cycle later (front contacts .27/.77). Body sits ~9% low so stance legs stay bent.
            g_w = TAU * g["off"]["LF"]
            hip_bob = -0.012 * math.cos(2 * w)
            sh_bob = -0.012 * math.cos(2 * w - 2 * g_w)
            hip_offset(side=0.008 * math.sin(w + 0.6), up=hip_bob - 0.036)
            rot("hips", pitch=0.03 * math.sin(2 * w), yaw=0.06 * math.sin(w), roll=0.07 * math.sin(w + 0.9))
            # shoulder height relative to the hips → spine pitch; lateral bend opposes the hips
            rot("spine", yaw=-0.05 * math.sin(w + 0.3), pitch=(hip_bob - sh_bob) / 0.38)
            rot("chest", yaw=-0.05 * math.sin(w + 0.7), roll=-0.05 * math.sin(w - g_w + 0.9), pitch=0.02 * math.sin(2 * w - 2 * g_w))
            # head: cancel most of the shoulder bob, keep a small nod that lags front contact by ~2 frames
            lag = TAU * 2 / N
            nod = 0.03 * math.sin(2 * w - 2 * g_w - lag)
            rot("neck", pitch=0.06 - (hip_bob - sh_bob) / 0.38 * 0.8 + nod * 0.4, yaw=0.04 * math.sin(w + 1.0))
            rot("head", pitch=-0.02 + nod, yaw=-0.03 * math.sin(w + 1.0))
            # tail: chain, each joint ~2.5 frames behind its parent, amplitude growing to the tip
            for i in range(1, 7):
                k = 0.4 + 0.6 * i / 6
                rot(f"tail{i}", pitch=0.05 * math.sin(2 * w - i * 0.9) + (0.04 if i < 3 else -0.02), yaw=0.17 * k * math.sin(w - i * 0.46))
            rot("ear.L", pitch=0.06 * math.sin(2 * w - lag))
            rot("ear.R", pitch=0.06 * math.sin(2 * w - lag + 0.5))
        else:
            # run: gather/extend spine flex, suspension lift, head steady, tail streams, ears pinned
            # flex > 0: gathered (rump tucked, back arched) as the hind paws swing under; < 0: extended
            flex = math.sin(w + 0.9)
            # (+pitch = bone tip down: an arch is hips tip UP, spine/chest tips DOWN)
            rot("hips", pitch=-0.22 * fx * flex, roll=0.02 * math.sin(w))
            hip_offset(up=0.035 * fx * math.sin(w - 0.6) - 0.01)
            rot("spine", pitch=0.16 * fx * flex)
            rot("chest", pitch=0.1 * fx * flex + 0.03)
            rot("neck", pitch=0.06 - 0.12 * fx * flex)
            rot("head", pitch=0.04 - 0.08 * fx * flex)
            for i in range(1, 7):
                k = 0.4 + 0.6 * i / 6
                # tail: each joint lags its parent ~1 frame and swings wider toward the tip (streams, never a plank)
                rot(f"tail{i}", pitch=(-0.12 if i == 1 else 0.03) + 0.16 * k * math.sin(w - i * 0.45 - 0.9), yaw=0.07 * k * math.sin(w - i * 0.5))
            rot("ear.L", pitch=-0.45 * fx)
            rot("ear.R", pitch=-0.45 * fx)
        key_all(fr)
    return act, N


def author_idle():
    N = 96
    act = bpy.data.actions.new("src_idle")
    rig.animation_data_create().action = act
    for fr in range(N + 1):
        ph = fr / N
        w = TAU * ph
        clear_pose()
        for leg in ("LF", "RF", "LH", "RH"):
            paw(f"ctl_{'f' if leg[1] == 'F' else 'h'}paw.{leg[0]}", 0.0, 0.0, 0.0)
        breath = math.sin(2 * w)
        hip_offset(side=0.004 * math.sin(w), up=-0.012 + 0.0025 * breath)
        rot("hips", roll=0.015 * math.sin(w))
        rot("spine", pitch=-0.012 * breath)
        rot("chest", pitch=0.015 * breath)
        # wary look: hold → snap glance left → hold → settle back (eased holds, quick turns)
        look = 0.0
        for t0, t1, a in ((0.18, 0.26, 0.32), (0.5, 0.6, -0.12), (0.8, 0.92, 0.0)):
            if ph >= t0:
                prev = look
                look = prev + (a - prev) * ease(min(1.0, (ph - t0) / (t1 - t0)))
        rot("neck", pitch=-0.02 * breath, yaw=look * 0.45)
        rot("head", pitch=0.08 + 0.02 * math.sin(w + 1), yaw=look * 0.55, roll=-look * 0.12)
        for i in range(1, 7):
            rot(f"tail{i}", pitch=0.02 * math.sin(w - i * 0.4), yaw=0.08 * math.sin(w - i * 0.45) + 0.03 * math.sin(3 * w - i * 0.6))
        # ear flick: fast attack, slower release
        fl = ph - 0.66
        flick = (math.exp(-fl * 30) * math.sin(fl * 60)) if 0 <= fl < 0.2 else 0.0
        rot("ear.L", pitch=0.25 * flick, yaw=0.15 * flick)
        rot("ear.R", pitch=0.03 * math.sin(w))
        key_all(fr)
    return act, N


# ------------------------------------------------------------------ jump: key poses, eased, tail/head lag
# A pose is a dict of channels; missing channels = idle rest. F/H = (fwd, up, tilt) for front/hind paws.
REST = dict(hip_up=-0.012, hip_fwd=0.0, hips=0.0, spine=0.0, chest=0.0, neck=0.0, head=0.08, tail=0.0, curl=0.0, ear=0.0,
            F=(0.0, 0.0, 0.0), H=(0.0, 0.0, 0.0))


def pose_at(keys, f):
    """keys: [(frame, pose)] ascending. Smoothstep between neighbours per channel; clamps outside."""
    def chan(k):
        pts = [(fr, {**REST, **p}[k]) for fr, p in keys]
        if f <= pts[0][0]:
            return pts[0][1]
        for (f0, a), (f1, b) in zip(pts, pts[1:]):
            if f <= f1:
                t = ease((f - f0) / (f1 - f0))
                return tuple(x + (y - x) * t for x, y in zip(a, b)) if isinstance(a, tuple) else a + (b - a) * t
        return pts[-1][1]
    return {k: chan(k) for k in REST}


def apply_pose(keys, f, loop=0):
    """body at f; head lags ~1 frame, ears ~2, each tail joint ~1.2 frames more than its parent (overlap)"""
    lagged = (lambda d: (f - d) % loop) if loop else (lambda d: max(0.0, f - d))
    p = pose_at(keys, f)
    hip_offset(up=p["hip_up"], fwd=p["hip_fwd"])
    rot("hips", pitch=p["hips"])
    rot("spine", pitch=p["spine"])
    rot("chest", pitch=p["chest"])
    rot("neck", pitch=pose_at(keys, lagged(1))["neck"])
    rot("head", pitch=pose_at(keys, lagged(1.5))["head"])
    for e in ("ear.L", "ear.R"):
        rot(e, pitch=pose_at(keys, lagged(2))["ear"])
    for i in range(1, 7):
        q = pose_at(keys, lagged(1.2 * i))
        k = 0.4 + 0.6 * i / 6
        rot(f"tail{i}", pitch=(q["tail"] if i == 1 else 0.0) + q["curl"] * k, yaw=0.03 * k * math.sin(f * 0.4 - i * 0.6))
    for s, side in (("L", 1.0), ("R", -1.0)):
        # left paws lead by a hair so the pair never moves as one plank
        lead = 0.012 * side
        for leg, (fw, up, tilt) in (("f", p["F"]), ("h", p["H"])):
            paw(f"ctl_{leg}paw.{s}", fw + (lead if fw or up else 0.0), up, tilt)


def author_keys(name, keys, frames, loop=False):
    act = bpy.data.actions.new(f"src_{name}")
    rig.animation_data_create().action = act
    for fr in range(frames + 1):
        clear_pose()
        apply_pose(keys, fr, frames if loop else 0)
        key_all(fr)
    return act, frames


# Root never moves in these clips; the game owns the arc. jumpUp: tiny load (f0-2), hind push with paws
# reaching *below* the root so contact holds while the game lifts it (f2-5), then the tucked rise pose.
# Body stays near level through the leap: any nose-up pitch reads as rearing from the chase cam.
RISE = dict(hip_up=0.03, hips=-0.02, spine=0.02, chest=-0.04, neck=0.06, head=0.14, tail=-0.08, curl=-0.08, ear=-0.4,
            F=(0.04, 0.3, 1.7), H=(-0.26, 0.12, 1.25))
JUMP_UP = [
    (0, dict(hip_up=-0.04, hips=0.06, chest=0.05, neck=0.06, head=0.12, tail=-0.05, ear=-0.1)),
    (2, dict(hip_up=-0.06, hips=0.1, spine=0.02, chest=0.08, neck=0.08, head=0.14, tail=-0.12, ear=-0.2, F=(0.0, 0.0, 0.3), H=(0.0, 0.0, 0.2))),
    (5, dict(hip_up=0.05, hips=-0.06, spine=-0.03, chest=-0.06, neck=-0.02, head=0.18, tail=0.1, ear=-0.35, F=(0.1, 0.2, 1.3), H=(-0.14, -0.05, 1.0))),
    (10, RISE),
]
# fall: front paws drift down to reach for the ground, hind tucks, tail floats up
HANG = dict(hip_up=0.01, hips=0.04, spine=0.03, chest=0.03, neck=0.0, head=0.12, tail=-0.18, curl=-0.1, ear=-0.3,
            F=(0.17, 0.1, 0.5), H=(0.05, 0.19, 1.15))
FALL = [
    (0, HANG),
    (12, {**HANG, "hips": 0.07, "tail": -0.24, "curl": -0.16, "ear": -0.35, "F": (0.19, 0.06, 0.4), "H": (0.07, 0.17, 1.05)}),
    (24, HANG),
]
# land: front paws plant at f0, hind a beat later (f2); absorb peaks f4-5; settle into idle frame 0 by f14
LAND = [
    (0, dict(hip_up=0.0, hips=0.1, spine=0.03, chest=0.04, neck=0.0, head=0.1, tail=-0.18, curl=-0.1, ear=-0.25,
             H=(0.03, 0.07, 0.6))),
    (2, dict(hip_up=-0.05, hips=0.06, spine=0.05, chest=0.1, neck=0.1, head=0.14, tail=-0.05, curl=-0.04, ear=-0.15)),
    (5, dict(hip_up=-0.1, hips=-0.04, spine=0.05, chest=0.12, neck=0.18, head=0.18, tail=0.14, curl=0.06, ear=0.1)),
    (9, dict(hip_up=-0.03, chest=0.02, neck=0.03, head=0.1, tail=0.04, curl=0.02, ear=0.05)),
    (14, dict()),
]

# clear old actions from previous runs
CLIPS = ("idle", "walk", "trot", "lope", "run", "jumpUp", "fall", "land")
for a in list(bpy.data.actions):
    if a.name.split(".")[0] in CLIPS + tuple(f"src_{c}" for c in CLIPS):
        bpy.data.actions.remove(a)
SRC = {"idle": author_idle(), "walk": author_gait("walk"), "trot": author_gait("trot"), "lope": author_gait("lope"), "run": author_gait("run"),
       "jumpUp": author_keys("jumpUp", JUMP_UP, 10), "fall": author_keys("fall", FALL, 24, loop=True),
       "land": author_keys("land", LAND, 14)}
print("authored", {k: v[1] for k, v in SRC.items()})
