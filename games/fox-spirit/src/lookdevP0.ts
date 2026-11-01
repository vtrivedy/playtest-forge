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
/** Fox: deeper shadow step + firmer mid so the coat reads as cel, not airbrushed */
const RAMP_FOX = toonRamp([52, 140, 255]);

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
 * Paper ↔ cel patch for MeshToonMaterial. Unpainted: lit luminance → sepia paper with fibre/tooth,
 * stains and pressed-ink hatching (cross-hatched in the deepest band). Painted: the authored cel
 * colour on paper tooth. Edge: fbm-ragged front with a wet sienna pigment bleed + tide-line.
 * `contour` adds a brushy ink line where the surface turns away (smooth-normal props only);
 * `climbBase` makes the front climb from that height so canopies paint bottom-up, never speckled.
 */
function patchPaint(mat: THREE.MeshToonMaterial, contour: number, climbBase: number | null): void {
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, paintU);
    shader.uniforms.uLkContour = { value: contour };
    shader.uniforms.uLkClimb = { value: new THREE.Vector2(climbBase ?? 0, climbBase === null ? 0 : 0.35) };
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
        uniform float uLkContour;
        uniform vec2 uLkClimb;
        ${NOISE_GLSL}`,
      )
      .replace(
        '#include <opaque_fragment>',
        `{
          vec2 xz = vLkWorld.xz;
          vec2 fc = gl_FragCoord.xy;
          // ragged watercolour front: large lobes + fine fibre bite
          float rag = (lkFbm(xz * 0.11) - 0.5) * 5.0 + (lkFbm(xz * 0.55 + 3.7) - 0.5) * 1.8 + (lkNoise(xz * 2.6) - 0.5) * 0.45;
          float lift = max(0.0, vLkWorld.y - uLkClimb.x) * uLkClimb.y;
          float drops = smoothstep(0.7, 0.78, lkNoise(xz * 1.3 + 11.0)) * (1.0 - step(0.2, lift));
          float paint = 0.0, tide = 0.0;
          for (int i = 0; i < 4; i++) {
            if (i >= uRestoreCount) break;
            vec4 r = uRestore[i];
            float d = length(xz - r.xy) - r.z + rag * min(1.0, r.z / 12.0) + lift;
            float e = max(0.12, r.w * 0.6);
            float p = 1.0 - smoothstep(-e, e, d);
            // stray pigment drops just past the front (ground level only)
            p = max(p, drops * (1.0 - smoothstep(0.0, 2.2, d)) * step(0.5, r.z));
            paint = max(paint, p);
            tide = max(tide, exp(-pow((d + e * 0.6) / (e * 0.7), 2.0)));
          }
          float lum = dot(outgoingLight, vec3(0.2126, 0.7152, 0.0722));
          float t = clamp(lum / 1.25, 0.0, 1.0);
          // paper: tooth + laid fibres (screen) and old-paper stains / foxing (world)
          float tooth = lkNoise(fc * 0.9) * 0.5 + lkNoise(fc * 0.23) * 0.5;
          float fibre = lkNoise(vec2(fc.x * 0.06 + fc.y * 0.025, fc.y * 0.85));
          float stain = lkFbm(xz * 0.35 + vLkWorld.y * 0.2);
          float foxing = smoothstep(0.8, 0.86, lkNoise(xz * 0.7 + vLkWorld.y * 0.5 + 5.0));
          vec3 paper = uPaper * (0.84 + 0.26 * stain) * (0.9 + 0.14 * tooth) * (0.96 + 0.07 * fibre);
          paper = mix(paper, paper * vec3(0.82, 0.72, 0.6), foxing * 0.5);
          vec3 sepia = mix(uPaperInk, paper, smoothstep(0.02, 0.6, t));
          // pressed-ink hatching: lines thicken with shade, cross-hatch in the deepest band, hand-wobbled
          float wob = lkNoise(fc * 0.04) * 5.0;
          float sh = 1.0 - smoothstep(0.1, 0.42, t);
          float sh2 = 1.0 - smoothstep(0.04, 0.2, t);
          float h1 = fract((fc.x + fc.y + wob) * 0.17);
          float h2 = fract((fc.x - fc.y + wob) * 0.17);
          float l1 = smoothstep(sh * 0.5 + 0.12, sh * 0.5, h1) * smoothstep(0.0, 0.15, sh);
          float l2 = smoothstep(sh2 * 0.45 + 0.12, sh2 * 0.45, h2) * smoothstep(0.0, 0.2, sh2);
          sepia = mix(sepia, uPaperInk * 1.25, max(l1 * 0.6, l2 * 0.65));
          // painted cel on the same paper, wet sienna pigment bleeding at the front + dried tide-line inside it
          vec3 cel = outgoingLight * (0.95 + 0.08 * tooth) * (0.96 + 0.08 * lkNoise(xz * 2.3));
          vec3 pigment = vec3(0.5, 0.24, 0.11) * (0.55 + 0.7 * t);
          cel = mix(cel, pigment, tide * 0.5);
          float wet = paint * (1.0 - paint) * 4.0;
          outgoingLight = mix(sepia, cel, paint);
          outgoingLight = mix(outgoingLight, pigment * 1.2, wet * 0.35);
          // brushy contour ink where the surface turns away from the eye
          float ndv = abs(dot(normalize(normal), normalize(vViewPosition)));
          float brush = 0.65 + 0.7 * lkNoise(xz * 2.0 + vLkWorld.y * 3.0);
          float cont = (1.0 - smoothstep(0.1, 0.1 + 0.22 * brush, ndv)) * uLkContour;
          outgoingLight = mix(outgoingLight, uPaperInk * 0.8, cont);
        }
        #include <opaque_fragment>`,
      );
  };
  mat.customProgramCacheKey = () => 'lk-paint';
}

function toon(
  color: THREE.ColorRepresentation,
  opts: { vertexColors?: boolean; contour?: number; climbBase?: number } = {},
): THREE.MeshToonMaterial {
  const m = new THREE.MeshToonMaterial({ color, gradientMap: RAMP_WORLD, vertexColors: !!opts.vertexColors });
  patchPaint(m, opts.contour ?? 0, opts.climbBase ?? null);
  return m;
}

/**
 * Inverted hull: back faces pushed out along smoothed normals, thicker with distance (≈ constant px).
 * `brush` swells/thins the stroke along the surface so world ink reads hand-inked, not CAD.
 */
const inkMats = new Map<string, THREE.MeshBasicMaterial>();
function inkMaterial(width: number, brush = false): THREE.MeshBasicMaterial {
  const key = `${Math.round(width * 1000)}${brush ? 'b' : ''}`;
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
        float inkB = ${brush ? '0.55 + 0.9 * (0.5 + 0.5 * sin(inkWp.x * 3.1 + sin(inkWp.y * 2.3 + inkWp.z * 1.7) * 2.0))' : '1.0'};
        transformed += normalize(normal) * uInkW * inkB * clamp(inkD * 0.09, 0.45, 5.0);`,
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
function inked(geo: THREE.BufferGeometry, mat: THREE.Material, width = 0.018, brush = false): THREE.Mesh {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const hull = new THREE.Mesh(hullGeometry(geo), inkMaterial(width, brush));
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
  // muted, lower-value ground so the fox coat is the hottest note; grouped into soft cel patches
  const sage = new THREE.Color(0x6e6750);
  const ochre = new THREE.Color(0x8e7d5c);
  const umber = new THREE.Color(0x6f5640);
  const dirt = new THREE.Color(0xa39278);
  const c = new THREE.Color();
  const band = (v: number, at: number) => THREE.MathUtils.smoothstep(v, at - 0.05, at + 0.05);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, groundH(x, z));
    const n = Math.sin(x * 0.23 + Math.cos(z * 0.19) * 2) * 0.5 + 0.5;
    c.copy(sage).lerp(ochre, band(n, 0.45) * 0.85);
    // leaf-litter drifts under the maples
    const litter = Math.max(0, Math.sin(x * 0.5 + 1.3) * Math.sin(z * 0.43 - 0.4));
    c.lerp(umber, band(litter, 0.35) * 0.6);
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

/** Flat-faced (chiselled) jittered block: hewn stone that keeps hard cel planes */
function hewn(geo: THREE.BufferGeometry, rand: () => number, amount = 0.05): THREE.BufferGeometry {
  const g = jitter(geo, amount, rand, 1.1).toNonIndexed();
  g.computeVertexNormals();
  return g;
}

/**
 * Canopy pad: a scalloped leaf-mass with a domed top, flat underside and drooping rim. Vertex
 * colours carry a 3-tone hue-shifted cel ramp (warm lit crown → body → plum underside); the toon
 * ramp then bands the light on top of it.
 */
type CanopyTones = [number, number, number];
function canopyPad(rand: () => number, radius: number, height: number, tones: CanopyTones): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, 40, 14);
  const p = g.getAttribute('position') as THREE.BufferAttribute;
  const lobes = 5 + Math.floor(rand() * 3);
  const ph = rand() * 6.28;
  const ph2 = rand() * 6.28;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const a = Math.atan2(z, x);
    // big lobes + serrated leaf-tooth so the silhouette reads as foliage, not a smooth cap
    const scallop = 1 + 0.14 * Math.sin(a * lobes + ph) + 0.06 * Math.sin(a * (lobes * 2 + 1) + ph2) + 0.035 * Math.abs(Math.sin(a * 13 + ph2 * 3));
    const rim = 1 - Math.abs(y);
    const yy = (y > 0 ? y * height : y * height * 0.7) - rim * rim * height * 0.1;
    p.setXYZ(i, x * radius * scallop, yy, z * radius * scallop);
  }
  const out = jitter(g, 0.08, rand, 1.6);
  const n = out.getAttribute('normal') as THREE.BufferAttribute;
  const cols = new Float32Array(n.count * 3);
  const lit = new THREE.Color(tones[0]);
  const mid = new THREE.Color(tones[1]);
  const under = new THREE.Color(tones[2]);
  const c = new THREE.Color();
  for (let i = 0; i < n.count; i++) {
    const ny = n.getY(i);
    c.copy(under).lerp(mid, THREE.MathUtils.smoothstep(ny, -0.25, -0.1)).lerp(lit, THREE.MathUtils.smoothstep(ny, 0.5, 0.62));
    cols.set([c.r, c.g, c.b], i * 3);
  }
  out.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  return out;
}

/** Muted melancholy canopies: lit / body / underside. Darker + greyer than the fox coat (0xc45c26) on purpose. */
const CANOPY: CanopyTones[] = [
  [0xa4603e, 0x7e3e2c, 0x4f2a2c], // rust → plum
  [0xa88550, 0x80603a, 0x52392e], // ochre → umber
  [0x94483a, 0x6c3028, 0x45242a], // dried crimson
  [0x9a6d4a, 0x744832, 0x4a2e2e], // sienna
];
/** Leaf litter: same family, dimmer still — it sits under the fox and must not compete */
const LITTER = [0x744032, 0x80603e, 0x8a6c4a, 0x5c3028];

type TreeKind = 'hero' | 'grove' | 'shrub';

/** Gnarled maple: flared, leaning trunk forking into limbs at staggered heights, each ending in a canopy lobe. `shrub` = trunkless ground clump. */
function buildMaple(rand: () => number, scale: number, kind: TreeKind, palette: number, baseY: number): THREE.Group {
  const g = new THREE.Group();
  const climbBase = baseY + 0.4;
  const bark = toon(0x4a3326, { contour: 0.8, climbBase });
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const tall = kind === 'hero' ? 4.0 : 3.4;
  const lean = (rand() - 0.5) * 0.9;
  const sway = (rand() - 0.5) * 0.6;
  const trunkCurve = new THREE.CatmullRomCurve3([V(0, -0.2, 0), V(lean * 0.2, tall * 0.35, sway * 0.2), V(lean * 0.75, tall * 0.7, -sway * 0.3), V(lean, tall, sway * 0.4)]);
  const r0 = kind === 'hero' ? 0.42 : 0.3;
  const top = trunkCurve.getPointAt(1);
  const pads: Array<{ at: THREE.Vector3; r: number; h: number }> = [];
  if (kind === 'shrub') {
    // low clump of 3 lobes sitting in the litter
    for (let i = 0; i < 3; i++) {
      const a = rand() * 6.28;
      const r = 0.55 + rand() * 0.3;
      pads.push({ at: V(Math.cos(a) * 0.45 * i, r * 0.35 + i * 0.12, Math.sin(a) * 0.45 * i), r, h: r * 0.75 });
    }
  } else {
    const trunkGeo = plumeGeometry(trunkCurve, (t) => THREE.MathUtils.lerp(r0, r0 * 0.4, t) + (1 - THREE.MathUtils.smoothstep(t, 0, 0.14)) * r0 * 0.7, 20, 9, 0);
    g.add(inked(jitter(trunkGeo, 0.05, rand, 2.0), bark, 0.024, true));
    // limbs fork out at different heights → tiered canopy, never one round lollipop
    const limbs = kind === 'hero' ? 5 : 4;
    const a0 = rand() * 6.28;
    for (let i = 0; i < limbs; i++) {
      const a = a0 + (i / limbs) * Math.PI * 2 + (rand() - 0.5) * 0.8;
      // staggered fork heights → lobes spread up the crown instead of one cap
      const from = trunkCurve.getPointAt(0.42 + (i / limbs) * 0.45 + rand() * 0.06);
      const reach = (kind === 'hero' ? 1.5 : 1.15) * (0.75 + rand() * 0.45);
      const rise = 0.5 + rand() * 0.9;
      const end = from.clone().add(V(Math.cos(a) * reach, rise, Math.sin(a) * reach));
      const mid = from.clone().lerp(end, 0.5).add(V(0, 0.35, 0));
      const limbCurve = new THREE.CatmullRomCurve3([from, mid, end]);
      const lr = r0 * 0.42;
      g.add(inked(plumeGeometry(limbCurve, (t) => THREE.MathUtils.lerp(lr, lr * 0.45, t), 10, 6, 0), bark, 0.018, true));
      const r = (kind === 'hero' ? 1.15 : 0.92) * (0.8 + rand() * 0.4);
      pads.push({ at: end.add(V(0, 0.25, 0)), r, h: r * (0.6 + rand() * 0.15) });
    }
    // crown mass: a big top lobe with fillers packed between it and the limb tiers
    const cr = kind === 'hero' ? 1.8 : 1.4;
    pads.push({ at: top.clone().add(V(0, 0.7, 0)), r: cr, h: cr * 0.68 });
    for (let i = 0; i < 2; i++) {
      const fa = rand() * 6.28;
      const fr = 0.8 + rand() * 0.3;
      pads.push({ at: top.clone().add(V(Math.cos(fa) * cr * 0.6, 0.15 + rand() * 0.5, Math.sin(fa) * cr * 0.6)), r: fr, h: fr * 0.7 });
    }
  }
  pads.forEach((pd, i) => {
    const tones = CANOPY[(palette + (i % 3 === 2 ? 1 : 0)) % CANOPY.length]!;
    const geo = canopyPad(rand, pd.r, pd.h, tones);
    const pad = inked(geo, toon(0xffffff, { vertexColors: true, contour: 0.9, climbBase }), 0.028, true);
    pad.position.copy(pd.at);
    pad.rotation.set((rand() - 0.5) * 0.25, rand() * 6.28, (rand() - 0.5) * 0.25);
    g.add(pad);
  });
  g.scale.setScalar(scale);
  return g;
}

function buildRock(rand: () => number, size: number, mossy = true): THREE.Mesh {
  const geo = jitter(new THREE.DodecahedronGeometry(size, 1), 0.16, rand, 0.7);
  geo.scale(1.2, 0.7, 1);
  const rock = inked(geo, toon(mossy ? 0x7e7a6c : 0x8e8472, { contour: 0.7 }), 0.026, true);
  rock.rotation.y = rand() * 6;
  return rock;
}

/**
 * Russetvale hearth arch: a weathered pointed arch of hewn voussoirs on stacked-stone piers, crowned
 * by twin ear-stones around an ember keystone (the fox-spirit's sign), rust-iron bands, one slipped
 * stone + rubble, autumn creeper on a shoulder, and a hanging ember lantern.
 */
function buildArch(rand: () => number, baseY: number): THREE.Group {
  const g = new THREE.Group();
  const climbBase = baseY + 0.2;
  const stoneA = toon(0x8a7b66, { climbBase });
  const stoneB = toon(0x766857, { climbBase });
  const plinthM = toon(0x7a6c5a, { climbBase });
  const iron = toon(0x5c3324, { climbBase });
  const W = 0.026;
  const block = (w: number, h: number, d: number, m: THREE.Material, amount = 0.05) => inked(hewn(new THREE.BoxGeometry(w, h, d, 2, 2, 2), rand, amount), m, W, true);
  // two-step plinth, half sunk
  const s1 = block(5.8, 0.4, 2.6, plinthM, 0.03);
  s1.position.y = 0.05;
  g.add(s1);
  const s2 = block(4.9, 0.3, 2.0, plinthM, 0.03);
  s2.position.y = 0.4;
  g.add(s2);
  // stacked-stone piers, tapering, every course a little off
  const SPAN = 1.75;
  const COURSE = 0.62;
  const SPRING = 0.55 + 5 * COURSE + 0.32;
  for (const sx of [-1, 1]) {
    for (let k = 0; k < 5; k++) {
      const w = 1.05 - k * 0.04;
      const b = block(w, COURSE * 0.94, 0.95 - k * 0.02, (k + (sx > 0 ? 1 : 0)) % 2 ? stoneA : stoneB);
      b.position.set(sx * SPAN + (rand() - 0.5) * 0.08, 0.55 + COURSE * (k + 0.5), (rand() - 0.5) * 0.06);
      b.rotation.y = (rand() - 0.5) * 0.12;
      g.add(b);
    }
    const cap = block(1.25, 0.3, 1.1, stoneB);
    cap.position.set(sx * SPAN, SPRING - 0.15, 0);
    g.add(cap);
    const band = inked(new THREE.BoxGeometry(1.1, 0.13, 1.0), iron, 0.018, true);
    band.position.set(sx * SPAN, 0.55 + COURSE * 2.95, 0);
    g.add(band);
  }
  // pointed (two-centred) arch: centres offset across the span, radius R
  const RISE = 2.4;
  const e = (RISE * RISE - SPAN * SPAN) / (2 * SPAN);
  const R = SPAN + e;
  const thetaMax = Math.acos(e / R);
  const keyHalf = 0.14;
  const N = 5;
  const dTheta = (thetaMax - keyHalf) / N;
  for (const sx of [-1, 1]) {
    for (let i = 0; i < N; i++) {
      const th = (i + 0.5) * dTheta;
      const v = block(0.66, R * dTheta * 0.9, 0.9, (i + (sx > 0 ? 0 : 1)) % 2 ? stoneA : stoneB, 0.04);
      v.position.set(sx * (R * Math.cos(th) - e), SPRING + R * Math.sin(th), 0);
      v.rotation.z = sx > 0 ? th : Math.PI - th;
      // ruin: one stone on the left has slipped
      if (sx < 0 && i === 2) {
        v.position.y -= 0.12;
        v.position.z += 0.08;
        v.rotation.z += 0.12;
      }
      g.add(v);
    }
  }
  const apex = SPRING + Math.sqrt(R * R - e * e);
  const key = block(0.7, 1.0, 1.05, stoneA, 0.03);
  key.position.set(0, apex + 0.05, 0);
  g.add(key);
  // twin ear-stones: the crown silhouette that says "fox shrine" without borrowing a torii
  for (const sx of [-1, 1]) {
    const earGeo = new THREE.ConeGeometry(0.28, 0.95, 4, 2);
    earGeo.translate(0, 0.47, 0);
    earGeo.scale(1, 1, 0.6);
    const ear = inked(hewn(earGeo, rand, 0.04), stoneB, W, true);
    ear.position.set(sx * 0.24, apex + 0.5, 0);
    ear.rotation.set(0, sx * 0.2, -sx * 0.32);
    g.add(ear);
  }
  // ember sigil set into the keystone face
  const ember = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.0, 1.15, 0.3) });
  const sigil = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), ember);
  sigil.scale.set(0.11, 0.2, 0.04);
  sigil.position.set(0, apex + 0.1, 0.53);
  g.add(sigil);
  // rubble from the slip + a fallen course
  const r1 = block(0.6, 0.45, 0.7, stoneB);
  r1.position.set(-2.9, 0.3, 1.2);
  r1.rotation.set(0.2, 0.7, 0.35);
  g.add(r1);
  const r2 = block(0.4, 0.3, 0.45, stoneA);
  r2.position.set(-2.4, 0.18, 1.8);
  r2.rotation.set(-0.3, 1.9, 0.1);
  g.add(r2);
  // autumn creeper draped over the right shoulder (paints with the world)
  for (let i = 0; i < 3; i++) {
    const th = thetaMax * (0.3 + i * 0.22);
    const pad = inked(canopyPad(rand, 0.48 - i * 0.06, 0.34, CANOPY[i % 2 === 0 ? 0 : 2]!), toon(0xffffff, { vertexColors: true, contour: 0.9, climbBase }), 0.022, true);
    pad.position.set(R * Math.cos(th) - e + 0.1, SPRING + R * Math.sin(th) + 0.35, 0.15 * (i - 1));
    pad.rotation.set(0.3, rand() * 6, -0.4);
    g.add(pad);
  }
  // hanging ember lantern under the keystone
  const intrados = SPRING + Math.sqrt((R - 0.33) ** 2 - e * e);
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.55), new THREE.MeshBasicMaterial({ color: INK }));
  cord.position.set(0, intrados - 0.27, 0);
  g.add(cord);
  const roof = inked(new THREE.ConeGeometry(0.28, 0.22, 6), iron, 0.014, true);
  roof.position.set(0, intrados - 0.62, 0);
  g.add(roof);
  const cage = inked(new THREE.CylinderGeometry(0.17, 0.2, 0.36, 6, 1, true), iron, 0.012);
  cage.position.set(0, intrados - 0.9, 0);
  g.add(cage);
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), ember);
  glow.position.set(0, intrados - 0.9, 0);
  g.add(glow);
  const light = new THREE.PointLight(0xff9a4a, 7, 8, 1.6);
  light.position.set(0, intrados - 0.95, 0.3);
  g.add(light);
  return g;
}

/** Broken pier stub: two courses standing, the third fallen */
function buildRuinStub(rand: () => number): THREE.Group {
  const g = new THREE.Group();
  const m = toon(0x857561);
  for (let k = 0; k < 2; k++) {
    const b = inked(hewn(new THREE.BoxGeometry(0.95 - k * 0.08, 0.58, 0.9, 2, 2, 2), rand), m, 0.026, true);
    b.position.set((rand() - 0.5) * 0.1, 0.25 + 0.6 * k, 0);
    b.rotation.y = (rand() - 0.5) * 0.2;
    g.add(b);
  }
  const f = inked(hewn(new THREE.BoxGeometry(0.9, 0.55, 0.85, 2, 2, 2), rand), m, 0.026, true);
  f.position.set(0.9, 0.2, 0.6);
  f.rotation.set(0.15, 0.6, 1.2);
  g.add(f);
  return g;
}

function buildGrass(scene: THREE.Scene, rand: () => number): void {
  // short, thin, muted tufts: texture for the ground, never a foreground focal point
  const blade = new THREE.ConeGeometry(0.035, 0.42, 3);
  blade.translate(0, 0.2, 0);
  const mat = toon(0xffffff);
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
    // keep the path and the hero-shot foreground clear
    if (pathDist(x, z) < 1.4 || Math.hypot(x + 1.6, z - 7.2) < 3.5) continue;
    // tufts: 3-5 blades around a point
    const cnt = 3 + Math.floor(rand() * 3);
    for (let j = 0; j < cnt && k < N; j++, k++) {
      p.set(x + (rand() - 0.5) * 0.3, 0, z + (rand() - 0.5) * 0.3);
      p.y = groundH(p.x, p.z) - 0.03;
      e.set((rand() - 0.5) * 0.7, rand() * 6, (rand() - 0.5) * 0.7);
      q.setFromEuler(e);
      const h = 0.5 + rand() * 0.7;
      s.set(1, h, 1);
      m.compose(p, q, s);
      mesh.setMatrixAt(k, m);
      col.setHex(rand() < 0.6 ? 0x8f8350 : rand() < 0.5 ? 0x6e7148 : 0x8e5a3a);
      mesh.setColorAt(k, col);
    }
  }
  mesh.receiveShadow = true;
  scene.add(mesh);
}

/** Five-lobed maple-leaf silhouette (not a confetti pentagon) */
function mapleLeafGeometry(size: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const pts = 10;
  for (let i = 0; i <= pts; i++) {
    const a = (i / pts) * Math.PI * 2 + Math.PI / 2;
    const r = i % 2 === 0 ? (i === 0 || i === pts ? 1 : 0.85) : 0.62;
    const x = Math.cos(a) * r * size;
    const y = Math.sin(a) * r * size;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  const g = new THREE.ShapeGeometry(shape);
  g.rotateX(-Math.PI / 2);
  return g;
}

function buildLeaves(scene: THREE.Scene, rand: () => number): void {
  const mesh = new THREE.InstancedMesh(mapleLeafGeometry(0.085), toon(0xffffff), 700);
  const m = new THREE.Matrix4();
  const col = new THREE.Color();
  for (let i = 0; i < 700; i++) {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * 22;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r - 3;
    m.makeRotationY(rand() * 6).setPosition(x, groundH(x, z) + 0.02, z);
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, col.setHex(LITTER[i % LITTER.length]!));
  }
  mesh.receiveShadow = true;
  scene.add(mesh);
}

function buildDistance(scene: THREE.Scene, rand: () => number): void {
  // layered ridges that fade into the mist
  const ridgeMat = toon(0x7e6a62);
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
        outgoingLight += vec3(1.0, 0.55, 0.22) * smoothstep(0.55, 0.85, rim) * 0.34;
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
  // cream throat blaze: thin sliver laid along the underside of the neck, sunk so only its face shows
  const bib = new THREE.Mesh(ellipsoid([0.04, 0.095, 0.03]), cream);
  bib.position.set(0, 0.105, 0.405);
  bib.rotation.x = 0.78;
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
  // cream underjaw tucked inside the snout: only a thin underside sliver shows (no grin line)
  const jawGeo = new THREE.ConeGeometry(0.055, 0.14, 8);
  jawGeo.rotateX(Math.PI / 2);
  jawGeo.scale(1, 0.5, 1);
  const jaw = new THREE.Mesh(jawGeo, cream);
  jaw.position.set(0, -0.05, 0.13);
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

  // one tapered tube per leg, coat fading to ink toward the paw; hind legs kink back at the hock
  const legMat = foxToon(0xffffff);
  const legPrev = legMat.onBeforeCompile;
  legMat.onBeforeCompile = (shader, r) => {
    legPrev.call(legMat, shader, r);
    shader.uniforms.uLegTop = { value: new THREE.Color(0xc45c26) };
    shader.uniforms.uLegInk = { value: new THREE.Color(0x2a1a14) };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aAlong;\nvarying float vAlong;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvAlong = aAlong;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vAlong;\nuniform vec3 uLegTop;\nuniform vec3 uLegInk;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = mix(uLegTop, uLegInk, smoothstep(0.45, 0.8, vAlong));');
  };
  legMat.customProgramCacheKey = () => 'lk-fox-leg';
  const V = (y: number, z: number) => new THREE.Vector3(0, y, z);
  const frontLeg = plumeGeometry(
    new THREE.CatmullRomCurve3([V(0, 0), V(-0.14, 0.01), V(-0.28, 0.0), V(-0.37, 0.005), V(-0.395, 0.05)]),
    (t) => THREE.MathUtils.lerp(0.07, 0.028, Math.min(1, t * 1.15)) + THREE.MathUtils.smoothstep(t, 0.85, 1) * 0.008,
    24,
    10,
    0,
  );
  const hindLeg = plumeGeometry(
    new THREE.CatmullRomCurve3([V(0, 0), V(-0.13, 0.035), V(-0.25, -0.04), V(-0.37, -0.005), V(-0.395, 0.045)]),
    (t) => THREE.MathUtils.lerp(0.085, 0.028, Math.min(1, t * 1.15)) + THREE.MathUtils.smoothstep(t, 0.85, 1) * 0.008,
    24,
    10,
    0,
  );
  const legs: THREE.Group[] = [];
  const legDefs: Array<[number, number, number, boolean]> = [
    [0.085, 0.2, 0, false],
    [-0.085, 0.2, 0.18, false],
    [0.09, -0.3, 0.14, true],
    [-0.09, -0.3, -0.1, true],
  ];
  for (const [x, z, swing, hind] of legDefs) {
    const leg = new THREE.Group();
    leg.position.set(x, 0.0, z);
    leg.rotation.x = swing;
    body.add(leg);
    leg.add(inked(hind ? hindLeg : frontLeg, legMat, W * 0.8));
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
// Sky: paper sky with ink-drawn cloud banks ↔ painted melancholy dusk with cel-banded clouds
// ---------------------------------------------------------------------------------------------

const SKY = {
  paper: { top: 0xbfa985, horizon: 0xe4d2ae, mist: 0xd8c3a0 },
  autumn: { top: 0x7a7086, mid: 0xb5866e, horizon: 0xdcae86, mist: 0xc9a68c },
  cloud: { lit: 0xeccaa0, mid: 0xc09080, shade: 0x93706a },
  sun: 0xffc27a,
};

type LookdevSky = { setPaint: (k: number, dir: THREE.Vector2) => void; mist: THREE.Color; update: (dt: number) => void };

function buildSky(scene: THREE.Scene, sunDir: THREE.Vector3): LookdevSky {
  const C = (h: number) => new THREE.Color(h);
  const mist = new THREE.Color();
  const u = {
    uPaperTop: { value: C(SKY.paper.top) },
    uPaperHor: { value: C(SKY.paper.horizon) },
    uInk: { value: INK.clone() },
    uTop: { value: C(SKY.autumn.top) },
    uMid: { value: C(SKY.autumn.mid) },
    uHor: { value: C(SKY.autumn.horizon) },
    uMist: { value: mist },
    uLit: { value: C(SKY.cloud.lit) },
    uCMid: { value: C(SKY.cloud.mid) },
    uShade: { value: C(SKY.cloud.shade) },
    uSun: { value: C(SKY.sun) },
    uSunDir: { value: sunDir.clone().normalize() },
    uPaintDir: { value: new THREE.Vector2(1, 0) },
    uPaint: { value: 0 },
    uTime: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: u,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uPaperTop, uPaperHor, uInk, uTop, uMid, uHor, uMist, uLit, uCMid, uShade, uSun, uSunDir;
      uniform vec2 uPaintDir;
      uniform float uPaint, uTime;
      varying vec3 vDir;
      ${NOISE_GLSL}
      // long banked cumulus in (azimuth, elevation) space, thickest in a band above the horizon
      float cloud(vec2 p) {
        vec2 q = vec2(p.x * 1.5, p.y * 5.0) + vec2(uTime * 0.004, 0.0);
        q += (vec2(lkNoise(q * 0.6 + 3.1), lkNoise(q * 0.6 - 7.7)) - 0.5) * vec2(0.9, 0.5);
        float band = smoothstep(0.03, 0.16, p.y) * (1.0 - smoothstep(0.34, 0.7, p.y));
        return lkFbm(q) + band * 0.22 - 0.06;
      }
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        float hp = max(h, 0.0);
        vec2 fc = gl_FragCoord.xy;
        // seam sits behind every lookdev camera (+z)
        float az = atan(d.x, -d.z);
        vec2 p = vec2(az, hp);
        float thr = 0.5 + (lkNoise(vec2(az * 60.0, hp * 160.0)) - 0.5) * 0.035;
        float c0 = cloud(p);
        float cUp = cloud(p + vec2(0.0, 0.035));
        float cDn = cloud(p - vec2(0.0, 0.035));
        float m = smoothstep(thr, thr + 0.008, c0) * smoothstep(0.015, 0.05, h);
        // shading by what's above / below: crowns lit, bellies in shade → 3 hard-ish cel bands
        float s = clamp(0.52 + (cDn - cUp) * 4.5 + (c0 - thr) * 0.8, 0.0, 1.0);
        float b1 = smoothstep(0.36, 0.4, s);
        float b2 = smoothstep(0.62, 0.66, s);
        float edge = 1.0 - smoothstep(0.0, 0.035, c0 - thr);
        float sunSide = 0.5 + 0.5 * dot(normalize(d.xz + 1e-4), normalize(uSunDir.xz + 1e-4));
        float tooth = lkNoise(fc * 0.9) * 0.5 + lkNoise(fc * 0.23) * 0.5;
        float fibre = lkNoise(vec2(fc.x * 0.06 + fc.y * 0.025, fc.y * 0.85));
        float wash = lkFbm(vec2(az * 1.3, hp * 3.0) + 9.0);

        // --- painted: dusk wash, banked cel clouds with pooled pigment edges
        vec3 sky = mix(uHor, uMid, smoothstep(0.02, 0.25, hp));
        sky = mix(sky, uTop, smoothstep(0.2, 0.85, hp));
        sky *= 0.93 + 0.12 * wash;
        sky += uSun * exp(-abs(h - 0.04) * 10.0) * pow(sunSide, 3.0) * 0.18;
        vec3 cc = mix(uShade, uCMid, b1);
        cc = mix(cc, uLit, b2);
        cc = mix(cc, cc * vec3(1.06, 0.98, 0.9), pow(sunSide, 2.0) * 0.5);
        cc *= 1.0 - edge * 0.22;
        vec3 painted = mix(sky, cc, m);
        painted *= 0.95 + 0.08 * tooth;

        // --- paper: sepia wash, clouds left as paper with ink contour + hatched bellies
        vec3 paper = mix(uPaperHor, uPaperTop, smoothstep(0.0, 0.8, hp)) * (0.9 + 0.14 * wash);
        paper *= (0.91 + 0.12 * tooth) * (0.96 + 0.07 * fibre);
        vec3 cloudPaper = mix(uPaperHor, vec3(1.0, 0.96, 0.88), 0.35) * (0.93 + 0.1 * tooth);
        float hl = fract((fc.x + fc.y + lkNoise(fc * 0.04) * 5.0) * 0.17);
        float hatch = smoothstep(0.4, 0.28, hl) * (1.0 - b2) + smoothstep(0.5, 0.36, hl) * (1.0 - b1);
        cloudPaper = mix(cloudPaper, uInk * 1.6, clamp(hatch, 0.0, 1.0) * 0.4);
        vec3 unpainted = mix(paper, cloudPaper, m);
        float line = m * (1.0 - smoothstep(0.0, 0.03, c0 - thr));
        unpainted = mix(unpainted, uInk, line * 0.85);

        // ragged sweep of paint across the dome toward the restore
        float rag = (lkFbm(vec2(az * 3.0, hp * 6.0)) - 0.5) * 0.5;
        float side = dot(normalize(d.xz + 1e-4), uPaintDir);
        float pm = uPaint >= 0.999 ? 1.0 : smoothstep(-0.03, 0.03, side - (1.0 - 2.0 * uPaint) + rag) * step(0.001, uPaint);
        vec3 col = mix(unpainted, painted, pm);
        col = mix(col, col * vec3(0.72, 0.56, 0.44), pm * (1.0 - pm) * 4.0 * 0.5);
        // horizon mist (= scene fog) and the band below it
        col = mix(col, uMist, 1.0 - smoothstep(-0.01, 0.09 + 0.03 * wash, h));
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(300, 64, 32), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  mesh.onBeforeRender = (_r, _s, cam) => {
    mesh.position.copy(cam.position);
    mesh.updateMatrixWorld();
  };
  scene.add(mesh);
  const paperMist = C(SKY.paper.mist);
  const autumnMist = C(SKY.autumn.mist);
  return {
    mist,
    setPaint(k, dir) {
      u.uPaint.value = k;
      u.uPaintDir.value.copy(dir).normalize();
      mist.copy(paperMist).lerp(autumnMist, k);
    },
    update(dt) {
      u.uTime.value += dt;
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------------------------

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
  // less flat fill → firmer cel bands; stronger warm back-rim separates every silhouette (fox included) from the ground
  lights.hemi.intensity = 0.7;
  lights.rim.intensity = 1.3;
  lights.rim.color.set(0xffc690);
  const fog = applyHeightFog(scene, { density: 0.012, height: 1, heightFalloff: 0.06 });
  const sky = buildSky(scene, new THREE.Vector3(0.7, 0.32, 0.25));

  const rand = rng(7);
  buildGround(scene);
  buildDistance(scene, rand);
  buildGrass(scene, rand);
  buildLeaves(scene, rand);

  const ARCH = new THREE.Vector3(-0.3, 0, -8);
  const arch = buildArch(rand, groundH(ARCH.x, ARCH.z));
  arch.position.set(ARCH.x, groundH(ARCH.x, ARCH.z) - 0.15, ARCH.z);
  arch.rotation.y = 0.12;
  scene.add(arch);
  const stub = buildRuinStub(rand);
  stub.position.set(-4.4, groundH(-4.4, -6.2) - 0.1, -6.2);
  stub.rotation.y = 0.5;
  scene.add(stub);

  // irregular grove: a hero maple framing the arch, a leaning pair, loners and low shrubs — no grid
  const trees: Array<[number, number, number, TreeKind, number]> = [
    [4.4, -7.6, 1.35, 'hero', 0],
    [-4.9, -10.2, 1.15, 'grove', 2],
    [-6.9, -7.4, 0.9, 'grove', 1],
    [-6.2, -1.2, 1.05, 'grove', 3],
    [8.2, 0.8, 0.95, 'grove', 2],
    [2.2, -16.5, 1.4, 'grove', 1],
    [-9.5, -15, 1.3, 'grove', 0],
    [11.5, -10.5, 1.2, 'hero', 3],
    [-13.5, -3.5, 1.35, 'grove', 2],
    [-8.2, 6.4, 0.85, 'grove', 1],
    [3.3, -3.4, 0.9, 'shrub', 3],
    [-3.4, 5.0, 1.0, 'shrub', 0],
    [-2.6, -10.6, 0.9, 'shrub', 1],
    [6.4, -3.2, 0.8, 'shrub', 2],
  ];
  for (const [x, z, sc, kind, pal] of trees) {
    const y = groundH(x, z);
    const t = buildMaple(rand, sc, kind, pal, y);
    t.position.set(x, y - 0.1, z);
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
    // half: the sky paints from the side the restore is sweeping in from (frame right)
    sky.setPaint(k, new THREE.Vector2(0.8, -0.6));
    matchFogToSky(scene, fog, sky.mist);
    post.params.restore = k;
    lights.key.color.set(0xffe6c4).lerp(new THREE.Color(0xffd6b0), k);
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
