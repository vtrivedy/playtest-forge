import * as THREE from 'three';

export type WindFoliage = {
  mesh: THREE.InstancedMesh;
  update: (t: number) => void;
  dispose: () => void;
};

/**
 * Instanced grass / reed blades with vertex wind.
 * Patch positions with a ColorField after creation if desired.
 */
export function createWindGrass(
  scene: THREE.Scene,
  opts: {
    count?: number;
    radius?: number;
    center?: THREE.Vector3;
    color?: number;
    ySampler?: (x: number, z: number) => number;
  } = {},
): WindFoliage {
  const count = opts.count ?? 900;
  const radius = opts.radius ?? 10;
  const center = opts.center ?? new THREE.Vector3();
  const ySampler = opts.ySampler ?? (() => 0);

  const geo = new THREE.PlaneGeometry(0.12, 0.55, 1, 3);
  geo.translate(0, 0.275, 0);

  const mat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(opts.color ?? 0x3a8f55) },
      uMono: { value: new THREE.Color(0x5a635c) },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      varying float vH;
      varying vec3 vWorld;
      void main() {
        vH = uv.y;
        vec3 p = position;
        float wind = sin(uTime * 1.8 + instanceMatrix[3].x * 0.7 + instanceMatrix[3].z * 0.55);
        p.x += wind * 0.12 * vH * vH;
        vec4 w = instanceMatrix * vec4(p, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor, uMono;
      uniform float uSat;
      varying float vH;
      varying vec3 vWorld;
      void main() {
        vec3 col = mix(uMono, uColor, clamp(uSat, 0.0, 1.0));
        col *= 0.55 + vH * 0.7;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  mat.uniforms.uSat = { value: 0 };

  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const dummy = new THREE.Object3D();
  let placed = 0;
  for (let i = 0; i < count * 3 && placed < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * radius;
    const x = center.x + Math.cos(a) * r;
    const z = center.z + Math.sin(a) * r;
    const y = ySampler(x, z);
    if (y < -0.2) continue;
    dummy.position.set(x, y, z);
    dummy.rotation.y = Math.random() * Math.PI;
    const s = 0.7 + Math.random() * 0.8;
    dummy.scale.set(s, s * (0.8 + Math.random() * 0.6), s);
    dummy.updateMatrix();
    mesh.setMatrixAt(placed++, dummy.matrix);
  }
  mesh.count = placed;
  mesh.instanceMatrix.needsUpdate = true;
  scene.add(mesh);

  return {
    mesh,
    update(t) {
      (mat.uniforms.uTime as { value: number }).value = t;
    },
    dispose() {
      geo.dispose();
      mat.dispose();
      scene.remove(mesh);
    },
  };
}

/** Simple low-poly tree (cone + trunk). Returns group; patch mats with ColorField. */
export function createStylizedTree(colorLeaf = 0x2f8f4e, colorTrunk = 0x5a4030): THREE.Group {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.18, 0.9, 6),
    new THREE.MeshStandardMaterial({ color: colorTrunk, roughness: 0.9 }),
  );
  trunk.position.y = 0.45;
  trunk.castShadow = true;
  g.add(trunk);
  const leafMat = new THREE.MeshStandardMaterial({ color: colorLeaf, roughness: 0.75 });
  const tiers = [
    { y: 1.1, r: 1.1, h: 1.4 },
    { y: 1.85, r: 0.85, h: 1.2 },
    { y: 2.45, r: 0.55, h: 1.0 },
  ];
  for (const t of tiers) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(t.r, t.h, 7), leafMat);
    cone.position.y = t.y;
    cone.castShadow = true;
    cone.receiveShadow = true;
    g.add(cone);
  }
  return g;
}
