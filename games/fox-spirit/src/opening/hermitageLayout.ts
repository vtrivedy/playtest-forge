/**
 * The Scribe's Hermitage (DESIGN-hermitage.md): north of Lanternhollow, up a winding hanger lane to a
 * ridge plateau where the Scribe made the Album. Pure layout + the terrain it adds; layout.ts folds
 * `northRise` / `northE` into groundH. No imports from layout.ts.
 */
import * as THREE from 'three';
import { polyDist } from './millbrookLayout';

type P2 = readonly [number, number];
const { smoothstep } = THREE.MathUtils;

/** the hanger lane: off the village's north lane, winding up through the beeches to the plateau */
export const NORTH_LANE: ReadonlyArray<P2> = [[-9.7, 102.3], [-12.6, 108.2], [-14.2, 114.6], [-11.4, 120.8], [-7.6, 124.6]];
const LANE_HALF = 3.9;

function smin(a: number, b: number, k: number): number {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

export const HERMITAGE = {
  /** the slope the lane winds up: open grass, a few hanger trees, so the house shows from the village */
  hillside: { x: -7, z: 115, rx: 15, rz: 11 },
  /** ridge plateau: centre, radius, height of the climb above the bowl's base */
  plateau: { x: -6.5, z: 133, r: 10.5, rise: 5.6 },
  /** the Scribe's house: tall, narrow, its door facing south down the lane (local +z = south) */
  house: { x: -4.8, z: 138.6, w: 4.6, d: 4.0, yaw: Math.PI },
  /** the open-air writing desk under the house's lean-to, facing the view */
  desk: { x: -8.6, z: 135.4, yaw: Math.PI * 0.92 },
  /** drying lines of pressed leaves: [ax, az, bx, bz] poles */
  lines: [
    [-13.2, 131.4, -10.0, 127.9],
    [-1.6, 128.4, 2.0, 131.6],
    [-12.15, 137.7, -12.6, 141.2],
  ] as ReadonlyArray<readonly [number, number, number, number]>,
  /** the ink pond, black and still */
  pond: { x: 0.6, z: 136.8, r: 2.1 },
  /** standing leaf-stones round the plateau's south lip */
  stones: [[-14.4, 127.4], [-9.6, 124.0], [1.8, 125.2], [5.8, 130.0]] as ReadonlyArray<P2>,
  /** paths on the plateau */
  paths: [[-7.6, 124.6, -7.0, 129.4], [-7.0, 129.4, -8.2, 134.0], [-7.0, 129.4, -4.8, 135.8], [-7.0, 129.4, -11.2, 129.8], [-7.0, 129.4, -0.6, 130.0]] as ReadonlyArray<readonly [number, number, number, number]>,
};

export const NORTH_PATHS: ReadonlyArray<readonly [number, number, number, number]> = (() => {
  const segs: Array<[number, number, number, number]> = [];
  for (let i = 0; i + 1 < NORTH_LANE.length; i++) segs.push([NORTH_LANE[i]![0], NORTH_LANE[i]![1], NORTH_LANE[i + 1]![0], NORTH_LANE[i + 1]![1]]);
  for (const p of HERMITAGE.paths) segs.push([p[0], p[1], p[2], p[3]]);
  return segs;
})();

/** metres outside the north shape (negative inside): hanger lane ∪ plateau */
export function northE(x: number, z: number): number {
  if (z < 96) return 99;
  const P = HERMITAGE.plateau;
  const ep = Math.hypot(x - P.x, (z - P.z) * 1.15) - P.r;
  const el = polyDist(NORTH_LANE, x, z).d - LANE_HALF;
  // the open hillside between the village and the plateau: the Hermitage stands in view of the well
  const S = HERMITAGE.hillside;
  const es = (Math.hypot((x - S.x) / S.rx, (z - S.z) / S.rz) - 1) * Math.min(S.rx, S.rz);
  return smin(smin(ep, el, 3), es, 4);
}
/** rim rise round the north shape: steep hanger banks, then the ridge */
export function northRim(x: number, z: number): number {
  const e = northE(x, z);
  return smoothstep(e, -2, 2.5) * 4.6 + Math.max(0, e - 2.5) * 0.6;
}
/** the climb: base terrain rises with the lane toward the plateau (0 in the bowl) */
export function northRise(x: number, z: number): number {
  const P = HERMITAGE.plateau;
  // a gentle dish on the plateau so the house sits in a hollow of the ridge, not on a dome
  const dish = -0.4 * (1 - smoothstep(Math.hypot(x - P.x, z - P.z), 0, P.r));
  // only up the hanger: Millbrook's brook head and the east rim keep their own heights
  const across = 1 - smoothstep(Math.abs(x - P.x), 18, 28);
  const D = HERMITAGE.pond;
  const pond = -0.45 * (1 - smoothstep(Math.hypot(x - D.x, z - D.z), D.r - 0.4, D.r + 0.6));
  return (P.rise * smoothstep(z, 104, 125) + dish * smoothstep(z, 120, 126) + pond) * across;
}

/** kickable leaf piles up the hanger lane (leafPiles.ts) */
export const NORTH_PILES: ReadonlyArray<{ x: number; z: number }> = [
  { x: -11.4, z: 105.6 }, { x: -13.9, z: 111.0 }, { x: -12.6, z: 118.0 }, { x: -9.2, z: 123.0 },
];
