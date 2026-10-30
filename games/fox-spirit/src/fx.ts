import * as THREE from 'three';

/** Soft circular ember trail — replaces square PointsMaterial sprites. */
export type EmberTrail = {
  points: THREE.Points;
  update: (dt: number, fox: THREE.Vector3, intensity?: number) => void;
};

export function createEmberTrail(scene: THREE.Scene, count = 48): EmberTrail {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,232,184,1)');
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
  const palette = [0xe07a2c, 0xf0a848, 0xc85a1e, 0xe8923a, 0xf6c878]; // amber-rust, small pale-gold share
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

  // Embers shed off the plume tip: anchored behind + above the rump along the travel heading (the GLB tail
  // tip sits ~0.8 behind / ~0.7 above the fox origin at 1.25 height), never orbiting the hind legs.
  const TAIL_BACK = 0.82;
  const TAIL_UP = 0.72;
  let t = 0;
  const trail: THREE.Vector3[] = [];
  const heading = new THREE.Vector3(0, 0, 1);
  const last = new THREE.Vector3();
  let hasLast = false;
  const anchor = new THREE.Vector3();
  const phases = Float32Array.from({ length: count }, () => Math.random() * Math.PI * 2);
  const rates = Float32Array.from({ length: count }, () => 0.55 + Math.random() * 0.5);
  const base = Float32Array.from(colors);

  return {
    points,
    update(dt, fox, intensity = 0.7) {
      t += dt;
      // heading from motion (main.ts only hands us a position); keep the last one while standing still
      if (hasLast) {
        const dx = fox.x - last.x;
        const dz = fox.z - last.z;
        const d = Math.hypot(dx, dz);
        if (d > 1e-4 && d < 2) {
          const k = Math.min(1, dt * 10);
          heading.x += (dx / d - heading.x) * k;
          heading.z += (dz / d - heading.z) * k;
          heading.y = 0;
          if (heading.lengthSq() > 1e-6) heading.normalize();
        }
      }
      last.copy(fox);
      hasLast = true;
      anchor.set(fox.x - heading.x * TAIL_BACK, fox.y + TAIL_UP, fox.z - heading.z * TAIL_BACK);
      trail.push(anchor.clone());
      if (trail.length > 28) trail.shift();
      mat.opacity = 0.3 + intensity * 0.3;
      mat.size = 0.1 + intensity * 0.1;
      const pos = geo.getAttribute('position') as THREE.BufferAttribute;
      const colAttr = geo.getAttribute('color') as THREE.BufferAttribute;
      for (let i = 0; i < count; i++) {
        const ph = phases[i]!;
        // life 0..1: born at the plume tip, drifts back along the path and rises, fading out
        const life = (t * rates[i]! + ph / (Math.PI * 2)) % 1;
        const back = Math.min(trail.length - 1, Math.floor(life * trail.length));
        const slot = trail[trail.length - 1 - back] ?? anchor;
        const sway = Math.sin(t * 2.2 + ph * 3) * (0.05 + life * 0.12);
        const wx = slot.x - heading.x * life * 0.35 + heading.z * sway;
        const wz = slot.z - heading.z * life * 0.35 - heading.x * sway;
        const wy = slot.y + life * (0.35 + (i % 4) * 0.06) + Math.sin(t * 3.1 + ph) * 0.03;
        pos.setXYZ(i, wx, wy, wz);
        const fade = (1 - life) * Math.min(1, life * 6) * intensity;
        colAttr.setXYZ(i, base[i * 3]! * fade, base[i * 3 + 1]! * fade, base[i * 3 + 2]! * fade);
      }
      pos.needsUpdate = true;
      colAttr.needsUpdate = true;
    },
  };
}
