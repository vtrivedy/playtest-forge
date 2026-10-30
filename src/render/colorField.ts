import * as THREE from 'three';

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
      uniforms: {
        uTime: { value: 0 },
      },
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
          gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        varying vec2 vUv;
        varying float vStrength;
        varying float vNoise;
        varying float vInner;
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
          // world-space brush noise (two octaves, slow drift): neighbouring stamps share one ragged,
          // organic edge instead of each repeating the same disc outline
          float n = ((noise(vWorld * 0.55 + uTime * 0.07) - 0.5) * 1.6 + (noise(vWorld * 2.1 - uTime * 0.05) - 0.5) * 0.7) * (vNoise + 0.12);
          float d = length(p) + n;
          float soft = 1.0 - smoothstep(vInner * 0.8, 1.0, d);
          float ink = soft * soft * (3.0 - 2.0 * soft) * vStrength;
          gl_FragColor = vec4(ink, ink, ink, 1.0);
        }`,
    });
    const N = ColorField.MAX_STAMPS;
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.rotateX(-Math.PI / 2);
    this.stampStrength = new THREE.InstancedBufferAttribute(new Float32Array(N), 1);
    this.stampNoise = new THREE.InstancedBufferAttribute(new Float32Array(N), 1);
    this.stampInner = new THREE.InstancedBufferAttribute(new Float32Array(N), 1);
    this.stampStrength.setUsage(THREE.DynamicDrawUsage);
    this.stampNoise.setUsage(THREE.DynamicDrawUsage);
    this.stampInner.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aStrength', this.stampStrength);
    geo.setAttribute('aNoise', this.stampNoise);
    geo.setAttribute('aInner', this.stampInner);
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

    const stamps: Array<{ x: number; z: number; size: number; strength: number; noise: number; inner: number }> = [];

    for (const r of this.restores) {
      if (r.radius > 0.01) {
        // full strength inside radius - edge, fading to 0 by radius + edge (matches the analytic front)
        const edge = Math.max(0.3, ColorField.edgeOf(r));
        const outer = r.radius + edge;
        stamps.push({
          x: r.center.x,
          z: r.center.z,
          size: outer * 2,
          strength: 1,
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
      if (g.strength > 0.01) stamps.push({ x: g.x, z: g.z, size: g.radius * 2, strength: g.strength, noise: 0.12, inner: 0.35 });
    }
    // strokes: a bead of stamps along each capsule, brighter and longer-lived than the trail
    for (const st of this.strokes) {
      const len = Math.hypot(st.b.x - st.a.x, st.b.z - st.a.z);
      const n = Math.max(1, Math.ceil(len / 0.9));
      const k = Math.min(1, this.strokeStrength(st));
      for (let i = 0; i <= n; i++) {
        const u = i / n;
        stamps.push({ x: st.a.x + (st.b.x - st.a.x) * u, z: st.a.z + (st.b.z - st.a.z) * u, size: st.radius * 2.2, strength: 0.95 * k, noise: 0.08, inner: 0.5 });
      }
    }

    const mesh = this.stampMesh;
    const n = Math.min(stamps.length, ColorField.MAX_STAMPS);
    const m = this._stampMatrix;
    for (let i = 0; i < n; i++) {
      const s = stamps[i]!;
      m.makeScale(s.size, 1, s.size).setPosition(s.x, 0, s.z);
      mesh.setMatrixAt(i, m);
      this.stampStrength!.setX(i, s.strength);
      this.stampNoise!.setX(i, s.noise);
      this.stampInner!.setX(i, s.inner);
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    this.stampStrength!.needsUpdate = true;
    this.stampNoise!.needsUpdate = true;
    this.stampInner!.needsUpdate = true;
    this.stampMat.uniforms.uTime!.value = this.time;
    renderer.render(this.maskScene, this.maskCam);

    renderer.setRenderTarget(prevTarget);
    renderer.autoClear = prevAutoClear;
    void dt;
  }

  getMaskTexture(): THREE.Texture | null {
    return this.maskRT?.texture ?? null;
  }

  /**
   * Patch MeshStandardMaterial: ink-wash mono + color mask blend.
   * Call once per material; then syncUniforms each frame.
   */
  patchMaterial(mat: THREE.MeshStandardMaterial): void {
    const field = this;
    const prev = mat.onBeforeCompile;
    mat.onBeforeCompile = (shader, renderer) => {
      prev.call(mat, shader, renderer); // keep material-specific patches (e.g. ground blend)
      shader.uniforms.uFox = { value: field.fox.clone() };
      shader.uniforms.uAura = { value: field.auraRadius };
      shader.uniforms.uTrailRadius = { value: field.trailRadius };
      shader.uniforms.uTrailLife = { value: field.trailLife };
      shader.uniforms.uGlobalColor = { value: field.globalColor };
      shader.uniforms.uGroundSurface = { value: mat.name === 'rv-terrain' || mat.name === 'rv-ground' ? 1 : 0 };
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
      shader.uniforms.uTime = { value: 0 };
      shader.uniforms.uRestoredChroma = { value: (mat.userData as { cfRestoredChroma?: number }).cfRestoredChroma ?? 1 };

      (mat.userData as { colorFieldShader?: typeof shader }).colorFieldShader = shader;

      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
          varying vec3 vWorldPosCF;
          varying vec3 vWorldNormalCF;`,
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
          uniform sampler2D uMaskMap;
          uniform float uUseMaskMap;
          uniform vec4 uBounds;
          uniform float uTime;

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

          float colorMaskAt(vec3 p) {
            float s = uGlobalColor;
            cfRim = 0.0;
            cfPermanent = uGlobalColor;
            if (uUseMaskMap > 0.5) {
              vec2 uv = vec2(
                (p.x - uBounds.x) / (uBounds.y - uBounds.x),
                (p.z - uBounds.z) / (uBounds.w - uBounds.z)
              );
              if (uv.x >= 0.0 && uv.x <= 1.0 && uv.y >= 0.0 && uv.y <= 1.0) {
                s = max(s, texture2D(uMaskMap, uv).r);
              }
            }
            // analytic restores with ink-bleed edge
            for (int i = 0; i < 4; i++) {
              if (i >= uRestoreCount) break;
              float rad = uRestoreRad[i];
              if (rad < 0.001) continue;
              vec3 c = uRestorePos[i];
              float d = distance(p.xz, c.xz);
              float edge = min(rad * 0.18, uRestoreEdge[i]);
              // painterly ragged front: two octaves so a crisp front still reads as brushwork
              float n = ((noise21(p.xz * 0.35 + uTime * 0.15) - 0.5) * 0.8 + (noise21(p.xz * 1.7 - uTime * 0.1) - 0.5) * 0.35) * edge * 1.6;
              float local = 1.0 - smoothstep(rad - edge + n, rad + edge * 0.5 + n, d);
              s = max(s, local);
              cfPermanent = max(cfPermanent, local);
              // the band just behind the front glows warm while it travels
              float behind = rad + n - d;
              cfRim = max(cfRim, uRestoreRim[i] * smoothstep(-edge * 0.4, edge * 0.3, behind) * (1.0 - smoothstep(edge * 0.4, edge * 2.6, behind)));
            }
            // aura: feathered and brush-broken, not a clean sphere
            float an = (noise21(p.xz * 0.6 + uTime * 0.08) - 0.5) * 0.35 + (noise21(p.xz * 2.3) - 0.5) * 0.15;
            float ad = distance(p, uFox) / uAura + an;
            float af = 1.0 - smoothstep(0.15, 1.0, ad);
            s = max(s, af * af);
            // the mask RT already carries the trail; the analytic loop is the no-RT fallback
            for (int i = 0; i < 24; i++) {
              if (i >= uTrailCount || uUseMaskMap > 0.5) break;
              vec3 tp = vec3(uTrail[i*4], uTrail[i*4+1], uTrail[i*4+2]);
              float life = uTrail[i*4+3];
              float td = distance(p, tp);
              float fall = 1.0 - clamp(td / uTrailRadius, 0.0, 1.0);
              s = max(s, fall * fall * (life / uTrailLife));
            }
            return clamp(s, 0.0, 1.0);
          }

          vec3 inkWash(vec3 color, vec3 worldPos, vec3 worldN) {
            // Faded sepia old photograph: luminance-preserving tone (darks stay dark — a lifted
            // floor turned thin dark reeds into pale streaks), soft paper shoulder, a ghost of hue.
            float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
            vec3 ink = luma * vec3(1.12, 0.93, 0.66);
            // faded blacks: a little warm lift, not a grey floor
            ink = ink * 0.94 + vec3(0.016, 0.012, 0.008);
            // paper shoulder so sunlit stone tops out cream, never white
            float sh = smoothstep(0.35, 1.6, luma);
            ink = mix(ink, vec3(0.86, 0.74, 0.56) * (0.45 + luma * 0.4), sh * 0.6);
            // ochre warmth in the mids (pressed-leaf) and a trace of the original hue
            ink = mix(ink, ink * vec3(1.08, 0.97, 0.8), smoothstep(0.04, 0.3, luma) * (1.0 - sh));
            ink = mix(ink, color * 0.92, 0.1);
            // low-frequency foxing / water stains only — fine world noise aliased into stipple
            vec2 gp = worldPos.xz + worldPos.y * vec2(0.71, 1.37);
            float g = (noise21(gp * 0.9) - 0.5) * 0.12 + (noise21(gp * 3.1) - 0.5) * 0.06;
            float fox = smoothstep(0.62, 0.9, noise21(gp * 0.35 + 3.1));
            ink *= 1.0 + g;
            ink = mix(ink, ink * vec3(0.9, 0.76, 0.56), fox * 0.25);
            // top-lit surfaces catch a breath of paper (soft wash, not a rim halo)
            float up = clamp(dot(normalize(worldN), vec3(0.0, 1.0, 0.0)), 0.0, 1.0);
            ink += up * up * vec3(0.012, 0.009, 0.005);
            return ink;
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
          vec3 chroma = mix(dot(outgoingLight, vec3(0.2126, 0.7152, 0.0722)) * vec3(1.04, 0.98, 0.88), outgoingLight, mix(uRestoredChroma, 1.0, cfPermanent * uGroundSurface)) * (1.0 + edgeBoost * 0.12);
          chroma *= mix(vec3(1.0), vec3(1.12, 1.04, 0.86), cfPermanent * uGroundSurface);
          // Keep the full feather instead of amplifying low mask values into a painted disc.
          // Modulation vanishes at 0/1, so untouched and fully restored regions remain exact.
          float brushEdge = (noise21(vWorldPosCF.xz * 0.85) - 0.5) * 0.5
            + (noise21(vWorldPosCF.xz * 2.7 + 8.0) - 0.5) * 0.2;
          float brushed = clamp(cm + brushEdge * sin(cm * 3.14159265), 0.0, 1.0);
          outgoingLight = mix(washed, chroma, brushed);
          // warm late-light band at a travelling restore front (#FFC98A): lifts what it crosses
          // without repainting it — stone stays stone, just sunlit
          float rimLuma = dot(outgoingLight, vec3(0.2126, 0.7152, 0.0722));
          outgoingLight += cfRim * (outgoingLight * vec3(0.55, 0.32, 0.08) + vec3(0.11, 0.06, 0.018) * (0.35 + rimLuma));
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
    const u = shader.uniforms;
    (u.uFox!.value as THREE.Vector3).copy(this.fox);
    u.uAura!.value = this.auraRadius;
    u.uTrailRadius!.value = this.trailRadius;
    u.uTrailLife!.value = this.trailLife;
    u.uGlobalColor!.value = this.globalColor;
    if (u.uRestoredChroma) u.uRestoredChroma.value = (mat.userData as { cfRestoredChroma?: number }).cfRestoredChroma ?? 1;
    u.uTime!.value = this.time;
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
      edgeArr[i] = Number.isFinite(r.edgeMax) ? r.edgeMax : 1e6;
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
