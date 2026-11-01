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

/** The Still Crown on the Summit: far down the vista gap past the bridge, low enough to sit inside the chase frame */
export const CROWN = { x: 2, y: -70, z: -112, yaw: 0, scale: 1.6 } as const;

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

/** The Hearthtree's hinge and the far crag it falls onto (KEEPING derives its frame from these) */
const HINGE = { x: 28.0, z: 73.6 } as const;
const CRAG = { x: 26.0, z: 65.2 } as const;
/**
 * The vista notch: past the far crag the rim opens into a saddle that drops into a valley, so the
 * bridge ends on an overlook with the Still Crown framed in the gap instead of facing the rim wall.
 * `a` runs on along the fall line beyond the crag, `c` across it.
 */
export const VISTA = (() => {
  const len = Math.hypot(CRAG.x - HINGE.x, CRAG.z - HINGE.z);
  return { x: CRAG.x, z: CRAG.z, dx: (CRAG.x - HINGE.x) / len, dz: (CRAG.z - HINGE.z) / len, start: 2.4, half: 6, edge: 7, drop: 0.75, floor: -11 };
})();
/** true inside the vista gap (plus `margin` across): nothing tall may stand here */
export function inVista(x: number, z: number, margin = 0): boolean {
  const V = VISTA;
  const a = (x - V.x) * V.dx + (z - V.z) * V.dz;
  const c = Math.abs((x - V.x) * V.dz - (z - V.z) * V.dx);
  return a > V.start - 1 && c < V.half + V.edge * 0.5 + a * 0.4 + margin;
}
function vistaCut(x: number, z: number, h: number): number {
  const V = VISTA;
  const a = (x - V.x) * V.dx + (z - V.z) * V.dz;
  const c = Math.abs((x - V.x) * V.dz - (z - V.z) * V.dx);
  // widen as it runs out: a gap, not a corridor
  const open = (1 - THREE.MathUtils.smoothstep(c, V.half + a * 0.35, V.half + V.edge + a * 0.5)) * THREE.MathUtils.smoothstep(a, V.start - 1.5, V.start + 1.5);
  const valley = Math.max(V.floor, 5 - Math.max(0, a - V.start) * V.drop) + Math.sin(x * 0.21) * Math.cos(z * 0.17) * 0.8;
  return THREE.MathUtils.lerp(h, Math.min(h, valley), open);
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
  return vistaCut(x, z, swell * flat * 0.8 + meadow + rim);
}

/** shelf walk height (the H-a updraft's landing) */
export const SHELF_TOP = groundH(SHELF.x, SHELF.z) + SHELF.rise;

/**
 * The first Keeping (DESIGN-keeping-place.md), east of the shelf at two storeys above the meadow:
 * shelf → ledge with one safe bend → steam spring against the terrace cliff → root-hearth terrace →
 * the arrested Hearthtree falls along `fall` (unit xz) onto the far crag and becomes the bridge.
 * Boxes use the collider yaw convention: local +z = (sin yaw, cos yaw), local +x = (cos yaw, −sin yaw).
 */
export const KEEPING = (() => {
  const hinge = HINGE;
  const crag = CRAG;
  const span = Math.hypot(crag.x - hinge.x, crag.z - hinge.z);
  const fall = { x: (crag.x - hinge.x) / span, z: (crag.z - hinge.z) / span };
  const yaw = Math.atan2(fall.x, fall.z);
  const terraceTop = SHELF_TOP + 4.5;
  const terrace = { x: hinge.x - fall.x * 2.7, z: hinge.z - fall.z * 2.7, hx: 2.9, hz: 2.9, yaw, top: terraceTop };
  /** terrace-local → world */
  const local = (lx: number, lz: number) => ({
    x: terrace.x + lx * Math.cos(yaw) + lz * Math.sin(yaw),
    z: terrace.z - lx * Math.sin(yaw) + lz * Math.cos(yaw),
  });
  const steam = { ...local(4.3, -2.2), y: SHELF_TOP, r: 1.0 };
  return {
    /** lit cradle on the shelf where the coal rests (feet height) */
    coal: { x: 15.1, z: 77.4, y: SHELF_TOP },
    /** ledge centre line at SHELF_TOP: shelf → bend → spring pad; `ledgeWidth` walkable */
    ledge: [[15.2, 79.0], [19.6, 85.0], [steam.x - 0.3, steam.z + 1.5]] as ReadonlyArray<readonly [number, number]>,
    ledgeWidth: 3.2,
    /** steam spring basin (coal → water → steam) at the ledge end, 1.4 m off the terrace cliff */
    steam,
    /** root-hearth terrace: box behind the hinge along −fall */
    terrace,
    /** dark root-hearth bowl among the roots, just behind the hinge */
    root: { ...local(0.3, 0.1), y: terraceTop, r: 0.75 },
    /** Hearthtree pivot (root crown) and fall direction; arrested lean from vertical (rad) */
    hinge: { ...hinge, y: terraceTop - 0.8 },
    fall,
    leanArrested: 0.95,
    /** far crag the crown lands across: walkable top = terraceTop */
    crag: { ...crag, hx: 2.5, hz: 2.7, yaw, top: terraceTop },
    span,
  };
})();

/** West-grove paper ruin: permanent dash folds, then a southern return to meadow. */
export const POP_UP_RUIN = {
  entry: { x: -24, z: 75 },
  leaves: [
    { x: -27, z: 75, top: 0.08 },
    { x: -31, z: 75, top: 0.63 },
  ],
  width: 3.4,
  depth: 3.6,
  overlook: { x: -35, z: 75, top: 1.18, width: 3.4, depth: 3.6 },
  returnEnd: { x: -35, z: 79.7 },
} as const;
