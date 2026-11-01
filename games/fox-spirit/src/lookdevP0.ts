/**
 * Redesign Phase 0 lookdev — "Pressed Ink → Living Cel".
 *
 * Self-contained Russetvale slice booted by `?lookdev=p0` (main.ts never boots the game then).
 * Unpainted world = warm sepia paper + ink; painted = soft 3-band cel autumn. The boundary is the
 * ColorField restore wavefront (same restore() / update() clock the game uses), drawn here with a
 * ragged watercolour edge + tide-line on MeshToonMaterial. The fox stand-in is procedural and never
 * graded (it carries the colour). Ink = inverted hulls.
 *
 * window.__lookdevHooks: setPaint('none'|'half'|'full'), setCamera('wide'|'fox'|'hero'), advance(frames, dt), ready.
 */
import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  createForgeRenderer,
  createColorField,
  createPostStack,
  createPaintedSky,
  applyLookdevLights,
  applyHeightFog,
  matchFogToSky,
} from '../../../src/render';

type PaintMode = 'none' | 'half' | 'full';
type Shot = 'wide' | 'fox' | 'hero';

const INK = new THREE.Color(0x24160e);
const FOX_HOME = new THREE.Vector3(0.6, 0, 3.2);

/** Deterministic RNG so every capture is the same slice */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------------------------
// Materials: toon ramp, paper/paint patch, ink hull
// ---------------------------------------------------------------------------------------------

function toonRamp(stops: number[]): THREE.DataTexture {
  const data = new Uint8Array(stops.length * 4);
  stops.forEach((v, i) => data.set([v, v, v, 255], i * 4));
  const tex = new THREE.DataTexture(data, stops.length, 1, THREE.RGBAFormat);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}
/** 3 bands: plum shadow, warm mid, lit */
const RAMP_WORLD = toonRamp([70, 150, 255]);
const RAMP_FOX = toonRamp([85, 165, 255]);

/** Shared paint uniforms: restores as (x, z, radius, edge) */
const paintU = {
  uRestore: { value: Array.from({ length: 4 }, () => new THREE.Vector4()) },
  uRestoreCount: { value: 0 },
  uPaper: { value: new THREE.Color(0.8, 0.66, 0.47) },
  uPaperInk: { value: new THREE.Color(0.2, 0.13, 0.08) },
};

const NOISE_GLSL = /* glsl */ `
  float lkHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float lkNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(lkHash(i), lkHash(i + vec2(1, 0)), u.x), mix(lkHash(i + vec2(0, 1)), lkHash(i + vec2(1, 1)), u.x), u.y);
  }
  float lkFbm(vec2 p) {
    float s = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { s += a * lkNoise(p); p = p * 2.03 + 17.1; a *= 0.5; }
    return s;
  }`;

/**
 * Paper ↔ cel patch for MeshToonMaterial. Unpainted: lit luminance → sepia paper, ink hatching in
 * the shadow band, paper tooth. Painted: the authored cel colour. Edge: fbm-ragged front with a
 * darker pigment tide-line just inside the paint.
 */
function patchPaint(mat: THREE.MeshToonMaterial): void {
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, paintU);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLkWorld;')
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
        vec4 lkW = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
        lkW = instanceMatrix * lkW;
        #endif
        vLkWorld = (modelMatrix * lkW).xyz;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vLkWorld;
        uniform vec4 uRestore[4];
        uniform int uRestoreCount;
        uniform vec3 uPaper;
        uniform vec3 uPaperInk;
        ${NOISE_GLSL}`,
      )
      .replace(
        '#include <opaque_fragment>',
        `{
          vec2 xz = vLkWorld.xz;
          // ragged watercolour front: large lobes + fine fibre bite
          float rag = (lkFbm(xz * 0.11) - 0.5) * 5.0 + (lkFbm(xz * 0.55 + 3.7) - 0.5) * 1.8 + (lkNoise(xz * 2.6) - 0.5) * 0.45;
          float drops = smoothstep(0.7, 0.78, lkNoise(xz * 1.3 + 11.0));
          float paint = 0.0, tide = 0.0;
          for (int i = 0; i < 4; i++) {
            if (i >= uRestoreCount) break;
            vec4 r = uRestore[i];
            float d = length(xz - r.xy) - r.z + rag * min(1.0, r.z / 12.0);
            float e = max(0.12, r.w * 0.6);
            float p = 1.0 - smoothstep(-e, e, d);
            // stray pigment drops just past the front
            p = max(p, drops * (1.0 - smoothstep(0.0, 2.2, d)) * step(0.5, r.z));
            paint = max(paint, p);
            tide = max(tide, exp(-pow((d + e * 0.6) / (e * 0.7), 2.0)));
          }
          float lum = dot(outgoingLight, vec3(0.2126, 0.7152, 0.0722));
          float t = clamp(lum / 1.25, 0.0, 1.0);
          // paper tooth (screen) + soft world blotches (stains in old paper)
          float tooth = lkNoise(gl_FragCoord.xy * 0.9) * 0.5 + lkNoise(gl_FragCoord.xy * 0.23) * 0.5;
          float stain = lkFbm(xz * 0.35 + vLkWorld.y * 0.2);
          vec3 paper = uPaper * (0.9 + 0.14 * stain) * (0.95 + 0.07 * tooth);
          vec3 sepia = mix(uPaperInk, paper, smoothstep(0.02, 0.62, t));
          // pressed-ink hatching where the cel shadow band falls
          float hatch = step(0.62, fract((gl_FragCoord.x + gl_FragCoord.y) * 0.16));
          float shadowBand = 1.0 - smoothstep(0.12, 0.3, t);
          sepia = mix(sepia, uPaperInk * 1.4, hatch * shadowBand * 0.45);
          // painted cel: the authored colour, with a dried-pigment tide line on the inner edge
          vec3 cel = outgoingLight * mix(vec3(1.0), vec3(0.62, 0.5, 0.42), tide);
          cel *= 0.96 + 0.08 * lkNoise(xz * 2.3);
          outgoingLight = mix(sepia, cel, paint);
        }
        #include <opaque_fragment>`,
      );
  };
  mat.customProgramCacheKey = () => 'lk-paint';
}

function toon(color: THREE.ColorRepresentation, opts: { vertexColors?: boolean; flat?: boolean } = {}): THREE.MeshToonMaterial {
  const m = new THREE.MeshToonMaterial({ color, gradientMap: RAMP_WORLD, vertexColors: !!opts.vertexColors });

  patchPaint(m);
  return m;
}

/** Inverted hull: back faces pushed out along smoothed normals, thicker with distance (≈ constant px) */
const inkMats = new Map<number, THREE.MeshBasicMaterial>();
function inkMaterial(width: number): THREE.MeshBasicMaterial {
  const key = Math.round(width * 1000);
  const hit = inkMats.get(key);
  if (hit) return hit;
  const m = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide, fog: true });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uInkW = { value: width };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uInkW;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vec3 inkWp = (modelMatrix * vec4(position, 1.0)).xyz;
        float inkD = distance(inkWp, cameraPosition);
        transformed += normalize(normal) * uInkW * clamp(inkD * 0.09, 0.45, 5.0);`,
      );
  };
  m.customProgramCacheKey = () => `lk-ink-${key}`;
  inkMats.set(key, m);
  return m;
}

function hullGeometry(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', geo.getAttribute('position').clone());
  if (geo.index) g.setIndex(geo.index.clone());
  const merged = mergeVertices(g, 1e-3);
  merged.computeVertexNormals();
  return merged;
}

/** Mesh + ink hull child */
function inked(geo: THREE.BufferGeometry, mat: THREE.Material, width = 0.018): THREE.Mesh {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const hull = new THREE.Mesh(hullGeometry(geo), inkMaterial(width));
  hull.castShadow = false;
  hull.userData.ink = true;
  mesh.add(hull);
  return mesh;
}

function jitter(geo: THREE.BufferGeometry, amount: number, rand: () => number, freq = 1.3): THREE.BufferGeometry {
  // displace merged positions coherently so faces stay closed
  const g = mergeVertices(geo.deleteAttribute('normal').deleteAttribute('uv'), 1e-4);
  const p = g.getAttribute('position') as THREE.BufferAttribute;
  const o = rand() * 100;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = Math.sin(v.x * freq * 3.1 + o) * Math.cos(v.y * freq * 2.7 - o) * Math.sin(v.z * freq * 3.3 + o * 0.5);
    v.multiplyScalar(1 + n * amount + (rand() - 0.5) * amount * 0.6);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

// ---------------------------------------------------------------------------------------------
// Scenery
// ---------------------------------------------------------------------------------------------

const PATH = new THREE.CatmullRomCurve3([
  new THREE.Vector3(3, 0, 30),
  new THREE.Vector3(1.5, 0, 14),
  new THREE.Vector3(0.4, 0, 4),
  new THREE.Vector3(-0.6, 0, -4),
  new THREE.Vector3(0, 0, -9),
]);
const PATH_PTS = PATH.getSpacedPoints(80);
function pathDist(x: number, z: number): number {
  let best = 1e9;
  for (const p of PATH_PTS) best = Math.min(best, Math.hypot(x - p.x, z - p.z));
  return best;
}
function groundH(x: number, z: number): number {
  const r = Math.hypot(x, z + 4);
  const hills = Math.sin(x * 0.11) * Math.cos(z * 0.09) * 0.9 + Math.sin(x * 0.31 + z * 0.17) * 0.25;
  const bowl = THREE.MathUtils.smoothstep(r, 16, 60) * 7;
  const flat = THREE.MathUtils.smoothstep(pathDist(x, z), 1.5, 6);
  return (hills * flat + bowl) * (z < -12 ? 1 + (-12 - z) * 0.03 : 1);
}

function buildGround(scene: THREE.Scene): void {
  const geo = new THREE.PlaneGeometry(180, 180, 150, 150);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const col = new Float32Array(pos.count * 3);
  const moss = new THREE.Color(0x7d8a4c);
  const ochre = new THREE.Color(0xc29a52);
  const rust = new THREE.Color(0xa45a32);
  const dirt = new THREE.Color(0xc9a36e);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, groundH(x, z));
    const n = Math.sin(x * 0.23 + Math.cos(z * 0.19) * 2) * 0.5 + 0.5;
    c.copy(moss).lerp(ochre, n * 0.75);
    // leaf-litter drifts under the maples
    const litter = Math.max(0, Math.sin(x * 0.5 + 1.3) * Math.sin(z * 0.43 - 0.4));
    c.lerp(rust, litter * 0.45);
    const pd = pathDist(x, z);
    c.lerp(dirt, 1 - THREE.MathUtils.smoothstep(pd, 0.9, 1.8));
    col.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, toon(0xffffff, { vertexColors: true }));
  ground.receiveShadow = true;
  scene.add(ground);
}

const FOLIAGE = [0xb8401f, 0xd0682a, 0xe0a03c, 0x9c2e1c];

function buildMaple(rand: () => number, scale: number, hueBias = 0): THREE.Group {
  const g = new THREE.Group();
  const bark = toon(0x4a3326, { flat: true });
  // bent two-segment trunk
  const lean = (rand() - 0.5) * 0.35;
  const t1 = new THREE.CylinderGeometry(0.22, 0.34, 2.4, 7, 3);
  t1.translate(0, 1.2, 0);
  const trunk = inked(jitter(t1, 0.06, rand), bark, 0.02);
  trunk.rotation.z = lean;
  g.add(trunk);
  const t2 = new THREE.CylinderGeometry(0.12, 0.22, 1.9, 6, 2);
  t2.translate(0, 0.95, 0);
  const top = inked(jitter(t2, 0.06, rand), bark, 0.018);
  top.position.set(-Math.sin(lean) * 2.4, Math.cos(lean) * 2.4, 0);
  top.rotation.z = -lean * 1.4;
  g.add(top);
  // limbs
  for (let i = 0; i < 3; i++) {
    const lg = new THREE.CylinderGeometry(0.05, 0.11, 1.5, 5);
    lg.translate(0, 0.75, 0);
    const limb = inked(lg, bark, 0.014);
    limb.position.set(-Math.sin(lean) * 2.2, 2.2 + i * 0.35, 0);
    limb.rotation.set((rand() - 0.5) * 0.6, i * 2.1 + rand(), 0.9 + rand() * 0.3, 'YXZ');
    g.add(limb);
  }
  // chunky foliage clumps: a crown plus satellite puffs
  const crownC = new THREE.Vector3(-Math.sin(lean) * 2.6, 4.3, 0);
  const n = 7 + Math.floor(rand() * 3);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rand() * 0.6;
    const ring = i === 0 ? 0 : 1.15 + rand() * 0.5;
    const r = i === 0 ? 1.55 : 0.85 + rand() * 0.45;
    const geo = jitter(new THREE.IcosahedronGeometry(r, 1), 0.12, rand, 0.9);
    geo.scale(1, 0.78, 1);
    const hue = FOLIAGE[(i + Math.floor(hueBias * 4)) % FOLIAGE.length]!;
    const m = toon(hue, { flat: true });
    const clump = inked(geo, m, 0.024);
    clump.position.copy(crownC).add(new THREE.Vector3(Math.cos(a) * ring, (rand() - 0.35) * 0.9 + (i === 0 ? 0.5 : 0), Math.sin(a) * ring));
    clump.rotation.set(rand() * 3, rand() * 3, rand() * 3);
    g.add(clump);
  }
  g.scale.setScalar(scale);
  return g;
}

function buildRock(rand: () => number, size: number, mossy = true): THREE.Mesh {
  const geo = jitter(new THREE.DodecahedronGeometry(size, 1), 0.16, rand, 0.7);
  geo.scale(1.2, 0.7, 1);
  const rock = inked(geo, toon(mossy ? 0x8a8576 : 0x9a8e7c, { flat: true }), 0.02);
  rock.rotation.y = rand() * 6;
  return rock;
}

/** Weathered shrine gate with a hanging ember lantern */
function buildArch(): THREE.Group {
  const g = new THREE.Group();
  const lacquer = toon(0x9e3a24, { flat: true });
  const wood = toon(0x3e2a1f, { flat: true });
  const stone = toon(0x8e8472, { flat: true });
  for (const sx of [-1.7, 1.7]) {
    const base = inked(new THREE.CylinderGeometry(0.42, 0.5, 0.45, 8), stone, 0.02);
    base.position.set(sx, 0.22, 0);
    g.add(base);
    const post = inked(new THREE.CylinderGeometry(0.2, 0.25, 4.1, 8), lacquer, 0.02);
    post.position.set(sx, 2.45, 0);
    post.rotation.z = sx > 0 ? 0.035 : -0.035;
    g.add(post);
  }
  // upswept lintel: a bent box
  const lintel = new THREE.BoxGeometry(5.6, 0.32, 0.5, 24, 1, 1);
  const lp = lintel.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < lp.count; i++) {
    const x = lp.getX(i);
    lp.setY(i, lp.getY(i) + Math.pow(Math.abs(x) / 2.8, 2.6) * 0.42);
  }
  lintel.computeVertexNormals();
  const top = inked(lintel, wood, 0.022);
  top.position.y = 4.65;
  g.add(top);
  const beam = inked(new THREE.BoxGeometry(4.3, 0.22, 0.3), lacquer, 0.02);
  beam.position.y = 3.85;
  g.add(beam);
  const tab = inked(new THREE.BoxGeometry(0.42, 0.6, 0.12), wood, 0.015);
  tab.position.set(0, 4.25, 0.12);
  g.add(tab);
  // ember lantern
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.6), new THREE.MeshBasicMaterial({ color: INK }));
  cord.position.set(0, 3.45, 0);
  g.add(cord);
  const cage = inked(new THREE.CylinderGeometry(0.2, 0.24, 0.42, 6), wood, 0.012);
  cage.position.set(0, 2.98, 0);
  g.add(cage);
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 1.3, 0.35) }));
  glow.position.set(0, 2.98, 0);
  g.add(glow);
  const light = new THREE.PointLight(0xff9a4a, 6, 7, 1.6);
  light.position.set(0, 2.9, 0.3);
  g.add(light);
  return g;
}

function buildGrass(scene: THREE.Scene, rand: () => number): void {
  const blade = new THREE.ConeGeometry(0.06, 0.55, 3);
  blade.translate(0, 0.27, 0);
  const mat = toon(0xffffff, { flat: true });
  const N = 900;
  const mesh = new THREE.InstancedMesh(blade, mat, N);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const col = new THREE.Color();
  let k = 0;
  while (k < N) {
    const x = (rand() - 0.5) * 44;
    const z = (rand() - 0.5) * 44 - 2;
    if (pathDist(x, z) < 1.4) continue;
    // tufts: 3-5 blades around a point
    const cnt = 3 + Math.floor(rand() * 3);
    for (let j = 0; j < cnt && k < N; j++, k++) {
      p.set(x + (rand() - 0.5) * 0.3, 0, z + (rand() - 0.5) * 0.3);
      p.y = groundH(p.x, p.z) - 0.03;
      e.set((rand() - 0.5) * 0.7, rand() * 6, (rand() - 0.5) * 0.7);
      q.setFromEuler(e);
      const h = 0.6 + rand() * 0.9;
      s.set(1, h, 1);
      m.compose(p, q, s);
      mesh.setMatrixAt(k, m);
      col.setHex(rand() < 0.6 ? 0xb39a4e : rand() < 0.5 ? 0x8a8f4a : 0xc0703a);
      mesh.setColorAt(k, col);
    }
  }
  mesh.receiveShadow = true;
  scene.add(mesh);
}

function buildLeaves(scene: THREE.Scene, rand: () => number): void {
  const leaf = new THREE.CircleGeometry(0.11, 5);
  leaf.rotateX(-Math.PI / 2);
  const mesh = new THREE.InstancedMesh(leaf, toon(0xffffff), 700);
  const m = new THREE.Matrix4();
  const col = new THREE.Color();
  for (let i = 0; i < 700; i++) {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * 22;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r - 3;
    m.makeRotationY(rand() * 6).setPosition(x, groundH(x, z) + 0.02, z);
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, col.setHex(FOLIAGE[i % FOLIAGE.length]!));
  }
  mesh.receiveShadow = true;
  scene.add(mesh);
}

function buildDistance(scene: THREE.Scene, rand: () => number): void {
  // layered ridges that fade into the mist
  const ridgeMat = toon(0x8a6a58, { flat: true });
  for (let i = 0; i < 9; i++) {
    const geo = jitter(new THREE.IcosahedronGeometry(1, 1), 0.18, rand, 0.6);
    const r = new THREE.Mesh(geo, ridgeMat);
    const a = -Math.PI / 2 + (i / 8 - 0.5) * 2.6;
    const d = 55 + rand() * 25;
    r.position.set(Math.cos(a) * d, -4, Math.sin(a) * d);
    r.scale.set(18 + rand() * 14, 10 + rand() * 9, 14 + rand() * 6);
    scene.add(r);
  }
}

// ---------------------------------------------------------------------------------------------
// Fox stand-in: lean, low-slung, long snout, big ears, flame-plume tail
// ---------------------------------------------------------------------------------------------

function foxToon(color: THREE.ColorRepresentation, emissive = 0x000000, ei = 0): THREE.MeshToonMaterial {
  const m = new THREE.MeshToonMaterial({ color, gradientMap: RAMP_FOX, emissive, emissiveIntensity: ei });
  // soft warm rim so the silhouette lifts off the paper
  m.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      `{
        float rim = 1.0 - clamp(dot(normalize(normal), vec3(0.0, 0.0, 1.0)), 0.0, 1.0);
        outgoingLight += vec3(1.0, 0.55, 0.22) * smoothstep(0.62, 0.9, rim) * 0.22;
      }
      #include <opaque_fragment>`,
    );
  };
  m.customProgramCacheKey = () => 'lk-fox';
  return m;
}

function ellipsoid(r: [number, number, number], seg = 20): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, seg, Math.round(seg * 0.7));
  g.scale(...r);
  return g;
}

/** Capped tube with an authored radius profile; `lobes` > 0 adds flame lobes toward the tip */
function plumeGeometry(curve: THREE.Curve<THREE.Vector3>, radius: (t: number) => number, rings = 36, sides = 12, lobes = 0.16): THREE.BufferGeometry {
  const frames = curve.computeFrenetFrames(rings, false);
  const pos: number[] = [];
  const idx: number[] = [];
  const along: number[] = [];
  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    const c = curve.getPointAt(t);
    const N = frames.normals[i]!;
    const B = frames.binormals[i]!;
    for (let j = 0; j < sides; j++) {
      const a = (j / sides) * Math.PI * 2;
      // flame lobes grow toward the tip
      const lobe = 1 + Math.sin(a * 3 + t * 9) * lobes * THREE.MathUtils.smoothstep(t, 0.3, 0.9);
      const r = radius(t) * lobe;
      along.push(t);
      pos.push(c.x + (N.x * Math.cos(a) + B.x * Math.sin(a)) * r, c.y + (N.y * Math.cos(a) + B.y * Math.sin(a)) * r, c.z + (N.z * Math.cos(a) + B.z * Math.sin(a)) * r);
    }
  }
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < sides; j++) {
      const a = i * sides + j;
      const b = i * sides + ((j + 1) % sides);
      const c = a + sides;
      const d = b + sides;
      idx.push(a, b, c, b, d, c);
    }
  }
  // caps
  const c0 = curve.getPointAt(0);
  const c1 = curve.getPointAt(1);
  const i0 = pos.length / 3;
  pos.push(c0.x, c0.y, c0.z, c1.x, c1.y, c1.z);
  along.push(0, 1);
  const last = rings * sides;
  for (let j = 0; j < sides; j++) {
    const jn = (j + 1) % sides;
    idx.push(i0, jn, j, i0 + 1, last + j, last + jn);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aAlong', new THREE.Float32BufferAttribute(along, 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function buildFox(): { root: THREE.Group; update: (t: number) => void; setHeadYaw: (y: number) => void } {
  const root = new THREE.Group();
  const coat = foxToon(0xc45c26);
  const coatDeep = foxToon(0x9c3f1a);
  const cream = foxToon(0xe8cfa6);
  const ink = foxToon(0x2a1a14);
  const emberTip = foxToon(0xff7a2a, 0xff5a10, 1.6);
  const W = 0.02;

  const body = new THREE.Group();
  body.position.y = 0.4;
  root.add(body);

  // lean torso: one haunch → tucked waist → deep chest → raised neck sweep (single silhouette)
  const spine = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.05, -0.44),
    new THREE.Vector3(0, 0.06, -0.27),
    new THREE.Vector3(0, 0.03, -0.04),
    new THREE.Vector3(0, 0.05, 0.18),
    new THREE.Vector3(0, 0.17, 0.34),
    new THREE.Vector3(0, 0.3, 0.44),
  ]);
  const girth = (t: number) => {
    const k = [0.09, 0.155, 0.135, 0.18, 0.12, 0.09];
    const f = t * (k.length - 1);
    const i = Math.min(k.length - 2, Math.floor(f));
    const u = f - i;
    return THREE.MathUtils.lerp(k[i]!, k[i + 1]!, u * u * (3 - 2 * u));
  };
  const torsoGeo = plumeGeometry(spine, girth, 40, 14, 0);
  torsoGeo.scale(0.88, 1.05, 1);
  torsoGeo.computeVertexNormals();
  body.add(inked(torsoGeo, coat, W));
  // cream throat blaze (narrow, runs up the neck — not a disc)
  const bib = new THREE.Mesh(ellipsoid([0.07, 0.17, 0.07]), cream);
  bib.position.set(0, 0.1, 0.27);
  bib.rotation.x = -0.75;
  body.add(bib);

  const head = new THREE.Group();
  head.position.set(0, 0.35, 0.5);
  body.add(head);
  // wedge skull: wide at the cheeks, flat brow, tapering into the snout
  const skullGeo = ellipsoid([0.12, 0.095, 0.13]);
  const sp = skullGeo.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < sp.count; i++) {
    const z = sp.getZ(i);
    // pinch toward the front, flare at the back cheeks → triangle from above
    sp.setX(i, sp.getX(i) * (1 - Math.max(0, z) * 2.2 + Math.max(0, -z) * 0.8));
  }
  skullGeo.computeVertexNormals();
  head.add(inked(skullGeo, coat, W));
  // long tapered snout
  const snoutGeo = new THREE.ConeGeometry(0.08, 0.25, 10);
  snoutGeo.rotateX(Math.PI / 2);
  snoutGeo.scale(1, 0.72, 1);
  const snout = inked(snoutGeo, coat, W);
  snout.position.set(0, -0.03, 0.19);
  head.add(snout);
  const jawGeo = new THREE.ConeGeometry(0.06, 0.2, 8);
  jawGeo.rotateX(Math.PI / 2);
  jawGeo.scale(1, 0.5, 1);
  const jaw = new THREE.Mesh(jawGeo, cream);
  jaw.position.set(0, -0.065, 0.16);
  head.add(jaw);
  const nose = new THREE.Mesh(ellipsoid([0.022, 0.018, 0.02], 10), ink);
  nose.position.set(0, -0.02, 0.31);
  head.add(nose);
  // narrow almond eyes with an ember glint
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(ellipsoid([0.026, 0.011, 0.018], 10), ink);
    eye.position.set(0.075 * s, 0.03, 0.095);
    eye.rotation.set(0, 0.5 * s, -0.35 * s);
    head.add(eye);
    const glint = new THREE.Mesh(new THREE.SphereGeometry(0.006, 6, 4), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.2, 0.4) }));
    glint.position.set(0.08 * s, 0.034, 0.108);
    head.add(glint);
  }
  // big pointed ears, ink-dark backs, ember tips
  for (const s of [-1, 1]) {
    const ear = new THREE.Group();
    ear.position.set(0.075 * s, 0.07, -0.02);
    ear.rotation.set(-0.2, 0, -0.32 * s);
    head.add(ear);
    const outer = new THREE.ConeGeometry(0.075, 0.26, 4);
    outer.translate(0, 0.13, 0);
    outer.scale(1, 1, 0.5);
    ear.add(inked(outer, coatDeep, W));
    const tip = new THREE.ConeGeometry(0.032, 0.08, 4);
    tip.translate(0, 0.226, 0);
    tip.scale(1, 1, 0.55);
    ear.add(new THREE.Mesh(tip, emberTip));
    const inner = new THREE.ConeGeometry(0.045, 0.17, 3);
    inner.translate(0, 0.1, 0.022);
    inner.scale(1, 1, 0.4);
    ear.add(new THREE.Mesh(inner, cream));
  }

  // short tapered legs: coat at the top, ink-dipped below
  const legs: THREE.Group[] = [];
  const legDefs: Array<[number, number, number]> = [
    [0.085, 0.2, 0],
    [-0.085, 0.2, 0.18],
    [0.09, -0.3, 0.14],
    [-0.09, -0.3, -0.1],
  ];
  for (const [x, z, swing] of legDefs) {
    const leg = new THREE.Group();
    leg.position.set(x, 0.0, z);
    leg.rotation.x = swing;
    body.add(leg);
    const upper = new THREE.CylinderGeometry(0.075, 0.045, 0.2, 8);
    upper.translate(0, -0.1, 0);
    leg.add(inked(upper, coat, W * 0.8));
    const lower = new THREE.CylinderGeometry(0.042, 0.026, 0.22, 8);
    lower.translate(0, -0.29, 0);
    leg.add(inked(lower, ink, W * 0.8));
    const paw = inked(ellipsoid([0.038, 0.025, 0.055], 10), ink, W * 0.7);
    paw.position.set(0, -0.405, 0.02);
    leg.add(paw);
    legs.push(leg);
  }

  // thick flame-plume tail: sweeps back and up, widest mid, burning tip
  const tailCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.06, -0.46),
    new THREE.Vector3(0, 0.02, -0.72),
    new THREE.Vector3(0, 0.14, -0.98),
    new THREE.Vector3(0, 0.42, -1.14),
    new THREE.Vector3(0, 0.72, -1.12),
  ]);
  const tailGeo = plumeGeometry(
    tailCurve,
    (t) => 0.05 + Math.pow(Math.sin(Math.min(1, t * 1.08) * Math.PI), 0.8) * 0.17 * (1 - t * 0.3),
    44,
    14,
  );
  // coat at the root → deeper flame → burning ember toward the tip (self-lit so it never sinks into shadow)
  const tailMat = foxToon(0xffffff);
  const tailPrev = tailMat.onBeforeCompile;
  tailMat.onBeforeCompile = (shader, r) => {
    tailPrev.call(tailMat, shader, r);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aAlong;\nvarying float vAlong;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvAlong = aAlong;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vAlong;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        vec3 tailCol = mix(vec3(0.56, 0.11, 0.025), vec3(0.42, 0.06, 0.012), smoothstep(0.2, 0.55, vAlong));
        diffuseColor.rgb = mix(tailCol, vec3(1.0, 0.36, 0.06), smoothstep(0.62, 0.95, vAlong));`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        totalEmissiveRadiance += vec3(1.0, 0.32, 0.06) * (smoothstep(0.5, 1.0, vAlong) * 1.6 + 0.06);`,
      );
  };
  tailMat.customProgramCacheKey = () => 'lk-fox-tail';
  const tail = inked(tailGeo, tailMat, W);
  const tailGroup = new THREE.Group();
  tailGroup.add(tail);
  tailGroup.position.z = 0.06;
  body.add(tailGroup);
  // flame tip + tongues licking off the plume
  const tipGeo = plumeGeometry(
    new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.66, -1.14), new THREE.Vector3(0, 0.84, -1.08), new THREE.Vector3(0.0, 1.0, -0.98)]),
    (t) => 0.07 * (1 - t) + 0.004,
    12,
    10,
  );
  const flameMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.0, 1.15, 0.3) });
  const flame = new THREE.Mesh(tipGeo, flameMat);
  tailGroup.add(flame);
  const tongues: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const tg = new THREE.ConeGeometry(0.03, 0.18, 5);
    tg.translate(0, 0.09, 0);
    const t = new THREE.Mesh(tg, new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 0.75, 0.18) }));
    t.position.set((i - 1) * 0.06, 0.8, -1.1 + i * 0.03);
    t.rotation.set(0.3, 0, (i - 1) * 0.4);
    tailGroup.add(t);
    tongues.push(t);
  }
  const tailLight = new THREE.PointLight(0xff7a30, 1.6, 3.5, 2);
  tailLight.position.set(0, 0.95, -1.0);
  tailGroup.add(tailLight);

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && !o.userData.ink) o.castShadow = true;
  });

  let headYaw = 0.3;
  return {
    root,
    setHeadYaw(y: number) {
      headYaw = y;
    },
    update(t) {
      // breathing + tail sway + flame flicker (alive, not idle-frozen)
      body.position.y = 0.4 + Math.sin(t * 2.2) * 0.006;
      tailGroup.rotation.y = Math.sin(t * 1.3) * 0.12;
      tailGroup.rotation.x = Math.sin(t * 0.9) * 0.04;
      head.rotation.set(Math.sin(t * 0.7) * 0.03 + 0.08, headYaw + Math.sin(t * 0.5) * 0.05, 0);
      tongues.forEach((tg, i) => (tg.scale.y = 0.8 + 0.35 * Math.abs(Math.sin(t * 7 + i * 2.1))));
      tailLight.intensity = 1.5 + Math.sin(t * 9) * 0.25;
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------------------------

const SKY = {
  paper: { zenith: 0xb9a98c, mid: 0xd9c4a0, horizon: 0xe9d7b5, mist: 0xd6c3a2, nadir: 0x9c8b72 },
  autumn: { zenith: 0x7d7aa0, mid: 0xdc9f62, horizon: 0xf2c290, mist: 0xd9b496, nadir: 0x8e7462 },
};

/** Camera pose + fox yaw / head turn per shot (fox stands at FOX_HOME) */
const SHOTS: Record<Shot, { pos: [number, number, number]; look: [number, number, number]; fov: number; foxYaw: number; headYaw: number }> = {
  wide: { pos: [9.5, 5.2, 17], look: [-1.2, 1.6, -4], fov: 50, foxYaw: Math.PI - 0.35, headYaw: 0.2 },
  fox: { pos: [2.75, 0.62, 3.75], look: [0.5, 0.52, 2.95], fov: 40, foxYaw: 0.25, headYaw: 0.45 },
  hero: { pos: [-1.6, 0.8, 7.2], look: [0.6, 1.7, -6], fov: 46, foxYaw: 0.55, headYaw: 0.3 },
};

export async function runLookdevP0(): Promise<void> {
  document.getElementById('hud')?.remove();
  const forge = await createForgeRenderer({ container: document.body, exposure: 1.1, shadows: true, pixelRatio: 1 });
  const { renderer } = forge;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 400);
  const lights = applyLookdevLights(scene);
  lights.key.position.set(14, 16, 6);
  lights.key.intensity = 2.8;
  lights.key.shadow.mapSize.set(1024, 1024);
  // chunky low-poly clumps acne under the default bias
  lights.key.shadow.bias = -0.0008;
  lights.key.shadow.normalBias = 0.08;
  lights.hemi.intensity = 0.9;
  const fog = applyHeightFog(scene, { density: 0.012, height: 1, heightFalloff: 0.06 });
  const sky = createPaintedSky(scene, { sunDir: new THREE.Vector3(0.7, 0.32, 0.25), godRays: 0.25, cloudAmount: 0.6 });

  const rand = rng(7);
  buildGround(scene);
  buildDistance(scene, rand);
  buildGrass(scene, rand);
  buildLeaves(scene, rand);

  const arch = buildArch();
  arch.position.set(-0.3, groundH(-0.3, -8), -8);
  arch.rotation.y = 0.12;
  scene.add(arch);

  const trees: Array<[number, number, number, number]> = [
    [-5.5, -3, 1.1, 0],
    [-9, -10, 1.35, 0.5],
    [5.2, -6.5, 1.2, 0.25],
    [8.5, 1.5, 0.95, 0.75],
    [-7.5, 6, 0.9, 0.5],
    [4.5, -14, 1.5, 0],
    [-3.5, -17, 1.3, 0.75],
    [12, -9, 1.4, 0.5],
    [-14, -4, 1.5, 0.25],
  ];
  for (const [x, z, s, h] of trees) {
    const t = buildMaple(rand, s, h);
    t.position.set(x, groundH(x, z) - 0.1, z);
    t.rotation.y = rand() * 6;
    scene.add(t);
  }
  const rocks: Array<[number, number, number]> = [
    [-2.2, 1.2, 0.7],
    [2.6, -2.5, 0.9],
    [-1.8, -7.2, 0.55],
    [1.9, -7.6, 0.45],
    [3.6, 6.5, 0.5],
    [-4.2, 9, 1.1],
    [6.5, -2, 0.6],
  ];
  for (const [x, z, s] of rocks) {
    const r = buildRock(rand, s);
    r.position.set(x, groundH(x, z) + s * 0.25, z);
    scene.add(r);
  }

  const fox = buildFox();
  fox.root.position.set(FOX_HOME.x, groundH(FOX_HOME.x, FOX_HOME.z), FOX_HOME.z);
  fox.root.rotation.y = 0.55;
  scene.add(fox.root);

  // restore wavefronts come from the game's ColorField clock
  const field = createColorField({ bounds: { minX: -90, maxX: 90, minZ: -90, maxZ: 90 } });
  let paintMode: PaintMode = 'none';
  const post = createPostStack(renderer, scene, camera, { bloomStrength: 0.35, bloomThreshold: 0.9, vignette: 0.3, grain: 0.012, pixelRatio: 1 });

  const skyPaper = Object.fromEntries(Object.entries(SKY.paper).map(([k, v]) => [k, new THREE.Color(v)])) as Record<string, THREE.Color>;
  const skyAutumn = Object.fromEntries(Object.entries(SKY.autumn).map(([k, v]) => [k, new THREE.Color(v)])) as Record<string, THREE.Color>;
  function setPaint(mode: PaintMode): void {
    paintMode = mode;
    field.restores.length = 0;
    if (mode === 'half') {
      // front sweeps diagonally through the middle of the wide shot; fox stands on the painted side
      field.restore(new THREE.Vector3(14, 0, 8), 14.5, 0.01, { edgeMax: 1.1 });
    } else if (mode === 'full') {
      field.restore(new THREE.Vector3(0, 0, -2), 70, 0.01, { edgeMax: 2.5 });
    }
    field.update(1);
    const k = mode === 'none' ? 0 : mode === 'half' ? 0.45 : 1;
    for (const key of Object.keys(SKY.paper)) {
      const c = (sky.params as unknown as Record<string, THREE.Color>)[key]!;
      c.copy(skyPaper[key]!).lerp(skyAutumn[key]!, k);
    }
    matchFogToSky(scene, fog, sky.params.mist);
    post.params.restore = k;
    lights.key.color.set(0xffe6c4).lerp(new THREE.Color(0xffc890), k);
  }
  function syncPaint(): void {
    paintU.uRestoreCount.value = Math.min(4, field.restores.length);
    field.restores.slice(0, 4).forEach((r, i) => paintU.uRestore.value[i]!.set(r.center.x, r.center.z, r.radius, Math.max(0.3, Math.min(r.edgeMax, r.radius * 0.18))));
  }
  function setCamera(shot: Shot): void {
    const s = SHOTS[shot];
    camera.position.set(...s.pos);
    camera.lookAt(...s.look);
    camera.fov = s.fov;
    camera.updateProjectionMatrix();
    fox.root.rotation.y = s.foxYaw;
    fox.setHeadYaw(s.headYaw);
    lights.key.target.position.set(s.look[0], 0, s.look[2]);
    lights.key.position.set(s.look[0] + 14, 16, s.look[2] + 6);
    lights.key.target.updateMatrixWorld();
  }

  let time = 0;
  function frame(dt: number): void {
    time += dt;
    fox.update(time);
    field.update(dt);
    syncPaint();
    sky.update(dt);
    post.render();
  }
  function resize(): void {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    forge.setSize(innerWidth, innerHeight);
    post.setSize(innerWidth, innerHeight);
  }
  addEventListener('resize', resize);

  setPaint('half');
  setCamera('wide');
  let manual = false;
  const hooks = {
    ready: false,
    get paint() {
      return paintMode;
    },
    setPaint,
    setCamera,
    advance(frames = 1, dt = 1 / 60) {
      manual = true;
      for (let i = 0; i < frames; i++) frame(dt);
      return time;
    },
  };
  (window as unknown as { __lookdevHooks: typeof hooks }).__lookdevHooks = hooks;
  // for tooling that waits on the game handle
  (window as unknown as { __game: object }).__game = { mode: 'lookdev-p0', hooks };

  let last = performance.now();
  const tick = () => {
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!manual) frame(dt);
    hooks.ready = true;
    requestAnimationFrame(tick);
  };
  tick();
}
