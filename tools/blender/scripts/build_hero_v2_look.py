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
    if n.y < 0 or n.z < 0:  # chest bib bulges forward / down: a deep keel of a chest, not a barrel
        push += 0.05 * neck * max(-n.y, -n.z, 0)
    chest = wsum(w, "Torso3", "Neck1") + 0.5 * w.get("Torso2", 0)
    if n.z < -0.3 and co.y < bh("FrontUpperLeg.L").y + 0.25:
        push += 0.1 * min(1, chest) * -n.z  # deeper brisket between / ahead of the forelegs
    hw = w.get("Head", 0)
    # Taper the lower cheek plane into the throat; a broad jaw made the cream read as a collar.
    jaw_taper = smooth(head_c.z + 0.06, head_c.z - 0.32, co.z) * hw
    co.x *= 1 - 0.14 * jaw_taper
    if hw > 0.3 and n.z < -0.3 and co.y > head_c.y - 0.12:
        push += 0.045 * hw * -n.z  # full throat under the jaw (no shadow shelf between cheeks and bib)
    belly = wsum(w, "Torso", "Torso2")
    if n.z < -0.4: push += 0.06 * belly * -n.z  # deep chest / belly line (turnaround: chest depth ~0.28x height)
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
    v.co.x *= 1 - 0.42 * t  # narrow, tapered muzzle (concept: fine, intelligent snout)
    v.co.z = zc + (v.co.z - zc) * (1 - 0.16 * t)
# eyes a touch larger (grounded amber, not cute): grow each eye about its centroid
for sgn in (1, -1):
    ev = [bm.verts[i] for i in eye_ids if bm.verts[i].co.x * sgn > 0]
    ec = sum((v.co for v in ev), Vector()) / len(ev)
    for v in ev: v.co = ec + (v.co - ec) * Vector((1.3, 1.5, 1.02))  # almond: long fore-aft, low lid height (watchful, not round)
# compact oval paws (turnaround: neat dark paws barely longer than the leg is wide), flat sole
paw_groups = [g for g in gname.values() if "Paw" in g]
for pg in paw_groups:
    vs = [v for v in bm.verts if sum(x for k, x in v[dl].items() if gname[k] == pg) > 0.35 and v.co.z < 0.24]
    if not vs: continue
    c = sum((v.co for v in vs), Vector()) / len(vs)
    for v in vs:
        k = smooth(0.24, 0.02, v.co.z)
        d = v.co - c
        v.co.x = c.x + d.x * (1 + 0.12 * k)
        v.co.y = c.y + d.y * (1 - (0.22 if d.y < 0 else 0.1) * k)
        v.co.z = max(v.co.z, GROUND + 0.005)
nose_ids = set(i for p in me.polygons if me.materials[p.material_index].name == "Black" for i in p.vertices)
if nose_ids:
    nc = sum((bm.verts[i].co for i in nose_ids), Vector()) / len(nose_ids)
    for i in nose_ids: bm.verts[i].co = nc + (bm.verts[i].co - nc) * 0.62 + Vector((0, 0.004, 0))
# delete the old thin tail beyond the root (rebuilt as plume)
kill = [v for v in bm.verts if sum(x for k, x in v[dl].items() if gname[k] in ("Tail2", "Tail3", "Tail4", "Tail5", "Tail6", "Tail7", "Tail8")) > 0.5]
old_boundaries = {e for e in bm.edges if e.is_boundary}
bmesh.ops.delete(bm, geom=kill, context="VERTS")
# Close only the opening created by removing the stock tail; otherwise a black triangular
# hole remains above the new brush root in the chase and back review views.
cut_edges = [e for e in bm.edges if e.is_boundary and e not in old_boundaries]
if cut_edges:
    caps = bmesh.ops.holes_fill(bm, edges=cut_edges, sides=0)["faces"]
    for face in caps: face.smooth = True
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
bm.to_mesh(me); bm.free(); me.update()

# ---------------------------------------------------------------- 2. region colours (rest pose rules)
# warm burnt orange (yellower than vermilion: ACES + warm fog push it red in engine); sock/paw authored a
# notch light because the streak * AO bake darkens them (lands near the concept's (102, 62, 38) umber)
PAL = dict(rust=(212, 124, 50), dorsal=(146, 70, 28), belly=(226, 168, 112), cream=(234, 218, 188),
           umber=(108, 62, 36), sock=(66, 42, 29), paw=(46, 31, 23), earback=(50, 29, 20), nose=(22, 15, 13),
           amber=(236, 156, 40), pupil=(30, 14, 8), liner=(42, 22, 14), earin=(236, 214, 186))
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
    c = mix(c, PAL["dorsal"], smooth(-0.12, 0.7, n.z) * 0.88)           # broad dark rust saddle over the back / haunches (painted mass)
    c = mix(c, PAL["belly"], smooth(-0.15, -0.8, n.z) * 0.75)           # warm pale underside (not pink)
    # cream: throat + bib tapering down the chest, muzzle, cheeks, inner ears (no belly/rump patches)
    if leg < 0.3:
        if wsum(w, *[f"Ear{i}.{s}" for i in (1, 2, 3, 4) for s in "LR"]) > 0.3:
            k = 1.0
        elif w.get("Head", 0) > 0.3:
            # Paint a soft oblique cheek boundary from anatomy, never the source polygon IDs.
            line = (eyeL.z + eyeR.z) * 0.5 - 0.12 + 0.07 * smooth(0.08, 0.38, abs(co.x))
            line += 0.025 * math.sin(co.y * 12.0)
            k = (1 - smooth(line - 0.12, line + 0.12, co.z)) * (1 - smooth(0.0, 0.6, n.z))
        elif co.y < CHEST_Y:
            half = 0.05 + 0.14 * smooth(1.35, 1.95, co.z)  # narrow V bib: wide at the throat, a thin blaze between the forelegs
            k = smooth(1.2, 1.5, co.z) * (1 - smooth(half - 0.05, half + 0.07, abs(co.x)))
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
        top = 1.22 if front_leg >= back_leg else 1.12  # umber up to the elbow / hock
        lt = leg * (1 - smooth(top - 0.08, top + 0.1, co.z))
        c = mix(c, PAL["umber"], lt)
        c = mix(c, PAL["sock"], leg * (1 - smooth(top - 0.22, top - 0.02, co.z)))  # dark sock to the elbow / hock
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
    elif d < 0.12: c = mix(c, PAL["liner"], 1 - smooth(0.03, 0.12, d))  # strong dark lid rim: watchful, not round
    if v.index in nose_vs: c = PAL["nose"]
    cols.append(c)
    # shell-fur length (model units; fox ~3.3 tall): long ruff/cheeks, short face/lower legs, none on paws/eyes
    neck = wsum(w, "Neck1", "Neck2", "Neck3", "Torso3")
    L = 0.018 + 0.022 * min(1, neck) + 0.012 * wsum(w, "Back", "BackLeg.L", "BackLeg.R")  # short: long shells read as raised chips
    if w.get("Head", 0) > 0.4: L = 0.008 + 0.02 * smooth(0.2, 0.6, abs(n.x)) * (1 - smooth(-0.3, -0.7, n.y))
    L = max(L, 0.028 * jaw)  # throat fur hangs over the jaw / bib crease
    if ear > 0.3: L = 0.005
    L *= 1 - 0.75 * leg * (1 - smooth(0.7, 1.2, co.z))
    if v.index in eye_vs or v.index in nose_vs or (d < 0.075): L = 0.0  # keep shells off the (enlarged) eyes and lids
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
for it in range(7):  # soft painted transitions (bib / saddle / socks blend, no cutout edges)
    new = []
    for i, c in enumerate(cols):
        if i in eye_vs or i in nose_vs or not adj[i]: new.append(c); continue
        s = [cols[j] for j in adj[i]]
        new.append(tuple((c[k] * 2 + sum(x[k] for x in s) / len(s)) / 3 for k in range(3)))
    cols = new
ca = me.color_attributes.new("Region", "BYTE_COLOR", "POINT")
for i, c in enumerate(cols): ca.data[i].color_srgb = (c[0] / 255, c[1] / 255, c[2] / 255, 1)
# fur length: relax steps (head short -> ruff long made a dark shell ledge under the jaw = "collar")
for it in range(10):
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
BAKE = 2048
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
body_s = streak((65, 7, 65)); leg_s = streak((65, 65, 8))
sm = node("ShaderNodeMix", data_type="FLOAT"); L_.new(mask.outputs["Color"], sm.inputs["Factor"])
L_.new(body_s.outputs["Fac"], sm.inputs[2]); L_.new(leg_s.outputs["Fac"], sm.inputs[3])
cr = node("ShaderNodeValToRGB"); cr.color_ramp.elements[0].position = 0.3; cr.color_ramp.elements[0].color = (0.8, 0.76, 0.72, 1)
cr.color_ramp.elements[1].position = 0.7; cr.color_ramp.elements[1].color = (1.08, 1.05, 1.0, 1)
L_.new(sm.outputs[0], cr.inputs["Fac"])
big = node("ShaderNodeTexNoise"); big.inputs["Scale"].default_value = 2.5
bigr = node("ShaderNodeMapRange"); bigr.inputs["To Min"].default_value = 0.9; bigr.inputs["To Max"].default_value = 1.08
L_.new(big.outputs["Fac"], bigr.inputs["Value"])
ao = node("ShaderNodeAmbientOcclusion", samples=16); ao.inputs["Distance"].default_value = 0.35
aor = node("ShaderNodeMapRange"); aor.inputs["To Min"].default_value = 0.82; aor.inputs["To Max"].default_value = 1.0
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
bump = node("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.2; bump.inputs["Distance"].default_value = 0.02
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
mp2 = node("ShaderNodeMapping"); mp2.inputs["Scale"].default_value = (95, 9, 75)  # thin strands laid along the body (discs read as scales, fine dots as sandpaper)
vor = node("ShaderNodeTexVoronoi"); vor.inputs["Scale"].default_value = 1.0; vor.inputs["Randomness"].default_value = 1.0
L_.new(tc2.outputs["Object"], mp2.inputs["Vector"]); L_.new(mp2.outputs["Vector"], vor.inputs["Vector"])
fall = node("ShaderNodeMapRange", interpolation_type="SMOOTHSTEP"); fall.inputs["From Min"].default_value = 0.0
fall.inputs["From Max"].default_value = 0.95; fall.inputs["To Min"].default_value = 1.0; fall.inputs["To Max"].default_value = 0.0
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
M_TAIL = pbr("FoxTailFur", tail_c, None, rough=0.9, spec=0.15)
cards_c = load("cards_col.png")
tf_c, tf_e = load("tail_flame.png"), load("tail_flame_emit.png")
# fur-to-flame locks over the plume's outer half: unlit burnt-orange strands at the root, glowing only where
# they have turned to flame (separate emission map); "wisp" name -> game keeps them soft-emissive
M_TFLAME = pbr("SpiritWispTailFlame", tf_c, None, emit_img=tf_e, emit_str=1.0, rough=0.85, alpha_mode="BLEND", spec=0.1)
M_TFLAME.use_backface_culling = False
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
S_FUR = 1.0  # continuous brush; sparse translucent wisps emerge from its tapered tip
RPROF = [(0, 0.16), (0.1, 0.3), (0.3, 0.44), (0.5, 0.47), (0.66, 0.4), (0.8, 0.27), (0.92, 0.12), (1.0, 0.012)]
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
    "FxEar.L": ("Ear4.L", None), "FxEar.R": ("Ear4.R", None), "FxNeck": ("Neck2", None),
    "FxBib": ("Neck1", None), "FxCheek.L": ("Head", None), "FxCheek.R": ("Head", None)}
# ruff flicker pivots sit at the ruff itself (chest keel / each cheek), not at the parent bone's tail
FX_AT = {"FxBib": lambda: (bh("Neck1") + Vector((0, -0.28, -0.32)), Vector((0, -0.3, -1))),
         "FxCheek.L": lambda: (head_c + Vector((0.2, 0.06, -0.1)), Vector((0.6, 0.7, -0.35))),
         "FxCheek.R": lambda: (head_c + Vector((-0.2, 0.06, -0.1)), Vector((-0.6, 0.7, -0.35)))}
bpy.context.view_layer.objects.active = arm
for o in sc.objects: o.select_set(o is arm)
bpy.ops.object.mode_set(mode="EDIT")
EB = arm.data.edit_bones
for name, (par, sample_) in FX_BONES.items():
    b = EB.new(name)
    if sample_:
        p, tan, _ = sample_; b.head = p; b.tail = p + tan * 0.3
    elif name in FX_AT:
        p, d_ = FX_AT[name](); b.head = p; b.tail = p + d_.normalized() * 0.2
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
    L = (0.025 + 0.045 * smooth(0.0, 0.4, s_)) * (1 - smooth(0.88, 1.0, s_))  # no shells past the flame line
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
glow_tail = glow_shell(tail, tlen, [smooth(0.45, 0.6, s_) for s_ in vs_], 0.3, M_TGLOW, "SpiritFox_TailGlow")

# ---------------------------------------------------------------- 7. cards: fur locks, flame plume, flakes
UV = {  # atlas rects (u0, v0, u1, v1) in Blender UV (v up)
    "rusttuft": (0.75, 0.5, 1.0, 1.0),  # cards_col.png
    "plume0": (0.0, 0.5, 0.25, 1.0), "plume1": (0.25, 0.5, 0.5, 1.0), "plume2": (0.5, 0.5, 0.75, 1.0), "plume3": (0.75, 0.5, 1.0, 1.0),
    "flake0": (0.5, 0.25, 0.75, 0.5), "flake1": (0.75, 0.25, 1.0, 0.5), "flake2": (0.5, 0.0, 0.75, 0.25),
    "rustlickL": (0.0, 0.5, 0.25, 1.0), "rustlickR": (0.25, 0.5, 0.5, 1.0),  # cards_col.png
    "tf0": (0.0, 0.0, 0.25, 1.0), "tf1": (0.25, 0.0, 0.5, 1.0), "tf2": (0.5, 0.0, 0.75, 1.0), "tf3": (0.75, 0.0, 1.0, 1.0),  # tail_flame.png
}
cards = {"tuft": new_obj("SpiritFox_Fur"), "tflame": new_obj("SpiritFox_TailFlame"), "fx": new_obj("SpiritFox_SpiritFX")}
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
def rise(off):
    """flame never licks downward (no tongues into the ground; fire rises): fold the under-side offsets up"""
    return Vector((off.x, off.y, max(off.z, -0.25 + 0.5 * off.z))).normalized()
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
def fxb(s): return "FxPlumeA" if s < 0.55 else "FxPlumeB" if s < 0.78 else "FxPlumeC"
# fur -> flame: translucent locks rooted on the brush over its outer half. Each is dense fur at the root and
# breaks up into amber flame toward its tip, so the tail dissolves gradually (concept) instead of ending
# in a separate fire jet. Tips flicker on the FX bones.
TF = ["tf0", "tf1", "tf2", "tf3"]
for j in range(12):
    s = 0.78 + 0.18 * (j / 11)  # fur -> flame only over the outer third
    p, tan, w, side, up = frame(s)
    th = j * 2.39996 + rnd.uniform(-0.25, 0.25)
    off = side * math.cos(th) + up * math.sin(th)
    k = smooth(0.6, 0.84, s)
    h = (0.24 + 0.18 * k) * rnd.uniform(0.85, 1.15)
    root = p + off * radius(min(s, S_FUR)) * (0.8 - 0.35 * k)
    lean = (tan * 1.0 + rise(off) * (0.22 + 0.12 * k) + up * 0.1).normalized()
    card("tflame", root, lean, off, h * rnd.uniform(0.5, 0.62), h, TF[j % 4], w, cross=(j % 4 == 0), wts_top=mixw(w, {fxb(s): 1.0}, 0.7))
# soft flame tongues from the dissolve line out past the old tip: the brush's outer silhouette, amber-rust
PL = ["plume0", "plume1", "plume2", "plume3"]
for j in range(8):
    s = 0.88 + 0.13 * (j / 7) ** 0.9  # soft wisps peel off the tip only
    p, tan, w, side, up = frame(min(s, 1.0))
    if s > 1: p = p + tan * (s - 1) * total
    th = j * 2.39996 + rnd.uniform(-0.25, 0.25)
    off = side * math.cos(th) + up * math.sin(th)
    k = smooth(0.74, 1.0, s)
    h = (0.23 + 0.18 * k) * rnd.uniform(0.85, 1.15)  # low trailing tongues: no bonfire over the rump from the chase cam
    wd = h * rnd.uniform(0.65, 0.85)
    root = p + off * radius(min(s, S_FUR)) * (0.75 - 0.5 * k)
    lean = (tan * 1.0 + rise(off) * (0.2 + 0.12 * k) + up * (0.08 + 0.08 * k)).normalized()  # a trailing plume, not an upright fan
    card("fx", root, lean, off, wd, h, PL[j % 4], w, cross=(j % 3 == 0), wts_top=mixw(w, {fxb(s): 1.0}, 0.8))
for j in range(2):  # tip: a few broad, soft tongues licking up and back (small pale-gold heart in the texture)
    s = 0.9 + 0.035 * j
    p, tan, w, side, up = frame(s)
    lean = (tan * 1.0 + up * (0.06 + 0.03 * j) + side * rnd.uniform(-0.35, 0.35)).normalized()
    card("fx", p - tan * 0.12, lean, side, 0.16, 0.32 + 0.06 * j, PL[(j + 1) % 4], w, cross=True, wts_top={"FxPlumeC": 1.0})
# Rising embers are emitted from skinned body anchors in foxLook.ts.
# silhouette flame-licks (concept's wispy fur edges): sparse fur locks whose tips curl like flame, on the
# shoulders only (cheek and bib cards read as chips / white fangs in engine) (no haunch licks: lying flat on the rump they read as paper patches in
# engine). Tips ride the ruff / neck FX bones so the edges lick in play.
def licks(cond, n, rect_l, rect_r, size, dirf, fxw):
    for co, nrm, w in pick(cond, n):
        dirn = dirf(co, nrm).normalized()
        h = size * rnd.uniform(0.8, 1.2)
        rect = rect_l if (co.x > 0) == (rnd.random() < 0.7) else rect_r
        wt = topw(w)
        card("tuft", co - nrm * 0.02, dirn, nrm, h * 0.42, h, rect, wt, wts_top=mixw(wt, fxw(co), 0.6))
licks(lambda co, n, w: wsum(w, "Torso3", "Neck1") > 0.5 and n.z > 0.55 and abs(n.x) > 0.25, 6,
      "rustlickL", "rustlickR", 0.24, lambda co, n: Vector((n.x * 0.6, 1, 0.45)), lambda co: {"FxNeck": 1.0})
for k, o in cards.items():
    cbm[k].to_mesh(o.data); cbm[k].free()
    o.data.materials.append({"tuft": M_TUFT, "tflame": M_TFLAME}.get(k, M_FX))
    for p in o.data.polygons: p.use_smooth = False
for o in (fur_shell, tail_shell, glow_body, glow_tail):
    o.parent = arm
print("LOOK done", {o.name: len(o.data.polygons) for o in [fox, tail, fur_shell, tail_shell, glow_body, glow_tail] + list(cards.values())})
