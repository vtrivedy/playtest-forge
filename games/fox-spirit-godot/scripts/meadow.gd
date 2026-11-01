class_name Meadow
extends RefCounted
## Arrival Meadow (opening/meadow.ts): slice ground, the H-a rock shelf at the foot of a stratified
## cliff ridge, framing groves, boulders with ink contact lines, grass and leaf litter.

## stone strata, base → cap: warm grey-ochre bands so the shelf reads as layered rock
const STRATA := [0x6e5c4c, 0x8a7560, 0x7a6754, 0x93806a]
const MOSS := 0x5e5c3a

## groves [x, z, scale, kind, palette]; palette ≥ 4 = moss/olive
const TREES := [
	[-12.5, 72.5, 1.25, "hero", 4], [-16, 77, 1.0, "grove", 2], [-10.5, 66.5, 1.05, "grove", 5], [-18, 68.5, 1.15, "lean", 0], [-22, 74, 1.1, "grove", 3],
	[4.5, 63.5, 1.2, "tall", 4], [-7.5, 61.5, 1.1, "grove", 1], [10, 62.5, 1.0, "grove", 5], [0.5, 59, 1.3, "grove", 3],
	[21.5, 67, 1.3, "hero", 0], [23, 84, 1.05, "grove", 2], [18.5, 90.5, 0.95, "grove", 5],
	[8, 81.5, 0.9, "grove", 4], [-23, 92, 1.0, "grove", 1], [-31, 79, 1.2, "tall", 5], [3, 101.5, 1.1, "grove", 3], [-15, 101, 1.0, "lean", 4], [-33, 93, 1.05, "grove", 0],
]
## boulders [x, z, size]
const ROCKS := [[-11, 74.5, 0.65], [-14.3, 70.2, 0.95], [-9.2, 68.8, 0.45], [2.4, 70.5, 0.75], [3.6, 69.3, 0.45], [8.2, 71, 0.55], [19.5, 69.5, 1.1], [6.2, 84.5, 0.5], [-20, 80.5, 0.7], [11.5, 87, 0.6]]


## stone column: 6–7-sided tapered drums in strata tones, a little turned and offset; `moss` caps it in turf
static func column(rand: Rng, x: float, z: float, r: float, y0: float, y1: float, moss: bool) -> Node3D:
	var g := Node3D.new()
	g.position = Vector3(x, 0, z)
	var sides := 6 if rand.f() < 0.5 else 7
	var stone_top := y1 - 0.3 if moss else y1
	var cuts: Array[float] = []
	var y := y0
	while y < stone_top - 0.6:
		y += 1.1 + rand.f() * 1.3
		cuts.append(y)
	var joints: Array[float] = [y0]
	for cy in cuts:
		if cy < stone_top - 0.6:
			joints.append(cy)
	joints.append(stone_top)
	var spin := rand.f() * PI
	for i in joints.size() - 1:
		var a := joints[i]
		var b := joints[i + 1]
		var k := (a - y0) / maxf(1.0, stone_top - y0)
		var rr := r * (1.0 - k * 0.14) * (0.95 + rand.f() * 0.1)
		var crown := 0.55 + rand.f() * 0.2 if (not moss and i == joints.size() - 2) else 0.94
		var geo := Geo.cylinder(rr * crown, rr, b - a - 0.04, sides, 1).hewn(rand, 0.07)
		var tone := Kit.lin(STRATA[(i + floori(x * 3.0 + z)) & 3]) * (0.88 + rand.f() * 0.2)
		tone.a = 1.0
		var m := Kit.inked(geo, Kit.toon(tone, {contour = 0.5}), 0.028, true)
		m.position = Vector3((rand.f() - 0.5) * 0.24, (a + b) / 2.0, (rand.f() - 0.5) * 0.24)
		m.rotation.y = spin + (rand.f() - 0.5) * 0.4
		g.add_child(m)
	if moss:
		var rr := r * 0.86 * 1.04
		var cap := Kit.inked(Geo.cylinder(rr, rr * 0.97, 0.36, sides, 1).hewn(rand, 0.03), Kit.toon(MOSS, {hatch_weight = 0.4}), 0.024, true)
		cap.position.y = y1 - 0.18
		cap.rotation.y = spin
		g.add_child(cap)
	return g


## H-a, the cold hearth: two-step stone plinth + ring of seven fire-blackened bowl stones
static func build_hearth(ctx: Ctx) -> void:
	var rand := ctx.rand
	var hx: float = Layout.HEARTH_A.x
	var hz: float = Layout.HEARTH_A.z
	var y := Layout.ground_h(hx, hz)
	var g := Node3D.new()
	g.name = "hearth-a"
	g.position = Vector3(hx, y, hz)
	ctx.add(g)
	ctx.occluder(g)
	for pl in [[2.0, 0.34, -0.06, 0x7e7465], [1.5, 0.28, 0.28, 0x8e8577]]:
		var m := Kit.inked(Geo.box(pl[0], pl[1], pl[0], 2, 1, 2).hewn(rand, 0.05), Kit.toon(pl[3], {contour = 0.5}), 0.022, true)
		m.position.y = pl[2] + pl[1] / 2.0
		m.rotation.y = rand.f() * 0.5
		g.add_child(m)
	var n := 7
	for i in n:
		var a0 := float(i) / n * TAU + 0.05
		var a1 := float(i + 1) / n * TAU - 0.05
		var pts := PackedVector2Array()
		for s in 7:
			var a := lerpf(a0, a1, s / 6.0)
			pts.append(Vector2(cos(a), sin(a)) * 1.0)
		for s in 7:
			var a := lerpf(a1, a0, s / 6.0)
			pts.append(Vector2(cos(a), sin(a)) * 0.66)
		var h := 0.5 + rand.f() * 0.14
		var geo := Geo.extrude(pts, h).rotate_x(-PI / 2.0).hewn(rand, 0.03)
		var tone := Kit.lin(0x5a4f46) * (0.85 + rand.f() * 0.25)
		tone.a = 1.0
		var stone := Kit.inked(geo, Kit.toon(tone, {contour = 0.5}), 0.022, true)
		stone.position.y = 0.5
		g.add_child(stone)
	ctx.colliders.append({kind = "cap", x = hx, z = hz, r = 1.05, base = y, h = 1.05})


## the H-a shelf and the cliff ridge it steps up into (shelf-local frame, yaw SHELF.yaw)
static func build_shelf(ctx: Ctx) -> void:
	var rand := ctx.rand
	var S := Layout.SHELF
	var g0 := Layout.ground_h(S.x, S.z)
	var top: float = g0 + S.rise
	var root := Node3D.new()
	root.name = "shelf"
	root.position = Vector3(S.x, 0, S.z)
	root.rotation.y = S.yaw
	ctx.add(root)
	var c := cos(S.yaw)
	var s := sin(S.yaw)
	var world := func(lx: float, lz: float) -> Vector2: return Vector2(S.x + lx * c + lz * s, S.z - lx * s + lz * c)
	var hw: float = S.w / 2.0
	var hd: float = S.d / 2.0
	for lx in [-3, 0, 3]:
		for lz in [-3, 0, 3]:
			var edge: bool = absi(lx) + absi(lz) > 0
			var cx: float = lx + (rand.f() - 0.5) * 0.4
			var cz: float = lz + (rand.f() - 0.5) * 0.4
			root.add_child(ctx.occluder(column(rand, cx, cz, 2.25 if edge else 2.0, g0 - 2.0, top, true)))
	ctx.colliders.append({kind = "box", x = S.x, z = S.z, yaw = S.yaw, hx = hw, hz = hd, top = top})
	var ridge := [
		[hw + 2.2, -3.2, 2.4, 7.4], [hw + 2.6, 1.2, 2.6, 8.3], [hw + 2.0, 5.4, 2.3, 7.0],
		[hw + 6.4, -1.5, 2.8, 10.2], [hw + 6.8, 3.6, 2.7, 9.4], [hw + 5.6, -6.6, 2.5, 8.6],
		[hw + 1.2, -hd - 2.2, 2.3, 6.6], [-1.2, hd + 2.4, 2.4, 6.2], [2.8, hd + 2.8, 2.2, 7.1],
		[-4.6, hd + 1.8, 1.9, 4.2], [hw + 10.5, 1, 3, 11.5],
	]
	for rd in ridge:
		var h: float = rd[3]
		var moss := h < 8.5 and rand.f() < 0.6
		root.add_child(ctx.occluder(column(rand, rd[0], rd[1], rd[2], g0 - 2.0, g0 + h + (1.0 if h > 8.0 else 0.0), moss)))
		var w: Vector2 = world.call(rd[0], rd[1])
		ctx.colliders.append({kind = "post", x = w.x, z = w.y, r = rd[2] * 0.95})
	for t in [[-2.6, -hd - 1.3, 0.7], [-0.8, -hd - 1.9, 0.45], [-6.2, hd + 1.2, 0.8], [-6.9, hd + 2.6, 0.5], [hw + 4.8, -hd - 4.7, 0.9]]:
		var w: Vector2 = world.call(t[0], t[1])
		var sz: float = t[2]
		var r := Props.build_rock(rand, sz)
		r.position = Vector3(w.x, Layout.ground_h(w.x, w.y) + sz * 0.2, w.y)
		ctx.add(r)
		ctx.add(Props.contact_ink(r, Layout.ground_h))
		ctx.colliders.append({kind = "cap", x = w.x, z = w.y, r = sz * 1.1, base = Layout.ground_h(w.x, w.y), h = sz * 0.95})
	# the beacon: one olive maple on the far corner of the shelf, visible from the well
	var tw: Vector2 = world.call(hw - 1.6, -hd + 1.7)
	var beacon := Props.build_maple(rand, 1.05, "hero", 4, top)
	beacon.position = Vector3(tw.x, top - 0.1, tw.y)
	beacon.rotation.y = 2.2
	ctx.add(beacon)
	ctx.occluder(beacon)
	ctx.colliders.append({kind = "post", x = tw.x, z = tw.y, r = 0.45 * 1.05 * 1.5})
	for t in [[hw - 1.2, hd - 1.4, 0.55], [hw - 2.3, hd - 0.9, 0.35]]:
		var w: Vector2 = world.call(t[0], t[1])
		var sz: float = t[2]
		var r := Props.build_rock(rand, sz)
		r.position = Vector3(w.x, top + sz * 0.2, w.y)
		ctx.add(r)
		ctx.colliders.append({kind = "cap", x = w.x, z = w.y, r = sz * 1.1, base = top, h = sz * 0.95})


static func clear(x: float, z: float, r: float) -> bool:
	if Layout.path_dist(x, z) <= r: return false
	if Vector2(x - Layout.WELL.x, z - Layout.WELL.y).length() <= 4.0 + r: return false
	if Vector2(x - Layout.HEARTH_A.x, z - Layout.HEARTH_A.z).length() <= 2.5 + r: return false
	for h in Layout.HOUSES:
		if maxf(absf(x - h.x) - h.w / 2.0, absf(z - h.z) - h.d / 2.0) <= r: return false
	return true


static func build(ctx: Ctx) -> void:
	var rand := ctx.rand
	var B := Layout.BOUNDS
	# umber litter pools under the crowns
	var litter := func(x: float, z: float) -> float:
		var k := 0.0
		for t in TREES:
			k = maxf(k, 1.0 - Layout.sstep(Vector2(x - t[0], z - t[1]).length(), 1.6 * t[2], 3.6 * t[2]))
		return k * (0.75 + 0.25 * sin(x * 1.3 + sin(z * 0.9) * 2.0))
	var ground := MeshInstance3D.new()
	ground.name = "ground"
	ground.mesh = Props.build_ground(B.cx, B.cz, B.rx * 3.0, B.rz * 3.4, 170, litter)
	ground.material_override = Kit.toon(0xffffff, {vertex_colors = true, hatch_weight = 0.22})
	ctx.add(ground)

	build_shelf(ctx)
	build_hearth(ctx)

	# the rim: a ring of big crowns on the bowl's lip closes the slice (the slope blocks)
	var rim_n := 16
	for i in rim_n:
		var a := float(i) / rim_n * TAU + rand.f() * 0.25
		var k := 1.06 + rand.f() * 0.14
		var x: float = B.cx + cos(a) * B.rx * k
		var z: float = B.cz + sin(a) * B.rz * k
		var y := Layout.ground_h(x, z)
		var sc := 1.4 + rand.f() * 0.5
		var kind := "tall" if rand.f() < 0.4 else "grove"
		var pal := 4 + (i & 1) if rand.f() < 0.6 else i & 3
		var t := Props.build_maple(rand, sc, kind, pal, y)
		t.position = Vector3(x, y - 0.1, z)
		t.rotation.y = rand.f() * 6.0
		ctx.add(t)
	for i in rim_n:
		var a := (i + 0.5) / rim_n * TAU + (rand.f() - 0.5) * 0.15
		var k2 := 1.32 + rand.f() * 0.18
		var x: float = B.cx + cos(a) * B.rx * k2
		var z: float = B.cz + sin(a) * B.rz * k2
		var y := Layout.ground_h(x, z)
		var t := Props.build_maple(rand, 1.6 + rand.f() * 0.5, "grove", 4 + (i & 1), y)
		t.position = Vector3(x, y - 0.1, z)
		t.rotation.y = rand.f() * 6.0
		ctx.add(t)
	for tr in TREES:
		var y := Layout.ground_h(tr[0], tr[1])
		var t := Props.build_maple(rand, tr[2], tr[3], tr[4], y)
		t.position = Vector3(tr[0], y - 0.1, tr[1])
		t.rotation.y = rand.f() * 6.0
		ctx.add(t)
		ctx.occluder(t)
		var r0 := 0.42 if tr[3] == "hero" else (0.38 if tr[3] == "lean" else 0.3)
		ctx.colliders.append({kind = "post", x = tr[0], z = tr[1], r = r0 * tr[2] * 1.5})
	for rk in ROCKS:
		var r := Props.build_rock(rand, rk[2])
		r.position = Vector3(rk[0], Layout.ground_h(rk[0], rk[1]) + rk[2] * 0.25, rk[1])
		ctx.add(r)
		ctx.colliders.append({kind = "cap", x = rk[0], z = rk[1], r = rk[2] * 1.1, base = Layout.ground_h(rk[0], rk[1]), h = rk[2] * 0.95})
		ctx.add(Props.contact_ink(r, Layout.ground_h))

	ctx.add(Props.build_grass(rand, B.cx, B.cz, B.rx * 2.0, B.rz * 2.0, 2600,
		func(x: float, z: float) -> bool: return clear(x, z, 0.6) and Layout.rim_k(x, z) < 1.0 - rand.f() * 0.15))
	var drifts := []
	for t in TREES:
		drifts.append([t[0], t[1], 1.6 + t[2] * 1.4])
	ctx.add(Props.build_leaves(rand, B.cx, B.cz, 30.0, 2600, drifts, func(x: float, z: float) -> bool: return clear(x, z, 0.2)))
	Props.build_distance(ctx.root, rand, B.cx, B.cz, -PI / 2.0, PI * 1.9, 16, 2.0)
