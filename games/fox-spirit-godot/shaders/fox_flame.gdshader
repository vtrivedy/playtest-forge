// Living-cel flame tongue on the tail (lookdevFox.flameMaterial): world-up billboard anchored on a
// bone, hard 3-tone cel flame (rust rim → ember → amber core), licking upward, leaning against motion.
shader_type spatial;
render_mode unshaded, cull_disabled, shadows_disabled;

uniform vec2 size = vec2(0.15, 0.3);
uniform float seed = 0.0;
uniform vec3 lean = vec3(0.0);
uniform float time = 0.0;

void vertex() {
	vec3 c = (MODEL_MATRIX * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
	vec3 right = INV_VIEW_MATRIX[0].xyz;
	float y = 1.0 - UV.y;
	vec3 p = c + right * (UV.x - 0.5) * size.x + vec3(0.0, 1.0, 0.0) * y * size.y + lean * y * y * size.y;
	POSITION = PROJECTION_MATRIX * VIEW_MATRIX * vec4(p, 1.0);
}

void fragment() {
	float y = 1.0 - UV.y;
	float t = time + seed * 7.0;
	float x = UV.x - 0.5 + sin(y * 6.0 - t * 5.0) * 0.09 * y + sin(y * 13.0 - t * 9.0 + seed) * 0.03 * y;
	float w = 0.5 * pow(max(0.0, 1.0 - y), 0.75) * smoothstep(0.0, 0.18, y + 0.04);
	float h = 0.82 + 0.18 * sin(t * 3.1 + seed * 3.0) * sin(t * 1.7);
	w *= step(y, h) * (1.0 - smoothstep(h - 0.3, h, y) * 0.6);
	float split = smoothstep(0.55, 0.9, y) * 0.22 * (0.5 + 0.5 * sin(t * 2.3));
	float d = min(abs(x - split * 0.5), abs(x + split * 0.5) + 0.04 * step(0.6, y));
	float f = d / max(w, 1e-3);
	if (f > 1.0) discard;
	vec3 rust = vec3(0.42, 0.09, 0.03);
	vec3 ember = vec3(0.86, 0.24, 0.04);
	vec3 core = vec3(1.0, 0.46, 0.1);
	vec3 col = f > 0.78 ? rust : (f > 0.45 || y > h * 0.65 ? ember : core);
	ALBEDO = col * 1.1;
}
