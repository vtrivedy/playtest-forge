/**
 * Opening slice layout: Lanternhollow + Arrival Meadow at the old Russetvale coordinates
 * (regionLanternhollow.ts / russetvale.ts route + H-a placement). Every module places from here.
 */
import * as THREE from 'three';

/** wake spot by the plaza, facing down the hub lane toward the meadow (−3, 81) */
export const SPAWN = { x: -5.2, z: 92.5, yaw: Math.atan2(2.2, -11.5) } as const;
/** the Great Well (village heart) */
export const WELL = { x: -8, z: 85 } as const;
/** H-a: cold hearth at the foot of the meadow shelf */
export const HEARTH_A = { x: 5.6, z: 74.2, r: 0.82, top: 1.0 } as const;
/** rock shelf the H-a updraft lifts onto: 9 × 9, top = ground + 5 */
export const SHELF = { x: 13, z: 75.5, w: 9, d: 9, yaw: 0.12, rise: 5 } as const;

/** First Keeping (Moss's place plan, #swarm :32): coal cradle on the shelf, ledge to the steam spring, root-hearth on the upper terrace */
export const KEEPING = {
  coal: { x: 15.8, z: 78.2 },
  steam: { x: 27.6, y: 5, z: 79.4 },
  root: { x: 31.2, y: 9.5, z: 76.8 },
} as const;

/** The Still Crown on the Summit: far east-southeast, beyond the ridge, backlit by the low sun */
export const CROWN = { x: 135, y: -14, z: 40, yaw: -0.4, scale: 2.1 } as const;

/** Cottages (all face +z: door on the z + d/2 wall) */
export const HOUSES = [
  { x: -18, z: 92, w: 5.2, d: 4.2, eave: 2.6, rise: 1.4, chimney: true },
  { x: -28.5, z: 84.4, w: 5.6, d: 4.6, eave: 2.8, rise: 2.1, chimney: false },
  { x: 12, z: 95, w: 5.2, d: 4.2, eave: 2.6, rise: 1.4, chimney: true },
  { x: -18, z: 84.6, w: 4.2, d: 3.8, eave: 2.3, rise: 1.2, chimney: false },
  { x: -9, z: 99.6, w: 4.4, d: 3.6, eave: 2.3, rise: 1.25, chimney: false },
  { x: -37, z: 86, w: 5, d: 4, eave: 2.5, rise: 1.45, chimney: false },
] as const;

/** Lanes as segments [ax, az, bx, bz]; the last ones lead the opening route out to H-a */
export const PATHS: ReadonlyArray<readonly [number, number, number, number]> = [
  [-18, 95, -14, 95], [-14, 95, -12.5, 89.5], [-12.5, 89.5, -8, 88], [-29.2, 87.5, -24, 88.3], [-24, 88.3, -18.7, 87.2],
  [-18.7, 87.2, -14, 87.8], [-14, 87.8, -12.5, 89.5], [-9.7, 102.3, -5.7, 102.3], [-5.7, 102.3, -5, 100.5], [-5, 100.5, 0, 94],
  [-37.7, 88.7, -34, 90], [-34, 90, -32, 88.5], [-32, 88.5, -29.2, 87.5], [-8, 88, -4, 88], [-4, 88, -3, 81], [-3, 81, 0, 80],
  [12, 98, 8, 99], [8, 99, 0, 94], [0, 80, 9, 88], [9, 88, 25, 88],
  [-6, 92, -7.2, 87], [0, 80, 4.2, 75.6], [0, 80, -3, 62],
];

/** Play area (ellipse); the ground climbs into a cliffed rim outside it */
export const BOUNDS = { cx: -4, cz: 83, rx: 40, rz: 25 } as const;

export function pathDist(x: number, z: number): number {
  // plaza around the well
  let d = Math.max(0, Math.hypot(x - WELL.x, z - WELL.z) - 3.2);
  for (const [ax, az, bx, bz] of PATHS) {
    const dx = bx - ax;
    const dz = bz - az;
    const t = THREE.MathUtils.clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1);
    d = Math.min(d, Math.hypot(x - ax - t * dx, z - az - t * dz));
  }
  return d;
}

/** 0 inside the play ellipse, rising past 1 at the rim */
export function rimK(x: number, z: number): number {
  return Math.hypot((x - BOUNDS.cx) / BOUNDS.rx, (z - BOUNDS.cz) / BOUNDS.rz);
}

/** Base terrain (no props): gentle swells, flattened lanes and house pads, cliffed rim */
export function groundH(x: number, z: number): number {
  const swell = Math.sin(x * 0.11) * Math.cos(z * 0.09) * 0.7 + Math.sin(x * 0.31 + z * 0.17) * 0.18;
  let flat = THREE.MathUtils.smoothstep(pathDist(x, z), 1.2, 5);
  for (const h of HOUSES) {
    const k = Math.max(Math.abs(x - h.x) - h.w / 2, Math.abs(z - h.z) - h.d / 2);
    flat = Math.min(flat, THREE.MathUtils.smoothstep(k, 0.8, 4));
  }
  // the meadow dips gently south of the village toward the shelf
  const meadow = -0.6 * (1 - THREE.MathUtils.smoothstep(z, 70, 84));
  const r = rimK(x, z);
  const rim = THREE.MathUtils.smoothstep(r, 0.92, 1.08) * 7 + Math.max(0, r - 1.08) * 14;
  return swell * flat * 0.8 + meadow + rim;
}
