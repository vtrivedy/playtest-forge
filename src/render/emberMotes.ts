import * as THREE from 'three';

export type EmberBurstOptions = {
  count?: number;
  /** Outward speed range m/s */
  speed?: [number, number];
  /** Extra upward bias m/s */
  lift?: number;
  life?: [number, number];
  /** Buoyant rise m/s² (hot air) */
  buoyancy?: number;
  drag?: number;
  /** Flash glow radius at the origin (0 = none) */
  flash?: number;
  /** Spark head size range m */
  size?: [number, number];
  /** Colour intensity; < 1 keeps sparks deep orange instead of tone-mapping to white-gold */
  heat?: number;
};

export type EmberMotes = {
  points: THREE.Points;
  /** Spawn a floating ember pickup; returns its id. scale > 1 for high-value motes. */
  add: (pos: THREE.Vector3, scale?: number) => number;
  /** Current (bobbing) world position of a mote. */
  positionOf: (id: number) => THREE.Vector3;
  /** Consume a mote: flash + sparks that streak into the homing target. */
  /** quiet: the mote dissolves upward in place (no streaks homing into the fox, no flash on the hero) */
  collect: (id: number, quiet?: boolean) => void;
  /** Loose sparks flying outward (restore money shot). */
  burst: (origin: THREE.Vector3, opts?: EmberBurstOptions) => void;
  /** target = where collect sparks home (fox chest). */
  update: (dt: number, target: THREE.Vector3) => void;
  dispose: () => void;
};

// HDR linear colors: core > 1 so it blooms through the post stack threshold
const CORE = new THREE.Color(2.6, 1.15, 0.32);
const FLAME_HOT = new THREE.Color(1.5, 0.62, 0.15);
const FLAME_COOL = new THREE.Color(1.1, 0.28, 0.06);
const HALO = new THREE.Color(1.0, 0.34, 0.07);
const SPARK = new THREE.Color(2.5, 1.05, 0.28);

const SHAPE_GLOW = 0;
const SHAPE_FLAME = 1;
const SHAPE_SPARK = 2;

const FLAMES = 5;
const ORBITERS = 3;
const TAIL = 4; // points drawn per streaking spark (head + 3 lagged)

type Mote = { anchor: THREE.Vector3; pos: THREE.Vector3; alive: boolean; phase: number; scale: number };
type Spark = {
  alive: boolean;
  homing: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  hist: THREE.Vector3[];
  life: number;
  maxLife: number;
  size: number;
  drag: number;
  buoyancy: number;
  flicker: number;
  heat: number;
};
type Flash = { alive: boolean; pos: THREE.Vector3; life: number; maxLife: number; size: number; follow: boolean };

/**
 * Ember mote pickups + collect streaks + restore spark bursts.
 * Everything is one additive THREE.Points draw with per-point size / color / shape.
 */
export function createEmberMotes(scene: THREE.Scene, opts: { maxMotes?: number; maxSparks?: number } = {}): EmberMotes {
  const maxMotes = opts.maxMotes ?? 16;
  const maxSparks = opts.maxSparks ?? 220;
  const maxFlashes = 12;
  const perMote = 2 + FLAMES + ORBITERS;
  const cap = maxMotes * perMote + maxSparks * TAIL + maxFlashes;

  const geo = new THREE.BufferGeometry();
  const aPos = new Float32Array(cap * 3);
  const aColor = new Float32Array(cap * 3);
  const aSize = new Float32Array(cap);
  const aAlpha = new Float32Array(cap);
  const aShape = new Float32Array(cap);
  geo.setAttribute('position', new THREE.BufferAttribute(aPos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aColor', new THREE.BufferAttribute(aColor, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aSize', new THREE.BufferAttribute(aSize, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aAlpha', new THREE.BufferAttribute(aAlpha, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aShape', new THREE.BufferAttribute(aShape, 1).setUsage(THREE.DynamicDrawUsage));

  const uniforms = { uViewHalfH: { value: 360 } };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute vec3 aColor;
      attribute float aSize;
      attribute float aAlpha;
      attribute float aShape;
      uniform float uViewHalfH;
      varying vec3 vColor;
      varying float vAlpha;
      varying float vShape;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        // world-space size in metres → pixels
        gl_PointSize = min(aSize * projectionMatrix[1][1] * uViewHalfH / max(0.05, -mv.z), 256.0);
        vColor = aColor;
        vAlpha = aAlpha;
        vShape = aShape;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vAlpha;
      varying float vShape;
      void main() {
        vec2 p = gl_PointCoord * 2.0 - 1.0;
        p.y = -p.y;
        float a;
        if (vShape < 0.5) {
          float d2 = dot(p, p);
          a = exp(-d2 * 4.5) * (1.0 - smoothstep(0.7, 1.0, sqrt(d2)));
        } else if (vShape < 1.5) {
          // flame tongue: round belly low, pinched tip high
          vec2 q = vec2(p.x * (1.7 + 2.2 * max(p.y + 0.1, 0.0)), (p.y + 0.3) * 1.05);
          a = exp(-dot(q, q) * 3.2);
        } else {
          a = exp(-dot(p, p) * 9.0);
        }
        a *= vAlpha;
        if (a < 0.004) discard;
        // premultiplied; partial alpha dims what's behind so embers stay orange over pale sepia instead of clipping white
        gl_FragColor = vec4(vColor * a, a * 0.45);
      }`,
  });
  // premultiplied add-over: src + dst·(1 − αocc)
  mat.blending = THREE.CustomBlending;
  mat.blendSrc = THREE.OneFactor;
  mat.blendDst = THREE.OneMinusSrcAlphaFactor;

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 5;
  const bufSize = new THREE.Vector2();
  points.onBeforeRender = (renderer) => {
    renderer.getDrawingBufferSize(bufSize);
    uniforms.uViewHalfH.value = bufSize.y * 0.5;
  };
  scene.add(points);

  const motes: Mote[] = [];
  const sparks: Spark[] = Array.from({ length: maxSparks }, () => ({
    alive: false,
    homing: false,
    pos: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    hist: Array.from({ length: TAIL - 1 }, () => new THREE.Vector3()),
    life: 0,
    maxLife: 1,
    size: 0.05,
    drag: 1,
    buoyancy: 0,
    flicker: 0,
    heat: 1,
  }));
  const flashes: Flash[] = Array.from({ length: maxFlashes }, () => ({
    alive: false,
    pos: new THREE.Vector3(),
    life: 0,
    maxLife: 1,
    size: 1,
    follow: false,
  }));
  let sparkCursor = 0;
  let t = 0;
  const target = new THREE.Vector3();
  const rand = (a: number, b: number) => a + Math.random() * (b - a);

  const takeSpark = (): Spark => {
    const s = sparks[sparkCursor]!;
    sparkCursor = (sparkCursor + 1) % maxSparks;
    return s;
  };
  const flash = (pos: THREE.Vector3, size: number, life: number, follow = false) => {
    const f = flashes.find((x) => !x.alive) ?? flashes[0]!;
    f.alive = true;
    f.pos.copy(pos);
    f.size = size;
    f.life = f.maxLife = life;
    f.follow = follow;
  };
  const spawnSpark = (origin: THREE.Vector3, vel: THREE.Vector3, o: Partial<Spark>) => {
    const s = takeSpark();
    s.alive = true;
    s.homing = o.homing ?? false;
    s.pos.copy(origin);
    s.vel.copy(vel);
    for (const h of s.hist) h.copy(origin);
    s.life = s.maxLife = o.maxLife ?? 1;
    s.size = o.size ?? 0.05;
    s.drag = o.drag ?? 1;
    s.buoyancy = o.buoyancy ?? 0;
    s.flicker = Math.random() * 10;
    s.heat = o.heat ?? 1;
  };

  let n = 0;
  const emit = (x: number, y: number, z: number, col: THREE.Color, k: number, size: number, alpha: number, shape: number) => {
    if (n >= cap) return;
    aPos[n * 3] = x;
    aPos[n * 3 + 1] = y;
    aPos[n * 3 + 2] = z;
    aColor[n * 3] = col.r * k;
    aColor[n * 3 + 1] = col.g * k;
    aColor[n * 3 + 2] = col.b * k;
    aSize[n] = size;
    aAlpha[n] = alpha;
    aShape[n] = shape;
    n++;
  };
  const tmpCol = new THREE.Color();
  const tmpV = new THREE.Vector3();

  return {
    points,
    add(pos, scale = 1) {
      motes.push({ anchor: pos.clone(), pos: pos.clone(), alive: true, phase: Math.random() * Math.PI * 2, scale });
      return motes.length - 1;
    },
    positionOf(id) {
      return motes[id]!.pos;
    },
    collect(id, quiet = false) {
      const m = motes[id];
      if (!m || !m.alive) return;
      m.alive = false;
      if (quiet) {
        for (let k = 0; k < Math.round(8 * m.scale); k++) {
          const a = Math.random() * Math.PI * 2;
          tmpV.set(Math.cos(a) * 0.35, rand(0.6, 1.3), Math.sin(a) * 0.35);
          spawnSpark(m.pos, tmpV, { maxLife: rand(0.9, 1.6), size: rand(0.03, 0.05), drag: 1.2, buoyancy: 0.5, heat: 0.6 });
        }
        return;
      }
      flash(m.pos, 0.9 * m.scale, 0.35);
      for (let k = 0; k < Math.round(16 * m.scale); k++) {
        const a = Math.random() * Math.PI * 2;
        const up = rand(-0.2, 1);
        tmpV.set(Math.cos(a), up, Math.sin(a)).normalize().multiplyScalar(rand(1.4, 2.8));
        spawnSpark(m.pos, tmpV, { homing: true, maxLife: rand(0.9, 1.3), size: rand(0.035, 0.06), drag: 2.5 });
      }
    },
    burst(origin, o = {}) {
      const count = o.count ?? 60;
      const [s0, s1] = o.speed ?? [1.5, 4];
      const [l0, l1] = o.life ?? [1.6, 3.2];
      if (o.flash) flash(origin, o.flash, 0.9);
      for (let k = 0; k < count; k++) {
        const a = Math.random() * Math.PI * 2;
        const el = rand(-0.25, 0.75);
        tmpV.set(Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el)).multiplyScalar(rand(s0, s1));
        tmpV.y += o.lift ?? 1;
        spawnSpark(origin, tmpV, {
          maxLife: rand(l0, l1),
          size: rand(...(o.size ?? [0.03, 0.065])),
          drag: o.drag ?? 1.4,
          buoyancy: o.buoyancy ?? 0.8,
          heat: o.heat ?? 1,
        });
      }
    },
    update(dt, homeTarget) {
      t += dt;
      target.copy(homeTarget);
      n = 0;

      for (const m of motes) {
        if (!m.alive) continue;
        const ph = m.phase;
        m.pos.copy(m.anchor);
        m.pos.y += Math.sin(t * 1.8 + ph) * 0.06;
        const { x, y, z } = m.pos;
        if (m.pos.distanceToSquared(target) > 80 * 80) continue; // too far to read; skip the fill
        const S = m.scale;
        // two-frequency flicker so neighbouring motes never pulse in sync
        const flick = 0.82 + 0.12 * Math.sin(t * 13 + ph * 3) + 0.08 * Math.sin(t * 29 + ph);
        emit(x, y + 0.03 * S, z, HALO, 1, 0.95 * S, 0.4 * flick, SHAPE_GLOW);
        for (let i = 0; i < FLAMES; i++) {
          const p = (t * (1.3 + (i % 2) * 0.35) + i / FLAMES + ph) % 1;
          const sway = Math.sin(t * 6 + i * 1.7 + ph) * 0.025 * p;
          const ang = i * 2.4 + ph;
          tmpCol.copy(FLAME_HOT).lerp(FLAME_COOL, p);
          emit(
            x + (Math.cos(ang) * 0.025 * (1 - p) + sway) * S,
            y + (-0.04 + p * 0.22) * S,
            z + Math.sin(ang) * 0.025 * (1 - p) * S,
            tmpCol,
            1,
            (0.2 * Math.pow(1 - p, 0.6) + 0.04) * S,
            (1 - p) * THREE.MathUtils.smoothstep(p, 0, 0.12) * 0.6,
            SHAPE_FLAME,
          );
        }
        emit(x, y, z, CORE, flick, 0.11 * S * (0.92 + 0.08 * flick), 1, SHAPE_GLOW);
        for (let i = 0; i < ORBITERS; i++) {
          const a = t * (2.1 + i * 0.55) + i * 2.1 + ph;
          const r = (0.17 + 0.04 * Math.sin(t * 1.7 + i)) * S;
          const tw = 0.5 + 0.5 * Math.sin(t * 17 + i * 5 + ph);
          emit(x + Math.cos(a) * r, y + (Math.sin(a * 0.7 + i) * 0.09 + 0.04) * S, z + Math.sin(a) * r, SPARK, 1, 0.04 * S, 0.4 + 0.6 * tw, SHAPE_SPARK);
        }
      }

      for (const s of sparks) {
        if (!s.alive) continue;
        s.life -= dt;
        const age = s.maxLife - s.life;
        for (let h = s.hist.length - 1; h > 0; h--) s.hist[h]!.copy(s.hist[h - 1]!);
        s.hist[0]!.copy(s.pos);
        if (s.homing) {
          // brief outward pop, then steer harder and faster into the fox
          const steer = THREE.MathUtils.smoothstep(age, 0.08, 0.45) * 14;
          tmpV.copy(target).sub(s.pos);
          const d = tmpV.length();
          tmpV.multiplyScalar((4 + age * 9) / Math.max(d, 1e-3));
          s.vel.lerp(tmpV, 1 - Math.exp(-steer * dt));
          s.vel.multiplyScalar(Math.exp(-(age < 0.12 ? s.drag : 0) * dt));
          if ((d < 0.14 && age > 0.12) || s.life <= 0) {
            s.alive = false;
            flash(target, 0.42, 0.22, true);
            continue;
          }
        } else {
          s.vel.multiplyScalar(Math.exp(-s.drag * dt));
          s.vel.y += s.buoyancy * dt;
          s.vel.x += Math.sin(t * 3 + s.flicker) * 0.6 * dt;
          if (s.life <= 0) {
            s.alive = false;
            continue;
          }
        }
        s.pos.addScaledVector(s.vel, dt);
        const lifeK = s.homing ? 1 : Math.min(1, s.life / (s.maxLife * 0.5));
        const tw = s.homing ? 1 : 0.65 + 0.35 * Math.sin(t * 21 + s.flicker * 7);
        // cool from white-gold to deep ember as it dies
        tmpCol.copy(FLAME_COOL).lerp(SPARK, Math.min(1, lifeK * 1.4));
        emit(s.pos.x, s.pos.y, s.pos.z, tmpCol, s.heat, s.size, lifeK * tw, SHAPE_SPARK);
        for (let h = 0; h < s.hist.length; h++) {
          const k = 1 - (h + 1) / TAIL;
          const hp = s.hist[h]!;
          emit(hp.x, hp.y, hp.z, tmpCol, s.heat, s.size * (0.5 + 0.5 * k), lifeK * tw * k * 0.7, SHAPE_SPARK);
        }
      }

      for (const f of flashes) {
        if (!f.alive) continue;
        f.life -= dt;
        if (f.life <= 0) {
          f.alive = false;
          continue;
        }
        if (f.follow) f.pos.copy(target);
        const k = f.life / f.maxLife;
        emit(f.pos.x, f.pos.y, f.pos.z, SPARK, 0.9, f.size * (1.25 - 0.25 * k), Math.pow(k, 1.5), SHAPE_GLOW);
      }

      geo.setDrawRange(0, n);
      for (const name of ['position', 'aColor', 'aSize', 'aAlpha', 'aShape']) {
        const attr = geo.getAttribute(name) as THREE.BufferAttribute;
        attr.clearUpdateRanges();
        attr.addUpdateRange(0, n * attr.itemSize);
        attr.needsUpdate = true;
      }
    },
    dispose() {
      geo.dispose();
      mat.dispose();
      scene.remove(points);
    },
  };
}
