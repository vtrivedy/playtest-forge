/**
 * The three worlds (DESIGN-worlds.md): Russetvale (autumn, the existing bowl), Ashwater Reach (rain marsh) and the
 * Scribe's Press (winter ink). One scene, one fox/controller/camera: the new worlds are islands far along x, reached
 * through the hub arches round the Great Well. Pure data + terrain; no three.js objects here.
 */
import * as THREE from 'three';

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

const ASH = { x: 700, z: 85, r: 46 } as const;
const PRESS = { x: -700, z: 85, r: 46 } as const;

export const WORLDS: Record<WorldId, WorldDef> = {
  russetvale: { id: 'russetvale', name: 'Russetvale', origin: { x: -8, z: 85 }, spawn: { x: -5.2, z: 92.5, yaw: Math.atan2(2.2, -11.5) }, look: null },
  ashwater: {
    id: 'ashwater', name: 'Ashwater Reach', origin: { x: ASH.x, z: ASH.z }, spawn: { x: ASH.x, z: ASH.z + ASH.r - 8, yaw: Math.PI },
    look: { sky: [0x45525d, 0x6f7c84, 0x9aa5a3], mist: 0x7f8c8c, fog: 0.028, key: 0xb8c6d4, precip: 1 },
  },
  press: {
    id: 'press', name: "The Scribe's Press", origin: { x: PRESS.x, z: PRESS.z }, spawn: { x: PRESS.x, z: PRESS.z + PRESS.r - 8, yaw: Math.PI },
    look: { sky: [0x9aa6b8, 0xc4cad4, 0xe2e0dc], mist: 0xc9ccd2, fog: 0.016, key: 0xd8d6d2, precip: 2 },
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

/** Ashwater Reach: a low drowned marsh, hummocks between pools, a bank rising to a rain-dark rim */
export function ashwaterE(x: number, z: number): number {
  return islandE(ASH, x, z, 3, 1.3);
}
export function ashwaterH(x: number, z: number): number {
  const e = ashwaterE(x, z);
  const hum = Math.sin(x * 0.21) * Math.cos(z * 0.17) * 0.6 + Math.sin(x * 0.07 + z * 0.11) * 0.5;
  const rim = smoothstep(e, -3, 4) * 6 + Math.max(0, e - 4) * 1.6;
  return hum + rim;
}

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
