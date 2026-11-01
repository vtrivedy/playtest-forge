class_name CatmullRom
extends RefCounted
## three CatmullRomCurve3 (centripetal, open) sampled by arc length like getPointAt()

static func _point(pts: Array, t: float) -> Vector3:
	var l := pts.size()
	var pt := (l - 1) * t
	var i := floori(pt)
	var w := pt - i
	if i >= l - 1:
		i = l - 2
		w = 1.0
	var p0: Vector3 = pts[i - 1] if i > 0 else (pts[0] as Vector3) * 2.0 - (pts[1] as Vector3)
	var p1: Vector3 = pts[i]
	var p2: Vector3 = pts[i + 1]
	var p3: Vector3 = pts[i + 2] if i + 2 < l else (pts[l - 1] as Vector3) * 2.0 - (pts[l - 2] as Vector3)
	var dt0 := pow(p0.distance_squared_to(p1), 0.25)
	var dt1 := pow(p1.distance_squared_to(p2), 0.25)
	var dt2 := pow(p2.distance_squared_to(p3), 0.25)
	if dt1 < 1e-4: dt1 = 1.0
	if dt0 < 1e-4: dt0 = dt1
	if dt2 < 1e-4: dt2 = dt1
	var out := Vector3()
	for k in 3:
		var x0 := p0[k]
		var x1 := p1[k]
		var x2 := p2[k]
		var x3 := p3[k]
		var t1 := ((x1 - x0) / dt0 - (x2 - x0) / (dt0 + dt1) + (x2 - x1) / dt1) * dt1
		var t2 := ((x2 - x1) / dt1 - (x3 - x1) / (dt1 + dt2) + (x3 - x2) / dt2) * dt1
		var c2 := -3 * x1 + 3 * x2 - 2 * t1 - t2
		var c3 := 2 * x1 - 2 * x2 + t1 + t2
		out[k] = x1 + t1 * w + c2 * w * w + c3 * w * w * w
	return out


## arc-length parameterised point (u in 0..1)
static func point_at(pts: Array, u: float) -> Vector3:
	var n := 200
	var lens := PackedFloat32Array([0.0])
	var prev := _point(pts, 0.0)
	for i in range(1, n + 1):
		var q := _point(pts, float(i) / n)
		lens.append(lens[i - 1] + prev.distance_to(q))
		prev = q
	var target := u * lens[n]
	var lo := 0
	var hi := n
	while lo < hi - 1:
		var mid := (lo + hi) / 2
		if lens[mid] < target: lo = mid
		else: hi = mid
	var seg := lens[hi] - lens[lo]
	var t := (lo + ((target - lens[lo]) / seg if seg > 0.0 else 0.0)) / n
	return _point(pts, t)


## count + 1 arc-length-even points (one length table for the whole sweep)
static func samples(pts: Array, count: int) -> Array[Vector3]:
	var n := 200
	var raw: Array[Vector3] = [_point(pts, 0.0)]
	var lens := PackedFloat32Array([0.0])
	for i in range(1, n + 1):
		raw.append(_point(pts, float(i) / n))
		lens.append(lens[i - 1] + raw[i - 1].distance_to(raw[i]))
	var out: Array[Vector3] = []
	var j := 0
	for k in count + 1:
		var target := lens[n] * k / count
		while j < n - 1 and lens[j + 1] < target:
			j += 1
		var seg := lens[j + 1] - lens[j]
		var w := clampf((target - lens[j]) / seg, 0.0, 1.0) if seg > 0.0 else 0.0
		out.append(_point(pts, (j + w) / n))
	return out
