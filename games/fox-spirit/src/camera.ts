import * as THREE from 'three';

/** Per-frame traversal input. The camera owns no gameplay state beyond what it is told here. */
export type CameraFrame = {
  /** Fox root (feet) position */
  target: THREE.Vector3;
  vel: THREE.Vector3;
  grounded: boolean;
  gliding: boolean;
  dashing: boolean;
  /** Predicted landing point while airborne (null on the ground / when nothing below) */
  landing: THREE.Vector3 | null;
};

export type CameraShot = {
  /** World points that must stay in frame; the first is the hero */
  subjects: THREE.Vector3[];
  /** Seconds held at full weight (blend in/out on top) */
  holdS: number;
  blendS?: number;
  /** Extra elevation in degrees above the traversal pitch */
  rise?: number;
  fov?: number;
};

export type CameraTunables = {
  distance: number;
  height: number;
  lookHeight: number;
  airDistance: number;
  glideDistance: number;
  fov: number;
  runFov: number;
  glideFov: number;
  /** Seconds of position lag (critically damped) */
  lag: number;
  lookAhead: number;
  /** Max auto-recentre rate behind the heading (rad/s) at full run speed */
  recenterRate: number;
  recenterDelay: number;
  /** Framing yaw bias so the quadruped reads in 3/4 rather than as a rear blob */
  sideBias: number;
  /** Share of a jump's rise the camera follows (0 = locked to last ground) */
  jumpTrack: number;
  /** Weight of the predicted landing in the look target while airborne */
  landingBias: number;
  clearance: number;
  shake: number;
};

export type FollowCamera = {
  camera: THREE.PerspectiveCamera;
  params: CameraTunables;
  update: (dt: number, frame: CameraFrame) => void;
  /** Cinematic framing pulse (restore/seedwell). Holds `durationS`, then eases back. */
  setPullBack: (amount: number, durationS?: number) => void;
  /** Cinematic two-shot layered over traversal; traversal keeps updating underneath. */
  playShot: (shot: CameraShot) => void;
  /** Landing dip + FOV kick; impact 0..1 */
  land: (impact: number) => void;
  /** FOV punch (degrees) decaying over ~0.15 s */
  punch: (deg: number) => void;
  /** Trauma 0..1 → subtle rotational shake (squared falloff) */
  shake: (trauma: number) => void;
  /** Manual orbit (radians); suspends auto-recentre for `recenterDelay` */
  orbit: (dYaw: number, dPitch?: number) => void;
  snapBehind: (yaw: number) => void;
  /** Camera yaw (camera sits at target + (sin yaw, cos yaw) * distance) */
  getYaw: () => number;
  resize: (w: number, h: number) => void;
};

const TAU = Math.PI * 2;
const wrap = (a: number) => a - TAU * Math.floor((a + Math.PI) / TAU);

export function createFollowCamera(opts: {
  /** Walkable surface the boom must stay above; refY = height the camera is working at */
  surfaceAt?: (x: number, z: number, refY: number) => number;
  params?: Partial<CameraTunables>;
} = {}): FollowCamera {
  const params: CameraTunables = {
    distance: 4.6,
    height: 1.75,
    lookHeight: 0.62,
    airDistance: 5.4,
    glideDistance: 6.4,
    fov: 54,
    runFov: 3,
    glideFov: 7,
    lag: 0.14,
    lookAhead: 1.6,
    recenterRate: 1.25,
    recenterDelay: 1.2,
    sideBias: 0.22,
    jumpTrack: 0.45,
    landingBias: 0.42,
    clearance: 0.55,
    shake: 1,
    ...opts.params,
  };
  const camera = new THREE.PerspectiveCamera(params.fov, 1, 0.1, 900);

  let initialized = false;
  let yaw = 0;
  let pitchBias = 0;
  let manualT = 99;
  let groundLock = 0;
  let focusY = 0;
  let dist = params.distance;
  let fovNow = params.fov;
  let dip = 0;
  let dipVel = 0;
  let fovKick = 0;
  let trauma = 0;
  let shakeT = 0;
  let pullAmt = 0;
  let pullHold = 0;
  let pullGoal = 0;
  let shot: (CameraShot & { t: number }) | null = null;

  /** Traversal rig position (spring state). The rendered camera adds dip/shake/shot on top. */
  const rig = new THREE.Vector3();
  const lead = new THREE.Vector3();
  const desired = new THREE.Vector3();
  const aim = new THREE.Vector3();
  const look = new THREE.Vector3();
  const posVel = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const boomFocus = new THREE.Vector3();
  const shotPos = new THREE.Vector3();
  const shotLook = new THREE.Vector3();
  const shotBox = new THREE.Box3();

  // Exact critically damped spring, stable across frame rates.
  function spring(dt: number) {
    const omega = 2 / Math.max(0.02, params.lag);
    const decay = Math.exp(-omega * dt);
    for (const axis of ['x', 'y', 'z'] as const) {
      const offset = rig[axis] - desired[axis];
      const impulse = posVel[axis] + omega * offset;
      rig[axis] = desired[axis] + (offset + impulse * dt) * decay;
      posVel[axis] = (posVel[axis] - omega * impulse * dt) * decay;
    }
  }

  /** Boom from focus → camera: lift over gentle slopes, pull in when a slope rises too steeply. */
  function sweepBoom(focus: THREE.Vector3, cam: THREE.Vector3) {
    if (!opts.surfaceAt) return;
    const steps = 10;
    let lift = 0;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      tmp.lerpVectors(focus, cam, t);
      const s = opts.surfaceAt(tmp.x, tmp.z, Math.max(focus.y, tmp.y) + 1.5);
      if (!Number.isFinite(s)) continue;
      const need = s + params.clearance - tmp.y;
      // a raise at boom fraction t needs need/t at the camera end to clear it
      if (need > 0) lift = Math.max(lift, need / t);
    }
    if (lift <= 0) return;
    if (lift < 3) {
      cam.y += lift;
      return;
    }
    // too steep to lift over: lift what we can, pull in to just short of the first blocking sample
    const maxLift = 3;
    let firstBlocked = steps + 1;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      tmp.lerpVectors(focus, cam, t);
      const s = opts.surfaceAt(tmp.x, tmp.z, Math.max(focus.y, tmp.y) + 1.5);
      if (Number.isFinite(s) && s + params.clearance > tmp.y + maxLift * t) {
        firstBlocked = i;
        break;
      }
    }
    const t = Math.max(0.3, (firstBlocked - 1) / steps);
    cam.lerpVectors(focus, cam, t);
    cam.y += maxLift * t;
  }

  function frameShot(s: CameraShot) {
    shotBox.makeEmpty();
    for (const p of s.subjects) shotBox.expandByPoint(p);
    shotBox.getCenter(shotLook);
    const size = shotBox.getSize(tmp).length();
    const fov = s.fov ?? params.fov;
    const need = (size * 0.62 + 2.2) / Math.tan(THREE.MathUtils.degToRad(fov * 0.5));
    // Look from the traversal side, swung 25° and raised so both subjects separate on screen
    const a = yaw + 0.45;
    const elev = THREE.MathUtils.degToRad(18 + (s.rise ?? 10));
    shotPos.set(
      shotLook.x + Math.sin(a) * Math.cos(elev) * need,
      shotLook.y + Math.sin(elev) * need,
      shotLook.z + Math.cos(a) * Math.cos(elev) * need,
    );
    sweepBoom(shotLook, shotPos);
  }

  return {
    camera,
    params,
    setPullBack(amount, durationS = 1.8) {
      pullGoal = Number.isFinite(amount) ? Math.max(0, amount) : 0;
      pullHold = Number.isFinite(durationS) ? Math.max(0, durationS) : 1.8;
    },
    playShot(s) {
      shot = { ...s, t: 0 };
    },
    land(impact) {
      const k = THREE.MathUtils.clamp(impact, 0, 1);
      dipVel -= 2.4 * k;
      fovKick -= 2.2 * k;
    },
    punch(deg) {
      fovKick += deg;
    },
    shake(t) {
      trauma = Math.min(1, trauma + t);
    },
    orbit(dYaw, dPitch = 0) {
      yaw = wrap(yaw + dYaw);
      pitchBias = THREE.MathUtils.clamp(pitchBias + dPitch, -0.25, 0.6);
      manualT = 0;
    },
    snapBehind(facing) {
      yaw = wrap(facing + Math.PI);
      initialized = false;
    },
    getYaw: () => yaw,
    resize(w, h) {
      if (!(w > 0 && h > 0)) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    },
    update(dtIn, f) {
      const dt = Number.isFinite(dtIn) ? Math.max(0, Math.min(dtIn, 0.1)) : 0;
      const p = f.target;
      const speed = Math.hypot(f.vel.x, f.vel.z);
      manualT += dt;

      // ---- vertical framing: lock to last ground; follow a share of the jump; track drops and glides
      if (!initialized) {
        groundLock = p.y;
        focusY = p.y;
      }
      if (f.grounded) groundLock = p.y;
      else if (f.gliding || p.y < groundLock - 1.2) groundLock = Math.min(groundLock, p.y + 0.6);
      const goalY = f.grounded ? p.y : groundLock + Math.max(0, p.y - groundLock) * params.jumpTrack + Math.min(0, p.y - groundLock);
      focusY = THREE.MathUtils.damp(focusY, goalY, f.grounded ? 9 : 5, dt);

      // ---- auto-recentre behind the run direction (never while backpedalling toward the lens)
      if (speed > 1 && manualT > params.recenterDelay && !f.dashing) {
        const heading = Math.atan2(f.vel.x, f.vel.z);
        const behind = wrap(heading + Math.PI + params.sideBias);
        const toward = -Math.cos(heading - yaw); // 1 = running away from camera
        const weight = toward > -0.2 ? Math.max(0.15, toward) : 0;
        const rate = params.recenterRate * Math.min(1, speed / 7.5) * weight * (f.gliding ? 1.4 : 1);
        const d = wrap(behind - yaw);
        yaw = wrap(yaw + THREE.MathUtils.clamp(d, -rate * dt, rate * dt));
      }

      // ---- smoothed look-ahead along velocity
      const la = Math.min(1, speed / 7.5) * params.lookAhead;
      tmp.set(f.vel.x, 0, f.vel.z);
      if (speed > 0.01) tmp.multiplyScalar(la / speed);
      lead.x = THREE.MathUtils.damp(lead.x, tmp.x, 3, dt);
      lead.z = THREE.MathUtils.damp(lead.z, tmp.z, 3, dt);

      // ---- boom length: ground → air → glide, + landing spread, + cinematic pull pulse
      let goalDist = f.gliding ? params.glideDistance : f.grounded ? params.distance : params.airDistance;
      aim.set(p.x + lead.x, focusY + params.lookHeight, p.z + lead.z);
      if (f.landing && !f.grounded) {
        const spread = Math.hypot(f.landing.x - p.x, f.landing.z - p.z);
        const drop = Math.max(0, p.y - f.landing.y);
        const w = params.landingBias * Math.min(1, spread / 6);
        aim.x += (f.landing.x - p.x) * w;
        aim.z += (f.landing.z - p.z) * w;
        aim.y += (Math.min(f.landing.y, focusY) - focusY) * Math.min(0.5, drop * 0.08);
        goalDist += Math.min(2.5, spread * 0.22 + drop * 0.18);
      }
      if (pullHold > 0) pullHold -= dt;
      pullAmt = THREE.MathUtils.damp(pullAmt, pullHold > 0 ? pullGoal : 0, pullHold > 0 ? 2.5 : 1.2, dt);
      goalDist += pullAmt;
      dist = THREE.MathUtils.damp(dist, goalDist, goalDist > dist ? 2.2 : 1.4, dt);

      const pitchLift = params.height * (dist / params.distance) + pitchBias * dist + pullAmt * 0.3;
      desired.set(p.x + Math.sin(yaw) * dist + lead.x * 0.3, focusY + pitchLift, p.z + Math.cos(yaw) * dist + lead.z * 0.3);
      sweepBoom(boomFocus.set(p.x, focusY + params.lookHeight, p.z), desired);

      if (!initialized) {
        rig.copy(desired);
        posVel.set(0, 0, 0);
        look.copy(aim);
        dist = goalDist;
        initialized = true;
      } else {
        spring(dt);
        look.x = THREE.MathUtils.damp(look.x, aim.x, 7, dt);
        look.y = THREE.MathUtils.damp(look.y, aim.y, 7, dt);
        look.z = THREE.MathUtils.damp(look.z, aim.z, 7, dt);
      }
      // hard floor at the lens itself (springs can overshoot into slopes)
      if (opts.surfaceAt) {
        const floor = opts.surfaceAt(rig.x, rig.z, rig.y + 1.5);
        if (Number.isFinite(floor) && rig.y < floor + params.clearance) {
          rig.y = floor + params.clearance;
          posVel.y = Math.max(0, posVel.y);
        }
      }

      // ---- landing dip (spring back), FOV
      dipVel += (-dip * 160 - dipVel * 18) * dt;
      dip += dipVel * dt;
      fovKick = THREE.MathUtils.damp(fovKick, 0, 7, dt);
      const run = Math.min(1, speed / 9);
      const fovGoal = params.fov + params.runFov * run + (f.gliding ? params.glideFov : 0);
      fovNow = THREE.MathUtils.damp(fovNow, fovGoal, 2.5, dt);

      // ---- cinematic shot layered on top (traversal state above keeps integrating)
      let shotW = 0;
      if (shot) {
        shot.t += dt;
        const blend = shot.blendS ?? 0.6;
        const total = blend * 2 + shot.holdS;
        if (shot.t >= total) shot = null;
        else {
          shot.subjects[0]!.copy(p);
          frameShot(shot);
          const x = Math.min(1, shot.t / blend, (total - shot.t) / blend);
          shotW = x * x * (3 - 2 * x);
        }
      }
      const outPos = tmp.copy(rig);
      const outLook = new THREE.Vector3().copy(look);
      let outFov = fovNow + fovKick;
      if (shotW > 0 && shot) {
        outPos.lerp(shotPos, shotW);
        outLook.lerp(shotLook, shotW);
        outFov = THREE.MathUtils.lerp(outFov, shot.fov ?? params.fov, shotW);
      }
      outPos.y += dip * (1 - shotW);

      camera.position.copy(outPos);
      camera.lookAt(outLook);
      // ---- trauma shake: small rotational wobble, squared falloff
      trauma = Math.max(0, trauma - dt * 1.6);
      shakeT += dt;
      const s = trauma * trauma * params.shake;
      if (s > 0.0001) {
        camera.rotateX(s * 0.035 * Math.sin(shakeT * 61.7 + 1.3));
        camera.rotateY(s * 0.035 * Math.sin(shakeT * 53.1 + 4.1));
        camera.rotateZ(s * 0.02 * Math.sin(shakeT * 47.3));
      }
      if (Math.abs(camera.fov - outFov) > 0.01) {
        camera.fov = outFov;
        camera.updateProjectionMatrix();
      }
    },
  };
}
