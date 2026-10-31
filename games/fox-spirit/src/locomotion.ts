import * as THREE from 'three';
import { FOX_RIG } from './foxRig';
import { carpusName } from './foxLimbRig';
import GAITS from '../../../assets/hero/spirit_fox.loco.json';

// Clip-driven locomotion (DESIGN-loco-clips.md + DESIGN-loco-flow.md). The authored clip is the pose:
// 1. speed-driven gait choice walk/trot/run on one shared, sync-matched phase, played at stride-matched rate;
// 2. every state change switches clips instantly and is smoothed by inertialization (offset decay, Holden);
// 3. bounded additives: slope tilt, bank, spine gather/extend + lateral bend, tail spring chain, look-ahead head;
// 4. light foot IK: ground rays per paw, stance foot lock, pelvis height, two-bone legs, pad normal align, carpal give.

export type MotionInput = {
  lookYaw?: number; brake?: number;
  /** Jump windup progress 0..1 (the jump_up clip is the anticipation; kept for callers / metrics). */
  crouch?: number; speed: number; grounded: boolean; yaw: number; verticalSpeed: number;
  groundAt: (x: number, z: number, ceiling: number) => number;
};

type Gait = keyof typeof GAITS;
const GAIT_NAMES = Object.keys(GAITS) as Gait[];
const isGait = (name: string): name is Gait => (GAIT_NAMES as string[]).includes(name);
/** States whose authored pose stands on all four paws while grounded. */
const AIR_STATES = new Set(['jump_apex', 'jump_fall', 'glide', 'dash', 'burst']);
/** States a gait entry lands out of (longer inertialization half-life). */
const LANDING_STATES = new Set(['jump_up', 'jump_apex', 'jump_fall', 'land', 'glide', 'dash']);
const v = () => new THREE.Vector3();
const q = () => new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);
const MATCH_BINS = 64;
const DEG = Math.PI / 180;
/** Inertialization source-velocity caps (rad/s, m/s). */
const MAX_ANG_VEL = 8, MAX_LIN_VEL = 1.5;

class Spring {
  value = 0; velocity = 0;
  step(target: number, dt: number, frequency: number, damping: number) {
    const n = Math.max(1, Math.ceil(dt / .008)); const h = dt / n; const omega = 2 * Math.PI * frequency;
    for (let i = 0; i < n; i++) {
      this.velocity += (omega * omega * (target - this.value) - 2 * damping * omega * this.velocity) * h;
      this.value += this.velocity * h;
    }
    return this.value;
  }
  reset() { this.value = 0; this.velocity = 0; }
}

/** Critically damped decay of an offset toward zero (Holden, "Spring-It-On": decay_spring_damper_exact). */
function decaySpring(x: THREE.Vector3, vel: THREE.Vector3, halfLife: number, dt: number) {
  const y = 2 * Math.LN2 / Math.max(1e-4, halfLife), e = Math.exp(-y * dt);
  const j = vel.clone().addScaledVector(x, y);
  x.addScaledVector(j, dt).multiplyScalar(e);
  vel.addScaledVector(j, -y * dt).multiplyScalar(e);
}
/** Rotation vector (axis × angle) of a quaternion, shortest arc. */
function logQ(r: THREE.Quaternion, out: THREE.Vector3) {
  const s = r.w < 0 ? -1 : 1, w = Math.min(1, Math.abs(r.w)), sinHalf = Math.sqrt(Math.max(0, 1 - w * w));
  const angle = 2 * Math.atan2(sinHalf, w);
  return sinHalf < 1e-7 ? out.set(r.x * s * 2, r.y * s * 2, r.z * s * 2) : out.set(r.x * s, r.y * s, r.z * s).multiplyScalar(angle / sinHalf);
}
function expQ(r: THREE.Vector3, out: THREE.Quaternion) {
  const angle = r.length();
  return angle < 1e-9 ? out.identity() : out.setFromAxisAngle(r.clone().divideScalar(angle), angle);
}

/** Inertialization state per animated bone: decaying offset (rotation vector / translation) + last displayed pose. */
type Inertial = {
  bone: THREE.Object3D;
  rot: THREE.Vector3; rotVel: THREE.Vector3; pos: THREE.Vector3; posVel: THREE.Vector3;
  shown: THREE.Quaternion; shownPos: THREE.Vector3; angVel: THREE.Vector3; linVel: THREE.Vector3; hasShown: boolean;
};

type Foot = {
  name: string; upper: THREE.Object3D; lower: THREE.Object3D; hock: THREE.Object3D; paw: THREE.Object3D;
  /** Pole: fore elbow points back (-1), hind stifle forward (+1), in actor space. */
  pole: number; padLocal: THREE.Vector3;
  stance: number; planted: boolean; anchor: THREE.Vector3; lock: THREE.Vector3;
  previous: THREE.Vector3; hasPrevious: boolean; shadow: THREE.Mesh;
  /** IK correction (target − clip pad) last frame, for the per-frame correction clamp; solved pad history for padJerk. */
  correction: THREE.Vector3; hasCorrection: boolean; solved: THREE.Vector3[];
};

function shadowTexture() {
  const n = 32, data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const r = Math.hypot(x + .5 - n / 2, y + .5 - n / 2) / (n / 2);
    data[(y * n + x) * 4 + 3] = Math.round(255 * Math.pow(Math.max(0, 1 - r), 1.6));
  }
  const tex = new THREE.DataTexture(data, n, n);
  tex.needsUpdate = true;
  return tex;
}

export class AuthoredLocomotion {
  params = {
    /** Gait points (m/s): walk→trot at trotSpeed, trot→run at gallopSpeed, ± gaitHysteresis (fraction), chosen on a
     * speed smoothed with gaitSpeedHalfLife so stick wiggles never flip the footfall order mid-stride. */
    trotSpeed: 1.05, gallopSpeed: 3.4, gaitHysteresis: .12, gaitSpeedHalfLife: .2,
    /** Inertialization half-lives (s): gait↔gait, into/out of idle, air/land → gait; other caller fades use fade × .6. */
    gaitHalfLife: .09, idleHalfLife: .13, landHalfLife: .15,
    /** Playback bounds relative to each clip's authored cadence; walk tops out lower so the walk stays slow and long. */
    minRate: .5, maxRate: 1.8, walkMaxRate: 1,
    /** Don't stop moving: on idle the gait keeps cycling (≤ stopHold s) until its pose matches idle (≤ stopMatch × best). */
    stopHold: .3, stopMatch: 1.25,
    /** Entry pose search look-ahead (s): matches where the legs are heading, not only where they are. */
    entryLook: .08,
    footIK: 1, pelvisAdjust: 1, maxPelvisDrop: .2, footLock: 1, maxLock: .08, normalAlignDeg: 10, clearance: .004,
    /** Max change of a paw's IK correction per 60 Hz frame (m). */
    padJerk: .04,
    contactShadow: .45,
    slopeTilt: 1, turnLean: .07, bankMax: .22, headLead: .38, headTurn: .12, headFrequency: 3, headDamping: .85,
    springFrequency: 3, springDamping: .8,
    /** Spine gather (+) / extend (−) degrees: gallop stride, air arc, land absorb; lateral bend deg per (rad/s · m/s). */
    spineGallop: 5, spineGallopPhase: .04, spineAir: 9, spineLand: 7, spineBendGain: 1.4, spineMaxDeg: 13, spineFrequency: 3.2, spineDamping: .8,
    /** Tail spring chain: deg per m/s² of forward accel (− = drops when accelerating), deg per m/s vertical (rising drags it
     * down), yaw deg per (rad/s · m/s). Root pitch ≤ tailMaxUpDeg above the clip, chain never past tailMaxElevDeg. */
    tailAccel: 2.2, tailVertical: 3, tailTurn: 2.2, tailMaxUpDeg: 35, tailMaxElevDeg: 80, tailFrequency: 3.2, tailDamping: .72,
    /** Carpus (fore) / hock (hind) give under stance load, degrees. */
    carpalGive: 14, maxGiveDeg: 18,
  };
  metrics = {
    gait: 'idle', phase: 0, playback: 1, cadenceHz: 0, clipWeights: {} as Record<string, number>,
    footGap: [0, 0, 0, 0], stanceFeet: 0, maxSlideMS: 0, maxPlantError: 0, maxResidual: 0,
    pelvisOffset: 0, spineFlexDeg: 0, spineGatherDeg: 0, spineBendDeg: 0, tailPitchDeg: 0, tailAddDeg: 0, carpalGiveDeg: 0,
    inertiaDeg: 0, inertiaCm: 0, inertiaHalfLife: 0, transitions: 0, padJerkCm: 0, stopHold: 0,
    turnRate: 0, slopePitch: 0, bank: 0,
  };
  input: MotionInput = { speed: 0, grounded: true, yaw: 0, verticalSpeed: 0, groundAt: () => 0 };
  readonly footfalls: THREE.Vector3[] = [];
  /** Caller's requested transition time for the current state (s); sets the inertialization half-life. */
  fadeSeconds = .16;

  private feet: Foot[] = [];
  /** Per-gait cycle phase; all advance at the shared cadence. Gait changes re-enter the new clip pose-matched. */
  private phases: Record<Gait, number> = { walk: 0, trot: 0, run: 0 };
  /** match[`${from}>${to}`][bin] = phase of `to` whose leg pose best matches `from` at bin/MATCH_BINS. */
  private match = new Map<string, Float32Array>();
  /** Leg pose feature per gait bin (actor space), for the runtime entry search. */
  private poses = new Map<Gait, number[][]>();
  /** Per-gait, per-bin distance to the idle pose / best bin's distance (stop-hold release test). */
  private idleFit = new Map<Gait, Float32Array>();
  /** Last displayed (inertialized, pre-additive) leg feature. */
  private feature: number[] = [];
  private featureVelocity: number[] = [];
  private gait: Gait = 'walk';
  private locomoting = false;
  private stateKey = 'idle';
  private holdT = 0;
  private animSpeed = 0;
  private lastSpeed = 0;
  private accel = 0;
  private halfLife = .1;
  private inertial: Inertial[] = [];
  private pendingTransition = false;
  private overlays: { bone: THREE.Object3D; rotation: THREE.Quaternion; position: THREE.Vector3 }[] = [];
  private rootPosition: THREE.Vector3;
  private armScale = 1;
  private yaw = 0;
  private turn = 0;
  private pelvis = 0;
  private pitchSpring = new Spring();
  private leanSpring = new Spring();
  private lookSpring = new Spring();
  private gatherSpring = new Spring();
  private bendSpring = new Spring();
  private tailPitch: Spring[] = [];
  private tailYaw: Spring[] = [];
  private spines: THREE.Object3D[] = [];
  private necks: THREE.Object3D[] = [];
  private tails: THREE.Object3D[] = [];
  private head?: THREE.Object3D;
  private pelvisBone?: THREE.Object3D;
  private shadows = new THREE.Group();

  constructor(private root: THREE.Object3D, private group: THREE.Group,
    private actions: Map<string, THREE.AnimationAction>) {
    this.rootPosition = root.position.clone();
    root.updateWorldMatrix(true, true);
    const arm = root.getObjectByName('SpiritFox_Armature');
    this.armScale = arm ? arm.getWorldScale(v()).x : root.getWorldScale(v()).x;
    this.yaw = group.rotation.y;
    for (const g of GAIT_NAMES) if (!actions.has(g)) throw new Error(`FOX clip ${g} missing`);
    const find = (n: string) => root.getObjectByName(n);
    this.pelvisBone = find(FOX_RIG.pelvis);
    this.spines = FOX_RIG.spine.map(find).filter((b): b is THREE.Object3D => !!b);
    this.necks = FOX_RIG.neck.map(find).filter((b): b is THREE.Object3D => !!b);
    this.tails = FOX_RIG.tail.map(find).filter((b): b is THREE.Object3D => !!b);
    this.tailPitch = this.tails.map(() => new Spring());
    this.tailYaw = this.tails.map(() => new Spring());
    this.head = find(FOX_RIG.head);
    // Every keyed bone except the spirit-flame cards (locomotion never writes FX bones).
    const fx = new Set<string>(FOX_RIG.fx);
    const keyed = new Set<string>();
    for (const a of actions.values()) for (const t of a.getClip().tracks) keyed.add(t.name.split('.')[0]);
    root.traverse((o) => {
      if (!(o as THREE.Bone).isBone || fx.has(o.name) || !keyed.has(o.name)) return;
      this.inertial.push({ bone: o, rot: v(), rotVel: v(), pos: v(), posVel: v(), shown: q(), shownPos: v(), angVel: v(), linVel: v(), hasShown: false });
    });

    // SkinnedMesh.updateMatrixWorld refreshes bindMatrixInverse after hero normalization.
    root.updateMatrixWorld(true);
    const floor = new THREE.Box3().setFromObject(root).min.y;
    const chains = (['l', 'r'] as const).map((s) => { const f = FOX_RIG.foreleg(s); return { upper: f.upper, lower: f.lower, hock: carpusName(s), paw: f.paw, pole: -1 }; });
    chains.push(...(['l', 'r'] as const).map((s) => { const h = FOX_RIG.hindleg(s); return { upper: h.thigh, lower: h.shin, hock: h.foot, paw: h.paw, pole: 1 }; }));
    const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, map: shadowTexture(), transparent: true, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 });
    const shadowGeo = new THREE.PlaneGeometry(.17, .17).rotateX(-Math.PI / 2);
    const padHeights: number[] = [];
    for (const c of chains) {
      const upper = find(c.upper), lower = find(c.lower), hock = find(c.hock), paw = find(c.paw);
      if (!upper || !lower || !hock || !paw) throw new Error(`FOX rig is missing leg chain ${c.upper}/${c.lower}/${c.hock}/${c.paw} (carpus needs applyFoxLimbRig)`);
      // Pad = centre of the lowest band of rendered vertices skinned to the paw bone.
      const padPoints: THREE.Vector3[] = [];
      root.traverse((object) => {
        const mesh = object as THREE.SkinnedMesh;
        if (!mesh.isSkinnedMesh || /fur|shell|glow|flame|spiritfx/i.test(mesh.name)) return;
        const boneIndex = mesh.skeleton.bones.indexOf(paw as THREE.Bone);
        if (boneIndex < 0) return;
        mesh.skeleton.update();
        const indices = mesh.geometry.getAttribute('skinIndex'), weights = mesh.geometry.getAttribute('skinWeight');
        for (let index = 0; index < indices.count; index++) {
          let weight = 0;
          for (let j = 0; j < 4; j++) if (indices.getComponent(index, j) === boneIndex) weight += weights.getComponent(index, j);
          if (weight >= .65) padPoints.push(mesh.localToWorld(mesh.getVertexPosition(index, v())));
        }
      });
      if (!padPoints.length) throw new Error(`No rendered pad vertices for ${c.paw}`);
      const low = Math.min(...padPoints.map((p) => p.y));
      const band = padPoints.filter((p) => p.y < low + .015);
      const padWorld = band.reduce((a, b) => a.add(b), v()).multiplyScalar(1 / band.length);
      padHeights.push(padWorld.y - floor);
      const shadow = new THREE.Mesh(shadowGeo, shadowMat.clone());
      shadow.name = `PawContactShadow_${c.paw}`;
      shadow.renderOrder = 2; shadow.visible = false;
      this.shadows.add(shadow);
      this.feet.push({ name: c.paw, upper, lower, hock, paw, pole: c.pole, padLocal: paw.worldToLocal(padWorld.clone()),
        stance: 1, planted: false, anchor: v(), lock: v(), previous: v(), hasPrevious: false, shadow,
        correction: v(), hasCorrection: false, solved: [] });
    }
    root.position.y -= padHeights.reduce((a, b) => a + b, 0) / padHeights.length;
    this.rootPosition.copy(root.position);
    root.updateWorldMatrix(true, true);
    this.shadows.name = 'PawContactShadows';
    group.add(this.shadows);
    this.buildPoseMatch();
  }

  /** Leg feature: elbow/stifle, carpus/hock and pad per leg, in actor space. */
  private legFeature() {
    this.root.updateMatrixWorld(true);
    const out: number[] = [];
    for (const f of this.feet) for (const o of [f.lower.getWorldPosition(v()), f.hock.getWorldPosition(v()), f.paw.localToWorld(f.padLocal.clone())])
      out.push(...this.group.worldToLocal(o).toArray());
    return out;
  }

  /** Sync markers by pose matching: sample each gait's leg pose and, for every gait pair, find the entry phase of the
   * new gait closest to the old one (plus the pose a few bins later for direction of travel). Walk (lateral), trot
   * (diagonal) and gallop (rotary) have different footfall orders, so equal phases would cross-blend opposite legs.
   * The per-bin poses also serve the runtime entry search (any state → gait) and the idle-fit for stopping. */
  private buildPoseMatch() {
    const mixer = this.actions.get('walk')!.getMixer();
    const all = [...this.actions.values()];
    const sample = (name: string, phase: number) => {
      for (const a of all) { a.play(); a.setEffectiveWeight(0); }
      const a = this.actions.get(name)!;
      a.setEffectiveTimeScale(0); a.setEffectiveWeight(1); a.time = phase * a.getClip().duration;
      mixer.update(0);
      return this.legFeature();
    };
    for (const g of GAIT_NAMES) this.poses.set(g, Array.from({ length: MATCH_BINS }, (_, i) => sample(g, i / MATCH_BINS)));
    const idle = sample('idle', 0);
    for (const a of all) a.setEffectiveWeight(0);
    const lookAhead = 3;
    for (const from of GAIT_NAMES) for (const to of GAIT_NAMES) {
      if (from === to) continue;
      const A = this.poses.get(from)!, B = this.poses.get(to)!, table = new Float32Array(MATCH_BINS);
      for (let i = 0; i < MATCH_BINS; i++) {
        let best = 0, bestD = Infinity;
        for (let j = 0; j < MATCH_BINS; j++) {
          const d = d2(A[i], B[j]) + d2(A[(i + lookAhead) % MATCH_BINS], B[(j + lookAhead) % MATCH_BINS]);
          if (d < bestD) { bestD = d; best = j; }
        }
        table[i] = best / MATCH_BINS;
      }
      this.match.set(`${from}>${to}`, table);
    }
    for (const g of GAIT_NAMES) {
      const fit = new Float32Array(this.poses.get(g)!.map((pose) => d2(idle, pose)));
      const best = Math.max(1e-9, Math.min(...fit));
      this.idleFit.set(g, fit.map((d) => d / best));
    }
    this.feature = idle;
    this.featureVelocity = idle.map(() => 0);
  }

  /** Runtime pose search: the gait phase whose leg pose and leg velocity (over `entryLook` s at the entry cadence) are
   * closest to what is on screen now — so a landing enters with planted paws in stance, not just before a swing. */
  private entryPhase(g: Gait, cadence: number) {
    const B = this.poses.get(g)!, look = this.params.entryLook;
    const ahead = this.feature.map((x, k) => x + this.featureVelocity[k] * look);
    const bins = Math.max(1, Math.round(look * cadence * MATCH_BINS));
    let best = 0, bestD = Infinity;
    B.forEach((pose, j) => { const d = d2(this.feature, pose) + d2(ahead, B[(j + bins) % MATCH_BINS]); if (d < bestD) { bestD = d; best = j; } });
    return best / MATCH_BINS;
  }

  reset() {
    this.beforeMixer();
    for (const foot of this.feet) { foot.planted = false; foot.lock.set(0, 0, 0); foot.hasPrevious = false; foot.hasCorrection = false; foot.solved.length = 0; }
    for (const s of [this.pitchSpring, this.leanSpring, this.lookSpring, this.gatherSpring, this.bendSpring, ...this.tailPitch, ...this.tailYaw]) s.reset();
    for (const b of this.inertial) { b.rot.set(0, 0, 0); b.rotVel.set(0, 0, 0); b.pos.set(0, 0, 0); b.posVel.set(0, 0, 0); b.hasShown = false; }
    this.pendingTransition = false; this.holdT = 0;
    this.turn = 0; this.yaw = this.group.rotation.y; this.pelvis = 0; this.accel = 0;
    this.lastSpeed = this.animSpeed = Math.max(0, this.input.speed);
  }
  /** A deliberate dash-facing snap is not a physical turn impulse. */
  syncYaw(yaw: number) {
    this.yaw = yaw; this.turn = 0;
    for (const foot of this.feet) { foot.hasCorrection = false; foot.solved.length = 0; }
  }

  /** Undo last frame's inertial/additive/IK layer before the mixer supplies the next authored pose. */
  beforeMixer() {
    for (let i = this.overlays.length - 1; i >= 0; i--) { const o = this.overlays[i]; o.bone.quaternion.copy(o.rotation); o.bone.position.copy(o.position); }
    this.overlays.length = 0;
    this.root.position.copy(this.rootPosition);
  }

  private save(bone: THREE.Object3D) { this.overlays.push({ bone, rotation: bone.quaternion.clone(), position: bone.position.clone() }); }

  /** Gait choice + instant clip switch (inertialized in afterMixer). Gait clips are time-driven from one shared phase. */
  blend(dt: number, active: string) {
    const p = this.params, speed = Math.max(0, this.input.speed);
    this.animSpeed += (speed - this.animSpeed) * (1 - Math.pow(.5, dt / Math.max(1e-3, p.gaitSpeedHalfLife)));
    this.accel = THREE.MathUtils.damp(this.accel, dt > 0 ? (speed - this.lastSpeed) / dt : 0, 10, dt);
    this.lastSpeed = speed;

    // Don't stop moving: an idle request out of a gait keeps the stride going until a phase that matches idle.
    let locomoting = isGait(active);
    if (!locomoting && active === 'idle' && this.locomoting && this.input.grounded && this.holdT < p.stopHold) {
      const bin = Math.floor(this.phases[this.gait] * MATCH_BINS) % MATCH_BINS;
      if (this.idleFit.get(this.gait)![bin] > p.stopMatch) { locomoting = true; this.holdT += dt; }
    }
    if (!locomoting || isGait(active)) this.holdT = 0;
    this.metrics.stopHold = this.holdT;
    const entering = locomoting && !this.locomoting;
    this.locomoting = locomoting;

    // Gait by smoothed speed (with hysteresis); entering picks the gait for the speed outright.
    const h = entering ? 0 : p.gaitHysteresis;
    const choose = entering ? speed : this.animSpeed;
    const order: Gait[] = ['walk', 'trot', 'run'], ups = [p.trotSpeed, p.gallopSpeed];
    let index = order.indexOf(this.gait);
    while (index < 2 && choose > ups[index] * (1 + h)) index++;
    while (index > 0 && choose < ups[index - 1] * (1 - h)) index--;
    const previous = this.gait;
    this.gait = order[index];
    if (locomoting && !entering && previous !== this.gait) {
      const bin = Math.floor(this.phases[previous] * MATCH_BINS) % MATCH_BINS;
      this.phases[this.gait] = this.match.get(`${previous}>${this.gait}`)![bin];
    }

    // Stride-matched cadence for the playing gait, rate bounded per authored clip (walk tops out lower).
    const clipRate = 1 / this.actions.get(this.gait)!.getClip().duration;
    const stride = GAITS[this.gait].stride * this.armScale;
    const cadence = THREE.MathUtils.clamp(speed / Math.max(1e-3, stride), clipRate * p.minRate, clipRate * (this.gait === 'walk' ? p.walkMaxRate : p.maxRate));
    if (entering) this.phases[this.gait] = this.entryPhase(this.gait, cadence);
    if (locomoting) for (const g of GAIT_NAMES) this.phases[g] = (this.phases[g] + dt * cadence) % 1;

    // Instant switch; the pose discontinuity is inertialized after the mixer runs.
    const key = locomoting ? `gait:${this.gait}` : active;
    if (key !== this.stateKey) {
      const was = this.stateKey;
      const idleSide = was === 'idle' || key === 'idle';
      this.halfLife = idleSide ? p.idleHalfLife
        : was.startsWith('gait:') && key.startsWith('gait:') ? p.gaitHalfLife
        : key.startsWith('gait:') && LANDING_STATES.has(was) ? p.landHalfLife
        : Math.max(.05, this.fadeSeconds * .6);
      this.stateKey = key;
      this.pendingTransition = true;
      this.metrics.transitions++;
    }
    for (const [name, action] of this.actions) {
      const w = locomoting ? (name === this.gait ? 1 : 0) : (name === active ? 1 : 0);
      if (isGait(name)) {
        action.time = this.phases[name] * action.getClip().duration;
        action.setEffectiveTimeScale(0);
        action.paused = false;
      }
      if (w > 0 && !action.isRunning()) action.play();
      action.enabled = true;
      action.setEffectiveWeight(w);
      this.metrics.clipWeights[name] = w;
    }
    this.metrics.gait = locomoting ? this.gait : active;
    this.metrics.phase = this.phases[this.gait];
    this.metrics.cadenceHz = locomoting ? cadence : 0;
    this.metrics.playback = locomoting ? cadence / clipRate : 1;
  }

  /** Inertialization: at a switch, offset = displayed (extrapolated one step) − new clip pose; then decay it. */
  private inertialize(dt: number) {
    const transition = this.pendingTransition;
    this.pendingTransition = false;
    let maxRot = 0, maxPos = 0;
    const r = q(), off = v();
    for (const b of this.inertial) {
      const bone = b.bone;
      if (transition && b.hasShown) {
        // Source velocity is clamped: the baked gallop swings some joints ~100° per key, and extrapolating that would
        // itself be the pop the switch is meant to hide.
        b.angVel.clampLength(0, MAX_ANG_VEL); b.linVel.clampLength(0, MAX_LIN_VEL / this.armScale);
        const src = expQ(b.angVel.clone().multiplyScalar(dt), q()).multiply(b.shown);
        logQ(r.copy(src).multiply(bone.quaternion.clone().invert()), b.rot);
        b.rotVel.copy(b.angVel);
        b.pos.copy(b.shownPos).addScaledVector(b.linVel, dt).sub(bone.position);
        b.posVel.copy(b.linVel);
      } else {
        decaySpring(b.rot, b.rotVel, this.halfLife, dt);
        decaySpring(b.pos, b.posVel, this.halfLife, dt);
      }
      const active = b.rot.lengthSq() > 1e-10 || b.pos.lengthSq() > 1e-12;
      if (active) {
        this.save(bone);
        bone.quaternion.premultiply(expQ(b.rot, r));
        bone.position.add(b.pos);
        maxRot = Math.max(maxRot, b.rot.length()); maxPos = Math.max(maxPos, b.pos.length());
      }
      // Displayed pose velocity (source velocity for the next switch).
      if (b.hasShown && dt > 0) {
        logQ(r.copy(bone.quaternion).multiply(b.shown.clone().invert()), off);
        b.angVel.copy(off.divideScalar(dt));
        b.linVel.copy(bone.position).sub(b.shownPos).divideScalar(dt);
      }
      b.shown.copy(bone.quaternion); b.shownPos.copy(bone.position); b.hasShown = true;
    }
    this.metrics.inertiaDeg = maxRot / DEG;
    this.metrics.inertiaCm = maxPos * this.armScale * 100;
    this.metrics.inertiaHalfLife = this.halfLife;
  }

  afterMixer(dt: number, active: string) {
    const p = this.params, input = this.input, step = Math.max(dt, 1e-5);
    const group = this.group;
    const forward = new THREE.Vector3(Math.sin(input.yaw), 0, Math.cos(input.yaw));
    const lateral = new THREE.Vector3(1, 0, 0).applyQuaternion(group.quaternion);

    this.inertialize(dt);
    const feature = this.legFeature();
    this.featureVelocity = feature.map((x, k) => dt > 0 && this.feature.length ? (x - this.feature[k]) / dt : 0);
    this.feature = feature;

    // ---- Additive layer: slope tilt, bank, spine, tail, look-ahead head (all bounded, all re-IK'd below) ----
    let dy = Math.atan2(Math.sin(input.yaw - this.yaw), Math.cos(input.yaw - this.yaw));
    if (Math.abs(dy) > 1) dy = 0;
    this.yaw = input.yaw;
    this.turn = THREE.MathUtils.damp(this.turn, dy / step, 12, dt);
    this.metrics.turnRate = this.turn;
    const ceiling = group.position.y + .8;
    const front = group.position.clone().addScaledVector(forward, .45), back = group.position.clone().addScaledVector(forward, -.45);
    const fg = input.groundAt(front.x, front.z, ceiling), bg = input.groundAt(back.x, back.z, ceiling);
    const slope = input.grounded && Number.isFinite(fg) && Number.isFinite(bg) ? -Math.atan2(fg - bg, .9) : 0;
    const pitch = this.pitchSpring.step(THREE.MathUtils.clamp(slope * p.slopeTilt, -.35, .35), dt, p.springFrequency, p.springDamping);
    const lean = this.leanSpring.step(input.grounded ? THREE.MathUtils.clamp(-this.turn * input.speed * p.turnLean, -p.bankMax, p.bankMax) : 0,
      dt, p.springFrequency, p.springDamping);
    this.metrics.slopePitch = pitch; this.metrics.bank = lean;
    this.save(this.root);
    // root's local frame is the actor frame (+Z forward): +X pitch noses down, +Z rolls.
    this.root.quaternion.premultiply(q().setFromEuler(new THREE.Euler(pitch, 0, lean)));
    this.root.updateWorldMatrix(true, true);
    const worldTurn = (bone: THREE.Object3D | undefined, axis: THREE.Vector3, angle: number) => {
      if (!bone || Math.abs(angle) < 1e-6) return;
      this.save(bone);
      bone.updateWorldMatrix(true, false);
      const parent = bone.parent!.getWorldQuaternion(q());
      const world = bone.getWorldQuaternion(q());
      bone.quaternion.copy(parent.invert().multiply(q().setFromAxisAngle(axis, angle).multiply(world)));
      bone.updateWorldMatrix(false, true);
    };

    // Spine gather (+, back rounds, chest dips, hips tuck) / extend (−): gallop stride, air arc, land absorb.
    const run = this.locomoting && this.gait === 'run' ? 1 : 0;
    const hindDown = Math.min(GAITS.run.contacts[2].phase, GAITS.run.contacts[3].phase);
    const vy = input.verticalSpeed;
    const airborne = !input.grounded || AIR_STATES.has(active) || active === 'jump_up';
    const air = airborne ? p.spineAir * (Math.exp(-((vy / 2) ** 2)) - .85 * THREE.MathUtils.smoothstep(Math.abs(vy), 1.5, 4.5)) : 0;
    const landAction = this.actions.get('land');
    const landU = active === 'land' && landAction ? landAction.time / landAction.getClip().duration : 1;
    const absorb = active === 'land' ? Math.sin(Math.PI * Math.min(1, landU / .6)) * (landU < .6 ? 1 : 0) : 0;
    // The gallop wave is phase-locked and already smooth; only the air / land / bend drives go through springs.
    const gallopWave = run * p.spineGallop * Math.cos(2 * Math.PI * (this.phases.run - hindDown + p.spineGallopPhase));
    const cap = p.spineMaxDeg;
    const gather = THREE.MathUtils.clamp(gallopWave + this.gatherSpring.step(THREE.MathUtils.clamp(air + absorb * p.spineLand, -cap, cap), dt, p.spineFrequency, p.spineDamping), -cap, cap);
    const bend = THREE.MathUtils.clamp(this.bendSpring.step(THREE.MathUtils.clamp(this.turn * input.speed * p.spineBendGain, -cap, cap), dt, p.spineFrequency, p.spineDamping), -cap, cap);
    this.metrics.spineGatherDeg = gather; this.metrics.spineBendDeg = bend;
    worldTurn(this.pelvisBone, lateral, -.35 * gather * DEG);
    worldTurn(this.pelvisBone, UP, -.3 * bend * DEG);
    for (const s of this.spines) { worldTurn(s, lateral, 1.35 * gather * DEG / this.spines.length); worldTurn(s, UP, 1.3 * bend * DEG / this.spines.length); }
    // Gaze stays level (stoic): the neck takes back the chest pitch.
    worldTurn(this.necks[0], lateral, -gather * DEG);

    // Look-ahead head: lead toward the move direction and into the turn.
    const lookDelta = input.lookYaw === undefined ? 0 : Math.atan2(Math.sin(input.lookYaw - input.yaw), Math.cos(input.lookYaw - input.yaw));
    const look = this.lookSpring.step(THREE.MathUtils.clamp(lookDelta * p.headLead + this.turn * p.headTurn, -.4, .4), dt, p.headFrequency, p.headDamping);
    for (const neck of this.necks) worldTurn(neck, UP, look * .5 / this.necks.length);
    worldTurn(this.head, UP, look * .5);

    // Tail spring chain: base leads, each bone lags a little softer (follow-through); caps keep it out of the vertical.
    const tailElev = () => {
      if (this.tails.length < 6) return 0;
      const d = this.group.worldToLocal(this.tails[5].getWorldPosition(v())).sub(this.group.worldToLocal(this.tails[0].getWorldPosition(v())));
      return Math.atan2(d.y, Math.max(1e-4, -d.z)) / DEG;
    };
    const clipElev = tailElev();
    const upRoom = Math.max(0, Math.min(p.tailMaxUpDeg, p.tailMaxElevDeg - clipElev));
    const pitchDrive = THREE.MathUtils.clamp(-this.accel * p.tailAccel - vy * p.tailVertical * (airborne ? 1 : .3), -p.tailMaxUpDeg, upRoom);
    const yawDrive = THREE.MathUtils.clamp(this.turn * input.speed * p.tailTurn, -30, 30);
    let pitchSum = 0;
    this.tails.forEach((tail, i) => {
      const k = i / Math.max(1, this.tails.length - 1), share = i === 0 ? .4 : .6 / (this.tails.length - 1);
      const f = p.tailFrequency * (1 - .35 * k);
      const tp = this.tailPitch[i].step(pitchDrive * share, dt, f, p.tailDamping);
      const ty = this.tailYaw[i].step(yawDrive * share, dt, f, p.tailDamping);
      // Bounded even mid-overshoot: the summed pitch never exceeds the room above the clip.
      const allowed = THREE.MathUtils.clamp(tp, -p.tailMaxUpDeg - pitchSum, upRoom - pitchSum);
      pitchSum += allowed;
      worldTurn(tail, lateral, allowed * DEG); // +X about the lateral axis raises a tail that points back (−Z)
      worldTurn(tail, UP, ty * DEG);
    });
    this.metrics.tailAddDeg = pitchSum;
    this.metrics.tailPitchDeg = tailElev();

    // ---- Foot IK: ground rays, stance lock, pelvis height, two-bone legs, carpal give ----
    this.footfalls.length = 0;
    this.metrics.stanceFeet = 0; this.metrics.maxSlideMS = 0; this.metrics.maxPlantError = 0; this.metrics.maxResidual = 0; this.metrics.carpalGiveDeg = 0;
    const locoW = this.locomoting ? 1 : 0;
    const standing = input.grounded && !AIR_STATES.has(active);
    const actorGround = input.groundAt(group.position.x, group.position.z, ceiling);
    const solveFeet = input.grounded && p.footIK > 0 && Number.isFinite(actorGround);
    type Plan = { pad: THREE.Vector3; ground: number; normal: THREE.Vector3; target: THREE.Vector3; w: number; give: number };
    const plans: (Plan | null)[] = [];
    let pelvisNeed = Infinity;
    const load = .45 + .55 * THREE.MathUtils.clamp(input.speed / 6, 0, 1);
    this.feet.forEach((foot, i) => {
      const pad = foot.paw.localToWorld(foot.padLocal.clone());
      // Stance weight from the authored contact windows on the playing gait's phase (soft 3 % edges); give peaks mid-stance.
      let gaitStance = 0, stanceArc = 0;
      if (this.locomoting) {
        const c = GAITS[this.gait].contacts[i], u = (this.phases[this.gait] - c.phase + 1) % 1, e = .03;
        gaitStance = THREE.MathUtils.smoothstep(u, 0, e) * (1 - THREE.MathUtils.smoothstep(u, c.duty - e, c.duty));
        stanceArc = u < c.duty ? Math.sin(Math.PI * u / c.duty) : 0;
      }
      const stanceTarget = !input.grounded ? 0 : locoW * gaitStance + (1 - locoW) * (standing ? 1 : 0);
      // ~40 ms ease so a touchdown (or a state change) seats the paw instead of snapping it.
      foot.stance += (stanceTarget - foot.stance) * (1 - Math.exp(-dt / .04));
      const ground = input.groundAt(pad.x, pad.z, ceiling);
      if (!solveFeet || !Number.isFinite(ground)) {
        foot.planted = false; foot.lock.set(0, 0, 0); foot.hasCorrection = false; plans.push(null);
        foot.shadow.visible = false;
        return;
      }
      // Pad normal from the ground field around the pad.
      const d = .08;
      const gx = input.groundAt(pad.x + d, pad.z, ceiling), gz = input.groundAt(pad.x, pad.z + d, ceiling);
      const normal = Number.isFinite(gx) && Number.isFinite(gz) ? new THREE.Vector3(-(gx - ground) / d, 1, -(gz - ground) / d).normalize() : UP.clone();
      // Foot lock: latch the stance pad where it lands; drag the anchor if the clip outruns maxLock.
      if (foot.stance > .5 && !foot.planted) {
        foot.planted = true; foot.anchor.copy(pad);
        if (locoW > .5 && input.speed > 1) this.footfalls.push(pad.clone().setY(ground));
      } else if (foot.stance < .4) foot.planted = false;
      // Only gait stance locks XZ; idle/turn/land clips place (and step) their own paws, IK just fits them to the ground.
      if (foot.planted && p.footLock > 0 && locoW > 0) {
        const want = foot.anchor.clone().sub(pad).setY(0);
        this.metrics.maxPlantError = Math.max(this.metrics.maxPlantError, want.length());
        if (want.length() > p.maxLock) { want.setLength(p.maxLock); foot.anchor.copy(pad).add(want); }
        foot.lock.copy(want).multiplyScalar(p.footLock);
      } else foot.lock.multiplyScalar(Math.exp(-dt / .06));
      // Vertical: stance pads sit on their own ground hit; swing pads follow the terrain under them (never below it).
      const offset = ground - actorGround;
      const swingY = Math.max(pad.y + offset, ground + p.clearance);
      const target = pad.clone().add(foot.lock);
      target.y = THREE.MathUtils.lerp(swingY, ground + p.clearance, foot.stance);
      // Correction clamp: the IK may not move an unplanted paw more than padJerk per 60 Hz frame beyond the clip's own
      // motion (planted paws are owned by the lock, which has its own maxLock bound).
      const correction = target.clone().sub(pad), limit = p.padJerk * Math.max(1, dt * 60);
      if (foot.hasCorrection && !foot.planted) {
        const change = correction.clone().sub(foot.correction);
        if (change.length() > limit) { correction.copy(foot.correction).add(change.setLength(limit)); target.copy(pad).add(correction); }
      }
      foot.correction.copy(correction); foot.hasCorrection = true;
      if (foot.stance > .5) pelvisNeed = Math.min(pelvisNeed, target.y - pad.y);
      const give = Math.min(p.maxGiveDeg, p.carpalGive * Math.max(locoW * stanceArc * load, absorb, (1 - locoW) * foot.stance * .15));
      plans.push({ pad, ground, normal, target, w: foot.stance, give });
    });

    // Pelvis: drop so the lowest stance foot can reach; never lift more than a little.
    const pelvisTarget = Number.isFinite(pelvisNeed) && solveFeet ? THREE.MathUtils.clamp(pelvisNeed * p.pelvisAdjust, -p.maxPelvisDrop, .03) : 0;
    this.pelvis = THREE.MathUtils.damp(this.pelvis, pelvisTarget, 18, dt);
    this.metrics.pelvisOffset = this.pelvis;
    if (Math.abs(this.pelvis) > 1e-5) {
      this.root.position.y += this.pelvis;
      this.root.updateWorldMatrix(true, true);
    }

    let jerk = 0;
    this.feet.forEach((foot, i) => {
      const plan = plans[i];
      if (!plan) { foot.hasPrevious = false; foot.solved.length = 0; this.metrics.footGap[i] = 0; return; }
      // Pad aligns to the ground normal (bounded) while it carries weight, then the leg carries the aligned pad to target.
      const align = q().setFromUnitVectors(UP, plan.normal);
      const maxAngle = THREE.MathUtils.degToRad(p.normalAlignDeg);
      const angle = 2 * Math.acos(Math.min(1, Math.abs(align.w)));
      if (angle > 1e-4 && plan.w > 0) {
        this.save(foot.paw);
        worldTurnBone(foot.paw, q().slerp(align, Math.min(1, maxAngle / angle) * plan.w));
      }
      // Carpal / hock give: the metacarpus / metatarsus slopes forward under load (pad keeps its world orientation).
      const give = plan.give * plan.w;
      if (give > .05) {
        this.save(foot.hock); this.save(foot.paw);
        const padRotation = foot.paw.getWorldQuaternion(q());
        worldTurnBone(foot.hock, q().setFromAxisAngle(lateral, -give * DEG));
        foot.paw.quaternion.copy(foot.paw.parent!.getWorldQuaternion(q()).invert().multiply(padRotation));
        foot.paw.updateWorldMatrix(false, true);
        this.metrics.carpalGiveDeg = Math.max(this.metrics.carpalGiveDeg, give);
      }
      const pad = foot.paw.localToWorld(foot.padLocal.clone());
      if (pad.distanceToSquared(plan.target) > 1e-8) this.placePaw(foot, plan.target.clone().sub(pad.sub(foot.paw.getWorldPosition(v()))));
      const solved = foot.paw.localToWorld(foot.padLocal.clone());
      this.metrics.footGap[i] = plan.w > .9 ? solved.y - plan.ground : 0;
      // padJerk: second difference of the solved pad in actor space (a pop shows as a one-frame spike).
      const local = group.worldToLocal(solved.clone());
      foot.solved.push(local); if (foot.solved.length > 3) foot.solved.shift();
      if (foot.solved.length === 3) jerk = Math.max(jerk, foot.solved[2].clone().sub(foot.solved[1]).sub(foot.solved[1].clone().sub(foot.solved[0])).length());
      if (plan.w > .5) {
        this.metrics.stanceFeet++;
        this.metrics.maxResidual = Math.max(this.metrics.maxResidual, solved.distanceTo(plan.target));
        if (foot.hasPrevious) this.metrics.maxSlideMS = Math.max(this.metrics.maxSlideMS, Math.hypot(solved.x - foot.previous.x, solved.z - foot.previous.z) / step);
        foot.previous.copy(solved); foot.hasPrevious = true;
      } else foot.hasPrevious = false;
      // Contact shadow at the ray hit, strongest under a loaded pad, fading as the paw lifts.
      const lift = THREE.MathUtils.clamp((solved.y - plan.ground) / .18, 0, 1);
      const opacity = p.contactShadow * Math.max(plan.w, 1 - lift) * (1 - .6 * lift);
      foot.shadow.visible = opacity > .01;
      if (foot.shadow.visible) {
        const hit = new THREE.Vector3(solved.x, plan.ground + .002, solved.z);
        foot.shadow.position.copy(this.shadows.worldToLocal(hit));
        foot.shadow.quaternion.copy(this.shadows.getWorldQuaternion(q()).invert().multiply(q().setFromUnitVectors(UP, plan.normal)));
        (foot.shadow.material as THREE.MeshBasicMaterial).opacity = opacity;
      }
    });
    this.metrics.padJerkCm = jerk * 100;
    function worldTurnBone(bone: THREE.Object3D, r: THREE.Quaternion) {
      const parent = bone.parent!.getWorldQuaternion(q());
      bone.quaternion.copy(parent.invert().multiply(r.multiply(bone.getWorldQuaternion(q()))));
      bone.updateWorldMatrix(false, true);
    }
    if (this.pelvisBone && this.spines.length >= 4) {
      const a = this.pelvisBone.getWorldPosition(v()), b = this.spines[1].getWorldPosition(v()), c = this.spines[3].getWorldPosition(v());
      this.metrics.spineFlexDeg = 180 - THREE.MathUtils.radToDeg(a.sub(b).angleTo(c.sub(b)));
    }
  }

  /** Two-bone solve (shoulder/hip → elbow/stifle → carpus/hock); metacarpus/metatarsus and pad keep their world orientation. */
  private placePaw(foot: Foot, target: THREE.Vector3) {
    for (const bone of [foot.upper, foot.lower, foot.hock, foot.paw]) this.save(bone);
    const hockRotation = foot.hock.getWorldQuaternion(q()), padRotation = foot.paw.getWorldQuaternion(q());
    const metatarsus = foot.paw.getWorldPosition(v()).sub(foot.hock.getWorldPosition(v()));
    this.solve(foot.upper, foot.lower, foot.hock, target.clone().sub(metatarsus), foot.pole);
    foot.hock.quaternion.copy(foot.hock.parent!.getWorldQuaternion(q()).invert().multiply(hockRotation));
    foot.hock.updateWorldMatrix(false, true);
    foot.paw.quaternion.copy(foot.paw.parent!.getWorldQuaternion(q()).invert().multiply(padRotation));
    foot.paw.updateWorldMatrix(false, true);
  }

  private solve(upper: THREE.Object3D, lower: THREE.Object3D, end: THREE.Object3D, target: THREE.Vector3, poleSign: number) {
    const a = upper.getWorldPosition(v()), b = lower.getWorldPosition(v()), c = end.getWorldPosition(v());
    const l1 = a.distanceTo(b), l2 = b.distanceTo(c); if (l1 < .001 || l2 < .001) return;
    const direction = target.clone().sub(a).normalize();
    const distance = THREE.MathUtils.clamp(a.distanceTo(target), Math.abs(l1 - l2) + .0001, l1 + l2 - .0001);
    // Keep the clip's own bend plane (current joint side); fall back to the anatomical pole.
    const bend = b.clone().sub(a).addScaledVector(direction, -b.clone().sub(a).dot(direction));
    if (bend.lengthSq() < (.05 * l1) ** 2) bend.copy(new THREE.Vector3(0, 0, poleSign).applyQuaternion(this.group.quaternion)).addScaledVector(direction, -bend.dot(direction));
    if (bend.lengthSq() < 1e-8) return;
    bend.normalize();
    const along = (l1 * l1 + distance * distance - l2 * l2) / (2 * distance);
    const joint = a.clone().addScaledVector(direction, along).addScaledVector(bend, Math.sqrt(Math.max(0, l1 * l1 - along * along)));
    const aim = (bone: THREE.Object3D, from: THREE.Vector3, to: THREE.Vector3) => {
      const world = bone.getWorldQuaternion(q());
      const correction = q().setFromUnitVectors(from.normalize(), to.normalize());
      const parent = bone.parent?.getWorldQuaternion(q()) ?? q();
      bone.quaternion.copy(parent.invert().multiply(correction.multiply(world)));
      bone.updateWorldMatrix(false, true);
    };
    aim(upper, b.clone().sub(a), joint.clone().sub(a));
    const elbow = lower.getWorldPosition(v()), tip = end.getWorldPosition(v());
    aim(lower, tip.sub(elbow), target.clone().sub(elbow));
  }
}

function d2(a: number[], b: number[]) { let s = 0; for (let k = 0; k < a.length; k++) s += (a[k] - b[k]) ** 2; return s; }
