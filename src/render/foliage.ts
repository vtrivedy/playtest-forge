import * as THREE from 'three';

export type WindFoliage = {
  mesh: THREE.InstancedMesh;
  /** t = elapsed seconds; pushPos = fox world position for parting blades */
  update: (t: number, pushPos?: THREE.Vector3) => void;
  dispose: () => void;
};

/** Single curved, tapered grass blade (pivot at root). */
function buildBladeGeometry(height = 0.62, baseW = 0.055, tipW = 0.006, segs = 7): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= segs; i++) {
    const v = i / segs;
    // ease-out taper + slight S-curve lean in local X
    const w = THREE.MathUtils.lerp(baseW, tipW, v * v * (3 - 2 * v));
    const lean = Math.sin(v * Math.PI * 0.55) * 0.11 + v * v * 0.04;
    const y = v * height;
    positions.push(-w * 0.5 + lean, y, 0);
    positions.push(w * 0.5 + lean, y, 0);
    uvs.push(0, v, 1, v);
    if (i < segs) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Dense instanced grass: curved tapered blades, tip→root gradient,
 * wind sway, optional fox-push parting, ColorField via uSat (sepia→rust/gold).
 */
export function createWindGrass(
  scene: THREE.Scene,
  opts: {
    count?: number;
    radius?: number;
    center?: THREE.Vector3;
    color?: number;
    monoColor?: number;
    tipColor?: number;
    tipMono?: number;
    ySampler?: (x: number, z: number) => number;
  } = {},
): WindFoliage {
  const count = opts.count ?? 2200;
  const radius = opts.radius ?? 10;
  const center = opts.center ?? new THREE.Vector3();
  const ySampler = opts.ySampler ?? (() => 0);

  const geo = buildBladeGeometry(0.58, 0.05, 0.005, 7);

  const mat2 = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    depthWrite: true,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(opts.color ?? 0xb8732a) },
      uTip: { value: new THREE.Color(opts.tipColor ?? 0xe8b84a) },
      uMono: { value: new THREE.Color(opts.monoColor ?? 0x7a684e) },
      uTipMono: { value: new THREE.Color(opts.tipMono ?? 0xa89070) },
      uSat: { value: 0 },
      uPush: { value: new THREE.Vector3(9999, 0, 9999) },
      uPushR: { value: 1.15 },
      uPushStr: { value: 0.55 },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uPush;
      uniform float uPushR;
      uniform float uPushStr;
      varying float vH;
      varying vec2 vUv;
      varying vec3 vWorld;
      void main() {
        vH = uv.y;
        vUv = uv;
        vec3 p = position;
        float h2 = vH * vH;
        float phase = instanceMatrix[3].x * 0.85 + instanceMatrix[3].z * 0.62;
        float wind = sin(uTime * 1.65 + phase) * 0.14
                   + sin(uTime * 2.7 + phase * 1.7) * 0.06;
        p.x += wind * h2;
        p.z += cos(uTime * 1.25 + phase * 0.9) * 0.05 * h2;

        vec4 w = instanceMatrix * vec4(p, 1.0);

        vec2 d = w.xz - uPush.xz;
        float dist = length(d);
        float influence = (1.0 - smoothstep(0.0, uPushR, dist)) * uPushStr * h2;
        if (influence > 0.001 && dist > 0.001) {
          vec2 dir = d / max(dist, 1e-4);
          w.x += dir.x * influence;
          w.z += dir.y * influence;
          w.y -= influence * 0.35;
        }

        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor, uTip, uMono, uTipMono;
      uniform float uSat;
      varying float vH;
      varying vec2 vUv;
      varying vec3 vWorld;
      void main() {
        float sat = clamp(uSat, 0.0, 1.0);
        vec3 root = mix(uMono, uColor, sat);
        vec3 tip  = mix(uTipMono, uTip, sat);
        vec3 col = mix(root, tip, smoothstep(0.12, 0.92, vH));
        col *= 0.7 + vH * 0.5;
        float edge = 1.0 - abs(vUv.x - 0.5) * 1.35;
        col *= 0.82 + 0.18 * clamp(edge, 0.0, 1.0);
        float tipFade = 1.0 - smoothstep(0.9, 1.0, vH) * 0.4;
        if (tipFade < 0.15) discard;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });

  const mesh = new THREE.InstancedMesh(geo, mat2, count);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.frustumCulled = true;
  const dummy = new THREE.Object3D();
  let placed = 0;
  // denser near center, thinner at rim
  for (let i = 0; i < count * 4 && placed < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.pow(Math.random(), 0.65) * radius;
    const x = center.x + Math.cos(a) * r;
    const z = center.z + Math.sin(a) * r;
    const y = ySampler(x, z);
    if (y < -0.2) continue;
    dummy.position.set(x, y, z);
    dummy.rotation.y = Math.random() * Math.PI * 2;
    // slight lean variety
    dummy.rotation.x = (Math.random() - 0.5) * 0.15;
    dummy.rotation.z = (Math.random() - 0.5) * 0.12;
    const sx = 0.65 + Math.random() * 0.7;
    const sy = 0.75 + Math.random() * 0.85;
    dummy.scale.set(sx, sy, sx);
    dummy.updateMatrix();
    mesh.setMatrixAt(placed++, dummy.matrix);
  }
  mesh.count = placed;
  mesh.instanceMatrix.needsUpdate = true;
  scene.add(mesh);

  const pushTmp = new THREE.Vector3(9999, 0, 9999);

  return {
    mesh,
    update(t, pushPos) {
      mat2.uniforms.uTime.value = t;
      if (pushPos) {
        pushTmp.copy(pushPos);
        mat2.uniforms.uPush.value.copy(pushTmp);
      }
    },
    dispose() {
      geo.dispose();
      mat2.dispose();
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
