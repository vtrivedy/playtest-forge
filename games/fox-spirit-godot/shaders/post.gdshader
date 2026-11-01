// Post grade (postStack.ts grade pass; bloom + ACES live in the Environment): sepia ↔ restored grade
// (saturation, log contrast, split tone, faded-black lift), warm burnt-edge vignette, shadow-only
// paper grain. Runs on the tonemapped frame, so the grade is gentler than three's linear one.
shader_type canvas_item;

uniform sampler2D screen : hint_screen_texture, filter_linear;
uniform float vignette = 0.3;
uniform float grain = 0.012;
uniform float restore = 0.0;
uniform float time = 0.0;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

void fragment() {
	vec3 c = texture(screen, SCREEN_UV).rgb;
	float sat = mix(0.9, 0.97, restore);
	float contrast = mix(0.93, 1.12, restore);
	float lift = mix(0.012, 0.003, restore);
	vec3 shadow_tint = mix(vec3(0.97, 0.95, 0.98), vec3(0.92, 0.86, 0.97), restore);
	c = clamp(0.5 + (c - 0.5) * contrast, 0.0, 1.0);
	float l = luma(c);
	c = max(mix(vec3(l), c, sat), 0.0);
	c *= mix(shadow_tint, vec3(1.03, 1.0, 0.93), smoothstep(0.1, 0.7, l));
	c += lift * 4.0 * vec3(1.0, 0.84, 0.62) * (1.0 - smoothstep(0.0, 0.5, l));
	float v = smoothstep(0.35, 0.95, distance(SCREEN_UV, vec2(0.5))) * vignette;
	c *= mix(vec3(1.0), vec3(0.72, 0.6, 0.5), v);
	float n = hash(SCREEN_UV * vec2(1280.0, 720.0) + floor(time * 8.0)) - 0.5;
	c *= 1.0 + n * grain * 4.0 * (1.0 - smoothstep(0.1, 0.5, luma(c)));
	COLOR = vec4(c, 1.0);
}
