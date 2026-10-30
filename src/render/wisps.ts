import * as THREE from 'three';

export type FoxWisps = {
  points: THREE.Points;
  update: (dt: number, fox: THREE.Vector3, colorAmount?: number) => void;
  dispose: () => void;
};

/** Ember-orange / gold wisps + spark trails (autumn fox). Always saturated. */
const EMBER = [0xff8a30, 0xffc857, 0xff5a1a, 0xffaa44, 0xffe08a];

export function createFoxWisps(scene: THREE.Scene, count = 56): FoxWisps {
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    phases[i] = Math.random() * Math.PI * 2;
    c.setHex(EMBER[i % EMBER.length]!);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.PointsMaterial({
    size: 0.16,
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

  return {
    points,
    update(dt, fox) {
      t += dt;
      trail.push(fox.clone());
      if (trail.length > 24) trail.shift();
      const pos = geo.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < count; i++) {
        const ph = phases[i]!;
        const orbit = 0.2 + (i % 5) * 0.07;
        const y = 0.25 + Math.sin(t * 2.5 + ph) * 0.2 + (i % 7) * 0.025;
        const ang = t * (1.4 + (i % 3) * 0.25) + ph;
        const slot = trail[Math.max(0, trail.length - 1 - (i % Math.max(1, trail.length)))] ?? fox;
        const ox = fox.x + Math.cos(ang) * orbit;
        const oz = fox.z + Math.sin(ang) * orbit;
        // prefer trailing embers behind fox
        const wx = THREE.MathUtils.lerp(ox, slot.x, 0.55);
        const wz = THREE.MathUtils.lerp(oz, slot.z, 0.55);
        const wy = fox.y + y + (i % 4) * 0.04;
        pos.setXYZ(i, wx, wy, wz);
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
