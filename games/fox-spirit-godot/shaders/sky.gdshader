// Paper sky with sepia ink-wash clouds ↔ painted melancholy dusk with cel-banded clouds
// (lookdevKit.buildSky). `paint` sweeps a ragged front across the dome toward `paint_dir`.
shader_type sky;
#include "res://shaders/noise.gdshaderinc"

uniform vec3 paper_top : source_color = vec3(0.749, 0.663, 0.522);
uniform vec3 paper_hor : source_color = vec3(0.894, 0.824, 0.682);
uniform vec3 ink : source_color = vec3(0.141, 0.086, 0.055);
uniform vec3 top : source_color = vec3(0.478, 0.439, 0.525);
uniform vec3 mid : source_color = vec3(0.71, 0.525, 0.431);
uniform vec3 hor : source_color = vec3(0.863, 0.682, 0.525);
uniform vec3 mist : source_color = vec3(0.847, 0.765, 0.627);
uniform vec3 lit : source_color = vec3(0.894, 0.749, 0.596);
uniform vec3 cmid : source_color = vec3(0.78, 0.604, 0.502);
uniform vec3 shade : source_color = vec3(0.659, 0.518, 0.478);
uniform vec3 sun : source_color = vec3(1.0, 0.761, 0.478);
uniform vec3 sun_dir = vec3(0.7, 0.32, 0.25);
uniform vec2 paint_dir = vec2(0.8, -0.6);
uniform float paint = 0.0;
uniform float time = 0.0;

float cloud(vec2 p) {
	vec2 q = vec2(p.x * 1.5, p.y * 5.0) + vec2(time * 0.004, 0.0);
	q += (vec2(lk_noise(q * 0.6 + 3.1), lk_noise(q * 0.6 - 7.7)) - 0.5) * vec2(0.9, 0.5);
	float band = smoothstep(0.03, 0.16, p.y) * (1.0 - smoothstep(0.34, 0.7, p.y));
	return lk_fbm(q) + band * 0.22 - 0.06;
}

void sky() {
	vec3 d = normalize(EYEDIR);
	float h = d.y;
	float hp = max(h, 0.0);
	vec2 fc = FRAGCOORD.xy;
	float az = atan(d.x, -d.z);
	vec2 p = vec2(az, hp);
	float thr = 0.5 + (lk_noise(vec2(az * 60.0, hp * 160.0)) - 0.5) * 0.035;
	float c0 = cloud(p);
	float c_up = cloud(p + vec2(0.0, 0.035));
	float c_dn = cloud(p - vec2(0.0, 0.035));
	float m_soft = smoothstep(thr - 0.03, thr + 0.07, c0) * smoothstep(0.015, 0.08, h);
	float m_wash = smoothstep(thr - 0.07, thr + 0.05, c0) * smoothstep(0.015, 0.08, h);
	float pool = smoothstep(thr - 0.01, thr + 0.015, c0) * (1.0 - smoothstep(thr + 0.015, thr + 0.06, c0));
	float s = clamp(0.52 + (c_dn - c_up) * 4.5 + (c0 - thr) * 0.8, 0.0, 1.0);
	float b1 = smoothstep(0.34, 0.42, s);
	float b2 = smoothstep(0.6, 0.68, s);
	float sun_side = 0.5 + 0.5 * dot(normalize(d.xz + 1e-4), normalize(sun_dir.xz + 1e-4));
	float tooth = lk_noise(fc * 0.9) * 0.5 + lk_noise(fc * 0.23) * 0.5;
	float fibre = lk_noise(vec2(fc.x * 0.06 + fc.y * 0.025, fc.y * 0.85));
	float wash = lk_fbm(vec2(az * 1.3, hp * 3.0) + 9.0);

	vec3 sk = mix(hor, mid, smoothstep(0.02, 0.25, hp));
	sk = mix(sk, top, smoothstep(0.2, 0.85, hp));
	sk *= 0.93 + 0.12 * wash;
	sk += sun * exp(-abs(h - 0.04) * 10.0) * pow(sun_side, 3.0) * 0.18;
	vec3 cc = mix(shade, cmid, b1);
	cc = mix(cc, lit, b2);
	cc = mix(cc, cc * vec3(1.06, 0.98, 0.9), pow(sun_side, 2.0) * 0.5);
	cc = mix(cc, cc * vec3(0.86, 0.76, 0.72), pool * 0.6);
	vec3 painted = mix(sk, cc, m_soft * 0.85);
	painted *= 0.95 + 0.08 * tooth;

	vec3 pap = mix(paper_hor, paper_top, smoothstep(0.0, 0.8, hp)) * (0.9 + 0.14 * wash);
	pap *= (0.91 + 0.12 * tooth) * (0.96 + 0.07 * fibre);
	float gran = lk_noise(fc * 0.35) * 0.6 + lk_noise(vec2(az * 40.0, hp * 120.0)) * 0.4;
	vec3 sepia_wash = mix(pap, ink * vec3(1.3, 1.1, 0.95), 0.26 + 0.1 * gran);
	vec3 sepia_shade = mix(pap, ink, 0.46 + 0.08 * gran);
	vec3 cw = mix(sepia_shade, sepia_wash, b1);
	cw = mix(cw, pap * vec3(1.05, 1.03, 0.98), b2 * 0.85);
	cw = mix(cw, mix(pap, ink, 0.66), pool * 0.8);
	float hl = fract((fc.x + fc.y + lk_noise(fc * 0.04) * 5.0) * 0.17);
	float lower_rim = smoothstep(0.025, 0.065, c_up - c_dn) * (1.0 - smoothstep(thr + 0.07, thr + 0.14, c0));
	float shade_side = lower_rim * (1.0 - smoothstep(0.24, 0.36, s)) * smoothstep(0.08, 0.18, hp) * (0.35 + 0.65 * (1.0 - sun_side));
	float hatch = smoothstep(0.42, 0.3, hl) * shade_side * (0.55 + 0.45 * lk_noise(vec2(az * 9.0, hp * 30.0)));
	cw = mix(cw, ink * 1.4, hatch * 0.38);
	vec3 unpainted = mix(pap, cw, m_wash * (0.82 + 0.18 * gran));

	float rag = (lk_fbm(vec2(az * 3.0, hp * 6.0)) - 0.5) * 0.5;
	float side = dot(normalize(d.xz + 1e-4), normalize(paint_dir));
	float pm = paint >= 0.999 ? 1.0 : smoothstep(-0.03, 0.03, side - (1.0 - 2.0 * paint) + rag) * step(0.001, paint);
	vec3 col = mix(unpainted, painted, pm);
	col = mix(col, col * vec3(0.72, 0.56, 0.44), pm * (1.0 - pm) * 4.0 * 0.5);
	col = mix(col, mist, 1.0 - smoothstep(-0.01, 0.09 + 0.03 * wash, h));
	COLOR = col;
}
