class_name Kit
extends RefCounted
## Pressed Ink → Living Cel kit: world/ink materials and mesh building (lookdevKit.toon / inked),
## plus village.ts's Kit — vertex-coloured parts placed in a frame stack and merged into one mesh.
## Ink width rides per vertex in CUSTOM0.w (with the welded smooth normal in xyz), so a merged
## group keeps every part's ink weight and the hull is a single next_pass.

const WORLD_SHADER := preload("res://shaders/world_cel.gdshader")
const INK_SHADER := preload("res://shaders/ink_hull.gdshader")
const RAMP_WORLD := Vector3(70.0 / 255.0, 150.0 / 255.0, 1.0)
const RAMP_CANOPY := Vector3(118.0 / 255.0, 178.0 / 255.0, 1.0)

static var _ink := {}

var _p := PackedVector3Array()
var _n := PackedVector3Array()
var _c := PackedColorArray()
var _h := PackedFloat32Array()
## parent transform for following adds
var frame := Transform3D.IDENTITY


## three hex colour → linear (three's ColorManagement does the same for hex inputs)
static func lin(hex: int) -> Color:
	return Color.hex((hex << 8) | 0xFF).srgb_to_linear()


static func euler(r: Vector3) -> Basis:
	# three Euler 'XYZ': R = Rx · Ry · Rz
	return Basis(Vector3.RIGHT, r.x) * Basis(Vector3.UP, r.y) * Basis(Vector3.BACK, r.z)


static func toon(color: Variant = 0xffffff, opts := {}) -> ShaderMaterial:
	var m := ShaderMaterial.new()
	m.shader = WORLD_SHADER
	# hex = sRGB (three hex); a Color is linear (three Color maths, e.g. tone.multiplyScalar)
	var c: Color = (color as Color).linear_to_srgb() if color is Color else Color.hex((int(color) << 8) | 0xFF)
	m.set_shader_parameter("albedo", c)
	m.set_shader_parameter("vertex_colors", opts.get("vertex_colors", false))
	m.set_shader_parameter("contour", opts.get("contour", 0.0))
	m.set_shader_parameter("hatch_weight", opts.get("hatch_weight", 1.0))
	if opts.has("climb_base"):
		m.set_shader_parameter("climb", Vector2(opts.climb_base, 0.35))
	m.set_shader_parameter("ramp", opts.get("ramp", RAMP_WORLD))
	m.set_shader_parameter("leaf_card", opts.get("leaf_card", false))
	return m


static func ink_material(brush := false) -> ShaderMaterial:
	if not _ink.has(brush):
		var m := ShaderMaterial.new()
		m.shader = INK_SHADER
		m.set_shader_parameter("brush", brush)
		_ink[brush] = m
	return _ink[brush]


## mesh with an ink hull pass (lookdevKit.inked); `geo` keeps its own colours if it has them
static func inked(geo: Geo, mat: ShaderMaterial, width := 0.018, brush := false, color := Color(1, 1, 1)) -> MeshInstance3D:
	var k := Kit.new()
	k.add_geo(geo, color, width)
	var mi := MeshInstance3D.new()
	mi.mesh = k.build_mesh()
	var m := mat.duplicate() as ShaderMaterial
	m.next_pass = ink_material(brush)
	mi.material_override = m
	return mi


## plain mesh, no ink (ground, grass, ridges)
static func plain(geo: Geo, mat: ShaderMaterial, color := Color(1, 1, 1)) -> MeshInstance3D:
	var mi := inked(geo, mat, 0.0, false, color)
	mi.material_override.next_pass = null
	return mi


## add an already-placed geo in the current frame; colour = linear vertex colour unless geo has its own
func add_geo(geo: Geo, color: Color, ink: float) -> void:
	var ids := geo.weld(1e-3)
	var count := 0
	for id in ids:
		count = maxi(count, id + 1)
	var hull := geo.smooth_normals_of(ids, count)
	var nb := frame.basis.inverse().transposed()
	var own := geo.c.size() == geo.p.size()
	# three winds counter-clockwise; Godot's front faces are clockwise → emit (a, c, b)
	for i in range(0, geo.p.size(), 3):
		for j in [0, 2, 1]:
			var k: int = i + j
			_p.append(frame * geo.p[k])
			_n.append((nb * geo.n[k]).normalized())
			_c.append(geo.c[k] if own else color)
			var hn := (nb * hull[k]).normalized()
			_h.append(hn.x)
			_h.append(hn.y)
			_h.append(hn.z)
			_h.append(ink)


## village Kit.add: geo placed at `at` / euler `rot` / `scale` inside the frame, flat hex colour
func add(geo: Geo, hex: int, at := Vector3.ZERO, rot := Vector3.ZERO, ink := 0.016, scl := Vector3.ONE) -> void:
	var prev := frame
	frame = frame * Transform3D(euler(rot).scaled_local(scl), at)
	add_geo(geo, lin(hex), ink)
	frame = prev


## run `fn` with parts placed relative to (x, y, z, yaw)
func at(x: float, y: float, z: float, yaw: float, fn: Callable) -> void:
	var prev := frame
	frame = frame * Transform3D(Basis(Vector3.UP, yaw), Vector3(x, y, z))
	fn.call()
	frame = prev


func is_empty() -> bool:
	return _p.is_empty()


func build_mesh() -> ArrayMesh:
	var arrays := []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = _p
	arrays[Mesh.ARRAY_NORMAL] = _n
	arrays[Mesh.ARRAY_COLOR] = _c
	arrays[Mesh.ARRAY_CUSTOM0] = _h
	var mesh := ArrayMesh.new()
	var fmt := Mesh.ARRAY_CUSTOM_RGBA_FLOAT << Mesh.ARRAY_FORMAT_CUSTOM0_SHIFT
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays, [], {}, fmt)
	return mesh


## one vertex-coloured toon mesh with its ink hull (village groups)
func build(material: ShaderMaterial = null) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.mesh = build_mesh()
	var m := material if material else toon(0xffffff, {vertex_colors = true})
	m.next_pass = ink_material(false)
	mi.material_override = m
	_p = PackedVector3Array()
	_n = PackedVector3Array()
	_c = PackedColorArray()
	_h = PackedFloat32Array()
	return mi
