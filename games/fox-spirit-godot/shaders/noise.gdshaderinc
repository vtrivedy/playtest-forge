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
// ordered 4×4 Bayer threshold for screen-door occluder fades (opaque pipeline, no sorting)
float bayer4(vec2 fc) {
	ivec2 p = ivec2(mod(fc, 4.0));
	int i = p.x + p.y * 4;
	int m[16] = int[](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
	return (float(m[i]) + 0.5) / 16.0;
}
