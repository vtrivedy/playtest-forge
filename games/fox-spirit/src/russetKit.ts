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
  rockA: new THREE.Color(0x6a5242),
  rockB: new THREE.Color(0x87684c),
  rockC: new THREE.Color(0x4c3a2e),
  rockDeep: new THREE.Color(0x3a2e24),
  soilTop: new THREE.Color(0x8a5a32),
  grassGold: new THREE.Color(0xc9a04a),
  grassDry: new THREE.Color(0xa88a4a),
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
};

export const LEAF_COLORS = [PAL.russet, PAL.maple, PAL.amber, PAL.gold, PAL.copper, PAL.crimson, PAL.leafBrown];

// ---------------------------------------------------------------- bucket

/** Accumulates non-indexed triangles (position/normal/color) for one material. */
export class Bucket {
  pos: number[] = [];
  nor: number[] = [];
  col: number[] = [];
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
    }
    if (g !== geo) g.dispose();
  }

  /** Raw triangle push (world space). */
  tri(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, n: THREE.Vector3, ca: THREE.Color, cb = ca, cc = ca): void {
    this.pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    for (let i = 0; i < 3; i++) this.nor.push(n.x, n.y, n.z);
    this.col.push(ca.r, ca.g, ca.b, cb.r, cb.g, cb.b, cc.r, cc.g, cc.b);
  }

  toMesh(material: THREE.Material, opts: { cast?: boolean; receive?: boolean; planarUV?: number } = {}): THREE.Mesh | null {
    if (!this.pos.length) return null;
    const geo = new THREE.BufferGeometry();
    if (opts.planarUV) {
      const uv: number[] = [];
      for (let i = 0; i < this.pos.length; i += 3) uv.push(this.pos[i]! / opts.planarUV, this.pos[i + 2]! / opts.planarUV);
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    }
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
  /** side bulge (m) */
  rough?: number;
  seed?: number;
  /** top-face colour (grass/litter) or null for bare stone tops */
  topColor?: THREE.Color | null;
  round?: boolean;
};

/**
 * Chunky rock slab with horizontal strata ledges and a chipped lip.
 * The walkable top stays flat (collision matches); sides bulge outward with stepped bands.
 */
export function rockSlab(b: Bucket, s: RockSpec): void {
  const h = s.top - s.bottom;
  const rough = s.rough ?? 0.55;
  const seed = s.seed ?? 1;
  let geo: THREE.BufferGeometry;
  if (s.round) {
    const r = s.w / 2;
    const radial = Math.max(22, Math.round(r * 3.2));
    geo = new THREE.CylinderGeometry(r, r * 0.92, h, radial, Math.max(2, Math.round(h / 0.55)), false);
  } else {
    geo = new THREE.BoxGeometry(
      s.w,
      h,
      s.d,
      Math.max(2, Math.round(s.w / 1.7)),
      Math.max(2, Math.round(h / 0.55)),
      Math.max(2, Math.round(s.d / 1.7)),
    );
  }
  geo = merged(geo);
  const p = geo.attributes.position as THREE.BufferAttribute;
  const hw = s.w / 2;
  const hd = s.d / 2;
  const hh = h / 2;
  const v = new THREE.Vector3();
  const dir = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const yWorld = v.y + hh + s.bottom;
    const isTop = v.y > hh - 0.01;
    // outward direction
    if (s.round) {
      const rad = Math.hypot(v.x, v.z);
      if (rad > (s.w / 2) * 0.88) dir.set(v.x / rad, 0, v.z / rad);
      else dir.set(0, 0, 0);
    } else {
      dir.set(Math.abs(v.x) > hw - 0.01 ? Math.sign(v.x) : 0, 0, Math.abs(v.z) > hd - 0.01 ? Math.sign(v.z) : 0);
      if (dir.lengthSq() > 0) dir.normalize();
    }
    const onSide = dir.lengthSq() > 0;
    const nx = v.x + s.x * 0.37 + seed * 13.1;
    const nz = v.z + s.z * 0.37;
    if (isTop) {
      // flat walk surface; chip the very rim slightly down
      if (onSide) {
        const chip = vnoise3(nx * 1.7, 3.3, nz * 1.7);
        v.y -= chip * 0.28;
        v.addScaledVector(dir, (chip - 0.35) * rough * 0.6);
      } else {
        v.y += (vnoise3(nx * 0.8, 0, nz * 0.8) - 0.5) * 0.06;
      }
    } else if (onSide) {
      // strata: stepped ledges every ~1.1 m, plus a slow wobble so cliffs never read as box faces
      const band = Math.floor((yWorld + seed * 0.37) / 1.15);
      const bandOff = (hash3(band, seed, 7) - 0.45) * rough * 1.6;
      const wob = (fbm3(nx * 0.11, band * 0.21 + seed, nz * 0.11, 2) - 0.5) * rough * 3.2;
      // lumpy within the band, constant vertically → horizontal ledges, not vertical flutes
      const n = fbm3(nx * 0.18, band * 0.9 + seed, nz * 0.18, 2);
      const inBand = ((yWorld + seed * 0.37) / 1.15) % 1;
      const lip = inBand > 0.75 ? (inBand - 0.75) * rough * 1.2 : 0; // overhanging band tops
      v.addScaledVector(dir, bandOff + wob + (n - 0.45) * rough * 0.35 + lip);
      v.y += (vnoise3(nx * 0.7, yWorld * 1.3, nz * 0.7) - 0.5) * 0.18;
    }
    // round the box corners off (irregular), so slabs read as rock not crates
    if (!s.round && Math.abs(v.x) > hw * 0.55 && Math.abs(v.z) > hd * 0.55) {
      const kx = (Math.abs(v.x) - hw * 0.55) / (hw * 0.45);
      const kz = (Math.abs(v.z) - hd * 0.55) / (hd * 0.45);
      const cut = Math.max(0, Math.min(kx, kz)) * Math.min(hw, hd) * (0.18 + hash3(Math.sign(v.x), Math.sign(v.z), seed) * 0.25);
      v.x -= Math.sign(v.x) * cut;
      v.z -= Math.sign(v.z) * cut;
    }
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  const topC = s.topColor === undefined ? PAL.soilTop : s.topColor;
  paint(geo, (q, n, out) => {
    const yWorld = q.y + hh + s.bottom;
    const band = Math.floor((yWorld + seed * 0.37) / 1.15);
    const k = hash3(band, seed, 3);
    out.copy(k < 0.33 ? PAL.rockA : k < 0.66 ? PAL.rockB : PAL.rockC);
    // darker toward the bottom, dusty ledge tops, horizontal grain
    const depth = THREE.MathUtils.clamp((s.top - yWorld) / 14, 0, 1);
    out.lerp(PAL.rockDeep, depth * 0.6);
    if (n.y > 0.25 && n.y <= 0.55) out.lerp(PAL.rockB.clone().multiplyScalar(1.25), 0.5);
    const grain = vnoise3(q.x * 0.35 + s.x, yWorld * 5.5, q.z * 0.35 + s.z);
    const inBand = ((yWorld + seed * 0.37) / 1.15) % 1;
    out.multiplyScalar((0.8 + grain * 0.3) * (inBand < 0.18 ? 0.78 : 1));
    if (n.y > 0.55 && topC) {
      const t = THREE.MathUtils.smoothstep(n.y, 0.55, 0.85);
      const tc = topC.clone().offsetHSL(0, 0, (vnoise3(q.x * 0.5, 0, q.z * 0.5) - 0.5) * 0.08);
      out.lerp(tc, t);
    }
  });
  b.add(geo, trs(s.x, s.bottom + hh, s.z, s.yaw ?? 0));
  geo.dispose();
}

/** Lumpy boulder (dressing). */
export function boulder(b: Bucket, x: number, y: number, z: number, r: number, seed: number, flat = 0.7): void {
  const geo = merged(new THREE.IcosahedronGeometry(r, 2));
  const p = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = fbm3(v.x * 1.3 / r + seed, v.y * 1.3 / r, v.z * 1.3 / r, 3);
    v.multiplyScalar(0.75 + n * 0.5);
    v.y *= flat;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  paint(geo, (q, n, out) => {
    out.copy(PAL.rockB).lerp(PAL.rockA, vnoise3(q.x * 2 + seed, q.y * 2, q.z * 2));
    if (n.y > 0.6) out.lerp(PAL.moss, 0.35);
    out.multiplyScalar(0.85 + 0.25 * vnoise3(q.x * 5, q.y * 5, q.z * 5 + seed));
  });
  b.add(geo, trs(x, y, z, seed * 2.1));
  geo.dispose();
}

// ---------------------------------------------------------------- ruins (weathered stone)

/** One chipped stone block (local centre at origin). */
export function stoneBlock(b: Bucket, m: THREE.Matrix4, w: number, h: number, d: number, seed: number, chip = 0.12): void {
  const geo = merged(new THREE.BoxGeometry(w, h, d, 1, 1, 1));
  const p = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  const r = rng(seed * 7919 + 13);
  const cornerChip = [r(), r(), r(), r(), r(), r(), r(), r()];
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const isCorner = Math.abs(v.x) > w / 2 - 0.01 && Math.abs(v.y) > h / 2 - 0.01 && Math.abs(v.z) > d / 2 - 0.01;
    const n = vnoise3(v.x * 3 + seed, v.y * 3, v.z * 3);
    const s = 1 - (n - 0.5) * chip * 0.6;
    v.x *= s;
    v.z *= s;
    if (isCorner) {
      const ci = (v.x > 0 ? 1 : 0) + (v.y > 0 ? 2 : 0) + (v.z > 0 ? 4 : 0);
      const c = cornerChip[ci]! > 0.6 ? chip * 1.1 : chip * 0.35;
      v.x -= Math.sign(v.x) * c;
      v.y -= Math.sign(v.y) * c * 0.25;
      v.z -= Math.sign(v.z) * c;
    }
    p.setXYZ(i, v.x, v.y, v.z);
  }
  // flat-ish shading via non-indexed normals reads as cut stone
  const g2 = geo.toNonIndexed();
  g2.computeVertexNormals();
  const base = PAL.stone.clone().offsetHSL(0, (r() - 0.5) * 0.04, (r() - 0.5) * 0.08);
  paint(g2, (q, n, out) => {
    out.copy(base);
    const wq = q.clone().applyMatrix4(m);
    const lich = vnoise3(wq.x * 1.6, wq.y * 1.6, wq.z * 1.6);
    if (lich > 0.62) out.lerp(PAL.stoneLichen, (lich - 0.62) * 1.6);
    if (n.y < -0.3) out.lerp(PAL.stoneDark, 0.45);
    out.multiplyScalar(0.88 + 0.22 * vnoise3(wq.x * 6, wq.y * 6, wq.z * 6));
  });
  b.add(g2, m);
  geo.dispose();
  g2.dispose();
}

/** Ruined arch: block pillars + voussoir ring, optionally broken on one side. */
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
  const base = trs(x, y, z, yaw);
  const bw = 0.82;
  const bh = 0.62;
  for (const side of [-1, 1]) {
    const px = (side * (span + bw)) / 2;
    const n = Math.ceil(ph / bh);
    const lose = side === 1 ? Math.floor(broken * n * 0.6) : 0;
    // plinth
    stoneBlock(b, base.clone().multiply(trs(px, 0.2, 0, 0)), bw * 1.25, 0.4, bw * 1.25, seed + side * 3, 0.1);
    for (let i = 0; i < n - lose; i++) {
      const jitter = trs(px + (r() - 0.5) * 0.06, 0.4 + bh * (i + 0.5), (r() - 0.5) * 0.06, (r() - 0.5) * 0.08);
      stoneBlock(b, base.clone().multiply(jitter), bw, bh * 1.02, bw, seed * 31 + i + side * 100, 0.1);
    }
    if (lose > 0) {
      // fallen blocks at the foot
      for (let k = 0; k < lose; k++) {
        const fx = px + side * (0.9 + r() * 1.6);
        const fz = (r() - 0.5) * 2.2;
        stoneBlock(b, base.clone().multiply(trs(fx, bh * 0.45, fz, r() * 3, 1, 1, 1, (r() - 0.5) * 0.5, (r() - 0.5) * 0.4)), bw, bh, bw, seed + 900 + k, 0.16);
      }
    }
  }
  // arch ring
  const R = (span + bw) / 2;
  const springY = 0.4 + Math.ceil(ph / bh) * bh;
  const vous = 11;
  const skipFrom = broken > 0 ? Math.floor(vous * (1 - broken * 0.7)) : vous;
  for (let i = 0; i < vous; i++) {
    if (i >= skipFrom) continue;
    const a0 = (i / vous) * Math.PI;
    const a1 = ((i + 1) / vous) * Math.PI;
    const am = (a0 + a1) / 2;
    const pointedLift = o.pointed ? Math.sin(am) * Math.sin(am) * 0.55 * R : 0;
    const cx = -Math.cos(am) * R;
    const cy = springY + Math.sin(am) * R * 1.02 + pointedLift;
    const len = R * (a1 - a0) * 1.06;
    const m = base.clone().multiply(trs(cx, cy, 0, 0, 1, 1, 1, 0, Math.PI / 2 - am));
    stoneBlock(b, m, len, bw * 0.95, bw * 0.95, seed * 53 + i, 0.08);
  }
  if (broken < 0.3) {
    // keystone cap
    stoneBlock(b, base.clone().multiply(trs(0, springY + R * 1.05 + (o.pointed ? 0.55 * R : 0) + 0.45, 0)), bw * 1.2, 0.5, bw * 1.1, seed + 77, 0.12);
  }
}

/** Broken column of stacked drums. */
export function ruinColumn(b: Bucket, x: number, y: number, z: number, h: number, seed: number, r0 = 0.42): void {
  const r = rng(seed * 6007 + 3);
  stoneBlock(b, trs(x, y + 0.2, z, r()), r0 * 2.6, 0.4, r0 * 2.6, seed + 1, 0.12);
  const drums = Math.max(1, Math.round(h / 0.8));
  for (let i = 0; i < drums; i++) {
    const dh = h / drums;
    const geo = merged(new THREE.CylinderGeometry(r0 * 0.96, r0, dh * 0.97, 9, 1));
    const p = geo.attributes.position as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    for (let k = 0; k < p.count; k++) {
      v.fromBufferAttribute(p, k);
      const n = vnoise3(v.x * 4 + seed + i, v.y * 4, v.z * 4);
      const s = 1 - n * 0.12;
      v.x *= s;
      v.z *= s;
      if (i === drums - 1 && v.y > 0) v.y -= n * dh * 0.7; // broken top
      p.setXYZ(k, v.x, v.y, v.z);
    }
    const g2 = geo.toNonIndexed();
    g2.computeVertexNormals();
    paint(g2, (q, n, out) => {
      out.copy(PAL.stone).offsetHSL(0, 0, (hash3(i, seed, 1) - 0.5) * 0.08);
      if (vnoise3(q.x * 3 + x, q.y * 3 + i, q.z * 3) > 0.65) out.lerp(PAL.stoneLichen, 0.35);
      if (n.y < -0.3) out.lerp(PAL.stoneDark, 0.4);
    });
    b.add(g2, trs(x + (r() - 0.5) * 0.05, y + 0.4 + dh * (i + 0.5), z, r() * 3));
    geo.dispose();
    g2.dispose();
  }
}

/**
 * Stone stair flight running along local +Z from (x0,z0,y0) to (x1,z1,y1).
 * Visual steps; pair with a ramped box collider of the same footprint.
 */
export function stairFlight(
  b: Bucket,
  a: { x: number; z: number; y: number },
  c: { x: number; z: number; y: number },
  width: number,
  seed: number,
  o: { parapet?: boolean; missing?: number } = {},
): void {
  const dx = c.x - a.x;
  const dz = c.z - a.z;
  const len = Math.hypot(dx, dz);
  const yaw = Math.atan2(dx, dz);
  const rise = c.y - a.y;
  const steps = Math.max(2, Math.round(Math.abs(rise) / 0.34));
  const run = len / steps;
  const r = rng(seed * 31337 + 11);
  for (let i = 0; i < steps; i++) {
    const t = (i + 0.5) / steps;
    const top = a.y + rise * ((i + 1) / steps);
    const lowY = Math.min(a.y, c.y) - 0.6;
    const h = top - lowY;
    const lx = 0;
    const lz = -len / 2 + run * (i + 0.5);
    const cx = (a.x + c.x) / 2 + Math.sin(yaw) * lz + Math.cos(yaw) * lx;
    const cz = (a.z + c.z) / 2 + Math.cos(yaw) * lz - Math.sin(yaw) * lx;
    // each tread split into 2-3 stones so edges read chipped and uneven
    const pieces = width > 2.4 ? 3 : 2;
    for (let k = 0; k < pieces; k++) {
      if (o.missing && r() < o.missing && k !== 1) continue;
      const pw = width / pieces;
      const off = -width / 2 + pw * (k + 0.5);
      const px = cx + Math.cos(yaw) * off;
      const pz = cz - Math.sin(yaw) * off;
      const m = trs(px, lowY + h / 2 - (r() * 0.04), pz, yaw + (r() - 0.5) * 0.05);
      stoneBlock(b, m, pw * 0.97, h, run * 1.02, seed * 97 + i * 7 + k, 0.09);
    }
    void t;
  }
  if (o.parapet) {
    for (const side of [-1, 1]) {
      for (let i = 0; i < steps; i += 2) {
        if (r() < 0.3) continue;
        const lz = -len / 2 + run * (i + 1);
        const top = a.y + rise * ((i + 1) / steps);
        const ox = side * (width / 2 + 0.22);
        const px = (a.x + c.x) / 2 + Math.sin(yaw) * lz + Math.cos(yaw) * ox;
        const pz = (a.z + c.z) / 2 + Math.cos(yaw) * lz - Math.sin(yaw) * ox;
        stoneBlock(b, trs(px, top + 0.35, pz, yaw), 0.4, 0.7 + r() * 0.4, run * 2, seed + i * 3 + side, 0.12);
      }
    }
  }
}

/**
 * Domed shrine (key art, right side): stepped plinth, four columns, entablature,
 * ribbed dome and finial. Carved glyph inlays go in `glow` bucket.
 */
export function domedShrine(stone: Bucket, glow: Bucket, x: number, y: number, z: number, scale: number, seed: number): void {
  const S = scale;
  const at = (lx: number, ly: number, lz: number, yaw = 0, sx = 1, sy = 1, sz = 1) =>
    trs(x + lx * S, y + ly * S, z + lz * S, yaw, sx * S, sy * S, sz * S);
  // stepped plinth
  stoneBlock(stone, at(0, 0.2, 0), 4.6, 0.4, 4.6, seed, 0.1);
  stoneBlock(stone, at(0, 0.6, 0), 4.0, 0.4, 4.0, seed + 1, 0.1);
  stoneBlock(stone, at(0, 1.0, 0), 3.4, 0.4, 3.4, seed + 2, 0.08);
  // columns
  for (const [cx, cz] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]] as const) {
    for (let i = 0; i < 4; i++) stoneBlock(stone, at(cx, 1.45 + i * 0.6, cz, i * 0.4), 0.46, 0.58, 0.46, seed * 11 + i + cx * 7 + cz * 3, 0.06);
    stoneBlock(stone, at(cx, 3.95, cz), 0.66, 0.2, 0.66, seed + 40, 0.05);
  }
  // inner altar with ember basin
  stoneBlock(stone, at(0, 1.6, 0), 0.9, 0.8, 0.9, seed + 50, 0.08);
  {
    const ring = new THREE.TorusGeometry(0.32, 0.07, 6, 18);
    ring.rotateX(Math.PI / 2);
    glow.add(ring, at(0, 2.05, 0), PAL.amber);
    ring.dispose();
    const ember = new THREE.IcosahedronGeometry(0.2, 1);
    glow.add(ember, at(0, 2.2, 0), PAL.copper);
    ember.dispose();
  }
  // entablature
  stoneBlock(stone, at(0, 4.25, 0), 3.5, 0.42, 3.5, seed + 60, 0.08);
  stoneBlock(stone, at(0, 4.6, 0), 3.0, 0.3, 3.0, seed + 61, 0.06);
  // glyph band (leaf glyphs) on the frieze, four faces
  for (let f = 0; f < 4; f++) {
    const yaw = (f * Math.PI) / 2;
    for (let k = -1; k <= 1; k++) {
      const lx = Math.cos(yaw) * k * 0.9 + Math.sin(yaw) * 1.77;
      const lz = -Math.sin(yaw) * k * 0.9 + Math.cos(yaw) * 1.77;
      const leaf = leafShape(0.28, 0.36);
      glow.add(leaf, at(lx, 4.25, lz, yaw, 1, 1, 1).multiply(new THREE.Matrix4().makeRotationX(0)), PAL.amber);
      leaf.dispose();
    }
  }
  // dome: lathe with slight ogee, ribbed
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const a = (t * Math.PI) / 2;
    const r = Math.cos(a) * 1.45 * (1 - 0.12 * Math.sin(t * Math.PI));
    pts.push(new THREE.Vector2(Math.max(0.02, r), Math.sin(a) * 1.55));
  }
  const dome = new THREE.LatheGeometry(pts, 16);
  const dp = dome.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < dp.count; i++) {
    v.fromBufferAttribute(dp, i);
    const ang = Math.atan2(v.z, v.x);
    const rib = Math.pow(Math.abs(Math.cos(ang * 4)), 8) * 0.06;
    const n = vnoise3(v.x * 3 + seed, v.y * 3, v.z * 3) * 0.08;
    const k = 1 + rib - n;
    v.x *= k;
    v.z *= k;
    dp.setXYZ(i, v.x, v.y, v.z);
  }
  dome.computeVertexNormals();
  paint(dome, (q, n, out) => {
    out.copy(PAL.stone).lerp(PAL.stoneDark, 0.15);
    const l = vnoise3(q.x * 2 + seed, q.y * 2, q.z * 2);
    if (l > 0.58) out.lerp(PAL.stoneLichen, (l - 0.58) * 1.8);
    out.multiplyScalar(0.9 + 0.2 * vnoise3(q.x * 7, q.y * 7, q.z * 7));
  });
  stone.add(dome, at(0, 4.75, 0));
  dome.dispose();
  // finial: drum, ball, spike
  stoneBlock(stone, at(0, 6.4, 0), 0.5, 0.3, 0.5, seed + 70, 0.05);
  const ball = new THREE.SphereGeometry(0.32, 10, 8);
  paint(ball, (_q, _n, out) => out.copy(PAL.stone));
  stone.add(ball, at(0, 6.85, 0));
  ball.dispose();
  const spike = new THREE.ConeGeometry(0.12, 0.7, 6);
  paint(spike, (_q, _n, out) => out.copy(PAL.stoneDark));
  stone.add(spike, at(0, 7.45, 0));
  spike.dispose();
}

/** Seedwell: octagonal carved basin, three standing glyph stones and a small cap. */
export function seedwell(stone: Bucket, glow: Bucket, x: number, y: number, z: number, seed: number): void {
  const r = rng(seed * 811 + 5);
  // basin ring of 8 blocks
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    stoneBlock(stone, trs(x + Math.cos(a) * 1.5, y + 0.35, z + Math.sin(a) * 1.5, -a + Math.PI / 2), 1.25, 0.7, 0.45, seed * 13 + i, 0.08);
  }
  stoneBlock(stone, trs(x, y + 0.1, z), 2.6, 0.2, 2.6, seed + 99, 0.05);
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
    stoneBlock(stone, trs(sx, y + h / 2, sz, yaw, 1, 1, 1, (r() - 0.5) * 0.12, (r() - 0.5) * 0.12), 0.75, h, 0.45, seed * 7 + k, 0.14);
    const leaf = leafShape(0.26, 0.4);
    glow.add(leaf, trs(sx + Math.sin(yaw) * 0.24, y + h * 0.62, sz + Math.cos(yaw) * 0.24, yaw), PAL.amber);
    leaf.dispose();
  }
}

/** Checkpoint lantern: stone post with a hooded lamp (lamp face in glow bucket). */
export function lanternPost(stone: Bucket, glow: Bucket, x: number, y: number, z: number, seed: number): void {
  stoneBlock(stone, trs(x, y + 0.15, z), 0.8, 0.3, 0.8, seed, 0.08);
  stoneBlock(stone, trs(x, y + 0.95, z), 0.32, 1.3, 0.32, seed + 1, 0.06);
  stoneBlock(stone, trs(x, y + 1.75, z), 0.62, 0.3, 0.62, seed + 2, 0.05);
  const lamp = new THREE.BoxGeometry(0.4, 0.38, 0.4);
  glow.add(lamp, trs(x, y + 2.08, z), PAL.amber);
  lamp.dispose();
  const roof = new THREE.ConeGeometry(0.52, 0.42, 4);
  paint(roof, (_q, _n, out) => out.copy(PAL.stoneDark));
  stone.add(roof, trs(x, y + 2.47, z, Math.PI / 4));
  roof.dispose();
}

// ---------------------------------------------------------------- leaves

/** Flat maple-ish leaf polygon in XY plane, pointing +Y. */
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

const _leafProto = leafShape(1, 1).toNonIndexed();
const _diamond = (() => {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, -0.5, 0, 0.4, 0, 0, 0, 0.5, 0, 0, -0.5, 0, 0, 0.5, 0, -0.4, 0, 0], 3));
  return g;
})();

/**
 * Leaf card appended directly (fast path). Normal `n` is the shading normal
 * (up for litter, radial for shrubs/crowns — gives soft volumetric shading).
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
  detailed = false,
): void {
  const proto = detailed ? _leafProto : _diamond;
  const p = proto.attributes.position as THREE.BufferAttribute;
  const m = trs(x, y, z, yaw, size, size, size, pitch, roll);
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).applyMatrix4(m);
    b.pos.push(v.x, v.y, v.z);
    b.nor.push(n.x, n.y, n.z);
    b.col.push(color.r, color.g, color.b);
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
    c.copy(palette[Math.floor(r() * palette.length)]!).offsetHSL((r() - 0.5) * 0.02, 0.05, (r() - 0.5) * 0.12 - 0.06);
    c.multiplyScalar(0.72);
    pushLeaf(b, x, y + 0.025 + r() * 0.04, z, 0.14 + r() * 0.16, r() * 6.28, -Math.PI / 2 + (r() - 0.5) * 0.7, (r() - 0.5) * 0.7, c, UP, r() < 0.18);
  }
}

/** Low red/orange shrub: a dome of leaf cards with radial normals. */
export function shrub(b: Bucket, r: () => number, x: number, y: number, z: number, size: number, hue: THREE.Color): void {
  const n = Math.round(10 + size * 16);
  const c = new THREE.Color();
  const nn = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const u = r() * Math.PI * 2;
    const v = Math.acos(1 - r() * 0.95); // upper hemisphere bias
    const sx = Math.sin(v) * Math.cos(u);
    const sy = Math.cos(v);
    const sz = Math.sin(v) * Math.sin(u);
    const rr = size * (0.55 + r() * 0.45);
    nn.set(sx, sy + 0.35, sz).normalize();
    c.copy(hue).offsetHSL((r() - 0.5) * 0.04, (r() - 0.5) * 0.1, (r() - 0.5) * 0.14 + (sy - 0.5) * 0.08);
    pushLeaf(b, x + sx * rr * 1.2, y + sy * rr * 0.75 + 0.05, z + sz * rr * 1.2, 0.2 + r() * 0.16 + size * 0.08, u, -v * 0.8, r() * 6.28, c, nn);
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
function barkColor(_t: number, ang: number, p: THREE.Vector3): THREE.Color {
  const n = vnoise3(p.x * 1.4 + ang, p.y * 0.5, p.z * 1.4);
  _barkC.copy(PAL.bark).lerp(PAL.barkLight, n * 0.6);
  if (vnoise3(p.x * 0.6, p.y * 0.9 + 3, p.z * 0.6) > 0.66) _barkC.lerp(PAL.moss, 0.3);
  return _barkC.clone();
}

export type MapleOpts = {
  height: number;
  trunkR: number;
  lean?: number;
  crownR?: number;
  leaf: THREE.Color;
  seed: number;
  /** extra canopy clusters per branch */
  density?: number;
  /** skip crown clusters within these spheres (keep route clear) */
  avoid?: Array<{ x: number; y: number; z: number; r: number }>;
};

/** Twisted maple with root buttresses, branches and lumpy leaf crowns (key-art tree). */
export function maple(bark: Bucket, leaves: Bucket, x: number, y: number, z: number, o: MapleOpts): void {
  const r = rng(o.seed * 2971 + 17);
  const H = o.height;
  const lean = o.lean ?? 0.12;
  const la = r() * Math.PI * 2;
  const top = new THREE.Vector3(x + Math.cos(la) * H * lean, y + H * 0.72, z + Math.sin(la) * H * lean);
  const trunk = new THREE.CatmullRomCurve3([
    new THREE.Vector3(x, y - 0.4, z),
    new THREE.Vector3(x + Math.cos(la + 1.4) * H * 0.05, y + H * 0.25, z + Math.sin(la + 1.4) * H * 0.05),
    new THREE.Vector3(x + Math.cos(la) * H * lean * 0.5, y + H * 0.5, z + Math.sin(la) * H * lean * 0.5),
    top,
  ]);
  taperedTube(bark, trunk, o.trunkR, o.trunkR * 0.45, 10, 9, barkColor, 1.2, 0.16);
  // root buttresses
  const nr = 4 + Math.floor(r() * 3);
  for (let i = 0; i < nr; i++) {
    const a = (i / nr) * Math.PI * 2 + r() * 0.6;
    const reach = o.trunkR * (2.2 + r() * 1.6);
    const c = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x + Math.cos(a) * o.trunkR * 0.3, y + o.trunkR * 1.6, z + Math.sin(a) * o.trunkR * 0.3),
      new THREE.Vector3(x + Math.cos(a) * o.trunkR * 1.1, y + o.trunkR * 0.5, z + Math.sin(a) * o.trunkR * 1.1),
      new THREE.Vector3(x + Math.cos(a) * reach, y - 0.25, z + Math.sin(a) * reach),
    ]);
    taperedTube(bark, c, o.trunkR * 0.5, o.trunkR * 0.12, 5, 6, barkColor, 0, 0.1);
  }
  // branches + crowns
  const nb = 5 + Math.floor(r() * 3);
  const crownR = o.crownR ?? H * 0.22;
  const leafC = new THREE.Color();
  for (let i = 0; i < nb; i++) {
    const t = 0.55 + r() * 0.4;
    const start = trunk.getPointAt(Math.min(1, t));
    const a = (i / nb) * Math.PI * 2 + r() * 0.8;
    const len = H * (0.25 + r() * 0.22);
    const end = new THREE.Vector3(
      start.x + Math.cos(a) * len,
      start.y + len * (0.35 + r() * 0.4),
      start.z + Math.sin(a) * len,
    );
    const mid = start.clone().lerp(end, 0.5).add(new THREE.Vector3(0, -len * 0.08, 0));
    taperedTube(bark, new THREE.CatmullRomCurve3([start, mid, end]), o.trunkR * 0.42, o.trunkR * 0.12, 5, 6, barkColor, 0.5, 0.1);
    const cr = crownR * (0.55 + r() * 0.35);
    crownCluster(leaves, r, end, cr, o.leaf, leafC, o.avoid, o.density ?? 1);
    for (let k = 0; k < 2; k++) {
      const off = new THREE.Vector3((r() - 0.5) * cr * 1.8, (r() - 0.3) * cr * 0.9, (r() - 0.5) * cr * 1.8);
      crownCluster(leaves, r, end.clone().add(off), cr * (0.5 + r() * 0.3), o.leaf, leafC, o.avoid, o.density ?? 1);
    }
  }
  crownCluster(leaves, r, top.clone().add(new THREE.Vector3(0, crownR * 0.4, 0)), crownR * 1.1, o.leaf, leafC, o.avoid, o.density ?? 1);
}

function crownCluster(
  b: Bucket,
  r: () => number,
  c: THREE.Vector3,
  R: number,
  hue: THREE.Color,
  tmp: THREE.Color,
  avoid: MapleOpts['avoid'],
  density: number,
): void {
  if (avoid?.some((s) => Math.hypot(c.x - s.x, c.y - s.y, c.z - s.z) < s.r + R * 0.8)) return;
  // inner mass: lumpy blob so the crown has body (no see-through gaps)
  const blob = merged(new THREE.IcosahedronGeometry(R * 0.5, 1));
  const p = blob.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = fbm3(v.x / R * 1.6 + c.x, v.y / R * 1.6, v.z / R * 1.6 + c.z, 3);
    v.multiplyScalar(0.7 + n * 0.55);
    v.y *= 0.72;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  blob.computeVertexNormals();
  const base = hue.clone();
  paint(blob, (q, n, out) => {
    out.copy(base).multiplyScalar(0.42 + 0.2 * Math.max(0, n.y) + 0.12 * vnoise3(q.x, q.y, q.z));
  });
  b.add(blob, trs(c.x, c.y, c.z));
  blob.dispose();
  // fringe of leaf cards
  const count = Math.round(R * R * 6.5 * density);
  const nn = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    const u = r() * Math.PI * 2;
    const w = Math.acos(2 * r() - 1);
    nn.set(Math.sin(w) * Math.cos(u), Math.cos(w) * 0.72, Math.sin(w) * Math.sin(u));
    const rr = R * (0.45 + Math.pow(r(), 0.6) * 0.7);
    tmp.copy(hue).offsetHSL((r() - 0.5) * 0.05, (r() - 0.5) * 0.1, (r() - 0.5) * 0.16 + nn.y * 0.06);
    if (r() < 0.12) tmp.copy(LEAF_COLORS[Math.floor(r() * 4)]!);
    const n2 = nn.clone().normalize().add(new THREE.Vector3(0, 0.4, 0)).normalize();
    pushLeaf(b, c.x + nn.x * rr, c.y + nn.y * rr, c.z + nn.z * rr, 0.32 + r() * 0.3 + R * 0.05, u, r() * 6.28, r() * 6.28, tmp, n2);
  }
}

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
export function groundCap(b: Bucket, s: RockSpec, color: THREE.Color, inset = 1.0): void {
  let geo: THREE.BufferGeometry;
  if (s.round) {
    geo = new THREE.CircleGeometry(Math.max(0.3, s.w / 2 - inset), Math.max(12, Math.round(s.w * 2)));
  } else {
    geo = new THREE.PlaneGeometry(Math.max(0.3, s.w - inset * 2), Math.max(0.3, s.d - inset * 2), Math.max(1, Math.round(s.w / 2)), Math.max(1, Math.round(s.d / 2)));
  }
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position as THREE.BufferAttribute;
  const cols: number[] = [];
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + s.x;
    const z = p.getZ(i) + s.z;
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
    c.copy(color).lerp(PAL.leafBrown, vnoise3(x * 0.3, 1, z * 0.3) * 0.35).multiplyScalar(1.25 + vnoise3(x, 2, z) * 0.2);
    cols.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  // flat up normals: corner cuts can collapse triangles, and a zero normal → NaN → bloom blackout
  const nrm = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) nrm[i * 3 + 1] = 1;
  geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  b.add(geo, trs(s.x, s.top, s.z, s.yaw ?? 0));
  geo.dispose();
}
