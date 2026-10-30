import * as THREE from 'three';

export type AutumnParticles = {
  leaves: THREE.InstancedMesh;
  embers: THREE.Points;
  /** Burst intensity at restore wavefront (0..1+) */
  setWavefront: (center: THREE.Vector3, radius: number, strength: number) => void;
  update: (dt: number) => void;
  dispose: () => void;
};

const LEAF_COLORS = [0xc45a28, 0xa83228, 0xd4782a, 0xc9a04a, 0xb84820, 0x8b3a1a];
const EMBER_COLORS = [0xff8a30, 0xffc857, 0xff5a1a, 0xffaa44];

function makeLeafTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, 64, 64);
  // simple maple-ish diamond with notch
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(32, 4);
  ctx.quadraticCurveTo(52, 22, 48, 40);
  ctx.quadraticCurveTo(40, 52, 32, 60);
  ctx.quadraticCurveTo(24, 52, 16, 40);
  ctx.quadraticCurveTo(12, 22, 32, 4);
  ctx.closePath();
  ctx.fill();
  // stem notch
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.moveTo(32, 58);
  ctx.lineTo(28, 64);
  ctx.lineTo(36, 64);
  ctx.closePath();
  ctx.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeEmberTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 32;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,200,120,0.85)');
  g.addColorStop(1, 'rgba(255,80,20,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

/**
 * Drifting maple leaf cards + soft warm embers. Boost near restore wavefront.
 */
export function createAutumnParticles(scene: THREE.Scene, leafCount = 160, emberCount = 90): AutumnParticles {
  const leafTex = makeLeafTexture();
  const leafGeo = new THREE.PlaneGeometry(0.28, 0.34);
  const leafMat = new THREE.MeshBasicMaterial({
    map: leafTex,
    transparent: true,
    alphaTest: 0.35,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, leafCount);
  leaves.frustumCulled = false;
  leaves.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  // per-instance color via InstancedBufferAttribute
  const leafCols = new Float32Array(leafCount * 3);
  const c = new THREE.Color();
  for (let i = 0; i < leafCount; i++) {
    c.setHex(LEAF_COLORS[i % LEAF_COLORS.length]!);
    leafCols[i * 3] = c.r;
    leafCols[i * 3 + 1] = c.g;
    leafCols[i * 3 + 2] = c.b;
  }
  leaves.instanceColor = new THREE.InstancedBufferAttribute(leafCols, 3);

  type LeafState = {
    x: number; y: number; z: number;
    vx: number; vy: number; vz: number;
    rx: number; ry: number; rz: number;
    spin: number; scale: number;
  };
  const states: LeafState[] = [];
  const dummy = new THREE.Object3D();
  for (let i = 0; i < leafCount; i++) {
    const s: LeafState = {
      x: (Math.random() - 0.5) * 28,
      y: Math.random() * 10 + 1,
      z: (Math.random() - 0.5) * 28,
      vx: (Math.random() - 0.5) * 0.35,
      vy: -0.25 - Math.random() * 0.4,
      vz: (Math.random() - 0.5) * 0.35,
      rx: Math.random() * Math.PI,
      ry: Math.random() * Math.PI,
      rz: Math.random() * Math.PI,
      spin: 0.8 + Math.random() * 2.2,
      scale: 0.7 + Math.random() * 0.9,
    };
    states.push(s);
    dummy.position.set(s.x, s.y, s.z);
    dummy.rotation.set(s.rx, s.ry, s.rz);
    dummy.scale.setScalar(s.scale);
    dummy.updateMatrix();
    leaves.setMatrixAt(i, dummy.matrix);
  }
  leaves.instanceMatrix.needsUpdate = true;
  scene.add(leaves);

  // embers
  const emberTex = makeEmberTexture();
  const eGeo = new THREE.BufferGeometry();
  const ePos = new Float32Array(emberCount * 3);
  const eCol = new Float32Array(emberCount * 3);
  const eVel = new Float32Array(emberCount * 3);
  for (let i = 0; i < emberCount; i++) {
    ePos[i * 3] = (Math.random() - 0.5) * 28;
    ePos[i * 3 + 1] = Math.random() * 10 + 1;
    ePos[i * 3 + 2] = (Math.random() - 0.5) * 28;
    eVel[i * 3] = (Math.random() - 0.5) * 0.3;
    eVel[i * 3 + 1] = 0.15 + Math.random() * 0.45;
    eVel[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
    c.setHex(EMBER_COLORS[i % EMBER_COLORS.length]!);
    eCol[i * 3] = c.r;
    eCol[i * 3 + 1] = c.g;
    eCol[i * 3 + 2] = c.b;
  }
  eGeo.setAttribute('position', new THREE.BufferAttribute(ePos, 3));
  eGeo.setAttribute('color', new THREE.BufferAttribute(eCol, 3));
  const eMat = new THREE.PointsMaterial({
    size: 0.18,
    map: emberTex,
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  const embers = new THREE.Points(eGeo, eMat);
  embers.frustumCulled = false;
  scene.add(embers);

  let wave = { x: 0, y: 0, z: 0, r: 0, s: 0 };

  return {
    leaves,
    embers,
    setWavefront(center, radius, strength) {
      wave = { x: center.x, y: center.y, z: center.z, r: radius, s: strength };
    },
    update(dt) {
      for (let i = 0; i < leafCount; i++) {
        const s = states[i]!;
        let { x, y, z } = s;
        x += s.vx * dt;
        y += s.vy * dt;
        z += s.vz * dt;
        // gentle flutter
        x += Math.sin(y * 1.7 + s.ry) * 0.15 * dt;
        z += Math.cos(y * 1.3 + s.rx) * 0.12 * dt;
        s.rx += s.spin * dt * 0.6;
        s.ry += s.spin * dt * 0.35;
        s.rz += s.spin * dt * 0.5;
        const dx = x - wave.x;
        const dz = z - wave.z;
        const d = Math.hypot(dx, dz);
        if (wave.s > 0.01 && Math.abs(d - wave.r) < 2.8) {
          const force = wave.s * (1 - Math.abs(d - wave.r) / 2.8);
          x += (-dz / (d + 0.1)) * force * dt * 2.8;
          z += (dx / (d + 0.1)) * force * dt * 2.8;
          y += force * 0.6 * dt;
        }
        if (y < -1.2 || Math.hypot(x, z) > 22) {
          x = wave.x + (Math.random() - 0.5) * Math.max(5, wave.r * 1.3);
          z = wave.z + (Math.random() - 0.5) * Math.max(5, wave.r * 1.3);
          y = 2.5 + Math.random() * 6;
        }
        s.x = x; s.y = y; s.z = z;
        dummy.position.set(x, y, z);
        dummy.rotation.set(s.rx, s.ry, s.rz);
        dummy.scale.setScalar(s.scale);
        dummy.updateMatrix();
        leaves.setMatrixAt(i, dummy.matrix);
      }
      leaves.instanceMatrix.needsUpdate = true;

      const pos = embers.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < emberCount; i++) {
        let x = pos.getX(i) + eVel[i * 3]! * dt;
        let y = pos.getY(i) + eVel[i * 3 + 1]! * dt;
        let z = pos.getZ(i) + eVel[i * 3 + 2]! * dt;
        const dx = x - wave.x;
        const dz = z - wave.z;
        const d = Math.hypot(dx, dz);
        if (wave.s > 0.01 && Math.abs(d - wave.r) < 2.5) {
          const force = wave.s * (1 - Math.abs(d - wave.r) / 2.5);
          x += (-dz / (d + 0.1)) * force * dt * 2.2;
          z += (dx / (d + 0.1)) * force * dt * 2.2;
          y += force * 1.6 * dt;
        }
        if (y > 12 || Math.hypot(x, z) > 22) {
          x = wave.x + (Math.random() - 0.5) * Math.max(4, wave.r);
          z = wave.z + (Math.random() - 0.5) * Math.max(4, wave.r);
          y = 0.5 + Math.random() * 2;
        }
        pos.setXYZ(i, x, y, z);
      }
      pos.needsUpdate = true;
      wave.s *= Math.pow(0.4, dt);
    },
    dispose() {
      leafGeo.dispose();
      leafMat.dispose();
      leafTex.dispose();
      scene.remove(leaves);
      eGeo.dispose();
      eMat.dispose();
      emberTex.dispose();
      scene.remove(embers);
    },
  };
}
