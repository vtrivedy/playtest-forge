class_name Rng
extends RefCounted
## mulberry32, bit-exact with lookdevKit.rng() so groves / jitter land where the three.js slice has them

var _a: int


func _init(seed: int) -> void:
	_a = seed & 0xFFFFFFFF


static func _imul(a: int, b: int) -> int:
	return ((a & 0xFFFF) * b + ((((a >> 16) * b) & 0xFFFF) << 16)) & 0xFFFFFFFF


func f() -> float:
	_a = (_a + 0x6D2B79F5) & 0xFFFFFFFF
	var t := _a
	t = _imul(t ^ (t >> 15), t | 1)
	t = (t ^ ((t + _imul(t ^ (t >> 7), t | 61)) & 0xFFFFFFFF)) & 0xFFFFFFFF
	return float((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296.0
