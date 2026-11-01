// Hearth flame (chem/updraft.ts): crossed quads with an animated teardrop, height scaled by heat,
// additive and dim per tongue so ten overlapping quads never bloom white. CUSTOM0.x = tongue phase.
shader_type spatial;
render_mode unshaded, blend_add, depth_draw_never, cull_disabled, shadows_disabled;

uniform float time = 0.0;
uniform float heat = 0.0;
varying float v_ph;

void vertex() {
	v_ph = CUSTOM0.x;
	VERTEX.y *= max(0.001, heat);
}

void fragment() {
	float y = 1.0 - UV.y;
	float t = time + v_ph;
	float x = (UV.x - 0.5) * 2.0;
	float sway = 0.16 * sin(t * 9.0 + y * 6.0) * y;
	float w = (1.0 - y) * (0.55 + 0.25 * sin(t * 13.0 + y * 11.0));
	float d = abs(x + sway) / max(0.02, w);
	float a = (1.0 - smoothstep(0.4, 1.0, d)) * smoothstep(0.0, 0.08, y) * (1.0 - smoothstep(0.55, 1.0, y));
	vec3 col = mix(vec3(1.0, 0.45, 0.12), vec3(0.85, 0.16, 0.02), smoothstep(0.0, 0.5, y + d * 0.35));
	float k = a * min(1.0, heat) * 0.8;
	ALBEDO = col * 0.7 * k;
	ALPHA = k;
}
