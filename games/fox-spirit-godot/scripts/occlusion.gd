class_name Occlusion
extends Node
## Chase-camera cutout scoped to actual sight blockers (opening/occlusion.ts). Each occluder unit
## (cottage, well, column, grove maple, hearth) gets exact trimesh sight shapes on physics layer 2;
## a bundle of rays (body + ears, ±0.42 m across) finds what stands between lens and fox. A blocker
## screen-door fades (opaque pipeline, no sorting) and drops its ink pass; it recovers promptly.

const SIGHT_LAYER := 2
var units: Array[Dictionary] = []  # {root, mats: Array[ShaderMaterial], ink: Array, fade}
var _by_body := {}


func setup(roots: Array[Node3D], world: Node3D) -> void:
	for root in roots:
		var u := {root = root, mats = [] as Array[ShaderMaterial], ink = [], fade = 0.0}
		var geo := root.find_children("*", "GeometryInstance3D", true, false)
		if root is GeometryInstance3D:
			geo.append(root)
		for n in geo:
			var gi := n as GeometryInstance3D
			var m := gi.material_override as ShaderMaterial
			if m == null or not m.shader.resource_path.contains("world_cel"):
				continue
			u.mats.append(m)
			u.ink.append(m.next_pass)
			if gi is MeshInstance3D:
				# faces baked to world space: physics bodies ignore the maples' scaled transforms
				var xf := gi.global_transform
				var faces := (gi as MeshInstance3D).mesh.get_faces()
				for i in faces.size():
					faces[i] = xf * faces[i]
				var shape := ConcavePolygonShape3D.new()
				shape.set_faces(faces)
				# a lens inside a cottage / the well ring still sees the wall it is inside
				shape.backface_collision = true
				var body := StaticBody3D.new()
				body.collision_layer = SIGHT_LAYER
				body.collision_mask = 0
				var cs := CollisionShape3D.new()
				cs.shape = shape
				body.add_child(cs)
				world.add_child(body)
				_by_body[body.get_rid()] = u
		units.append(u)


func update(dt: float, cam: Camera3D, feet: Vector3) -> void:
	var hidden := {}
	var lens := cam.global_position
	var target := feet + Vector3(0, 0.45, 0)
	var dir := target - lens
	var dist := dir.length()
	if dist > 0.5:
		var space := cam.get_world_3d().direct_space_state
		var right := dir.cross(Vector3.UP).normalized() * 0.42
		for h in [0.2, 0.72]:
			for o in [-1.0, 0.0, 1.0]:
				var from: Vector3 = lens + right * o
				var to: Vector3 = target + right * o
				to.y = feet.y + h
				var q := PhysicsRayQueryParameters3D.create(from, from + (to - from).normalized() * (dist - 0.18), 1 << (SIGHT_LAYER - 1))
				q.hit_back_faces = true
				var exclude: Array[RID] = []
				for i in 4:
					q.exclude = exclude
					var hit := space.intersect_ray(q)
					if hit.is_empty():
						break
					var u: Variant = _by_body.get(hit.rid)
					if u != null and (u.root as Node3D).is_visible_in_tree():
						hidden[u.root] = true
					exclude.append(hit.rid)
	for u in units:
		var on: bool = hidden.has(u.root)
		u.fade = lerpf(u.fade, 1.0 if on else 0.0, 1.0 - exp(-(14.0 if on else 9.0) * dt))
		if u.fade < 0.002 and not on:
			u.fade = 0.0
		for i in u.mats.size():
			var m: ShaderMaterial = u.mats[i]
			m.set_shader_parameter("fade", u.fade)
			m.next_pass = u.ink[i] if u.fade < 0.2 else null


func state() -> Dictionary:
	var faded := 0
	for u in units:
		if u.fade > 0.05:
			faded += 1
	return {occluders = units.size(), faded = faded}
