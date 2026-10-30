import * as THREE from 'three';

/** Per-frame traversal input. The camera owns no gameplay state beyond what it is told here. */
export type CameraFrame = {
  /** Fox root (feet) position */
  target: THREE.Vector3;
  vel: THREE.Vector3;
  grounded: boolean;
  gliding: boolean;
  dashing: boolean;
  /** Seconds since leaving the ground */
  airTime: number;
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

/** One authored camera pose on a cinematic path (world space). */
export type CameraPathKey = { t: number; pos: THREE.Vector3; look: THREE.Vector3; fov?: number };

export type CameraPath = {
  /** Poses in time order; interpolated as a C1 Hermite spline in time (zero velocity at the ends) */
  keys: CameraPathKey[];
  /** Blend from the traversal lens onto the path (s) */
  blendInS?: number;
  /** Blend from the last key back to traversal (s) */
  blendOutS?: number;
  /** Seconds before the player can take the camera back (move / jump / dash yields) */
  lockS?: number;
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
  /** Authored camera move layered over traversal (restore money shot). Replaces any active shot. */
  playPath: (path: CameraPath) => void;
  /** Path playback state for the harness: time, weight (0..1), yielded to input */
  pathState: () => { t: number; w: number; yielding: boolean } | null;
  /** Landing dip + FOV kick; impact 0..1 */
  land: (impact: number) => void;
  /** FOV punch (degrees) decaying over ~0.15 s */
  punch: (deg: number) => void;
  /** Trauma 0..1 → subtle rotational shake (squared falloff) */
  shake: (trauma: number) => void;
  /** Manual orbit (radians); suspends auto-recentre for `recenterDelay` */
  orbit: (dYaw: number, dPitch?: number) => void;
  snapBehind: (yaw: number) => void;
  /**
   * Steering yaw: the "behind" direction input is read against. The 3/4 framing bias is
   * applied on top when placing the lens, never here — otherwise holding forward while the
   * camera recentres feeds back into a spiral.
   */
  getYaw: () => number;
  resize: (w: number, h: number) => void;
  debug: { fox: [number, number]; landing: [number, number] | null; internals: () => string };
};

const TAU = Math.PI * 2;
const wrap = (a: number) => a - TAU * Math.floor((a + Math.PI) / TAU);

export function createFollowCamera(opts: {
  /** Walkable surface the boom must stay above; refY = height the camera is working at */
  surfaceAt?: (x: number, z: number, refY: number) => number;
  params?: Partial<CameraTunables>;
} = {}): FollowCamera {
  const params: CameraTunables = {
    distance: 3.8,
    height: 1.5,
    lookHeight: 0.62,
    airDistance: 4.8,
    glideDistance: 6.4,
    fov: 54,
    runFov: 3,
    glideFov: 7,
    lag: 0.14,
    lookAhead: 1.6,
    recenterRate: 1.25,
    recenterDelay: 1.2,
    sideBias: 0.55,
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
  /** Active shot: pose solved once at start (no per-frame re-solve pops); look tracks the subjects */
  let shot: (CameraShot & { t: number; end: number; yielding?: boolean }) | null = null;
  let shotStill = 1;
  let landW = 0;
  let liftNow = 0;
  let boomT = 1;
  let boomLift = 0;
  const landAt = new THREE.Vector3();
  const ndc = new THREE.Vector3();
  /** Where the fox / predicted landing sit on screen (NDC) — framing metrics for the harness */
  const debug = {
    fox: [0, 0] as [number, number],
    landing: null as [number, number] | null,
    internals: () =>
      `shot=${shotW.toFixed(2)} boomT=${boomT.toFixed(2)} lift=${boomLift.toFixed(2)} focusY=${focusY.toFixed(2)} lock=${groundLock.toFixed(2)} dist=${dist.toFixed(2)}`,
  };
  let shotW = 0;
  /** Active authored path (restore cinematic) */
  let path: (Required<CameraPath> & { t: number; end: number; yielding: boolean; outFrom: number; w: number }) | null = null;
  const pathPos = new THREE.Vector3();
  const pathLook = new THREE.Vector3();

  /** C1 Hermite through keys in time; finite-difference tangents, zero velocity at both ends. */
  function evalPath(keys: CameraPathKey[], t: number, field: 'pos' | 'look', out: THREE.Vector3) {
    const n = keys.length;
    if (t <= keys[0]!.t) return out.copy(keys[0]![field]);
    if (t >= keys[n - 1]!.t) return out.copy(keys[n - 1]![field]);
    let i = 0;
    while (i < n - 2 && t > keys[i + 1]!.t) i++;
    const a = keys[i]!;
    const b = keys[i + 1]!;
    const h = Math.max(1e-4, b.t - a.t);
    const u = (t - a.t) / h;
    const u2 = u * u;
    const u3 = u2 * u;
    const tan = (k: number, o: THREE.Vector3) => {
      if (k <= 0 || k >= n - 1) return o.set(0, 0, 0);
      const p = keys[k - 1]!;
      const q = keys[k + 1]!;
      return o.subVectors(q[field], p[field]).multiplyScalar(1 / Math.max(1e-4, q.t - p.t));
    };
    const ma = tan(i, _ta);
    const mb = tan(i + 1, _tb);
    return out
      .copy(a[field])
      .multiplyScalar(2 * u3 - 3 * u2 + 1)
      .addScaledVector(ma, (u3 - 2 * u2 + u) * h)
      .addScaledVector(b[field], -2 * u3 + 3 * u2)
      .addScaledVector(mb, (u3 - u2) * h);
  }
  const _ta = new THREE.Vector3();
  const _tb = new THREE.Vector3();
  function pathFov(keys: CameraPathKey[], t: number, fallback: number) {
    const n = keys.length;
    let i = 0;
    while (i < n - 2 && t > keys[i + 1]!.t) i++;
    const a = keys[i]!;
    const b = keys[Math.min(n - 1, i + 1)]!;
    const u = THREE.MathUtils.smoothstep(t, a.t, b.t);
    return THREE.MathUtils.lerp(a.fov ?? fallback, b.fov ?? fallback, u);
  }

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

  /**
   * Boom from focus → camera against walkable surfaces: lift over gentle slopes; when a slope
   * rises too steeply, pull in to just short of the first blocking sample. Returns the boom
   * fraction to keep and the lift to add (callers smooth these — no pops).
   */
  const boom = { t: 1, lift: 0 };
  function sweepBoom(focus: THREE.Vector3, cam: THREE.Vector3) {
    boom.t = 1;
    boom.lift = 0;
    if (!opts.surfaceAt) return boom;
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
    const maxLift = 3;
    if (lift < maxLift) {
      boom.lift = lift;
      return boom;
    }
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
    boom.t = Math.max(0.3, (firstBlocked - 1) / steps);
    boom.lift = maxLift;
    return boom;
  }
  function applyBoom(focus: THREE.Vector3, cam: THREE.Vector3, t: number, lift: number) {
    cam.lerpVectors(focus, cam, t);
    cam.y += lift * t;
  }

  /**
   * Hard framing guard: keep the fox (chest/feet) inside a safe angular window from the lens.
   * Ground-locked framing + a boom pulled in against a wall can otherwise lose the fox off the top.
   */
  function guardFraming(p: THREE.Vector3) {
    const halfV = THREE.MathUtils.degToRad(camera.fov * 0.5);
    const dh = Math.max(0.5, Math.hypot(look.x - rig.x, look.z - rig.z));
    const fh = Math.max(0.3, Math.hypot(p.x - rig.x, p.z - rig.z));
    const lookA = Math.atan2(look.y - rig.y, dh);
    const top = Math.atan2(p.y + 0.95 - rig.y, fh);
    const feet = Math.atan2(p.y - rig.y, fh);
    const up = halfV * 0.6;
    const down = halfV * 0.78;
    let a = lookA;
    if (top - a > up) a = top - up;
    if (a - feet > down) a = feet + down;
    if (a !== lookA) look.y = rig.y + Math.tan(a) * dh;
    // horizontal: fox within 70 % of the half-width
    const halfH = Math.atan(Math.tan(halfV) * camera.aspect) * 0.7;
    const yawLook = Math.atan2(look.x - rig.x, look.z - rig.z);
    const yawFox = Math.atan2(p.x - rig.x, p.z - rig.z);
    const off = wrap(yawFox - yawLook);
    if (Math.abs(off) > halfH) {
      const ny = yawLook + (off - Math.sign(off) * halfH);
      look.x = rig.x + Math.sin(ny) * dh;
      look.z = rig.z + Math.cos(ny) * dh;
    }
  }

  function frameShot(s: CameraShot) {
    shotBox.makeEmpty();
    for (const p of s.subjects) shotBox.expandByPoint(p);
    shotBox.getCenter(shotLook);
    const size = shotBox.getSize(tmp).length();
    const fov = s.fov ?? params.fov;
    const need = (size * 0.62 + 2.2) / Math.tan(THREE.MathUtils.degToRad(fov * 0.5));
    // Look from the traversal side, swung 25° and raised so both subjects separate on screen
    const a = yaw + params.sideBias + 0.45;
    const elev = THREE.MathUtils.degToRad(18 + (s.rise ?? 10));
    shotPos.set(
      shotLook.x + Math.sin(a) * Math.cos(elev) * need,
      shotLook.y + Math.sin(elev) * need,
      shotLook.z + Math.cos(a) * Math.cos(elev) * need,
    );
    const b = sweepBoom(shotLook, shotPos);
    applyBoom(shotLook, shotPos, b.t, b.lift);
  }

  return {
    camera,
    params,
    setPullBack(amount, durationS = 1.8) {
      pullGoal = Number.isFinite(amount) ? Math.max(0, amount) : 0;
      pullHold = Number.isFinite(durationS) ? Math.max(0, durationS) : 1.8;
    },
    playPath(p) {
      if (p.keys.length < 2) return;
      shot = null;
      const blendOutS = p.blendOutS ?? 1.2;
      path = {
        keys: p.keys,
        blendInS: p.blendInS ?? 0.8,
        blendOutS,
        lockS: p.lockS ?? 0,
        t: 0,
        end: p.keys[p.keys.length - 1]!.t + blendOutS,
        yielding: false,
        outFrom: 1,
        w: 0,
      };
    },
    pathState: () => (path ? { t: path.t, w: path.w, yielding: path.yielding } : null),
    playShot(s) {
      // a shot already on screen just extends; restarting would pop from its pose back to traversal
      if (shot) {
        if (!shot.yielding) shot.end = Math.max(shot.end, shot.t + s.holdS + (shot.blendS ?? 0.6));
        return;
      }
      shot = { ...s, t: 0, end: (s.blendS ?? 0.6) * 2 + s.holdS };
      shotStill = 1;
      frameShot(shot);
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
    debug,
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
        const behind = wrap(heading + Math.PI);
        const toward = -Math.cos(heading - yaw); // 1 = running away from camera
        // only nudge near-forward runs (≲35° off): diagonals and strafes stay straight and
        // predictable instead of chasing themselves into a spiral (W+D held 3 s turned 150°)
        const weight = THREE.MathUtils.smoothstep(toward, Math.cos(THREE.MathUtils.degToRad(35)), Math.cos(THREE.MathUtils.degToRad(8)));
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

      // ---- boom length: ground → (sustained) air → glide. Short chained hops keep the ground boom.
      const airW = f.grounded ? 0 : THREE.MathUtils.smoothstep(f.airTime, 0.35, 0.9);
      let goalDist = f.gliding
        ? params.glideDistance
        : THREE.MathUtils.lerp(params.distance, params.airDistance, airW);
      let dropLift = 0;
      // ---- look target: fox + look-ahead; airborne, slide toward the predicted landing so it stays in frame
      const hasLanding = !!f.landing && !f.grounded;
      if (hasLanding) landAt.copy(f.landing!);
      landW = THREE.MathUtils.damp(landW, hasLanding ? 1 : 0, hasLanding ? 6 : 4, dt);
      const baseY = f.grounded ? Math.max(focusY, p.y - 0.3) : focusY;
      aim.set(p.x + lead.x * (1 - landW * 0.6), baseY + params.lookHeight, p.z + lead.z * (1 - landW * 0.6));
      if (landW > 0.001) {
        const spread = Math.hypot(landAt.x - p.x, landAt.z - p.z);
        const drop = Math.max(0, p.y - landAt.y);
        const w = params.landingBias * Math.min(1, spread / 5) * landW;
        aim.x += (landAt.x - aim.x) * w;
        aim.z += (landAt.z - aim.z) * w;
        // drops: tilt toward the landing height and raise the lens so the ground you'll hit is visible
        aim.y += (Math.max(landAt.y, focusY - 10) - focusY) * Math.min(0.7, 0.15 + drop * 0.07) * landW;
        dropLift = Math.min(3.5, drop * 0.3) * landW;
        goalDist += Math.min(2, Math.max(0, spread - 4) * 0.2 + drop * 0.1) * landW;
      }
      if (pullHold > 0) pullHold -= dt;
      pullAmt = THREE.MathUtils.damp(pullAmt, pullHold > 0 ? pullGoal : 0, pullHold > 0 ? 2.5 : 1.2, dt);
      goalDist += pullAmt;
      dist = THREE.MathUtils.damp(dist, goalDist, goalDist > dist ? 2.2 : 1.4, dt);

      liftNow = THREE.MathUtils.damp(liftNow, dropLift, 3, dt);
      const pitchLift = params.height * (dist / params.distance) + pitchBias * dist + pullAmt * 0.3 + liftNow;
      const lensYaw = yaw + params.sideBias;
      desired.set(p.x + Math.sin(lensYaw) * dist + lead.x * 0.3, focusY + pitchLift, p.z + Math.cos(lensYaw) * dist + lead.z * 0.3);
      // boom collision: pull in fast, release slowly; lift eases (no pops at ledges/walls)
      boomFocus.set(p.x, focusY + params.lookHeight, p.z);
      const b = sweepBoom(boomFocus, desired);
      if (!initialized) {
        boomT = b.t;
        boomLift = b.lift;
      }
      boomT = THREE.MathUtils.damp(boomT, b.t, b.t < boomT ? 12 : 2.2, dt);
      boomLift = THREE.MathUtils.damp(boomLift, b.lift, b.lift > boomLift ? 10 : 2.5, dt);
      applyBoom(boomFocus, desired, boomT, boomLift);

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
      guardFraming(p);
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
      shotW = 0;
      if (shot) {
        shot.t += dt;
        const blend = shot.blendS ?? 0.6;
        if (shot.t >= shot.end) shot = null;
        else {
          // reward framing yields to play: any jump/dash, or the fox / its landing leaving the safe
          // frame, starts the blend-out from the *current* weight (works mid blend-in, no pop)
          ndc.set(p.x, p.y + 0.6, p.z).project(camera);
          let leaving = Math.abs(ndc.x) > 0.8 || Math.abs(ndc.y) > 0.8 || ndc.z > 1 || !f.grounded || f.dashing;
          if (!leaving && f.landing) {
            ndc.copy(f.landing).project(camera);
            leaving = Math.abs(ndc.x) > 0.85 || Math.abs(ndc.y) > 0.85 || ndc.z > 1;
          }
          if (leaving && !shot.yielding) {
            const x0 = Math.min(1, shot.t / blend, (shot.end - shot.t) / blend);
            shot.end = shot.t + blend * 0.7 * x0;
            shot.yielding = true;
          }
          tmp.copy(shot.subjects[1] ?? p).add(p).multiplyScalar(0.5);
          shotLook.x = THREE.MathUtils.damp(shotLook.x, tmp.x, 3, dt);
          shotLook.y = THREE.MathUtils.damp(shotLook.y, tmp.y, 3, dt);
          shotLook.z = THREE.MathUtils.damp(shotLook.z, tmp.z, 3, dt);
          const x = shot.yielding
            ? Math.max(0, (shot.end - shot.t) / (blend * 0.7))
            : Math.min(1, shot.t / blend, (shot.end - shot.t) / blend);
          // strongest while the fox stands still; a moving player gets a lighter intervention
          shotStill = THREE.MathUtils.damp(shotStill, speed > 1.5 ? 0.45 : 1, 3, dt);
          shotW = x * x * (3 - 2 * x) * shotStill;
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

      // ---- authored path (restore cinematic): ease on, play the keys, ease back to traversal.
      // After lockS any move / jump / dash hands the lens back from wherever the blend is (no pop).
      let pathW = 0;
      if (path) {
        path.t += dt;
        const tEnd = path.keys[path.keys.length - 1]!.t;
        if (!path.yielding && path.t > path.lockS && (speed > 1.5 || !f.grounded || f.dashing)) {
          path.yielding = true;
          path.outFrom = path.w;
          path.end = path.t + path.blendOutS * 0.7 * path.w;
        }
        if (path.t >= path.end) path = null;
        else {
          let x: number;
          if (path.yielding) x = path.outFrom * Math.max(0, (path.end - path.t) / (path.blendOutS * 0.7 * path.outFrom || 1));
          else x = Math.min(1, path.t / path.blendInS, path.t > tEnd ? 1 - (path.t - tEnd) / path.blendOutS : 1);
          x = THREE.MathUtils.clamp(x, 0, 1);
          path.w = x;
          pathW = x * x * (3 - 2 * x);
          const pt = Math.min(path.t, tEnd);
          evalPath(path.keys, pt, 'pos', pathPos);
          evalPath(path.keys, pt, 'look', pathLook);
          // long blends arc up and over (the hand-back from the valley pullback would cut through the shrine)
          const lift = Math.min(7, outPos.distanceTo(pathPos) * 0.3) * 4 * pathW * (1 - pathW);
          outPos.lerp(pathPos, pathW);
          outPos.y += lift;
          outLook.lerp(pathLook, pathW);
          outFov = THREE.MathUtils.lerp(outFov, pathFov(path.keys, pt, params.fov), pathW);
        }
      }
      shotW = Math.max(shotW, pathW);
      outPos.y += dip * (1 - shotW);
      // the rendered lens (shot blend + dip) gets the same floor guarantee as the rig
      if (opts.surfaceAt) {
        const floor = opts.surfaceAt(outPos.x, outPos.z, outPos.y + 1.5);
        if (Number.isFinite(floor) && outPos.y < floor + params.clearance * 0.8) outPos.y = floor + params.clearance * 0.8;
      }

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
      camera.updateMatrixWorld();
      ndc.set(p.x, p.y + 0.6, p.z).project(camera);
      debug.fox = [ndc.x, ndc.y];
      if (hasLanding) {
        ndc.copy(landAt).project(camera);
        debug.landing = [ndc.x, ndc.y];
      } else debug.landing = null;
    },
  };
}
