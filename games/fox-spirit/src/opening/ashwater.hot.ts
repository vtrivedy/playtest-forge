/**
 * Ashwater Reach's per-frame step (ashwater.ts builds it; DESIGN-ashwater.md, tla/Ashwater.tla). No allocation, real
 * dt, no Math.random. Cold `events` fire once per transition. Gates are physical: the channel and pool drain only
 * after their reed dam is dashed through, reed mats only rise once Reedskim is earned, and wading into water that is
 * still deep puts the fox back on the bank it left. Levels complete on arrival in the region beyond each gate.
 */
import type * as THREE from 'three';
import { ASH_ORIGIN, CISTERN, SOAK, DAM_A, DAM_A2, DAM_B, DAM_C, FLOOD, LEDGE, MATS, MAT_RISE, PUNT, SECRETS, WATER, waterAt } from './ashwaterLayout';
import type { Collider } from '../lookdevPlay';

export const ASH_TIMING = { drain: 3.2, matRise: 0.9, matStagger: 0.18, damFall: 1.1, glow: 2.5, matHold: 1.2, matSink: 0.7, matRecover: 0.8 };
const T = ASH_TIMING;

/** the only words the marsh offers are places and feelings (captions), never the answer: no teach hints here */

export type AshRig = {
  fox: THREE.Object3D;
  /** live controller reads (null until the controller exists) */
  motion: () => { readonly grounded: boolean; readonly dashing: boolean } | null;
  hasReedskim: () => boolean;
  teleport: (x: number, z: number, yaw: number) => void;
  teach: (text: string) => void;
  events: { place: (which: 0) => void; secret: (which: 0 | 1) => void; burstA: () => void; burstA2: () => void; burstB: () => void; burstC: () => void; complete: (level: 0 | 1 | 2) => void; splash: () => void };
  waterMesh: { channel: THREE.Object3D; channelE: THREE.Object3D; pond: THREE.Object3D; pool: THREE.Object3D };
  /** the water the channel lets go, running down the sluice gully (streaks scrolled downhill) into the soak */
  flow: THREE.Object3D;
  flowMat: THREE.MeshStandardMaterial;
  flowTex: THREE.Texture;
  soak: THREE.Object3D;
  damA: THREE.Object3D;
  damA2: THREE.Object3D;
  damB: THREE.Object3D;
  damC: THREE.Object3D;
  damACol: Extract<Collider, { kind: 'post' }>;
  damA2Col: Extract<Collider, { kind: 'post' }>;
  damBCol: Extract<Collider, { kind: 'post' }>;
  damCCol: Extract<Collider, { kind: 'post' }>;
  /** the Ferrykeeper's punt rides the cistern's water; the cistern's south gate shuts while it is flooded */
  punt: THREE.Object3D;
  puntCol: Extract<Collider, { kind: 'box' }>;
  cGate: THREE.Object3D;
  gateCol: Extract<Collider, { kind: 'box' }>;
  mats: THREE.Object3D[];
  matCols: Extract<Collider, { kind: 'box' }>[];
  /** seconds the fox has stood on each mat (it sinks past `matHold`, recovers once left) */
  matLoad: Float32Array;
  glow: THREE.Object3D;
  glowMat: THREE.MeshBasicMaterial;
  /** the Ferrykeeper: pressed flat until the Seedwell fills, then unpresses and flies off */
  heron: THREE.Object3D;
  heronMat: THREE.MeshToonMaterial;
  heronCol: Extract<Collider, { kind: 'post' }>;
  safe: THREE.Vector3;
  s: {
    burstA: number; burstA2: number; burstB: number; burstC: number; channelY: number; channelEY: number; poolY: number; matK: number; glowK: number;
    done: number; safeYaw: number; splashes: number; inMarsh: number; heronT: number; heronY: number; heronZ: number; clock: number; lastSplash: number; secrets: number;
    /** place lines already said (bit 0: the soak, once water has reached it) */ places: number;
  };
};

/** footing at or above this is dry whatever the water does (full surface −0.15) */
const DRY_Y = -0.05;

const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

export function updateAshwater(rig: AshRig, dt: number): void {
  const s = rig.s;
  s.clock += dt;
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
  // the sill's culvert: only reachable from the drained west bed (its dam faces west, below the bank)
  if (s.burstA2 < 0 && s.burstA > 0 && dashing && f.y < -0.3 && Math.hypot(lx - DAM_A2.lx, lz - DAM_A2.lz) < DAM_A2.reach) {
    s.burstA2 = 0;
    rig.damA2Col.r = 0.001;
    rig.events.burstA2();
  }
  if (s.burstB < 0 && dashing && Math.hypot(lx - DAM_B.lx, lz - DAM_B.lz) < DAM_B.reach) {
    s.burstB = 0;
    rig.damBCol.r = 0.001;
    rig.events.burstB();
  }
  // the weir's reed gate: dashed, the race floods the cistern for a while, then the gate washes out and re-forms
  if (s.burstC < 0 && dashing && Math.hypot(lx - DAM_C.lx, lz - DAM_C.lz) < DAM_C.reach) {
    s.burstC = 0;
    rig.damCCol.r = 0.001;
    rig.events.burstC();
  }
  if (s.burstA >= 0) s.burstA += dt;
  if (s.burstA2 >= 0) s.burstA2 += dt;
  if (s.burstB >= 0) s.burstB += dt;
  if (s.burstC >= 0) s.burstC += dt;
  if (s.burstC > FLOOD.rise + FLOOD.hold + FLOOD.fall) {
    s.burstC = -1;
    rig.damCCol.r = 1.1;
  }
  s.channelY = WATER.channel.full + (WATER.channel.drained - WATER.channel.full) * smooth(s.burstA / T.drain);
  const base = WATER.pool.full + (WATER.pool.drained - WATER.pool.full) * smooth(s.burstB / T.drain);
  const flood = s.burstC < 0 ? 0 : smooth(s.burstC / FLOOD.rise) * (1 - smooth((s.burstC - FLOOD.rise - FLOOD.hold) / FLOOD.fall));
  s.poolY = base + (FLOOD.level - base) * flood;
  s.channelEY = WATER.channelE.full + (WATER.channelE.drained - WATER.channelE.full) * smooth(s.burstA2 / T.drain);
  rig.waterMesh.channel.position.y = s.channelY;
  rig.waterMesh.channelE.position.y = s.channelEY;
  rig.waterMesh.pool.position.y = s.poolY;
  // water runs downhill: while either reach drains (the east one through the culvert into the west bed, then out of
  // the sluice), the gully runs, strongest at the start of each drain; the soak fills with what left the channel
  const run = Math.max(flowOf(s.burstA), flowOf(s.burstA2));
  rig.flow.visible = run > 0.01;
  rig.flowMat.opacity = 0.8 * run;
  rig.flowTex.offset.y -= dt * (0.6 + 1.6 * run);
  const drained = 0.5 * (smooth(s.burstA / T.drain) + (s.burstA2 < 0 ? 0 : smooth(s.burstA2 / T.drain)));
  rig.soak.position.y = SOAK.low + (SOAK.high - SOAK.low) * drained;
  // the punt floats (resting on the floor when dry); the gate shuts once water stands in the cistern
  const puntY = Math.max(s.poolY, -0.95);
  rig.punt.position.y = puntY + 0.05;
  rig.puntCol.top = puntY + PUNT.rise;
  const shut = flood > 0.02;
  rig.gateCol.top = shut ? CISTERN.wallTop : -100;
  rig.cGate.position.y = shut ? (CISTERN.wallTop - 1.3) / 2 : -4;
  stepDam(rig.damA, s.burstA);
  stepDam(rig.damA2, s.burstA2);
  stepDam(rig.damB, s.burstB);
  stepDam(rig.damC, s.burstC);
  if (s.burstC < 0) {
    rig.damC.visible = true;
    rig.damC.scale.set(1, 1, 1);
  }

  // reed mats rise once Reedskim is earned (staggered from the near bank)
  if (rig.hasReedskim() && s.matK < 1 + MATS.length * T.matStagger) s.matK += dt / T.matRise;
  for (let i = 0; i < rig.mats.length; i++) {
    const k = smooth(s.matK - i * T.matStagger);
    const col = rig.matCols[i]!;
    // a fox standing on a mat loads it; past `matHold` it sinks below the surface (keep moving or get wet)
    const on = grounded && Math.abs(f.x - col.x) < col.hx && Math.abs(f.z - col.z) < col.hz && f.y > WATER.pond.full - 0.3;
    rig.matLoad[i] = on ? rig.matLoad[i]! + dt : Math.max(0, rig.matLoad[i]! - dt / T.matRecover);
    const sink = smooth((rig.matLoad[i]! - T.matHold) / T.matSink) * 0.55;
    const top = WATER.pond.full + MAT_RISE - sink;
    const mat = rig.mats[i]!;
    mat.position.y = top - 0.18 - (1 - k) * 0.6;
    mat.rotation.z = on ? Math.sin(rig.matLoad[i]! * 9) * 0.03 * (1 + sink * 4) : 0;
    mat.visible = k > 0.001;
    col.top = k > 0.6 ? top : -100;
  }

  // wading: standing on a bed still under water puts the fox back where it last stood dry
  if (s.inMarsh && grounded) {
    const w = waterAt(f.x, f.z);
    const level = w === 'channel' ? s.channelY : w === 'channelE' ? s.channelEY : w === 'pool' ? s.poolY : w === 'pond' ? WATER.pond.full : 0;
    if (w !== null && f.y < level - 0.2) {
      s.splashes++;
      rig.events.splash();
      // a reset that lands straight back in water (the safe spot itself went under) falls back to the bank anchor
      // of the stage the fox is in, so a reset can never loop
      if (s.clock - s.lastSplash < 0.5) {
        const ax = ASH_ORIGIN.x, az = ASH_ORIGIN.z + (lz > 14 ? 16.5 : lz > -24 ? -15 : -40);
        rig.safe.set(ax, 0, az);
      }
      s.lastSplash = s.clock;
      rig.teleport(rig.safe.x, rig.safe.z, s.safeYaw);
    } else if (f.y > DRY_Y && (w === null || (w !== 'pond' && f.y > level + 0.05))) {
      // (never a reed mat: it may be the thing sinking under you)
      // only truly dry footing (not the drowned bank slope) is a place to put the fox back
      rig.safe.copy(f);
      s.safeYaw = rig.fox.rotation.y;
    }
  }

  // side places: each tells its piece once, when the fox stands in it
  if (s.inMarsh && grounded) {
    if ((s.secrets & 1) === 0 && s.burstA > 2 && Math.hypot(lx - SECRETS.roof.lx, lz - SECRETS.roof.lz) < SECRETS.roof.r) {
      s.secrets |= 1;
      rig.events.secret(0);
    }
    if ((s.secrets & 2) === 0 && Math.hypot(lx - SECRETS.mooring.lx, lz - SECRETS.mooring.lz) < SECRETS.mooring.r) {
      s.secrets |= 2;
      rig.events.secret(1);
    }
  }
  // the soak says its line once, the first time the fox stands by it after the sluice has run
  if (s.inMarsh && grounded && (s.places & 1) === 0 && s.burstA > 1 && Math.hypot(lx - SOAK.lx, lz - SOAK.lz) < SOAK.r + 3) {
    s.places |= 1;
    rig.events.place(0);
  }
  // levels complete on arrival beyond each gate (the store also checks prerequisites)
  if (s.inMarsh && grounded) {
    if ((s.done & 1) === 0 && s.burstA2 > 0 && lz > -23 && lz < -9) {
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
  // unrestored, a low teal shimmer marks the goal from the weir; restored, it rises into the full column
  const g = smooth(s.glowK);
  rig.glow.scale.set(1, 0.14 + 0.86 * g, 1);
  rig.glowMat.opacity = 0.22 + 0.33 * g;
  // the punt rides the Mill Pool's water; the Ferrykeeper unpresses with the Seedwell, then lifts away over the weir
  if (s.glowK > 0) {
    const u = smooth(s.glowK);
    rig.heron.scale.z = 0.08 + 1.22 * u;
    rig.heronMat.color.setRGB(0.85 - 0.45 * u, 0.81 - 0.33 * u, 0.72 - 0.22 * u);
    s.heronT += dt;
    const fly = smooth((s.heronT - 3) / 6);
    rig.heron.position.y = s.heronY + fly * 14;
    rig.heron.position.z = s.heronZ + fly * 30;
    rig.heron.visible = fly < 0.999;
    if (fly > 0.2) rig.heronCol.r = 0.001;
  }

}

/** how hard the sluice gully runs `t` s after a reach's dam burst (0 before, a surge, then a long trickle) */
function flowOf(t: number): number {
  if (t < 0) return 0;
  return smooth(t / 0.5) * (1 - 0.8 * smooth((t - T.drain) / 2.5)) * (1 - smooth((t - T.drain - 14) / 4));
}

/** a burst reed dam slumps and scatters into the water over `damFall` s */
function stepDam(dam: THREE.Object3D, t: number): void {
  if (t < 0) return;
  const k = smooth(t / T.damFall);
  dam.scale.set(1 + k * 0.6, Math.max(0.001, 1 - k), 1 + k * 0.6);
  dam.visible = k < 0.999;
}
