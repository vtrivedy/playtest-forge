import * as THREE from 'three';
import { buildRig, resetToRest, rotateBoneAxis, rotateBoneWorld, setBoneWorldQuat, LEG_IDS, type LegId, type Rig, type RigLeg } from './rig';
import { fabrik, applyChain } from './ik';
import { DEFAULT_GAITS, GAITS, PHASE, gaitWeights, type GaitName, type GaitTune } from './gait';

export type LocoParams = {
  gaits: Record<GaitName, GaitTune>;
  /** Below this ground speed the stride clock stops and feet only re-step to fix their stance */
  idleSpeed: number;
  /** Planted-foot error (u) that triggers a corrective step while standing / turning on the spot */
  idleStepDist: number;
  idleStepTime: number;
  /** Fraction of the stance stride a paw lands ahead of its neutral spot */
  strideLead: number;
  /** 0..1 how far moving strides centre under the hip instead of the standing paw spot */
  strideUnderHip: number;
  /** Scapula swing (rad per unit of paw offset / leg reach) and its cap */
  scapulaSwing: number;
  maxScapula: number;
  /** Body lowers so planted paws stay within reach × this */
  reachMargin: number;
  /** Stance feet farther than reach × this from their hip are forced to step */
  overreach: number;
  /** Nose-down pitch (rad) per u/s² of forward acceleration (braking pitches nose-up) */
  pitchAccel: number;
  maxPitch: number;
  /** Fraction of the physical centripetal lean angle applied as body roll */
  lean: number;
  maxRoll: number;
  /** Spine yaw bend (rad) per rad/s of turn rate */
  spineBend: number;
  maxBend: number;
  /** Gallop spine flex/extend amplitude (rad) */
  gallopFlex: number;
  /** 0..1 how much the head cancels body pitch/roll */
  headStabilize: number;
  /** Head/neck yaw into the turn (rad per rad/s) */
  headLook: number;
  /** Crouch spring (jump wind-up, landing absorb) */
  crouchStiffness: number;
  crouchDamping: number;
  landCrouch: number;
  windupCrouch: number;
  takeoffStretch: number;
  /** Skid/brace: nose-up pitch and hind squat */
  skidPitch: number;
  skidSquat: number;
  /** Tail spring chain */
  tailStiffness: number;
  tailStiffnessTip: number;
  tailDrag: number;
  tailGravity: number;
  tailSway: number;
  /** Air pose follow rate (1/s) */
  airPoseRate: number;
  /** Body follow rate for slope height/pitch (1/s) */
  bodyRate: number;
  debug: boolean;
};

export const DEFAULT_LOCO: LocoParams = {
  gaits: structuredClone(DEFAULT_GAITS),
  idleSpeed: 0.25,
  idleStepDist: 0.09,
  idleStepTime: 0.2,
  strideLead: 0.5,
  strideUnderHip: 0.7,
  scapulaSwing: 0.6,
  maxScapula: 0.3,
  reachMargin: 0.96,
  overreach: 1.04,
  pitchAccel: 0.012,
  maxPitch: 0.22,
  lean: 0.55,
  maxRoll: 0.28,
  spineBend: 0.11,
  maxBend: 0.32,
  gallopFlex: 0.1,
  headStabilize: 0.75,
  headLook: 0.12,
  crouchStiffness: 220,
  crouchDamping: 18,
  landCrouch: 0.16,
  windupCrouch: 0.1,
  takeoffStretch: 0.05,
  skidPitch: 0.16,
  skidSquat: 0.08,
  tailStiffness: 26,
  tailStiffnessTip: 6,
  tailDrag: 5,
  tailGravity: 1.5,
  tailSway: 0.05,
  airPoseRate: 14,
  bodyRate: 12,
  debug: false,
};

export type LocoInput = {
  /** World velocity of the character (u/s) */
  vel: THREE.Vector3;
  grounded: boolean;
  gliding: boolean;
  dashing: boolean;
  skidding: boolean;
  /** 0..1 jump wind-up progress (crouch before takeoff) */
  windup: number;
};

type LegState = {
  rig: RigLeg;
  mode: 'plant' | 'step' | 'air';
  foot: THREE.Vector3;
  from: THREE.Vector3;
  t: number;
  dur: number;
  prevPhase: number;
  /** Ground-contact flag for debug / footfall events */
  contact: boolean;
  /** Ground height of the current step's landing spot */
  ty: number;
  joints: THREE.Vector3[];
};

export type Footfall = { leg: LegId; pos: THREE.Vector3; strength: number };

const UP = new THREE.Vector3(0, 1, 0);
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _m2 = new THREE.Matrix4();
const _e = new THREE.Euler();

export type Locomotion = ReturnType<typeof createLocomotion>;

/**
 * Runtime quadruped locomotion. The fox group carries the physics position + heading; every frame the skeleton is
 * rebuilt from rest: body pose (bob/pitch/roll/crouch, slope) → spine bend → planted-foot IK → head → tail.
 */
/**
 * `groundAt(x, z, refY)` returns the walkable surface height under a point; `feetOffset` is how far the group origin
 * sits above the ground it stands on.
 */
export function createLocomotion(model: THREE.Group, groundAt: (x: number, z: number, refY: number) => number, feetOffset = 0) {
  const rig: Rig = buildRig(model);
  const params: LocoParams = structuredClone(DEFAULT_LOCO);
  const legs = {} as Record<LegId, LegState>;
  for (const id of LEG_IDS) {
    const r = rig.legs[id];
    legs[id] = {
      rig: r,
      mode: 'plant',
      foot: new THREE.Vector3(),
      from: new THREE.Vector3(),
      t: 0,
      dur: 0,
      prevPhase: 0,
      contact: true,
      ty: 0,
      joints: r.restJoints.map((p) => p.clone()),
    };
  }
  const stepTarget = {} as Record<LegId, THREE.Vector3>;
  for (const id of LEG_IDS) stepTarget[id] = new THREE.Vector3();
  const weights: Record<GaitName, number> = { walk: 1, trot: 0, gallop: 0 };
  const state = {
    phase: 0,
    freq: 0,
    duty: 0.66,
    speed: 0,
    gait: 'walk' as GaitName | 'idle' | 'air',
    yawRate: 0,
    fwdAccel: 0,
    latAccel: 0,
    pitch: 0,
    pitchDyn: 0,
    roll: 0,
    lift: 0,
    liftF: 0,
    liftH: 0,
    crouch: 0,
    crouchVel: 0,
    bend: 0,
    look: 0,
    air: 0,
    skid: 0,
    /** Treadmill speed for staged stills (group stays put, feet cycle) */
    treadmill: 0,
    clock: 0,
  };
  let prevYaw = model.rotation.y;
  let prevGrounded = true;
  let prevVel = new THREE.Vector3();
  let initialised = false;
  const footfalls: Footfall[] = [];

  // tail spring chain (world space)
  const tailN = rig.tailRest.length;
  const tailP = rig.tailRest.map((p) => p.clone());
  const tailPrev = rig.tailRest.map((p) => p.clone());
  const tailTarget = rig.tailRest.map((p) => p.clone());
  const tailLen = rig.tailRest.slice(1).map((p, i) => p.distanceTo(rig.tailRest[i]));
  const tailTipObj = new THREE.Object3D();
  rig.tail[rig.tail.length - 1].add(tailTipObj);
  {
    // tip in last bone's local space
    model.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(rig.tail[rig.tail.length - 1].matrixWorld).invert();
    tailTipObj.position.copy(rig.tailRest[tailN - 1]).applyMatrix4(model.matrixWorld).applyMatrix4(inv);
  }

  // rest world-relative orientation of paws and head in model space (for re-orienting after IK)
  model.updateMatrixWorld(true);
  const modelQInv = model.getWorldQuaternion(new THREE.Quaternion()).invert();
  const footRestQ = {} as Record<LegId, THREE.Quaternion>;
  for (const id of LEG_IDS) footRestQ[id] = modelQInv.clone().multiply(rig.legs[id].foot.getWorldQuaternion(new THREE.Quaternion()));
  const headRestQ = modelQInv.clone().multiply(rig.head.getWorldQuaternion(new THREE.Quaternion()));

  // ---- debug draw ----
  const debug = new THREE.Group();
  debug.name = 'loco-debug';
  debug.visible = false;
  const dbgMat = (c: number) => new THREE.MeshBasicMaterial({ color: c, depthTest: false, transparent: true });
  const footMarks = {} as Record<LegId, THREE.Mesh>;
  for (const id of LEG_IDS) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), dbgMat(0x33ff66));
    m.renderOrder = 999;
    footMarks[id] = m;
    debug.add(m);
  }
  const comMark = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), dbgMat(0xffee33));
  comMark.renderOrder = 999;
  debug.add(comMark);
  const velArrow = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(), 1, 0x33ccff, 0.15, 0.08);
  (velArrow.line.material as THREE.LineBasicMaterial).depthTest = false;
  (velArrow.cone.material as THREE.MeshBasicMaterial).depthTest = false;
  debug.add(velArrow);

  const groupPos = new THREE.Vector3();
  const groupQ = new THREE.Quaternion();
  const bodyQ = new THREE.Quaternion();

  /**
   * Neutral world position of a foot for the group at `pos` with heading `yaw`. `under` slides it from the
   * standing spot toward straight under the hip (strides centre under the hip so short fore legs can reach).
   */
  function neutralFoot(leg: RigLeg, pos: THREE.Vector3, yaw: number, out: THREE.Vector3, under = 0) {
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    const x = leg.restFoot.x;
    const z = THREE.MathUtils.lerp(leg.restFoot.z, leg.restJoints[0].z, under);
    out.set(pos.x + x * c + z * s, pos.y, pos.z - x * s + z * c);
    return out;
  }

  function ground(x: number, z: number, refY: number, fallback: number) {
    const y = groundAt(x, z, refY);
    return Number.isFinite(y) && y > refY - 1.5 ? y : fallback;
  }
  /** Planted height of a foot-bone head above the ground (its rest height in the model) */
  const pad = (L: LegState) => L.rig.restFoot.y + feetOffset;
  /** Foot-bone-head plant point on the ground under (x, z) */
  function plantY(L: LegState, x: number, z: number) {
    const ref = groupPos.y - feetOffset;
    return ground(x, z, ref + 0.45, ref) + pad(L);
  }

  function startStep(L: LegState, dur: number) {
    L.mode = 'step';
    L.from.copy(L.foot);
    L.t = 0;
    L.dur = Math.max(0.06, dur);
    L.contact = false;
    L.ty = L.foot.y;
  }

  function snapAll(pos: THREE.Vector3, yaw: number) {
    for (const id of LEG_IDS) {
      const L = legs[id];
      neutralFoot(L.rig, pos, yaw, L.foot);
      L.foot.y = plantY(L, L.foot.x, L.foot.z);
      L.mode = 'plant';
      L.contact = true;
    }
    for (let i = 0; i < tailN; i++) {
      tailP[i].copy(rig.tailRest[i]).applyMatrix4(model.matrixWorld);
      tailPrev[i].copy(tailP[i]);
    }
  }

  function update(dt: number, input: LocoInput) {
    footfalls.length = 0;
    const p = params;
    resetToRest(rig);
    model.updateMatrixWorld(true);
    model.getWorldPosition(groupPos);
    model.getWorldQuaternion(groupQ);
    const yaw = model.rotation.y;
    if (!initialised) {
      snapAll(groupPos, yaw);
      prevYaw = yaw;
      initialised = true;
    }
    if (dt <= 0) dt = 1e-4;

    // --- kinematics from the controller ---
    const vel = _v3.copy(input.vel);
    vel.y = 0;
    if (state.treadmill > 0) vel.set(Math.sin(yaw), 0, Math.cos(yaw)).multiplyScalar(state.treadmill);
    const speed = vel.length();
    const dyaw = Math.atan2(Math.sin(yaw - prevYaw), Math.cos(yaw - prevYaw));
    prevYaw = yaw;
    state.yawRate = THREE.MathUtils.damp(state.yawRate, dyaw / dt, 10, dt);
    const fwd = _v.set(Math.sin(yaw), 0, Math.cos(yaw));
    const acc = _v2.copy(vel).sub(prevVel).divideScalar(dt);
    prevVel.copy(vel);
    const fwdA = THREE.MathUtils.clamp(acc.dot(fwd), -60, 60);
    state.fwdAccel = THREE.MathUtils.damp(state.fwdAccel, fwdA, 8, dt);
    state.speed = speed;
    // teleports / respawns: re-plant everything
    for (const id of LEG_IDS) {
      if (legs[id].foot.distanceToSquared(groupPos) > 9) {
        snapAll(groupPos, yaw);
        break;
      }
    }

    const grounded = input.grounded;
    const g = p.gaits;
    gaitWeights(speed, g, weights);
    let freq = 0;
    let duty = 0;
    let stepH = 0;
    let bobA = 0;
    for (const n of GAITS) {
      const w = weights[n];
      freq += w * g[n].freq * THREE.MathUtils.clamp(Math.pow(Math.max(speed, 0.05) / g[n].speed, 0.4), 0.6, 1.35);
      duty += w * g[n].duty;
      stepH += w * g[n].stepHeight;
      bobA += w * g[n].bob;
    }
    state.freq = freq;
    state.duty = duty;
    const moving = speed > p.idleSpeed && grounded && !input.skidding;
    if (moving) state.phase = (state.phase + freq * dt) % 1;
    state.gait = !grounded ? 'air' : !moving ? 'idle' : weights.gallop > 0.5 ? 'gallop' : weights.trot > 0.5 ? 'trot' : 'walk';

    // --- crouch spring: landing absorb, wind-up, takeoff stretch ---
    if (grounded && !prevGrounded) {
      const impact = THREE.MathUtils.clamp(-input.vel.y / 14, 0.15, 1);
      state.crouchVel -= p.landCrouch * impact * 16;
    }
    if (!grounded && prevGrounded && input.vel.y > 1) state.crouchVel += p.takeoffStretch * 18;
    const crouchTarget = -p.windupCrouch * input.windup - (input.skidding ? p.skidSquat * 0.5 : 0);
    state.crouchVel += (-(state.crouch - crouchTarget) * p.crouchStiffness - state.crouchVel * p.crouchDamping) * dt;
    state.crouch += state.crouchVel * dt;
    state.crouch = THREE.MathUtils.clamp(state.crouch, -0.3, 0.15);

    state.air = THREE.MathUtils.damp(state.air, grounded ? 0 : 1, grounded ? 18 : 8, dt);
    state.skid = THREE.MathUtils.damp(state.skid, input.skidding ? 1 : 0, 10, dt);

    // --- body height + slope: fore/hind pairs follow their feet, capped so every planted paw stays in reach ---
    const yawQ = groupQ;
    let foreUp = 0;
    let hindUp = 0;
    let foreMax = Infinity;
    let hindMax = Infinity;
    for (const id of LEG_IDS) {
      const L = legs[id];
      const fy = L.mode === 'step' ? THREE.MathUtils.lerp(L.from.y, L.ty, Math.min(1, L.t / L.dur)) : L.foot.y;
      const restY = groupPos.y + L.rig.restFoot.y;
      const up = L.mode === 'air' ? 0 : fy - restY;
      if (L.rig.fore) foreUp += up * 0.5;
      else hindUp += up * 0.5;
      // planted paws and the landing spot of late-swing paws must stay in reach (lower the body ahead of touchdown)
      const late = L.mode === 'step' && L.t > L.dur * 0.4;
      if ((L.mode === 'plant' || late) && grounded) {
        const f = late ? stepTarget[id] : L.foot;
        // hip where the un-lifted body would put it; how high may it sit and still reach this paw?
        const hip = _v.copy(L.rig.restJoints[0]).applyQuaternion(yawQ).add(groupPos);
        if (late) hip.addScaledVector(_v3, L.dur - L.t);
        const dh = Math.hypot(hip.x - f.x, hip.z - f.z);
        const r = L.rig.reach * p.reachMargin;
        const maxUp = f.y + Math.sqrt(Math.max(0, r * r - dh * dh)) - hip.y;
        if (L.rig.fore) foreMax = Math.min(foreMax, maxUp);
        else hindMax = Math.min(hindMax, maxUp);
      }
    }
    if (!grounded) foreUp = hindUp = 0;
    const fT = THREE.MathUtils.clamp(Math.min(foreUp, foreMax), -0.35, 0.3);
    const hT = THREE.MathUtils.clamp(Math.min(hindUp, hindMax), -0.35, 0.3);
    state.liftF = THREE.MathUtils.damp(state.liftF, fT, fT < state.liftF ? 30 : p.bodyRate, dt);
    state.liftH = THREE.MathUtils.damp(state.liftH, hT, hT < state.liftH ? 30 : p.bodyRate, dt);
    const bodyLen = rig.shoulder.distanceTo(rig.hip);
    const ph = state.phase * Math.PI * 2;
    // walk/trot: two dips per stride (one per diagonal/lateral support); gallop: one big rock per stride
    const bob = moving
      ? -(weights.walk + weights.trot) * bobA * Math.cos(2 * ph) - weights.gallop * bobA * Math.cos(ph + 0.6)
      : 0;
    const gallopRock = moving ? weights.gallop * 0.06 * Math.sin(ph + 0.6) : 0;
    const accelPitch = THREE.MathUtils.clamp(-state.fwdAccel * p.pitchAccel, -p.maxPitch, p.maxPitch);
    const pitchTarget = (grounded ? accelPitch : 0) + gallopRock + state.skid * p.skidPitch + airPitch(input);
    state.pitchDyn = THREE.MathUtils.damp(state.pitchDyn, pitchTarget, p.bodyRate, dt);
    const leanPhys = Math.atan((speed * state.yawRate) / 9.8);
    const rollTarget = THREE.MathUtils.clamp(-leanPhys * p.lean, -p.maxRoll, p.maxRoll);
    state.roll = THREE.MathUtils.damp(state.roll, grounded ? rollTarget : rollTarget * 0.5, 8, dt);
    // idle breathing
    state.clock += dt;
    const breathe = !moving && grounded ? Math.sin(state.clock * 2.1) * 0.004 : 0;
    // shoulder / hip heights: feet-follow lift + bob + crouch + dynamic pitch, hard-capped by paw reach
    const common = bob + state.crouch + breathe;
    const halfPitch = Math.sin(state.pitchDyn) * bodyLen * 0.5;
    const frontY = Math.min(state.liftF + common + halfPitch, foreMax);
    const hindY2 = Math.min(state.liftH + common - halfPitch, hindMax);
    state.pitch = Math.atan2(frontY - hindY2, bodyLen);
    const dy = (frontY + hindY2) * 0.5;
    state.lift = dy;
    // root transform about the COM, in model space
    _e.set(-state.pitch, 0, state.roll, 'YXZ');
    _q.setFromEuler(_e);
    const com = rig.com;
    _m.makeTranslation(com.x, com.y + dy, com.z)
      .multiply(_m2.makeRotationFromQuaternion(_q))
      .multiply(new THREE.Matrix4().makeTranslation(-com.x, -com.y, -com.z));
    const bodyM = _m.clone();
    // world target for the root bone: G * M * G^-1 * rootWorld
    const rootW = rig.pelvis.matrixWorld.clone();
    const G = model.matrixWorld;
    const target = new THREE.Matrix4().copy(G).multiply(_m).multiply(_m2.copy(G).invert()).multiply(rootW);
    const local = new THREE.Matrix4().copy(rig.pelvis.parent!.matrixWorld).invert().multiply(target);
    local.decompose(rig.pelvis.position, rig.pelvis.quaternion, _v.set(0, 0, 0));
    rig.pelvis.scale.copy(_v);
    rig.pelvis.updateMatrixWorld(true);
    bodyQ.copy(groupQ).multiply(_q);

    // --- spine: bend into turns, gallop flex/extend, skid hunch ---
    const bendTarget = THREE.MathUtils.clamp(state.yawRate * p.spineBend * Math.min(1, speed / 2 + 0.3), -p.maxBend, p.maxBend);
    state.bend = THREE.MathUtils.damp(state.bend, bendTarget, 9, dt);
    const upW = _v.set(0, 1, 0).applyQuaternion(bodyQ);
    const rightW = _v2.set(-1, 0, 0).applyQuaternion(bodyQ);
    const flex = moving ? weights.gallop * p.gallopFlex * Math.sin(ph + 2.2) : 0;
    const airFlex = airSpineFlex(input) * state.air;
    for (const b of rig.spine) {
      rotateBoneAxis(b, upW, state.bend / rig.spine.length, false);
      rotateBoneAxis(b, rightW, (flex + airFlex) / rig.spine.length, false);
    }
    // hips swing out opposite the chest
    rotateBoneAxis(rig.pelvis, upW, -state.bend * 0.25, false);
    rig.pelvis.updateMatrixWorld(true);

    // --- feet ---
    updateFeet(dt, input, speed, vel, yaw, freq, duty, stepH, moving);

    // --- leg IK ---
    for (const id of LEG_IDS) solveLeg(legs[id]);

    // --- head: stabilise against body pitch/roll, look into the turn ---
    state.look = THREE.MathUtils.damp(state.look, THREE.MathUtils.clamp(state.yawRate * p.headLook, -0.5, 0.5), 6, dt);
    {
      const cur = rig.head.getWorldQuaternion(_q);
      const lookQ = _q2.setFromAxisAngle(UP, state.look + state.bend * 0.5);
      const desired = new THREE.Quaternion().copy(groupQ).premultiply(lookQ).multiply(headRestQ);
      // remove part of the body's pitch from the head and let the rest through
      const stab = new THREE.Quaternion().copy(cur).slerp(desired, p.headStabilize);
      const delta = stab.multiply(cur.clone().invert());
      const part = new THREE.Quaternion().slerp(delta, 1 / (rig.neck.length + 1));
      for (const b of rig.neck) rotateBoneWorld(b, part);
      rotateBoneWorld(rig.head, part);
    }

    // --- tail spring chain ---
    updateTail(dt, speed, ph, moving);

    // ears: lay back a touch with speed / in air
    const earBack = Math.min(1, speed / 9) * 0.25 + state.air * 0.2;
    for (const ear of rig.ears) rotateBoneAxis(ear[0], rightW.set(-1, 0, 0).applyQuaternion(bodyQ), earBack, true);

    prevGrounded = grounded;

    // --- debug ---
    debug.visible = p.debug;
    if (p.debug) {
      for (const id of LEG_IDS) {
        const L = legs[id];
        footMarks[id].position.copy(L.foot);
        (footMarks[id].material as THREE.MeshBasicMaterial).color.setHex(L.contact ? 0x33ff66 : 0xff4433);
      }
      comMark.position.copy(rig.com).applyMatrix4(bodyM).applyMatrix4(G);
      velArrow.position.copy(groupPos).add(_v.set(0, 0.9, 0));
      if (speed > 0.05) velArrow.setDirection(_v.copy(vel).normalize());
      velArrow.setLength(Math.max(0.05, speed * 0.25), 0.15, 0.08);
    }
  }

  function airPitch(input: LocoInput) {
    if (input.grounded) return 0;
    if (input.gliding) return -0.06;
    if (input.dashing) return -0.08;
    // nose up on the rise, nose down as it falls toward the landing
    return THREE.MathUtils.clamp(input.vel.y * 0.035, -0.3, 0.25);
  }

  function airSpineFlex(input: LocoInput) {
    // stretch on the rise, gather on the fall
    if (input.gliding || input.dashing) return 0.06;
    return input.vel.y > 0 ? 0.08 : -0.1;
  }


  function landingTarget(L: LegState, vel: THREE.Vector3, yaw: number, remain: number, stanceT: number, out: THREE.Vector3) {
    // the body will have travelled on by touchdown (a treadmill pose stays put)
    const travel = state.treadmill > 0 ? 0 : remain;
    const pos = _v.copy(groupPos).addScaledVector(vel, travel);
    const yawAt = yaw + state.yawRate * travel;
    neutralFoot(L.rig, pos, yawAt, out, params.strideUnderHip);
    out.addScaledVector(vel, stanceT * params.strideLead);
    out.y = plantY(L, out.x, out.z);
    // never aim a paw where the leg can't reach at touchdown (it would pop forward on contact)
    const c = Math.cos(yawAt);
    const sn = Math.sin(yawAt);
    const hx = L.rig.restJoints[0].x;
    const hz = L.rig.restJoints[0].z;
    const hipX = pos.x + hx * c + hz * sn;
    const hipZ = pos.z - hx * sn + hz * c;
    const hipY = pos.y + L.rig.restJoints[0].y + (L.rig.fore ? state.liftF : state.liftH);
    const r = L.rig.reach * params.reachMargin;
    const dy = Math.min(r * 0.98, Math.max(0, hipY - out.y));
    const maxH = Math.sqrt(r * r - dy * dy);
    const dx = out.x - hipX;
    const dz = out.z - hipZ;
    const h = Math.hypot(dx, dz);
    if (h > maxH) {
      out.x = hipX + (dx * maxH) / h;
      out.z = hipZ + (dz * maxH) / h;
      out.y = plantY(L, out.x, out.z);
    }
    return out;
  }

  function updateFeet(dt: number, input: LocoInput, speed: number, vel: THREE.Vector3, yaw: number, freq: number, duty: number, stepH: number, moving: boolean) {
    const p = params;
    const grounded = input.grounded;
    const stanceT = freq > 0 ? duty / freq : 0.3;
    const swingT = freq > 0 ? (1 - duty) / freq : 0.25;

    if (state.treadmill > 0) {
      for (const id of LEG_IDS) if (legs[id].mode === 'plant') legs[id].foot.addScaledVector(vel, -dt);
    }

    if (!grounded) {
      for (const id of LEG_IDS) {
        const L = legs[id];
        if (L.mode === 'plant' || L.mode === 'step') {
          // push-off: planted feet stay put until the leg runs out of reach
          const hip = L.rig.chain[0].getWorldPosition(_v2);
          if (L.mode === 'step' || hip.distanceTo(L.foot) > L.rig.reach * 0.97 || input.dashing) {
            L.mode = 'air';
            L.contact = false;
          }
        }
        if (L.mode === 'air') {
          airFoot(L, input, _v2);
          L.foot.lerp(_v2, 1 - Math.exp(-p.airPoseRate * dt));
        }
      }
      return;
    }

    // landing: air feet touch down where they are
    for (const id of LEG_IDS) {
      const L = legs[id];
      if (L.mode === 'air') {
        L.foot.y = plantY(L, L.foot.x, L.foot.z);
        L.mode = 'plant';
        L.contact = true;
        footfalls.push({ leg: id, pos: L.foot.clone(), strength: 1 });
      }
    }

    if (input.skidding) {
      // brace: fores dig in ahead, hinds tuck under; paws slide with the body (that's the skid)
      for (const id of LEG_IDS) {
        const L = legs[id];
        neutralFoot(L.rig, groupPos, yaw, _v2);
        const f = _v.set(Math.sin(yaw), 0, Math.cos(yaw));
        _v2.addScaledVector(f, L.rig.fore ? 0.22 : 0.06);
        _v2.y = plantY(L, _v2.x, _v2.z);
        L.foot.lerp(_v2, 1 - Math.exp(-20 * dt));
        L.mode = 'plant';
        L.contact = true;
      }
      return;
    }

    let stepping = 0;
    for (const id of LEG_IDS) if (legs[id].mode === 'step') stepping++;

    for (const id of LEG_IDS) {
      const L = legs[id];
      const offset = LEG_PHASE(id);
      const legPhase = (((state.phase + offset) % 1) + 1) % 1;
      const wasStance = L.prevPhase < duty;
      const isStance = legPhase < duty;
      L.prevPhase = legPhase;

      if (L.mode === 'plant') {
        const hip = L.rig.chain[0].getWorldPosition(_v2);
        const over = hip.distanceTo(L.foot) > L.rig.reach * p.overreach;
        if (moving && ((wasStance && !isStance) || over)) {
          startStep(L, over && isStance ? Math.min(swingT, 0.16) : swingT * (1 - (legPhase - duty) / (1 - duty) * 0.5));
          stepping++;
        } else if (!moving) {
          neutralFoot(L.rig, groupPos, yaw, _v);
          const err = Math.hypot(_v.x - L.foot.x, _v.z - L.foot.z);
          if ((err > p.idleStepDist && stepping === 0) || over) {
            startStep(L, p.idleStepTime);
            stepping++;
          }
        }
      }
      if (L.mode === 'step') {
        L.t += dt;
        // gait steps touch down exactly when the stride clock says this foot's stance begins
        // (if the clock jumps into stance early, the step keeps its last planned end instead of snapping)
        if (moving && !isStance) L.dur = L.t + (1 - legPhase) / Math.max(freq, 0.1);
        const remain = Math.max(0, L.dur - L.t);
        const tgt = stepTarget[id];
        if (moving) landingTarget(L, vel, yaw, remain, stanceT, tgt);
        else {
          neutralFoot(L.rig, groupPos, yaw, tgt);
          tgt.y = plantY(L, tgt.x, tgt.z);
        }
        L.ty = tgt.y;
        const s = Math.min(1, L.t / L.dur);
        const e = s * s * (3 - 2 * s);
        L.foot.lerpVectors(L.from, tgt, e);
        const h = moving ? stepH : stepH * 0.6;
        L.foot.y += h * Math.sin(Math.PI * Math.pow(s, 0.75)) + Math.max(0, tgt.y - L.from.y) * 0.3 * Math.sin(Math.PI * s);
        if (s >= 1) {
          L.foot.copy(tgt);
          L.mode = 'plant';
          L.contact = true;
          footfalls.push({ leg: id, pos: L.foot.clone(), strength: Math.min(1, speed / 7) });
        }
      }
    }
  }

  function LEG_PHASE(id: LegId) {
    let o = 0;
    for (const n of GAITS) o += weights[n] * PHASE[n][id];
    return o;
  }

  /** Air pose foot target (world): rise = hinds trail, fores tuck; fall = fores reach for the ground. */
  function airFoot(L: LegState, input: LocoInput, out: THREE.Vector3) {
    const fore = L.rig.fore;
    let y = 0.18;
    let z = 0;
    if (input.gliding || input.dashing) {
      y = 0.2;
      z = fore ? 0.28 : -0.32;
    } else if (input.vel.y > 1.5) {
      y = fore ? 0.3 : 0.12;
      z = fore ? -0.02 : -0.28;
    } else if (input.vel.y > -2) {
      y = fore ? 0.28 : 0.24;
      z = fore ? 0.04 : 0.08;
    } else {
      y = fore ? 0.1 : 0.2;
      z = fore ? 0.16 : 0.1;
    }
    out.set(L.rig.restFoot.x * 0.9, L.rig.restFoot.y + y, L.rig.restFoot.z + z);
    // body frame (follows pitch) so the tuck reads relative to the spine
    out.applyQuaternion(bodyQ).add(groupPos);
    return out;
  }

  const _plane = new THREE.Vector3();
  const _side = new THREE.Vector3();
  function solveLeg(L: LegState) {
    const chain = L.rig.chain;
    const js = L.joints;
    if (L.rig.scapula) {
      // shoulder blade swings the shoulder joint toward the paw (fore legs get most of their reach here)
      const sh = chain[0].getWorldPosition(_v2);
      const fwdW = _v3.set(0, 0, 1).applyQuaternion(bodyQ);
      const dz = _v.copy(L.foot).sub(sh).dot(fwdW);
      const ang = THREE.MathUtils.clamp((dz / L.rig.reach) * params.scapulaSwing, -params.maxScapula, params.maxScapula);
      rotateBoneAxis(L.rig.scapula, _side.set(1, 0, 0).applyQuaternion(bodyQ), -ang);
    }
    for (let i = 0; i < chain.length; i++) chain[i].getWorldPosition(js[i]);
    L.rig.foot.getWorldPosition(js[chain.length]);
    // soft reach: never fully lock the leg straight
    const base = js[0];
    const target = _v.copy(L.foot);
    const maxR = L.rig.reach * 0.985;
    const minR = L.rig.minReach;
    const d = target.distanceTo(base);
    if (d > maxR) target.sub(base).multiplyScalar(maxR / d).add(base);
    else if (d < minR) target.sub(base).multiplyScalar(minR / Math.max(d, 1e-4)).add(base);
    // leg plane: contains base→target, normal ≈ body side axis
    _side.set(1, 0, 0).applyQuaternion(bodyQ);
    _v2.copy(target).sub(base).normalize();
    _plane.copy(_side).addScaledVector(_v2, -_side.dot(_v2)).normalize();
    // seed: project the rest pose onto the plane
    for (let i = 1; i < js.length; i++) {
      _v3.copy(js[i]).sub(base);
      js[i].addScaledVector(_plane, -_v3.dot(_plane));
    }
    fabrik(js, L.rig.lengths, target, _plane, 10);
    applyChain(chain, L.rig.foot, js);
    // paw: keep its rest orientation relative to the heading, flex back while swinging
    const pawQ = _q2.copy(groupQ).multiply(footRestQ[L.rig.id]);
    if (L.mode === 'step') {
      const s = Math.min(1, L.t / L.dur);
      const curl = Math.sin(Math.PI * s) * (L.rig.fore ? 1.1 : 0.7);
      pawQ.premultiply(_q.setFromAxisAngle(_side, curl));
    } else if (L.mode === 'air') {
      pawQ.premultiply(_q.setFromAxisAngle(_side, L.rig.fore ? 0.9 : 0.5));
    }
    setBoneWorldQuat(L.rig.foot, pawQ);
  }

  function updateTail(dt: number, speed: number, ph: number, moving: boolean) {
    const p = params;
    // targets: tail joints where the body pose (without the spring) would put them, plus a gait counter-sway
    for (let i = 0; i < rig.tail.length; i++) rig.tail[i].getWorldPosition(tailTarget[i]);
    tailTipObj.getWorldPosition(tailTarget[tailN - 1]);
    const sideW = _side.set(1, 0, 0).applyQuaternion(bodyQ);
    const sway = moving ? p.tailSway * Math.sin(ph * (weights.gallop > 0.5 ? 1 : 2)) : 0;
    // tail lifts on the run, streams in the air
    const liftUp = Math.min(1, speed / 8) * 0.15;
    for (let i = 1; i < tailN; i++) {
      const k = i / (tailN - 1);
      tailTarget[i].addScaledVector(sideW, sway * k * 2.5);
      tailTarget[i].y += liftUp * k * k;
    }
    tailP[0].copy(tailTarget[0]);
    const drag = Math.exp(-p.tailDrag * dt);
    for (let i = 1; i < tailN; i++) {
      const k = i / (tailN - 1);
      const P = tailP[i];
      _v.copy(P).sub(tailPrev[i]).multiplyScalar(drag);
      tailPrev[i].copy(P);
      P.add(_v);
      P.y -= p.tailGravity * dt * dt;
      const stiff = THREE.MathUtils.lerp(p.tailStiffness, p.tailStiffnessTip, k);
      P.lerp(tailTarget[i], 1 - Math.exp(-stiff * dt));
    }
    for (let i = 1; i < tailN; i++) {
      _v.copy(tailP[i]).sub(tailP[i - 1]).normalize();
      tailP[i].copy(tailP[i - 1]).addScaledVector(_v, tailLen[i - 1]);
    }
    applyChain(rig.tail, tailTipObj, tailP);
  }

  return {
    rig,
    params,
    state,
    legs,
    weights,
    debug,
    footfalls,
    update,
    /** Re-plant all feet under the current pose (teleports, staged shots) */
    snap() {
      model.updateMatrixWorld(true);
      snapAll(model.getWorldPosition(new THREE.Vector3()), model.rotation.y);
    },
    snapshot() {
      const contacts: Record<string, boolean> = {};
      const feet: Record<string, number[]> = {};
      for (const id of LEG_IDS) {
        contacts[id] = legs[id].contact;
        feet[id] = legs[id].foot.toArray().map((v) => Number(v.toFixed(3)));
      }
      return {
        gait: state.gait,
        phase: Number(state.phase.toFixed(3)),
        freq: Number(state.freq.toFixed(2)),
        duty: Number(state.duty.toFixed(2)),
        speed: Number(state.speed.toFixed(2)),
        weights: { ...weights },
        pitch: Number(state.pitch.toFixed(3)),
        roll: Number(state.roll.toFixed(3)),
        bend: Number(state.bend.toFixed(3)),
        crouch: Number(state.crouch.toFixed(3)),
        yawRate: Number(state.yawRate.toFixed(2)),
        contacts,
        feet,
      };
    },
  };
}
