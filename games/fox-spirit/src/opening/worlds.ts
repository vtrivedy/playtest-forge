/**
 * The three worlds (DESIGN-worlds.md): Russetvale (autumn, the existing bowl), Ashwater Reach (rain marsh) and the
 * Scribe's Press (winter ink). One scene, one fox/controller/camera: the new worlds are islands far along x, reached
 * through the hub arches round the Great Well. Pure data + terrain; no three.js objects here.
 */
import * as THREE from 'three';
import { ash, ASH_ORIGIN, ASH_SPAWN, E as cedarAshE, H as cedarAshH } from './ashwaterLayout';

export type WorldId = 'russetvale' | 'ashwater' | 'press';

export type WorldLook = {
  /** sky gradient (top, mid, horizon) and the mist the fog matches */
  sky: [number, number, number];
  mist: number;
  /** fog density (exp2) */
  fog: number;
  key: number;
  /** 0 none, 1 rain, 2 snow */
  precip: 0 | 1 | 2;
};

export type WorldDef = {
  id: WorldId;
  name: string;
  /** island centre (world space); russetvale's is the well */
  origin: { x: number; z: number };
  /** where an arch drops the fox, facing `yaw` */
  spawn: { x: number; z: number; yaw: number };
  look: WorldLook | null;
};

/** |x| beyond this is outside Russetvale: terrain, paint and look dispatch on it */
export const WORLD_SPLIT = 350;

const PRESS = { x: -700, z: 85, r: 46 } as const;

/** outward unit direction of an island shape at p (its E gradient): return arches stand that way */
export function outward(E: (x: number, z: number) => number, p: { x: number; z: number }): { x: number; z: number } {
  const gx = E(p.x + 1, p.z) - E(p.x - 1, p.z);
  const gz = E(p.x, p.z + 1) - E(p.x, p.z - 1);
  const l = Math.hypot(gx, gz) || 1;
  return { x: gx / l, z: gz / l };
}
/** arrivals face into the island */
function inwardYaw(E: (x: number, z: number) => number, p: { x: number; z: number }): number {
  const o = outward(E, p);
  return Math.atan2(-o.x, -o.z);
}

export const WORLDS: Record<WorldId, WorldDef> = {
  russetvale: { id: 'russetvale', name: 'Russetvale', origin: { x: -8, z: 85 }, spawn: { x: -5.2, z: 92.5, yaw: Math.atan2(2.2, -11.5) }, look: null },
  ashwater: {
    id: 'ashwater', name: 'Ashwater Reach', origin: { x: ASH_ORIGIN.x, z: ASH_ORIGIN.z }, spawn: { ...ash(ASH_SPAWN.lx, ASH_SPAWN.lz), yaw: inwardYaw(cedarAshE, ash(ASH_SPAWN.lx, ASH_SPAWN.lz)) },
    look: { sky: [0x45525d, 0x6f7c84, 0x9aa5a3], mist: 0x7d8b86, fog: 0.028, key: 0xb3c2cc, precip: 1 },
  },
  press: {
    id: 'press', name: "The Scribe's Press", origin: { x: PRESS.x, z: PRESS.z }, spawn: { x: PRESS.x, z: PRESS.z + PRESS.r - 8, yaw: inwardYaw((x, z) => pressE(x, z), { x: PRESS.x, z: PRESS.z + PRESS.r - 8 }) },
    look: { sky: [0xaaa6a4, 0xd2cec6, 0xe4e0d8], mist: 0xdad6ce, fog: 0.0055, key: 0xe2dccf, precip: 2 },
  },
};

export function worldAt(x: number): WorldId {
  return x > WORLD_SPLIT ? 'ashwater' : x < -WORLD_SPLIT ? 'press' : 'russetvale';
}

const { smoothstep } = THREE.MathUtils;

/** metres outside an island's walkable shape (negative inside): a lobed disc */
function islandE(I: { x: number; z: number; r: number }, x: number, z: number, lobes: number, seed: number): number {
  const dx = x - I.x;
  const dz = z - I.z;
  const a = Math.atan2(dz, dx);
  const r = I.r * (1 + 0.12 * Math.sin(a * lobes + seed) + 0.06 * Math.sin(a * (lobes + 3) - seed * 2));
  return Math.hypot(dx, dz) - r;
}

/** Ashwater Reach terrain is Cedar's (ashwaterLayout.ts) */
export const ashwaterE = cedarAshE;
export const ashwaterH = cedarAshH;

/** The Scribe's Press: a snowfield plateau under ink cliffs */
export function pressE(x: number, z: number): number {
  return islandE(PRESS, x, z, 5, 0.4);
}
export function pressH(x: number, z: number): number {
  const e = pressE(x, z);
  const drift = Math.sin(x * 0.13 + 0.7) * Math.cos(z * 0.11) * 0.9 + Math.sin(x * 0.31 - z * 0.23) * 0.2;
  const rim = smoothstep(e, -2, 3) * 9 + Math.max(0, e - 3) * 2.2;
  return 0.5 + drift + rim;
}

/** hub arches (walk through, along the arch's normal away from the well, to travel) — worldsScene builds them */
export const HUB_ARCHES: ReadonlyArray<{ to: WorldId; x: number; z: number }> = [
  { to: 'ashwater', x: -2, z: 91 },
  { to: 'press', x: -10.5, z: 92.6 },
];
/** the three Seedwells round the plaza (Hazel's seedwells.ts draws them) — clear of every arrival lens */
export const SEEDWELLS: ReadonlyArray<{ world: WorldId; x: number; z: number }> = [
  { world: 'russetvale', x: -4, z: 77.5 },
  { world: 'ashwater', x: 3, z: 93 },
  { world: 'press', x: 0, z: 98 },
];
/** island return arches stand this far outward of the spawn (the arrival lens stays clear of them) */
export const RETURN_ARCH_BACK = 4;
/** a hub arrival from `from`: 3.4 m inside that world's arch, facing the well (the lens stays on the plaza side) */
export function hubArrival(from: WorldId, well: { x: number; z: number }): { x: number; z: number; yaw: number } {
  const a = HUB_ARCHES.find((h) => h.to === from) ?? HUB_ARCHES[0]!;
  const dx = a.x - well.x;
  const dz = a.z - well.z;
  const l = Math.hypot(dx, dz);
  return { x: a.x - (dx / l) * 3.4, z: a.z - (dz / l) * 3.4, yaw: Math.atan2(-dx, -dz) };
}
