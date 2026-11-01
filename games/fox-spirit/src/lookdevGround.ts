/** Painted earth and route framing for Pressed Ink → Living Cel. World shader hooks stay in the caller. */
import * as THREE from 'three';

interface GroundContext {
  groundH: (x: number, z: number) => number;
  pathDist: (x: number, z: number) => number;
  toon: (color: THREE.ColorRepresentation, opts?: { vertexColors?: boolean; hatchWeight?: number }) => THREE.MeshToonMaterial;
  mapleLeafGeometry: (size: number) => THREE.BufferGeometry;
  /** leaf-litter weight (0..1) for the umber drifts; defaults to a broad sine field */
  litter?: (x: number, z: number) => number;
}
const LITTER = [0x603a2d, 0x786044, 0x897354, 0x493d34];

/** Ground sheet over [cx ± w/2, cz ± d/2] (`seg` quads on the long side) */
export interface GroundArea {
  cx: number;
  cz: number;
  w: number;
  d: number;
  seg: number;
}

export function buildGround(scene: THREE.Scene, ctx: GroundContext, area: GroundArea = { cx: 0, cz: 0, w: 180, d: 180, seg: 150 }): THREE.Mesh {
  const { groundH, pathDist, toon } = ctx;
  const segW = Math.round(area.w >= area.d ? area.seg : (area.seg * area.w) / area.d);
  const segD = Math.round(area.d >= area.w ? area.seg : (area.seg * area.d) / area.w);
  const geo = new THREE.PlaneGeometry(area.w, area.d, segW, segD);
  geo.rotateX(-Math.PI / 2);
  geo.translate(area.cx, 0, area.cz);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const col = new Float32Array(pos.count * 3);
  // muted, lower-value ground so the fox coat is the hottest note; grouped into soft cel patches
  const sage = new THREE.Color(0x414739);
  const ochre = new THREE.Color(0x655d45);
  const umber = new THREE.Color(0x503c31);
  const dirt = new THREE.Color(0x92856a);
  const wornEarth = new THREE.Color(0x7f755c);
  const c = new THREE.Color();
  const pathColor = new THREE.Color();
  const band = (v: number, at: number) => THREE.MathUtils.smoothstep(v, at - 0.05, at + 0.05);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, groundH(x, z));
    const n = Math.sin(x * 0.23 + Math.cos(z * 0.19) * 2) * 0.5 + 0.5;
    c.copy(sage).lerp(ochre, band(n, 0.55) * 0.65);
    // leaf-litter drifts under the maples
    const litter = ctx.litter ? ctx.litter(x, z) : Math.max(0, Math.sin(x * 0.5 + 1.3) * Math.sin(z * 0.43 - 0.4));
    c.lerp(umber, band(litter, 0.3) * 0.75);
    const pd = pathDist(x, z);
    // Broad worn patches interrupt the bright ribbon without adding fine ground noise.
    const wear = Math.sin(z * 0.37 + Math.sin(x * 0.31) * 1.8) * 0.5 + 0.5;
    pathColor.copy(dirt).lerp(wornEarth, band(wear, 0.58) * 0.38);
    c.lerp(pathColor, 1 - THREE.MathUtils.smoothstep(pd + Math.sin(z * 2.3 + x) * 0.14, 0.65, 1.6));
    col.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, toon(0xffffff, { vertexColors: true, hatchWeight: 0.22 }));
  ground.receiveShadow = true;
  scene.add(ground);
  return ground;
}


/** Tuft scatter: N blades over [cx ± w/2, cz ± d/2], off the path and wherever `keep` refuses */
export interface ScatterArea {
  cx: number;
  cz: number;
  w: number;
  d: number;
  n: number;
  keep?: (x: number, z: number) => boolean;
}

export function buildGrass(scene: THREE.Scene, rand: () => number, ctx: GroundContext, area: ScatterArea = { cx: 0, cz: -2, w: 44, d: 44, n: 900 }): void {
  const { groundH, pathDist, toon } = ctx;
  // short, thin, muted tufts: texture for the ground, never a foreground focal point
  const blade = new THREE.ConeGeometry(0.035, 0.42, 3);
  blade.translate(0, 0.2, 0);
  const mat = toon(0xffffff);
  const N = area.n;
  const mesh = new THREE.InstancedMesh(blade, mat, N);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const col = new THREE.Color();
  let k = 0;
  while (k < N) {
    const x = (rand() - 0.5) * area.w + area.cx;
    const z = (rand() - 0.5) * area.d + area.cz;
    if (pathDist(x, z) < 1.4 || (area.keep && !area.keep(x, z))) continue;
    // tufts: 3-5 blades around a point
    const cnt = 3 + Math.floor(rand() * 3);
    for (let j = 0; j < cnt && k < N; j++, k++) {
      p.set(x + (rand() - 0.5) * 0.3, 0, z + (rand() - 0.5) * 0.3);
      p.y = groundH(p.x, p.z) - 0.03;
      e.set((rand() - 0.5) * 0.7, rand() * 6, (rand() - 0.5) * 0.7);
      q.setFromEuler(e);
      const h = 0.5 + rand() * 0.7;
      s.set(1, h, 1);
      m.compose(p, q, s);
      mesh.setMatrixAt(k, m);
      col.setHex(rand() < 0.6 ? 0x716d51 : rand() < 0.5 ? 0x505b42 : 0x786047);
      mesh.setColorAt(k, col);
    }
  }
  mesh.receiveShadow = true;
  scene.add(mesh);
}


/** Leaf litter: 3 of 5 leaves pile in drifts ([x, z, r]; random around the centre if omitted), the rest scatter within `r` */
export interface LitterArea {
  cx: number;
  cz: number;
  r: number;
  n: number;
  drifts?: ReadonlyArray<readonly [number, number, number]>;
  keep?: (x: number, z: number) => boolean;
}

export function buildLeaves(scene: THREE.Scene, rand: () => number, ctx: GroundContext, area: LitterArea = { cx: 0, cz: -3, r: 22, n: 1400 }): void {
  const { groundH, pathDist, toon, mapleLeafGeometry } = ctx;
  // drifts: most leaves pile in clusters (under canopies, along the path shoulders), the rest scattered
  const N = area.n;
  const mesh = new THREE.InstancedMesh(mapleLeafGeometry(0.095), toon(0xffffff), N);
  const m = new THREE.Matrix4();
  const col = new THREE.Color();
  const drifts =
    area.drifts ??
    Array.from({ length: 22 }, () => {
      const a = rand() * Math.PI * 2;
      const r = 2 + Math.sqrt(rand()) * 18;
      return [area.cx + Math.cos(a) * r, area.cz - 1 + Math.sin(a) * r, 0.8 + rand() * 1.6] as const;
    });
  for (let i = 0; i < N; i++) {
    let x: number;
    let z: number;
    if (i % 5 < 3) {
      const [dx, dz, dr] = drifts[i % drifts.length]!;
      const a = rand() * Math.PI * 2;
      const r = Math.pow(rand(), 0.7) * dr;
      x = dx + Math.cos(a) * r;
      z = dz + Math.sin(a) * r;
    } else {
      const a = rand() * Math.PI * 2;
      const r = Math.sqrt(rand()) * area.r;
      x = area.cx + Math.cos(a) * r;
      z = area.cz + Math.sin(a) * r;
    }
    // Keep the path quiet; gather stray leaves along its ragged shoulder.
    if (pathDist(x, z) < 1.15) {
      x += x < area.cx ? -1.5 : 1.5;
    }
    if (area.keep && !area.keep(x, z)) {
      mesh.setMatrixAt(i, m.makeScale(0, 0, 0));
      mesh.setColorAt(i, col);
      continue;
    }
    m.makeRotationY(rand() * 6).setPosition(x, groundH(x, z) + 0.02 + rand() * 0.01, z);
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, col.setHex(LITTER[i % LITTER.length]!));
  }
  mesh.receiveShadow = true;
  scene.add(mesh);
}


export function buildContactShadow(): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.MultiplyBlending,
    premultipliedAlpha: true,
    uniforms: { uInk: { value: new THREE.Color(0x30353c) } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 uInk; varying vec2 vUv;
      void main() {
        vec2 q = (vUv - 0.5) * vec2(2.0, 2.0);
        float a = (1.0 - smoothstep(0.15, 1.0, length(q))) * 0.65;
        gl_FragColor = vec4(mix(vec3(1.0), uInk, a), 1.0);
      }`,
  });
  const disc = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.8), mat);
  disc.rotation.x = -Math.PI / 2;
  disc.renderOrder = 1;
  return disc;
}

