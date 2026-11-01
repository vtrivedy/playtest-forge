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

/**
 * Runaway Page flight loops, one per stage: [x, height above base terrain (groundH), z]. Stage 1 starts east of the well (the hedgehog has the well's face), in the wake view, and
 * circles the plaza; stages 2–3 circle over the canopy chain and the pop-up ruin high enough that only those reach it. `payoff.step` / `payoff.r` = radius of the permanent wash at each catch / when the page is kept.
 */
export const PAGE = {
  stages: [
    [[-1.8, 1.3, 88.2], [-2, 1.1, 91], [-1, 1.2, 95.5], [-5, 1.1, 97.2], [-10.5, 1.2, 95.5], [-13.2, 1.2, 90.2], [-12.5, 1.2, 86.8], [-10.5, 1.1, 82.8], [-5.2, 1.1, 84.2]],
    // stage 2 shuttles 1.6 m above the canopy's roost and high leaf (Tallow CANOPY rise 3.5 / 3.0): landing on a leaf
    // can't reach it, a spring launch through it can; hops arc out wide so it never flies into the fox
    [[-1, 5.1, 64.7], [2.6, 6.4, 64.6], [0.9, 4.6, 67.1], [-3, 6.2, 67.4]],
    // stage 3 shuttles 1 m above the pop-up ruin's overlook and second leaf (Rook POP_UP_RUIN tops 1.02 / 0.47 abs): a jump reaches it
    [[-24.4, 3.0, 71], [-26.4, 4.2, 68.6], [-28.4, 2.1, 71], [-26.4, 4.0, 73.4]],
  ] as ReadonlyArray<ReadonlyArray<readonly [number, number, number]>>,
  payoff: { r: 55, step: 13 },
} as const;

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

/** Optional canopy route; broad one-way leaf tops above the meadow retry floor. */
export const CANOPY = [
  { id: 'entry', x: -0.2, z: 71.5, rise: 0.42 },
  { id: 'middle', x: -0.2, z: 69.3, rise: 1.9 },
  { id: 'high', x: 0.9, z: 67.1, rise: 3.0 },
  { id: 'roost', x: -1, z: 64.7, rise: 3.5 },
] as const;
/** West-grove paper ruin: permanent dash folds, then a southern return to meadow. */
export const POP_UP_RUIN = {
  entry: { x: -24, z: 75 },
  leaves: [
    { x: -27, z: 75, top: -0.08, yaw: 0 },
    { x: -28.4, z: 71, top: 0.47, yaw: -Math.PI / 2 },
  ],
  width: 3.4,
  depth: 3.6,
  overlook: { x: -24.4, z: 71, top: 1.02, width: 3.4, depth: 3.6 },
  returnEnd: { x: -24.4, z: 75.7 },
} as const;
/**
 * The jogs (DESIGN-jogs.md): the meadow leg from the canopy's foot north and then west to the paper ruin.
 * Cairns sit just off the line at its bends, each topped by a finger-stone laid toward `to`; the leaf
 * ribbon is drifted along `line`; the hare's waymark stone faces the canopy roost.
 */
export const JOGS = (() => {
  const roost = CANOPY[CANOPY.length - 1];
  const stone = { x: -3.6, z: 67.4 };
  const fx = roost.x - stone.x;
  const fz = roost.z - stone.z;
  const fl = Math.hypot(fx, fz);
  return {
    line: [[-4.5, 66.5], [-5.6, 72.5], [-6.6, 77.6], [-11, 79.4], [-16.8, 79.6], [-21.6, 76.8]] as ReadonlyArray<readonly [number, number]>,
    cairns: [
      { x: -6.2, z: 68.6, to: { x: -6.6, z: 77.6 } },
      { x: -8.4, z: 76.3, to: { x: -16.8, z: 79.6 } },
      { x: -19.0, z: 77.6, to: { x: -24, z: 75 } },
    ],
    /** the hare's waymark stone; `face` is its drawing's outward normal (toward the roost) */
    hare: { stone, x: stone.x + (fx / fl) * 0.2, z: stone.z + (fz / fl) * 0.2, face: { x: fx / fl, z: fz / fl } },
    harePath: [{ x: -4.9, z: 69.2 }, { x: -5.6, z: 73.4 }, { x: -7.2, z: 78.2 }, { x: -11.5, z: 80.0 }, { x: -16.8, z: 79.9 }, { x: -21.9, z: 77.4 }],
    /** the hare lopes on only while the fox is within `lead` m; it sits facing `look` at the end */
    lead: 5.5,
    look: { x: -24, z: 75 },
  };
})();

/**
 * Unpressed creatures (DESIGN-unpressed.md): where each pressed drawing sits. `yaw` orients the creature's
 * profile plane on the surface (its local +z = the surface's outward normal); `y` is the drawing's foot line;
 * `settle` is where the creature ends up living after its performance.
 */
export const UNPRESSED = (() => {
  // the Great Well's stone ring, on the side that faces the lane mouth (seen head-on from the spawn and the plaza)
  const wd = { x: 0.8, z: 0.6 };
  const hog = { x: WELL.x + wd.x * 1.58, z: WELL.z + wd.z * 1.58 };
  // the shelf's west cliff, between the lz 0 / −3 columns, facing H-a
  const sc = Math.cos(SHELF.yaw);
  const ss = Math.sin(SHELF.yaw);
  const shelfAt = (lx: number, lz: number) => ({ x: SHELF.x + lx * sc + lz * ss, z: SHELF.z - lx * ss + lz * sc });
  const heron = shelfAt(-5.45, -1.4);
  // the far crag: a standing page-stone near its far-left corner, its face toward the bridge
  const K = KEEPING;
  const cc = Math.cos(K.crag.yaw);
  const cs = Math.sin(K.crag.yaw);
  const cragAt = (lx: number, lz: number) => ({ x: K.crag.x + lx * cc + lz * cs, z: K.crag.z - lx * cs + lz * cc });
  const stone = cragAt(1.35, 1.2);
  return {
    hedgehog: { ...hog, y: groundH(hog.x, hog.z) + 0.1, yaw: Math.atan2(wd.x, wd.z), settle: { x: WELL.x + wd.x * 2.5 - wd.z * 1.3, z: WELL.z + wd.z * 2.5 + wd.x * 1.3 } },
    heron: {
      ...heron, y: groundH(heron.x, heron.z) + 0.7, yaw: Math.atan2(-sc, ss),
      /** it lives at the cliff foot, back to the rock: land on it and it flings you up onto the shelf */
      settle: { ...shelfAt(-6.1, 1.5), y: groundH(shelfAt(-6.1, 1.5).x, shelfAt(-6.1, 1.5).z) },
      /** its facing once settled (away from the cliff, out over the meadow) */
      out: { x: -sc, z: ss },
    },
    deer: { x: stone.x - K.fall.x * 0.2, z: stone.z - K.fall.z * 0.2, y: K.crag.top, yaw: Math.atan2(-K.fall.x, -K.fall.z), stone: { ...stone, yaw: K.crag.yaw }, settle: { ...cragAt(-0.7, 2.1), y: K.crag.top },
      /** out of the stone toward the bridge, round its left end, to the far edge facing the Crown */
      path: [cragAt(1.35, 0.25), cragAt(0.0, 0.5), cragAt(-0.7, 2.1)] },
    hare: {
      ...JOGS.hare, y: groundH(JOGS.hare.x, JOGS.hare.z) + 0.34, yaw: Math.atan2(JOGS.hare.face.x, JOGS.hare.face.z),
      /** it lopes ahead of the fox along the jog and sits at the ruin's entry */
      path: JOGS.harePath,
      settle: JOGS.harePath[JOGS.harePath.length - 1]!,
    },
  };
})();

/**
 * Ink glyph stones (DESIGN-glyphs.md): three standing stones in the east meadow whose glyphs only show while
 * freshly painted by the aura, and a sealed paper-door shrine at the rim foot whose lintel (also paint-read)
 * gives the order. `yaw` turns each slab; the shrine faces west, back into the rim slope.
 */
export const GLYPHS = {
  stones: [
    { id: 'leaf', x: 21.0, z: 90.6, yaw: 0.35 },
    { id: 'flame', x: 29.4, z: 91.6, yaw: -0.4 },
    { id: 'moon', x: 30.2, z: 81.6, yaw: 1.2 },
  ],
  /** the lintel's order */
  order: ['moon', 'leaf', 'flame'] as const,
  shrine: { x: 32.0, z: 88.6, yaw: -Math.PI / 2 },
  /** seconds a lit stone holds before guttering; painting a stone out of turn gutters them all */
  window: 16,
} as const;

/** the fox kit sealed in the glyph shrine (an unpressed creature, locked until the door opens) */
export const KIT = (() => {
  const sh = GLYPHS.shrine;
  const c = Math.cos(sh.yaw);
  const s = Math.sin(sh.yaw);
  const at = (lx: number, lz: number) => ({ x: sh.x + lx * c + lz * s, z: sh.z - lx * s + lz * c });
  const page = at(0, -0.56);
  return {
    ...page, y: groundH(sh.x, sh.z) + 0.25, yaw: sh.yaw,
    /** out through the door, across the meadow, home to curl up by the well */
    path: [at(0, 1.6), { x: 24, z: 88.6 }, { x: 8, z: 88.6 }, { x: -6.0, z: 87.8 }],
  };
})();
