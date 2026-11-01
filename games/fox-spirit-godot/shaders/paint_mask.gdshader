// ColorField trail mask (src/render/colorField.ts stamp pass): top-down over the field bounds, the
// max of every aura / trail / stroke stamp. three.js draws instanced quads with a MAX blend; a canvas
// has no MAX blend, so one full-rect pass loops the stamp list instead (≤ 128 stamps).
shader_type canvas_item;
render_mode blend_disabled;

uniform vec4 bounds; // minX, minZ, width, depth
uniform int count = 0;
uniform vec4 stamps[128]; // x, z, size (diameter), strength
uniform vec2 shape[128]; // noise, inner

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
	vec2 i = floor(p); vec2 f = fract(p);
	float a = hash(i), b = hash(i + vec2(1., 0.)), c = hash(i + vec2(0., 1.)), d = hash(i + vec2(1., 1.));
	vec2 u = f * f * (3. - 2. * f);
	return mix(a, b, u.x) + (c - a) * u.y * (1. - u.x) + (d - b) * u.x * u.y;
}

void fragment() {
	vec2 world = bounds.xy + UV * bounds.zw;
	float ink = 0.0;
	for (int i = 0; i < 128; i++) {
		if (i >= count) break;
		vec4 s = stamps[i];
		vec2 p = (world - s.xy) / (s.z * 0.5);
		float r = length(p);
		if (r >= 1.0) continue;
		float n = ((noise(world * 0.55) - 0.5) * 1.6 + (noise(world * 2.1) - 0.5) * 0.7) * shape[i].x;
		float soft = 1.0 - smoothstep(shape[i].y, 0.88, r + n);
		soft *= 1.0 - smoothstep(0.82, 1.0, r);
		ink = max(ink, soft * soft * (3.0 - 2.0 * soft) * s.w);
	}
	COLOR = vec4(ink, ink, 0.0, 1.0);
}
