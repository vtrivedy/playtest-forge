import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export type DistantLandOptions = {
  /** Number of floating islands in the far ring */
  count: number;
  /** Ring radii (world units, keep < sky radius 400) */
  minRadius: number;
  maxRadius: number;
  /** Island vertical spread (world Y) */
  minY: number;
  maxY: number;
  /** Island scale range */
  minScale: number;
  maxScale: number;
  /** Silhouette (near) colour and haze (far) colour — haze should match sky mist/fog */
  silhouette: THREE.Color;
  haze: THREE.Color;
  sunDir: THREE.Vector3;
  sunColor: THREE.Color;
  /** Aerial perspective: distance at which islands are fully hazed */
  hazeFar: number;
  /** World Y under which undersides dissolve into the cloud-sea mist */
  mistFloor: number;
  /** Layered mist rings between island tiers */
  mistLayers: number;
  /** Deterministic layout seed */
  seed: number;
  /** Azimuth (radians, atan2(z, x)) the camera mostly faces — islands cluster here */
  focusAngle: number;
  /** Fraction of islands placed within ±focusSpread of focusAngle */
  focusBias: number;
  focusSpread: number;
};

export type DistantLand = {
  group: THREE.Group;
  update: (dt: number) => void;
  dispose: () => void;
};

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

/** One floating-island variant: lumpy top, jagged inverted spire, ruin silhouettes. */
function islandVariant(rand: () => number, ruins: boolean): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  // top plate
  const top = new THREE.CylinderGeometry(1, 0.9, 0.35, 14, 1);
  const tp = top.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < tp.count; i++) {
    const k = 0.82 + rand() * 0.3;
    tp.setX(i, tp.getX(i) * k);
    tp.setZ(i, tp.getZ(i) * k);
    if (tp.getY(i) > 0) tp.setY(i, tp.getY(i) + rand() * 0.18);
  }
  parts.push(top.toNonIndexed());

  // underside spire — inverted jagged cone, sometimes double-lobed
  const lobes = rand() > 0.55 ? 2 : 1;
  for (let l = 0; l < lobes; l++) {
    const h = 1.6 + rand() * 1.6;
    const cone = new THREE.ConeGeometry(0.9 - l * 0.3, h, 10, 3);
    cone.rotateX(Math.PI);
    const cp = cone.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < cp.count; i++) {
      const j = 0.75 + rand() * 0.5;
      cp.setX(i, cp.getX(i) * j);
      cp.setZ(i, cp.getZ(i) * j);
    }
    cone.translate(l * (rand() - 0.5) * 0.9, -h / 2 - 0.1, l * (rand() - 0.5) * 0.6);
    parts.push(cone.toNonIndexed());
  }

  // tree / rock nubs on top
  const nubs = 2 + Math.floor(rand() * 4);
  for (let i = 0; i < nubs; i++) {
    const a = rand() * Math.PI * 2;
    const r = rand() * 0.7;
    const s = 0.18 + rand() * 0.25;
    const nub = new THREE.IcosahedronGeometry(s, 0);
    nub.scale(1, 1.4 + rand(), 1);
    nub.translate(Math.cos(a) * r, 0.3 + s, Math.sin(a) * r);
    parts.push(nub.toNonIndexed());
  }

  if (ruins) {
    // broken colonnade + an arch — reads as the shrine culture in silhouette
    const pillars = 2 + Math.floor(rand() * 4);
    const baseA = rand() * Math.PI * 2;
    for (let i = 0; i < pillars; i++) {
      const a = baseA + i * 0.5;
      const ph = 0.5 + rand() * 1.0;
      const p = new THREE.BoxGeometry(0.07, ph, 0.07);
      p.translate(Math.cos(a) * 0.55, 0.25 + ph / 2, Math.sin(a) * 0.55);
      parts.push(p);
    }
    if (rand() > 0.35) {
      const arch = new THREE.TorusGeometry(0.32, 0.07, 4, 10, Math.PI);
      const legH = 0.7;
      arch.translate(0, 0.25 + legH, 0);
      const l1 = new THREE.BoxGeometry(0.13, legH, 0.13).translate(-0.32, 0.25 + legH / 2, 0);
      const l2 = new THREE.BoxGeometry(0.13, legH, 0.13).translate(0.32, 0.25 + legH / 2, 0);
      const g = mergeGeometries([arch.toNonIndexed(), l1.toNonIndexed(), l2.toNonIndexed()])!;
      g.rotateY(rand() * Math.PI);
      g.translate((rand() - 0.5) * 0.5, 0, (rand() - 0.5) * 0.5);
      parts.push(g);
    }
  }

  const merged = mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)))!;
  merged.computeVertexNormals();
  return merged;
}

/**
 * Far ring of silhouetted floating islands + ruins sunk into layered mist.
 * Unlit painted shader with its own aerial perspective (scene fog off) so
 * distance reads as value steps, not a cream wall.
 */
export function createDistantLand(scene: THREE.Scene, opts: Partial<DistantLandOptions> = {}): DistantLand {
  const o: DistantLandOptions = {
    count: 18,
    minRadius: 110,
    maxRadius: 320,
    minY: -30,
    maxY: 26,
    minScale: 9,
    maxScale: 26,
    silhouette: new THREE.Color(0x5a4a44),
    haze: new THREE.Color(0xdcc0a4),
    sunDir: new THREE.Vector3(-0.3, 0.18, -0.94),
    sunColor: new THREE.Color(0xffd9a0),
    hazeFar: 420,
    mistFloor: -18,
    mistLayers: 3,
    seed: 7,
    focusAngle: -Math.PI / 2,
    focusBias: 0.6,
    focusSpread: 0.85,
    ...opts,
  };
  const rand = rng(o.seed);
  const group = new THREE.Group();
  group.name = 'distantLand';

  const uniforms = {
    uSil: { value: o.silhouette },
    uHaze: { value: o.haze },
    uSunDir: { value: o.sunDir.clone().normalize() },
    uSunColor: { value: o.sunColor },
    uHazeFar: { value: o.hazeFar },
    uMistFloor: { value: o.mistFloor },
    uTime: { value: 0 },
  };

  const landMat = new THREE.ShaderMaterial({
    fog: false,
    uniforms,
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      varying vec3 vNormal;
      void main() {
        vec4 p = vec4(position, 1.0);
        vec3 n = normal;
        #ifdef USE_INSTANCING
          p = instanceMatrix * p;
          n = mat3(instanceMatrix) * n;
        #endif
        vec4 w = modelMatrix * p;
        vWorld = w.xyz;
        vNormal = normalize(mat3(modelMatrix) * n);
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uSil, uHaze, uSunDir, uSunColor;
      uniform float uHazeFar, uMistFloor;
      varying vec3 vWorld;
      varying vec3 vNormal;
      void main() {
        vec3 toCam = cameraPosition - vWorld;
        float dist = length(toCam);
        vec3 v = -toCam / dist;
        vec3 n = normalize(vNormal);
        // flat painted value: soft wrap light + rim toward the low sun
        float wrap = clamp(dot(n, normalize(uSunDir)) * 0.5 + 0.5, 0.0, 1.0);
        vec3 col = uSil * (0.75 + 0.45 * wrap);
        float rim = pow(1.0 - abs(dot(n, -v)), 3.0) * max(dot(v, normalize(uSunDir)), 0.0);
        col += uSunColor * rim * 0.35;
        // aerial perspective — never fully gone so the far tier still silhouettes
        float a = 1.0 - exp(-pow(dist / uHazeFar, 1.4) * 1.6);
        vec3 haze = uHaze + uSunColor * 0.2 * pow(max(dot(v, normalize(uSunDir)), 0.0), 4.0);
        col = mix(col, haze, clamp(a, 0.0, 0.72));
        // undersides sink into the cloud-sea mist
        float sink = smoothstep(uMistFloor + 14.0, uMistFloor - 6.0, vWorld.y);
        col = mix(col, haze, sink);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });

  // variants: half with ruins
  const VARIANTS = 6;
  const geos: THREE.BufferGeometry[] = [];
  for (let i = 0; i < VARIANTS; i++) geos.push(islandVariant(rand, i % 3 !== 2));

  const perVariant: THREE.Matrix4[][] = geos.map(() => []);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < o.count; i++) {
    // golden-angle ring so islands don't clump; tiers by radius
    const focused = i < Math.round(o.count * o.focusBias);
    const ang = focused
      ? o.focusAngle + (((i * 0.618034) % 1) * 2 - 1) * o.focusSpread + (rand() - 0.5) * 0.15
      : i * 2.39996 + rand() * 0.5;
    const t = (i % 3) / 2 + rand() * 0.2;
    const r = THREE.MathUtils.lerp(o.minRadius, o.maxRadius, Math.min(1, t));
    // farther islands sit higher + bigger so they still read over mist
    const y = THREE.MathUtils.lerp(o.minY, o.maxY, rand() * 0.7 + t * 0.3);
    const s = THREE.MathUtils.lerp(o.minScale, o.maxScale, rand() * 0.6 + t * 0.4);
    dummy.position.set(Math.cos(ang) * r, y, Math.sin(ang) * r);
    dummy.rotation.set(0, rand() * Math.PI * 2, 0);
    dummy.scale.set(s, s * (0.9 + rand() * 0.4), s);
    dummy.updateMatrix();
    perVariant[i % VARIANTS].push(dummy.matrix.clone());
  }

  const meshes: THREE.InstancedMesh[] = [];
  geos.forEach((g, vi) => {
    const mats = perVariant[vi];
    if (!mats.length) return;
    const im = new THREE.InstancedMesh(g, landMat, mats.length);
    mats.forEach((m, k) => im.setMatrixAt(k, m));
    im.instanceMatrix.needsUpdate = true;
    im.frustumCulled = false;
    im.renderOrder = -900;
    group.add(im);
    meshes.push(im);
  });

  // Layered mist rings: open cylinders with soft drifting fbm alpha between tiers.
  const mistMat = new THREE.ShaderMaterial({
    fog: false,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uHaze: uniforms.uHaze,
      uSunDir: uniforms.uSunDir,
      uSunColor: uniforms.uSunColor,
      uTime: uniforms.uTime,
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vWorld;
      void main() {
        vUv = uv;
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uHaze, uSunDir, uSunColor;
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vWorld;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float noise(vec2 p){
        vec2 i=floor(p), f=fract(p);
        float a=hash(i), b=hash(i+vec2(1.,0.)), c=hash(i+vec2(0.,1.)), d=hash(i+vec2(1.,1.));
        vec2 u=f*f*(3.-2.*f);
        return mix(a,b,u.x)+(c-a)*u.y*(1.-u.x)+(d-b)*u.x*u.y;
      }
      float fbm(vec2 p){ float v=0., a=0.5; for(int i=0;i<4;i++){ v+=a*noise(p); p*=2.1; a*=0.5; } return v; }
      void main() {
        // uv.x wraps around the ring: use integer tiling so the seam matches
        vec2 p = vec2(vUv.x * 24.0 + uTime * 0.05, vUv.y * 2.2);
        float n = fbm(p);
        float body = smoothstep(0.0, 0.35, vUv.y) * smoothstep(1.0, 0.45, vUv.y);
        float alpha = smoothstep(0.35, 0.8, n) * body * 0.4;
        vec3 v = normalize(vWorld - cameraPosition);
        float fwd = pow(max(dot(v, normalize(uSunDir)), 0.0), 3.0);
        vec3 col = uHaze * (0.96 + 0.08 * n) + uSunColor * fwd * 0.22;
        gl_FragColor = vec4(col, alpha);
      }`,
  });

  const mistGeos: THREE.BufferGeometry[] = [];
  for (let i = 0; i < o.mistLayers; i++) {
    const t = o.mistLayers === 1 ? 0.5 : i / (o.mistLayers - 1);
    const r = THREE.MathUtils.lerp(o.minRadius * 0.8, o.maxRadius * 1.05, t);
    const h = 26 + t * 22;
    const g = new THREE.CylinderGeometry(r, r, h, 64, 1, true);
    mistGeos.push(g);
    const m = new THREE.Mesh(g, mistMat);
    m.position.y = o.mistFloor + 4 + t * 10;
    m.rotation.y = i * 1.3;
    m.frustumCulled = false;
    m.renderOrder = -800 + i;
    group.add(m);
  }

  scene.add(group);

  return {
    group,
    update(dt) {
      uniforms.uTime.value += dt;
    },
    dispose() {
      geos.forEach((g) => g.dispose());
      mistGeos.forEach((g) => g.dispose());
      landMat.dispose();
      mistMat.dispose();
      meshes.forEach((m) => m.dispose());
      scene.remove(group);
    },
  };
}
