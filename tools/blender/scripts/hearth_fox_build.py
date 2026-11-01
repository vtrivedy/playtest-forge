"""Hearth-fox (redesign-s1): authored stylized fox mesh for ?lookdev=p0.

Blender Z-up, fox faces -Y (→ glTF/three +Z). Units = metres at game scale (shoulder ≈ 0.42).
Run in Blender via MCP exec or `blender -b --python`. Builds into scene 'FOX_review', collection 'FOX'.
Stages: body (skin modifier → subsurf → applied), head loft, ears, eyes, tail plume, vertex colours.
"""
import bpy, bmesh, math
from mathutils import Vector

scene = bpy.data.scenes.get("FOX_review") or bpy.context.scene
if bpy.context.window:
    bpy.context.window.scene = scene
coll = bpy.data.collections.get("FOX")
if coll is None:
    coll = bpy.data.collections.new("FOX")
    scene.collection.children.link(coll)
for ob in list(coll.objects):
    bpy.data.objects.remove(ob, do_unlink=True)
for _m in list(bpy.data.meshes) + list(bpy.data.armatures):
    if _m.users == 0:
        (bpy.data.meshes if isinstance(_m, bpy.types.Mesh) else bpy.data.armatures).remove(_m)


LEG_LIFT = 0.06  # stretches legs: everything above the paws rides up, paws stay on the ground


def P(f, z, x=0.0):
    """forward f (+ = nose), up z, lateral x"""
    t = max(0.0, min(1.0, (z - 0.02) / 0.34))
    return Vector((x, -f, z + LEG_LIFT * t * t * (3 - 2 * t)))


def link(ob):
    coll.objects.link(ob)
    return ob


# ------------------------------------------------------------------ body skeleton (skin modifier)
# (name, point, radius_side, radius_up)
NODES = {
    # back line: rump → slight loin rise → tucked waist → deep chest → withers; neck carried upright (alert, wary)
    "dock": (P(-0.42, 0.455), 0.042, 0.048),
    "rump": (P(-0.31, 0.435), 0.076, 0.086),
    "loin": (P(-0.18, 0.452), 0.066, 0.062),
    "waist": (P(-0.04, 0.458), 0.064, 0.054),
    "chest": (P(0.12, 0.39), 0.1, 0.16),
    "withers": (P(0.22, 0.45), 0.088, 0.11),
    "neck0": (P(0.275, 0.525), 0.078, 0.086),
    "neck1": (P(0.31, 0.58), 0.063, 0.066),
    "neck2": (P(0.335, 0.618), 0.048, 0.052),
}
LEGS = {
    # front: shoulder → elbow → wrist → paw → toe (round sections, full elbow tapering to a slim sloped pastern)
    "F": [(P(0.19, 0.35), 0.064, 0.074), (P(0.15, 0.23), 0.043, 0.044), (P(0.165, 0.08), 0.021, 0.022), (P(0.185, 0.02), 0.021, 0.018), (P(0.22, 0.014), 0.018, 0.012)],
    # hind: hip → stifle → mid-shin → hock → paw → toe  (digitigrade: hock pulled back)
    "H": [(P(-0.25, 0.385), 0.076, 0.09), (P(-0.185, 0.25), 0.056, 0.06), (P(-0.22, 0.19), 0.039, 0.04), (P(-0.3, 0.11), 0.022, 0.024), (P(-0.28, 0.02), 0.02, 0.018), (P(-0.245, 0.014), 0.018, 0.012)],
}
LEG_X = {"F": 0.055, "H": 0.06}

verts, edges, radii = [], [], []


def add(p, rs, ru):
    verts.append(p)
    radii.append((rs, ru))
    return len(verts) - 1


chain = ["dock", "rump", "loin", "waist", "chest", "withers", "neck0", "neck1", "neck2"]
ids = {}
for n in chain:
    ids[n] = add(*NODES[n])
for a, b in zip(chain, chain[1:]):
    edges.append((ids[a], ids[b]))
for side in (1, -1):
    for key, root in (("F", "chest"), ("H", "rump")):
        prev = ids[root] if key == "H" else ids["withers"]
        for i, (p, rs, ru) in enumerate(LEGS[key]):
            q = p.copy()
            q.x = LEG_X[key] * side * (1.0 if i == 0 else 0.9)
            v = add(q, rs, ru)
            edges.append((prev, v))
            prev = v

me = bpy.data.meshes.new("fox_body")
me.from_pydata([tuple(v) for v in verts], edges, [])
body = link(bpy.data.objects.new("fox_body", me))
skin = body.modifiers.new("skin", "SKIN")
skin.use_smooth_shade = True
for sv, (rs, ru) in zip(me.skin_vertices[0].data, radii):
    sv.radius = (rs, ru)
me.skin_vertices[0].data[ids["rump"]].use_root = True  # (dock hangs off the rump → plume grows out of continuous skin)
sub = body.modifiers.new("sub", "SUBSURF")
sub.levels = sub.render_levels = 2
print("body nodes", len(verts))


# ------------------------------------------------------------------ loft helper
def loft(name, rings, cap0=True, cap1=True):
    """rings: list of lists of Vector (equal length). Quads between rings, fan caps."""
    bm = bmesh.new()
    vr = [[bm.verts.new(p) for p in ring] for ring in rings]
    n = len(rings[0])
    for a, b in zip(vr, vr[1:]):
        for j in range(n):
            bm.faces.new((a[j], a[(j + 1) % n], b[(j + 1) % n], b[j]))
    for ring, flip, on in ((vr[0], True, cap0), (vr[-1], False, cap1)):
        if not on:
            continue
        c = bm.verts.new(sum((v.co for v in ring), Vector()) / n)
        for j in range(n):
            f = (ring[j], ring[(j + 1) % n], c)
            bm.faces.new(f[::-1] if not flip else f)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    return link(bpy.data.objects.new(name, me))


def ring_pts(center, fwd, up, hw, top, bot, n=16, shape=lambda a: 1.0, ex=2.4):
    side = fwd.cross(up).normalized()
    up = side.cross(fwd).normalized()
    pts = []
    for j in range(n):
        a = 2 * math.pi * j / n
        c, s = math.cos(a), math.sin(a)
        # superellipse: squarer than an ellipse
        cx = math.copysign(abs(c) ** (2 / ex), c)
        sz = math.copysign(abs(s) ** (2 / ex), s)
        k = shape(a)
        pts.append(center + side * cx * hw * k + up * sz * (top if s > 0 else bot) * k)
    return pts


def lerp_table(tab, u):
    for a, b in zip(tab, tab[1:]):
        if a[0] <= u <= b[0]:
            t = (u - a[0]) / (b[0] - a[0])
            t = t * t * (3 - 2 * t)
            return [x + (y - x) * t for x, y in zip(a[1:], b[1:])]
    return list(tab[0][1:] if u < tab[0][0] else tab[-1][1:])


# ------------------------------------------------------------------ head: wedge skull, cheek ruff, long tapered muzzle
HEAD_PIVOT = P(0.365, 0.64)
HEAD_PITCH = math.radians(-9)  # nose slightly down: wary, not perky
#        u      halfw  top    bot    zc
HEAD = [(-0.09, 0.024, 0.024, 0.024, 0.0),
        (-0.075, 0.054, 0.052, 0.05, 0.0),
        (-0.045, 0.074, 0.064, 0.058, 0.0),
        (-0.01, 0.076, 0.064, 0.054, 0.0),
        (0.025, 0.064, 0.054, 0.046, -0.004),
        (0.055, 0.046, 0.04, 0.038, -0.012),
        (0.085, 0.036, 0.031, 0.032, -0.018),
        (0.12, 0.029, 0.025, 0.026, -0.021),
        (0.15, 0.022, 0.02, 0.019, -0.022),
        (0.17, 0.015, 0.014, 0.012, -0.022),
        (0.183, 0.006, 0.006, 0.005, -0.022)]


def cheek(u):
    """ruff flare: lower-side lobe sweeping back, strongest behind the eye"""
    amt = max(0.0, 1 - abs(u + 0.035) / 0.05)

    def shape(a):
        # a measured from +side; lower cheek ≈ -25°
        d = min(abs(((a - (-0.45)) + math.pi) % (2 * math.pi) - math.pi), abs(((a - (math.pi + 0.45)) + math.pi) % (2 * math.pi) - math.pi))
        return 1 + 0.75 * amt * max(0.0, 1 - d / 0.55) ** 1.4
    return shape


def head_point(u, zc):
    fwd = Vector((0, -math.cos(HEAD_PITCH), math.sin(HEAD_PITCH)))
    up = Vector((0, -math.sin(HEAD_PITCH), math.cos(HEAD_PITCH))) * -1
    up = Vector((0, math.sin(HEAD_PITCH), math.cos(HEAD_PITCH)))
    return HEAD_PIVOT + fwd * u + up * zc, fwd, up


rings = []
U = [-0.09, -0.08, -0.065, -0.05, -0.035, -0.02, -0.005, 0.01, 0.025, 0.04, 0.055, 0.07, 0.085, 0.1, 0.115, 0.13, 0.145, 0.16, 0.172, 0.183]
for u in U:
    hw, top, bot, zc = lerp_table(HEAD, u)
    c, fwd, up = head_point(u, zc)
    rings.append(ring_pts(c, fwd, up, hw, top, bot, n=16, shape=cheek(u)))
head = loft("fox_head", rings)
print("head ok")


def head_surface(u, side_angle, lift=0.0):
    """point on head surface: cast from outside toward the head axis"""
    c, fwd, up = head_point(u, lerp_table(HEAD, u)[3] + lift)
    side = fwd.cross(up).normalized()
    d = (side * math.cos(side_angle) + up * math.sin(side_angle)).normalized()
    origin = c + d * 0.3
    ok, loc, nrm, _ = head.ray_cast(origin, -d)
    return (loc, nrm) if ok else (c, d)


def uv_sphere(name, r, seg=12, rings=8):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * r[0], v.co.y * r[1], v.co.z * r[2]))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    return link(bpy.data.objects.new(name, me))


# ------------------------------------------------------------------ nose
c, fwd, up = head_point(0.178, -0.019)
nose = uv_sphere("fox_nose", (0.014, 0.012, 0.011))
nose.location = c
nose.rotation_euler = (HEAD_PITCH, 0, 0)

# ------------------------------------------------------------------ eyes: ink almond, amber iris facing out
EYES = []
for s_ in (1, -1):
    loc, nrm = head_surface(0.042, math.radians(30 if s_ > 0 else 180 - 30), 0.0)
    # mirror for left side: side vector flips with angle
    eye = uv_sphere(f"fox_eye_{'L' if s_ > 0 else 'R'}", (0.0068, 0.0175, 0.005), seg=16, rings=10)
    # eye local Z is the outward normal; local Y the long axis (along the muzzle, outer corner up)
    z = nrm.normalized()
    y = Vector((0, -1, -0.3)).normalized()  # inner corner low, outer corner up: wary almond
    y = (y - z * y.dot(z)).normalized()
    x = y.cross(z)
    from mathutils import Matrix
    m = Matrix((x, y, z)).transposed().to_4x4()
    eye.matrix_world = Matrix.Translation(loc - z * 0.002) @ m
    EYES.append(eye)
print("eyes", [tuple(round(v, 3) for v in e.location) for e in EYES])

# ------------------------------------------------------------------ ears: tall cupped triangles, tilted out and back
EARS = []
for s_ in (1, -1):
    base, _n = head_surface(-0.035, math.radians(62 if s_ > 0 else 180 - 62), 0.0)
    base = base - _n * 0.014  # sink into the skull
    sx = 1 if base.x > 0 else -1
    axis = Vector((0.42 * sx, 0.2, 1.0)).normalized()  # out + back + up
    face = Vector((0.35 * sx, -1.0, 0.0))  # ear opening faces forward, slightly out
    face = (face - axis * face.dot(axis)).normalized()
    side = axis.cross(face).normalized()
    H = 0.14
    rings = []
    for t in [0.0, 0.18, 0.36, 0.54, 0.7, 0.84, 0.94, 1.0]:
        w = 0.05 * (1 - t) ** 0.8 + 0.0015
        d = 0.017 * (1 - t) ** 0.9 + 0.001
        ring = []
        for j in range(10):
            a = 2 * math.pi * j / 10
            cx, cy = math.cos(a), math.sin(a)
            # front half (cy>0, toward `face`) is pushed back → cupped opening
            dep = d * cy if cy < 0 else -d * 0.35 * cy
            ring.append(base + axis * (t * H) + side * (cx * w) + face * dep)
        rings.append(ring)
    ear = loft(f"fox_ear_{'L' if s_ > 0 else 'R'}", rings)
    ear["face"] = tuple(face)
    EARS.append(ear)

# ------------------------------------------------------------------ tail: big plume, ember tip with flame lobes
def catmull(pts, n):
    out = []
    P_ = [pts[0]] + pts + [pts[-1]]
    segs = len(pts) - 1
    for i in range(n + 1):
        f = i / n * segs
        k = min(segs - 1, int(f))
        t = f - k
        p0, p1, p2, p3 = P_[k], P_[k + 1], P_[k + 2], P_[k + 3]
        out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    return out


# carried J: leaves the rump level, sags through the brush, flame point sweeps up (reads as a rising flame)
TAIL_PTS = [P(-0.25, 0.465), P(-0.39, 0.44), P(-0.55, 0.38), P(-0.73, 0.36), P(-0.89, 0.41), P(-1.0, 0.5), P(-1.07, 0.62)]
TAIL_N = 34


def tail_radius(t):
    # root sits inside the rump at body girth so the back line flows into the plume; fullest ~50%
    # narrow-ish dock leaving the rump, fur blooms after it, long taper to the flame point
    bloom = 0.5 + 0.5 * smooth_(0.05, 0.28, t)
    body = math.sin(min(1.0, 0.1 + t * 0.9) * math.pi) ** 0.5
    tip = (1 - smooth_(0.5, 1.0, t)) ** 0.9  # long flame taper to a point, no scoop end
    return 0.14 * bloom * body * (1 - 0.15 * t) * (0.2 + 0.8 * tip) + 0.002


def smooth_(e0, e1, x):
    t = max(0.0, min(1.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


cs = catmull(TAIL_PTS, TAIL_N)
rings = []
for i, c in enumerate(cs):
    t = i / TAIL_N
    fwd = (cs[min(i + 1, TAIL_N)] - cs[max(i - 1, 0)]).normalized()
    up = Vector((0, 0, 1))
    r = tail_radius(t)
    # flame lobes on the burn-out third: sharp crests twisting along the tail
    lob = 0.36 * max(0.0, min(1.0, (t - 0.5) / 0.35))
    # fur locks along the brush: low, sharp, many
    fur = 0.07 * smooth_(0.1, 0.3, t) * (1 - smooth_(0.55, 0.75, t))

    def shape(a, t=t, lob=lob, fur=fur):
        return 1 + lob * (0.5 + 0.5 * math.sin(a * 3 + t * 13)) ** 4 - lob * 0.2 + fur * (0.5 + 0.5 * math.sin(a * 7 - t * 30)) ** 6
    rings.append(ring_pts(c, fwd, up, r * 1.0, r * 1.08, r * 0.95, n=21, shape=shape, ex=2.0))
tail = loft("fox_tail", rings)
print("ears+tail ok")


# ================================================================== stage 2: subdivide, paint, join
def smooth01(e0, e1, x):
    t = max(0.0, min(1.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


def hsh(*v):
    """cheap deterministic hash → [0,1)"""
    h = math.sin(sum(a * b for a, b in zip(v, (12.9898, 78.233, 37.719)))) * 43758.5453
    return h - math.floor(h)


def fur_noise(a, b):
    """ragged fur edge: two octaves of hashed sines (deterministic, vertex-level)"""
    return 0.6 * math.sin(a * 37.0 + b * 13.0) + 0.4 * math.sin(a * 91.0 - b * 57.0 + 1.7)


def lin(hexv):
    c = [((hexv >> s) & 255) / 255 for s in (16, 8, 0)]
    return [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]


COAT = lin(0xc4521c)  # burnt orange
SADDLE = lin(0x8e3416)  # deep rust along the back
CREAM = lin(0xe9d5b0)
INK = lin(0x2a1a14)
EMBER = lin(0xff7a24)
GOLD = lin(0xffa640)  # deep amber: stays a flame under bloom, never blows to white


def mix(a, b, t):
    return [x + (y - x) * t for x, y in zip(a, b)]


def apply_mods(ob, sub_levels=0):
    if sub_levels:
        m = ob.modifiers.new("sub", "SUBSURF")
        m.levels = m.render_levels = sub_levels
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    old = ob.data
    ob.modifiers.clear()
    ob.data = me
    bpy.data.meshes.remove(old)
    for p in me.polygons:
        p.use_smooth = True


def paint(ob, fn):
    """fn(co, normal) -> (rgb, ember)"""
    me = ob.data
    ca = me.color_attributes.get("Col") or me.color_attributes.new("Col", "FLOAT_COLOR", "POINT")
    me.color_attributes.active_color = ca
    uv = me.uv_layers.get("UVMap") or me.uv_layers.new(name="UVMap")
    em = []
    for v in me.vertices:
        rgb, e = fn(v.co, v.normal)
        ca.data[v.index].color = (*rgb, 1.0)
        em.append(e)
    for loop in me.loops:
        uv.data[loop.index].uv = (em[loop.vertex_index], 0.0)


apply_mods(body)
apply_mods(head, 2)


def tufts(ob, region, amp, freq):
    """jagged fur: sharp ridges pushed out along the normal, pointing down/back (reads as tufts in silhouette)"""
    for v in ob.data.vertices:
        w = region(v.co)
        if w <= 0:
            continue
        a = math.atan2(v.co.x, v.co.z - 0.3) * freq
        saw = (a / TAU) % 1.0 + 0.35 * math.sin(-v.co.y * 60.0 + v.co.z * 40.0)
        spike = max(0.0, 1 - abs((saw % 1.0) - 0.5) * 2.4) ** 2.5
        v.co += v.normal * amp * w * spike


TAU = math.pi * 2
# chest/neck ruff: front + sides of the throat down to the brisket, not the back
tufts(body, lambda co: smooth01(0.16, 0.24, -co.y) * smooth01(0.42, 0.36, -co.y) * smooth01(0.36, 0.44, co.z) * smooth01(0.7, 0.6, co.z), 0.03, 11)
for p in body.data.polygons:
    p.use_smooth = True
for e in EARS:
    apply_mods(e, 1)
apply_mods(tail, 1)
for o in EYES + [nose]:
    apply_mods(o)


def body_col(co, n):
    f, z, x = -co.y, co.z, co.x
    c = COAT
    # saddle: darker rust over the dorsal line, feathered by fur noise
    c = mix(c, SADDLE, 0.55 * smooth01(0.35, 0.85, n.z + 0.08 * fur_noise(f, x)) * smooth01(0.3, 0.38, z))
    # cream bib: front of throat + chest, ragged fur edge, narrows down the brisket
    width = 0.016 + 0.036 * smooth01(0.3, 0.56, z) + 0.006 * fur_noise(z * 3, f)
    bib = smooth01(width + 0.012, width - 0.004, abs(x)) * smooth01(0.08, 0.2, f) * smooth01(0.3, 0.36, z) * smooth01(0.0, 0.5, -n.y)
    bib = max(bib, smooth01(-0.55, -0.85, n.z) * smooth01(0.06, 0.16, f) * smooth01(0.31, 0.29, z) * smooth01(0.045, 0.02, abs(x)) * 0.6)  # brisket wisp
    c = mix(c, CREAM, bib)
    # ink socks: fade like fur, starting at elbow/hock; ragged edge
    front = f > 0
    top = 0.25 if front else 0.2
    sock = smooth01(top, top - 0.09, z + 0.018 * fur_noise(math.atan2(co.x, co.y), z))
    c = mix(c, INK, sock)
    return c, 0.0


def head_col(co, n):
    # head-local u/zc frame
    rel = co - HEAD_PIVOT
    fwd = Vector((0, -math.cos(HEAD_PITCH), math.sin(HEAD_PITCH)))
    up = Vector((0, math.sin(HEAD_PITCH), math.cos(HEAD_PITCH)))
    u, h = rel.dot(fwd), rel.dot(up)
    side = abs(co.x)
    zc = lerp_table(HEAD, u)[3]
    # cream: underjaw + muzzle sides below a line from cheek ruff to nose, plus the cheek ruff itself
    line = zc + 0.004 - 0.012 * smooth01(0.05, -0.03, u) + 0.003 * fur_noise(u, side)
    cream = smooth01(line + 0.004, line - 0.006, h)
    ruff = smooth01(0.055, 0.075, side) * smooth01(0.0, -0.02, h)
    cream = max(cream, ruff)
    # fade out behind the jaw hinge so the cream never wraps the nape into a collar (chase-cam view)
    cream *= smooth01(-0.07, -0.02, u)
    cream *= smooth01(0.172, 0.15, u)  # keep the tip of the nose coat-dark
    c = mix(COAT, CREAM, cream)
    # forehead slightly deeper, muzzle bridge saddle
    c = mix(c, SADDLE, 0.35 * smooth01(0.5, 0.9, n.z) * smooth01(-0.06, 0.02, u))
    # dark tear-mark from the inner eye toward the nose (fox mask)
    tear = smooth01(0.01, 0.0, abs(h - (zc + 0.002 - 0.25 * (u - 0.05)))) * smooth01(0.04, 0.06, u) * smooth01(0.12, 0.09, u) * smooth01(0.012, 0.02, side)
    c = mix(c, SADDLE, 0.5 * tear)
    c = mix(c, INK, smooth01(0.165, 0.18, u))
    return c, 0.0


def ear_fn(ear):
    face = Vector(ear["face"])
    zs = [v.co.z for v in ear.data.vertices]
    z0, z1 = min(zs), max(zs)

    def fn(co, n):
        t = (co.z - z0) / (z1 - z0)
        inner = smooth01(0.45, 0.8, n.dot(face)) * smooth01(0.7, 0.45, t) * smooth01(0.0, 0.12, t)
        c = mix(COAT, CREAM, inner * 0.9)
        c = mix(c, INK, smooth01(0.58, 0.72, t + 0.03 * fur_noise(co.x, co.y)) * (1 - inner * 0.6))
        c = mix(c, SADDLE, 0.5 * smooth01(-0.2, -0.6, n.dot(face)) * smooth01(0.6, 0.4, t))
        return c, 0.0
    return fn


def tail_fn(co, n):
    # param along the tail = nearest curve sample
    i = min(range(len(cs)), key=lambda k: (cs[k] - co).length_squared)
    t = i / TAIL_N + 0.025 * fur_noise(co.x * 3, co.z * 3)
    c = mix(COAT, SADDLE, 0.4 * smooth01(0.1, 0.4, t) * smooth01(0.2, 0.7, n.z))
    c = mix(c, EMBER, smooth01(0.45, 0.7, t))
    c = mix(c, GOLD, smooth01(0.8, 0.97, t))
    return c, smooth01(0.55, 0.95, t)


paint(body, body_col)
paint(head, head_col)
for e in EARS:
    paint(e, ear_fn(e))
paint(tail, tail_fn)


from mathutils import Matrix
for o in EYES:
    # amber iris on the outward pole, ink rim, dark pupil; bake the transform first
    nz = (o.matrix_world.to_3x3() @ Vector((0, 0, 1))).normalized()
    cen = o.matrix_world.translation.copy()
    o.data.transform(o.matrix_world)
    o.matrix_world = Matrix.Identity(4)

    def efn(co, n, nz=nz, cen=cen):
        d = (co - cen).normalized().dot(nz)
        iris = smooth01(0.55, 0.75, d)
        c = mix(INK, lin(0xe8a23a), iris)
        return mix(c, lin(0x1a0e08), smooth01(0.93, 0.98, d)), 0.5 * iris
    paint(o, efn)
nose.data.transform(nose.matrix_world)
nose.matrix_world = Matrix.Identity(4)
paint(nose, lambda co, n: (INK, 0.0))
# concept head reads larger against the body: scale the painted head kit about the skull pivot
HEAD_SCALE = 1.1
_hs = Matrix.Translation(HEAD_PIVOT) @ Matrix.Scale(HEAD_SCALE, 4) @ Matrix.Translation(-HEAD_PIVOT)
for o in [head, nose] + EARS + EYES:
    o.data.transform(_hs)
print("painted")
