/**
 * Lookdev play (`?lookdev=p0` stills; the opening is the default boot): the hearth-fox runs the P0 clearing under a real chase camera.
 * DESIGN-lookdev-play.md. Authored clips are the pose (speed-driven gait tree, pose-matched gait
 * changes, jumpUp → fall → land); procedural work is limited to small additives (turn bank, pitch).
 */
import * as THREE from 'three';
import { createFollowCamera, type FollowCamera } from './camera';
import type { HearthFox } from './lookdevFox';
import type { UpdraftSystem } from './chem/updraft';

/** Walkable / blocking shapes built from the same data that places the props. */
export type Collider =
  /** mound (rock): surface = base + h·√(1 − (d/r)²) */
  | { kind: 'cap'; x: number; z: number; r: number; base: number; h: number }
  /** oriented box (plinth step, pier, ruin block); `yaw` = the group's rotation.y */
  | { kind: 'box'; x: number; z: number; yaw: number; hx: number; hz: number; top: number; oneWay?: boolean }
  /** trunk: always blocks */
  | { kind: 'post'; x: number; z: number; r: number };

/** lens volume samples: centre + 8 around the rim (unit radius) */
const LENS_RING = [[0, 0], ...Array.from({ length: 8 }, (_, i) => [Math.cos((i * Math.PI) / 4), Math.sin((i * Math.PI) / 4)])] as const;

export const PLAY = {
  runSpeed: 3.2,
  walkSpeed: 0.85,
  /** ground speed ease (1/s) up / down */
  accel: 3.2,
  decel: 5.5,
  /** yaw rate (rad/s) at a standstill and at full run */
  turnSlow: 7,
  turnFast: 3.6,
  jumpVelocity: 5.0,
  glideSink: 1.35,
  dashSpeed: 8,
  dashDuration: 0.24,
  dashCooldown: 0.55,
  gravity: 15,
  fallGravity: 1.45,
  /** vy multiplier when jump is released while rising */
  jumpCut: 0.5,
  coyote: 0.1,
  buffer: 0.12,
  airControl: 1.6,
  /** max step-up without a jump (m) */
  step: 0.22,
  /** gait playback bounds relative to the authored cadence */
  minRate: 0.6,
  maxRate: 1.7,
  gaitHysteresis: 0.12,
  gaitFade: 0.2,
  idleFade: 0.3,
  turnBank: 0.05,
  bankMax: 0.18,
  airPitch: 0.06,
  /** above this ground speed a touchdown keeps the gait instead of the (planted) land clip */
  landMaxSpeed: 0.35,
  slopeTilt: 1,
  /** foot IK: 0 = clip only */
  footIK: 1,
  /** clip paw height (m above the root plane) that counts as stance */
  stanceHeight: 0.035,
  /** pre-IK paw world speed (m/s) below which a low paw counts as planted */
  stanceSpeed: 0.6,
  maxLock: 0.06,
  maxPelvisDrop: 0.08,
};

const TAU = Math.PI * 2;
const wrap = (a: number) => a - TAU * Math.floor((a + Math.PI) / TAU);

function colliderTop(c: Collider, x: number, z: number): number {
  const dx = x - c.x;
  const dz = z - c.z;
  if (c.kind === 'post') return dx * dx + dz * dz < c.r * c.r ? Infinity : -Infinity;
  if (c.kind === 'cap') {
    const k = 1 - (dx * dx + dz * dz) / (c.r * c.r);
    return k > 0 ? c.base + c.h * Math.sqrt(k) : -Infinity;
  }
  const cos = Math.cos(c.yaw);
  const sin = Math.sin(c.yaw);
  const lx = dx * cos - dz * sin;
  const lz = dx * sin + dz * cos;
  return Math.abs(lx) < c.hx && Math.abs(lz) < c.hz ? c.top : -Infinity;
}

type AnimState = 'idle' | 'loco' | 'jumpUp' | 'fall' | 'land';
const STATE_FADE: Record<Exclude<AnimState, 'loco' | 'idle'>, number> = { jumpUp: 0.06, fall: 0.16, land: 0.06 };
const BINS = 32;

/**
 * Clip driver on the fox's mixer. Gaits (walk / trot / lope / run, whichever are authored) are time-driven
 * from their own phase at a stride-matched rate; a gait change enters the new clip at the phase whose
 * paw layout best matches the old one. Other states are ordinary crossfaded actions.
 */
class FoxAnimator {
  readonly gaits: { name: string; speed: number; dur: number; action: THREE.AnimationAction; phase: number; share: number }[];
  private states = new Map<string, { action: THREE.AnimationAction; w: number }>();
  private match = new Map<string, Float32Array>();
  private entry = new Map<string, number>();
  private gait = 0;
  private locoW = 0;
  state: AnimState = 'idle';
  rate = 1;

  constructor(private fox: HearthFox) {
    const { actions, clipSpeed } = fox;
    this.gaits = ['walk', 'trot', 'lope', 'run']
      .filter((n) => actions.has(n) && (clipSpeed[n] ?? 0) > 0)
      .map((name) => {
        const action = actions.get(name)!;
        return { name, speed: clipSpeed[name]!, dur: action.getClip().duration, action, phase: 0, share: 0 };
      })
      .sort((a, b) => a.speed - b.speed);
    if (!this.gaits.length) throw new Error('hearth fox has no gait clips');
    for (const name of ['idle', 'jumpUp', 'fall', 'land']) {
      const action = actions.get(name) ?? this.stillFrom('run', name);
      if (name !== 'idle' && name !== 'fall') {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
      }
      this.states.set(name, { action, w: name === 'idle' ? 1 : 0 });
    }
    this.buildPoseMatch();
    for (const a of fox.actions.values()) a.setEffectiveWeight(0);
    this.states.get('idle')!.action.setEffectiveWeight(1).play();
  }

  /** Air poses held from the run until jumpUp / fall / land are authored (Blender, @ember). */
  private stillFrom(src: string, name: string): THREE.AnimationAction {
    const at = { jumpUp: 0.3, fall: 0.62, land: 0.92 }[name] ?? 0;
    const clip = this.fox.actions.get(src)!.getClip().clone();
    clip.name = `${name}~${src}`;
    const action = this.fox.mixer.clipAction(clip);
    action.time = clip.userData.holdAt = at * clip.duration;
    action.setEffectiveTimeScale(0);
    return action;
  }

  private buildPoseMatch() {
    const { fox } = this;
    const all = [...fox.actions.values()];
    const sample = (action: THREE.AnimationAction, t: number) => {
      for (const a of all) {
        a.play();
        a.setEffectiveWeight(0);
      }
      action.setEffectiveTimeScale(0).setEffectiveWeight(1);
      action.time = t;
      fox.mixer.update(0);
      fox.root.updateMatrixWorld(true);
      return Object.values(fox.paws()).flatMap((p) => fox.root.worldToLocal(new THREE.Vector3(...p)).toArray());
    };
    const poses = this.gaits.map((g) => Array.from({ length: BINS }, (_, i) => sample(g.action, (i / BINS) * g.dur)));
    const idle = sample(this.states.get('idle')!.action, 0);
    const d2 = (a: number[], b: number[]) => a.reduce((s, x, k) => s + (x - b[k]!) ** 2, 0);
    this.gaits.forEach((from, fi) =>
      this.gaits.forEach((to, ti) => {
        if (fi === ti) return;
        const table = new Float32Array(BINS);
        for (let i = 0; i < BINS; i++) {
          let best = 0;
          let bestD = Infinity;
          for (let j = 0; j < BINS; j++) {
            const d = d2(poses[fi]![i]!, poses[ti]![j]!) + d2(poses[fi]![(i + 2) % BINS]!, poses[ti]![(j + 2) % BINS]!);
            if (d < bestD) [best, bestD] = [j, d];
          }
          table[i] = best / BINS;
        }
        this.match.set(`${from.name}>${to.name}`, table);
      }),
    );
    this.gaits.forEach((g, gi) => {
      let best = 0;
      let bestD = Infinity;
      poses[gi]!.forEach((p, j) => {
        const d = d2(idle, p);
        if (d < bestD) [best, bestD] = [j, d];
      });
      this.entry.set(g.name, best / BINS);
    });
    for (const a of all) {
      a.setEffectiveTimeScale(1);
      a.stop();
    }
    for (const g of this.gaits) g.action.setEffectiveTimeScale(0);
  }

  /** speed = ground speed (m/s); state chosen by the controller */
  update(dt: number, speed: number, state: AnimState) {
    const P = PLAY;
    if (state !== this.state && this.states.has(state)) {
      const s = this.states.get(state)!.action;
      const hold = s.getClip().userData.holdAt as number | undefined;
      if (state !== 'idle') s.reset();
      if (hold !== undefined) {
        s.setEffectiveTimeScale(0);
        s.time = hold;
      }
      s.play();
    }
    this.state = state;

    // gait tree: pick by speed with hysteresis around the geometric mean of neighbouring clip speeds
    const entering = this.locoW < 1e-3;
    const h = entering ? 0 : P.gaitHysteresis;
    const prev = this.gait;
    let g = prev;
    while (g < this.gaits.length - 1 && speed > Math.sqrt(this.gaits[g]!.speed * this.gaits[g + 1]!.speed) * (1 + h)) g++;
    while (g > 0 && speed < Math.sqrt(this.gaits[g - 1]!.speed * this.gaits[g]!.speed) * (1 - h)) g--;
    this.gait = g;
    const cur = this.gaits[g]!;
    if (entering && state === 'loco') {
      cur.phase = this.entry.get(cur.name) ?? 0;
      for (const x of this.gaits) x.share = x === cur ? 1 : 0;
    } else if (g !== prev) {
      const from = this.gaits[prev]!;
      cur.phase = this.match.get(`${from.name}>${cur.name}`)![Math.floor(from.phase * BINS) % BINS]!;
    }
    const shareStep = dt / P.gaitFade;
    for (const x of this.gaits) {
      x.share = x === cur ? Math.min(1, x.share + shareStep) : Math.max(0, x.share - shareStep);
      // stride-matched cadence: the paws travel with the ground (bounded around the authored rate)
      const rate = THREE.MathUtils.clamp(speed / x.speed, P.minRate, P.maxRate);
      if (x === cur) this.rate = rate;
      if (x.share > 0) x.phase = (x.phase + (dt * rate) / x.dur) % 1;
    }

    // crossfade: loco tree fades as one state
    const fade = state === 'idle' ? P.idleFade : state === 'loco' ? P.gaitFade : STATE_FADE[state];
    const step = dt / Math.max(1e-3, fade);
    const toward = (w: number, t: number) => (w < t ? Math.min(t, w + step) : Math.max(t, w - step));
    this.locoW = toward(this.locoW, state === 'loco' ? 1 : 0);
    let total = this.locoW;
    for (const [name, s] of this.states) {
      s.w = toward(s.w, name === state ? 1 : 0);
      total += s.w;
    }
    const norm = total > 1e-5 ? 1 / total : 0;
    const shares = this.gaits.reduce((s, x) => s + x.share, 0) || 1;
    for (const x of this.gaits) {
      const w = (this.locoW * x.share * norm) / shares;
      x.action.time = x.phase * x.dur;
      if (w > 1e-4 && !x.action.isRunning()) x.action.play();
      x.action.setEffectiveWeight(w);
    }
    for (const s of this.states.values()) {
      const w = s.w * norm;
      if (w > 1e-4 && !s.action.isRunning() && !s.action.paused) s.action.play();
      s.action.setEffectiveWeight(w);
    }
  }

  /** one-shot finished (jumpUp / land) */
  done(state: 'jumpUp' | 'land'): boolean {
    const a = this.states.get(state)!.action;
    return a.getClip().userData.holdAt !== undefined ? false : a.time >= a.getClip().duration - 1e-3;
  }
  oneShotLength(state: 'jumpUp' | 'land'): number {
    const a = this.states.get(state)!.action;
    return a.getClip().userData.holdAt !== undefined ? (state === 'land' ? 0.18 : 0.12) : a.getClip().duration;
  }
  get gaitName(): string {
    return this.gaits[this.gait]!.name;
  }
}

const UP = new THREE.Vector3(0, 1, 0);
const v3 = () => new THREE.Vector3();
const qt = () => new THREE.Quaternion();

/**
 * Light foot IK on top of the clip (port of main's AuthoredLocomotion foot pass to the hearth rig):
 * a paw the clip has on its ground plane is in stance → it latches where it landed (bounded lock),
 * every paw follows the terrain under it, the pelvis drops so the lowest stance paw reaches, and
 * a two-bone solve (shoulder/hip → elbow/stifle → pastern/meta) carries the paw; pastern/meta and
 * paw keep their clip world orientation.
 */
class FootIK {
  private feet: {
    upper: THREE.Object3D; lower: THREE.Object3D; hock: THREE.Object3D; paw: THREE.Object3D; pole: number;
    planted: boolean; anchor: THREE.Vector3; lock: THREE.Vector3; prev: THREE.Vector3 | null; raw: THREE.Vector3 | null;
  }[] = [];
  private pelvis = 0;
  /** worst stance-paw XZ speed this frame (m/s) — skate metric */
  slide = 0;
  stanceFeet = 0;

  constructor(private root: THREE.Object3D, private model: THREE.Object3D) {
    const find = (n: string) => {
      const o = model.getObjectByName(n);
      if (!o) throw new Error(`hearth fox rig: missing ${n}`);
      return o;
    };
    for (const sd of ['L', 'R']) {
      this.feet.push({ upper: find(`upperarm${sd}`), lower: find(`forearm${sd}`), hock: find(`pastern${sd}`), paw: find(`fpaw${sd}`), pole: -1, planted: false, anchor: v3(), lock: v3(), prev: null, raw: null });
      this.feet.push({ upper: find(`thigh${sd}`), lower: find(`shin${sd}`), hock: find(`meta${sd}`), paw: find(`hpaw${sd}`), pole: 1, planted: false, anchor: v3(), lock: v3(), prev: null, raw: null });
    }
  }

  apply(dt: number, ground: (x: number, z: number) => number, grounded: boolean, moving: boolean) {
    const { root, model } = this;
    const P = PLAY;
    model.position.y = 0;
    root.updateMatrixWorld(true);
    const baseY = root.position.y;
    this.slide = 0;
    this.stanceFeet = 0;
    if (!grounded || P.footIK <= 0) {
      for (const f of this.feet) [f.planted, f.prev, f.raw] = [false, null, null];
      this.pelvis = THREE.MathUtils.damp(this.pelvis, 0, 18, dt);
      model.position.y = this.pelvis;
      return;
    }
    const plans = this.feet.map((f) => {
      const pad = f.paw.getWorldPosition(v3());
      // stance = the clip has the paw on its ground plane AND (nearly) still in the world
      const rawSpeed = f.raw ? Math.hypot(pad.x - f.raw.x, pad.z - f.raw.z) / Math.max(dt, 1e-5) : 0;
      f.raw = pad.clone();
      const stance = pad.y - baseY < P.stanceHeight && rawSpeed < P.stanceSpeed;
      const g = ground(pad.x, pad.z);
      if (stance && !f.planted) [f.planted, f.anchor] = [true, pad.clone()];
      else if (!stance) f.planted = false;
      if (f.planted && moving) {
        const want = f.anchor.clone().sub(pad).setY(0);
        if (want.length() > P.maxLock) {
          want.setLength(P.maxLock);
          f.anchor.copy(pad).add(want);
        }
        f.lock.copy(want);
      } else f.lock.multiplyScalar(Math.exp(-dt / 0.06));
      // the clip's paw height rides on the terrain under the paw (never below it)
      const target = pad.clone().add(f.lock);
      target.y = Math.max(pad.y + (g - baseY), g);
      return { target, stance, need: target.y - pad.y };
    });
    let need = Infinity;
    for (const p of plans) if (p.stance) need = Math.min(need, p.need);
    this.pelvis = THREE.MathUtils.damp(this.pelvis, Number.isFinite(need) ? THREE.MathUtils.clamp(need, -P.maxPelvisDrop, 0.02) : 0, 18, dt);
    model.position.y = this.pelvis;
    model.updateMatrixWorld(true);
    this.feet.forEach((f, i) => {
      const { target, stance } = plans[i]!;
      const pad = f.paw.getWorldPosition(v3());
      if (pad.distanceToSquared(target) > 1e-8) this.place(f, target);
      const solved = f.paw.getWorldPosition(v3());
      if (stance) {
        this.stanceFeet++;
        if (f.prev) this.slide = Math.max(this.slide, Math.hypot(solved.x - f.prev.x, solved.z - f.prev.z) / Math.max(dt, 1e-5));
        f.prev = solved;
      } else f.prev = null;
    });
  }

  private place(f: FootIK['feet'][number], target: THREE.Vector3) {
    const hockRot = f.hock.getWorldQuaternion(qt());
    const pawRot = f.paw.getWorldQuaternion(qt());
    const metatarsus = f.paw.getWorldPosition(v3()).sub(f.hock.getWorldPosition(v3()));
    this.solve(f.upper, f.lower, f.hock, target.clone().sub(metatarsus), f.pole);
    f.hock.quaternion.copy(f.hock.parent!.getWorldQuaternion(qt()).invert().multiply(hockRot));
    f.hock.updateWorldMatrix(false, true);
    f.paw.quaternion.copy(f.paw.parent!.getWorldQuaternion(qt()).invert().multiply(pawRot));
    f.paw.updateWorldMatrix(false, true);
  }

  private solve(upper: THREE.Object3D, lower: THREE.Object3D, end: THREE.Object3D, target: THREE.Vector3, pole: number) {
    const a = upper.getWorldPosition(v3());
    const b = lower.getWorldPosition(v3());
    const c = end.getWorldPosition(v3());
    const l1 = a.distanceTo(b);
    const l2 = b.distanceTo(c);
    if (l1 < 1e-3 || l2 < 1e-3) return;
    const dir = target.clone().sub(a).normalize();
    const dist = THREE.MathUtils.clamp(a.distanceTo(target), Math.abs(l1 - l2) + 1e-4, l1 + l2 - 1e-4);
    // keep the clip's bend plane; fall back to the anatomical pole (elbow back, stifle forward)
    const bend = b.clone().sub(a);
    bend.addScaledVector(dir, -bend.dot(dir));
    if (bend.lengthSq() < (0.05 * l1) ** 2) {
      bend.set(0, 0, pole).applyQuaternion(this.root.quaternion);
      bend.addScaledVector(dir, -bend.dot(dir));
    }
    if (bend.lengthSq() < 1e-8) return;
    bend.normalize();
    const along = (l1 * l1 + dist * dist - l2 * l2) / (2 * dist);
    const joint = a.clone().addScaledVector(dir, along).addScaledVector(bend, Math.sqrt(Math.max(0, l1 * l1 - along * along)));
    const aim = (bone: THREE.Object3D, from: THREE.Vector3, to: THREE.Vector3) => {
      const world = bone.getWorldQuaternion(qt());
      const fix = qt().setFromUnitVectors(from.normalize(), to.normalize());
      bone.quaternion.copy(bone.parent!.getWorldQuaternion(qt()).invert().multiply(fix.multiply(world)));
      bone.updateWorldMatrix(false, true);
    };
    aim(upper, b.clone().sub(a), joint.clone().sub(a));
    const elbow = lower.getWorldPosition(v3());
    aim(lower, end.getWorldPosition(v3()).sub(elbow), target.clone().sub(elbow));
  }
}

export interface PlayController {
  cam: FollowCamera;
  /** Highest walkable surface; posts return Infinity so placement can reject them. */
  surfaceAt: (x: number, z: number) => number;
  step: (dt: number) => void;
  state: () => Record<string, unknown>;
  setStick: (x: number | null, z?: number) => void;
  setKeys: (codes: string[]) => void;
  teleport: (x: number, z: number, yaw: number) => void;
}

export function createPlay(opts: {
  fox: HearthFox;
  groundH: (x: number, z: number) => number;
  colliders: Collider[];
  start: { x: number; z: number; yaw: number };
  /** touchdown from a jump: feet position, impact 0..1 */
  onLand?: (at: THREE.Vector3, impact: number) => void;
  /** Supported top contact; optional spring returns launch velocity after its load dwell. */
  onGroundContact?: (at: THREE.Vector3, arrivalSpeed: number, jumpHeld: boolean, dt: number) => number | null;
  /** Contextual pickup/place. Edged independently of key repeat. */
  onInteract?: () => void;
  /** Called before an accepted dash changes velocity, including midair dashes. */
  onDash?: (lastGrounded: THREE.Vector3) => void;
  /**
   * Blockers that sit right beside the fox (arch piers). Main's follow camera does not pull in for a
   * blocker within ~1 m of the fox; it reports a fade and leaves the cutout to the world. These meshes
   * fade (and drop their ink hulls) while that fade is on.
   */
  cutout?: THREE.Object3D[];
  /** Opening heat teach: existing chemistry volume, sampled by real movement. */
  updrafts?: UpdraftSystem;
}): PlayController {
  const { fox, groundH, colliders } = opts;
  const P = PLAY;
  const anim = new FoxAnimator(fox);
  const ik = new FootIK(fox.root, fox.model);

  /** walkable surface (posts excluded unless `solid`) */
  const surface = (x: number, z: number, solid = true, ceiling = Infinity) => {
    let y = groundH(x, z);
    for (const c of colliders) {
      if (c.kind === 'box' && c.oneWay && c.top > ceiling) continue;
      if (solid || c.kind !== 'post') y = Math.max(y, colliderTop(c, x, z));
    }
    return y;
  };

  /** lens sphere inside a pier / block / rock / trunk */
  const lensBlocked = (x: number, y: number, z: number, r: number) =>
    colliders.some((c) => {
      if (c.kind === 'box' && c.oneWay) return false;
      for (const [ox, oz] of LENS_RING.map(([u, w]) => [u * r, w * r])) if (colliderTop(c, x + ox, z + oz) > y - r) return true;
      return false;
    });
  /**
   * Sight blockers for the follow camera's scenery occlusion (it pulls the boom in front of anything
   * between lens and fox): unrendered solid proxies of piers, blocks and trunks built from the colliders.
   */
  const sightProxies = new THREE.Group();
  const proxyMat = new THREE.MeshStandardMaterial();
  for (const c of colliders) {
    const base = groundH(c.x, c.z) - 0.2;
    if (c.kind === 'box' && !c.oneWay && c.top - base > 1) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(c.hx * 2, c.top - base, c.hz * 2), proxyMat);
      m.position.set(c.x, (base + c.top) / 2, c.z);
      m.rotation.y = c.yaw;
      m.name = 'pier';
      sightProxies.add(m);
    } else if (c.kind === 'post') {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(c.r * 0.7, c.r, 3, 10), proxyMat);
      m.position.set(c.x, base + 1.5, c.z);
      m.name = 'trunk';
      sightProxies.add(m);
    }
  }
  const cam = createFollowCamera({
    surfaceAt: (x, z) => surface(x, z, false, fox.root.position.y + P.step),
    lensBlocked,
    scenery: sightProxies,
    params: {
      distance: 2.45,
      runDistance: 2.35,
      // room to pull in front of a pier; a smaller 3/4 bias keeps the lens inside the arch opening
      minDistance: 1.2,
      sideBias: 0.35,
      height: 1.15,
      groundLift: 0.2,
      lookHeight: 0.33,
      framingHeight: 0.38,
      airDistance: 2.65,
      lookAhead: 1.2,
      fov: 50,
      clearance: 0.35,
      // main's recentre scales with speed / 7.5 m/s (its fox runs 9); ours tops out at 3.2, so match the rate
      recenterRate: 2.9,
    },
  });

  if (new URLSearchParams(location.search).has('gui')) {
    void import('lil-gui').then(({ default: GUI }) => {
      const gui = new GUI({ title: 'hearth-fox feel' });
      const move = gui.addFolder('move');
      move.add(P, 'runSpeed', 1.5, 6, 0.05);
      move.add(P, 'walkSpeed', 0.3, 1.5, 0.05);
      move.add(P, 'accel', 1, 10, 0.1);
      move.add(P, 'decel', 1, 12, 0.1);
      move.add(P, 'turnSlow', 2, 12, 0.1);
      move.add(P, 'turnFast', 1, 8, 0.1);
      const jump = gui.addFolder('jump');
      jump.add(P, 'jumpVelocity', 2, 9, 0.05);
      jump.add(P, 'gravity', 6, 30, 0.5);
      jump.add(P, 'fallGravity', 1, 2.5, 0.05);
      jump.add(P, 'jumpCut', 0.2, 1, 0.05);
      jump.add(P, 'airControl', 0, 5, 0.1);
      jump.add(P, 'coyote', 0, 0.25, 0.01);
      jump.add(P, 'buffer', 0, 0.25, 0.01);
      const glideDash = gui.addFolder('glide + dash');
      glideDash.add(P, 'glideSink', 0.5, 3, 0.05);
      glideDash.add(P, 'dashSpeed', 4, 12, 0.1);
      glideDash.add(P, 'dashDuration', 0.1, 0.4, 0.01);
      glideDash.add(P, 'dashCooldown', 0.2, 1.5, 0.05);
      if (opts.updrafts) {
        glideDash.add(opts.updrafts.tun, 'maxRise', 2, 12, 0.1);
        glideDash.add(opts.updrafts.tun, 'liftResponse', 1, 12, 0.1);
      }
      const clip = gui.addFolder('clips + IK');
      clip.add(P, 'minRate', 0.3, 1, 0.05);
      clip.add(P, 'maxRate', 1, 2.5, 0.05);
      clip.add(P, 'gaitFade', 0.05, 0.5, 0.01);
      clip.add(P, 'turnBank', 0, 0.15, 0.005);
      clip.add(P, 'footIK', 0, 1, 1);
      clip.add(P, 'maxLock', 0, 0.15, 0.005);
      const c = gui.addFolder('camera');
      c.add(cam.params, 'distance', 1.5, 7, 0.05);
      c.add(cam.params, 'height', 0.3, 3, 0.05);
      c.add(cam.params, 'lag', 0, 0.5, 0.01);
      c.add(cam.params, 'sideBias', -1, 1, 0.01);
    });
  }

  const cutMats: THREE.Material[] = [];
  const cutHulls: THREE.Object3D[] = [];
  for (const root of opts.cutout ?? [])
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (mesh.userData.ink) return void cutHulls.push(mesh);
      // own material (shared stone materials stay opaque elsewhere); keep the toon/paint shader patch
      const src = mesh.material as THREE.Material;
      const m = src.clone();
      m.onBeforeCompile = src.onBeforeCompile;
      m.customProgramCacheKey = src.customProgramCacheKey;
      m.transparent = true;
      mesh.material = m;
      cutMats.push(m);
    });
  let cutK = 0;
  const applyCutout = (dt: number) => {
    if (!cutMats.length) return;
    const info = cam.debug.internals();
    const fade = Number(/fade=([\d.]+)/.exec(info)?.[1] ?? 0);
    cutK = THREE.MathUtils.damp(cutK, /blocker=pier/.test(info) ? fade : 0, 10, dt);
    for (const m of cutMats) m.opacity = 1 - 0.8 * cutK;
    for (const h of cutHulls) h.visible = cutK < 0.3;
  };

  const keys = new Set<string>();
  let stick: THREE.Vector2 | null = null;
  addEventListener('keydown', (e) => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    keys.add(e.code);
  });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());

  const pos = new THREE.Vector3();
  let yaw = 0;
  let yawRate = 0;
  let speed = 0;
  const vel = new THREE.Vector3();
  let grounded = true;
  let airT = 0;
  let coyoteT = 0;
  let bufferT = 0;
  let jumpHeld = false;
  let dashHeld = false;
  let interactHeld = false;
  const lastGrounded = new THREE.Vector3();
  let dashT = 0;
  let dashCooldownT = 0;
  let dashesUsed = 0;
  const dashStart = new THREE.Vector3();
  let lastDashDistance = 0;
  let gliding = false;
  let cut = false;
  let rising = false;
  let landT = 99;
  let jumpT = 99;
  let bank = 0;
  let pitch = 0;
  let apexY = 0;
  let apexTime = 0;
  let takeoffY = 0;
  const lastJump = { apex: 0, air: 0, timeToApex: 0 };

  function teleport(x: number, z: number, y0: number) {
    pos.set(x, surface(x, z), z);
    yaw = y0;
    speed = 0;
    yawRate = 0;
    vel.set(0, 0, 0);
    grounded = true;
    lastGrounded.copy(pos);
    dashT = dashCooldownT = 0;
    gliding = false;
    cam.snapBehind(yaw);
  }
  teleport(opts.start.x, opts.start.z, opts.start.yaw);

  const wish = new THREE.Vector2();
  function readInput() {
    if (stick) wish.copy(stick);
    else {
      let ix = 0;
      let iz = 0;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) ix -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) ix += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) iz -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) iz += 1;
      // camera-relative: forward = away from the lens
      const cy = cam.getYaw();
      const fx = -Math.sin(cy);
      const fz = -Math.cos(cy);
      wish.set(fx * -iz - fz * ix, fz * -iz + fx * ix);
      if (wish.lengthSq() > 1) wish.normalize();
      if (keys.has('ControlLeft') || keys.has('ControlRight')) wish.multiplyScalar(P.walkSpeed / P.runSpeed);
    }
    const jump = keys.has('Space');
    if (jump && !jumpHeld) bufferT = P.buffer;
    jumpHeld = jump;
    const interact = keys.has('KeyE');
    if (interact && !interactHeld) opts.onInteract?.();
    interactHeld = interact;
    const dash = keys.has('ShiftLeft') || keys.has('ShiftRight');
    if (dash && !dashHeld && dashCooldownT <= 0) {
      opts.onDash?.(lastGrounded.clone());
      dashT = P.dashDuration;
      dashCooldownT = P.dashDuration + P.dashCooldown;
      dashesUsed++;
      dashStart.copy(pos);
    }
    dashHeld = dash;
  }

  /** horizontal move with step / wall blocking, per axis so the fox slides along walls */
  function moveTo(nx: number, nz: number, feetY: number) {
    const tol = grounded ? P.step : 0.05;
    const fwdX = Math.sin(yaw) * 0.28;
    const fwdZ = Math.cos(yaw) * 0.28;
    const ok = (x: number, z: number) => surface(x, z, true, feetY + tol + 0.15) <= feetY + tol && surface(x + fwdX, z + fwdZ, true, feetY + tol + 0.15) <= feetY + tol + 0.15;
    if (ok(nx, pos.z)) pos.x = nx;
    else vel.x = 0;
    if (ok(pos.x, nz)) pos.z = nz;
    else vel.z = 0;
  }

  function step(dt: number) {
    if (dashT > 0 && dashT <= dt) lastDashDistance = Math.hypot(pos.x - dashStart.x, pos.z - dashStart.z);
    dashT = Math.max(0, dashT - dt);
    dashCooldownT = Math.max(0, dashCooldownT - dt);
    if (grounded && Number.isFinite(surface(pos.x, pos.z, true, pos.y + P.step))) lastGrounded.copy(pos);
    readInput();
    bufferT -= dt;
    const want = wish.length();

    // facing: bounded, eased yaw rate (slower when fast); travel along the facing on the ground
    if (want > 0.01) {
      const target = Math.atan2(wish.x, wish.y);
      const err = wrap(target - yaw);
      const max = THREE.MathUtils.lerp(P.turnSlow, P.turnFast, THREE.MathUtils.clamp(speed / P.runSpeed, 0, 1));
      const rate = max * Math.tanh((err * 6) / max);
      yawRate = THREE.MathUtils.damp(yawRate, rate, grounded ? 10 : 4, dt);
    } else yawRate = THREE.MathUtils.damp(yawRate, 0, 10, dt);
    const dYaw = yawRate * dt;
    yaw = wrap(yaw + dYaw);

    if (grounded) {
      const err = want > 0.01 ? wrap(Math.atan2(wish.x, wish.y) - yaw) : 0;
      const target = want * P.runSpeed * Math.max(0, Math.cos(err));
      speed = THREE.MathUtils.damp(speed, target, target > speed ? P.accel : P.decel, dt);
      if (speed < 0.02 && target === 0) speed = 0;
      vel.x = Math.sin(yaw) * speed;
      vel.z = Math.cos(yaw) * speed;
      coyoteT = P.coyote;
    } else {
      coyoteT -= dt;
      const desired = new THREE.Vector2(wish.x, wish.y).multiplyScalar(Math.max(speed, P.runSpeed * 0.6));
      const k = 1 - Math.exp(-P.airControl * dt);
      vel.x += (desired.x - vel.x) * k * Math.min(1, want);
      vel.z += (desired.y - vel.z) * k * Math.min(1, want);
      speed = Math.hypot(vel.x, vel.z);
    }

    // jump: buffered press, coyote grace
    if (bufferT > 0 && coyoteT > 0) {
      bufferT = 0;
      coyoteT = 0;
      grounded = false;
      rising = true;
      cut = false;
      vel.y = P.jumpVelocity;
      airT = 0;
      jumpT = 0;
      takeoffY = pos.y;
      apexY = pos.y;
      apexTime = 0;
    }

    if (dashT > 0) {
      speed = P.dashSpeed;
      vel.x = Math.sin(yaw) * speed;
      vel.z = Math.cos(yaw) * speed;
    }
    const lift = opts.updrafts?.liftAt(pos.x, pos.y, pos.z);
    gliding = !grounded && jumpHeld && airT > 0.12 && (vel.y <= 0 || (lift?.k ?? 0) > 0.05);
    const feetY = pos.y;
    moveTo(pos.x + vel.x * dt, pos.z + vel.z * dt, feetY);

    let arrivalSpeed = 0;
    if (!grounded) {
      airT += dt;
      jumpT += dt;
      if (rising && !jumpHeld && !cut && vel.y > 0) {
        vel.y *= P.jumpCut;
        cut = true;
      }
      if (gliding) {
        const heat = lift?.k ?? 0;
        const target = THREE.MathUtils.lerp(-P.glideSink, opts.updrafts?.tun.maxRise ?? 6.5, heat);
        vel.y = THREE.MathUtils.damp(vel.y, target, heat > 0 ? opts.updrafts!.tun.liftResponse : 5, dt);
      } else {
        const fall = vel.y < 0 ? P.fallGravity * (1 - (opts.updrafts?.tun.fallLift ?? 0) * (lift?.k ?? 0)) : 1;
        vel.y -= P.gravity * fall * dt;
      }
      if (vel.y < 0) rising = false;
      pos.y += vel.y * dt;
      if (pos.y > apexY) { apexY = pos.y; apexTime = airT; }
      const floor = surface(pos.x, pos.z, true, feetY + 0.06);
      if (pos.y <= floor && vel.y <= 0) {
        arrivalSpeed = -vel.y;
        const impact = THREE.MathUtils.clamp(arrivalSpeed / 9, 0, 1);
        pos.y = floor;
        grounded = true;
        lastJump.apex = apexY - takeoffY;
        lastJump.air = airT;
        lastJump.timeToApex = apexTime;
        landT = 0;
        cam.land(impact * 0.6);
        fox.land(impact);
        if (lastJump.apex > 0.2) opts.onLand?.(pos, impact);
        vel.y = 0;
        // horizontal momentum carries into the ground run along the new facing
        speed = Math.hypot(vel.x, vel.z) * Math.max(0, Math.cos(wrap(Math.atan2(vel.x, vel.z) - yaw)));
      }
    } else {
      const floor = surface(pos.x, pos.z, true, feetY + P.step);
      if (floor < pos.y - P.step) {
        // walked off a ledge
        grounded = false;
        rising = false;
        airT = 0;
        jumpT = 99;
        vel.y = 0;
        takeoffY = apexY = pos.y;
        apexTime = 0;
      } else pos.y = floor;
    }
    if (grounded) {
      const launch = opts.onGroundContact?.(pos, arrivalSpeed, jumpHeld, dt);
      if (launch != null && launch > 0) {
        grounded = false;
        rising = true;
        cut = false;
        coyoteT = bufferT = 0;
        vel.y = launch;
        airT = jumpT = 0;
        takeoffY = apexY = pos.y;
        apexTime = 0;
        landT = 99;
      }
    }
    if (opts.updrafts && lift) opts.updrafts.trackRide(dt, pos.y, vel.y, grounded, lift, grounded ? 'opening-ground' : null);
    landT += dt;

    // clip state
    let state: AnimState;
    if (!grounded) state = jumpT < anim.oneShotLength('jumpUp') && !anim.done('jumpUp') && vel.y > 0 ? 'jumpUp' : 'fall';
    // the land clip plants its paws at rest: only a slow touchdown absorbs in it; a running landing stays in the gait
    else if (speed < P.landMaxSpeed && landT < anim.oneShotLength('land') && !anim.done('land')) state = 'land';
    else state = speed > 0.06 || want > 0.05 ? 'loco' : 'idle';
    anim.update(dt, speed, state);

    // additives: turn bank (grounded), nose up rising / down falling
    bank = THREE.MathUtils.damp(bank, grounded ? THREE.MathUtils.clamp(-yawRate * speed * P.turnBank, -P.bankMax, P.bankMax) : 0, 6, dt);
    let slope = 0;
    if (grounded) {
      const fx = Math.sin(yaw) * 0.3;
      const fz = Math.cos(yaw) * 0.3;
      slope = -Math.atan2(surface(pos.x + fx, pos.z + fz, false, pos.y + P.step) - surface(pos.x - fx, pos.z - fz, false, pos.y + P.step), 0.6) * P.slopeTilt;
    }
    pitch = THREE.MathUtils.damp(pitch, THREE.MathUtils.clamp(grounded ? slope : -vel.y * P.airPitch, -0.35, 0.35), 8, dt);
    fox.root.position.copy(pos);
    fox.root.rotation.set(0, yaw, 0);
    fox.model.rotation.set(pitch, 0, bank);
    fox.striding = grounded && anim.state === 'loco' && anim.gaitName !== 'walk';
    fox.update(dt);
    ik.apply(dt, (x, z) => surface(x, z, false, pos.y + P.step), grounded, anim.state === 'loco');

    cam.update(dt, {
      target: pos,
      vel,
      facing: yaw,
      grounded,
      gliding,
      dashing: dashT > 0,
      airTime: grounded ? 0 : airT,
      landing: null,
    });
    applyCutout(dt);
  }

  return {
    cam,
    surfaceAt: (x, z) => surface(x, z, true, pos.y + P.step),
    step,
    teleport(x, z, y) {
      teleport(x, z, y);
    },
    setStick(x, z = 0) {
      stick = x === null ? null : new THREE.Vector2(x, z);
      if (stick && stick.length() > 1) stick.normalize();
    },
    setKeys(codes) {
      keys.clear();
      for (const c of codes) keys.add(c);
    },
    state: () => ({
      pos: pos.toArray().map((v) => +v.toFixed(3)),
      vel: vel.toArray().map((v) => +v.toFixed(3)),
      speed: +speed.toFixed(3),
      yaw: +yaw.toFixed(3),
      grounded,
      gliding,
      dashing: dashT > 0,
      dashesUsed,
      lastDashDistance: +lastDashDistance.toFixed(3),
      updraft: opts.updrafts?.state(),
      airTime: +airT.toFixed(3),
      apexY: +apexY.toFixed(3),
      lastJump: { apex: +lastJump.apex.toFixed(3), air: +lastJump.air.toFixed(3), timeToApex: +lastJump.timeToApex.toFixed(3) },
      anim: anim.state,
      gait: anim.gaitName,
      playback: +anim.rate.toFixed(3),
      stanceFeet: ik.stanceFeet,
      maxSlide: +ik.slide.toFixed(3),
      paws: fox.paws(),
      camera: { pos: cam.camera.position.toArray().map((v) => +v.toFixed(3)), boom: cam.debug.internals(), blocked: cam.debug.blocked() },
    }),
  };
}
