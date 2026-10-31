import * as THREE from 'three';

/** Visual drain shares the gameplay cylinder's height, with a soft painterly XZ boundary. */
const MAX_VISUAL_DRAINS = 16;
/** Uniforms for a field with no paint layer (paint disabled in the shader). */
const NO_PAINT = {
  uPaintMap: { value: null as THREE.Texture | null },
  uWetMap: { value: null as THREE.Texture | null },
  uClimbMap: { value: null as THREE.Texture | null },
  uGroundMap: { value: null as THREE.Texture | null },
  uPaintBounds: { value: new THREE.Vector4(0, 1, 0, 1) },
  uPaintOn: { value: 0 },
};
export const VISUAL_DRAIN_GLSL = /* glsl */ `
  uniform vec4 uVisualDrains[16];
  uniform int uVisualDrainCount;
  float temporaryVisibilityAt(vec3 p) {
    if (uVisualDrainCount == 0) return 1.0;
    float visibility = 1.0;
    float brush = sin(p.x * 1.7 + sin(p.z * 1.3)) * 0.065
                + sin(p.z * 3.1 + p.x * 0.7) * 0.035;
    for (int i = 0; i < 16; i++) {
      if (i >= uVisualDrainCount) break;
      vec4 drain = uVisualDrains[i];
      float distanceXZ = distance(p.xz, drain.xz) + brush;
      float feather = min(0.75, drain.w * 0.35);
      float influence = (1.0 - smoothstep(drain.w - feather, drain.w, distanceXZ))
                      * (1.0 - smoothstep(3.5, 4.0, abs(p.y - drain.y)));
      visibility = min(visibility, 1.0 - influence);
    }
    return visibility;
  }
`;

export type TrailSample = { x: number; y: number; z: number; life: number };

/** A deliberate colour stroke (the fox's dash): a capsule a→b that outlives the trail and can exceed 1. */
export type ColorStroke = { a: THREE.Vector3; b: THREE.Vector3; life: number; strength: number; radius: number };

export type RestoreRegion = {
  center: THREE.Vector3;
  targetRadius: number;
  radius: number;
  durationS: number;
  age: number;
  /** 0..1 completion of the wavefront */
  t: number;
  /** Radius fraction (0..1) at an age in seconds; default ease-out cubic over durationS */
  profile?: (ageS: number) => number;
  /** Max soft-edge half-width (m). Large restores keep a crisp, readable front instead of a 30 m smear. */
  edgeMax: number;
  /** Leading warm light band strength 0..1 (set from the expansion; 0 once settled) */
  rim: number;
};

export type RestoreOptions = {
  /** Radius fraction (0..1) at an age in seconds. Overrides the default ease-out over durationS. */
  profile?: (ageS: number) => number;
  /** Max soft-edge half-width in metres (default: proportional to radius). */
  edgeMax?: number;
};

export type ColorFieldOptions = {
  auraRadius?: number;
  trailMax?: number;
  trailDepositInterval?: number;
  trailLife?: number;
  trailRadius?: number;
  /** World XZ bounds for mask RT sampling */
  bounds?: { minX: number; maxX: number; minZ: number; maxZ: number };
  maskSize?: number;
};

/**
 * World-space color restoration:
 *  (a) radius around fox
 *  (b) decaying trail (ring buffer)
 *  (c) permanent restored regions with painterly noise-edged wavefront
 *
 * Materials patched via onBeforeCompile get faded-sepia grade → autumn chroma by mask.
 * Fox / wisps should NOT be patched (stay saturated).
 */
export class ColorField {
  fox = new THREE.Vector3();
  auraRadius: number;
  trail: TrailSample[] = [];
  trailMax: number;
  trailDepositInterval: number;
  trailLife: number;
  trailRadius: number;
  private _accum = 0;
  restores: RestoreRegion[] = [];
  strokes: ColorStroke[] = [];
  /** Visual-only active Shade volumes; raw sample() remains unchanged for gameplay supply probes. */
  visualDrains: Array<{ center: THREE.Vector3; radius: number }> = [];
  /** Shared renderer uniforms for world materials and the leaf mask consumer. */
  readonly visualDrainUniforms = {
    uVisualDrains: { value: Array.from({ length: MAX_VISUAL_DRAINS }, () => new THREE.Vector4()) },
    uVisualDrainCount: { value: 0 },
  };
  /** Walkable height under (x, z) — airborne trail fades out of the ground mask with height (no decal band under a glide) */
  groundAt: ((x: number, z: number) => number) | null = null;
  /** Visual-only warmth (e.g. a lit hearth tinting its surroundings): stamped into the mask, never read by sample() */
  glows: Array<{ x: number; z: number; radius: number; strength: number }> = [];
  /** Strokes fade linearly to 0 over their last `strokeFade` seconds */
  strokeFade = 1.5;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  /** Global fill 0..1 (debug / end state) */
  globalColor = 0;
  /** Simulation clock (s) driving edge noise — advanced by update(), so captures are deterministic */
  time = 0;
  /** Persistent fox paint (shared by regional fields). Assign before materials compile. */
  paint: PaintLayer | null = null;

  /** Optional top-down mask RT (permanent + soft trail splat). Built lazily. */
  private maskRT: THREE.WebGLRenderTarget | null = null;
  private maskScene: THREE.Scene | null = null;
  private maskCam: THREE.OrthographicCamera | null = null;
  private fadeMat: THREE.ShaderMaterial | null = null;
  private stampMat: THREE.ShaderMaterial | null = null;
  private stampMesh: THREE.InstancedMesh | null = null;
  private stampStrength: THREE.InstancedBufferAttribute | null = null;
  private stampNoise: THREE.InstancedBufferAttribute | null = null;
  private stampInner: THREE.InstancedBufferAttribute | null = null;
  private stampRestore: THREE.InstancedBufferAttribute | null = null;
  private stampDrainSource: THREE.InstancedBufferAttribute | null = null;
  private static readonly MAX_STAMPS = 128;
  private readonly _stampMatrix = new THREE.Matrix4();
  private maskSize: number;
  private _renderer: THREE.WebGLRenderer | null = null;

  constructor(opts: ColorFieldOptions = {}) {
    this.auraRadius = opts.auraRadius ?? 2.6;
    this.trailMax = opts.trailMax ?? 64;
    this.trailDepositInterval = opts.trailDepositInterval ?? 0.04;
    this.trailLife = opts.trailLife ?? 2.6;
    this.trailRadius = opts.trailRadius ?? 1.4;
    this.bounds = opts.bounds ?? { minX: -24, maxX: 24, minZ: -24, maxZ: 24 };
    this.maskSize = opts.maskSize ?? 512;
  }

  setWorldBounds(minX: number, maxX: number, minZ: number, maxZ: number): void {
    this.bounds = { minX, maxX, minZ, maxZ };
    this.rebuildMaskCam();
  }

  setFox(pos: THREE.Vector3): void {
    this.fox.copy(pos);
  }

  /** Permanently restore a region with a painterly expanding wavefront. */
  restore(center: THREE.Vector3, radius: number, durationS = 2.2, opts: RestoreOptions = {}): RestoreRegion {
    const r: RestoreRegion = {
      center: center.clone(),
      targetRadius: radius,
      radius: 0,
      durationS: Math.max(0.2, durationS),
      age: 0,
      t: 0,
      profile: opts.profile,
      edgeMax: opts.edgeMax ?? Infinity,
      rim: 0,
    };
    this.restores.push(r);
    return r;
  }

  /** Lay a stroke (e.g. along a dash). Extend it by moving `b` while the dash runs. */
  stroke(a: THREE.Vector3, b: THREE.Vector3, opts: { life?: number; strength?: number; radius?: number } = {}): ColorStroke {
    const s: ColorStroke = { a: a.clone(), b: b.clone(), life: opts.life ?? 6, strength: opts.strength ?? 1.5, radius: opts.radius ?? 1.6 };
    this.strokes.push(s);
    return s;
  }

  /** Current strength of a stroke (strength, fading to 0 over its last strokeFade seconds). */
  strokeStrength(s: ColorStroke): number {
    return s.strength * Math.min(1, s.life / this.strokeFade);
  }

  /** Max stroke contribution at p (may exceed 1: fresh strokes punch through drains). */
  strokeAt(p: THREE.Vector3): number {
    let best = 0;
    for (const s of this.strokes) {
      const d = distToSegment(p, s.a, s.b);
      if (d >= s.radius) continue;
      const k = 1 - THREE.MathUtils.smoothstep(d, s.radius * 0.6, s.radius);
      best = Math.max(best, this.strokeStrength(s) * k);
    }
    return best;
  }

  /** Soft-edge half-width of a restore front at its current radius (m). */
  static edgeOf(r: RestoreRegion): number {
    return Math.min(r.radius * 0.18, r.edgeMax);
  }

  update(dt: number): void {
    this.time += dt;
    this._accum += dt;
    for (const t of this.trail) t.life -= dt;
    this.trail = this.trail.filter((t) => t.life > 0);
    for (const s of this.strokes) s.life -= dt;
    if (this.strokes.length) this.strokes = this.strokes.filter((s) => s.life > 0);
    if (this._accum >= this.trailDepositInterval) {
      this._accum = 0;
      this.trail.push({ x: this.fox.x, y: this.fox.y, z: this.fox.z, life: this.trailLife });
      if (this.trail.length > this.trailMax) this.trail.shift();
    }
    for (const r of this.restores) {
      r.age += dt;
      r.t = Math.min(1, r.age / r.durationS);
      // ease-out cubic wavefront unless the caller authored the timing
      const e = r.profile ? THREE.MathUtils.clamp(r.profile(r.age), 0, 1) : 1 - Math.pow(1 - r.t, 3);
      r.radius = r.targetRadius * e;
      // warm light band rides the front while it travels, then fades as it settles
      r.rim = THREE.MathUtils.smoothstep(r.radius, 0.3, 2.5) * (1 - THREE.MathUtils.smoothstep(r.t, 0.82, 1));
    }
  }

  /** Saturation 0..1 at a world point (gameplay probes). */
  sample(p: THREE.Vector3): number {
    let s = this.globalColor;
    for (const r of this.restores) {
      const d = Math.hypot(p.x - r.center.x, p.z - r.center.z);
      // soft noise-ish edge approx on CPU (ground plane distance, like the shader)
      const edge = ColorField.edgeOf(r) * 0.66;
      const local = 1 - THREE.MathUtils.smoothstep(d, r.radius - edge, r.radius + edge);
      s = Math.max(s, local);
    }
    const aura = 1 - Math.min(1, p.distanceTo(this.fox) / this.auraRadius);
    s = Math.max(s, Math.pow(Math.max(0, aura), 1.15));
    for (const t of this.trail) {
      const d = Math.hypot(p.x - t.x, p.y - t.y, p.z - t.z);
      const fall = 1 - Math.min(1, d / this.trailRadius);
      s = Math.max(s, fall * (t.life / this.trailLife));
    }
    if (this.strokes.length) s = Math.max(s, this.strokeAt(p));
    return THREE.MathUtils.clamp(s, 0, 1);
  }

  /**
   * Init mask RT (call once with the game renderer). Optional — shader uniforms
   * still work without it; RT improves trail continuity when stamped each frame.
   */
  initMask(renderer: THREE.WebGLRenderer): void {
    this._renderer = renderer;
    this.maskRT = new THREE.WebGLRenderTarget(this.maskSize, this.maskSize, {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      magFilter: THREE.LinearFilter,
      minFilter: THREE.LinearFilter,
    });
    // clear to black (no color)
    renderer.setRenderTarget(this.maskRT);
    renderer.setClearColor(0x000000, 1);
    renderer.clear();
    renderer.setRenderTarget(null);

    this.maskScene = new THREE.Scene();
    this.maskCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    this.rebuildMaskCam();

    this.fadeMat = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null as THREE.Texture | null },
        uFade: { value: 0.985 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse;
        uniform float uFade;
        varying vec2 vUv;
        void main() {
          gl_FragColor = texture2D(tDiffuse, vUv) * uFade;
        }`,
      depthTest: false,
      depthWrite: false,
    });

    // All stamps (restores + fox + trail) go out as one instanced draw per frame
    this.stampMat = new THREE.ShaderMaterial({
      uniforms: {},
      transparent: true,
      // Sources combine by strongest contribution, exactly as sample() does.
      // Summing overlapping trail stamps turned their soft edges into a hard disc.
      blending: THREE.CustomBlending,
      blendEquation: THREE.MaxEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide, // mask camera views stamps from below
      vertexShader: /* glsl */ `
        attribute float aStrength;
        attribute float aNoise;
        attribute float aInner;
        attribute vec2 aRestore;
        attribute vec2 aDrainSource;
        varying vec2 vDrainSource;
        varying vec2 vRestore;
        varying vec2 vCenter;
        varying vec2 vUv;
        varying float vStrength;
        varying float vNoise;
        varying float vInner;
        varying vec2 vWorld;
        void main() {
          vUv = uv;
          vWorld = (instanceMatrix * vec4(position, 1.0)).xz;
          vStrength = aStrength;
          vNoise = aNoise;
          vInner = aInner;
          vRestore = aRestore;
          vDrainSource = aDrainSource;
          vCenter = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xz;
          gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        varying vec2 vDrainSource;
        varying vec2 vUv;
        varying float vStrength;
        varying float vNoise;
        varying float vInner;
        varying vec2 vRestore;
        varying vec2 vCenter;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
        float noise(vec2 p){
          vec2 i = floor(p); vec2 f = fract(p);
          float a = hash(i), b = hash(i+vec2(1.,0.)), c = hash(i+vec2(0.,1.)), d = hash(i+vec2(1.,1.));
          vec2 u = f*f*(3.-2.*f);
          return mix(a,b,u.x) + (c-a)*u.y*(1.-u.x) + (d-b)*u.x*u.y;
        }
        varying vec2 vWorld;
        void main() {
          vec2 p = vUv * 2.0 - 1.0;
          float ink;
          if (vRestore.y > 0.0) {
            // Same metres, stationary noise and feather as the analytic material front.
            // Leaves sampling this RT must not see a larger circular restore halo.
            float edge = vRestore.y;
            float brush = ((noise(vWorld * 0.35) - 0.5) * 0.8 + (noise(vWorld * 1.7) - 0.5) * 0.35) * edge * 1.6
              + (noise(vWorld * 0.075 + 17.0) - 0.5) * edge * 3.0;
            ink = 1.0 - smoothstep(vRestore.x - edge + brush, vRestore.x + edge * 0.5 + brush, distance(vWorld, vCenter));
          } else {
            // Stationary world-space brush noise makes neighbouring stains coherent.
            float n = ((noise(vWorld * 0.55) - 0.5) * 1.6 + (noise(vWorld * 2.1) - 0.5) * 0.7) * vNoise;
            float d = length(p) + n;
            float soft = 1.0 - smoothstep(vInner, 0.88, d);
            // Fade before the square boundary so outward bleed cannot make rectangles.
            soft *= 1.0 - smoothstep(0.82, 1.0, length(p));
            ink = soft * soft * (3.0 - 2.0 * soft) * vStrength;
          }
          // Keep provenance before Max blending; evaluate drains at the receiving surface.
          float shape = vStrength > 0.0001 ? ink / vStrength : 0.0;
          float strongStroke = shape * vDrainSource.x > 1.0 ? 1.0 : 0.0;
          float protectedSource = max(vDrainSource.y, strongStroke);
          gl_FragColor = vec4(ink, ink * protectedSource, 0.0, 1.0);
        }`,
    });
    const N = ColorField.MAX_STAMPS;
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.rotateX(-Math.PI / 2);
    this.stampStrength = new THREE.InstancedBufferAttribute(new Float32Array(N), 1);
    this.stampNoise = new THREE.InstancedBufferAttribute(new Float32Array(N), 1);
    this.stampInner = new THREE.InstancedBufferAttribute(new Float32Array(N), 1);
    this.stampRestore = new THREE.InstancedBufferAttribute(new Float32Array(N * 2), 2);
    this.stampDrainSource = new THREE.InstancedBufferAttribute(new Float32Array(N * 2), 2);
    this.stampStrength.setUsage(THREE.DynamicDrawUsage);
    this.stampNoise.setUsage(THREE.DynamicDrawUsage);
    this.stampInner.setUsage(THREE.DynamicDrawUsage);
    this.stampRestore.setUsage(THREE.DynamicDrawUsage);
    this.stampDrainSource.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aStrength', this.stampStrength);
    geo.setAttribute('aNoise', this.stampNoise);
    geo.setAttribute('aInner', this.stampInner);
    geo.setAttribute('aRestore', this.stampRestore);
    geo.setAttribute('aDrainSource', this.stampDrainSource);
    this.stampMesh = new THREE.InstancedMesh(geo, this.stampMat, N);
    this.stampMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.stampMesh.frustumCulled = false;
    this.maskScene.add(this.stampMesh);
  }

  private rebuildMaskCam(): void {
    if (!this.maskCam) return;
    const { minX, maxX, minZ, maxZ } = this.bounds;
    this.maskCam.left = minX;
    this.maskCam.right = maxX;
    this.maskCam.top = maxZ;
    this.maskCam.bottom = minZ;
    // Look *up* from below with up=+Z so mask u→+X and v→+Z, matching every
    // sampler's uv = ((x - minX)/w, (z - minZ)/d). (Looking down with up=-Z mirrored Z.)
    this.maskCam.position.set(0, -50, 0);
    this.maskCam.up.set(0, 0, 1);
    this.maskCam.lookAt(0, 0, 0);
    this.maskCam.updateProjectionMatrix();
  }

  /** Stamp fox + trail + restores into mask RT. Call once per frame before main render. */
  renderMask(dt: number): void {
    if (!this.maskRT || !this._renderer || !this.maskScene || !this.maskCam || !this.stampMesh || !this.stampMat) {
      return;
    }
    this.syncVisualDrains();
    const renderer = this._renderer;
    const prevTarget = renderer.getRenderTarget();
    const prevAutoClear = renderer.autoClear;

    // Fade previous (cheap: clear slightly toward black via full-screen isn't available —
    // we re-stamp restores fully each frame and only use RT as soft trail cache).
    // Simpler reliable path: clear + stamp everything that should be permanent + recent trail.
    renderer.setRenderTarget(this.maskRT);
    renderer.autoClear = true;
    renderer.setClearColor(0x000000, 1);
    renderer.clear();
    renderer.autoClear = false;

    const stamps: Array<{ x: number; z: number; size: number; strength: number; noise: number; inner: number; restore?: RestoreRegion; strokeStrength?: number; protected?: boolean }> = [];

    for (const r of this.restores) {
      if (r.radius > 0.01) {
        // Extra support around the analytic front keeps brush bleed inside the stamp quad.
        const edge = Math.max(0.001, ColorField.edgeOf(r));
        // Fine + broad noise can extend the feather to R + 2.92e.
        const outer = r.radius + edge * 3.1;
        stamps.push({
          x: r.center.x,
          z: r.center.z,
          size: outer * 2,
          strength: 1,
          restore: r,
          protected: true,
          noise: Math.min(0.12, (edge * 0.5) / outer),
          inner: Math.max(0, (r.radius - edge) / outer),
        });
      }
    }
    // the fox's colour reaches the ground only when it is near it: a high glide leaves no painted band
    const near = (x: number, y: number, z: number) => {
      if (!this.groundAt) return 1;
      const g = this.groundAt(x, z);
      return Number.isFinite(g) ? 1 - THREE.MathUtils.smoothstep(y - g, 0.8, 3.2) : 1;
    };
    const foxK = near(this.fox.x, this.fox.y, this.fox.z);
    if (foxK > 0.01)
      stamps.push({
        x: this.fox.x,
        z: this.fox.z,
        size: this.auraRadius * 2.0 * (0.7 + 0.3 * foxK),
        strength: 0.95 * foxK,
        noise: 0.12,
        inner: 0.4,
      });
    for (const t of this.trail) {
      const life = t.life / this.trailLife;
      const k = near(t.x, t.y, t.z);
      if (k < 0.01) continue;
      stamps.push({
        x: t.x,
        z: t.z,
        size: this.trailRadius * 2.0,
        strength: 0.7 * life * k,
        noise: 0.2,
        inner: 0.3,
      });
    }

    for (const g of this.glows) {
      if (g.strength > 0.01) stamps.push({ x: g.x, z: g.z, size: g.radius * 2, strength: g.strength, noise: 0.12, inner: 0.35, protected: true });
    }
    // strokes: a bead of stamps along each capsule, brighter and longer-lived than the trail
    for (const st of this.strokes) {
      const len = Math.hypot(st.b.x - st.a.x, st.b.z - st.a.z);
      const n = Math.max(1, Math.ceil(len / 0.9));
      const k = Math.min(1, this.strokeStrength(st));
      for (let i = 0; i <= n; i++) {
        const u = i / n;
        stamps.push({ x: st.a.x + (st.b.x - st.a.x) * u, z: st.a.z + (st.b.z - st.a.z) * u, size: st.radius * 2.2, strength: 0.95 * k, noise: 0.08, inner: 0.5, strokeStrength: this.strokeStrength(st) });
      }
    }

    const mesh = this.stampMesh;
    const n = Math.min(stamps.length, ColorField.MAX_STAMPS);
    const m = this._stampMatrix;
    for (let i = 0; i < n; i++) {
      const s = stamps[i]!;
      m.makeScale(s.size, 1, s.size).setPosition(s.x, 0, s.z);
      mesh.setMatrixAt(i, m);
      this.stampDrainSource!.setXY(i, s.strokeStrength ?? 0, s.protected ? 1 : 0);
      this.stampStrength!.setX(i, s.strength);
      this.stampNoise!.setX(i, s.noise);
      this.stampInner!.setX(i, s.inner);
      this.stampRestore!.setXY(i, s.restore?.radius ?? 0, s.restore ? Math.max(0.001, ColorField.edgeOf(s.restore)) : 0);
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    this.stampDrainSource!.needsUpdate = true;
    this.stampStrength!.needsUpdate = true;
    this.stampNoise!.needsUpdate = true;
    this.stampInner!.needsUpdate = true;
    this.stampRestore!.needsUpdate = true;
    renderer.render(this.maskScene, this.maskCam);

    renderer.setRenderTarget(prevTarget);
    renderer.autoClear = prevAutoClear;
    void dt;
  }

  private syncVisualDrains(): void {
    const count = Math.min(MAX_VISUAL_DRAINS, this.visualDrains.length);
    this.visualDrainUniforms.uVisualDrainCount.value = count;
    for (let i = 0; i < count; i++) {
      const drain = this.visualDrains[i]!;
      this.visualDrainUniforms.uVisualDrains.value[i]!.set(drain.center.x, drain.center.y, drain.center.z, Math.max(0.01, drain.radius));
    }
  }

  /** RG provenance mask: red = all sources, green = permanent/glow or strong-stroke protected color. */
  getMaskTexture(): THREE.Texture | null {
    return this.maskRT?.texture ?? null;
  }

  /**
   * Patch MeshStandardMaterial: ink-wash mono + color mask blend.
   * Call once per material; then syncUniforms each frame.
   */
  patchMaterial(mat: THREE.MeshStandardMaterial): void {
    const field = this;
    // painted plants perk up: clumps swell a little along their (clump-outward) normals.
    // A material define (not a shader one) so it is part of the program cache key.
    if ((mat.userData as { foliage?: boolean }).foliage) mat.defines = { ...mat.defines, CF_PERK: '' };
    const prev = mat.onBeforeCompile;
    mat.onBeforeCompile = (shader, renderer) => {
      prev.call(mat, shader, renderer); // keep material-specific patches (e.g. ground blend)
      Object.assign(shader.uniforms, field.visualDrainUniforms);
      shader.uniforms.uFox = { value: field.fox.clone() };
      shader.uniforms.uAura = { value: field.auraRadius };
      shader.uniforms.uTrailRadius = { value: field.trailRadius };
      shader.uniforms.uTrailLife = { value: field.trailLife };
      shader.uniforms.uGlobalColor = { value: field.globalColor };
      shader.uniforms.uGroundSurface = { value: mat.name === 'rv-terrain' || mat.name === 'rv-ground' ? 1 : 0 };
      shader.uniforms.uPaintKind = { value: paintKindOf(mat) };
      shader.uniforms.uTrail = { value: new Float32Array(24 * 4) };
      shader.uniforms.uTrailCount = { value: 0 };
      // up to 4 restores
      shader.uniforms.uRestorePos = { value: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()] };
      shader.uniforms.uRestoreRad = { value: new Float32Array(4) };
      shader.uniforms.uRestoreEdge = { value: new Float32Array(4) };
      shader.uniforms.uRestoreRim = { value: new Float32Array(4) };
      shader.uniforms.uRestoreCount = { value: 0 };
      shader.uniforms.uMaskMap = { value: field.getMaskTexture() };
      shader.uniforms.uUseMaskMap = { value: 0 };
      shader.uniforms.uBounds = {
        value: new THREE.Vector4(field.bounds.minX, field.bounds.maxX, field.bounds.minZ, field.bounds.maxZ),
      };
      shader.uniforms.uRestoredChroma = { value: (mat.userData as { cfRestoredChroma?: number }).cfRestoredChroma ?? 1 };
      Object.assign(shader.uniforms, field.paint?.uniforms ?? { ...NO_PAINT, ...paintLookUniforms() });
      shader.uniforms.uClimbTall = { value: climbTallOf(mat) };

      (mat.userData as { colorFieldShader?: typeof shader }).colorFieldShader = shader;

      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
          varying vec3 vWorldPosCF;
          varying vec3 vWorldNormalCF;
          uniform sampler2D uPaintMap;
          uniform vec4 uPaintBounds;
          uniform float uPaintOn;`,
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          #ifdef CF_PERK
          if (uPaintOn > 0.5) {
            vec4 perkW = vec4(transformed, 1.0);
            #ifdef USE_INSTANCING
            perkW = instanceMatrix * perkW;
            #endif
            perkW = modelMatrix * perkW;
            vec2 perkUv = vec2((perkW.x - uPaintBounds.x) / (uPaintBounds.y - uPaintBounds.x),
                               (perkW.z - uPaintBounds.z) / (uPaintBounds.w - uPaintBounds.z));
            float perk = textureLod(uPaintMap, clamp(perkUv, 0.0, 1.0), 0.0).r;
            transformed += objectNormal * perk * 0.08 + vec3(0.0, perk * 0.05, 0.0);
          }
          #endif`,
        )
        .replace(
          '#include <worldpos_vertex>',
          `#include <worldpos_vertex>
          vWorldPosCF = (modelMatrix * vec4(transformed, 1.0)).xyz;
          vWorldNormalCF = normalize(mat3(modelMatrix) * normal);`,
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          varying vec3 vWorldPosCF;
          varying vec3 vWorldNormalCF;
          ${VISUAL_DRAIN_GLSL}
          uniform vec3 uFox;
          uniform float uAura;
          uniform float uTrailRadius;
          uniform float uTrailLife;
          uniform float uGlobalColor;
          uniform float uRestoredChroma;
          uniform float uTrail[96];
          uniform int uTrailCount;
          uniform vec3 uRestorePos[4];
          uniform float uRestoreRad[4];
          uniform float uRestoreEdge[4];
          uniform float uRestoreRim[4];
          uniform int uRestoreCount;
          // leading warm light band of a travelling restore front (written by colorMaskAt)
          float cfRim;
          float cfPermanent;
          uniform float uGroundSurface;
          // what the fox's paint restores this surface to: 0 meadow, 1 cool stone, 2 own colour, 3 leaf litter
          uniform float uPaintKind;
          uniform sampler2D uMaskMap;
          uniform float uUseMaskMap;
          uniform vec4 uBounds;
          uniform sampler2D uPaintMap;
          uniform sampler2D uWetMap;
          uniform vec4 uPaintBounds;
          uniform float uPaintOn;
          uniform sampler2D uClimbMap;
          uniform sampler2D uGroundMap;
          uniform float uClimbH;
          uniform float uClimbFoliage;
          uniform float uClimbTall;
          uniform float uInkWash;
          uniform float uHueLeak;
          uniform float uAuraColor;
          uniform float uPalette;
          uniform float uHueJitter;
          uniform float uGranulation;
          uniform float uBleed;
          uniform float uEdgeDarken;
          uniform float uPaperGrain;
          uniform vec2 uPaintSeed;
          uniform float uSpeckDebug;
          uniform vec3 uPal[5];
          // spreading wet front of fresh blooms
          float cfWet;
          // fox paint coverage here, and how much of the visible colour is that paint
          float cfPaint;
          float cfPaintLead;
          // which wash (bloom) the pigment here came from, 0..1
          float cfWash;
          // live aura/trail (the brush is still wet here)
          float cfFresh;

          float hash21(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
          }
          float noise21(vec2 p) {
            vec2 i = floor(p); vec2 f = fract(p);
            float a = hash21(i), b = hash21(i+vec2(1.,0.));
            float c = hash21(i+vec2(0.,1.)), d = hash21(i+vec2(1.,1.));
            vec2 u = f*f*(3.-2.*f);
            return mix(a,b,u.x) + (c-a)*u.y*(1.-u.x) + (d-b)*u.x*u.y;
          }
          // seeded world-space fBm (4 octaves, rotated) — paper and pigment never swim with the camera
          float fbm4(vec2 p) {
            float v = 0.0, a = 0.5;
            for (int i = 0; i < 4; i++) {
              v += a * noise21(p);
              p = mat2(1.6, 1.2, -1.2, 1.6) * p + 7.3;
              a *= 0.5;
            }
            return v / 0.9375;
          }

          float colorMaskAt(vec3 p) {
            float temporaryVisibility = temporaryVisibilityAt(p);
            float s = uGlobalColor;
            cfRim = 0.0;
            cfPermanent = uGlobalColor;
            cfPaint = 0.0;
            cfWet = 0.0;
            cfPaintLead = 0.0;
            cfWash = 0.0;
            cfFresh = 0.0;
            if (uUseMaskMap > 0.5) {
              vec2 uv = vec2(
                (p.x - uBounds.x) / (uBounds.y - uBounds.x),
                (p.z - uBounds.z) / (uBounds.w - uBounds.z)
              );
              if (uv.x >= 0.0 && uv.x <= 1.0 && uv.y >= 0.0 && uv.y <= 1.0) {
                vec2 sources = texture2D(uMaskMap, uv).rg;
                // the live aura / short trail only hints colour: the lasting paint tells the story
                s = max(s, max(sources.r * temporaryVisibility * uAuraColor, sources.g));
                cfFresh = sources.r;
              }
            }
            if (uPaintOn > 0.5) {
              vec2 puv = vec2(
                (p.x - uPaintBounds.x) / (uPaintBounds.y - uPaintBounds.x),
                (p.z - uPaintBounds.z) / (uPaintBounds.w - uPaintBounds.z)
              );
              if (puv.x >= 0.0 && puv.x <= 1.0 && puv.y >= 0.0 && puv.y <= 1.0) {
                // paint is the fox's: a Shade's drain blots it like the live aura
                vec2 paintRG = texture2D(uPaintMap, puv).rg;
                cfPaint = paintRG.r;
                cfWash = paintRG.g;
                if (uPaintKind > 0.5 && uPaintKind < 2.5) {
                  // props: colour climbs from the foot. The climb target (paint dilated over a
                  // footprint, eased at climbRate) raises a ragged front up to climbH above the ground.
                  float cover = texture2D(uClimbMap, puv).r;
                  float gY = texture2D(uGroundMap, puv).r;
                  float hA = gY < -500.0 ? 0.0 : max(0.0, p.y - gY);
                  float upN = clamp(normalize(vWorldNormalCF).y, 0.0, 1.0);
                  float reachH = uClimbH * mix(1.0, uClimbFoliage, uClimbTall) * (1.0 + upN * 0.3);
                  float front = reachH * smoothstep(0.02, 0.92, cover);
                  float jag = (noise21(vec2(p.x + p.z, p.y) * 1.4 + uPaintSeed) - 0.5) * 0.8
                            + (noise21(vec2(p.x - p.z, p.y) * 4.1 + uPaintSeed) - 0.5) * 0.25;
                  float climbK = 1.0 - smoothstep(front - 0.6, front + 0.05, hA + jag);
                  cfPaint = cover * climbK;
                }
                cfPaint *= temporaryVisibility;
                cfWet = texture2D(uWetMap, puv).r * temporaryVisibility;
                cfPaintLead = clamp((cfPaint - s) * 4.0 + 0.5, 0.0, 1.0);
              }
            }
            // analytic restores with ink-bleed edge
            for (int i = 0; i < 4; i++) {
              if (i >= uRestoreCount) break;
              float rad = uRestoreRad[i];
              if (rad < 0.001) continue;
              vec3 c = uRestorePos[i];
              float d = distance(p.xz, c.xz);
              float edge = max(0.001, uRestoreEdge[i]);
              // painterly ragged front: two octaves so a crisp front still reads as brushwork
              float n = ((noise21(p.xz * 0.35) - 0.5) * 0.8 + (noise21(p.xz * 1.7) - 0.5) * 0.35) * edge * 1.6
                + (noise21(p.xz * 0.075 + 17.0) - 0.5) * edge * 3.0;
              float local = 1.0 - smoothstep(rad - edge + n, rad + edge * 0.5 + n, d);
              s = max(s, local);
              cfPermanent = max(cfPermanent, local);
              // the band just behind the front glows warm while it travels
              float behind = rad + n - d;
              cfRim = max(cfRim, uRestoreRim[i] * smoothstep(-edge * 0.4, edge * 0.3, behind) * (1.0 - smoothstep(edge * 0.4, edge * 2.6, behind)));
            }
            // aura: feathered and brush-broken, not a clean sphere
            float an = (noise21(p.xz * 0.6) - 0.5) * 0.35 + (noise21(p.xz * 2.3) - 0.5) * 0.15;
            float ad = distance(p, uFox) / uAura + an;
            float af = 1.0 - smoothstep(0.15, 1.0, ad);
            s = max(s, af * af * temporaryVisibility * uAuraColor);
            // the mask RT already carries the trail; the analytic loop is the no-RT fallback
            for (int i = 0; i < 24; i++) {
              if (i >= uTrailCount || uUseMaskMap > 0.5) break;
              vec3 tp = vec3(uTrail[i*4], uTrail[i*4+1], uTrail[i*4+2]);
              float life = uTrail[i*4+3];
              float td = distance(p, tp);
              float fall = 1.0 - clamp(td / uTrailRadius, 0.0, 1.0);
              s = max(s, fall * fall * (life / uTrailLife) * temporaryVisibility);
            }
            return clamp(s, 0.0, 1.0);
          }

          vec3 inkWash(vec3 color, vec3 worldPos, vec3 worldN) {
            // Pressed gray-sepia paper: luminance only (a warm roof or a lit window must not read
            // as colour before the fox arrives), darks stay dark, soft paper shoulder, a whisper of hue.
            float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
            vec3 ink = luma * vec3(1.05, 0.99, 0.87);
            ink = ink * 0.95 + vec3(0.013, 0.012, 0.01);
            // paper shoulder so sunlit stone tops out cream-grey, never white
            float sh = smoothstep(0.35, 1.6, luma);
            ink = mix(ink, vec3(0.83, 0.79, 0.7) * (0.45 + luma * 0.4), sh * 0.6);
            ink = mix(ink, color * 0.92, uHueLeak);
            // low-frequency foxing / water stains only — fine world noise aliased into stipple
            vec2 gp = worldPos.xz + worldPos.y * vec2(0.71, 1.37) + uPaintSeed;
            float g = (noise21(gp * 0.9) - 0.5) * 0.1 + (noise21(gp * 3.1) - 0.5) * 0.05;
            float fox = smoothstep(0.62, 0.9, noise21(gp * 0.35 + 3.1));
            ink *= 1.0 + g;
            ink = mix(ink, ink * vec3(0.94, 0.88, 0.76), fox * 0.22);
            // top-lit surfaces catch a breath of paper (soft wash, not a rim halo)
            float up = clamp(dot(normalize(worldN), vec3(0.0, 1.0, 0.0)), 0.0, 1.0);
            ink += up * up * vec3(0.01, 0.009, 0.007);
            return mix(color, ink, uInkWash);
          }
          `,
        )
        .replace(
          '#include <opaque_fragment>',
          `
          float cm = colorMaskAt(vWorldPosCF);
          // slight chroma boost near mask edge for painterly bleed
          float edgeBoost = smoothstep(0.15, 0.55, cm) * (1.0 - smoothstep(0.55, 0.95, cm));
          vec3 washed = inkWash(outgoingLight, vWorldPosCF, vWorldNormalCF);
          // restored hue strength per material: stone/rock come back as warm-grey stone, not orange paint
          vec3 chroma = mix(dot(outgoingLight, vec3(0.2126, 0.7152, 0.0722)) * vec3(1.04, 0.98, 0.88), outgoingLight, mix(uRestoredChroma, 1.0, max(cfPermanent, cfPaint) * uGroundSurface)) * (1.0 + edgeBoost * 0.12);
          chroma *= mix(vec3(1.0), vec3(1.12, 1.04, 0.86), cfPermanent * uGroundSurface);
          // Keep the full feather instead of amplifying low mask values into a painted disc.
          // Modulation vanishes at 0/1, so untouched and fully restored regions remain exact.
          float brushEdge = (noise21(vWorldPosCF.xz * 0.85) - 0.5) * 0.5
            + (noise21(vWorldPosCF.xz * 2.7 + 8.0) - 0.5) * 0.2;
          float brushed = clamp(cm + brushEdge * sin(cm * 3.14159265), 0.0, 1.0);
          // Sepia has a lifted dark floor. Restored colour should feel warmer/brighter,
          // while retaining authored hue and the same soft permanent/temporary fronts.
          float washedValue = dot(washed, vec3(0.2126, 0.7152, 0.0722));
          float restoredValue = dot(chroma, vec3(0.2126, 0.7152, 0.0722));
          // Dark soil needs more headroom than stone to reach the same target;
          // otherwise the lifted sepia floor turns a warm wake into a burn mark.
          float aliveGain = clamp(washedValue * 1.18 / max(restoredValue, 0.002), 1.0, mix(1.65, 4.0, uGroundSurface));
          chroma *= aliveGain;
          // The fox's paint is a watercolour wash that brings each surface's own life back:
          // soil → an autumn wash (ochre / sage / moss / burnt sienna, madder accents) blended with its
          // own colour; stone → cool grey with lichen and moss tops; wood / plaster / roofs / foliage /
          // water → their authored colour, enriched; litter melts into the wash bar a few warm piles.
          // Watercolour cues: granulation in the paper's valleys, a dilute fringe where paper shows,
          // a darker broken tide line where the wash dried, a wet glistening edge while it spreads.
          float pk = 0.0;
          vec3 wpP = vWorldPosCF;
          vec2 spP = wpP.xz + uPaintSeed;
          vec2 gpP = spP + wpP.y * vec2(0.63, 1.21);
          float paper = fbm4(gpP * 2.3);
          if (cfPaint > 0.002) {
            float gran = noise21(gpP * 4.7 + 1.3) * 0.5 + noise21(gpP * 12.9) * 0.25 + paper * 0.25;
            float body = smoothstep(0.5, 0.78, cfPaint + (gran - 0.5) * (0.08 + 0.2 * uBleed));
            float fringe = smoothstep(0.04, 0.4, cfPaint) * smoothstep(0.3, 0.7, gran) * mix(0.4, 0.85, uBleed);
            pk = max(body, fringe);
            float rimBreak = smoothstep(0.3, 0.62, noise21(gpP * 0.9 + 4.0));
            float tide = smoothstep(0.44, 0.56, cfPaint + (gran - 0.5) * 0.08) * (1.0 - smoothstep(0.6, 0.78, cfPaint)) * mix(0.2, 1.0, rimBreak);
            // each wash dried at its own strength / hue: overlapping blooms read as separate passes
            float wash = clamp((cfWash - 0.15) / 0.85, 0.0, 1.0);
            // hue zones a few metres across, so a run crosses ochre → sage → moss → sienna washes
            float h1 = clamp(fbm4(spP * 0.13) * 1.8 - 0.4 + ((wash - 0.5) * 0.5 + (noise21(spP * 0.55 + 9.0) - 0.5) * 0.4) * uHueJitter, 0.0, 1.0);
            float h2 = noise21(spP * 0.17 + 5.0);
            float h3 = noise21(spP * 0.33 + 47.0);
            vec3 pO = uPal[0] / dot(uPal[0], vec3(0.2126, 0.7152, 0.0722));
            vec3 pS = uPal[1] / dot(uPal[1], vec3(0.2126, 0.7152, 0.0722));
            vec3 pM = uPal[2] / dot(uPal[2], vec3(0.2126, 0.7152, 0.0722));
            vec3 pB = uPal[3] / dot(uPal[3], vec3(0.2126, 0.7152, 0.0722));
            vec3 pR = uPal[4] / dot(uPal[4], vec3(0.2126, 0.7152, 0.0722));
            vec3 pal = mix(pO, pS, smoothstep(0.32, 0.58, h1));
            pal = mix(pal, pM, smoothstep(0.62, 0.86, h1));
            pal = mix(pal, pB, smoothstep(0.62, 0.86, h2) * 0.7);
            pal = mix(pal, pR, smoothstep(0.82, 0.95, h3) * 0.55);
            float chromaLuma = dot(chroma, vec3(0.2126, 0.7152, 0.0722));
            // pigment density: settled pools and thin passages; granulation settles in paper valleys
            float dens = mix(0.8, 1.2, noise21(spP * 0.38 + 11.0) * 0.55 + noise21(spP * 1.9 + 2.0) * 0.45);
            dens *= mix(0.88, 1.12, wash);
            dens *= 1.0 + uGranulation * 0.5 * (0.5 - gran);
            // cauliflower back-runs: faint darker lines where one wash crept into another
            float backrun = 1.0 - smoothstep(0.0, 0.035, abs(noise21(spP * 0.42 + 23.0) - 0.5));
            vec3 own = max(mix(vec3(chromaLuma), chroma, 1.25), 0.0);
            // watercolour on paper sits a little lighter and cleaner than the dead soil it covers
            vec3 groundPaint = mix(own, chromaLuma * pal * 1.22, uPalette) * dens * (1.0 - backrun * 0.12);
            float up = clamp(normalize(vWorldNormalCF).y, 0.0, 1.0);
            // lichen patches follow the surface (gp folds height in), not horizontal bands
            float lichen = smoothstep(0.55, 0.75, noise21(gpP * 0.9 + 3.0) * 0.7 + noise21(gpP * 3.1) * 0.3);
            // stone comes back as warm sunlit sandstone (against the grey paper the warmth is the life),
            // with gold lichen patches and moss on the tops
            vec3 stone = chromaLuma * mix(vec3(1.2, 1.0, 0.76), vec3(1.1, 1.0, 0.86), noise21(gpP * 0.5)) * 1.15;
            vec3 lichenC = chromaLuma * pO * 1.1;
            vec3 moss = chromaLuma * pM * 1.08;
            float mossK = smoothstep(0.5, 0.85, up) * smoothstep(0.4, 0.66, noise21(spP * 0.8 + 6.0));
            vec3 ownPaint = own * mix(0.95, 1.1, dens - 0.8);
            vec3 stonePaint = mix(mix(stone, lichenC, lichen * 0.7), moss, mossK);
            // kept litter piles come back as warm leaves, lighter than their dead value
            vec3 litterPaint = ownPaint * 1.2;
            vec3 paintC = uPaintKind < 0.5 ? groundPaint : uPaintKind < 1.5 ? stonePaint : uPaintKind < 2.5 ? ownPaint : litterPaint;
            // the dried tide line is the pigment itself, pooled darker and richer — never a brown outline
            paintC *= 1.0 - tide * uEdgeDarken;
            paintC = mix(vec3(dot(paintC, vec3(0.2126, 0.7152, 0.0722))), paintC, 1.0 + tide * 0.25);
            // wet edge: the spreading front glistens more saturated and a touch darker
            paintC = mix(vec3(dot(paintC, vec3(0.2126, 0.7152, 0.0722))), paintC, 1.0 + cfWet * 0.3) * (1.0 - cfWet * 0.1);
            // the fringe is dilute: lighter and thinner, the paper shows through
            float pL = dot(paintC, vec3(0.2126, 0.7152, 0.0722));
            paintC = mix(mix(vec3(pL), paintC, 0.6) * 1.08, paintC, body);
            chroma = mix(chroma, paintC, pk);
            if (uPaintKind > 2.5) {
              // litter melts into the wash: only sparse warm piles stay (whole patches, so no torn leaves)
              if (pk > 0.3 && noise21(spP * 0.55 + 71.0) < 0.86) discard;
              if (uSpeckDebug > 0.5) chroma = vec3(1.0, 0.0, 1.0);
            }
          }
          if (uSpeckDebug > 0.5 && uPaintKind > 2.5) { washed = vec3(1.0, 0.0, 1.0); }
          outgoingLight = mix(washed, chroma, max(brushed, pk));
          // paper grain under everything patched: one seeded world fBm, so it never swims
          outgoingLight *= 1.0 + (paper - 0.5) * 0.14 * uPaperGrain;
          // wet front: soft cool sheen while a bloom is still spreading
          float wetLuma = dot(outgoingLight, vec3(0.2126, 0.7152, 0.0722));
          outgoingLight += cfWet * 0.35 * (outgoingLight * vec3(0.15, 0.18, 0.12) + vec3(0.02, 0.025, 0.02) * (0.35 + wetLuma));
          // restore-wave rim stays warm but quieter (Shade/shrine only, not fox paint)
          float rimLuma = dot(outgoingLight, vec3(0.2126, 0.7152, 0.0722));
          outgoingLight += cfRim * 0.55 * (outgoingLight * vec3(0.45, 0.28, 0.08) + vec3(0.08, 0.045, 0.014) * (0.35 + rimLuma));
          #include <opaque_fragment>
          `,
        );
    };
    mat.needsUpdate = true;
  }

  syncMaterial(mat: THREE.MeshStandardMaterial): void {
    const shader = (mat.userData as { colorFieldShader?: { uniforms: Record<string, { value: unknown }> } })
      .colorFieldShader;
    if (!shader) return;
    this.syncVisualDrains();
    const u = shader.uniforms;
    (u.uFox!.value as THREE.Vector3).copy(this.fox);
    u.uAura!.value = this.auraRadius;
    u.uTrailRadius!.value = this.trailRadius;
    u.uTrailLife!.value = this.trailLife;
    u.uGlobalColor!.value = this.globalColor;
    if (u.uRestoredChroma) u.uRestoredChroma.value = (mat.userData as { cfRestoredChroma?: number }).cfRestoredChroma ?? 1;
    (u.uBounds!.value as THREE.Vector4).set(
      this.bounds.minX,
      this.bounds.maxX,
      this.bounds.minZ,
      this.bounds.maxZ,
    );
    const tex = this.getMaskTexture();
    u.uMaskMap!.value = tex;
    u.uUseMaskMap!.value = tex ? 1 : 0;

    const arr = u.uTrail!.value as Float32Array;
    const n = Math.min(24, this.trail.length);
    u.uTrailCount!.value = n;
    const start = Math.max(0, this.trail.length - n);
    for (let i = 0; i < n; i++) {
      const t = this.trail[start + i]!;
      arr[i * 4] = t.x;
      arr[i * 4 + 1] = t.y;
      arr[i * 4 + 2] = t.z;
      arr[i * 4 + 3] = t.life;
    }

    const posArr = u.uRestorePos!.value as THREE.Vector3[];
    const radArr = u.uRestoreRad!.value as Float32Array;
    const edgeArr = u.uRestoreEdge!.value as Float32Array;
    const rimArr = u.uRestoreRim!.value as Float32Array;
    const rc = Math.min(4, this.restores.length);
    u.uRestoreCount!.value = rc;
    for (let i = 0; i < rc; i++) {
      const r = this.restores[i]!;
      posArr[i]!.copy(r.center);
      radArr[i] = r.radius;
      edgeArr[i] = ColorField.edgeOf(r);
      rimArr[i] = r.rim;
    }
  }

  dispose(): void {
    this.maskRT?.dispose();
    this.fadeMat?.dispose();
    this.stampMat?.dispose();
    this.stampMesh?.geometry.dispose();
  }
}

type Bloom = { x: number; z: number; radius: number; strength: number; age: number; life: number; seed: number; start: number };

export type PaintTuning = {
  /** Path ribbon bloom radius (m) at a run; walk scales it down a little */
  ribbonRadius: number;
  /** Metres travelled between ribbon blooms */
  ribbonSpacing: number;
  /** Pawfall bloom radius (m) */
  pawRadius: number;
  /** Metres travelled between side drips that bleed past the path */
  dripSpacing: number;
  dripRadius: number;
  /** Seconds a bloom keeps spreading before it dries in place */
  bloomLife: number;
  strength: number;
  /** Climb coverage gained per second once paint reaches a prop's foot (1/s) */
  climbRate: number;
};

/**
 * Watercolour look uniforms shared by every patched material (lil-gui "Paint" folder).
 * Autumn palette in unit luma (the shader renormalises): ochre, sage, moss, burnt sienna, madder accent.
 */
export function paintLookUniforms() {
  return {
    /** 0 = authored colour, 1 = full gray-sepia paper for unpainted surfaces */
    uInkWash: { value: 1 },
    /** Authored hue that leaks through the unpainted wash */
    uHueLeak: { value: 0.02 },
    /** How much the live aura / short trail colours on its own (the paint does the storytelling) */
    uAuraColor: { value: 0.45 },
    /** Palette weight vs the surface's own enriched colour on soil */
    uPalette: { value: 0.62 },
    uHueJitter: { value: 0.7 },
    uGranulation: { value: 0.6 },
    uBleed: { value: 0.6 },
    uEdgeDarken: { value: 0.4 },
    uPaperGrain: { value: 0.5 },
    /** World-XZ offset derived from the single paint seed (fBm never swims; same seed = same paper) */
    uPaintSeed: { value: new THREE.Vector2() },
    /** Metres paint climbs up props at full coverage; foliage climbs uClimbFoliage× further */
    uClimbH: { value: 4.2 },
    uClimbFoliage: { value: 2.4 },
    /** 1 = tint litter magenta / sprout-free debug for speck hunts */
    uSpeckDebug: { value: 0 },
    uPal: {
      value: [
        new THREE.Color(1.6, 1.0, 0.3), // golden ochre
        new THREE.Color(0.82, 1.08, 0.72), // sage
        new THREE.Color(0.74, 1.1, 0.4), // moss
        new THREE.Color(1.8, 0.8, 0.42), // burnt sienna
        new THREE.Color(1.75, 0.7, 0.78), // madder
      ],
    },
  };
}

/** mulberry32: the paint's only randomness (bloom ids, splash lobes, ribbon jitter) */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Persistent watercolour paint laid by the fox. One render target over the whole valley,
 * never cleared: wet blooms spread (MAX-blended, ragged world-space edge) for ~1 s, then dry
 * in place forever. Visual only — gameplay probes (ColorField.sample) never read it.
 * A 1 m climb target follows the paint (dilated to a prop footprint) at `climbRate`/s, so colour
 * creeps up trunks, walls and rocks a beat after the wash reaches their foot.
 * A coarse CPU grid mirrors coverage for the grade coupling and capture metrics.
 */
export class PaintLayer {
  readonly bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  readonly tun: PaintTuning = {
    ribbonRadius: 2.2,
    ribbonSpacing: 0.35,
    pawRadius: 0.95,
    dripSpacing: 6,
    dripRadius: 1.5,
    bloomLife: 1.3,
    strength: 1,
    climbRate: 0.8,
  };
  blooms: Bloom[] = [];
  /** Total blooms ever laid (metrics) */
  laid = 0;
  /** 1 m coverage grid (0..1) mirroring the RT for CPU queries */
  readonly grid: Float32Array;
  readonly gridW: number;
  readonly gridH: number;
  /** Seeded RNG: every random choice in paint goes through this */
  readonly rand: () => number;
  /** CPU ms of the last render() (stamp + climb submission) */
  passMs = 0;
  private painted = 0;
  private rt: THREE.WebGLRenderTarget | null = null;
  /** Live wet edges of spreading blooms; cleared every frame (half resolution) */
  private wetRT: THREE.WebGLRenderTarget | null = null;
  private wetDirty = false;
  /** 1 m climb coverage, ping-ponged while anything is still climbing */
  private climbRT: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget] | null = null;
  private climbMat: THREE.ShaderMaterial | null = null;
  private climbScene = new THREE.Scene();
  private climbCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  /** Seconds the climb pass keeps running after the last live bloom */
  private climbSettle = 0;
  private mat: THREE.ShaderMaterial | null = null;
  private aWet: THREE.InstancedBufferAttribute | null = null;
  private aSeed: THREE.InstancedBufferAttribute | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private scene = new THREE.Scene();
  private cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  private mesh: THREE.InstancedMesh | null = null;
  private aRadius: THREE.InstancedBufferAttribute | null = null;
  private aStrength: THREE.InstancedBufferAttribute | null = null;
  private readonly _m = new THREE.Matrix4();
  private static readonly MAX = 256;
  /** Uniform objects shared by every consumer material */
  readonly uniforms = {
    uPaintMap: { value: null as THREE.Texture | null },
    uWetMap: { value: null as THREE.Texture | null },
    uClimbMap: { value: null as THREE.Texture | null },
    /** Terrain height (m) at 1 m, for the climb height gate; -1000 off-island */
    uGroundMap: { value: null as THREE.Texture | null },
    uPaintBounds: { value: new THREE.Vector4() },
    uPaintOn: { value: 0 },
    ...paintLookUniforms(),
  };

  constructor(bounds: { minX: number; maxX: number; minZ: number; maxZ: number }, private texelsPerMetre = 6.8, readonly seed = 1337) {
    this.bounds = { ...bounds };
    this.rand = mulberry32(seed);
    const sr = mulberry32(seed ^ 0x9e3779b9);
    this.uniforms.uPaintSeed.value.set(sr() * 512, sr() * 512);
    this.gridW = Math.ceil(bounds.maxX - bounds.minX);
    this.gridH = Math.ceil(bounds.maxZ - bounds.minZ);
    this.grid = new Float32Array(this.gridW * this.gridH);
    this.uniforms.uPaintBounds.value.set(bounds.minX, bounds.maxX, bounds.minZ, bounds.maxZ);
  }

  init(renderer: THREE.WebGLRenderer): void {
    this.renderer = renderer;
    const { minX, maxX, minZ, maxZ } = this.bounds;
    const cap = Math.min(4096, renderer.capabilities.maxTextureSize);
    const w = Math.min(cap, Math.round((maxX - minX) * this.texelsPerMetre));
    const h = Math.min(cap, Math.round((maxZ - minZ) * this.texelsPerMetre));
    this.rt = new THREE.WebGLRenderTarget(w, h, {
      type: THREE.UnsignedByteType,
      format: THREE.RGBAFormat,
      magFilter: THREE.LinearFilter,
      minFilter: THREE.LinearFilter,
      depthBuffer: false,
    });
    this.wetRT = new THREE.WebGLRenderTarget(Math.round(w / 2), Math.round(h / 2), {
      type: THREE.UnsignedByteType,
      format: THREE.RGBAFormat,
      magFilter: THREE.LinearFilter,
      minFilter: THREE.LinearFilter,
      depthBuffer: false,
    });
    const prev = renderer.getRenderTarget();
    renderer.setClearColor(0x000000, 1);
    for (const t of [this.rt, this.wetRT]) {
      renderer.setRenderTarget(t);
      renderer.clear();
    }
    renderer.setRenderTarget(prev);
    // look up from below with up=+Z: u→+X, v→+Z (same convention as the colour mask)
    Object.assign(this.cam, { left: minX, right: maxX, top: maxZ, bottom: minZ });
    this.cam.position.set(0, -50, 0);
    this.cam.up.set(0, 0, 1);
    this.cam.lookAt(0, 0, 0);
    this.cam.updateProjectionMatrix();

    const geo = new THREE.PlaneGeometry(1, 1);
    geo.rotateX(-Math.PI / 2);
    this.aRadius = new THREE.InstancedBufferAttribute(new Float32Array(PaintLayer.MAX), 1).setUsage(THREE.DynamicDrawUsage);
    this.aStrength = new THREE.InstancedBufferAttribute(new Float32Array(PaintLayer.MAX), 1).setUsage(THREE.DynamicDrawUsage);
    this.aWet = new THREE.InstancedBufferAttribute(new Float32Array(PaintLayer.MAX), 1).setUsage(THREE.DynamicDrawUsage);
    this.aSeed = new THREE.InstancedBufferAttribute(new Float32Array(PaintLayer.MAX), 1).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aWet', this.aWet);
    geo.setAttribute('aSeed', this.aSeed);
    geo.setAttribute('aRadius', this.aRadius);
    geo.setAttribute('aStrength', this.aStrength);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uWetPass: { value: 0 } },
      transparent: true,
      blending: THREE.CustomBlending,
      blendEquation: THREE.MaxEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
      vertexShader: /* glsl */ `
        attribute float aRadius;
        attribute float aStrength;
        attribute float aWet;
        attribute float aSeed;
        varying float vSeed;
        varying vec2 vWorld;
        varying vec2 vCenter;
        varying float vRadius;
        varying float vStrength;
        varying float vWet;
        void main() {
          vWet = aWet;
          vSeed = aSeed;
          vWorld = (instanceMatrix * vec4(position, 1.0)).xz;
          vCenter = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xz;
          vRadius = aRadius;
          vStrength = aStrength;
          gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        varying vec2 vWorld;
        varying vec2 vCenter;
        varying float vRadius;
        varying float vStrength;
        varying float vWet;
        varying float vSeed;
        uniform float uWetPass;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
        float noise(vec2 p){
          vec2 i = floor(p); vec2 f = fract(p);
          float a = hash(i), b = hash(i+vec2(1.,0.)), c = hash(i+vec2(0.,1.)), d = hash(i+vec2(1.,1.));
          vec2 u = f*f*(3.-2.*f);
          return mix(a,b,u.x) + (c-a)*u.y*(1.-u.x) + (d-b)*u.x*u.y;
        }
        void main() {
          // Stationary world-space noise: neighbouring blooms share one ragged coastline.
          float n = (noise(vWorld * 0.55) - 0.5) * 0.55
                  + (noise(vWorld * 1.9 + 7.0) - 0.5) * 0.3
                  + (noise(vWorld * 6.5 + 3.0) - 0.5) * 0.12;
          float d = distance(vWorld, vCenter) / max(vRadius, 0.01) + n;
          if (uWetPass > 0.5) {
            // the spreading front of a wet bloom glistens; its interior a little
            float front = smoothstep(0.5, 0.8, d) * (1.0 - smoothstep(0.82, 0.92, d));
            float pool = 1.0 - smoothstep(0.55, 0.86, d);
            gl_FragColor = vec4((front + pool * 0.3) * vWet * vStrength, 0.0, 0.0, 1.0);
            return;
          }
          // watercolour: a decided body edge, then a thin wet fringe creeping out in fingers
          float core = 1.0 - smoothstep(0.62, 0.8, d);
          float fingers = (noise(vWorld * 2.6 + 19.0) - 0.5) * 0.3;
          float fringe = (1.0 - smoothstep(0.76, 1.08 + fingers, d)) * 0.42;
          float ink = max(core, fringe);
          // paper granulation inside the wash
          ink *= 0.9 + 0.1 * noise(vWorld * 9.0);
          // G: this wash's pigment id (MAX-blended → overlapping washes keep their own shapes)
          gl_FragColor = vec4(ink * vStrength, core * (0.15 + 0.85 * vSeed), 0.0, 1.0);
        }`,
    });
    this.mat = mat;
    this.mesh = new THREE.InstancedMesh(geo, mat, PaintLayer.MAX);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);

    // climb coverage: 1 m texels; each texel eases toward the paint dilated over a prop footprint
    const cw = Math.ceil(maxX - minX);
    const ch = Math.ceil(maxZ - minZ);
    const climbOpts = { type: THREE.UnsignedByteType, format: THREE.RGBAFormat, magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter, depthBuffer: false };
    this.climbRT = [new THREE.WebGLRenderTarget(cw, ch, climbOpts), new THREE.WebGLRenderTarget(cw, ch, climbOpts)];
    for (const t of this.climbRT) {
      renderer.setRenderTarget(t);
      renderer.clear();
    }
    renderer.setRenderTarget(prev);
    this.climbMat = new THREE.ShaderMaterial({
      uniforms: {
        tPaint: { value: this.rt.texture },
        tPrev: { value: null as THREE.Texture | null },
        uStep: { value: 0 },
        uMetre: { value: new THREE.Vector2(1 / (maxX - minX), 1 / (maxZ - minZ)) },
      },
      depthTest: false,
      depthWrite: false,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D tPaint;
        uniform sampler2D tPrev;
        uniform float uStep;
        uniform vec2 uMetre;
        varying vec2 vUv;
        void main() {
          // a wall or trunk 1–4 m from the wash still drinks it: dilate over the footprint
          float target = texture2D(tPaint, vUv).r;
          for (int k = 0; k < 8; k++) {
            float a = float(k) * 0.785398 + 0.3;
            vec2 o = vec2(cos(a), sin(a)) * uMetre;
            target = max(target, texture2D(tPaint, vUv + o * 0.6).r);
            target = max(target, texture2D(tPaint, vUv + o * 2.0).r * 0.95);
            target = max(target, texture2D(tPaint, vUv + o * 3.8).r * 0.78);
          }
          float prevC = texture2D(tPrev, vUv).r;
          gl_FragColor = vec4(prevC + clamp(target - prevC, 0.0, uStep), 0.0, 0.0, 1.0);
        }`,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.climbMat);
    quad.frustumCulled = false;
    this.climbScene.add(quad);

    this.uniforms.uPaintMap.value = this.rt.texture;
    this.uniforms.uWetMap.value = this.wetRT.texture;
    this.uniforms.uClimbMap.value = this.climbRT[0].texture;
    this.uniforms.uPaintOn.value = 1;
  }

  /** Bake terrain height (1 m) for the prop climb gate. `heightAt` returns < -500 where there is no ground. */
  setGround(heightAt: (x: number, z: number) => number): void {
    const { minX, minZ } = this.bounds;
    const w = this.gridW;
    const h = this.gridH;
    const data = new Uint16Array(w * h * 4);
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const y = heightAt(minX + i + 0.5, minZ + j + 0.5);
        data[(j * w + i) * 4] = THREE.DataUtils.toHalfFloat(Number.isFinite(y) ? Math.max(-1000, y) : -1000);
      }
    const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.HalfFloatType);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    this.uniforms.uGroundMap.value = tex;
  }

  /** Lay one wet bloom that spreads to `radius` over `life` seconds, then dries in place. */
  bloom(x: number, z: number, radius: number, strength = this.tun.strength, life = this.tun.bloomLife, start = 0.35, delay = 0): void {
    const { minX, maxX, minZ, maxZ } = this.bounds;
    if (x < minX || x > maxX || z < minZ || z > maxZ || strength < 0.02) return;
    if (this.blooms.length >= PaintLayer.MAX) this.blooms.shift();
    this.blooms.push({ x, z, radius, strength: Math.min(1, strength), age: -delay, life, seed: this.rand(), start });
    this.laid++;
    this.markGrid(x, z, radius * 0.8, Math.min(1, strength));
  }

  /**
   * A big radial burst (Shade freed, hearth lit, Seedwell latched): one wash spreads out of a
   * point to `radius` over ~`life` s while petal lobes run ahead of it unevenly, then all of it dries for good.
   */
  splash(x: number, z: number, radius: number, life = 1.5): void {
    this.bloom(x, z, radius * 0.8, 1, life, 0.06);
    const lobes = 9;
    const rnd = this.rand;
    const a0 = rnd() * Math.PI * 2;
    for (let i = 0; i < lobes; i++) {
      const a = a0 + (i / lobes) * Math.PI * 2 + (rnd() - 0.5) * 0.5;
      const d = radius * (0.42 + rnd() * 0.3);
      // a lobe wells up once the central wash has reached it, then runs on past the rim
      const delay = life * (0.18 + (d / radius) * 0.35);
      this.bloom(x + Math.cos(a) * d, z + Math.sin(a) * d, radius * (0.3 + rnd() * 0.16), 0.95, life * (0.7 + rnd() * 0.35), 0.3, delay);
    }
  }

  private markGrid(x: number, z: number, r: number, k: number): void {
    const gx0 = Math.max(0, Math.floor(x - r - this.bounds.minX));
    const gx1 = Math.min(this.gridW - 1, Math.floor(x + r - this.bounds.minX));
    const gz0 = Math.max(0, Math.floor(z - r - this.bounds.minZ));
    const gz1 = Math.min(this.gridH - 1, Math.floor(z + r - this.bounds.minZ));
    for (let gz = gz0; gz <= gz1; gz++)
      for (let gx = gx0; gx <= gx1; gx++) {
        const cx = gx + 0.5 + this.bounds.minX;
        const cz = gz + 0.5 + this.bounds.minZ;
        if (Math.hypot(cx - x, cz - z) > r) continue;
        const i = gz * this.gridW + gx;
        if (this.grid[i]! < 0.5 && k >= 0.5) this.painted++;
        this.grid[i] = Math.max(this.grid[i]!, k);
      }
  }

  /** Painted fraction (0..1) of the ground within `r` metres. */
  coverageAround(x: number, z: number, r: number): number {
    let sum = 0;
    let n = 0;
    const gx0 = Math.max(0, Math.floor(x - r - this.bounds.minX));
    const gx1 = Math.min(this.gridW - 1, Math.floor(x + r - this.bounds.minX));
    const gz0 = Math.max(0, Math.floor(z - r - this.bounds.minZ));
    const gz1 = Math.min(this.gridH - 1, Math.floor(z + r - this.bounds.minZ));
    for (let gz = gz0; gz <= gz1; gz += 1)
      for (let gx = gx0; gx <= gx1; gx += 1) {
        if (Math.hypot(gx + 0.5 + this.bounds.minX - x, gz + 0.5 + this.bounds.minZ - z) > r) continue;
        sum += this.grid[gz * this.gridW + gx]!;
        n++;
      }
    return n ? sum / n : 0;
  }

  /** Painted ground area (m²) */
  get paintedArea(): number {
    return this.painted;
  }

  /** Advance wet blooms and stamp them into the persistent target. */
  render(dt: number): void {
    const t0 = performance.now();
    this.stamp(dt);
    this.climb(dt);
    this.passMs = performance.now() - t0;
  }

  /** Ease the climb target toward the (dilated) paint; idles once everything has finished climbing. */
  private climb(dt: number): void {
    if (!this.climbRT || !this.climbMat || !this.renderer) return;
    if (this.blooms.length) this.climbSettle = 1 / Math.max(0.05, this.tun.climbRate) + 0.3;
    if (this.climbSettle <= 0) return;
    this.climbSettle -= dt;
    const [a, b] = this.climbRT;
    this.climbMat.uniforms.tPrev!.value = a.texture;
    this.climbMat.uniforms.uStep!.value = Math.max(1 / 255, this.tun.climbRate * dt);
    const renderer = this.renderer;
    const prev = renderer.getRenderTarget();
    renderer.setRenderTarget(b);
    renderer.render(this.climbScene, this.climbCam);
    renderer.setRenderTarget(prev);
    this.climbRT = [b, a];
    this.uniforms.uClimbMap.value = b.texture;
  }

  private stamp(dt: number): void {
    for (const b of this.blooms) b.age += dt;
    if (!this.rt || !this.wetRT || !this.renderer || !this.mesh || !this.mat) return;
    if (!this.blooms.length) {
      if (this.wetDirty) {
        const prev = this.renderer.getRenderTarget();
        this.renderer.setRenderTarget(this.wetRT);
        this.renderer.setClearColor(0x000000, 1);
        this.renderer.clear();
        this.renderer.setRenderTarget(prev);
        this.wetDirty = false;
      }
      return;
    }
    const mesh = this.mesh;
    const live = this.blooms.filter((b) => b.age >= 0);
    const n = live.length;
    for (let i = 0; i < n; i++) {
      const b = live[i]!;
      const t = Math.min(1, b.age / b.life);
      // wet spread: quick bloom out of the pawfall, slowing as the pigment settles
      const r = b.radius * (b.start + (1 - b.start) * (1 - Math.pow(1 - t, 3)));
      const size = r * 3.4; // quad support for the noise-bent edge and wet fringe
      this._m.makeScale(size, 1, size).setPosition(b.x, 0, b.z);
      mesh.setMatrixAt(i, this._m);
      this.aRadius!.setX(i, r);
      this.aStrength!.setX(i, b.strength);
      this.aWet!.setX(i, 1 - t * t);
      this.aSeed!.setX(i, b.seed);
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    this.aRadius!.needsUpdate = true;
    this.aStrength!.needsUpdate = true;
    this.aWet!.needsUpdate = true;
    this.aSeed!.needsUpdate = true;
    const renderer = this.renderer;
    const prev = renderer.getRenderTarget();
    const prevAuto = renderer.autoClear;
    renderer.autoClear = false;
    this.mat.uniforms.uWetPass!.value = 0;
    renderer.setRenderTarget(this.rt);
    renderer.render(this.scene, this.cam);
    this.mat.uniforms.uWetPass!.value = 1;
    renderer.setRenderTarget(this.wetRT);
    renderer.setClearColor(0x000000, 1);
    renderer.clear();
    renderer.render(this.scene, this.cam);
    this.wetDirty = true;
    renderer.setRenderTarget(prev);
    renderer.autoClear = prevAuto;
    this.blooms = this.blooms.filter((b) => b.age < b.life);
  }

  dispose(): void {
    this.rt?.dispose();
    this.wetRT?.dispose();
    for (const t of this.climbRT ?? []) t.dispose();
    this.climbMat?.dispose();
    this.uniforms.uGroundMap.value?.dispose();
    this.mesh?.geometry.dispose();
    (this.mesh?.material as THREE.Material | undefined)?.dispose();
  }
}

/** What the fox's paint restores a material to (see the uPaintKind shader uniform). */
function paintKindOf(mat: THREE.Material): number {
  const kind = (mat.userData as { cfPaintKind?: number }).cfPaintKind;
  if (kind !== undefined) return kind;
  // grass blades on the path green up with the meadow under them
  if (mat.name === 'rv-terrain' || mat.name === 'rv-ground' || /grass/i.test(mat.name)) return 0;
  if (mat.name === 'rv-stone' || mat.name === 'rv-rock') return 1;
  if (mat.name === 'rv-litter') return 3;
  return 2;
}

/** Trunks and canopies climb further than walls and rocks (uClimbFoliage). */
function climbTallOf(mat: THREE.Material): number {
  return (mat.userData as { foliage?: boolean }).foliage || /bark|canopy|leaf|trunk/i.test(mat.name) ? 1 : 0;
}

/** Convenience factory */
export function createColorField(opts?: ColorFieldOptions): ColorField {
  return new ColorField(opts);
}

const _ab = new THREE.Vector3();
const _ap = new THREE.Vector3();
function distToSegment(p: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3): number {
  _ab.subVectors(b, a);
  _ap.subVectors(p, a);
  const l2 = _ab.lengthSq();
  const t = l2 > 1e-8 ? THREE.MathUtils.clamp(_ap.dot(_ab) / l2, 0, 1) : 0;
  return _ap.addScaledVector(_ab, -t).length();
}
