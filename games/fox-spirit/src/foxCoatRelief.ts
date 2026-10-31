export const BROAD_FUR_RELIEF_GLSL = /* glsl */ `
// Broad low-amplitude coat relief. Existing fxNoise(vec3) is required.
// restMetres = authored rest position * the validated positive uniform hero scale.
// Noise-cell spans are 3.5cm across / 16cm along; visible clump width is not identical to cell size.
// Height is nominally 1.2mm peak-to-trough at amount1. All derivatives run before discard/branches.
float foxClumpFootprint(vec3 q) {
  return length(abs(dFdx(q)) + abs(dFdy(q)));
}
vec2 foxClumpSlope(vec3 q) {
  float coarse = (fxNoise(q) - 0.5) * 0.0009;
  float fine = (fxNoise(q * 1.7) - 0.5) * 0.0003;
  float coarseResolved = 1.0 - smoothstep(0.20, 0.65, foxClumpFootprint(q));
  float fineResolved = 1.0 - smoothstep(0.20, 0.65, foxClumpFootprint(q * 1.7));
  // Filter slopes, not height: avoid differentiating a screen-dependent fade.
  return vec2(dFdx(coarse), dFdy(coarse)) * coarseResolved
    + vec2(dFdx(fine), dFdy(fine)) * fineResolved;
}
vec3 foxBroadFurNormal(vec3 positionVS, vec3 surfaceNormal, vec3 restMetres,
                      float throatMask, float anatomicalMask, float amount, float faceDirection) {
  vec3 bodyQ = restMetres / vec3(0.035, 0.035, 0.16);
  vec3 throatQ = restMetres / vec3(0.035, 0.16, 0.035);
  // Blend independently oriented slopes; do not warp coordinates through the throat transition.
  vec2 slope = mix(foxClumpSlope(bodyQ), foxClumpSlope(throatQ), clamp(throatMask, 0.0, 1.0));
  vec3 sx = dFdx(positionVS), sy = dFdy(positionVS);
  vec3 rx = cross(sy, surfaceNormal), ry = cross(surfaceNormal, sx);
  float determinant = dot(sx, rx) * faceDirection;
  float derivativeArea = length(sx) * length(sy);
  float condition = abs(determinant) / max(derivativeArea, 1e-20);
  float conditioned = smoothstep(0.05, 0.25, condition);
  vec3 viewDirection = -positionVS / max(length(positionVS), 1e-6);
  float grazingFade = smoothstep(0.05, 0.20, abs(dot(surfaceNormal, viewDirection)));
  vec3 gradient = sign(determinant) * (slope.x * rx + slope.y * ry);
  gradient /= max(abs(determinant), 1e-12);
  gradient -= surfaceNormal * dot(surfaceNormal, gradient);
  // Mask the slope so protected eye/cream/paw borders do not become raised ridges.
  gradient *= conditioned * grazingFade * clamp(anatomicalMask, 0.0, 1.0) * clamp(amount, 0.0, 1.5);
  gradient *= min(1.0, 0.176327 / max(length(gradient), 1e-6)); // tan(10deg)
  return normalize(surfaceNormal - gradient);
}
// Opaque coat only, after normal_fragment_maps and before lighting.
// Preserve the unperturbed normal for existing rim/inner-heat facing calculations.
// anatomicalMask must feather out eyes/socket, cream and paws; current aFurMask is a starting point.
// This alters PBR shading only: it cannot supply fur silhouette or replace the ruff.

`;
