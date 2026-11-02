/**
 * Ashwater Reach's per-frame step (ashwater.ts builds it; DESIGN-ashwater.md, tla/Ashwater.tla). No allocation, real
 * dt, no Math.random. Cold `events` fire once per transition. Gates are physical: the channel and pool drain only
 * after their reed dam is dashed through, reed mats only rise once Reedskim is earned, and wading into water that is
 * still deep puts the fox back on the bank it left. Levels complete on arrival in the region beyond each gate.
 */
import type * as THREE from 'three';
import { ASH_ORIGIN, DAM_A, DAM_B, LEDGE, MAT_RISE, MATS, WATER, WEIR, waterAt } from './ashwaterLayout';
import type { Collider } from '../lookdevPlay';

export const ASH_TIMING = { drain: 3.2, matRise: 0.9, matStagger: 0.18, damFall: 1.1, glow: 2.5 };
const T = ASH_TIMING;

export const HINT_DAM = 'The reeds have dammed the sluice · Shift dash through them';
export const HINT_MATS = 'Reedskim · jump from mat to mat across the pond';
export const HINT_DAM_B = 'The mill race is choked · dash the islet’s reeds';
export const HINT_GLIDE = 'Space · jump off the weir, hold to glide';

export type AshRig = {
  fox: THREE.Object3D;
  /** live controller reads (null until the controller exists) */
  motion: () => { readonly grounded: boolean; readonly dashing: boolean } | null;
  hasReedskim: () => boolean;
  teleport: (x: number, z: number, yaw: number) => void;
  teach: (text: string) => void;
  events: { burstA: () => void; burstB: () => void; complete: (level: 0 | 1 | 2) => void; splash: () => void };
  waterMesh: { channel: THREE.Object3D; pond: THREE.Object3D; pool: THREE.Object3D };
  damA: THREE.Object3D;
  damB: THREE.Object3D;
  damACol: Extract<Collider, { kind: 'post' }>;
  damBCol: Extract<Collider, { kind: 'post' }>;
  mats: THREE.Object3D[];
  matCols: Extract<Collider, { kind: 'box' }>[];
  glow: THREE.Object3D;
  safe: THREE.Vector3;
  s: {
    burstA: number; burstB: number; channelY: number; poolY: number; matK: number; glowK: number;
    done: number; safeYaw: number; splashes: number; inMarsh: number;
  };
};

const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

export function updateAshwater(rig: AshRig, dt: number): void {
  const s = rig.s;
  const f = rig.fox.position;
  const lx = f.x - ASH_ORIGIN.x;
  const lz = f.z - ASH_ORIGIN.z;
  s.inMarsh = Math.abs(lx) < 90 && Math.abs(lz) < 90 ? 1 : 0;
  const m = rig.motion();
  const dashing = m !== null && m.dashing;
  const grounded = m !== null && m.grounded;

  // dams: a dash that passes through the reeds bursts them (once)
  if (s.burstA < 0 && dashing && Math.hypot(lx - DAM_A.lx, lz - DAM_A.lz) < DAM_A.reach) {
    s.burstA = 0;
    rig.damACol.r = 0.001;
    rig.events.burstA();
  }
  if (s.burstB < 0 && dashing && Math.hypot(lx - DAM_B.lx, lz - DAM_B.lz) < DAM_B.reach) {
    s.burstB = 0;
    rig.damBCol.r = 0.001;
    rig.events.burstB();
  }
  if (s.burstA >= 0) s.burstA += dt;
  if (s.burstB >= 0) s.burstB += dt;
  s.channelY = WATER.channel.full + (WATER.channel.drained - WATER.channel.full) * smooth(s.burstA / T.drain);
  s.poolY = WATER.pool.full + (WATER.pool.drained - WATER.pool.full) * smooth(s.burstB / T.drain);
  rig.waterMesh.channel.position.y = s.channelY;
  rig.waterMesh.pool.position.y = s.poolY;
  stepDam(rig.damA, s.burstA);
  stepDam(rig.damB, s.burstB);

  // reed mats rise once Reedskim is earned (staggered from the near bank)
  if (rig.hasReedskim() && s.matK < 1 + MATS.length * T.matStagger) s.matK += dt / T.matRise;
  for (let i = 0; i < rig.mats.length; i++) {
    const k = smooth(s.matK - i * T.matStagger);
    const top = WATER.pond.full + MAT_RISE;
    rig.mats[i]!.position.y = top - 0.08 - (1 - k) * 0.6;
    rig.mats[i]!.visible = k > 0.001;
    rig.matCols[i]!.top = k > 0.6 ? top : -100;
  }

  // wading: standing on a bed still under water puts the fox back where it last stood dry
  if (s.inMarsh && grounded) {
    const w = waterAt(f.x, f.z);
    const level = w === 'channel' ? s.channelY : w === 'pool' ? s.poolY : w === 'pond' ? WATER.pond.full : 0;
    if (w !== null && f.y < level - 0.2) {
      s.splashes++;
      rig.events.splash();
      rig.teleport(rig.safe.x, rig.safe.z, s.safeYaw);
    } else if (w === null) {
      rig.safe.copy(f);
      s.safeYaw = rig.fox.rotation.y;
    }
  }

  // levels complete on arrival beyond each gate (the store also checks prerequisites)
  if (s.inMarsh && grounded) {
    if ((s.done & 1) === 0 && s.burstA > 0 && lz > -23 && lz < -9) {
      s.done |= 1;
      rig.events.complete(0);
    }
    if ((s.done & 1) !== 0 && (s.done & 2) === 0 && lz > 14.6 && lz < 33 && (lx < -15.5 || lx > 15.5 || lz < 20)) {
      s.done |= 2;
      rig.events.complete(1);
    }
    if ((s.done & 3) === 3 && (s.done & 4) === 0 && f.y > LEDGE.top - 0.4 && lx > LEDGE.x0 && lx < LEDGE.x1 && lz > LEDGE.z0 && lz < LEDGE.z1) {
      s.done |= 4;
      rig.events.complete(2);
    }
  }
  if ((s.done & 4) !== 0 && s.glowK < 1) s.glowK = Math.min(1, s.glowK + dt / T.glow);
  rig.glow.visible = s.glowK > 0.001;
  rig.glow.scale.set(1, Math.max(0.001, smooth(s.glowK)), 1);

  // one teach line at a time, only where it applies
  if (!s.inMarsh) return;
  if (s.burstA < 0 && Math.hypot(lx - DAM_A.lx, lz - DAM_A.lz) < 7) rig.teach(HINT_DAM);
  else if (s.matK > 0.5 && (s.done & 2) === 0 && lz > -16 && lz < -6) rig.teach(HINT_MATS);
  else if (s.burstB < 0 && (s.done & 2) !== 0 && lz > 14 && lz < 34 && lx > -16 && lx < 16 && f.y < 1) rig.teach(HINT_DAM_B);
  else if ((s.done & 4) === 0 && f.y > WEIR.top - 0.5 && lx > WEIR.xMax - 7 && lz > WEIR.z0) rig.teach(HINT_GLIDE);
}

/** a burst reed dam slumps and scatters into the water over `damFall` s */
function stepDam(dam: THREE.Object3D, t: number): void {
  if (t < 0) return;
  const k = smooth(t / T.damFall);
  dam.scale.set(1 + k * 0.6, Math.max(0.001, 1 - k), 1 + k * 0.6);
  dam.visible = k < 0.999;
}
