// Spirit fox look: GLB material tuning, the stylised fur shader patch and the body-tied spirit fire
// (flame licks anchored to skinned surface points + rising embers). Owned by the FOX stream; locomotion
// lives in fox.ts / locomotion/. Every knob is in FOX_LOOK (lil-gui "Look > fox", window.__game.foxLook).
import * as THREE from 'three';
import { FOX_RIG } from './foxRig';

export const FOX_LOOK = {
  /** fur albedo multiplier (linear) — pulls the ACES-reddened vermilion back to burnt orange / ochre */
  furTint: [0.92, 1.12, 1.0] as [number, number, number],
  furSaturation: 0.85,
  furValue: 0.95,
  /** painterly value strokes (object-space clumps laid along the body) */
  strokeStrength: 0.18,
  strokeScale: 1.0,
  /** broken amber rim at grazing angles = the spirit glow at the silhouette */
  rimStrength: 0.22,
  rimPower: 2.5,
  rimColor: [1.0, 0.72, 0.42] as [number, number, number], // pale gold: separates the fox from orange ground
  eyeGlow: 0.025,
  /** spirit wisps (thin curling flame off the back and tail): height multiplier, brightness, stream-back with speed */
  lickScale: 1.0,
  lickIntensity: 1.0,
  lickStream: 0.35,
  /** embers per second at rest / extra per m/s of speed; size in metres */
  emberRate: 3,
  emberRateSpeed: 3,
  emberSize: 0.04,
};

type FurUniforms = {
  uTint: { value: THREE.Vector3 };
  uSatVal: { value: THREE.Vector2 };
  uStroke: { value: THREE.Vector2 };
  uRim: { value: THREE.Vector4 };
  uRimColor: { value: THREE.Color };
};
const furUniforms: FurUniforms = {
  uTint: { value: new THREE.Vector3() },
  uSatVal: { value: new THREE.Vector2() },
  uStroke: { value: new THREE.Vector2() },
  uRim: { value: new THREE.Vector4() },
  uRimColor: { value: new THREE.Color() },
};
const eyeMats: THREE.MeshStandardMaterial[] = [];

/** Push FOX_LOOK into the shared uniforms (cheap; call per frame). */
function syncLook() {
  const L = FOX_LOOK;
  furUniforms.uTint.value.set(...L.furTint);
  furUniforms.uSatVal.value.set(L.furSaturation, L.furValue);
  furUniforms.uStroke.value.set(L.strokeStrength, L.strokeScale);
  furUniforms.uRim.value.set(L.rimStrength, L.rimPower, 0, 0);
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

function patchFur(mat: THREE.MeshStandardMaterial) {
  const shell = mat.name.toLowerCase().includes("shell");
  const tail = mat.name.toLowerCase().startsWith('foxtailfur');
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, furUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRest;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRest = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vRest;
uniform vec3 uTint; uniform vec2 uSatVal; uniform vec2 uStroke; uniform vec4 uRim; uniform vec3 uRimColor;
${NOISE_GLSL}`,
      )
      .replace(
        '#include <map_fragment>',
        `#ifdef USE_MAP
  // Prefer broad painted values over the baked fine fur speckle.
  diffuseColor = vec4(diffuse, opacity) * texture2D(map, vMapUv, 0.4);
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
}`,
      )
      .replace(
        '#include <opaque_fragment>',
        `{
  float facing = saturate(dot(normal, normalize(vViewPosition)));
  ${shell ? `diffuseColor.a *= (1.0 - smoothstep(0.12, 0.7, facing)) * ${tail ? "0.075" : "0.22"}; if (diffuseColor.a < 0.01) discard;` : ""}
  float fres = pow(1.0 - facing, uRim.y);
  float strands = smoothstep(0.2, 0.8, fxNoise(vRest * vec3(9.0, 6.0, 2.5)));
  outgoingLight += uRimColor * uRim.x * fres * (0.35 + 0.65 * strands) * diffuseColor.a;
  ${tail ? `
  #ifdef USE_MAP
    // Authored tail UV: V=1 at the root, V=0 at tail_08.
    float tailAlong = 1.0 - vMapUv.y;
    float tipHeat = smoothstep(0.75, 1.0, tailAlong);
    outgoingLight += uRimColor * 0.4 * tipHeat;
    float tipCoverage = 1.0 - smoothstep(0.82, 1.0, tailAlong);
    diffuseColor.a *= tipCoverage;
    if (diffuseColor.a < ${shell ? "0.01" : "0.45"}) discard;
  #endif` : ''}
}
#include <opaque_fragment>`,
      );
  };
  mat.customProgramCacheKey = () => `fox-fur-${shell ? 'edge' : 'body'}-${tail ? 'tail' : 'coat'}`;
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
  const uni = { uEyeL: { value: cen[0] }, uEyeR: { value: cen[1] }, uEyeR0: { value: r } };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uni);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRest;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRest = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRest;\nuniform vec3 uEyeL; uniform vec3 uEyeR; uniform float uEyeR0;\nvec3 eyeIris; float eyeLid; float eyeGlint;')
      .replace(
        '#include <map_fragment>',
        `{
  vec3 c = vRest.x > 0.0 ? uEyeL : uEyeR;
  vec2 q = (vRest.zy - c.zy) / uEyeR0;          // forward, up in units of the eye radius
  float d = length(q);
  float aperture = length(q / vec2(1.0, 0.5));
  float pupil = 1.0 - smoothstep(0.85, 1.0, length(q / vec2(0.13, 0.39)));
  vec3 iris = mix(vec3(0.48, 0.23, 0.055), vec3(0.22, 0.075, 0.018), smoothstep(0.15, 0.85, d));
  iris = mix(iris, vec3(0.05, 0.025, 0.015), smoothstep(0.62, 0.74, aperture));   // fine umber iris boundary
  iris = mix(iris, vec3(0.02, 0.01, 0.008), pupil);
  float glint = 1.0 - smoothstep(0.045, 0.085, length(q - vec2(0.22, 0.14)));
  // A fine lid line gives way to rust fur, rather than filling the large authored disc with black.
  float lid = smoothstep(0.70, 0.79, aperture);
  iris = mix(iris, vec3(0.055, 0.024, 0.012), lid);
  float coat = smoothstep(0.82, 1.08, aperture);
  iris = mix(iris, vec3(0.32, 0.09, 0.025), coat);
  vec2 tearCorner = q - vec2(0.8, -0.25);
  float tear = exp(-40.0 * dot(tearCorner, tearCorner)) * lid * (1.0 - coat);
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
export function applyFoxLook(root: THREE.Object3D) {
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
        patchEye(mat, mesh.geometry);
        eyeMats.push(mat);
      } else if (n.includes('nose')) {
        mat.color.setHex(0xffffff);
        mat.emissive.setHex(0x000000);
        mat.emissiveIntensity = 0;
      } else if (n.includes('fur')) {
        // The opaque coat supplies the soft shadow; shell shadow maps ignore our grazing-angle fade.
        if (n.includes('shell')) {
          mesh.castShadow = false;
          mesh.renderOrder = 2;
          mat.transparent = true;
          mat.depthWrite = false;
          mat.alphaTest = 0;
        }
        if (n.startsWith('foxtailfur')) {
          mat.transparent = n.includes('shell');
          mat.depthWrite = !n.includes('shell');
          if (!n.includes('shell')) {
            mesh.renderOrder = 1;
            // Match the shadow silhouette to the visible disappearing tip.
            const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: mat.map, alphaTest: 0.45 });
            depth.onBeforeCompile = (shader) => {
              shader.fragmentShader = shader.fragmentShader.replace('#include <alphatest_fragment>', `
#ifdef USE_MAP
  diffuseColor.a *= 1.0 - smoothstep(0.82, 1.0, 1.0 - vMapUv.y);
#endif
#include <alphatest_fragment>`);
            };
            depth.customProgramCacheKey = () => 'fox-tail-depth';
            mesh.customDepthMaterial = depth;
          }
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
  syncLook();
}

// ------------------------------------------------------------------------------------------- spirit fire

type Anchor = { mesh: THREE.SkinnedMesh; index: number };
type Lick = { a: Anchor; h: number; w: number; seed: number; lean: number; tailFlow: boolean };

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
attribute vec3 aPos; attribute vec3 aDir; attribute vec3 aShape; // w, h, seed
attribute float aAlpha;
varying vec2 vUv; varying float vSeed; varying float vAlpha;
void main() {
  vUv = uv; vSeed = aShape.z; vAlpha = aAlpha;
  vec3 viewDir = normalize(cameraPosition - aPos);
  vec3 across = cross(aDir, viewDir);
  // A nearly head-on wisp still has a stable width.
  vec3 fallback = cross(aDir, vec3(0.0, 0.0, 1.0));
  if (length(fallback) < 0.01) fallback = cross(aDir, vec3(0.0, 1.0, 0.0));
  fallback = normalize(fallback);
  if (dot(fallback, across) < 0.0) fallback = -fallback;
  vec3 side = normalize(mix(fallback, across, smoothstep(0.0, 0.05, length(across))));
  float bend = sin(uv.y * 4.5 + aShape.z) * uv.y * uv.y * aShape.x * 0.65;
  vec3 p = aPos + side * ((uv.x - 0.5) * aShape.x + bend) + aDir * uv.y * aShape.y;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;
const LICK_FRAG = /* glsl */ `
uniform float uTime; uniform float uIntensity;
varying vec2 vUv; varying float vSeed; varying float vAlpha;
${NOISE_GLSL}
void main() {
  float y = vUv.y;
  float curl = sin(y * 6.0 - uTime * 1.2 + vSeed * 2.1) * 0.22 * y;
  curl += sin(y * 11.0 - uTime * 0.8 + vSeed) * 0.065 * y;
  float x = vUv.x - 0.5 + curl;
  float width = mix(0.36, 0.07, y);
  float body = exp(-2.0 * x * x / (width * width));
  body *= smoothstep(0.0, 0.12, y) * (1.0 - smoothstep(0.6, 1.0, y));
  // Broad, slow variation keeps the flame present between breaths, without glitter noise.
  float breathe = 0.72 + 0.28 * sin(uTime * 1.1 + vSeed * 3.0);
  body *= mix(0.65, 1.0, fxNoise(vec3(vUv * vec2(3.0, 4.0), uTime * 0.4 + vSeed)));
  vec3 col = mix(vec3(1.0, 0.25, 0.055), vec3(1.0, 0.48, 0.12), smoothstep(0.1, 0.85, y)) * 1.2;
  float a = body * vAlpha * uIntensity * 0.70 * breathe;
  if (a < 0.003) discard;
  gl_FragColor = vec4(col * a, a * 0.65);
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
varying float vHeat;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = (1.0 - smoothstep(0.0, 0.75, d)) * vHeat;
  if (a < 0.004) discard;
  vec3 col = mix(vec3(0.75, 0.12, 0.02), vec3(1.0, 0.55, 0.15), smoothstep(0.1, 0.6, vHeat));
  col = mix(col, vec3(1.0, 0.85, 0.55), smoothstep(0.75, 1.0, vHeat) * (1.0 - d));
  gl_FragColor = vec4(col * a * 1.7, a * 0.3);
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
  // [mesh, bones, min rest normal.y, wisps, height m, width m, lean back] — small ear smoulders, broad tail wake
  const spec: [THREE.SkinnedMesh | undefined, readonly string[], number, number, number, number, number][] = [
    [body, [R.spine[3], R.neck[0]], 0.45, 3, 0.22, 0.12, 0.7],
    [body, [R.spine[1], R.spine[2], R.spine[0], R.pelvis], 0.75, 0, 0.18, 0.06, 0.8],
    [tail, R.tail.slice(2, 6), 0.15, 12, 0.44, 0.27, 0.9],
    [body, R.ear("l").slice(2), -1.0, 3, 0.16, 0.075, 0.4],
    [body, R.ear("r").slice(2), -1.0, 3, 0.16, 0.075, 0.4],
  ];
  const licks: Lick[] = [];
  const emberPool: Anchor[] = [];
  let seed = 1;
  const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (const [mesh, bones, minUp, n, h, w, lean] of spec) {
    if (!mesh) continue;
    const pts = surfacePoints(mesh, bones, minUp);
    if (!pts.length) continue;
    for (let i = 0; i < n; i++) {
      const index = pts[Math.floor(rnd() * pts.length)]!;
      licks.push({ a: { mesh, index }, h: h * (0.7 + 0.6 * rnd()), w: w * (0.8 + 0.4 * rnd()), seed: rnd() * 10, lean, tailFlow: mesh === tail });
    }
    const sparkPts = mesh === tail ? surfacePoints(mesh, R.tail.slice(2, 6), -1) : pts;
    const sourcePts = sparkPts.length ? sparkPts : pts;
    const count = mesh === tail ? 90 : 20;
    for (let i = 0; i < count; i++) emberPool.push({ mesh, index: sourcePts[Math.floor(rnd() * sourcePts.length)]! });
  }

  const diagnostics = { wisps: licks.length, sourceAnchors: emberPool.length, liveEmbers: 0, speed: 0, visible: true };
  group.userData.spiritFx = diagnostics;

  // flame licks: one instanced billboard per lick
  const quad = new THREE.PlaneGeometry(1, 1, 4, 10).translate(0.5, 0.5, 0);
  const lg = new THREE.InstancedBufferGeometry();
  lg.index = quad.index;
  lg.setAttribute('position', quad.getAttribute('position'));
  lg.setAttribute('uv', quad.getAttribute('uv'));
  const aPos = new THREE.InstancedBufferAttribute(new Float32Array(licks.length * 3), 3);
  const aDir = new THREE.InstancedBufferAttribute(new Float32Array(licks.length * 3), 3);
  const aShape = new THREE.InstancedBufferAttribute(new Float32Array(licks.length * 3), 3);
  const aAlpha = new THREE.InstancedBufferAttribute(new Float32Array(licks.length), 1);
  for (const [k, a] of Object.entries({ aPos, aDir, aShape, aAlpha })) {
    a.setUsage(THREE.DynamicDrawUsage);
    lg.setAttribute(k, a);
  }
  lg.instanceCount = licks.length;
  const lickMat = new THREE.ShaderMaterial({
    vertexShader: LICK_VERT, fragmentShader: LICK_FRAG,
    uniforms: { uTime: { value: 0 }, uIntensity: { value: 1 } },
    transparent: true, depthWrite: false, blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, side: THREE.DoubleSide,
  });
  const lickMesh = new THREE.Mesh(lg, lickMat);
  lickMesh.frustumCulled = false;
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
    vertexShader: EMBER_VERT, fragmentShader: EMBER_FRAG, uniforms: { uScale: { value: 900 } },
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
  const dir = new THREE.Vector3(), backward = new THREE.Vector3();
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
      dir.copy(up);
      if (lk.tailFlow) dir.multiplyScalar(0.55).add(backward.set(0, 0, -1).transformDirection(group.matrixWorld).multiplyScalar(0.9));
      dir.addScaledVector(vel, -L.lickStream * lk.lean * 0.25).normalize();
      tmp.addScaledVector(dir, 0.015);
      aPos.setXYZ(i, tmp.x, tmp.y, tmp.z);
      aDir.setXYZ(i, dir.x, dir.y, dir.z);
      const flick = 0.75 + 0.25 * Math.sin(time * (5 + lk.seed) + lk.seed * 3) * Math.sin(time * 2.3 + lk.seed);
      const stretch = (0.65 + 0.35 * THREE.MathUtils.smoothstep(speed, 0.5, 6)) * (1 + Math.min(1, speed * 0.12) * lk.lean);
      aShape.setXYZ(i, lk.w * L.lickScale, lk.h * L.lickScale * flick * stretch, lk.seed);
      aAlpha.setX(i, 0.45 + 0.35 * flick);
    });
    aPos.needsUpdate = aDir.needsUpdate = aShape.needsUpdate = aAlpha.needsUpdate = true;
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
      if (!lickMesh.parent && group.parent) group.parent.add(lickMesh, embers);
      group.getWorldPosition(tmp);
      if (hasPrev && dt > 0) vel.copy(tmp).sub(prev).divideScalar(dt);
      if (vel.lengthSq() > 400) vel.set(0, 0, 0); // teleports
      prev.copy(tmp); hasPrev = true;
      if (!visible) return;
      const L = FOX_LOOK;
      time = t;
      speed = Math.hypot(vel.x, vel.z);
      diagnostics.speed = Number(speed.toFixed(2));
      diagnostics.liveEmbers = 0;
      lickMat.uniforms.uTime!.value = t;
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
