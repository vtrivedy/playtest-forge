extends SceneTree
# godot --headless --path . -s tools/inspect_fox.gd : dump the hearth fox GLB (nodes, bones, clips, extras)
func _init() -> void:
	var scene: Node = (load("res://assets/hero/hearth_fox.glb") as PackedScene).instantiate()
	_walk(scene, 0)
	var ap: AnimationPlayer = scene.find_children("*", "AnimationPlayer", true, false)[0]
	for n in ap.get_animation_list():
		var a := ap.get_animation(n)
		print("clip ", n, " len=", a.length, " loop=", a.loop_mode, " tracks=", a.get_track_count())
	quit()

func _walk(n: Node, d: int) -> void:
	var line := "  ".repeat(d) + n.name + " <" + n.get_class() + ">"
	if n is Node3D: line += " pos=" + str((n as Node3D).position) + " scale=" + str((n as Node3D).scale)
	if n.has_meta("extras"): line += " extras=" + str(n.get_meta("extras"))
	if n is MeshInstance3D:
		var m := (n as MeshInstance3D).mesh
		line += " aabb=" + str(m.get_aabb()) + " surfaces=" + str(m.get_surface_count())
		for s in m.get_surface_count():
			var arr := m.surface_get_arrays(s)
			line += " [s%d verts=%d color=%s uv=%s mat=%s]" % [s, arr[Mesh.ARRAY_VERTEX].size(), arr[Mesh.ARRAY_COLOR] != null, arr[Mesh.ARRAY_TEX_UV] != null, m.surface_get_material(s)]
	if n is Skeleton3D:
		var sk := n as Skeleton3D
		var names := []
		for i in sk.get_bone_count(): names.append(sk.get_bone_name(i))
		line += " bones=" + str(names)
	print(line)
	for c in n.get_children(): _walk(c, d + 1)
