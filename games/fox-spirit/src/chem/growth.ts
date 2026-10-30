import * as THREE from 'three';
import type GUI from 'lil-gui';
import { Reactor, type ReactorTunables, type SupplyFn } from './reactor';
import { boxCollider, type Collider, type CollisionWorld } from '../collision';
import { barkTextures } from '../russetTextures';
import { PAL, LEAF_COLORS, fbm3, vnoise3, leafShape } from '../russetKit';

/**
 * Growth element (docs/design/world-1.md §1.3, §1.5): a curled root knot that, while its heat ≥ 0.5,
 * grows a root segment by segment along an authored spline into a walkable bridge or ramp. Supply
 * ends → the reactor holds (`holdTime`), gutters (`gutterTime` = the wither warning: bark greys and
 * trembles), then the root withers from the knot end. Colliders load ahead of the visible front and
 * unload only behind the withered end; a fox standing on the root retains it until it reaches stable ground.
 */
export type RootSpot = {
  id: string;
  /** Knot centre on the ground */
  knot: THREE.Vector3;
  /** Walk-surface centreline, knot → far end */
  path: Array<[number, number, number]>;
  segments: number;
  /** Walkable width (m) */
  width: number;
  /** Seedwell whose latch makes this root grow for good */
  restoredBy?: string;
};

export type GrowthTunables = ReactorTunables & {
  /** Heat at or above which the root grows */
  growHeat: number;
  /** Seconds to grow one segment */
  segmentTime: number;
  /** Seconds to wither one segment */
  witherSegmentTime: number;
  /** Probe ring radius round the knot (m) */
  probeRing: number;
};

export const GROWTH_DEFAULTS: GrowthTunables = {
  threshold: 0.3,
  igniteTime: 0.35,
  holdTime: 3.0,
  gutterTime: 1.0,
  growHeat: 0.5,
  segmentTime: 1.5,
  witherSegmentTime: 0.7,
  probeRing: 1.0,
};

/** Walk surface sits this far above the braid's axis */
const DECK = 0.36;
/** Collider pieces (m along the root) */
const PIECE = 0.5;
/** Tip taper length (m): the front narrows to a point */
const TIP = 0.9;

type Piece = { c: Collider; s0: number; s1: number };

export type GrowthHooks = {
  /** Per-frame at the moving front while it grows (sparks, leaves) */
  onFront?: (root: Root, p: THREE.Vector3, dt: number) => void;
  /** A stretch of root crumbled (falling bark/leaves) */
  onWither?: (root: Root, p: THREE.Vector3) => void;
  onIgnite?: (root: Root) => void;
  /** The root reached its far end */
  onComplete?: (root: Root) => void;
};

export class Root {
  readonly reactor: Reactor;
  readonly group = new THREE.Group();
  /** Walk-surface curve (arc-length parametrised via getPointAt) */
  readonly curve: THREE.CatmullRomCurve3;
  readonly length: number;
  readonly segLen: number;
  /** Grown length (m from the knot) */
  front = 0;
  /** Withered length (m from the knot) */
  wither = 0;
  /** Fox is on this root, or left it airborne and has not reached stable ground */
  retained = false;
  /** Growth glow 0..1 (eases with growing) */
  glow = 0;
  /** Ignite flare 1 → 0 */
  flare = 0;
  readonly pieces: Piece[] = [];
  readonly bark: THREE.MeshStandardMaterial;
  readonly knotMat: THREE.MeshStandardMaterial;
  readonly leafMat: THREE.MeshStandardMaterial;
  readonly light: THREE.PointLight;
  readonly knotLight: THREE.PointLight;
  readonly debug = new THREE.Group();
  private readonly uni: Record<string, THREE.IUniform>;
  private readonly leaves: THREE.InstancedMesh;
  private readonly leafData: Array<{ s: number; p: THREE.Vector3; q: THREE.Quaternion; size: number }> = [];
  private readonly pieceMat: THREE.LineBasicMaterial[] = [];
  private wasComplete = false;
  private lastWitherFx = 0;
  private readonly tmpM = new THREE.Matrix4();
  private readonly tmpQ = new THREE.Quaternion();
  private readonly tmpS = new THREE.Vector3();
  private readonly tmpE = new THREE.Euler();

  constructor(
    readonly spot: RootSpot,
    readonly tun: GrowthTunables,
    shared: GrowthShared,
    col: CollisionWorld,
  ) {
    const k = spot.knot;
    const probes = [new THREE.Vector3(k.x, k.y + 0.6, k.z)];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.3;
      probes.push(new THREE.Vector3(k.x + Math.cos(a) * tun.probeRing, k.y + 0.6, k.z + Math.sin(a) * tun.probeRing));
    }
    this.reactor = new Reactor(spot.id, 'root', probes, tun);
    this.group.name = `root-${spot.id}`;
    this.curve = new THREE.CatmullRomCurve3(spot.path.map(([x, y, z]) => new THREE.Vector3(x, y, z)), false, 'centripetal');
    this.length = this.curve.getLength();
    this.segLen = this.length / spot.segments;

    // shared uniforms drive bark, knot and leaves together
    this.uni = {
      uFront: { value: 0 },
      uWither: { value: 0 },
      uLife: { value: 0 },
      uGlow: { value: 0 },
      uWarn: { value: 0 },
      uTime: { value: 0 },
      uHeat: { value: 0 },
    };
    this.bark = shared.bark.clone();
    this.knotMat = shared.bark.clone();
    this.patch(this.bark, true);
    this.patch(this.knotMat, false);

    const braid = new THREE.Mesh(buildBraid(this.curve, this.length, hashSeed(spot.id)), this.bark);
    braid.castShadow = true;
    braid.receiveShadow = true;
    braid.frustumCulled = false;
    this.group.add(braid);
    const knot = new THREE.Mesh(buildKnot(k, this.curve, hashSeed(spot.id) + 7), this.knotMat);
    knot.castShadow = true;
    knot.receiveShadow = true;
    this.group.add(knot);

    // leaves unfurl along the grown root (instanced; CPU-scaled near the front)
    this.leafMat = shared.leaf.clone();
    const nLeaf = Math.round(this.length * 9);
    this.leaves = new THREE.InstancedMesh(shared.leafGeo, this.leafMat, nLeaf);
    this.leaves.frustumCulled = false;
    this.leaves.castShadow = true;
    const c = new THREE.Color();
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < nLeaf; i++) {
      const s = ((i + hash(i, 1)) / nLeaf) * this.length;
      const u = s / this.length;
      const p = this.curve.getPointAt(u);
      const tan = this.curve.getTangentAt(u);
      const side = new THREE.Vector3().crossVectors(tan, up).normalize();
      const a = (hash(i, 2) - 0.5) * 2.6; // around the top half of the braid
      const r = 0.42 + hash(i, 3) * 0.12;
      const off = side.clone().multiplyScalar(Math.sin(a) * r * 1.4).addScaledVector(up, Math.cos(a) * r - DECK);
      // keep the walk line mostly clear: leaves sit on the shoulders of the braid
      if (Math.abs(Math.sin(a)) < 0.35) off.addScaledVector(side, (Math.sign(a) || 1) * 0.4);
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-1.1 + hash(i, 4) * 0.8, Math.atan2(side.x, side.z) + Math.sign(a) * 1.2 + (hash(i, 5) - 0.5), (hash(i, 6) - 0.5) * 0.8, 'YXZ'));
      this.leafData.push({ s, p: p.add(off), q, size: 0.16 + hash(i, 7) * 0.14 });
      c.copy(LEAF_COLORS[i % LEAF_COLORS.length]!).multiplyScalar(0.85 + hash(i, 8) * 0.3);
      this.leaves.setColorAt(i, c);
      this.tmpM.makeScale(0, 0, 0);
      this.leaves.setMatrixAt(i, this.tmpM);
    }
    this.group.add(this.leaves);

    // warm light that travels with the growth front, and a heartbeat in the knot
    this.light = new THREE.PointLight(0xffa04a, 0, 9, 1.6);
    this.group.add(this.light);
    this.knotLight = new THREE.PointLight(0xff8a3a, 0, 6, 1.8);
    this.knotLight.position.set(k.x, k.y + 0.7, k.z);
    this.group.add(this.knotLight);

    // collision pieces (disabled until the front reaches them)
    const n = Math.ceil(this.length / PIECE);
    for (let i = 0; i < n; i++) {
      const s0 = (i / n) * this.length;
      const s1 = ((i + 1) / n) * this.length;
      const a = this.curve.getPointAt(s0 / this.length);
      const b = this.curve.getPointAt(s1 / this.length);
      const c2 = col.add(
        boxCollider({
          x: (a.x + b.x) / 2,
          z: (a.z + b.z) / 2,
          w: spot.width,
          d: Math.hypot(b.x - a.x, b.z - a.z) + 0.06,
          yaw: Math.atan2(b.x - a.x, b.z - a.z),
          top: a.y,
          top1: b.y,
          bottom: Math.min(a.y, b.y) - 0.7,
          tag: `root:${spot.id}`,
        }),
      );
      c2.enabled = false;
      this.pieces.push({ c: c2, s0, s1 });
    }

    // debug: walk line, collider pieces (green on / grey off), probes
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(this.curve.getSpacedPoints(60)), new THREE.LineBasicMaterial({ color: 0xffd060, depthTest: false }));
    line.renderOrder = 10;
    this.debug.add(line);
    for (const p of this.pieces) {
      const m = new THREE.LineBasicMaterial({ color: 0x666666, depthTest: false, transparent: true, opacity: 0.9 });
      this.pieceMat.push(m);
      const w = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(spot.width, 0.06, p.c.hz * 2)), m);
      w.position.set(p.c.x, (p.c.top0 + p.c.top1) / 2, p.c.z);
      w.rotation.y = p.c.yaw;
      w.rotation.x = -Math.atan2(p.c.top1 - p.c.top0, p.c.hz * 2);
      w.renderOrder = 10;
      this.debug.add(w);
    }
    const probeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false });
    for (const p of probes) {
      const s = new THREE.Mesh(shared.probeGeo, probeMat);
      s.position.copy(p);
      s.renderOrder = 10;
      this.debug.add(s);
    }
    this.debug.visible = false;
    this.group.add(this.debug);
  }

  /** 0..1 grown */
  get grown(): number {
    return this.front / this.length;
  }

  /** Arc length of the walk surface nearest (x, z) — for the fox-relative front metrics */
  sNear(x: number, z: number): number {
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i <= 80; i++) {
      const p = this.curve.getPointAt(i / 80);
      const d = (p.x - x) ** 2 + (p.z - z) ** 2;
      if (d < bd) {
        bd = d;
        best = (i / 80) * this.length;
      }
    }
    return best;
  }

  /** `foxOn`: fox grounded on this root. `foxStable`: fox grounded on non-temporary ground. */
  update(dt: number, t: number, supplyAt: SupplyFn, debugOn: boolean, foxOn: boolean, foxStable: boolean, hooks: GrowthHooks, drainedAt?: (p: THREE.Vector3) => boolean): void {
    const tun = this.tun;
    this.reactor.update(dt, supplyAt, drainedAt);
    // a lit root always finishes: the hold only starts counting once it is fully grown
    if (this.reactor.state === 'holding' && this.front < this.length && this.reactor.heat >= tun.growHeat) this.reactor.holdLeft = tun.holdTime;
    const heat = this.reactor.heat;
    this.retained = foxOn || (this.retained && !foxStable);
    const growRate = this.segLen / tun.segmentTime;
    const growing = heat >= tun.growHeat && this.front < this.length;
    if (heat >= tun.growHeat) {
      // re-lit mid-wither: the knot end knits back first
      if (this.wither > 0) this.wither = Math.max(0, this.wither - growRate * 2 * dt);
      this.front = Math.min(this.length, this.front + growRate * dt);
    } else if (this.reactor.state === 'cold' && this.front > 0 && !this.retained) {
      const before = this.wither;
      this.wither = Math.min(this.front, this.wither + (this.segLen / tun.witherSegmentTime) * dt);
      if (this.wither - this.lastWitherFx > 0.6 || (before === 0 && this.wither > 0)) {
        this.lastWitherFx = this.wither;
        hooks.onWither?.(this, this.curve.getPointAt(Math.min(1, this.wither / this.length)));
      }
      if (this.wither >= this.front - 1e-4) {
        this.front = 0;
        this.wither = 0;
        this.lastWitherFx = 0;
      }
    }
    if (this.front >= this.length && !this.wasComplete) hooks.onComplete?.(this);
    this.wasComplete = this.front >= this.length;

    // collision-before-load; unload only once the visual has withered past a piece
    for (let i = 0; i < this.pieces.length; i++) {
      const p = this.pieces[i]!;
      const on = this.front > p.s0 + 0.05 && this.wither < p.s1 - 0.05;
      // retained: nothing loaded unloads while the fox is using the chain
      p.c.enabled = on || (this.retained && p.c.enabled);
      this.pieceMat[i]!.color.setHex(p.c.enabled ? 0x40ff70 : 0x555555);
    }

    // look
    this.flare = Math.max(0, this.flare - dt * 1.4);
    this.glow = THREE.MathUtils.damp(this.glow, growing ? 1 : 0, growing ? 6 : 1.5, dt);
    const warn = this.reactor.state === 'guttering' || (this.reactor.state === 'cold' && this.front > 0) ? 1 : 0;
    const life = this.reactor.restored ? 1 : Math.min(1, heat * 1.4 + (this.front > 0 ? 0.35 : 0));
    const u = this.uni;
    u.uFront!.value = this.front;
    u.uWither!.value = this.wither;
    u.uLife!.value = THREE.MathUtils.damp(u.uLife!.value as number, life, 3, dt);
    u.uGlow!.value = this.glow + this.flare * 0.6;
    u.uWarn!.value = THREE.MathUtils.damp(u.uWarn!.value as number, warn, 8, dt);
    u.uTime!.value = t;
    u.uHeat!.value = heat;
    const fp = this.curve.getPointAt(Math.min(1, this.front / this.length));
    this.light.position.set(fp.x, fp.y + 0.4, fp.z);
    this.light.intensity = (this.glow * 5 + this.flare * 3) * (this.front > 0 ? 1 : 0);
    const beat = 0.75 + 0.25 * Math.sin(t * 5.2) * Math.sin(t * 2.6);
    this.knotLight.intensity = (heat * 2.2 + this.flare * 4) * beat;
    if (growing) hooks.onFront?.(this, fp, dt);

    // leaves: unfurl 0.35–1.5 m behind the front; curl and drop as the root withers
    for (let i = 0; i < this.leafData.length; i++) {
      const L = this.leafData[i]!;
      const grow = THREE.MathUtils.clamp((this.front - L.s - 0.35) / 1.15, 0, 1);
      const alive = this.wither > 0 ? THREE.MathUtils.clamp((L.s - this.wither) / 0.5, 0, 1) : 1;
      const k = easeOutBack(grow) * alive;
      if (k <= 0.001) {
        this.tmpM.makeScale(0, 0, 0);
      } else {
        // curled shut (pitched in, folded) → open, with a held-breath tremble while the root warns
        const tremble = (u.uWarn!.value as number) * Math.sin(t * 38 + i) * 0.12;
        this.tmpE.set((1 - grow) * 1.4 + tremble, 0, (1 - grow) * 0.9);
        this.tmpQ.setFromEuler(this.tmpE).premultiply(L.q);
        this.tmpS.set(L.size * k, L.size * k * (0.4 + 0.6 * grow), L.size * k);
        this.tmpM.compose(L.p, this.tmpQ, this.tmpS);
      }
      this.leaves.setMatrixAt(i, this.tmpM);
    }
    this.leaves.instanceMatrix.needsUpdate = true;
    this.leafMat.emissiveIntensity = 0.05 + this.glow * 0.25;
    this.debug.visible = debugOn;
  }

  /** Growth-front reveal, gnarled taper, sap glow, sepia → warm bark, wither warning tremble */
  private patch(m: THREE.MeshStandardMaterial, braid: boolean): void {
    const u = this.uni;
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, u);
      sh.vertexShader = sh.vertexShader
        .replace(
          '#include <common>',
          /* glsl */ `#include <common>
          uniform float uFront, uWither, uWarn, uTime;
          attribute float aS;
          attribute vec3 aAxis;
          varying float vS;
          varying float vUp;
          varying vec3 vWp;`,
        )
        .replace(
          '#include <begin_vertex>',
          braid
            ? /* glsl */ `#include <begin_vertex>
          vS = aS;
          // front: collapse ungrown rings onto the axis, taper the tip to a point
          float kf = clamp((uFront - aS) / ${TIP.toFixed(2)}, 0.0, 1.0);
          float kw = uWither > 0.0 ? clamp((aS - uWither) / 0.5, 0.0, 1.0) : 1.0;
          float k = sqrt(kf) * kw;
          // wither warning: a held-breath shiver
          vec3 shiver = vec3(sin(uTime * 41.0 + aS * 3.0), 0.0, cos(uTime * 37.0 + aS * 2.3)) * 0.018 * uWarn;
          transformed = mix(aAxis, transformed, k) + shiver * step(0.001, k);
          if (k <= 0.0) transformed = aAxis;`
            : /* glsl */ `#include <begin_vertex>
          vS = -1.0;`,
        )
        .replace(
          '#include <worldpos_vertex>',
          /* glsl */ `#include <worldpos_vertex>
          vWp = (modelMatrix * vec4(transformed, 1.0)).xyz;
          vUp = normalize(mat3(modelMatrix) * objectNormal).y;`,
        );
      sh.fragmentShader = sh.fragmentShader
        .replace(
          '#include <common>',
          /* glsl */ `#include <common>
          uniform float uFront, uWither, uLife, uGlow, uWarn, uTime, uHeat;
          varying float vS;
          varying float vUp;
          varying vec3 vWp;
          float gh(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
          float gn(vec3 p) { vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
            return mix(mix(mix(gh(i), gh(i + vec3(1,0,0)), f.x), mix(gh(i + vec3(0,1,0)), gh(i + vec3(1,1,0)), f.x), f.y),
                       mix(mix(gh(i + vec3(0,0,1)), gh(i + vec3(1,0,1)), f.x), mix(gh(i + vec3(0,1,1)), gh(i + vec3(1,1,1)), f.x), f.y), f.z); }`,
        )
        .replace(
          '#include <color_fragment>',
          /* glsl */ `#include <color_fragment>
          // sepia (held breath) → warm living bark; moss settles on the upper faces
          float lum = dot(diffuseColor.rgb, vec3(0.3, 0.55, 0.15));
          vec3 sepia = vec3(lum) * vec3(1.02, 0.9, 0.74) * 0.92;
          float moss = smoothstep(0.35, 0.8, vUp) * smoothstep(0.4, 0.7, gn(vWp * 2.3));
          vec3 living = mix(diffuseColor.rgb, vec3(0.42, 0.40, 0.16), moss * 0.55);
          float life = clamp(uLife - uWarn * 0.45, 0.0, 1.0);
          diffuseColor.rgb = mix(sepia, living, life);`,
        )
        .replace(
          '#include <emissivemap_fragment>',
          /* glsl */ `#include <emissivemap_fragment>
          // sap light: a soft warm band riding the growth front, and ember veins in the bark's furrows
          float behind = uFront - vS;
          float band = vS >= 0.0 ? exp(-max(behind, 0.0) / 0.9) * step(-0.05, behind) : 0.0;
          float veins = smoothstep(0.62, 0.8, gn(vWp * vec3(1.4, 5.0, 1.4) + vec3(0.0, uTime * 0.25, 0.0)));
          float knotBeat = vS < 0.0 ? (0.7 + 0.3 * sin(uTime * 5.2)) * uHeat : 0.0;
          float warnFlick = 1.0 - uWarn * (0.5 + 0.5 * sin(uTime * 24.0));
          totalEmissiveRadiance += vec3(1.0, 0.5, 0.17) * (band * uGlow * 1.6 + veins * (uHeat * 0.35 + knotBeat * 0.9)) * warnFlick;`,
        );
    };
    m.customProgramCacheKey = () => `root-growth-${braid ? 'b' : 'k'}`;
  }
}

type GrowthShared = {
  bark: THREE.MeshStandardMaterial;
  leaf: THREE.MeshStandardMaterial;
  leafGeo: THREE.BufferGeometry;
  probeGeo: THREE.BufferGeometry;
};

function createShared(): GrowthShared {
  const tex = barkTextures(512);
  for (const t of [tex.map, tex.normalMap, tex.roughnessMap]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.needsUpdate = true;
  }
  const bark = new THREE.MeshStandardMaterial({
    name: 'root-bark',
    color: 0xffffff,
    vertexColors: true,
    map: tex.map,
    normalMap: tex.normalMap,
    normalScale: new THREE.Vector2(1.1, 1.1),
    roughnessMap: tex.roughnessMap,
    roughness: 0.92,
    metalness: 0,
    emissive: 0xffffff,
    emissiveIntensity: 1,
  });
  // emissive is added in the shader only (sap band / veins); keep the base emissive black
  bark.emissive.setRGB(0, 0, 0);
  const leafGeo = leafShape(1, 1);
  leafGeo.translate(0, 0.5, 0); // pivot at the stem
  leafGeo.computeVertexNormals();
  const leaf = new THREE.MeshStandardMaterial({ name: 'root-leaf', roughness: 0.75, side: THREE.DoubleSide, emissive: 0x7a2a08, emissiveIntensity: 0.05 });
  return { bark, leaf, leafGeo, probeGeo: new THREE.SphereGeometry(0.08, 8, 6) };
}

// ---------------------------------------------------------------- geometry

function hash(i: number, k: number): number {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return x - Math.floor(x);
}
function hashSeed(s: string): number {
  let h = 7;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 9973;
  return h;
}
function easeOutBack(x: number): number {
  const c = 1.5;
  return x <= 0 ? 0 : x >= 1 ? 1 : 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2;
}

type TubeAcc = { pos: number[]; nor: number[]; uv: number[]; col: number[]; s: number[]; axis: number[]; idx: number[] };

/**
 * Tube along `centre(s)` with per-ring radius; every vertex carries its arc length (aS) and its ring
 * centre (aAxis) so the shader can grow/wither it without rebuilding geometry.
 */
function tube(acc: TubeAcc, rings: number, sides: number, ring: (i: number) => { c: THREE.Vector3; t: THREE.Vector3; r: number; s: number; v: number }, tint: (i: number, j: number, n: THREE.Vector3) => THREE.Color): void {
  const base = acc.pos.length / 3;
  const ref = new THREE.Vector3(0, 1, 0);
  const nrm = new THREE.Vector3();
  const bin = new THREE.Vector3();
  const n = new THREE.Vector3();
  let prevN: THREE.Vector3 | null = null;
  for (let i = 0; i <= rings; i++) {
    const { c, t, r, s, v } = ring(i);
    // parallel-transport-ish frame (stable for gently curving roots)
    if (prevN) nrm.copy(prevN).addScaledVector(t, -prevN.dot(t)).normalize();
    else nrm.crossVectors(t, ref).normalize().cross(t).normalize();
    if (!(nrm.lengthSq() > 0.5)) nrm.set(1, 0, 0);
    prevN = nrm.clone();
    bin.crossVectors(t, nrm).normalize();
    for (let j = 0; j <= sides; j++) {
      const a = (j / sides) * Math.PI * 2;
      // gnarl: lumpy cross-section
      const lump = 1 + (fbm3(c.x * 1.7 + Math.cos(a) * 0.6, c.y * 1.7, c.z * 1.7 + Math.sin(a) * 0.6, 2) - 0.5) * 0.5;
      n.copy(nrm).multiplyScalar(Math.cos(a)).addScaledVector(bin, Math.sin(a)).normalize();
      acc.pos.push(c.x + n.x * r * lump, c.y + n.y * r * lump, c.z + n.z * r * lump);
      acc.nor.push(n.x, n.y, n.z);
      acc.uv.push(j / sides, v);
      const col = tint(i, j, n);
      acc.col.push(col.r, col.g, col.b);
      acc.s.push(s);
      acc.axis.push(c.x, c.y, c.z);
    }
  }
  const row = sides + 1;
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < sides; j++) {
      const a = base + i * row + j;
      acc.idx.push(a, a + row, a + 1, a + 1, a + row, a + row + 1);
    }
  }
}

function toGeometry(acc: TubeAcc): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(acc.pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(acc.nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(acc.uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(acc.col, 3));
  g.setAttribute('aS', new THREE.Float32BufferAttribute(acc.s, 1));
  g.setAttribute('aAxis', new THREE.Float32BufferAttribute(acc.axis, 3));
  g.setIndex(acc.idx);
  g.computeVertexNormals();
  return g;
}

const newAcc = (): TubeAcc => ({ pos: [], nor: [], uv: [], col: [], s: [], axis: [], idx: [] });

/** Three braided strands + hanging rootlets along the walk curve */
function buildBraid(curve: THREE.CatmullRomCurve3, length: number, seed: number): THREE.BufferGeometry {
  const acc = newAcc();
  const up = new THREE.Vector3(0, 1, 0);
  const rings = Math.ceil(length / 0.12);
  const barkC = new THREE.Color();
  const tint = (n: THREE.Vector3, k: number) => barkC.copy(PAL.bark).lerp(PAL.barkLight, 0.35 + 0.5 * k).lerp(PAL.root, n.y < -0.3 ? 0.5 : 0);
  const strands = [
    { ph: 0, rh: 0.3, r: 0.3 },
    { ph: (Math.PI * 2) / 3, rh: 0.3, r: 0.27 },
    { ph: (Math.PI * 4) / 3, rh: 0.3, r: 0.25 },
  ];
  // strands start buried in the knot (s < 0 shows from the first instant of growth)
  const s0 = -0.6;
  strands.forEach((st, k) => {
    tube(
      acc,
      rings,
      9,
      (i) => {
        const s = s0 + ((length - s0) * i) / rings;
        const u = THREE.MathUtils.clamp(s / length, 0, 1);
        const c = curve.getPointAt(u);
        const t = curve.getTangentAt(u);
        const side = new THREE.Vector3().crossVectors(t, up).normalize();
        const tw = st.ph + s * 1.25 + (vnoise3(s * 0.7, k, seed) - 0.5) * 0.8;
        // the braid flattens into a deck: wider than tall
        c.addScaledVector(side, Math.cos(tw) * st.rh * 1.35).addScaledVector(up, Math.sin(tw) * st.rh * 0.55 - DECK);
        if (s < 0) c.addScaledVector(t, s * 0.4).addScaledVector(up, s * 0.5);
        const thick = 1 + 0.55 * Math.exp(-Math.max(s, 0) / 1.4);
        const end = THREE.MathUtils.smoothstep(length - s, 0, 1.2) * 0.6 + 0.4;
        const r = st.r * thick * end * (0.85 + 0.3 * vnoise3(s * 1.3, k * 3.1, seed));
        return { c, t, r, s, v: s * 0.7 };
      },
      (_i, _j, n) => tint(n, vnoise3(n.x * 2, n.y * 2 + k, seed)),
    );
  });
  // rootlets: thin strands dropping from the underside after the front passes
  const nLet = Math.floor(length / 1.1);
  for (let q = 0; q < nLet; q++) {
    const sAt = ((q + 0.5 + (hash(q, seed) - 0.5) * 0.6) / nLet) * length;
    const u = sAt / length;
    const top = curve.getPointAt(u).addScaledVector(up, -DECK - 0.25);
    const t = curve.getTangentAt(u);
    const side = new THREE.Vector3().crossVectors(t, up).normalize();
    top.addScaledVector(side, (hash(q, 2) - 0.5) * 1.0);
    const len = 0.5 + hash(q, 3) * 1.3;
    const swing = new THREE.Vector3((hash(q, 4) - 0.5) * 0.6, 0, (hash(q, 5) - 0.5) * 0.6);
    tube(
      acc,
      8,
      5,
      (i) => {
        const f = i / 8;
        const c = top.clone().addScaledVector(up, -f * len).addScaledVector(swing, f * f);
        return { c, t: new THREE.Vector3(0, -1, 0).addScaledVector(swing, 2 * f).normalize(), r: 0.07 * (1 - f * 0.85), s: sAt + 0.3 + f * len * 0.8, v: f };
      },
      () => barkC.copy(PAL.root).lerp(PAL.barkLight, 0.2),
    );
  }
  return toGeometry(acc);
}

/** The knot: a fist of roots curled into the ground — a held breath, coiled tight */
function buildKnot(k: THREE.Vector3, curve: THREE.CatmullRomCurve3, seed: number): THREE.BufferGeometry {
  const acc = newAcc();
  const barkC = new THREE.Color();
  const toward = curve.getPointAt(0).sub(k).setY(0).normalize();
  const yaw0 = Math.atan2(toward.z, toward.x);
  const coils = 5;
  for (let q = 0; q < coils; q++) {
    const a0 = yaw0 + Math.PI + (q / coils) * Math.PI * 2 + (hash(q, seed) - 0.5) * 0.5;
    const R0 = 1.25 + hash(q, 2) * 0.35;
    const turns = 1.1 + hash(q, 3) * 0.5;
    tube(
      acc,
      28,
      8,
      (i) => {
        const f = i / 28;
        // log spiral curling inward and upward, like a fern head that never opened
        const a = a0 + f * turns * Math.PI * 2;
        const R = R0 * Math.exp(-f * 1.7);
        const y = k.y - 0.15 + Math.sin(f * Math.PI) * 0.55 + f * 0.35;
        const c = new THREE.Vector3(k.x + Math.cos(a) * R, y, k.z + Math.sin(a) * R);
        const t = new THREE.Vector3(-Math.sin(a), 0.2, Math.cos(a)).normalize();
        return { c, t, r: 0.26 * (1 - f * 0.75) + 0.03, s: -1, v: f * 3 };
      },
      (_i, _j, n) => barkC.copy(PAL.bark).lerp(PAL.barkLight, 0.3 + 0.4 * vnoise3(n.x * 3, n.y * 3 + q, seed)),
    );
  }
  // the bole: a lumpy burl the coils grip
  tube(
    acc,
    10,
    12,
    (i) => {
      const f = i / 10;
      const c = new THREE.Vector3(k.x, k.y - 0.3 + f * 1.0, k.z);
      return { c, t: new THREE.Vector3(0, 1, 0), r: 0.62 * Math.sin(0.2 + f * 2.6) + 0.05, s: -1, v: f };
    },
    (_i, _j, n) => barkC.copy(PAL.bark).lerp(PAL.barkLight, 0.25 + 0.4 * vnoise3(n.x * 4, n.z * 4, seed)),
  );
  return toGeometry(acc);
}

// ---------------------------------------------------------------- system

export type GrowthSystem = {
  readonly tun: GrowthTunables;
  readonly roots: Root[];
  /** `groundTag`: tag of the collider the fox stands on (null airborne, 'terrain' on the heightfield) */
  update: (dt: number, t: number, supplyAt: SupplyFn, debugOn: boolean, groundTag: string | null, drainedAt?: (p: THREE.Vector3) => boolean) => void;
  grown: (id: string) => number;
  /** Seedwell latched: its roots grow for good */
  restore: (seedwellId: string) => void;
  state: () => {
    roots: Array<{ id: string; heat: number; state: string; supply: number; holdLeft: number; restored: boolean; front: number; length: number; grown: number; wither: number; retained: boolean; segments: number; collidersOn: number; knot: number[] }>;
    tun: GrowthTunables;
  };
};

export function createGrowth(scene: THREE.Scene, spots: RootSpot[], col: CollisionWorld, opts: { gui?: GUI } & GrowthHooks = {}): GrowthSystem {
  const tun: GrowthTunables = { ...GROWTH_DEFAULTS };
  const shared = createShared();
  const roots = spots.map((s) => new Root(s, tun, shared, col));
  for (const r of roots) {
    scene.add(r.group);
    r.reactor.onIgnite = () => {
      r.flare = 1;
      opts.onIgnite?.(r);
    };
  }
  const sys: GrowthSystem = {
    tun,
    roots,
    update(dt, t, supplyAt, debugOn, groundTag, drainedAt) {
      const stable = groundTag !== null && !groundTag.startsWith('root:');
      for (const r of roots) r.update(dt, t, supplyAt, debugOn, groundTag === `root:${r.spot.id}`, stable, opts, drainedAt);
    },
    grown: (id) => roots.find((r) => r.spot.id === id)?.grown ?? 0,
    restore(seedwellId) {
      for (const r of roots) if (r.spot.restoredBy === seedwellId) r.reactor.restored = true;
    },
    state: () => ({
      roots: roots.map((r) => ({
        id: r.spot.id,
        heat: Number(r.reactor.heat.toFixed(3)),
        state: r.reactor.state,
        supply: Number(r.reactor.supply.toFixed(3)),
        holdLeft: Number(Math.max(0, r.reactor.holdLeft).toFixed(2)),
        restored: r.reactor.restored,
        front: Number(r.front.toFixed(2)),
        length: Number(r.length.toFixed(2)),
        grown: Number(r.grown.toFixed(3)),
        wither: Number(r.wither.toFixed(2)),
        retained: r.retained,
        segments: Math.floor(r.front / r.segLen + 1e-3),
        collidersOn: r.pieces.filter((p) => p.c.enabled).length,
        knot: [r.spot.knot.x, r.spot.knot.y, r.spot.knot.z],
      })),
      tun: { ...tun },
    }),
  };
  if (opts.gui) {
    const f = opts.gui.addFolder('Chem › Growth');
    f.add(tun, 'threshold', 0.05, 0.9, 0.01);
    f.add(tun, 'igniteTime', 0, 1, 0.01);
    f.add(tun, 'holdTime', 0, 8, 0.1);
    f.add(tun, 'gutterTime', 0.2, 3, 0.05).name('witherWarning');
    f.add(tun, 'growHeat', 0.1, 1, 0.01);
    f.add(tun, 'segmentTime', 0.3, 4, 0.05);
    f.add(tun, 'witherSegmentTime', 0.2, 3, 0.05);
    f.close();
  }
  return sys;
}
