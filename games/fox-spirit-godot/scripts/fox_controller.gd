class_name FoxController
extends CharacterBody3D
## Hearth-fox controller (lookdevPlay.ts createPlay) on a native CharacterBody3D: camera-relative
## move with bounded, eased turning; accel/decel ground speed; buffered jump with coyote grace and
## jump-cut; hold-jump glide; dash burst + cooldown; hearth updraft lift. Same tunable names and
## defaults as PLAY so feel can be compared one-to-one. Move + 2 actions (jump, dash).

@export_group("move")
@export var run_speed := 3.2
@export var walk_speed := 0.85
@export var accel := 3.2
@export var decel := 5.5
@export var turn_slow := 7.0
@export var turn_fast := 3.6
@export_group("jump")
@export var jump_velocity := 5.0
@export var gravity := 15.0
@export var fall_gravity := 1.45
@export var jump_cut := 0.5
@export var coyote := 0.1
@export var buffer := 0.12
@export var air_control := 1.6
@export_group("glide + dash")
@export var glide_sink := 1.35
@export var dash_speed := 8.0
@export var dash_duration := 0.24
@export var dash_cooldown := 0.55
@export_group("clips")
@export var min_rate := 0.6
@export var max_rate := 1.7
@export var gait_hysteresis := 0.12
@export var turn_bank := 0.05
@export var bank_max := 0.18
@export var air_pitch := 0.06
@export var land_max_speed := 0.35
@export var slope_tilt := 1.0

var visual: FoxVisual
var cam: ChaseCam
var hearth: Hearth
## scripted input for captures: {forward, back, left, right, jump, dash, walk} → bool (null = real input)
var scripted: Variant = null
signal landed(at: Vector3, impact: float)

var yaw := 0.0
var yaw_rate := 0.0
var speed := 0.0
var grounded := true
var gliding := false
var dashing := false
var dashes_used := 0
var air_t := 0.0
var lift := {k = 0.0}
var last_jump := {apex = 0.0, air = 0.0}
var _coyote_t := 0.0
var _buffer_t := 0.0
var _jump_held := false
var _dash_held := false
var _dash_t := 0.0
var _dash_cd := 0.0
var _cut := false
var _rising := false
var _land_t := 99.0
var _jump_t := 99.0
var _bank := 0.0
var _pitch := 0.0
var _apex_y := 0.0
var _takeoff_y := 0.0
var _want := 0.0


func _ready() -> void:
	var shape := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.2
	cap.height = 0.62
	shape.shape = cap
	shape.position.y = 0.31
	add_child(shape)
	collision_layer = 1
	collision_mask = 1
	floor_snap_length = 0.3
	floor_max_angle = deg_to_rad(52.0)
	floor_constant_speed = true
	visual = FoxVisual.new()
	add_child(visual)
	visual.foot_ik.body = get_rid()


func teleport(x: float, z: float, facing: float) -> void:
	var y := Layout.ground_h(x, z)
	var space := get_world_3d().direct_space_state if is_inside_tree() else null
	if space:
		var hit := space.intersect_ray(PhysicsRayQueryParameters3D.create(Vector3(x, y + 20.0, z), Vector3(x, y - 5.0, z), 1))
		if not hit.is_empty():
			y = hit.position.y
	global_position = Vector3(x, y, z)
	yaw = facing
	speed = 0.0
	yaw_rate = 0.0
	velocity = Vector3.ZERO
	grounded = true
	_dash_t = 0.0
	_dash_cd = 0.0
	gliding = false
	if cam:
		cam.snap_behind(yaw, global_position)


func _held(action: String) -> bool:
	if scripted != null:
		return scripted.get(action, false)
	return Input.is_action_pressed(action)


func _read_input() -> Vector2:
	if scripted != null and scripted.has("stick"):
		# world-relative stick (harness setStick)
		_held_buttons()
		return scripted.stick
	var ix := (1.0 if _held("move_right") else 0.0) - (1.0 if _held("move_left") else 0.0)
	var iz := (1.0 if _held("move_forward") else 0.0) - (1.0 if _held("move_back") else 0.0)
	var cy := cam.view_yaw() if cam else yaw
	# camera-relative: forward = away from the lens, right = its right hand
	var fwd := Vector2(sin(cy), cos(cy))
	var right := Vector2(-cos(cy), sin(cy))
	var wish := fwd * iz + right * ix
	if wish.length_squared() > 1.0:
		wish = wish.normalized()
	if _held("walk"):
		wish *= walk_speed / run_speed
	_held_buttons()
	return wish


func _held_buttons() -> void:
	var jump := _held("jump")
	if jump and not _jump_held:
		_buffer_t = buffer
	_jump_held = jump
	var dash := _held("dash")
	if dash and not _dash_held and _dash_cd <= 0.0:
		_dash_t = dash_duration
		_dash_cd = dash_duration + dash_cooldown
		dashes_used += 1
	_dash_held = dash


func _physics_process(dt: float) -> void:
	_dash_t = maxf(0.0, _dash_t - dt)
	_dash_cd = maxf(0.0, _dash_cd - dt)
	var wish := _read_input()
	_buffer_t -= dt
	_want = wish.length()

	# facing: bounded, eased yaw rate (slower when fast)
	if _want > 0.01:
		var err := wrapf(atan2(wish.x, wish.y) - yaw, -PI, PI)
		var mx := lerpf(turn_slow, turn_fast, clampf(speed / run_speed, 0.0, 1.0))
		var rate := mx * tanh(err * 6.0 / mx)
		yaw_rate = lerpf(yaw_rate, rate, 1.0 - exp(-(10.0 if grounded else 4.0) * dt))
	else:
		yaw_rate = lerpf(yaw_rate, 0.0, 1.0 - exp(-10.0 * dt))
	yaw = wrapf(yaw + yaw_rate * dt, -PI, PI)

	var vel := velocity
	if grounded:
		var err := wrapf(atan2(wish.x, wish.y) - yaw, -PI, PI) if _want > 0.01 else 0.0
		var target := _want * run_speed * maxf(0.0, cos(err))
		speed = lerpf(speed, target, 1.0 - exp(-(accel if target > speed else decel) * dt))
		if speed < 0.02 and target == 0.0:
			speed = 0.0
		vel.x = sin(yaw) * speed
		vel.z = cos(yaw) * speed
		_coyote_t = coyote
	else:
		_coyote_t -= dt
		var desired := wish * maxf(speed, run_speed * 0.6)
		var k := (1.0 - exp(-air_control * dt)) * minf(1.0, _want)
		vel.x += (desired.x - vel.x) * k
		vel.z += (desired.y - vel.z) * k
		speed = Vector2(vel.x, vel.z).length()

	# jump: buffered press, coyote grace
	if _buffer_t > 0.0 and _coyote_t > 0.0:
		_buffer_t = 0.0
		_coyote_t = 0.0
		grounded = false
		_rising = true
		_cut = false
		vel.y = jump_velocity
		air_t = 0.0
		_jump_t = 0.0
		_takeoff_y = global_position.y
		_apex_y = global_position.y
	dashing = _dash_t > 0.0
	if dashing:
		speed = dash_speed
		vel.x = sin(yaw) * speed
		vel.z = cos(yaw) * speed
	var pos := global_position
	lift = hearth.lift_at(pos.x, pos.y, pos.z) if hearth else {k = 0.0}
	gliding = not grounded and _jump_held and air_t > 0.12 and (vel.y <= 0.0 or lift.k > 0.05)

	if not grounded:
		air_t += dt
		_jump_t += dt
		if _rising and not _jump_held and not _cut and vel.y > 0.0:
			vel.y *= jump_cut
			_cut = true
		if gliding:
			var heat: float = lift.k
			var target := lerpf(-glide_sink, hearth.tun.max_rise if hearth else 6.5, heat)
			var resp: float = hearth.tun.lift_response if heat > 0.0 else 5.0
			vel.y = lerpf(vel.y, target, 1.0 - exp(-resp * dt))
		else:
			var fall: float = fall_gravity * (1.0 - (hearth.tun.fall_lift if hearth else 0.0) * lift.k) if vel.y < 0.0 else 1.0
			vel.y -= gravity * fall * dt
		if vel.y < 0.0:
			_rising = false
	else:
		vel.y = 0.0

	var was_air := not grounded
	var fall_vy := vel.y
	velocity = vel
	move_and_slide()
	pos = global_position
	if was_air:
		_apex_y = maxf(_apex_y, pos.y)
		if is_on_floor() and fall_vy <= 0.0:
			var impact := clampf(-fall_vy / 9.0, 0.0, 1.0)
			grounded = true
			last_jump = {apex = snappedf(_apex_y - _takeoff_y, 0.001), air = snappedf(air_t, 0.001)}
			_land_t = 0.0
			if cam:
				cam.land(impact * 0.6)
			visual.land(impact)
			landed.emit(pos, impact)
			# horizontal momentum carries into the ground run along the new facing
			speed = Vector2(vel.x, vel.z).length() * maxf(0.0, cos(wrapf(atan2(vel.x, vel.z) - yaw, -PI, PI)))
	elif not is_on_floor():
		# walked off a ledge
		grounded = false
		_rising = false
		air_t = 0.0
		_jump_t = 99.0
		_takeoff_y = pos.y
		_apex_y = pos.y
	else:
		# blocked by a wall: the run speed follows what actually moved (no treadmill)
		var real := Vector2(get_real_velocity().x, get_real_velocity().z).length()
		if not dashing and real < speed - 0.05:
			speed = lerpf(speed, real, 1.0 - exp(-12.0 * dt))
	if hearth:
		hearth.track_ride(dt, pos.y, velocity.y, grounded, lift)
	_land_t += dt

	# clip state
	var st: String
	if not grounded:
		st = "jumpUp" if _jump_t < visual.one_shot_length("jumpUp") and velocity.y > 0.0 else "fall"
	elif speed < land_max_speed and _land_t < visual.one_shot_length("land"):
		st = "land"
	else:
		st = "loco" if speed > 0.06 or _want > 0.05 else "idle"
	visual.drive(dt, speed, st, gait_hysteresis, min_rate, max_rate)
	visual.foot_ik.grounded = grounded
	visual.foot_ik.moving = st == "loco"
	visual.foot_ik.base = pos

	# additives: turn bank (grounded), nose up rising / down falling, slope pitch
	_bank = lerpf(_bank, clampf(-yaw_rate * speed * turn_bank, -bank_max, bank_max) if grounded else 0.0, 1.0 - exp(-6.0 * dt))
	var slope := 0.0
	if grounded:
		var f := Vector3(sin(yaw), 0, cos(yaw)) * 0.3
		slope = -atan2(Layout.ground_h(pos.x + f.x, pos.z + f.z) - Layout.ground_h(pos.x - f.x, pos.z - f.z), 0.6) * slope_tilt
	_pitch = lerpf(_pitch, clampf(slope if grounded else -velocity.y * air_pitch, -0.35, 0.35), 1.0 - exp(-8.0 * dt))
	visual.rotation = Vector3(0, yaw, 0)
	visual.model.rotation = Vector3(_pitch, 0, _bank)
	if cam:
		cam.follow(dt, pos, velocity, yaw, grounded, gliding, dashing, _want > 0.01)


func state() -> Dictionary:
	var p := global_position
	return {
		pos = [snappedf(p.x, 0.001), snappedf(p.y, 0.001), snappedf(p.z, 0.001)],
		speed = snappedf(speed, 0.001), yaw = snappedf(yaw, 0.001), grounded = grounded, gliding = gliding,
		dashing = dashing, dashes_used = dashes_used, air_time = snappedf(air_t, 0.001),
		last_jump = last_jump, anim = visual.state, gait = visual.gait_name(), playback = snappedf(visual.rate, 0.001),
		lift = snappedf(lift.k, 0.001), stance_feet = visual.foot_ik.stance_feet, max_slide = snappedf(visual.foot_ik.slide, 0.001),
	}
