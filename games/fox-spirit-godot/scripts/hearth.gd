class_name Hearth
extends Node3D
## H-a cold hearth (opening/hearth.ts + chem/reactor.ts + chem/updraft.ts): a Reactor reads paint
## supply at five probes, warms over igniteTime, holds, gutters; once lit in the opening it stays
## restored. While hot it raises an ember updraft column a gliding fox rides to the shelf.

signal ignited(at: Vector3)

## Height of the ash bed above the hearth's ground point — the column starts here
const BED_Y := 0.92

var tun := {
	threshold = 0.3, ignite_time = 0.25, hold_time = 3.0, gutter_time = 0.8,
	radius = 2.2, top_falloff = 2.0, max_rise = 6.5, lift_response = 4.0,
	column_steer = 0.65, center_pull = 1.5, fall_lift = 0.35, probe_ring = 0.9,
}
var id := "H-a"
var base := Vector3.ZERO
var column_height := 9.0
var probes: Array[Vector3] = []
# reactor
var heat := 0.0
var reactor_state := "cold"
var restored := false
var hold_left := 0.0
var supply := 0.0
var flare := 0.0
# opening teach
var latched := false
var ignition := ""
var complete := false
var last_ride := {}
var _ride := {}
var _ride_t := 0.0

var _ash: StandardMaterial3D
var _light: OmniLight3D
var _embers: CPUParticles3D
var _leaves: CPUParticles3D
var _flames: Array[ShaderMaterial] = []
var _flame_meshes: Array[MeshInstance3D] = []
var _smoke: MeshInstance3D
var _air: ShaderMaterial


func setup(ground_y: float) -> void:
	position = Vector3(Layout.HEARTH_A.x, ground_y, Layout.HEARTH_A.z)
	base = position + Vector3(0, BED_Y, 0)
	probes = [position + Vector3(0, 0.7, 0)]
	for i in 4:
		var a := i / 4.0 * TAU + 0.4
		probes.append(position + Vector3(cos(a) * tun.probe_ring, 0.7, sin(a) * tun.probe_ring))
	# ash bed: grey, ember cracks wake with heat
	var bed := MeshInstance3D.new()
	var disc := CylinderMesh.new()
	disc.top_radius = 0.68
	disc.bottom_radius = 0.68
	disc.height = 0.04
	bed.mesh = disc
	_ash = StandardMaterial3D.new()
	_ash.albedo_color = Color(0.32, 0.3, 0.29)
	_ash.emission_enabled = true
	_ash.emission = Color(1.0, 0.42, 0.12)
	_ash.emission_energy_multiplier = 0.04
	bed.material_override = _ash
	bed.position.y = BED_Y
	add_child(bed)
	# the held breath: a frozen ink curl over the cold bowl, dissolving upward as it lights
	_smoke = MeshInstance3D.new()
	var k := Kit.new()
	var curl := []
	for i in 13:
		var t := i / 12.0
		curl.append(Vector3(sin(t * 5.0) * 0.25 * t, t * 1.6, cos(t * 5.0) * 0.25 * t))
	k.add_geo(Geo.plume(curl, func(t: float) -> float: return 0.07 * (1.0 - t) + 0.02, 24, 6), Color(1, 1, 1), 0.0)
	_smoke.mesh = k.build_mesh()
	var sm := StandardMaterial3D.new()
	sm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	sm.albedo_color = Color(0.141, 0.086, 0.055, 0.32)
	sm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	_smoke.material_override = sm
	_smoke.position.y = BED_Y
	_smoke.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(_smoke)
	# cel flame tongues in the bowl
	var quad := QuadMesh.new()
	for f in [[0.0, 0.0, 0.9, 0.55, 0.1], [0.28, 0.12, 0.6, 0.4, 0.5], [-0.25, -0.15, 0.7, 0.42, 0.8], [0.05, -0.3, 0.5, 0.35, 0.3], [-0.2, 0.25, 0.55, 0.36, 0.65]]:
		var m := MeshInstance3D.new()
		m.mesh = quad
		var mat := ShaderMaterial.new()
		mat.shader = preload("res://shaders/fox_flame.gdshader")
		mat.set_shader_parameter("size", Vector2(f[3], f[2]))
		mat.set_shader_parameter("seed", f[4])
		m.material_override = mat
		m.position = Vector3(f[0], BED_Y - 0.05, f[1])
		m.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		m.extra_cull_margin = 3.0
		m.visible = false
		add_child(m)
		_flames.append(mat)
		_flame_meshes.append(m)
	# rising embers up the column
	_embers = CPUParticles3D.new()
	_embers.amount = 90
	_embers.lifetime = 2.6
	_embers.emitting = false
	_embers.local_coords = false
	_embers.mesh = FoxVisual._spark_mesh(0.06)
	_embers.emission_shape = CPUParticles3D.EMISSION_SHAPE_SPHERE
	_embers.emission_sphere_radius = 0.6
	_embers.direction = Vector3.UP
	_embers.spread = 8.0
	_embers.initial_velocity_min = 2.4
	_embers.initial_velocity_max = 3.8
	_embers.gravity = Vector3.ZERO
	_embers.tangential_accel_min = -0.6
	_embers.tangential_accel_max = 0.6
	_embers.color_ramp = FoxVisual._ember_ramp()
	_embers.position.y = BED_Y
	add_child(_embers)
	# rust leaves lifted and turned over by the warm air (they keep their body colour, unlike embers)
	_leaves = CPUParticles3D.new()
	_leaves.amount = 16
	_leaves.lifetime = 3.4
	_leaves.emitting = false
	_leaves.local_coords = false
	var leaf := Kit.new()
	leaf.add_geo(Props.maple_leaf_geometry(0.11).rotate_x(PI / 2.0), Color(1, 1, 1), 0.0)
	_leaves.mesh = leaf.build_mesh()
	_leaves.material_override = Props.leaf_cards_material(0.0)
	_leaves.material_override.set_shader_parameter("leaf_card", false)
	_leaves.emission_shape = CPUParticles3D.EMISSION_SHAPE_SPHERE
	_leaves.emission_sphere_radius = 0.9
	_leaves.direction = Vector3.UP
	_leaves.spread = 20.0
	_leaves.initial_velocity_min = 1.4
	_leaves.initial_velocity_max = 2.4
	_leaves.gravity = Vector3(0, -0.2, 0)
	_leaves.tangential_accel_min = 0.6
	_leaves.tangential_accel_max = 1.4
	_leaves.angular_velocity_min = -180.0
	_leaves.angular_velocity_max = 180.0
	_leaves.particle_flag_rotate_y = true
	_leaves.scale_amount_min = 0.8
	_leaves.scale_amount_max = 1.2
	var tones := Gradient.new()
	tones.set_color(0, Kit.lin(0xa4603e))
	tones.set_color(1, Kit.lin(0xa88550))
	_leaves.color_initial_ramp = tones
	_leaves.position.y = BED_Y
	add_child(_leaves)
	# warm air: soft parcels rising through the column (a body of air, never a tube)
	var air := MeshInstance3D.new()
	var arrays := []
	arrays.resize(Mesh.ARRAY_MAX)
	var pos := PackedVector3Array()
	var uv := PackedVector2Array()
	var seeds := PackedFloat32Array()
	var rnd := Rng.new(7)
	for i in 28:
		var seed := [rnd.f(), rnd.f(), rnd.f(), rnd.f()]
		for c in [[-1, -1], [1, 1], [1, -1], [-1, -1], [-1, 1], [1, 1]]:
			pos.append(Vector3(c[0], c[1], 0))
			uv.append(Vector2(c[0] * 0.5 + 0.5, 0.5 - c[1] * 0.5))
			seeds.append_array(seed)
	arrays[Mesh.ARRAY_VERTEX] = pos
	arrays[Mesh.ARRAY_TEX_UV] = uv
	arrays[Mesh.ARRAY_CUSTOM0] = seeds
	var am := ArrayMesh.new()
	am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays, [], {}, Mesh.ARRAY_CUSTOM_RGBA_FLOAT << Mesh.ARRAY_FORMAT_CUSTOM0_SHIFT)
	air.mesh = am
	_air = ShaderMaterial.new()
	_air.shader = preload("res://shaders/hearth_air.gdshader")
	_air.set_shader_parameter("height", column_height)
	_air.set_shader_parameter("radius", tun.radius * 0.85)
	air.material_override = _air
	air.position.y = BED_Y
	air.extra_cull_margin = 12.0
	air.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(air)
	_light = OmniLight3D.new()
	_light.light_color = Color(1.0, 0.54, 0.23)
	_light.light_energy = 0.0
	_light.omni_range = 11.0
	_light.position.y = BED_Y + 1.2
	add_child(_light)


## supply: max paint (aura / trail / restore) at a probe; dashing widens the fox aura
func update(dt: float, t: float, supply_at: Callable, fox_pos: Vector3, dashing: bool) -> void:
	var aura_fn := func(p: Vector3) -> float:
		var d := Vector2(p.x - fox_pos.x, p.z - fox_pos.z).length()
		var aura := 1.0 - Layout.sstep(d, 2.0 if dashing else 1.5, 3.2 if dashing else 2.5)
		return maxf(aura, supply_at.call(p))
	_react(dt, aura_fn, dashing)
	flare = maxf(0.0, flare - dt * 1.6)
	var gutter := 0.55 + 0.45 * sin(t * 31.0) * sin(t * 17.3) if reactor_state == "guttering" else 1.0
	var vis := heat * gutter
	_ash.emission_energy_multiplier = 0.04 + vis * 2.6 + flare * 2.0
	_light.light_energy = (vis * 1.3 + flare * 1.5) * (0.92 + 0.08 * sin(t * 13.7))
	_embers.emitting = vis > 0.05
	_leaves.emitting = vis > 0.05
	_embers.speed_scale = 0.6 + 0.6 * minf(1.4, vis * 1.1 + flare * 0.7)
	for m in _flames:
		m.set_shader_parameter("time", t)
	_air.set_shader_parameter("time", t)
	_air.set_shader_parameter("heat", minf(1.35, vis * 1.15 + flare * 0.65))
	for m in _flame_meshes:
		m.visible = vis > 0.05
		m.scale = Vector3.ONE * clampf(vis + flare * 0.8, 0.2, 1.4)
	var sm := _smoke.material_override as StandardMaterial3D
	sm.albedo_color.a = 0.32 * (1.0 - minf(1.0, heat * 1.6))
	_smoke.visible = sm.albedo_color.a > 0.01
	_smoke.position.y = BED_Y + heat * 1.4
	_smoke.scale = Vector3.ONE * (1.0 + heat * 0.5)
	if not last_ride.is_empty() and last_ride.land_feet_y != null and last_ride.land_feet_y > last_ride.base_y + 2.0:
		complete = true


func _react(dt: float, supply_at: Callable, dashing: bool) -> void:
	if restored:
		heat = 1.0
		reactor_state = "restored"
		return
	var s := 0.0
	for p in probes:
		s = maxf(s, supply_at.call(p))
	supply = s
	if s >= tun.threshold:
		if reactor_state == "cold":
			flare = 1.0
			latched = true
			ignition = "dash" if dashing else "aura"
			# the first teach stays lit for the session (no glide soft-lock)
			restored = true
			ignited.emit(base)
		heat = minf(1.0, heat + dt / tun.ignite_time) if tun.ignite_time > 0.0 else 1.0
		hold_left = tun.hold_time
		reactor_state = "burning"
		return
	if reactor_state == "cold":
		return
	if hold_left > 0.0:
		hold_left -= dt
		reactor_state = "holding"
		return
	heat = maxf(0.0, heat - dt / tun.gutter_time)
	reactor_state = "guttering" if heat > 0.0 else "cold"


## lift factor at the fox's feet: heat × radialK × topK
func lift_at(x: float, feet_y: float, z: float) -> Dictionary:
	var out := {k = 0.0, radial_k = 0.0, ax = base.x, az = base.z}
	if heat <= 0.0:
		return out
	var dy := feet_y - base.y
	if dy < -0.6 or dy > column_height:
		return out
	var d := Vector2(x - base.x, z - base.z).length()
	var radial_k := 1.0 - Layout.sstep(d, tun.radius * 0.6, tun.radius + 0.5)
	if radial_k <= 0.0:
		return out
	var top_k := 1.0 - Layout.sstep(dy, column_height - minf(tun.top_falloff, column_height), column_height)
	out.k = heat * radial_k * top_k
	out.radial_k = radial_k
	return out


## per-step ride bookkeeping (ride log for acceptance)
func track_ride(dt: float, feet_y: float, vy: float, grounded: bool, lift: Dictionary) -> void:
	if _ride.is_empty() and not grounded and lift.k > 0.05:
		_ride = {hearth = id, entry_feet_y = snappedf(feet_y, 0.01), entry_vy = snappedf(vy, 0.01), base_y = snappedf(base.y, 0.01), time_in_column = 0.0, t_plus7 = -1.0, peak_feet_y = feet_y, land_feet_y = null}
		_ride_t = 0.0
		last_ride = _ride
	if _ride.is_empty():
		return
	_ride_t += dt
	if lift.k > 0.05:
		_ride.time_in_column += dt
	if _ride.t_plus7 < 0.0 and feet_y >= _ride.base_y + 7.0:
		_ride.t_plus7 = _ride_t
	_ride.peak_feet_y = maxf(_ride.peak_feet_y, feet_y)
	if grounded and _ride_t > 0.1:
		_ride.land_feet_y = snappedf(feet_y, 0.01)
		_ride = {}


func state() -> Dictionary:
	return {id = id, heat = snappedf(heat, 0.001), state = reactor_state, supply = snappedf(supply, 0.001), restored = restored, latched = latched, ignition = ignition, complete = complete, last_ride = last_ride}
