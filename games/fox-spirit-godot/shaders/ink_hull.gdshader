// Inverted-hull ink (lookdevKit.inkMaterial): back faces pushed out along the smoothed normal,
// thicker with distance (≈ constant px). Used as next_pass; CUSTOM0 = (smooth normal, width).
shader_type spatial;
render_mode unshaded, cull_front, shadows_disabled;
#include "res://shaders/noise.gdshaderinc"

uniform vec3 ink : source_color = vec3(0.141, 0.086, 0.055);
/** width from the material instead of CUSTOM0 (skinned fox: NORMAL is already smooth) */
uniform float width_override = 0.0;
/** swell / thin the stroke along the surface so world ink reads hand-inked */
uniform bool brush = false;

void vertex() {
	vec3 nrm = width_override > 0.0 ? NORMAL : CUSTOM0.xyz;
	float w = width_override > 0.0 ? width_override : CUSTOM0.w;
	vec3 wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	float d = distance(wp, CAMERA_POSITION_WORLD);
	float b = brush ? 0.55 + 0.9 * (0.5 + 0.5 * sin(wp.x * 3.1 + sin(wp.y * 2.3 + wp.z * 1.7) * 2.0)) : 1.0;
	VERTEX += normalize(nrm) * w * b * clamp(d * 0.09, 0.45, 5.0);
}

void fragment() {
	ALBEDO = ink;
}
