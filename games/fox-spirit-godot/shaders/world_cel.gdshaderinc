// Pressed Ink → Living Cel world material (lookdevKit.toon + patchPaint + opening/paint TRAIL_BLEND).
// Unpainted: lit luminance → sepia paper with tooth, stains, foxing and pressed-ink hatching.
// Painted: the authored cel colour (3-band toon key) on paper tooth. Edge: ragged watercolour front,
// wet sienna pigment + tide-line. three.js mixes on outgoingLight after lighting; Godot has no hook
// there in fragment(), so the single directional key light builds the final colour in light().
#include "res://shaders/noise.gdshaderinc"

/** linear (Kit.toon converts three hex colours) */
uniform vec3 albedo = vec3(1.0);
uniform bool vertex_colors = false;
/** brushy ink contour where the surface turns away (smooth-normal props) */
uniform float contour = 0.0;
uniform float hatch_weight = 1.0;
/** (base y, rate): the paint front climbs from base so canopies paint bottom-up */
uniform vec2 climb = vec2(0.0);
/** toon ramp stops (three gradientMap texels / 255): world 70/150/255, canopy 118/178/255 */
uniform vec3 ramp = vec3(0.2745, 0.5882, 1.0);
/** rim-leaf cards: discard when seen face-on (only silhouette sprigs survive) */
uniform bool leaf_card = false;
uniform float fade = 0.0;

global uniform vec4 paint_restore_0;
global uniform vec4 paint_restore_1;
global uniform vec4 paint_restore_2;
global uniform vec4 paint_restore_3;
global uniform int paint_restore_count;
global uniform sampler2D trail_map : filter_linear, repeat_disable;
global uniform vec4 trail_bounds;
global uniform float trail_on;
global uniform vec3 paper;
global uniform vec3 paper_ink;

varying vec3 v_world;
varying vec3 v_leaf_out;
// fragment → light
varying vec3 v_albedo;
varying vec3 v_amb;
varying vec4 v_paint; // paint, tide, bloom, tooth
varying vec3 v_paper;
varying vec2 v_misc; // contour amount, cel noise
varying float v_fog;
varying float v_hatch;

void vertex() {
	v_world = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	v_leaf_out = normalize(mat3(MODEL_MATRIX) * vec3(0.0, 1.0, 0.0));
}

float band3(float ndl) {
	float c = ndl * 0.5 + 0.5;
	return c < 1.0 / 3.0 ? ramp.x : (c < 2.0 / 3.0 ? ramp.y : ramp.z);
}

void fragment() {
	if (fade > 0.0 && fade_threshold(FRAGCOORD.xy) < fade * 0.88) discard;
	if (leaf_card && abs(dot(v_leaf_out, normalize(CAMERA_POSITION_WORLD - v_world))) > 0.32) discard;
	vec2 xz = v_world.xz;
	// ragged watercolour front: large lobes + fine fibre bite
	float rag = (lk_fbm(xz * 0.11) - 0.5) * 5.0 + (lk_fbm(xz * 0.55 + 3.7) - 0.5) * 1.8 + (lk_fbm(xz * 2.2 + 9.1) - 0.5) * 0.9 + (lk_noise(xz * 9.0) - 0.5) * 0.22;
	float lift = max(0.0, v_world.y - climb.x) * climb.y;
	float drops = smoothstep(0.7, 0.78, lk_noise(xz * 1.3 + 11.0)) * (1.0 - step(0.2, lift));
	float paint = 0.0, tide = 0.0, bloom = 0.0;
	for (int i = 0; i < 4; i++) {
		if (i >= paint_restore_count) break;
		vec4 r = i == 0 ? paint_restore_0 : (i == 1 ? paint_restore_1 : (i == 2 ? paint_restore_2 : paint_restore_3));
		float d = length(xz - r.xy) - r.z + rag * min(1.0, r.z / 12.0) + lift;
		float e = max(0.06, r.w * 0.16);
		float p = 1.0 - smoothstep(-e, e, d);
		p = max(p, drops * (1.0 - smoothstep(0.0, 2.2, d)) * step(0.5, r.z));
		paint = max(paint, p);
		tide = max(tide, exp(-pow((d + e * 0.9) / (e * 0.9), 2.0)));
		bloom = max(bloom, exp(-pow((d - 0.35 - 0.25 * lk_noise(xz * 1.7)) / 0.3, 2.0)) * step(0.5, r.z));
	}
	if (trail_on > 0.5) {
		vec2 trail_uv = (xz - trail_bounds.xy) / trail_bounds.zw;
		float inside = step(0.0, trail_uv.x) * step(0.0, trail_uv.y) * step(trail_uv.x, 1.0) * step(trail_uv.y, 1.0);
		vec2 bleed = vec2(lk_fbm(xz * 1.2), lk_fbm(xz * 1.2 + 8.7)) - 0.5;
		vec2 uv = clamp(trail_uv + bleed * 0.65 / trail_bounds.zw, 0.0, 1.0);
		float source = texture(trail_map, uv).r * inside;
		source = max(0.0, source - lift * 0.15);
		float fibre = (lk_fbm(xz * 1.8 + 3.7) - 0.5) * 0.3 + (lk_noise(xz * 8.0) - 0.5) * 0.055;
		float front = source + fibre * smoothstep(0.03, 0.15, source);
		float wake = smoothstep(0.19, 0.31, front) * inside;
		float rim = exp(-pow((front - 0.29) / 0.045, 2.0)) * inside;
		tide = max(tide, rim * 0.58 * (1.0 - paint));
		bloom = max(bloom, exp(-pow((front - 0.15) / 0.04, 2.0)) * inside * 0.38 * (1.0 - paint));
		paint = max(paint, wake);
	}
	vec2 fc = FRAGCOORD.xy;
	float tooth = lk_noise(fc * 0.9) * 0.5 + lk_noise(fc * 0.23) * 0.5;
	float fibre = lk_noise(vec2(fc.x * 0.06 + fc.y * 0.025, fc.y * 0.85));
	float stain = lk_fbm(xz * 0.35 + v_world.y * 0.2);
	float foxing = smoothstep(0.8, 0.86, lk_noise(xz * 0.7 + v_world.y * 0.5 + 5.0));
	vec3 pap = paper * (0.84 + 0.26 * stain) * (0.9 + 0.14 * tooth) * (0.96 + 0.07 * fibre);
	pap = mix(pap, pap * vec3(0.82, 0.72, 0.6), foxing * 0.5);

	vec3 base = albedo * (vertex_colors ? COLOR.rgb : vec3(1.0));
	// the lookdev rig's soft lights, analytic (no shadows in three.js either): hemi + fill + rim, toon-banded
	vec3 wn = normalize((INV_VIEW_MATRIX * vec4(NORMAL, 0.0)).xyz);
	vec3 hemi = mix(vec3(0.0685, 0.0395, 0.0212), vec3(1.0, 0.7529, 0.5271), wn.y * 0.5 + 0.5) * 0.7 / PI;
	vec3 fill = vec3(0.5271, 0.2159, 0.0802) * 0.45 / PI * band3(dot(wn, normalize(vec3(-12.0, 7.0, -6.0))));
	vec3 rimc = vec3(1.0, 0.5647, 0.2789) * 1.3 / PI * band3(dot(wn, normalize(vec3(-2.0, 5.0, -14.0))));
	v_albedo = base;
	v_amb = hemi + fill + rimc;
	v_paint = vec4(paint, tide, bloom, tooth);
	v_paper = pap;
	float ndv = abs(dot(normalize(NORMAL), normalize(VIEW)));
	float brush = 0.65 + 0.7 * lk_noise(xz * 2.0 + v_world.y * 3.0);
	float air = 1.0 - ink_air(distance(v_world, CAMERA_POSITION_WORLD));
	v_misc = vec2((1.0 - smoothstep(0.1, 0.1 + 0.22 * brush, ndv)) * contour * air, lk_noise(xz * 2.3));
	v_hatch = hatch_weight * air;
	v_fog = height_fog(v_world, CAMERA_POSITION_WORLD);
	ALBEDO = vec3(1.0);
}

void light() {
	float ndl = dot(NORMAL, LIGHT);
	vec3 col = LIGHT_COLOR / PI;
	if (LIGHT_IS_DIRECTIONAL) {
		vec3 lit = v_albedo * (band3(ndl) * ATTENUATION * col + v_amb);
		float paint = v_paint.x;
		float tide = v_paint.y;
		float bloom = v_paint.z;
		float tooth = v_paint.w;
		float lum = dot(lit, vec3(0.2126, 0.7152, 0.0722));
		float t = clamp(lum / 1.25, 0.0, 1.0);
		vec3 sepia = mix(paper_ink, v_paper, smoothstep(0.02, 0.6, t));
		// pressed-ink hatching: lines thicken with shade, cross-hatch in the deepest band, hand-wobbled
		vec2 fc = FRAGCOORD.xy;
		float wob = lk_noise(fc * 0.04) * 5.0;
		float sh = 1.0 - smoothstep(0.1, 0.42, t);
		float sh2 = 1.0 - smoothstep(0.04, 0.2, t);
		float h1 = fract((fc.x + fc.y + wob) * 0.17);
		float h2 = fract((fc.x - fc.y + wob) * 0.17);
		float l1 = smoothstep(sh * 0.5 + 0.12, sh * 0.5, h1) * smoothstep(0.0, 0.15, sh);
		float l2 = smoothstep(sh2 * 0.45 + 0.12, sh2 * 0.45, h2) * smoothstep(0.0, 0.2, sh2);
		sepia = mix(sepia, paper_ink * 1.25, max(l1 * 0.6, l2 * 0.65) * v_hatch);
		vec3 cel = lit * (0.95 + 0.08 * tooth) * (0.96 + 0.08 * v_misc.y);
		vec3 pigment = vec3(0.42, 0.18, 0.08) * (0.55 + 0.6 * t);
		cel = mix(cel, pigment, tide * 0.7);
		float wet = paint * (1.0 - paint) * 4.0;
		sepia = mix(sepia, paper * 1.12, bloom * (1.0 - sh) * 0.55);
		vec3 o = mix(sepia, cel, paint);
		o = mix(o, pigment, wet * 0.4);
		o = mix(o, paper_ink * 0.8, v_misc.x);
		DIFFUSE_LIGHT += mix(o, fog_color, v_fog);
	} else {
		// hearth / tail glow: banded warmth, full on paint, a paper-warm lift on sepia
		vec3 tint = mix(v_paper * 0.7, v_albedo, v_paint.x);
		DIFFUSE_LIGHT += tint * band3(ndl) * ATTENUATION * col * (1.0 - v_fog);
	}
}
