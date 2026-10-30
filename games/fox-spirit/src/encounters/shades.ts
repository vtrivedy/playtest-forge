import * as THREE from 'three';
import type GUI from 'lil-gui';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Shade (docs/design/world-1.md §3.8): an ink silhouette of an animal caught mid-stride when the Keeping
 * struck. It drifts along an authored closed patrol and drains temporary colour within `drainRadius`:
 * aura/trail and spent dash strokes (≤ 1) read as 0 there, and unsupplied reactors in it skip their hold.
 * A dash through it frees it: it comes apart into leaves. Contact without a dash knocks the fox back.
 */
export type ShadeSpot = { id: string; patrol: Array<[number, number, number]>; speed?: number };

export type ShadeTunables = { drainRadius: number; speed: number; hitRadius: number; knockback: number; bob: number; releaseTime: number; invulnerability: number; debug: boolean };
export const SHADE_DEFAULTS: ShadeTunables = { drainRadius: 3, speed: 2.2, hitRadius: 1.1, knockback: 3, bob: 0.3, releaseTime: 1.15, invulnerability: 1, debug: false };

type ShadeActor = {
  id: string;
  curve: THREE.CatmullRomCurve3;
  length: number;
  u: number;
  speed?: number;
  pos: THREE.Vector3;
  heading: number;
  group: THREE.Group;
  mat: THREE.ShaderMaterial;
  pool: THREE.Mesh;
  /** 1 = present, falls to 0 while freed */
  presence: number;
  freed: boolean;
  leaves: THREE.InstancedMesh;
  leafSeeds: Array<{ p: THREE.Vector3; velocity: THREE.Vector3; phase: number }>;
  releaseAge: number;
  debug: THREE.Group;
};

/** Bake the licensed library animal in one authored gallop pose. No live skeleton or hero code. */
async function animalGeometry(): Promise<THREE.BufferGeometry> {
  const gltf = await new GLTFLoader().loadAsync('/assets/library/animals/quaternius_deer.glb');
  const mixer = new THREE.AnimationMixer(gltf.scene);
  const clip = gltf.animations.find(c => c.name === 'Gallop')!;
  mixer.clipAction(clip).play();
  mixer.setTime(clip.duration * 0.32);
  // A caught memory, with the head sunk slightly into the shoulders rather than hunting.
  const neck = gltf.scene.getObjectByName('Neck3');
  if (neck) neck.rotation.x += 0.22;
  gltf.scene.updateMatrixWorld(true);
  const parts: THREE.BufferGeometry[] = [];
  const v = new THREE.Vector3();
  gltf.scene.traverse(o => {
    const mesh = o as THREE.SkinnedMesh;
    if (!mesh.isMesh) return;
    if (mesh.isSkinnedMesh) mesh.skeleton.update();
    const source = mesh.geometry;
    const g = new THREE.BufferGeometry();
    const positions = new Float32Array(source.attributes.position!.count * 3);
    for (let i = 0; i < source.attributes.position!.count; i++) {
      mesh.getVertexPosition(i, v).applyMatrix4(mesh.matrixWorld);
      v.toArray(positions, i * 3);
    }
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    if (source.index) g.setIndex(source.index.clone());
    parts.push(g.index ? g.toNonIndexed() : g);
  });
  const g = mergeVertices(mergeGeometries(parts)!, 0.0001);
  g.computeBoundingBox();
  const box = g.boundingBox!;
  const size = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());
  g.translate(-centre.x, -box.min.y, -centre.z);
  // An elongated ink memory: a tall narrow animal, still recognisably mid-stride.
  const scale = 2.5 / size.y;
  g.scale(scale * 0.72, scale, scale * 0.72);
  g.computeVertexNormals();
  g.computeBoundingBox();
  mixer.stopAllAction();
  mixer.uncacheRoot(gltf.scene);
  return g;
}

const NOISE = /* glsl */ `
  float h3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float n3(vec3 x) {
    vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z);
  }`;

function inkMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPresence: { value: 1 }, uSeed: { value: 0 } },
    vertexShader: /* glsl */ `
      uniform float uTime, uPresence, uSeed;
      varying vec3 vN; varying vec3 vV; varying vec3 vP; varying float vY;
      ${NOISE}
      void main() {
        vec3 p = position;
        // wavering: the ink never quite holds still; it boils more toward the feet
        float w = (1.0 - smoothstep(0.0, 1.6, p.y)) * 0.15 + 0.1;
        p += normal * (n3(p * 3.0 + vec3(0.0, uTime * 1.3, uSeed)) - 0.5) * w * 2.0;
        p.x += sin(uTime * 1.7 + p.y * 2.0 + uSeed) * 0.075;
        // freeing: the body lifts and spreads as it comes apart
        p += normal * (1.0 - uPresence) * 0.35;
        vP = p; vY = p.y;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uPresence, uSeed;
      varying vec3 vN; varying vec3 vV; varying vec3 vP; varying float vY;
      ${NOISE}
      void main() {
        float n = n3(vP * 4.0 + vec3(0.0, -uTime * 0.9, uSeed));
        // legs dissolve into smoke near the ground; freeing eats the whole body
        float cut = mix(0.0, 0.62, 1.0 - smoothstep(0.05, 0.7, vY)) + (1.0 - uPresence) * 1.1;
        if (n < cut) discard;
        float rim = pow(1.0 - abs(dot(vN, vV)), 2.2);
        // pressed ink: near-black umber core, a thin paper-pale rim like dried wash at the edge
        vec3 core = vec3(0.012, 0.008, 0.005);
        vec3 edge = vec3(0.13, 0.09, 0.055);
        vec3 col = mix(core, edge, rim * 0.32 + smoothstep(cut, cut + 0.06, n) * 0.0);
        col = mix(col, edge * 0.8, 1.0 - smoothstep(cut, cut + 0.05, n));
        col = mix(col, vec3(0.16, 0.078, 0.033), n * 0.12);
        gl_FragColor = vec4(col, 0.98 - rim * 0.18);
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
    fog: false,
    transparent: true,
    depthWrite: false,
  });
}

function poolMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPresence: { value: 1 }, uRadius: { value: 3 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uPresence;
      varying vec2 vUv;
      ${NOISE}
      void main() {
        vec2 q = vUv - 0.5;
        float r = length(q) * 2.0;
        float n = n3(vec3(q * 6.0, uTime * 0.25));
        float a = (1.0 - smoothstep(0.55 + n * 0.25, 1.0, r)) * 0.55 * uPresence;
        // faint ring at the drain edge so the reach reads in play
        a += smoothstep(0.86, 0.93, r) * (1.0 - smoothstep(0.93, 1.0, r)) * 0.25 * uPresence;
        gl_FragColor = vec4(vec3(0.05, 0.04, 0.035), a);
      }`,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
}

export type ShadeSystem = {
  readonly tun: ShadeTunables;
  /** True if p is inside an active Shade's drain */
  drains: (p: THREE.Vector3) => boolean;
  /** Advance patrols; returns contact/free events for the fox */
  update: (dt: number, t: number, fox: THREE.Vector3, dashing: boolean) => Array<{ type: 'freed' | 'hit'; id: string; pos: THREE.Vector3 }>;
  resetSweep: () => void;
  state: () => Array<{ id: string; pos: number[]; freed: boolean }>;
};

export async function createShades(scene: THREE.Scene, spots: ShadeSpot[], groundAt: (x: number, z: number, y: number) => number, gui?: GUI): Promise<ShadeSystem> {
  const tun = { ...SHADE_DEFAULTS };
  const geo = await animalGeometry();
  const leafGeo = leafGeometry();
  const leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, side: THREE.DoubleSide, transparent: true, depthWrite: false });
  const matrix = new THREE.Matrix4();
  const leafColor = new THREE.Color();
  const inkColor = new THREE.Color(0x514334);
  const autumnColors = [0xa8441f, 0xb86c2d, 0xc9a04a, 0x9f3821].map(c => new THREE.Color(c));
  const poolGeo = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
  const shades: ShadeActor[] = spots.map((s, i) => {
    const curve = new THREE.CatmullRomCurve3(s.patrol.map(([x, y, z]) => new THREE.Vector3(x, y, z)), true, 'centripetal');
    const mat = inkMaterial();
    mat.uniforms.uSeed!.value = i * 7.3;
    const group = new THREE.Group();
    const body = new THREE.Mesh(geo, mat);
    body.castShadow = false;
    group.add(body);
    scene.add(group);
    const pool = new THREE.Mesh(poolGeo, poolMaterial());
    pool.renderOrder = 1;
    scene.add(pool);
    const leaves = new THREE.InstancedMesh(leafGeo, leafMat.clone(), 72);
    leaves.visible = false;
    leaves.frustumCulled = false;
    leaves.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(leaves);
    const leafSeeds = Array.from({ length: 72 }, (_, k) => {
      const source = geo.attributes.position!;
      const p = new THREE.Vector3().fromBufferAttribute(source, (k * 167 + i * 31) % source.count);
      return { p, velocity: new THREE.Vector3(Math.sin(k * 2.4) * 0.75, 0.4 + (k % 7) * 0.11, Math.cos(k * 1.7) * 0.75), phase: k * 2.399 };
    });
    const debug = new THREE.Group();
    const line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(curve.getPoints(96)), new THREE.LineBasicMaterial({ color: 0xc9a04a }));
    debug.add(line);
    const ring = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 64 }, (_, k) => new THREE.Vector3(Math.cos(k / 64 * Math.PI * 2), 0.05, Math.sin(k / 64 * Math.PI * 2)))), new THREE.LineBasicMaterial({ color: 0xe08a2b }));
    debug.add(ring);
    debug.visible = false;
    scene.add(debug);
    return { leaves, leafSeeds, releaseAge: 0, debug, id: s.id, curve, length: curve.getLength(), u: 0, speed: s.speed, pos: new THREE.Vector3(), heading: 0, group, mat, pool, presence: 1, freed: false };
  });
  const tmp = new THREE.Vector3();
  let previousFox: THREE.Vector3 | null = null;
  const sys: ShadeSystem = {
    tun,
    resetSweep() { previousFox = null; },
    drains(p) {
      for (const s of shades) if (!s.freed && Math.hypot(p.x - s.pos.x, p.z - s.pos.z) < tun.drainRadius && Math.abs(p.y - s.pos.y) < 4) return true;
      return false;
    },
    update(dt, t, fox, dashing) {
      const ev: Array<{ type: 'freed' | 'hit'; id: string; pos: THREE.Vector3 }> = [];
      for (const s of shades) {
        if (s.freed) {
          s.releaseAge += dt;
          const age = s.releaseAge;
          s.leaves.visible = age < 4.5;
          const base = s.group.position;
          for (let k = 0; k < s.leafSeeds.length; k++) {
            const seed = s.leafSeeds[k]!;
            const p = seed.p.clone().applyAxisAngle(THREE.Object3D.DEFAULT_UP, s.heading);
            p.add(base).addScaledVector(seed.velocity, age);
            p.x += Math.sin(age * 2 + seed.phase) * age * 0.13;
            p.z += Math.cos(age * 1.6 + seed.phase) * age * 0.13;
            p.y = Math.max(s.pos.y + 0.04, p.y - age * age * 0.75);
            const fade = Math.min(1, age * 9) * (1 - THREE.MathUtils.smoothstep(age, 3.2, 4.5));
            const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(age * 1.8 + seed.phase, seed.phase + age, Math.sin(age + seed.phase)));
            matrix.compose(p, q, new THREE.Vector3(0.11 * fade, 0.11 * fade, 0.11 * fade));
            s.leaves.setMatrixAt(k, matrix);
            leafColor.copy(inkColor).lerp(autumnColors[k % 4]!, THREE.MathUtils.smoothstep(age, 0.12 + (k % 4) * 0.07, 1.6));
            s.leaves.setColorAt(k, leafColor);
          }
          s.leaves.instanceMatrix.needsUpdate = true;
          if (s.leaves.instanceColor) s.leaves.instanceColor.needsUpdate = true;
          s.presence = Math.max(0, s.presence - dt / tun.releaseTime);
          s.group.visible = s.presence > 0;
          s.pool.visible = s.presence > 0;
        } else {
          s.u = (s.u + (dt * (s.speed ?? tun.speed)) / s.length) % 1;
          s.curve.getPointAt(s.u, s.pos);
          s.curve.getTangentAt(s.u, tmp);
          s.heading = Math.atan2(tmp.x, tmp.z);
          // drift: a slow bob, as if the ink were suspended in water
          const gy = groundAt(s.pos.x, s.pos.z, s.pos.y + 2);
          if (Number.isFinite(gy)) s.pos.y = gy;
          // Sweep the fox segment so a fast dash cannot skip a narrow animal between frames.
          // Teleport/reset hooks explicitly clear the previous endpoint.
          let nearest = fox;
          if (previousFox) {
            const segment = new THREE.Line3(previousFox, fox);
            nearest = segment.closestPointToPoint(s.pos, true, new THREE.Vector3());
          }
          const d = Math.hypot(nearest.x - s.pos.x, nearest.z - s.pos.z);
          const dy = nearest.y - s.pos.y;
          if (d < tun.hitRadius + (dashing ? 0.5 : 0) && dy > -0.5 && dy < 3.2) {
            if (dashing) {
              s.freed = true;
              s.releaseAge = 0;
              ev.push({ type: 'freed', id: s.id, pos: s.pos.clone().setY(s.pos.y + 1.5) });
            } else ev.push({ type: 'hit', id: s.id, pos: s.pos.clone() });
          }
        }
        s.debug.visible = tun.debug && !s.freed;
        const ring = s.debug.children[1]!;
        ring.position.copy(s.pos);
        ring.scale.setScalar(tun.drainRadius);
        if (!s.freed) s.group.position.set(s.pos.x, s.pos.y + tun.bob + Math.sin(t * 1.3 + s.u * 20) * tun.bob, s.pos.z);
        s.group.rotation.y = s.heading;
        s.mat.uniforms.uTime!.value = t;
        s.mat.uniforms.uPresence!.value = s.presence;
        s.pool.position.set(s.pos.x, s.pos.y + 0.04, s.pos.z);
        s.pool.scale.setScalar(tun.drainRadius);
        const pm = s.pool.material as THREE.ShaderMaterial;
        pm.uniforms.uTime!.value = t;
        pm.uniforms.uPresence!.value = s.presence;
      }
      previousFox = fox.clone();
      return ev;
    },
    state() {
      return shades.map((s) => ({ id: s.id, pos: s.pos.toArray().map((v) => Number(v.toFixed(2))), freed: s.freed, releaseAge: Number(s.releaseAge.toFixed(3)), leaves: s.freed && s.releaseAge < 4.5 ? 72 : 0 }));
    },
  };
  if (gui) {
    const f = gui.addFolder('Encounters › Shades');
    f.add(tun, 'drainRadius', 1, 6, 0.1);
    f.add(tun, 'hitRadius', 0.5, 2.5, 0.05);
    f.add(tun, 'knockback', 0, 6, 0.1).name('knockback metres');
    f.add(tun, 'speed', 0, 5, 0.1);
    f.add(tun, 'bob', 0, 0.6, 0.01);
    f.add(tun, 'releaseTime', 0.4, 2, 0.05);
    f.add(tun, 'invulnerability', 0.3, 2, 0.05);
    f.add(tun, 'debug');
    f.close();
  }
  return sys;
}

/** A small pointed leaf, cupped along its midrib. Units are scaled by each instance. */
function leafGeometry() {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, 1.5, 0, -0.65, 0, 0, 0, -1.1, 0, 0.65, 0, 0, 0, 0.15, 0.22], 3));
  g.setIndex([0, 1, 4, 1, 2, 4, 2, 3, 4, 3, 0, 4]);
  g.computeVertexNormals();
  return g;
}
