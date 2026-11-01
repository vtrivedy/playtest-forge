class_name FootIK
extends SkeletonModifier3D
## Light foot IK on top of the clip (lookdevPlay.ts FootIK), as a native skeleton modifier: a paw the
## clip has on its ground plane (and nearly still in the world) is in stance → it latches where it
## landed (bounded lock), every paw follows the ground under it (physics ray), the pelvis drops so
## the lowest stance paw reaches, and a two-bone solve (shoulder/hip → elbow/stifle → pastern/meta)
## carries the paw; pastern/meta and paw keep their clip world orientation.

@export var enabled := true
## clip paw height (m above the root plane) that counts as stance
@export var stance_height := 0.035
## pre-IK paw world speed (m/s) below which a low paw counts as planted
@export var stance_speed := 0.6
@export var max_lock := 0.06
@export var max_pelvis_drop := 0.08

## set by the controller each tick
var grounded := true
var moving := false
## fox root (feet) world position
var base := Vector3.ZERO
## the fox's own body, excluded from the ground rays
var body: RID
## worst stance-paw XZ speed this frame (m/s) — skate metric, post-IK
var slide := 0.0
var stance_feet := 0

var _feet: Array[Dictionary] = []
var _pelvis := 0.0
var _root := -1
var _written: Variant = null
var _written_off := 0.0


func _ready() -> void:
	var sk := get_skeleton()
	_root = sk.find_bone("root")
	for sd in [".L", ".R"]:
		_feet.append(_foot(sk, "upperarm" + sd, "forearm" + sd, "pastern" + sd, "fpaw" + sd, -1.0))
		_feet.append(_foot(sk, "thigh" + sd, "shin" + sd, "meta" + sd, "hpaw" + sd, 1.0))


func _foot(sk: Skeleton3D, u: String, l: String, h: String, p: String, pole: float) -> Dictionary:
	return {upper = sk.find_bone(u), lower = sk.find_bone(l), hock = sk.find_bone(h), paw = sk.find_bone(p), pole = pole,
		planted = false, anchor = Vector3.ZERO, lock = Vector3.ZERO, prev = null, raw = null}


func _world(sk: Skeleton3D, bone: int) -> Vector3:
	return sk.global_transform * sk.get_bone_global_pose(bone).origin


func _ground(x: float, y: float, z: float) -> float:
	var q := PhysicsRayQueryParameters3D.create(Vector3(x, y + 0.5, z), Vector3(x, y - 1.5, z), 1, [body])
	var hit := get_world_3d().direct_space_state.intersect_ray(q)
	return hit.position.y if not hit.is_empty() else base.y


func _process_modification_with_delta(dt: float) -> void:
	var sk := get_skeleton()
	slide = 0.0
	stance_feet = 0
	if not enabled or not grounded or dt <= 0.0:
		for f in _feet:
			f.planted = false
			f.prev = null
			f.raw = null
		_pelvis = lerpf(_pelvis, 0.0, 1.0 - exp(-18.0 * dt))
		_drop(sk)
		return
	var plans := []
	for f in _feet:
		var pad := _world(sk, f.paw)
		var raw_speed: float = Vector2(pad.x - f.raw.x, pad.z - f.raw.z).length() / dt if f.raw != null else 0.0
		f.raw = pad
		var stance := pad.y - base.y < stance_height and raw_speed < stance_speed
		var g := _ground(pad.x, base.y, pad.z)
		if stance and not f.planted:
			f.planted = true
			f.anchor = pad
		elif not stance:
			f.planted = false
		if f.planted and moving:
			var want: Vector3 = f.anchor - pad
			want.y = 0.0
			if want.length() > max_lock:
				want = want.normalized() * max_lock
				f.anchor = pad + want
			f.lock = want
		else:
			f.lock *= exp(-dt / 0.06)
		# the clip's paw height rides on the ground under the paw (never below it)
		var target: Vector3 = pad + f.lock
		target.y = maxf(pad.y + (g - base.y), g)
		plans.append({target = target, stance = stance, need = target.y - pad.y})
	var need := INF
	for p in plans:
		if p.stance:
			need = minf(need, p.need)
	_pelvis = lerpf(_pelvis, clampf(need, -max_pelvis_drop, 0.02) if need < INF else 0.0, 1.0 - exp(-18.0 * dt))
	_drop(sk)
	for i in _feet.size():
		var f: Dictionary = _feet[i]
		var target: Vector3 = plans[i].target
		if _world(sk, f.paw).distance_squared_to(target) > 1e-8:
			_place(sk, f, target)
		var solved := _world(sk, f.paw)
		if plans[i].stance:
			stance_feet += 1
			if f.prev != null:
				slide = maxf(slide, Vector2(solved.x - f.prev.x, solved.z - f.prev.z).length() / dt)
			f.prev = solved
		else:
			f.prev = null


func _drop(sk: Skeleton3D) -> void:
	if _root < 0:
		return
	var cur := sk.get_bone_pose_position(_root)
	# a root the clip doesn't key keeps last tick's drop: take it back out before adding this one
	if _written != null and cur.is_equal_approx(_written):
		cur.y -= _written_off
	_written = cur + Vector3(0, _pelvis, 0)
	_written_off = _pelvis
	sk.set_bone_pose_position(_root, _written)
	sk.force_update_bone_child_transform(_root)


## world rotation of a bone (skeleton → world)
func _wbasis(sk: Skeleton3D, bone: int) -> Basis:
	return sk.global_transform.basis * sk.get_bone_global_pose(bone).basis


## set a bone's world rotation, keeping its local position
func _set_wbasis(sk: Skeleton3D, bone: int, wb: Basis) -> void:
	var parent := sk.get_bone_parent(bone)
	var pb := sk.global_transform.basis * (sk.get_bone_global_pose(parent).basis if parent >= 0 else Basis())
	sk.set_bone_pose_rotation(bone, (pb.inverse() * wb).get_rotation_quaternion())
	sk.force_update_bone_child_transform(bone)


func _place(sk: Skeleton3D, f: Dictionary, target: Vector3) -> void:
	var hock_rot := _wbasis(sk, f.hock)
	var paw_rot := _wbasis(sk, f.paw)
	var metatarsus := _world(sk, f.paw) - _world(sk, f.hock)
	_solve(sk, f.upper, f.lower, f.hock, target - metatarsus, f.pole)
	_set_wbasis(sk, f.hock, hock_rot)
	_set_wbasis(sk, f.paw, paw_rot)


func _solve(sk: Skeleton3D, upper: int, lower: int, end: int, target: Vector3, pole: float) -> void:
	var a := _world(sk, upper)
	var b := _world(sk, lower)
	var c := _world(sk, end)
	var l1 := a.distance_to(b)
	var l2 := b.distance_to(c)
	if l1 < 1e-3 or l2 < 1e-3:
		return
	var dir := (target - a).normalized()
	var dist := clampf(a.distance_to(target), absf(l1 - l2) + 1e-4, l1 + l2 - 1e-4)
	# keep the clip's bend plane; fall back to the anatomical pole (elbow back, stifle forward)
	var bend := b - a
	bend -= dir * bend.dot(dir)
	if bend.length_squared() < pow(0.05 * l1, 2):
		bend = get_parent_node_3d().global_transform.basis * Vector3(0, 0, pole) if get_parent_node_3d() else Vector3(0, 0, pole)
		bend -= dir * bend.dot(dir)
	if bend.length_squared() < 1e-8:
		return
	bend = bend.normalized()
	var along := (l1 * l1 + dist * dist - l2 * l2) / (2.0 * dist)
	var joint := a + dir * along + bend * sqrt(maxf(0.0, l1 * l1 - along * along))
	_aim(sk, upper, b - a, joint - a)
	var elbow := _world(sk, lower)
	_aim(sk, lower, _world(sk, end) - elbow, target - elbow)


func _aim(sk: Skeleton3D, bone: int, from: Vector3, to: Vector3) -> void:
	var fix := Quaternion(from.normalized(), to.normalized())
	_set_wbasis(sk, bone, Basis(fix) * _wbasis(sk, bone))
