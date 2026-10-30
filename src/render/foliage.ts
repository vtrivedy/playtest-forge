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
    monoColor?: number;
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
      uColor: { value: new THREE.Color(opts.color ?? 0xc9a04a) },
      uMono: { value: new THREE.Color(opts.monoColor ?? 0x8a7358) },
      uSat: { value: 0 },
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

/**
 * Autumn maple: gnarled trunk + clustered leaf-blob crown (rust / crimson / amber).
 * Matches keyart deciduous silhouette better than pine cones.
 */
export function createStylizedTree(colorLeaf = 0xc45a28, colorTrunk = 0x4a3020): THREE.Group {
  const g = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({
    color: colorTrunk,
    roughness: 0.92,
    flatShading: true,
  });
  // slightly bent trunk from stacked tapered cylinders
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.2, 1.15, 6), trunkMat);
  trunk.position.y = 0.55;
  trunk.rotation.z = 0.08;
  trunk.castShadow = true;
  g.add(trunk);
  const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.08, 0.7, 5), trunkMat);
  branch.position.set(0.25, 1.15, 0.05);
  branch.rotation.z = -0.85;
  branch.castShadow = true;
  g.add(branch);
  const branch2 = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.07, 0.55, 5), trunkMat);
  branch2.position.set(-0.2, 1.05, -0.1);
  branch2.rotation.z = 0.7;
  branch2.castShadow = true;
  g.add(branch2);

  const leafMat = new THREE.MeshStandardMaterial({
    color: colorLeaf,
    roughness: 0.72,
    flatShading: true,
  });
  // irregular crown clusters (maple-like mass, not pine tiers)
  const clusters: Array<[number, number, number, number]> = [
    [0.0, 1.55, 0.0, 0.85],
    [0.45, 1.7, 0.15, 0.55],
    [-0.4, 1.65, -0.1, 0.5],
    [0.15, 2.05, -0.25, 0.48],
    [-0.2, 2.0, 0.3, 0.42],
    [0.35, 1.35, -0.35, 0.4],
    [-0.35, 1.4, 0.25, 0.38],
  ];
  for (const [lx, ly, lz, lr] of clusters) {
    const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(lr, 0), leafMat);
    blob.position.set(lx, ly, lz);
    blob.scale.set(1.15, 0.85 + Math.random() * 0.2, 1.05);
    blob.rotation.set(Math.random(), Math.random(), Math.random());
    blob.castShadow = true;
    blob.receiveShadow = true;
    g.add(blob);
  }
  return g;
}

/** Alias kept for callers who want explicit maple naming. */
export const createMapleTree = createStylizedTree;
