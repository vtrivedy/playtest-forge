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

/** Smooth periodic wobble around the rim (no per-vertex jitter → no crystal spikes). */
function rimNoise(a: number, seed: number): number {
  return (
    0.08 * Math.sin(a * 3 + seed) + 0.05 * Math.sin(a * 7 + seed * 2.3) + 0.03 * Math.sin(a * 13 + seed * 0.7)
  );
}

/**
 * One floating-island variant (unit scale): lumpy top, craggy stepped underside with hanging
 * spires, small tree silhouettes, and — on ruin islands — a broken colonnade and an arch whose
 * proportions match the near ruins, so the far tier reads as the same shrine culture.
 */
function islandVariant(rand: () => number, kind: 'arch' | 'colonnade' | 'tower' | 'bare'): THREE.BufferGeometry {
  const ruins = kind !== 'bare';
  const parts: THREE.BufferGeometry[] = [];
  const seed = rand() * 10;

  // top plate
  const top = new THREE.CylinderGeometry(1, 0.96, 0.22, 28, 1);
  const tp = top.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < tp.count; i++) {
    const a = Math.atan2(tp.getZ(i), tp.getX(i));
    const k = 1 + rimNoise(a, seed);
    tp.setX(i, tp.getX(i) * k);
    tp.setZ(i, tp.getZ(i) * k);
    if (tp.getY(i) > 0) tp.setY(i, tp.getY(i) + 0.04 * Math.sin(a * 2 + seed));
  }
  parts.push(top.toNonIndexed());

  // craggy underside: stepped strata rings narrowing to lobed spires
  {
    const prof: Array<[number, number]> = [
      [0, 1],
      [0.12, 0.97],
      [0.2, 0.84],
      [0.42, 0.78],
      [0.52, 0.6],
      [0.9, 0.5],
      [1.05, 0.32],
      [1.6, 0.2],
      [2.3, 0.06],
      [2.7, 0],
    ];
    const depthK = 0.8 + rand() * 0.7;
    const seg = 26;
    const rings = prof.map(([d, r], j) =>
      Array.from({ length: seg }, (_, i) => {
        const a = (i / seg) * Math.PI * 2;
        const lobe = 0.5 + 0.5 * Math.sin(a * 2 + seed * 1.7);
        const jag = 1 + rimNoise(a * (1 + j * 0.15), seed + j) * 1.6;
        const dd = d * depthK * (0.65 + lobe * 0.7) * (j > 4 ? 0.8 + lobe * 0.4 : 1);
        return new THREE.Vector3(Math.cos(a) * r * jag, -0.11 - dd, Math.sin(a) * r * jag);
      }),
    );
    const pos: number[] = [];
    for (let j = 0; j < rings.length - 1; j++) {
      for (let i = 0; i < seg; i++) {
        const i2 = (i + 1) % seg;
        const a = rings[j]![i]!;
        const b = rings[j]![i2]!;
        const c = rings[j + 1]![i]!;
        const d = rings[j + 1]![i2]!;
        pos.push(a.x, a.y, a.z, c.x, c.y, c.z, b.x, b.y, b.z, b.x, b.y, b.z, c.x, c.y, c.z, d.x, d.y, d.z);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    parts.push(g);
    // a couple of extra hanging spires off-centre
    const extra = 1 + Math.floor(rand() * 2);
    for (let l = 0; l < extra; l++) {
      const h = 0.8 + rand() * 1.2;
      const cone = new THREE.ConeGeometry(0.22 + rand() * 0.15, h, 7, 2);
      cone.rotateX(Math.PI);
      const a = rand() * Math.PI * 2;
      cone.translate(Math.cos(a) * 0.55, -0.4 - h / 2, Math.sin(a) * 0.55);
      parts.push(cone.toNonIndexed());
    }
  }

  // small trees: leaning trunk + clumped crown; some bare
  const trees = 2 + Math.floor(rand() * 3);
  for (let i = 0; i < trees; i++) {
    const a = rand() * Math.PI * 2;
    const r = 0.2 + rand() * 0.6;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const h = 0.18 + rand() * 0.22;
    const lean = (rand() - 0.5) * 0.5;
    const trunk = new THREE.CylinderGeometry(0.012, 0.03, h, 5);
    trunk.translate(0, h / 2, 0);
    trunk.rotateZ(lean);
    trunk.translate(x, 0.1, z);
    parts.push(trunk.toNonIndexed());
    const tx = x - Math.sin(lean) * h;
    const ty = 0.1 + Math.cos(lean) * h;
    if (rand() < 0.7) {
      // broad, ragged crown: clumps spill sideways and down the trunk (no ball-on-a-stick)
      for (let k = 0; k < 8; k++) {
        const cr = 0.035 + rand() * 0.05;
        const clump = new THREE.IcosahedronGeometry(cr, 1);
        clump.scale(1.3, 0.7, 1.3);
        const drop = rand() * rand() * h * 0.55;
        clump.translate(tx + (rand() - 0.5) * 0.3 * (1 - drop / h), ty - drop + (rand() - 0.3) * 0.05, z + (rand() - 0.5) * 0.3 * (1 - drop / h));
        parts.push(clump.toNonIndexed());
      }
    } else {
      for (let k = 0; k < 3; k++) {
        const bl = 0.06 + rand() * 0.06;
        const br = new THREE.CylinderGeometry(0.003, 0.008, bl, 4);
        br.translate(0, bl / 2, 0);
        br.rotateZ((rand() - 0.5) * 1.6);
        br.translate(tx, ty - 0.02, z);
        parts.push(br.toNonIndexed());
      }
    }
  }
  // boulders
  for (let i = 0; i < 3; i++) {
    const a = rand() * Math.PI * 2;
    const r = rand() * 0.8;
    const s = 0.04 + rand() * 0.06;
    const nub = new THREE.IcosahedronGeometry(s, 0);
    nub.scale(1.3, 0.8, 1);
    nub.translate(Math.cos(a) * r, 0.1 + s * 0.5, Math.sin(a) * r);
    parts.push(nub.toNonIndexed());
  }

  if (ruins) {
    const pillar = (px: number, pz: number, ph: number, r0: number, snapped: boolean) => {
      const col = new THREE.CylinderGeometry(r0 * 0.9, r0, ph, 7);
      const cp = col.attributes.position as THREE.BufferAttribute;
      if (snapped) for (let k = 0; k < cp.count; k++) if (cp.getY(k) > 0) cp.setY(k, cp.getY(k) - (cp.getX(k) + r0) * 1.2);
      col.translate(px, 0.1 + ph / 2, pz);
      parts.push(col.toNonIndexed());
      parts.push(new THREE.BoxGeometry(r0 * 2.8, 0.035, r0 * 2.8).translate(px, 0.115, pz).toNonIndexed());
    };
    const archAt = (ax: number, az: number, span: number, legH: number, broken: boolean, yaw: number) => {
      const ring = new THREE.TorusGeometry(span + 0.045, 0.05, 5, 14, broken ? Math.PI * 0.6 : Math.PI);
      ring.scale(1, 1, 1.5);
      ring.translate(0, 0.1 + legH, 0);
      const l1 = new THREE.BoxGeometry(0.1, legH, 0.11).translate(-span - 0.045, 0.1 + legH / 2, 0);
      const l2h = broken ? legH * 0.5 : legH;
      const l2 = new THREE.BoxGeometry(0.1, l2h, 0.11).translate(span + 0.045, 0.1 + l2h / 2, 0);
      const g = mergeGeometries([ring.toNonIndexed(), l1.toNonIndexed(), l2.toNonIndexed()])!;
      g.rotateY(yaw);
      g.translate(ax, 0, az);
      parts.push(g);
    };
    const baseA = rand() * Math.PI * 2;
    if (kind === 'arch') {
      // one tall broken arch — a secondary vertical landmark that survives the haze
      archAt((rand() - 0.5) * 0.3, (rand() - 0.5) * 0.3, 0.2 + rand() * 0.06, 0.75 + rand() * 0.3, rand() < 0.6, rand() * Math.PI);
      pillar(Math.cos(baseA) * 0.55, Math.sin(baseA) * 0.55, 0.3 + rand() * 0.2, 0.035, true);
    } else if (kind === 'colonnade') {
      // clustered colonnade: tall survivors still carrying a lintel, stumps around them
      const n = 4 + Math.floor(rand() * 3);
      const ps: Array<[number, number, number]> = [];
      for (let i = 0; i < n; i++) {
        const a = baseA + i * 0.36;
        const tall = i === 1 || i === 2;
        const ph = tall ? 0.7 + rand() * 0.25 : 0.15 + rand() * 0.35;
        ps.push([Math.cos(a) * 0.48, Math.sin(a) * 0.48, ph]);
        pillar(ps[i]![0], ps[i]![1], ph, 0.04, !tall);
      }
      const [x1, z1, h1] = ps[1]!;
      const [x2, z2, h2] = ps[2]!;
      const lin = new THREE.BoxGeometry(Math.hypot(x2 - x1, z2 - z1) + 0.12, 0.06, 0.08);
      lin.rotateY(-Math.atan2(z2 - z1, x2 - x1));
      lin.translate((x1 + x2) / 2, 0.1 + Math.min(h1, h2) + 0.03, (z1 + z2) / 2);
      parts.push(lin.toNonIndexed());
    } else {
      // tower stub: a squat broken drum-tower with a small arch beside it
      const th = 0.6 + rand() * 0.35;
      const tower = new THREE.CylinderGeometry(0.13, 0.16, th, 9);
      const tp2 = tower.attributes.position as THREE.BufferAttribute;
      for (let k = 0; k < tp2.count; k++) if (tp2.getY(k) > 0) tp2.setY(k, tp2.getY(k) - Math.max(0, tp2.getX(k) + 0.05) * 1.4);
      tower.translate(Math.cos(baseA) * 0.35, 0.1 + th / 2, Math.sin(baseA) * 0.35);
      parts.push(tower.toNonIndexed());
      archAt(-Math.cos(baseA) * 0.3, -Math.sin(baseA) * 0.3, 0.15, 0.4, true, baseA);
    }
  }

  const merged = mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)).map((p) => {
    p.deleteAttribute('uv');
    p.deleteAttribute('normal');
    return p;
  }))!;
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
  const kinds = ['arch', 'colonnade', 'bare', 'tower', 'colonnade', 'arch'] as const;
  for (let i = 0; i < VARIANTS; i++) geos.push(islandVariant(rand, kinds[i]!));

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
