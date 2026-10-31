/** Soft advected heat in fur flow; fxNoise is supplied by the coat shader. */
export const EMBER_FURL_GLSL = /* glsl */ `
float foxHeatStreak(vec3 q) {
  float field = fxNoise(q);
  float streak = smoothstep(0.59, 0.78, field);
  float footprint = length(abs(dFdx(q)) + abs(dFdy(q)));
  // About 60% of the nominal resolved means: no uniformly luminous distant coat.
  return mix(streak, 0.06, smoothstep(0.12, 0.35, footprint));
}
float foxEmberFurls(vec3 metres, float neckFlow, float time) {
  vec3 body = (metres + vec3(0.0, 0.0, time * 0.012)) / vec3(0.02, 0.025, 0.22);
  vec3 neck = (metres - vec3(0.0, time * 0.012, 0.0)) / vec3(0.02, 0.22, 0.025);
  float gate = smoothstep(0.48, 0.72, fxNoise(metres / 0.30 + vec3(3.1, 1.7, 2.3)));
  return mix(foxHeatStreak(body), foxHeatStreak(neck), neckFlow) * gate;
}
`;
