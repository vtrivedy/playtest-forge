class_name Village
extends RefCounted
## Lanternhollow (opening/village.ts): timber-and-plaster cottages under thatch or slate, the Great
## Well, the cold fire-pit, the lych-gate and lane walls, flagstones, wattle fences, festoon lanterns
## and doorstep clutter. Every landmark merges into one vertex-coloured toon mesh with its ink hull.

const C := {
	plaster = 0xd6c4a2, plaster_warm = 0xcdb48e, timber = 0x5a3f2e, timber_dark = 0x3d2a20,
	stone = 0x8a8274, stone_dark = 0x6b6358, stone_cool = 0x6e6d69, stone_field = 0x5f584f,
	cloth = [0xb9ab90, 0x8d6f62, 0x7d8088], thatch = 0x8d7a52, thatch_dark = 0x6c5d40,
	slate = 0x5d5c66, slate_dark = 0x4a4952, amber = 0xe6a65a, door = 0x6b4a32, flag = 0x8d8471,
	bloom = [0x9a4f3c, 0xa8834a, 0x7d5a6a], leaf = 0x5d6040, cabbage = 0x6d7350, rope = 0x8a7357,
}
const GATE_HALF := 1.35


static func box(w: float, h: float, d: float) -> Geo:
	return Geo.box(w, h, d)


static func cyl(rt: float, rb: float, h: float, seg := 8, axis := "y") -> Geo:
	return Geo.cyl(rt, rb, h, seg, axis)


static func v(x: float, y: float, z: float) -> Vector3:
	return Vector3(x, y, z)


## triangle prism across x: base `d` (z), apex `h`, thickness `t`
static func gable(d: float, h: float, t: float) -> Geo:
	return Geo.extrude(PackedVector2Array([Vector2(-d / 2, 0), Vector2(d / 2, 0), Vector2(0, h)]), t).translate(0, 0, -t / 2).rotate_y(PI / 2)


## round-topped slab in the xy plane
static func arch_slab(w: float, h: float, t: float) -> Geo:
	var r := w / 2
	var pts := PackedVector2Array([Vector2(-r, 0), Vector2(r, 0)])
	for i in 21:
		var a := PI * i / 20.0
		pts.append(Vector2(cos(a) * r, h - r + sin(a) * r))
	return Geo.extrude(pts, t).translate(0, 0, -t / 2)


static func maple_shape(s: float) -> PackedVector2Array:
	var pts := [[0, 0.26], [0.055, 0.13], [0.17, 0.2], [0.14, 0.07], [0.27, 0.08], [0.19, -0.03], [0.25, -0.1], [0.07, -0.13], [0.025, -0.17], [0.025, -0.25], [-0.025, -0.25], [-0.025, -0.17], [-0.07, -0.13], [-0.25, -0.1], [-0.19, -0.03], [-0.27, 0.08], [-0.14, 0.07], [-0.17, 0.2], [-0.055, 0.13]]
	var out := PackedVector2Array()
	for p in pts:
		out.append(Vector2(p[0], p[1]) * s * 3.7)
	return out


## window facing +z at the kit frame: amber pane, cross mullion, sill, open shutters, optional flower box
static func window_unit(k: Kit, rand: Rng, flowers: bool) -> void:
	k.add(box(0.8, 0.72, 0.06), C.amber, v(0, 0, 0))
	k.add(box(0.07, 0.72, 0.09), C.timber, v(0, 0, 0.04))
	k.add(box(0.8, 0.07, 0.09), C.timber, v(0, 0.02, 0.04))
	k.add(box(0.98, 0.14, 0.2), C.timber, v(0, -0.42, 0.08))
	k.add(box(0.96, 0.12, 0.12), C.timber_dark, v(0, 0.42, 0.05))
	for s in [-1, 1]:
		k.add(box(0.36, 0.82, 0.06), C.door, v(s * 0.66, 0, 0.12), v(0, s * 0.5, 0))
	if flowers:
		k.add(box(0.9, 0.2, 0.24), C.timber_dark, v(0, -0.58, 0.16))
		for i in 4:
			k.add(Geo.icosa(0.13, 0).jitter(0.2, rand), C.leaf if i % 2 else C.bloom[i % 3], v(-0.3 + i * 0.2, -0.43, 0.17))


## thatch course slab (local z = down-slope when sz = +1): lumpy top, scalloped fringe at the eave end
static func thatch_course(w: float, t: float, length: float, sz: float, rand: Rng) -> Geo:
	var g := Geo.box(w, t, length, ceili(w / 0.18), 1, 3)
	var o := rand.f() * 10.0
	for i in g.p.size():
		var x := g.p[i].x
		var y := g.p[i].y
		var z := g.p[i].z * sz
		var bump := sin(x * 2.1 + o) * sin(z * 3.3 + o) * 0.035
		if y > 0.0:
			y += bump
		if z > length / 2.0 - 1e-3:
			var sc := absf(sin(x * 7.0 + o))
			g.p[i].z = (z + 0.09 * sc) * sz
			y -= 0.07 * sc
		g.p[i].y = y
	return g.smooth_normals()


static func cottage(k: Kit, ctx: Ctx, h: Dictionary, index: int) -> float:
	var rand := ctx.rand
	var y0 := INF
	for sx in [-1, 1]:
		for sz in [-1, 1]:
			y0 = minf(y0, Layout.ground_h(h.x + sx * h.w / 2.0, h.z + sz * h.d / 2.0))
	var w: float = h.w
	var d: float = h.d
	var eave: float = h.eave
	var rise: float = h.rise
	var slate := index % 3 == 1
	var stone_lower := index % 2 == 1
	var plaster: int = C.plaster_warm if index % 2 else C.plaster
	var base := 0.55
	var wall_top := base + eave
	k.at(h.x, y0, h.z, 0.0, func() -> void:
		k.add(box(w + 0.45, 1.3, d + 0.45).hewn(rand, 0.03), C.stone_dark, v(0, base - 0.65, 0), Vector3.ZERO, 0.022)
		var per := func(length: float, fn: Callable) -> void:
			var n := maxi(2, roundi(length / 0.75))
			for i in n:
				fn.call((i + 0.5) / n - 0.5, length / n)
		var field := func(x: float, z: float, r: float) -> void:
			var geo := Geo.dodeca(r, 0).jitter(0.18, rand)
			var tone: int = C.stone_dark if rand.f() < 0.4 else (C.stone_field if rand.f() < 0.5 else C.stone_cool)
			k.add(geo, tone, v(x, base - 0.42 + r * 0.35, z), v(rand.f(), rand.f() * 6.0, rand.f()), 0.02, v(1.25, 0.8, 1.1))
		for sz in [-1, 1]:
			per.call(w + 0.5, func(t: float, _s: float) -> void: field.call(t * (w + 0.5) + (rand.f() - 0.5) * 0.15, sz * (d / 2.0 + 0.2), 0.3 + rand.f() * 0.14))
		for sx in [-1, 1]:
			per.call(d + 0.1, func(t: float, _s: float) -> void: field.call(sx * (w / 2.0 + 0.2), t * (d + 0.1) + (rand.f() - 0.5) * 0.15, 0.3 + rand.f() * 0.14))

		# walls (slightly bowed); some cottages keep a rubble-stone ground storey
		k.add(Geo.box(w, eave, d, 4, 3, 3).jitter(0.01, rand), plaster, v(0, base + eave / 2.0, 0), Vector3.ZERO, 0.016)
		if stone_lower:
			for c in 3:
				var yy := base + 0.18 + c * 0.32
				for sz in [-1, 1]:
					per.call(w, func(t: float, s: float) -> void:
						var geo := box(s * 0.92, 0.3, 0.12).hewn(rand, 0.06)
						k.add(geo, C.stone if rand.f() < 0.5 else C.stone_dark, v(t * w + (c % 2) * 0.15, yy, sz * (d / 2.0 + 0.04)), Vector3.ZERO, 0.014))
				for sx in [-1, 1]:
					per.call(d, func(t: float, s: float) -> void:
						var geo := box(0.12, 0.3, s * 0.92).hewn(rand, 0.06)
						k.add(geo, C.stone if rand.f() < 0.5 else C.stone_dark, v(sx * (w / 2.0 + 0.04), yy, t * d), Vector3.ZERO, 0.014))

		# timber frame
		for sx in [-1, 1]:
			for sz in [-1, 1]:
				k.add(box(0.22, eave + 0.1, 0.22), C.timber, v(sx * w / 2.0, base + eave / 2.0, sz * d / 2.0))
		for sz in [-1, 1]:
			k.add(box(w + 0.14, 0.2, 0.18), C.timber, v(0, wall_top - 0.1, sz * d / 2.0 + 0.03))
			if not stone_lower:
				k.add(box(w + 0.14, 0.16, 0.16), C.timber, v(0, base + 0.12, sz * d / 2.0 + 0.03))
			k.add(box(w + 0.1, 0.12, 0.12), C.timber, v(0, base + eave * 0.52, sz * d / 2.0 + 0.04))
		for sx in [-1, 1]:
			k.add(box(0.18, 0.2, d + 0.14), C.timber, v(sx * w / 2.0 + 0.03, wall_top - 0.1, 0))
			var bh := eave * 0.42
			var blen := Vector2(d * 0.5, bh).length()
			var ang := atan2(d * 0.5, bh)
			for s in [-1, 1]:
				k.add(box(0.1, blen, 0.1), C.timber, v(sx * w / 2.0 + 0.05, base + eave * 0.52 + bh / 2.0, s * d * 0.25), v(s * ang, 0, 0))

		# gables (x ends) with a king post and a round attic window
		for sx in [-1, 1]:
			k.at(sx * (w - 0.06) / 2.0, wall_top, 0.0, 0.0, func() -> void:
				k.add(gable(d + 0.1, rise, 0.14), plaster)
				k.add(box(0.16, rise * 0.85, 0.14), C.timber, v(sx * 0.05, rise * 0.42, 0))
				k.add(cyl(0.26, 0.26, 0.1, 12, "x"), C.timber_dark, v(sx * 0.08, rise * 0.4, 0))
				k.add(cyl(0.19, 0.19, 0.1, 12, "x"), C.amber, v(sx * 0.11, rise * 0.4, 0)))

		# roof: thick slabs with a big overhang, rolled thatch eaves + ridge, or slate courses
		var over := 0.6
		var half := d / 2.0 + over
		var slope := atan2(rise, d / 2.0)
		var run := half / cos(slope)
		var thick := 0.24 if slate else 0.3
		var tone: int = C.slate if slate else C.thatch
		var tone_dark: int = C.slate_dark if slate else C.thatch_dark
		var y_surf := func(t: float) -> float: return wall_top + rise - tan(slope) * half * t
		for sz in [-1, 1]:
			var z_at := func(t: float) -> float: return sz * half * t
			if slate:
				k.add(Geo.box(w + over * 2.0, thick, run, 5, 1, 4).hewn(rand, 0.012), tone, v(0, y_surf.call(0.5) + thick / 2.0, z_at.call(0.5)), v(sz * slope, 0, 0), 0.024)
				for t in [0.22, 0.42, 0.62, 0.82]:
					k.add(box(w + over * 2.0 + 0.02, 0.06, 0.12), tone_dark, v(0, y_surf.call(t) + thick + 0.01, z_at.call(t)), v(sz * slope, 0, 0), 0.01)
				k.add(box(w + over * 2.0 + 0.06, thick + 0.04, 0.14), tone_dark, v(0, y_surf.call(1.0) + thick / 2.0, z_at.call(1.0)), v(sz * slope, 0, 0), 0.016)
			else:
				var bands := [[0.0, 0.42], [0.34, 0.72], [0.64, 1.0]]
				for c in 3:
					var t0: float = bands[c][0]
					var t1: float = bands[c][1]
					var tm := (t0 + t1) / 2.0
					var wide := w + over * 2.0 - (2 - c) * 0.06
					k.add(thatch_course(wide, thick, run * (t1 - t0), sz, rand), C.thatch_dark if c % 2 else tone, v(0, y_surf.call(tm) + thick / 2.0 + c * 0.07, z_at.call(tm)), v(sz * slope, 0, 0), 0.022 if c == 2 else 0.016)
		var ridge_r := 0.17 if slate else 0.36
		k.add(cyl(ridge_r, ridge_r, w + over * 2.0 + 0.15, 10, "x").jitter(0.01 if slate else 0.05, rand), tone_dark, v(0, y_surf.call(0.0) + thick + (0.02 if slate else 0.08), 0), Vector3.ZERO, 0.024)

		# front (+z): arched door under a hooded porch, step, a window
		var front := d / 2.0
		var door_x := -w * 0.2
		k.add(arch_slab(1.12, 1.92, 0.12), C.timber_dark, v(door_x, base - 0.02, front + 0.05))
		k.add(arch_slab(0.88, 1.74, 0.12), C.door, v(door_x, base, front + 0.1))
		for dx in [-0.22, 0.0, 0.22]:
			k.add(box(0.03, 1.5, 0.04), C.timber_dark, v(door_x + dx, base + 0.8, front + 0.17))
		k.add(cyl(0.05, 0.05, 0.06, 8, "z"), C.amber, v(door_x + 0.3, base + 0.9, front + 0.18))
		k.add(box(1.4, 0.32, 0.7).hewn(rand, 0.05), C.stone_field, v(door_x, base - 0.2, front + 0.45), Vector3.ZERO, 0.02)
		k.at(door_x, base + 2.05, front + 0.35, 0.0, func() -> void:
			for s in [-1, 1]:
				k.add(box(0.85, 0.12, 0.75).hewn(rand, 0.02), tone, v(s * 0.36, 0.18, 0), v(0, 0, -s * 0.5), 0.016)
			for s in [-1, 1]:
				k.add(box(0.08, 0.5, 0.08), C.timber, v(s * 0.55, -0.12, -0.15), v(0.7, 0, 0)))
		k.at(w * 0.24, base + eave * 0.58, front + 0.03, 0.0, func() -> void: window_unit(k, rand, true))
		for sx in [-0.25, 0.25]:
			k.at(sx * w, base + eave * 0.58, -front - 0.03, PI, func() -> void: window_unit(k, rand, false))
		for sx in [-1, 1]:
			k.at(sx * w / 2.0 + sx * 0.03, base + eave * 0.36, d * 0.1, sx * PI / 2.0, func() -> void: window_unit(k, rand, false))

		if h.chimney:
			# stacked-stone chimney up the west gable, standing clear of the ridge
			var cx := -w / 2.0 - 0.35
			var ctop := wall_top + rise + 1.0
			var yy := base - 0.2
			var s := 0.95
			while yy < ctop:
				var geo := box(s, 0.45, s).hewn(rand, 0.06)
				k.add(geo, C.stone if rand.f() < 0.5 else C.stone_dark, v(cx + (rand.f() - 0.5) * 0.05, yy + 0.22, -d * 0.18 + (rand.f() - 0.5) * 0.05), v(0, (rand.f() - 0.5) * 0.2, 0), 0.02)
				yy += 0.42
				s = maxf(0.68, s - 0.03)
			k.add(box(0.9, 0.16, 0.9).hewn(rand, 0.04), C.stone_dark, v(cx, yy + 0.08, -d * 0.18), Vector3.ZERO, 0.02)
			k.add(cyl(0.12, 0.14, 0.3, 7), C.stone_dark, v(cx + 0.15, yy + 0.3, -d * 0.18 + 0.1))

		# doorstep clutter: barrel + crates; woodpile under the back eave
		k.add(cyl(0.34, 0.3, 0.78, 10), C.timber, v(door_x - 1.0, base - 0.1 + 0.39 - 0.25, front + 0.6), Vector3.ZERO, 0.016)
		for yy in [0.12, 0.55]:
			k.add(cyl(0.355, 0.33, 0.06, 10), C.timber_dark, v(door_x - 1.0, base - 0.35 + yy + 0.1, front + 0.6))
		k.add(box(0.6, 0.55, 0.6).hewn(rand, 0.03), C.door, v(w * 0.42, base - 0.3 + 0.27, front + 0.65), v(0, 0.3, 0), 0.016)
		k.add(box(0.45, 0.4, 0.45).hewn(rand, 0.03), C.timber, v(w * 0.42 + 0.05, base - 0.3 + 0.75, front + 0.62), v(0, -0.2, 0), 0.016)
		for row in 3:
			for i in 4 - row:
				k.add(cyl(0.14, 0.14, 0.9, 7, "z"), C.timber if i % 2 else C.door, v(w * 0.1 + (i - 1.5 + row * 0.5) * 0.29, base - 0.15 + row * 0.25, -front - 0.55), Vector3.ZERO, 0.012))
	return y0


static func great_well(k: Kit, ctx: Ctx) -> void:
	var rand := ctx.rand
	var y := Layout.ground_h(Layout.WELL.x, Layout.WELL.y)
	k.at(Layout.WELL.x, y, Layout.WELL.y, 0.3, func() -> void:
		for ring in 2:
			for i in 11:
				var a := (i + ring * 0.5) / 11.0 * TAU
				k.add(box(0.78, 0.42, 0.5).hewn(rand, 0.07), C.stone if (i + ring) % 3 else C.stone_dark, v(sin(a) * 1.28, 0.2 + ring * 0.4, cos(a) * 1.28), v(0, a, 0), 0.02)
		for i in 11:
			var a := (i + 0.25) / 11.0 * TAU
			k.add(box(0.8, 0.16, 0.6).hewn(rand, 0.05), C.stone_cool, v(sin(a) * 1.3, 0.9, cos(a) * 1.3), v(0, a, 0), 0.02)
		var disc := PackedVector2Array()
		for i in 18:
			disc.append(Vector2(cos(TAU * i / 18.0), sin(TAU * i / 18.0)) * 1.05)
		k.add(Geo.shape(disc).rotate_x(-PI / 2), 0x23201f, v(0, 0.55, 0), Vector3.ZERO, 0.001)
		for s in [-1, 1]:
			k.add(box(0.24, 2.6, 0.24), C.timber, v(s * 1.38, 1.3, 0))
			k.add(box(0.16, 0.9, 0.16), C.timber, v(s * 1.38, 0.45, 0.35), v(-0.5, 0, 0))
		k.add(cyl(0.11, 0.11, 3.0, 8, "x"), C.timber_dark, v(0, 1.9, 0))
		k.add(cyl(0.2, 0.2, 0.32, 10, "x"), C.timber, v(0, 1.9, 0))
		k.add(box(0.08, 0.55, 0.08), C.timber_dark, v(1.6, 1.68, 0.14), v(0, 0, 0.5))
		k.add(cyl(0.02, 0.02, 0.75, 4), C.rope, v(0.0, 1.47, 0.18))
		k.add(cyl(0.22, 0.17, 0.32, 10), C.timber, v(0.0, 0.98, 0.18), Vector3.ZERO, 0.016)
		for s in [-1, 1]:
			k.add(box(3.5, 0.2, 1.4).hewn(rand, 0.025), C.slate, v(0, 2.62, s * 0.52), v(s * 0.62, 0, 0), 0.022)
		k.add(cyl(0.13, 0.13, 3.6, 8, "x"), C.slate_dark, v(0, 2.98, 0))
		k.add(box(0.7, 0.5, 0.12).hewn(rand, 0.03), C.stone_dark, v(0, 0.45, 1.58))
		k.add(Geo.extrude(maple_shape(0.22), 0.05), C.stone_cool, v(0, 0.46, 1.63)))


## the village fire-pit by the plaza: a ring of stones round cold, charred logs
static func fire_pit(k: Kit, ctx: Ctx, x: float, z: float) -> void:
	var rand := ctx.rand
	k.at(x, Layout.ground_h(x, z), z, 0.0, func() -> void:
		for i in 9:
			var a := i / 9.0 * TAU
			k.add(Geo.dodeca(0.26, 0).hewn(rand, 0.15), C.stone if i % 2 else C.stone_dark, v(sin(a) * 0.85, 0.08, cos(a) * 0.85), v(0, a, 0), 0.02, v(1.2, 0.8, 1))
		for i in 4:
			k.add(cyl(0.09, 0.11, 0.9, 7, "x"), 0x2f2622, v(0, 0.12, 0), v(0.25, i / 4.0 * PI, 0.35), 0.012)
		k.add(cyl(0.2, 0.2, 1.6, 9, "x"), C.timber, v(0, 0.22, -1.9), v(0, 0.2, 0), 0.018))


## worn flagstones set flush in the lanes (instanced, no ink)
static func flagstones(ctx: Ctx) -> Node3D:
	var rand := ctx.rand
	var shapes: Array[Geo] = []
	for vv in 4:
		var g := Geo.cylinder(0.3, 0.33, 0.1, 5 + vv, 1)
		var lobes: Array[float] = []
		for i in 5 + vv:
			lobes.append(0.75 + rand.f() * 0.4)
		for i in g.p.size():
			var a := atan2(g.p[i].z, g.p[i].x)
			var kk := lobes[roundi((a + PI) / TAU * (5 + vv)) % (5 + vv)]
			g.p[i].x *= kk
			g.p[i].z *= kk
		shapes.append(g.hewn(rand, 0.04))
	var placed := [[], [], [], []]
	for s in Layout.PATHS:
		var ax: float = s[0]
		var az: float = s[1]
		var bx: float = s[2]
		var bz: float = s[3]
		if minf(az, bz) < 78.0:
			continue
		var length := Vector2(bx - ax, bz - az).length()
		var nx := -(bz - az) / length
		var nz := (bx - ax) / length
		var st := 0.3
		while st < length:
			if rand.f() < 0.18:
				st += 0.62 + rand.f() * 0.3
				continue
			var t := st / length
			var side := (rand.f() - 0.5) * 1.1
			var x := ax + (bx - ax) * t + nx * side
			var z := az + (bz - az) * t + nz * side
			var sc := 0.8 + rand.f() * 0.45
			var which := floori(rand.f() * shapes.size())
			var e := Vector3((rand.f() - 0.5) * 0.06, rand.f() * 6.0, (rand.f() - 0.5) * 0.06)
			placed[which].append(Transform3D(Kit.euler(e).scaled_local(Vector3(sc, 1, sc)), Vector3(x, Layout.ground_h(x, z) - 0.035, z)))
			st += 0.62 + rand.f() * 0.3
	var g := Node3D.new()
	g.name = "flagstones"
	var mat := Kit.toon(C.flag, {hatch_weight = 0.6})
	for i in shapes.size():
		var k := Kit.new()
		k.add_geo(shapes[i], Color(1, 1, 1), 0.0)
		var mm := MultiMesh.new()
		mm.transform_format = MultiMesh.TRANSFORM_3D
		mm.mesh = k.build_mesh()
		mm.instance_count = placed[i].size()
		for j in placed[i].size():
			mm.set_instance_transform(j, placed[i][j])
		var mi := MultiMeshInstance3D.new()
		mi.multimesh = mm
		mi.material_override = mat
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		g.add_child(mi)
	return g


static func lantern_post(k: Kit, ctx: Ctx, x: float, z: float, yaw: float) -> Vector3:
	var y := Layout.ground_h(x, z)
	k.at(x, y, z, yaw, func() -> void:
		k.add(box(0.4, 0.3, 0.4).hewn(ctx.rand, 0.06), C.stone_dark, v(0, 0.1, 0), Vector3.ZERO, 0.016)
		k.add(box(0.17, 2.5, 0.17), C.timber, v(0, 1.25, 0))
		k.add(box(0.75, 0.13, 0.13), C.timber, v(0.3, 2.38, 0))
		k.add(box(0.08, 0.5, 0.08), C.timber, v(0.18, 2.12, 0), v(0, 0, -0.8))
		k.add(box(0.3, 0.38, 0.3), C.amber, v(0.55, 2.02, 0))
		k.add(box(0.36, 0.06, 0.36), C.timber_dark, v(0.55, 1.82, 0))
		k.add(Geo.cone(0.28, 0.22, 4), C.timber_dark, v(0.55, 2.3, 0), v(0, PI / 4, 0)))
	return Vector3(x, y + 2.4, z)


## sagging string of paper lanterns between two points
static func festoon(k: Kit, a: Vector3, b: Vector3, sag: float) -> void:
	var n := maxi(4, roundi(a.distance_to(b) / 1.1))
	var pts := []
	for i in 17:
		var t := i / 16.0
		var p := a.lerp(b, t)
		p.y = lerpf(a.y, b.y, t) - sag * 4.0 * t * (1.0 - t)
		pts.append(p)
	k.add(Geo.tube(pts, 24, 0.018, 4), C.rope, Vector3.ZERO, Vector3.ZERO, 0.006)
	for i in range(1, n):
		var t := float(i) / n
		var p := a.lerp(b, t)
		p.y = lerpf(a.y, b.y, t) - sag * 4.0 * t * (1.0 - t) - 0.2
		k.add(Geo.sphere(0.13, 8, 6).scale(1, 1.25, 1), C.bloom[0] if i % 3 == 1 else C.amber, p, Vector3.ZERO, 0.01)


## wattle fence run (posts + woven rails), returns its collider
static func fence(k: Kit, ctx: Ctx, ax: float, az: float, bx: float, bz: float) -> Dictionary:
	var length := Vector2(bx - ax, bz - az).length()
	var yaw := atan2(bx - ax, bz - az)
	var n := maxi(2, roundi(length / 1.2))
	for i in n + 1:
		var t := float(i) / n
		var x := ax + (bx - ax) * t
		var z := az + (bz - az) * t
		var rx := (ctx.rand.f() - 0.5) * 0.12
		k.add(cyl(0.06, 0.07, 0.95, 6), C.timber, v(x, Layout.ground_h(x, z) + 0.42, z), v(rx, 0, (ctx.rand.f() - 0.5) * 0.12), 0.012)
	var mx := (ax + bx) / 2.0
	var mz := (az + bz) / 2.0
	var y := Layout.ground_h(mx, mz)
	for yy in [0.32, 0.62]:
		k.add(Geo.box(0.07, 0.16, length, 1, 1, ceili(length)).jitter(0.02, ctx.rand), C.timber_dark, v(mx, y + yy, mz), v(0, yaw, 0), 0.012)
	return {kind = "box", x = mx, z = mz, yaw = yaw, hx = 0.12, hz = length / 2.0, top = y + 0.8}


## two-wheeled hand cart, tipped onto its shafts
static func hand_cart(k: Kit, ctx: Ctx, x: float, z: float, yaw: float) -> void:
	var rand := ctx.rand
	k.at(x, Layout.ground_h(x, z), z, yaw, func() -> void:
		k.add(box(1.2, 0.12, 1.6).hewn(rand, 0.02), C.timber, v(0, 0.62, 0), v(0.12, 0, 0), 0.016)
		for s in [-1, 1]:
			k.add(box(0.08, 0.36, 1.6), C.timber_dark, v(s * 0.6, 0.82, 0), v(0.12, 0, 0))
			k.add(cyl(0.48, 0.48, 0.1, 12, "x"), C.timber, v(s * 0.68, 0.48, 0.1), Vector3.ZERO, 0.016)
			k.add(cyl(0.12, 0.12, 0.14, 8, "x"), C.timber_dark, v(s * 0.7, 0.48, 0.1))
			k.add(box(0.07, 0.07, 1.4), C.timber, v(s * 0.4, 0.3, -1.25), v(-0.3, 0, 0))
		k.add(cyl(0.3, 0.26, 0.6, 9), C.timber, v(0.2, 1.0, 0.25), v(0.12, 0, 0), 0.014)
		k.add(Geo.icosa(0.32, 1).jitter(0.2, rand), C.thatch, v(-0.25, 0.85, -0.3), Vector3.ZERO, 0.014, v(1.2, 0.7, 1)))


## washing line between two crooked poles, a few cloths hanging
static func washing_line(k: Kit, ctx: Ctx, ax: float, az: float, bx: float, bz: float) -> void:
	var a := Vector3(ax, Layout.ground_h(ax, az) + 2.1, az)
	var b := Vector3(bx, Layout.ground_h(bx, bz) + 2.1, bz)
	for p in [a, b]:
		var rx := (ctx.rand.f() - 0.5) * 0.1
		k.add(cyl(0.06, 0.08, 2.2, 6), C.timber, v(p.x, p.y - 1.05, p.z), v(rx, 0, (ctx.rand.f() - 0.5) * 0.1), 0.012)
	var yaw := atan2(b.x - a.x, b.z - a.z)
	var sag := func(t: float) -> Vector3:
		var p := a.lerp(b, t)
		p.y = lerpf(a.y, b.y, t) - 0.3 * 4.0 * t * (1.0 - t)
		return p
	var pts := []
	for i in 9:
		pts.append(sag.call(i / 8.0))
	k.add(Geo.tube(pts, 12, 0.015, 4), C.rope, Vector3.ZERO, Vector3.ZERO, 0.005)
	var ts := [0.2, 0.42, 0.66, 0.84]
	for i in 4:
		var p: Vector3 = sag.call(ts[i])
		var w := 0.5 + (i % 2) * 0.25
		var h := 0.6 + (i % 3) * 0.15
		k.add(Geo.box(0.03, h, w, 1, 3, 3).jitter(0.04, ctx.rand), C.cloth[i % 3], v(p.x, p.y - h / 2.0, p.z), v(0, yaw, (1 if i % 2 else -1) * 0.05), 0.01)


## slow chimney smoke: ink-wash puffs that swell, drift and fade
static func chimney_smoke(ctx: Ctx, x: float, y: float, z: float) -> void:
	var mat := Kit.toon(0xc9bfb2)
	var k := Kit.new()
	k.add_geo(Geo.icosa(0.3, 1).jitter(0.15, ctx.rand), Color(1, 1, 1), 0.0)
	var mesh := k.build_mesh()
	var puffs: Array[MeshInstance3D] = []
	for i in 7:
		var m := MeshInstance3D.new()
		m.mesh = mesh
		m.material_override = mat
		m.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		ctx.add(m)
		puffs.append(m)
	ctx.on_update(func(_dt: float, t: float) -> void:
		for i in puffs.size():
			var life := fmod(t * 0.16 + float(i) / puffs.size(), 1.0)
			var s := sin(PI * minf(1.0, life * 1.4)) * (0.5 + life * 1.3)
			puffs[i].scale = Vector3.ONE * maxf(0.001, s)
			puffs[i].position = Vector3(x + life * 1.6 + sin(t * 0.7 + i) * 0.12, y + life * 3.2, z - life * 0.5))


## lych-gate frame across the hub lane where it leaves for the meadow
static func lane_gate() -> Dictionary:
	var ax := -4.0
	var az := 88.0
	var bx := -3.0
	var bz := 81.0
	var length := Vector2(bx - ax, bz - az).length()
	var dx := (bx - ax) / length
	var dz := (bz - az) / length
	var x := ax + (bx - ax) * 0.8
	var z := az + (bz - az) * 0.8
	var nx := -dz
	var nz := dx
	return {x = x, z = z, y = Layout.ground_h(x, z), yaw = atan2(-nz, nx), nx = nx, nz = nz, dx = dx, dz = dz}


static func build_gate(k: Kit, ctx: Ctx, g: Dictionary) -> void:
	var rand := ctx.rand
	k.at(g.x, g.y, g.z, g.yaw, func() -> void:
		for s in [-1, 1]:
			var geo := box(0.62, 0.5, 0.62).hewn(rand, 0.07)
			k.add(geo, C.stone_field, v(s * GATE_HALF, 0.15, 0), v(0, rand.f(), 0), 0.02)
			k.add(Geo.box(0.3, 2.6, 0.3, 1, 3, 1).jitter(0.02, rand), C.timber, v(s * GATE_HALF, 1.55, 0))
			k.add(box(0.12, 0.7, 0.12), C.timber, v(s * (GATE_HALF - 0.3), 2.25, 0), v(0, 0, s * 0.75))
		k.add(Geo.box(GATE_HALF * 2 + 0.7, 0.24, 0.3, 4, 1, 1).jitter(0.02, rand), C.timber_dark, v(0, 2.48, 0))
		var slope := 0.62
		for sz in [-1, 1]:
			k.add(thatch_course(GATE_HALF * 2 + 1.0, 0.24, 1.25, sz, rand), C.thatch, v(0, 2.95, sz * 0.47), v(sz * slope, 0, 0), 0.02)
		k.add(cyl(0.2, 0.2, GATE_HALF * 2 + 1.1, 10, "x").jitter(0.04, rand), C.thatch_dark, v(0, 3.32, 0), Vector3.ZERO, 0.02)
		k.add(cyl(0.015, 0.015, 0.45, 4), C.rope, v(0, 2.15, 0))
		k.add(box(0.3, 0.38, 0.3), C.amber, v(0, 1.78, 0), v(0, 0.4, 0))
		k.add(Geo.cone(0.26, 0.18, 4), C.timber_dark, v(0, 2.03, 0), v(0, PI / 4 + 0.4, 0))
		k.add(box(0.36, 0.06, 0.36), C.timber_dark, v(0, 1.57, 0), v(0, 0.4, 0))
		k.add(box(0.7, 0.42, 0.08).hewn(rand, 0.03), C.door, v(0, 2.48, 0.19))
		k.add(Geo.extrude(maple_shape(0.16), 0.04), C.amber, v(0, 2.46, 0.23)))


## low dry-stone walls along both sides of the hub lane down to the gate
static func lane_walls(k: Kit, ctx: Ctx, g: Dictionary) -> Array[Dictionary]:
	var rand := ctx.rand
	var out: Array[Dictionary] = []
	var yaw := atan2(g.dx, g.dz)
	for s in [-1, 1]:
		var runs := [[0.3, 2.6], [3.4, 4.6]] if s < 0 else [[0.3, 3.8]]
		for rn in runs:
			var a: float = rn[0]
			var b: float = rn[1]
			var n := roundi((b - a) / 0.5)
			for i in n:
				var t := a + (i + 0.5) / n * (b - a)
				var x: float = g.x + g.nx * s * (GATE_HALF + 0.15) - g.dx * t
				var z: float = g.z + g.nz * s * (GATE_HALF + 0.15) - g.dz * t
				var y := Layout.ground_h(x, z)
				var g1 := box(0.42, 0.22, 0.5).hewn(rand, 0.06)
				k.add(g1, C.stone_field if rand.f() < 0.5 else C.stone_dark, v(x, y + 0.08, z), v(0, yaw + (rand.f() - 0.5) * 0.12, 0), 0.016)
				var g2 := box(0.4, 0.2, 0.46).hewn(rand, 0.06)
				var c2: int = C.stone_dark if rand.f() < 0.5 else C.stone_cool
				var ox := (rand.f() - 0.5) * 0.06
				k.add(g2, c2, v(x + ox, y + 0.29, z + (rand.f() - 0.5) * 0.06), v(0, yaw + 0.25 * (1 if i % 2 else -1), 0), 0.016)
				var g3 := box(0.48, 0.1, 0.52).hewn(rand, 0.04)
				var ry := (rand.f() - 0.5) * 0.1
				k.add(g3, C.stone_cool, v(x, y + 0.45, z), v(0, yaw + ry, (rand.f() - 0.5) * 0.08), 0.014)
			var tm := (a + b) / 2.0
			var cx: float = g.x + g.nx * s * (GATE_HALF + 0.15) - g.dx * tm
			var cz: float = g.z + g.nz * s * (GATE_HALF + 0.15) - g.dz * tm
			out.append({kind = "box", x = cx, z = cz, yaw = yaw, hx = 0.28, hz = (b - a) / 2.0, top = Layout.ground_h(cx, cz) + 0.62})
	return out


## plank store-shed with a lean-to slate roof and a sack pile
static func shed(k: Kit, ctx: Ctx, x: float, z: float, yaw: float) -> Dictionary:
	var rand := ctx.rand
	var y := Layout.ground_h(x, z) - 0.05
	var w := 2.6
	var d := 2.0
	var h_front := 2.1
	var h_back := 1.5
	k.at(x, y, z, yaw, func() -> void:
		k.add(box(w + 0.3, 0.4, d + 0.3).hewn(rand, 0.04), C.stone_dark, v(0, 0.05, 0), Vector3.ZERO, 0.02)
		for i in 7:
			var px := -w / 2.0 + (i + 0.5) * (w / 7.0)
			k.add(box(w / 7.0 - 0.02, h_front, 0.08), C.door if i % 2 else C.timber, v(px, 0.2 + h_front / 2.0, d / 2.0), v(0, 0, (rand.f() - 0.5) * 0.03), 0.012)
			k.add(box(w / 7.0 - 0.02, h_back, 0.08), C.timber if i % 2 else C.door, v(px, 0.2 + h_back / 2.0, -d / 2.0), Vector3.ZERO, 0.012)
		for s in [-1, 1]:
			k.add(box(0.08, (h_front + h_back) / 2.0, d), C.timber, v(s * w / 2.0, 0.2 + (h_front + h_back) / 4.0, 0))
		for s in [-1, 1]:
			for sz in [-1, 1]:
				var hh := h_front if sz > 0 else h_back
				k.add(box(0.16, hh, 0.16), C.timber_dark, v(s * w / 2.0, 0.2 + hh / 2.0, sz * d / 2.0))
		var slope := atan2(h_front - h_back, d)
		k.add(Geo.box(w + 0.6, 0.16, d + 0.8, 3, 1, 3).hewn(rand, 0.015), C.slate, v(0, 0.2 + (h_front + h_back) / 2.0 + 0.1, 0), v(slope, 0, 0), 0.02)
		k.add(box(0.9, 1.5, 0.06), C.timber_dark, v(0.3, 0.95, d / 2.0 + 0.05))
		for i in 3:
			var geo := Geo.icosa(0.3, 1).jitter(0.15, rand)
			k.add(geo, C.cloth[0], v(-w / 2.0 - 0.45 + (i % 2) * 0.3, 0.3 + floori(i / 2.0) * 0.4, d / 2.0 - 0.2 - i * 0.25), v(0, rand.f() * 6.0, 0), 0.014, v(1, 0.75, 1.3)))
	return {kind = "box", x = x, z = z, yaw = yaw, hx = w / 2.0 + 0.25, hz = d / 2.0 + 0.35, top = y + h_front + 0.3}


static func build(ctx: Ctx) -> void:
	var cols := ctx.colliders
	for i in Layout.HOUSES.size():
		var h: Dictionary = Layout.HOUSES[i]
		var k := Kit.new()
		var y0 := cottage(k, ctx, h, i)
		var g := k.build()
		g.name = "cottage-%d" % i
		ctx.add(g)
		ctx.occluder(g)
		cols.append({kind = "box", x = h.x, z = h.z, yaw = 0.0, hx = h.w / 2.0 + 0.45, hz = h.d / 2.0 + 0.45, top = y0 + 0.55 + h.eave + h.rise})
		cols.append({kind = "post", x = h.x - h.w * 0.2 - 1.0, z = h.z + h.d / 2.0 + 0.6, r = 0.36})
		cols.append({kind = "post", x = h.x + h.w * 0.42, z = h.z + h.d / 2.0 + 0.65, r = 0.38})
		if h.chimney:
			cols.append({kind = "post", x = h.x - h.w / 2.0 - 0.35, z = h.z - h.d * 0.18, r = 0.5})
			# only the cottage nearest the waking fox still keeps a fire
			if i == 0:
				chimney_smoke(ctx, h.x - h.w / 2.0 - 0.35, y0 + 0.55 + h.eave + h.rise + 1.6, h.z - h.d * 0.18)

	# each landmark is its own merged group so the chase-cam cutout fades only what blocks
	var group := func(name: String, fn: Callable) -> void:
		var k := Kit.new()
		fn.call(k)
		var g := k.build()
		g.name = name
		ctx.add(g)
		ctx.occluder(g)
	group.call("great-well", func(k: Kit) -> void: great_well(k, ctx))
	cols.append({kind = "post", x = Layout.WELL.x, z = Layout.WELL.y, r = 1.8})

	var gate := lane_gate()
	group.call("lane-gate", func(k: Kit) -> void:
		build_gate(k, ctx, gate)
		cols.append_array(lane_walls(k, ctx, gate)))
	for s in [-1, 1]:
		cols.append({kind = "post", x = gate.x + gate.nx * s * GATE_HALF, z = gate.z + gate.nz * s * GATE_HALF, r = 0.3})

	group.call("village-props", func(props: Kit) -> void:
		fire_pit(props, ctx, -11.5, 93.6)
		var posts := {}
		for pp in [["plaza", -12.0, 86.4, 0.4], ["east", 6.6, 89.4, PI]]:
			posts[pp[0]] = lantern_post(props, ctx, pp[1], pp[2], pp[3])
			cols.append({kind = "post", x = pp[1], z = pp[2], r = 0.2})
		var well_top := Vector3(Layout.WELL.x, Layout.ground_h(Layout.WELL.x, Layout.WELL.y) + 2.75, Layout.WELL.y)
		festoon(props, posts.plaza, well_top, 0.45)
		festoon(props, well_top, Vector3(gate.x - gate.nx * GATE_HALF, gate.y + 2.25, gate.z - gate.nz * GATE_HALF), 0.55)
		# back gardens: a wattle fence ~2 m off the back wall, cabbage rows between
		for fg in [[-21.0, -15.0, 80.4, 82.7], [-31.5, -25.5, 79.8, 82.1], [8.6, 15.4, 90.8, 92.9]]:
			var ax: float = fg[0]
			var bx: float = fg[1]
			var z: float = fg[2]
			var wall_z: float = fg[3]
			cols.append(fence(props, ctx, ax, z, bx, z))
			for row in 2:
				var x := ax + 0.6
				while x < bx - 0.4:
					var zz := z + (wall_z - z) * (0.33 + row * 0.3)
					var r := 0.17 + ctx.rand.f() * 0.06
					var geo := Geo.icosa(r, 1).jitter(0.22, ctx.rand)
					var px := x + (ctx.rand.f() - 0.5) * 0.15
					props.add(geo, C.leaf if row else C.cabbage, v(px, Layout.ground_h(x, zz) + r * 0.55, zz), v(0, ctx.rand.f() * 6.0, 0), 0.01, v(1, 0.8, 1))
					x += 0.62
		hand_cart(props, ctx, -11.2, 81.8, 0.7)
		cols.append({kind = "box", x = -11.2, z = 81.8, yaw = 0.7, hx = 0.75, hz = 1.2, top = Layout.ground_h(-11.2, 81.8) + 0.9})
		for sk in [[-24.6, 89.4, 0.3, 0], [-23.4, 89.9, 1.2, 0], [-24.1, 89.6, 0.8, 1]]:
			var geo := Geo.box(1.0, 0.55, 0.6, 2, 1, 1).hewn(ctx.rand, 0.05)
			props.add(geo, C.thatch, v(sk[0], Layout.ground_h(sk[0], sk[1]) + 0.26 + sk[3] * 0.55, sk[1]), v(0, sk[2], 0), 0.016)
		cols.append({kind = "box", x = -24.0, z = 89.6, yaw = 0.6, hx = 1.1, hz = 0.7, top = Layout.ground_h(-24, 89.6) + 1.1})
		washing_line(props, ctx, -33.5, 91.2, -29.2, 91.8)
		for wp in [[-33.5, 91.2], [-29.2, 91.8]]:
			cols.append({kind = "post", x = wp[0], z = wp[1], r = 0.12}))
	group.call("store-shed", func(k: Kit) -> void: cols.append(shed(k, ctx, 2.4, 87.4, 0.35)))
	ctx.add(flagstones(ctx))
