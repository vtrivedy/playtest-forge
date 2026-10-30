# Hero v2 look stage — exec'd inside build_hero_v2.py (uses arm, fox, upd, ROOT, sc).
# Shape tweaks, ember-plume tail, fur bake, tufts + ember/flame/leaf cards, materials.
import random
from mathutils import Vector, Matrix, kdtree
TEX = f"{ROOT}/assets/hero/source/v2"
rnd = random.Random(42)
B = {b.name: b for b in arm.data.bones}
def bh(n): return arm.matrix_world @ B[n].head_local
def bt(n): return arm.matrix_world @ B[n].tail_local
def smooth(e0, e1, x):
    t = max(0.0, min(1.0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t)
def srgb(c): return tuple(((v / 255) / 12.92 if v / 255 <= 0.04045 else ((v / 255 + 0.055) / 1.055) ** 2.4) for v in c)

me = fox.data
gname = {g.index: g.name for g in fox.vertex_groups}
def weights(v): return {gname[g.group]: g.weight for g in v.groups if g.weight > 0.001}
def wsum(w, *names): return sum(w.get(n, 0) for n in names)

# ---------------------------------------------------------------- 1. shape: neck/chest ruff mass, cheeks, slimmer belly
bm = bmesh.new(); bm.from_mesh(me); bm.verts.ensure_lookup_table(); bm.normal_update()
dl = bm.verts.layers.deform.active
head_c = (bh("Head") + bt("Head")) / 2
for v in bm.verts:
    w = {gname[k]: x for k, x in v[dl].items()}
    n = v.normal; co = v.co
    neck = wsum(w, "Neck1", "Neck2") + 0.7 * w.get("Neck3", 0) + 0.55 * w.get("Torso3", 0)
    push = 0.075 * neck
    if n.y < 0 or n.z < 0:  # chest bib bulges forward / down
        push += 0.06 * neck * max(-n.y, -n.z, 0)
    hw = w.get("Head", 0)
    if hw > 0.3 and abs(n.x) > 0.45 and co.y > head_c.y - 0.05 and co.z < head_c.z + 0.05:
        push += 0.05 * hw * abs(n.x)  # cheek fluff
    belly = wsum(w, "Torso", "Torso2")
    if n.z < -0.5: push -= 0.03 * belly  # tuck the belly (lean)
    v.co += n * push
nose_ids = set(i for p in me.polygons if me.materials[p.material_index].name == "Black" for i in p.vertices)
if nose_ids:
    nc = sum((bm.verts[i].co for i in nose_ids), Vector()) / len(nose_ids)
    for i in nose_ids: bm.verts[i].co = nc + (bm.verts[i].co - nc) * 0.72 + Vector((0, 0.012, 0))
# delete the old thin tail beyond the root (rebuilt as plume)
kill = [v for v in bm.verts if sum(x for k, x in v[dl].items() if gname[k] in ("Tail2", "Tail3", "Tail4", "Tail5", "Tail6", "Tail7", "Tail8")) > 0.5]
bmesh.ops.delete(bm, geom=kill, context="VERTS")
bm.to_mesh(me); bm.free(); me.update()

# ---------------------------------------------------------------- 2. region colours (rest pose rules)
PAL = dict(rust=(184, 76, 26), dorsal=(128, 48, 18), belly=(214, 140, 84), cream=(236, 218, 190),
           umber=(98, 54, 30), sock=(42, 29, 22), earback=(58, 34, 24), nose=(22, 15, 13),
           amber=(236, 152, 38), pupil=(30, 14, 8), liner=(64, 32, 18))
mat_names = [m.name for m in me.materials]
MI = {n: i for i, n in enumerate(mat_names)}
eye_vs, nose_vs, cream_vs, grey_vs = set(), set(), set(), set()
for p in me.polygons:
    nm = mat_names[p.material_index]
    tgt = eye_vs if nm == "Eyes" else nose_vs if nm == "Black" else cream_vs if nm == "Main_Light" else grey_vs if nm == "Grey" else None
    if tgt is not None: tgt.update(p.vertices)
eye_cos = [me.vertices[i].co.copy() for i in eye_vs]
ekd = kdtree.KDTree(len(eye_cos))
for i, c in enumerate(eye_cos): ekd.insert(c, i)
ekd.balance()
eyeL = Vector(map(lambda *a: sum(a) / len(a), *[c for c in eye_cos if c.x > 0]))
eyeR = Vector(map(lambda *a: sum(a) / len(a), *[c for c in eye_cos if c.x < 0]))
def mix(a, b, t): return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))
cols, legmask = [], []
for v in me.vertices:
    w = weights(v); co, n = v.co, v.normal
    leg_lo = wsum(w, "FrontLowerLeg.L", "FrontLowerLeg.R", "BackLowerLeg.L", "BackLowerLeg.R")
    leg_up = wsum(w, "FrontUpperLeg.L", "FrontUpperLeg.R", "BackUpperLeg.L", "BackUpperLeg.R")
    leg = min(1, leg_lo + leg_up + 0.5 * wsum(w, "BackLeg.L", "BackLeg.R"))
    legmask.append(leg)
    c = PAL["rust"]
    c = mix(c, PAL["dorsal"], smooth(0.3, 0.95, n.z) * 0.55)            # darker topline
    c = mix(c, PAL["belly"], smooth(-0.2, -0.85, n.z) * 0.6)            # paler underside
    if v.index in cream_vs and not (co.y > 0.45 and co.z > 1.25): c = PAL["cream"]  # no cream rump patch
    if v.index in grey_vs: c = PAL["sock"]
    # legs: umber thighs -> charcoal socks (front darker higher, like the turnaround)
    front = wsum(w, "FrontLowerLeg.L", "FrontLowerLeg.R", "FrontUpperLeg.L", "FrontUpperLeg.R") > 0.3
    top = 1.30 if front else 1.15
    lt = leg * (1 - smooth(top - 0.35, top, co.z))
    c = mix(c, PAL["umber"], lt)
    c = mix(c, PAL["sock"], max(leg * (1 - smooth(0.45, 0.95, co.z)), 1 - smooth(0.42, 0.6, co.z)))
    # ears: dark backs + tips, pale inner
    ear = wsum(w, *[f"Ear{i}.{s}" for i in (1, 2, 3, 4) for s in "LR"])
    if ear > 0.2:
        tipt = wsum(w, "Ear3.L", "Ear3.R", "Ear4.L", "Ear4.R")
        if n.y > -0.1: c = mix(c, PAL["earback"], min(1, ear) * (0.35 + 0.65 * tipt))
        else: c = mix(c, (225, 190, 160), min(1, ear) * 0.7 * (1 - tipt)); c = mix(c, PAL["earback"], tipt * 0.6)
    # eye liner ring + amber eyes with slit pupils
    d, _, _ = ekd.find(co)
    if v.index in eye_vs:
        e = eyeL if co.x > 0 else eyeR
        dz = abs(co.z - e.z) / 0.035; dyx = abs((co - e).xy.length) / 0.07
        c = mix(PAL["amber"], PAL["pupil"], 1 - smooth(0.12, 0.35, dyx))
    elif d < 0.07: c = mix(c, PAL["liner"], 1 - smooth(0.02, 0.07, d))
    if v.index in nose_vs: c = PAL["nose"]
    cols.append(c)
# soften region borders (not eyes / nose)
adj = [[] for _ in me.vertices]
for e in me.edges:
    a, b = e.vertices; adj[a].append(b); adj[b].append(a)
for it in range(3):
    new = []
    for i, c in enumerate(cols):
        if i in eye_vs or i in nose_vs or not adj[i]: new.append(c); continue
        s = [cols[j] for j in adj[i]]
        new.append(tuple((c[k] * 2 + sum(x[k] for x in s) / len(s)) / 3 for k in range(3)))
    cols = new
ca = me.color_attributes.new("Region", "BYTE_COLOR", "POINT")
for i, c in enumerate(cols): ca.data[i].color_srgb = (c[0] / 255, c[1] / 255, c[2] / 255, 1)
ma = me.color_attributes.new("Mask", "BYTE_COLOR", "POINT")
for i, l in enumerate(legmask): ma.data[i].color = (l, 0, 0, 1)

# ---------------------------------------------------------------- 3. UV + fur bake (colour*streaks*AO, streak normal)
bpy.context.view_layer.objects.active = fox
for o in sc.objects: o.select_set(o is fox)
bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.006)
bpy.ops.object.mode_set(mode="OBJECT")
BAKE = 1024
img_c = bpy.data.images.new("fox_fur_col", BAKE, BAKE); img_n = bpy.data.images.new("fox_fur_nrm", BAKE, BAKE)
img_n.colorspace_settings.name = "Non-Color"
bake = bpy.data.materials.new("BakeFur"); bake.use_nodes = True
nt = bake.node_tree; N_ = nt.nodes; L_ = nt.links; N_.clear()
def node(t, **kw):
    n = N_.new(t)
    for k, v in kw.items(): setattr(n, k, v)
    return n
out = node("ShaderNodeOutputMaterial")
attr = node("ShaderNodeVertexColor", layer_name="Region")
mask = node("ShaderNodeVertexColor", layer_name="Mask")
tc = node("ShaderNodeTexCoord")
def streak(scale):
    mp = node("ShaderNodeMapping"); mp.inputs["Scale"].default_value = scale
    nz = node("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 1.0
    nz.inputs["Detail"].default_value = 8; nz.inputs["Roughness"].default_value = 0.62
    L_.new(tc.outputs["Object"], mp.inputs["Vector"]); L_.new(mp.outputs["Vector"], nz.inputs["Vector"])
    return nz
body_s = streak((150, 10, 150)); leg_s = streak((150, 150, 12))
sm = node("ShaderNodeMix", data_type="FLOAT"); L_.new(mask.outputs["Color"], sm.inputs["Factor"])
L_.new(body_s.outputs["Fac"], sm.inputs[2]); L_.new(leg_s.outputs["Fac"], sm.inputs[3])
cr = node("ShaderNodeValToRGB"); cr.color_ramp.elements[0].position = 0.36; cr.color_ramp.elements[0].color = (0.5, 0.48, 0.46, 1)
cr.color_ramp.elements[1].position = 0.64; cr.color_ramp.elements[1].color = (1.18, 1.14, 1.08, 1)
L_.new(sm.outputs[0], cr.inputs["Fac"])
big = node("ShaderNodeTexNoise"); big.inputs["Scale"].default_value = 2.5
bigr = node("ShaderNodeMapRange"); bigr.inputs["To Min"].default_value = 0.9; bigr.inputs["To Max"].default_value = 1.08
L_.new(big.outputs["Fac"], bigr.inputs["Value"])
ao = node("ShaderNodeAmbientOcclusion", samples=16); ao.inputs["Distance"].default_value = 0.35
aor = node("ShaderNodeMapRange"); aor.inputs["To Min"].default_value = 0.55; aor.inputs["To Max"].default_value = 1.0
L_.new(ao.outputs["AO"], aor.inputs["Value"])
m1 = node("ShaderNodeMix", data_type="RGBA", blend_type="MULTIPLY"); m1.inputs["Factor"].default_value = 1
L_.new(attr.outputs["Color"], m1.inputs[6]); L_.new(cr.outputs["Color"], m1.inputs[7])
m2 = node("ShaderNodeVectorMath", operation="SCALE"); L_.new(m1.outputs[2], m2.inputs[0]); L_.new(bigr.outputs[0], m2.inputs["Scale"])
m3 = node("ShaderNodeVectorMath", operation="SCALE"); L_.new(m2.outputs[0], m3.inputs[0]); L_.new(aor.outputs[0], m3.inputs["Scale"])
emis = node("ShaderNodeEmission"); L_.new(m3.outputs[0], emis.inputs["Color"])
bsdf = node("ShaderNodeBsdfPrincipled")
bump = node("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.45; bump.inputs["Distance"].default_value = 0.02
L_.new(sm.outputs[0], bump.inputs["Height"]); L_.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
L_.new(emis.outputs[0], out.inputs["Surface"])
tex = node("ShaderNodeTexImage", image=img_c); N_.active = tex
fox.data.materials.clear(); fox.data.materials.append(bake)
for p in fox.data.polygons: p.material_index = 0
eng = sc.render.engine
sc.render.engine = "CYCLES"; sc.cycles.device = "CPU"; sc.cycles.samples = 16
sc.render.bake.margin = 8
bpy.ops.object.bake(type="EMIT", use_clear=True)
img_c.filepath_raw = f"{TEX}/fox_fur_col.jpg"; img_c.file_format = "JPEG"; img_c.save()
L_.new(bsdf.outputs[0], out.inputs["Surface"]); tex.image = img_n; N_.active = tex
bpy.ops.object.bake(type="NORMAL", normal_space="TANGENT", use_clear=True)
img_n.filepath_raw = f"{TEX}/fox_fur_nrm.jpg"; img_n.file_format = "JPEG"; img_n.save()
sc.render.engine = eng
print("BAKED fur")

# ---------------------------------------------------------------- 4. game materials
def load(n, noncolor=False):
    im = bpy.data.images.load(f"{TEX}/{n}"); im.colorspace_settings.name = "Non-Color" if noncolor else "sRGB"; return im
def pbr(name, col=None, nrm=None, emit_img=None, emit_col=None, emit_str=0.0, rough=0.8, alpha=None, alpha_mode=None, spec=0.3):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; b = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    b.inputs["Roughness"].default_value = rough
    b.inputs["Specular IOR Level"].default_value = spec
    if col:
        t = nt.nodes.new("ShaderNodeTexImage"); t.image = col
        nt.links.new(t.outputs["Color"], b.inputs["Base Color"])
        if alpha_mode == "BLEND":
            nt.links.new(t.outputs["Alpha"], b.inputs["Alpha"])
        elif alpha_mode == "MASK":
            mth = nt.nodes.new("ShaderNodeMath"); mth.operation = "GREATER_THAN"; mth.inputs[1].default_value = 0.5
            nt.links.new(t.outputs["Alpha"], mth.inputs[0]); nt.links.new(mth.outputs[0], b.inputs["Alpha"])
    if nrm:
        t = nt.nodes.new("ShaderNodeTexImage"); t.image = nrm
        nm = nt.nodes.new("ShaderNodeNormalMap"); nm.inputs["Strength"].default_value = 0.8
        nt.links.new(t.outputs["Color"], nm.inputs["Color"]); nt.links.new(nm.outputs["Normal"], b.inputs["Normal"])
    if emit_img:
        t = nt.nodes.new("ShaderNodeTexImage"); t.image = emit_img
        nt.links.new(t.outputs["Color"], b.inputs["Emission Color"])
    elif emit_col:
        b.inputs["Emission Color"].default_value = emit_col + (1,)
    b.inputs["Emission Strength"].default_value = emit_str
    m.use_backface_culling = alpha_mode is None
    if alpha_mode == "BLEND":
        m.blend_method = "BLEND"; m.surface_render_method = "BLENDED"
    elif alpha_mode == "MASK":
        m.blend_method = "CLIP"
    return m
fur_c, fur_n = load("fox_fur_col.jpg"), load("fox_fur_nrm.jpg", True)
M_FUR = pbr("FoxFur", fur_c, fur_n, rough=0.82, spec=0.25)
M_EYE = pbr("FoxEye", fur_c, None, emit_img=fur_c, emit_str=0.9, rough=0.15, spec=0.6)
M_NOSE = pbr("FoxNose", fur_c, None, rough=0.3, spec=0.5)
fox.data.materials.clear()
for m_ in (M_FUR, M_EYE, M_NOSE): fox.data.materials.append(m_)
for p in me.polygons:
    vs = set(p.vertices)
    p.material_index = 1 if vs <= eye_vs else 2 if vs <= nose_vs else 0
fox.data.color_attributes.remove(fox.data.color_attributes["Mask"])
fox.data.color_attributes.remove(fox.data.color_attributes["Region"])
tail_c, tail_e = load("tail_col.png"), load("tail_emit.png")
M_TAIL = pbr("EmberTail", tail_c, None, emit_img=tail_e, emit_str=2.2, rough=0.7, spec=0.2)
M_TAIL.use_backface_culling = True
cards_c, cards_e = load("cards_col.png"), load("cards_emit.png")
M_TUFT = pbr("FurTufts", cards_c, None, rough=0.85, alpha_mode="MASK", spec=0.2)
M_FLAME = pbr("EmberWisps", cards_c, None, emit_img=cards_e, emit_str=1.8, rough=0.6, alpha_mode="BLEND", spec=0.0)

# ---------------------------------------------------------------- 5. ember plume tail
chain = [f"Tail{i}" for i in range(1, 9)]
spine = [bh(n) for n in chain] + [bt("Tail8")]
seglen = [(spine[i + 1] - spine[i]).length for i in range(len(spine) - 1)]
total = sum(seglen)
def at(s):
    """point, tangent, bone-weights at arc fraction s (0..1, extrapolate beyond)."""
    d = s * total
    for i, L in enumerate(seglen):
        if d <= L or i == len(seglen) - 1:
            t = d / L
            p = spine[i].lerp(spine[i + 1], t) if t <= 1 else spine[i + 1] + (spine[i + 1] - spine[i]).normalized() * (d - L)
            tan = (spine[i + 1] - spine[i]).normalized()
            if i + 1 < len(seglen) and t > 0.5:
                tan = tan.lerp((spine[i + 2] - spine[i + 1]).normalized(), (t - 0.5)).normalized()
            w = {chain[i]: 1 - 0.5 * max(0, t - 0.5), }
            if i + 1 < len(chain) and t > 0.5: w[chain[i + 1]] = 0.5 * (t - 0.5) * 2 * 0.5
            tot = sum(w.values()); return p, tan, {k: x / tot for k, x in w.items()}
        d -= L
RPROF = [(0, 0.11), (0.12, 0.22), (0.35, 0.36), (0.6, 0.43), (0.8, 0.40), (0.93, 0.27), (1.0, 0.07)]
def radius(s):
    for (a, ra), (b, rb) in zip(RPROF, RPROF[1:]):
        if s <= b:
            t = (s - a) / (b - a); t = t * t * (3 - 2 * t); return ra + (rb - ra) * t
    return RPROF[-1][1]
def new_obj(name):
    m = bpy.data.meshes.new(name); o = bpy.data.objects.new(name, m); sc.collection.objects.link(o)
    o.parent = arm; md = o.modifiers.new("Armature", "ARMATURE"); md.object = arm
    return o
tail = new_obj("SpiritFox_Tail")
bmt = bmesh.new(); uvl = bmt.loops.layers.uv.new("UVMap"); dft = bmt.verts.layers.deform.new()
gi = {}
def gidx(o, n):
    if n not in o.vertex_groups: o.vertex_groups.new(name=n)
    return o.vertex_groups[n].index
RINGS, SEG = 56, 28
side0 = Vector((1, 0, 0))
rings = []
prev_side = side0
for r in range(RINGS + 1):
    s = r / RINGS
    p, tan, w = at(s)
    side = (prev_side - tan * prev_side.dot(tan)).normalized(); prev_side = side
    up = side.cross(tan).normalized()
    ring = []
    for k in range(SEG):
        th = k / SEG * 2 * math.pi
        lob = 1 + 0.13 * math.sin(7 * th + s * 9) + 0.07 * math.sin(13 * th - s * 15) + (0.12 * math.sin(5 * th + s * 30) * smooth(0.7, 1, s))
        rr = radius(s) * lob * (1.0 - 0.12 * max(0, -math.sin(th)))  # slightly flatter underside
        q = p + (side * math.cos(th) + up * math.sin(th)) * rr
        v = bmt.verts.new(q)
        for bn, x in w.items(): v[dft][gidx(tail, bn)] = x
        ring.append(v)
    rings.append(ring)
for r in range(RINGS):
    for k in range(SEG):
        a, b2, c2, d2 = rings[r][k], rings[r][(k + 1) % SEG], rings[r + 1][(k + 1) % SEG], rings[r + 1][k]
        f = bmt.faces.new((a, b2, c2, d2))
        for lp, (u, vv) in zip(f.loops, [(k / SEG, r / RINGS), ((k + 1) / SEG, r / RINGS), ((k + 1) / SEG, (r + 1) / RINGS), (k / SEG, (r + 1) / RINGS)]):
            lp[uvl].uv = (u, vv)
        f.smooth = True
bmesh.ops.contextual_create(bmt, geom=rings[-1])  # cap tip
bmt.normal_update(); bmt.to_mesh(tail.data); bmt.free()
tail.data.materials.append(M_TAIL)

# ---------------------------------------------------------------- 6. cards: tufts, ember wisps, leaves
UV = {  # atlas rects (u0, v0, u1, v1) in Blender UV (v up)
    "flame0": (0.0, 0.5, 0.25, 1.0), "flame1": (0.25, 0.5, 0.5, 1.0), "flame2": (0.0, 0.0, 0.25, 0.5), "flame3": (0.25, 0.0, 0.5, 0.5),
    "cream": (0.5, 0.5, 0.75, 1.0), "rusttuft": (0.75, 0.5, 1.0, 1.0),
    "leaf0": (0.5, 0.25, 0.75, 0.5), "leaf1": (0.75, 0.25, 1.0, 0.5), "leaf2": (0.5, 0.0, 0.75, 0.25), "leaf3": (0.75, 0.0, 1.0, 0.25),
}
cards = {"tuft": new_obj("SpiritFox_Fur"), "flame": new_obj("SpiritFox_Wisps")}
cbm = {k: bmesh.new() for k in cards}
for k, b_ in cbm.items(): b_.loops.layers.uv.new("UVMap"); b_.verts.layers.deform.new()
def card(kind, base, up, facing, w, h, rect, wts, cross=False, wts_top=None):
    b_ = cbm[kind]; uvl_ = b_.loops.layers.uv.active; df = b_.verts.layers.deform.active; o = cards[kind]
    up = up.normalized(); side = up.cross(facing).normalized()
    if side.length < 1e-4: side = up.orthogonal().normalized()
    sides = [side] + ([up.cross(side).normalized()] if cross else [])
    u0, v0, u1, v1 = UV[rect]
    for sd in sides:
        ps = [base - sd * w / 2, base + sd * w / 2, base + sd * w / 2 + up * h, base - sd * w / 2 + up * h]
        vs = [b_.verts.new(p) for p in ps]
        for i, v in enumerate(vs):
            ww = wts if (i < 2 or not wts_top) else wts_top
            for bn, x in ww.items(): v[df][gidx(o, bn)] = x
        f = b_.faces.new(vs)
        for lp, uv in zip(f.loops, [(u0, v0), (u1, v0), (u1, v1), (u0, v1)]): lp[uvl_].uv = uv
FL = ["flame0", "flame1", "flame2", "flame3"]
# ear-tip embers (two crossed per ear) — follow the ear direction
for s in "LR":
    e1, e4 = bh(f"Ear1.{s}"), bt(f"Ear4.{s}")
    d = (e4 - e1).normalized()
    for j in range(2):
        card("flame", e4 - d * 0.34 + Vector((rnd.uniform(-.02, .02), 0, 0)), (d + Vector((0, 0.55 + 0.3 * j, 0.1))).normalized(), Vector((0, -1, 0)),
             0.2, 0.36 + 0.08 * j, FL[(j + (s == "R")) % 4], {f"Ear4.{s}": 1.0}, cross=True)
# scruff embers along the back of the head / neck crest
for j in range(5):
    t = j / 4
    p = bh("Neck2").lerp(bh("Head"), t) + Vector((rnd.uniform(-0.08, 0.08), 0.05, 0.12))
    card("flame", p, Vector((0, 0.45, 1)), Vector((1, 0, 0)), 0.24, 0.32 + 0.12 * (1 - t), FL[j % 4], {"Neck3" if t > 0.5 else "Neck2": 1.0}, cross=True)
# surface-sampled tufts
body_v = [(v.co.copy(), v.normal.copy(), weights(v)) for v in me.vertices]
def pick(cond, n):
    cand = [x for x in body_v if cond(*x)]
    rnd.shuffle(cand); return cand[:n]
def topw(w):
    it = sorted(w.items(), key=lambda kv: -kv[1])[:3]; s = sum(x for _, x in it) or 1
    return {k: x / s for k, x in it}
# cream chest bib / throat ruff (hangs down, splays outward)
for co, n, w in pick(lambda co, n, w: wsum(w, "Neck1", "Neck2", "Torso3") > 0.5 and n.y < -0.25 and n.z < 0.5 and co.z > 1.75, 18):
    dirn = (Vector((0, 0, -1)) * 0.75 + n * 0.4 + Vector((0, 0.15, 0))).normalized()
    card("tuft", co - n * 0.04, dirn, n, rnd.uniform(0.14, 0.2), rnd.uniform(0.17, 0.24), "cream", topw(w))
# cheek fluff (sweeps back and out)
for co, n, w in pick(lambda co, n, w: w.get("Head", 0) > 0.6 and abs(n.x) > 0.6 and co.z < head_c.z and co.y > head_c.y - 0.08, 10):
    dirn = (Vector((math.copysign(0.6, n.x), 0.7, -0.35))).normalized()
    card("tuft", co - n * 0.02, dirn, n, 0.13, 0.2, "cream", topw(w))
# rust fur flow over neck crest, shoulders, haunches (lies back along the body)
for co, n, w in pick(lambda co, n, w: n.z > 0.3 and abs(n.x) < 0.6 and wsum(w, "Neck1", "Neck2", "Neck3") > 0.6, 12):
    dirn = (Vector((0, 1, -0.1)) + n * 0.25).normalized()
    card("tuft", co - n * 0.03, dirn, n, rnd.uniform(0.14, 0.2), rnd.uniform(0.18, 0.26), "rusttuft", topw(w))
# tail ember tongues + leaves (weights follow the spine)
for j in range(20):
    s = 0.5 + 0.5 * (j / 19) ** 0.7
    p, tan, w = at(s); th = rnd.uniform(-0.3, math.pi + 0.3)
    side = Vector((1, 0, 0)); up = side.cross(tan).normalized()
    off = (side * math.cos(th) + up * math.sin(th))
    base = p + off * radius(s) * 0.7
    dirn = (tan * 0.7 + off * 0.3 + Vector((0, 0, 0.55))).normalized()
    h = 0.25 + 0.75 * (s - 0.5) * 2
    _, _, w2 = at(min(1.0, s + 0.12))
    card("flame", base, dirn, off, h * 0.5, h, FL[j % 4], w, cross=True, wts_top=w2)
for j in range(5):  # tip flare sweeping up/back
    p, tan, w = at(0.9 + 0.025 * j)
    card("flame", p, (tan + Vector((rnd.uniform(-.35, .35), 0, 0.6 + 0.25 * j))).normalized(), Vector((1, 0, 0)), 0.55, 1.05, FL[j % 4], w, cross=True)
for j in range(10):
    s = rnd.uniform(0.6, 1.15)
    p, tan, w = at(min(s, 1.0))
    if s > 1: p = p + tan * (s - 1) * total
    off = Vector((rnd.uniform(-1, 1), rnd.uniform(-0.3, 0.6), rnd.uniform(-0.2, 1))).normalized()
    base = p + off * (radius(min(s, 1)) + rnd.uniform(0.1, 0.35))
    card("flame", base, Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(-1, 1))), off, 0.12, 0.12, f"leaf{j % 4}", w)
for k, o in cards.items():
    cbm[k].to_mesh(o.data); cbm[k].free()
    o.data.materials.append(M_TUFT if k == "tuft" else M_FLAME)
    for p in o.data.polygons: p.use_smooth = False
print("LOOK done", {o.name: len(o.data.polygons) for o in [fox, tail] + list(cards.values())})
