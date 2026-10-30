# Hero v2 look stage — exec'd inside build_hero_v2.py (uses arm, fox, upd, ROOT, sc).
# Shape tweaks, fur bake, flame-plume tail (fur root -> translucent flame), ear curls, flake embers, FX flicker bones.
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

# ---------------------------------------------------------------- 1. shape: ruff, cheeks, lean belly, long snout, paws
bm = bmesh.new(); bm.from_mesh(me); bm.verts.ensure_lookup_table(); bm.normal_update()
dl = bm.verts.layers.deform.active
head_c = (bh("Head") + bt("Head")) / 2
for v in bm.verts:
    w = {gname[k]: x for k, x in v[dl].items()}
    n = v.normal; co = v.co
    neck = wsum(w, "Neck1", "Neck2") + 0.7 * w.get("Neck3", 0) + 0.55 * w.get("Torso3", 0)
    push = 0.055 * neck
    if n.y < 0 or n.z < 0:  # chest bib bulges forward / down (slender, not barrel)
        push += 0.035 * neck * max(-n.y, -n.z, 0)
    hw = w.get("Head", 0)
    if hw > 0.3 and abs(n.x) > 0.45 and co.y > head_c.y - 0.05 and co.z < head_c.z + 0.05:
        push += 0.05 * hw * abs(n.x)  # cheek fluff
    if hw > 0.3 and n.z < -0.3 and co.y > head_c.y - 0.12:
        push += 0.045 * hw * -n.z  # full throat under the jaw (no shadow shelf between cheeks and bib)
    belly = wsum(w, "Torso", "Torso2")
    if n.z < -0.5: push -= 0.035 * belly  # tuck the belly (lean)
    v.co += n * push
# longer, sharper snout: stretch everything in front of the eyes forward and taper it
eye_ids = set(i for p in me.polygons if me.materials[p.material_index].name == "Eyes" for i in p.vertices)
nose_ids = set(i for p in me.polygons if me.materials[p.material_index].name == "Black" for i in p.vertices)
ey = sum((bm.verts[i].co.y for i in eye_ids)) / len(eye_ids)
zc = sum((bm.verts[i].co.z for i in nose_ids)) / len(nose_ids) - 0.03
snout = [v for v in bm.verts if sum(x for k, x in v[dl].items() if gname[k] == "Head") > 0.5 and v.co.y < ey - 0.03]
fmax = max(ey - 0.03 - v.co.y for v in snout)
for v in snout:
    f = ey - 0.03 - v.co.y; t = f / fmax
    v.co.y = ey - 0.03 - f * 1.42
    v.co.x *= 1 - 0.30 * t
    v.co.z = zc + (v.co.z - zc) * (1 - 0.16 * t)
# rounder, bigger paws: spread + push the toes forward, flat sole
paw_groups = [g for g in gname.values() if "Paw" in g]
for pg in paw_groups:
    vs = [v for v in bm.verts if sum(x for k, x in v[dl].items() if gname[k] == pg) > 0.35 and v.co.z < 0.24]
    if not vs: continue
    c = sum((v.co for v in vs), Vector()) / len(vs)
    for v in vs:
        k = smooth(0.24, 0.02, v.co.z)
        d = v.co - c
        v.co.x = c.x + d.x * (1 + 0.32 * k)
        v.co.y = c.y + d.y * (1 + (0.55 if d.y < 0 else 0.15) * k) - 0.03 * k
        v.co.z = max(v.co.z, GROUND + 0.005)
nose_ids = set(i for p in me.polygons if me.materials[p.material_index].name == "Black" for i in p.vertices)
if nose_ids:
    nc = sum((bm.verts[i].co for i in nose_ids), Vector()) / len(nose_ids)
    for i in nose_ids: bm.verts[i].co = nc + (bm.verts[i].co - nc) * 0.62 + Vector((0, 0.004, 0))
# delete the old thin tail beyond the root (rebuilt as plume)
kill = [v for v in bm.verts if sum(x for k, x in v[dl].items() if gname[k] in ("Tail2", "Tail3", "Tail4", "Tail5", "Tail6", "Tail7", "Tail8")) > 0.5]
bmesh.ops.delete(bm, geom=kill, context="VERTS")
bm.to_mesh(me); bm.free(); me.update()

# ---------------------------------------------------------------- 2. region colours (rest pose rules)
# warm burnt orange (yellower than vermilion: ACES + warm fog push it red in engine); sock/paw authored a
# notch light because the streak * AO bake darkens them (lands near the concept's (102, 62, 38) umber)
PAL = dict(rust=(210, 116, 46), dorsal=(180, 90, 34), belly=(230, 156, 92), cream=(238, 222, 192),
           umber=(138, 82, 46), sock=(118, 74, 44), paw=(84, 55, 37), earback=(70, 40, 26), nose=(22, 15, 13),
           amber=(236, 156, 40), pupil=(30, 14, 8), liner=(70, 36, 20), earin=(236, 214, 186))
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
CHEST_Y = bh("FrontUpperLeg.L").y + 0.12  # in front of this = chest / throat; behind = belly
cols, legmask, furlen, glow, throat = [], [], [], [], []
for v in me.vertices:
    w = weights(v); co, n = v.co, v.normal
    front_leg = wsum(w, *[f"Front{b}.{s}" for b in ("UpperLeg", "LowerLeg", "Paw") for s in "LR"])
    back_leg = wsum(w, *[f"Back{b}.{s}" for b in ("UpperLeg", "LowerLeg", "Paw") for s in "LR"]) + 0.6 * wsum(w, "BackLeg.L", "BackLeg.R")
    leg = min(1, front_leg + back_leg)
    legmask.append(leg)
    c = PAL["rust"]
    c = mix(c, PAL["dorsal"], smooth(0.35, 0.95, n.z) * 0.45)           # slightly deeper topline
    c = mix(c, PAL["belly"], smooth(-0.3, -0.85, n.z) * 0.55)           # warm pale underside (not pink)
    # cream: throat + bib tapering down the chest, muzzle, cheeks, inner ears (no belly/rump patches)
    if v.index in cream_vs and leg < 0.3:
        if w.get("Head", 0) > 0.3 or wsum(w, *[f"Ear{i}.{s}" for i in (1, 2, 3, 4) for s in "LR"]) > 0.3:
            k = 1.0
        elif co.y < CHEST_Y:
            half = 0.07 + 0.2 * smooth(1.25, 1.95, co.z)  # V-shaped bib: wide at the throat, narrow between the forelegs
            k = smooth(1.12, 1.4, co.z) * (1 - smooth(half - 0.03, half + 0.05, abs(co.x)))
        else:
            k = 0.0
        c = mix(c, PAL["cream"], k)
    # jaw underside + upper throat: always cream and never AO-darkened (else a dark "collar" under the jaw)
    jaw = smooth(-0.1, -0.5, n.z) * smooth(head_c.y + 0.25, head_c.y - 0.05, co.y) * (1 - smooth(0.12, 0.2, abs(co.x)))
    jaw *= min(1.0, w.get("Head", 0) + wsum(w, "Neck2", "Neck3")) * (1 if leg < 0.2 else 0)
    c = mix(c, PAL["cream"], jaw)
    throat.append(max(jaw, smooth(0.1, 0.5, min(1.0, wsum(w, "Neck2", "Neck3", "Head"))) * smooth(-0.2, -0.6, n.z)))
    if v.index in grey_vs: c = PAL["sock"]
    # legs: burnt orange to the knee/elbow, then umber -> dark sock -> darkest paws
    if leg > 0.05:
        top = 1.06 if front_leg >= back_leg else 0.98
        lt = leg * (1 - smooth(top - 0.18, top + 0.04, co.z))
        c = mix(c, PAL["umber"], lt)
        c = mix(c, PAL["sock"], leg * (1 - smooth(top - 0.42, top - 0.14, co.z)))
        c = mix(c, PAL["paw"], leg * (1 - smooth(0.06, 0.26, co.z)))
    # ears: dark backs + tips, pale inner
    ear = wsum(w, *[f"Ear{i}.{s}" for i in (1, 2, 3, 4) for s in "LR"])
    if ear > 0.2:
        tipt = wsum(w, "Ear3.L", "Ear3.R", "Ear4.L", "Ear4.R")
        if n.y > -0.1: c = mix(c, PAL["earback"], min(1, ear) * (0.15 + 0.85 * tipt))
        else: c = mix(c, PAL["earin"], min(1, ear) * 0.75 * (1 - tipt)); c = mix(c, PAL["earback"], tipt * 0.7)
    # eye liner ring + amber eyes with slit pupils
    d, _, _ = ekd.find(co)
    if v.index in eye_vs:
        e = eyeL if co.x > 0 else eyeR
        dyx = abs((co - e).xy.length) / 0.07
        c = mix(PAL["amber"], PAL["pupil"], 1 - smooth(0.12, 0.35, dyx))
    elif d < 0.07: c = mix(c, PAL["liner"], 1 - smooth(0.02, 0.07, d))
    if v.index in nose_vs: c = PAL["nose"]
    cols.append(c)
    # shell-fur length (model units; fox ~3.3 tall): long ruff/cheeks, short face/lower legs, none on paws/eyes
    neck = wsum(w, "Neck1", "Neck2", "Neck3", "Torso3")
    L = 0.06 + 0.06 * min(1, neck) + 0.025 * wsum(w, "Back", "BackLeg.L", "BackLeg.R")
    if w.get("Head", 0) > 0.4: L = 0.016 + 0.05 * smooth(0.2, 0.6, abs(n.x)) * (1 - smooth(-0.3, -0.7, n.y))
    L = max(L, 0.07 * jaw)  # throat fur hangs over the jaw / bib crease
    if ear > 0.3: L = 0.012
    L *= 1 - 0.75 * leg * (1 - smooth(0.7, 1.2, co.z))
    if v.index in eye_vs or v.index in nose_vs or (d < 0.05): L = 0.0
    if co.z < 0.2: L = 0.0
    furlen.append(L)
    # spirit inner glow (under the fur): faint heat at the shoulders / nape only (concept has no flame ridge,
    # no flank or chest glow)
    g = 0.45 * min(1, wsum(w, "Torso3", "Neck1", "Neck2")) * smooth(0.55, 0.95, n.z)
    glow.append(min(1.0, g * (1 - leg) * (0 if ear > 0.2 or w.get("Head", 0) > 0.5 else 1)))
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
# fur length: relax steps (head short -> ruff long made a dark shell ledge under the jaw = "collar")
for it in range(4):
    furlen = [0.0 if L <= 0 else (L * 2 + sum(furlen[j] for j in adj[i]) / len(adj[i])) / 3 if adj[i] else L for i, L in enumerate(furlen)]
for it in range(2):
    glow = [(g * 2 + sum(glow[j] for j in adj[i]) / len(adj[i])) / 3 if adj[i] else g for i, g in enumerate(glow)]
ga = me.color_attributes.new("Glow", "BYTE_COLOR", "POINT")
for i, g in enumerate(glow): ga.data[i].color = (g, g, g, 1)
ma = me.color_attributes.new("Mask", "BYTE_COLOR", "POINT")
for i, l in enumerate(legmask): ma.data[i].color = (l, throat[i], 0, 1)

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
cr = node("ShaderNodeValToRGB"); cr.color_ramp.elements[0].position = 0.34; cr.color_ramp.elements[0].color = (0.56, 0.5, 0.46, 1)
cr.color_ramp.elements[1].position = 0.66; cr.color_ramp.elements[1].color = (1.16, 1.1, 1.02, 1)
L_.new(sm.outputs[0], cr.inputs["Fac"])
big = node("ShaderNodeTexNoise"); big.inputs["Scale"].default_value = 2.5
bigr = node("ShaderNodeMapRange"); bigr.inputs["To Min"].default_value = 0.9; bigr.inputs["To Max"].default_value = 1.08
L_.new(big.outputs["Fac"], bigr.inputs["Value"])
ao = node("ShaderNodeAmbientOcclusion", samples=16); ao.inputs["Distance"].default_value = 0.35
aor = node("ShaderNodeMapRange"); aor.inputs["To Min"].default_value = 0.68; aor.inputs["To Max"].default_value = 1.0
L_.new(ao.outputs["AO"], aor.inputs["Value"])
msep = node("ShaderNodeSeparateColor"); L_.new(mask.outputs["Color"], msep.inputs["Color"])
aom = node("ShaderNodeMix", data_type="FLOAT"); aom.inputs[3].default_value = 1.0   # throat mask (G) -> no AO
L_.new(msep.outputs[1], aom.inputs["Factor"]); L_.new(aor.outputs[0], aom.inputs[2])
m1 = node("ShaderNodeMix", data_type="RGBA", blend_type="MULTIPLY"); m1.inputs["Factor"].default_value = 1
L_.new(attr.outputs["Color"], m1.inputs[6]); L_.new(cr.outputs["Color"], m1.inputs[7])
m2 = node("ShaderNodeVectorMath", operation="SCALE"); L_.new(m1.outputs[2], m2.inputs[0]); L_.new(bigr.outputs[0], m2.inputs["Scale"])
m3 = node("ShaderNodeVectorMath", operation="SCALE"); L_.new(m2.outputs[0], m3.inputs[0]); L_.new(aom.outputs[0], m3.inputs["Scale"])
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
# strand mask for the fur shells: voronoi dots (one per hair clump), random length, tapered profile
img_s = bpy.data.images.new("fox_fur_strand", BAKE, BAKE); img_s.colorspace_settings.name = "Non-Color"
for n_ in list(N_):
    if n_.type not in ("OUTPUT_MATERIAL", "TEX_IMAGE"): N_.remove(n_)
tc2 = node("ShaderNodeTexCoord")
mp2 = node("ShaderNodeMapping"); mp2.inputs["Scale"].default_value = (74, 16, 60)  # clumps stretched along the body
vor = node("ShaderNodeTexVoronoi"); vor.inputs["Scale"].default_value = 1.0; vor.inputs["Randomness"].default_value = 1.0
L_.new(tc2.outputs["Object"], mp2.inputs["Vector"]); L_.new(mp2.outputs["Vector"], vor.inputs["Vector"])
fall = node("ShaderNodeMapRange", interpolation_type="SMOOTHSTEP"); fall.inputs["From Min"].default_value = 0.0
fall.inputs["From Max"].default_value = 0.78; fall.inputs["To Min"].default_value = 1.0; fall.inputs["To Max"].default_value = 0.0
L_.new(vor.outputs["Distance"], fall.inputs["Value"])
sep = node("ShaderNodeSeparateColor"); L_.new(vor.outputs["Color"], sep.inputs["Color"])
lenr = node("ShaderNodeMapRange"); lenr.inputs["To Min"].default_value = 0.55; lenr.inputs["To Max"].default_value = 1.0
L_.new(sep.outputs[0], lenr.inputs["Value"])
mul = node("ShaderNodeMath", operation="MULTIPLY"); L_.new(fall.outputs[0], mul.inputs[0]); L_.new(lenr.outputs[0], mul.inputs[1])
em2 = node("ShaderNodeEmission"); L_.new(mul.outputs[0], em2.inputs["Color"])
out = next(n_ for n_ in N_ if n_.type == "OUTPUT_MATERIAL"); L_.new(em2.outputs[0], out.inputs["Surface"])
tex = next(n_ for n_ in N_ if n_.type == "TEX_IMAGE"); tex.image = img_s; N_.active = tex
sc.render.engine = "CYCLES"
bpy.ops.object.bake(type="EMIT", use_clear=True)
sc.render.engine = eng
import numpy as np
px_c = np.empty(BAKE * BAKE * 4, dtype=np.float32); img_c.pixels.foreach_get(px_c)
px_s = np.empty(BAKE * BAKE * 4, dtype=np.float32); img_s.pixels.foreach_get(px_s)
px_c = px_c.reshape(-1, 4); px_c[:, 3] = px_s.reshape(-1, 4)[:, 0]
img_sh = bpy.data.images.new("fox_fur_shell", BAKE, BAKE, alpha=True)
img_sh.pixels.foreach_set(px_c.ravel())
img_sh.filepath_raw = f"{TEX}/fox_fur_shell.png"; img_sh.file_format = "PNG"; img_sh.save()
# inner-glow mask -> RGBA ember texture (alpha = mask broken up by the fur-clump strands)
for n_ in list(N_):
    if n_.type not in ("OUTPUT_MATERIAL", "TEX_IMAGE"): N_.remove(n_)
gcol = node("ShaderNodeVertexColor", layer_name="Glow"); em3 = node("ShaderNodeEmission")
L_.new(gcol.outputs["Color"], em3.inputs["Color"]); L_.new(em3.outputs[0], out.inputs["Surface"])
img_g = bpy.data.images.new("fox_glow_mask", BAKE // 2, BAKE // 2); img_g.colorspace_settings.name = "Non-Color"
tex.image = img_g; N_.active = tex
sc.render.engine = "CYCLES"
bpy.ops.object.bake(type="EMIT", use_clear=True)
sc.render.engine = eng
GB = BAKE // 2
px_g = np.empty(GB * GB * 4, dtype=np.float32); img_g.pixels.foreach_get(px_g)
gm = px_g.reshape(-1, 4)[:, 0]
strand = px_s.reshape(BAKE, BAKE, 4)[::2, ::2, 0].ravel()
ga_ = np.clip(gm * (0.45 + 0.55 * strand) * 0.9, 0, 0.45)
ember_lo, ember_hi = np.array(srgb((214, 82, 18))), np.array(srgb((250, 160, 52)))  # amber, never white
rgb = ember_lo[None, :] + (ember_hi - ember_lo)[None, :] * np.clip(gm, 0, 1)[:, None] ** 1.5
img_gl = bpy.data.images.new("fox_glow", GB, GB, alpha=True)
img_gl.pixels.foreach_set(np.concatenate([rgb, ga_[:, None]], axis=1).astype(np.float32).ravel())
img_gl.filepath_raw = f"{TEX}/fox_glow.png"; img_gl.file_format = "PNG"; img_gl.save()
print("BAKED fur")

# ---------------------------------------------------------------- 4. game materials
def load(n, noncolor=False):
    im = bpy.data.images.load(f"{TEX}/{n}"); im.colorspace_settings.name = "Non-Color" if noncolor else "sRGB"; return im
def pbr(name, col=None, nrm=None, emit_img=None, emit_col=None, emit_str=0.0, rough=0.8, alpha_mode=None, spec=0.3, clip=0.5):
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
            mth = nt.nodes.new("ShaderNodeMath"); mth.operation = "GREATER_THAN"; mth.inputs[1].default_value = clip
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
        m.blend_method = "CLIP"; m.alpha_threshold = clip
    return m
fur_c, fur_n, fur_sh = load("fox_fur_col.jpg"), load("fox_fur_nrm.jpg", True), load("fox_fur_shell.png")
M_FUR = pbr("FoxFur", fur_c, fur_n, rough=0.85, spec=0.2)
M_EYE = pbr("FoxEye", fur_c, None, emit_img=fur_c, emit_str=0.6, rough=0.15, spec=0.6)
M_NOSE = pbr("FoxNose", fur_c, None, rough=0.3, spec=0.5)
fox.data.materials.clear()
for m_ in (M_FUR, M_EYE, M_NOSE): fox.data.materials.append(m_)
for p in me.polygons:
    vs = set(p.vertices)
    p.material_index = 1 if vs <= eye_vs else 2 if vs <= nose_vs else 0
fox.data.color_attributes.remove(fox.data.color_attributes["Mask"])
fox.data.color_attributes.remove(fox.data.color_attributes["Region"])
fox.data.color_attributes.remove(fox.data.color_attributes["Glow"])
tail_c, tcore_c = load("tail_col.png"), load("tail_core.png")
# tail core: alpha-clipped so the fur ends in flame-tongue shapes (the flame cards take over from there)
M_TAIL = pbr("FoxTailFur", tcore_c, None, rough=0.85, spec=0.2, alpha_mode="MASK", clip=0.5)
cards_c = load("cards_col.png")
M_TUFT = pbr("FoxFurCards", cards_c, None, rough=0.9, alpha_mode="MASK", spec=0.15)
# spirit FX: names contain "wisp" so the game's tuneMaterials keeps them soft-emissive (not the fur branch)
fx_c, glow_c, tglow_c = load("spirit_fx.png"), load("fox_glow.png"), load("tail_glow.png")
M_FX = pbr("SpiritWispFX", fx_c, None, emit_img=fx_c, emit_str=1.4, rough=0.6, alpha_mode="BLEND", spec=0.0)
M_GLOW = pbr("SpiritWispGlow", glow_c, None, emit_img=glow_c, emit_str=0.5, rough=0.8, alpha_mode="BLEND", spec=0.0)
M_TGLOW = pbr("SpiritWispTailGlow", tglow_c, None, emit_img=tglow_c, emit_str=1.1, rough=0.8, alpha_mode="BLEND", spec=0.0)
for m_ in (M_FX, M_GLOW, M_TGLOW): m_.use_backface_culling = False
SHELL_CLIPS = (0.2, 0.38, 0.55)
M_SHELL = [pbr(f"FoxFurShell{k + 1}", fur_sh, None, rough=0.9, alpha_mode="MASK", spec=0.15, clip=c_) for k, c_ in enumerate(SHELL_CLIPS)]
TAIL_CLIPS = (0.18, 0.32, 0.46, 0.6)
M_TSHELL = [pbr(f"FoxTailFurShell{k + 1}", tail_c, None, rough=0.9, alpha_mode="MASK", spec=0.15, clip=c_) for k, c_ in enumerate(TAIL_CLIPS)]

# ---------------------------------------------------------------- 5. shell fur (combed: out along normal, laid back along flow)
def shells(src, lengths, flows, mats, name):
    """src mesh object -> one skinned object with len(mats) offset shells (faces with any zero-length vert dropped)."""
    objs = []
    N = len(mats)
    for k in range(1, N + 1):
        o = src.copy(); o.data = src.data.copy(); o.name = f"{name}{k}"; sc.collection.objects.link(o)
        o.modifiers.clear(); md = o.modifiers.new("Armature", "ARMATURE"); md.object = arm
        bm_ = bmesh.new(); bm_.from_mesh(o.data); bm_.verts.ensure_lookup_table(); bm_.normal_update()
        kill_ = [f for f in bm_.faces if min(lengths[v.index] for v in f.verts) < 0.004]
        h = k / N
        for v in bm_.verts:
            L = lengths[v.index]
            if L <= 0: continue
            v.co = v.co + v.normal * L * h + flows[v.index] * L * 0.9 * h ** 1.4
        bmesh.ops.delete(bm_, geom=kill_, context="FACES")
        bm_.to_mesh(o.data); bm_.free()
        o.data.materials.clear(); o.data.materials.append(mats[k - 1])
        for p in o.data.polygons: p.material_index = 0
        objs.append(o)
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join(); objs[0].name = name
    return objs[0]
flows = []
for i, v in enumerate(me.vertices):
    n = v.normal; leg = legmask[i]
    w = weights(v)
    base = Vector((0, 1, -0.25)).lerp(Vector((0, 0.15, -1)), min(1, leg))   # back along the body, down the legs
    if w.get("Head", 0) > 0.4: base = Vector((math.copysign(0.5, v.co.x), 1, -0.2))  # cheeks sweep back/out
    if wsum(w, "Neck1", "Neck2", "Torso3") > 0.5 and n.y < -0.2: base = Vector((0, 0.1, -1))  # bib hangs down
    if throat[i] > 0.4: base = Vector((0, 0.25, -1))  # throat fur hangs down over the crease
    t = base - n * base.dot(n)
    flows.append(t.normalized() if t.length > 1e-4 else Vector())
fur_shell = shells(fox, furlen, flows, M_SHELL, "SpiritFox_FurShell")


# ---------------------------------------------------------------- 6. flame-plume tail: fur root third -> translucent flame
# Fur (core + shells + locks) only to S_FUR; from mid-plume outward the silhouette is layered flame cards
# that follow the curve and curl back, then flake embers trail behind along the travel direction (+y).
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
S_FUR = 0.68  # fur tube ends here (alpha-eroded from ~0.36 in flame-tongue shapes, see tail_core.png)
RPROF = [(0, 0.14), (0.1, 0.25), (0.3, 0.35), (0.46, 0.36), (0.58, 0.29), (0.68, 0.12)]
def radius(s):
    for (a, ra), (b, rb) in zip(RPROF, RPROF[1:]):
        if s <= b:
            t = (s - a) / (b - a); t = t * t * (3 - 2 * t); return ra + (rb - ra) * t
    return RPROF[-1][1]
def new_obj(name):
    m = bpy.data.meshes.new(name); o = bpy.data.objects.new(name, m); sc.collection.objects.link(o)
    o.parent = arm; md = o.modifiers.new("Armature", "ARMATURE"); md.object = arm
    return o
def gidx(o, n):
    if n not in o.vertex_groups: o.vertex_groups.new(name=n)
    return o.vertex_groups[n].index

# FX flicker bones (keyed per clip in the anim stage: scale/rotation flicker so flames lick in play)
FX_BONES = {  # name: (parent, head, direction)
    "FxPlumeA": ("Tail4", at(0.4)), "FxPlumeB": ("Tail6", at(0.62)), "FxPlumeC": ("Tail8", at(0.86)),
    "FxEar.L": ("Ear4.L", None), "FxEar.R": ("Ear4.R", None), "FxNeck": ("Neck2", None)}
bpy.context.view_layer.objects.active = arm
for o in sc.objects: o.select_set(o is arm)
bpy.ops.object.mode_set(mode="EDIT")
EB = arm.data.edit_bones
for name, (par, sample_) in FX_BONES.items():
    b = EB.new(name)
    if sample_:
        p, tan, _ = sample_; b.head = p; b.tail = p + tan * 0.3
    else:
        pb = EB[par]; b.head = pb.tail.copy(); b.tail = pb.tail + (pb.tail - pb.head).normalized() * 0.2
    b.parent = EB[par]; b.use_connect = False; b.use_deform = True; b.roll = 0
bpy.ops.object.mode_set(mode="OBJECT")
B = {b.name: b for b in arm.data.bones}

tail = new_obj("SpiritFox_Tail")
bmt = bmesh.new(); uvl = bmt.loops.layers.uv.new("UVMap"); dft = bmt.verts.layers.deform.new()
RINGS, SEG = 28, 20
prev_side = Vector((1, 0, 0))
rings, ring_s = [], []
for r in range(RINGS + 1):
    s = S_FUR * r / RINGS
    p, tan, w = at(s)
    side = (prev_side - tan * prev_side.dot(tan)).normalized(); prev_side = side
    up = side.cross(tan).normalized()
    ring = []
    for k in range(SEG):
        th = k / SEG * 2 * math.pi
        lob = 1 + 0.10 * math.sin(5 * th + s * 9) + 0.05 * math.sin(11 * th - s * 15)
        rr = radius(s) * lob * (1.0 - 0.12 * max(0, -math.sin(th)))  # slightly flatter underside
        v = bmt.verts.new(p + (side * math.cos(th) + up * math.sin(th)) * rr)
        for bn, x in w.items(): v[dft][gidx(tail, bn)] = x
        ring.append(v)
    rings.append(ring); ring_s.append(s)
for r in range(RINGS):
    for k in range(SEG):
        f = bmt.faces.new((rings[r][k], rings[r][(k + 1) % SEG], rings[r + 1][(k + 1) % SEG], rings[r + 1][k]))
        for lp, (u, vv) in zip(f.loops, [(k / SEG, ring_s[r]), ((k + 1) / SEG, ring_s[r]), ((k + 1) / SEG, ring_s[r + 1]), (k / SEG, ring_s[r + 1])]):
            lp[uvl].uv = (u, vv)
        f.smooth = True
f = bmt.faces.new(rings[0][::-1])  # close the root (no see-through hole from behind); the tip end is clipped away
for lp in f.loops: lp[uvl].uv = (0.5, 0.0)
bmt.normal_update(); bmt.to_mesh(tail.data); bmt.free()
tail.data.materials.append(M_TAIL)
tme = tail.data
vs_ = [ring_s[min(i // SEG, RINGS)] for i in range(len(tme.vertices))]  # arc fraction per vertex (ring order kept)
tlen, tflow = [], []
for v, s_ in zip(tme.vertices, vs_):
    _, tan, _ = at(min(1.0, s_ + 0.03))
    L = (0.06 + 0.14 * smooth(0.0, 0.4, s_)) * (1 - smooth(0.5, 0.62, s_))  # no shells past the flame line
    tlen.append(L)
    t = tan - v.normal * tan.dot(v.normal); tflow.append(t.normalized() if t.length > 1e-4 else Vector())
tail_shell = shells(tail, tlen, tflow, M_TSHELL, "SpiritFox_TailShell")

# ---------------------------------------------------------------- 6b. spirit inner glow: thin emissive shells UNDER the fur shells
def glow_shell(src, lengths, keep, frac, mat, name):
    o = src.copy(); o.data = src.data.copy(); o.name = name; sc.collection.objects.link(o)
    o.modifiers.clear(); md = o.modifiers.new("Armature", "ARMATURE"); md.object = arm; o.parent = arm
    bm_ = bmesh.new(); bm_.from_mesh(o.data); bm_.verts.ensure_lookup_table(); bm_.normal_update()
    kill_ = [f for f in bm_.faces if max(keep[v.index] for v in f.verts) < 0.03]
    for v in bm_.verts: v.co = v.co + v.normal * (lengths[v.index] * frac + 0.006)
    bmesh.ops.delete(bm_, geom=kill_, context="FACES")
    bm_.to_mesh(o.data); bm_.free()
    o.data.materials.clear(); o.data.materials.append(mat)
    for p in o.data.polygons: p.material_index = 0
    return o
glow_body = glow_shell(fox, furlen, glow, 0.3, M_GLOW, "SpiritFox_Glow")
glow_tail = glow_shell(tail, tlen, [smooth(0.3, 0.45, s_) for s_ in vs_], 0.3, M_TGLOW, "SpiritFox_TailGlow")

# ---------------------------------------------------------------- 7. cards: fur locks, cheek fluff, flame plume, ear curls, flakes
UV = {  # atlas rects (u0, v0, u1, v1) in Blender UV (v up)
    "cream": (0.5, 0.5, 0.75, 1.0), "rusttuft": (0.75, 0.5, 1.0, 1.0),  # cards_col.png
    "plume0": (0.0, 0.5, 0.25, 1.0), "plume1": (0.25, 0.5, 0.5, 1.0), "plume2": (0.5, 0.5, 0.75, 1.0), "plume3": (0.75, 0.5, 1.0, 1.0),
    "curl0": (0.0, 0.0, 0.25, 0.5), "curl1": (0.25, 0.0, 0.5, 0.5),
    "flake0": (0.5, 0.25, 0.75, 0.5), "flake1": (0.75, 0.25, 1.0, 0.5), "flake2": (0.5, 0.0, 0.75, 0.25), "shimmer": (0.75, 0.0, 1.0, 0.25),
}
cards = {"tuft": new_obj("SpiritFox_Fur"), "fx": new_obj("SpiritFox_SpiritFX")}
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
def frame(s):
    p, tan, w = at(s); side = Vector((1, 0, 0)); side = (side - tan * side.dot(tan)).normalized()
    return p, tan, w, side, side.cross(tan).normalized()
def mixw(a, b, t):
    out = {k: x * (1 - t) for k, x in a.items()}
    for k, x in b.items(): out[k] = out.get(k, 0) + x * t
    return out
body_v = [(v.co.copy(), v.normal.copy(), weights(v)) for v in me.vertices]
def pick(cond, n):
    cand = [x for x in body_v if cond(*x)]
    rnd.shuffle(cand); return cand[:n]
def topw(w):
    it = sorted(w.items(), key=lambda kv: -kv[1])[:3]; s = sum(x for _, x in it) or 1
    return {k: x / s for k, x in it}
# cheek fluff (cream, sweeps back and out — the turnaround's facial ruff)
for co, n, w in pick(lambda co, n, w: w.get("Head", 0) > 0.6 and abs(n.x) > 0.6 and co.z < head_c.z and co.y > head_c.y - 0.08, 12):
    dirn = (Vector((math.copysign(0.6, n.x), 0.7, -0.35))).normalized()
    card("tuft", co - n * 0.02, dirn, n, 0.12, 0.2, "cream", topw(w))
# tail fur locks, root third only: laid flat along the plume (low splay -> no hedgehog spikes end-on),
# all burnt orange (no cream/ash locks; the plume brightens through the flame instead)
for j in range(90):
    s = 0.05 + 0.47 * (j / 89)
    p, tan, w, side, up = frame(s); th = j * 2.39996 + rnd.uniform(-0.3, 0.3)  # golden-angle spiral -> even layering
    off = side * math.cos(th) + up * math.sin(th)
    _, _, w2 = at(min(1.0, s + 0.1))
    h = (0.36 + 0.22 * smooth(0.05, 0.4, s)) * rnd.uniform(0.85, 1.15)
    card("tuft", p + off * radius(s) * 0.82, (tan + off * 0.16).normalized(), off, h * 0.55, h, "rusttuft", w, wts_top=w2)
# flame plume: translucent tongues rooted inside the fur from mid-plume out, streaming along the tail and
# curling back/up. Layered around the whole circumference (underside too) so the plume volume is kept; tips
# are skinned to the FX flicker bones. A few broad tongues lean off-axis so the plume still reads as fire
# from the chase cam (looking down the tail).
PL = ["plume0", "plume1", "plume2", "plume3"]
def fxb(s): return "FxPlumeA" if s < 0.55 else "FxPlumeB" if s < 0.78 else "FxPlumeC"
for j in range(54):
    s = 0.26 + 0.68 * (j / 53) ** 0.9
    p, tan, w, side, up = frame(s)
    th = j * 2.39996 + rnd.uniform(-0.25, 0.25)
    off = side * math.cos(th) + up * math.sin(th)
    k = smooth(0.26, 0.95, s)
    h = (0.6 + 0.9 * k) * rnd.uniform(0.85, 1.15)
    wd = h * rnd.uniform(0.5, 0.7)
    root = p + off * radius(min(s, S_FUR)) * (0.85 - 0.6 * k)  # early tongues sit on the fur, later ones inside
    lean = (tan * 1.0 + off * (0.14 + 0.1 * k) + up * 0.06).normalized()  # stream back, not a bouquet
    card("fx", root, lean, off, wd, h, PL[j % 4], w, cross=(j % 3 == 0), wts_top=mixw(w, {fxb(s): 1.0}, 0.8))
for j in range(7):  # tip: broader tongues licking up and back, a pale-gold heart (concept: bright, not ash)
    s = 0.84 + 0.03 * j
    p, tan, w, side, up = frame(s)
    lean = (tan * 1.0 + up * (0.12 + 0.03 * j) + side * rnd.uniform(-0.3, 0.3)).normalized()
    card("fx", p - tan * 0.1, lean, side, 0.75, 1.25 + 0.08 * j, PL[(j + 1) % 4], w, cross=True, wts_top={"FxPlumeC": 1.0})
# flake embers trailing behind the plume along the motion path (sparse, shrinking with distance)
FL = ["flake0", "flake1", "flake2"]
for j in range(18):
    d = (j + rnd.uniform(0, 1)) / 18
    s = 0.72 + 0.75 * d
    p, tan, w, side, up = frame(min(s, 1.0))
    if s > 1: p = p + tan * (s - 1) * total
    pos = p + up * rnd.uniform(0.15, 0.55 + 0.9 * d) + side * rnd.uniform(-0.35, 0.35) * (0.6 + d) + Vector((0, 0.15 * d, 0.25 * d))
    sz = rnd.uniform(0.11, 0.17) * (1 - 0.4 * d)
    fac = Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(-0.3, 0.3))).normalized()
    card("fx", pos, Vector((rnd.uniform(-1, 1), rnd.uniform(-0.3, 1), rnd.uniform(-1, 1))), fac, sz, sz * 1.3, FL[j % 3], {"FxPlumeC": 1.0})
# ear embers: thin ribbons trailing back off the ear tips, curling over (not upright candles)
for s in "LR":
    e1, e4 = bh(f"Ear1.{s}"), bt(f"Ear4.{s}")
    d = (e4 - e1).normalized()
    out_ = Vector((1 if s == "L" else -1, 0, 0))
    for k, (ln, wd, back, rect) in enumerate(((0.46, 0.2, 0.55, "curl0"), (0.34, 0.15, 0.9, "curl1"))):
        upv = (d + Vector((0, back, 0)) + out_ * 0.1 * k).normalized()  # rise off the tip, sweep back
        card("fx", e4 - d * (0.24 + 0.06 * k), upv, out_, wd, ln, rect, {f"Ear4.{s}": 1.0}, cross=(k == 0), wts_top={f"FxEar.{s}": 1.0})
# shoulders / nape: two faint heat-shimmer wisps lying back (no flame ridge)
for j, (x_, t_) in enumerate(((0.07, 0.25), (-0.06, 0.55))):
    base = bh("Neck1").lerp(bh("Neck2"), t_) + Vector((x_, 0.05, 0.2))
    card("fx", base, Vector((x_ * 2, 1, 0.75)).normalized(), Vector((1, 0, 0)), 0.32, 0.42, "shimmer", {"Neck1": 0.5, "Neck2": 0.5}, wts_top={"FxNeck": 1.0})
for k, o in cards.items():
    cbm[k].to_mesh(o.data); cbm[k].free()
    o.data.materials.append(M_TUFT if k == "tuft" else M_FX)
    for p in o.data.polygons: p.use_smooth = False
for o in (fur_shell, tail_shell, glow_body, glow_tail):
    o.parent = arm
print("LOOK done", {o.name: len(o.data.polygons) for o in [fox, tail, fur_shell, tail_shell, glow_body, glow_tail] + list(cards.values())})
