class_name Opening
extends Node3D
## The Keeping — opening slice (opening/scene.ts): wake in the sepia village of Lanternhollow, carry
## the paint down the hub path into Arrival Meadow, light the cold hearth H-a and ride its heat onto
## the rock shelf. Pressed Ink → Living Cel kit, hearth-fox B, chase camera with occluder fade.

## fixed review cameras for art checks (scene.ts SHOTS)
const SHOTS := {
	hub = [Vector3(-1.5, 4.2, 101), Vector3(-11, 1.2, 86), 50.0],
	cottage = [Vector3(-13.2, 1.7, 98.8), Vector3(-18.4, 2.0, 92), 50.0],
	well = [Vector3(-4.2, 1.5, 89.2), Vector3(-8, 1.1, 85), 50.0],
	lane = [Vector3(-11.5, 1.4, 89.6), Vector3(-28, 1.8, 85.5), 50.0],
	meadow = [Vector3(-4.5, 3.2, 91), Vector3(6, 1, 74), 50.0],
	gate = [Vector3(-4.9, 1.3, 88.6), Vector3(-2.9, 1.5, 81), 50.0],
	aerial = [Vector3(-4, 46, 122), Vector3(-4, 0, 82), 45.0],
	overview = [Vector3(-34, 26, 112), Vector3(4, 0, 76), 50.0],
	village = [Vector3(6, 7, 66), Vector3(-10, 1, 92), 50.0],
}
const PAPER_MIST := Color(0.847, 0.765, 0.627)
const AUTUMN_MIST := Color(0.788, 0.651, 0.549)

var ctx: Ctx
var fox: FoxController
var cam: ChaseCam
var field: ColorField
var hearth: Hearth
var occlusion: Occlusion
var env: Environment
var sky_mat: ShaderMaterial
var key: DirectionalLight3D
var post: ShaderMaterial
var hud: Label
var time := 0.0
var elapsed := 0.0


func _ready() -> void:
	process_physics_priority = 10
	var t0 := Time.get_ticks_msec()
	_build_environment()
	ctx = Ctx.new(self)
	Meadow.build(ctx)
	Village.build(ctx)
	_build_colliders()
	field = ColorField.new()
	add_child(field)
	hearth = Hearth.new()
	add_child(hearth)
	hearth.setup(Layout.ground_h(Layout.HEARTH_A.x, Layout.HEARTH_A.z))
	hearth.ignited.connect(func(at: Vector3) -> void: field.restore(at, 12.0, 1.8, 1.4))
	cam = ChaseCam.new()
	cam.near = 0.1
	cam.far = 900.0
	add_child(cam)
	cam.make_current()
	fox = FoxController.new()
	fox.cam = cam
	fox.hearth = hearth
	add_child(fox)
	fox.teleport(Layout.SPAWN.x, Layout.SPAWN.z, Layout.SPAWN.yaw)
	occlusion = Occlusion.new()
	add_child(occlusion)
	occlusion.setup(ctx.occluders, self)
	_build_overlay()
	add_child(Tunables.new(fox, hearth, cam))
	# art debugging: -- --off=glow,fog,post
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--off="):
			var off := a.trim_prefix("--off=").split(",")
			env.glow_enabled = env.glow_enabled and not off.has("glow")
			if off.has("fog"):
				RenderingServer.global_shader_parameter_set("fog_density", 0.0)
			(post.get_meta("rect") as CanvasItem).visible = not off.has("post")
	if not OS.get_cmdline_user_args().is_empty():
		add_child(Capture.new())
	print("[opening] built in %d ms" % (Time.get_ticks_msec() - t0))


func _build_environment() -> void:
	env = Environment.new()
	sky_mat = ShaderMaterial.new()
	sky_mat.shader = preload("res://shaders/sky.gdshader")
	var sky := Sky.new()
	sky.sky_material = sky_mat
	sky.process_mode = Sky.PROCESS_MODE_REALTIME
	env.background_mode = Environment.BG_SKY
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color.BLACK
	env.reflected_light_source = Environment.REFLECTION_SOURCE_DISABLED
	env.tonemap_mode = Environment.TONE_MAPPER_ACES
	env.tonemap_exposure = 1.1
	# three's ACESFilmic has no white normalisation; Godot's default white = 1 lifts every mid-tone
	env.tonemap_white = 16.0
	env.glow_enabled = true
	env.glow_intensity = 0.25
	env.glow_bloom = 0.0
	env.glow_hdr_threshold = 1.2
	env.glow_blend_mode = Environment.GLOW_BLEND_MODE_ADDITIVE
	var we := WorldEnvironment.new()
	we.environment = env
	add_child(we)
	key = DirectionalLight3D.new()
	key.light_color = Color(1.0, 0.902, 0.769)
	key.light_energy = 2.8 / PI
	key.shadow_enabled = true
	key.shadow_bias = 0.03
	key.shadow_normal_bias = 1.2
	key.directional_shadow_mode = DirectionalLight3D.SHADOW_PARALLEL_2_SPLITS
	key.directional_shadow_max_distance = 45.0
	add_child(key)
	key.look_at_from_position(Vector3(14, 16, 6), Vector3.ZERO)


func _build_colliders() -> void:
	var body := StaticBody3D.new()
	body.name = "world-colliders"
	body.collision_layer = 1
	add_child(body)
	var ground: MeshInstance3D = get_node("ground")
	var gs := CollisionShape3D.new()
	gs.shape = ground.mesh.create_trimesh_shape()
	body.add_child(gs)
	for c in ctx.colliders:
		var cs := CollisionShape3D.new()
		var gy := Layout.ground_h(c.x, c.z)
		match c.kind:
			"box":
				var bottom := gy - 1.0
				var b := BoxShape3D.new()
				b.size = Vector3(c.hx * 2.0, c.top - bottom, c.hz * 2.0)
				cs.shape = b
				cs.transform = Transform3D(Basis(Vector3.UP, c.yaw), Vector3(c.x, (c.top + bottom) / 2.0, c.z))
			"post":
				var p := CylinderShape3D.new()
				p.radius = c.r
				p.height = 8.0
				cs.shape = p
				cs.position = Vector3(c.x, gy + 3.0, c.z)
			"cap":
				var p := CylinderShape3D.new()
				p.radius = c.r * 0.8
				p.height = c.h * 1.8
				cs.shape = p
				cs.position = Vector3(c.x, c.base, c.z)
		body.add_child(cs)


func _build_overlay() -> void:
	var layer := CanvasLayer.new()
	add_child(layer)
	var rect := ColorRect.new()
	rect.set_anchors_preset(Control.PRESET_FULL_RECT)
	rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	post = ShaderMaterial.new()
	post.shader = preload("res://shaders/post.gdshader")
	rect.material = post
	post.set_meta("rect", rect)
	layer.add_child(rect)
	hud = Label.new()
	hud.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	hud.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	hud.position = Vector2(-300, -76)
	hud.size = Vector2(600, 36)
	hud.add_theme_color_override("font_color", Color(0.957, 0.898, 0.796))
	hud.add_theme_font_size_override("font_size", 16)
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.169, 0.137, 0.118, 0.76)
	sb.set_corner_radius_all(5)
	sb.content_margin_left = 18
	sb.content_margin_right = 18
	sb.content_margin_top = 8
	sb.content_margin_bottom = 8
	hud.add_theme_stylebox_override("normal", sb)
	hud.modulate.a = 0.0
	layer.add_child(hud)


func _physics_process(dt: float) -> void:
	time += dt
	elapsed += dt
	var p := fox.global_position
	hearth.update(dt, time, field.sample, p, fox.dashing)
	field.step(dt, p)
	for fn in ctx.updates:
		fn.call(dt, time)
	# art shots park the fox; the chase cutout only runs behind a live chase camera
	if fox.is_physics_processing():
		occlusion.update(dt, cam, p)
	_grade(field.paint_k())
	var near := Vector2(p.x - Layout.HEARTH_A.x, p.z - Layout.HEARTH_A.z).length() < 12.0
	hud.text = "The warmth carries on." if hearth.complete else ("Space · jump and hold to ride the warm air" if hearth.latched else "Bring your colour to the cold hearth · run close or Shift dash")
	hud.modulate.a = move_toward(hud.modulate.a, 1.0 if near and elapsed > 2.0 else 0.0, dt * 2.5)


## world grade follows how much of the slice the fox has painted
func _grade(k: float) -> void:
	sky_mat.set_shader_parameter("paint", k)
	sky_mat.set_shader_parameter("time", time)
	var mist := PAPER_MIST.lerp(AUTUMN_MIST, k).srgb_to_linear()
	RenderingServer.global_shader_parameter_set("fog_color", Vector3(mist.r, mist.g, mist.b))
	key.light_color = Color(1.0, 0.902, 0.769).lerp(Color(1.0, 0.839, 0.69), k)
	post.set_shader_parameter("restore", k)
	post.set_shader_parameter("time", time)


## frame a fixed review camera (scene.ts shot); paint "full" floods the slice. The chase cutout is
## parked (nothing fades for an art camera), as three's shot() renders before occlusion runs.
func shot(name: String, paint := "none") -> void:
	fox.set_physics_process(false)
	occlusion.clear()
	var s: Array = SHOTS[name]
	cam.global_position = s[0]
	cam.look_at(s[1])
	cam.fov = s[2]
	if paint == "full" and field.restores.is_empty():
		field.restore(Vector3(-4, 0, 84), 200.0, 0.01, 2.5)


## the harness surface (window.__game equivalent)
func state() -> Dictionary:
	return {mode = "opening", fox = fox.state(), opening = {hearth = hearth.state(), paint = field.state(), visibility = occlusion.state(), restores = field.restores.size()}}
