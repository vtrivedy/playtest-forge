"""Hearth-fox rig: deform skeleton + deterministic distance weights, joins parts into
`fox_coat` (outlined, toon) and `fox_face` (eyes + nose, no outline).

Exec'd after hearth_fox_build.py in the same namespace (uses NODES, LEGS, LEG_X, cs, HEAD_PIVOT, ...).
"""
import bpy, math
from mathutils import Vector

# ------------------------------------------------------------------ skeleton
BONES = {}  # name -> (head, tail, parent)


def bone(name, h, t, parent=None):
    BONES[name] = (Vector(h), Vector(t), parent)


bone("root", (0, 0, 0), (0, -0.12, 0))
bone("hips", P(-0.27, 0.43), P(-0.08, 0.425), "root")
bone("spine", P(-0.08, 0.425), P(0.12, 0.42), "hips")
bone("chest", P(0.12, 0.42), P(0.27, 0.5), "spine")
bone("neck", P(0.27, 0.5), P(0.37, 0.6), "chest")
bone("head", HEAD_PIVOT, HEAD_PIVOT + Vector((0, -0.16, -0.012)), "neck")
for e in EARS:
    zs = sorted(e.data.vertices, key=lambda v: v.co.z)
    base = sum((v.co for v in zs[:10]), Vector()) / 10
    tip = zs[-1].co.copy()
    side = "L" if base.x > 0 else "R"
    e["bone"] = f"ear.{side}"
    bone(f"ear.{side}", base, base + (tip - base) * 0.6, "head")
TAIL_IDX = [0, 6, 12, 18, 24, 30, TAIL_N]
for k in range(len(TAIL_IDX) - 1):
    bone(f"tail{k + 1}", cs[TAIL_IDX[k]], cs[TAIL_IDX[k + 1]], "hips" if k == 0 else f"tail{k}")
for side, sx in (("L", 1), ("R", -1)):
    F = [p.copy() for p, *_ in LEGS["F"]]
    H = [p.copy() for p, *_ in LEGS["H"]]
    for i, p in enumerate(F):
        p.x = LEG_X["F"] * sx * (1.0 if i == 0 else 0.9)
    for i, p in enumerate(H):
        p.x = LEG_X["H"] * sx * (1.0 if i == 0 else 0.9)
    # front: shoulder → elbow → wrist → paw(ground) → toe
    bone(f"upperarm.{side}", F[0] + Vector((0, 0, 0.04)), F[1], "chest")
    bone(f"forearm.{side}", F[1], F[2], f"upperarm.{side}")
    bone(f"pastern.{side}", F[2], F[3], f"forearm.{side}")
    bone(f"fpaw.{side}", F[3], F[4], f"pastern.{side}")
    # hind: hip → stifle → hock → paw → toe (H[2] is a mid-shin fullness node)
    bone(f"thigh.{side}", H[0] + Vector((0, 0, 0.03)), H[1], "hips")
    bone(f"shin.{side}", H[1], H[3], f"thigh.{side}")
    bone(f"meta.{side}", H[3], H[4], f"shin.{side}")
    bone(f"hpaw.{side}", H[4], H[5], f"meta.{side}")

old = bpy.data.objects.get("fox_rig")
if old:
    bpy.data.objects.remove(old, do_unlink=True)
arm = bpy.data.armatures.new("fox_rig")
rig = link(bpy.data.objects.new("fox_rig", arm))
arm.display_type = "STICK"
rig.show_in_front = True
bpy.context.view_layer.objects.active = rig
for o in bpy.context.view_layer.objects:
    o.select_set(False)
rig.select_set(True)
bpy.ops.object.mode_set(mode="EDIT")
for name, (h, t, par) in BONES.items():
    eb = arm.edit_bones.new(name)
    eb.head, eb.tail = h, t
    eb.roll = 0.0
for name, (h, t, par) in BONES.items():
    if par:
        eb = arm.edit_bones[name]
        eb.parent = arm.edit_bones[par]
        eb.use_connect = (eb.head - eb.parent.tail).length < 1e-4
bpy.ops.object.mode_set(mode="OBJECT")


# ------------------------------------------------------------------ weights
def seg_dist(p, a, b):
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / ab.length_squared))
    return (p - (a + ab * t)).length, t


LEG_BONES = {s: [f"upperarm.{s}", f"forearm.{s}", f"pastern.{s}", f"fpaw.{s}", f"thigh.{s}", f"shin.{s}", f"meta.{s}", f"hpaw.{s}"] for s in "LR"}
TRUNK = ["hips", "spine", "chest", "neck", "head"]


def assign(ob, fn):
    ob.vertex_groups.clear()
    groups = {}
    for v in ob.data.vertices:
        ws = fn(v.co)
        ws = sorted(((w, n) for n, w in ws.items() if w > 1e-4), reverse=True)[:4]
        tot = sum(w for w, _ in ws)
        for w, n in ws:
            g = groups.get(n) or ob.vertex_groups.new(name=n)
            groups[n] = g
            g.add([v.index], w / tot, "REPLACE")


def body_w(co):
    side = "L" if co.x > 0 else "R"
    cands = TRUNK + ["tail1"] + LEG_BONES[side]
    out = {}
    for n in cands:
        h, t, _ = BONES[n]
        d, _ = seg_dist(co, h, t)
        # compare distance relative to each bone's girth; soft power → no folds at the hip/shoulder
        r = RADIUS.get(n.split(".")[0], 0.075)
        out[n] = 1.0 / max(1e-4, d / r) ** 4
    return out


RADIUS = {"tail1": 0.045, "upperarm": 0.05, "thigh": 0.065, "forearm": 0.025, "shin": 0.035,
          "pastern": 0.018, "meta": 0.018, "fpaw": 0.016, "hpaw": 0.016}


def head_w(co):
    rel = co - HEAD_PIVOT
    u = -rel.y
    k = smooth01(-0.085, -0.03, u)
    return {"head": k, "neck": 1 - k}


def tail_w(co):
    # tent weights centred on each tail bone (continuous across joints → no sausage kinks)
    i = min(range(len(cs)), key=lambda k: (cs[k] - co).length_squared)
    i += (cs[min(i + 1, TAIL_N)] - cs[i]).normalized().dot(co - cs[i]) / max(1e-6, (cs[min(i + 1, TAIL_N)] - cs[i]).length)
    w = {}
    for k in range(len(TAIL_IDX) - 1):
        c = 0.5 * (TAIL_IDX[k] + TAIL_IDX[k + 1])
        span = TAIL_IDX[k + 1] - TAIL_IDX[k]
        w[f"tail{k + 1}"] = max(0.0, 1 - abs(i - c) / span)
    if i < TAIL_IDX[1] * 0.5:
        w["tail1"] = 1.0
    w["hips"] = 1 - smooth01(0, TAIL_IDX[1] * 0.9, i)
    return w


def ear_w_fn(ear):
    zs = [v.co.z for v in ear.data.vertices]
    z0, z1 = min(zs), max(zs)

    def fn(co):
        k = smooth01(0.0, 0.35, (co.z - z0) / (z1 - z0))
        return {ear["bone"]: k, "head": 1 - k}
    return fn


assign(body, body_w)
assign(head, head_w)
assign(tail, tail_w)
for e in EARS:
    assign(e, ear_w_fn(e))
for o in EYES + [nose]:
    assign(o, lambda co: {"head": 1.0})


# ------------------------------------------------------------------ join + skin
def join(name, parts):
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    for o in parts:
        o.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    ob = parts[0]
    ob.name = ob.data.name = name
    ob.parent = rig
    mod = ob.modifiers.new("rig", "ARMATURE")
    mod.object = rig
    return ob


coat = join("fox_coat", [body, head, tail] + EARS)
face = join("fox_face", EYES + [nose])
print("rig ok", len(BONES), "bones;", len(coat.data.vertices), "coat verts")
