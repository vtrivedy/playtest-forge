/**
 * Ink as a material (DESIGN-sumiro-look.md): a wash chained after the paper patch (lookdevKit.patchPaint), so paint,
 * contour and snow keep working. Pigment granulates in a world-space fbm, dried wash blotches leave tide-lines,
 * shadows go violet-grey, and faces that stand up drip: streaks run down from the top lip, darkest where they start.
 * Build-time only; the shader does all the work.
 */
import * as THREE from 'three';
import { toon } from './lookdevKit';

export type WashOpts = {
  /** wash blotch scale (1/m) */
  scale?: number;
  /** tide-line strength 0..1 */
  tide?: number;
  /** drip strength on vertical faces 0..1 */
  drip?: number;
  /** ink blots splattered on upward faces 0..1 (ground) */
  splat?: number;
  /** dark albedo lays down as flat ink after lighting (sumi-e: pigment, not shading) 0..1 */
  density?: number;
  /** the ink the wash dries to */
  ink?: number;
  /** the hue shadows lean to */
  shade?: number;
  vertexColors?: boolean;
  contour?: number;
  side?: THREE.Side;
};

const WASH_GLSL = /* glsl */ `
{
  vec3 wN = normalize(normal * mat3(viewMatrix));
  float vert = 1.0 - abs(wN.y);
  vec3 wp = vLkWorld;
  // walls take their wash on (along-face, height); tops on the ground plane
  float along = wp.x * wN.z - wp.z * wN.x;
  vec2 uv = mix(wp.xz, vec2(along, wp.y * 0.8), step(0.55, vert));
  float g = lkFbm(uv * uWashA.x + 4.3);
  float gran = lkNoise(uv * 6.5) * 0.5 + lkNoise(uv * 21.0 + 2.0) * 0.5;
  float tideL = (1.0 - smoothstep(0.0, 0.02, abs(g - 0.53 + (gran - 0.5) * 0.03))) * smoothstep(0.3, 0.7, lkNoise(uv * 0.13 + 5.0));
  vec3 c = outgoingLight;
  float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float alb = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
  float dens = (1.0 - smoothstep(0.03, 0.14, alb)) * uWashDensity;
  c = mix(c, uWashInk * (0.75 + 0.5 * min(lum, 1.0)) * (0.85 + 0.3 * gran), dens);
  lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
  // mid shadows lean violet; true ink stays ink
  c = mix(c, uWashShade * (0.35 + lum), smoothstep(0.04, 0.16, lum) * (1.0 - smoothstep(0.16, 0.55, lum)) * 0.5);
  c *= 0.84 + 0.28 * g;
  c *= 0.92 + 0.12 * gran;
  c = mix(c, uWashInk, tideL * uWashA.y * 0.45);
  // drips: thin vertical streaks of varying length hanging from the upper lip of a standing face
  float lane = floor(along * 3.2);
  float laneN = lkHash(vec2(lane, 7.0));
  float fall = fract(along * 3.2);
  float strand = smoothstep(0.5, 0.15, abs(fall - 0.5)) ;
  float len = 0.6 + laneN * 4.5;
  float topY = uWashTop + (lkNoise(vec2(lane * 0.37, 1.0)) - 0.5) * 2.0;
  float from = max(0.0, (topY - wp.y));
  float runK = (1.0 - smoothstep(len * 0.6, len, from)) * step(0.45, laneN) * strand;
  float wet = lkFbm(vec2(along * 1.4, wp.y * 0.18)) ;
  float streaks = max(runK, smoothstep(0.62, 0.7, wet) * 0.6);
  c = mix(c, uWashInk, clamp(streaks, 0.0, 1.0) * smoothstep(0.35, 0.75, vert) * uWashA.z);
  // splatter on what faces the sky: big pooled blots with ragged edges, and flung dots
  float up = smoothstep(0.6, 0.9, wN.y);
  float pool = smoothstep(0.735, 0.75, lkFbm(wp.xz * 0.5 + 9.0) + (lkNoise(wp.xz * 4.1) - 0.5) * 0.06);
  float dots = smoothstep(0.9, 0.92, lkNoise(wp.xz * 3.3 + 1.0)) * smoothstep(0.45, 0.62, lkFbm(wp.xz * 0.3 + 2.0));
  float halo = smoothstep(0.68, 0.73, lkFbm(wp.xz * 0.5 + 9.0)) * (1.0 - pool);
  c = mix(c, mix(c, uWashShade * 0.9, 0.55), halo * up * uWashA.w);
  c = mix(c, mix(uWashInk, vec3(0.16, 0.2, 0.3), 0.6) * (0.8 + 0.5 * gran), max(pool * 0.85, dots) * up * uWashA.w);
  outgoingLight = c;
}
`;

/** a toon material on paper with the ink wash over it */
export function inkWash(color: THREE.ColorRepresentation, o: WashOpts = {}): THREE.MeshToonMaterial {
  const m = toon(color, { vertexColors: o.vertexColors, contour: o.contour ?? 0, hatchWeight: 0 });
  if (o.side !== undefined) m.side = o.side;
  const a = new THREE.Vector4(o.scale ?? 0.35, o.tide ?? 0.7, o.drip ?? 0.5, o.splat ?? 0);
  const ink = new THREE.Color(o.ink ?? 0x1c1d26);
  const shade = new THREE.Color(o.shade ?? 0x5a5872);
  const paper = m.onBeforeCompile;
  m.userData.lk = `${m.userData.lk}|wash${a.toArray().join(',')},${o.density ?? 0}|${ink.getHexString()}|${shade.getHexString()}`;
  m.userData.washTop = { value: 1e4 };
  m.onBeforeCompile = (shader, renderer) => {
    paper.call(m, shader, renderer);
    shader.uniforms.uWashA = { value: a };
    shader.uniforms.uWashInk = { value: ink };
    shader.uniforms.uWashShade = { value: shade };
    shader.uniforms.uWashTop = m.userData.washTop;
    shader.uniforms.uWashDensity = { value: o.density ?? 0 };
    shader.fragmentShader = shader.fragmentShader
      .replace('uniform float uSnow;', 'uniform float uSnow;\nuniform vec4 uWashA;\nuniform vec3 uWashInk;\nuniform vec3 uWashShade;\nuniform float uWashTop;\nuniform float uWashDensity;')
      .replace('#include <opaque_fragment>', `${WASH_GLSL}\n#include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'lk-paint-wash';
  return m;
}

/** drips start this high (world y) on the material's standing faces; leave unset for drips from noise alone */
export function washDripFrom(m: THREE.MeshToonMaterial, y: number): THREE.MeshToonMaterial {
  (m.userData.washTop as { value: number }).value = y;
  m.userData.lk = `${m.userData.lk}|top${Math.round(y * 2) / 2}`;
  return m;
}
