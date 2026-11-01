class_name Ctx
extends RefCounted
## Shared build context for the slice modules (opening/scene.ts OpeningCtx)

var root: Node3D
var rand := Rng.new(11)
## {kind = "box"|"post"|"cap", …} walk / block shapes, turned into StaticBody3D shapes by the scene
var colliders: Array[Dictionary] = []
## view blockers that fade (screen-door) while they sit between the chase lens and the fox
var occluders: Array[Node3D] = []
var updates: Array[Callable] = []


func _init(r: Node3D) -> void:
	root = r


func add(n: Node3D) -> Node3D:
	root.add_child(n)
	return n


func occluder(n: Node3D) -> Node3D:
	occluders.append(n)
	return n


func on_update(fn: Callable) -> void:
	updates.append(fn)
