/**
 * Pressed Ink → Living Cel kit: toon ramps, paper ↔ cel paint patch (ColorField restore uniforms),
 * inverted-hull ink, jitter/hewn helpers, and the shared prop builders (maple, rock, arch, ruin, sky).
 * Scenes (lookdevP0 clearing, opening slice) own their layout; they build from here.
 */
import * as THREE from 'three';
import { createTrailUniforms, TRAIL_DECLARATIONS, TRAIL_BLEND } from './opening/paint';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const INK = new THREE.Color(0x24160e);
/** Deterministic RNG so every capture is the same slice */
export function rng(seed: number): () => number {
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

export function toonRamp(stops: number[]): THREE.DataTexture {
  const data = new Uint8Array(stops.length * 4);
  stops.forEach((v, i) => data.set([v, v, v, 255], i * 4));
  const tex = new THREE.DataTexture(data, stops.length, 1, THREE.RGBAFormat);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}
/** 3 bands: plum shadow, warm mid, lit */
export const RAMP_WORLD = toonRamp([70, 150, 255]);
/** Canopies: shallow shade step so a lobe's underside is one mid band, never a dark toadstool gill */
export const RAMP_CANOPY = toonRamp([118, 178, 255]);

/** Shared paint uniforms: restores as (x, z, radius, edge) */
export const paintU = {
  ...createTrailUniforms(),
  uRestore: { value: Array.from({ length: 4 }, () => new THREE.Vector4()) },
  uRestoreCount: { value: 0 },
  uPaper: { value: new THREE.Color(0.8, 0.66, 0.47) },
  uPaperInk: { value: new THREE.Color(0.2, 0.13, 0.08) },
};

export const NOISE_GLSL = /* glsl */ `
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
export function patchPaint(mat: THREE.MeshToonMaterial, contour: number, climbBase: number | null, hatchWeight = 1): void {
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, paintU);
    shader.uniforms.uLkContour = { value: contour };
    shader.uniforms.uLkHatchWeight = { value: hatchWeight };
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
        ${TRAIL_DECLARATIONS}
        uniform vec3 uPaper;
        uniform vec3 uPaperInk;
        uniform float uLkContour;
        uniform float uLkHatchWeight;
        uniform vec2 uLkClimb;
        ${NOISE_GLSL}`,
      )
      .replace(
        '#include <opaque_fragment>',
        `{
          vec2 xz = vLkWorld.xz;
          vec2 fc = gl_FragCoord.xy;
          // ragged watercolour front: large lobes + fine fibre bite
          float rag = (lkFbm(xz * 0.11) - 0.5) * 5.0 + (lkFbm(xz * 0.55 + 3.7) - 0.5) * 1.8 + (lkFbm(xz * 2.2 + 9.1) - 0.5) * 0.9 + (lkNoise(xz * 9.0) - 0.5) * 0.22;
          float lift = max(0.0, vLkWorld.y - uLkClimb.x) * uLkClimb.y;
          float drops = smoothstep(0.7, 0.78, lkNoise(xz * 1.3 + 11.0)) * (1.0 - step(0.2, lift));
          float paint = 0.0, tide = 0.0, bloom = 0.0;
          for (int i = 0; i < 4; i++) {
            if (i >= uRestoreCount) break;
            vec4 r = uRestore[i];
            float d = length(xz - r.xy) - r.z + rag * min(1.0, r.z / 12.0) + lift;
            // tight front so the edge reads as a wet brush stroke, not an airbrushed blur
            float e = max(0.06, r.w * 0.16);
            float p = 1.0 - smoothstep(-e, e, d);
            // stray pigment drops just past the front (ground level only)
            p = max(p, drops * (1.0 - smoothstep(0.0, 2.2, d)) * step(0.5, r.z));
            paint = max(paint, p);
            // pigment pools in a dark line just inside the front; water pushes a pale paper bloom ahead of it
            tide = max(tide, exp(-pow((d + e * 0.9) / (e * 0.9), 2.0)));
            bloom = max(bloom, exp(-pow((d - 0.35 - 0.25 * lkNoise(xz * 1.7)) / 0.3, 2.0)) * step(0.5, r.z));
          }
          ${TRAIL_BLEND}
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
          sepia = mix(sepia, uPaperInk * 1.25, max(l1 * 0.6, l2 * 0.65) * uLkHatchWeight);
          // painted cel on the same paper, wet sienna pigment bleeding at the front + dried tide-line inside it
          vec3 cel = outgoingLight * (0.95 + 0.08 * tooth) * (0.96 + 0.08 * lkNoise(xz * 2.3));
          vec3 pigment = vec3(0.42, 0.18, 0.08) * (0.55 + 0.6 * t);
          cel = mix(cel, pigment, tide * 0.7);
          float wet = paint * (1.0 - paint) * 4.0;
          sepia = mix(sepia, uPaper * 1.12, bloom * (1.0 - sh) * 0.55);
          outgoingLight = mix(sepia, cel, paint);
          outgoingLight = mix(outgoingLight, pigment, wet * 0.4);
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

export function toon(
  color: THREE.ColorRepresentation,
  opts: { vertexColors?: boolean; contour?: number; climbBase?: number; ramp?: THREE.Texture; hatchWeight?: number } = {},
): THREE.MeshToonMaterial {
  const m = new THREE.MeshToonMaterial({ color, gradientMap: opts.ramp ?? RAMP_WORLD, vertexColors: !!opts.vertexColors });
  patchPaint(m, opts.contour ?? 0, opts.climbBase ?? null, opts.hatchWeight ?? 1);
  return m;
}

/**
 * Inverted hull: back faces pushed out along smoothed normals, thicker with distance (≈ constant px).
 * `brush` swells/thins the stroke along the surface so world ink reads hand-inked, not CAD.
 */
export const inkMats = new Map<string, THREE.MeshBasicMaterial>();
export function inkMaterial(width: number, brush = false): THREE.MeshBasicMaterial {
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

export function hullGeometry(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', geo.getAttribute('position').clone());
  if (geo.index) g.setIndex(geo.index.clone());
  const merged = mergeVertices(g, 1e-3);
  merged.computeVertexNormals();
  return merged;
}

/** Mesh + ink hull child */
export function inked(geo: THREE.BufferGeometry, mat: THREE.Material, width = 0.018, brush = false): THREE.Mesh {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const hull = new THREE.Mesh(hullGeometry(geo), inkMaterial(width, brush));
  hull.castShadow = false;
  hull.userData.ink = true;
  mesh.add(hull);
  return mesh;
}

export function jitter(geo: THREE.BufferGeometry, amount: number, rand: () => number, freq = 1.3): THREE.BufferGeometry {
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

/** Flat-faced (chiselled) jittered block: hewn stone that keeps hard cel planes */
export function hewn(geo: THREE.BufferGeometry, rand: () => number, amount = 0.05): THREE.BufferGeometry {
  const g = jitter(geo, amount, rand, 1.1).toNonIndexed();
  g.computeVertexNormals();
  return g;
}

/**
 * Canopy lobe: a lumpy leaf-mass (clumped bulges + serrated leaf-tooth, only slightly flattened
 * underneath — never a mushroom cap). Vertex colours carry a 2-tone hue-shifted ramp (warm lit crown →
 * body); the toon ramp then bands the light on top of it, so the underside is a single shade band.
 */
export type CanopyTones = [number, number, number];
export function canopyPad(rand: () => number, radius: number, height: number, tones: CanopyTones): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, 40, 18);
  const p = g.getAttribute('position') as THREE.BufferAttribute;
  const ph = Array.from({ length: 6 }, () => rand() * 6.28);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const a = Math.atan2(z, x);
    // clumped bulges (sub-clusters of leaves) + fine serration for a jagged inked silhouette
    const clump = 0.2 * Math.sin(x * 3.1 + ph[0]!) * Math.sin(y * 2.7 + ph[1]!) * Math.sin(z * 3.3 + ph[2]!);
    const fine = 0.07 * Math.sin(x * 7.3 + ph[3]!) * Math.sin(y * 6.1 + ph[4]!) * Math.sin(z * 7.7 + ph[5]!);
    const tooth = 0.055 * Math.sin(a * 19 + y * 17 + ph[3]!) * Math.sin(y * 23 + ph[4]!);
    const notch = Math.pow(0.5 + 0.5 * Math.sin(a * 5 + y * 3 + ph[0]!), 5) * (1 - y * y) * 0.36;
    const k = 1 + clump * 1.35 + fine + tooth - notch;
    const yy = y > 0 ? y * height : y * height * 0.8;
    p.setXYZ(i, x * radius * k, yy * k, z * radius * k);
  }
  const out = jitter(g, 0.06, rand, 1.6);
  const n = out.getAttribute('normal') as THREE.BufferAttribute;
  const cols = new Float32Array(n.count * 3);
  const lit = new THREE.Color(tones[0]);
  const mid = new THREE.Color(tones[1]);
  const shade = new THREE.Color(tones[2]);
  const c = new THREE.Color();
  for (let i = 0; i < n.count; i++) {
    const ny = n.getY(i);
    // one body tone below, lit crown above — the toon ramp supplies the shade band (no plum toadstool cap)
    c.copy(shade).lerp(mid, THREE.MathUtils.smoothstep(ny, -0.8, -0.35)).lerp(lit, THREE.MathUtils.smoothstep(ny, 0.05, 0.4));
    cols.set([c.r, c.g, c.b], i * 3);
  }
  out.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  return out;
}

/** Muted melancholy canopies: lit / body / underside. Darker + greyer than the fox coat (0xc45c26) on purpose. */
export const CANOPY: CanopyTones[] = [
  [0xa4603e, 0x7e3e2c, 0x4f2a2c], // rust → plum
  [0xa88550, 0x80603a, 0x52392e], // ochre → umber
  [0x94483a, 0x6c3028, 0x45242a], // dried crimson
  [0x9a6d4a, 0x744832, 0x4a2e2e], // sienna
];

export type TreeKind = 'hero' | 'grove' | 'tall' | 'lean';

/**
 * Silhouette leaf card: a serrated five-lobed maple leaf (tip +Y, face +Z) with its own ink rim baked
 * in as dark vertex colour, so it reads as a drawn leaf breaking the canopy contour at any distance.
 */
export const RIM_LEAF = (() => {
  const outline = (grow: number) => {
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i < 120; i++) {
      const a = (i / 120) * Math.PI * 2;
      const x = a - Math.PI / 2;
      // palmate: 5 broad lobes with pointed tips and V sinuses, the two by the stem smaller, saw-tooth edge
      const u = (((x * 5) / (Math.PI * 2) + 0.5) % 1 + 1) % 1;
      const tri = 1 - Math.abs(u - 0.5) * 2;
      const lower = 1 - 0.5 * THREE.MathUtils.smoothstep(Math.abs(Math.atan2(Math.sin(x), Math.cos(x))), 1.7, 2.7);
      const r = (0.42 + 0.58 * Math.pow(tri, 1.3) * lower) * (1 + 0.07 * Math.abs(Math.sin(x * 30))) + grow;
      pts.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r + 0.42));
    }
    return pts;
  };
  const tint = (g: THREE.BufferGeometry, v: number) => {
    const n = g.getAttribute('position').count;
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(v), 3));
    return g;
  };
  const fill = tint(new THREE.ShapeGeometry(new THREE.Shape(outline(0))), 1);
  const ringShape = new THREE.Shape(outline(0.075));
  ringShape.holes.push(new THREE.Path(outline(0).reverse()));
  const ring = tint(new THREE.ShapeGeometry(ringShape), 0.12);
  const stem = tint(new THREE.PlaneGeometry(0.06, 0.32).translate(0, -0.08, -0.002), 0.12);
  return mergeGeometries([fill, ring, stem])!;
})();

/** Gnarled maple: flared, leaning trunk forking into limbs at staggered heights, each ending in a canopy lobe. */
export function buildMaple(rand: () => number, scale: number, kind: TreeKind, palette: number, baseY: number): THREE.Group {
  const g = new THREE.Group();
  const climbBase = baseY + 0.4;
  const bark = toon(0x4a3326, { contour: 0.8, climbBase });
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const tall = kind === 'hero' ? 4.0 : kind === 'tall' ? 4.8 : kind === 'lean' ? 3.6 : 3.4;
  const lean = kind === 'lean' ? 1.9 : (rand() - 0.5) * (kind === 'tall' ? 1.6 : 0.9);
  const sway = (rand() - 0.5) * 0.6;
  // 'lean': an old storm-bent maple — knuckled kink low, then the trunk reaches out over the path (+x)
  const trunkCurve = new THREE.CatmullRomCurve3(
    kind === 'lean'
      ? [V(0, -0.2, 0), V(0.25, tall * 0.28, 0.15), V(lean * 0.3, tall * 0.48, -0.25), V(lean * 0.72, tall * 0.74, 0.2), V(lean, tall, 0)]
      : [V(0, -0.2, 0), V(lean * 0.2, tall * 0.35, sway * 0.2), V(lean * 0.75, tall * 0.7, -sway * 0.3), V(lean, tall, sway * 0.4)],
  );
  const r0 = kind === 'hero' ? 0.42 : kind === 'lean' ? 0.38 : 0.3;
  const top = trunkCurve.getPointAt(1);
  const pads: Array<{ at: THREE.Vector3; r: number; h: number }> = [];
  {
    const trunkGeo = plumeGeometry(trunkCurve, (t) => THREE.MathUtils.lerp(r0, r0 * 0.4, t) + (1 - THREE.MathUtils.smoothstep(t, 0, 0.14)) * r0 * 0.7, 20, 9, 0);
    g.add(inked(jitter(trunkGeo, kind === 'lean' ? 0.09 : 0.05, rand, 2.0), bark, 0.024, true));
    // limbs fork out at different heights → tiered canopy, never one round lollipop
    const limbs = kind === 'hero' ? 6 : kind === 'lean' ? 4 : 5;
    const a0 = kind === 'lean' ? -0.6 : rand() * 6.28;
    // 1–2 limbs stay bare: real sky holes in the crown with the inked limb showing through
    const holeA = 1 + Math.floor(rand() * (limbs - 1));
    const holeB = kind === 'hero' || kind === 'tall' ? 1 + ((holeA + 1 + Math.floor(rand() * (limbs - 3))) % (limbs - 1)) : -1;
    for (let i = 0; i < limbs; i++) {
      // the bent tree throws its limbs to the leaning side
      const a = kind === 'lean' ? a0 + (i / (limbs - 1)) * 1.6 + (rand() - 0.5) * 0.4 : a0 + (i / limbs) * Math.PI * 2 + (rand() - 0.5) * 0.8;
      // staggered fork heights → lobes spread up the crown instead of one cap
      const from = trunkCurve.getPointAt(0.42 + (i / limbs) * 0.45 + rand() * 0.06);
      const bare = i === holeA || i === holeB;
      // bare limbs reach past the crown so they read as branches against sky, not lines on a lobe
      const reach = (kind === 'hero' ? 1.5 : kind === 'tall' ? 0.8 : 1.15) * (0.6 + rand() * 0.7) * (bare ? 1.05 : 1);
      const rise = 0.65 + rand() * 0.9;
      const end = from.clone().add(V(Math.cos(a) * reach, rise, Math.sin(a) * reach));
      const mid = from.clone().lerp(end, 0.5).add(V(0, -0.18, 0));
      const limbCurve = new THREE.CatmullRomCurve3([from, mid, end]);
      const lr = r0 * 0.42;
      g.add(inked(plumeGeometry(limbCurve, (t) => THREE.MathUtils.lerp(lr, lr * (bare ? 0.06 : 0.3), t), 10, 6, 0), bark, 0.018, true));
      if (bare) {
        // bare limb: forks into two inked twigs so the hole reads as branch, not a missing mesh
        for (const tw of [0.55]) {
          const fork = limbCurve.getPointAt(0.65);
          const tip = fork.clone().add(V(Math.cos(a + tw) * 0.38, 0.45 + rand() * 0.3, Math.sin(a + tw) * 0.38));
          g.add(inked(plumeGeometry(new THREE.CatmullRomCurve3([fork, fork.clone().lerp(tip, 0.5).add(V(0, -0.08, 0)), tip]), (t) => THREE.MathUtils.lerp(lr * 0.32, lr * 0.025, t), 6, 5, 0), bark, 0.014, true));
        }
        continue;
      }
      const r = (kind === 'hero' ? 1.1 : kind === 'tall' ? 0.75 : 0.9) * (0.6 + rand() * 0.7);
      pads.push({ at: end.clone().lerp(from, 0.18).add(V((rand() - 0.5) * 0.2, 0.05, (rand() - 0.5) * 0.2)), r, h: r * (0.7 + rand() * 0.2) });
    }
    // crown mass: a big top lobe with fillers packed between it and the limb tiers
    const cr = kind === 'hero' ? 1.6 : kind === 'tall' ? 1.0 : kind === 'lean' ? 1.15 : 1.25;
    // crown sits clear of the limb tier so light shows between them
    pads.push({ at: top.clone().add(V((rand() - 0.5) * 0.6, 0.85, (rand() - 0.5) * 0.6)), r: cr, h: cr * 0.8 });
    for (let i = 0; i < (kind === 'lean' ? 2 : 1); i++) {
      const fa = rand() * 6.28;
      const fr = 0.55 + rand() * 0.5;
      pads.push({ at: top.clone().add(V(Math.cos(fa) * cr * 0.75, (rand() - 0.3) * 0.9, Math.sin(fa) * cr * 0.75)), r: fr, h: fr * 0.8 });
    }
  }
  pads.forEach((pd, i) => {
    const tones = CANOPY[kind === 'hero' && i === 1 ? 1 : (palette + (i % 3 === 2 ? 1 : 0)) % CANOPY.length]!;
    const geo = canopyPad(rand, pd.r, pd.h, tones);
    const pad = inked(geo, toon(0xffffff, { vertexColors: true, contour: 0.9, climbBase, ramp: RAMP_CANOPY }), 0.028, true);
    pad.position.copy(pd.at);
    pad.rotation.set((rand() - 0.5) * 0.6, rand() * 6.28, (rand() - 0.5) * 0.6);
    g.add(pad);
  });
  // leaf sprigs on each lobe's silhouette band only: small inked palmate leaves standing out of the contour
  // in clusters (tip outward, face across the radial direction, so lobe-facing cards are edge-on)
  const CLUSTERS = 3;
  const PER = 4;
  const cardMat = toon(0xffffff, { vertexColors: true, climbBase, ramp: RAMP_CANOPY });
  cardMat.side = THREE.DoubleSide;
  const paintCards = cardMat.onBeforeCompile;
  cardMat.onBeforeCompile = (shader, renderer) => {
    paintCards(shader, renderer);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLeafOut;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vLeafOut = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * vec3(0.0, 1.0, 0.0));`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLeafOut;')
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        if (abs(dot(normalize(vLeafOut), normalize(cameraPosition - vLkWorld))) > 0.32) discard;`);
  };
  cardMat.customProgramCacheKey = () => 'lk-paint-rim-leaf';
  const cards = new THREE.InstancedMesh(RIM_LEAF, cardMat, pads.length * CLUSTERS * PER);
  const cm = new THREE.Matrix4();
  const cq = new THREE.Quaternion();
  const cs = new THREE.Vector3();
  const cp = new THREE.Vector3();
  const cc = new THREE.Color();
  const out = new THREE.Vector3();
  const across = new THREE.Vector3();
  const side = new THREE.Vector3();
  let ci = 0;
  pads.forEach((pd, i) => {
    const tones = CANOPY[kind === 'hero' && i === 1 ? 1 : (palette + (i % 3 === 2 ? 1 : 0)) % CANOPY.length]!;
    const a0 = rand() * 6.28;
    for (let k = 0; k < CLUSTERS; k++) {
      // one sprig breaks the contour together, a value step darker than its lobe
      const ak = a0 + (k / CLUSTERS) * Math.PI * 2 + (rand() - 0.5) * 0.8;
      const yk = -0.15 + rand() * 0.5;
      for (let j = 0; j < PER; j++, ci++) {
        const a = ak + (rand() - 0.5) * 0.35;
        const yv = yk + (rand() - 0.5) * 0.25;
        out.set(Math.cos(a), yv * 0.8, Math.sin(a)).normalize();
        across.set(-Math.sin(a), 0, Math.cos(a));
        side.crossVectors(out, across);
        cm.makeBasis(side, out, across).multiply(new THREE.Matrix4().makeRotationY((rand() - 0.5) * 0.4)).multiply(new THREE.Matrix4().makeRotationZ((rand() - 0.5) * 0.9));
        cq.setFromRotationMatrix(cm);
        cs.setScalar(pd.r * (0.15 + rand() * 0.07));
        cp.set(pd.at.x + Math.cos(a) * pd.r * 0.98, pd.at.y + yv * pd.h * 0.85, pd.at.z + Math.sin(a) * pd.r * 0.98);
        cards.setMatrixAt(ci, cm.compose(cp, cq, cs));
        cards.setColorAt(ci, cc.setHex(tones[1]).lerp(new THREE.Color(tones[0]), 0.25 + rand() * 0.2));
      }
    }
  });
  cards.castShadow = true;
  g.add(cards);
  g.scale.setScalar(scale);
  return g;
}

/** Field stone tinted over its whole surface (dark damp foot → warm umber body → olive moss crown), never a capped toadstool */
export function buildRock(rand: () => number, size: number, mossy = true): THREE.Mesh {
  const geo = jitter(new THREE.DodecahedronGeometry(size, 1), 0.16, rand, 0.7);
  geo.scale(1.2, 0.7, 1);
  const n = geo.getAttribute('normal') as THREE.BufferAttribute;
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const foot = new THREE.Color(0x4e3e34);
  const body = new THREE.Color(0x76604c);
  const moss = new THREE.Color(mossy ? 0x5e5c3a : 0x7a6a52);
  const cols = new Float32Array(n.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < n.count; i++) {
    const ny = n.getY(i);
    const patch = Math.sin(pos.getX(i) * 5.1 / size + 1.3) * Math.sin(pos.getZ(i) * 4.3 / size) * 0.25;
    c.copy(foot).lerp(body, THREE.MathUtils.smoothstep(ny, -0.6, -0.1)).lerp(moss, THREE.MathUtils.smoothstep(ny + patch, 0.15, 0.65) * 0.9);
    cols.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const rock = inked(geo, toon(0xffffff, { vertexColors: true, contour: 0.7 }), 0.026, true);
  rock.rotation.y = rand() * 6;
  return rock;
}

/**
 * Russetvale hearth arch: a weathered pointed arch of hewn voussoirs on stacked-stone piers, crowned
 * by twin ear-stones around an ember keystone (the fox-spirit's sign), rust-iron bands, one slipped
 * stone + rubble, autumn creeper on a shoulder, and a hanging ember lantern.
 */
export function buildArch(rand: () => number, baseY: number): THREE.Group {
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
export function buildRuinStub(rand: () => number): THREE.Group {
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


/** Five-lobed maple-leaf silhouette (not a confetti pentagon) */
export function mapleLeafGeometry(size: number): THREE.BufferGeometry {
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

export function buildDistance(scene: THREE.Scene, rand: () => number): void {
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
// Geometry helpers
// ---------------------------------------------------------------------------------------------

/** Capped tube with an authored radius profile; `lobes` > 0 adds flame lobes toward the tip */
export function plumeGeometry(curve: THREE.Curve<THREE.Vector3>, radius: (t: number) => number, rings = 36, sides = 12, lobes = 0.16): THREE.BufferGeometry {
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

// ---------------------------------------------------------------------------------------------
// Sky: paper sky with sepia ink-wash clouds ↔ painted melancholy dusk with cel-banded clouds
// ---------------------------------------------------------------------------------------------

export const SKY = {
  paper: { top: 0xbfa985, horizon: 0xe4d2ae, mist: 0xd8c3a0 },
  autumn: { top: 0x7a7086, mid: 0xb5866e, horizon: 0xdcae86, mist: 0xc9a68c },
  cloud: { lit: 0xe4bf98, mid: 0xc79a80, shade: 0xa8847a },
  sun: 0xffc27a,
};

export type LookdevSky = { setPaint: (k: number, dir: THREE.Vector2) => void; mist: THREE.Color; update: (dt: number) => void };

export function buildSky(scene: THREE.Scene, sunDir: THREE.Vector3): LookdevSky {
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
        // painted clouds are wet blooms: soft-edged body, pigment pooled just inside the rim
        float mSoft = smoothstep(thr - 0.03, thr + 0.07, c0) * smoothstep(0.015, 0.08, h);
        // ink-wash on paper spreads a little further than the painted bloom
        float mWash = smoothstep(thr - 0.07, thr + 0.05, c0) * smoothstep(0.015, 0.08, h);
        float pool = smoothstep(thr - 0.01, thr + 0.015, c0) * (1.0 - smoothstep(thr + 0.015, thr + 0.06, c0));
        // shading by what's above / below: crowns lit, bellies in shade → 3 hard-ish cel bands
        float s = clamp(0.52 + (cDn - cUp) * 4.5 + (c0 - thr) * 0.8, 0.0, 1.0);
        float b1 = smoothstep(0.34, 0.42, s);
        float b2 = smoothstep(0.6, 0.68, s);
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
        cc = mix(cc, cc * vec3(0.86, 0.76, 0.72), pool * 0.6);
        vec3 painted = mix(sky, cc, mSoft * 0.85);
        painted *= 0.95 + 0.08 * tooth;

        // --- paper: sepia ink-wash clouds — the same soft blooms as the painted sky, laid in diluted
        // sepia on paper: granulating body, pigment pooled at the rim, paper left for the lit crowns,
        // and loose hatching only on the shade side (never a hard cut-out)
        vec3 paper = mix(uPaperHor, uPaperTop, smoothstep(0.0, 0.8, hp)) * (0.9 + 0.14 * wash);
        paper *= (0.91 + 0.12 * tooth) * (0.96 + 0.07 * fibre);
        float gran = lkNoise(fc * 0.35) * 0.6 + lkNoise(vec2(az * 40.0, hp * 120.0)) * 0.4;
        vec3 sepiaWash = mix(paper, uInk * vec3(1.3, 1.1, 0.95), 0.26 + 0.1 * gran);
        vec3 sepiaShade = mix(paper, uInk, 0.46 + 0.08 * gran);
        vec3 cw = mix(sepiaShade, sepiaWash, b1);
        cw = mix(cw, paper * vec3(1.05, 1.03, 0.98), b2 * 0.85);
        cw = mix(cw, mix(paper, uInk, 0.66), pool * 0.8);
        float hl = fract((fc.x + fc.y + lkNoise(fc * 0.04) * 5.0) * 0.17);
        float lowerRim = smoothstep(0.025, 0.065, cUp - cDn) * (1.0 - smoothstep(thr + 0.07, thr + 0.14, c0));
        float shadeSide = lowerRim * (1.0 - smoothstep(0.24, 0.36, s)) * smoothstep(0.08, 0.18, hp) * (0.35 + 0.65 * (1.0 - sunSide));
        float hatch = smoothstep(0.42, 0.3, hl) * shadeSide * (0.55 + 0.45 * lkNoise(vec2(az * 9.0, hp * 30.0)));
        cw = mix(cw, uInk * 1.4, hatch * 0.38);
        vec3 unpainted = mix(paper, cw, mWash * (0.82 + 0.18 * gran));

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

