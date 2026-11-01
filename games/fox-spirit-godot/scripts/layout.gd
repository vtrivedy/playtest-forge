class_name Layout
extends RefCounted
## Opening slice layout (opening/layout.ts): Lanternhollow + Arrival Meadow at the old Russetvale
## coordinates. Every module places from here. three.js and Godot share axes (y up, right-handed).

## wake spot by the plaza, facing down the hub lane toward the meadow (−3, 81)
const SPAWN := {x = -5.2, z = 92.5, yaw = 2.9524}  # atan2(2.2, -11.5)
const WELL := Vector2(-8, 85)
## H-a: cold hearth at the foot of the meadow shelf
const HEARTH_A := {x = 5.6, z = 74.2, r = 0.82, top = 1.0}
## rock shelf the H-a updraft lifts onto: 9 × 9, top = ground + 5
const SHELF := {x = 13.0, z = 75.5, w = 9.0, d = 9.0, yaw = 0.12, rise = 5.0}

## cottages (all face +z: door on the z + d/2 wall)
const HOUSES := [
	{x = -18.0, z = 92.0, w = 5.2, d = 4.2, eave = 2.6, rise = 1.4, chimney = true},
	{x = -28.5, z = 84.4, w = 5.6, d = 4.6, eave = 2.8, rise = 2.1, chimney = false},
	{x = 12.0, z = 95.0, w = 5.2, d = 4.2, eave = 2.6, rise = 1.4, chimney = true},
	{x = -18.0, z = 84.6, w = 4.2, d = 3.8, eave = 2.3, rise = 1.2, chimney = false},
	{x = -9.0, z = 99.6, w = 4.4, d = 3.6, eave = 2.3, rise = 1.25, chimney = false},
	{x = -37.0, z = 86.0, w = 5.0, d = 4.0, eave = 2.5, rise = 1.45, chimney = false},
]

## lanes [ax, az, bx, bz]; the last ones lead the opening route out to H-a
const PATHS := [
	[-18, 95, -14, 95], [-14, 95, -12.5, 89.5], [-12.5, 89.5, -8, 88], [-29.2, 87.5, -24, 88.3], [-24, 88.3, -18.7, 87.2],
	[-18.7, 87.2, -14, 87.8], [-14, 87.8, -12.5, 89.5], [-9.7, 102.3, -5.7, 102.3], [-5.7, 102.3, -5, 100.5], [-5, 100.5, 0, 94],
	[-37.7, 88.7, -34, 90], [-34, 90, -32, 88.5], [-32, 88.5, -29.2, 87.5], [-8, 88, -4, 88], [-4, 88, -3, 81], [-3, 81, 0, 80],
	[12, 98, 8, 99], [8, 99, 0, 94], [0, 80, 9, 88], [9, 88, 25, 88],
	[-6, 92, -7.2, 87], [0, 80, 4.2, 75.6], [0, 80, -3, 62],
]

## play area (ellipse); the ground climbs into a cliffed rim outside it
const BOUNDS := {cx = -4.0, cz = 83.0, rx = 40.0, rz = 25.0}


static func sstep(x: float, e0: float, e1: float) -> float:
	var t := clampf((x - e0) / (e1 - e0), 0.0, 1.0)
	return t * t * (3.0 - 2.0 * t)


static func path_dist(x: float, z: float) -> float:
	# plaza around the well
	var d := maxf(0.0, Vector2(x - WELL.x, z - WELL.y).length() - 3.2)
	for s in PATHS:
		var ax: float = s[0]
		var az: float = s[1]
		var dx: float = s[2] - ax
		var dz: float = s[3] - az
		var t := clampf(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0.0, 1.0)
		d = minf(d, Vector2(x - ax - t * dx, z - az - t * dz).length())
	return d


## 0 inside the play ellipse, rising past 1 at the rim
static func rim_k(x: float, z: float) -> float:
	return Vector2((x - BOUNDS.cx) / BOUNDS.rx, (z - BOUNDS.cz) / BOUNDS.rz).length()


## base terrain (no props): gentle swells, flattened lanes and house pads, cliffed rim
static func ground_h(x: float, z: float) -> float:
	var swell := sin(x * 0.11) * cos(z * 0.09) * 0.7 + sin(x * 0.31 + z * 0.17) * 0.18
	var flat := sstep(path_dist(x, z), 1.2, 5.0)
	for h in HOUSES:
		var k := maxf(absf(x - h.x) - h.w / 2.0, absf(z - h.z) - h.d / 2.0)
		flat = minf(flat, sstep(k, 0.8, 4.0))
	# the meadow dips gently south of the village toward the shelf
	var meadow := -0.6 * (1.0 - sstep(z, 70.0, 84.0))
	var r := rim_k(x, z)
	var rim := sstep(r, 0.92, 1.08) * 7.0 + maxf(0.0, r - 1.08) * 14.0
	return swell * flat * 0.8 + meadow + rim
