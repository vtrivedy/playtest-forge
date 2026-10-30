import * as THREE from 'three';

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

  respawn() { this.wisps = 3; this.left = 0; this.invulnerable = 1; }
  state() {
    return { wisps: this.wisps, hits: this.hits, frees: this.frees, invulnerable: Number(this.invulnerable.toFixed(3)), knockbackTravel: Number(this.travel.toFixed(3)) };
  }
}
