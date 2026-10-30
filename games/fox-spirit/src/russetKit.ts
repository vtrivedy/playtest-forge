import * as THREE from 'three';

/**
 * Russetvale geometry kit: chunky strata rock, weathered ruins, carved shrines,
 * giant maples, shrubs and leaf litter. Everything static is appended into
 * per-material buckets and merged, so the realm stays a handful of draw calls.
 * Colours are the *restored* autumn palette — ColorField washes them to sepia.
 */

// ---------------------------------------------------------------- noise / rng

export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 1000003) / 1000003;
  };
}

function hash3(x: number, y: number, z: number): number {
  const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return h - Math.floor(h);
}

export function vnoise3(x: number, y: number, z: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const xf = x - xi;
  const yf = y - yi;
  const zf = z - zi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const w = zf * zf * (3 - 2 * zf);
  const l = (a: number, b: number, t: number) => a + (b - a) * t;
  const c = (dx: number, dy: number, dz: number) => hash3(xi + dx, yi + dy, zi + dz);
  return l(
    l(l(c(0, 0, 0), c(1, 0, 0), u), l(c(0, 1, 0), c(1, 1, 0), u), v),
    l(l(c(0, 0, 1), c(1, 0, 1), u), l(c(0, 1, 1), c(1, 1, 1), u), v),
    w,
  );
}

export function fbm3(x: number, y: number, z: number, oct = 3): number {
  let a = 0.5;
  let f = 1;
  let s = 0;
  for (let i = 0; i < oct; i++) {
    s += a * vnoise3(x * f, y * f, z * f);
    f *= 2.03;
    a *= 0.5;
  }
  return s / (1 - Math.pow(0.5, oct));
}

// ---------------------------------------------------------------- palette (restored)

export const PAL = {
  stone: new THREE.Color(0xb8a482),
  stoneDark: new THREE.Color(0x6e5e4a),
  stoneLichen: new THREE.Color(0xa86a34),
  rockA: new THREE.Color(0x6b5f55),
  rockB: new THREE.Color(0x887a6a),
  rockC: new THREE.Color(0x4e443c),
  rockDeep: new THREE.Color(0x37302a),
  soilTop: new THREE.Color(0x6e5640),
  grassGold: new THREE.Color(0xc9a04a),
  grassDry: new THREE.Color(0x9a8452),
  moss: new THREE.Color(0x8a4a24),
  path: new THREE.Color(0x7a4a2a),
  mud: new THREE.Color(0x3e3226),
  bark: new THREE.Color(0x4a3426),
  barkLight: new THREE.Color(0x6e5440),
  russet: new THREE.Color(0xa8441f),
  maple: new THREE.Color(0xb8321f),
  amber: new THREE.Color(0xe08a2b),
  gold: new THREE.Color(0xc9a04a),
  copper: new THREE.Color(0xd8813a),
  crimson: new THREE.Color(0x8e2418),
  leafBrown: new THREE.Color(0x6e3c20),
  wood: new THREE.Color(0x6a4a32),
  sail: new THREE.Color(0xd8c4a0),
  root: new THREE.Color(0x3e2e22),
  // masonry + cliffs: warm-grey stone, soot, rust moss (lichen) — restored colour lives in foliage and fox
  rockGrey: new THREE.Color(0x7c7570),
  rockDust: new THREE.Color(0x9a8a72),
  stoneSoot: new THREE.Color(0x4a4038),
  rustMoss: new THREE.Color(0x8a4e22),
  lichen: new THREE.Color(0xa08a5a),
  soilUmber: new THREE.Color(0x5f4a38),
  pathEarth: new THREE.Color(0x87705a),
  bankDamp: new THREE.Color(0x3a3026),
};

export const LEAF_COLORS = [PAL.russet, PAL.maple, PAL.amber, PAL.gold, PAL.copper, PAL.crimson, PAL.leafBrown];

// ---------------------------------------------------------------- bucket

/** Accumulates non-indexed triangles (position/normal/color) for one material. */
export class Bucket {
  pos: number[] = [];
  nor: number[] = [];
  col: number[] = [];
  /** Atlas UVs — only buckets fed exclusively by pushLeaf carry these. */
  uv: number[] = [];
  /** Optional per-vertex scalar (ground leafiness); filled with `auxDefault` by add(). */
  aux: number[] | null = null;
  auxDefault = 0;
  private v = new THREE.Vector3();
  private n = new THREE.Vector3();
  private nm = new THREE.Matrix3();

  /** Append a geometry (indexed or not) with optional transform; must have a color attr or pass `tint`. */
  add(geo: THREE.BufferGeometry, m?: THREE.Matrix4, tint?: THREE.Color): void {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (!g.attributes.normal) g.computeVertexNormals();
    const p = g.attributes.position as THREE.BufferAttribute;
    const nn = g.attributes.normal as THREE.BufferAttribute;
    const c = g.attributes.color as THREE.BufferAttribute | undefined;
    if (m) this.nm.getNormalMatrix(m);
    for (let i = 0; i < p.count; i++) {
      this.v.fromBufferAttribute(p, i);
      this.n.fromBufferAttribute(nn, i);
      if (m) {
        this.v.applyMatrix4(m);
        this.n.applyMatrix3(this.nm);
      }
      if (!(this.n.lengthSq() > 1e-8) || !Number.isFinite(this.n.x)) this.n.set(0, 1, 0);
      this.n.normalize();
      this.pos.push(this.v.x, this.v.y, this.v.z);
      this.nor.push(this.n.x, this.n.y, this.n.z);
      if (c) this.col.push(c.getX(i), c.getY(i), c.getZ(i));
      else if (tint) this.col.push(tint.r, tint.g, tint.b);
      else this.col.push(1, 1, 1);
      if (this.aux) this.aux.push(g.attributes.leafy ? (g.attributes.leafy as THREE.BufferAttribute).getX(i) : this.auxDefault);
    }
    if (g !== geo) g.dispose();
  }

  /** Raw triangle push (world space). */
  tri(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, n: THREE.Vector3, ca: THREE.Color, cb = ca, cc = ca): void {
    this.pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    for (let i = 0; i < 3; i++) this.nor.push(n.x, n.y, n.z);
    this.col.push(ca.r, ca.g, ca.b, cb.r, cb.g, cb.b, cc.r, cc.g, cc.b);
    if (this.aux) this.aux.push(this.auxDefault, this.auxDefault, this.auxDefault);
  }

  /** Raw triangle with per-vertex normals (world space). */
  triN(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, na: THREE.Vector3, nb: THREE.Vector3, nc: THREE.Vector3, ca: THREE.Color, cb: THREE.Color, cc: THREE.Color): void {
    this.pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    this.nor.push(na.x, na.y, na.z, nb.x, nb.y, nb.z, nc.x, nc.y, nc.z);
    this.col.push(ca.r, ca.g, ca.b, cb.r, cb.g, cb.b, cc.r, cc.g, cc.b);
    if (this.aux) this.aux.push(this.auxDefault, this.auxDefault, this.auxDefault);
  }

  /**
   * `boxUV` (m per tile): per-triangle box projection on the dominant face axis, so
   * merged stone/rock gets a world-scaled surface texture without authored UVs.
   */
  toMesh(material: THREE.Material, opts: { cast?: boolean; receive?: boolean; planarUV?: number; boxUV?: number } = {}): THREE.Mesh | null {
    if (!this.pos.length) return null;
    const geo = new THREE.BufferGeometry();
    const nv = this.pos.length / 3;
    if (this.uv.length === nv * 2) {
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    } else if (opts.boxUV) {
      const uv = new Float32Array(nv * 2);
      const P = this.pos;
      const k = 1 / opts.boxUV;
      for (let t = 0; t < nv; t += 3) {
        const i = t * 3;
        const ax = P[i + 3]! - P[i]!, ay = P[i + 4]! - P[i + 1]!, az = P[i + 5]! - P[i + 2]!;
        const bx = P[i + 6]! - P[i]!, by = P[i + 7]! - P[i + 1]!, bz = P[i + 8]! - P[i + 2]!;
        const nx = Math.abs(ay * bz - az * by);
        const ny = Math.abs(az * bx - ax * bz);
        const nz = Math.abs(ax * by - ay * bx);
        for (let j = 0; j < 3; j++) {
          const x = P[i + j * 3]!, y = P[i + j * 3 + 1]!, z = P[i + j * 3 + 2]!;
          const o = (t + j) * 2;
          if (nx >= ny && nx >= nz) {
            uv[o] = z * k;
            uv[o + 1] = y * k;
          } else if (ny >= nz) {
            uv[o] = x * k;
            uv[o + 1] = z * k;
          } else {
            uv[o] = x * k;
            uv[o + 1] = y * k;
          }
        }
      }
      geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    } else if (opts.planarUV) {
      const uv: number[] = [];
      for (let i = 0; i < this.pos.length; i += 3) uv.push(this.pos[i]! / opts.planarUV, this.pos[i + 2]! / opts.planarUV);
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    }
    if (this.aux && this.aux.length === nv) geo.setAttribute('leafy', new THREE.Float32BufferAttribute(this.aux, 1));
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    geo.computeBoundingSphere();
    geo.computeBoundingBox();
    const mesh = new THREE.Mesh(geo, material);
    mesh.castShadow = opts.cast ?? true;
    mesh.receiveShadow = opts.receive ?? true;
    return mesh;
  }

  get vertexCount(): number {
    return this.pos.length / 3;
  }
}

function paint(geo: THREE.BufferGeometry, fn: (p: THREE.Vector3, n: THREE.Vector3, out: THREE.Color) => void): void {
  const p = geo.attributes.position as THREE.BufferAttribute;
  if (!geo.attributes.normal) geo.computeVertexNormals();
  const nn = geo.attributes.normal as THREE.BufferAttribute;
  const cols = new Float32Array(p.count * 3);
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    n.fromBufferAttribute(nn, i);
    fn(v, n, c);
    cols[i * 3] = c.r;
    cols[i * 3 + 1] = c.g;
    cols[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
}

function merged(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  geo.deleteAttribute('normal');
  geo.deleteAttribute('uv');
  // weld coincident verts so displacement keeps the surface closed
  const p = geo.attributes.position as THREE.BufferAttribute;
  const map = new Map<string, number>();
  const remap: number[] = [];
  const out: number[] = [];
  for (let i = 0; i < p.count; i++) {
    const k = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
    let j = map.get(k);
    if (j === undefined) {
      j = out.length / 3;
      map.set(k, j);
      out.push(p.getX(i), p.getY(i), p.getZ(i));
    }
    remap.push(j);
  }
  const idx = geo.index ? Array.from(geo.index.array as ArrayLike<number>).map((i) => remap[i]!) : remap;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
  g.setIndex(idx);
  return g;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _e = new THREE.Euler();
export function trs(x: number, y: number, z: number, yaw = 0, sx = 1, sy = sx, sz = sx, pitch = 0, roll = 0): THREE.Matrix4 {
  _e.set(pitch, yaw, roll, 'YXZ');
  _q.setFromEuler(_e);
  _s.set(sx, sy, sz);
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), _q, _s);
}

// ---------------------------------------------------------------- rock

export type RockSpec = {
  x: number;
  z: number;
  yaw?: number;
  w: number;
  d: number;
  top: number;
  bottom: number;
  /** side relief (m) */
  rough?: number;
  seed?: number;
  /** top-face colour (grass/litter) or null for bare stone tops */
  topColor?: THREE.Color | null;
  round?: boolean;
  /** undercut depth below the cap rock (m); 0 = none */
  overhang?: number;
  /** broken, non-flat top (m of relief) for crags that are not walk surfaces */
  roughTop?: number;
};

const _rc = new THREE.Color();

/** Shared rock colouring: warm-grey/umber beds, dark wet joints, dusty ledges, rust moss, soil tops. */
export function rockColor(q: THREE.Vector3, n: THREE.Vector3, top: number, seed: number, topC: THREE.Color | null, out: THREE.Color): THREE.Color {
  const bed = Math.floor((q.y + seed * 0.37 + vnoise3(q.x * 0.05, 0, q.z * 0.05) * 2) / 2.3);
  const k = hash3(bed, seed, 3);
  out.copy(PAL.rockGrey).lerp(k < 0.5 ? PAL.rockA : PAL.rockB, 0.35 + k * 0.2);
  const mott = fbm3(q.x * 0.35, q.y * 0.35, q.z * 0.35, 2);
  out.multiplyScalar(0.78 + mott * 0.42);
  // darker and damper toward the foot of each face, black under overhangs
  const depth = THREE.MathUtils.clamp((top - q.y) / 12, 0, 1);
  out.lerp(PAL.rockDeep, depth * 0.45);
  if (n.y < -0.25) out.lerp(PAL.rockDeep, 0.55);
  // vertical seep stains under ledges
  const seep = vnoise3(q.x * 1.3 + q.z * 0.9, q.y * 0.12, seed);
  if (seep > 0.64 && Math.abs(n.y) < 0.4) out.lerp(PAL.rockDeep, (seep - 0.64) * 1.6);
  // dusty ledges + rust moss on near-flat steps
  if (n.y > 0.3 && n.y <= 0.7) {
    out.lerp(PAL.rockDust, 0.35);
    if (fbm3(q.x * 0.6 + 3, q.y, q.z * 0.6, 2) > 0.6) out.lerp(PAL.rustMoss, 0.28);
  }
  if (n.y > 0.7) {
    const t = THREE.MathUtils.smoothstep(n.y, 0.7, 0.9);
    if (topC) out.lerp(_rc.copy(topC).offsetHSL(0, 0, (vnoise3(q.x * 0.5, 0, q.z * 0.5) - 0.5) * 0.08), t);
    else out.lerp(PAL.rustMoss, t * 0.3 * vnoise3(q.x * 0.4, 1, q.z * 0.4));
  }
  return out;
}

/**
 * Rock mass with a flat walkable top (collision matches) and fractured sides:
 * jointed vertical facets of varied depth and lean, broken by the odd bedding
 * plane, eroded angular corners and an undercut beneath the cap rock.
 * Flat-shaded so it reads as cut stone, not clay.
 */
export function rockSlab(b: Bucket, s: RockSpec): void {
  const h = s.top - s.bottom;
  const rough = s.rough ?? 0.55;
  const seed = s.seed ?? 1;
  const over = s.overhang ?? 0.7 * rough;
  const hw = s.w / 2;
  const hd = s.d / 2;
  // rim ring: perimeter samples (local, centred) with outward direction and arc-length u
  const ring: Array<{ x: number; z: number; nx: number; nz: number; u: number }> = [];
  if (s.round) {
    const R = hw;
    const n = Math.max(24, Math.round((Math.PI * 2 * R) / 0.85));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      ring.push({ x: Math.cos(a) * R, z: Math.sin(a) * R, nx: Math.cos(a), nz: Math.sin(a), u: a * R });
    }
  } else {
    const corners: Array<[number, number, number, number]> = [
      [-hw, hd, 0, 1],
      [hw, hd, 1, 0],
      [hw, -hd, 0, -1],
      [-hw, -hd, -1, 0],
    ];
    let u = 0;
    for (let e = 0; e < 4; e++) {
      const [x0, z0, nx, nz] = corners[e]!;
      const [x1, z1] = corners[(e + 1) % 4]!;
      const len = Math.hypot(x1 - x0, z1 - z0);
      const m = Math.max(2, Math.round(len / 0.85));
      for (let k = 0; k < m; k++) {
        // irregular spacing along the edge (corners stay put) so no regular panel grid shows
        const t = (k + (k > 0 ? (hash3(k, e, 77) - 0.5) * 0.6 : 0)) / m;
        ring.push({ x: x0 + (x1 - x0) * t, z: z0 + (z1 - z0) * t, nx, nz, u: u + len * t });
      }
      u += len;
    }
  }
  const ny = Math.max(3, Math.round(h / 0.65));
  const N = ring.length;
  const P: THREE.Vector3[][] = [];
  for (let i = 0; i < N; i++) {
    const q = ring[i]!;
    const col: THREE.Vector3[] = [];
    for (let j = 0; j <= ny; j++) {
      const yWorld = s.bottom + (h * (j + (j > 0 && j < ny ? (hash3(j, Math.floor(q.u / 4), 91) - 0.5) * 0.5 : 0))) / ny;
      const below = s.top - yWorld;
      const v = new THREE.Vector3(q.x, yWorld, q.z);
      if (s.round) {
        const taper = 0.94 + 0.06 * (j / ny);
        v.x *= taper;
        v.z *= taper;
      }
      // jointed facets: irregular-width vertical columns, each its own depth, lean and one fracture
      const u = q.u;
      const ci = Math.floor(u / 3.1 + vnoise3(u * 0.07, seed, 1.7) * 1.4);
      const d0 = (hash3(ci, seed, 1) - 0.42) * rough * 1.3;
      const lean = (hash3(ci, seed, 2) - 0.5) * rough * 0.16 * below;
      const fy = hash3(ci, seed, 4) * h;
      const frac = below > fy ? (hash3(ci, seed, 5) - 0.5) * rough * 0.9 : 0;
      // weak, irregular bedding (not a layer cake)
      const bed = Math.floor((yWorld + seed * 0.7 + vnoise3(u * 0.07, 0, seed) * 3) / 2.6);
      const bedOff = (hash3(bed, ci >> 2, seed) - 0.5) * rough * 0.18;
      // cap rock at the lip, undercut beneath it where the noise says so
      const ovN = THREE.MathUtils.smoothstep(vnoise3(u * 0.09, seed * 0.3, 4.4), 0.35, 0.75);
      const cap = below < 0.6 ? 0 : -over * ovN * THREE.MathUtils.smoothstep(below, 0.6, 1.4) * (1 - THREE.MathUtils.smoothstep(below, 2.6, 4.5));
      let off = d0 + lean + frac + bedOff + cap;
      // the very lip stays near the collider edge (feet never hang over air)
      const lipK = THREE.MathUtils.smoothstep(below, 0.05, 0.9);
      off = THREE.MathUtils.lerp(Math.min(0.12, Math.max(-0.22, off * 0.3)), off, lipK);
      v.x += q.nx * off;
      v.z += q.nz * off;
      if (j === ny) v.y -= vnoise3(u * 0.9, 3.3, seed) * 0.22; // chipped rim
      // eroded corners: angular, stepped with height, varied per corner
      if (!s.round && Math.abs(v.x) > hw * 0.5 && Math.abs(v.z) > hd * 0.5) {
        const kx = (Math.abs(v.x) - hw * 0.5) / (hw * 0.5);
        const kz = (Math.abs(v.z) - hd * 0.5) / (hd * 0.5);
        const step = Math.floor((yWorld + seed) / 1.7);
        const ch = hash3(Math.sign(v.x), Math.sign(v.z), seed);
        const depthK = 0.12 + ch * 0.22 + (hash3(step, ch * 9, seed) - 0.5) * 0.12 * Math.min(1, below / 1.2);
        const cut = Math.max(0, Math.min(kx, kz)) * Math.min(hw, hd) * depthK;
        v.x -= Math.sign(v.x) * cut;
        v.z -= Math.sign(v.z) * cut;
      }
      col.push(v);
    }
    P.push(col);
  }
  const m = trs(s.x, 0, s.z, s.yaw ?? 0);
  const nm = new THREE.Matrix3().getNormalMatrix(m);
  const topC = s.topColor === undefined ? PAL.soilTop : s.topColor;
  const W = (v: THREE.Vector3) => v.clone().applyMatrix4(m);
  const n = new THREE.Vector3();
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  const ca = new THREE.Color();
  const cb = new THREE.Color();
  const cc = new THREE.Color();
  const emit = (a: THREE.Vector3, bb: THREE.Vector3, c: THREE.Vector3, outward: THREE.Vector3) => {
    const A = W(a);
    let B = W(bb);
    let C = W(c);
    e1.subVectors(B, A);
    e2.subVectors(C, A);
    n.crossVectors(e1, e2);
    if (n.lengthSq() < 1e-10) return;
    n.normalize();
    if (n.dot(outward) < 0) {
      n.negate();
      [B, C] = [C, B];
    }
    b.tri(A, B, C, n, rockColor(A, n, s.top, seed, topC, ca), rockColor(B, n, s.top, seed, topC, cb), rockColor(C, n, s.top, seed, topC, cc));
  };
  // sides: world-space grid, one normal per quad, then creased vertex normals — smooth across
  // gentle facets (an intact fracture plane), hard where the plane breaks (> ~38°)
  const WP = P.map((col) => col.map(W));
  const qn: THREE.Vector3[][] = [];
  const out = new THREE.Vector3();
  for (let i = 0; i < N; i++) {
    const i2 = (i + 1) % N;
    const q = ring[i]!;
    const q2 = ring[i2]!;
    out.set(q.nx + q2.nx, 0, q.nz + q2.nz).normalize().applyMatrix3(nm);
    const colN: THREE.Vector3[] = [];
    for (let j = 0; j < ny; j++) {
      const a = WP[i]![j]!;
      const d = WP[i2]![j + 1]!;
      e1.subVectors(d, a);
      e2.subVectors(WP[i]![j + 1]!, WP[i2]![j]!);
      const fn = new THREE.Vector3().crossVectors(e1, e2);
      if (fn.lengthSq() < 1e-12) fn.copy(out);
      fn.normalize();
      if (fn.dot(out) < 0) fn.negate();
      colN.push(fn);
    }
    qn.push(colN);
  }
  const CREASE = Math.cos((38 * Math.PI) / 180);
  const vn = (i: number, j: number, own: THREE.Vector3) => {
    const acc = new THREE.Vector3();
    for (const di of [-1, 0]) {
      for (const dj of [-1, 0]) {
        const qi = (i + di + N) % N;
        const qj = j + dj;
        if (qj < 0 || qj >= ny) continue;
        const f = qn[qi]![qj]!;
        if (f.dot(own) >= CREASE) acc.add(f);
      }
    }
    return acc.lengthSq() > 0 ? acc.normalize() : own.clone();
  };
  for (let i = 0; i < N; i++) {
    const i2 = (i + 1) % N;
    for (let j = 0; j < ny; j++) {
      const own = qn[i]![j]!;
      const A = WP[i]![j]!;
      const B = WP[i2]![j]!;
      const C = WP[i2]![j + 1]!;
      const D = WP[i]![j + 1]!;
      const nA = vn(i, j, own);
      const nB = vn(i2, j, own);
      const nC = vn(i2, j + 1, own);
      const nD = vn(i, j + 1, own);
      const cA = rockColor(A, nA, s.top, seed, topC, new THREE.Color());
      const cB = rockColor(B, nB, s.top, seed, topC, new THREE.Color());
      const cC = rockColor(C, nC, s.top, seed, topC, new THREE.Color());
      const cD = rockColor(D, nD, s.top, seed, topC, new THREE.Color());
      // winding: outward-facing
      e1.subVectors(B, A);
      e2.subVectors(C, A);
      if (n.crossVectors(e1, e2).dot(own) >= 0) {
        b.triN(A, B, C, nA, nB, nC, cA, cB, cC);
        b.triN(A, C, D, nA, nC, nD, cA, cC, cD);
      } else {
        b.triN(A, C, B, nA, nC, nB, cA, cC, cB);
        b.triN(A, D, C, nA, nD, nC, cA, cD, cC);
      }
    }
  }
  // top: chipped rim band → inset rings (relief for crags) → flat cap triangulated in-plane
  const up = new THREE.Vector3(0, 1, 0);
  const minHalf = Math.min(hw, hd);
  const nRings = s.roughTop ? Math.max(2, Math.floor(minHalf / 1.0)) : 1;
  let prev = P.map((c) => c[ny]!);
  for (let k = 1; k <= nRings; k++) {
    const inset = Math.min(minHalf * 0.85, s.roughTop ? k * (minHalf * 0.85) / nRings : 0.9);
    const kx = Math.max(0.12, 1 - inset / hw);
    const kz = Math.max(0.12, 1 - inset / hd);
    const cur = prev.map((v, i) => {
      const r = ring[i]!;
      let y = s.top;
      if (s.roughTop) y += (hash3(Math.floor(r.u / 1.4), k, seed) - 0.55) * s.roughTop + (vnoise3(r.x * 0.5, seed, r.z * 0.5) - 0.5) * s.roughTop * 0.6;
      return new THREE.Vector3(v.x * kx, y, v.z * kz);
    });
    for (let i = 0; i < N; i++) {
      const i2 = (i + 1) % N;
      emit(prev[i]!, prev[i2]!, cur[i2]!, up);
      emit(prev[i]!, cur[i2]!, cur[i]!, up);
    }
    prev = cur;
  }
  const contour = prev.map((v) => new THREE.Vector2(v.x, v.z));
  if (THREE.ShapeUtils.isClockWise(contour)) contour.reverse(), prev.reverse();
  for (const [a, bb, c] of THREE.ShapeUtils.triangulateShape(contour, [])) emit(prev[a!]!, prev[bb!]!, prev[c!]!, up);
}

/**
 * Talus fillet: a lumpy scree/soil wedge banked against a cliff face (zFace), running
 * along x from x0 to x1 and spilling `depth` m outward along `dirZ`. Breaks the hard
 * inside corner of a stepped hill into an eroded slope.
 */
export function talus(b: Bucket, x0: number, x1: number, zFace: number, dirZ: number, depth: number, yBase: number, height: number, seed: number): void {
  const nx = Math.max(2, Math.ceil((x1 - x0) / 0.55));
  const nd = Math.max(2, Math.ceil(depth / 0.45));
  const P: THREE.Vector3[][] = [];
  for (let i = 0; i <= nx; i++) {
    const row: THREE.Vector3[] = [];
    const x = x0 + ((x1 - x0) * i) / nx;
    const end = THREE.MathUtils.smoothstep(Math.min(x - x0, x1 - x), 0, 1.6);
    const reach = depth * (0.65 + 0.35 * vnoise3(x * 0.4, seed, 2));
    for (let j = 0; j <= nd; j++) {
      const d = (reach * j) / nd;
      const prof = Math.pow(1 - d / reach, 1.3) * (0.7 + 0.6 * fbm3(x * 0.45 + seed, d * 0.5, 3, 2));
      const y = yBase - 0.05 + height * prof * end;
      row.push(new THREE.Vector3(x + (vnoise3(x, d, seed) - 0.5) * 0.2, j === nd ? yBase - 0.08 : y, zFace + dirZ * (d - 0.35)));
    }
    P.push(row);
  }
  const n = new THREE.Vector3();
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  const cA = new THREE.Color();
  const cB = new THREE.Color();
  const cC = new THREE.Color();
  const tri = (a: THREE.Vector3, bb: THREE.Vector3, c: THREE.Vector3) => {
    e1.subVectors(bb, a);
    e2.subVectors(c, a);
    n.crossVectors(e1, e2);
    if (n.lengthSq() < 1e-9) return;
    n.normalize();
    if (n.y < 0) {
      n.negate();
      [bb, c] = [c, bb];
    }
    b.tri(a, bb, c, n, rockColor(a, n, yBase + height, seed, PAL.soilUmber, cA), rockColor(bb, n, yBase + height, seed, PAL.soilUmber, cB), rockColor(c, n, yBase + height, seed, PAL.soilUmber, cC));
  };
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nd; j++) {
      tri(P[i]![j]!, P[i + 1]![j]!, P[i + 1]![j + 1]!);
      tri(P[i]![j]!, P[i + 1]![j + 1]!, P[i]![j + 1]!);
    }
  }
}

/** Angular fractured boulder (dressing). */
export function boulder(b: Bucket, x: number, y: number, z: number, r: number, seed: number, flat = 0.7): void {
  const geo = merged(new THREE.IcosahedronGeometry(r, 1));
  const p = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  // a couple of cleavage planes give the angular, split-stone read
  const planes = [0, 1, 2].map((k) => new THREE.Vector3(hash3(seed, k, 1) - 0.5, hash3(seed, k, 2) * 0.6 - 0.1, hash3(seed, k, 3) - 0.5).normalize());
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = fbm3(v.x * 1.3 / r + seed, v.y * 1.3 / r, v.z * 1.3 / r, 2);
    v.multiplyScalar(0.8 + n * 0.4);
    for (const pl of planes) {
      const d = v.dot(pl) - r * 0.55;
      if (d > 0) v.addScaledVector(pl, -d * 0.85);
    }
    v.y *= flat;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  const g2 = geo.toNonIndexed();
  geo.dispose();
  g2.computeVertexNormals();
  const m = trs(x, y, z, seed * 2.1);
  const wq = new THREE.Vector3();
  paint(g2, (q, n, out) => {
    wq.copy(q).applyMatrix4(m);
    rockColor(wq, n, y + r * flat, seed, PAL.rustMoss, out);
  });
  b.add(g2, m);
  g2.dispose();
}

// ---------------------------------------------------------------- masonry

/** Weathering context for the structure being built: its foot and crown heights. */
type Site = { base: number; top: number; moss: number; soot: number };
let SITE: Site = { base: 0, top: 4, moss: 1, soot: 1 };
export function setSite(base: number, top: number, moss = 1, soot = 1): void {
  SITE = { base, top, moss, soot };
}

/** Authored weathering: dark run-off streaks falling from a damaged point (x,z) below yTop. */
const STAINS: Array<{ x: number; z: number; r: number; yTop: number }> = [];
export function addStain(x: number, z: number, r: number, yTop: number): void {
  STAINS.push({ x, z, r, yTop });
}

const STONE_TINTS = [0xa29d94, 0xa8a195, 0x9b978f, 0xa09887, 0xa6a196].map((c) => new THREE.Color(c));

/** Per-vertex masonry colour: block tint, worn arrises, rising damp, soot streaks, rust moss. */
function stoneShade(p: THREE.Vector3, n: THREE.Vector3, kind: number, base: THREE.Color, out: THREE.Color): THREE.Color {
  out.copy(base);
  const h = THREE.MathUtils.clamp((p.y - SITE.base) / Math.max(1, SITE.top - SITE.base), 0, 1);
  if (kind > 0) out.multiplyScalar(1.02); // worn arrises
  out.multiplyScalar(0.84 + 0.3 * fbm3(p.x * 0.8, p.y * 0.8, p.z * 0.8, 2));
  // rising damp and soot at the foot; dark soffits
  out.lerp(PAL.stoneSoot, (1 - THREE.MathUtils.smoothstep(h, 0, 0.45)) * 0.38 * SITE.soot);
  if (n.y < -0.4) out.lerp(PAL.stoneSoot, kind === 0 ? 0.5 : 0.18);
  // run-off streaks down vertical faces
  const st = vnoise3(p.x * 2.4 + p.z * 1.9, p.y * 0.22, 3.1);
  if (Math.abs(n.y) < 0.5 && st > 0.6) out.lerp(PAL.stoneSoot, (st - 0.6) * 1.4 * SITE.soot);
  for (const st2 of STAINS) {
    const d = Math.hypot(p.x - st2.x, p.z - st2.z);
    if (d < st2.r && p.y < st2.yTop) {
      const streak = vnoise3(p.x * 3.3 + p.z * 2.9, p.y * 0.15, 7);
      out.lerp(PAL.stoneSoot, (1 - d / st2.r) * (0.35 + streak * 0.45) * THREE.MathUtils.smoothstep(st2.yTop - p.y, 0, 0.6));
    }
  }
  // rust moss / lichen: tops and the damp lower courses, in patches
  const m = fbm3(p.x * 1.2 + 7, p.y * 1.2, p.z * 1.2, 2);
  const want = THREE.MathUtils.smoothstep(n.y, 0.45, 0.9) * 0.32 + (1 - h) * 0.22;
  const k = m + want - 0.8;
  if (k > 0) out.lerp(k > 0.12 ? PAL.rustMoss : PAL.lichen, Math.min(0.8, k * 3.2) * SITE.moss);
  return out;
}

const _hexF: THREE.Vector3[][] = Array.from({ length: 8 }, () => [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]);
const _hexE = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
const _hc = new THREE.Vector3();
const _hn = new THREE.Vector3();
const _he1 = new THREE.Vector3();
const _he2 = new THREE.Vector3();
const _hcol = [new THREE.Color(), new THREE.Color(), new THREE.Color()];
const _htc = new THREE.Vector3();

/**
 * Chamfered hexahedron: corners P[i + 2j + 4k] (any convex 8-corner block — boxes,
 * wedge voussoirs, dome stones). `bevel[c]` is the per-corner chamfer: small for
 * fitted arrises, large where a corner has been knocked off.
 */
export function hexBlock(b: Bucket, P: THREE.Vector3[], bevel: number[], tint: THREE.Color): void {
  _hc.set(0, 0, 0);
  for (const q of P) _hc.add(q);
  _hc.multiplyScalar(1 / 8);
  for (let c = 0; c < 8; c++) {
    for (let a = 0; a < 3; a++) {
      const e = _hexE[a]!.subVectors(P[c ^ (1 << a)]!, P[c]!);
      const L = e.length();
      e.multiplyScalar(Math.min(bevel[c]!, L * 0.42) / Math.max(L, 1e-6));
    }
    for (let a = 0; a < 3; a++) _hexF[c]![a]!.copy(P[c]!).add(_hexE[(a + 1) % 3]!).add(_hexE[(a + 2) % 3]!);
  }
  const emit = (A: THREE.Vector3, B: THREE.Vector3, C: THREE.Vector3, kind: number) => {
    _he1.subVectors(B, A);
    _he2.subVectors(C, A);
    _hn.crossVectors(_he1, _he2);
    const len = _hn.length();
    if (len < 1e-7) return;
    _hn.multiplyScalar(1 / len);
    _htc.copy(A).add(B).add(C).multiplyScalar(1 / 3).sub(_hc);
    let p0 = A;
    let p1 = B;
    if (_hn.dot(_htc) < 0) {
      _hn.negate();
      p0 = B;
      p1 = A;
    }
    stoneShade(p0, _hn, kind, tint, _hcol[0]!);
    stoneShade(p1, _hn, kind, tint, _hcol[1]!);
    stoneShade(C, _hn, kind, tint, _hcol[2]!);
    b.tri(p0, p1, C, _hn, _hcol[0]!, _hcol[1]!, _hcol[2]!);
  };
  // faces
  for (let a = 0; a < 3; a++) {
    const u = 1 << ((a + 1) % 3);
    const w = 1 << ((a + 2) % 3);
    for (const s of [0, 1 << a]) {
      const q = [s, s | u, s | u | w, s | w].map((c) => _hexF[c]![a]!);
      emit(q[0]!, q[1]!, q[2]!, 0);
      emit(q[0]!, q[2]!, q[3]!, 0);
    }
  }
  // edge chamfers
  for (let a = 0; a < 3; a++) {
    const au = (a + 1) % 3;
    const aw = (a + 2) % 3;
    for (let c = 0; c < 8; c++) {
      if (c & (1 << a)) continue;
      const c1 = c | (1 << a);
      const q = [_hexF[c]![au]!, _hexF[c]![aw]!, _hexF[c1]![aw]!, _hexF[c1]![au]!];
      emit(q[0]!, q[1]!, q[2]!, 1);
      emit(q[0]!, q[2]!, q[3]!, 1);
    }
  }
  // corner facets
  for (let c = 0; c < 8; c++) emit(_hexF[c]![0]!, _hexF[c]![1]!, _hexF[c]![2]!, 2);
}

function stoneTint(r: () => number): THREE.Color {
  return STONE_TINTS[Math.floor(r() * STONE_TINTS.length)]!.clone().multiplyScalar(0.96 + r() * 0.08);
}

function bevels(r: () => number, size: number, chip: number): number[] {
  const base = Math.min(0.028, size * 0.08);
  return Array.from({ length: 8 }, () => (r() < chip * 0.4 ? Math.min(size * 0.4, base + 0.05 + r() * 0.12) : base * (0.7 + r() * 0.6)));
}

/** One dressed, fitted ashlar block (local centre at origin, transform `m`). */
export function stoneBlock(b: Bucket, m: THREE.Matrix4, w: number, h: number, d: number, seed: number, chip = 0.12, tintK = 1): void {
  const r = rng(seed * 7919 + 13);
  const P: THREE.Vector3[] = [];
  for (let c = 0; c < 8; c++) {
    const j = Math.min(w, h, d) * 0.012;
    P.push(new THREE.Vector3(((c & 1 ? 1 : -1) * w) / 2 + (r() - 0.5) * j, ((c & 2 ? 1 : -1) * h) / 2 + (r() - 0.5) * j, ((c & 4 ? 1 : -1) * d) / 2 + (r() - 0.5) * j).applyMatrix4(m));
  }
  hexBlock(b, P, bevels(r, Math.min(w, h, d), chip), stoneTint(r).multiplyScalar(tintK));
}

/** Course of blocks along local +x from x0 to x1 (centre line z=0), heights y0..y1, depth d. Staggered joints. */
function course(b: Bucket, m: THREE.Matrix4, x0: number, x1: number, y0: number, y1: number, d: number, seed: number, len = 1.1, chip = 0.08): void {
  const r = rng(seed * 4241 + 3);
  let x = x0;
  let first = true;
  while (x < x1 - 0.05) {
    let L = len * (0.7 + r() * 0.6) * (first ? 0.4 + r() * 0.6 : 1);
    first = false;
    if (x1 - (x + L) < len * 0.35) L = x1 - x;
    stoneBlock(b, m.clone().multiply(trs(x + L / 2, (y0 + y1) / 2, 0)), L, y1 - y0, d, seed * 31 + Math.round(x * 10), chip);
    x += L;
  }
}

/** Solid inner core (hidden behind fitted faces) so joints never show daylight. */
function core(b: Bucket, m: THREE.Matrix4, w: number, h: number, d: number): void {
  const g = new THREE.BoxGeometry(w, h, d);
  b.add(g, m, PAL.stoneSoot);
  g.dispose();
}

/** Coursed square pier from y0 to y1 (local), alternating whole / split courses. */
let carvedSupport: THREE.BufferGeometry | null = null;
let snappedSupport: THREE.BufferGeometry | null = null;

/** The world loads one licensed CC0 source before any region assembles its architecture. */
export function setRuinSupportGeometry(geometry: THREE.BufferGeometry): void {
  carvedSupport = geometry;
  snappedSupport?.dispose();
  snappedSupport = geometry.clone();
  const p = snappedSupport.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const edge = 1.43 + Math.sin(p.getX(i) * 37) * 0.035 + Math.cos(p.getZ(i) * 29) * 0.025;
    p.setY(i, Math.min(p.getY(i), edge));
  }
  snappedSupport.computeVertexNormals();
}

function pier(b: Bucket, base: THREE.Matrix4, x: number, z: number, w: number, y0: number, y1: number, seed: number, brokenTop = false): void {
  const source = brokenTop ? snappedSupport : carvedSupport;
  if (!source) throw new Error('Load CC0 ruin supports before assembling the world');
  const r = rng(seed * 6007 + 3);
  const height = y1 - y0;
  const m = base.clone().multiply(trs(x, y0, z, r() * 6.28, w / 0.61, height / (brokenTop ? 1.49 : 1.9), w / 0.61,
    (r() - 0.5) * 0.018, (r() - 0.5) * 0.018));
  b.add(source, m, stoneTint(r));
}

/** Point on an arch intrados (t 0..1 left→right) + outward normal; pointed arches use two centres. */
function archPoint(t: number, R: number, pointed: boolean, out: THREE.Vector3, nrm: THREE.Vector3): void {
  if (!pointed) {
    const a = Math.PI * (1 - t);
    out.set(Math.cos(a) * R, Math.sin(a) * R, 0);
    nrm.set(Math.cos(a), Math.sin(a), 0);
    return;
  }
  // two-centred arch: each half is an arc of radius R + e about the opposite centre (±e)
  const e = R * 0.42;
  const Rr = R + e;
  const aSpan = Math.acos(e / Rr);
  const left = t <= 0.5;
  const k = left ? t * 2 : (1 - t) * 2; // 0 at springing → 1 at apex
  const a = Math.PI - aSpan * k;
  const x = e + Math.cos(a) * Rr;
  const y = Math.sin(a) * Rr;
  out.set(left ? x : -x, y, 0);
  nrm.set(left ? Math.cos(a) : -Math.cos(a), Math.sin(a), 0);
}

/**
 * Arch ring of fitted wedge voussoirs over the clear span 2R, springing at local y=0.
 * `from`/`to` (0..1) leave a deliberate broken end.
 */
function voussoirRing(b: Bucket, m: THREE.Matrix4, R: number, thick: number, depth: number, n: number, pointed: boolean, seed: number, from = 0, to = 1): void {
  const r = rng(seed * 313 + 9);
  const pa = new THREE.Vector3();
  const pb = new THREE.Vector3();
  const na = new THREE.Vector3();
  const nb = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const t0 = i / n;
    const t1 = (i + 1) / n;
    if (t1 <= from + 1e-6 || t0 >= to - 1e-6) continue;
    archPoint(t0, R, pointed, pa, na);
    archPoint(t1, R, pointed, pb, nb);
    const key = i === Math.floor(n / 2);
    const th = thick * (key ? 1.18 : 1) * (0.96 + r() * 0.08);
    const P: THREE.Vector3[] = [];
    for (let c = 0; c < 8; c++) {
      const end = c & 1 ? pb : pa;
      const en = c & 1 ? nb : na;
      const q = end.clone().addScaledVector(en, c & 2 ? th : 0);
      q.z = (c & 4 ? 1 : -1) * depth * 0.5 * (key ? 1.04 : 1);
      P.push(q.applyMatrix4(m));
    }
    const brokenEnd = (from > 0 && t0 < from + 1.5 / n) || (to < 1 && t1 > to - 1.5 / n);
    hexBlock(b, P, bevels(r, Math.min(thick, depth, R * 0.3), brokenEnd ? 0.4 : 0.06), stoneTint(r));
  }
}

/** Fallen block / rubble lying on the ground at local (x, z). */
function fallen(b: Bucket, base: THREE.Matrix4, x: number, z: number, w: number, h: number, d: number, seed: number): void {
  const r = rng(seed * 61 + 5);
  const pitch = (r() - 0.5) * 0.6;
  const roll = (r() - 0.5) * 0.5;
  stoneBlock(b, base.clone().multiply(trs(x, h * 0.32, z, r() * 3, 1, 1, 1, pitch, roll)), w, h, d, seed, 0.45);
}

/**
 * Ruined arch (key art): coursed piers on a plinth course, impost slabs, a ring of fitted
 * wedge voussoirs. `broken` > 0 snaps the right side: short pier, ring ends early, fallen
 * stones at the foot — the damage reads as one deliberate event, not even gaps.
 */
export function ruinArch(
  b: Bucket,
  x: number,
  y: number,
  z: number,
  yaw: number,
  o: { span?: number; pillarH?: number; seed?: number; broken?: number; pointed?: boolean } = {},
): void {
  const span = o.span ?? 3.2;
  const ph = o.pillarH ?? 3.4;
  const seed = o.seed ?? 1;
  const r = rng(seed * 104729 + 7);
  const broken = o.broken ?? 0;
  const lean = (r() - 0.5) * 0.05;
  const base = trs(x, y, z, yaw, 1, 1, 1, 0, lean);
  const bw = 0.86;
  const R = span / 2;
  const thick = 0.6;
  setSite(y, y + ph + R + thick, 1, 1);
  const springY = 0.36 + ph;
  for (const side of [-1, 1]) {
    const px = side * (R + bw / 2);
    // plinth course
    stoneBlock(b, base.clone().multiply(trs(px, 0.18, 0)), bw * 1.3, 0.36, bw * 1.3, seed + side * 3, 0.15);
    const snapped = side === 1 && broken > 0;
    const top = snapped ? 0.36 + ph * (1 - broken * 0.75) : springY;
    pier(b, base, px, 0, bw, 0.36, top, seed * 7 + side * 50, snapped);
    if (!snapped) stoneBlock(b, base.clone().multiply(trs(px - side * 0.06, springY + 0.11, 0)), bw * 1.18, 0.22, bw * 1.12, seed + side * 9, 0.1);
  }
  const ringBase = base.clone().multiply(trs(0, springY + 0.22, 0));
  const nv = Math.max(9, Math.round((Math.PI * (R + thick / 2)) / 0.5) | 1);
  const to = broken > 0 ? Math.max(0.2, 1 - broken * 0.85) : 1;
  voussoirRing(b, ringBase, R, thick, bw * 0.96, nv, !!o.pointed, seed + 400, 0, to);
  if (broken > 0) {
    // fallen pier courses and voussoirs, scattered toward the broken side
    const lost = Math.round(broken * 7);
    for (let k = 0; k < lost; k++) {
      fallen(b, base, R + bw + 0.4 + r() * 2.2, (r() - 0.5) * 2.4, 0.5 + r() * 0.4, 0.4 + r() * 0.2, 0.5 + r() * 0.3, seed + 900 + k);
    }
    for (let k = 0; k < 5; k++) fallen(b, base, R + bw * 0.5 + r() * 1.6, (r() - 0.5) * 1.6, 0.18 + r() * 0.2, 0.14, 0.18 + r() * 0.2, seed + 950 + k);
  }
}

/** Fitted column drum (chamfered, 12 sides, slight entasis); jagged top when `broken`. */
function drum(b: Bucket, m: THREE.Matrix4, r0: number, r1: number, h: number, seed: number, broken: boolean): void {
  const ch = Math.min(0.05, h * 0.12);
  const prof = [
    new THREE.Vector2(0.001, -h / 2),
    new THREE.Vector2(r0 - ch, -h / 2),
    new THREE.Vector2(r0, -h / 2 + ch),
    new THREE.Vector2(r1, h / 2 - ch),
    new THREE.Vector2(r1 - ch, h / 2),
    new THREE.Vector2(0.001, h / 2),
  ];
  const g = new THREE.LatheGeometry(prof, 12, hash3(seed, 1, 1) * 6);
  const p = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = vnoise3(v.x * 5 + seed, v.y * 5, v.z * 5);
    const s = 1 - (n - 0.5) * 0.06;
    v.x *= s;
    v.z *= s;
    if (broken && v.y > 0) v.y -= Math.pow(vnoise3(v.x * 3 + seed, 7, v.z * 3), 1.4) * h * 0.9;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  const g2 = g.toNonIndexed();
  g.dispose();
  g2.computeVertexNormals();
  const r = rng(seed * 3 + 1);
  const tint = stoneTint(r);
  const wq = new THREE.Vector3();
  paint(g2, (q, n, out) => stoneShade(wq.copy(q).applyMatrix4(m), n, 0, tint, out));
  b.add(g2, m);
  g2.dispose();
}

/** Broken column: square plinth, base moulding, fitted drums with a snapped top (+ a fallen drum). */
export function ruinColumn(b: Bucket, x: number, y: number, z: number, h: number, seed: number, r0 = 0.42): void {
  const r = rng(seed * 6007 + 3);
  setSite(y, y + h + 0.6);
  const lean = trs(x, y, z, r() * 3, 1, 1, 1, (r() - 0.5) * 0.04, (r() - 0.5) * 0.04);
  stoneBlock(b, lean.clone().multiply(trs(0, 0.2, 0)), r0 * 2.7, 0.4, r0 * 2.7, seed + 1, 0.15);
  drum(b, lean.clone().multiply(trs(0, 0.5, 0)), r0 * 1.22, r0 * 1.12, 0.2, seed + 2, false);
  const drums = Math.max(1, Math.round(h / 0.75));
  const dh = h / drums;
  for (let i = 0; i < drums; i++) {
    const t0 = i / drums;
    const t1 = (i + 1) / drums;
    drum(b, lean.clone().multiply(trs(0, 0.6 + dh * (i + 0.5), 0)), r0 * (1 - t0 * 0.08), r0 * (1 - t1 * 0.08), dh, seed * 11 + i, i === drums - 1);
  }
  core(b, lean.clone().multiply(trs(0, 0.6 + h / 2 - dh / 2, 0)), r0 * 1.2, h - dh, r0 * 1.2);
  if (h > 1.2 && r() < 0.7) {
    const a = r() * Math.PI * 2;
    const d = r0 * 2.6 + r() * 0.8;
    drum(b, trs(x + Math.cos(a) * d, y + r0 * 0.9, z + Math.sin(a) * d, a, 1, 1, 1, Math.PI / 2, (r() - 0.5) * 0.3), r0, r0 * 0.97, 0.7, seed + 99, false);
  }
}

/**
 * Stone stair flight from a → c (rise along the run), sitting on a solid supported body.
 * Each tread is two or three worn slabs with a rounded nosing and a dished middle; the
 * open side(s) get a coursed cheek wall stepped under the treads. `open` picks which
 * sides are exposed (local −x / +x); `foot` is the ground height under the flight.
 * Visual only — pair with a ramped box collider of the same footprint.
 */
export function stairFlight(
  b: Bucket,
  a: { x: number; z: number; y: number },
  c: { x: number; z: number; y: number },
  width: number,
  seed: number,
  o: { open?: [boolean, boolean]; foot?: number; crumbleStart?: boolean; crumbleEnd?: boolean; rock?: Bucket } = {},
): void {
  const dx = c.x - a.x;
  const dz = c.z - a.z;
  const len = Math.hypot(dx, dz);
  const yaw = Math.atan2(dx, dz);
  const rise = c.y - a.y;
  const steps = Math.max(2, Math.round(Math.abs(rise) / 0.3));
  const run = len / steps;
  const r = rng(seed * 31337 + 11);
  const foot = o.foot ?? Math.min(a.y, c.y) - 0.6;
  const open = o.open ?? [true, true];
  const m0 = new THREE.Matrix4().compose(new THREE.Vector3(a.x, 0, a.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(1, 1, 1));
  setSite(foot, Math.max(a.y, c.y) + 0.5, 1.1, 1);
  const tread = 0.16;
  const cheek = 0.42;
  const hw = width / 2;
  for (let i = 0; i < steps; i++) {
    const top = a.y + rise * ((i + 1) / steps);
    const z0 = run * i;
    const crumble = (o.crumbleEnd && i >= steps - 2) || (o.crumbleStart && i < 2);
    // riser body: one fitted block from the step below to under this tread
    const bodyLo = Math.max(foot, top - 0.3 - tread - 0.42);
    const bodyHi = top - tread;
    if (bodyHi - bodyLo > 0.05) stoneBlock(b, m0.clone().multiply(trs(0, (bodyLo + bodyHi) / 2, z0 + run * 0.5)), width * 0.98, bodyHi - bodyLo, run * 1.0, seed * 97 + i * 7, 0.06);
    // tread slabs: worn nosing, middle slab sits lower (dished by feet)
    const pieces = width > 2.4 ? 3 : 2;
    let x = -hw;
    for (let k = 0; k < pieces; k++) {
      const pw = k === pieces - 1 ? hw - x : (width / pieces) * (0.82 + r() * 0.36);
      if (crumble && k !== 1 && r() < 0.55) {
        x += pw;
        continue;
      }
      const mid = pieces === 3 ? k === 1 : false;
      const sag = mid ? 0.025 : 0.008 * r();
      const tz = z0 + run * 0.5 - 0.02; // nosing overhangs the riser a little
      const P: THREE.Vector3[] = [];
      for (let q = 0; q < 8; q++) {
        const lx = q & 1 ? x + pw : x;
        const ly = (q & 2 ? top - sag : top - tread) + (r() - 0.5) * 0.01;
        const lz = tz + (q & 4 ? -run * 0.53 : run * 0.53);
        P.push(new THREE.Vector3(lx, ly, lz).applyMatrix4(m0));
      }
      // nosing corners (front-top: local −z is the low/front edge) worn round
      const bev = bevels(r, tread, crumble ? 0.4 : 0.05);
      for (const q of [6, 7]) bev[q] = Math.max(bev[q]!, 0.07 + r() * 0.04);
      hexBlock(b, P, bev, stoneTint(r));
      x += pw;
    }
  }
  // supported body: the flight stands on a solid mass down to the foot
  {
    const g = new THREE.BufferGeometry();
    const lo = foot;
    const yA = a.y - tread - 0.3;
    const yC = c.y - tread - 0.3;
    const L = len;
    const ins = 0.12;
    const v = [
      [-hw + ins, lo, 0], [hw - ins, lo, 0], [-hw + ins, lo, L], [hw - ins, lo, L],
      [-hw + ins, Math.max(lo, yA), 0], [hw - ins, Math.max(lo, yA), 0], [-hw + ins, Math.max(lo, yC), L], [hw - ins, Math.max(lo, yC), L],
    ];
    const quads = [[0, 1, 5, 4], [2, 6, 7, 3], [0, 4, 6, 2], [1, 3, 7, 5], [4, 5, 7, 6]];
    const pos: number[] = [];
    for (const qd of quads) for (const t of [[0, 1, 2], [0, 2, 3]]) for (const k of t) pos.push(...(v[qd[k]!] as [number, number, number]));
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    b.add(g, m0, PAL.stoneSoot);
    g.dispose();
  }
  // open side(s): a band of coursed cheek masonry just under the treads; below it the flight
  // is buried in a rough rock buttress, so the stair reads before its support
  const lineAt = (z: number) => a.y + (rise * z) / len;
  for (const side of [0, 1] as const) {
    if (!open[side]) continue;
    const sgn = side === 0 ? -1 : 1;
    const sx = sgn * (hw + cheek / 2 - 0.06);
    const ch = 0.42;
    const band = 1.0;
    for (let k = 0; ; k++) {
      const y0 = foot + k * ch;
      const y1 = y0 + ch;
      if (y0 > Math.max(a.y, c.y) - tread - 0.15) break;
      // this course shows only where the tread line is between its top and `band` above it
      const zLo = THREE.MathUtils.clamp(((y1 + tread - a.y) / (rise || 1)) * len, 0, len);
      const zHi = THREE.MathUtils.clamp(((y1 + band - a.y) / (rise || 1)) * len, 0, len);
      const zs = Math.min(zLo, zHi);
      const ze = Math.max(zLo, zHi);
      const cut = o.crumbleEnd ? 1.1 : 0;
      const s0 = (o.crumbleStart ? 1.1 : 0) + zs;
      if (ze - cut - s0 < 0.35) continue;
      course(b, m0.clone().multiply(trs(sx, 0, 0, Math.PI / 2)), -(ze - cut), -s0, y0, Math.min(y1, Math.max(a.y, c.y) - tread), cheek, seed * 13 + k * 7 + side, 1.15, 0.1);
    }
    if (o.rock) {
      // buttress: a rough sloping rock face from the foot up to just under the masonry band
      const nz = Math.max(3, Math.ceil(len / 0.7));
      const ny = 5;
      const pts: THREE.Vector3[][] = [];
      for (let zi = 0; zi <= nz; zi++) {
        const z = (len * zi) / nz;
        const topY = Math.max(foot, lineAt(z) - tread - band + 0.15);
        const row: THREE.Vector3[] = [];
        for (let yi = 0; yi <= ny; yi++) {
          const t = yi / ny;
          const y = foot - 0.3 + (topY - foot + 0.3) * t;
          const out = hw + cheek * 0.6 + (1 - t) * 0.9 + (vnoise3(z * 0.9 + seed, y * 0.8, side) - 0.5) * 0.5;
          row.push(new THREE.Vector3(sgn * out, y, z).applyMatrix4(m0));
        }
        pts.push(row);
      }
      const nn = new THREE.Vector3();
      const ca = new THREE.Color();
      const cb2 = new THREE.Color();
      const cc2 = new THREE.Color();
      const outW = new THREE.Vector3(sgn, 0, 0).transformDirection(m0);
      const tri = (p: THREE.Vector3, q: THREE.Vector3, r2: THREE.Vector3) => {
        nn.crossVectors(new THREE.Vector3().subVectors(q, p), new THREE.Vector3().subVectors(r2, p));
        if (nn.lengthSq() < 1e-10) return;
        nn.normalize();
        if (nn.dot(outW) < 0) {
          nn.negate();
          [q, r2] = [r2, q];
        }
        const yt = Math.max(a.y, c.y);
        o.rock!.tri(p, q, r2, nn, rockColor(p, nn, yt, seed, PAL.soilUmber, ca), rockColor(q, nn, yt, seed, PAL.soilUmber, cb2), rockColor(r2, nn, yt, seed, PAL.soilUmber, cc2));
      };
      for (let zi = 0; zi < nz; zi++) {
        for (let yi = 0; yi < ny; yi++) {
          tri(pts[zi]![yi]!, pts[zi + 1]![yi]!, pts[zi + 1]![yi + 1]!);
          tri(pts[zi]![yi]!, pts[zi + 1]![yi + 1]!, pts[zi]![yi + 1]!);
        }
      }
    }
  }
  // crumbled end: rubble below the break
  if (o.crumbleEnd || o.crumbleStart) {
    const zEnd = o.crumbleEnd ? len : 0;
    const yEnd = o.crumbleEnd ? c.y : a.y;
    for (let k = 0; k < 6; k++) {
      const lz = zEnd + (o.crumbleEnd ? 1 : -1) * (0.3 + r() * 1.2);
      const lx = (r() - 0.5) * width;
      const s = 0.2 + r() * 0.35;
      stoneBlock(b, m0.clone().multiply(trs(lx, Math.max(foot, yEnd - 2.5) + s * 0.4, lz, r() * 3, 1, 1, 1, (r() - 0.5) * 0.7, (r() - 0.5) * 0.6)), s * 1.4, s, s * 1.1, seed + 700 + k, 0.5);
    }
  }
}

/** Flagstone paving: irregular slabs in loose rows over a rect (local), slightly proud of `y`. */
export function paving(b: Bucket, m: THREE.Matrix4, w: number, d: number, y: number, seed: number, skip = 0.06, inside?: (x: number, z: number) => boolean): void {
  const r = rng(seed * 733 + 1);
  let z = -d / 2;
  while (z < d / 2 - 0.1) {
    const rowD = Math.min(d / 2 - z, 0.55 + r() * 0.45);
    let x = -w / 2 + (r() - 0.5) * 0.3;
    x = Math.max(-w / 2, x);
    while (x < w / 2 - 0.1) {
      const pw = Math.min(w / 2 - x, 0.6 + r() * 0.7);
      const cx = x + pw / 2;
      const cz = z + rowD / 2;
      if (r() >= skip && (!inside || inside(cx, cz))) {
        const th = 0.12;
        const tilt = (r() - 0.5) * 0.03;
        stoneBlock(b, m.clone().multiply(trs(cx, y + th / 2 - 0.085 + (r() - 0.5) * 0.02, cz, (r() - 0.5) * 0.04, 1, 1, 1, tilt, tilt)), pw - 0.04, th, rowD - 0.04, seed * 17 + Math.round(cx * 13 + cz * 71), 0.12, 0.74 + r() * 0.12);
      }
      x += pw;
    }
    z += rowD;
  }
}

/**
 * Domed shrine (key art, right side): coursed stepped plinth with paved top, four coursed
 * corner piers carrying round arches on every face, entablature with a glyph frieze,
 * cornice, and a dome laid in fitted wedge courses round a finial. Glyph inlays go in `glow`.
 */
export function domedShrine(stone: Bucket, glow: Bucket, x: number, y: number, z: number, scale: number, seed: number): void {
  const S = scale;
  const M = trs(x, y, z, 0, S, S, S);
  const at = (lx: number, ly: number, lz: number, yaw = 0) => M.clone().multiply(trs(lx, ly, lz, yaw));
  setSite(y, y + 7.6 * S, 0.9, 1);
  // --- stepped plinth: each tier is a ring of fitted blocks round a solid core
  const tiers: Array<[number, number]> = [[4.6, 0], [4.0, 0.4], [3.4, 0.8]];
  for (let ti = 0; ti < tiers.length; ti++) {
    const [w, y0] = tiers[ti]!;
    const y1 = y0 + 0.4;
    const dep = 0.62;
    core(stone, at(0, (y0 + y1) / 2 - 0.01, 0), w - 0.3, 0.38, w - 0.3);
    for (let f = 0; f < 4; f++) {
      const yaw = (f * Math.PI) / 2;
      // long faces run the full width on two sides, inset on the other two
      const L = f % 2 === 0 ? w : w - dep * 2;
      const fm = M.clone().multiply(trs(0, 0, 0, yaw)).multiply(trs(0, 0, w / 2 - dep / 2));
      course(stone, fm, -L / 2, L / 2, y0, y1, dep, seed * 5 + ti * 13 + f, 1.15, 0.12);
    }
  }
  // paved platform
  paving(stone, M, 3.3, 3.3, 1.2, seed + 3, 0.04);
  // --- four corner piers (1.2 → 4.4) with impost bands
  const pc = 1.32;
  const pw = 0.72;
  const springY = 3.06;
  const entY = 4.42;
  for (const [cx, cz] of [[-pc, -pc], [pc, -pc], [-pc, pc], [pc, pc]] as const) {
    stoneBlock(stone, at(cx, 1.3, cz), pw + 0.16, 0.2, pw + 0.16, seed + 30 + cx * 7 + cz * 3, 0.1);
    pier(stone, M, cx, cz, pw, 1.4, springY, seed * 11 + Math.round(cx * 7 + cz * 3));
    stoneBlock(stone, at(cx, springY + 0.08, cz), pw + 0.14, 0.16, pw + 0.14, seed + 40 + cx * 5 + cz, 0.08);
    pier(stone, M, cx, cz, pw, springY + 0.16, entY, seed * 13 + Math.round(cx * 5 + cz * 9));
  }
  // --- arches on all four faces + spandrel blocks up to the entablature
  const R = pc - pw / 2; // clear half-span
  const thick = 0.34;
  for (let f = 0; f < 4; f++) {
    const yaw = (f * Math.PI) / 2;
    const fm = M.clone().multiply(trs(0, 0, 0, yaw)).multiply(trs(0, 0, pc));
    voussoirRing(stone, fm.clone().multiply(trs(0, springY + 0.16, 0)), R, thick, pw * 0.94, 9, false, seed * 7 + f);
    // spandrels: wedge blocks filling between ring extrados and the entablature soffit
    for (const side of [-1, 1]) {
      const P: THREE.Vector3[] = [];
      const xa = side * (R + thick * 0.15);
      const xb = side * (R * 0.42);
      const ya = springY + 0.16 + Math.sqrt(Math.max(0, (R + thick) ** 2 - xa * xa));
      const yb = springY + 0.16 + Math.sqrt(Math.max(0, (R + thick) ** 2 - xb * xb));
      for (let c = 0; c < 8; c++) {
        const lx = c & 1 ? xb : xa;
        const ly = c & 2 ? entY : lx === xa ? ya - 0.05 : yb - 0.03;
        P.push(new THREE.Vector3(lx, ly, (c & 4 ? 1 : -1) * pw * 0.45).applyMatrix4(fm));
      }
      hexBlock(stone, P, bevels(rng(seed + f * 2 + side), 0.3, 0.05), stoneTint(rng(seed + f * 9 + side)));
    }
    // crown filler over the keystone
    stoneBlock(stone, fm.clone().multiply(trs(0, (springY + 0.16 + R + thick * 1.18 + entY) / 2 + 0.01, 0)), R * 0.9, Math.max(0.06, entY - (springY + 0.16 + R + thick * 1.18)), pw * 0.9, seed + 77 + f, 0.05);
  }
  // inner altar with ember basin (visible through the arches)
  drum(stone, at(0, 1.38, 0), 0.62, 0.6, 0.36, seed + 49, false);
  drum(stone, at(0, 1.78, 0), 0.42, 0.4, 0.44, seed + 50, false);
  drum(stone, at(0, 2.08, 0), 0.6, 0.56, 0.16, seed + 51, false);
  {
    const ring = new THREE.TorusGeometry(0.32, 0.07, 6, 18);
    ring.rotateX(Math.PI / 2);
    glow.add(ring, at(0, 2.2, 0), PAL.amber);
    ring.dispose();
    const ember = new THREE.IcosahedronGeometry(0.2, 1);
    glow.add(ember, at(0, 2.32, 0), PAL.copper);
    ember.dispose();
  }
  // --- entablature: architrave course, frieze course with glyphs, projecting cornice
  core(stone, at(0, entY + 0.4, 0), 3.2, 0.78, 3.2);
  for (let f = 0; f < 4; f++) {
    const yaw = (f * Math.PI) / 2;
    const L = f % 2 === 0 ? 3.5 : 3.5 - 0.7;
    const fm = M.clone().multiply(trs(0, 0, 0, yaw)).multiply(trs(0, 0, 1.75 - 0.35));
    course(stone, fm, -L / 2, L / 2, entY, entY + 0.36, 0.7, seed * 17 + f, 1.2, 0.1);
    const L2 = f % 2 === 0 ? 3.36 : 3.36 - 0.6;
    const fm2 = M.clone().multiply(trs(0, 0, 0, yaw)).multiply(trs(0, 0, 1.68 - 0.3));
    course(stone, fm2, -L2 / 2, L2 / 2, entY + 0.36, entY + 0.66, 0.6, seed * 19 + f, 0.9, 0.1);
    const L3 = f % 2 === 0 ? 3.8 : 3.8 - 0.7;
    const fm3 = M.clone().multiply(trs(0, 0, 0, yaw)).multiply(trs(0, 0, 1.9 - 0.35));
    // one corner of the cornice has come down (north-east): a single, deliberate break
    course(stone, fm3, -L3 / 2 + (f === 2 ? 0.9 : 0), L3 / 2 - (f === 1 ? 1.3 : 0), entY + 0.66, entY + 0.86, 0.7, seed * 23 + f, 1.3, 0.14);
    for (let k = -1; k <= 1; k++) {
      const lx = Math.cos(yaw) * k * 0.95 + Math.sin(yaw) * 1.69;
      const lz = -Math.sin(yaw) * k * 0.95 + Math.cos(yaw) * 1.69;
      const leaf = leafShape(0.26, 0.24);
      glow.add(leaf, at(lx, entY + 0.51, lz, yaw), PAL.amber);
      leaf.dispose();
    }
  }
  // rain has run off the broken corner for a long time: a dark streak down the NE pier
  addStain(x + 1.45 * S, z - 1.45 * S, 1.1 * S, y + (entY + 0.86) * S);
  // the fallen cornice stones lie below the broken corner
  for (const [fx, fz, k] of [[2.9, -2.4, 0], [3.5, -1.6, 1], [2.4, -3.2, 2]] as const) fallen(stone, M, fx, fz, 1.0, 0.2 + k * 0.03, 0.62, seed + 600 + k);
  // --- dome: fitted wedge courses (corbelled), staggered joints, over a dark shell
  const dBase = entY + 0.86;
  const Rd = 1.5;
  const Hd = 1.6;
  const prof = (t: number) => ({ r: Math.cos((t * Math.PI) / 2) * Rd * (1 - 0.1 * Math.sin(t * Math.PI)), y: Math.sin((t * Math.PI) / 2) * Hd });
  {
    const shellPts: THREE.Vector2[] = [];
    for (let i = 0; i <= 10; i++) {
      const q = prof(i / 10);
      shellPts.push(new THREE.Vector2(Math.max(0.02, q.r - 0.14), q.y - 0.1));
    }
    const shell = new THREE.LatheGeometry(shellPts, 16);
    stone.add(shell, at(0, dBase, 0), PAL.stoneSoot);
    shell.dispose();
  }
  const rd = rng(seed * 41 + 2);
  const courses = 7;
  for (let j = 0; j < courses; j++) {
    const t0 = j / courses;
    const t1 = (j + 1) / courses;
    const a = prof(t0 * 0.9);
    const bq = prof(t1 * 0.9);
    const n = Math.max(6, Math.round((Math.PI * 2 * a.r) / 0.6));
    const off = (j % 2) * 0.5 + rd() * 0.2;
    const th = 0.16;
    for (let i = 0; i < n; i++) {
      const th0 = ((i + off) / n) * Math.PI * 2;
      // a few dome stones lost on the broken north-east side
      const lost = (j === 2 || j === 3) && Math.abs((((th0 + Math.PI / 4 + Math.PI) % (Math.PI * 2)) - Math.PI)) < (j === 2 ? 0.25 : 0.42);
      if (lost) continue;
      const th1 = ((i + 1 + off) / n) * Math.PI * 2;
      const P: THREE.Vector3[] = [];
      for (let c = 0; c < 8; c++) {
        const ang = c & 1 ? th1 : th0;
        const ring = c & 2 ? bq : a;
        const rr = ring.r + (c & 4 ? th * 0.5 : -th * 0.5);
        P.push(new THREE.Vector3(Math.cos(ang) * rr, dBase + ring.y + (c & 4 ? 0.03 : 0), Math.sin(ang) * rr).applyMatrix4(M));
      }
      hexBlock(stone, P, bevels(rd, 0.16, 0.08), stoneTint(rd));
    }
  }
  // cap stone + finial (drum, ball, spike)
  const capY = dBase + prof(0.9).y;
  drum(stone, at(0, capY + 0.1, 0), prof(0.9).r + 0.08, prof(0.9).r - 0.02, 0.22, seed + 69, false);
  stoneBlock(stone, at(0, capY + 0.36, 0), 0.5, 0.3, 0.5, seed + 70, 0.08);
  const ball = new THREE.SphereGeometry(0.3, 12, 8);
  const ballFlat = ball.toNonIndexed();
  ballFlat.computeVertexNormals();
  paint(ballFlat, (q, nn, out) => stoneShade(q.clone().applyMatrix4(at(0, capY + 0.82, 0)), nn, 0, STONE_TINTS[1]!, out));
  stone.add(ballFlat, at(0, capY + 0.82, 0));
  ball.dispose();
  ballFlat.dispose();
  const spike = new THREE.ConeGeometry(0.11, 0.62, 6);
  paint(spike, (_q, _n, out) => out.copy(PAL.stoneSoot));
  stone.add(spike, at(0, capY + 1.38, 0));
  spike.dispose();
}

/** Seedwell: octagonal carved basin of fitted wedge blocks, three standing glyph stones. */
export function seedwell(stone: Bucket, glow: Bucket, column: THREE.BufferGeometry, x: number, y: number, z: number, seed: number): void {
  const r = rng(seed * 811 + 5);
  setSite(y, y + 3);
  // basin ring: 8 wedge blocks, fitted
  for (let i = 0; i < 8; i++) {
    const a0 = (i / 8) * Math.PI * 2;
    const a1 = ((i + 1) / 8) * Math.PI * 2;
    const P: THREE.Vector3[] = [];
    for (let c = 0; c < 8; c++) {
      const a = c & 1 ? a1 : a0;
      const rr = c & 4 ? 1.78 : 1.28;
      P.push(new THREE.Vector3(x + Math.cos(a) * rr, y + (c & 2 ? 0.72 : 0), z + Math.sin(a) * rr));
    }
    hexBlock(stone, P, bevels(r, 0.45, 0.12), stoneTint(r));
  }
  paving(stone, trs(x, 0, z), 2.6, 2.6, y + 0.16, seed + 99, 0, (px, pz) => Math.hypot(px, pz) < 1.25);
  // ember pool
  const pool = new THREE.CircleGeometry(1.2, 18);
  pool.rotateX(-Math.PI / 2);
  glow.add(pool, trs(x, y + 0.45, z), PAL.amber);
  pool.dispose();
  // three glyph stones
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + 0.5;
    const sx = x + Math.cos(a) * 2.6;
    const sz = z + Math.sin(a) * 2.6;
    const h = 2.1 + r() * 0.8;
    const yaw = Math.atan2(x - sx, z - sz);
    stone.add(column, trs(sx, y - 0.1, sz, yaw, 0.45 / 0.61, h / 1.9, 0.45 / 0.61, (r() - 0.5) * 0.1, (r() - 0.5) * 0.1), stoneTint(r));
    const leaf = leafShape(0.26, 0.4);
    glow.add(leaf, trs(sx + Math.sin(yaw) * 0.24, y + h * 0.62, sz + Math.cos(yaw) * 0.24, yaw), PAL.amber);
    leaf.dispose();
  }
}

/**
 * Cold hearth (world-1.md §1.3 heat): a squat two-course plinth and a ring of seven fitted wedge stones
 * around a sunken ash bed at y + 0.92 (the ash, flame and ember column live in chem/updraft.ts).
 */
export function hearthBrazier(stone: Bucket, x: number, y: number, z: number, seed: number): void {
  const r = rng(seed * 613 + 11);
  setSite(y, y + 1.1);
  stoneBlock(stone, trs(x, y + 0.12, z, r() * 3), 1.9, 0.26, 1.9, seed, 0.16);
  stoneBlock(stone, trs(x, y + 0.36, z, 0.4 + r()), 1.45, 0.26, 1.45, seed + 1, 0.14);
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2 + 0.06;
    const a1 = ((i + 1) / n) * Math.PI * 2 - 0.06;
    const P: THREE.Vector3[] = [];
    const h = 0.56 + r() * 0.12;
    for (let c = 0; c < 8; c++) {
      const a = c & 1 ? a1 : a0;
      const rr = c & 4 ? 0.98 : 0.66;
      // outer face leans out a little, like a weathered bowl
      const top = c & 2;
      P.push(new THREE.Vector3(x + Math.cos(a) * (rr + (top && c & 4 ? 0.08 : 0)), y + 0.46 + (top ? h : 0), z + Math.sin(a) * (rr + (top && c & 4 ? 0.08 : 0))));
    }
    // fire-blackened bowl stones
    hexBlock(stone, P, bevels(r, 0.3, 0.07), stoneTint(r).multiplyScalar(0.58 + r() * 0.1));
  }
}

/** Kiln inlet: a weathered pillar with a cantilevered arm carrying a shallow stone dish over a hearth. */
export function kilnBowl(stone: Bucket, px: number, py: number, pz: number, bx: number, by: number, bz: number, seed: number, column?: THREE.BufferGeometry): void {
  const r = rng(seed * 409 + 3);
  setSite(py, by + 0.6);
  const top = by + 0.55;
  const h = top - py;
  if (column) {
    // carved drums stacked into one tall pillar, each turned a little: an old kiln mast, not a monolith
    const drums = Math.max(1, Math.round(h / 2.2));
    const dh = h / drums;
    for (let i = 0; i < drums; i++) stone.add(column, trs(px, py + dh * i, pz, r() * Math.PI, 1.35 - i * 0.08, dh / 1.9, 1.35 - i * 0.08), PAL.stone);
  } else {
    const courses = Math.max(2, Math.round(h / 0.75));
    for (let i = 0; i < courses; i++) {
      const ch = h / courses;
      const w = 0.78 - (i / courses) * 0.18;
      stoneBlock(stone, trs(px, py + ch * (i + 0.5), pz, r() * 0.4 - 0.2), w, ch * 0.98, w, seed + i, 0.12);
    }
  }
  const dx = bx - px;
  const dz = bz - pz;
  const len = Math.hypot(dx, dz);
  const yaw = Math.atan2(dx, dz);
  stoneBlock(stone, trs((px + bx) / 2, top + 0.12, (pz + bz) / 2, yaw), 0.44, 0.34, len + 0.5, seed + 40, 0.1);
  const n = 6;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2 + 0.05;
    const a1 = ((i + 1) / n) * Math.PI * 2 - 0.05;
    const P: THREE.Vector3[] = [];
    for (let c = 0; c < 8; c++) {
      const a = c & 1 ? a1 : a0;
      const rr = c & 4 ? 0.88 : 0.58;
      P.push(new THREE.Vector3(bx + Math.cos(a) * rr, by - 0.12 + (c & 2 ? 0.32 : 0), bz + Math.sin(a) * rr));
    }
    hexBlock(stone, P, bevels(r, 0.26, 0.06), stoneTint(r));
  }
  stoneBlock(stone, trs(bx, by - 0.2, bz), 1.2, 0.16, 1.2, seed + 50, 0.1);
}

/** Checkpoint lantern: stone post with a hooded lamp (lamp face in glow bucket). */
export function lanternPost(stone: Bucket, glow: Bucket, column: THREE.BufferGeometry, x: number, y: number, z: number, seed: number): void {
  setSite(y, y + 2.6);
  stone.add(column, trs(x, y, z, seed * 0.13), PAL.stone);
  const lamp = new THREE.BoxGeometry(0.4, 0.38, 0.4);
  glow.add(lamp, trs(x, y + 2.08, z), PAL.amber);
  lamp.dispose();
  const roof = new THREE.ConeGeometry(0.52, 0.42, 4);
  paint(roof, (_q, _n, out) => out.copy(PAL.stoneSoot));
  stone.add(roof, trs(x, y + 2.47, z, Math.PI / 4));
  roof.dispose();
}

// ---------------------------------------------------------------- leaves

/** Flat maple-ish leaf polygon in XY plane, pointing +Y (glyph inlays). */
export function leafShape(w: number, h: number): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(0, -h * 0.5);
  s.lineTo(w * 0.22, -h * 0.15);
  s.lineTo(w * 0.5, -h * 0.05);
  s.lineTo(w * 0.3, h * 0.12);
  s.lineTo(w * 0.36, h * 0.38);
  s.lineTo(w * 0.1, h * 0.3);
  s.lineTo(0, h * 0.5);
  s.lineTo(-w * 0.1, h * 0.3);
  s.lineTo(-w * 0.36, h * 0.38);
  s.lineTo(-w * 0.3, h * 0.12);
  s.lineTo(-w * 0.5, -h * 0.05);
  s.lineTo(-w * 0.22, -h * 0.15);
  s.lineTo(0, -h * 0.5);
  return new THREE.ShapeGeometry(s);
}

/** Leaf-atlas cells (see russetTextures.leafAtlas): u0, v0 of each 0.5×0.5 cell. */
export const LEAF_CELL = { single: 0, single2: 1, spray: 2, sparse: 3 } as const;
const CELL_UV: Array<[number, number]> = [
  [0, 0.5],
  [0.5, 0.5],
  [0, 0],
  [0.5, 0],
];
const _cardQ = [
  [-0.5, -0.5, 0, 0],
  [0.5, -0.5, 1, 0],
  [0.5, 0.5, 1, 1],
  [-0.5, -0.5, 0, 0],
  [0.5, 0.5, 1, 1],
  [-0.5, 0.5, 0, 1],
] as const;

/**
 * Alpha-cut leaf card (atlas `cell`), appended directly. Normal `n` is the shading
 * normal (up for litter, radial for crowns — soft volumetric light). Flipped cards
 * mirror the cell so repeats don't line up.
 */
export function pushLeaf(
  b: Bucket,
  x: number,
  y: number,
  z: number,
  size: number,
  yaw: number,
  pitch: number,
  roll: number,
  color: THREE.Color,
  n: THREE.Vector3,
  cell = 0,
  flip = false,
): void {
  const m = trs(x, y, z, yaw, size, size, size, pitch, roll);
  const v = new THREE.Vector3();
  const [u0, v0] = CELL_UV[cell]!;
  for (const [px, py, cu, cv] of _cardQ) {
    v.set(px, py, 0).applyMatrix4(m);
    b.pos.push(v.x, v.y, v.z);
    b.nor.push(n.x, n.y, n.z);
    b.col.push(color.r, color.g, color.b);
    b.uv.push(u0 + (flip ? 1 - cu : cu) * 0.5 * 0.98 + 0.005, v0 + cv * 0.5 * 0.98 + 0.005);
  }
}

const UP = new THREE.Vector3(0, 1, 0);

/** Flat leaf litter scattered on the ground (sampler gives ground y). */
export function litterPatch(
  b: Bucket,
  r: () => number,
  cx: number,
  cz: number,
  radius: number,
  count: number,
  ground: (x: number, z: number) => number,
  palette = LEAF_COLORS,
): void {
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r()) * radius;
    const x = cx + Math.cos(a) * d;
    const z = cz + Math.sin(a) * d;
    const y = ground(x, z);
    if (!Number.isFinite(y) || y < -50) continue;
    c.copy(palette[Math.floor(r() * palette.length)]!).offsetHSL((r() - 0.5) * 0.02, 0.02, (r() - 0.5) * 0.12 - 0.04);
    c.multiplyScalar(0.8);
    // curled, slightly lifted leaves catch light at the pile edges
    pushLeaf(b, x, y + 0.03 + r() * 0.05, z, 0.16 + r() * 0.14, r() * 6.28, -Math.PI / 2 + (r() - 0.5) * 0.9, (r() - 0.5) * 0.8, c, UP, r() < 0.5 ? 0 : 1, r() < 0.5);
  }
}

/** Low red/orange shrub: overlapping twig sprays fanned out from a rooted base. */
export function shrub(b: Bucket, r: () => number, x: number, y: number, z: number, size: number, hue: THREE.Color): void {
  const n = Math.round(6 + size * 10);
  const c = new THREE.Color();
  const nn = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const u = r() * Math.PI * 2;
    const up = 0.25 + r() * 0.75;
    const sx = Math.cos(u) * (1 - up * 0.6);
    const sz = Math.sin(u) * (1 - up * 0.6);
    const rr = size * (0.35 + r() * 0.45);
    nn.set(sx, up + 0.4, sz).normalize();
    c.copy(hue).offsetHSL((r() - 0.5) * 0.04, (r() - 0.5) * 0.1, (r() - 0.5) * 0.12 + (up - 0.6) * 0.1);
    const s = (0.55 + r() * 0.35) * (0.6 + size * 0.7);
    // card base at the root, fanned outward: yaw faces out, pitch leans it over
    pushLeaf(b, x + sx * rr * 0.6, y + s * 0.42 * up + 0.02, z + sz * rr * 0.6, s, -u + Math.PI / 2, -(1 - up) * 0.9, (r() - 0.5) * 0.4, c, nn, r() < 0.65 ? LEAF_CELL.spray : LEAF_CELL.sparse, r() < 0.5);
  }
}

// ---------------------------------------------------------------- trees

function taperedTube(
  b: Bucket,
  curve: THREE.Curve<THREE.Vector3>,
  r0: number,
  r1: number,
  segs: number,
  radial: number,
  color: (t: number, ang: number, p: THREE.Vector3) => THREE.Color,
  twist = 0,
  bumpy = 0.12,
): void {
  const frames = curve.computeFrenetFrames(segs, false);
  const rings: THREE.Vector3[][] = [];
  const norms: THREE.Vector3[][] = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const c = curve.getPointAt(t);
    const N = frames.normals[i]!;
    const B = frames.binormals[i]!;
    const rad = THREE.MathUtils.lerp(r0, r1, Math.pow(t, 0.8));
    const ring: THREE.Vector3[] = [];
    const nr: THREE.Vector3[] = [];
    for (let k = 0; k < radial; k++) {
      const a = (k / radial) * Math.PI * 2 + t * twist;
      const dir = N.clone().multiplyScalar(Math.cos(a)).addScaledVector(B, Math.sin(a));
      const bump = 1 + (vnoise3(c.x * 0.8 + Math.cos(a) * 2, c.y * 0.6, c.z * 0.8 + Math.sin(a) * 2) - 0.5) * bumpy * 2;
      // bark ridges
      const ridge = 1 + Math.pow(Math.abs(Math.sin(a * 3 + t * twist * 2)), 6) * 0.08;
      ring.push(c.clone().addScaledVector(dir, rad * bump * ridge));
      nr.push(dir);
    }
    rings.push(ring);
    norms.push(nr);
  }
  for (let i = 0; i < segs; i++) {
    for (let k = 0; k < radial; k++) {
      const k2 = (k + 1) % radial;
      const a = rings[i]![k]!;
      const bb = rings[i]![k2]!;
      const c = rings[i + 1]![k]!;
      const d = rings[i + 1]![k2]!;
      const na = norms[i]![k]!;
      const nb = norms[i]![k2]!;
      const nc = norms[i + 1]![k]!;
      const nd = norms[i + 1]![k2]!;
      const ca = color(i / segs, (k / radial) * 6.28, a);
      const cb = color(i / segs, (k2 / radial) * 6.28, bb);
      const cc = color((i + 1) / segs, (k / radial) * 6.28, c);
      const cd = color((i + 1) / segs, (k2 / radial) * 6.28, d);
      b.pos.push(a.x, a.y, a.z, c.x, c.y, c.z, bb.x, bb.y, bb.z, bb.x, bb.y, bb.z, c.x, c.y, c.z, d.x, d.y, d.z);
      for (const n of [na, nc, nb, nb, nc, nd]) b.nor.push(n.x, n.y, n.z);
      for (const cl of [ca, cc, cb, cb, cc, cd]) b.col.push(cl.r, cl.g, cl.b);
    }
  }
}

const _barkC = new THREE.Color();

// ---------------------------------------------------------------- roots & undersides

/** Hanging root strand from a rim point, swaying down and inward. */
export function hangingRoot(b: Bucket, r: () => number, x: number, y: number, z: number, len: number, inward: THREE.Vector2, r0 = 0.22): void {
  const pts: THREE.Vector3[] = [];
  const segs = 5;
  let px = x;
  let pz = z;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    px += (r() - 0.5) * len * 0.12 + inward.x * len * 0.04;
    pz += (r() - 0.5) * len * 0.12 + inward.y * len * 0.04;
    pts.push(new THREE.Vector3(px, y - t * len, pz));
  }
  taperedTube(
    b,
    new THREE.CatmullRomCurve3(pts),
    r0,
    0.02,
    8,
    5,
    (t) => _barkC.copy(PAL.root).lerp(PAL.rockDeep, t * 0.5).clone(),
    0,
    0.2,
  );
}

/**
 * Island underside: chunky inverted mass hung from an outline, stepped strata
 * ledges, lobed stalactite spires, darkening with depth.
 * `outline(theta)` returns rim radius from (cx,cz).
 */
export function islandUnderside(
  b: Bucket,
  cx: number,
  cz: number,
  topY: number,
  outline: (theta: number) => number,
  depth: number,
  seed: number,
  radial = 96,
): void {
  // ring profile: [depth fraction, radius fraction]; pairs create overhanging strata ledges
  const prof: Array<[number, number]> = [
    [0.0, 1.0],
    [0.025, 1.01],
    [0.05, 0.965],
    [0.09, 0.95],
    [0.12, 0.9],
    [0.18, 0.88],
    [0.22, 0.8],
    [0.3, 0.76],
    [0.36, 0.64],
    [0.46, 0.58],
    [0.55, 0.44],
    [0.66, 0.34],
    [0.78, 0.2],
    [0.9, 0.09],
    [1.0, 0.0],
  ];
  const rings: THREE.Vector3[][] = [];
  const cols: THREE.Color[][] = [];
  for (let j = 0; j < prof.length; j++) {
    const [df, rf] = prof[j]!;
    const ring: THREE.Vector3[] = [];
    const cr: THREE.Color[] = [];
    for (let i = 0; i < radial; i++) {
      const th = (i / radial) * Math.PI * 2;
      const R = outline(th);
      // lobes: some angular sectors hang much deeper (stalactite masses)
      const lobe = Math.pow(fbm3(Math.cos(th) * 2.2 + seed, Math.sin(th) * 2.2, seed * 0.3, 3), 2.2);
      const dd = df * depth * (0.55 + lobe * 1.25);
      const jag = 1 + (vnoise3(Math.cos(th) * 6 + seed, df * 9, Math.sin(th) * 6) - 0.5) * 0.18 * Math.min(1, df * 6);
      const rr = R * rf * jag * (df > 0.5 ? 0.8 + lobe * 0.5 : 1);
      ring.push(new THREE.Vector3(cx + Math.cos(th) * rr, topY - dd, cz + Math.sin(th) * rr));
      const c = new THREE.Color();
      const band = Math.floor(dd / 2.2 + vnoise3(Math.cos(th) * 3, df, Math.sin(th) * 3) * 0.8);
      const k = hash3(band, seed, 2);
      c.copy(k < 0.33 ? PAL.rockB : k < 0.66 ? PAL.rockA : PAL.rockC);
      c.lerp(PAL.rockDeep, Math.min(1, df * 1.5) * 0.85);
      if (j < 2) c.copy(PAL.soilTop).lerp(PAL.rockA, j * 0.5);
      c.multiplyScalar(0.85 + vnoise3(th * 8, dd * 0.7, seed) * 0.3);
      cr.push(c);
    }
    rings.push(ring);
    cols.push(cr);
  }
  const n = new THREE.Vector3();
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  for (let j = 0; j < rings.length - 1; j++) {
    for (let i = 0; i < radial; i++) {
      const i2 = (i + 1) % radial;
      const a = rings[j]![i]!;
      const bb = rings[j]![i2]!;
      const c = rings[j + 1]![i]!;
      const d = rings[j + 1]![i2]!;
      e1.subVectors(c, a);
      e2.subVectors(bb, a);
      n.crossVectors(e2, e1).normalize();
      // outward-facing winding (normals point away from axis)
      b.tri(a, bb, c, n, cols[j]![i]!, cols[j]![i2]!, cols[j + 1]![i]!);
      e1.subVectors(c, bb);
      e2.subVectors(d, bb);
      n.crossVectors(e2, e1).normalize();
      b.tri(bb, d, c, n, cols[j]![i2]!, cols[j + 1]![i2]!, cols[j + 1]![i]!);
    }
  }
}

/** Small inverted spire hanging under an island (extra chunk). */
export function hangingSpire(b: Bucket, x: number, y: number, z: number, r: number, len: number, seed: number): void {
  const geo = merged(new THREE.ConeGeometry(r, len, 9, 6));
  const p = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = fbm3(v.x * 0.6 + seed, v.y * 0.4, v.z * 0.6, 3);
    const band = Math.floor(v.y / 1.6);
    const k = 0.8 + n * 0.5 + (hash3(band, seed, 1) - 0.5) * 0.25;
    v.x *= k;
    v.z *= k;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.rotateX(Math.PI); // point down
  geo.computeVertexNormals();
  paint(geo, (q, _n, out) => {
    const band = Math.floor(q.y / 1.8);
    const k = hash3(band, seed, 4);
    out.copy(k < 0.5 ? PAL.rockA : PAL.rockC).lerp(PAL.rockDeep, THREE.MathUtils.clamp(-q.y / len + 0.5, 0, 1) * 0.8);
  });
  b.add(geo, trs(x, y - len / 2, z, seed));
  geo.dispose();
}

/** Walkable ground cap on a slab top (litter-textured ground material), inset from the chipped rim. */
export function groundCap(b: Bucket, s: RockSpec, color: THREE.Color, inset = 0.5, leafy?: (x: number, z: number) => number): void {
  let geo: THREE.BufferGeometry;
  if (s.round) {
    geo = new THREE.CircleGeometry(Math.max(0.3, s.w / 2 - inset), Math.max(12, Math.round(s.w * 2)));
  } else {
    geo = new THREE.PlaneGeometry(Math.max(0.3, s.w - inset * 2), Math.max(0.3, s.d - inset * 2), Math.max(1, Math.round(s.w / 1.2)), Math.max(1, Math.round(s.d / 1.2)));
  }
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position as THREE.BufferAttribute;
  const cols: number[] = [];
  const lf: number[] = [];
  const c = new THREE.Color();
  const cy = Math.cos(s.yaw ?? 0);
  const sy = Math.sin(s.yaw ?? 0);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) * cy + p.getZ(i) * sy + s.x;
    const z = -p.getX(i) * sy + p.getZ(i) * cy + s.z;
    lf.push(leafy ? leafy(x, z) : 0.4);
    p.setY(i, 0.03);
    if (!s.round) {
      // match rockSlab's irregular corner rounding (plus margin) so the cap never overhangs
      const hw = s.w / 2;
      const hd = s.d / 2;
      let vx = p.getX(i);
      let vz = p.getZ(i);
      if (Math.abs(vx) > hw * 0.5 && Math.abs(vz) > hd * 0.5) {
        const kx = (Math.abs(vx) - hw * 0.5) / (hw * 0.5);
        const kz = (Math.abs(vz) - hd * 0.5) / (hd * 0.5);
        const cut = Math.max(0, Math.min(kx, kz)) * Math.min(hw, hd) * 0.5;
        vx -= Math.sign(vx) * cut;
        vz -= Math.sign(vz) * cut;
        p.setX(i, vx);
        p.setZ(i, vz);
      }
    }
    c.copy(color).lerp(PAL.soilUmber, vnoise3(x * 0.3, 1, z * 0.3) * 0.4).multiplyScalar(1.0 + vnoise3(x, 2, z) * 0.16);
    cols.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  geo.setAttribute('leafy', new THREE.Float32BufferAttribute(lf, 1));
  // flat up normals: corner cuts can collapse triangles, and a zero normal → NaN → bloom blackout
  const nrm = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) nrm[i * 3 + 1] = 1;
  geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  b.add(geo, trs(s.x, s.top, s.z, s.yaw ?? 0));
  geo.dispose();
}
