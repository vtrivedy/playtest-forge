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
  setSite,
  paving,
  talus,
  LEAF_CELL,
} from './russetKit';
import { stoneTextures, rockTextures, barkTextures, groundTextures, leafAtlas } from './russetTextures';

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
  /** Flood tween 0..1 (lone maple, wellspring glow); `pulse` adds an ignition flare to the basin glow/light */
  setFlood: (k: number, pulse?: number) => void;
  /** Harness: un-light the Wellspring so the restore event can be replayed from sepia */
  resetWellspring: () => void;
};

// ---------------------------------------------------------------- island shape

const UP_N = new THREE.Vector3(0, 1, 0);
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

// ---------------------------------------------------------------- trees (x, z, height, crown hue)

const AMBER_TREES: Array<[number, number, number, number]> = [
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

const MEADOW_TREES: Array<[number, number, number, number]> = [
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

/** Tree footprints for leaf drifts: x, z, height. */
const TREE_SPOTS: Array<[number, number, number]> = [...AMBER_TREES, ...MEADOW_TREES].map(([x, z, h]) => [x, z, h]);

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
  // surfaces: world-scaled stone/rock detail, alpha-cut leaf atlas, soil ↔ litter ground blend
  const stoneTex = stoneTextures();
  const rockTex = rockTextures();
  const groundTex = groundTextures();
  const atlas = leafAtlas();
  Object.assign(M.stone, stoneTex);
  M.stone.color.setScalar(1.2);
  M.stone.normalScale.set(0.9, 0.9);
  Object.assign(M.bark, barkTextures());
  M.bark.color.setScalar(1.25);
  Object.assign(M.rock, rockTex);
  M.rock.color.setScalar(1.3);
  M.rock.normalScale.set(1.1, 1.1);
  for (const m of [M.leaf, M.litter]) leafCutout(m, atlas);
  groundBlend(M.terrain, groundTex);
  groundBlend(M.ground, groundTex);
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
      if (m === M.ground) {
        e.b.aux = [];
        e.b.auxDefault = 0.4;
      }
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
  // ground-cap leafiness: drifts under trees and at the summit maple, a worn path and a
  // swept apron at the Wellspring, leaves banked against the plinth
  const SUMMIT_PATH = [
    { x: -6.4, z: -80.5 },
    { x: -4.6, z: -83.6 },
    { x: 0, z: -85.6 },
  ];
  const capLeafy = (x: number, z: number) => {
    let l = 0.36 + (fbm3(x * 0.09, 4, z * 0.09, 2) - 0.5) * 0.55;
    for (const [tx, tz, th] of TREE_SPOTS) {
      const dd = Math.hypot(x - tx, z - tz) / (th * 0.45);
      if (dd < 1.4) l += (1 - dd / 1.4) * 0.5;
    }
    if (z < -80 && Math.abs(x) < 15) {
      l += smooth01(7, 1.5, Math.hypot(x - 8.5, z + 92.5)) * 0.6;
      let dp = 1e9;
      for (let i = 0; i < SUMMIT_PATH.length - 1; i++) {
        const a = SUMMIT_PATH[i]!;
        const b = SUMMIT_PATH[i + 1]!;
        const abx = b.x - a.x;
        const abz = b.z - a.z;
        const t = THREE.MathUtils.clamp(((x - a.x) * abx + (z - a.z) * abz) / (abx * abx + abz * abz), 0, 1);
        dp = Math.min(dp, Math.hypot(x - a.x - abx * t, z - a.z - abz * t));
      }
      l = THREE.MathUtils.lerp(l, 0.04, smooth01(2.2, 0.8, dp));
      const ds = Math.max(Math.abs(x), Math.abs(z + 89));
      if (ds < 5.2) l *= 0.35;
      l += smooth01(3.0, 3.4, ds) * smooth01(4.4, 3.5, ds) * 0.75;
    }
    return THREE.MathUtils.clamp(l, 0, 1);
  };
  const slab = (spec: RockSpec) => {
    rockSlab(bk('rock', spec.x, spec.z), spec);
    if (spec.topColor !== null) groundCap(bk('ground', spec.x, spec.z, false), spec, spec.topColor ?? PAL.soilTop, 0.5, capLeafy);
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
    const leafyArr: number[] = [];
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
        // colour = soil/grass under the litter; leafy = how much litter lies on it
        const pd = pathDist(x, z);
        const me = marshE(x, z);
        const pe = ((x - POND.x) / POND.rx) ** 2 + ((z - POND.z) / POND.rz) ** 2;
        const n1 = fbm3(x * 0.08, 0, z * 0.08, 3);
        const n2 = fbm3(x * 0.03 + 9, 1, z * 0.03, 2);
        const amberK = z < 12 && z > -50 ? smooth01(12, -4, z) : 0;
        // umber soil with golden dry-grass swathes in the open meadow
        const grass = smooth01(0.44, 0.66, n2) * (1 - amberK);
        c.copy(PAL.soilUmber).lerp(PAL.grassDry, grass * 0.9);
        c.lerp(PAL.grassGold, grass * smooth01(0.5, 0.75, n1) * 0.55);
        const nBig = fbm3(x * 0.022 + 5, 2, z * 0.022, 2);
        let leafy = 0.3 + (n1 - 0.5) * 0.45 + (nBig - 0.5) * 0.7 + amberK * 0.55 - grass * 0.2;
        // drifts under every tree canopy
        let tree = 0;
        for (const [tx, tz, th] of TREE_SPOTS) {
          const dd = Math.hypot(x - tx, z - tz) / (th * 0.45);
          if (dd < 1.4) tree = Math.max(tree, 1 - dd / 1.4);
        }
        leafy += tree * 0.6;
        // worn path: packed earth, few leaves, soft verge
        const pathK = smooth01(2.6, 0.9, pd);
        c.lerp(PAL.pathEarth, pathK * 0.85);
        leafy = THREE.MathUtils.lerp(leafy, 0.06, pathK * 0.9) + smooth01(1.6, 3.2, pd) * smooth01(4.5, 3.0, pd) * 0.35; // leaves banked at the verge
        // damp dark banks at the pond and marsh
        const bank = Math.max(smooth01(1.25, 0.85, me), smooth01(1.5, 0.95, pe));
        c.lerp(PAL.bankDamp, bank * 0.9);
        leafy *= 1 - bank * 0.85;
        c.lerp(PAL.rockGrey, rimK * 0.7);
        c.multiplyScalar(0.92 + vnoise3(x * 1.7, 5, z * 1.7) * 0.16);
        leafyArr.push(THREE.MathUtils.clamp(leafy, 0, 1));
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
    for (let i = 0; i < pos.length; i += 3) uvs.push(pos[i]! / GROUND_TILE, pos[i + 2]! / GROUND_TILE);
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setAttribute('leafy', new THREE.Float32BufferAttribute(leafyArr, 1));
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
    const um = ub.toMesh(M.rock, { cast: false, receive: false, boxUV: 4 });
    const rm = rb.toMesh(M.bark, { cast: false, receive: false, boxUV: 2 });
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
    // visual skirt only reaches just under the terrace it stands on (the rest is buried)
    const under = terraces.slice(0, i).filter((o) => o.s0 < tr.s1 && o.s1 > tr.s0).reduce((m, o) => Math.max(m, o.top), -2.5);
    slab({
      x: c.x,
      z: c.z,
      yaw: T_YAW,
      w: tr.w,
      d: len,
      top: tr.top,
      bottom: under - 1.5,
      rough: 0.7,
      seed: 10 + i,
      topColor: PAL.soilUmber.clone().lerp(PAL.grassDry, 0.45),
    });
  }
  // stair flight helper in terrace frame (collider ramp + stone steps)
  type FlightOpts = { crumbleStart?: boolean; crumbleEnd?: boolean };
  const flightT = (s0: number, t0: number, y0: number, s1: number, t1: number, y1: number, width: number, seed: number, o: FlightOpts = {}) => {
    const a = sp(s0, t0);
    const b = sp(s1, t1);
    flight({ x: a.x, z: a.z, y: y0 }, { x: b.x, z: b.z, y: y1 }, width, seed, o);
  };
  /**
   * Stair flight: ramp collider + supported masonry. Sides that abut higher ground (the
   * cliff behind a switchback) stay closed; open sides get a cheek wall down to the foot.
   */
  const flight = (a: { x: number; z: number; y: number }, b: { x: number; z: number; y: number }, width: number, seed: number, o: FlightOpts = {}) => {
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const yaw = Math.atan2(b.x - a.x, b.z - a.z);
    const px = Math.cos(yaw);
    const pz = -Math.sin(yaw);
    let foot = Infinity;
    const open: [boolean, boolean] = [false, false];
    for (const t of [0.2, 0.5, 0.8]) {
      const cx = a.x + (b.x - a.x) * t;
      const cz = a.z + (b.z - a.z) * t;
      const line = a.y + (b.y - a.y) * t;
      foot = Math.min(foot, col.highestAt(cx, cz));
      for (const side of [0, 1] as const) {
        const k = (side === 0 ? -1 : 1) * (width / 2 + 0.9);
        if (col.highestAt(cx + px * k, cz + pz * k) < line - 0.4) open[side] = true;
      }
    }
    foot = Math.max(Math.min(a.y, b.y) - 8, Math.min(foot, Math.min(a.y, b.y)) - 0.3);
    col.add(boxCollider({ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, w: width, d: len, yaw, top: a.y, top1: b.y, bottom: Math.min(a.y, b.y) - 1, tag: 'stair' }));
    stairFlight(bk('stone', a.x, a.z), a, b, width, seed, { open, foot, ...o });
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
  slab({ x: SW1P.x, z: SW1P.z, w: 12.4, d: 12.4, top: 20, bottom: -2, round: true, rough: 0.8, seed: 31, topColor: PAL.soilUmber.clone().lerp(PAL.grassDry, 0.5) });
  {
    const sb = new Bucket();
    hangingSpire(sb, SW1P.x, -1, SW1P.z, 6, 24, 12);
    const m = sb.toMesh(M.rock, { cast: false, boxUV: 4 });
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

  /** Marsh tussock: a low peat mound with a flat walkable crown that slumps into the ink. */
  const hummock = (x: number, z: number, rr: number, top: number, seed: number) => {
    col.add(cylCollider({ x, z, r: rr, top, bottom: -3, tag: 'hummock' }));
    const rings = 9;
    const seg = 28;
    const pos: number[] = [];
    const lf: number[] = [];
    const cc: number[] = [];
    const c = new THREE.Color();
    const pts: THREE.Vector3[][] = [];
    for (let j = 0; j <= rings; j++) {
      const t = j / rings;
      const row: THREE.Vector3[] = [];
      for (let i = 0; i < seg; i++) {
        const a = (i / seg) * Math.PI * 2;
        const wob = 1 + (vnoise3(Math.cos(a) * 1.5 + seed, Math.sin(a) * 1.5, 0) - 0.5) * 0.3;
        const d = t * rr * 1.45 * wob;
        const k = THREE.MathUtils.smoothstep(d, rr * 0.82, rr * 1.4);
        const y = top + (vnoise3(x + Math.cos(a) * d, seed, z + Math.sin(a) * d) - 0.5) * 0.08 * (1 - k) - k * (top - MARSH.ink + 0.5) - k * k * 0.3;
        row.push(new THREE.Vector3(x + Math.cos(a) * d, y, z + Math.sin(a) * d));
      }
      pts.push(row);
    }
    const push = (p: THREE.Vector3, t: number) => {
      pos.push(p.x, p.y, p.z);
      lf.push(THREE.MathUtils.clamp(0.22 - t * 0.3 + (vnoise3(p.x * 0.7, 3, p.z * 0.7) - 0.5) * 0.3, 0, 1));
      c.copy(PAL.bankDamp).lerp(PAL.soilUmber, (1 - t) * 0.55).lerp(PAL.grassDry, (1 - t) * 0.25 * vnoise3(p.x * 0.5, 1, p.z * 0.5));
      cc.push(c.r, c.g, c.b);
    };
    for (let j = 0; j < rings; j++) {
      for (let i = 0; i < seg; i++) {
        const i2 = (i + 1) % seg;
        for (const [jj, ii] of [[j, i], [j + 1, i], [j + 1, i2], [j, i], [j + 1, i2], [j, i2]] as const) push(pts[jj]![ii]!, jj / rings);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(cc, 3));
    g.setAttribute('leafy', new THREE.Float32BufferAttribute(lf, 1));
    g.computeVertexNormals();
    bk('ground', x, z, false).add(g);
    g.dispose();
  };
  /** Mossy rock step (Amberwood boulder route): fractured, soil-capped. */
  const boulderStep = (x: number, z: number, rr: number, top: number, seed: number) => {
    col.add(cylCollider({ x, z, r: rr, top, bottom: -3, tag: 'boulder' }));
    slab({ x, z, w: rr * 2, d: rr * 2, top, bottom: -1.5, round: true, rough: 0.7, seed, topColor: PAL.soilUmber.clone().lerp(PAL.rustMoss, 0.35), overhang: 0.2 });
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
  flight({ x: 90.0, z: 15.0, y: 1.2 }, { x: 92.4, z: 12.6, y: 2.0 }, 2.2, 21);
  const SW2P = new THREE.Vector3(95, 2, 10);
  col.add(cylCollider({ x: SW2P.x, z: SW2P.z, r: 5, top: 2, bottom: -3, tag: 'sw2-island' }));
  slab({ x: SW2P.x, z: SW2P.z, w: 10, d: 10, top: 2, bottom: -2.4, round: true, rough: 0.5, seed: 61, topColor: PAL.stone.clone().lerp(PAL.moss, 0.3) });
  // sunken ruin walls round the island
  ruinArch(bk('stone', 99, 6), 99.5, 2, 6.5, 0.8, { span: 2.6, pillarH: 3, seed: 71, broken: 0.6 });
  ruinColumn(bk('stone', 91, 5), 91, 2, 6.5, 2.2, 72);
  ruinColumn(bk('stone', 100, 13), 99.5, 2, 13.5, 3.4, 73);

  // reeds: rooted stands of bent, tapering blades (some cattails), clustered by a noise mask
  // so the ink keeps open water between them; copper/tan when restored
  {
    const rr = rng(404);
    const c = new THREE.Color();
    const cb = new THREE.Color();
    const ct = new THREE.Color();
    const nrm = new THREE.Vector3();
    const reedTones = [new THREE.Color(0x8a6a42), new THREE.Color(0x9a7a4a), PAL.copper, PAL.russet, new THREE.Color(0x6e5a3a)];
    let placed = 0;
    for (let i = 0; i < 6000 && placed < 190; i++) {
      const x = MARSH.x + (rr() * 2 - 1) * MARSH.rx * 1.08;
      const z = MARSH.z + (rr() * 2 - 1) * MARSH.rz * 1.08;
      const e = marshE(x, z);
      if (e > 1.12) continue;
      if (fbm3(x * 0.09, 7, z * 0.09, 2) < 0.5 - (e > 0.8 ? 0.12 : 0)) continue; // open water
      if (routeNear(route, x, z, 2.4)) continue;
      if (Math.hypot(x - SW2P.x, z - SW2P.z) < 6.5) continue;
      placed++;
      const base = e < 0.85 ? MARSH.ink - 0.05 : groundRaw(x, z) - 0.05;
      const b = bk('reed', x, z, false);
      const n = 10 + Math.floor(rr() * 14);
      const spread = 0.25 + rr() * 0.6;
      const tone = reedTones[Math.floor(rr() * reedTones.length)]!;
      // dark rooted clump at the waterline
      const clump = new THREE.ConeGeometry(spread + 0.25, 0.22, 7, 1, true);
      b.add(clump, trs(x, base + 0.08, z, rr() * 3), PAL.bankDamp.clone().multiplyScalar(0.7));
      clump.dispose();
      for (let k = 0; k < n; k++) {
        const a = rr() * Math.PI * 2;
        const d = Math.sqrt(rr()) * spread;
        const px = x + Math.cos(a) * d;
        const pz = z + Math.sin(a) * d;
        const cattail = rr() < 0.18;
        const h = (cattail ? 1.9 : 1.1) + rr() * 1.4;
        const bendA = a + (rr() - 0.5) * 1.2;
        const bend = cattail ? 0.08 : 0.18 + rr() * 0.45 * (d / spread + 0.4);
        const w = cattail ? 0.022 : 0.03 + rr() * 0.028;
        const wa = bendA + Math.PI / 2 + (rr() - 0.5) * 1.2; // blade faces vary
        const wx = Math.cos(wa) * w;
        const wz = Math.sin(wa) * w;
        c.copy(tone).offsetHSL((rr() - 0.5) * 0.03, (rr() - 0.5) * 0.08, (rr() - 0.5) * 0.12);
        cb.copy(PAL.bankDamp).multiplyScalar(0.8);
        nrm.set(Math.cos(bendA), 0.5, Math.sin(bendA)).normalize();
        const seg = 3;
        let prevL: THREE.Vector3 | null = null;
        let prevR: THREE.Vector3 | null = null;
        let prevC = cb.clone();
        for (let q = 0; q <= seg; q++) {
          const t = q / seg;
          const off = bend * t * t * h;
          const cx = px + Math.cos(bendA) * off;
          const cz = pz + Math.sin(bendA) * off;
          const cy = base + h * t - off * 0.35;
          const tw = 1 - t * 0.92;
          const L = new THREE.Vector3(cx - wx * tw, cy, cz - wz * tw);
          const R = new THREE.Vector3(cx + wx * tw, cy, cz + wz * tw);
          ct.copy(cb).lerp(c, Math.min(1, t * 2.2)).multiplyScalar(t > 0.85 ? 1.12 : 1);
          if (prevL && prevR) {
            b.tri(prevL, prevR, R, nrm, prevC, prevC, ct);
            b.tri(prevL, R, L, nrm, prevC, ct, ct);
          }
          prevL = L;
          prevR = R;
          prevC = ct.clone();
        }
        if (cattail && prevL) {
          const head = new THREE.CylinderGeometry(0.045, 0.04, 0.28, 6);
          b.add(head, trs((prevL.x + prevR!.x) / 2, prevL.y - 0.2, (prevL.z + prevR!.z) / 2), new THREE.Color(0x4a2e1c));
          head.dispose();
        }
      }
    }
  }

  // Pockets' stilt hut (60, 52) y3
  {
    const hx = 60;
    const hz = 52;
    const hy = 3;
    col.add(boxCollider({ x: hx, z: hz, w: 8, d: 8, top: hy, bottom: hy - 0.5, tag: 'hut-deck' }));
    flight({ x: 60, z: 59.5, y: 0.3 }, { x: 60, z: 56.2, y: 3 }, 1.8, 81);
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
    m.position.set(MARSH.x + Math.cos(a) * MARSH.rx * d, -1.32 + r() * 0.2, MARSH.z + Math.sin(a) * MARSH.rz * d);
    m.scale.setScalar(12 + r() * 12);
    m.rotation.x = -Math.PI / 2 + 0.06; // hugs the ink: never veils the tussocks or boardwalk
    m.userData.phase = r() * 6.28;
    mists.push(m);
    group.add(m);
  }

  // ==================================================================== AMBERWOOD
  // canopy route: boulder steps → leaning branch → bounce crown pads spiralling the hollow Seedwell maple
  const SW3P = new THREE.Vector3(-10, 17.5, -36);
  boulderStep(12, -14, 1.8, 1.5, 91);
  boulderStep(9.5, -16.5, 1.6, 3.0, 92);
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
    // leaf mat: forked branches under a thin twig mat, a lighter top band of flat leaves
    // (reads as a landing from below and above), drooping sprays hide the rim
    const lb = bk('leaf', x, z);
    const tw = bk('bark', x, z);
    const mat = new THREE.CylinderGeometry(rad * 0.82, rad * 0.55, 0.28, 14);
    tw.add(mat, trs(x, top - 0.2, z), PAL.leafBrown.clone().multiplyScalar(0.55));
    mat.dispose();
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 + r();
      const tube = new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3([
          new THREE.Vector3(x, top - 0.6, z),
          new THREE.Vector3(x + Math.cos(a) * rad * 0.5, top - 0.32, z + Math.sin(a) * rad * 0.5),
          new THREE.Vector3(x + Math.cos(a) * rad * 0.95, top - 0.18 + r() * 0.1, z + Math.sin(a) * rad * 0.95),
        ]),
        6,
        0.12,
        5,
        false,
      );
      tw.add(tube, undefined, PAL.bark);
      tube.dispose();
    }
    const nn = new THREE.Vector3();
    const c = new THREE.Color();
    const hueSet = [PAL.maple, PAL.russet, PAL.amber, PAL.gold];
    const padHue = hueSet[i % 4]!;
    for (let k = 0; k < rad * rad * 26; k++) {
      const a = r() * Math.PI * 2;
      const d = Math.sqrt(r()) * rad * 0.95;
      nn.set(Math.cos(a) * d * 0.08, 1, Math.sin(a) * d * 0.08).normalize();
      c.copy(r() < 0.75 ? padHue : LEAF_COLORS[Math.floor(r() * 4)]!).offsetHSL(0, 0, 0.04 + (r() - 0.5) * 0.1);
      pushLeaf(lb, x + Math.cos(a) * d, top + 0.03 + r() * 0.08, z + Math.sin(a) * d, 0.6 + r() * 0.45, r() * 6.28, -Math.PI / 2 + (r() - 0.5) * 0.35, (r() - 0.5) * 0.35, c, nn, r() < 0.5 ? LEAF_CELL.single : LEAF_CELL.spray, r() < 0.5);
    }
    const rim = Math.round(Math.PI * 2 * rad * 3.2);
    for (let k = 0; k < rim; k++) {
      const a = (k / rim) * Math.PI * 2 + (r() - 0.5) * 0.3;
      const d = rad * (0.82 + r() * 0.2);
      const droop = 0.5 + r() * 0.7;
      nn.set(Math.cos(a), 0.6, Math.sin(a)).normalize();
      c.copy(padHue).offsetHSL((r() - 0.5) * 0.04, 0, (r() - 0.5) * 0.12).multiplyScalar(0.72 + r() * 0.2);
      const s = 0.8 + r() * 0.5;
      // card base at the rim, tip hanging outward and down
      pushLeaf(lb, x + Math.cos(a) * (d + s * 0.3), top - s * 0.18 * droop, z + Math.sin(a) * (d + s * 0.3), s, Math.atan2(Math.cos(a), Math.sin(a)) + (r() - 0.5) * 0.5, -Math.PI / 2 + droop, (r() - 0.5) * 0.4, c, nn, r() < 0.7 ? LEAF_CELL.spray : LEAF_CELL.sparse, r() < 0.5);
    }
    for (let k = 0; k < rad * 4; k++) {
      const a = r() * Math.PI * 2;
      const d = r() * rad * 0.7;
      c.copy(padHue).multiplyScalar(0.45);
      pushLeaf(lb, x + Math.cos(a) * d, top - 0.45 - r() * 0.3, z + Math.sin(a) * d, 0.9 + r() * 0.4, r() * 6.28, 0.3 + r() * 0.6, r() * 6.28, c, UP_N, LEAF_CELL.spray, r() < 0.5);
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
  slab({ x: 0, z: -31.2, w: 5.2, d: 5.2, top: 8, bottom: -1, round: true, rough: 0.6, seed: 95, topColor: PAL.soilUmber });

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
    const mesh = b.toMesh(M.bark, { boxUV: 2 })!;
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
  const crownHues = [PAL.maple, PAL.russet, PAL.amber, PAL.gold];
  for (let i = 0; i < AMBER_TREES.length; i++) {
    const [x, z, h, ci] = AMBER_TREES[i]!;
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
  slab({ x: 0, z: -58, w: ARENA.r * 2, d: ARENA.r * 2, top: ARENA.top, bottom: -3, round: true, rough: 0.9, seed: 101, topColor: PAL.soilUmber.clone().lerp(PAL.rockDust, 0.5) });
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
      bottom: i === 0 ? -4 : rows[i - 1]!.top - 1.5,
      rough: 0.8,
      seed: 130 + i,
      topColor: PAL.soilUmber.clone().lerp(PAL.grassDry, 0.3),
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
  // talus fillets banked into the inside corners at the row ends (clear of stairs and ruins);
  // low ramp colliders so feet follow the scree without opening a shortcut up the rows
  const fillets: Array<[number, number, number]> = [
    // row index (strip on top of it), x0, x1
    [0, 9.8, 16.6],
    [1, -15.6, -9.8],
    [2, 11.6, 14.9],
    [3, 10.0, 13.9],
    [3, -13.9, -10.0],
  ];
  for (let k = 0; k < fillets.length; k++) {
    const [ri, x0, x1] = fillets[k]!;
    const lo = rows[ri]!;
    const face = rows[ri + 1]!.z0;
    const hgt = 2.2 + ((k * 37) % 5) * 0.2;
    talus(bk('rock', (x0 + x1) / 2, face), x0, x1, face, 1, 2.8, lo.top, hgt, 1900 + k);
    col.add(boxCollider({ x: (x0 + x1) / 2, z: face + 1.0, w: x1 - x0 - 1.2, d: 2.0, yaw: Math.PI, top: lo.top + 0.3, top1: lo.top + hgt * 0.7, bottom: lo.top - 1, tag: 'talus' }));
    const tr = rng(1950 + k);
    for (let q = 0; q < 3; q++) {
      const bx = x0 + 0.8 + tr() * (x1 - x0 - 1.6);
      boulder(bk('rock', bx, face), bx, lo.top + 0.4 + tr() * 0.6, face + 0.6 + tr() * 1.4, 0.35 + tr() * 0.45, 1960 + k * 5 + q, 0.7);
    }
  }
  // fractured spurs on the flanks: clusters of tall jointed columns break the stepped profile
  const spurs: Array<{ x: number; z: number; r: number; top: number; n: number }> = [
    { x: 20.4, z: -86, r: 3.4, top: 31, n: 3 },
    { x: 18.8, z: -72.4, r: 2.2, top: 21, n: 2 },
    { x: -19.8, z: -82, r: 2.8, top: 27.2, n: 3 },
    { x: -18.4, z: -94, r: 2.6, top: 34.5, n: 2 },
  ];
  for (let k = 0; k < spurs.length; k++) {
    const sp2 = spurs[k]!;
    const tr = rng(2050 + k);
    for (let q = 0; q < sp2.n; q++) {
      const a = (q / sp2.n) * Math.PI * 2 + tr() * 1.5;
      const d = q === 0 ? 0 : sp2.r * (0.55 + tr() * 0.3);
      const cx = sp2.x + Math.cos(a) * d;
      const cz = sp2.z + Math.sin(a) * d;
      const w = 2.2 + tr() * 1.6;
      const dd = 2.0 + tr() * 1.6;
      const top = sp2.top - q * (2.2 + tr() * 2.4);
      const yaw = tr() * Math.PI;
      slab({ x: cx, z: cz, w, d: dd, yaw, top, bottom: -6, rough: 1.0, seed: 1990 + k * 7 + q, topColor: null, overhang: 0.7, roughTop: 0.9 });
      col.add(boxCollider({ x: cx, z: cz, w: w * 0.85, d: dd * 0.85, yaw, top: top - 0.35, bottom: -6, tag: 'spur' }));
      if (q === 0) shrub(bk('leaf', cx, cz, false), tr, cx + (tr() - 0.5), top, cz + (tr() - 0.5), 0.6 + tr() * 0.4, [PAL.maple, PAL.russet, PAL.amber][k % 3]!);
      for (let h2 = 0; h2 < 2; h2++) hangingRoot(bk('bark', cx, cz), tr, cx + (tr() - 0.5) * w * 0.7, top - 0.3, cz + (tr() - 0.5) * dd * 0.7, 2 + tr() * 4, new THREE.Vector2(0, 0), 0.07 + tr() * 0.07);
    }
  }
  // foliage spilling over the row lips: hanging sprays soften the long shelf edges
  {
    const dr = rng(2101);
    const drapeHues = [PAL.russet, PAL.maple, PAL.amber, PAL.leafBrown, PAL.crimson, PAL.copper];
    for (let i = 0; i < rows.length; i++) {
      const rw = rows[i]!;
      for (let x = -rw.hw + 0.8; x < rw.hw - 0.8; x += 0.55 + dr() * 0.7) {
        if (Math.abs(x) < 8.4) continue; // stair lanes
        if (fbm3(x * 0.25, i * 3.1, 2, 2) < 0.42) continue;
        const lb = bk('leaf', x, rw.z0, false);
        const hue = drapeHues[Math.floor(dr() * drapeHues.length)]!;
        const n = 2 + Math.floor(dr() * 3);
        for (let k = 0; k < n; k++) {
          const sz = 0.8 + dr() * 0.9;
          const c = hue.clone().offsetHSL(0, (dr() - 0.5) * 0.1, (dr() - 0.5) * 0.12).multiplyScalar(0.75 + dr() * 0.25);
          // card hangs down the face: rolled upside down so the twig end sits on the lip
          pushLeaf(lb, x + (dr() - 0.5) * 0.5, rw.top - sz * 0.38 - dr() * 0.3, rw.z0 + 0.12 + dr() * 0.18, sz, (dr() - 0.5) * 0.5, -0.12 - dr() * 0.25, Math.PI + (dr() - 0.5) * 0.6, c, new THREE.Vector3(0, 0.4, 1).normalize(), dr() < 0.6 ? LEAF_CELL.spray : LEAF_CELL.sparse, dr() < 0.5);
        }
        if (dr() < 0.35) shrub(bk('leaf', x, rw.z0, false), dr, x, rw.top, rw.z0 - 0.6, 0.4 + dr() * 0.4, hue);
      }
    }
  }
  // the hill's mass continues below to the ground (one chunky base)
  slab({ x: 0, z: -88, w: 40, d: 20, top: 16, bottom: -4, rough: 1.0, seed: 140, topColor: null });
  // switchback flights
  flight({ x: 6.6, z: -68.7, y: 12 }, { x: -6.6, z: -68.7, y: 17.2 }, 2.4, 150);
  flight({ x: -6.6, z: -71.5, y: 17.2 }, { x: 6.6, z: -71.5, y: 22.4 }, 2.4, 151);
  // broken flight 3 (3.0 m gap, near-level)
  flight({ x: 6.6, z: -74.5, y: 22.4 }, { x: 1.5, z: -74.5, y: 24.3 }, 2.4, 152, { crumbleEnd: true });
  flight({ x: -1.5, z: -74.5, y: 24.4 }, { x: -6.6, z: -74.5, y: 27.6 }, 2.4, 153, { crumbleStart: true });
  // broken flight 4 (3.6 m gap, near-level)
  flight({ x: -6.6, z: -77.5, y: 27.6 }, { x: -1.8, z: -77.5, y: 29.4 }, 2.4, 154, { crumbleEnd: true });
  flight({ x: 1.8, z: -77.5, y: 29.6 }, { x: 6.6, z: -77.5, y: 32.8 }, 2.4, 155, { crumbleStart: true });
  flight({ x: 6.6, z: -80.5, y: 32.8 }, { x: -6.6, z: -80.5, y: 38 }, 2.6, 156);
  // ruins on the rows (arches, columns) — key-art silhouette
  ruinArch(bk('stone', -12, -71), -12, 17.2, -71.6, 0, { span: 3.2, pillarH: 3.8, seed: 160, pointed: true });
  ruinArch(bk('stone', 12, -74), 12.5, 22.4, -74.6, 0.1, { span: 2.8, pillarH: 3.2, seed: 161, broken: 0.6 });
  ruinArch(bk('stone', -11, -77), -11, 27.6, -77.6, -0.1, { span: 3, pillarH: 3.6, seed: 162, broken: 0.3 });
  ruinColumn(bk('stone', 10, -78), 10.5, 27.6, -77.8, 2.6, 163);
  ruinColumn(bk('stone', -10, -81), -8.7, 32.8, -80.9, 3.4, 164);
  ruinColumn(bk('stone', 11, -81), 8.9, 32.8, -80.7, 1.6, 165);

  // summit: domed Ember Wellspring shrine + arches + the lone maple
  const WSP = new THREE.Vector3(0, 38, -89);
  const wsGlow = glowMat('rv-glow-wellspring');
  const wsGlowB = new Bucket();
  domedShrine(bk('stone', 0, -89), wsGlowB, WSP.x, WSP.y, WSP.z, 1.3, 170);
  col.add(boxCollider({ x: WSP.x, z: WSP.z, w: 6.0, d: 6.0, top: WSP.y + 0.5, bottom: WSP.y - 1, tag: 'shrine-plinth' }));
  ruinArch(bk('stone', -8, -88), -8.5, 38, -86.5, 0.25, { span: 3.4, pillarH: 4.4, seed: 171, pointed: true });
  ruinArch(bk('stone', -7, -94), -6.5, 38, -94, -0.3, { span: 3, pillarH: 3.6, seed: 172, broken: 0.5 });
  ruinColumn(bk('stone', 9, -85), 9, 38, -84.5, 2.2, 173);
  // swept flagstone apron round the plinth (ragged outer edge), broken flags along the
  // worn path from the stair head, leaf drifts banked at the plinth corners and arch feet
  {
    const sb = bk('stone', 0, -89);
    setSite(37.5, 40);
    paving(sb, trs(0, 0, -89), 10, 10, 38, 175, 0.1, (px, pz) => {
      const ds = Math.max(Math.abs(px), Math.abs(pz));
      return ds > 3.1 && ds < 4.1 + vnoise3(px * 0.7, 2, pz * 0.7) * 1.1;
    });
    const pr = rng(176);
    for (let i = 0; i < SUMMIT_PATH.length - 1; i++) {
      const a = SUMMIT_PATH[i]!;
      const b = SUMMIT_PATH[i + 1]!;
      const L = Math.hypot(b.x - a.x, b.z - a.z);
      const yaw = Math.atan2(b.x - a.x, b.z - a.z);
      for (let d = 0.4; d < L; d += 0.72) {
        for (const side of [-0.45, 0.45]) {
          if (pr() < 0.3) continue;
          const px = a.x + ((b.x - a.x) * d) / L + Math.cos(yaw) * side;
          const pz = a.z + ((b.z - a.z) * d) / L - Math.sin(yaw) * side;
          stoneBlock(sb, trs(px, 38.01, pz, yaw + (pr() - 0.5) * 0.3, 1, 1, 1, (pr() - 0.5) * 0.04, (pr() - 0.5) * 0.04), 0.8 + pr() * 0.3, 0.12, 0.62 + pr() * 0.2, 1770 + Math.round(d * 10) + (side > 0 ? 1 : 0), 0.2);
        }
      }
    }
    const lr2 = rng(177);
    const onSummit = (px: number, pz: number) => col.highestAt(px, pz);
    for (const [px, pz, rad, n] of [
      [-3.4, -85.6, 1.3, 70], [3.4, -85.6, 1.1, 55], [-3.5, -92.4, 1.4, 70], [3.5, -92.3, 1.2, 60],
      [8.5, -92.5, 3.2, 220], [6.4, -90.5, 1.6, 70], [-8.5, -86.4, 1.4, 60], [-6.6, -94, 1.6, 70], [9, -84.5, 1.0, 40],
      [-11.5, -84, 1.6, 50], [11.5, -96, 2.0, 70], [-2, -96.5, 1.8, 60],
    ] as const) {
      litterPatch(bk('litter', px, pz, false), lr2, px, pz, rad, n, onSummit);
    }
  }
  // stairs down the summit's front (key art: stair flight to the shrine)
  // lone maple — keeps a faint russet before the flood, flares after
  const loneMat = new THREE.MeshStandardMaterial({ name: 'rv-lone-maple', vertexColors: true, roughness: 0.75, side: THREE.DoubleSide });
  leafCutout(loneMat, atlas);
  const loneLeaves = new Bucket();
  const loneBark = bk('bark', 8, -92);
  maple(loneBark, loneLeaves, 8.5, 38, -92.5, { height: 15, trunkR: 0.9, lean: 0.28, leaf: PAL.maple, seed: 999, crownR: 4.2, density: 2.4 });
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
  (pond.material.uniforms.uSky!.value as THREE.Color).set(0x5e5244);
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
  for (let i = 0; i < MEADOW_TREES.length; i++) {
    const [x, z, h, ci] = MEADOW_TREES[i]!;
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
    // red thickets: dense bush masses banked against tree roots and the meadow's edges
    // (the key art's flaming foreground; the 10 % accent once restored)
    {
      const thr = rng(2201);
      const thHues = [PAL.maple, PAL.crimson, PAL.russet, PAL.maple, PAL.amber];
      let made = 0;
      for (let i = 0; i < 400 && made < 46; i++) {
        let x: number;
        let z: number;
        if (i % 2 === 0) {
          const [tx, tz, th] = TREE_SPOTS[Math.floor(thr() * TREE_SPOTS.length)]!;
          const a = thr() * Math.PI * 2;
          const d = th * (0.12 + thr() * 0.22);
          x = tx + Math.cos(a) * d;
          z = tz + Math.sin(a) * d;
        } else {
          const th = thr() * Math.PI * 2;
          const R = outlineR(th) - 4 - thr() * 10;
          x = Math.cos(th) * R;
          z = Math.sin(th) * R;
        }
        if (!insideIsland(x, z, 3) || routeNear(route, x, z, 3.2) || marshE(x, z) < 1.2 || inTerraces(x, z, 3)) continue;
        if (Math.hypot(x - POND.x, (z - POND.z) * 1.6) < 18 || z < -50) continue;
        made++;
        const n = 4 + Math.floor(thr() * 5);
        for (let k = 0; k < n; k++) {
          const a = thr() * Math.PI * 2;
          const d = Math.sqrt(thr()) * 2.4;
          const px = x + Math.cos(a) * d;
          const pz = z + Math.sin(a) * d;
          if (routeNear(route, px, pz, 2.2)) continue;
          const g = groundAtCover(px, pz);
          if (!Number.isFinite(g)) continue;
          shrub(bk('leaf', px, pz, false), thr, px, g, pz, 0.7 + thr() * 0.6, thHues[Math.floor(thr() * thHues.length)]!);
        }
        litterPatch(bk('litter', x, z, false), thr, x, z, 3.2, 26, (px, pz) => groundAtCover(px, pz));
      }
    }
    // Amberwood floor: thick leaf fall under each maple
    for (const [x, z] of AMBER_TREES) litterPatch(bk('litter', x, z, false), lr, x, z, 8, 110, (px, pz) => groundAtCover(px, pz));
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
        const m = bb.toMesh(mat, { cast: false, receive: false, boxUV: mat === M.rock ? 4 : mat === M.stone ? 1.6 : mat === M.bark ? 2 : undefined });
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
    const m = b.toMesh(mat, { cast, receive: true, planarUV: mat === M.ground ? GROUND_TILE : undefined, boxUV: mat === M.stone ? 1.6 : mat === M.rock ? 4 : mat === M.bark ? 2 : undefined });
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
    resetWellspring() {
      wellLit = false;
      realm.setFlood(0);
    },
    setFlood(k, pulse = 0) {
      flood = k;
      const arr = loneCol.array as Float32Array;
      for (let i = 0; i < arr.length; i++) arr[i] = loneFaded[i]! + (loneFull[i]! - loneFaded[i]!) * k;
      loneCol.needsUpdate = true;
      wsGlow.emissiveIntensity = 0.1 + k * 2.4 + pulse;
      wsLight.intensity = k * 60 + pulse * 8;
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

const GROUND_TILE = 4.4;

/**
 * Alpha-cut leaf cards. Mip averaging thins alpha below the cutoff at distance, so far
 * crowns would go bald; alpha is boosted with the sampled mip level to keep coverage.
 */
function leafCutout(mat: THREE.MeshStandardMaterial, atlas: THREE.Texture): void {
  mat.map = atlas;
  mat.alphaTest = 0.45;
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    prev.call(mat, shader, renderer);
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <alphatest_fragment>',
      `#ifdef USE_MAP
        vec2 lfSz = vec2(textureSize(map, 0));
        vec2 lfDx = dFdx(vMapUv * lfSz);
        vec2 lfDy = dFdy(vMapUv * lfSz);
        float lfLod = max(0.0, 0.5 * log2(max(dot(lfDx, lfDx), dot(lfDy, lfDy))));
        diffuseColor.a *= 1.0 + lfLod * 0.3;
      #endif
      #include <alphatest_fragment>`,
    );
  };
}

/**
 * Ground = packed soil (tinted by vertex colour) with a litter layer on top. The leaf
 * texture's alpha is a per-leaf rank: a leaf shows only where rank > 1 − leafiness, so
 * worn paths thin out leaf by leaf into drifts. Leaves take their own autumn hue from
 * the rank (mostly brown, some russet/amber/gold, a little maple red) — the 70/20/10 mix.
 */
function groundBlend(mat: THREE.MeshStandardMaterial, tex: { leaf: THREE.Texture; soil: THREE.Texture }): void {
  mat.map = tex.leaf;
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    prev.call(mat, shader, renderer);
    shader.uniforms.uSoil = { value: tex.soil };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float leafy;
        varying float vLeafy;
        varying vec3 vGPos;`)
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        vLeafy = leafy;
        vGPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform sampler2D uSoil;
        varying float vLeafy;
        varying vec3 vGPos;
        float gHash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
        float gNoise(vec2 p) {
          vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(gHash(i), gHash(i + vec2(1, 0)), u.x), mix(gHash(i + vec2(0, 1)), gHash(i + vec2(1, 1)), u.x), u.y);
        }
        vec3 gLeafHue(float k) {
          float h = fract(k * 7.31);
          if (h < 0.30) return vec3(0.43, 0.24, 0.13);  // leaf brown
          if (h < 0.48) return vec3(0.66, 0.27, 0.12);  // russet
          if (h < 0.62) return vec3(0.82, 0.50, 0.17);  // amber
          if (h < 0.76) return vec3(0.76, 0.60, 0.29);  // gold
          if (h < 0.84) return vec3(0.55, 0.40, 0.25);  // dull tan
          if (h < 0.94) return vec3(0.70, 0.20, 0.12);  // maple red
          return vec3(0.52, 0.14, 0.09);                // crimson
        }`)
      .replace('#include <map_fragment>', `
        vec4 gLeaf = texture2D(map, vMapUv);
        vec3 gSoil = texture2D(uSoil, vMapUv * 0.71 + vec2(0.31, 0.57)).rgb;
        float gLm = vLeafy + (gNoise(vGPos.xz * 0.16) - 0.5) * 0.5 + (gNoise(vGPos.xz * 0.63 + 7.0) - 0.5) * 0.22;
        float gVis = smoothstep(0.96 - gLm, 1.04 - gLm, gLeaf.a) * step(0.03, gLeaf.a);`)
      .replace('#include <color_fragment>', `
        // regional drift of the litter's dominant hue: maple-red hollows, gold swathes, brown elsewhere
        float gReg = gNoise(vGPos.xz * 0.028 + 11.0) * 0.7 + gNoise(vGPos.xz * 0.07 + 3.0) * 0.3;
        vec3 gHue = gLeafHue(gLeaf.a);
        float gTake = step(fract(gLeaf.a * 5.37), 0.72);
        gHue = mix(gHue, fract(gLeaf.a * 3.7) < 0.5 ? vec3(0.70, 0.20, 0.12) : vec3(0.66, 0.27, 0.12), smoothstep(0.58, 0.74, gReg) * gTake);
        gHue = mix(gHue, fract(gLeaf.a * 3.7) < 0.5 ? vec3(0.76, 0.60, 0.29) : vec3(0.82, 0.50, 0.17), smoothstep(0.42, 0.28, gReg) * gTake);
        vec3 gLeafCol = gLeaf.rgb * gHue * mix(vec3(1.0), vColor.rgb * 1.6, 0.2);
        diffuseColor.rgb *= mix(gSoil * vColor.rgb, gLeafCol * 1.15, gVis);`);
  };
  mat.needsUpdate = true;
}
