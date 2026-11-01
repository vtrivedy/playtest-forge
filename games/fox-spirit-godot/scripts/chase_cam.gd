class_name ChaseCam
extends Camera3D
## Third-person chase camera (camera.ts tuned by lookdevPlay.ts): critically damped boom behind the
## fox's facing with a 3/4 side bias, speed-scaled recentre after a manual delay, look-ahead,
## ground-locked jump tracking, glide pull-back, terrain clearance. Scenery between lens and fox is
## not dodged — it fades (occlusion.gd), so the shot stays stable.

@export var distance := 2.45
@export var run_distance := 2.35
@export var min_distance := 1.2
@export var side_bias := 0.35
@export var height := 1.15
@export var ground_lift := 0.2
@export var look_height := 0.33
@export var framing_height := 0.38
@export var air_distance := 2.65
@export var glide_distance := 4.8
@export var look_ahead := 1.2
@export var base_fov := 50.0
@export var clearance := 0.35
@export var recenter_rate := 2.9
@export var recenter_delay := 1.2
@export var lag := 0.14
@export var jump_track := 0.8

var yaw := 0.0
var _vel := Vector3.ZERO
var _aim := Vector3.ZERO
var _aim_vel := Vector3.ZERO
var _ground_lock := 0.0
var _air_w := 0.0
var _manual_t := 99.0
var _shake := 0.0
var _dist := 2.45


func snap_behind(facing: float, target: Vector3) -> void:
	yaw = facing
	_ground_lock = target.y
	_dist = distance
	var lens := _lens(target, target.y)
	global_position = lens
	_aim = target + Vector3(0, look_height + framing_height, 0)
	_vel = Vector3.ZERO
	_aim_vel = Vector3.ZERO
	look_at(_aim)


## yaw of the view direction (for camera-relative input)
func view_yaw() -> float:
	var f := -global_transform.basis.z
	return atan2(f.x, f.z)


func land(impact: float) -> void:
	_shake = maxf(_shake, impact)


func _lens(p: Vector3, base_y: float) -> Vector3:
	var ly := yaw + side_bias
	return Vector3(p.x - sin(ly) * _dist, base_y + height + ground_lift, p.z - cos(ly) * _dist)


static func _damp(cur: Vector3, goal: Vector3, vel: Vector3, smooth: float, dt: float) -> Array:
	# critically damped spring (Game Programming Gems 4 SmoothDamp)
	var omega := 2.0 / maxf(0.02, smooth)
	var x := omega * dt
	var e := 1.0 / (1.0 + x + 0.48 * x * x + 0.235 * x * x * x)
	var change := cur - goal
	var temp := (vel + change * omega) * dt
	var nv := (vel - temp * omega) * e
	return [goal + (change + temp) * e, nv]


func follow(dt: float, p: Vector3, vel: Vector3, facing: float, grounded: bool, gliding: bool, dashing: bool, steering: bool) -> void:
	var speed := Vector2(vel.x, vel.z).length()
	_manual_t = 0.0 if not steering else _manual_t + dt
	# recentre behind the facing once moving (scaled with speed), faster in a glide
	if speed > 1.0 and not dashing:
		var rate := recenter_rate * minf(1.0, speed / 7.5) * (1.4 if gliding else 1.0)
		yaw += wrapf(facing - yaw, -PI, PI) * (1.0 - exp(-rate * dt))
	_air_w = move_toward(_air_w, 0.0 if grounded else 1.0, dt * 3.0)
	if grounded:
		_ground_lock = p.y
	var goal_y := p.y if grounded else _ground_lock + maxf(0.0, p.y - _ground_lock) * jump_track + minf(0.0, p.y - _ground_lock)
	if gliding:
		goal_y = p.y
	var ground_d := lerpf(distance, run_distance, clampf(speed / 3.2, 0.0, 1.0))
	var want := glide_distance if gliding else lerpf(ground_d, air_distance, _air_w)
	_dist = lerpf(_dist, want, 1.0 - exp(-3.0 * dt))
	var lens := _lens(p, goal_y)
	# terrain clearance (lens never dips into the bowl's slope)
	lens.y = maxf(lens.y, Layout.ground_h(lens.x, lens.z) + clearance)
	var r := _damp(global_position, lens, _vel, lag, dt)
	var pos: Vector3 = r[0]
	_vel = r[1]
	var lead := Vector3(vel.x, 0, vel.z).normalized() * minf(1.0, speed / 7.5) * look_ahead if speed > 0.1 else Vector3.ZERO
	var aim_goal := Vector3(p.x + lead.x, goal_y + look_height + framing_height, p.z + lead.z)
	var ra := _damp(_aim, aim_goal, _aim_vel, lag * 0.8, dt)
	_aim = ra[0]
	_aim_vel = ra[1]
	_shake = maxf(0.0, _shake - dt * 3.0)
	global_position = pos + Vector3(0, sin(Time.get_ticks_msec() * 0.06) * 0.02 * _shake, 0)
	look_at(_aim)
	fov = base_fov + (3.0 if gliding else 0.0)
