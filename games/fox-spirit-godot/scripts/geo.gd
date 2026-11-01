class_name Geo
extends RefCounted
## Triangle-soup geometry (positions + normals per corner), the port of the three.js primitives the
## kit relies on. Winding is three's (counter-clockwise front); Kit flips it for Godot when it builds. Segment layouts follow three's BoxGeometry / CylinderGeometry / PolyhedronGeometry
## so `jitter` / `hewn` displace the same lattice and the props keep their silhouettes.

var p := PackedVector3Array()
var n := PackedVector3Array()
## optional per-corner colour (canopy / rock tones); Kit fills flat colour when empty
var c := PackedColorArray()


func copy() -> Geo:
	var g := Geo.new()
	g.p = p.duplicate()
	g.n = n.duplicate()
	g.c = c.duplicate()
	return g


func tri(a: Vector3, b: Vector3, d: Vector3, na := Vector3.ZERO, nb := Vector3.ZERO, nd := Vector3.ZERO) -> void:
	p.append(a)
	p.append(b)
	p.append(d)
	if na == Vector3.ZERO:
		var fn := (b - a).cross(d - a).normalized()
		n.append(fn)
		n.append(fn)
		n.append(fn)
	else:
		n.append(na)
		n.append(nb)
		n.append(nd)


func quad(a: Vector3, b: Vector3, d: Vector3, e: Vector3, na := Vector3.ZERO, nb := Vector3.ZERO, nd := Vector3.ZERO, ne := Vector3.ZERO) -> void:
	# a b / e d (counter-clockwise seen from the front)
	tri(a, b, d, na, nb, nd)
	tri(a, d, e, na, nd, ne)


# --- transforms -------------------------------------------------------------------------------

func xform(t: Transform3D) -> Geo:
	var nb := t.basis.inverse().transposed()
	for i in p.size():
		p[i] = t * p[i]
		n[i] = (nb * n[i]).normalized()
	return self


func translate(x: float, y: float, z: float) -> Geo:
	var o := Vector3(x, y, z)
	for i in p.size():
		p[i] += o
	return self


func rotate_x(a: float) -> Geo:
	return xform(Transform3D(Basis(Vector3.RIGHT, a), Vector3.ZERO))


func rotate_y(a: float) -> Geo:
	return xform(Transform3D(Basis(Vector3.UP, a), Vector3.ZERO))


func rotate_z(a: float) -> Geo:
	return xform(Transform3D(Basis(Vector3.BACK, a), Vector3.ZERO))


func scale(x: float, y: float, z: float) -> Geo:
	return xform(Transform3D(Basis.from_scale(Vector3(x, y, z)), Vector3.ZERO))


func append(o: Geo) -> Geo:
	p.append_array(o.p)
	n.append_array(o.n)
	c.append_array(o.c)
	return self


# --- normals / welding ------------------------------------------------------------------------

static func key(v: Vector3, q: float) -> Vector3i:
	return Vector3i(roundi(v.x / q), roundi(v.y / q), roundi(v.z / q))


## unique-vertex index per corner (positions welded within `q`)
func weld(q: float) -> PackedInt32Array:
	var ids := PackedInt32Array()
	ids.resize(p.size())
	var map := {}
	for i in p.size():
		var k := key(p[i], q)
		var id: int = map.get(k, -1)
		if id < 0:
			id = map.size()
			map[k] = id
		ids[i] = id
	return ids


func flat_normals() -> Geo:
	for i in range(0, p.size(), 3):
		var fn := (p[i + 1] - p[i]).cross(p[i + 2] - p[i]).normalized()
		n[i] = fn
		n[i + 1] = fn
		n[i + 2] = fn
	return self


## area-weighted normals averaged over welded corners
func smooth_normals_of(ids: PackedInt32Array, count: int) -> PackedVector3Array:
	var acc := PackedVector3Array()
	acc.resize(count)
	for i in range(0, p.size(), 3):
		var fn := (p[i + 1] - p[i]).cross(p[i + 2] - p[i])
		acc[ids[i]] += fn
		acc[ids[i + 1]] += fn
		acc[ids[i + 2]] += fn
	var out := PackedVector3Array()
	out.resize(p.size())
	for i in p.size():
		out[i] = acc[ids[i]].normalized()
	return out


func smooth_normals(q := 1e-4) -> Geo:
	var ids := weld(q)
	var count := 0
	for id in ids:
		count = maxi(count, id + 1)
	n = smooth_normals_of(ids, count)
	return self


# --- jitter / hewn ----------------------------------------------------------------------------

## coherent radial jitter on welded positions so faces stay closed (lookdevKit.jitter); smooth normals
func jitter(amount: float, rand: Rng, freq := 1.3) -> Geo:
	var ids := weld(1e-4)
	var count := 0
	for id in ids:
		count = maxi(count, id + 1)
	var moved := PackedVector3Array()
	moved.resize(count)
	var done := PackedByteArray()
	done.resize(count)
	var o := rand.f() * 100.0
	for i in p.size():
		var id := ids[i]
		if done[id] == 0:
			var v := p[i]
			var k := sin(v.x * freq * 3.1 + o) * cos(v.y * freq * 2.7 - o) * sin(v.z * freq * 3.3 + o * 0.5)
			moved[id] = v * (1.0 + k * amount + (rand.f() - 0.5) * amount * 0.6)
			done[id] = 1
		p[i] = moved[id]
	n = smooth_normals_of(ids, count)
	return self


## flat-faced chiselled jitter: hard cel planes
func hewn(rand: Rng, amount := 0.05) -> Geo:
	jitter(amount, rand, 1.1)
	return flat_normals()


# --- primitives -------------------------------------------------------------------------------

static func box(w: float, h: float, d: float, ws := 1, hs := 1, ds := 1) -> Geo:
	var g := Geo.new()
	# each face: grid over (u, v) along two axes, normal along the third
	g._box_face(Vector3(0, 0, 1), Vector3(1, 0, 0), Vector3(0, 1, 0), w, h, d, ws, hs)
	g._box_face(Vector3(0, 0, -1), Vector3(-1, 0, 0), Vector3(0, 1, 0), w, h, d, ws, hs)
	g._box_face(Vector3(1, 0, 0), Vector3(0, 0, -1), Vector3(0, 1, 0), d, h, w, ds, hs)
	g._box_face(Vector3(-1, 0, 0), Vector3(0, 0, 1), Vector3(0, 1, 0), d, h, w, ds, hs)
	g._box_face(Vector3(0, 1, 0), Vector3(1, 0, 0), Vector3(0, 0, -1), w, d, h, ws, ds)
	g._box_face(Vector3(0, -1, 0), Vector3(1, 0, 0), Vector3(0, 0, 1), w, d, h, ws, ds)
	return g


func _box_face(nrm: Vector3, u: Vector3, v: Vector3, uw: float, vh: float, depth: float, us: int, vs: int) -> void:
	var o := nrm * depth * 0.5
	for i in us:
		for j in vs:
			var u0 := -uw * 0.5 + uw * i / us
			var u1 := -uw * 0.5 + uw * (i + 1) / us
			var v0 := -vh * 0.5 + vh * j / vs
			var v1 := -vh * 0.5 + vh * (j + 1) / vs
			quad(o + u * u0 + v * v0, o + u * u1 + v * v0, o + u * u1 + v * v1, o + u * u0 + v * v1, nrm, nrm, nrm, nrm)


## three CylinderGeometry: centred, axis y, radiusTop at +h/2; smooth sides, flat caps
static func cylinder(rt: float, rb: float, h: float, radial := 8, hseg := 1, open := false) -> Geo:
	var g := Geo.new()
	var slope := (rb - rt) / h
	for j in hseg:
		var y0 := -h * 0.5 + h * j / hseg
		var y1 := -h * 0.5 + h * (j + 1) / hseg
		var r0 := lerpf(rb, rt, float(j) / hseg)
		var r1 := lerpf(rb, rt, float(j + 1) / hseg)
		for i in radial:
			var a0 := TAU * i / radial
			var a1 := TAU * (i + 1) / radial
			var d0 := Vector3(sin(a0), 0, cos(a0))
			var d1 := Vector3(sin(a1), 0, cos(a1))
			var n0 := Vector3(d0.x, slope, d0.z).normalized()
			var n1 := Vector3(d1.x, slope, d1.z).normalized()
			g.quad(d0 * r0 + Vector3(0, y0, 0), d1 * r0 + Vector3(0, y0, 0), d1 * r1 + Vector3(0, y1, 0), d0 * r1 + Vector3(0, y1, 0), n0, n1, n1, n0)
	if not open:
		for i in radial:
			var a0 := TAU * i / radial
			var a1 := TAU * (i + 1) / radial
			var d0 := Vector3(sin(a0), 0, cos(a0))
			var d1 := Vector3(sin(a1), 0, cos(a1))
			if rt > 0.0:
				g.tri(Vector3(0, h * 0.5, 0), d0 * rt + Vector3(0, h * 0.5, 0), d1 * rt + Vector3(0, h * 0.5, 0), Vector3.UP, Vector3.UP, Vector3.UP)
			if rb > 0.0:
				g.tri(Vector3(0, -h * 0.5, 0), d1 * rb + Vector3(0, -h * 0.5, 0), d0 * rb + Vector3(0, -h * 0.5, 0), Vector3.DOWN, Vector3.DOWN, Vector3.DOWN)
	return g


## cylinder lying along x / z (village `cyl(…, axis)`)
static func cyl(rt: float, rb: float, h: float, seg := 8, axis := "y") -> Geo:
	var g := cylinder(rt, rb, h, seg)
	if axis == "x":
		g.rotate_z(PI / 2)
	elif axis == "z":
		g.rotate_x(PI / 2)
	return g


static func cone(r: float, h: float, radial := 8) -> Geo:
	return cylinder(0.0, r, h, radial)


static func sphere(r: float, ws := 16, hs := 12) -> Geo:
	var g := Geo.new()
	for j in hs:
		var t0 := PI * j / hs
		var t1 := PI * (j + 1) / hs
		for i in ws:
			var a0 := TAU * i / ws
			var a1 := TAU * (i + 1) / ws
			var v00 := _sph(a0, t0)
			var v10 := _sph(a1, t0)
			var v11 := _sph(a1, t1)
			var v01 := _sph(a0, t1)
			if j > 0:
				g.tri(v00 * r, v01 * r, v10 * r, v00, v01, v10)
			if j < hs - 1:
				g.tri(v10 * r, v01 * r, v11 * r, v10, v01, v11)
	return g


static func _sph(a: float, t: float) -> Vector3:
	return Vector3(-cos(a) * sin(t), cos(t), sin(a) * sin(t))


static func plane_xz(w: float, d: float, ws: int, ds: int) -> Geo:
	var g := Geo.new()
	for i in ws:
		for j in ds:
			var x0 := -w * 0.5 + w * i / ws
			var x1 := -w * 0.5 + w * (i + 1) / ws
			var z0 := -d * 0.5 + d * j / ds
			var z1 := -d * 0.5 + d * (j + 1) / ds
			g.quad(Vector3(x0, 0, z1), Vector3(x1, 0, z1), Vector3(x1, 0, z0), Vector3(x0, 0, z0), Vector3.UP, Vector3.UP, Vector3.UP, Vector3.UP)
	return g


# polyhedra (three PolyhedronGeometry: subdivide each face `detail` times, project to the sphere)
const _T := 1.618033988749895
const _ICO_V := [Vector3(-1, _T, 0), Vector3(1, _T, 0), Vector3(-1, -_T, 0), Vector3(1, -_T, 0), Vector3(0, -1, _T), Vector3(0, 1, _T), Vector3(0, -1, -_T), Vector3(0, 1, -_T), Vector3(_T, 0, -1), Vector3(_T, 0, 1), Vector3(-_T, 0, -1), Vector3(-_T, 0, 1)]
const _ICO_F := [0, 11, 5, 0, 5, 1, 0, 1, 7, 0, 7, 10, 0, 10, 11, 1, 5, 9, 5, 11, 4, 11, 10, 2, 10, 7, 6, 7, 1, 8, 3, 9, 4, 3, 4, 2, 3, 2, 6, 3, 6, 8, 3, 8, 9, 4, 9, 5, 2, 4, 11, 6, 2, 10, 8, 6, 7, 9, 8, 1]
const _R := 0.6180339887498949
const _DOD_V := [Vector3(-1, -1, -1), Vector3(-1, -1, 1), Vector3(-1, 1, -1), Vector3(-1, 1, 1), Vector3(1, -1, -1), Vector3(1, -1, 1), Vector3(1, 1, -1), Vector3(1, 1, 1), Vector3(0, -_R, -_T), Vector3(0, -_R, _T), Vector3(0, _R, -_T), Vector3(0, _R, _T), Vector3(-_R, -_T, 0), Vector3(-_R, _T, 0), Vector3(_R, -_T, 0), Vector3(_R, _T, 0), Vector3(-_T, 0, -_R), Vector3(_T, 0, -_R), Vector3(-_T, 0, _R), Vector3(_T, 0, _R)]
const _DOD_F := [3, 11, 7, 3, 7, 15, 3, 15, 13, 7, 19, 17, 7, 17, 6, 7, 6, 15, 17, 4, 8, 17, 8, 10, 17, 10, 6, 8, 0, 16, 8, 16, 2, 8, 2, 10, 0, 12, 1, 0, 1, 18, 0, 18, 16, 6, 10, 2, 6, 2, 13, 6, 13, 15, 2, 16, 18, 2, 18, 3, 2, 3, 13, 18, 1, 9, 18, 9, 11, 18, 11, 3, 4, 14, 12, 4, 12, 0, 4, 0, 8, 11, 9, 5, 11, 5, 19, 11, 19, 7, 19, 5, 14, 19, 14, 4, 19, 4, 17, 1, 12, 14, 1, 14, 5, 1, 5, 9]
const _OCT_V := [Vector3(1, 0, 0), Vector3(-1, 0, 0), Vector3(0, 1, 0), Vector3(0, -1, 0), Vector3(0, 0, 1), Vector3(0, 0, -1)]
const _OCT_F := [0, 2, 4, 0, 4, 3, 0, 3, 5, 0, 5, 2, 1, 2, 5, 1, 5, 3, 1, 3, 4, 1, 4, 2]


static func _poly(verts: Array, faces: Array, r: float, detail: int) -> Geo:
	var g := Geo.new()
	var cols := detail + 1
	for f in range(0, faces.size(), 3):
		var a: Vector3 = verts[faces[f]]
		var b: Vector3 = verts[faces[f + 1]]
		var d: Vector3 = verts[faces[f + 2]]
		# three's subdivide(): rows from a→d, b→d
		var grid := []
		for i in cols + 1:
			var aj := a.lerp(d, float(i) / cols)
			var bj := b.lerp(d, float(i) / cols)
			var rows := cols - i
			var row := []
			for j in rows + 1:
				row.append(aj if (j == 0 and i == cols) else aj.lerp(bj, float(j) / max(1, rows)))
			grid.append(row)
		for i in cols:
			for j in 2 * (cols - i) - 1:
				var k := floori(j / 2.0)
				var v1: Vector3
				var v2: Vector3
				var v3: Vector3
				if j % 2 == 0:
					v1 = grid[i][k + 1]
					v2 = grid[i + 1][k]
					v3 = grid[i][k]
				else:
					v1 = grid[i][k + 1]
					v2 = grid[i + 1][k + 1]
					v3 = grid[i + 1][k]
				var p1 := v1.normalized() * r
				var p2 := v2.normalized() * r
				var p3 := v3.normalized() * r
				g.tri(p1, p2, p3)
	if detail > 0:
		g.smooth_normals()
	return g


static func icosa(r: float, detail := 0) -> Geo:
	return _poly(_ICO_V, _ICO_F, r, detail)


static func dodeca(r: float, detail := 0) -> Geo:
	return _poly(_DOD_V, _DOD_F, r, detail)


static func octa(r: float, detail := 0) -> Geo:
	return _poly(_OCT_V, _OCT_F, r, detail)


## flat shape in the xy plane facing +z (three ShapeGeometry); `holes` cut from it
static func shape(outline: PackedVector2Array, holes: Array = []) -> Geo:
	var g := Geo.new()
	var pts := outline
	if not holes.is_empty():
		pts = _bridge(outline, holes)
	var idx := Geometry2D.triangulate_polygon(pts)
	if idx.is_empty():
		idx = Geometry2D.triangulate_polygon(_reversed(pts))
		pts = _reversed(pts)
	for i in range(0, idx.size(), 3):
		var a := pts[idx[i]]
		var b := pts[idx[i + 1]]
		var d := pts[idx[i + 2]]
		var va := Vector3(a.x, a.y, 0)
		var vb := Vector3(b.x, b.y, 0)
		var vd := Vector3(d.x, d.y, 0)
		if (vb - va).cross(vd - va).z < 0.0:
			g.tri(va, vd, vb, Vector3.BACK, Vector3.BACK, Vector3.BACK)
		else:
			g.tri(va, vb, vd, Vector3.BACK, Vector3.BACK, Vector3.BACK)
	return g


## > 0 for counter-clockwise (y up)
static func signed_area(a: PackedVector2Array) -> float:
	var s := 0.0
	for i in a.size():
		var u := a[i]
		var v := a[(i + 1) % a.size()]
		s += u.x * v.y - v.x * u.y
	return s * 0.5


static func _reversed(a: PackedVector2Array) -> PackedVector2Array:
	var o := a.duplicate()
	o.reverse()
	return o


## ring shape with one hole: bridge outline ↔ hole into a single simple polygon
static func _bridge(outline: PackedVector2Array, holes: Array) -> PackedVector2Array:
	var hole: PackedVector2Array = holes[0]
	var o := outline.duplicate()
	if signed_area(o) < 0.0:
		o.reverse()
	var h := hole.duplicate()
	if signed_area(h) > 0.0:
		h.reverse()
	# closest pair
	var bi := 0
	var bj := 0
	var bd := INF
	for i in o.size():
		for j in h.size():
			var d := o[i].distance_squared_to(h[j])
			if d < bd:
				bd = d
				bi = i
				bj = j
	var out := PackedVector2Array()
	for i in o.size() + 1:
		out.append(o[(bi + i) % o.size()])
	for j in h.size() + 1:
		out.append(h[(bj + j) % h.size()])
	return out


## three ExtrudeGeometry (no bevel): shape in xy, extruded along +z over [0, depth]
static func extrude(outline: PackedVector2Array, depth: float) -> Geo:
	var g := Geo.new()
	var o := outline
	if signed_area(o) < 0.0:
		o = _reversed(o)
	var front := shape(o)
	var back := front.copy()
	front.translate(0, 0, depth)
	# back face: flip winding
	for i in range(0, back.p.size(), 3):
		g.tri(back.p[i], back.p[i + 2], back.p[i + 1], Vector3.FORWARD, Vector3.FORWARD, Vector3.FORWARD)
	g.append(front)
	for i in o.size():
		var a := o[i]
		var b := o[(i + 1) % o.size()]
		var e := Vector3(b.x - a.x, b.y - a.y, 0)
		var nrm := Vector3(e.y, -e.x, 0).normalized()
		g.quad(Vector3(a.x, a.y, 0), Vector3(b.x, b.y, 0), Vector3(b.x, b.y, depth), Vector3(a.x, a.y, depth), nrm, nrm, nrm, nrm)
	return g


## capped tube along a polyline curve with radius(t) profile (lookdevKit.plumeGeometry, lobes = 0)
static func plume(curve: Array, radius: Callable, rings := 20, sides := 9) -> Geo:
	var g := Geo.new()
	var pts := CatmullRom.samples(curve, rings)
	# parallel-transport frames
	var tangents: Array[Vector3] = []
	for i in rings + 1:
		var a := pts[maxi(0, i - 1)]
		var b := pts[mini(rings, i + 1)]
		tangents.append((b - a).normalized())
	var nrm := tangents[0].cross(Vector3.UP if absf(tangents[0].y) < 0.9 else Vector3.RIGHT).normalized()
	var ring_pts := []
	for i in rings + 1:
		if i > 0:
			var axis := tangents[i - 1].cross(tangents[i])
			if axis.length() > 1e-6:
				nrm = nrm.rotated(axis.normalized(), tangents[i - 1].angle_to(tangents[i]))
		var bin := tangents[i].cross(nrm).normalized()
		var r: float = radius.call(float(i) / rings)
		var ring := []
		for j in sides:
			var a := TAU * j / sides
			var dir := nrm * cos(a) + bin * sin(a)
			ring.append([pts[i] + dir * r, dir])
		ring_pts.append(ring)
	for i in rings:
		for j in sides:
			var jn := (j + 1) % sides
			var a: Array = ring_pts[i][j]
			var b: Array = ring_pts[i][jn]
			var d: Array = ring_pts[i + 1][jn]
			var e: Array = ring_pts[i + 1][j]
			g.tri(a[0], b[0], d[0], a[1], b[1], d[1])
			g.tri(a[0], d[0], e[0], a[1], d[1], e[1])
	for j in sides:
		var jn := (j + 1) % sides
		g.tri(pts[0], ring_pts[0][jn][0], ring_pts[0][j][0])
		g.tri(pts[rings], ring_pts[rings][j][0], ring_pts[rings][jn][0])
	return g


## thin rope / tube through points (three TubeGeometry on a CatmullRom curve)
static func tube(points: Array, segments: int, r: float, radial := 4) -> Geo:
	return plume(points, func(_t: float) -> float: return r, segments, radial)
