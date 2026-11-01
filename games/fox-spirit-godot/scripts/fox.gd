class_name FoxVisual
extends Node3D
## Hearth-fox "Emberkit" (lookdevFox.ts): the authored GLB (walk / trot / lope / run / jumpUp / fall /
## land, in place; glTF extras carry each clip's ground speed) under a native AnimationTree.
## Look: cel coat + skinned ink hull (next_pass), tail flame tongues, ember motes, tail light.
##
## Animation: root BlendTree → Transition "state" {idle, loco, jumpUp, fall, land}; loco = Transition
## "gait" {walk, trot, lope, run}. As FoxAnimator, gaits are time-driven from their own phase
## (TimeSeek every tick, TimeScale 0) at a stride-matched rate; a gait change enters the new clip at
## the phase whose paw layout best matches the old one (table built from the animation tracks).

const GLB := preload("res://assets/hero/hearth_fox.glb")
const GAITS := ["walk", "trot", "lope", "run"]
const STATE_FADE := {idle = 0.3, loco = 0.2, jumpUp = 0.06, fall = 0.16, land = 0.06}
const BINS := 32
const GAIT_FADE := 0.2

var model: Node3D
var skeleton: Skeleton3D
var player: AnimationPlayer
var tree: AnimationTree
## authored ground speed per clip (m/s)
var clip_speed := {}
var state := "idle"
var gait := 0
var rate := 1.0
## per gait: phase 0..1 and cross-fade share
var _phase: Array[float] = [0.0, 0.0, 0.0, 0.0]
var _share: Array[float] = [1.0, 0.0, 0.0, 0.0]
var _loco_w := 0.0
## "from>to" → PackedFloat32Array(BINS) of entry phases; gait → entry phase from idle
var _match := {}
var _entry := {}
var _flames: Array[ShaderMaterial] = []
var _tip: Node3D
var _tip_prev := Vector3.ZERO
var _lean := Vector3.ZERO
var _time := 0.0
var _tail_light: OmniLight3D
var _puffs: CPUParticles3D
var foot_ik: FootIK


func _ready() -> void:
	model = GLB.instantiate()
	add_child(model)
	skeleton = model.find_children("*", "Skeleton3D", true, false)[0]
	player = model.find_children("*", "AnimationPlayer", true, false)[0]
	var rig := model.get_node("fox_rig")
	clip_speed = rig.get_meta("extras", {}).get("clipSpeed", {})
	for m: MeshInstance3D in model.find_children("*", "MeshInstance3D", true, false):
		var coat := m.name.begins_with("fox_coat")
		var mat := ShaderMaterial.new()
		mat.shader = preload("res://shaders/fox_coat.gdshader")
		mat.set_shader_parameter("ember_gain", 1.7 if coat else 0.9)
		if coat:
			# inverted hull that follows the skin: same skinned surface, back faces pushed out
			var ink := Kit.ink_material(false).duplicate() as ShaderMaterial
			ink.set_shader_parameter("width_override", 0.02)
			mat.next_pass = ink
		m.material_override = mat
		m.extra_cull_margin = 1.0
	for n in ["idle", "walk", "trot", "lope", "run", "fall"]:
		player.get_animation(n).loop_mode = Animation.LOOP_LINEAR
	skeleton.modifier_callback_mode_process = Skeleton3D.MODIFIER_CALLBACK_MODE_PROCESS_PHYSICS
	foot_ik = FootIK.new()
	skeleton.add_child(foot_ik)
	_build_tree()
	_build_fx()


func _build_tree() -> void:
	var root := AnimationNodeBlendTree.new()
	var st := AnimationNodeTransition.new()
	var gt := AnimationNodeTransition.new()
	gt.xfade_time = GAIT_FADE
	root.add_node("gait", gt)
	for i in GAITS.size():
		var g: String = GAITS[i]
		gt.add_input(g)
		var a := AnimationNodeAnimation.new()
		a.animation = g
		root.add_node(g, a)
		root.add_node(g + "_seek", AnimationNodeTimeSeek.new())
		root.add_node(g + "_hold", AnimationNodeTimeScale.new())
		root.connect_node(g + "_seek", 0, g)
		root.connect_node(g + "_hold", 0, g + "_seek")
		root.connect_node("gait", i, g + "_hold")
	var states := ["idle", "loco", "jumpUp", "fall", "land"]
	for s in states:
		st.add_input(s)
	root.add_node("state", st)
	for i in states.size():
		var s: String = states[i]
		if s == "loco":
			root.connect_node("state", i, "gait")
		else:
			var a := AnimationNodeAnimation.new()
			a.animation = s
			root.add_node(s, a)
			root.connect_node("state", i, s)
	root.connect_node("output", 0, "state")
	tree = AnimationTree.new()
	# advance with the controller's physics tick: deterministic captures, paws sampled on the same clock
	tree.callback_mode_process = AnimationMixer.ANIMATION_CALLBACK_MODE_PROCESS_PHYSICS
	tree.tree_root = root
	add_child(tree)
	tree.anim_player = tree.get_path_to(player)
	tree.active = true
	tree.set("parameters/state/transition_request", "idle")
	tree.set("parameters/gait/transition_request", "walk")
	for g in GAITS:
		tree.set("parameters/%s_hold/scale" % g, 0.0)
	_build_pose_match()


## paw layout (4 paws, skeleton space) of a clip at time t, composed from its tracks over the rest pose
func _paws_at(anim: Animation, t: float) -> PackedFloat32Array:
	var cache := {}
	var out := PackedFloat32Array()
	for n in ["fpaw.L", "fpaw.R", "hpaw.L", "hpaw.R"]:
		var o := _bone_at(anim, t, skeleton.find_bone(n), cache).origin
		out.append_array([o.x, o.y, o.z])
	return out


func _bone_at(anim: Animation, t: float, b: int, cache: Dictionary) -> Transform3D:
	if cache.has(b):
		return cache[b]
	var rest := skeleton.get_bone_rest(b)
	var pos := rest.origin
	var rot := rest.basis.get_rotation_quaternion()
	var scl := rest.basis.get_scale()
	var path := NodePath("fox_rig/Skeleton3D:" + skeleton.get_bone_name(b))
	var ti := anim.find_track(path, Animation.TYPE_POSITION_3D)
	if ti >= 0: pos = anim.position_track_interpolate(ti, t)
	ti = anim.find_track(path, Animation.TYPE_ROTATION_3D)
	if ti >= 0: rot = anim.rotation_track_interpolate(ti, t)
	ti = anim.find_track(path, Animation.TYPE_SCALE_3D)
	if ti >= 0: scl = anim.scale_track_interpolate(ti, t)
	var local := Transform3D(Basis(rot) * Basis.from_scale(scl), pos)
	var parent := skeleton.get_bone_parent(b)
	var g := _bone_at(anim, t, parent, cache) * local if parent >= 0 else local
	cache[b] = g
	return g


static func _d2(a: PackedFloat32Array, b: PackedFloat32Array) -> float:
	var s := 0.0
	for k in a.size():
		s += (a[k] - b[k]) * (a[k] - b[k])
	return s


## FoxAnimator.buildPoseMatch: best entry phase per (from gait bin → to gait), and from idle
func _build_pose_match() -> void:
	var poses := []
	for g in GAITS:
		var anim := player.get_animation(g)
		var row := []
		for i in BINS:
			row.append(_paws_at(anim, float(i) / BINS * anim.length))
		poses.append(row)
	var idle := _paws_at(player.get_animation("idle"), 0.0)
	for fi in GAITS.size():
		for ti in GAITS.size():
			if fi == ti:
				continue
			var table := PackedFloat32Array()
			for i in BINS:
				var best := 0
				var best_d := INF
				for j in BINS:
					var d := _d2(poses[fi][i], poses[ti][j]) + _d2(poses[fi][(i + 2) % BINS], poses[ti][(j + 2) % BINS])
					if d < best_d:
						best = j
						best_d = d
				table.append(float(best) / BINS)
			_match["%s>%s" % [GAITS[fi], GAITS[ti]]] = table
	for gi in GAITS.size():
		var best := 0
		var best_d := INF
		for j in BINS:
			var d := _d2(idle, poses[gi][j])
			if d < best_d:
				best = j
				best_d = d
		_entry[GAITS[gi]] = float(best) / BINS


func _build_fx() -> void:
	var tail6 := BoneAttachment3D.new()
	tail6.bone_name = "tail6"
	skeleton.add_child(tail6)
	_tip = tail6
	var tail5 := BoneAttachment3D.new()
	tail5.bone_name = "tail5"
	skeleton.add_child(tail5)
	_tail_light = OmniLight3D.new()
	_tail_light.light_color = Color(1.0, 0.478, 0.188)
	_tail_light.light_energy = 0.22
	_tail_light.omni_range = 2.0
	_tail_light.position = Vector3(0, 0.08, 0)
	tail6.add_child(_tail_light)
	# cel flame tongues along the tail's burn-out third, tallest at the point
	var quad := QuadMesh.new()
	for tg in [[tail6, Vector3(0, 0.04, 0), Vector2(0.15, 0.3), 0.1], [tail6, Vector3(0.03, 0, 0.02), Vector2(0.1, 0.2), 0.55], [tail6, Vector3(-0.035, -0.02, -0.01), Vector2(0.09, 0.16), 0.85], [tail5, Vector3(0.025, 0.02, 0.02), Vector2(0.08, 0.13), 0.35], [tail5, Vector3(-0.03, -0.015, 0.015), Vector2(0.07, 0.1), 0.7]]:
		var m := MeshInstance3D.new()
		m.mesh = quad
		var mat := ShaderMaterial.new()
		mat.shader = preload("res://shaders/fox_flame.gdshader")
		mat.set_shader_parameter("size", tg[2])
		mat.set_shader_parameter("seed", tg[3])
		m.material_override = mat
		m.position = tg[1]
		m.extra_cull_margin = 2.0
		m.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		(tg[0] as Node3D).add_child(m)
		_flames.append(mat)
	# ember motes drifting up off the tail tip, fading orange → ash (world-space trail)
	var motes := CPUParticles3D.new()
	motes.amount = 48
	motes.lifetime = 1.6
	motes.local_coords = false
	motes.mesh = _spark_mesh(0.035)
	motes.direction = Vector3.UP
	motes.spread = 25.0
	motes.initial_velocity_min = 0.15
	motes.initial_velocity_max = 0.3
	motes.gravity = Vector3(0, 0.08, 0)
	motes.color_ramp = _ember_ramp()
	motes.position = Vector3(0, 0.07, 0)
	tail6.add_child(motes)
	# ember kick-up on landings
	_puffs = CPUParticles3D.new()
	_puffs.amount = 24
	_puffs.lifetime = 0.9
	_puffs.one_shot = true
	_puffs.emitting = false
	_puffs.explosiveness = 1.0
	_puffs.local_coords = false
	_puffs.mesh = _spark_mesh(0.04)
	_puffs.emission_shape = CPUParticles3D.EMISSION_SHAPE_RING
	_puffs.emission_ring_axis = Vector3.UP
	_puffs.emission_ring_radius = 0.25
	_puffs.emission_ring_inner_radius = 0.1
	_puffs.emission_ring_height = 0.0
	_puffs.direction = Vector3.UP
	_puffs.spread = 60.0
	_puffs.initial_velocity_min = 0.3
	_puffs.initial_velocity_max = 0.7
	_puffs.damping_min = 2.0
	_puffs.damping_max = 4.0
	_puffs.gravity = Vector3.ZERO
	_puffs.color_ramp = _ember_ramp()
	add_child(_puffs)


static func _spark_mesh(s: float) -> QuadMesh:
	var q := QuadMesh.new()
	q.size = Vector2(s, s)
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	m.vertex_color_use_as_albedo = true
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.albedo_texture = _dot_texture()
	q.material = m
	return q


static func _dot_texture() -> ImageTexture:
	var n := 16
	var img := Image.create(n, n, false, Image.FORMAT_RGBA8)
	for y in n:
		for x in n:
			var r := Vector2(x - n / 2.0 + 0.5, y - n / 2.0 + 0.5).length() / (n / 2.0)
			img.set_pixel(x, y, Color(1, 1, 1, pow(maxf(0.0, 1.0 - r), 1.5)))
	return ImageTexture.create_from_image(img)


static func _ember_ramp() -> Gradient:
	var g := Gradient.new()
	g.set_color(0, Color(2.2, 0.75, 0.12, 0.0))
	g.set_color(1, Color(0.3, 0.12, 0.05, 0.0))
	g.add_point(0.15, Color(2.2, 0.7, 0.12, 1.0))
	g.add_point(0.6, Color(1.2, 0.3, 0.08, 0.7))
	return g


## ember ring kicked up at the paws on touchdown (impact 0..1)
func land(impact: float) -> void:
	_puffs.amount = maxi(4, roundi(4 + 20 * clampf(impact, 0.0, 1.0)))
	_puffs.global_position = global_position + Vector3(0, 0.03, 0)
	_puffs.restart()


## state chosen by the controller; speed = ground speed (m/s) drives gait + cadence
func drive(dt: float, speed: float, next_state: String, hysteresis := 0.12, min_rate := 0.6, max_rate := 1.7) -> void:
	if next_state != state:
		var st: AnimationNodeTransition = (tree.tree_root as AnimationNodeBlendTree).get_node("state")
		st.xfade_time = STATE_FADE[next_state]
		tree.set("parameters/state/transition_request", next_state)
		state = next_state
	# gait tree: pick by speed with hysteresis around the geometric mean of neighbouring clip speeds
	var entering := _loco_w < 1e-3
	var h := 0.0 if entering else hysteresis
	var prev := gait
	var g := gait
	while g < GAITS.size() - 1 and speed > sqrt(clip_speed[GAITS[g]] * clip_speed[GAITS[g + 1]]) * (1.0 + h):
		g += 1
	while g > 0 and speed < sqrt(clip_speed[GAITS[g - 1]] * clip_speed[GAITS[g]]) * (1.0 - h):
		g -= 1
	gait = g
	if entering and state == "loco":
		_phase[g] = _entry[GAITS[g]]
		for i in GAITS.size():
			_share[i] = 1.0 if i == g else 0.0
	elif g != prev:
		_phase[g] = _match["%s>%s" % [GAITS[prev], GAITS[g]]][int(_phase[prev] * BINS) % BINS]
	if g != prev or entering:
		tree.set("parameters/gait/transition_request", GAITS[g])
	_loco_w = move_toward(_loco_w, 1.0 if state == "loco" else 0.0, dt / GAIT_FADE)
	for i in GAITS.size():
		var name: String = GAITS[i]
		_share[i] = move_toward(_share[i], 1.0 if i == g else 0.0, dt / GAIT_FADE)
		# stride-matched cadence: the paws travel with the ground (bounded around the authored rate)
		var r := clampf(speed / clip_speed[name], min_rate, max_rate)
		if i == g:
			rate = r
		if _share[i] > 0.0:
			_phase[i] = fmod(_phase[i] + dt * r / player.get_animation(name).length, 1.0)
		tree.set("parameters/%s_seek/seek_request" % name, _phase[i] * player.get_animation(name).length)
	_fx(dt)


func gait_name() -> String:
	return GAITS[gait]


## one-shot finished (jumpUp / land)
func one_shot_length(s: String) -> float:
	return player.get_animation(s).length


func _fx(dt: float) -> void:
	_time += dt
	_tail_light.light_energy = 0.2 + sin(_time * 9.0) * 0.03
	var tip := _tip.global_position
	if dt > 0.0:
		var v := (_tip_prev - tip) / dt * 0.25
		v.y = 0.0
		v = v.limit_length(1.2)
		_lean = _lean.lerp(v, minf(1.0, dt * 8.0))
	_tip_prev = tip
	for m in _flames:
		m.set_shader_parameter("time", _time)
		m.set_shader_parameter("lean", _lean)
