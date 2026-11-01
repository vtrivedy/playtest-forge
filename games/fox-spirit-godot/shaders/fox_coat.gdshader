// Hearth-fox coat (lookdevFox.coatMaterial): two flat cel tones banded on total light, rust-plum
// shadow tint, pressed-ink hatch in the shadow step, one hard warm rim band, and the ember steps on
// the tail's burn-out third (UV.x = ember mask). The fox never takes the paper grade.
shader_type spatial;
render_mode ambient_light_disabled, specular_disabled;

uniform float ember_gain = 1.7;
varying float v_ember;
varying vec3 v_amb;
varying vec3 v_base;

void vertex() {
	v_ember = UV.x;
}

float ramp_fox(float ndl) {
	float c = ndl * 0.5 + 0.5;
	return c < 1.0 / 3.0 ? 55.0 / 255.0 : (c < 2.0 / 3.0 ? 175.0 / 255.0 : 1.0);
}

void fragment() {
	v_base = COLOR.rgb;
	vec3 wn = normalize((INV_VIEW_MATRIX * vec4(NORMAL, 0.0)).xyz);
	vec3 hemi = mix(vec3(0.0685, 0.0395, 0.0212), vec3(1.0, 0.7529, 0.5271), wn.y * 0.5 + 0.5) * 0.7 / PI;
	vec3 fill = vec3(0.5271, 0.2159, 0.0802) * 0.45 / PI * ramp_fox(dot(wn, normalize(vec3(-12.0, 7.0, -6.0))));
	vec3 rimc = vec3(1.0, 0.5647, 0.2789) * 1.3 / PI * ramp_fox(dot(wn, normalize(vec3(-2.0, 5.0, -14.0))));
	v_amb = hemi + fill + rimc;
	ALBEDO = vec3(1.0);
	float ember_step = 0.35 * step(0.45, v_ember) + 0.65 * step(0.8, v_ember);
	float rim = 1.0 - clamp(dot(normalize(NORMAL), vec3(0.0, 0.0, 1.0)), 0.0, 1.0);
	EMISSION = v_base * ember_step * ember_gain + vec3(1.0, 0.55, 0.22) * smoothstep(0.72, 0.76, rim) * 0.22 * (1.0 - v_ember);
}

void light() {
	vec3 col = LIGHT_COLOR / PI;
	float ndl = dot(NORMAL, LIGHT);
	if (LIGHT_IS_DIRECTIONAL) {
		vec3 lit = v_base * (ramp_fox(ndl) * ATTENUATION * col + v_amb);
		float L = dot(lit, vec3(0.2126, 0.7152, 0.0722)) / max(1e-3, dot(v_base, vec3(0.2126, 0.7152, 0.0722)));
		float shade = smoothstep(0.43, 0.47, L);
		float band = mix(0.6, 1.0, shade);
		vec3 tint = mix(vec3(0.82, 0.58, 0.66), vec3(1.0), shade);
		float hatch = step(0.66, fract((FRAGCOORD.x + FRAGCOORD.y) * 0.16));
		DIFFUSE_LIGHT += v_base * band * tint * (1.0 - 0.18 * hatch * (1.0 - shade));
	} else {
		DIFFUSE_LIGHT += v_base * ramp_fox(ndl) * ATTENUATION * col * 0.5;
	}
}
