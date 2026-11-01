class_name Tunables
extends CanvasLayer
## Feel panel (lookdevPlay.ts `?gui` lil-gui): F1 toggles live sliders for the controller, glide /
## dash, updraft and camera tunables. Hidden by default; never shown in captures.

var _box: VBoxContainer


func _init(fox: FoxController, hearth: Hearth, cam: ChaseCam) -> void:
	layer = 10
	visible = false
	var panel := PanelContainer.new()
	panel.position = Vector2(8, 8)
	add_child(panel)
	var scroll := ScrollContainer.new()
	scroll.custom_minimum_size = Vector2(300, 500)
	panel.add_child(scroll)
	_box = VBoxContainer.new()
	scroll.add_child(_box)
	_title("move")
	for p in [["run_speed", 1.5, 6], ["walk_speed", 0.3, 1.5], ["accel", 1, 10], ["decel", 1, 12], ["turn_slow", 2, 12], ["turn_fast", 1, 8]]:
		_slider(fox, p[0], p[1], p[2])
	_title("jump")
	for p in [["jump_velocity", 2, 9], ["gravity", 6, 30], ["fall_gravity", 1, 2.5], ["jump_cut", 0.2, 1], ["air_control", 0, 5], ["coyote", 0, 0.25], ["buffer", 0, 0.25]]:
		_slider(fox, p[0], p[1], p[2])
	_title("glide + dash")
	for p in [["glide_sink", 0.5, 3], ["dash_speed", 4, 12], ["dash_duration", 0.1, 0.4], ["dash_cooldown", 0.2, 1.5]]:
		_slider(fox, p[0], p[1], p[2])
	_dict_slider(hearth.tun, "max_rise", 2, 12)
	_dict_slider(hearth.tun, "lift_response", 1, 12)
	_title("clips + IK")
	for p in [["min_rate", 0.3, 1], ["max_rate", 1, 2.5], ["turn_bank", 0, 0.15]]:
		_slider(fox, p[0], p[1], p[2])
	_slider(fox.visual.foot_ik, "max_lock", 0, 0.15)
	_title("camera")
	for p in [["distance", 1.5, 7], ["height", 0.3, 3], ["lag", 0, 0.5], ["side_bias", -1, 1]]:
		_slider(cam, p[0], p[1], p[2])


func _unhandled_input(e: InputEvent) -> void:
	if e is InputEventKey and e.pressed and not e.echo and e.keycode == KEY_F1:
		visible = not visible


func _title(t: String) -> void:
	var l := Label.new()
	l.text = t
	_box.add_child(l)


func _row(label: String, value: float, lo: float, hi: float, set_fn: Callable) -> void:
	var row := HBoxContainer.new()
	var l := Label.new()
	l.text = label
	l.custom_minimum_size.x = 120
	var s := HSlider.new()
	s.min_value = lo
	s.max_value = hi
	s.step = (hi - lo) / 200.0
	s.value = value
	s.custom_minimum_size.x = 120
	var v := Label.new()
	v.text = "%.2f" % value
	s.value_changed.connect(func(x: float) -> void:
		set_fn.call(x)
		v.text = "%.2f" % x)
	row.add_child(l)
	row.add_child(s)
	row.add_child(v)
	_box.add_child(row)


func _slider(o: Object, prop: String, lo: float, hi: float) -> void:
	_row(prop, o.get(prop), lo, hi, func(x: float) -> void: o.set(prop, x))


func _dict_slider(d: Dictionary, key: String, lo: float, hi: float) -> void:
	_row(key, d[key], lo, hi, func(x: float) -> void: d[key] = x)
