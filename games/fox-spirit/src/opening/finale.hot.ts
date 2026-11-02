/**
 * The finale's per-frame step (DESIGN-finale.md, tla/Finale.tla). Everything here runs every frame: no allocation,
 * real dt, no Math.random (seeds come from the build). Phase transitions call the rig's cold `events`, which may
 * allocate once. The phase sequence is latched and automatic after Kindle: it never waits on the ember.
 */
import * as THREE from 'three';
import { worldAt } from './worlds';
import type { HearthFox } from '../lookdevFox';
import { fitLetterPlane, type LetterPlane } from './lettering.hot';

export const FINALE_TIMING = {
  /** seconds in each automatic phase after Kindle */
  warming: 2.5, unbinding: 3.2, open: 3.0, released: 7.5,
  /** pages leave the book over this long; each flies `pageLife` s */
  pageSpread: 3.2, pageLife: 13,
  /** kits drift down this long after release starts, one every `kitGap` s; drift and pop seconds */
  kitFirst: 1.8, kitGap: 1.1, kitDrift: 3.2, kitPop: 0.6, kitScale: 0.42,
  /** a curled kit the standing hero comes this close to hops up and shuffles to a free slot */
  kitRoom: 0.95,
  /** the card: fox still this long by the cradle (within `restR`), or `timeout` s after snow begins */
  rest: 1.6, restR: 4.2, timeout: 24, cardIn: 2.5, cardHold: 7.5, cardOut: 2.5,
  snowRamp: 14,
  /** seconds for the hero to get up from lying (the lie-down played back) */
  getUp: 0.55,
};
const T = FINALE_TIMING;

export const PHASES = ['sealed', 'warming', 'unbinding', 'open', 'released', 'snow'] as const;
export type FinalePhase = (typeof PHASES)[number];
/** a kit: 0 pressed (in the Album), 1 drifting down as a page, 2 popped and trotting home, 3 curled by the ember,
 * 4 shuffling to a free slot because the hero came too close (still home: tla/Finale.tla `Disturb` / `Resettle`) */
export const KIT_PHASES = ['pressed', 'drifting', 'trotting', 'curled', 'shuffling'] as const;

export type FinaleRig = {
  /** live inputs */
  settled: () => boolean;
  emberInCradle: () => boolean;
  fox: THREE.Object3D;
  camera: THREE.PerspectiveCamera;
  canvas: HTMLCanvasElement;
  /** the shared paint uniform the world's toon shader reads for settled snow */
  snowCover: { value: number };
  groundH: (x: number, z: number) => number;
  /** cold one-shot events (may allocate) */
  events: { onward: (to: THREE.Vector3) => void; homeCaption: () => boolean; kindle: () => void; unbind: () => void; open: () => void; release: () => void; snow: () => void; card: () => void };
  /** scene parts */
  hinge: THREE.Object3D;
  screw: THREE.Object3D;
  wheel: THREE.Object3D;
  coverMat: THREE.MeshToonMaterial;
  paperMat: THREE.MeshToonMaterial;
  ironMat: THREE.MeshToonMaterial;
  lampPaper: THREE.MeshToonMaterial;
  emblemMat: THREE.MeshBasicMaterial;
  glowMat: THREE.MeshBasicMaterial;
  light: THREE.PointLight;
  /** the way to the cradle: motes along a pre-sampled path (xyz LUT, evenly spaced by arc length) */
  wayMesh: THREE.InstancedMesh;
  wayLut: Float32Array;
  wayLen: number;
  /** the onward stream from the pinned page at the well to the ember (LUT rebuilt cold via events.onward when the ember moves) */
  onwardMesh: THREE.InstancedMesh;
  onwardLut: Float32Array;
  onwardAt: THREE.Vector3;
  /** where the current stream starts (the fox, when it was last rebuilt) */
  onwardFrom: THREE.Vector3;
  emberAt: THREE.Vector3;
  homeReady: () => boolean;
  canTeachOnward: () => boolean;
  emberWhere: (out: THREE.Vector3) => boolean;
  pageMeshes: THREE.InstancedMesh[];
  leafMesh: THREE.InstancedMesh;
  pageSeed: Float32Array;
  snow: THREE.Points;
  snowMat: THREE.ShaderMaterial;
  kitFoxes: HearthFox[];
  kitPages: THREE.Mesh[];
  card: LetterPlane;
  /** the shared in-frame teach line (teach.ts) */
  teach: (text: string) => void;
  /** fixed points */
  cradle: THREE.Vector3;
  bookTop: THREE.Vector3;
  /** unit xz direction from the Press down the valley to the Still Crown */
  toCrown: THREE.Vector3;
  kitLand: Float32Array;
  /** each kit's current curl spot (x, z), picked from `kitSlots` */
  kitCurl: Float32Array;
  kitSlots: Float32Array;
  cover0: THREE.Color; cover1: THREE.Color; paper0: THREE.Color; paper1: THREE.Color; ember: THREE.Color; emblem0: THREE.Color;
  /** mutable state (numbers only) */
  s: {
    phase: number; t: number; clock: number; snowT: number; still: number; settledT: number; onwardT: number; onwardLen: number; homeSaid: number; restK: number; lieT: number; getUpT: number;
    card: 0 | 1 | 2; cardT: number; kitNear: number; foxX: number; foxZ: number; kindles: number; cardShows: number; wheel: number; leavesOut: number;
  };
  /** the hero's rest clips on its own mixer, blended over the controller while it lies by the ember */
  player: { setMoveScale: (k: number) => void; intent: () => number };
  heroLie: THREE.AnimationAction;
  heroRest: THREE.AnimationAction;
  lieDur: number;
  kitPhase: Int8Array;
  kitT: Float32Array;
  kitX: Float32Array;
  kitZ: Float32Array;
  kitYaw: Float32Array;
};

/** shortest-way damped angle (never flips side across ±π): frame-rate independent */
export function dampAngle(current: number, target: number, lambda: number, dt: number): number {
  let d = (target - current) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return current + d * (1 - Math.exp(-lambda * dt));
}

function smooth(x: number, a: number, b: number): number {
  return THREE.MathUtils.smoothstep(x, a, b);
}
const m4 = new THREE.Matrix4();
const q = new THREE.Quaternion();
const e = new THREE.Euler();
const sc = new THREE.Vector3();
const p3 = new THREE.Vector3();
const pageCounts = new Int32Array(3);

function enter(rig: FinaleRig, phase: number): void {
  rig.s.phase = phase;
  rig.s.t = 0;
  if (phase === 1) {
    rig.s.kindles++;
    rig.events.kindle();
  } else if (phase === 2) rig.events.unbind();
  else if (phase === 3) rig.events.open();
  else if (phase === 4) rig.events.release();
  else if (phase === 5) rig.events.snow();
}

function durationOf(phase: number): number {
  return phase === 1 ? T.warming : phase === 2 ? T.unbinding : phase === 3 ? T.open : phase === 4 ? T.released : Infinity;
}

/** a page particle at `age` s after it lifts off the book: spiral up, then away down the valley toward the Crown */
function pagePose(rig: FinaleRig, i: number, age: number): number {
  const sd = rig.pageSeed;
  const a = sd[i * 4]!, b = sd[i * 4 + 1]!, c = sd[i * 4 + 2]!, d = sd[i * 4 + 3]!;
  const u = Math.min(1, age / 3);
  const ang = a * 6.283 + age * (1.6 + b);
  const r = 0.25 + (1.4 + c * 1.6) * u;
  const away = Math.max(0, age - 2.4);
  const run = away * (4.2 + d * 2.4);
  const side = (b - 0.5) * 0.5 * run + Math.sin(age * 0.9 + a * 9) * 0.6;
  const X = rig.toCrown;
  p3.set(
    rig.bookTop.x + Math.cos(ang) * r + X.x * run - X.z * side,
    rig.bookTop.y + 0.15 + 4.2 * (1 - (1 - u) * (1 - u)) + away * (0.5 + c * 0.8) + Math.sin(age * 1.7 + d * 7) * 0.35,
    rig.bookTop.z + Math.sin(ang) * r + X.z * run + X.x * side,
  );
  e.set(age * (1.8 + c) + a * 6, age * 1.1 + b * 6, Math.sin(age * 2.6 + d * 6) * 0.7);
  q.setFromEuler(e);
  // page → leaf: the drawing shrinks as the leaf grows, both over the first stretch of the run
  return smooth(age, 2.0, 4.0);
}

function stepPages(rig: FinaleRig, since: number): void {
  pageCounts[0] = pageCounts[1] = pageCounts[2] = 0;
  let leaves = 0;
  const n = rig.leafMesh.instanceMatrix.count;
  for (let i = 0; i < n; i++) {
    const age = since - (i / n) * T.pageSpread;
    if (age < 0 || age > T.pageLife) continue;
    const k = pagePose(rig, i, age);
    const life = Math.min(1, age * 3) * (1 - smooth(age, T.pageLife - 2.5, T.pageLife));
    if (k < 1) {
      sc.setScalar(life * (1 - k));
      const mesh = rig.pageMeshes[i % 3]!;
      mesh.setMatrixAt(pageCounts[i % 3]!++, m4.compose(p3, q, sc));
    }
    if (k > 0) {
      sc.setScalar(life * k * 1.25);
      rig.leafMesh.setMatrixAt(leaves++, m4.compose(p3, q, sc));
    }
  }
  for (let j = 0; j < 3; j++) {
    const mesh = rig.pageMeshes[j]!;
    mesh.count = pageCounts[j]!;
    mesh.instanceMatrix.needsUpdate = true;
  }
  rig.leafMesh.count = leaves;
  rig.leafMesh.instanceMatrix.needsUpdate = true;
  rig.s.leavesOut = Math.max(rig.s.leavesOut, leaves);
}

/** the free slot farthest from the hero and from every other kit's spot (a kit is never asked to lie inside the fox) */
function pickSlot(rig: FinaleRig, i: number): void {
  const f = rig.fox.position;
  const sl = rig.kitSlots;
  let best = 0, bestScore = -1;
  for (let j = 0; j < sl.length; j += 2) {
    const x = sl[j]!, z = sl[j + 1]!;
    let score = Math.hypot(x - f.x, z - f.z);
    for (let k = 0; k < rig.kitFoxes.length; k++) {
      if (k === i || rig.kitPhase[k]! < 2) continue;
      score = Math.min(score, 1.6 * Math.hypot(x - rig.kitCurl[k * 2]!, z - rig.kitCurl[k * 2 + 1]!));
    }
    if (score > bestScore) {
      bestScore = score;
      best = j;
    }
  }
  rig.kitCurl[i * 2] = sl[best]!;
  rig.kitCurl[i * 2 + 1] = sl[best + 1]!;
}

function stepKit(rig: FinaleRig, i: number, dt: number, since: number): void {
  const kit = rig.kitFoxes[i]!;
  const page = rig.kitPages[i]!;
  const ph = rig.kitPhase[i]!;
  const lx = rig.kitLand[i * 2]!, lz = rig.kitLand[i * 2 + 1]!;
  if (ph === 0) {
    if (since < T.kitFirst + i * T.kitGap) return;
    rig.kitPhase[i] = 1;
    rig.kitT[i] = 0;
    page.visible = true;
  }
  rig.kitT[i]! += dt;
  const t = rig.kitT[i]!;
  if (rig.kitPhase[i] === 1) {
    // the page rocks down like a leaf from the book to its landing spot
    const u = Math.min(1, t / T.kitDrift);
    const fall = 1 - (1 - u) * (1 - u);
    const gy = rig.groundH(lx, lz);
    page.position.set(
      THREE.MathUtils.lerp(rig.bookTop.x, lx, u) + Math.sin(t * 2.4) * 0.5 * (1 - u),
      THREE.MathUtils.lerp(rig.bookTop.y + 2.2, gy + 0.36, fall) + Math.sin(u * Math.PI) * 1.2,
      THREE.MathUtils.lerp(rig.bookTop.z, lz, u),
    );
    page.rotation.set(Math.sin(t * 2.4) * 0.6 * (1 - u), t * 0.8, Math.cos(t * 2.4) * 0.4 * (1 - u));
    if (u >= 1) {
      rig.kitPhase[i] = 2;
      rig.kitT[i] = 0;
      rig.kitX[i] = lx;
      rig.kitZ[i] = lz;
      rig.kitYaw[i] = Math.atan2(rig.cradle.x - lx, rig.cradle.z - lz);
      pickSlot(rig, i);
      kit.root.visible = true;
      kit.play('idle');
    }
    return;
  }
  // popped: the page flattens away as the kit springs up out of it, then walks to its place by the ember
  const pop = Math.min(1, t / T.kitPop);
  const spring = pop >= 1 ? 1 : 1 - Math.exp(-6 * pop) * Math.cos(pop * 9.5);
  page.visible = pop < 1;
  page.scale.set(1 - pop, 1 - pop, 1 - pop);
  kit.root.scale.setScalar(T.kitScale * Math.max(0.001, spring));
  const cx = rig.kitCurl[i * 2]!, cz = rig.kitCurl[i * 2 + 1]!;
  if ((rig.kitPhase[i] === 2 && t > T.kitPop + 0.3) || rig.kitPhase[i] === 4) {
    const dx = cx - rig.kitX[i]!, dz = cz - rig.kitZ[i]!;
    const d = Math.hypot(dx, dz);
    if (d < 0.08) {
      rig.kitPhase[i] = 3;
      rig.kitT[i] = 0;
      kit.mixer.timeScale = 1;
      kit.play('lieDown' as 'idle');
    } else {
      kit.play('walk');
      // stride-matched: the authored walk speed scaled with the kit, easing into its spot (never below a slow
      // amble, so it always arrives); it steps straight at the spot while its body turns to face the way
      // (a kit making room hurries a little more)
      const walk = (kit.clipSpeed.walk ?? 0.53) * T.kitScale;
      const v = Math.max(0.12, Math.min(walk * (rig.kitPhase[i] === 4 ? 2.4 : 1.6), d * 2.5));
      kit.mixer.timeScale = v / Math.max(0.01, walk);
      // it goes round the hero, never through: lean the heading away from the fox inside `kitRoom` + a margin
      const f = rig.fox.position;
      const hx = rig.kitX[i]! - f.x, hz = rig.kitZ[i]! - f.z;
      const hd = Math.max(1e-3, Math.hypot(hx, hz));
      const push = Math.max(0, (T.kitRoom + 0.25 - hd) / 0.25) * 1.5;
      let ux = dx / d + (hx / hd) * push, uz = dz / d + (hz / hd) * push;
      const ul = Math.max(1e-3, Math.hypot(ux, uz));
      ux /= ul;
      uz /= ul;
      rig.kitYaw[i] = dampAngle(rig.kitYaw[i]!, Math.atan2(ux, uz), 8, dt);
      const step = Math.min(v * dt, d);
      rig.kitX[i]! += ux * step;
      rig.kitZ[i]! += uz * step;
    }
  }
  if (rig.kitPhase[i] === 3 && rig.s.restK <= 0 && rig.s.getUpT < 0) {
    // the standing hero walks into a curled kit: it hops up and shuffles over to a free slot
    const f = rig.fox.position;
    if (Math.hypot(f.x - rig.kitX[i]!, f.z - rig.kitZ[i]!) < T.kitRoom) {
      rig.kitPhase[i] = 4;
      // past the pop: the kit keeps its size, it only gets up and walks
      rig.kitT[i] = T.kitPop + 1;
      pickSlot(rig, i);
    }
  }
  if (rig.kitPhase[i] === 3) {
    // curled: settle down, then breathe
    if (kit.clip === ('lieDown' as 'idle') && rig.kitT[i]! > rig.lieDur) kit.play('rest' as 'idle');
    rig.kitYaw[i] = dampAngle(rig.kitYaw[i]!, Math.atan2(rig.cradle.x - rig.kitX[i]!, rig.cradle.z - rig.kitZ[i]!), 3, dt);
  }
  kit.root.position.set(rig.kitX[i]!, rig.groundH(rig.kitX[i]!, rig.kitZ[i]!), rig.kitZ[i]!);
  kit.root.rotation.y = rig.kitYaw[i]!;
  kit.update(dt);
}

/** the way: sparse motes drift from the root-hearth to the cradle while the Press waits, and fade once it is kindled */
function stepWay(rig: FinaleRig, dt: number): void {
  const s = rig.s;
  if (rig.settled()) s.settledT += dt;
  const on = smooth(s.settledT, 3, 6) * (s.phase === 0 ? 1 : 1 - smooth(s.t + (s.phase > 1 ? 9 : 0), 0, 2.5));
  const mesh = rig.wayMesh;
  if (on <= 0.001) {
    mesh.count = 0;
    return;
  }
  const n = mesh.instanceMatrix.count;
  const lut = rig.wayLut;
  const N = lut.length / 3;
  let k = 0;
  for (let i = 0; i < n; i++) {
    const u = (i / n + (s.settledT * 1.6) / rig.wayLen) % 1;
    const f = u * (N - 1);
    const j = Math.min(N - 2, Math.floor(f));
    const w = f - j;
    p3.set(
      lut[j * 3]! + (lut[j * 3 + 3]! - lut[j * 3]!) * w + Math.sin(s.clock * 0.9 + i * 2.1) * 0.22,
      lut[j * 3 + 1]! + (lut[j * 3 + 4]! - lut[j * 3 + 1]!) * w + Math.sin(s.clock * 1.3 + i) * 0.16,
      lut[j * 3 + 2]! + (lut[j * 3 + 5]! - lut[j * 3 + 2]!) * w,
    );
    const size = on * (0.6 + 0.4 * Math.sin(i * 7.3)) * Math.min(1, u * 14, (1 - u) * 8);
    sc.setScalar(Math.max(0.001, size));
    q.identity();
    mesh.setMatrixAt(k++, m4.compose(p3, q, sc));
  }
  mesh.count = k;
  mesh.instanceMatrix.needsUpdate = true;
}

/**
 * The hero lies down with the kits: in snow, still by the ember, it blends lieDown → rest over whatever the controller
 * plays (a heavy weight so the controller's idle only tints it). Asking to move starts a get-up: the controller is held
 * in place while lieDown plays back (chest and fore paws first, then the hips), then movement eases back in — the fox
 * never turns or slides on its belly (feel critic, 7527b97).
 */
function stepHeroRest(rig: FinaleRig, dt: number): void {
  const s = rig.s;
  const asking = rig.player.intent() > 0.1;
  if (s.getUpT >= 0) {
    s.getUpT += dt;
    // movement returns once the body is mostly up
    rig.player.setMoveScale(smooth(s.getUpT, T.getUp * 0.55, T.getUp));
    rig.heroLie.setEffectiveWeight(30 * (1 - smooth(s.getUpT, T.getUp * 0.45, T.getUp)));
    rig.heroRest.setEffectiveWeight(0);
    if (s.getUpT >= T.getUp) {
      s.getUpT = -1;
      s.restK = 0;
      s.lieT = 0;
      rig.heroLie.stop();
      rig.heroRest.stop();
      rig.heroLie.timeScale = 1;
      rig.player.setMoveScale(1);
    }
    return;
  }
  const want = s.phase === 5 && s.still >= T.rest * 0.5 && !asking ? 1 : 0;
  if (asking && s.restK > 0.05) {
    // get up: play the lie-down backwards from wherever it is, quickly
    s.getUpT = 0;
    rig.player.setMoveScale(0);
    rig.heroLie.paused = false;
    rig.heroLie.timeScale = -(rig.lieDur * 0.4) / (T.getUp * 0.8);
    // skip the settle (f16-24 barely moves): the body visibly starts up within a frame or two of the input
    rig.heroLie.time = Math.min(rig.heroLie.time, rig.lieDur * 0.4);
    if (s.lieT >= rig.lieDur) rig.heroLie.time = rig.lieDur * 0.4;
    rig.heroLie.play();
    return;
  }
  s.restK = want > s.restK ? Math.min(1, s.restK + dt / 0.6) : Math.max(0, s.restK - dt / 0.4);
  if (s.restK <= 0) {
    if (s.lieT > 0) {
      s.lieT = 0;
      rig.heroLie.stop();
      rig.heroRest.stop();
    }
    return;
  }
  if (s.lieT === 0) {
    rig.heroLie.reset().play();
    rig.heroRest.reset().play();
  }
  s.lieT += dt;
  const toRest = smooth(s.lieT, rig.lieDur - 0.35, rig.lieDur);
  rig.heroLie.setEffectiveWeight(30 * s.restK * (1 - toRest));
  rig.heroRest.setEffectiveWeight(30 * s.restK * toRest);
}

/** onward: after the page comes home, motes stream from the well to wherever the ember rests, until it is carried or kindled */
const ONWARD_HINT = 'Follow the warm light home';

function stepOnward(rig: FinaleRig, dt: number): void {
  const s = rig.s;
  const mesh = rig.onwardMesh;
  const carried = rig.emberWhere(rig.emberAt);
  const f = rig.fox.position;
  const near = Math.hypot(f.x - rig.emberAt.x, f.z - rig.emberAt.z) < 5;
  const local = worldAt(f.x) === 'russetvale';
  const want = local && s.phase === 0 && rig.homeReady() && !carried && !near;
  // a page already kept when the game loads (saved progress) comes home quietly: no reveal, no caption replay
  if (s.homeSaid === 0 && s.clock < 1 && rig.homeReady()) s.homeSaid = 1;
  if (local && s.phase === 0 && rig.homeReady() && !carried && s.homeSaid === 0) {
    // Remote page completion leaves the reveal pending until the fox comes home.
    if (rig.events.homeCaption()) s.homeSaid = 1;
  }
  if (want && (rig.emberAt.distanceToSquared(rig.onwardAt) > 1 || f.distanceToSquared(rig.onwardFrom) > 16)) rig.events.onward(rig.emberAt);
  s.onwardT = want ? Math.min(3, s.onwardT + dt) : Math.max(0, s.onwardT - dt * 2);
  // say it too: a first-timer stood on the overlook after the catch with nothing pointing onward (Kit, 2f5af69)
  if (want && s.onwardT > 0.5 && rig.canTeachOnward()) rig.teach(ONWARD_HINT);
  const on = smooth(s.onwardT, 0.5, 3);
  if (on <= 0.001) {
    mesh.count = 0;
    return;
  }
  const n = mesh.instanceMatrix.count;
  const lut = rig.onwardLut;
  const N = lut.length / 3;
  for (let i = 0; i < n; i++) {
    const u = (i / n + (s.clock * 1.8) / s.onwardLen) % 1;
    const fu = u * (N - 1);
    const j = Math.min(N - 2, Math.floor(fu));
    const w = fu - j;
    p3.set(
      lut[j * 3]! + (lut[j * 3 + 3]! - lut[j * 3]!) * w + Math.sin(s.clock * 0.9 + i * 2.1) * 0.22,
      lut[j * 3 + 1]! + (lut[j * 3 + 4]! - lut[j * 3 + 1]!) * w + Math.sin(s.clock * 1.3 + i) * 0.16,
      lut[j * 3 + 2]! + (lut[j * 3 + 5]! - lut[j * 3 + 2]!) * w,
    );
    sc.setScalar(Math.max(0.001, on * (0.6 + 0.4 * Math.sin(i * 7.3)) * Math.min(1, u * 14, (1 - u) * 8)));
    q.identity();
    mesh.setMatrixAt(i, m4.compose(p3, q, sc));
  }
  mesh.count = n;
  mesh.instanceMatrix.needsUpdate = true;
}

export function updateFinale(rig: FinaleRig, dt: number): void {
  const s = rig.s;
  s.clock += dt;
  s.t += dt;
  // Kindle: warmth set in the cradle once the Keeping has settled; every later phase is automatic
  if (s.phase === 0) {
    if (rig.settled() && rig.emberInCradle()) enter(rig, 1);
  } else if (s.phase < 5 && s.t >= durationOf(s.phase)) enter(rig, s.phase + 1);
  stepWay(rig, dt);
  stepOnward(rig, dt);
  const ph = s.phase;
  if (ph === 0) return;
  // (fox travel since last frame is read below; the position is stored at the end of the step)

  // warming: the cradle flares, the iron glows, ink frost lifts off the covers and the emblem warms
  const warm = ph === 1 ? smooth(s.t, 0, T.warming) : 1;
  const flare = ph === 1 ? Math.sin(Math.min(1, s.t / T.warming) * Math.PI) : 0;
  rig.glowMat.opacity = 0.32 * warm * (0.9 + 0.1 * Math.sin(s.clock * 2.1)) + 0.25 * flare;
  rig.light.intensity = 2.2 * warm + 2.5 * flare;
  rig.coverMat.color.copy(rig.cover0).lerp(rig.cover1, warm);
  rig.emblemMat.color.copy(rig.emblem0).lerp(rig.ember, smooth(warm, 0, 0.6));
  rig.ironMat.emissive.setRGB(0.55, 0.16, 0.04).multiplyScalar(ph <= 2 ? warm * (ph === 2 ? 1 - smooth(s.t, 1.5, T.unbinding) : 1) : 0);
  rig.lampPaper.emissive.setRGB(0.6, 0.28, 0.08).multiplyScalar(warm);

  // unbinding: the wheel turns and the screw backs out, lifting the platen clear of the cover
  const lift = ph === 2 ? smooth(s.t, 0.2, T.unbinding) : ph > 2 ? 1 : 0;
  if (ph === 2) s.wheel += dt * 3.2 * Math.sin(Math.min(1, s.t / T.unbinding) * Math.PI);
  rig.wheel.rotation.y = s.wheel;
  rig.screw.position.y = lift * 2.4;

  // open: the cover turns over the spine and comes to rest on the stone (a slight settle, no bounce)
  const turn = ph === 3 ? smooth(s.t, 0, T.open) : ph > 3 ? 1 : 0;
  rig.hinge.rotation.z = turn * (Math.PI + 0.26) + (ph > 3 ? Math.sin(Math.min(1, s.t / 0.8) * Math.PI) * 0.025 * Math.exp(-s.t * 3) : 0);
  rig.paperMat.color.copy(rig.paper0).lerp(rig.paper1, turn);

  // released (and on into snow): pages fly, kits drift down and come home to the ember
  if (ph >= 4) {
    const since = ph === 4 ? s.t : T.released + s.t;
    stepPages(rig, since);
    for (let i = 0; i < rig.kitFoxes.length; i++) stepKit(rig, i, dt, since);
  }

  // snow: falls in the shader round the camera, thickening slowly
  if (ph === 5) {
    s.snowT += dt;
    rig.snow.visible = true;
    const u = rig.snowMat.uniforms;
    u.uTime!.value = s.snowT;
    u.uAmount!.value = smooth(s.snowT, 0, T.snowRamp);
    u.uHalfH!.value = rig.canvas.height * 0.5;
    // and it settles: a slow dusting on every sky-facing painted surface
    rig.snowCover.value = smooth(s.snowT, 4, 80) * 0.8;
    (u.uCenter!.value as THREE.Vector3).copy(rig.camera.position);
  }

  // the card: once, in snow, every kit curled, the fox resting by the ember (or after the grace timeout)
  if (ph === 5) {
    const f = rig.fox.position;
    const near = Math.hypot(f.x - rig.cradle.x, f.z - rig.cradle.z) < T.restR;
    const speed = Math.hypot(f.x - s.foxX, f.z - s.foxZ) / Math.max(1e-4, dt);
    s.still = near && speed < 0.15 ? s.still + dt : 0;
  }
  stepHeroRest(rig, dt);
  if (s.card === 0 && ph === 5) {
    let curled = true;
    // home = curled, or shuffling to a new spot after the hero came close
    for (let i = 0; i < rig.kitPhase.length; i++) if (rig.kitPhase[i]! < 3) curled = false;
    if (curled && (s.still >= T.rest || s.snowT >= T.timeout)) {
      s.card = 1;
      s.cardT = 0;
      s.cardShows++;
      rig.events.card();
    }
  }
  s.foxX = rig.fox.position.x;
  s.foxZ = rig.fox.position.z;
  if (s.card === 1) {
    s.cardT += dt;
    const o = smooth(s.cardT, 0, T.cardIn) * (1 - smooth(s.cardT, T.cardIn + T.cardHold, T.cardIn + T.cardHold + T.cardOut));
    if (s.cardT >= T.cardIn + T.cardHold + T.cardOut) s.card = 2;
    fitLetterPlane(rig.card, rig.camera, s.card === 1 ? o : 0);
  }
  // review metric: the closest any landed kit stands to the hero (≥ ~0.8 m = no kit drawn inside the fox)
  s.kitNear = 99;
  const f = rig.fox.position;
  for (let i = 0; i < rig.kitPhase.length; i++) if (rig.kitPhase[i]! >= 2) s.kitNear = Math.min(s.kitNear, Math.hypot(f.x - rig.kitX[i]!, f.z - rig.kitZ[i]!));
}
