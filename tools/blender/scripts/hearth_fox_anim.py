"""Hearth-fox clips: idle / walk / run, authored on IK paw controls then baked to FK deform keys.

Exec'd after hearth_fox_rig.py (uses rig, BONES, ...). 30 fps. Clips are in-place; the walk/run
stance phase moves each planted paw backward at exactly CLIP_SPEED so the game/lookdev can drive
root motion at that speed with zero skating. Clip speeds are written to the rig as custom props
(exported as glTF extras) so three.js reads them instead of hard-coding.
"""
import bpy, math
from mathutils import Vector, Matrix

FPS = 30
scene.render.fps = FPS
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
    ctl(f"pole_elbow.{s}", eb[f"forearm.{s}"].head + Vector((0, 0.35, 0)), "hips")
    ctl(f"ctl_hpaw.{s}", eb[f"meta.{s}"].tail)
    ctl(f"ctl_hock.{s}", eb[f"shin.{s}"].tail, f"ctl_hpaw.{s}", up=True)
    ctl(f"ctl_htoe.{s}", eb[f"hpaw.{s}"].tail, f"ctl_hpaw.{s}", 0.02)
    ctl(f"pole_stifle.{s}", eb[f"shin.{s}"].head + Vector((0, -0.35, 0)), "hips")
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
    p.location = p.bone.matrix_local.to_3x3().inverted() @ Vector((0.0, -fwd, up))
    p.rotation_euler = (tilt * SGN[name], 0, 0)


def hip_offset(side=0.0, up=0.0, fwd=0.0):
    """world-space hip shift (x = fox left, z = up, fwd = -Y) → bone-local location"""
    m = pb["hips"].bone.matrix_local.to_3x3().inverted()
    pb["hips"].location = m @ Vector((side, -fwd, up))


def ease(x):
    return x * x * (3 - 2 * x)


def foot_path(ph, duty, stride, lift, reach=0.0):
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
    tilt = 0.55 + 0.6 * math.sin(math.pi * min(1.0, q * 1.15)) - 0.55 * ease(min(1.0, q * 1.6))
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
    "walk": dict(frames=34, stride=0.6, duty=0.64, off=dict(LH=0.0, LF=0.27, RH=0.5, RF=0.77), lift=(0.06, 0.05)),
    "run": dict(frames=16, stride=1.3, duty=0.3, off=dict(LH=0.0, RH=0.09, LF=0.45, RF=0.55), lift=(0.11, 0.09), centre=(0.03, 0.07)),
}


def author_gait(name):
    g = GAITS[name]
    N = g["frames"]
    act = bpy.data.actions.new(f"src_{name}")
    rig.animation_data_create().action = act
    run = name == "run"
    for fr in range(N + 1):
        ph = fr / N
        clear_pose()
        for leg in ("LF", "RF", "LH", "RH"):
            front = leg[1] == "F"
            s = leg[0]
            f, up, tilt = foot_path(ph + 1 - g["off"][leg], g["duty"], g["stride"] * g["duty"], g["lift"][0 if front else 1], reach=0.1 if run else 0.0)
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
            rot("hips", pitch=-0.22 * flex, roll=0.02 * math.sin(w))
            hip_offset(up=0.035 * math.sin(w - 0.6) - 0.01)
            rot("spine", pitch=0.16 * flex)
            rot("chest", pitch=0.1 * flex + 0.03)
            rot("neck", pitch=0.06 - 0.12 * flex)
            rot("head", pitch=0.04 - 0.08 * flex)
            for i in range(1, 7):
                k = 0.4 + 0.6 * i / 6
                rot(f"tail{i}", pitch=(-0.12 if i == 1 else 0.04) + 0.1 * k * math.sin(w - i * 0.8), yaw=0.05 * k * math.sin(w - i * 0.6))
            rot("ear.L", pitch=-0.45)
            rot("ear.R", pitch=-0.45)
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
        hip_offset(side=0.004 * math.sin(w), up=-0.022 + 0.0025 * breath)
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


# clear old actions from previous runs
for a in list(bpy.data.actions):
    if a.name.split(".")[0] in ("src_idle", "src_walk", "src_run", "idle", "walk", "run"):
        bpy.data.actions.remove(a)
SRC = {"idle": author_idle(), "walk": author_gait("walk"), "run": author_gait("run")}
print("authored", {k: v[1] for k, v in SRC.items()})
