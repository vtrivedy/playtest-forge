// Spirit fox look: GLB material tuning, the stylised fur shader patch and the body-tied spirit fire
// (flame licks anchored to skinned surface points + rising embers). Owned by the FOX stream; locomotion
// lives in fox.ts / locomotion/. Every knob is in FOX_LOOK (lil-gui "Look > fox", window.__gameHooks.foxLook).
import * as THREE from 'three';
import { FOX_RIG } from './foxRig';
import { rebuildTailBrush } from './foxTailBrush';
import { BROAD_FUR_RELIEF_GLSL } from './foxCoatRelief';
import { EMBER_FURL_GLSL } from './foxCoatHeat';

export const FOX_LOOK = {
  /** fur albedo multiplier (linear) — pulls the ACES-reddened vermilion back to burnt orange / ochre */
  furTint: [0.92, 1.12, 1.0] as [number, number, number],
  furSaturation: 0.85,
  furValue: 0.95,
  /** painterly value strokes (object-space clumps laid along the body) */
  strokeStrength: 0.18,
  strokeScale: 1.0,
  /** Amount of the two thin skinned coat fringe layers; 0 returns to the original surface. */
  furFringe: 1.0,
  brushRelief: 0.75,
  /** broken amber rim at grazing angles = the spirit glow at the silhouette */
  rimStrength: 0.22,
  rimPower: 2.5,
  rimColor: [1.0, 0.72, 0.42] as [number, number, number], // pale gold: separates the fox from orange ground
  eyeGlow: 0.04,
  eyeSocketLift: 1.0,
  /** Deep warmth just inside the coat silhouette; stays below bloom. */
  innerHeat: 0.06,
  bodyEmber: 1.0,
  emberSeams: 1.0,
  spineHeat: 1.0,
  /** spirit wisps (thin curling flame off the back and tail): height multiplier, brightness, stream-back with speed */
  lickScale: 1.0,
  lickIntensity: 1.0,
  lickStream: 0.35,
  coreRadiance: 2.4,
  tailRadiance: 0.8,
  emberRadiance: 3.0,
  /** embers per second at rest / extra per m/s of speed; size in metres */
  emberRate: 3,
  emberRateSpeed: 3,
  emberSize: 0.04,
};

const LIMB_HEAT_BAND = { inStart: 0.31, inEnd: 0.35, outStart: 0.39, outEnd: 0.45, frontOffset: 0.02 } as const;

type FurUniforms = {
  uTime: { value: number };
  uFringe: { value: number };
  uSocketLift: { value: number };
  uBodyEmber: { value: number };
  uBrushRelief: { value: number };
  uHeroMetres: { value: number };
  uEmberSeams: { value: number };
  uTint: { value: THREE.Vector3 };
  uSatVal: { value: THREE.Vector2 };
  uStroke: { value: THREE.Vector2 };
  uRim: { value: THREE.Vector4 };
  uRimColor: { value: THREE.Color };
};
const furUniforms: FurUniforms = {
  uTime: { value: 0 },
  uFringe: { value: 1 },
  uSocketLift: { value: 0 },
  uBodyEmber: { value: 1 },
  uBrushRelief: { value: 0.75 },
  uHeroMetres: { value: 1 },
  uEmberSeams: { value: 1 },
  uTint: { value: new THREE.Vector3() },
  uSatVal: { value: new THREE.Vector2() },
  uStroke: { value: new THREE.Vector2() },
  uRim: { value: new THREE.Vector4() },
  uRimColor: { value: new THREE.Color() },
};
const eyeMats: THREE.MeshStandardMaterial[] = [];
const eyeUniforms = {
  uEyeL: { value: new THREE.Vector3() },
  uEyeR: { value: new THREE.Vector3() },
  uEyeR0: { value: 0.1 },
};
const EYE_APERTURE_GLSL = /* glsl */ `
vec2 foxSocketCoordinates(vec3 p, vec3 center, float radius) {
  vec2 q = (p.zy - center.zy) / max(0.0001, radius);
  q.y += q.x * 0.10;
  return q;
}
vec2 foxEyeCoordinates(vec3 p, vec3 center, float radius) {
  vec2 q = foxSocketCoordinates(p, center, radius);
  q.y += q.x * 0.08;
  return q;
}
float foxEyeAperture(vec2 q) { return length(q / vec2(0.70, q.y < 0.0 ? 0.26 : 0.32)); }
float foxSocketExtent(vec2 q) { return length(q / vec2(1.0, 0.5)); }
`;

/** Push FOX_LOOK into the shared uniforms (cheap; call per frame). */
function syncLook() {
  const L = FOX_LOOK;
  furUniforms.uFringe.value = L.furFringe;
  furUniforms.uSocketLift.value = L.eyeSocketLift;
  furUniforms.uBodyEmber.value = L.bodyEmber;
  furUniforms.uBrushRelief.value = L.brushRelief;
  furUniforms.uEmberSeams.value = L.emberSeams;
  furUniforms.uTint.value.set(...L.furTint);
  furUniforms.uSatVal.value.set(L.furSaturation, L.furValue);
  furUniforms.uStroke.value.set(L.strokeStrength, L.strokeScale);
  furUniforms.uRim.value.set(L.rimStrength, L.rimPower, L.innerHeat, 0);
  furUniforms.uRimColor.value.setRGB(...L.rimColor);
  for (const m of eyeMats) m.emissiveIntensity = L.eyeGlow;
}

const NOISE_GLSL = /* glsl */ `
float fxHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float fxNoise(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(fxHash(i + vec3(0, 0, 0)), fxHash(i + vec3(1, 0, 0)), f.x),
                 mix(fxHash(i + vec3(0, 1, 0)), fxHash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(fxHash(i + vec3(0, 0, 1)), fxHash(i + vec3(1, 0, 1)), f.x),
                 mix(fxHash(i + vec3(0, 1, 1)), fxHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}`;

function patchFur(mat: THREE.MeshStandardMaterial, fringeLength = 0, fringeCutoff = 0.22) {
  const shell = mat.name.toLowerCase().includes("shell");
  const tail = mat.name.toLowerCase().startsWith('foxtailfur');
  const innerHeat = mat.name.toLowerCase() === 'foxfur';
  const coat = mat.name.toLowerCase().startsWith('foxfur');
  const heatedCoat = coat;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, furUniforms, eyeUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
varying vec3 vRest;
${heatedCoat ? 'attribute vec2 aInnerHeat; attribute vec4 aSpiritCoat; varying vec2 vInnerHeat; varying vec4 vSpiritCoat;' : ''}
${fringeLength || innerHeat ? 'attribute float aFurMask; varying float vFurMask;' : ''}
${fringeLength ? `uniform float uFringe; attribute float aRuffMask; varying float vRuffMask;` : ''}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vRest = position;
${heatedCoat ? 'vInnerHeat = aInnerHeat; vSpiritCoat = aSpiritCoat;' : ''}
${fringeLength || innerHeat ? 'vFurMask = aFurMask;' : ''}
${fringeLength ? `
  // Offset in bind space before skinning, so fringe follows the exact authored pose.
  vRuffMask = aRuffMask;
  vec3 comb = normalize(normal + vec3(0.0, -0.2 - 0.45 * aRuffMask, -0.2));
  transformed += comb * (${fringeLength.toFixed(3)} + aRuffMask * ${fringeLength > 0.04 ? '0.11' : '0.07'}) * uFringe * max(aFurMask, aRuffMask);
` : ''}`);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vRest;
${heatedCoat ? 'uniform float uTime; uniform float uBodyEmber; uniform float uHeroMetres; uniform float uEmberSeams; varying vec2 vInnerHeat; varying vec4 vSpiritCoat; float foxFurls; float foxFurlMask; float foxRustPigment;' : ''}
${innerHeat ? 'uniform float uBrushRelief;' : ''}
${coat ? `uniform vec3 uEyeL; uniform vec3 uEyeR; uniform float uEyeR0; uniform float uSocketLift;
${EYE_APERTURE_GLSL}` : ''}
${fringeLength || innerHeat ? 'varying float vFurMask;' : ''}
${fringeLength ? 'uniform float uFringe; varying float vRuffMask;' : ''}
uniform vec3 uTint; uniform vec2 uSatVal; uniform vec2 uStroke; uniform vec4 uRim; uniform vec3 uRimColor;
${NOISE_GLSL}
${heatedCoat ? EMBER_FURL_GLSL : ''}
${innerHeat ? BROAD_FUR_RELIEF_GLSL : ''}`,
      )
      .replace(
        '#include <map_fragment>',
        `#ifdef USE_MAP
  // Prefer broad painted values over the baked fine fur speckle.
  diffuseColor = vec4(diffuse, opacity) * texture2D(map, vMapUv, 0.4);
  ${tail ? `diffuseColor.a = opacity;
  // This spindle has continuous UVs; the removed petal atlas would paint dark islands on it.
  float brushAlong = 1.0 - vMapUv.y;
  diffuseColor.rgb = mix(vec3(0.36, 0.095, 0.022), vec3(0.78, 0.29, 0.045), smoothstep(0.15, 1.0, brushAlong));` : ""}
  ${coat ? `{
    vec3 center = vRest.x > 0.0 ? uEyeL : uEyeR;
    float aperture = foxSocketExtent(foxSocketCoordinates(vRest, center, uEyeR0));
    float region = 1.0 - smoothstep(2.4, 3.2, aperture);
    region *= 1.0 - smoothstep(0.10, 0.22, abs(vRest.x - center.x));
    float pigment = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
    float rustSource = smoothstep(1.6, 2.2, diffuseColor.r / max(0.001, diffuseColor.g))
      * (1.0 - smoothstep(0.40, 0.55, diffuseColor.b / max(0.001, diffuseColor.g)));
    float paintedFootprint = max(rustSource, 1.0 - smoothstep(0.02, 0.05, pigment));
    // Match measured unpainted boundary pigment; never carry the old ring's luminance into the fill.
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.384, 0.127, 0.031), uSocketLift * region * paintedFootprint);
  }` : ''}
#endif
{
  // clumps elongated along the body (+Z forward in rest space) and down the legs
  vec3 q = vRest * uStroke.y;
  float clump = fxNoise(q * vec3(2.5, 2.0, 0.8)) * 0.65 + fxNoise(q * vec3(6.0, 5.0, 1.6)) * 0.35;
  diffuseColor.rgb *= 1.0 + uStroke.x * (clump - 0.5) * 2.0;
  // grade only the saturated fur (rust / umber); cream bib, muzzle and ear insides keep their warm white
  vec3 c = diffuseColor.rgb;
  float sat = (max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b))) / max(1e-4, max(c.r, max(c.g, c.b)));
  float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
  vec3 graded = mix(vec3(lum), c, uSatVal.x) * uTint;
  diffuseColor.rgb = mix(c, graded, smoothstep(0.25, 0.55, sat)) * uSatVal.y;
  ${heatedCoat ? `
  float coatAmount = clamp(uBodyEmber, 0.0, 1.5);
  float rustPigment = smoothstep(1.6, 2.2, c.r / max(0.001, c.g));
  foxRustPigment = rustPigment;
  float undercoat = vSpiritCoat.w * rustPigment * smoothstep(0.35, 0.60, sat) * 0.24 * coatAmount;
  vec3 charcoal = min(diffuseColor.rgb, vec3(0.055, 0.046, 0.040) + diffuseColor.rgb * 0.25);
  diffuseColor.rgb = mix(diffuseColor.rgb, charcoal, undercoat);
  float lowerLimb = 1.0 - smoothstep(1.20, 1.65, vRest.y);
  float darkStocking = lowerLimb * (1.0 - smoothstep(0.035, 0.10, lum));
  // Stockings stay dark but warm umber, lightening up the leg, so wrist and hock angles read at gameplay distance.
  vec3 stocking = mix(vec3(0.085, 0.045, 0.024), vec3(0.19, 0.082, 0.034), smoothstep(0.25, 1.45, vRest.y));
  diffuseColor.rgb = mix(diffuseColor.rgb, stocking, darkStocking * 0.85 * clamp(coatAmount, 0.0, 1.0));
  float frontCoat = smoothstep(0.35, 1.25, vRest.z) * (1.0 - smoothstep(2.3, 2.6, vRest.y));
  float creamPigment = 1.0 - rustPigment;
  float peachShift = min(0.1, 0.1 * frontCoat * vSpiritCoat.w * creamPigment * coatAmount);
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.06, 0.97, 0.86), peachShift);
  foxFurls = foxEmberFurls(vRest * uHeroMetres, smoothstep(0.6, 1.3, vRest.z), uTime);
  float furlNapeClearance = 1.0 - smoothstep(0.55, 1.15, vRest.z);
  foxFurlMask = clamp(vSpiritCoat.z * rustPigment * coatAmount * uEmberSeams * furlNapeClearance, 0.0, 1.0);
  ` : ''}
  ${tail ? `
  #ifdef USE_MAP
    float handoff = smoothstep(0.50, 0.82, 1.0 - vMapUv.y);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.80, 0.35, 0.07), handoff * 0.6);
  #endif` : ''}
}`,
      )
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
${innerHeat ? `vec3 foxCoatBaseNormal = normal;
  vec3 reliefCenter = vRest.x > 0.0 ? uEyeL : uEyeR;
  float reliefEye = smoothstep(1.4, 3.2, foxSocketExtent(foxSocketCoordinates(vRest, reliefCenter, uEyeR0)));
  float reliefRust = smoothstep(1.6, 2.2, diffuseColor.r / max(0.001, diffuseColor.g));
  float reliefMask = vFurMask * reliefEye * reliefRust;
  float reliefThroat = smoothstep(0.6, 1.3, vRest.z)
    * (1.0 - smoothstep(-0.6, -0.1, vInnerHeat.y))
    * (1.0 - smoothstep(2.3, 2.6, vRest.y));
  normal = foxBroadFurNormal(-vViewPosition, normal, vRest * uHeroMetres, reliefThroat, reliefMask, uBrushRelief, faceDirection);` : ''}`)
      .replace(
        '#include <opaque_fragment>',
        `{
  float facing = saturate(dot(${fringeLength ? 'normalize(vNormal)' : innerHeat ? 'foxCoatBaseNormal' : 'normal'}, normalize(vViewPosition)));
  ${fringeLength ? `vec3 tuftQ = vRest * vec3(30.0, 30.0, 4.0);
  float tuft = fxNoise(tuftQ);
  float tuftCoverage = smoothstep(${fringeLength > 0.04 ? "0.4, 0.8" : "0.1, 0.5"}, tuft);
  float tuftFootprint = length(abs(dFdx(tuftQ)) + abs(dFdy(tuftQ)));
  tuftCoverage = mix(tuftCoverage, ${ (fringeCutoff * 0.7).toFixed(3) }, smoothstep(0.35, 0.8, tuftFootprint));
  float furCoverage = tuftCoverage * max(vFurMask, vRuffMask) * clamp(uFringe, 0.0, 1.0)
    * (1.0 - smoothstep(0.05, 0.45, facing));
  if (furCoverage < ${fringeCutoff.toFixed(3)}) discard;
  diffuseColor.a = 1.0;` : ''}
  ${heatedCoat ? `
  float chroma = (max(diffuseColor.r, max(diffuseColor.g, diffuseColor.b)) - min(diffuseColor.r, min(diffuseColor.g, diffuseColor.b))) / max(0.0001, max(diffuseColor.r, max(diffuseColor.g, diffuseColor.b)));
  float warmth = vInnerHeat.x * smoothstep(0.2, 0.7, vInnerHeat.y) * smoothstep(0.25, 0.55, chroma);
  warmth *= mix(0.35, 1.0, pow(1.0 - facing, 1.3));
  float heatBreath = 0.92 + 0.08 * sin(uTime * 1.1);
  ${innerHeat ? 'outgoingLight += vec3(1.0, 0.30, 0.06) * uRim.z * warmth * heatBreath;' : ''}
  // Buried heat spreads through thin ear tissue and softly through the outer limb/back coat.
  // Broad skin weights provide the feather; only the opaque coat emits this layer.
  float throughCoat = ${fringeLength ? '1.0' : 'mix(0.60, 1.0, pow(1.0 - facing, 1.2))'};
  float emberHeat = vSpiritCoat.x * 2.8 ${fringeLength ? '' : '+ vSpiritCoat.y * 0.50 * foxRustPigment'} + vSpiritCoat.z * 0.40;
  outgoingLight += vec3(0.80, 0.23, 0.025) * emberHeat * throughCoat * heatBreath * clamp(uBodyEmber, 0.0, 1.5);
  float furlPulse = 0.94 + 0.06 * sin(uTime * 0.8 + vRest.z);
  vec3 furlColor = mix(vec3(0.85, 0.22, 0.03), vec3(1.0, 0.35, 0.06), foxFurls);
  outgoingLight += furlColor * foxFurls * foxFurlMask * 0.90 * furlPulse * throughCoat;
  ${innerHeat ? `float bibFront = smoothstep(0.35, 1.25, vRest.z) * (1.0 - smoothstep(2.3, 2.6, vRest.y));
  float bibRust = foxRustPigment;
  float bibBorder = 4.0 * bibRust * (1.0 - bibRust);
  float bibHeat = bibFront * vSpiritCoat.w * clamp(uBodyEmber, 0.0, 1.5);
  outgoingLight += vec3(0.85, 0.22, 0.03) * bibBorder * bibHeat * 0.35 * heatBreath;
` : ''}
  ` : ''}
  float fres = pow(1.0 - facing, uRim.y);
  float strands = smoothstep(0.2, 0.8, fxNoise(vRest * vec3(9.0, 6.0, 2.5)));
  float rimPigment = smoothstep(1.6, 2.2, diffuseColor.r / max(0.001, diffuseColor.g));
  outgoingLight += uRimColor * ${shell || tail ? "0.0" : "1.0"} * uRim.x * fres * (0.35 + 0.65 * strands) * diffuseColor.a * rimPigment;
  // Dark stockings get a soft russet sheen on their silhouette so legs read as furred volume, not flat sticks.
  float sockPigment = 1.0 - smoothstep(0.10, 0.22, max(diffuseColor.r, max(diffuseColor.g, diffuseColor.b)));
  outgoingLight += vec3(0.55, 0.27, 0.12) * ${shell || tail ? "0.0" : "1.0"} * uRim.x * 1.6 * fres * (0.45 + 0.55 * strands) * diffuseColor.a * sockPigment;
  ${tail ? `
  #ifdef USE_MAP
    // Brush UV: V=1 at the buried root, V=0 at the capped terminal extension.
    float tailAlong = 1.0 - vMapUv.y;
    float tipHeat = smoothstep(0.68, 0.88, tailAlong);
    ${!shell ? 'outgoingLight += vec3(1.0, 0.24, 0.025) * mix(0.07, 0.4, tipHeat);' : ''}
    ${shell ? `float tipCoverage = 1.0 - smoothstep(0.65, 1.0, tailAlong);
    float furTuft = smoothstep(0.20, 0.78, fxNoise(vRest * vec3(12.0, 12.0, 3.0)));
    float coverage = tipCoverage * furTuft * (1.0 - smoothstep(0.05, 0.60, facing));
    // Alpha testing above this chunk cannot see our procedural coverage.
    if (coverage < ${mat.alphaTest.toFixed(3)}) discard;
    diffuseColor.a = 1.0;` : 'diffuseColor.a = 1.0;'}
  #endif` : ''}
}
#include <opaque_fragment>`,
      );
  };
  mat.customProgramCacheKey = () => `fox-fur-${shell ? 'edge' : 'body'}-${tail ? 'tail' : 'coat'}-${fringeLength}-${fringeCutoff}-${mat.alphaTest}-sock-sheen-${innerHeat ? 'warm-relief-furls-v4' : heatedCoat ? 'warm-cutout-furls-v4' : 'plain'}`;
  mat.needsUpdate = true;
}

/** Procedural fox eye (the eye mesh is ~10 verts, too coarse for a painted pupil): amber iris with a
 *  vertical slit pupil, dark limbal ring, a small catchlight; only the iris glows, faintly. */
function patchEye(mat: THREE.MeshStandardMaterial, geo: THREE.BufferGeometry) {
  const pos = geo.getAttribute('position');
  const idx = geo.index;
  const used = new Set<number>();
  if (idx) for (let i = 0; i < idx.count; i++) used.add(idx.getX(i));
  else for (let i = 0; i < pos.count; i++) used.add(i);
  const cen = [new THREE.Vector3(), new THREE.Vector3()], cnt = [0, 0];
  for (const i of used) { const k = pos.getX(i) > 0 ? 0 : 1; cen[k]!.add(new THREE.Vector3().fromBufferAttribute(pos, i)); cnt[k]!++; }
  cen.forEach((c, k) => c.divideScalar(Math.max(1, cnt[k]!)));
  let r = 0;
  for (const i of used) {
    const v = new THREE.Vector3().fromBufferAttribute(pos, i), c = cen[v.x > 0 ? 0 : 1]!;
    r = Math.max(r, Math.hypot(v.y - c.y, v.z - c.z));
  }
  mat.map = null;
  mat.emissiveMap = null;
  mat.color.setHex(0xffffff);
  mat.roughness = 0.4;
  mat.emissive = new THREE.Color(0xffffff);
  eyeUniforms.uEyeL.value.copy(cen[0]!);
  eyeUniforms.uEyeR.value.copy(cen[1]!);
  eyeUniforms.uEyeR0.value = r;
  const uni = eyeUniforms;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uni);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRest;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRest = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vRest;\nuniform vec3 uEyeL; uniform vec3 uEyeR; uniform float uEyeR0;\nvec3 eyeIris; float eyeLid; float eyeGlint;\n${EYE_APERTURE_GLSL}`)
      .replace(
        '#include <map_fragment>',
        `{
  vec3 c = vRest.x > 0.0 ? uEyeL : uEyeR;
  vec2 q = foxEyeCoordinates(vRest, c, uEyeR0);
  float d = length(q);
  float aperture = foxEyeAperture(q);
  if (aperture > 0.82) discard;
  float pupil = 1.0 - smoothstep(0.85, 1.0, length(q / vec2(0.07, 0.15)));
  vec3 iris = mix(vec3(0.32, 0.13, 0.025), vec3(0.16, 0.045, 0.009), smoothstep(0.15, 0.85, d));
  iris = mix(iris, vec3(0.05, 0.025, 0.015), smoothstep(0.74, 0.78, aperture));   // fine umber iris boundary
  iris = mix(iris, vec3(0.02, 0.01, 0.008), pupil);
  float glint = 1.0 - smoothstep(0.045, 0.085, length(q - vec2(0.16, 0.10)));
  // The head is closed under the eye: outside the fine lid, reveal real coat geometry.
  float lid = smoothstep(0.76, 0.82, aperture);
  iris = mix(iris, vec3(0.055, 0.024, 0.012), lid);
  vec2 tearCorner = q - vec2(0.48, -0.09);
  float tear = exp(-40.0 * dot(tearCorner, tearCorner)) * lid;
  iris = mix(iris, vec3(0.095, 0.038, 0.016), tear * 0.45);
  diffuseColor.rgb = mix(iris, vec3(1.0, 0.88, 0.62), glint * (1.0 - lid));
  eyeLid = lid; eyeGlint = glint * (1.0 - lid);
  eyeIris = vec3(1.0, 0.55, 0.15) * (1.0 - pupil) * (1.0 - smoothstep(0.6, 0.9, d)) * (1.0 - lid);
}`,
      )
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(0.3, 0.85, eyeLid);')
      .replace('#include <emissivemap_fragment>', 'totalEmissiveRadiance *= eyeIris; totalEmissiveRadiance += vec3(1.0, 0.88, 0.62) * eyeGlint * 0.12;');
  };
  mat.customProgramCacheKey = () => 'fox-eye';
  mat.needsUpdate = true;
}

/** Material pass over the loaded GLB (spirit FX cards, eyes, nose, fur). */
export function applyFoxLook(root: THREE.Object3D, targetHeight = 1.25) {
  const authoredSize = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
  const metresPerUnit = targetHeight / Math.max(0.001, authoredSize.y);
  furUniforms.uHeroMetres.value = metresPerUnit;
  rebuildTailBrush(root, metresPerUnit);
  const coats: { mesh: THREE.SkinnedMesh; mat: THREE.MeshStandardMaterial }[] = [];
  root.traverse((c) => {
    if (!(c as THREE.Mesh).isMesh) return;
    const mesh = c as THREE.Mesh;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const raw of list) {
      const mat = raw as THREE.MeshStandardMaterial;
      if (!mat?.isMeshStandardMaterial) continue;
      const n = (mat.name || mesh.name || '').toLowerCase();
      if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
      if (mat.emissiveMap) mat.emissiveMap.colorSpace = THREE.SRGBColorSpace;
      if (n.includes('eye')) {
        // The source eye cap is larger than the procedural aperture; the head supplies its occlusion.
        mesh.castShadow = false;
        mesh.userData.forgeSkipAO = true;
        patchEye(mat, mesh.geometry);
        eyeMats.push(mat);
      } else if (n.includes('nose')) {
        mat.color.setHex(0xffffff);
        mat.emissive.setHex(0x000000);
        mat.emissiveIntensity = 0;
      } else if (n.includes('fur')) {
        if (n === 'foxfur' && (mesh as THREE.SkinnedMesh).isSkinnedMesh) coats.push({ mesh: mesh as THREE.SkinnedMesh, mat });
        // The opaque coat supplies the soft shadow; shell shadow maps ignore our grazing-angle fade.
        if (n.includes('shell')) {
          mesh.userData.forgeSkipAO = true;
          mesh.castShadow = false;
          mesh.renderOrder = 2;
          mat.transparent = !n.startsWith('foxtailfur');
          mat.depthWrite = n.startsWith('foxtailfur');
          if (!n.startsWith('foxtailfur')) mat.alphaTest = 0;
        }
        if (n.startsWith('foxtailfur')) {
          // The new core is a capped physical volume; only its alpha-tested fringe dissolves.
          mesh.userData.forgeSkipAO = n.includes('shell');
          mat.transparent = false;
          mat.depthWrite = true;
          if (!n.includes('shell')) mesh.renderOrder = 1;
        }
        mat.color.setHex(0xffffff);
        mat.roughness = 0.85;
        mat.normalScale.setScalar(0.35);
        mat.emissive.setHex(0x000000);
        mat.emissiveIntensity = 0;
        patchFur(mat);
      }
    }
  });
  // Append after traversal: each surface shares the source skeleton and bind matrices, never new bones.
  let coatHeatVertices = 0, coatRuffVertices = 0;
  const coatSpiritRegions = { ear: 0, limb: 0, back: 0, undercoat: 0 };
  const coatRegionNames = ['ear', 'limb', 'back', 'undercoat'] as const;
  for (const { mesh, mat } of coats) {
    const R = FOX_RIG;
    const heatBones = new Set<string>([...R.spine, ...R.neck]);
    const throatBones = new Set<string>(R.neck.slice(0, 2));
    const pawBones = new Set<string>(['l', 'r'].flatMap((s) => [R.foreleg(s as 'l' | 'r').paw, R.hindleg(s as 'l' | 'r').paw]));
    const limbPaw = new Map<string, string>(['l', 'r'].flatMap((side) => {
      const f = R.foreleg(side as 'l' | 'r'), h = R.hindleg(side as 'l' | 'r');
      return [[f.lower, f.paw], [f.paw, f.paw], [h.shin, h.paw], [h.foot, h.paw], [h.paw, h.paw]];
    }));
    const earHeat = new Map<string, number>(['l', 'r'].flatMap((s) => R.ear(s as 'l' | 'r').slice(2).map((name, index) => [name, index === 0 ? 0.45 : 1] as const)));
    const full = new Set<string>([R.pelvis, ...R.spine, ...R.neck]);
    const short = new Set<string>(['l', 'r'].flatMap((side) => {
      const s = side as 'l' | 'r', f = R.foreleg(s), h = R.hindleg(s);
      return [f.scapula, f.upper, h.hip, h.thigh];
    }));
    const g = mesh.geometry, si = g.getAttribute('skinIndex'), sw = g.getAttribute('skinWeight'), p = g.getAttribute('position');
    const pawFloor = new Map([...pawBones].map((name) => [name, Infinity]));
    for (let i = 0; i < si.count; i++) for (let k = 0; k < 4; k++) {
      const name = mesh.skeleton.bones[si.getComponent(i, k)]?.name ?? '';
      if (pawBones.has(name) && sw.getComponent(i, k) >= 0.65) pawFloor.set(name, Math.min(pawFloor.get(name)!, p.getY(i)));
    }
    for (const [name, floor] of pawFloor) if (!Number.isFinite(floor)) throw new Error(`Ember coat missing pad surface for ${name}`);
    const mask = new Float32Array(si.count), ruff = new Float32Array(si.count), heat = new Float32Array(si.count * 2);
    const spirit = new Float32Array(si.count * 4);
    const restNormals = g.getAttribute('normal');
    for (let i = 0; i < si.count; i++) {
      let pawFloorSum = 0, frontLimbWeight = 0;
      for (let k = 0; k < 4; k++) {
        const name = mesh.skeleton.bones[si.getComponent(i, k)]?.name ?? '';
        if (heatBones.has(name)) heat[i * 2] += sw.getComponent(i, k);
        const weight = sw.getComponent(i, k);
        spirit[i * 4] += (earHeat.get(name) ?? 0) * weight;
        const limbFloor = limbPaw.get(name);
        if (limbFloor) {
          spirit[i * 4 + 1] += weight; pawFloorSum += weight * pawFloor.get(limbFloor)!;
          if (limbFloor.startsWith('front_')) frontLimbWeight += weight;
        }
        if (heatBones.has(name) || name === R.pelvis) spirit[i * 4 + 2] += weight;
        if (heatBones.has(name) || name === R.pelvis) spirit[i * 4 + 3] += weight;
        let ruffAmount = throatBones.has(name)
          ? THREE.MathUtils.smoothstep(restNormals.getZ(i), 0.15, 0.65) * (1 - THREE.MathUtils.smoothstep(p.getY(i), 2.25, 2.60)) : 0;
        if (name === R.head) ruffAmount = THREE.MathUtils.smoothstep(Math.abs(p.getX(i)), 0.24, 0.40)
          * (1 - THREE.MathUtils.smoothstep(p.getZ(i), 1.20, 1.48))
          * (1 - THREE.MathUtils.smoothstep(p.getY(i), 2.50, 2.78))
          * THREE.MathUtils.smoothstep(Math.abs(restNormals.getX(i)), 0.25, 0.65);
        ruff[i] += sw.getComponent(i, k) * ruffAmount;
        let amount = full.has(name) ? 1 : short.has(name) ? 0.5 : 0;
        if (name === R.head) {
          amount = 0.5 * (1 - THREE.MathUtils.smoothstep(p.getZ(i), 0.85, 1.28)) * (1 - THREE.MathUtils.smoothstep(p.getY(i), 2.6, 2.85));
          const jaw = (1 - THREE.MathUtils.smoothstep(restNormals.getY(i), -0.55, -0.15))
            * (1 - THREE.MathUtils.smoothstep(p.getY(i), 2.40, 2.55))
            * THREE.MathUtils.smoothstep(p.getZ(i), 1.10, 1.35)
            * (1 - THREE.MathUtils.smoothstep(p.getZ(i), 1.80, 2.02));
          amount = Math.max(amount, jaw * 0.35);
        }
        mask[i] += sw.getComponent(i, k) * amount;
      }
      heat[i * 2 + 1] = restNormals.getY(i);
      const limbWeight = spirit[i * 4 + 1]!;
      if (limbWeight > 0) {
        const abovePad = (p.getY(i) - pawFloorSum / limbWeight) * metresPerUnit + LIMB_HEAT_BAND.frontOffset * frontLimbWeight / limbWeight;
        spirit[i * 4 + 1] *= THREE.MathUtils.smoothstep(abovePad, LIMB_HEAT_BAND.inStart, LIMB_HEAT_BAND.inEnd) * (1 - THREE.MathUtils.smoothstep(abovePad, LIMB_HEAT_BAND.outStart, LIMB_HEAT_BAND.outEnd));
      }
      spirit[i * 4 + 1] *= THREE.MathUtils.smoothstep(Math.max(restNormals.getX(i) * Math.sign(p.getX(i)), -restNormals.getZ(i) * 0.65), 0.05, 0.55);
      spirit[i * 4 + 2] *= THREE.MathUtils.smoothstep(restNormals.getY(i), 0.0, 0.60);
      spirit[i * 4 + 3] *= 1 - THREE.MathUtils.smoothstep(restNormals.getY(i), -0.45, 0.35);
      const eyeCenter = p.getX(i) > 0 ? eyeUniforms.uEyeL.value : eyeUniforms.uEyeR.value;
      const eyeRadius = Math.max(0.0001, eyeUniforms.uEyeR0.value);
      const eyeX = (p.getZ(i) - eyeCenter.z) / eyeRadius;
      const eyeY = (p.getY(i) - eyeCenter.y) / eyeRadius + eyeX * 0.10;
      const socketClearance = THREE.MathUtils.smoothstep(Math.hypot(eyeX, eyeY / 0.5), 1.4, 2.8);
      ruff[i] *= socketClearance;
      spirit[i * 4] *= socketClearance;
      spirit[i * 4 + 2] *= socketClearance;
      coatRegionNames.forEach((key, channel) => {
        spirit[i * 4 + channel] = THREE.MathUtils.clamp(spirit[i * 4 + channel]!, 0, 1);
        if (spirit[i * 4 + channel]! > 0.05) coatSpiritRegions[key]++;
      });
      if (heat[i * 2]! > 0.05 && restNormals.getY(i) > 0.2) coatHeatVertices++;
      if (ruff[i]! > 0.05) coatRuffVertices++;
    }
    g.setAttribute('aInnerHeat', new THREE.BufferAttribute(heat, 2));
    g.setAttribute('aFurMask', new THREE.BufferAttribute(mask, 1));
    g.setAttribute('aRuffMask', new THREE.BufferAttribute(ruff, 1));
    g.setAttribute('aSpiritCoat', new THREE.BufferAttribute(spirit, 4));
    for (const [i, [length, cutoff]] of [[0.03, 0.28], [0.06, 0.46]].entries()) {
      const fringe = mesh.clone(false);
      const material = mat.clone();
      material.name = `FoxFurShellCoat${i + 1}`;
      material.transparent = false;
      material.depthWrite = true;
      material.side = THREE.FrontSide;
      material.alphaTest = 0;
      material.normalMap = null;
      patchFur(material, length, cutoff);
      fringe.name = `FoxCoatFringe${i + 1}`;
      fringe.material = material;
      fringe.castShadow = false;
      fringe.userData.forgeSkipAO = true;
      fringe.receiveShadow = true;
      fringe.renderOrder = 2;
      fringe.frustumCulled = false;
      mesh.parent!.add(fringe);
    }
  }
  root.userData.coatFringeLayers = coats.length * 2;
  root.userData.coatFringeMode = 'cutout';
  root.userData.coatHeatVertices = coatHeatVertices;
  root.userData.coatRuffVertices = coatRuffVertices;
  root.userData.coatSpiritRegions = coatSpiritRegions;
  syncLook();
}

// ------------------------------------------------------------------------------------------- spirit fire

type Anchor = { mesh: THREE.SkinnedMesh; index: number };
type Lick = { a: Anchor; h: number; w: number; seed: number; lean: number; tailFlow: boolean; spineFlow: boolean; flow?: { from: THREE.Bone; to: THREE.Bone; after?: THREE.Bone } };

/** Surface points whose dominant bone is in `bones` and whose rest normal points up enough. */
function surfacePoints(mesh: THREE.SkinnedMesh, bones: readonly string[], minUp: number): number[] {
  const names = mesh.skeleton.bones.map((b) => b.name);
  const want = new Set(bones.map((b) => names.indexOf(b)).filter((i) => i >= 0));
  const g = mesh.geometry;
  const si = g.getAttribute('skinIndex'), sw = g.getAttribute('skinWeight'), nrm = g.getAttribute('normal');
  const out: number[] = [];
  for (let i = 0; i < si.count; i++) {
    let best = 0, bw = -1;
    for (let k = 0; k < 4; k++) {
      const w = sw.getComponent(i, k);
      if (w > bw) { bw = w; best = si.getComponent(i, k); }
    }
    if (want.has(best) && (!nrm || nrm.getY(i) >= minUp)) out.push(i);
  }
  return out;
}

const LICK_VERT = /* glsl */ `
attribute vec3 aPos; attribute vec3 aDir; attribute vec3 aBend; attribute vec4 aShape; // w, h, seed, crest
attribute float aAlpha;
varying vec2 vUv; varying float vSeed; varying float vAlpha; varying float vCrest;
void main() {
  vUv = uv; vSeed = aShape.z; vAlpha = aAlpha; vCrest = aShape.w;
  vec3 center = aPos + (aDir * uv.y + aBend * uv.y * uv.y) * aShape.y;
  vec3 tangent = normalize(aDir + 2.0 * aBend * uv.y);
  vec3 viewDir = normalize(cameraPosition - center);
  vec3 across = cross(tangent, viewDir);
  // A nearly head-on wisp still has a stable width.
  vec3 fallback = cross(tangent, vec3(0.0, 0.0, 1.0));
  if (length(fallback) < 0.01) fallback = cross(tangent, vec3(0.0, 1.0, 0.0));
  fallback = normalize(fallback);
  if (dot(fallback, across) < 0.0) fallback = -fallback;
  vec3 side = normalize(mix(fallback, across, smoothstep(0.0, 0.05, length(across))));
  float bend = sin(uv.y * 4.5 + aShape.z) * uv.y * uv.y * aShape.x * 0.65;
  vec3 p = center + side * ((uv.x - 0.5) * aShape.x + bend);
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;
const LICK_FRAG = /* glsl */ `
uniform float uTime; uniform float uIntensity; uniform vec2 uRadiance;
varying vec2 vUv; varying float vSeed; varying float vAlpha; varying float vCrest;
${NOISE_GLSL}
void main() {
  float y = vUv.y;
  float curl = sin(y * 6.0 - uTime * 1.2 + vSeed * 2.1) * 0.22 * y;
  curl += sin(y * 11.0 - uTime * 0.8 + vSeed) * 0.065 * y;
  float x = vUv.x - 0.5 + curl;
  float width = mix(0.36, 0.07, y);
  float shape = exp(-2.0 * x * x / (width * width));
  float attachedCrest = step(0.5, vCrest) * (1.0 - step(1.5, vCrest));
  float rootEnvelope = mix(smoothstep(0.0, 0.12, y), mix(0.55, 1.0, smoothstep(0.0, 0.12, y)), attachedCrest);
  shape *= rootEnvelope * (1.0 - smoothstep(0.6, 1.0, y));
  float body = shape;
  // Broad, slow variation keeps the flame present between breaths, without glitter noise.
  float breathe = 0.72 + 0.28 * sin(uTime * 1.1 + vSeed * 3.0);
  body *= mix(0.65, 1.0, fxNoise(vec3(vUv * vec2(3.0, 4.0), uTime * 0.4 + vSeed)));
  float crest = clamp(vCrest, 0.0, 1.0);
  vec3 rootColor = mix(vec3(1.0, 0.12, 0.015), vec3(0.95, 0.16, 0.025), crest);
  vec3 tipColor = mix(vec3(1.0, 0.24, 0.035), vec3(0.95, 0.34, 0.06), crest);
  vec3 col = mix(rootColor, tipColor, smoothstep(0.1, 0.85, y));
  float a = body * vAlpha * uIntensity * 0.70 * breathe;
  float radiance = mix(uRadiance.y, uRadiance.x, crest) * mix(1.0, 0.5, step(1.5, vCrest));
  // Keep the core luminous through quiet breaths; only the broad orange envelope breathes/noises.
  float core = shape * vAlpha * uIntensity * radiance;
  if (a < 0.003 && core < 0.003) discard;
  vec3 hot = mix(vec3(1.0, 0.18, 0.025), vec3(1.0, 0.28, 0.035), crest);
  gl_FragColor = vec4(col * a + hot * core, a * 0.85);
}`;
const EMBER_VERT = /* glsl */ `
attribute float aSize; attribute float aHeat;
varying float vHeat;
uniform float uScale;
void main() {
  vHeat = aHeat;
  vec4 mv = viewMatrix * vec4(position, 1.0); // positions are already world-space
  gl_PointSize = aSize * uScale / max(0.05, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const EMBER_FRAG = /* glsl */ `
uniform float uRadiance;
varying float vHeat;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = (1.0 - smoothstep(0.0, 0.75, d)) * vHeat;
  if (a < 0.004) discard;
  vec3 col = mix(vec3(0.75, 0.12, 0.02), vec3(1.0, 0.55, 0.15), smoothstep(0.1, 0.6, vHeat));
  col = mix(col, vec3(1.0, 0.85, 0.55), smoothstep(0.75, 1.0, vHeat) * (1.0 - d));
  gl_FragColor = vec4(col * a * uRadiance, a * 0.3);
}`;

export type SpiritFx = {
  update: (dt: number, t: number, gliding: boolean) => void;
  setVisible: (on: boolean) => void;
};

/** Spirit fire tied to the skinned body. `group` is the fox actor group (its parent receives the FX). */
export function createSpiritFx(root: THREE.Object3D, group: THREE.Object3D): SpiritFx {
  const skinned: THREE.SkinnedMesh[] = [];
  root.traverse((c) => { if ((c as THREE.SkinnedMesh).isSkinnedMesh) skinned.push(c as THREE.SkinnedMesh); });
  const matName = (m: THREE.SkinnedMesh) => ((m.material as THREE.Material).name || '').toLowerCase();
  const body = skinned.find((m) => matName(m) === 'foxfur');
  const tail = skinned.find((m) => matName(m) === 'foxtailfur');
  const R = FOX_RIG;
  // [mesh, bones, min rest normal.y, wisps, height m, width m, lean back] — small ear smoulders, tapered tail brush
  const spec: [THREE.SkinnedMesh | undefined, readonly string[], number, number, number, number, number, boolean?, number?][] = [
    [body, [R.neck[0], R.spine[3]], 0.65, 3, 0.14, 0.07, 0.7],
    [body, [R.spine[1], R.spine[2], R.spine[0], R.pelvis], 0.75, 0, 0.18, 0.06, 0.8],
    [tail, R.tail.slice(4, 7), 0.15, 8, 0.58, 0.13, 0.8],
    [body, R.ear("l").slice(3), -1.0, 2, 0.14, 0.035, 0.8],
    [body, R.ear("r").slice(3), -1.0, 2, 0.14, 0.035, 0.8],
    // Appended, independently seeded and without motes: existing brush/crest randomness stays identical.
    [body, [R.spine[1], R.spine[2]], 0.75, 2, 0.14, 0.06, 0.4, true, 0],
  ];
  const licks: Lick[] = [];
  const emberPool: Anchor[] = [];
  let seed = 1;
  const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  let spineSeed = 2017;
  const spineRnd = () => ((spineSeed = (Math.imul(spineSeed, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (const [mesh, bones, minUp, n, h, w, lean, spineFlow = false, sparks] of spec) {
    const random = spineFlow ? spineRnd : rnd;
    if (!mesh) continue;
    const surface = surfacePoints(mesh, bones, minUp);
    const uv = mesh.geometry.getAttribute('uv');
    const pts = mesh === tail ? surface.filter((i) => 1 - uv.getY(i) >= 0.55) : surface;
    if (!pts.length) continue;
    const crest = mesh !== tail && n > 0 && !spineFlow;
    const ear = bones.some((b) => b.startsWith('ear_'));
    const positions = mesh.geometry.getAttribute('position');
    const highest = crest ? Math.max(...pts.map((i) => positions.getY(i))) : 0;
    const wickPts = crest ? pts.filter((i) => positions.getY(i) >= highest - (ear ? 0.015 : 0.08)) : pts;
    const joints = mesh.geometry.getAttribute('skinIndex'), weights = mesh.geometry.getAttribute('skinWeight');
    const pointBone = (index: number) => {
      let slot = 0;
      for (let k = 1; k < 4; k++) if (weights.getComponent(index, k) > weights.getComponent(index, slot)) slot = k;
      return mesh.skeleton.bones[joints.getComponent(index, slot)]!;
    };
    const stratified = mesh === tail || spineFlow;
    const sourceBuckets = stratified ? bones.map((name) => pts.filter((index) => pointBone(index).name === name)) : [];
    for (let i = 0; i < n; i++) {
      const bucket = stratified ? sourceBuckets[i % sourceBuckets.length]! : wickPts;
      const candidates = bucket.length ? bucket : pts;
      const index = candidates[Math.floor(random() * candidates.length)]!;
      let flow: Lick['flow'];
      if (mesh === tail) {
        const from = pointBone(index);
        const segment = R.tail.findIndex((name) => name === from.name);
        const to = mesh.skeleton.bones.find((bone) => bone.name === R.tail[segment + 1]);
        const after = mesh.skeleton.bones.find((bone) => bone.name === R.tail[segment + 2]);
        if (to) flow = { from, to, after };
      }
      licks.push({ a: { mesh, index }, h: h * (0.7 + 0.6 * random()), w: w * (0.8 + 0.4 * random()), seed: random() * 10, lean, tailFlow: mesh === tail, spineFlow, flow });
    }
    const sparkPts = mesh === tail ? surfacePoints(mesh, R.tail.slice(2, 6), -1) : pts;
    const sourcePts = sparkPts.length ? sparkPts : pts;
    const count = sparks ?? (mesh === tail ? 90 : 20);
    for (let i = 0; i < count; i++) emberPool.push({ mesh, index: sourcePts[Math.floor(random() * sourcePts.length)]! });
  }

  const lookState = { emberSeams: FOX_LOOK.emberSeams, bodyEmber: FOX_LOOK.bodyEmber, brushRelief: FOX_LOOK.brushRelief, furFringe: FOX_LOOK.furFringe, tailRadiance: FOX_LOOK.tailRadiance, eyeSocketLift: FOX_LOOK.eyeSocketLift };
  const diagnostics = { look: lookState, eyePigmentRecovery: 'boundary-rust', tailBrush: root.userData.tailBrush, spineWisps: licks.filter((l) => l.spineFlow).length, coatHeatVertices: root.userData.coatHeatVertices as number, coatFringeLayers: root.userData.coatFringeLayers as number, coatFringeMode: root.userData.coatFringeMode, coatRuffVertices: root.userData.coatRuffVertices as number, coatSpiritRegions: root.userData.coatSpiritRegions, limbHeatPlacement: 'outer-back-above-stocking', limbHeatAbovePadMetres: { front: (LIMB_HEAT_BAND.inEnd + LIMB_HEAT_BAND.outStart) * 0.5 - LIMB_HEAT_BAND.frontOffset, hind: (LIMB_HEAT_BAND.inEnd + LIMB_HEAT_BAND.outStart) * 0.5 }, wisps: licks.length, sourceAnchors: emberPool.length, liveEmbers: 0, speed: 0, visible: true };
  group.userData.spiritFx = diagnostics;

  // flame licks: one instanced billboard per lick
  const quad = new THREE.PlaneGeometry(1, 1, 4, 10).translate(0.5, 0.5, 0);
  const lg = new THREE.InstancedBufferGeometry();
  lg.index = quad.index;
  lg.setAttribute('position', quad.getAttribute('position'));
  lg.setAttribute('uv', quad.getAttribute('uv'));
  const aPos = new THREE.InstancedBufferAttribute(new Float32Array(licks.length * 3), 3);
  const aDir = new THREE.InstancedBufferAttribute(new Float32Array(licks.length * 3), 3);
  const aBend = new THREE.InstancedBufferAttribute(new Float32Array(licks.length * 3), 3);
  const aShape = new THREE.InstancedBufferAttribute(new Float32Array(licks.length * 4), 4);
  const aAlpha = new THREE.InstancedBufferAttribute(new Float32Array(licks.length), 1);
  for (const [k, a] of Object.entries({ aPos, aDir, aBend, aShape, aAlpha })) {
    a.setUsage(THREE.DynamicDrawUsage);
    lg.setAttribute(k, a);
  }
  lg.instanceCount = licks.length;
  const lickMat = new THREE.ShaderMaterial({
    vertexShader: LICK_VERT, fragmentShader: LICK_FRAG,
    uniforms: { uTime: furUniforms.uTime, uIntensity: { value: 1 }, uRadiance: { value: new THREE.Vector2(FOX_LOOK.coreRadiance, FOX_LOOK.tailRadiance) } },
    transparent: true, depthWrite: false, blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, side: THREE.DoubleSide,
  });
  const lickMesh = new THREE.Mesh(lg, lickMat);
  lickMesh.frustumCulled = false;
  lickMesh.userData.forgeSkipAO = true;
  lickMesh.renderOrder = 3;

  // embers: world-space points with buoyant rise, drag and sway
  const N = 120;
  const eg = new THREE.BufferGeometry();
  const ePos = new Float32Array(N * 3), eSize = new Float32Array(N), eHeat = new Float32Array(N);
  const eVel = new Float32Array(N * 3), eAge = new Float32Array(N).fill(1), eLife = new Float32Array(N).fill(1);
  const eSeed = Float32Array.from({ length: N }, () => rnd() * 6.28);
  eg.setAttribute('position', new THREE.BufferAttribute(ePos, 3).setUsage(THREE.DynamicDrawUsage));
  eg.setAttribute('aSize', new THREE.BufferAttribute(eSize, 1).setUsage(THREE.DynamicDrawUsage));
  eg.setAttribute('aHeat', new THREE.BufferAttribute(eHeat, 1).setUsage(THREE.DynamicDrawUsage));
  const emberMat = new THREE.ShaderMaterial({
    vertexShader: EMBER_VERT, fragmentShader: EMBER_FRAG, uniforms: { uScale: { value: 900 }, uRadiance: { value: FOX_LOOK.emberRadiance } },
    transparent: true, depthWrite: false, blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  const embers = new THREE.Points(eg, emberMat);
  const drawingBufferSize = new THREE.Vector2();
  embers.onBeforeRender = (renderer, _scene, camera) => {
    emberMat.uniforms.uScale!.value = renderer.getDrawingBufferSize(drawingBufferSize).y * 0.5 * camera.projectionMatrix.elements[5]!;
  };
  embers.frustumCulled = false;
  embers.renderOrder = 3;

  const tmp = new THREE.Vector3(), prev = new THREE.Vector3(), vel = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const dir = new THREE.Vector3(), backward = new THREE.Vector3(), curve = new THREE.Vector3(), lateral = new THREE.Vector3();
  let hasPrev = false, visible = true, spawnAcc = 0, pending = 0, next = 0, time = 0, speed = 0;
  const anchorPos = (a: Anchor, out: THREE.Vector3) => a.mesh.getVertexPosition(a.index, out).applyMatrix4(a.mesh.matrixWorld);
  const anchorMeshes = [...new Set([...licks.map((l) => l.a.mesh), ...emberPool.map((a) => a.mesh)])];

  // Anchors are skinned surface points: resolve them after the final bone pose of this step with fresh world
  // matrices + bone palette (render-time hooks run after three.js uploads attributes = one render late).
  const anchorNow = () => {
    group.updateWorldMatrix(true, true);
    for (const m of anchorMeshes) m.skeleton.update();
    const L = FOX_LOOK;
    licks.forEach((lk, i) => {
      anchorPos(lk.a, tmp);
      if (lk.flow) {
        dir.setFromMatrixPosition(lk.flow.to.matrixWorld);
        backward.setFromMatrixPosition(lk.flow.from.matrixWorld);
        dir.sub(backward).normalize().addScaledVector(up, 0.12);
        if (lk.flow.after) {
          curve.setFromMatrixPosition(lk.flow.after.matrixWorld);
          backward.setFromMatrixPosition(lk.flow.to.matrixWorld);
          curve.sub(backward).normalize();
        } else curve.copy(dir);
        curve.addScaledVector(up, 0.5).normalize();
      } else {
        backward.set(0, 0, -1).transformDirection(group.matrixWorld);
        if (lk.spineFlow) {
          lateral.set(1, 0, 0).transformDirection(group.matrixWorld);
          dir.copy(up).multiplyScalar(0.65).addScaledVector(backward, 0.85).addScaledVector(lateral, i % 2 ? -0.3 : 0.3);
        } else dir.copy(up).multiplyScalar(0.8).addScaledVector(backward, 0.65);
      }
      dir.addScaledVector(vel, -L.lickStream * lk.lean * (lk.tailFlow ? 0.04 : 0.25)).normalize();
      if (lk.flow) curve.sub(dir).multiplyScalar(0.5);
      else curve.set(0, 0, 0);
      aBend.setXYZ(i, curve.x, curve.y, curve.z);
      // Ear/nape fire begins inside fur; a lifted, zero-alpha root reads as a floating candle.
      tmp.addScaledVector(dir, !lk.tailFlow && !lk.spineFlow ? -0.02 : 0.015);
      aPos.setXYZ(i, tmp.x, tmp.y, tmp.z);
      aDir.setXYZ(i, dir.x, dir.y, dir.z);
      const flick = lk.spineFlow ? 0.925 + 0.075 * Math.sin(time * 1.1 + lk.seed * 3) : 0.75 + 0.25 * Math.sin(time * (5 + lk.seed) + lk.seed * 3) * Math.sin(time * 2.3 + lk.seed);
      const restScale = lk.tailFlow ? 0.65 : 0.95;
      const stretch = THREE.MathUtils.lerp(restScale, 1, THREE.MathUtils.smoothstep(speed, 0.5, 6)) * (1 + Math.min(1, speed * 0.12) * lk.lean);
      aShape.setXYZW(i, lk.w * L.lickScale, lk.h * L.lickScale * flick * stretch, lk.seed, lk.tailFlow ? 0 : lk.spineFlow ? 2 : 1);
      aAlpha.setX(i, (0.45 + 0.35 * flick) * (lk.spineFlow ? L.spineHeat : 1));
    });
    aPos.needsUpdate = aDir.needsUpdate = aBend.needsUpdate = aShape.needsUpdate = aAlpha.needsUpdate = true;
    for (; pending > 0 && emberPool.length; pending--) {
      const i = next; next = (next + 1) % N;
      anchorPos(emberPool[Math.floor(rnd() * emberPool.length)]!, tmp);
      ePos[i * 3] = tmp.x; ePos[i * 3 + 1] = tmp.y; ePos[i * 3 + 2] = tmp.z;
      eVel[i * 3] = vel.x * 0.3 + (rnd() - 0.5) * 0.25;
      eVel[i * 3 + 1] = 0.25 + rnd() * 0.35;
      eVel[i * 3 + 2] = vel.z * 0.3 + (rnd() - 0.5) * 0.25;
      eHeat[i] = 0;
      eAge[i] = 0; eLife[i] = 2.2 + rnd();
      eSize[i] = L.emberSize * (0.5 + rnd());
    }
    (eg.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (eg.getAttribute('aSize') as THREE.BufferAttribute).needsUpdate = true;
  };

  return {
    setVisible(on) {
      visible = diagnostics.visible = on;
      lickMesh.visible = embers.visible = on;
    },
    update(dt, t, gliding) {
      syncLook();
      furUniforms.uTime.value = t;
      if (!lickMesh.parent && group.parent) group.parent.add(lickMesh, embers);
      group.getWorldPosition(tmp);
      if (hasPrev && dt > 0) vel.copy(tmp).sub(prev).divideScalar(dt);
      if (vel.lengthSq() > 400) vel.set(0, 0, 0); // teleports
      prev.copy(tmp); hasPrev = true;
      if (!visible) return;
      const L = FOX_LOOK;
      lookState.emberSeams = L.emberSeams;
      lookState.bodyEmber = L.bodyEmber;
      lookState.brushRelief = L.brushRelief;
      lookState.furFringe = L.furFringe;
      lookState.tailRadiance = L.tailRadiance;
      lookState.eyeSocketLift = L.eyeSocketLift;
      (lickMat.uniforms.uRadiance!.value as THREE.Vector2).set(L.coreRadiance, L.tailRadiance);
      emberMat.uniforms.uRadiance!.value = L.emberRadiance;
      time = t;
      speed = Math.hypot(vel.x, vel.z);
      diagnostics.speed = Number(speed.toFixed(2));
      diagnostics.liveEmbers = 0;
      lickMat.uniforms.uIntensity!.value = L.lickIntensity * (0.8 + 0.4 * THREE.MathUtils.smoothstep(speed, 0.5, 6)) * (gliding ? 1.25 : 1);
      spawnAcc += dt * (L.emberRate + L.emberRateSpeed * speed) * (gliding ? 1.6 : 1);
      pending = Math.min(N, pending + Math.floor(spawnAcc));
      spawnAcc -= Math.floor(spawnAcc);
      for (let i = 0; i < N; i++) {
        if (eAge[i]! >= eLife[i]!) { eHeat[i] = 0; continue; }
        diagnostics.liveEmbers++;
        eAge[i] += dt;
        const u = eAge[i]! / eLife[i]!;
        const drag = Math.exp(-1.6 * dt);
        eVel[i * 3] = eVel[i * 3]! * drag + Math.sin(t * 3 + eSeed[i]!) * 0.35 * dt;
        eVel[i * 3 + 1] = eVel[i * 3 + 1]! * drag + 0.5 * dt;
        eVel[i * 3 + 2] = eVel[i * 3 + 2]! * drag + Math.cos(t * 2.6 + eSeed[i]!) * 0.35 * dt;
        for (let k = 0; k < 3; k++) ePos[i * 3 + k] += eVel[i * 3 + k]! * dt;
        eHeat[i] = (1 - u) * Math.min(1, u * 8) * (0.75 + 0.25 * Math.sin(t * 17 + eSeed[i]! * 9));
      }
      (eg.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
      (eg.getAttribute('aHeat') as THREE.BufferAttribute).needsUpdate = true;
      anchorNow();
    },
  };
}
