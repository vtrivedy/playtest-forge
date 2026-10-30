# Hero v2 animation stage — exec'd inside build_hero_v2.py after the look stage.
# Builds the 9 game clips (idle, run, jump_up, jump_apex, jump_fall, glide, dash, land, burst)
# run / dash / glide are a procedural sagittal gallop; idle / jumps / land / burst resample the CC0
# Quaternius clips (re-proportioned rest) + world-axis overlays.
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

# run — procedural rotary gallop solved with sagittal 2D IK. Each paw follows a planted-then-arc path in
# armature space (stance: pad on the ground sliding back linearly = no skate; swing: lift, tuck, reach).
# Rotations are all about world X, so legs never splay sideways. Hind legs are 3-segment: the metatarsus
# angle is prescribed per phase (vertical in stance, raked back at push-off, tucked in swing) and thigh+shin
# are solved with the stifle forward; forelegs are 2-segment with the knee/carpus forward (paw folds back).
def ease_io2(u): return u * u * (3 - 2 * u)
LEGS = {  # side, hind?, touchdown phase, duty factor (rotary gallop: hind pair, then fore pair)
    "L_hind": (0.00, 0.36), "R_hind": (0.08, 0.36), "R_fore": (0.46, 0.32), "L_fore": (0.55, 0.32)}
def leg_phase(t, td, duty):
    ph = (t - td) % 1.0
    return (True, ph / duty) if ph < duty else (False, (ph - duty) / (1 - duty))
def ang(v): return math.atan2(v[1], v[0])            # (y, z) -> radians
def yz(v): return Vector((v.y, v.z))
REST_YZ = {b.name: (yz(b.head_local), yz(b.tail_local)) for b in arm.data.bones}
def rest_ang(bn): h, t_ = REST_YZ[bn]; return ang(t_ - h)
def seglen(a_, b_): return (a_ - b_).length
FORE = {s_: dict(up=f"FrontUpperLeg.{s_}", lo=f"FrontLowerLeg.{s_}", paw=f"FrontPaw.{s_}") for s_ in "LR"}
HIND = {s_: dict(th=f"BackLeg.{s_}", sh=f"BackUpperLeg.{s_}", mt=f"BackLowerLeg.{s_}", paw=f"BackPaw.{s_}") for s_ in "LR"}
for s_ in "LR":
    f_, h_ = FORE[s_], HIND[s_]
    f_["a"] = seglen(*REST_YZ[f_["up"]]); f_["b"] = seglen(REST_YZ[f_["lo"]][0], REST_YZ[f_["paw"]][0])
    f_["foot"] = REST_YZ[f_["paw"]][0].copy()
    h_["a"] = seglen(*REST_YZ[h_["th"]]); h_["b"] = seglen(*REST_YZ[h_["sh"]])
    h_["c"] = seglen(REST_YZ[h_["mt"]][0], REST_YZ[h_["paw"]][0]); h_["foot"] = REST_YZ[h_["paw"]][0].copy()
def ik2(root, target, a_, b_):
    """2-bone IK in the sagittal plane, knee toward -y (forward). returns abs angles (bone1, bone2)."""
    d = target - root; L = max(abs(a_ - b_) + 1e-4, min(a_ + b_ - 1e-4, d.length))
    base = ang(d); al = math.acos(max(-1, min(1, (a_ * a_ + L * L - b_ * b_) / (2 * a_ * L))))
    a1 = base - al                                     # knee/stifle forward of the root->target line
    knee = root + Vector((math.cos(a1), math.sin(a1))) * a_
    tgt = root + d.normalized() * L
    return a1, ang(tgt - knee)
def paw_path(stance, u, foot, fwd, back, lift, early=1.0):
    """fetlock target (y, z): stance slides back on the ground, swing arcs up and forward."""
    if stance: return Vector((foot.x - fwd + (fwd + back) * u, foot.y))
    k = ease_io2(u)
    y = foot.x + back - (fwd + back) * k
    z = foot.y + lift * math.sin(math.pi * min(1.0, u ** early)) ** 0.9
    return Vector((y, z))
def apply_dict(pose):
    for bn, (loc, q, sc_) in pose.items():
        pb = arm.pose.bones[bn]; pb.rotation_mode = "QUATERNION"
        pb.location = loc; pb.rotation_quaternion = q; pb.scale = sc_
    bpy.context.view_layer.update()
def posed_yz(bn): pb = arm.pose.bones[bn]; return yz(pb.head), yz(pb.tail)
LEG_BONES = [b for d_ in list(FORE.values()) + list(HIND.values()) for k_, b in d_.items() if isinstance(b, str)]
GALLOP_BASE = sample(S["Idle"], 0)
for bn in LEG_BONES: GALLOP_BASE[bn][1] = Quaternion()
def set_chain(p, bones, targets):
    """bones in parent->child order, targets = desired absolute angles (rad). Uses the evaluated spine pose."""
    acc = 0.0
    for bn, tgt in zip(bones, targets):
        h, t_ = posed_yz(bn)
        cur = ang(t_ - h) + acc
        rot = math.degrees(tgt - cur)
        rot = (rot + 180) % 360 - 180
        wrot(p, bn, (1, 0, 0), rot); acc += math.radians(rot)
def gallop_pose(t, st=1.0):
    """t in [0,1). st scales stride (dash > run)."""
    p = copy(GALLOP_BASE)
    # spine: gathered (arched) just before hind touchdown, extended in the suspension after hind push-off
    flex = math.cos(2 * math.pi * (t - 0.96))                      # +1 gathered, -1 extended
    wrot(p, "Torso", (1, 0, 0), 2 * flex * st)
    wrot(p, "Torso2", (1, 0, 0), 1.2 * flex * st)
    pitch = 2.5 * math.sin(2 * math.pi * (t - 0.2)) * st             # front rises as the forelegs load
    wrot(p, "Body", (1, 0, 0), -pitch)
    wloc(p, "Body", (0, 0, 0.03 * st * math.cos(2 * math.pi * (t - 0.32)) - 0.02))
    wrot(p, "Neck1", (1, 0, 0), pitch * 0.7 - 3 * flex * st + 5)   # gaze stays level (stoic)
    wrot(p, "Head", (1, 0, 0), -2.5 * math.sin(2 * math.pi * (t - 0.3)) - 5)
    for e in EARS: wrot(p, e, (1, 0, 0), 14 + 3 * math.sin(2 * math.pi * t))
    tail_wave(p, t, amp_yaw=3, amp_pitch=6, speed=1.0, lift=8, per=-1)
    apply_dict(p)
    for key, (td, duty) in LEGS.items():
        s_ = key[0]; stance, u = leg_phase(t, td, duty)
        if "hind" in key:
            L_ = HIND[s_]
            P = paw_path(stance, u, L_["foot"], 0.42 * st, 0.62 * st, 0.34, early=0.75)
            mt = rest_ang(L_["mt"]) + math.radians((-6 + 40 * u ** 2) if stance else (34 + 16 * math.sin(math.pi * u) - 40 * ease_io2(u)))
            J = P - Vector((math.cos(mt), math.sin(mt))) * L_["c"]
            hip = posed_yz(L_["th"])[0]
            if (J - hip).length < 0.9:  # long shin: never fold the hock up into the hip (keeps the stifle under)
                J = hip + (J - hip).normalized() * 0.9
            a1, a2 = ik2(hip, J, L_["a"], L_["b"])
            pw = rest_ang(L_["paw"]) + math.radians((38 * max(0, (u - 0.55) / 0.45) ** 1.5) if stance else 30 * (1 - ease_io2(u)) + 28 * math.sin(math.pi * u))
            set_chain(p, [L_["th"], L_["sh"], L_["mt"], L_["paw"]], [a1, a2, mt, pw])
        else:
            L_ = FORE[s_]
            P = paw_path(stance, u, L_["foot"], 0.5 * st, 0.36 * st, 0.5, early=1.25)
            sh = posed_yz(L_["up"])[0]
            if stance:
                a1, a2 = ik2(sh, P, L_["a"], L_["b"])
            else:  # swing: FK blend between lift-off and reach poses; carpus folds the paw up behind
                f0 = paw_path(True, 1.0, L_["foot"], 0.5 * st, 0.36 * st, 0.0); f1 = paw_path(True, 0.0, L_["foot"], 0.5 * st, 0.36 * st, 0.0)
                b0, c0 = ik2(sh, f0, L_["a"], L_["b"]); b1, c1 = ik2(sh, f1, L_["a"], L_["b"])
                k = ease_io2(u)
                a1 = b0 + (b1 - b0) * k - math.radians(10) * math.sin(math.pi * u)
                a2 = c0 + (c1 - c0) * k + math.radians(72) * math.sin(math.pi * min(1.0, u * 1.15)) ** 1.2
            pw = rest_ang(L_["paw"]) + math.radians((42 * max(0, (u - 0.5) / 0.5) ** 1.5) if stance else 42 * (1 - ease_io2(u)) + 75 * math.sin(math.pi * min(1, u * 1.3)))
            set_chain(p, [L_["up"], L_["lo"], L_["paw"]], [a1, a2, pw])
    apply_dict(p)
    return p

RUN_N = 14
run = [gallop_pose(f / RUN_N) for f in range(RUN_N)]; run.append(copy(run[0]))
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

# glide — the concept's leap: extended suspension (forelegs reaching, hind legs streaming), tail high and
# fanning, slow bank (loop 24f)
gl = []
for i in range(25):
    t = i / 24; p = gallop_pose(0.36)
    for s_ in "LR":
        wrot(p, f"FrontUpperLeg.{s_}", (1, 0, 0), -16); wrot(p, f"FrontLowerLeg.{s_}", (1, 0, 0), -6)
        wrot(p, f"BackLeg.{s_}", (1, 0, 0), 14)
    wrot(p, "Body", (0, 1, 0), 4 * math.sin(2 * math.pi * t))
    wloc(p, "Body", (0, 0, 0.04 * math.sin(2 * math.pi * t + 1)))
    for e in EARS: wrot(p, e, (1, 0, 0), 12)
    tail_wave(p, t, amp_yaw=9, amp_pitch=5, speed=1.0, lift=4, per=-2)
    gl.append(p)
make("glide", gl)

# dash — blistering stretched stride (8f loop): longer reach, low head, ears pinned, tail streaming
da = [gallop_pose(f / 8, st=1.25) for f in range(8)]; da.append(copy(da[0]))
for p in da:
    wrot(p, "Neck1", (1, 0, 0), 8); wrot(p, "Head", (1, 0, 0), -6)
    for e in EARS: wrot(p, e, (1, 0, 0), 22)
    tail_wave(p, 0, 0, 0, lift=10)
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
