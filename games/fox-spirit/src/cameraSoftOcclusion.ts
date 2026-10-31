import * as THREE from 'three';

/** Opt-in alpha attenuation for custom foreground volumes; never changes actor presence. */
export function heroSoftUniforms() {
  return { uCameraHero: { value: new THREE.Vector4(-10000, -10000, -10000, 0) },
    uCameraHeroRadius: { value: new THREE.Vector2(1, 1) }, uCameraHeroEnabled: { value: 0 } };
}
export const HERO_SOFT_VERTEX = 'varying float vCameraOccluderDepth;';
export const HERO_SOFT_FRAGMENT = /* glsl */ `
  uniform vec4 uCameraHero;
  uniform vec2 uCameraHeroRadius;
  uniform float uCameraHeroEnabled;
  varying float vCameraOccluderDepth;
  float cameraHeroAlpha() {
    float radius = length((gl_FragCoord.xy - uCameraHero.xy) / max(uCameraHeroRadius, vec2(1.0)));
    float silhouette = 1.0 - smoothstep(0.45, 0.70, radius);
    float foreground = smoothstep(0.02, 0.35, uCameraHero.z - vCameraOccluderDepth);
    float nearLens = smoothstep(0.3, 1.2, vCameraOccluderDepth);
    return mix(1.0, nearLens * (1.0 - 0.85 * silhouette * foreground), uCameraHeroEnabled);
  }`;

export function bindHeroSoftOccluder(material: THREE.Material, focus: { value: THREE.Vector4 }, radius: { value: THREE.Vector2 }) {
  const shader = material as THREE.ShaderMaterial;
  if (!shader.isShaderMaterial || !shader.userData.heroSoftOccluder) return false;
  shader.uniforms.uCameraHero = focus;
  shader.uniforms.uCameraHeroRadius = radius;
  return true;
}
