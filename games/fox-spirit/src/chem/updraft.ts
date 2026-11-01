import * as THREE from 'three';
import type GUI from 'lil-gui';
import { Reactor, type ReactorTunables, type SupplyFn } from './reactor';

/**
 * Heat element (docs/design/world-1.md §1.3, §5): a cold ash hearth that, while coloured, raises an
 * ember updraft column a gliding fox rides. The column is a first-class volume: radius / height /
 * falloffs are tunables, drawn as a wireframe in debug view.
 */
export type UpdraftTunables = ReactorTunables & {
  /** Column radius (m) — full lift inside 0.6·radius, fading to 0 at radius + 0.5 */
  radius: number;
  /** Lift fades to 0 over this many metres below the column top */
  topFalloff: number;
  /** Glide vy target at full lift (m/s) */
  maxRise: number;
  /** Damp rate toward the target vy (1/s) */
  liftResponse: number;
  /** Fraction of glide speed removed at full radialK, so the stick steers inside the column */
  columnSteer: number;
  /** Centering velocity toward the axis at full radialK (m/s) */
  centerPull: number;
  /** Gravity reduction for a fox falling (not gliding) through the column, at full k */
  fallLift: number;
  /** Probe ring radius around the bowl (m); the fox's colour must reach one of the probes */
  probeRing: number;
};

export const UPDRAFT_DEFAULTS: UpdraftTunables = {
  threshold: 0.3,
  igniteTime: 0.25,
  holdTime: 3.0,
  gutterTime: 0.8,
  radius: 2.2,
  topFalloff: 2.0,
  maxRise: 6.5,
  liftResponse: 4,
  columnSteer: 0.65,
  centerPull: 1.5,
  fallLift: 0.35,
  probeRing: 0.9,
};

export type HearthSpot = { id: string; x: number; y: number; z: number; height?: number; medium?: 'steam' };

/** Height of the hearth's ash bed above its ground point — the column starts here */
const BED_Y = 0.92;

export type Lift = {
  /** heat × radialK × topK */
  k: number;
  radialK: number;
  /** column axis */
  ax: number;
  az: number;
  hearth: Hearth | null;
};

export type RideLog = {
  hearth: string;
  entryFeetY: number;
  entryVy: number;
  baseY: number;
  timeInColumn: number;
  /** First time (s since entry) the feet reached base + 7 m; −1 if never */
  tPlus7: number;
  peakFeetY: number;
  landFeetY: number | null;
  landedOn: string | null;
};

export class Hearth {
  readonly reactor: Reactor;
  readonly group = new THREE.Group();
  /** Column base (ash bed) */
  readonly base: THREE.Vector3;
  height: number;
  readonly ash: THREE.MeshStandardMaterial;
  readonly embers: THREE.ShaderMaterial;
  readonly glow: THREE.ShaderMaterial;
  readonly smoke: THREE.MeshBasicMaterial;
  readonly flame: THREE.ShaderMaterial;
  readonly light: THREE.PointLight;
  readonly smokeMesh: THREE.Mesh;
  readonly debug = new THREE.Group();
  readonly debugMat: THREE.LineBasicMaterial;
  readonly probeMat: THREE.MeshBasicMaterial;
  /** Ignite flare 1 → 0 */
  flare = 0;

  constructor(
    readonly spot: HearthSpot,
    tun: UpdraftTunables,
    shared: HearthShared,
  ) {
    this.height = spot.height ?? 9;
    this.base = new THREE.Vector3(spot.x, spot.y + BED_Y, spot.z);
    const probes = [new THREE.Vector3(spot.x, spot.y + 0.7, spot.z)];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      probes.push(new THREE.Vector3(spot.x + Math.cos(a) * tun.probeRing, spot.y + 0.7, spot.z + Math.sin(a) * tun.probeRing));
    }
    this.reactor = new Reactor(spot.id, 'hearth', probes, tun);
    this.group.position.set(spot.x, spot.y, spot.z);
    this.group.name = `hearth-${spot.id}`;

    // (masonry is realm art: russetKit.hearthBrazier, merged with the world's stone)
    // ash bed: grey, with ember cracks that wake with heat
    this.ash = shared.ash.clone();
    const bed = new THREE.Mesh(shared.bedGeo, this.ash);
    bed.rotation.x = -Math.PI / 2;
    bed.position.y = BED_Y;
    this.group.add(bed);

    // frozen smoke curl: the breath the hearth is holding. Dissolves upward as it lights.
    this.smoke = shared.smoke.clone();
    configureColdInk(this.smoke);
    this.smokeMesh = new THREE.Mesh(shared.smokeGeo, this.smoke);
    this.smokeMesh.position.y = BED_Y;
    this.smokeMesh.rotation.y = (spot.x * 7.1 + spot.z * 3.3) % (Math.PI * 2);
    this.group.add(this.smokeMesh);

    // flame tongues in the bowl
    this.flame = shared.flame.clone();
    const flame = new THREE.Mesh(shared.flameGeo, this.flame);
    flame.position.y = BED_Y - 0.05;
    flame.frustumCulled = false;
    this.group.add(flame);

    // Rising embers and lifted leaves; separate feathered warm-air body (no shell).
    this.embers = shared.embers.clone();
    const pts = new THREE.Points(shared.emberGeo, this.embers);
    pts.position.y = BED_Y;
    pts.frustumCulled = false;
    this.group.add(pts);
    // Rust leaves keep their body color; only the ember points add light.
    const leafMaterial = this.embers.clone();
    leafMaterial.uniforms = this.embers.uniforms;
    leafMaterial.blending = THREE.NormalBlending;
    const leaves = new THREE.Points(shared.leafGeo, leafMaterial);
    leaves.position.y = BED_Y;
    leaves.frustumCulled = false;
    this.group.add(leaves);
    this.glow = shared.glow.clone();
    if (spot.medium === 'steam') {
      this.glow.uniforms.uBodyColor!.value.set(0xc6bfa2);
      this.glow.uniforms.uOpacity!.value = 0.25;
    }
    const haze = new THREE.Mesh(shared.glowGeo, this.glow);
    haze.position.y = BED_Y;
    haze.frustumCulled = false;
    haze.renderOrder = 2;
    this.group.add(haze);

    this.light = new THREE.PointLight(0xff8a3a, 0, 16, 1.6);
    this.light.position.y = BED_Y + 1.2;
    this.group.add(this.light);

    // debug: column wireframe (coloured by heat) + probes
    this.debugMat = new THREE.LineBasicMaterial({ color: 0x4aa8ff, transparent: true, opacity: 0.9, depthTest: false });
    const wire = new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.CylinderGeometry(1, 1, 1, 16, 4, true)), this.debugMat);
    wire.name = 'column';
    wire.renderOrder = 10;
    this.debug.add(wire);
    this.probeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false });
    for (const p of probes) {
      const s = new THREE.Mesh(shared.probeGeo, this.probeMat);
      s.position.set(p.x - spot.x, p.y - spot.y, p.z - spot.z);
      s.renderOrder = 10;
      this.debug.add(s);
    }
    this.debug.visible = false;
    this.group.add(this.debug);
    this.layout(tun);
  }

  /** Re-fit column-sized pieces after a tunable change */
  layout(tun: UpdraftTunables): void {
    const wire = this.debug.getObjectByName('column')!;
    wire.scale.set(tun.radius, this.height, tun.radius);
    wire.position.y = BED_Y + this.height / 2;
    this.embers.uniforms.uHeight!.value = this.height;
    this.embers.uniforms.uRadius!.value = tun.radius;
    this.glow.uniforms.uHeight!.value = this.height;
    this.glow.uniforms.uRadius!.value = tun.radius * 0.85;
  }

  update(dt: number, t: number, supplyAt: SupplyFn, debugOn: boolean, drainedAt?: (p: THREE.Vector3) => boolean): void {
    this.reactor.update(dt, supplyAt, drainedAt);
    const h = this.reactor.heat;
    this.flare = Math.max(0, this.flare - dt * 1.6);
    // guttering flicker: embers/light stutter so the warning reads before lift dies
    const gutter = this.reactor.state === 'guttering' ? 0.55 + 0.45 * Math.sin(t * 31) * Math.sin(t * 17.3) : 1;
    const vis = h * gutter;
    this.embers.uniforms.uTime!.value = t;
    this.embers.uniforms.uHeat!.value = Math.min(1.4, vis * 1.1 + this.flare * 0.7);
    this.glow.uniforms.uTime!.value = t;
    this.glow.uniforms.uHeat!.value = Math.min(1.35, vis * 1.15 + this.flare * 0.65);
    this.flame.uniforms.uTime!.value = t;
    this.flame.uniforms.uHeat!.value = Math.min(1.4, vis + this.flare * 0.8);
    this.ash.emissiveIntensity = 0.04 + vis * 2.6 + this.flare * 2;
    this.light.intensity = (vis * 26 + this.flare * 30) * (0.92 + 0.08 * Math.sin(t * 13.7));
    // the held breath: the frozen curl fades and lifts away as the hearth takes
    (this.smoke.userData.inkTime as {value:number}).value=t;
    this.smoke.opacity = 0.32 * (1 - Math.min(1, h * 1.6));
    this.smokeMesh.visible = this.smoke.opacity > 0.01;
    this.smokeMesh.position.y = BED_Y + h * 1.4;
    this.smokeMesh.scale.setScalar(1 + h * 0.5);
    if (this.spot.medium === 'steam') {
      // Wet heat uses the same lift/reactor, but reads as paper-pale vapor.
      this.embers.uniforms.uHeat!.value = 0;
      this.flame.uniforms.uHeat!.value = 0;
      this.ash.emissiveIntensity = 0.04 + vis * 0.12;
      this.light.intensity = vis * 2.0;
    }
    this.debug.visible = debugOn;
    if (debugOn) {
      const c = this.debugMat.color;
      c.setRGB(0.29, 0.66, 1).lerp(new THREE.Color(1, 0.45, 0.1), h);
      if (this.reactor.state === 'guttering') c.setRGB(1, 0.15, 0.15);
      this.probeMat.color.setRGB(1, 1 - this.reactor.supply, 1 - this.reactor.supply);
    }
  }

  /** Lift factor at the fox's feet; fills `out` when stronger than what it holds */
  liftAt(x: number, feetY: number, z: number, tun: UpdraftTunables, out: Lift): void {
    const h = this.reactor.heat;
    if (h <= 0) return;
    const dy = feetY - this.base.y;
    if (dy < -0.6 || dy > this.height) return;
    const d = Math.hypot(x - this.base.x, z - this.base.z);
    const radialK = 1 - THREE.MathUtils.smoothstep(d, tun.radius * 0.6, tun.radius + 0.5);
    if (radialK <= 0) return;
    const topK = 1 - THREE.MathUtils.smoothstep(dy, this.height - Math.min(tun.topFalloff, this.height), this.height);
    const k = h * radialK * topK;
    if (k > out.k) {
      out.k = k;
      out.radialK = radialK;
      out.ax = this.base.x;
      out.az = this.base.z;
      out.hearth = this;
    }
  }
}

type HearthShared = {
  ash: THREE.MeshStandardMaterial;
  smoke: THREE.MeshBasicMaterial;
  embers: THREE.ShaderMaterial;
  glow: THREE.ShaderMaterial;
  flame: THREE.ShaderMaterial;
  bedGeo: THREE.BufferGeometry;
  smokeGeo: THREE.BufferGeometry;
  flameGeo: THREE.BufferGeometry;
  emberGeo: THREE.BufferGeometry;
  leafGeo: THREE.BufferGeometry;
  glowGeo: THREE.BufferGeometry;
  probeGeo: THREE.BufferGeometry;
};

function crackTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#000';
  g.fillRect(0, 0, 256, 256);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  // glowing coals: soft blobs, brighter toward the centre
  for (let i = 0; i < 70; i++) {
    const a = rnd() * Math.PI * 2;
    const r = Math.sqrt(rnd()) * 110;
    const x = 128 + Math.cos(a) * r;
    const y = 128 + Math.sin(a) * r;
    const s = 6 + rnd() * 16;
    const grd = g.createRadialGradient(x, y, 0, x, y, s);
    const v = 1 - r / 150;
    grd.addColorStop(0, `rgba(255,${Math.floor(120 + 90 * v)},40,${0.55 + 0.45 * v})`);
    grd.addColorStop(1, 'rgba(255,60,10,0)');
    g.fillStyle = grd;
    g.beginPath();
    g.arc(x, y, s, 0, Math.PI * 2);
    g.fill();
  }
  // cracks between the ash plates
  g.strokeStyle = 'rgba(255,150,60,0.9)';
  g.lineWidth = 1.6;
  for (let i = 0; i < 26; i++) {
    let x = 128 + (rnd() - 0.5) * 180;
    let y = 128 + (rnd() - 0.5) * 180;
    g.beginPath();
    g.moveTo(x, y);
    for (let k = 0; k < 6; k++) {
      x += (rnd() - 0.5) * 34;
      y += (rnd() - 0.5) * 34;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function configureColdInk(smoke: THREE.MeshBasicMaterial): void {
  smoke.userData.inkTime={value:0};
  smoke.onBeforeCompile=shader=>{
    shader.uniforms.uInkTime=smoke.userData.inkTime;
    shader.vertexShader='varying vec3 vInkP; varying vec3 vInkN; varying vec3 vInkV; uniform float uInkTime;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      transformed.x+=sin(position.y*2.1+uInkTime*.3)*.035;
      vInkP=position; vInkN=normalize(normalMatrix*normal);
      vInkV=normalize(-(modelViewMatrix*vec4(transformed,1.)).xyz);`);
    shader.fragmentShader='varying vec3 vInkP; varying vec3 vInkN; varying vec3 vInkV; uniform float uInkTime;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <alphamap_fragment>',`#include <alphamap_fragment>
      float noise=.5+.5*sin(vInkP.y*6.0+sin(vInkP.x*9.0+uInkTime*.4)*1.3-uInkTime*.35);
      float edge=smoothstep(.0,.55,abs(dot(normalize(vInkN),normalize(vInkV))));
      diffuseColor.a*=edge*mix(.35,1.,noise)*(1.-smoothstep(.8,2.6,vInkP.y));`);
  };
  smoke.customProgramCacheKey=()=> 'hearth-cold-ink-smoke-v1';
}

function createShared(): HearthShared {
  const crack = crackTexture();
  const ash = new THREE.MeshStandardMaterial({
    name: 'chem-hearth-ash',
    color: 0x3b3531,
    roughness: 1,
    emissive: 0xffffff,
    emissiveMap: crack,
    emissiveIntensity: 0.04,
  });
  const bedGeo = new THREE.CircleGeometry(0.66, 24);

  // frozen smoke curl: a tapered ribbon spiralling ~2.6 m up, hanging still
  const smokeGeo = (() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 24; i++) {
      const u = i / 24;
      const a = u * Math.PI * 2.4;
      const r = 0.12 + u * 0.55;
      pts.push(new THREE.Vector3(Math.cos(a) * r, 0.1 + u * 2.6, Math.sin(a) * r));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const g = new THREE.TubeGeometry(curve, 64, 0.11, 7, false);
    // taper + swell: thin at the coals, puffed in the middle, wisping out at the top
    const p = g.attributes.position as THREE.BufferAttribute;
    const segs = 65;
    const ring = 8;
    for (let s = 0; s < segs; s++) {
      const u = s / (segs - 1);
      const c = curve.getPointAt(u);
      const w = 0.35 + 1.6 * Math.sin(Math.PI * Math.pow(u, 0.7)) * (1 - u * 0.4);
      for (let r = 0; r < ring; r++) {
        const i = s * ring + r;
        if (i >= p.count) continue;
        p.setXYZ(i, c.x + (p.getX(i) - c.x) * w, p.getY(i), c.z + (p.getZ(i) - c.z) * w);
      }
    }
    g.computeVertexNormals();
    return g;
  })();
  const smoke = new THREE.MeshBasicMaterial({ name:'hearth-cold-ink-smoke', color:0x302720, transparent:true, opacity:.32, depthWrite:false, side:THREE.DoubleSide, fog:true });
  configureColdInk(smoke);

  // rising embers + a few lifted leaves, animated entirely in the vertex shader
  const N_EMBER = 220;
  const N_LEAF = 36;
  const emberGeo = new THREE.BufferGeometry();
  const N_ALL = N_EMBER + N_LEAF;
  const seeds = new Float32Array(N_ALL * 4);
  let s = 11;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < N_ALL; i++) {
    seeds[i * 4] = rnd();
    seeds[i * 4 + 1] = rnd();
    seeds[i * 4 + 2] = rnd();
    seeds[i * 4 + 3] = i < N_EMBER ? 0 : 1;
  }
  emberGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N_ALL * 3), 3));
  emberGeo.setAttribute('seed', new THREE.BufferAttribute(seeds, 4));
  emberGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 5, 0), 12);
  const leafGeo = new THREE.BufferGeometry();
  leafGeo.setAttribute('position', emberGeo.getAttribute('position'));
  leafGeo.setAttribute('seed', emberGeo.getAttribute('seed'));
  leafGeo.setDrawRange(N_EMBER, N_LEAF);
  emberGeo.setDrawRange(0, N_EMBER);
  const embers = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uHeat: { value: 0 }, uHeight: { value: 9 }, uRadius: { value: 2.2 }, uScale: { value: 640 } },
    vertexShader: /* glsl */ `
      attribute vec4 seed;
      uniform float uTime, uHeat, uHeight, uRadius, uScale;
      varying float vA;
      varying float vLeaf;
      varying float vHot;
      varying float vSpin;
      void main() {
        float leaf = seed.w > 0.5 && seed.w < 1.5 ? 1.0 : 0.0;
        float speed = leaf > 0.5 ? mix(2.2, 3.4, seed.y) : mix(3.6, 6.8, seed.y);
        float ph = fract(seed.x + uTime * speed / uHeight);
        float y = ph * uHeight * (leaf > 0.5 ? 0.95 : 1.0);
        float turn = uTime * (leaf > 0.5 ? 1.1 : 1.6 + seed.y) + ph * 5.0;
        float a = seed.z * 6.2832 + turn;
        float r = uRadius * (leaf > 0.5 ? 0.35 + 0.45 * seed.y : 0.08 + 0.7 * sqrt(seed.y)) * (0.55 + 0.45 * ph);
        vec3 p = vec3(cos(a) * r, y, sin(a) * r);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float fade = smoothstep(0.0, 0.06, ph) * (1.0 - smoothstep(0.55, 1.0, ph));
        // a cold column shows nothing; heat thins the stream rather than dimming it all evenly
        float alive = step(seed.y * 0.85, uHeat);
        vA = fade * alive * min(1.0, uHeat * 1.4);
        // Lifted leaves must dissolve before a foreground sprite covers the fox.
        // Keep distant column leaves and additive embers at their authored weight.
        vA *= mix(1.0, smoothstep(0.8, 2.0, -mv.z), leaf);
        vLeaf = leaf;
        vHot = 1.0 - ph;
        vSpin = seed.z * 6.2832 + uTime * (1.5 + seed.y * 2.0);
        float size = leaf > 0.5 ? mix(0.22, 0.38, seed.x) : mix(0.08, 0.18, seed.x) * (1.3 - ph * 0.5);
        gl_PointSize = size * uScale / max(0.5, -mv.z);
      }`,
    fragmentShader: /* glsl */ `
      varying float vA;
      varying float vLeaf;
      varying float vHot;
      varying float vSpin;
      void main() {
        vec2 q = gl_PointCoord - 0.5;
        if (vLeaf > 0.5) {
          // turning maple-ish leaf: rotated lens with a notch, warm rust lit from below
          float c = cos(vSpin), s = sin(vSpin);
          vec2 r = vec2(c * q.x - s * q.y, s * q.x + c * q.y);
          r.x *= 1.0 + 0.6 * abs(sin(vSpin * 0.7));
          float d = length(vec2(r.x * 1.6, r.y)) - 0.42 + 0.08 * cos(atan(r.y, r.x) * 5.0);
          if (d > 0.0) discard;
          vec3 col = mix(vec3(0.55, 0.16, 0.05), vec3(0.95, 0.42, 0.12), 0.5 + 0.5 * sin(vSpin));
          col *= 0.8 + vHot * 0.6;
          gl_FragColor = vec4(pow(col, vec3(2.2)), vA * 0.95); // authored in sRGB
        } else {
          float d = length(q);
          float core = exp(-d * d * 38.0) * (1.0 - smoothstep(0.32, 0.5, d));
          if (core < 0.02) discard;
          vec3 hot = vec3(1.0, 0.42, 0.1);
          vec3 cool = vec3(0.75, 0.12, 0.02);
          gl_FragColor = vec4(mix(cool, hot, vHot * vHot) * 1.5, core * vA);
        }
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  // Warm air is a collection of soft moving parcels, never a continuous tube.
  // Seeded quad centers travel in world space; billboard only their soft footprint.
  const glowGeo = (() => {
    const positions: number[] = [], uvs: number[] = [], seeds: number[] = [];
    for (let i = 0; i < 28; i++) {
      const seed = [rnd(), rnd(), rnd(), rnd()];
      for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]]) {
        positions.push(x!, y!, 0);
        uvs.push(x! * 0.5 + 0.5, y! * 0.5 + 0.5);
        seeds.push(...seed);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setAttribute('seed', new THREE.Float32BufferAttribute(seeds, 4));
    return geo;
  })();
  const glow = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uHeat: { value: 0 }, uHeight: { value: 9 }, uRadius: { value: 1.9 }, uBodyColor: { value: new THREE.Color(0.56, 0.24, 0.075) }, uOpacity: { value: 0.12 } },
    vertexShader: /* glsl */ `
      attribute vec4 seed;
      uniform float uTime, uHeight, uRadius;
      varying vec2 vUv;
      varying float vLife, vSeed;
      void main() {
        float life = fract(seed.x + uTime * mix(1.5, 2.7, seed.y) / uHeight);
        float a = seed.z * 6.2832 + life * 2.1 + uTime * 0.18;
        float r = uRadius * sqrt(seed.w) * (0.18 + life * 0.55);
        vec3 center = vec3(cos(a) * r, life * uHeight, sin(a) * r);
        center.x += sin(life * 7.0 + uTime * 0.7 + seed.z * 9.0) * life * 0.28;
        vec4 mv = modelViewMatrix * vec4(center, 1.0);
        float size = mix(0.7, 1.25, seed.y) * (0.65 + life * 0.7);
        mv.xy += position.xy * vec2(size, size * 1.5);
        gl_Position = projectionMatrix * mv;
        vUv = uv;
        vLife = life;
        vSeed = seed.z * 17.0;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uHeat;
      varying vec2 vUv;
      varying float vLife, vSeed;
      uniform vec3 uBodyColor;
      uniform float uOpacity;
      void main() {
        vec2 q = (vUv - 0.5) * 2.0;
        // Wavering interior with a guaranteed zero-alpha border on all four edges.
        float warp = sin(q.y * 5.0 - uTime * 1.9 + vSeed) * 0.12;
        float d = length(vec2(q.x + warp * (1.0 - abs(q.x)), q.y));
        float feather = 1.0 - smoothstep(0.1, 1.0, d);
        float folds = 0.65 + 0.35 * sin(q.y * 7.0 - uTime * 2.4 + vSeed + q.x * 3.0);
        float life = smoothstep(0.0, 0.16, vLife) * (1.0 - smoothstep(0.55, 1.0, vLife));
        float alpha = min(1.0, uHeat) * life * feather * feather * folds * uOpacity;
        // Body is alpha-composited russet air; ember cores provide the glow separately.
        gl_FragColor = vec4(uBodyColor, alpha);
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });

  // flame tongues: crossed quads with an animated teardrop
  const flameGeo = (() => {
    const pos: number[] = [];
    const uv: number[] = [];
    const ph: number[] = [];
    const tongues: Array<[number, number, number, number]> = [
      // x, z, height, width
      [0, 0, 0.95, 0.7],
      [0.26, 0.1, 0.62, 0.5],
      [-0.2, 0.22, 0.7, 0.5],
      [-0.12, -0.26, 0.55, 0.45],
      [0.18, -0.2, 0.5, 0.42],
    ];
    tongues.forEach(([x, z, h, w], k) => {
      for (const rot of [0.3 + k, 0.3 + k + Math.PI / 2]) {
        const c = Math.cos(rot) * w * 0.5;
        const sn = Math.sin(rot) * w * 0.5;
        const quad = [
          [x - c, 0, z - sn, 0, 0], [x + c, 0, z + sn, 1, 0], [x + c, h, z + sn, 1, 1],
          [x - c, 0, z - sn, 0, 0], [x + c, h, z + sn, 1, 1], [x - c, h, z - sn, 0, 1],
        ];
        for (const [px, py, pz, u, v] of quad) {
          pos.push(px!, py!, pz!);
          uv.push(u!, v!);
          ph.push(k * 1.7);
        }
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('phase', new THREE.Float32BufferAttribute(ph, 1));
    return g;
  })();
  const flame = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uHeat: { value: 0 } },
    vertexShader: /* glsl */ `
      uniform float uHeat;
      attribute float phase;
      varying vec2 vUv;
      varying float vPh;
      void main() {
        vUv = uv;
        vPh = phase;
        vec3 p = position;
        p.y *= max(0.001, uHeat);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uHeat;
      varying vec2 vUv;
      varying float vPh;
      void main() {
        float y = vUv.y;
        float t = uTime + vPh;
        float x = (vUv.x - 0.5) * 2.0;
        float sway = 0.16 * sin(t * 9.0 + y * 6.0) * y;
        float w = (1.0 - y) * (0.55 + 0.25 * sin(t * 13.0 + y * 11.0));
        float d = abs(x + sway) / max(0.02, w);
        float a = (1.0 - smoothstep(0.4, 1.0, d)) * smoothstep(0.0, 0.08, y) * (1.0 - smoothstep(0.55, 1.0, y));
        // ten crossed tongues overlap additively: keep each one dim and orange so the stack never blooms white
        vec3 col = mix(vec3(1.0, 0.45, 0.12), vec3(0.85, 0.16, 0.02), smoothstep(0.0, 0.5, y + d * 0.35));
        float k = a * min(1.0, uHeat) * 0.8;
        gl_FragColor = vec4(col * 0.7 * k, k);
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });

  return {
    ash,
    smoke,
    embers,
    glow,
    flame,
    bedGeo,
    smokeGeo,
    flameGeo,
    emberGeo,
    leafGeo,
    glowGeo,
    probeGeo: new THREE.SphereGeometry(0.12, 8, 6),
  };
}

export type UpdraftSystem = {
  readonly tun: UpdraftTunables;
  readonly hearths: Hearth[];
  lastRide: RideLog | null;
  update: (dt: number, t: number, supplyAt: SupplyFn, debugOn: boolean, drainedAt?: (p: THREE.Vector3) => boolean) => void;
  liftAt: (x: number, feetY: number, z: number, out?: Lift) => Lift;
  /** Per-step ride bookkeeping (ride log for acceptance) */
  trackRide: (dt: number, feetY: number, vy: number, grounded: boolean, lift: Lift, groundTag: string | null) => void;
  state: () => {
    hearths: Array<{ id: string; heat: number; state: string; supply: number; holdLeft: number; restored: boolean; pos: number[]; height: number }>;
    lastRide: RideLog | null;
    tun: UpdraftTunables;
  };
};

export function createUpdrafts(
  scene: THREE.Scene,
  spots: HearthSpot[],
  opts: { gui?: GUI; onIgnite?: (h: Hearth) => void } = {},
): UpdraftSystem {
  const tun: UpdraftTunables = { ...UPDRAFT_DEFAULTS };
  const shared = createShared();
  const hearths = spots.map((s) => new Hearth(s, tun, shared));
  for (const h of hearths) {
    scene.add(h.group);
    h.reactor.onIgnite = () => {
      h.flare = 1;
      opts.onIgnite?.(h);
    };
  }
  const tmp: Lift = { k: 0, radialK: 0, ax: 0, az: 0, hearth: null };
  let ride: RideLog | null = null;
  let rideT = 0;
  const sys: UpdraftSystem = {
    tun,
    hearths,
    lastRide: null,
    update(dt, t, supplyAt, debugOn, drainedAt) {
      for (const h of hearths) h.update(dt, t, supplyAt, debugOn, drainedAt);
    },
    liftAt(x, feetY, z, out = tmp) {
      out.k = 0;
      out.radialK = 0;
      out.hearth = null;
      for (const h of hearths) h.liftAt(x, feetY, z, tun, out);
      return out;
    },
    trackRide(dt, feetY, vy, grounded, lift, groundTag) {
      if (!ride && lift.hearth && !grounded && lift.k > 0.05) {
        ride = {
          hearth: lift.hearth.spot.id,
          entryFeetY: Number(feetY.toFixed(2)),
          entryVy: Number(vy.toFixed(2)),
          baseY: Number(lift.hearth.base.y.toFixed(2)),
          timeInColumn: 0,
          tPlus7: -1,
          peakFeetY: feetY,
          landFeetY: null,
          landedOn: null,
        };
        rideT = 0;
        sys.lastRide = ride;
      }
      if (!ride) return;
      rideT += dt;
      if (lift.k > 0.05) ride.timeInColumn = Number((ride.timeInColumn + dt).toFixed(3));
      if (ride.tPlus7 < 0 && feetY >= ride.baseY + 7) ride.tPlus7 = Number(rideT.toFixed(3));
      ride.peakFeetY = Math.max(ride.peakFeetY, Number(feetY.toFixed(2)));
      if (grounded && rideT > 0.1) {
        ride.landFeetY = Number(feetY.toFixed(2));
        ride.landedOn = groundTag;
        ride = null;
      }
    },
    state() {
      return {
        hearths: hearths.map((h) => ({
          id: h.spot.id,
          heat: Number(h.reactor.heat.toFixed(3)),
          state: h.reactor.state,
          supply: Number(h.reactor.supply.toFixed(3)),
          holdLeft: Number(Math.max(0, h.reactor.holdLeft).toFixed(2)),
          restored: h.reactor.restored,
          pos: [h.base.x, h.base.y, h.base.z],
          height: h.height,
        })),
        lastRide: sys.lastRide,
        tun: { ...tun },
      };
    },
  };

  if (opts.gui) {
    const f = opts.gui.addFolder('Chem › Updraft');
    const relayout = () => hearths.forEach((h) => h.layout(tun));
    f.add(tun, 'threshold', 0.05, 0.9, 0.01);
    f.add(tun, 'igniteTime', 0, 1, 0.01);
    f.add(tun, 'holdTime', 0, 8, 0.1);
    f.add(tun, 'gutterTime', 0.2, 2, 0.05);
    f.add(tun, 'radius', 1, 3.5, 0.05).onChange(relayout);
    f.add(tun, 'topFalloff', 0.5, 6, 0.1);
    f.add(tun, 'maxRise', 2, 12, 0.1);
    f.add(tun, 'liftResponse', 1, 12, 0.1);
    f.add(tun, 'columnSteer', 0, 0.9, 0.01);
    f.add(tun, 'centerPull', 0, 4, 0.05);
    f.add(tun, 'fallLift', 0, 1, 0.01);
    f.close();
  }
  return sys;
}
