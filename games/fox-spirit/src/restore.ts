import * as THREE from 'three';
import type { ColorField, RestoreRegion } from '../../../src/render';
import type { AutumnParticles, EmberMotes } from '../../../src/render';
import type { CameraPathKey, FollowCamera } from './camera';
import type { GameAudio } from './audio';
import type { Hud } from './hud';

/**
 * Wellspring restore money shot (Sol 03:31 shot list). Times are seconds since the fox enters the trigger:
 *
 *   0–1.0   approach hold: fox walks up to the basin, low three-quarter lens, world still sepia
 *   1.0     ignition: basin flare, small spark core, leaf vortex — the colour front starts
 *   1.0–3.5 lens cranes out over the stairs while the front runs down stairs, bank and trees
 *   3.5–5.0 pull back along the valley; fox, dome and maple stay as anchors
 *   5.0–6.0 settle; then the lens eases back to traversal (any move / jump / dash takes it sooner)
 */
export const IGNITE_S = 1.0;
/** Player input is held until the ignition has landed */
const LOCK_S = IGNITE_S + 0.5;
/** Where the fox stops, relative to the basin centre: end of the summit path, at the plinth's south face */
const STAND: [number, number] = [-0.9, 3.75];
const FLOOD_S = 6;

/**
 * Front radius (m) at age since ignition. Hand-timed to this hill: basin core first, then down the
 * stair flight (~10–30 m) and bank/trees (~35–60 m) at a readable ~20 m/s, then racing out over the valley.
 */
const FRONT: Array<[number, number]> = [
  [0, 0],
  [0.25, 1.0],
  [0.6, 4.2],
  [1.0, 9.5],
  [1.6, 19],
  [2.2, 31],
  [2.8, 47],
  [3.5, 78],
  [4.3, 132],
  [5.2, 196],
  [6.0, 235],
];

/** Monotone cubic (Fritsch–Carlson) through [t, v] keys: no overshoot, so the front never recedes. */
function monotoneCurve(keys: Array<[number, number]>): (t: number) => number {
  const n = keys.length;
  const d: number[] = [];
  for (let i = 0; i < n - 1; i++) d.push((keys[i + 1]![1] - keys[i]![1]) / (keys[i + 1]![0] - keys[i]![0]));
  const m: number[] = [0];
  for (let i = 1; i < n - 1; i++) m.push(d[i - 1]! * d[i]! <= 0 ? 0 : (d[i - 1]! + d[i]!) / 2);
  m.push(d[n - 2]!);
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = m[i + 1] = 0;
      continue;
    }
    const a = m[i]! / d[i]!;
    const b = m[i + 1]! / d[i]!;
    const s = a * a + b * b;
    if (s > 9) {
      const k = 3 / Math.sqrt(s);
      m[i] = k * a * d[i]!;
      m[i + 1] = k * b * d[i]!;
    }
  }
  return (t) => {
    if (t <= keys[0]![0]) return keys[0]![1];
    if (t >= keys[n - 1]![0]) return keys[n - 1]![1];
    let i = 0;
    while (t > keys[i + 1]![0]) i++;
    const [t0, v0] = keys[i]!;
    const [t1, v1] = keys[i + 1]!;
    const h = t1 - t0;
    const u = (t - t0) / h;
    const u2 = u * u;
    const u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * v0 + (u3 - 2 * u2 + u) * h * m[i]! + (-2 * u3 + 3 * u2) * v1 + (u3 - u2) * h * m[i + 1]!;
  };
}
const frontRadius = monotoneCurve(FRONT);

/**
 * Camera keys relative to the shrine. `fox` keys live in the approach frame (x = fox's right while facing
 * the basin, y = up, z = back along the approach): the opening is solved for a profile-leaning three-quarter
 * fox at ~18 % frame height on the left third with the basin upper-right. `world` keys are authored for this
 * hill (offsets in world axes): crane out over the south-west stair face, then pull back over the valley
 * looking north-east so fox, dome and maple stay on the left while the front runs out through Amberwood.
 */
const SHOT: Array<{ t: number; frame: 'fox' | 'world'; pos: [number, number, number]; look: [number, number, number]; fov: number }> = [
  { t: 0, frame: 'fox', pos: [3.6, 1.12, 5.85], look: [-3.86, 1.41, 0.24], fov: 52 },
  { t: IGNITE_S, frame: 'fox', pos: [3.46, 1.15, 5.72], look: [-3.86, 1.41, 0.24], fov: 52 },
  { t: 1.6, frame: 'fox', pos: [3.7, 1.4, 6.3], look: [-3.4, 1.2, 0.8], fov: 53 },
  { t: 2.7, frame: 'world', pos: [-12, 2.5, 18], look: [2, -8, 6], fov: 54 },
  { t: 3.7, frame: 'world', pos: [-18, 5.5, 27], look: [4, -10, 10], fov: 54 },
  { t: 5.0, frame: 'world', pos: [-22, 8.5, 34], look: [7, -11, 13], fov: 52 },
  { t: 6.0, frame: 'world', pos: [-23, 8.8, 35.5], look: [7, -11, 13], fov: 52 },
];

export type RestorePhase = 'idle' | 'approach' | 'ignited';

export type RestoreCinematic = {
  readonly phase: RestorePhase;
  /** Seconds since the fox entered the trigger (−1 when idle) */
  readonly age: number;
  /** Seconds since ignition (−1 before) */
  readonly floodAge: number;
  /** Current colour-front radius (m) */
  readonly frontRadius: number;
  /** True while the sequence owns the fox (approach + ignition) */
  readonly inputLocked: boolean;
  /** Fox entered the Wellspring trigger: start the sequence (ignites at IGNITE_S) */
  begin: (fox: THREE.Vector3) => void;
  /** While locked: slow walk toward the stand point, as a wish vector (length ≤ 1) */
  walkWish: (fox: THREE.Vector3, out: THREE.Vector3) => THREE.Vector3;
  /** While locked and standing: yaw that faces the basin */
  readonly faceYaw: number;
  /** Undo the restore (harness: replay the event from a clean sepia world) */
  reset: () => void;
  update: (dt: number) => void;
};

export function createRestoreCinematic(opts: {
  colorField: ColorField;
  shrinePos: THREE.Vector3;
  radius?: number;
  autumnFX: AutumnParticles;
  motes?: EmberMotes;
  /** Spark burst origin (ember basin); defaults to just above shrinePos. */
  burstAt?: THREE.Vector3;
  /** Leaf vortex centre; defaults to shrinePos. */
  swirlAt?: THREE.Vector3;
  /** Walkable top at (x, z) — leaf release along the front */
  groundAt: (x: number, z: number) => number;
  /** Realm flood tween 0..1 + basin flare (emissive / light) */
  setFlood: (k: number, pulse: number) => void;
  /** Gameplay state flips here (restored flag, status, HUD text) */
  onIgnite: () => void;
  camera: FollowCamera;
  audio: GameAudio;
  hud: Hud;
}): RestoreCinematic {
  const radius = opts.radius ?? 235;
  const S = opts.shrinePos.clone();
  const burstAt = opts.burstAt ?? S.clone().setY(S.y + 1.2);
  let phase: RestorePhase = 'idle';
  let age = -1;
  let floodAge = -1;
  let region: RestoreRegion | null = null;
  let sparkAcc = 0;
  let leafAcc = 0;
  let rimAcc = 0;
  const approach = new THREE.Vector3(0, 0, 1);
  const right = new THREE.Vector3(1, 0, 0);
  const stand = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const camDir = new THREE.Vector3();
  /** The fox draws its warmth in before ignition (the aura carpet would pre-colour the summit) */
  const baseAura = opts.colorField.auraRadius;
  const DRAWN_AURA = 0.9;

  const keyPoint = (frame: 'fox' | 'world', v: [number, number, number]) =>
    frame === 'world'
      ? new THREE.Vector3(S.x + v[0], S.y + v[1], S.z + v[2])
      : new THREE.Vector3().copy(S).addScaledVector(right, v[0]).setY(S.y + v[1]).addScaledVector(approach, v[2]);

  function ignite() {
    phase = 'ignited';
    floodAge = 0;
    region = opts.colorField.restore(S, radius, FLOOD_S, {
      profile: (a) => frontRadius(a) / radius,
      // a readable 4 m light band (art direction §6.5), not a 40 m smear at full radius
      edgeMax: 3.2,
    });
    opts.onIgnite();
    opts.audio.play('shrine');
    opts.audio.swell(4.5);
    opts.hud.setPrompt('Autumn restored');
    opts.hud.hidePromptSoon(5);
    // small orange core + coherent sparks — the basin flare carries the light, not a white disc
    opts.motes?.burst(burstAt, { count: 70, speed: [1.6, 4.2], lift: 0.7, buoyancy: 0.7, drag: 1.5, life: [1.6, 3], flash: 0.9, size: [0.06, 0.13], heat: 0.55 });
    opts.autumnFX.swirl(opts.swirlAt ?? S, 120, 2.8);
    opts.camera.shake(0.12);
  }

  /** Release leaves (and a few warm sparks) where the front crosses ground the lens can see. */
  function frontRelease(dt: number, r: number, rim: number) {
    if (r < 2 || r > 90 || rim < 0.05) return;
    const cam = opts.camera.camera;
    cam.getWorldDirection(camDir);
    const bearing = Math.atan2(cam.position.z - S.z, cam.position.x - S.x);
    leafAcc += dt * 22 * rim;
    rimAcc += dt * 9 * rim;
    let guard = 0;
    while ((leafAcc >= 1 || rimAcc >= 1) && guard++ < 40) {
      // sample the arc facing the camera (Gaussian-ish spread ±80°)
      const th = bearing + (Math.random() + Math.random() + Math.random() - 1.5) * 1.1;
      const rr = r * (0.94 + Math.random() * 0.05);
      const x = S.x + Math.cos(th) * rr;
      const z = S.z + Math.sin(th) * rr;
      const gy = opts.groundAt(x, z);
      if (!Number.isFinite(gy) || gy < S.y - 80) continue;
      tmp.set(x, gy, z).sub(cam.position);
      const d = tmp.length();
      if (d > 60 || tmp.dot(camDir) < d * 0.45) continue;
      tmp.add(cam.position);
      if (leafAcc >= 1) {
        leafAcc -= 1;
        // leaves read at stair distance: scale with distance from the lens
        opts.autumnFX.kick(tmp, 0.8, THREE.MathUtils.clamp(d / 9, 1.4, 3.2));
      }
      if (rimAcc >= 1) {
        rimAcc -= 1;
        opts.motes?.burst(tmp.setY(tmp.y + 0.25), { count: 2, speed: [0.3, 0.9], lift: 0.9, life: [0.8, 1.6], buoyancy: 0.9, size: [0.05, 0.1], heat: 0.5 });
      }
    }
  }

  return {
    get phase() {
      return phase;
    },
    get age() {
      return age;
    },
    get floodAge() {
      return floodAge;
    },
    get frontRadius() {
      return region?.radius ?? 0;
    },
    get inputLocked() {
      return phase !== 'idle' && age < LOCK_S;
    },
    begin(fox) {
      if (phase !== 'idle') return;
      phase = 'approach';
      age = 0;
      // fixed stand + approach frame: the lens is authored once, wherever the fox crossed the trigger
      stand.set(S.x + STAND[0], fox.y, S.z + STAND[1]);
      approach.set(STAND[0], 0, STAND[1]).normalize();
      // fox's right while facing the basin
      right.set(approach.z, 0, -approach.x);
      const keys: CameraPathKey[] = SHOT.map((k) => ({ t: k.t, pos: keyPoint(k.frame, k.pos), look: keyPoint(k.frame, k.look), fov: k.fov }));
      opts.camera.playPath({ keys, blendInS: 0.7, blendOutS: 1.4, lockS: LOCK_S });
    },
    get faceYaw() {
      return Math.atan2(-approach.x, -approach.z);
    },
    walkWish(fox, out) {
      out.set(stand.x - fox.x, 0, stand.z - fox.z);
      const d = out.length();
      if (d < 0.12) return out.set(0, 0, 0);
      // easing walk (≈ 1–2.5 m/s): the fox steps up to the basin, it doesn't run into it
      return out.multiplyScalar(Math.min(0.3, d * 0.36) / d);
    },
    reset() {
      if (region) {
        const i = opts.colorField.restores.indexOf(region);
        if (i >= 0) opts.colorField.restores.splice(i, 1);
      }
      region = null;
      phase = 'idle';
      age = -1;
      floodAge = -1;
      sparkAcc = leafAcc = rimAcc = 0;
      opts.colorField.auraRadius = baseAura;
      opts.setFlood(0, 0);
    },
    update(dt) {
      if (phase === 'idle') return;
      age += dt;
      if (phase === 'approach') {
        // the basin wakes as the fox steps up: a slow warm breath before the flare
        opts.setFlood(0, 0.6 * THREE.MathUtils.smoothstep(age, 0.15, IGNITE_S));
        opts.colorField.auraRadius = THREE.MathUtils.lerp(baseAura, DRAWN_AURA, THREE.MathUtils.smoothstep(age, 0, 0.7));
        for (const t of opts.colorField.trail) t.life -= dt * 8;
        if (age >= IGNITE_S) ignite();
        return;
      }
      floodAge += dt;
      const a = floodAge;
      opts.colorField.auraRadius = THREE.MathUtils.lerp(DRAWN_AURA, baseAura, THREE.MathUtils.smoothstep(a, 0.6, 3));
      // basin flare synced to the burst: fast attack, ~1 s decay, then a slow ember breath that settles
      const flare = 4.2 * THREE.MathUtils.smoothstep(a, 0, 0.09) * Math.exp(-Math.max(0, a - 0.09) / 0.55);
      const breath = 0.5 * (0.5 + 0.5 * Math.sin(a * 2.6)) * (1 - THREE.MathUtils.smoothstep(a, 2, FLOOD_S));
      opts.setFlood(THREE.MathUtils.smoothstep(a, 0.15, 5), 0.6 * (1 - THREE.MathUtils.smoothstep(a, 0, 0.4)) + flare + breath);
      // thinning plume of rising sparks, normalised by dt
      if (a < 1.8) {
        sparkAcc += dt * 32 * (1 - a / 1.8);
        const n = Math.floor(sparkAcc);
        if (n > 0) {
          sparkAcc -= n;
          opts.motes?.burst(burstAt, { count: n, speed: [0.3, 1.1], lift: 0.8, life: [1.4, 2.6], buoyancy: 1, size: [0.05, 0.11], heat: 0.6 });
        }
      }
      const r = region?.radius ?? 0;
      const rim = region?.rim ?? 0;
      frontRelease(dt, r, rim);
      opts.autumnFX.setWavefront(S, r, 0.9 * rim);
    },
  };
}
