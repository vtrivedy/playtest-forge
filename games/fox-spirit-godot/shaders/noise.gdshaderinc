// lookdevKit NOISE_GLSL: value noise + 5-octave fbm shared by paper, paint front and sky
float lk_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float lk_noise(vec2 p) {
	vec2 i = floor(p), f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(mix(lk_hash(i), lk_hash(i + vec2(1, 0)), u.x), mix(lk_hash(i + vec2(0, 1)), lk_hash(i + vec2(1, 1)), u.x), u.y);
}
float lk_fbm(vec2 p) {
	float s = 0.0, a = 0.5;
	for (int i = 0; i < 5; i++) { s += a * lk_noise(p); p = p * 2.03 + 17.1; a *= 0.5; }
	return s;
}
// screen-door threshold for occluder fades (opaque pipeline, no sorting): interleaved gradient noise
// broken up by paper-fibre value noise, so a fading wall dissolves like wet paper rather than a grid
float fade_threshold(vec2 fc) {
	float ign = fract(52.9829189 * fract(dot(fc, vec2(0.06711056, 0.00583715))));
	return clamp(ign * 0.7 + lk_noise(fc * 0.35) * 0.3, 0.0, 1.0);
}

// three's height fog (src/render/atmosphere.ts applyHeightFog: height 1, falloff 0.06), applied in
// linear before tonemapping like three; Godot's depth fog reads far denser at the same density.
global uniform vec3 fog_color;
global uniform float fog_density;
float height_fog(vec3 world, vec3 cam) {
	float k = 0.06;
	float h_cam = clamp(cam.y - 1.0, -60.0, 400.0);
	float dy = clamp(world.y - cam.y, -400.0, 400.0);
	float line = abs(dy) > 0.01 ? (1.0 - exp(-k * dy)) / (k * dy) : 1.0;
	float o = fog_density * exp(-k * h_cam) * line * length(world - cam);
	return clamp(1.0 - exp(-o * o * 0.5 - o * 0.5), 0.0, 1.0);
}
