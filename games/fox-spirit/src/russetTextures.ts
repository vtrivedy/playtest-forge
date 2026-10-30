import * as THREE from 'three';

/**
 * Procedural surface textures for Russetvale, generated once at load.
 * Albedo maps are near-neutral multipliers: hue comes from the per-vertex
 * restored palette, so ColorField's sepia wash keeps working unchanged.
 */

// ---------------------------------------------------------------- tileable noise

function ihash(x: number, y: number, s: number): number {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Value noise on a `period`-cell lattice that wraps exactly. */
function pnoise(x: number, y: number, period: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const m = (a: number) => ((a % period) + period) % period;
  const a = ihash(m(xi), m(yi), seed);
  const b = ihash(m(xi + 1), m(yi), seed);
  const c = ihash(m(xi), m(yi + 1), seed);
  const d = ihash(m(xi + 1), m(yi + 1), seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** fbm over [0,1)² that tiles; `base` lattice cells per tile at octave 0. */
function pfbm(u: number, v: number, base: number, oct: number, seed: number): number {
  let s = 0;
  let a = 0.5;
  let p = base;
  let n = 0;
  for (let i = 0; i < oct; i++) {
    s += a * pnoise(u * p, v * p, p, seed + i * 17);
    n += a;
    a *= 0.5;
    p *= 2;
  }
  return s / n;
}

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 1000003) / 1000003;
  };
}

// ---------------------------------------------------------------- helpers

type Field = Float32Array;

function toTexture(N: number, rgba: Uint8Array, srgb: boolean): THREE.DataTexture {
  const t = new THREE.DataTexture(rgba, N, N, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 8;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.needsUpdate = true;
  return t;
}

/** Tangent-space normal map from a wrapped height field (canvas y down → +v up). */
function normalFromHeight(N: number, H: Field, strength: number): THREE.DataTexture {
  const out = new Uint8Array(N * N * 4);
  const at = (x: number, y: number) => H[((y + N) % N) * N + ((x + N) % N)]!;
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      let nx = -dx;
      let ny = dy;
      let nz = 1;
      const l = Math.hypot(nx, ny, nz);
      nx /= l;
      ny /= l;
      nz /= l;
      const k = (y * N + x) * 4;
      out[k] = Math.round((nx * 0.5 + 0.5) * 255);
      out[k + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      out[k + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      out[k + 3] = 255;
    }
  }
  return toTexture(N, out, false);
}

/** Thin random-walk crack, carved into height H and a darkening mask D. */
function crack(N: number, H: Field, D: Field, r: () => number, len: number, depth: number, vertical = 0): void {
  let x = r() * N;
  let y = r() * N;
  let a = vertical ? Math.PI / 2 + (r() - 0.5) * 0.6 : r() * Math.PI * 2;
  for (let i = 0; i < len; i++) {
    a += (r() - 0.5) * 0.22;
    if (vertical) a += (Math.PI / 2 - (((a % Math.PI) + Math.PI) % Math.PI)) * 0.15;
    x += Math.cos(a);
    y += Math.sin(a);
    const w = r() < 0.1 ? 1 : 0;
    for (let oy = -w; oy <= w; oy++) {
      for (let ox = -w; ox <= w; ox++) {
        const k = (((Math.round(y) + oy) % N + N) % N) * N + (((Math.round(x) + ox) % N + N) % N);
        const f = (1 - Math.hypot(ox, oy) / (w + 1)) * (0.6 + 0.4 * Math.sin(i * 0.05));
        H[k] = H[k]! - depth * f;
        D[k] = Math.max(D[k]!, f);
      }
    }
    if (r() < 0.006) crack(N, H, D, r, Math.floor(len * 0.4), depth * 0.7, vertical);
  }
}

// ---------------------------------------------------------------- stone (dressed ashlar, ~1.6 m tile)

export type SurfaceSet = { map: THREE.DataTexture; normalMap: THREE.DataTexture; roughnessMap: THREE.DataTexture };

export function stoneTextures(N = 512): SurfaceSet {
  const H: Field = new Float32Array(N * N);
  const D: Field = new Float32Array(N * N);
  const A: Field = new Float32Array(N * N);
  const r = rng(1931);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const u = x / N;
      const v = y / N;
      const big = pfbm(u, v, 4, 5, 11);
      const grain = ihash(x, y, 5);
      const k = y * N + x;
      H[k] = big * 0.9 + grain * 0.12;
      // mottling + speckle: weathered sandstone, not a clean box
      const mott = pfbm(u, v, 3, 4, 41);
      const speck = grain > 0.93 ? -0.1 : grain < 0.05 ? 0.06 : 0;
      A[k] = 0.8 + (mott - 0.5) * 0.32 + (big - 0.5) * 0.12 + speck;
    }
  }
  // pits and pocks
  for (let i = 0; i < 110; i++) {
    const cx = r() * N;
    const cy = r() * N;
    const rad = 1.5 + r() * r() * 9;
    for (let oy = -Math.ceil(rad); oy <= rad; oy++) {
      for (let ox = -Math.ceil(rad); ox <= rad; ox++) {
        const d = Math.hypot(ox, oy) / rad;
        if (d > 1) continue;
        const k = (((Math.floor(cy) + oy) % N + N) % N) * N + (((Math.floor(cx) + ox) % N + N) % N);
        const f = 1 - d * d;
        H[k] = H[k]! - f * 0.22;
        D[k] = Math.max(D[k]!, f * 0.25);
      }
    }
  }
  for (let i = 0; i < 4; i++) crack(N, H, D, r, 50 + Math.floor(r() * 120), 0.35);
  const rgba = new Uint8Array(N * N * 4);
  const rough = new Uint8Array(N * N * 4);
  for (let k = 0; k < N * N; k++) {
    const a = Math.max(0.3, Math.min(1, A[k]! - D[k]! * 0.22));
    rgba[k * 4] = Math.round(a * 255);
    rgba[k * 4 + 1] = Math.round(a * 0.985 * 255);
    rgba[k * 4 + 2] = Math.round(a * 0.96 * 255);
    rgba[k * 4 + 3] = 255;
    const g = Math.min(1, 0.86 + D[k]! * 0.14 - (H[k]! - 0.5) * 0.1);
    rough[k * 4] = rough[k * 4 + 1] = rough[k * 4 + 2] = Math.round(g * 255);
    rough[k * 4 + 3] = 255;
  }
  return { map: toTexture(N, rgba, true), normalMap: normalFromHeight(N, H, 3.2), roughnessMap: toTexture(N, rough, false) };
}

// ---------------------------------------------------------------- rock (bedded, fractured cliff, ~4 m tile)

export function rockTextures(N = 512): SurfaceSet {
  const H: Field = new Float32Array(N * N);
  const D: Field = new Float32Array(N * N);
  const A: Field = new Float32Array(N * N);
  const r = rng(733);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const u = x / N;
      const v = y / N;
      const warp = pfbm(u, v, 3, 3, 71);
      // bedding planes: horizontal in the projected v, gently warped
      const bed = v * 4 + (warp - 0.5) * 1.1;
      const bf = bed - Math.floor(bed);
      const ledge = Math.pow(Math.min(1, bf / 0.82), 2.2) - (bf > 0.82 ? (bf - 0.82) * 4.5 : 0);
      const big = pfbm(u, v, 4, 5, 12);
      const k = y * N + x;
      H[k] = ledge * 0.14 + big * 0.85 + ihash(x, y, 9) * 0.1;
      D[k] = bf > 0.94 ? (bf - 0.94) * 5 : 0;
      const band = ihash(Math.floor(bed) & 7, 3, 77);
      A[k] = 0.74 + (band - 0.5) * 0.08 + (pfbm(u, v, 5, 4, 43) - 0.5) * 0.34;
    }
  }
  for (let i = 0; i < 7; i++) crack(N, H, D, r, 80 + Math.floor(r() * 200), 0.6, 1);
  for (let i = 0; i < 3; i++) crack(N, H, D, r, 50 + Math.floor(r() * 90), 0.4);
  const rgba = new Uint8Array(N * N * 4);
  const rough = new Uint8Array(N * N * 4);
  for (let k = 0; k < N * N; k++) {
    const a = Math.max(0.25, Math.min(1, A[k]! - Math.min(1, D[k]!) * 0.3));
    rgba[k * 4] = Math.round(a * 255);
    rgba[k * 4 + 1] = Math.round(a * 0.985 * 255);
    rgba[k * 4 + 2] = Math.round(a * 0.96 * 255);
    rgba[k * 4 + 3] = 255;
    const g = Math.min(1, 0.88 + Math.min(1, D[k]!) * 0.12);
    rough[k * 4] = rough[k * 4 + 1] = rough[k * 4 + 2] = Math.round(g * 255);
    rough[k * 4 + 3] = 255;
  }
  return { map: toTexture(N, rgba, true), normalMap: normalFromHeight(N, H, 2.6), roughnessMap: toTexture(N, rough, false) };
}

// ---------------------------------------------------------------- bark (vertical fissured plates, ~2 m tile)

export function barkTextures(N = 512): SurfaceSet {
  const H: Field = new Float32Array(N * N);
  const A: Field = new Float32Array(N * N);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const u = x / N;
      const v = y / N;
      // long flat plates between narrow wandering furrows, with fine vertical fibres
      const warp = (pfbm(u, v, 3, 3, 21) - 0.5) * 0.9 + (pfbm(u, v, 7, 2, 22) - 0.5) * 0.25;
      const f = u * 6 + warp * 1.6;
      const col = Math.floor(f);
      const fr = f - col;
      const cy = v * 2 + ihash(((col % 6) + 6) % 6, 1, 31) * 3 + (pfbm(u, v, 5, 2, 24) - 0.5) * 0.3;
      const cell = Math.floor(cy);
      const cf = cy - cell;
      const edge = Math.min(fr, 1 - fr);
      const plate = THREE.MathUtils.smoothstep(edge, 0.02, 0.14) * (0.75 + 0.25 * THREE.MathUtils.smoothstep(Math.min(cf, 1 - cf), 0, 0.04));
      const shade = ihash(((col % 6) + 6) % 6, ((cell % 2) + 2) % 2, 33);
      const fibre = pnoise(u * 64, v * 4, 64, 25);
      const cross = fibre;
      const k = y * N + x;
      H[k] = plate * 0.6 + cross * 0.12 + ihash(x, y, 4) * 0.03;
      A[k] = 0.36 + plate * (0.42 + shade * 0.14) + (cross - 0.5) * 0.14;
    }
  }
  const rgba = new Uint8Array(N * N * 4);
  const rough = new Uint8Array(N * N * 4);
  for (let k = 0; k < N * N; k++) {
    const a = Math.max(0.2, Math.min(1, A[k]!));
    rgba[k * 4] = Math.round(a * 255);
    rgba[k * 4 + 1] = Math.round(a * 0.95 * 255);
    rgba[k * 4 + 2] = Math.round(a * 0.88 * 255);
    rgba[k * 4 + 3] = 255;
    rough[k * 4] = rough[k * 4 + 1] = rough[k * 4 + 2] = 235;
    rough[k * 4 + 3] = 255;
  }
  return { map: toTexture(N, rgba, true), normalMap: normalFromHeight(N, H, 1.6), roughnessMap: toTexture(N, rough, false) };
}

// ---------------------------------------------------------------- ground: soil + leaf carpet (blended per fragment)

/**
 * Maple outline into a canvas path (centre 0,0, tip toward −y): five pointed lobes
 * (top, upper pair, small lower pair) with deep sinuses, toothed margins and a stem notch.
 */
function maplePath(g: CanvasRenderingContext2D, s: number, serr: number, r: () => number): void {
  // half outline, degrees from the top tip clockwise: [angle, radius]
  const half: Array<[number, number]> = [
    [0, 1.0],
    [9, 0.66],
    [16, 0.7],
    [26, 0.4], // sinus
    [40, 0.72],
    [47, 0.66],
    [56, 0.95], // upper lobe tip
    [66, 0.64],
    [74, 0.6],
    [88, 0.34], // sinus
    [104, 0.56],
    [114, 0.6], // lower lobe tip
    [128, 0.44],
    [150, 0.24], // basal sinus
    [172, 0.16],
  ];
  const pts: Array<[number, number]> = [];
  for (const [a, rr] of half) pts.push([a, rr]);
  for (let i = half.length - 1; i >= 1; i--) pts.push([360 - half[i]![0], half[i]![1]]);
  g.beginPath();
  for (let i = 0; i < pts.length; i++) {
    const [a, rr] = pts[i]!;
    const t = (a * Math.PI) / 180;
    const jit = 1 + (r() - 0.5) * serr;
    g.lineTo(Math.sin(t) * rr * s * jit, -Math.cos(t) * rr * s * jit);
  }
  g.closePath();
}

export type GroundSet = { leaf: THREE.DataTexture; soil: THREE.DataTexture };

/**
 * leaf: RGB leaf colour (near-white multipliers), A = per-leaf rank in (0.1..1], 0 = gap.
 * The ground shader shows a leaf only where rank > 1 − leafiness, so coverage
 * thins leaf by leaf (never a fade) between worn paths and deep drifts.
 * soil: packed umber earth with pebbles, twigs and dry stubble.
 */
export function groundTextures(N = 1024): GroundSet {
  const r = rng(4243);
  // --- leaf layer: colour canvas + rank canvas, drawn in the same order
  const cv = document.createElement('canvas');
  cv.width = cv.height = N;
  const gc = cv.getContext('2d')!;
  const rk = document.createElement('canvas');
  rk.width = rk.height = N;
  const gr = rk.getContext('2d')!;
  gc.fillStyle = '#000';
  gc.fillRect(0, 0, N, N);
  gr.fillStyle = '#000';
  gr.fillRect(0, 0, N, N);
  const tones = [0.98, 0.9, 0.82, 0.74, 0.94, 0.86];
  const count = Math.round((N * N) / 900);
  for (let i = 0; i < count; i++) {
    const x = r() * N;
    const y = r() * N;
    const s = (13 + r() * r() * 30) * (N / 1024);
    const a = r() * Math.PI * 2;
    const rank = 0.1 + 0.9 * r();
    const tone = tones[Math.floor(r() * tones.length)]! * (0.85 + r() * 0.15);
    const curl = 0.6 + r() * 0.4; // foreshortened / curled leaves
    for (const [ox, oy] of [[0, 0], [N, 0], [-N, 0], [0, N], [0, -N], [N, N], [-N, -N], [N, -N], [-N, N]] as const) {
      if (x + ox < -60 || x + ox > N + 60 || y + oy < -60 || y + oy > N + 60) continue;
      for (const [ctx, pass] of [[gc, 0], [gr, 1]] as const) {
        ctx.save();
        ctx.translate(x + ox, y + oy);
        ctx.rotate(a);
        ctx.scale(1, curl);
        if (pass === 0) {
          // contact shadow first, then the leaf, then veins
          ctx.fillStyle = 'rgba(30,20,12,0.55)';
          ctx.save();
          ctx.translate(s * 0.12, s * 0.16);
          maplePath(ctx, s * 1.04, 0.15, r);
          ctx.fill();
          ctx.restore();
          const c = Math.round(tone * 255);
          ctx.fillStyle = `rgb(${c},${Math.round(c * 0.97)},${Math.round(c * 0.92)})`;
          maplePath(ctx, s, 0.15, r);
          ctx.fill();
          ctx.strokeStyle = `rgba(40,24,14,${0.35 + r() * 0.2})`;
          ctx.lineWidth = Math.max(0.8, s * 0.06);
          ctx.beginPath();
          for (const ang of [0, 1.25, -1.25, 2.4, -2.4]) {
            ctx.moveTo(0, s * 0.15);
            ctx.lineTo(Math.sin(ang) * s * 0.75, -Math.cos(ang) * s * 0.75);
          }
          ctx.moveTo(0, s * 0.15);
          ctx.lineTo(0, s * 0.75); // stem
          ctx.stroke();
        } else {
          const q = Math.round(rank * 255);
          ctx.fillStyle = `rgb(${q},${q},${q})`;
          maplePath(ctx, s * 1.02, 0.15, r);
          ctx.fill();
        }
        ctx.restore();
      }
    }
  }
  const lc = gc.getImageData(0, 0, N, N).data;
  const lr = gr.getImageData(0, 0, N, N).data;
  const leaf = new Uint8Array(N * N * 4);
  for (let k = 0; k < N * N; k++) {
    leaf[k * 4] = lc[k * 4]!;
    leaf[k * 4 + 1] = lc[k * 4 + 1]!;
    leaf[k * 4 + 2] = lc[k * 4 + 2]!;
    leaf[k * 4 + 3] = lr[k * 4]!;
  }

  // --- soil
  const S = document.createElement('canvas');
  S.width = S.height = N;
  const gs = S.getContext('2d')!;
  const img = gs.createImageData(N, N);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const u = x / N;
      const v = y / N;
      const m = pfbm(u, v, 6, 5, 91);
      const grit = ihash(x, y, 13);
      const a = 0.62 + (m - 0.5) * 0.36 + (grit - 0.5) * 0.12;
      const k = (y * N + x) * 4;
      img.data[k] = Math.round(Math.min(1, a) * 255);
      img.data[k + 1] = Math.round(Math.min(1, a * 0.95) * 255);
      img.data[k + 2] = Math.round(Math.min(1, a * 0.86) * 255);
      img.data[k + 3] = 255;
    }
  }
  gs.putImageData(img, 0, 0);
  const wrapDraw = (x: number, y: number, pad: number, fn: () => void) => {
    for (const [ox, oy] of [[0, 0], [N, 0], [-N, 0], [0, N], [0, -N]] as const) {
      if (x + ox < -pad || x + ox > N + pad || y + oy < -pad || y + oy > N + pad) continue;
      gs.save();
      gs.translate(x + ox, y + oy);
      fn();
      gs.restore();
    }
  };
  const sc = N / 1024;
  // dry stubble strokes (golden where the vertex tint is grass)
  for (let i = 0; i < 2600; i++) {
    const x = r() * N;
    const y = r() * N;
    const len = (6 + r() * 14) * sc;
    const a = -Math.PI / 2 + (r() - 0.5) * 1.2;
    const c = Math.round((0.7 + r() * 0.3) * 255);
    wrapDraw(x, y, 30, () => {
      gs.strokeStyle = `rgba(${c},${Math.round(c * 0.93)},${Math.round(c * 0.75)},0.55)`;
      gs.lineWidth = 1.2 * sc;
      gs.beginPath();
      gs.moveTo(0, 0);
      gs.quadraticCurveTo(Math.cos(a) * len * 0.5 + 2, Math.sin(a) * len * 0.5, Math.cos(a) * len, Math.sin(a) * len);
      gs.stroke();
    });
  }
  // pebbles
  for (let i = 0; i < 700; i++) {
    const x = r() * N;
    const y = r() * N;
    const s = (1.5 + r() * r() * 7) * sc;
    const c = Math.round((0.55 + r() * 0.35) * 255);
    const a = r() * 3;
    wrapDraw(x, y, 20, () => {
      gs.rotate(a);
      gs.fillStyle = 'rgba(25,18,12,0.5)';
      gs.beginPath();
      gs.ellipse(s * 0.25, s * 0.3, s, s * 0.7, 0, 0, Math.PI * 2);
      gs.fill();
      gs.fillStyle = `rgb(${c},${Math.round(c * 0.96)},${Math.round(c * 0.9)})`;
      gs.beginPath();
      gs.ellipse(0, 0, s, s * 0.7, 0, 0, Math.PI * 2);
      gs.fill();
    });
  }
  // twigs
  for (let i = 0; i < 110; i++) {
    const x = r() * N;
    const y = r() * N;
    const len = (14 + r() * 40) * sc;
    const a = r() * Math.PI * 2;
    wrapDraw(x, y, 70, () => {
      gs.rotate(a);
      gs.strokeStyle = 'rgba(30,20,14,0.75)';
      gs.lineWidth = (1 + r() * 1.6) * sc;
      gs.beginPath();
      gs.moveTo(0, 0);
      gs.lineTo(len * 0.5, (r() - 0.5) * 4);
      gs.lineTo(len, (r() - 0.5) * 6);
      if (r() < 0.5) {
        gs.moveTo(len * 0.5, 0);
        gs.lineTo(len * 0.75, -len * 0.18);
      }
      gs.stroke();
    });
  }
  // a few flattened old leaves in the soil (dull, always visible)
  for (let i = 0; i < 160; i++) {
    const x = r() * N;
    const y = r() * N;
    const s = (6 + r() * 10) * sc;
    const a = r() * Math.PI * 2;
    const c = Math.round((0.55 + r() * 0.2) * 255);
    wrapDraw(x, y, 40, () => {
      gs.rotate(a);
      gs.globalAlpha = 0.7;
      gs.fillStyle = `rgb(${c},${Math.round(c * 0.9)},${Math.round(c * 0.78)})`;
      maplePath(gs, s, 0.1, r);
      gs.fill();
      gs.globalAlpha = 1;
    });
  }
  const soil = new Uint8Array(gs.getImageData(0, 0, N, N).data);
  return { leaf: toTexture(N, leaf, true), soil: toTexture(N, soil, true) };
}

// ---------------------------------------------------------------- leaf atlas (alpha-cut cards)

/**
 * 2×2 atlas, 1024²: [0] single maple leaf, [1] second leaf, [2] twig spray of 7 leaves,
 * [3] sparse spray of 4. RGB near-white (vertex colour supplies hue), alpha cut-out.
 */
export function leafAtlas(N = 1024): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = cv.height = N;
  const g = cv.getContext('2d')!;
  g.clearRect(0, 0, N, N);
  const r = rng(5150);
  const C = N / 2;
  const leafAt = (x: number, y: number, s: number, a: number, tone: number, curl = 1) => {
    g.save();
    g.translate(x, y);
    g.rotate(a);
    g.scale(1, curl);
    const c = Math.round(tone * 255);
    const grd = g.createRadialGradient(0, s * 0.2, s * 0.1, 0, 0, s);
    grd.addColorStop(0, `rgb(${Math.round(c * 0.86)},${Math.round(c * 0.8)},${Math.round(c * 0.74)})`);
    grd.addColorStop(1, `rgb(${c},${Math.round(c * 0.97)},${Math.round(c * 0.93)})`);
    g.fillStyle = grd;
    maplePath(g, s, 0.22, r);
    g.fill();
    g.strokeStyle = `rgba(80,52,32,0.2)`;
    g.lineWidth = Math.max(1, s * 0.03);
    g.beginPath();
    for (const ang of [0, 1.25, -1.25, 2.3, -2.3]) {
      g.moveTo(0, s * 0.12);
      g.lineTo(Math.sin(ang) * s * 0.78, -Math.cos(ang) * s * 0.78);
    }
    g.stroke();
    g.restore();
  };
  // [0], [1]: single leaves with stems
  for (const [cx, cy, seedA] of [[C * 0.5, C * 0.5, 0], [C * 1.5, C * 0.5, 1]] as const) {
    g.strokeStyle = 'rgb(120,90,70)';
    g.lineWidth = C * 0.018;
    g.beginPath();
    g.moveTo(cx, cy + C * 0.12);
    g.lineTo(cx + C * 0.02, cy + C * 0.46);
    g.stroke();
    leafAt(cx, cy, C * (seedA ? 0.36 : 0.42), seedA ? 0.15 : -0.05, 1);
  }
  // [2], [3]: sprays — twig from the bottom centre, leaves fanned at the tips
  const spray = (ox: number, oy: number, n: number) => {
    const bx = ox + C * 0.5;
    const by = oy + C * 0.97;
    const tips: Array<[number, number, number]> = [];
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1);
      const a = -Math.PI / 2 + (t - 0.5) * 2.2 + (r() - 0.5) * 0.25;
      const len = C * (0.3 + r() * 0.16) * (1 - Math.abs(t - 0.5) * 0.35);
      tips.push([bx + Math.cos(a) * len, by + Math.sin(a) * len, a]);
    }
    g.strokeStyle = 'rgba(150,118,92,0.6)';
    for (const [tx, ty] of tips) {
      g.lineWidth = C * 0.005;
      g.beginPath();
      g.moveTo(bx, by);
      g.quadraticCurveTo((bx + tx) / 2 + (r() - 0.5) * C * 0.08, (by + ty) / 2, tx, ty);
      g.stroke();
    }
    // back leaves darker, front lighter
    const order = tips.map((p, i) => ({ p, i, k: r() })).sort((a, b) => a.k - b.k);
    for (const { p, k } of order) {
      const s = C * (0.11 + r() * 0.05);
      leafAt(p[0], p[1] - s * 0.35, s, p[2] + Math.PI / 2 + (r() - 0.5) * 0.5, 0.78 + k * 0.22, 0.75 + r() * 0.25);
      // a second, smaller leaf partway along the twig fills the spray without big shapes
      const mx = (p[0] + bx) / 2 + (r() - 0.5) * C * 0.06;
      const my = (p[1] + by) / 2;
      leafAt(mx, my, s * 0.75, p[2] + Math.PI / 2 + (r() - 0.5) * 0.9, 0.7 + r() * 0.25, 0.7 + r() * 0.3);
    }
  };
  spray(0, C, 9);
  spray(C, C, 5);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}
