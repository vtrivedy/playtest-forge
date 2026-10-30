import * as THREE from 'three';
import { createStylizedWater } from '../../../src/render';
import { CollisionWorld, boxCollider, cylCollider, type Collider } from './collision';
import {
  Bucket,
  PAL,
  LEAF_COLORS,
  rng,
  vnoise3,
  fbm3,
  trs,
  rockSlab,
  groundCap,
  type RockSpec,
  boulder,
  stoneBlock,
  ruinArch,
  ruinColumn,
  stairFlight,
  domedShrine,
  seedwell,
  lanternPost,
  litterPatch,
  shrub,
  pushLeaf,
  maple,
  hangingRoot,
  islandUnderside,
  hangingSpire,
  type MapleOpts,
} from './russetKit';

/**
 * Russetvale — World 1 realm (docs/design/world-1.md §2).
 * Floating bowl island 260×200 m: Arrival Meadow (S), Windmill Rise terraces (W),
 * Reedmarsh (E), Amberwood (centre-N), Wellspring Hill (far N).
 * +x east, −z north, units metres.
 */

export type RouteAct = 'jump' | 'jumpdash' | 'glide';
export type Waypoint = { x: number; y: number; z: number; act?: RouteAct; ground?: boolean; label?: string };

export type SeedwellState = {
  id: 'SW1' | 'SW2' | 'SW3';
  name: string;
  pos: THREE.Vector3;
  radius: number;
  lit: boolean;
  glow: THREE.MeshStandardMaterial;
  light: THREE.PointLight;
};

export type RealmEvent =
  | { type: 'seedwell'; index: number }
  | { type: 'bridge' }
  | { type: 'checkpoint'; index: number }
  | { type: 'ember'; value: number; index: number }
  | { type: 'wellspring' }
  | { type: 'hazard'; kind: 'ink' | 'fall' };

export type Realm = {
  group: THREE.Group;
  materials: THREE.MeshStandardMaterial[];
  collision: CollisionWorld;
  terrainY: (x: number, z: number) => number;
  spawnPos: THREE.Vector3;
  wellspringPos: THREE.Vector3;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  seedwells: SeedwellState[];
  checkpoints: Array<{ pos: THREE.Vector3; lit: boolean }>;
  respawnPos: () => THREE.Vector3;
  route: Waypoint[];
  emberTotal: number;
  /** Pickup spots (visuals live in the game's EmberMotes kit). */
  emberSpots: ReadonlyArray<{ p: THREE.Vector3; value: number }>;
  zoneAt: (x: number, z: number) => string;
  bridgeGrown: () => number;
  wellspringLit: () => boolean;
  /** Per-frame: animation + triggers. `colorAt` = ColorField saturation probe. */
  update: (dt: number, t: number, fox: THREE.Vector3, feetY: number, colorAt: (p: THREE.Vector3) => number) => RealmEvent[];
  /** Flood tween 0..1 (lone maple, wellspring glow) */
  setFlood: (k: number) => void;
};

// ---------------------------------------------------------------- island shape

const RX = 134;
const RZ = 104;

export function outlineR(th: number): number {
  const c = Math.cos(th);
  const s = Math.sin(th);
  const e = 1 / Math.sqrt((c / RX) ** 2 + (s / RZ) ** 2);
  const jag = 1 + 0.04 * Math.sin(5 * th + 0.7) + 0.025 * Math.sin(11 * th + 1.3) + 0.015 * Math.sin(23 * th + 0.2);
  return e * jag;
}

function insideIsland(x: number, z: number, margin = 0): boolean {
  return Math.hypot(x, z) <= outlineR(Math.atan2(z, x)) - margin;
}

const POND = { x: -18, z: 70, rx: 15, rz: 9, floor: -0.75, water: -0.22 };
const MARSH = { x: 78, z: 22, rx: 30, rz: 26, floor: -2, ink: -1.45 };

function marshE(x: number, z: number): number {
  return ((x - MARSH.x) / MARSH.rx) ** 2 + ((z - MARSH.z) / MARSH.rz) ** 2;
}

function smooth01(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/** Raw ground height (no void). */
function groundRaw(x: number, z: number): number {
  const meadowW = smooth01(10, 50, z); // rolling south, calmer north
  let h =
    0.35 +
    (0.55 * Math.sin(x * 0.08 + 1) * Math.cos(z * 0.07) + 0.28 * Math.sin(x * 0.19 + z * 0.11)) * (0.45 + meadowW * 0.6);
  h += (fbm3(x * 0.05, 0, z * 0.05, 2) - 0.5) * 0.6;
  // pond basin
  const pe = ((x - POND.x) / POND.rx) ** 2 + ((z - POND.z) / POND.rz) ** 2;
  h = THREE.MathUtils.lerp(h, POND.floor, smooth01(1.5, 0.75, pe));
  // marsh basin
  const me = marshE(x, z);
  h = THREE.MathUtils.lerp(h, MARSH.floor + (fbm3(x * 0.15, 1, z * 0.15, 2) - 0.5) * 0.3, smooth01(1.0, 0.8, me));
  return h;
}

// ---------------------------------------------------------------- windmill-rise terrace frame

const TO = { x: -48, z: 52 };
const TD = new THREE.Vector2(-0.684, -0.729).normalize();
const TN = new THREE.Vector2(-TD.y, TD.x); // (0.729, -0.684)
const T_YAW = Math.atan2(TD.x, TD.y);
const T_END = 82;

/** Terrace frame (s along the climb toward SW1, t lateral) → world xz. */
function sp(s: number, t: number): { x: number; z: number } {
  return { x: TO.x + TD.x * s + TN.x * t, z: TO.z + TD.y * s + TN.y * t };
}

// ---------------------------------------------------------------- build

export async function createRussetvale(scene: THREE.Scene): Promise<Realm> {
  const group = new THREE.Group();
  group.name = 'russetvale';
  scene.add(group);
  const r = rng(20261030);

  const terrainY = (x: number, z: number) => (insideIsland(x, z) ? groundRaw(x, z) : -1000);
  const col = new CollisionWorld(terrainY);

  // -------------------------------------------------- materials
  const mk = (o: THREE.MeshStandardMaterialParameters & { name: string }) =>
    new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0, ...o });
  const M = {
    terrain: mk({ name: 'rv-terrain', roughness: 0.95 }),
    ground: mk({ name: 'rv-ground', roughness: 0.95 }),
    rock: mk({ name: 'rv-rock', roughness: 0.93 }),
    stone: mk({ name: 'rv-stone', roughness: 0.86 }),
    bark: mk({ name: 'rv-bark', roughness: 0.9 }),
    leaf: mk({ name: 'rv-canopy', roughness: 0.78, side: THREE.DoubleSide }),
    litter: mk({ name: 'rv-litter', roughness: 0.92, side: THREE.DoubleSide }),
    wood: mk({ name: 'rv-wood', roughness: 0.88 }),
    sail: mk({ name: 'rv-sail', roughness: 0.95, side: THREE.DoubleSide }),
    reed: mk({ name: 'rv-reed', roughness: 0.8, side: THREE.DoubleSide }),
  };
  M.terrain.map = leafLitterTexture();
  M.ground.map = M.terrain.map;
  const patchable: THREE.MeshStandardMaterial[] = Object.values(M);

  // Spatial buckets: material × 64 m cell, so frustum culling still works on merged meshes.
  const buckets = new Map<string, { b: Bucket; mat: THREE.Material; cast: boolean }>();
  const CELL = 64;
  const bk = (mat: keyof typeof M | THREE.Material, x: number, z: number, cast = true): Bucket => {
    const m = typeof mat === 'string' ? M[mat] : mat;
    const key = `${m.uuid}:${Math.floor(x / CELL)}:${Math.floor(z / CELL)}:${cast}`;
    let e = buckets.get(key);
    if (!e) {
      e = { b: new Bucket(), mat: m, cast };
      buckets.set(key, e);
    }
    return e.b;
  };

  // -------------------------------------------------- shrine glow materials (carved stone that warms)
  const glowMat = (name: string) =>
    new THREE.MeshStandardMaterial({
      name,
      vertexColors: true,
      color: 0xb8a68a,
      roughness: 0.6,
      emissive: new THREE.Color(0xff8a2a),
      emissiveIntensity: 0.0,
    });

  /** Rock slab + litter-textured ground cap on walkable tops. */
  const slab = (spec: RockSpec) => {
    rockSlab(bk('rock', spec.x, spec.z), spec);
    if (spec.topColor !== null) groundCap(bk('ground', spec.x, spec.z, false), spec, spec.topColor ?? PAL.soilTop);
  };

  // ==================================================================== ROUTE
  // Critical path, authored once; drives path paint, litter, embers and the autopilot.
  const route: Waypoint[] = [];
  const W = (x: number, y: number, z: number, o: Partial<Waypoint> = {}) => route.push({ x, y, z, ground: true, ...o });
  const WS = (s: number, t: number, y: number, o: Partial<Waypoint> = {}) => {
    const p = sp(s, t);
    W(p.x, y, p.z, { ground: false, ...o });
  };

  // A · Arrival Meadow
  W(0, 0, 90, { label: 'portal' });
  W(0, 0, 80, { label: 'cp-meadow' });
  W(6, 0, 70);
  W(22, 0, 58);
  W(42, 0, 46);
  W(54, 0, 40, { label: 'cp-marsh' });
  // C · Reedmarsh — boardwalk, hummock, ghost-ink stones, SW2 island
  W(57, 0.3, 36.3, { ground: false });
  W(64.5, 0.3, 31.4, { ground: false });
  W(68.5, 0.4, 28.2, { ground: false, act: 'jump' });
  W(73.5, 0.25, 25, { ground: false, act: 'jump' });
  W(77.5, 0.25, 22.5, { ground: false, act: 'jump' });
  W(81.5, 0.25, 20, { ground: false, act: 'jump' });
  W(85.5, 0.25, 17.5, { ground: false, act: 'jump' });
  W(89.4, 1.2, 15.6, { ground: false });
  W(92.4, 2.0, 12.6, { ground: false });
  W(95, 2, 10, { ground: false, label: 'SW2' });
  // after SW2 the ink dries — walk out west across the basin floor
  W(90, 2, 9, { ground: false });
  W(86.6, -1.9, 12.2, { ground: false });
  W(62, -1.9, 22, { ground: false });
  W(44, 0, 26);
  W(20, 0, 40);
  W(-10, 0, 52);
  W(-34, 0, 56);
  // B · Windmill Rise
  WS(-7, 0, 0, { ground: true });
  WS(1.5, 0, 2);
  WS(6, 6, 2);
  WS(10.5, 12.8, 2);
  WS(10.5, 2.6, 6);
  WS(14.5, 2.4, 6);
  WS(17.2, 6.5, 6, { label: 'cp-mills' });
  WS(20.4, -1, 6, { act: 'jump' });
  WS(23, -1, 7.5, { act: 'jump' });
  WS(25.5, -1, 9.0, { act: 'jump' });
  WS(29.5, -1, 10);
  WS(36.5, -1.2, 10);
  WS(36.5, -8.8, 14);
  WS(39.8, -9.4, 14);
  WS(45, -2, 14);
  WS(51.2, 0, 14, { act: 'jumpdash', label: 'chasm' });
  WS(62.3, 0.6, 14);
  WS(62.3, 1.2, 14);
  WS(62.3, 9.2, 18);
  WS(65.6, 9.2, 18);
  WS(66, 1.0, 22);
  WS(69.8, 1.0, 22);
  WS(80.8, 4.6, 22, { act: 'glide', label: 'launch' });
  W(-112, 20, -24, { ground: false, label: 'SW1' });
  // glide off SW1 east, over the terraces' north shoulder, into Amberwood
  W(-108, 20, -25, { ground: false, act: 'glide' });
  W(-72, 0, -26, { ground: false });
  W(-40, 0, -18);
  W(-14, 0, -6);
  W(0, 0, -1.5, { label: 'cp-amber' });
  W(9, 0, -9);
  // D · Amberwood canopy climb
  W(11.6, 0, -12.4, { act: 'jump' });
  W(12, 1.5, -14, { ground: false, act: 'jump' });
  W(9.6, 3.0, -16.4, { ground: false });
  W(8.0, 3.0, -17.9, { ground: false });
  W(0.8, 6.8, -24.8, { ground: false });
  W(-1.6, 7, -26.2, { ground: false, act: 'jump' });
  W(-7, 8.8, -25.2, { ground: false, act: 'jump' });
  W(-13, 10.6, -26.2, { ground: false, act: 'jump' });
  W(-17.4, 12.4, -30.2, { ground: false, act: 'jump' });
  W(-17.9, 14.2, -36, { ground: false, act: 'jump' });
  W(-15, 16, -41.4, { ground: false, act: 'jump' });
  W(-10.8, 17.5, -37.4, { ground: false, label: 'SW3' });
  W(-9, 17.5, -35.5, { ground: false, act: 'glide' });
  W(0, 8, -31.2, { ground: false, label: 'bridge-head' });
  // E · root bridge → arena → switchback ascent → Wellspring
  W(0, 10, -37.5, { ground: false });
  W(0.5, 12, -44.5, { ground: false, label: 'cp-arena' });
  W(4, 12, -60, { ground: false });
  W(6.6, 12, -68.7, { ground: false });
  W(-6.4, 17.2, -68.7, { ground: false });
  W(-6.4, 17.2, -71.5, { ground: false });
  W(6.4, 22.4, -71.5, { ground: false });
  W(6.4, 22.4, -74.5, { ground: false });
  W(1.8, 24.2, -74.5, { ground: false, act: 'jump' });
  W(-2.1, 24.6, -74.5, { ground: false });
  W(-6.4, 27.6, -74.5, { ground: false });
  W(-6.4, 27.6, -77.5, { ground: false });
  W(-2.1, 29.3, -77.5, { ground: false, act: 'jump' });
  W(2.5, 29.8, -77.5, { ground: false });
  W(6.4, 32.8, -77.5, { ground: false });
  W(6.4, 32.8, -80.5, { ground: false });
  W(-6.4, 38, -80.5, { ground: false });
  W(-5, 38, -83.5, { ground: false });
  W(0, 38, -86, { ground: false, label: 'wellspring' });

  // ==================================================================== TERRAIN
  {
    const step = 1.5;
    const x0 = -138;
    const z0 = -108;
    const nx = Math.ceil(276 / step);
    const nz = Math.ceil(216 / step);
    const pos: number[] = [];
    const cols: number[] = [];
    const idx: number[] = [];
    const inside: boolean[] = [];
    const c = new THREE.Color();
    const groundSegs = route
      .map((p, i) => [p, route[i + 1]] as const)
      .filter(([a, b]) => b && a.ground && b.ground) as Array<readonly [Waypoint, Waypoint]>;
    const pathDist = (x: number, z: number) => {
      let best = 1e9;
      for (const [a, b] of groundSegs) {
        const abx = b.x - a.x;
        const abz = b.z - a.z;
        const t = Math.max(0, Math.min(1, ((x - a.x) * abx + (z - a.z) * abz) / (abx * abx + abz * abz)));
        const d = Math.hypot(x - a.x - abx * t, z - a.z - abz * t);
        if (d < best) best = d;
      }
      return best;
    };
    for (let j = 0; j <= nz; j++) {
      for (let i = 0; i <= nx; i++) {
        let x = x0 + i * step;
        let z = z0 + j * step;
        const th = Math.atan2(z, x);
        const R = outlineR(th);
        const d = Math.hypot(x, z);
        const ins = d <= R;
        inside.push(ins);
        if (!ins) {
          x = Math.cos(th) * R;
          z = Math.sin(th) * R;
        }
        let y = groundRaw(x, z);
        const rimK = smooth01(R - 6, R, Math.min(d, R));
        y += rimK * 0.25 - (ins ? 0 : 0.3);
        pos.push(x, y, z);
        // colour
        const pd = pathDist(x, z);
        const me = marshE(x, z);
        const pe = ((x - POND.x) / POND.rx) ** 2 + ((z - POND.z) / POND.rz) ** 2;
        const n1 = fbm3(x * 0.08, 0, z * 0.08, 3);
        const n2 = vnoise3(x * 0.6, 2, z * 0.6);
        c.copy(PAL.grassGold).lerp(PAL.grassDry, n1);
        if (z < 12 && z > -50) c.lerp(PAL.moss, 0.55 * smooth01(12, -4, z) * (0.6 + n1 * 0.6)); // Amberwood floor
        if (n2 > 0.72) c.lerp(PAL.leafBrown, 0.35);
        c.lerp(PAL.path.clone().multiplyScalar(1.45), smooth01(2.8, 1.0, pd) * 0.85);
        c.lerp(PAL.mud, smooth01(1.1, 0.85, me));
        c.lerp(PAL.mud, smooth01(1.3, 0.9, pe) * 0.8);
        c.lerp(PAL.rockA, rimK * 0.7);
        c.multiplyScalar(0.9 + vnoise3(x * 1.7, 5, z * 1.7) * 0.18);
        cols.push(c.r, c.g, c.b);
      }
    }
    const row = nx + 1;
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const a = j * row + i;
        const b = a + 1;
        const cc = a + row;
        const d = cc + 1;
        if (inside[a] || inside[b] || inside[cc]) idx.push(a, cc, b);
        if (inside[b] || inside[cc] || inside[d]) idx.push(b, cc, d);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    const uvs: number[] = [];
    for (let i = 0; i < pos.length; i += 3) uvs.push(pos[i]! / 2.6, pos[i + 2]! / 2.6);
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, M.terrain);
    mesh.receiveShadow = true;
    mesh.name = 'rv-terrain';
    group.add(mesh);
  }

  // ==================================================================== ISLAND UNDERSIDE (chunky strata + roots)
  {
    const ub = new Bucket();
    islandUnderside(ub, 0, 0, 0.1, (th) => outlineR(th) * 1.004, 70, 3, 160);
    const ur = rng(77);
    for (let i = 0; i < 26; i++) {
      const th = ur() * Math.PI * 2;
      const R = outlineR(th) * (0.25 + ur() * 0.55);
      hangingSpire(ub, Math.cos(th) * R, -10 - ur() * 18, Math.sin(th) * R, 5 + ur() * 9, 14 + ur() * 26, i + 1);
    }
    const rb = new Bucket();
    for (let i = 0; i < 90; i++) {
      const th = ur() * Math.PI * 2;
      const R = outlineR(th) * (0.93 + ur() * 0.06);
      const inward = new THREE.Vector2(-Math.cos(th), -Math.sin(th));
      hangingRoot(rb, ur, Math.cos(th) * R, -1 - ur() * 5, Math.sin(th) * R, 5 + ur() * 16, inward, 0.12 + ur() * 0.3);
    }
    const um = ub.toMesh(M.rock, { cast: false, receive: false });
    const rm = rb.toMesh(M.bark, { cast: false, receive: false });
    if (um) group.add(um);
    if (rm) group.add(rm);
  }

  // ==================================================================== WINDMILL RISE (terraces)
  type Terr = { s0: number; s1: number; top: number; w: number };
  const terraces: Terr[] = [
    { s0: 0, s1: T_END, top: 2, w: 30 },
    { s0: 12, s1: T_END, top: 6, w: 28 },
    { s0: 28, s1: T_END, top: 10, w: 26 },
    { s0: 38, s1: 52, top: 14, w: 24 },
    { s0: 60.5, s1: T_END, top: 14, w: 24 },
    { s0: 64, s1: T_END, top: 18, w: 22 },
    { s0: 68, s1: T_END, top: 22, w: 20 },
  ];
  for (let i = 0; i < terraces.length; i++) {
    const tr = terraces[i]!;
    const c = sp((tr.s0 + tr.s1) / 2, 0);
    const len = tr.s1 - tr.s0;
    col.add(boxCollider({ x: c.x, z: c.z, w: tr.w, d: len, yaw: T_YAW, top: tr.top, bottom: -4, tag: `terrace${i}` }));
    slab({
      x: c.x,
      z: c.z,
      yaw: T_YAW,
      w: tr.w,
      d: len,
      top: tr.top,
      bottom: -4,
      rough: 0.7,
      seed: 10 + i,
      topColor: PAL.grassGold.clone().lerp(PAL.moss, 0.35),
    });
  }
  // stair flight helper in terrace frame (collider ramp + stone steps)
  const flightT = (s0: number, t0: number, y0: number, s1: number, t1: number, y1: number, width: number, seed: number, parapet = true) => {
    const a = sp(s0, t0);
    const b = sp(s1, t1);
    flight({ x: a.x, z: a.z, y: y0 }, { x: b.x, z: b.z, y: y1 }, width, seed, parapet);
  };
  const flight = (
    a: { x: number; z: number; y: number },
    b: { x: number; z: number; y: number },
    width: number,
    seed: number,
    parapet = true,
    missing = 0,
  ) => {
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const yaw = Math.atan2(b.x - a.x, b.z - a.z);
    col.add(boxCollider({ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, w: width, d: len, yaw, top: a.y, top1: b.y, bottom: Math.min(a.y, b.y) - 1, tag: 'stair' }));
    stairFlight(bk('stone', a.x, a.z), a, b, width, seed, { parapet, missing });
  };
  // R1 entrance stair (0 → 2), straight up the front
  flightT(-6.5, 0, 0.1, 0.4, 0, 2, 3.4, 1);
  // R2 lateral flight on k1 (2 → 6)
  flightT(10.5, 11.2, 2, 10.5, 2.0, 6, 2.6, 2);
  // R3 jump chain on k2: broken pillar stumps (6 → 7.5 → 9 → 10)
  for (const [s, top, seed] of [[23, 7.5, 3], [25.5, 9.0, 4]] as const) {
    const p = sp(s, -1);
    col.add(boxCollider({ x: p.x, z: p.z, w: 1.9, d: 1.9, yaw: T_YAW, top, bottom: 5, tag: 'stump' }));
    const sb = bk('stone', p.x, p.z);
    const n = Math.round((top - 6) / 0.62);
    for (let i = 0; i < n; i++) {
      const hh = (top - 6) / n;
      stoneBlock(sb, trs(p.x, 6 + hh * (i + 0.5), p.z, T_YAW + (r() - 0.5) * 0.1), 1.9, hh * 0.98, 1.9, seed * 10 + i, 0.12);
    }
  }
  // R4 lateral flight on k3 (10 → 14)
  flightT(36.5, -0.6, 10, 36.5, -9.6, 14, 2.6, 5);
  // chasm on k4 between s 52 and 60.5 (jump + air-dash, 8.5 m)
  // R5 lateral flight on k4b (14 → 18)
  flightT(62.3, 0.4, 14, 62.3, 9.8, 18, 2.4, 6);
  // R6 lateral flight on k5 (18 → 22)
  flightT(66, 9.8, 18, 66, 0.4, 22, 2.4, 7);

  // windmills (towers static, blades animated)
  type Mill = { hub: THREE.Group; pos: THREE.Vector3; spin: number };
  const mills: Mill[] = [];
  const millSites: Array<[number, number, number]> = [
    [23.8, -8.4, 6],
    [48.6, -7.6, 14],
    [73.5, -4.6, 22],
  ];
  const millFacing = Math.atan2(-TD.x, -TD.y) + 0.5; // face back down the climb (toward meadow/camera)
  for (let i = 0; i < millSites.length; i++) {
    const [s, t, y] = millSites[i]!;
    const p = sp(s, t);
    const H = 10;
    col.add(cylCollider({ x: p.x, z: p.z, r: 2.4, top: y + H, bottom: y - 1, tag: 'mill' }));
    // tower: stacked stone courses, tapering
    const sb = bk('stone', p.x, p.z);
    const courses = 14;
    for (let k = 0; k < courses; k++) {
      const rad = THREE.MathUtils.lerp(2.4, 1.6, k / courses);
      const ring = 9;
      for (let q = 0; q < ring; q++) {
        const a = (q / ring) * Math.PI * 2 + (k % 2) * 0.35;
        const ch = H / courses;
        stoneBlock(sb, trs(p.x + Math.cos(a) * rad, y + ch * (k + 0.5), p.z + Math.sin(a) * rad, -a + Math.PI / 2), (2 * Math.PI * rad) / ring + 0.08, ch * 0.96, 0.6, i * 1000 + k * 20 + q, 0.08);
      }
    }
    // cap
    const cap = new THREE.ConeGeometry(2.3, 2.6, 8, 1);
    const capB = bk('wood', p.x, p.z);
    capB.add(cap, trs(p.x, y + H + 1.2, p.z, 0.2), PAL.wood.clone().multiplyScalar(0.8));
    cap.dispose();
    // hub + blades (dynamic)
    const hub = new THREE.Group();
    hub.position.set(p.x + Math.sin(millFacing) * 2.2, y + H - 0.6, p.z + Math.cos(millFacing) * 2.2);
    hub.rotation.y = millFacing;
    const bladeB = new Bucket();
    const sailB = new Bucket();
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2;
      const spar = new THREE.BoxGeometry(0.22, 7.2, 0.18);
      spar.translate(0, 3.6, 0);
      bladeB.add(spar, new THREE.Matrix4().makeRotationZ(a), PAL.wood);
      spar.dispose();
      // lattice ribs
      for (let q = 1; q < 7; q++) {
        const rib = new THREE.BoxGeometry(1.5, 0.07, 0.07);
        rib.translate(0.75, q * 1.0, 0.05);
        bladeB.add(rib, new THREE.Matrix4().makeRotationZ(a), PAL.wood);
        rib.dispose();
      }
      // pressed-sepia sailcloth, a little torn on one blade
      const sail = new THREE.PlaneGeometry(1.4, k === 2 ? 4.2 : 5.8, 2, 4);
      const sp2 = sail.attributes.position as THREE.BufferAttribute;
      for (let v = 0; v < sp2.count; v++) sp2.setZ(v, 0.08 + Math.sin(sp2.getY(v) * 0.9) * 0.08);
      sail.translate(0.78, k === 2 ? 4.6 : 3.9, 0);
      sailB.add(sail, new THREE.Matrix4().makeRotationZ(a), PAL.sail.clone().offsetHSL(0, 0, (k % 2) * -0.05));
      sail.dispose();
    }
    const hubGeo = new THREE.CylinderGeometry(0.4, 0.5, 0.8, 8);
    hubGeo.rotateX(Math.PI / 2);
    bladeB.add(hubGeo, undefined, PAL.wood);
    hubGeo.dispose();
    const rot = new THREE.Group();
    const bm = bladeB.toMesh(M.wood);
    const sm = sailB.toMesh(M.sail);
    if (bm) rot.add(bm);
    if (sm) rot.add(sm);
    hub.add(rot);
    group.add(hub);
    mills.push({ hub: rot as unknown as THREE.Group, pos: new THREE.Vector3(p.x, y + H, p.z), spin: 0 });
  }

  // terrace dressing: ruins, columns, boulders, shrubs, litter
  {
    const ruinsT: Array<[number, number, number, number, number]> = [
      // s, t, y, yaw offset, broken
      [5, -10, 2, 0.1, 0.5],
      [16, 10, 6, -0.2, 0],
      [33, 8, 10, 0.3, 0.6],
      [44, 6, 14, 0, 0.2],
      [76, 7, 22, -0.3, 0.4],
    ];
    for (let i = 0; i < ruinsT.length; i++) {
      const [s, t, y, yo, brk] = ruinsT[i]!;
      const p = sp(s, t);
      ruinArch(bk('stone', p.x, p.z), p.x, y, p.z, T_YAW + yo, { span: 3, pillarH: 3.6 + (i % 2), seed: 40 + i, broken: brk, pointed: i % 2 === 1 });
    }
    const colsT: Array<[number, number, number, number]> = [
      [3, 12, 2, 2.4],
      [8, -12, 2, 1.4],
      [19, -12, 6, 2.8],
      [30, -11, 10, 1.9],
      [57, 10, 14, 2.2],
      [70, 8, 22, 3.2],
      [79, -7, 22, 1.6],
    ];
    for (let i = 0; i < colsT.length; i++) {
      const [s, t, y, h] = colsT[i]!;
      const p = sp(s, t);
      ruinColumn(bk('stone', p.x, p.z), p.x, y, p.z, h, 60 + i);
    }
  }

  // SW1 Wind Seedwell spire (−112, −24, y20)
  const SW1P = new THREE.Vector3(-112, 20, -24);
  col.add(cylCollider({ x: SW1P.x, z: SW1P.z, r: 6.2, top: 20, bottom: -30, tag: 'sw1-spire' }));
  slab({ x: SW1P.x, z: SW1P.z, w: 12.4, d: 12.4, top: 20, bottom: -2, round: true, rough: 0.8, seed: 31, topColor: PAL.grassGold });
  {
    const sb = new Bucket();
    hangingSpire(sb, SW1P.x, -1, SW1P.z, 6, 24, 12);
    const m = sb.toMesh(M.rock, { cast: false });
    if (m) group.add(m);
  }

  // ==================================================================== REEDMARSH
  const inkGeo = new THREE.CircleGeometry(1, 64);
  inkGeo.rotateX(-Math.PI / 2);
  const inkMat = new THREE.MeshStandardMaterial({ name: 'rv-ink', color: 0x1f1914, roughness: 0.18, metalness: 0.0 });
  const ink = new THREE.Mesh(inkGeo, inkMat);
  ink.scale.set(MARSH.rx * 0.97, 1, MARSH.rz * 0.97);
  ink.position.set(MARSH.x, MARSH.ink, MARSH.z);
  ink.receiveShadow = true;
  group.add(ink);
  let inkActive = true;

  // boardwalk on stilts (56,37)→(65,31)
  const plankWalk = (a: { x: number; z: number }, b: { x: number; z: number }, top: number, w: number) => {
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const yaw = Math.atan2(b.x - a.x, b.z - a.z);
    col.add(boxCollider({ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, w, d: len, yaw, top, bottom: top - 0.4, tag: 'boardwalk' }));
    const wb = bk('wood', a.x, a.z);
    const n = Math.round(len / 0.45);
    for (let i = 0; i < n; i++) {
      const lz = -len / 2 + (i + 0.5) * (len / n);
      const cx = (a.x + b.x) / 2 + Math.sin(yaw) * lz;
      const cz = (a.z + b.z) / 2 + Math.cos(yaw) * lz;
      const plank = new THREE.BoxGeometry(w * (0.9 + r() * 0.15), 0.1, len / n - 0.05);
      wb.add(plank, trs(cx, top - 0.05 - r() * 0.03, cz, yaw + (r() - 0.5) * 0.06), PAL.wood.clone().offsetHSL(0, 0, (r() - 0.5) * 0.1));
      plank.dispose();
      if (i % 4 === 0) {
        for (const side of [-1, 1]) {
          const post = new THREE.CylinderGeometry(0.1, 0.12, top + 2.6, 5);
          wb.add(post, trs(cx + Math.cos(yaw) * side * w * 0.5, (top - 2.6) / 2 - 0.2, cz - Math.sin(yaw) * side * w * 0.5), PAL.wood.clone().multiplyScalar(0.7));
          post.dispose();
        }
      }
    }
  };
  plankWalk({ x: 55.2, z: 37.5 }, { x: 66, z: 30.5 }, 0.3, 2.0);

  const hummock = (x: number, z: number, rr: number, top: number, seed: number) => {
    col.add(cylCollider({ x, z, r: rr, top, bottom: -3, tag: 'hummock' }));
    slab({ x, z, w: rr * 2, d: rr * 2, top, bottom: -2.6, round: true, rough: 0.35, seed, topColor: PAL.mud.clone().lerp(PAL.moss, 0.5) });
  };
  hummock(69, 28, 3, 0.4, 51);
  hummock(90, 15, 3, 1.2, 52);
  hummock(60, 12, 3.4, 0.5, 53);
  hummock(98, 30, 2.6, 0.3, 54);
  hummock(84, 36, 3.2, 0.4, 55);

  // ghost-ink stepping stones: faint sketches until the fox's colour touches them
  type Ghost = { c: Collider; mesh: THREE.Mesh; mat: THREE.MeshStandardMaterial; solid: number };
  const ghosts: Ghost[] = [];
  for (const [x, z] of [[73.5, 25], [77.5, 22.5], [81.5, 20], [85.5, 17.5]] as const) {
    const c = col.add(cylCollider({ x, z, r: 1.15, top: 0.25, bottom: -2.5, tag: 'ghost' }));
    const gb = new Bucket();
    rockSlab(gb, { x: 0, z: 0, w: 2.3, d: 2.3, top: 0.25, bottom: -2.2, round: true, rough: 0.2, seed: x, topColor: PAL.stone });
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, transparent: true, opacity: 0.3, color: 0xe8dcc4 });
    const mesh = gb.toMesh(mat)!;
    mesh.position.set(x, 0, z);
    group.add(mesh);
    ghosts.push({ c, mesh, mat, solid: 0 });
  }
  // stair from the H2 hummock onto the SW2 ruin island
  flight({ x: 90.0, z: 15.0, y: 1.2 }, { x: 92.4, z: 12.6, y: 2.0 }, 2.2, 21, false);
  const SW2P = new THREE.Vector3(95, 2, 10);
  col.add(cylCollider({ x: SW2P.x, z: SW2P.z, r: 5, top: 2, bottom: -3, tag: 'sw2-island' }));
  slab({ x: SW2P.x, z: SW2P.z, w: 10, d: 10, top: 2, bottom: -2.4, round: true, rough: 0.5, seed: 61, topColor: PAL.stone.clone().lerp(PAL.moss, 0.3) });
  // sunken ruin walls round the island
  ruinArch(bk('stone', 99, 6), 99.5, 2, 6.5, 0.8, { span: 2.6, pillarH: 3, seed: 71, broken: 0.6 });
  ruinColumn(bk('stone', 91, 5), 91, 2, 6.5, 2.2, 72);
  ruinColumn(bk('stone', 100, 13), 99.5, 2, 13.5, 3.4, 73);

  // reeds (thin 3D blades — copper when restored)
  {
    const rr = rng(404);
    const c = new THREE.Color();
    let placed = 0;
    for (let i = 0; i < 2600 && placed < 260; i++) {
      const x = MARSH.x + (rr() * 2 - 1) * MARSH.rx * 1.05;
      const z = MARSH.z + (rr() * 2 - 1) * MARSH.rz * 1.05;
      const e = marshE(x, z);
      if (e > 1.1) continue;
      if (routeNear(route, x, z, 2.2)) continue;
      if (Math.hypot(x - SW2P.x, z - SW2P.z) < 6) continue;
      placed++;
      const base = e < 0.85 ? MARSH.ink - 0.1 : groundRaw(x, z);
      const b = bk('reed', x, z, false);
      const n = 7 + Math.floor(rr() * 8);
      for (let k = 0; k < n; k++) {
        const a = rr() * Math.PI * 2;
        const d = rr() * 0.8;
        const h = 1.4 + rr() * 1.8;
        const px = x + Math.cos(a) * d;
        const pz = z + Math.sin(a) * d;
        const lean = (rr() - 0.5) * 0.35;
        const w = 0.025 + rr() * 0.03;
        c.copy(PAL.copper).lerp(PAL.russet, rr() * 0.6).offsetHSL(0, 0, (rr() - 0.5) * 0.12).multiplyScalar(0.55);
        const top = new THREE.Vector3(px + Math.cos(a) * lean * h, base + h, pz + Math.sin(a) * lean * h);
        const l = new THREE.Vector3(px - Math.sin(a) * w, base, pz + Math.cos(a) * w);
        const rgt = new THREE.Vector3(px + Math.sin(a) * w, base, pz - Math.cos(a) * w);
        const nn = new THREE.Vector3(Math.cos(a), 0.4, Math.sin(a)).normalize();
        b.tri(l, rgt, top, nn, c.clone().multiplyScalar(0.55), c.clone().multiplyScalar(0.55), c);
      }
    }
  }

  // Pockets' stilt hut (60, 52) y3
  {
    const hx = 60;
    const hz = 52;
    const hy = 3;
    col.add(boxCollider({ x: hx, z: hz, w: 8, d: 8, top: hy, bottom: hy - 0.5, tag: 'hut-deck' }));
    flight({ x: 60, z: 59.5, y: 0.3 }, { x: 60, z: 56.2, y: 3 }, 1.8, 81, false);
    const wb = bk('wood', hx, hz);
    const deck = new THREE.BoxGeometry(8, 0.3, 8);
    wb.add(deck, trs(hx, hy - 0.15, hz), PAL.wood);
    deck.dispose();
    for (const [px, pz] of [[-3.6, -3.6], [3.6, -3.6], [-3.6, 3.6], [3.6, 3.6]] as const) {
      const post = new THREE.CylinderGeometry(0.16, 0.2, hy + 1.5, 6);
      wb.add(post, trs(hx + px, (hy - 1.5) / 2, hz + pz), PAL.wood.clone().multiplyScalar(0.7));
      post.dispose();
    }
    const walls = new THREE.BoxGeometry(5, 3, 5);
    wb.add(walls, trs(hx, hy + 1.5, hz - 0.5), PAL.wood.clone().lerp(PAL.stone, 0.3));
    walls.dispose();
    col.add(boxCollider({ x: hx, z: hz - 0.5, w: 5, d: 5, top: hy + 3, bottom: hy, tag: 'hut' }));
    const roof = new THREE.ConeGeometry(4.6, 3, 4);
    wb.add(roof, trs(hx, hy + 4.5, hz - 0.5, Math.PI / 4), PAL.russet.clone().multiplyScalar(0.7));
    roof.dispose();
  }

  // marsh mist sheets (soft billboards low over the ink)
  const mistTex = (() => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    const g = cv.getContext('2d')!;
    const grd = g.createRadialGradient(64, 64, 4, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,255,255,0.55)');
    grd.addColorStop(0.5, 'rgba(255,255,255,0.18)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const mistMat = new THREE.MeshBasicMaterial({ map: mistTex, color: 0xe6cfa8, transparent: true, depthWrite: false, opacity: 0.55 });
  const mists: THREE.Mesh[] = [];
  for (let i = 0; i < 14; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mistMat);
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r()) * 0.9;
    m.position.set(MARSH.x + Math.cos(a) * MARSH.rx * d, -0.6 + r() * 1.4, MARSH.z + Math.sin(a) * MARSH.rz * d);
    m.scale.setScalar(12 + r() * 12);
    m.rotation.x = -Math.PI / 2 + 0.25;
    m.userData.phase = r() * 6.28;
    mists.push(m);
    group.add(m);
  }

  // ==================================================================== AMBERWOOD
  // canopy route: boulder steps → leaning branch → bounce crown pads spiralling the hollow Seedwell maple
  const SW3P = new THREE.Vector3(-10, 17.5, -36);
  hummock(12, -14, 1.8, 1.5, 91); // mossy boulder step
  col.colliders[col.colliders.length - 1]!.tag = 'boulder';
  hummock(9.5, -16.5, 1.6, 3.0, 92);
  col.colliders[col.colliders.length - 1]!.tag = 'boulder';
  // leaning branch ramp
  {
    const a = { x: 8.2, z: -17.8, y: 3.0 };
    const b = { x: 0.2, z: -25.3, y: 7.0 };
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const yaw = Math.atan2(b.x - a.x, b.z - a.z);
    col.add(boxCollider({ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, w: 1.9, d: len, yaw, top: a.y, top1: b.y, bottom: a.y - 1.4, tag: 'branch' }));
    const bb = bk('bark', a.x, a.z);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(a.x + 2.5, -0.5, a.z + 2.4),
      new THREE.Vector3(a.x, a.y - 0.75, a.z),
      new THREE.Vector3((a.x + b.x) / 2, (a.y + b.y) / 2 - 0.7, (a.z + b.z) / 2),
      new THREE.Vector3(b.x, b.y - 0.7, b.z),
      new THREE.Vector3(b.x - 2, b.y + 0.5, b.z - 2),
    ]);
    const tube = new THREE.TubeGeometry(curve, 24, 0.85, 8, false);
    const tp = tube.attributes.position as THREE.BufferAttribute;
    const cc: number[] = [];
    for (let i = 0; i < tp.count; i++) {
      const n = vnoise3(tp.getX(i) * 1.5, tp.getY(i) * 1.5, tp.getZ(i) * 1.5);
      const c = PAL.bark.clone().lerp(PAL.barkLight, n * 0.7);
      if (tp.getY(i) > a.y - 0.3 && n > 0.45) c.lerp(PAL.moss, 0.45);
      cc.push(c.r, c.g, c.b);
    }
    tube.setAttribute('color', new THREE.Float32BufferAttribute(cc, 3));
    bb.add(tube);
    tube.dispose();
  }
  const pads: Array<[number, number, number, number]> = [
    [-2, -27, 7.0, 3.5],
    [-7, -25, 8.8, 2.6],
    [-13, -26, 10.6, 2.6],
    [-17.5, -30, 12.4, 2.6],
    [-18, -36, 14.2, 2.6],
    [-15, -41.5, 16.0, 2.6],
  ];
  // hollow Seedwell maple trunk (SW3 sits in its split crown)
  col.add(cylCollider({ x: SW3P.x, z: SW3P.z, r: 3.6, top: SW3P.y, bottom: -1, tag: 'sw3-trunk' }));
  {
    const tb = bk('bark', SW3P.x, SW3P.z);
    const g = new THREE.CylinderGeometry(3.3, 4.6, SW3P.y + 1, 16, 10, true);
    const p = g.attributes.position as THREE.BufferAttribute;
    const cc: number[] = [];
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i);
      const z = p.getZ(i);
      const a = Math.atan2(z, x);
      const ridge = 1 + Math.pow(Math.abs(Math.sin(a * 5 + y * 0.15)), 4) * 0.12 + (vnoise3(x, y * 0.4, z) - 0.5) * 0.2;
      const flare = 1 + Math.max(0, -y / ((SW3P.y + 1) / 2) - 0.6) * 0.8;
      p.setXYZ(i, x * ridge * flare, y, z * ridge * flare);
      const c = PAL.bark.clone().lerp(PAL.barkLight, vnoise3(x * 2, y * 0.6, z * 2) * 0.6);
      cc.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(cc, 3));
    g.computeVertexNormals();
    tb.add(g, trs(SW3P.x, (SW3P.y - 1) / 2, SW3P.z));
    g.dispose();
    // split crown lip: jagged bark shards round the top
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2;
      const h = 1.2 + r() * 2.4;
      const shard = new THREE.ConeGeometry(0.7, h, 5);
      tb.add(shard, trs(SW3P.x + Math.cos(a) * 3.4, SW3P.y + h / 2 - 0.2, SW3P.z + Math.sin(a) * 3.4, a, 1, 1, 1, Math.cos(a) * 0.25, -Math.sin(a) * 0.25), PAL.bark);
      shard.dispose();
    }
    // floor of the hollow
    const floor = new THREE.CircleGeometry(3.4, 16);
    floor.rotateX(-Math.PI / 2);
    tb.add(floor, trs(SW3P.x, SW3P.y - 0.02, SW3P.z), PAL.barkLight);
    floor.dispose();
  }
  for (let i = 0; i < pads.length; i++) {
    const [x, z, top, rad] = pads[i]!;
    col.add(cylCollider({ x, z, r: rad, top, bottom: top - 0.6, bounce: 1.14, tag: 'crown-pad' }));
    // leaf mat: dark twig disc + dense leaf cards
    const lb = bk('leaf', x, z);
    const disc = new THREE.CylinderGeometry(rad, rad * 0.7, 0.55, 18);
    lb.add(disc, trs(x, top - 0.3, z), PAL.crimson.clone().multiplyScalar(0.6));
    disc.dispose();
    const nn = new THREE.Vector3();
    const c = new THREE.Color();
    for (let k = 0; k < rad * rad * 22; k++) {
      const a = r() * Math.PI * 2;
      const d = Math.sqrt(r()) * rad * 1.08;
      nn.set(Math.cos(a) * d * 0.15, 1, Math.sin(a) * d * 0.15).normalize();
      c.copy(LEAF_COLORS[Math.floor(r() * 4)]!).offsetHSL(0, 0, (r() - 0.5) * 0.12);
      pushLeaf(lb, x + Math.cos(a) * d, top + 0.02 + r() * 0.05 - (d / rad) * 0.15, z + Math.sin(a) * d, 0.32 + r() * 0.2, r() * 6.28, -Math.PI / 2 + (r() - 0.5) * 0.6, (r() - 0.5) * 0.5, c, nn, true);
    }
    // supporting branch from the Seedwell trunk (or own trunk for the first pad)
    const from = i === 0 ? new THREE.Vector3(x + 1.5, -0.5, z + 1) : new THREE.Vector3(SW3P.x, top - 3.5, SW3P.z);
    const to = new THREE.Vector3(x, top - 0.55, z);
    const mid = from.clone().lerp(to, 0.55).add(new THREE.Vector3(0, -1.2, 0));
    const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([from, mid, to]), 10, i === 0 ? 0.8 : 0.5, 7, false);
    bk('bark', x, z).add(tube, undefined, PAL.bark);
    tube.dispose();
  }
  // root-knuckle bridge head (0,−31) y8
  col.add(cylCollider({ x: 0, z: -31.2, r: 2.6, top: 8, bottom: -1, tag: 'bridge-head' }));
  slab({ x: 0, z: -31.2, w: 5.2, d: 5.2, top: 8, bottom: -1, round: true, rough: 0.6, seed: 95, topColor: PAL.moss });

  // root bridge (grows when all 3 Seedwells are lit): (0,−31.5) y8 → (0,−43.2) y12
  const bridgeC = col.add(boxCollider({ x: 0, z: -37.35, w: 2.6, d: 11.7, yaw: Math.PI, top: 8, top1: 12, bottom: 6.5, tag: 'root-bridge' }));
  bridgeC.enabled = false;
  const bridgeMesh = (() => {
    const b = new Bucket();
    for (let k = 0; k < 9; k++) {
      const off = (k - 4) * 0.3;
      const pts = [
        new THREE.Vector3(off * 1.5, 6.5, -29.5),
        new THREE.Vector3(off, 7.6, -32),
        new THREE.Vector3(off * 0.8 + Math.sin(k) * 0.3, 9.3, -37.5),
        new THREE.Vector3(off, 11.4, -43),
        new THREE.Vector3(off * 1.6, 11.0, -45.5),
      ];
      for (const p of pts) p.y -= 0.3 + Math.abs(k - 4) * 0.06 + Math.cos(k * 1.7) * 0.08;
      const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 28, k === 4 ? 0.5 : 0.3 + (k % 3) * 0.06, 7, false);
      b.add(tube, undefined, PAL.root.clone().lerp(PAL.barkLight, k * 0.08));
      tube.dispose();
    }
    // cross-lashing roots tie the bundle into a walkable span (collider is the ramp under them)
    for (let k = 0; k < 7; k++) {
      const z = -32.5 - k * 1.7;
      const t = (z + 31.5) / -11.7;
      const y = 8 + t * 4 - 0.25;
      const c = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-1.5, y - 0.5, z + 0.3),
        new THREE.Vector3(0, y + 0.05, z),
        new THREE.Vector3(1.5, y - 0.5, z - 0.3),
      ]);
      const tube = new THREE.TubeGeometry(c, 8, 0.18, 6, false);
      b.add(tube, undefined, PAL.root.clone().lerp(PAL.moss, 0.3));
      tube.dispose();
    }
    const mesh = b.toMesh(M.bark)!;
    return mesh;
  })();
  bridgeMesh.scale.set(1, 1, 0.001);
  bridgeMesh.position.z = -31.5 * (1 - 0.001);
  bridgeMesh.visible = false;
  group.add(bridgeMesh);
  let bridgeT = 0;
  let bridgeGrowing = false;

  // Amberwood giant maples (20) + the camera/route kept clear of crowns
  const avoid: NonNullable<MapleOpts['avoid']> = [];
  for (const w of route) {
    if (w.y > 2.5 || (w.z < 10 && w.z > -50)) {
      avoid.push({ x: w.x, y: w.y + 1, z: w.z, r: 3.5 });
      avoid.push({ x: w.x, y: w.y + 3.4, z: w.z + 6.4, r: 3.5 });
    }
  }
  const amber: Array<[number, number, number, number]> = [
    // x, z, height, colour idx
    [-30, -8, 22, 0],
    [-42, -32, 26, 1],
    [-28, -40, 24, 2],
    [24, -30, 24, 0],
    [32, -8, 20, 3],
    [-56, -12, 18, 1],
    [26, -50, 22, 2],
    [-26, -54, 22, 0],
    [38, -24, 20, 1],
    [-10, 8, 15, 3],
    [14, 8, 17, 2],
    [42, -42, 20, 0],
    [-62, -42, 22, 2],
    [54, -14, 18, 1],
    [-48, -54, 20, 3],
    [30, -66, 18, 0],
    [-32, -70, 20, 1],
    [46, -60, 18, 2],
    [-20, -20, 19, 2],
    [20, -16, 16, 1],
  ];
  const crownHues = [PAL.maple, PAL.russet, PAL.amber, PAL.gold];
  for (let i = 0; i < amber.length; i++) {
    const [x, z, h, ci] = amber[i]!;
    const y = groundRaw(x, z);
    maple(bk('bark', x, z), bk('leaf', x, z), x, y, z, {
      height: h,
      trunkR: h * 0.06,
      leaf: crownHues[ci]!,
      seed: 300 + i,
      lean: 0.08,
      density: 0.8,
      avoid,
    });
    col.add(cylCollider({ x, z, r: h * 0.06 + 0.2, top: y + h * 0.6, bottom: y - 1, tag: 'trunk' }));
  }
  // crown above the Seedwell maple's hollow (kept off the route by `avoid`)
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + 0.4;
    maple(bk('bark', SW3P.x, SW3P.z), bk('leaf', SW3P.x, SW3P.z), SW3P.x + Math.cos(a) * 2.6, SW3P.y - 2, SW3P.z + Math.sin(a) * 2.6, {
      height: 10,
      trunkR: 0.6,
      lean: 0.45,
      leaf: crownHues[k % 4]!,
      seed: 700 + k,
      density: 0.8,
      avoid,
    });
  }

  // ==================================================================== WELLSPRING HILL
  const ARENA = { x: 0, z: -58, r: 16, top: 12 };
  col.add(cylCollider({ x: ARENA.x, z: ARENA.z, r: ARENA.r, top: ARENA.top, bottom: -3, tag: 'arena' }));
  slab({ x: 0, z: -58, w: ARENA.r * 2, d: ARENA.r * 2, top: ARENA.top, bottom: -3, round: true, rough: 0.9, seed: 101, topColor: PAL.stone.clone().lerp(PAL.grassDry, 0.5) });
  // ring of broken, ash-stained pillars
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2 + 0.2;
    if (Math.sin(a) > 0.92) continue; // leave the bridge mouth open
    const px = ARENA.x + Math.cos(a) * (ARENA.r - 1.6);
    const pz = ARENA.z + Math.sin(a) * (ARENA.r - 1.6);
    if (pz < -66) continue; // keep the stair lane clear
    ruinColumn(bk('stone', px, pz), px, ARENA.top, pz, 1.4 + ((k * 37) % 5) * 0.6, 120 + k, 0.5);
    col.add(cylCollider({ x: px, z: pz, r: 0.8, top: ARENA.top + 1.6, bottom: ARENA.top - 1, tag: 'pillar' }));
  }
  type Row = { z0: number; top: number; hw: number };
  const rows: Row[] = [
    { z0: -70, top: 17.2, hw: 18 },
    { z0: -73, top: 22.4, hw: 17 },
    { z0: -76, top: 27.6, hw: 16 },
    { z0: -79, top: 32.8, hw: 15 },
    { z0: -82, top: 38, hw: 14 },
  ];
  const ZB = -98;
  for (let i = 0; i < rows.length; i++) {
    const rw = rows[i]!;
    const cz = (rw.z0 + ZB) / 2;
    col.add(boxCollider({ x: 0, z: cz, w: rw.hw * 2, d: rw.z0 - ZB, top: rw.top, bottom: -4, tag: `row${i}` }));
    slab({
      x: 0,
      z: cz,
      w: rw.hw * 2,
      d: rw.z0 - ZB,
      top: rw.top,
      bottom: i === 0 ? -4 : rows[i - 1]!.top - 3,
      rough: 0.8,
      seed: 130 + i,
      topColor: PAL.grassDry.clone().lerp(PAL.moss, 0.4),
    });
  }
  // break the stepped read: boulders, shrubs and hanging roots along each row lip (clear of the stair lanes)
  {
    const hr = rng(1717);
    const shrubHues = [PAL.maple, PAL.russet, PAL.amber, PAL.crimson];
    for (let i = 0; i < rows.length; i++) {
      const rw = rows[i]!;
      for (let k = 0; k < 9; k++) {
        const side = k % 2 ? 1 : -1;
        const x = side * (8.5 + hr() * (rw.hw - 9.5));
        const z = rw.z0 - 0.6 - hr() * 1.6;
        if (hr() < 0.45) boulder(bk('rock', x, z), x, rw.top, z, 0.6 + hr() * 0.9, 1800 + i * 10 + k, 0.65);
        else shrub(bk('leaf', x, z, false), hr, x, rw.top, z, 0.5 + hr() * 0.5, shrubHues[Math.floor(hr() * 4)]!);
      }
      for (let k = 0; k < 7; k++) {
        const x = (hr() * 2 - 1) * rw.hw * 0.95;
        if (Math.abs(x) < 7.5) continue;
        hangingRoot(bk('bark', x, rw.z0), hr, x, rw.top - 0.2, rw.z0 + 0.25, 2 + hr() * 3.5, new THREE.Vector2(0, -1), 0.08 + hr() * 0.1);
      }
    }
  }
  // the hill's mass continues below to the ground (one chunky base)
  slab({ x: 0, z: -88, w: 40, d: 20, top: 16, bottom: -4, rough: 1.0, seed: 140, topColor: null });
  // switchback flights
  flight({ x: 6.6, z: -68.7, y: 12 }, { x: -6.6, z: -68.7, y: 17.2 }, 2.4, 150);
  flight({ x: -6.6, z: -71.5, y: 17.2 }, { x: 6.6, z: -71.5, y: 22.4 }, 2.4, 151);
  // broken flight 3 (3.0 m gap, near-level)
  flight({ x: 6.6, z: -74.5, y: 22.4 }, { x: 1.5, z: -74.5, y: 24.3 }, 2.4, 152);
  flight({ x: -1.5, z: -74.5, y: 24.4 }, { x: -6.6, z: -74.5, y: 27.6 }, 2.4, 153);
  // broken flight 4 (3.6 m gap, near-level)
  flight({ x: -6.6, z: -77.5, y: 27.6 }, { x: -1.8, z: -77.5, y: 29.4 }, 2.4, 154);
  flight({ x: 1.8, z: -77.5, y: 29.6 }, { x: 6.6, z: -77.5, y: 32.8 }, 2.4, 155);
  flight({ x: 6.6, z: -80.5, y: 32.8 }, { x: -6.6, z: -80.5, y: 38 }, 2.6, 156);
  // ruins on the rows (arches, columns) — key-art silhouette
  ruinArch(bk('stone', -12, -71), -12, 17.2, -71.6, 0, { span: 3.2, pillarH: 3.8, seed: 160, pointed: true });
  ruinArch(bk('stone', 12, -74), 12.5, 22.4, -74.6, 0.1, { span: 2.8, pillarH: 3.2, seed: 161, broken: 0.6 });
  ruinArch(bk('stone', -11, -77), -11, 27.6, -77.6, -0.1, { span: 3, pillarH: 3.6, seed: 162, broken: 0.3 });
  ruinColumn(bk('stone', 10, -78), 10.5, 27.6, -77.8, 2.6, 163);
  ruinColumn(bk('stone', -10, -81), -10.5, 32.8, -80.8, 3.4, 164);
  ruinColumn(bk('stone', 11, -81), 11, 32.8, -80.6, 1.6, 165);

  // summit: domed Ember Wellspring shrine + arches + the lone maple
  const WSP = new THREE.Vector3(0, 38, -89);
  const wsGlow = glowMat('rv-glow-wellspring');
  const wsGlowB = new Bucket();
  domedShrine(bk('stone', 0, -89), wsGlowB, WSP.x, WSP.y, WSP.z, 1.3, 170);
  col.add(boxCollider({ x: WSP.x, z: WSP.z, w: 6.0, d: 6.0, top: WSP.y + 0.5, bottom: WSP.y - 1, tag: 'shrine-plinth' }));
  ruinArch(bk('stone', -8, -88), -8.5, 38, -86.5, 0.25, { span: 3.4, pillarH: 4.4, seed: 171, pointed: true });
  ruinArch(bk('stone', -7, -94), -6.5, 38, -94, -0.3, { span: 3, pillarH: 3.6, seed: 172, broken: 0.5 });
  ruinColumn(bk('stone', 9, -85), 9, 38, -84.5, 2.2, 173);
  // stairs down the summit's front (key art: stair flight to the shrine)
  // lone maple — keeps a faint russet before the flood, flares after
  const loneMat = new THREE.MeshStandardMaterial({ name: 'rv-lone-maple', vertexColors: true, roughness: 0.75, side: THREE.DoubleSide });
  const loneLeaves = new Bucket();
  const loneBark = bk('bark', 8, -92);
  maple(loneBark, loneLeaves, 8.5, 38, -92.5, { height: 15, trunkR: 0.9, lean: 0.28, leaf: PAL.maple, seed: 999, crownR: 3.6, density: 1.3 });
  col.add(cylCollider({ x: 8.5, z: -92.5, r: 1.1, top: 46, bottom: 37, tag: 'lone-trunk' }));
  const loneMesh = loneLeaves.toMesh(loneMat)!;
  loneMesh.userData.isOccluder = true;
  group.add(loneMesh);
  const loneCol = loneMesh.geometry.attributes.color as THREE.BufferAttribute;
  const loneFull = Float32Array.from(loneCol.array as Float32Array);
  const loneFaded = Float32Array.from(loneFull);
  {
    const c = new THREE.Color();
    const sep = new THREE.Color(0.62, 0.5, 0.38);
    for (let i = 0; i < loneFaded.length; i += 3) {
      c.setRGB(loneFull[i]!, loneFull[i + 1]!, loneFull[i + 2]!);
      const l = c.r * 0.3 + c.g * 0.59 + c.b * 0.11;
      c.lerp(sep.clone().multiplyScalar(0.5 + l), 0.55);
      loneFaded[i] = c.r;
      loneFaded[i + 1] = c.g;
      loneFaded[i + 2] = c.b;
    }
    (loneCol.array as Float32Array).set(loneFaded);
    loneCol.needsUpdate = true;
  }
  const wsLight = new THREE.PointLight(0xff9a40, 0, 26, 1.6);
  wsLight.position.set(WSP.x, WSP.y + 3, WSP.z);
  group.add(wsLight);
  const wsGlowMesh = wsGlowB.toMesh(wsGlow, { cast: false });
  if (wsGlowMesh) group.add(wsGlowMesh);
  patchable.push(wsGlow);

  // ==================================================================== SEEDWELL + LANTERN MEMBERS
  const seedwells: SeedwellState[] = [];
  const mkSeedwell = (id: SeedwellState['id'], name: string, p: THREE.Vector3, radius: number, seed: number, ox = 0, oz = 0) => {
    const g = glowMat(`rv-glow-${id}`);
    const gb = new Bucket();
    seedwell(bk('stone', p.x, p.z), gb, p.x + ox, p.y, p.z + oz, seed);
    const m = gb.toMesh(g, { cast: false });
    if (m) group.add(m);
    patchable.push(g);
    const light = new THREE.PointLight(0xff9a40, 0, 18, 1.6);
    light.position.set(p.x + ox, p.y + 2.2, p.z + oz);
    group.add(light);
    seedwells.push({ id, name, pos: new THREE.Vector3(p.x + ox, p.y, p.z + oz), radius, lit: false, glow: g, light });
  };
  mkSeedwell('SW1', 'Wind Seedwell', SW1P, 40, 201);
  mkSeedwell('SW2', 'Reed Seedwell', SW2P, 35, 202);
  mkSeedwell('SW3', 'Maple Seedwell', SW3P, 30, 203);

  const lanternMat = glowMat('rv-glow-lanterns');
  lanternMat.emissiveIntensity = 0.05;
  patchable.push(lanternMat);
  const checkpoints: Realm['checkpoints'] = [];
  const lanternB = new Bucket();
  const cpSites: Array<[number, number, number]> = [
    [2.6, 0, 80],
    [sp(17.2, 9.3).x, 6, sp(17.2, 9.3).z],
    [53, 0, 42.5],
    [2.6, 0, 0],
    [3.2, 12, -45.2],
  ];
  for (let i = 0; i < cpSites.length; i++) {
    const [x, y0, z] = cpSites[i]!;
    const y = y0 === 0 ? groundRaw(x, z) : y0;
    lanternPost(bk('stone', x, z), lanternB, x, y, z, 220 + i);
    col.add(cylCollider({ x, z, r: 0.45, top: y + 2.6, bottom: y - 1, tag: 'lantern' }));
    checkpoints.push({ pos: new THREE.Vector3(x - 1.6, y, z), lit: false });
  }
  const lanternMesh = lanternB.toMesh(lanternMat, { cast: false });
  if (lanternMesh) group.add(lanternMesh);

  // ==================================================================== MEADOW + PORTAL
  // portal ring of standing stones (0,92) and the first arch framing the Wellspring
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2 - Math.PI / 2 + 0.45;
    const px = Math.cos(a) * 5.4;
    const pz = 92 + Math.sin(a) * 5.4;
    if (pz > 94) continue; // keep the camera side open
    const h = 1.6 + ((k * 53) % 7) * 0.25;
    stoneBlock(bk('stone', px, pz), trs(px, groundRaw(px, pz) + h / 2 - 0.1, pz, -a, 1, 1, 1, 0.06, 0.05), 0.8, h, 0.55, 240 + k, 0.16);
  }
  {
    const y = groundRaw(0, 85);
    ruinArch(bk('stone', 0, 85), 0, y - 0.1, 85, 0.06, { span: 3.6, pillarH: 4.2, seed: 250, pointed: true });
    const y2 = groundRaw(10, 64);
    ruinArch(bk('stone', 10, 64), 10.5, y2 - 0.1, 64, 0.9, { span: 3.2, pillarH: 3.4, seed: 251, broken: 0.55 });
    const y3 = groundRaw(-8, 42);
    ruinArch(bk('stone', -8, 42), -9, y3 - 0.1, 44, -0.3, { span: 3.2, pillarH: 3.8, seed: 252, broken: 0.25 });
  }
  // Wen's pond
  const pond = createStylizedWater(scene, { size: 36, y: POND.water, colorDeep: 0x3a3024, colorShallow: 0x7a6a50 });
  pond.mesh.position.set(POND.x, POND.water, POND.z);
  (pond.material.uniforms.uSky!.value as THREE.Color).set(0x8a7a62);
  {
    // Wen's dock
    const a = { x: -6, z: 72 };
    const b = { x: -13, z: 71 };
    col.add(boxCollider({ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, w: 1.8, d: Math.hypot(b.x - a.x, b.z - a.z), yaw: Math.atan2(b.x - a.x, b.z - a.z), top: 0.35, bottom: -0.2, tag: 'dock' }));
    const wb = bk('wood', a.x, a.z);
    for (let i = 0; i < 14; i++) {
      const t = (i + 0.5) / 14;
      const plank = new THREE.BoxGeometry(0.45, 0.1, 1.8);
      wb.add(plank, trs(a.x + (b.x - a.x) * t, 0.3, a.z + (b.z - a.z) * t, Math.atan2(b.x - a.x, b.z - a.z) + Math.PI / 2), PAL.wood.clone().offsetHSL(0, 0, (r() - 0.5) * 0.1));
      plank.dispose();
    }
  }
  // meadow + realm maples (medium) and boulders
  const meadowTrees: Array<[number, number, number, number]> = [
    [-14, 86, 9, 1],
    [16, 82, 8, 2],
    [-34, 76, 10, 0],
    [30, 70, 9, 3],
    [-40, 34, 11, 1],
    [36, 30, 9, 2],
    [-24, 24, 10, 0],
    [8, 26, 8, 3],
    [-6, 58, 7, 2],
    [62, 70, 9, 0],
    [-62, 70, 10, 2],
    [104, 46, 9, 1],
  ];
  for (let i = 0; i < meadowTrees.length; i++) {
    const [x, z, h, ci] = meadowTrees[i]!;
    const y = groundRaw(x, z);
    maple(bk('bark', x, z), bk('leaf', x, z), x, y, z, { height: h, trunkR: h * 0.055, leaf: crownHues[ci]!, seed: 500 + i, lean: 0.18, density: 1.1 });
    col.add(cylCollider({ x, z, r: h * 0.055 + 0.15, top: y + h * 0.6, bottom: y - 1, tag: 'trunk' }));
  }
  {
    const br = rng(606);
    for (let i = 0; i < 70; i++) {
      const x = (br() * 2 - 1) * 120;
      const z = (br() * 2 - 1) * 95;
      if (!insideIsland(x, z, 8)) continue;
      if (routeNear(route, x, z, 4) || marshE(x, z) < 1.15 || inTerraces(x, z, 4) || Math.hypot(x, z + 58) < 20 || (z < -66 && Math.abs(x) < 24)) continue;
      const y = groundRaw(x, z);
      boulder(bk('rock', x, z), x, y, z, 0.6 + br() * 1.6, i, 0.6);
    }
  }

  // ==================================================================== GROUND COVER (leaf litter + low red/orange shrubs)
  {
    const lr = rng(909);
    const groundAtCover = (x: number, z: number) => {
      const g = col.highestAt(x, z);
      return g < -50 ? NaN : g;
    };
    // litter: dense along every route segment, ground or raised
    for (let i = 0; i < route.length - 1; i++) {
      const a = route[i]!;
      const b = route[i + 1]!;
      if (a.act === 'glide') continue;
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      if (len > 45 && !a.ground) continue;
      const n = Math.ceil(len / 1.6);
      for (let k = 0; k < n; k++) {
        const t = (k + lr()) / n;
        const x = a.x + (b.x - a.x) * t;
        const z = a.z + (b.z - a.z) * t;
        const g = groundAtCover(x, z);
        if (!Number.isFinite(g) || Math.abs(g - (a.y + (b.y - a.y) * t)) > 1.2) continue;
        litterPatch(bk('litter', x, z, false), lr, x, z, a.ground ? 2.0 : 1.3, a.ground ? 5 : 6, (px, pz) => {
          const gg = groundAtCover(px, pz);
          return Math.abs(gg - g) > 0.5 ? NaN : gg;
        });
      }
    }
    // shrubs flanking the ground path, carpeting the edges
    const shrubHues = [PAL.maple, PAL.russet, PAL.amber, PAL.crimson, PAL.copper];
    const placeShrub = (x: number, z: number, size: number) => {
      const g = groundAtCover(x, z);
      if (!Number.isFinite(g)) return;
      if (marshE(x, z) < 0.95) return;
      shrub(bk('leaf', x, z, false), lr, x, g, z, size, shrubHues[Math.floor(lr() * shrubHues.length)]!);
      litterPatch(bk('litter', x, z, false), lr, x, z, size * 2.0, 6, (px, pz) => {
        const gg = groundAtCover(px, pz);
        return Math.abs(gg - g) > 0.5 ? NaN : gg;
      });
    };
    for (let i = 0; i < route.length - 1; i++) {
      const a = route[i]!;
      const b = route[i + 1]!;
      if (a.act === 'glide' || a.act === 'jump' || a.act === 'jumpdash') continue;
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      if (len < 1) continue;
      const dx = (b.x - a.x) / len;
      const dz = (b.z - a.z) / len;
      const n = Math.floor(len / (a.ground ? 2.6 : 4.5));
      for (let k = 0; k < n; k++) {
        const t = (k + lr()) / Math.max(1, n);
        for (const side of [-1, 1]) {
          if (lr() < 0.3) continue;
          const off = (a.ground ? 2.4 : 1.6) + lr() * 2.4;
          const x = a.x + (b.x - a.x) * t - dz * side * off;
          const z = a.z + (b.z - a.z) * t + dx * side * off;
          if (routeNear(route, x, z, 1.8)) continue;
          const gy = groundAtCover(x, z);
          if (!Number.isFinite(gy) || Math.abs(gy - (a.y + (b.y - a.y) * t)) > 1.0) continue;
          placeShrub(x, z, 0.4 + lr() * 0.55);
        }
      }
    }
    // meadow and terrace fields: scattered shrub clumps + litter drifts (no paper grass cards)
    for (let i = 0; i < 520; i++) {
      const x = (lr() * 2 - 1) * 128;
      const z = (lr() * 2 - 1) * 100;
      if (!insideIsland(x, z, 3)) continue;
      if (routeNear(route, x, z, 2.5)) continue;
      if (marshE(x, z) < 1.05) continue;
      if (Math.hypot(x - POND.x, (z - POND.z) * 1.6) < 17) continue;
      if (Math.hypot(x, z + 58) < 17 || (z < -66 && Math.abs(x) < 24)) continue;
      const amberZone = z < 12 && z > -50;
      if (lr() < (amberZone ? 0.35 : 0.6)) placeShrub(x, z, 0.35 + lr() * 0.6);
      else {
        const g = groundAtCover(x, z);
        if (Number.isFinite(g)) litterPatch(bk('litter', x, z, false), lr, x, z, 3.0, amberZone ? 34 : 14, (px, pz) => {
          const gg = groundAtCover(px, pz);
          return Math.abs(gg - g) > 0.5 ? NaN : gg;
        });
      }
    }
    // Amberwood floor: thick leaf fall under each maple
    for (const [x, z] of amber) litterPatch(bk('litter', x, z, false), lr, x, z, 8, 110, (px, pz) => groundAtCover(px, pz));
  }

  // ==================================================================== SATELLITE ISLETS (glide-reachable / backdrop)
  {
    const sats: Array<[number, number, number, number, boolean]> = [
      [-168, -6, -42, 14, true],
      [-150, -10, 40, 9, false],
      [172, 4, -36, 16, true],
      [160, -16, 60, 10, false],
      [-120, 26, -150, 18, true],
      [96, 16, -158, 15, true],
      [0, -8, -168, 12, false],
      [-60, -24, 160, 14, true],
      [70, -30, 150, 11, false],
      [-210, 18, -120, 22, true],
      [220, 10, -110, 20, true],
    ];
    const sr = rng(1111);
    for (let i = 0; i < sats.length; i++) {
      const [x, y, z, rad, ruins] = sats[i]!;
      const ob = new Bucket();
      const sb = new Bucket();
      const lb = new Bucket();
      const bkb = new Bucket();
      const outl = (th: number) => rad * (1 + 0.12 * Math.sin(th * 3 + i) + 0.06 * Math.sin(th * 7 + i * 2));
      islandUnderside(ob, x, z, y, outl, rad * 2.6, 50 + i, 48);
      // top cap
      const cap = new THREE.CircleGeometry(1, 32);
      cap.rotateX(-Math.PI / 2);
      const cp = cap.attributes.position as THREE.BufferAttribute;
      for (let v = 0; v < cp.count; v++) {
        const px = cp.getX(v);
        const pz = cp.getZ(v);
        const th = Math.atan2(pz, px);
        const d = Math.hypot(px, pz);
        const R = outl(th) * d;
        cp.setXYZ(v, x + Math.cos(th) * R, y + (1 - d * d) * rad * 0.12 + 0.1, z + Math.sin(th) * R);
      }
      cap.computeVertexNormals();
      ob.add(cap, undefined, PAL.grassDry.clone().lerp(PAL.moss, 0.4));
      cap.dispose();
      for (let k = 0; k < 6; k++) {
        const th = sr() * Math.PI * 2;
        hangingRoot(bkb, sr, x + Math.cos(th) * outl(th) * 0.9, y - 1, z + Math.sin(th) * outl(th) * 0.9, 6 + sr() * 12, new THREE.Vector2(-Math.cos(th), -Math.sin(th)), 0.3);
      }
      if (ruins) {
        ruinArch(sb, x - rad * 0.2, y + rad * 0.1, z, sr() * 3, { span: 3.6, pillarH: 5 + sr() * 3, seed: 900 + i, broken: sr() * 0.6, pointed: sr() < 0.5 });
        ruinColumn(sb, x + rad * 0.35, y + rad * 0.08, z + rad * 0.2, 4 + sr() * 4, 950 + i, 0.6);
        ruinColumn(sb, x + rad * 0.1, y + rad * 0.1, z - rad * 0.35, 2 + sr() * 5, 970 + i, 0.55);
      }
      maple(bkb, lb, x + rad * 0.3, y + rad * 0.08, z - rad * 0.3, { height: 7 + sr() * 5, trunkR: 0.45, leaf: crownHues[i % 4]!, seed: 1200 + i, density: 0.5, lean: 0.3 });
      for (const [bb, mat] of [[ob, M.rock], [sb, M.stone], [lb, M.leaf], [bkb, M.bark]] as const) {
        const m = bb.toMesh(mat, { cast: false, receive: false });
        if (m) group.add(m);
      }
    }
  }

  // ==================================================================== EMBERS (critical-path breadcrumbs)
  const emberSpots: Array<{ p: THREE.Vector3; value: number }> = [];
  {
    let acc = 0;
    let n = 0;
    for (let i = 0; i < route.length - 1; i++) {
      const a = route[i]!;
      const b = route[i + 1]!;
      const len = Math.hypot(b.x - a.x, b.z - a.z, b.y - a.y);
      const spacing = 3.4;
      for (let d = spacing - acc; d < len; d += spacing) {
        const t = d / len;
        const x = a.x + (b.x - a.x) * t;
        const z = a.z + (b.z - a.z) * t;
        const air = a.act ? Math.sin(t * Math.PI) * (a.act === 'glide' ? 1.5 : 1.6) : 0;
        let y = a.y + (b.y - a.y) * t + air;
        if (!a.act) {
          const g = col.highestAt(x, z);
          if (g > y - 1.5 && g < y + 1.5) y = g;
        }
        if (a.act === 'glide' && len > 30) continue; // long glides: drop motes only near landing
        n++;
        emberSpots.push({ p: new THREE.Vector3(x, y + 0.7, z), value: n % 12 === 0 ? 5 : 1 });
      }
      acc = (acc + len) % spacing;
    }
  }
  const emberTaken = new Array<boolean>(emberSpots.length).fill(false);
  const emberTotal = emberSpots.reduce((s, e) => s + e.value, 0);

  // ==================================================================== ATMOSPHERE: cloud sea sheets under the realm
  {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 256;
    const g = cv.getContext('2d')!;
    const img = g.createImageData(256, 256);
    for (let j = 0; j < 256; j++) {
      for (let i = 0; i < 256; i++) {
        const u = i / 256;
        const v = j / 256;
        const n = fbm3(u * 6, v * 6, 0.5, 4);
        const rr = Math.hypot(u - 0.5, v - 0.5) * 2;
        const a = Math.max(0, Math.min(1, (n - 0.35) * 2.2)) * Math.max(0, 1 - rr * rr);
        const k = (j * 256 + i) * 4;
        img.data[k] = 255;
        img.data[k + 1] = 255;
        img.data[k + 2] = 255;
        img.data[k + 3] = Math.round(a * 255);
      }
    }
    g.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    for (const [y, size, op, rot] of [[-34, 900, 0.55, 0], [-58, 1300, 0.7, 1.3], [-90, 1700, 0.85, 2.1]] as const) {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(size, size),
        new THREE.MeshBasicMaterial({ map: tex, color: 0xead2ae, transparent: true, opacity: op, depthWrite: false, fog: true }),
      );
      m.rotation.set(-Math.PI / 2, 0, rot);
      m.position.y = y;
      m.renderOrder = -1;
      group.add(m);
    }
  }

  // ==================================================================== merge buckets
  let verts = 0;
  const perMat: Record<string, number> = {};
  for (const { b, mat, cast } of buckets.values()) {
    verts += b.vertexCount;
    perMat[mat.name] = (perMat[mat.name] ?? 0) + b.vertexCount;
    const m = b.toMesh(mat, { cast, receive: true, planarUV: mat === M.ground ? 2.6 : undefined });
    if (m) {
      // Canopy / leaf buckets sit between follow-cam and the fox — fade them.
      if (mat.name === 'rv-canopy' || mat.name.includes('leaf') || mat.name.includes('canopy')) {
        m.userData.isOccluder = true;
      }
      group.add(m);
    }
  }
  console.info(`[russetvale] merged ${buckets.size} buckets, ${verts} verts, ${col.colliders.length} colliders, ${emberSpots.length} embers`, JSON.stringify(perMat));

  // ==================================================================== runtime
  const spawnPos = new THREE.Vector3(0, groundRaw(0, 90), 90);
  let lastCheckpoint = 0;
  let wellLit = false;
  let flood = 0;

  const zoneAt = (x: number, z: number) => {
    if (z < -42) return 'E · Wellspring Hill';
    if (marshE(x, z) < 1.15) return 'C · Reedmarsh';
    if (inTerraces(x, z, 0) || x < -95) return 'B · Windmill Rise';
    if (z < 12) return 'D · Amberwood';
    return 'A · Arrival Meadow';
  };

  const realm: Realm = {
    group,
    materials: patchable,
    collision: col,
    terrainY,
    spawnPos,
    wellspringPos: WSP.clone(),
    bounds: { minX: -140, maxX: 140, minZ: -110, maxZ: 110 },
    seedwells,
    checkpoints,
    route,
    emberTotal,
    emberSpots,
    zoneAt,
    bridgeGrown: () => bridgeT,
    wellspringLit: () => wellLit,
    respawnPos() {
      const p = checkpoints[lastCheckpoint]?.pos ?? spawnPos;
      return p.clone();
    },
    setFlood(k) {
      flood = k;
      const arr = loneCol.array as Float32Array;
      for (let i = 0; i < arr.length; i++) arr[i] = loneFaded[i]! + (loneFull[i]! - loneFaded[i]!) * k;
      loneCol.needsUpdate = true;
      wsGlow.emissiveIntensity = 0.1 + k * 2.4;
      wsLight.intensity = k * 60;
    },
    update(dt, t, fox, feetY, colorAt) {
      const ev: RealmEvent[] = [];
      // embers
      for (let i = 0; i < emberSpots.length; i++) {
        const e = emberSpots[i]!;
        if (emberTaken[i]) continue;
        if (Math.abs(fox.x - e.p.x) < 1.2 && Math.abs(fox.z - e.p.z) < 1.2 && Math.abs(fox.y + 0.5 - e.p.y) < 1.4) {
          emberTaken[i] = true;
          ev.push({ type: 'ember', value: e.value, index: i });
        }
      }

      // checkpoints
      for (let i = 0; i < checkpoints.length; i++) {
        const c = checkpoints[i]!;
        if (Math.hypot(fox.x - c.pos.x, fox.z - c.pos.z) < 4.5 && Math.abs(feetY - c.pos.y) < 3) {
          if (!c.lit) {
            c.lit = true;
            ev.push({ type: 'checkpoint', index: i });
          }
          lastCheckpoint = i;
        }
      }
      const litCount = checkpoints.filter((c) => c.lit).length;
      lanternMat.emissiveIntensity = 0.05 + Math.min(1, litCount) * 0.9;

      // seedwells
      for (let i = 0; i < seedwells.length; i++) {
        const s = seedwells[i]!;
        if (!s.lit && fox.distanceTo(s.pos) < 3.6) {
          s.lit = true;
          ev.push({ type: 'seedwell', index: i });
          // seedwell doubles as checkpoint
          checkpoints.push({ pos: s.pos.clone().add(new THREE.Vector3(0, 0, 2.6)), lit: true });
          lastCheckpoint = checkpoints.length - 1;
          if (s.id === 'SW2') inkActive = false;
          if (seedwells.every((q) => q.lit) && !bridgeGrowing) {
            bridgeGrowing = true;
            ev.push({ type: 'bridge' });
          }
        }
        const target = s.lit ? 2.2 + Math.sin(t * 2.2 + i) * 0.25 : 0.0;
        s.glow.emissiveIntensity += (target - s.glow.emissiveIntensity) * Math.min(1, dt * 1.5);
        s.light.intensity += ((s.lit ? 40 : 0) - s.light.intensity) * Math.min(1, dt * 1.5);
      }

      // root bridge growth
      if (bridgeGrowing && bridgeT < 1) {
        bridgeT = Math.min(1, bridgeT + dt / 2.6);
        const e = 1 - Math.pow(1 - bridgeT, 3);
        bridgeMesh.visible = true;
        bridgeMesh.scale.z = Math.max(0.001, e);
        bridgeMesh.position.z = -31.5 * (1 - e);
        if (bridgeT >= 1) bridgeC.enabled = true;
      }

      // ink pools dry after SW2
      if (!inkActive && ink.position.y > MARSH.floor - 1.2) {
        ink.position.y -= dt * 0.35;
        inkMat.roughness = Math.min(0.9, inkMat.roughness + dt * 0.2);
      }

      // ghost-ink stones: solid while touched by colour (aura/trail/restored)
      for (const g of ghosts) {
        const c = Math.max(colorAt(new THREE.Vector3(g.c.x, 0.3, g.c.z)), inkActive ? 0 : 1);
        g.c.enabled = c > 0.4;
        g.solid += ((g.c.enabled ? 1 : 0) - g.solid) * Math.min(1, dt * 6);
        g.mat.opacity = 0.22 + g.solid * 0.78;
        g.mat.transparent = g.solid < 0.98;
        g.mat.depthWrite = g.solid > 0.6;
        g.mat.color.setRGB(0.92 - g.solid * 0.12, 0.86 - g.solid * 0.14, 0.77 - g.solid * 0.17);
      }

      // windmills: turn while in colour before SW1, for good after
      const sw1 = seedwells[0]!.lit;
      for (const m of mills) {
        const live = sw1 || wellLit ? 1 : colorAt(m.pos) > 0.3 ? 1 : 0;
        m.spin += ((live ? (Math.PI * 2) / 10 : 0) - m.spin) * Math.min(1, dt * 0.8);
        m.hub.rotation.z += m.spin * dt;
      }

      // marsh mist drift
      for (const m of mists) {
        const ph = m.userData.phase as number;
        m.position.x += Math.sin(t * 0.07 + ph) * dt * 0.4;
        (m.material as THREE.MeshBasicMaterial).opacity = inkActive ? 0.55 : 0.3;
      }

      // wellspring
      if (!wellLit && Math.hypot(fox.x - WSP.x, fox.z - WSP.z) < 5.2 && feetY > WSP.y - 1.5) {
        wellLit = true;
        ev.push({ type: 'wellspring' });
      }
      if (!wellLit) wsGlow.emissiveIntensity = 0.06 + flood;

      // hazards
      if (inkActive && marshE(fox.x, fox.z) < 0.9 && feetY < MARSH.ink + 0.15) ev.push({ type: 'hazard', kind: 'ink' });
      if (feetY < -24) ev.push({ type: 'hazard', kind: 'fall' });
      void flood;
      return ev;
    },
  };
  return realm;
}

// ---------------------------------------------------------------- helpers

function routeNear(route: Waypoint[], x: number, z: number, r: number): boolean {
  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i]!;
    const b = route[i + 1]!;
    const abx = b.x - a.x;
    const abz = b.z - a.z;
    const L = abx * abx + abz * abz;
    const t = L > 0 ? Math.max(0, Math.min(1, ((x - a.x) * abx + (z - a.z) * abz) / L)) : 0;
    if (Math.hypot(x - a.x - abx * t, z - a.z - abz * t) < r) return true;
  }
  return false;
}

function inTerraces(x: number, z: number, margin: number): boolean {
  const dx = x - TO.x;
  const dz = z - TO.z;
  const s = dx * TD.x + dz * TD.y;
  const t = dx * TN.x + dz * TN.y;
  return s > -8 - margin && s < T_END + margin && Math.abs(t) < 15 + margin;
}

/** Tileable fallen-leaf carpet (multiplies terrain vertex colour): the litter reads dense at zero vertex cost. */
function leafLitterTexture(): THREE.CanvasTexture {
  const N = 512;
  const cv = document.createElement('canvas');
  cv.width = cv.height = N;
  const g = cv.getContext('2d')!;
  g.fillStyle = '#8a7462';
  g.fillRect(0, 0, N, N);
  const r = rng(4242);
  const hues = ['#e2a070', '#d8865a', '#f0c070', '#c86848', '#e8b888', '#b07050', '#f2d0a0', '#a86848'];
  const leaf = (x: number, y: number, s: number, a: number, col: string) => {
    for (const [ox, oy] of [[0, 0], [N, 0], [-N, 0], [0, N], [0, -N]] as const) {
      g.save();
      g.translate(x + ox, y + oy);
      g.rotate(a);
      g.fillStyle = col;
      g.beginPath();
      // five-lobed maple-ish leaf
      for (let k = 0; k <= 10; k++) {
        const t = (k / 10) * Math.PI * 2;
        const lobe = k % 2 === 0 ? 1 : 0.52;
        const rr = s * lobe * (k === 5 ? 0.35 : 1);
        g.lineTo(Math.sin(t) * rr, -Math.cos(t) * rr * 1.05);
      }
      g.closePath();
      g.fill();
      g.strokeStyle = 'rgba(60,30,20,0.35)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(0, s * 0.9);
      g.lineTo(0, -s * 0.8);
      g.stroke();
      g.restore();
    }
  };
  for (let i = 0; i < 1500; i++) {
    const shade = 0.75 + r() * 0.35;
    g.globalAlpha = 0.9;
    leaf(r() * N, r() * N, 7 + r() * 13, r() * 6.28, hues[Math.floor(r() * hues.length)]!);
    g.globalAlpha = 1;
    if (r() < 0.2) {
      g.fillStyle = `rgba(40,25,15,${0.15 * shade})`;
      g.fillRect(r() * N, r() * N, 3, 3);
    }
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
