import * as THREE from 'three';

/**
 * Life returning where the fox paints: grass tufts and small autumn flowers spring out of
 * fresh paint (≈0.45 s scale-in with a little overshoot), then sway and stay. Two instanced
 * draws over ring buffers; only growing instances touch their matrices each frame.
 * Not colour-field patched — they only ever exist on painted ground.
 */
export type PaintSprouts = {
  group: THREE.Group;
  /** Sprout `count` plants scattered within `radius` of (x, z). `groundAt` returns surface y or NaN. */
  sprout(x: number, z: number, radius: number, count: number, groundAt: (x: number, z: number) => number, flowerChance?: number): void;
  update(dt: number): void;
  readonly planted: number;
};

type Kind = {
  mesh: THREE.InstancedMesh;
  max: number;
  next: number;
  pos: Float32Array;
  yaw: Float32Array;
  size: Float32Array;
  age: Float32Array;
  growing: Set<number>;
};

const GROW_S = 0.45;

function bladeTexture(flowers: boolean): THREE.CanvasTexture {
  const N = 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = N;
  const g = cv.getContext('2d')!;
  let seed = flowers ? 91 : 17;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  g.clearRect(0, 0, N, N);
  const blades = flowers ? 4 : 11;
  for (let i = 0; i < blades; i++) {
    const x0 = N * (0.2 + r() * 0.6);
    const h = N * (flowers ? 0.55 + r() * 0.3 : 0.45 + r() * 0.5);
    const lean = (r() - 0.5) * N * 0.35;
    const w = N * (flowers ? 0.025 : 0.035 + r() * 0.03);
    // value ramp: dark base → light tip; hue comes from the instance colour
    const grad = g.createLinearGradient(0, N, 0, N - h);
    grad.addColorStop(0, '#8c876a');
    grad.addColorStop(1, '#f2ecd2');
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(x0 - w, N);
    g.quadraticCurveTo(x0 - w * 0.5 + lean * 0.4, N - h * 0.55, x0 + lean, N - h);
    g.quadraticCurveTo(x0 + w * 0.5 + lean * 0.4, N - h * 0.55, x0 + w, N);
    g.closePath();
    g.fill();
    if (flowers) {
      // a soft five-petal head; near-white so the instance colour sets the hue
      const cx = x0 + lean;
      const cy = N - h;
      const pr = N * (0.06 + r() * 0.03);
      g.fillStyle = '#fff6e8';
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2 + r();
        g.beginPath();
        g.ellipse(cx + Math.cos(a) * pr * 0.7, cy + Math.sin(a) * pr * 0.7, pr * 0.62, pr * 0.42, a, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = '#c99a3a';
      g.beginPath();
      g.arc(cx, cy, pr * 0.32, 0, Math.PI * 2);
      g.fill();
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Three crossed cards, base at the origin, 1 m tall (scaled per instance). */
function tuftGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 3; i++) {
    const p = new THREE.PlaneGeometry(1, 1);
    p.translate(0, 0.5, 0);
    p.rotateY((i / 3) * Math.PI);
    parts.push(p);
  }
  const pos: number[] = [];
  const uv: number[] = [];
  const nor: number[] = [];
  for (const p of parts) {
    const ni = p.index!;
    const pa = p.getAttribute('position');
    const ua = p.getAttribute('uv');
    for (let k = 0; k < ni.count; k++) {
      const i = ni.getX(k);
      pos.push(pa.getX(i), pa.getY(i), pa.getZ(i));
      uv.push(ua.getX(i), ua.getY(i));
      // up-leaning normals: tufts light like the ground they stand on, not like flat cards
      nor.push(0, 1, 0);
    }
    p.dispose();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
}

export function createPaintSprouts(scene: THREE.Scene, opts: { maxGrass?: number; maxFlowers?: number } = {}): PaintSprouts {
  const group = new THREE.Group();
  group.name = 'paint-sprouts';
  scene.add(group);
  const time = { value: 0 };
  const geo = tuftGeometry();
  const make = (flowers: boolean, max: number): Kind => {
    const mat = new THREE.MeshLambertMaterial({
      map: bladeTexture(flowers),
      alphaTest: 0.5,
      side: THREE.DoubleSide,
    });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = time;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;')
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          {
            // tips sway in the valley breeze; the base stays planted
            vec3 o = instanceMatrix[3].xyz;
            float k = uv.y * uv.y;
            transformed.x += sin(uTime * 1.6 + o.x * 0.7 + o.z * 0.4) * 0.09 * k;
            transformed.z += sin(uTime * 1.2 + o.z * 0.8) * 0.05 * k;
          }`,
        );
      // backlit warmth so new growth glows a little in the low sun
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        totalEmissiveRadiance += diffuseColor.rgb * 0.3;`,
      );
    };
    const mesh = new THREE.InstancedMesh(geo, mat, max);
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.userData.forgeSkipAO = true;
    // allocate instance colours now so the first compile already uses them
    mesh.setColorAt(0, new THREE.Color(1, 1, 1));
    group.add(mesh);
    return { mesh, max, next: 0, pos: new Float32Array(max * 3), yaw: new Float32Array(max), size: new Float32Array(max), age: new Float32Array(max), growing: new Set() };
  };
  const grass = make(false, opts.maxGrass ?? 4000);
  const flowers = make(true, opts.maxFlowers ?? 1200);
  // olive-gold / sage / ochre grasses; cream, madder, gold and soft violet flowers
  const grassHues = [0x9c9a4a, 0xb3a24e, 0x7f8f4e, 0xc49a52, 0x8f9a5c].map((c) => new THREE.Color(c));
  const flowerHues = [0xf2dcb8, 0xd8644a, 0xe8b440, 0xb98ac0, 0xf0a070].map((c) => new THREE.Color(c));
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const col = new THREE.Color();
  let planted = 0;

  const write = (k: Kind, i: number) => {
    const t = Math.min(1, k.age[i]! / GROW_S);
    // ease-out-back: a little spring as it pops up
    const c = 1.7;
    const e = 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
    const h = k.size[i]! * Math.max(0.001, e);
    p.set(k.pos[i * 3]!, k.pos[i * 3 + 1]!, k.pos[i * 3 + 2]!);
    q.setFromAxisAngle(up, k.yaw[i]!);
    s.set(h * 0.9, h, h * 0.9);
    m.compose(p, q, s);
    k.mesh.setMatrixAt(i, m);
  };

  const plant = (k: Kind, x: number, y: number, z: number, size: number, hue: THREE.Color) => {
    const i = k.next;
    k.next = (k.next + 1) % k.max;
    k.pos.set([x, y - 0.02, z], i * 3);
    k.yaw[i] = Math.random() * Math.PI;
    k.size[i] = size;
    k.age[i] = 0;
    k.growing.add(i);
    col.copy(hue).multiplyScalar(0.85 + Math.random() * 0.3);
    k.mesh.setColorAt(i, col);
    k.mesh.instanceColor!.needsUpdate = true;
    k.mesh.count = Math.max(k.mesh.count, i + 1);
    write(k, i);
    k.mesh.instanceMatrix.needsUpdate = true;
    planted++;
  };

  return {
    group,
    get planted() {
      return planted;
    },
    sprout(x, z, radius, count, groundAt, flowerChance = 0.25) {
      for (let n = 0; n < count; n++) {
        const a = Math.random() * Math.PI * 2;
        const d = Math.sqrt(Math.random()) * radius;
        const px = x + Math.cos(a) * d;
        const pz = z + Math.sin(a) * d;
        const py = groundAt(px, pz);
        if (!Number.isFinite(py)) continue;
        if (Math.random() < flowerChance) plant(flowers, px, py, pz, 0.32 + Math.random() * 0.22, flowerHues[Math.floor(Math.random() * flowerHues.length)]!);
        else plant(grass, px, py, pz, 0.28 + Math.random() * 0.3, grassHues[Math.floor(Math.random() * grassHues.length)]!);
      }
    },
    update(dt) {
      time.value += dt;
      for (const k of [grass, flowers]) {
        if (!k.growing.size) continue;
        for (const i of k.growing) {
          k.age[i] = k.age[i]! + dt;
          write(k, i);
          if (k.age[i]! >= GROW_S) k.growing.delete(i);
        }
        k.mesh.instanceMatrix.needsUpdate = true;
      }
    },
  };
}
