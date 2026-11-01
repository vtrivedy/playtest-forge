class_name Capture
extends Node
## Scripted capture driver (the Godot side of tools/opening-hero-route.mjs + opening-stills.mjs).
## Godot user args (after `--`):
##   --route=hero          drive the fox village → meadow → hearth → updraft → shelf with real inputs
##   --shots=a,b[:full]    render fixed review shots (Opening.SHOTS) and quit
##   --poses=a,b           chase-cam stills at three.js opening-stills poses (fox teleported) and quit
##   --probe               feel probe (same inputs as tools/threejs-feel-probe.mjs); headless is fine
##   --out=DIR             where PNGs + state.jsonl go
## Run under the movie maker for video: godot --path . --write-movie out.avi --fixed-fps 30 -- --route=hero

## fox pose [x, z, yaw] (tools/opening-stills.mjs POSES)
const POSES := {
	spawn = [-6.0, 92.0, PI * 0.92], well = [-5.5, 87.5, PI * 0.75], meadow = [-1.5, 80.0, PI * 0.85],
	hearth = [2.6, 77.5, PI * 0.75], shelf = [3.4, 71.5, PI * 0.55], back = [9.0, 66.0, -0.2], dashstop = [4.3, 72.95, PI * 0.95],
}

var opening: Opening
var out := "/tmp/godot-capture"
var args := {}
var _route: Array = []
var _phase := 0
var _since := 0.0
var _t := 0.0
var _launch_y: Variant = null
var _stills := {}
var _log: FileAccess
var _frame := 0


func _ready() -> void:
	for a in OS.get_cmdline_user_args():
		var kv := a.trim_prefix("--").split("=", true, 1)
		args[kv[0]] = kv[1] if kv.size() > 1 else "1"
	out = args.get("out", out)
	DirAccess.make_dir_recursive_absolute(out)
	opening = get_parent() as Opening
	_log = FileAccess.open(out.path_join("state.jsonl"), FileAccess.WRITE)
	if args.has("shots"):
		_run_shots.call_deferred()
	elif args.has("poses"):
		_run_poses.call_deferred()
	elif args.has("probe"):
		_run_probe.call_deferred()
	elif args.has("route"):
		_route = _hero_route()


func _save(name: String) -> void:
	await RenderingServer.frame_post_draw
	var img := get_viewport().get_texture().get_image()
	img.save_png(out.path_join(name + ".png"))
	_log.store_line(JSON.stringify({still = name, t = snappedf(_t, 0.01), state = opening.state()}))
	print("[capture] ", name)


func _settle(frames: int) -> void:
	for i in frames:
		await get_tree().physics_frame
	await get_tree().process_frame


func _run_shots() -> void:
	await _settle(30)
	var paint: String = "full" if args.get("paint", "") == "full" else "none"
	for name in str(args.shots).split(","):
		opening.fox.set_physics_process(false)
		opening.shot(name, paint)
		await get_tree().process_frame
		await _save("shot-" + name + ("-paint" if paint == "full" else ""))
	get_tree().quit()


func _run_poses() -> void:
	var paint: bool = args.get("paint", "") == "full"
	if paint:
		opening.field.restore(Vector3(-4, 0, 80), 90.0, 0.01, 2.5)
	for name in str(args.poses).split(","):
		var p: Array = POSES[name]
		opening.fox.teleport(p[0], p[1], p[2])
		await _settle(90)
		await _save("pose-" + name + ("-paint" if paint else ""))
	get_tree().quit()


func _ticks(n: int) -> Dictionary:
	for i in n:
		await get_tree().physics_frame
	return opening.fox.state()


## gait bands at fixed stick magnitudes + one full jump: stance-paw slide, speed, apex / air
func _run_probe() -> void:
	var fox := opening.fox
	var out := {}
	await _ticks(2)
	for b in [["walk", 0.15, 3.0], ["trot", 0.35, 3.0], ["run", 1.0, 2.5]]:
		fox.teleport(-1.5, 80.0, PI)
		fox.scripted = {stick = Vector2(0, -b[1])}
		await _ticks(60)
		var slides: Array[float] = []
		var s := {}
		for i in int(b[2] * 60):
			s = await _ticks(1)
			if s.stance_feet > 0:
				slides.append(s.max_slide)
		slides.sort()
		out[b[0]] = {gait = s.gait, speed = s.speed, playback = s.playback, slide_p50 = slides[slides.size() / 2], slide_p95 = slides[int(slides.size() * 0.95)]}
	fox.teleport(-1.5, 80.0, PI)
	fox.scripted = {stick = Vector2(0, -1)}
	await _ticks(60)
	fox.scripted = {stick = Vector2(0, -1), jump = true}
	await _ticks(20)
	fox.scripted = {stick = Vector2(0, -1)}
	var s2 := await _ticks(120)
	out.jump = s2.last_jump
	print("[probe] ", JSON.stringify(out))
	_log.store_line(JSON.stringify({probe = out}))
	get_tree().quit()


## beats: hold (s) | to [x, z] at stick magnitude | lift (ride the column) | jump marks
func _hero_route() -> Array:
	return [
		{beat = "wake in paper", hold = 2.0},
		{beat = "first colour", to = Vector2(-7.2, 88), mag = 0.3},
		{beat = "well path", to = Vector2(-4, 88), mag = 0.55},
		{beat = "through the gate", to = Vector2(-3.2, 80.5), mag = 0.75},
		{beat = "run into the meadow", to = Vector2(-1.5, 72.0), mag = 1.0, jump_at = [1.2, 3.0]},
		{beat = "loop past the groves", to = Vector2(0.5, 68.5), mag = 1.0},
		{beat = "turn toward hearth", to = Vector2(3.4, 72.4), mag = 0.8},
		{beat = "bring the warmth", to = Vector2(4.3, 74.8), mag = 0.4},
		{beat = "hearth lit", hold = 2.5},
		{beat = "ride the warm air", lift = true},
		{beat = "glide to shelf", to = Vector2(13, 75.5), mag = 1.0, glide = true},
		{beat = "shelf landing", hold = 2.5},
		{beat = "shelf overlook", to = Vector2(14, 73), mag = 0.3},
		{beat = "warmth carries on", hold = 3.0, last = true},
	]


func _physics_process(dt: float) -> void:
	if _route.is_empty():
		return
	_t += dt
	_since += dt
	var st := opening.fox
	var pos := st.global_position
	var leg: Dictionary = _route[_phase]
	var advance := false
	if leg.has("hold") and _since >= leg.hold:
		advance = true
	if leg.has("to") and Vector2(pos.x - leg.to.x, pos.z - leg.to.y).length() < (0.7 if leg.get("glide", false) else 0.55):
		advance = true
	if leg.get("lift", false):
		if _launch_y == null:
			_launch_y = pos.y
		if pos.y > _launch_y + 7.1:
			advance = true
	if leg.get("glide", false) and st.grounded and _since > 0.5:
		advance = true
	if advance:
		_log.store_line(JSON.stringify({beat_done = leg.beat, t = snappedf(_t, 0.01), state = opening.state()}))
		if leg.get("last", false):
			get_tree().quit()
			return
		_phase += 1
		_since = 0.0
		leg = _route[_phase]
		print("[route] %.2f %s" % [_t, leg.beat])
	var input := {}
	if not leg.has("hold"):
		var to: Vector2 = Vector2(4.3, 74.8) if leg.get("lift", false) else leg.to
		var d := Vector2(to.x - pos.x, to.y - pos.z)
		var mag: float = minf(0.3, d.length() * 0.7) if leg.get("lift", false) else leg.mag
		input.stick = d.normalized() * mag if d.length() > 0.01 else Vector2.ZERO
		input.jump = leg.get("lift", false) or leg.get("glide", false)
		for jt in leg.get("jump_at", []):
			if _since >= jt and _since < jt + 0.25:
				input.jump = true
	st.scripted = input
	_frame += 1
	if _frame % 15 == 0:
		_log.store_line(JSON.stringify({t = snappedf(_t, 0.01), beat = leg.beat, state = opening.state()}))
	for still in str(args.get("stills", "")).split(",", false):
		var kv := still.split("@")
		if kv.size() == 2 and not _stills.has(kv[0]) and _t >= float(kv[1]):
			_stills[kv[0]] = true
			_save(kv[0])
