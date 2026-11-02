/**
 * Millbrook, the west expansion (DESIGN-millbrook.md): pure layout data + the terrain it adds.
 * layout.ts folds `westBase` / `westRimE` into groundH; region modules place from these anchors.
 * No imports from layout.ts (it imports this file and evaluates terrain at module load).
 */
import * as THREE from 'three';

type P2 = readonly [number, number];
const { smoothstep } = THREE.MathUtils;

/** sunken leaf lane from the last cottage out through the rim to the valley */
export const LANE: ReadonlyArray<P2> = [[-36.5, 88.6], [-46, 90.6], [-55, 88.8], [-63.5, 86.6]];
const LANE_HALF = 4.4;

/** the brook, north (upstream) → south */
export const BROOK: ReadonlyArray<P2> = [[-72.5, 114], [-74.2, 106], [-75.6, 100], [-77.4, 93], [-79, 87], [-81.4, 80.5], [-81.2, 73], [-83.2, 65], [-85.5, 54]];
const BROOK_NOTCH = 3.0;

/** polyline point at arc length s (m) and the unit tangent there */
function along(line: ReadonlyArray<P2>, s: number): { x: number; z: number; tx: number; tz: number } {
  let left = s;
  for (let i = 0; i + 1 < line.length; i++) {
    const [ax, az] = line[i]!;
    const [bx, bz] = line[i + 1]!;
    const len = Math.hypot(bx - ax, bz - az);
    if (left <= len || i + 2 === line.length) {
      const t = Math.min(1, left / len);
      return { x: ax + (bx - ax) * t, z: az + (bz - az) * t, tx: (bx - ax) / len, tz: (bz - az) / len };
    }
    left -= len;
  }
  return { x: line[0]![0], z: line[0]![1], tx: 0, tz: 1 };
}
/** distance to a polyline and the arc length of the nearest point */
export function polyDist(line: ReadonlyArray<P2>, x: number, z: number): { d: number; s: number } {
  let best = Infinity;
  let bestS = 0;
  let acc = 0;
  for (let i = 0; i + 1 < line.length; i++) {
    const [ax, az] = line[i]!;
    const [bx, bz] = line[i + 1]!;
    const dx = bx - ax;
    const dz = bz - az;
    const l2 = dx * dx + dz * dz;
    const t = Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / l2));
    const d = Math.hypot(x - ax - t * dx, z - az - t * dz);
    if (d < best) {
      best = d;
      bestS = acc + t * Math.sqrt(l2);
    }
    acc += Math.sqrt(l2);
  }
  return { d: best, s: bestS };
}
export const brookLength = (() => {
  let a = 0;
  for (let i = 0; i + 1 < BROOK.length; i++) a += Math.hypot(BROOK[i + 1]![0] - BROOK[i]![0], BROOK[i + 1]![1] - BROOK[i]![1]);
  return a;
})();
export const brookAt = (s: number) => along(BROOK, s);

/** valley floor: falls gently north → south so the brook has somewhere to go */
export function westFloor(z: number): number {
  return -0.9 - (106 - z) * 0.016;
}
/** brook water surface at (x, z) (by the nearest brook point) */
export function waterY(z: number): number {
  return westFloor(z) - 0.38;
}

export const MILLBROOK = (() => {
  const wheelS = polyDist(BROOK, -76.7, 96.4).s;
  const w = brookAt(wheelS);
  // east bank normal (flow turned right: (tz, −tx) points east here)
  const nx = -w.tz;
  const nz = w.tx;
  const east = nx > 0 ? 1 : -1;
  const damS = wheelS - 5.2;
  const d = brookAt(damS);
  const bridgeS = polyDist(BROOK, -79, 87).s;
  const stonesS = polyDist(BROOK, -81.4, 77).s;
  const mill = { x: w.x + nx * east * 4.4, z: w.z + nz * east * 4.4 };
  return {
    valley: { cx: -80, cz: 84, rx: 22, rz: 21 },
    /** west hilltop: plateau radius `r`, `rise` above the floor */
    lookout: { x: -100.5, z: 71, r: 4.6, rise: 6.4 },
    /** the stopped waterwheel in the brook; axle runs across the flow into the mill's west wall */
    wheel: { x: w.x, z: w.z, s: wheelS, r: 1.75, yaw: Math.atan2(w.tx, w.tz), across: { x: nx * east, z: nz * east } },
    /** mill house on the east bank, its long wall to the brook; yaw turns local +z toward the brook */
    mill: { ...mill, w: 6.4, d: 5.0, yaw: Math.atan2(-nx * east, -nz * east) },
    /** leaf dam choking the brook just upstream of the wheel */
    dam: { x: d.x, z: d.z, s: damS, yaw: Math.atan2(d.tx, d.tz) },
    bridge: { ...brookAt(bridgeS), s: bridgeS },
    stones: { ...brookAt(stonesS), s: stonesS },
    /** the cold malting kiln east of the mill (an updraft hearth once the bellows work) */
    kiln: (() => {
      const yaw = Math.atan2(-nx * east, -nz * east);
      const ex = -Math.sin(yaw);
      const ez = -Math.cos(yaw);
      return { x: mill.x + ex * 6.2 + Math.cos(yaw) * 2.5, z: mill.z + ez * 6.2 - Math.sin(yaw) * 2.5, height: 12 };
    })(),
    /** the Weir Stones: a column shelf on the north rim, the brook's spring falling off its west lip */
    weir: { x: -70.5, z: 106.5, yaw: Math.PI, half: 3.4, top: 6.6, lip: { x: -1, z: 0 }, fall: { x: -74.1, z: 106.2 } },
    /** hay field on the east bank south of the lane */
    hay: { x: -68.5, z: 74.5, w: 11, d: 10 },
  };
})();

/** footpaths inside Millbrook (pathDist flattens + colours them like the village lanes) */
export const WEST_PATHS: ReadonlyArray<readonly [number, number, number, number]> = (() => {
  const B = MILLBROOK.bridge;
  const S = MILLBROOK.stones;
  const M = MILLBROOK.mill;
  const L = MILLBROOK.lookout;
  const segs: Array<[number, number, number, number]> = [];
  const chain = (pts: ReadonlyArray<P2>) => {
    for (let i = 0; i + 1 < pts.length; i++) segs.push([pts[i]![0], pts[i]![1], pts[i + 1]![0], pts[i + 1]![1]]);
  };
  chain(LANE);
  chain([LANE[LANE.length - 1]!, [-70, 87.6], [B.x + 2.2, B.z + 0.4]]);
  chain([[B.x - 2.2, B.z - 0.6], [-88, 84.5], [-93.5, 80.5], [-95.5, 75.5], [L.x + 2.6, L.z + 1.6]]);
  chain([[-70, 87.6], [M.x + 0.5, M.z - 3.6]]);
  chain([[-70, 87.6], [-73.4, 80.4], [S.x + 2.4, S.z + 0.3]]);
  chain([[S.x - 2.4, S.z - 0.2], [-90, 75.5], [-95.5, 75.5]]);
  return segs;
})();

/** smooth min (polynomial, blend width k) */
function smin(a: number, b: number, k: number): number {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

/** metres outside the west play shape (negative inside): valley ∪ lookout ∪ lane ∪ brook notches */
export function westE(x: number, z: number): number {
  const V = MILLBROOK.valley;
  const L = MILLBROOK.lookout;
  const ev = (Math.hypot((x - V.cx) / V.rx, (z - V.cz) / V.rz) - 1) * Math.min(V.rx, V.rz);
  const el = Math.hypot(x - L.x, z - L.z) - (L.r + 8);
  const ec = polyDist(LANE, x, z).d - LANE_HALF;
  const eb = polyDist(BROOK, x, z).d - BROOK_NOTCH;
  return smin(smin(smin(ev, el, 4), ec, 3), eb, 2);
}
/** rim rise for the west shape: soft banks, then a long hill slope */
export function westRim(x: number, z: number): number {
  const e = westE(x, z);
  return smoothstep(e, -2.5, 2) * 4.2 + Math.max(0, e - 2) * 0.55;
}

/** 0 east of the lane's rim gap, 1 in Millbrook: blends the bowl's swells into the valley's floor */
export function westK(x: number): number {
  return smoothstep(-x, 40, 62);
}

/** valley base (no rim): floor, small swells, the lookout hill, and the carved brook */
export function westBase(x: number, z: number): number {
  const L = MILLBROOK.lookout;
  let h = westFloor(z) + Math.sin(x * 0.19 + 1.1) * Math.cos(z * 0.15) * 0.3;
  h += L.rise * (1 - smoothstep(Math.hypot(x - L.x, z - L.z), L.r, L.r + 10.5));
  const { d } = polyDist(BROOK, x, z);
  if (d < 4.2) {
    const w = waterY(z);
    // banks never dip under the water line, then the channel cuts down to the bed
    h = THREE.MathUtils.lerp(Math.max(h, w + 0.14), h, smoothstep(d, 2.4, 4.2));
    h = THREE.MathUtils.lerp(w - 0.42, h, smoothstep(d, 0.9, 2.2));
  }
  return h;
}
