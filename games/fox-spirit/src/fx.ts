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


/** Soft circular ember trail — replaces square PointsMaterial sprites. */
export type EmberTrail = {
  update: (dt: number, fox: THREE.Vector3, intensity?: number) => void;
};

export function createEmberTrail(scene: THREE.Scene, count = 48): EmberTrail {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,240,1)');
  g.addColorStop(0.25, 'rgba(255,180,60,0.95)');
  g.addColorStop(0.55, 'rgba(255,80,20,0.45)');
  g.addColorStop(1, 'rgba(255,40,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;

  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const col = new THREE.Color();
  const palette = [0xff8a30, 0xffc857, 0xff5a1a, 0xffaa44, 0xffe08a];
  for (let i = 0; i < count; i++) {
    col.setHex(palette[i % palette.length]!);
    colors[i * 3] = col.r;
    colors[i * 3 + 1] = col.g;
    colors[i * 3 + 2] = col.b;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.22,
    map: tex,
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);

  let t = 0;
  const trail: THREE.Vector3[] = [];
  const phases = Float32Array.from({ length: count }, () => Math.random() * Math.PI * 2);

  return {
    update(dt, fox, intensity = 0.7) {
      t += dt;
      trail.push(fox.clone());
      if (trail.length > 28) trail.shift();
      mat.opacity = 0.35 + intensity * 0.3;
      mat.size = 0.14 + intensity * 0.12;
      const pos = geo.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < count; i++) {
        const ph = phases[i]!;
        const slot = trail[Math.max(0, trail.length - 1 - (i % Math.max(1, trail.length)))] ?? fox;
        const orbit = 0.12 + (i % 5) * 0.05;
        const ang = t * (1.6 + (i % 3) * 0.3) + ph;
        const wx = THREE.MathUtils.lerp(fox.x + Math.cos(ang) * orbit, slot.x, 0.6);
        const wz = THREE.MathUtils.lerp(fox.z + Math.sin(ang) * orbit, slot.z, 0.6);
        const wy = fox.y + 0.2 + Math.sin(t * 2.8 + ph) * 0.18 + (i % 6) * 0.03;
        pos.setXYZ(i, wx, wy, wz);
      }
      pos.needsUpdate = true;
    },
  };
}
