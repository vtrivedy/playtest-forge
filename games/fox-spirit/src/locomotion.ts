import * as THREE from 'three';
import { FOX_RIG } from './foxRig';
import { carpusName } from './foxLimbRig';
import GAITS from '../../../assets/hero/spirit_fox.loco.json';

// Clip-driven locomotion (DESIGN-loco-clips.md). The authored clip is the pose:
// 1. speed-driven 1D blend tree walk/trot/run on one shared, sync-matched phase, played at stride-matched rate;
// 2. linear crossfades between states (idle, jump_*, land, ...);
// 3. light foot IK: ground rays per paw, stance foot lock, pelvis height, two-bone legs, pad normal align;
// 4. subtle additives only: slope tilt, turn lean, look-at head.

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
const v = () => new THREE.Vector3();
const q = () => new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);
const MATCH_BINS = 64;

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

type Foot = {
  name: string; upper: THREE.Object3D; lower: THREE.Object3D; hock: THREE.Object3D; paw: THREE.Object3D;
  /** Pole: fore elbow points back (-1), hind stifle forward (+1), in actor space. */
  pole: number; padLocal: THREE.Vector3;
  stance: number; planted: boolean; anchor: THREE.Vector3; lock: THREE.Vector3;
  previous: THREE.Vector3; hasPrevious: boolean; shadow: THREE.Mesh;
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
    /** Blend tree points (m/s): walk→trot at trotSpeed, trot→run at gallopSpeed, ± gaitHysteresis (fraction).
     * Walk, trot and gallop have different footfall orders, so a gait change is a short synced crossfade (gaitFade s),
     * never a standing mid-band mix. Points sit where each clip plays within minRate..maxRate of its authored cadence. */
    trotSpeed: 1.15, gallopSpeed: 3.4, gaitHysteresis: .12, gaitFade: .18,
    /** Crossfade into idle (other states use the caller's fade, 0.12–0.2 s). */
    idleFade: .25,
    /** Playback rate bounds relative to each clip's authored cadence (stance lock absorbs what the clamp leaves). */
    minRate: .5, maxRate: 1.8,
    footIK: 1, pelvisAdjust: 1, maxPelvisDrop: .2, footLock: 1, maxLock: .08, normalAlignDeg: 10, clearance: .004,
    contactShadow: .45,
    slopeTilt: 1, turnLean: .05, bankMax: .16, headLead: .24, headFrequency: 3, headDamping: .85,
    springFrequency: 3, springDamping: .8,
  };
  metrics = {
    gait: 'idle', phase: 0, playback: 1, cadenceHz: 0, clipWeights: {} as Record<string, number>,
    footGap: [0, 0, 0, 0], stanceFeet: 0, maxSlideMS: 0, maxPlantError: 0, maxResidual: 0,
    pelvisOffset: 0, spineFlexDeg: 0, turnRate: 0, slopePitch: 0, bank: 0,
  };
  input: MotionInput = { speed: 0, grounded: true, yaw: 0, verticalSpeed: 0, groundAt: () => 0 };
  readonly footfalls: THREE.Vector3[] = [];
  fadeSeconds = .16;

  private feet: Foot[] = [];
  /** Per-gait cycle phase; all advance at the shared cadence. Gait changes re-enter the new clip pose-matched. */
  private phases: Record<Gait, number> = { walk: 0, trot: 0, run: 0 };
  /** match[`${from}>${to}`][bin] = phase of `to` whose leg pose best matches `from` at bin/MATCH_BINS; entry[g] = best match to idle. */
  private match = new Map<string, Float32Array>();
  private entry: Record<Gait, number> = { walk: 0, trot: 0, run: 0 };
  private locoWeight = 0;
  private share: Record<Gait, number> = { walk: 1, trot: 0, run: 0 };
  private gait: Gait = 'walk';
  private weights = new Map<string, number>([['idle', 1]]);
  private overlays: { bone: THREE.Object3D; rotation: THREE.Quaternion }[] = [];
  private rootPosition: THREE.Vector3;
  private armScale = 1;
  private yaw = 0;
  private turn = 0;
  private pelvis = 0;
  private pitchSpring = new Spring();
  private leanSpring = new Spring();
  private lookSpring = new Spring();
  private spines: THREE.Object3D[] = [];
  private necks: THREE.Object3D[] = [];
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
    this.head = find(FOX_RIG.head);

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
        stance: 1, planted: false, anchor: v(), lock: v(), previous: v(), hasPrevious: false, shadow });
    }
    root.position.y -= padHeights.reduce((a, b) => a + b, 0) / padHeights.length;
    this.rootPosition.copy(root.position);
    root.updateWorldMatrix(true, true);
    this.shadows.name = 'PawContactShadows';
    group.add(this.shadows);
    this.buildPoseMatch();
  }

  /** Sync markers by pose matching: sample each gait's leg pose (elbow/stifle, carpus/hock, pad, plus the pose a few
   * bins later for direction of travel) and, for every gait pair, find the entry phase of the new gait closest to the
   * old one. Walk (lateral), trot (diagonal) and gallop (rotary) have different footfall orders, so equal phases
   * would cross-blend opposite leg configurations. */
  private buildPoseMatch() {
    const mixer = this.actions.get('walk')!.getMixer();
    const all = [...this.actions.values()];
    const sample = (name: string, phase: number) => {
      for (const a of all) { a.play(); a.setEffectiveWeight(0); }
      const a = this.actions.get(name)!;
      a.setEffectiveTimeScale(0); a.setEffectiveWeight(1); a.time = phase * a.getClip().duration;
      mixer.update(0); this.root.updateMatrixWorld(true);
      const out: number[] = [];
      for (const f of this.feet) for (const o of [f.lower.getWorldPosition(v()), f.hock.getWorldPosition(v()), f.paw.localToWorld(f.padLocal.clone())])
        out.push(...this.group.worldToLocal(o).toArray());
      return out;
    };
    const poses = new Map<string, number[][]>();
    for (const g of GAIT_NAMES) poses.set(g, Array.from({ length: MATCH_BINS }, (_, i) => sample(g, i / MATCH_BINS)));
    const idle = sample('idle', 0);
    for (const a of all) a.setEffectiveWeight(0);
    const d2 = (a: number[], b: number[]) => a.reduce((s, x, k) => s + (x - b[k]) ** 2, 0);
    const lookAhead = 3;
    for (const from of GAIT_NAMES) for (const to of GAIT_NAMES) {
      if (from === to) continue;
      const A = poses.get(from)!, B = poses.get(to)!, table = new Float32Array(MATCH_BINS);
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
      const B = poses.get(g)!;
      let best = 0, bestD = Infinity;
      B.forEach((pose, j) => { const d = d2(idle, pose); if (d < bestD) { bestD = d; best = j; } });
      this.entry[g] = best / MATCH_BINS;
    }
  }

  reset() {
    this.beforeMixer();
    for (const foot of this.feet) { foot.planted = false; foot.lock.set(0, 0, 0); foot.hasPrevious = false; }
    for (const s of [this.pitchSpring, this.leanSpring, this.lookSpring]) s.reset();
    this.turn = 0; this.yaw = this.group.rotation.y; this.pelvis = 0;
  }
  /** A deliberate dash-facing snap is not a physical turn impulse. */
  syncYaw(yaw: number) { this.yaw = yaw; this.turn = 0; }

  /** Undo last frame's additive/IK layer before the mixer supplies the next authored pose. */
  beforeMixer() {
    for (let i = this.overlays.length - 1; i >= 0; i--) { const o = this.overlays[i]; o.bone.quaternion.copy(o.rotation); }
    this.overlays.length = 0;
    this.root.position.copy(this.rootPosition);
  }

  private save(bone: THREE.Object3D) { this.overlays.push({ bone, rotation: bone.quaternion.clone() }); }

  /** Blend tree + crossfades. Gait clips are time-driven from one shared phase (sync group). */
  blend(dt: number, active: string) {
    const p = this.params, speed = Math.max(0, this.input.speed);
    const locomoting = isGait(active);
    const fade = active === 'idle' ? Math.max(this.fadeSeconds, p.idleFade) : this.fadeSeconds;
    const step = fade <= 0 ? 1 : dt / fade;
    const toward = (w: number, target: number) => w < target ? Math.min(target, w + step) : Math.max(target, w - step);

    // 1D blend tree by ground speed: pick the gait (with hysteresis), crossfade its share on the shared phase.
    const entering = this.locoWeight < 1e-3;
    const h = entering ? 0 : p.gaitHysteresis;
    const order: Gait[] = ['walk', 'trot', 'run'], ups = [p.trotSpeed, p.gallopSpeed];
    let index = order.indexOf(this.gait);
    while (index < 2 && speed > ups[index] * (1 + h)) index++;
    while (index > 0 && speed < ups[index - 1] * (1 - h)) index--;
    const previous = this.gait;
    this.gait = order[index];
    if (entering) this.phases[this.gait] = this.entry[this.gait];
    else if (previous !== this.gait) {
      const bin = Math.floor(this.phases[previous] * MATCH_BINS) % MATCH_BINS;
      this.phases[this.gait] = this.match.get(`${previous}>${this.gait}`)![bin];
    }
    const shareStep = entering ? 1 : dt / Math.max(1e-3, p.gaitFade);
    let shareTotal = 0;
    for (const g of GAIT_NAMES) {
      const t = g === this.gait ? 1 : 0;
      this.share[g] = this.share[g] < t ? Math.min(t, this.share[g] + shareStep) : Math.max(t, this.share[g] - shareStep);
      shareTotal += this.share[g];
    }
    for (const g of GAIT_NAMES) this.share[g] /= Math.max(1e-5, shareTotal);

    // Stride-matched cadence: one cycle per blended stride of ground travel, rate bounded per authored clip.
    let stride = 0, natural = 0;
    for (const g of GAIT_NAMES) {
      stride += this.share[g] * GAITS[g].stride * this.armScale;
      natural += this.share[g] / this.actions.get(g)!.getClip().duration;
    }
    const cadence = THREE.MathUtils.clamp(speed / Math.max(1e-3, stride), natural * p.minRate, natural * p.maxRate);
    if (this.locoWeight > 0 || locomoting) for (const g of GAIT_NAMES) this.phases[g] = (this.phases[g] + dt * cadence) % 1;

    // Linear crossfades; the locomotion blend tree fades as one state.
    this.locoWeight = toward(this.locoWeight, locomoting ? 1 : 0);
    let total = this.locoWeight;
    for (const name of this.actions.keys()) {
      if (isGait(name)) continue;
      const w = toward(this.weights.get(name) ?? 0, name === active ? 1 : 0);
      this.weights.set(name, w); total += w;
    }
    const norm = total > 1e-5 ? 1 / total : 0;
    for (const [name, action] of this.actions) {
      let w: number;
      if (isGait(name)) {
        w = this.locoWeight * this.share[name] * norm;
        action.time = this.phases[name] * action.getClip().duration;
        action.setEffectiveTimeScale(0);
        action.paused = false;
      } else w = (this.weights.get(name) ?? 0) * norm;
      if (w > 1e-4 && !action.isRunning()) action.play();
      action.enabled = true;
      action.setEffectiveWeight(w);
      this.metrics.clipWeights[name] = w;
    }
    let dominant: Gait = 'walk';
    for (const g of GAIT_NAMES) if (this.share[g] > this.share[dominant]) dominant = g;
    this.metrics.gait = locomoting ? dominant : active;
    this.metrics.phase = this.phases[this.gait];
    this.metrics.cadenceHz = locomoting ? cadence : 0;
    this.metrics.playback = locomoting ? cadence / natural : 1;
  }

  afterMixer(dt: number, active: string) {
    const p = this.params, input = this.input, step = Math.max(dt, 1e-5);
    const group = this.group;
    const forward = new THREE.Vector3(Math.sin(input.yaw), 0, Math.cos(input.yaw));

    // ---- Additive layer: slope tilt, turn lean, look-at head (all subtle) ----
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
    const lookDelta = input.lookYaw === undefined ? 0 : Math.atan2(Math.sin(input.lookYaw - input.yaw), Math.cos(input.lookYaw - input.yaw));
    const look = this.lookSpring.step(THREE.MathUtils.clamp(lookDelta * p.headLead + this.turn * .05, -.3, .3), dt, p.headFrequency, p.headDamping);
    for (const neck of this.necks) worldTurn(neck, UP, look * .5 / this.necks.length);
    worldTurn(this.head, UP, look * .5);

    // ---- Foot IK: ground rays, stance lock, pelvis height, two-bone legs ----
    this.footfalls.length = 0;
    this.metrics.stanceFeet = 0; this.metrics.maxSlideMS = 0; this.metrics.maxPlantError = 0; this.metrics.maxResidual = 0;
    const locoW = GAIT_NAMES.reduce((s, g) => s + (this.metrics.clipWeights[g] ?? 0), 0);
    const standing = input.grounded && !AIR_STATES.has(active);
    const actorGround = input.groundAt(group.position.x, group.position.z, ceiling);
    const solveFeet = input.grounded && p.footIK > 0 && Number.isFinite(actorGround);
    type Plan = { pad: THREE.Vector3; ground: number; normal: THREE.Vector3; target: THREE.Vector3; w: number };
    const plans: (Plan | null)[] = [];
    let pelvisNeed = Infinity;
    this.feet.forEach((foot, i) => {
      const pad = foot.paw.localToWorld(foot.padLocal.clone());
      // Stance weight from the authored contact windows on the shared phase (soft 3 % edges).
      let gaitStance = 0;
      for (const g of GAIT_NAMES) {
        const c = GAITS[g].contacts[i], u = (this.phases[g] - c.phase + 1) % 1, e = .03;
        gaitStance += this.share[g] * THREE.MathUtils.smoothstep(u, 0, e) * (1 - THREE.MathUtils.smoothstep(u, c.duty - e, c.duty));
      }
      const stanceTarget = !input.grounded ? 0 : locoW * gaitStance + (1 - locoW) * (standing ? 1 : 0);
      // ~40 ms ease so a touchdown (or a state change) seats the paw instead of snapping it.
      foot.stance += (stanceTarget - foot.stance) * (1 - Math.exp(-dt / .04));
      const ground = input.groundAt(pad.x, pad.z, ceiling);
      if (!solveFeet || !Number.isFinite(ground)) {
        foot.planted = false; foot.lock.set(0, 0, 0); plans.push(null);
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
      if (foot.planted && p.footLock > 0 && locoW > 1e-3) {
        const want = foot.anchor.clone().sub(pad).setY(0);
        this.metrics.maxPlantError = Math.max(this.metrics.maxPlantError, want.length());
        if (want.length() > p.maxLock) { want.setLength(p.maxLock); foot.anchor.copy(pad).add(want); }
        foot.lock.copy(want).multiplyScalar(p.footLock * locoW);
      } else foot.lock.multiplyScalar(Math.exp(-dt / .06));
      // Vertical: stance pads sit on their own ground hit; swing pads follow the terrain under them (never below it).
      const offset = ground - actorGround;
      const swingY = Math.max(pad.y + offset, ground + p.clearance);
      const target = pad.clone().add(foot.lock);
      target.y = THREE.MathUtils.lerp(swingY, ground + p.clearance, foot.stance);
      if (foot.stance > .5) pelvisNeed = Math.min(pelvisNeed, target.y - pad.y);
      plans.push({ pad, ground, normal, target, w: foot.stance });
    });

    // Pelvis: drop so the lowest stance foot can reach; never lift more than a little.
    const pelvisTarget = Number.isFinite(pelvisNeed) && solveFeet ? THREE.MathUtils.clamp(pelvisNeed * p.pelvisAdjust, -p.maxPelvisDrop, .03) : 0;
    this.pelvis = THREE.MathUtils.damp(this.pelvis, pelvisTarget, 18, dt);
    this.metrics.pelvisOffset = this.pelvis;
    if (Math.abs(this.pelvis) > 1e-5) {
      this.root.position.y += this.pelvis;
      this.root.updateWorldMatrix(true, true);
    }

    this.feet.forEach((foot, i) => {
      const plan = plans[i];
      if (!plan) { foot.hasPrevious = false; this.metrics.footGap[i] = 0; return; }
      // Pad aligns to the ground normal (bounded) while it carries weight, then the leg carries the aligned pad to target.
      const align = q().setFromUnitVectors(UP, plan.normal);
      const maxAngle = THREE.MathUtils.degToRad(p.normalAlignDeg);
      const angle = 2 * Math.acos(Math.min(1, Math.abs(align.w)));
      if (angle > 1e-4 && plan.w > 0) {
        this.save(foot.paw);
        worldTurnBone(foot.paw, q().slerp(align, Math.min(1, maxAngle / angle) * plan.w));
      }
      const pad = foot.paw.localToWorld(foot.padLocal.clone());
      if (pad.distanceToSquared(plan.target) > 1e-8) this.placePaw(foot, plan.target.clone().sub(pad.sub(foot.paw.getWorldPosition(v()))));
      const solved = foot.paw.localToWorld(foot.padLocal.clone());
      this.metrics.footGap[i] = plan.w > .9 ? solved.y - plan.ground : 0;
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
