import * as THREE from 'three';

export type FoxWisps = {
  points: THREE.Points;
  /** Call each frame; `fox` is the spirit world position. */
  update: (dt: number, fox: THREE.Vector3, colorAmount?: number) => void;
  dispose: () => void;
};

const WISP_COLORS = [0xff4fd8, 0x4ff0ff, 0xffd56a, 0xa78bfa, 0xff8f6a];

/** Glowing multicolor wisp particles that orbit / trail the fox. Always saturated. */
export function createFoxWisps(scene: THREE.Scene, count = 48): FoxWisps {
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    phases[i] = Math.random() * Math.PI * 2;
    c.setHex(WISP_COLORS[i % WISP_COLORS.length]!);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.PointsMaterial({
    size: 0.18,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);

  let t = 0;
  const trail: THREE.Vector3[] = [];

  return {
    points,
    update(dt, fox) {
      t += dt;
      trail.push(fox.clone());
      if (trail.length > 20) trail.shift();
      const pos = geo.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < count; i++) {
        const ph = phases[i]!;
        const orbit = 0.25 + (i % 5) * 0.08;
        const y = 0.35 + Math.sin(t * 2.2 + ph) * 0.25 + (i % 7) * 0.03;
        const ang = t * (1.2 + (i % 3) * 0.2) + ph;
        // mix orbit around fox with delayed trail slots
        const slot = trail[Math.max(0, trail.length - 1 - (i % trail.length))] ?? fox;
        const ox = fox.x + Math.cos(ang) * orbit;
        const oz = fox.z + Math.sin(ang) * orbit;
        const wx = THREE.MathUtils.lerp(ox, slot.x, 0.35);
        const wz = THREE.MathUtils.lerp(oz, slot.z, 0.35);
        pos.setXYZ(i, wx, fox.y + y, wz);
      }
      pos.needsUpdate = true;
    },
    dispose() {
      geo.dispose();
      mat.dispose();
      scene.remove(points);
    },
  };
}
