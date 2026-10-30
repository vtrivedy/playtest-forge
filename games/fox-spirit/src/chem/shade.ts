import * as THREE from 'three';
import type GUI from 'lil-gui';

/**
 * Shade (docs/design/world-1.md §3.8): an ink silhouette of an animal caught mid-stride when the Keeping
 * struck. It drifts along an authored closed patrol and drains temporary colour within `drainRadius`:
 * aura/trail and spent dash strokes (≤ 1) read as 0 there, and unsupplied reactors in it skip their hold.
 * A dash through it frees it: it comes apart into leaves. Contact without a dash knocks the fox back.
 */
export type ShadeSpot = { id: string; patrol: Array<[number, number, number]>; speed?: number };

export type ShadeTunables = { drainRadius: number; speed: number; hitRadius: number; knockback: number };
export const SHADE_DEFAULTS: ShadeTunables = { drainRadius: 3, speed: 2.2, hitRadius: 1.1, knockback: 7 };

type ShadeActor = {
  id: string;
  curve: THREE.CatmullRomCurve3;
  length: number;
  u: number;
  speed: number;
  pos: THREE.Vector3;
  heading: number;
  group: THREE.Group;
  mat: THREE.ShaderMaterial;
  pool: THREE.Mesh;
  /** 1 = present, falls to 0 while freed */
  presence: number;
  freed: boolean;
};

/** Ink stag, mid-stride: body, neck, head, four legs, antler tines. Built from primitives, merged. */
function stagGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const add = (g: THREE.BufferGeometry, m: THREE.Matrix4) => parts.push(g.applyMatrix4(m).toNonIndexed());
  const M = (x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) =>
    new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
  // body (+z forward)
  add(new THREE.SphereGeometry(0.5, 14, 10), M(0, 1.45, 0, 0.08, 0, 0, 0.62, 0.66, 1.25));
  add(new THREE.SphereGeometry(0.42, 12, 8), M(0, 1.5, 0.45, 0, 0, 0, 0.7, 0.8, 0.8));
  // neck + head, raised and turned a little — listening
  add(new THREE.CylinderGeometry(0.16, 0.26, 0.9, 10), M(0, 2.0, 0.78, -0.75, 0, 0));
  add(new THREE.SphereGeometry(0.2, 12, 8), M(0.05, 2.42, 1.08, 0, 0.25, 0, 0.85, 0.9, 1.45));
  add(new THREE.ConeGeometry(0.08, 0.28, 6), M(0.12, 2.6, 0.98, 0, 0, -0.9));
  add(new THREE.ConeGeometry(0.08, 0.28, 6), M(-0.06, 2.6, 0.98, 0, 0, 0.9));
  // legs mid-stride (front left forward, hind right back)
  const leg = (x: number, z: number, swing: number, hind: boolean) => {
    add(new THREE.CylinderGeometry(0.08, hind ? 0.14 : 0.11, 0.7, 7), M(x, 0.98, z, swing, 0, 0));
    add(new THREE.CylinderGeometry(0.04, 0.07, 0.75, 6), M(x, 0.36, z + Math.sin(swing) * 0.45, swing * 0.6, 0, 0));
  };
  leg(0.2, 0.62, 0.45, false);
  leg(-0.2, 0.55, -0.2, false);
  leg(0.2, -0.55, 0.15, true);
  leg(-0.2, -0.6, -0.45, true);
  // antlers: two beams with tines
  for (const s of [1, -1]) {
    add(new THREE.CylinderGeometry(0.025, 0.045, 0.7, 5), M(s * 0.2, 2.86, 0.92, -0.35, 0, s * -0.5));
    add(new THREE.CylinderGeometry(0.02, 0.035, 0.45, 5), M(s * 0.42, 3.18, 0.78, -0.7, 0, s * -0.2));
    add(new THREE.CylinderGeometry(0.015, 0.03, 0.3, 5), M(s * 0.3, 3.08, 1.05, 0.5, 0, s * -0.3));
    add(new THREE.CylinderGeometry(0.015, 0.03, 0.28, 5), M(s * 0.5, 3.38, 0.9, 0.2, 0, s * -0.6));
  }
  // tail
  add(new THREE.ConeGeometry(0.07, 0.25, 6), M(0, 1.6, -0.78, -2.3, 0, 0));
  let n = 0;
  for (const g of parts) n += g.attributes.position!.count;
  const pos = new Float32Array(n * 3);
  const nor = new Float32Array(n * 3);
  let o = 0;
  for (const g of parts) {
    pos.set(g.attributes.position!.array as Float32Array, o * 3);
    nor.set(g.attributes.normal!.array as Float32Array, o * 3);
    o += g.attributes.position!.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return out;
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
        float w = (1.0 - smoothstep(0.0, 1.6, p.y)) * 0.12 + 0.03;
        p += normal * (n3(p * 3.0 + vec3(0.0, uTime * 1.3, uSeed)) - 0.5) * w * 2.0;
        p.x += sin(uTime * 1.7 + p.y * 2.0 + uSeed) * 0.03;
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
        vec3 core = vec3(0.045, 0.035, 0.03);
        vec3 edge = vec3(0.62, 0.55, 0.45);
        vec3 col = mix(core, edge, rim * 0.55 + smoothstep(cut, cut + 0.06, n) * 0.0);
        col = mix(col, edge * 0.8, 1.0 - smoothstep(cut, cut + 0.05, n));
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
    fog: false,
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
  state: () => Array<{ id: string; pos: number[]; freed: boolean }>;
};

export function createShades(scene: THREE.Scene, spots: ShadeSpot[], groundAt: (x: number, z: number, y: number) => number, gui?: GUI): ShadeSystem {
  const tun = { ...SHADE_DEFAULTS };
  const geo = stagGeometry();
  const poolGeo = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
  const shades: ShadeActor[] = spots.map((s, i) => {
    const curve = new THREE.CatmullRomCurve3(s.patrol.map(([x, y, z]) => new THREE.Vector3(x, y, z)), true, 'centripetal');
    const mat = inkMaterial();
    mat.uniforms.uSeed!.value = i * 7.3;
    const group = new THREE.Group();
    const body = new THREE.Mesh(geo, mat);
    body.castShadow = true;
    group.add(body);
    scene.add(group);
    const pool = new THREE.Mesh(poolGeo, poolMaterial());
    pool.renderOrder = 1;
    scene.add(pool);
    return { id: s.id, curve, length: curve.getLength(), u: 0, speed: s.speed ?? tun.speed, pos: new THREE.Vector3(), heading: 0, group, mat, pool, presence: 1, freed: false };
  });
  const tmp = new THREE.Vector3();
  const sys: ShadeSystem = {
    tun,
    drains(p) {
      for (const s of shades) if (!s.freed && Math.hypot(p.x - s.pos.x, p.z - s.pos.z) < tun.drainRadius && Math.abs(p.y - s.pos.y) < 4) return true;
      return false;
    },
    update(dt, t, fox, dashing) {
      const ev: Array<{ type: 'freed' | 'hit'; id: string; pos: THREE.Vector3 }> = [];
      for (const s of shades) {
        if (s.freed) {
          s.presence = Math.max(0, s.presence - dt / 0.7);
          s.group.visible = s.presence > 0;
          s.pool.visible = s.presence > 0;
        } else {
          s.u = (s.u + (dt * s.speed) / s.length) % 1;
          s.curve.getPointAt(s.u, s.pos);
          s.curve.getTangentAt(s.u, tmp);
          s.heading = Math.atan2(tmp.x, tmp.z);
          // drift: a slow bob, as if the ink were suspended in water
          const gy = groundAt(s.pos.x, s.pos.z, s.pos.y + 2);
          if (Number.isFinite(gy)) s.pos.y = gy;
          const d = Math.hypot(fox.x - s.pos.x, fox.z - s.pos.z);
          const dy = fox.y - s.pos.y;
          if (d < tun.hitRadius + (dashing ? 0.5 : 0) && dy > -0.5 && dy < 3.2) {
            if (dashing) {
              s.freed = true;
              ev.push({ type: 'freed', id: s.id, pos: s.pos.clone().setY(s.pos.y + 1.5) });
            } else ev.push({ type: 'hit', id: s.id, pos: s.pos.clone() });
          }
        }
        s.group.position.set(s.pos.x, s.pos.y + 0.12 + Math.sin(t * 1.3 + s.u * 20) * 0.08, s.pos.z);
        s.group.rotation.y = s.heading;
        s.mat.uniforms.uTime!.value = t;
        s.mat.uniforms.uPresence!.value = s.presence;
        s.pool.position.set(s.pos.x, s.pos.y + 0.04, s.pos.z);
        s.pool.scale.setScalar(tun.drainRadius);
        const pm = s.pool.material as THREE.ShaderMaterial;
        pm.uniforms.uTime!.value = t;
        pm.uniforms.uPresence!.value = s.presence;
      }
      return ev;
    },
    state() {
      return shades.map((s) => ({ id: s.id, pos: s.pos.toArray().map((v) => Number(v.toFixed(2))), freed: s.freed }));
    },
  };
  if (gui) {
    const f = gui.addFolder('Chem › Shade');
    f.add(tun, 'drainRadius', 1, 6, 0.1);
    f.add(tun, 'hitRadius', 0.5, 2.5, 0.05);
    f.add(tun, 'knockback', 0, 14, 0.5);
    f.close();
  }
  return sys;
}
