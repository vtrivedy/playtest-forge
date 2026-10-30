import * as THREE from 'three';

/** Tiny camera shake + particle burst helpers for game feel. */
export class Juice {
  private shake = 0;
  private readonly base = new THREE.Vector3();
  private readonly particles: THREE.Points;
  private readonly velocities: Float32Array;
  private life = 0;

  constructor(scene: THREE.Scene, private camera: THREE.PerspectiveCamera, count = 64) {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.velocities = new Float32Array(count * 3);
    this.particles = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        color: 0xffe08a,
        size: 0.12,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    scene.add(this.particles);
  }

  bump(amount = 0.25) {
    this.shake = Math.max(this.shake, amount);
  }

  burst(at: THREE.Vector3, color = 0xffe08a) {
    const pos = this.particles.geometry.getAttribute('position') as THREE.BufferAttribute;
    (this.particles.material as THREE.PointsMaterial).color.setHex(color);
    (this.particles.material as THREE.PointsMaterial).opacity = 1;
    this.life = 0.45;
    for (let i = 0; i < pos.count; i++) {
      pos.setXYZ(i, at.x, at.y, at.z);
      this.velocities[i * 3] = (Math.random() - 0.5) * 6;
      this.velocities[i * 3 + 1] = Math.random() * 5;
      this.velocities[i * 3 + 2] = (Math.random() - 0.5) * 6;
    }
    pos.needsUpdate = true;
  }

  update(dt: number) {
    this.base.copy(this.camera.position);
    if (this.shake > 0.001) {
      this.camera.position.x += (Math.random() - 0.5) * this.shake;
      this.camera.position.y += (Math.random() - 0.5) * this.shake * 0.6;
      this.shake *= Math.pow(0.05, dt);
    }
    if (this.life > 0) {
      this.life -= dt;
      const pos = this.particles.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        pos.setXYZ(
          i,
          pos.getX(i) + this.velocities[i * 3]! * dt,
          pos.getY(i) + this.velocities[i * 3 + 1]! * dt,
          pos.getZ(i) + this.velocities[i * 3 + 2]! * dt,
        );
        this.velocities[i * 3 + 1]! -= 9 * dt;
      }
      pos.needsUpdate = true;
      (this.particles.material as THREE.PointsMaterial).opacity = Math.max(0, this.life / 0.45);
    }
  }
}

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}
