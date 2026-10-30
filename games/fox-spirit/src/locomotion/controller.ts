import * as THREE from 'three';

/** Ground momentum: separate accel/brake, speed-limited turn rate (a real turning radius), skid on reversals. */
export type MoveParams = {
  /** u/s² gaining speed */
  accel: number;
  /** u/s² shedding speed when input releases */
  decel: number;
  /** u/s² braking during a skid (input reversed at speed) */
  skidDecel: number;
  /** Max lateral (centripetal) accel u/s² — sets the turn radius r = v² / a */
  lateralAccel: number;
  /** Turn rate cap (rad/s) at standstill / very low speed */
  pivotRate: number;
  /** Reversal angle (rad) that triggers a skid instead of a carve */
  skidAngle: number;
  /** Minimum speed (u/s) for a skid */
  skidSpeed: number;
  /** Jump wind-up crouch before takeoff (s) — visual anticipation, keep tiny */
  jumpWindup: number;
};

export const DEFAULT_MOVE: MoveParams = {
  accel: 16,
  decel: 20,
  skidDecel: 34,
  lateralAccel: 34,
  pivotRate: 9,
  skidAngle: 2.2,
  skidSpeed: 4.5,
  jumpWindup: 0.06,
};

export type MoveState = {
  /** Heading of travel (rad, atan2(x, z)) */
  heading: number;
  speed: number;
  skidding: boolean;
};

export function createMoveState(heading: number): MoveState {
  return { heading, speed: 0, skidding: false };
}

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * Advance grounded movement. `wish` is the camera-relative input (length 0..1 = stick magnitude).
 * Writes horizontal velocity into `vel` and returns the yaw the body should face.
 */
export function groundMove(s: MoveState, p: MoveParams, wish: THREE.Vector3, maxSpeed: number, facing: number, vel: THREE.Vector3, dt: number): number {
  const mag = Math.min(1, Math.hypot(wish.x, wish.z));
  // resync with whatever the air / dash phase left us (standing still: wherever the body faces)
  const curSpeed = Math.hypot(vel.x, vel.z);
  s.heading = curSpeed > 0.05 ? Math.atan2(vel.x, vel.z) : facing;
  s.speed = curSpeed;
  if (mag > 0.01) {
    const want = Math.atan2(wish.x, wish.z);
    const diff = wrap(want - s.heading);
    if (!s.skidding && Math.abs(diff) > p.skidAngle && s.speed > p.skidSpeed) s.skidding = true;
    if (s.skidding) {
      s.speed = Math.max(0, s.speed - p.skidDecel * dt);
      if (s.speed < 1.2 || Math.abs(diff) < p.skidAngle * 0.6) s.skidding = false;
    } else {
      const rate = Math.min(p.pivotRate, p.lateralAccel / Math.max(s.speed, 0.1));
      s.heading = wrap(s.heading + THREE.MathUtils.clamp(diff, -rate * dt, rate * dt));
      // slow down while carving hard (you can't hold top speed through a hairpin)
      const target = maxSpeed * mag * (1 - 0.35 * Math.min(1, Math.abs(diff) / 1.6));
      if (s.speed < target) s.speed = Math.min(target, s.speed + p.accel * dt);
      else s.speed = Math.max(target, s.speed - p.decel * dt);
    }
  } else {
    s.skidding = false;
    s.speed = Math.max(0, s.speed - p.decel * dt);
  }
  vel.x = Math.sin(s.heading) * s.speed;
  vel.z = Math.cos(s.heading) * s.speed;
  return s.heading;
}
