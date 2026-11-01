// Paper sky with sepia ink-wash clouds ↔ painted melancholy dusk with cel-banded clouds
// (lookdevKit.buildSky). `paint` sweeps a ragged front across the dome toward `paint_dir`.
shader_type sky;
// colours are linear (three hex → linear), no source_color hints
#include "res://shaders/noise.gdshaderinc"

uniform vec3 paper_top = vec3(0.5210, 0.3971, 0.2350);
uniform vec3 paper_hor = vec3(0.7756, 0.6453, 0.4228);
uniform vec3 ink = vec3(0.0176, 0.0080, 0.0044);
uniform vec3 top = vec3(0.1942, 0.1619, 0.2379);
uniform vec3 mid = vec3(0.4624, 0.2379, 0.1556);
uniform vec3 hor = vec3(0.7162, 0.4228, 0.2379);
uniform vec3 mist = vec3(0.6866, 0.5462, 0.3510);
uniform vec3 lit = vec3(0.7756, 0.5210, 0.3139);
uniform vec3 cmid = vec3(0.5705, 0.3232, 0.2159);
uniform vec3 shade = vec3(0.3918, 0.2311, 0.1942);
uniform vec3 sun = vec3(1.0000, 0.5398, 0.1942);
uniform vec3 sun_dir = vec3(0.7, 0.32, 0.25);
uniform vec2 paint_dir = vec2(0.8, -0.6);
uniform float paint = 0.0;
uniform float time = 0.0;

// Compatibility draws the sky after the scene's tonemap/sRGB step (measured: output ≈ linear × exposure),
// so the sky applies three's ACESFilmic (exposure 1.1) and the sRGB encode itself.
vec3 rrt_odt(vec3 v) {
	vec3 a = v * (v + 0.0245786) - 0.000090537;
	vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
	return a / b;
}
vec3 display(vec3 c) {
	c *= 1.1 / 0.6;
	c = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777)) * c;
	c = rrt_odt(c);
	c = clamp(mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602)) * c, 0.0, 1.0);
	return mix(1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, c * 12.92, step(c, vec3(0.0031308))) / 1.1;
}

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
	COLOR = display(col);
}
