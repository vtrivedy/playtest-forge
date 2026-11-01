class_name Props
extends RefCounted
## Shared lookdev props (lookdevKit.ts / lookdevGround.ts): gnarled maple, field rock, contact ink,
## distance ridges, ground sheet, grass tufts, leaf litter, maple leaf + rim-leaf card geometry.

const INK := Color(0.141, 0.086, 0.055)

## lit / body / underside per canopy palette (autumn family, then late-summer moss family)
const CANOPY := [[0xa4603e, 0x7e3e2c, 0x4f2a2c], [0xa88550, 0x80603a, 0x52392e], [0x94483a, 0x6c3028, 0x45242a], [0x9a6d4a, 0x744832, 0x4a2e2e]]
const CANOPY_MOSS := [[0x858149, 0x5f5c35, 0x3d3a29], [0x8c7c4c, 0x655634, 0x42372a]]
const LITTER := [0x603a2d, 0x786044, 0x897354, 0x493d34]

static var _rim_leaf: Mesh
static var _leaf_cards_mat: ShaderMaterial


static func _canopy_tones(palette: int, kind: String, i: int) -> Array:
	var fam: Array = CANOPY_MOSS if palette >= CANOPY.size() else CANOPY
	if kind == "hero" and i == 1:
		return CANOPY[1]
	return fam[(palette + (1 if i % 3 == 2 else 0)) % fam.size()]


static func smooth(x: float, a: float, b: float) -> float:
	return Layout.sstep(x, a, b)


## lumpy leaf-mass lobe with a 2-tone hue ramp in vertex colour (lookdevKit.canopyPad)
static func canopy_pad(rand: Rng, radius: float, height: float, tones: Array) -> Geo:
	var g := Geo.sphere(1.0, 40, 18)
	var ph: Array[float] = []
	for i in 6:
		ph.append(rand.f() * 6.28)
	for i in g.p.size():
		var v := g.p[i]
		var x := v.x
		var y := v.y
		var z := v.z
		var a := atan2(z, x)
		var clump := 0.2 * sin(x * 3.1 + ph[0]) * sin(y * 2.7 + ph[1]) * sin(z * 3.3 + ph[2])
		var fine := 0.07 * sin(x * 7.3 + ph[3]) * sin(y * 6.1 + ph[4]) * sin(z * 7.7 + ph[5])
		var tooth := 0.055 * sin(a * 19.0 + y * 17.0 + ph[3]) * sin(y * 23.0 + ph[4])
		var notch := pow(0.5 + 0.5 * sin(a * 5.0 + y * 3.0 + ph[0]), 5.0) * (1.0 - y * y) * 0.36
		var k := 1.0 + clump * 1.35 + fine + tooth - notch
		var yy := y * height if y > 0.0 else y * height * 0.8
		g.p[i] = Vector3(x * radius * k, yy * k, z * radius * k)
	g.jitter(0.06, rand, 1.6)
	var lit := Kit.lin(tones[0])
	var mid := Kit.lin(tones[1])
	var shade := Kit.lin(tones[2])
	g.c.resize(g.p.size())
	for i in g.p.size():
		var ny := g.n[i].y
		g.c[i] = shade.lerp(mid, smooth(ny, -0.8, -0.35)).lerp(lit, smooth(ny, 0.05, 0.4))
	return g


## serrated five-lobed maple leaf card (tip +y, face +z) with its ink rim baked as dark vertex colour
static func rim_leaf() -> Mesh:
	if _rim_leaf:
		return _rim_leaf
	var outline := func(grow: float) -> PackedVector2Array:
		var pts := PackedVector2Array()
		for i in 120:
			var a := float(i) / 120.0 * TAU
			var x := a - PI / 2.0
			var u := fposmod(x * 5.0 / TAU + 0.5, 1.0)
			var tri := 1.0 - absf(u - 0.5) * 2.0
			var lower := 1.0 - 0.5 * smooth(absf(atan2(sin(x), cos(x))), 1.7, 2.7)
			var r := (0.42 + 0.58 * pow(tri, 1.3) * lower) * (1.0 + 0.07 * absf(sin(x * 30.0))) + grow
			pts.append(Vector2(cos(a) * r, sin(a) * r + 0.42))
		return pts
	var g := Geo.shape(outline.call(0.0))
	g.c.resize(g.p.size())
	g.c.fill(Color(1, 1, 1))
	var ring := Geo.shape(outline.call(0.075), [outline.call(0.0)])
	ring.c.resize(ring.p.size())
	ring.c.fill(Color(0.12, 0.12, 0.12))
	var stem := Geo.new()
	stem.quad(Vector3(-0.03, -0.24, -0.002), Vector3(0.03, -0.24, -0.002), Vector3(0.03, 0.08, -0.002), Vector3(-0.03, 0.08, -0.002), Vector3.BACK, Vector3.BACK, Vector3.BACK, Vector3.BACK)
	stem.c.resize(stem.p.size())
	stem.c.fill(Color(0.12, 0.12, 0.12))
	g.append(ring).append(stem)
	var k := Kit.new()
	k.add_geo(g, Color(1, 1, 1), 0.0)
	_rim_leaf = k.build_mesh()
	return _rim_leaf


## gnarled maple: flared leaning trunk forking into limbs at staggered heights, each ending in a lobe
static func build_maple(rand: Rng, scale: float, kind: String, palette: int, base_y: float) -> Node3D:
	var g := Node3D.new()
	g.name = "maple"
	var climb_base := base_y + 0.4
	var bark := Kit.toon(0x4a3326, {contour = 0.8, climb_base = climb_base})
	var tall := 4.0 if kind == "hero" else (4.8 if kind == "tall" else (3.6 if kind == "lean" else 3.4))
	var lean := 1.9 if kind == "lean" else (rand.f() - 0.5) * (1.6 if kind == "tall" else 0.9)
	var sway := (rand.f() - 0.5) * 0.6
	var trunk: Array
	if kind == "lean":
		trunk = [Vector3(0, -0.2, 0), Vector3(0.25, tall * 0.28, 0.15), Vector3(lean * 0.3, tall * 0.48, -0.25), Vector3(lean * 0.72, tall * 0.74, 0.2), Vector3(lean, tall, 0)]
	else:
		trunk = [Vector3(0, -0.2, 0), Vector3(lean * 0.2, tall * 0.35, sway * 0.2), Vector3(lean * 0.75, tall * 0.7, -sway * 0.3), Vector3(lean, tall, sway * 0.4)]
	var r0 := 0.42 if kind == "hero" else (0.38 if kind == "lean" else 0.3)
	var top := CatmullRom.point_at(trunk, 1.0)
	var pads := []
	var trunk_geo := Geo.plume(trunk, func(t: float) -> float: return lerpf(r0, r0 * 0.4, t) + (1.0 - smooth(t, 0.0, 0.14)) * r0 * 0.7, 20, 9)
	g.add_child(Kit.inked(trunk_geo.jitter(0.09 if kind == "lean" else 0.05, rand, 2.0), bark, 0.024, true))
	var limbs := 6 if kind == "hero" else (4 if kind == "lean" else 5)
	var a0 := -0.6 if kind == "lean" else rand.f() * 6.28
	var hole_a := 1 + floori(rand.f() * (limbs - 1))
	var hole_b := 1 + ((hole_a + 1 + floori(rand.f() * (limbs - 3))) % (limbs - 1)) if (kind == "hero" or kind == "tall") else -1
	for i in limbs:
		var a: float
		if kind == "lean":
			a = a0 + float(i) / (limbs - 1) * 1.6 + (rand.f() - 0.5) * 0.4
		else:
			a = a0 + float(i) / limbs * TAU + (rand.f() - 0.5) * 0.8
		var from := CatmullRom.point_at(trunk, 0.42 + float(i) / limbs * 0.45 + rand.f() * 0.06)
		var bare := i == hole_a or i == hole_b
		var reach := (1.5 if kind == "hero" else (0.8 if kind == "tall" else 1.15)) * (0.6 + rand.f() * 0.7) * (1.05 if bare else 1.0)
		var rise := 0.65 + rand.f() * 0.9
		var end := from + Vector3(cos(a) * reach, rise, sin(a) * reach)
		var mid := from.lerp(end, 0.5) + Vector3(0, -0.18, 0)
		var limb := [from, mid, end]
		var lr := r0 * 0.42
		g.add_child(Kit.inked(Geo.plume(limb, func(t: float) -> float: return lerpf(lr, lr * (0.06 if bare else 0.3), t), 10, 6), bark, 0.018, true))
		if bare:
			var fork := CatmullRom.point_at(limb, 0.65)
			var tip := fork + Vector3(cos(a + 0.55) * 0.38, 0.45 + rand.f() * 0.3, sin(a + 0.55) * 0.38)
			var twig := [fork, fork.lerp(tip, 0.5) + Vector3(0, -0.08, 0), tip]
			g.add_child(Kit.inked(Geo.plume(twig, func(t: float) -> float: return lerpf(lr * 0.32, lr * 0.025, t), 6, 5), bark, 0.014, true))
			continue
		var r := (1.1 if kind == "hero" else (0.75 if kind == "tall" else 0.9)) * (0.6 + rand.f() * 0.7)
		var at := end.lerp(from, 0.18) + Vector3((rand.f() - 0.5) * 0.2, 0.05, (rand.f() - 0.5) * 0.2)
		pads.append({at = at, r = r, h = r * (0.7 + rand.f() * 0.2)})
	var cr := 1.6 if kind == "hero" else (1.0 if kind == "tall" else (1.15 if kind == "lean" else 1.25))
	pads.append({at = top + Vector3((rand.f() - 0.5) * 0.6, 0.85, (rand.f() - 0.5) * 0.6), r = cr, h = cr * 0.8})
	for i in (2 if kind == "lean" else 1):
		var fa := rand.f() * 6.28
		var fr := 0.55 + rand.f() * 0.5
		pads.append({at = top + Vector3(cos(fa) * cr * 0.75, (rand.f() - 0.3) * 0.9, sin(fa) * cr * 0.75), r = fr, h = fr * 0.8})
	var pad_mat := Kit.toon(0xffffff, {vertex_colors = true, contour = 0.9, climb_base = climb_base, ramp = Kit.RAMP_CANOPY})
	for i in pads.size():
		var pd: Dictionary = pads[i]
		var pad := Kit.inked(canopy_pad(rand, pd.r, pd.h, _canopy_tones(palette, kind, i)), pad_mat, 0.028, true)
		pad.position = pd.at
		pad.basis = Kit.euler(Vector3((rand.f() - 0.5) * 0.6, rand.f() * 6.28, (rand.f() - 0.5) * 0.6))
		pad.set_meta("crown", true)
		g.add_child(pad)
	# leaf sprigs on each lobe's silhouette band only (face-on cards discard in the shader)
	var clusters := 3
	var per := 4
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_colors = true
	mm.mesh = rim_leaf()
	mm.instance_count = pads.size() * clusters * per
	var ci := 0
	for i in pads.size():
		var pd: Dictionary = pads[i]
		var tones := _canopy_tones(palette, kind, i)
		var ca0 := rand.f() * 6.28
		for k in clusters:
			var ak := ca0 + float(k) / clusters * TAU + (rand.f() - 0.5) * 0.8
			var yk := -0.15 + rand.f() * 0.5
			for j in per:
				var a := ak + (rand.f() - 0.5) * 0.35
				var yv := yk + (rand.f() - 0.5) * 0.25
				var out := Vector3(cos(a), yv * 0.8, sin(a)).normalized()
				var across := Vector3(-sin(a), 0, cos(a))
				var side := out.cross(across)
				var b := Basis(side, out, across) * Basis(Vector3.UP, (rand.f() - 0.5) * 0.4) * Basis(Vector3.BACK, (rand.f() - 0.5) * 0.9)
				b = b.orthonormalized().scaled_local(Vector3.ONE * pd.r * (0.15 + rand.f() * 0.07))
				var at: Vector3 = pd.at
				var cp := Vector3(at.x + cos(a) * pd.r * 0.98, at.y + yv * pd.h * 0.85, at.z + sin(a) * pd.r * 0.98)
				mm.set_instance_transform(ci, Transform3D(b, cp))
				mm.set_instance_color(ci, Kit.lin(tones[1]).lerp(Kit.lin(tones[0]), 0.25 + rand.f() * 0.2))
				ci += 1
	var cards := MultiMeshInstance3D.new()
	cards.multimesh = mm
	cards.material_override = leaf_cards_material(climb_base)
	g.add_child(cards)
	g.scale = Vector3.ONE * scale
	return g


static func leaf_cards_material(climb_base: float) -> ShaderMaterial:
	var m := Kit.toon(0xffffff, {vertex_colors = true, climb_base = climb_base, ramp = Kit.RAMP_CANOPY, leaf_card = true})
	m.shader = preload("res://shaders/world_cel_twosided.gdshader")
	return m


## field stone tinted foot → body → moss over its whole surface
static func build_rock(rand: Rng, size: float, mossy := true) -> MeshInstance3D:
	var g := Geo.dodeca(size, 1).jitter(0.16, rand, 0.7)
	g.scale(1.2, 0.7, 1.0)
	var foot := Kit.lin(0x4e3e34)
	var body := Kit.lin(0x76604c)
	var moss := Kit.lin(0x5e5c3a if mossy else 0x7a6a52)
	g.c.resize(g.p.size())
	for i in g.p.size():
		var ny := g.n[i].y
		var patch := sin(g.p[i].x * 5.1 / size + 1.3) * sin(g.p[i].z * 4.3 / size) * 0.25
		g.c[i] = foot.lerp(body, smooth(ny, -0.6, -0.1)).lerp(moss, smooth(ny + patch, 0.15, 0.65) * 0.9)
	var rock := Kit.inked(g, Kit.toon(0xffffff, {vertex_colors = true, contour = 0.7}), 0.026, true)
	rock.rotation.y = rand.f() * 6.0
	return rock


## ink line where a prop meets the ground (lookdevKit.contactInk): bisect crossing edges
static func contact_ink(mesh: MeshInstance3D, surface_h: Callable) -> MeshInstance3D:
	var xf := mesh.global_transform if mesh.is_inside_tree() else mesh.transform
	var arr := mesh.mesh.surface_get_arrays(0)
	var verts: PackedVector3Array = arr[Mesh.ARRAY_VERTEX]
	var lines := PackedVector3Array()
	for i in range(0, verts.size(), 3):
		var tri := [xf * verts[i], xf * verts[i + 1], xf * verts[i + 2]]
		var hs := []
		for v: Vector3 in tri:
			hs.append(v.y - surface_h.call(v.x, v.z))
		var cross := []
		for j in 3:
			var k := (j + 1) % 3
			if hs[j] * hs[k] >= 0.0:
				continue
			var lo := 0.0
			var hi := 1.0
			var pt := Vector3()
			for s in 12:
				var t := (lo + hi) / 2.0
				pt = (tri[j] as Vector3).lerp(tri[k], t)
				if (pt.y - surface_h.call(pt.x, pt.z)) * hs[j] > 0.0:
					lo = t
				else:
					hi = t
			pt.y = surface_h.call(pt.x, pt.z) + 0.025
			cross.append(pt)
		if cross.size() == 2:
			lines.append(cross[0])
			lines.append(cross[1])
	var arrays := []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = lines
	var am := ArrayMesh.new()
	if not lines.is_empty():
		am.add_surface_from_arrays(Mesh.PRIMITIVE_LINES, arrays)
	var mi := MeshInstance3D.new()
	mi.mesh = am
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.albedo_color = INK
	mi.material_override = m
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	return mi


## five-lobed maple-leaf silhouette lying flat
static func maple_leaf_geometry(size: float) -> Geo:
	var pts := PackedVector2Array()
	for i in 10:
		var a := float(i) / 10.0 * TAU + PI / 2.0
		var r := (1.0 if i == 0 else 0.85) if i % 2 == 0 else 0.62
		pts.append(Vector2(cos(a) * r * size, sin(a) * r * size))
	return Geo.shape(pts).rotate_x(-PI / 2.0)


## layered ridges fading into the mist: `count` humps on an arc around (cx, cz)
static func build_distance(parent: Node3D, rand: Rng, cx: float, cz: float, dir: float, arc: float, count: int, y: float) -> void:
	var mat := Kit.toon(0x7e6a62)
	for i in count:
		var geo := Geo.icosa(1.0, 1).jitter(0.18, rand, 0.6)
		var r := Kit.plain(geo, mat)
		var a := dir + (float(i) / (count - 1) - 0.5) * arc
		var d := 55.0 + rand.f() * 25.0
		r.position = Vector3(cx + cos(a) * d, y, cz + sin(a) * d)
		r.scale = Vector3(18.0 + rand.f() * 14.0, 10.0 + rand.f() * 9.0, 14.0 + rand.f() * 6.0)
		r.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		parent.add_child(r)


## painted earth sheet (lookdevGround.buildGround): indexed grid, vertex-coloured cel patches + lanes
static func build_ground(cx: float, cz: float, w: float, d: float, seg: int, litter: Callable) -> ArrayMesh:
	var seg_w := seg if w >= d else roundi(seg * w / d)
	var seg_d := seg if d >= w else roundi(seg * d / w)
	var sage := Kit.lin(0x414739)
	var ochre := Kit.lin(0x655d45)
	var umber := Kit.lin(0x503c31)
	var dirt := Kit.lin(0x92856a)
	var worn := Kit.lin(0x7f755c)
	var band := func(v: float, at: float) -> float: return smooth(v, at - 0.05, at + 0.05)
	var verts := PackedVector3Array()
	var cols := PackedColorArray()
	for j in seg_d + 1:
		for i in seg_w + 1:
			var x := cx - w / 2.0 + w * i / seg_w
			var z := cz - d / 2.0 + d * j / seg_d
			verts.append(Vector3(x, Layout.ground_h(x, z), z))
			var nn := sin(x * 0.23 + cos(z * 0.19) * 2.0) * 0.5 + 0.5
			var c := sage.lerp(ochre, band.call(nn, 0.55) * 0.65)
			c = c.lerp(umber, band.call(litter.call(x, z), 0.3) * 0.75)
			var pd := Layout.path_dist(x, z)
			var wear := sin(z * 0.37 + sin(x * 0.31) * 1.8) * 0.5 + 0.5
			var path_c := dirt.lerp(worn, band.call(wear, 0.58) * 0.38)
			c = c.lerp(path_c, 1.0 - smooth(pd + sin(z * 2.3 + x) * 0.14, 0.65, 1.6))
			cols.append(c)
	var idx := PackedInt32Array()
	var row := seg_w + 1
	for j in seg_d:
		for i in seg_w:
			var a := j * row + i
			# clockwise from above (Godot front face)
			idx.append_array([a, a + 1, a + row, a + 1, a + row + 1, a + row])
	var normals := PackedVector3Array()
	normals.resize(verts.size())
	for t in range(0, idx.size(), 3):
		var fn := (verts[idx[t + 2]] - verts[idx[t]]).cross(verts[idx[t + 1]] - verts[idx[t]])
		for k in 3:
			normals[idx[t + k]] += fn
	for i in normals.size():
		normals[i] = normals[i].normalized()
	var arrays := []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = verts
	arrays[Mesh.ARRAY_NORMAL] = normals
	arrays[Mesh.ARRAY_COLOR] = cols
	arrays[Mesh.ARRAY_INDEX] = idx
	var am := ArrayMesh.new()
	am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
	return am


## tuft scatter (lookdevGround.buildGrass): 3–5 thin muted blades per tuft
static func build_grass(rand: Rng, cx: float, cz: float, w: float, d: float, count: int, keep: Callable) -> MultiMeshInstance3D:
	var blade := Geo.cone(0.035, 0.42, 3).translate(0, 0.2, 0)
	var k := Kit.new()
	k.add_geo(blade, Color(1, 1, 1), 0.0)
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_colors = true
	mm.mesh = k.build_mesh()
	mm.instance_count = count
	var n := 0
	while n < count:
		var x := (rand.f() - 0.5) * w + cx
		var z := (rand.f() - 0.5) * d + cz
		if Layout.path_dist(x, z) < 1.4 or not keep.call(x, z):
			continue
		var cnt := 3 + floori(rand.f() * 3)
		var j := 0
		while j < cnt and n < count:
			var p := Vector3(x + (rand.f() - 0.5) * 0.3, 0, z + (rand.f() - 0.5) * 0.3)
			p.y = Layout.ground_h(p.x, p.z) - 0.03
			var e := Vector3((rand.f() - 0.5) * 0.7, rand.f() * 6.0, (rand.f() - 0.5) * 0.7)
			var h := 0.5 + rand.f() * 0.7
			mm.set_instance_transform(n, Transform3D(Kit.euler(e).scaled_local(Vector3(1, h, 1)), p))
			var hex := 0x716d51 if rand.f() < 0.6 else (0x505b42 if rand.f() < 0.5 else 0x786047)
			mm.set_instance_color(n, Kit.lin(hex))
			j += 1
			n += 1
	var mi := MultiMeshInstance3D.new()
	mi.multimesh = mm
	mi.material_override = Kit.toon(0xffffff, {vertex_colors = true})
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	return mi


## leaf litter: 3 of 5 leaves pile in drifts, the rest scatter within r
static func build_leaves(rand: Rng, cx: float, cz: float, r: float, count: int, drifts: Array, keep: Callable) -> MultiMeshInstance3D:
	var k := Kit.new()
	k.add_geo(maple_leaf_geometry(0.095), Color(1, 1, 1), 0.0)
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_colors = true
	mm.mesh = k.build_mesh()
	mm.instance_count = count
	for i in count:
		var x: float
		var z: float
		if i % 5 < 3:
			var dr: Array = drifts[i % drifts.size()]
			var a := rand.f() * TAU
			var rr: float = pow(rand.f(), 0.7) * dr[2]
			x = dr[0] + cos(a) * rr
			z = dr[1] + sin(a) * rr
		else:
			var a := rand.f() * TAU
			var rr := sqrt(rand.f()) * r
			x = cx + cos(a) * rr
			z = cz + sin(a) * rr
		if Layout.path_dist(x, z) < 1.15:
			x += -1.5 if x < cx else 1.5
		if not keep.call(x, z):
			mm.set_instance_transform(i, Transform3D(Basis.from_scale(Vector3.ZERO), Vector3.ZERO))
			continue
		mm.set_instance_transform(i, Transform3D(Basis(Vector3.UP, rand.f() * 6.0), Vector3(x, Layout.ground_h(x, z) + 0.02 + rand.f() * 0.01, z)))
		mm.set_instance_color(i, Kit.lin(LITTER[i % LITTER.size()]))
	var mi := MultiMeshInstance3D.new()
	mi.multimesh = mm
	mi.material_override = Kit.toon(0xffffff, {vertex_colors = true})
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	return mi
