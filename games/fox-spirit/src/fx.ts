import * as THREE from 'three';

/** Soft leaf kick-up burst when the fox runs through leaf carpet. */
export type LeafKick = {
  burst: (origin: THREE.Vector3, strength?: number) => void;
  update: (dt: number) => void;
};

export function createLeafKick(scene: THREE.Scene, max = 48): LeafKick {
  const geo = new THREE.PlaneGeometry(0.22, 0.28);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xc45a28,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, max);
  mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(mesh);

  type P = { alive: boolean; life: number; maxLife: number; pos: THREE.Vector3; vel: THREE.Vector3; spin: number };
  const parts: P[] = Array.from({ length: max }, () => ({
    alive: false,
    life: 0,
    maxLife: 1,
    pos: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    spin: 0,
  }));
  const dummy = new THREE.Object3D();
  const colors = [0xc45a28, 0xb8321f, 0xd4782a, 0xc9a04a];

  return {
    burst(origin, strength = 1) {
      let spawned = 0;
      for (const p of parts) {
        if (p.alive) continue;
        p.alive = true;
        p.maxLife = 0.55 + Math.random() * 0.45;
        p.life = p.maxLife;
        p.pos.copy(origin).add(new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.05, (Math.random() - 0.5) * 0.4));
        p.vel.set(
          (Math.random() - 0.5) * 2.2 * strength,
          (0.8 + Math.random() * 1.6) * strength,
          (Math.random() - 0.5) * 2.2 * strength,
        );
        p.spin = (Math.random() - 0.5) * 8;
        mat.color.setHex(colors[spawned % colors.length]!);
        spawned++;
        if (spawned >= 10) break;
      }
    },
    update(dt) {
      for (let i = 0; i < max; i++) {
        const p = parts[i]!;
        if (!p.alive) {
          dummy.scale.set(0, 0, 0);
          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
          continue;
        }
        p.life -= dt;
        if (p.life <= 0) {
          p.alive = false;
          dummy.scale.set(0, 0, 0);
          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
          continue;
        }
        p.vel.y -= 4.5 * dt;
        p.pos.addScaledVector(p.vel, dt);
        const t = p.life / p.maxLife;
        dummy.position.copy(p.pos);
        dummy.rotation.set(p.spin * (1 - t), p.spin * 1.3, p.spin * 0.7);
        dummy.scale.setScalar(0.7 + 0.5 * t);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}
