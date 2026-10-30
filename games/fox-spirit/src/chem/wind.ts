import { leafAtlas } from '../russetTextures';
import * as THREE from 'three';
import type GUI from 'lil-gui';
import { Reactor, type ReactorTunables, type SupplyFn } from './reactor';

/**
 * Wind element (docs/design/world-1.md §1.3): a wind current is an authored spline tube that, while its
 * source reactor has heat, carries a gliding fox along it — `push` m/s along the tangent and `hold` of the
 * glide sink cancelled. Visual: streaming air threads and leaves flowing down the spline, fading with heat.
 */
export type WindSpot = {
  id: string;
  /** Spline control points (x, y, z), flow runs first → last */
  path: Array<[number, number, number]>;
  /** Where colour must touch to wake it (e.g. a wind-bell at the current's mouth) */
  source: [number, number, number];
  /** Tube radius (m) */
  radius?: number;
};

export type WindTunables = ReactorTunables & {
  push: number;
  hold: number;
  /** centering velocity toward the spline at the tube edge (m/s) */
  centerPull: number;
  radius: number;
};

export const WIND_DEFAULTS: WindTunables = {
  threshold: 0.3,
  igniteTime: 1.0,
  holdTime: 3.0,
  gutterTime: 3.0,
  push: 5,
  hold: 0.8,
  centerPull: 2,
  radius: 2.8,
};

export type WindForce = { k: number; tx: number; ty: number; tz: number; px: number; py: number; pz: number };

type Current = {
  spot: WindSpot;
  reactor: Reactor;
  curve: THREE.CatmullRomCurve3;
  length: number;
  /** Dense samples for nearest-point queries */
  samples: THREE.Vector3[];
  tangents: THREE.Vector3[];
  threads: THREE.ShaderMaterial;
  leaves: THREE.Points;
  leafU: Float32Array;
  leafOff: Float32Array;
  debug: THREE.Line;
};

function threadMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uHeat: { value: 0 }, uLen: { value: 100 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uHeat, uLen;
      varying vec2 vUv;
      void main() {
        // long soft streaks running down the current (u = along, v = around)
        float u = vUv.x * uLen;
        float around = vUv.y;
        float lane = floor(around * 7.0);
        float streak = sin(u * 0.35 - uTime * 6.0 + lane * 2.7) * 0.5 + 0.5;
        streak *= sin(u * 0.11 - uTime * 2.3 + lane * 5.1) * 0.5 + 0.5;
        float band = 1.0 - abs(fract(around * 7.0) - 0.5) * 2.0;
        float ends = smoothstep(0.0, 0.04, vUv.x) * (1.0 - smoothstep(0.9, 1.0, vUv.x));
        float a = uHeat * smoothstep(0.45, 0.95, streak) * pow(band, 3.0) * ends * 0.22;
        gl_FragColor = vec4(vec3(1.0, 0.86, 0.66) * a, a);
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
}

export type WindSystem = {
  readonly tun: WindTunables;
  readonly currents: Current[];
  update: (dt: number, t: number, supplyAt: SupplyFn, debugOn: boolean, drainedAt?: (p: THREE.Vector3) => boolean) => void;
  /** Strongest current at a point (k = 0 outside every tube) */
  forceAt: (p: THREE.Vector3, out: WindForce) => WindForce;
  /** Mark currents whose source lies within r of c restored (Seedwell latch) */
  restoreNear: (c: THREE.Vector3, r: number) => void;
  state: () => Array<{ id: string; heat: number; state: string; restored: boolean; length: number }>;
};

export function createWind(scene: THREE.Scene, spots: WindSpot[], opts: { gui?: GUI } = {}): WindSystem {
  const tun: WindTunables = { ...WIND_DEFAULTS };
  const N_LEAF = 90;
  const windLeaf = leafAtlas(256);
  windLeaf.repeat.set(0.5, 0.5);
  windLeaf.offset.set(0, 0.5);
  const currents: Current[] = spots.map((spot) => {
    const curve = new THREE.CatmullRomCurve3(spot.path.map(([x, y, z]) => new THREE.Vector3(x, y, z)), false, 'centripetal');
    const length = curve.getLength();
    const n = Math.max(32, Math.ceil(length / 0.75));
    const samples: THREE.Vector3[] = [];
    const tangents: THREE.Vector3[] = [];
    for (let i = 0; i <= n; i++) {
      samples.push(curve.getPointAt(i / n));
      tangents.push(curve.getTangentAt(i / n));
    }
    const [sx, sy, sz] = spot.source;
    const reactor = new Reactor(spot.id, 'wind', [new THREE.Vector3(sx, sy, sz)], tun);
    const threads = threadMaterial();
    threads.uniforms.uLen!.value = length;
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.ceil(length / 1.5), (spot.radius ?? tun.radius) * 0.7, 14, false), threads);
    tube.frustumCulled = false;
    tube.renderOrder = 3;
    scene.add(tube);
    // leaves riding the current: CPU-advanced along u, offset inside the tube
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N_LEAF * 3), 3));
    const leafU = new Float32Array(N_LEAF);
    const leafOff = new Float32Array(N_LEAF * 3);
    let s = spot.id.length * 97 + 13;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < N_LEAF; i++) {
      leafU[i] = rnd();
      const a = rnd() * Math.PI * 2;
      const r = Math.sqrt(rnd()) * (spot.radius ?? tun.radius) * 0.75;
      leafOff[i * 3] = Math.cos(a) * r;
      leafOff[i * 3 + 1] = Math.sin(a) * r * 0.6;
      leafOff[i * 3 + 2] = rnd();
    }
    const leafMat = new THREE.PointsMaterial({ map: windLeaf, alphaTest: 0.03, color: 0xc8582a, size: 0.22, sizeAttenuation: true, transparent: true, opacity: 0, depthWrite: false });
    const leaves = new THREE.Points(geo, leafMat);
    leaves.frustumCulled = false;
    scene.add(leaves);
    const debug = new THREE.Line(new THREE.BufferGeometry().setFromPoints(samples), new THREE.LineBasicMaterial({ color: 0x66ccff, depthTest: false }));
    debug.visible = false;
    debug.renderOrder = 10;
    scene.add(debug);
    return { spot, reactor, curve, length, samples, tangents, threads, leaves, leafU, leafOff, debug };
  });

  const tmp = new THREE.Vector3();
  const sys: WindSystem = {
    tun,
    currents,
    update(dt, t, supplyAt, debugOn, drainedAt) {
      for (const c of currents) {
        c.reactor.update(dt, supplyAt, drainedAt);
        const h = c.reactor.heat;
        c.threads.uniforms.uTime!.value = t;
        c.threads.uniforms.uHeat!.value = h;
        const lm = c.leaves.material as THREE.PointsMaterial;
        lm.opacity = Math.min(1, h * 1.2) * 0.9;
        c.leaves.visible = h > 0.01;
        if (c.leaves.visible) {
          const pos = c.leaves.geometry.attributes.position as THREE.BufferAttribute;
          const speed = (tun.push + 6) * h;
          for (let i = 0; i < c.leafU.length; i++) {
            c.leafU[i] = (c.leafU[i]! + (dt * speed * (0.8 + c.leafOff[i * 3 + 2]! * 0.4)) / c.length) % 1;
            const u = c.leafU[i]!;
            c.curve.getPointAt(u, tmp);
            const wob = Math.sin(t * 3 + i) * 0.25;
            pos.setXYZ(i, tmp.x + c.leafOff[i * 3]! + wob, tmp.y + c.leafOff[i * 3 + 1]! + Math.cos(t * 2.3 + i) * 0.2, tmp.z + wob * 0.6);
          }
          pos.needsUpdate = true;
        }
        c.debug.visible = debugOn;
      }
    },
    forceAt(p, out) {
      out.k = 0;
      for (const c of currents) {
        const h = c.reactor.heat;
        if (h <= 0) continue;
        const R = c.spot.radius ?? tun.radius;
        let best = Infinity;
        let bi = 0;
        for (let i = 0; i < c.samples.length; i++) {
          const d = c.samples[i]!.distanceToSquared(p);
          if (d < best) {
            best = d;
            bi = i;
          }
        }
        const d = Math.sqrt(best);
        // no pull past the mouth or the end: the current only holds what is inside it
        if (d > R + 1 || bi === c.samples.length - 1) continue;
        const k = h * (1 - THREE.MathUtils.smoothstep(d, R * 0.6, R + 1));
        if (k > out.k) {
          const tg = c.tangents[bi]!;
          const sp = c.samples[bi]!;
          out.k = k;
          out.tx = tg.x;
          out.ty = tg.y;
          out.tz = tg.z;
          out.px = sp.x - p.x;
          out.py = sp.y - p.y;
          out.pz = sp.z - p.z;
        }
      }
      return out;
    },
    restoreNear(cn, r) {
      for (const c of currents) {
        const [sx, , sz] = c.spot.source;
        if (Math.hypot(sx - cn.x, sz - cn.z) <= r) c.reactor.restored = true;
      }
    },
    state() {
      return currents.map((c) => ({ id: c.spot.id, heat: Number(c.reactor.heat.toFixed(3)), state: c.reactor.state, restored: c.reactor.restored, length: Number(c.length.toFixed(1)) }));
    },
  };
  if (opts.gui) {
    const f = opts.gui.addFolder('Chem › Wind');
    f.add(tun, 'push', 0, 12, 0.1);
    f.add(tun, 'hold', 0, 1, 0.01);
    f.add(tun, 'centerPull', 0, 5, 0.1);
    f.add(tun, 'holdTime', 0, 8, 0.1);
    f.close();
  }
  return sys;
}
