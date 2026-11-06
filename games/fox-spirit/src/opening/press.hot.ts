/**
 * The Scribe's Press per-frame step (press.ts builds it; DESIGN-worlds.md, tla/Press.tla). No allocation, real dt,
 * no Math.random. Gates are physical:
 *   teach    — warmth carried from a brazier melts the ridge's frozen seal; crossing the gate earns Inkstep
 *   develop  — with Inkstep, an air-dash over the frozen membrane cracks it into a glide draft (it never closes);
 *              standing on the Archive shelf completes the level
 *   combine  — the shelf's membrane is iced: carried warmth melts the ice, then an air-dash cracks it into a short
 *              draft; warmth carried UP that draft kindles the pillar's brazier, the seam thaws and the pressed stair
 *              stands; standing on the Wellspring ledge completes the world
 * Warmth fades (WARM_S) and is spent on what it melts; every lit brazier relights it, so nothing can be lost for good.
 * No words teach: captions name places and what changed, never an action or a key.
 */
import type * as THREE from 'three';
import type { Collider } from '../lookdevPlay';
import { BRAZIER_REACH, BRAZIERS, BREAK, DRAFT, DRAFT_B_HEIGHT, HIGH_BRAZIER, LEDGE, LEDGE_TOP, MEMBRANE_A, MEMBRANE_B, PRESS_ORIGIN, RIDGE, SEAM_S, SHELF, SHELF_TOP, STACK, STAIR, WARM_S } from './pressLayout';

export type PressRig = {
  fox: THREE.Object3D;
  motion: () => { readonly grounded: boolean; readonly dashing: boolean } | null;
  hasInkstep: () => boolean;
  events: { arrive: () => void; coda: () => void; warmed: () => void; kindled: (i: number) => void; thawSeal: () => void; crack: (which: 0 | 1) => void; meltIce: () => void; seam: () => void; stood: () => void; complete: (level: 0 | 1 | 2) => void };
  seal: THREE.Object3D;
  sealCol: Extract<Collider, { kind: 'box' }>;
  /** the fox's carried warmth (glow + light), scaled by `warm` */
  warmGlow: THREE.Object3D;
  warmLight: THREE.PointLight;
  braziers: THREE.PointLight[];
  /** each brazier's base height (feet must be within 1 m of it to take or give a flame) */
  brazierY: Float32Array;
  /** the seam's ink (its material darkens → wets → pales as the heat runs it, by `seamK`) */
  seamMat: THREE.MeshStandardMaterial;
  /** the stair's stacks (scaled from pressed to full) and their colliders (tops rise with them) */
  stacks: THREE.Object3D[];
  stackCols: Extract<Collider, { kind: 'box' }>[];
  /** each stack's full top and base */
  stackTop: Float32Array;
  coals: THREE.MeshStandardMaterial[];
  membranes: THREE.Object3D[];
  ice: THREE.Object3D;
  drafts: THREE.Object3D[];
  lever: THREE.Object3D;
  platen: THREE.Object3D;
  scribe: THREE.Object3D;
  scribeHead: THREE.Object3D;
  scribeArm: THREE.Object3D;
  /** the pressed autumn under the platen: it warms as the platen lifts */
  leafMat: THREE.MeshStandardMaterial;
  s: {
    /** lit braziers (bit i = BRAZIERS[i]) */ lit: number; wasWarm: number;
    /** carried warmth 0..1 */ warm: number; sealK: number; thawed: number;
    /** per membrane: −1 frozen, ≥ 0 seconds since it cracked */ crackA: number; crackB: number;
    iceK: number; iced: number; done: number; dashWasAir: number; time: number; arrived: number;
    /** sim seconds since the pillar's brazier lit (−1 before): the seam runs, then the stacks stand */ seam: number; stood: number; /** sim seconds since the Press woke (−1 before, −2 once the coda is said) */ coda: number;
    /** 0 bowed over the shut Press → 1 lever lifted, the Scribe turned to the fox */ leverK: number;
  };
};

const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

export function updatePress(rig: PressRig, dt: number): void {
  const s = rig.s;
  s.time += dt;
  const f = rig.fox.position;
  const lx = f.x - PRESS_ORIGIN.x;
  const lz = f.z - PRESS_ORIGIN.z;
  const here = Math.abs(lx) < 80 && Math.abs(lz) < 80;
  const m = rig.motion();
  const grounded = m !== null && m.grounded;
  const dashing = m !== null && m.dashing;
  // an air-dash: the dash began off the ground (latched for the dash's length)
  if (!dashing) s.dashWasAir = 0;
  else if (s.dashWasAir === 0) s.dashWasAir = grounded ? -1 : 1;
  const airDash = dashing && s.dashWasAir === 1;

  if (here && s.arrived === 0) {
    s.arrived = 1;
    rig.events.arrive();
  }
  // braziers: a lit one fills the warmth; a cold one takes a carried flame (and stays lit); warmth fades on its own
  if (here) {
    for (let i = 0; i < BRAZIERS.length; i++) {
      const B = BRAZIERS[i]!;
      if (Math.hypot(lx - B.lx, lz - B.lz) > BRAZIER_REACH || Math.abs(f.y - rig.brazierY[i]!) > 1) continue;
      const bit = 1 << i;
      if ((s.lit & bit) === 0 && s.warm > 0) {
        s.lit |= bit;
        rig.events.kindled(i);
        if (i === HIGH_BRAZIER && s.seam < 0) {
          s.seam = 0;
          rig.events.seam();
        }
      }
      if ((s.lit & bit) !== 0) {
        if (s.warm < 0.5) rig.events.warmed();
        s.warm = 1;
      }
    }
  }
  s.warm = Math.max(0, s.warm - dt / WARM_S);
  s.wasWarm = s.warm > 0 ? 1 : 0;
  const glow = smooth(Math.min(1, s.warm * 3));
  rig.warmGlow.visible = glow > 0.01;
  rig.warmGlow.scale.setScalar(0.6 + 0.4 * glow);
  rig.warmLight.intensity = 0.9 * glow;
  for (let i = 0; i < rig.braziers.length; i++) {
    const on = (s.lit & (1 << i)) !== 0 ? 1 : 0;
    rig.braziers[i]!.intensity = on * (1.6 + 0.3 * Math.sin(s.time * 7.3 + i * 2) + 0.2 * Math.sin(s.time * 11.1 + i));
    rig.coals[i]!.emissiveIntensity = on * 1.6;
  }

  // teach: the seal melts when warmth touches it
  if (s.thawed === 0) {
    const nearSeal = Math.abs(lz - RIDGE.lz) < RIDGE.half + 1.1 && Math.abs(lx) < RIDGE.gate + 0.6;
    if (nearSeal && s.warm > 0) {
      s.thawed = 1;
      s.warm = 0;
      s.wasWarm = 0;
      rig.events.thawSeal();
    }
  }
  if (s.thawed === 1 && s.sealK < 1) {
    s.sealK = Math.min(1, s.sealK + dt / 1.6);
    const k = smooth(s.sealK);
    rig.seal.scale.set(1, Math.max(0.02, 1 - k), 1);
    rig.seal.visible = k < 0.99;
    // the gate opens as the ink runs down (the collider drops with it)
    rig.sealCol.top = rig.seal.userData.base + (rig.seal.userData.top - rig.seal.userData.base) * (1 - k);
  }
  if ((s.done & 1) === 0 && s.sealK >= 1 && lz < RIDGE.lz - RIDGE.half - 0.6 && here) {
    s.done |= 1;
    rig.events.complete(0);
  }

  // develop: an air-dash over the frozen membrane (Inkstep earned) cracks the draft
  if (s.crackA < 0 && airDash && rig.hasInkstep() && Math.hypot(lx - MEMBRANE_A.lx, lz - MEMBRANE_A.lz) < BREAK.reach && f.y - rig.membranes[0]!.position.y < BREAK.above) {
    s.crackA = 0;
    rig.events.crack(0);
  }
  if ((s.done & 2) === 0 && (s.done & 1) !== 0 && grounded && lz < SHELF.z1 && lz > SHELF.z0 && f.y > SHELF_TOP - 0.3) {
    s.done |= 2;
    rig.events.complete(1);
  }

  // combine: warmth melts the ice off the second membrane, then an air-dash cracks it
  if (s.iced === 1 && s.warm > 0 && Math.hypot(lx - MEMBRANE_B.lx, lz - MEMBRANE_B.lz) < MEMBRANE_B.r + 1.2 && f.y < SHELF_TOP + 1.2) {
    s.iced = 0;
    s.warm = 0;
    s.wasWarm = 0;
    rig.events.meltIce();
  }
  if (s.iced === 0 && s.iceK < 1) {
    s.iceK = Math.min(1, s.iceK + dt / 1.2);
    rig.ice.scale.setScalar(Math.max(0.01, 1 - smooth(s.iceK)));
    rig.ice.visible = s.iceK < 0.99;
  }
  if (s.crackB < 0 && s.iced === 0 && airDash && Math.hypot(lx - MEMBRANE_B.lx, lz - MEMBRANE_B.lz) < BREAK.reach && f.y - rig.membranes[1]!.position.y < BREAK.above) {
    s.crackB = 0;
    rig.events.crack(1);
  }
  // the seam: heat runs from the pillar's foot to the stair (the ink wets, then pales), then the stacks unpress from
  // the foot up; a fox standing on one rides it (the collider's top rises under it)
  if (s.seam >= 0) {
    s.seam += dt;
    const run = Math.min(1, s.seam / SEAM_S);
    rig.seamMat.emissiveIntensity = 0.15 + 1.4 * Math.sin(Math.PI * Math.min(1, run * 1.15)) + 0.25 * run;
    rig.seamMat.opacity = 1 - 0.55 * smooth((s.seam - SEAM_S) / 1.5);
    for (let i = 0; i < rig.stacks.length; i++) {
      const k = smooth((s.seam - SEAM_S - i * STACK.stagger) / STACK.rise);
      const base = SHELF_TOP;
      const full = rig.stackTop[i]! - base;
      const h = STAIR.pressed + (full - STAIR.pressed) * k;
      rig.stacks[i]!.scale.y = h / full;
      rig.stackCols[i]!.top = base + h;
    }
    if (s.stood === 0 && s.seam > SEAM_S + (rig.stacks.length - 1) * STACK.stagger + STACK.rise) {
      s.stood = 1;
      rig.events.stood();
    }
  }
  if ((s.done & 4) === 0 && (s.done & 2) !== 0 && s.stood === 1 && grounded && lx > LEDGE.x0 && lx < LEDGE.x1 && lz > LEDGE.z0 && lz < LEDGE.z1 && f.y > LEDGE_TOP - 0.3) {
    s.done |= 4;
    rig.events.complete(2);
    s.coda = 0;
  }
  if (s.coda >= 0) {
    s.coda += dt;
    if (s.coda > 4.5) {
      s.coda = -2;
      rig.events.coda();
    }
  }

  // the Scribe: bowed until the Press wakes, then turns, reaches, and lifts the lever (the platen rises off the pages)
  if ((s.done & 4) !== 0 && s.leverK < 1) s.leverK = Math.min(1, s.leverK + dt / 2.4);
  const lk = smooth(s.leverK);
  const reach = smooth(Math.min(1, s.leverK * 2));
  const lift = smooth(Math.max(0, s.leverK * 2 - 1));
  rig.scribeHead.rotation.x = 0.45 * (1 - reach) - 0.15 * lift;
  rig.scribeArm.rotation.x = -0.5 - 1.6 * reach + 0.9 * lift;
  rig.lever.rotation.x = 0.55 - 1.5 * lift;
  rig.platen.position.y = 1.5 + 0.7 * lift;
  rig.leafMat.emissiveIntensity = 0.05 + 1.1 * lift;
  rig.scribe.rotation.y = -Math.PI / 2 - 0.25 + 0.9 * lk;
  // breathing while bowed (sim time, no allocation)
  rig.scribe.scale.y = 1 + 0.012 * Math.sin(s.time * 1.3) * (1 - lk);

  // drafts: rise in after the crack, then breathe
  if (s.crackA >= 0) s.crackA += dt;
  if (s.crackB >= 0) s.crackB += dt;
  draftLook(rig.drafts[0]!, rig.membranes[0]!, s.crackA, s.time);
  draftLook(rig.drafts[1]!, rig.membranes[1]!, s.crackB, s.time + 1.7);
}

function draftLook(draft: THREE.Object3D, membrane: THREE.Object3D, t: number, time: number): void {
  if (t < 0) {
    draft.visible = false;
    return;
  }
  const k = smooth(t / 0.9);
  draft.visible = true;
  draft.scale.set(k, 0.2 + 0.8 * k, k);
  draft.rotation.y = time * 0.6;
  membrane.scale.setScalar(1 + 0.25 * k);
}

/** the drafts' lift for the controller (k as the hearth columns report it): full inside 0.6·radius */
export function pressLift(rig: PressRig, x: number, feetY: number, z: number, out: { k: number; radialK: number; ax: number; az: number }): void {
  const s = rig.s;
  for (let i = 0; i < 2; i++) {
    const t = i === 0 ? s.crackA : s.crackB;
    if (t < 0.3) continue;
    const mem = rig.membranes[i]!.position;
    const dy = feetY - mem.y;
    const height = i === 0 ? DRAFT.height : DRAFT_B_HEIGHT;
    if (dy < -0.6 || dy > height) continue;
    const d = Math.hypot(x - mem.x, z - mem.z);
    const radialK = 1 - smooth((d - DRAFT.radius * 0.6) / (DRAFT.radius * 0.4 + 0.5));
    if (radialK <= 0) continue;
    const topK = 1 - smooth((dy - (height - 1.6)) / 1.6);
    const k = Math.min(1, t / 0.9) * radialK * topK;
    if (k > out.k) {
      out.k = k;
      out.radialK = radialK;
      out.ax = mem.x;
      out.az = mem.z;
    }
  }
}
