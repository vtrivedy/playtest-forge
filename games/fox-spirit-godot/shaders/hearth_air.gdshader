// Warm air over a lit hearth (chem/updraft.ts glow): 28 soft parcels rising through the column,
// billboarded in view space, a wavering russet body with a zero-alpha border (never a tube).
shader_type spatial;
render_mode unshaded, blend_mix, depth_draw_never, cull_disabled, shadows_disabled, skip_vertex_transform;

uniform float time = 0.0;
uniform float heat = 0.0;
uniform float height = 9.0;
uniform float radius = 1.87;
varying float v_life;
varying float v_seed;

void vertex() {
	vec4 seed = CUSTOM0;
	float life = fract(seed.x + time * mix(1.5, 2.7, seed.y) / height);
	float a = seed.z * 6.2832 + life * 2.1 + time * 0.18;
	float r = radius * sqrt(seed.w) * (0.18 + life * 0.55);
	vec3 center = vec3(cos(a) * r, life * height, sin(a) * r);
	center.x += sin(life * 7.0 + time * 0.7 + seed.z * 9.0) * life * 0.28;
	vec4 mv = MODELVIEW_MATRIX * vec4(center, 1.0);
	float size = mix(0.7, 1.25, seed.y) * (0.65 + life * 0.7);
	mv.xy += VERTEX.xy * vec2(size, size * 1.5);
	VERTEX = mv.xyz;
	v_life = life;
	v_seed = seed.z * 17.0;
}

void fragment() {
	vec2 q = (UV - 0.5) * 2.0;
	float warp = sin(q.y * 5.0 - time * 1.9 + v_seed) * 0.12;
	float d = length(vec2(q.x + warp * (1.0 - abs(q.x)), q.y));
	float feather = 1.0 - smoothstep(0.1, 1.0, d);
	float folds = 0.65 + 0.35 * sin(q.y * 7.0 - time * 2.4 + v_seed + q.x * 3.0);
	float life = smoothstep(0.0, 0.16, v_life) * (1.0 - smoothstep(0.55, 1.0, v_life));
	ALBEDO = vec3(0.56, 0.24, 0.075);
	ALPHA = min(1.0, heat) * life * feather * feather * folds * 0.12;
}
