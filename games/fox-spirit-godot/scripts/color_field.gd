class_name ColorField
extends Node
## World-space colour restoration (src/render/colorField.ts, as tuned by opening/paint.ts):
##  (a) aura around the fox, (b) decaying trail ring buffer, (c) permanent restore regions with a
## painterly front. sample() is the gameplay supply probe; the trail mask is a SubViewport the world
## shader samples through the `trail_map` global.

var fox := Vector3.ZERO
var aura_radius := 2.2
var trail_radius := 1.5
var trail_life := 10.0
var trail_max := 96
var trail_deposit_interval := 0.11
## {x, y, z, life}
var trail: Array[Dictionary] = []
## {center, target_radius, radius, duration, age, edge_max}
var restores: Array[Dictionary] = []
var bounds := Rect2(-60, 40, 110, 85)  # x = minX, y = minZ
var distance := 0.0
var _accum := 0.0
var _prev: Variant = null
var _viewport: SubViewport
var _rect_mat: ShaderMaterial


func _ready() -> void:
	_viewport = SubViewport.new()
	_viewport.size = Vector2i(512, 512)
	_viewport.disable_3d = true
	_viewport.transparent_bg = false
	_viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	add_child(_viewport)
	var rect := ColorRect.new()
	rect.size = Vector2(512, 512)
	_rect_mat = ShaderMaterial.new()
	_rect_mat.shader = preload("res://shaders/paint_mask.gdshader")
	_rect_mat.set_shader_parameter("bounds", Vector4(bounds.position.x, bounds.position.y, bounds.size.x, bounds.size.y))
	rect.material = _rect_mat
	_viewport.add_child(rect)
	RenderingServer.global_shader_parameter_set("trail_map", _viewport.get_texture())
	RenderingServer.global_shader_parameter_set("trail_bounds", Vector4(bounds.position.x, bounds.position.y, bounds.size.x, bounds.size.y))
	RenderingServer.global_shader_parameter_set("trail_on", 1.0)


## permanently restore a region with an ease-out expanding wavefront
func restore(center: Vector3, radius: float, duration := 2.2, edge_max := INF) -> void:
	restores.append({center = center, target_radius = radius, radius = 0.0, duration = maxf(0.2, duration), age = 0.0, edge_max = edge_max})


static func edge_of(r: Dictionary) -> float:
	return minf(r.radius * 0.18, r.edge_max)


## once per step, after the fox moves
func step(dt: float, position: Vector3) -> void:
	if _prev != null:
		var d: float = (_prev as Vector3).distance_to(position)
		if d < 5.0:
			distance += d
		else:
			trail.clear()  # teleports are not paint travel
	_prev = position
	fox = position
	_accum += dt
	for t in trail:
		t.life -= dt
	trail = trail.filter(func(t: Dictionary) -> bool: return t.life > 0.0)
	if _accum >= trail_deposit_interval:
		_accum = 0.0
		trail.append({x = fox.x, y = fox.y, z = fox.z, life = trail_life})
		if trail.size() > trail_max:
			trail.pop_front()
	for r in restores:
		r.age += dt
		var t := minf(1.0, r.age / r.duration)
		r.radius = r.target_radius * (1.0 - pow(1.0 - t, 3.0))
	_render_mask()
	_sync_restores()


## saturation 0..1 at a world point (gameplay probes)
func sample(p: Vector3) -> float:
	var s := 0.0
	for r in restores:
		var d := Vector2(p.x - r.center.x, p.z - r.center.z).length()
		var e := edge_of(r) * 0.66
		s = maxf(s, 1.0 - Layout.sstep(d, r.radius - e, r.radius + e))
	var aura := 1.0 - minf(1.0, p.distance_to(fox) / aura_radius)
	s = maxf(s, pow(maxf(0.0, aura), 1.15))
	for t in trail:
		var d := Vector3(p.x - t.x, p.y - t.y, p.z - t.z).length()
		s = maxf(s, (1.0 - minf(1.0, d / trail_radius)) * (t.life / trail_life))
	return clampf(s, 0.0, 1.0)


## the fox's colour reaches the ground only near it: a high glide leaves no painted band
func _near(x: float, y: float, z: float) -> float:
	return 1.0 - Layout.sstep(y - Layout.ground_h(x, z), 0.8, 3.2)


func _render_mask() -> void:
	var stamps := PackedVector4Array()
	var shape := PackedVector2Array()
	var fk := _near(fox.x, fox.y, fox.z)
	if fk > 0.01:
		stamps.append(Vector4(fox.x, fox.z, aura_radius * 2.0 * (0.7 + 0.3 * fk), 0.95 * fk))
		shape.append(Vector2(0.12, 0.4))
	for t in trail:
		var k := _near(t.x, t.y, t.z)
		if k < 0.01:
			continue
		stamps.append(Vector4(t.x, t.z, trail_radius * 2.0, 0.7 * (t.life / trail_life) * k))
		shape.append(Vector2(0.2, 0.3))
	var n := mini(stamps.size(), 128)
	stamps.resize(128)
	shape.resize(128)
	_rect_mat.set_shader_parameter("count", n)
	_rect_mat.set_shader_parameter("stamps", stamps)
	_rect_mat.set_shader_parameter("shape", shape)


func _sync_restores() -> void:
	var n := mini(4, restores.size())
	RenderingServer.global_shader_parameter_set("paint_restore_count", n)
	for i in n:
		var r: Dictionary = restores[i]
		RenderingServer.global_shader_parameter_set("paint_restore_%d" % i, Vector4(r.center.x, r.center.z, r.radius, maxf(0.3, minf(r.edge_max, r.radius * 0.18))))


## world grade follows how much of the slice the fox has painted (0..1)
func paint_k() -> float:
	var a := 0.0
	for r in restores:
		a += r.radius * r.radius
	return minf(1.0, a / 260.0)


func state() -> Dictionary:
	return {trail_samples = trail.size(), supply = snappedf(sample(fox), 0.001), distance = snappedf(distance, 0.01), restores = restores.size()}
