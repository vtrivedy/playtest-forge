import * as THREE from 'three';

/** Extra sweep reach while a dash is live, so a fast pass cannot graze past the animal. */
export const DASH_REACH = 0.5;
/** After the dash timer runs out its momentum still carries the fox ~3 m; that skid keeps dash contact. */
export const DASH_CARRY = 0.2;
const DASH_CARRY_SPEED = 1.25;

/** Dash contact: the dash tick itself, or its post-dash skid while still faster than a run. */
export function dashContact(wasDashing: boolean, dashT: number, speed: number, cruise: number): boolean {
  return wasDashing || (dashT > -DASH_CARRY && speed > cruise * DASH_CARRY_SPEED);
}

/** Intersect the swept feet segment with the authored vertical animal hit cylinder. */
export function crossesShade(from: THREE.Vector3, to: THREE.Vector3, origin: THREE.Vector3, radius: number): boolean {
  const x = from.x - origin.x, z = from.z - origin.z, dx = to.x - from.x, dz = to.z - from.z;
  const a = dx * dx + dz * dz, c = x * x + z * z - radius * radius;
  let enter = 0, exit = 1;
  if (a < 1e-12) {
    if (c >= 0) return false;
  } else {
    const b = 2 * (x * dx + z * dz), discriminant = b * b - 4 * a * c;
    if (discriminant <= 0) return false;
    const root = Math.sqrt(discriminant);
    enter = Math.max(enter, (-b - root) / (2 * a));
    exit = Math.min(exit, (-b + root) / (2 * a));
  }
  const y = from.y - origin.y, dy = to.y - from.y;
  if (Math.abs(dy) < 1e-12) {
    if (y <= -.5 || y >= 3.2) return false;
  } else {
    const bottom = (-.5 - y) / dy, top = (3.2 - y) / dy;
    enter = Math.max(enter, Math.min(bottom, top));
    exit = Math.min(exit, Math.max(bottom, top));
  }
  return enter < exit;
}

/** One fox sweep against one Shade: a dash crossing frees it exactly once; plain contact hits. */
export function touchShade(shade: { freed: boolean }, from: THREE.Vector3, to: THREE.Vector3, origin: THREE.Vector3, hitRadius: number, dashing: boolean): 'freed' | 'hit' | null {
  if (shade.freed || !crossesShade(from, to, origin, hitRadius + (dashing ? DASH_REACH : 0))) return null;
  if (!dashing) return 'hit';
  shade.freed = true;
  return 'freed';
}

/** Encounter-owned displacement: wall checked by the caller; never changes movement tuning. */
export class ShadeContact {
  wisps = 3;
  hits = 0;
  frees = 0;
  invulnerable = 0;
  travel = 0;
  private left = 0;
  private duration = 0.3;
  private age = 0;
  private direction = new THREE.Vector3();

  hit(fox: THREE.Vector3, source: THREE.Vector3, distance: number, grace: number): boolean {
    if (this.invulnerable > 0) return false;
    this.wisps = Math.max(0, this.wisps - 1);
    this.hits++;
    this.invulnerable = grace;
    this.direction.copy(fox).sub(source).setY(0);
    if (this.direction.lengthSq() < 1e-6) this.direction.set(0, 0, 1);
    this.direction.normalize();
    this.left = Math.max(0, distance);
    this.travel = 0;
    this.age = 0;
    return true;
  }

  update(dt: number, move: (dx: number, dz: number) => number) {
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    if (this.left <= 0 || dt <= 0) return;
    const previous = Math.min(1, this.age / this.duration);
    this.age += dt;
    const next = Math.min(1, this.age / this.duration);
    const a = 1 - (1 - previous) ** 2;
    const b = 1 - (1 - next) ** 2;
    const distance = this.left * (b - a) / Math.max(1e-6, 1 - a);
    // Small substeps prevent tunnelling through narrow walls at low capture rates.
    const steps = Math.max(1, Math.ceil(distance / 0.12));
    for (let i = 0; i < steps; i++) this.travel += move(this.direction.x * distance / steps, this.direction.z * distance / steps);
    this.left = Math.max(0, this.left - distance);
    if (next >= 1) this.left = 0;
  }

  /** A dash overrides any knockback still in flight: nothing pushes the fox while it dashes. */
  cancelKnockback() { this.left = 0; }

  respawn() { this.wisps = 3; this.left = 0; this.invulnerable = 1; }
  state() {
    return { wisps: this.wisps, hits: this.hits, frees: this.frees, invulnerable: Number(this.invulnerable.toFixed(3)), knockbackTravel: Number(this.travel.toFixed(3)) };
  }
}
