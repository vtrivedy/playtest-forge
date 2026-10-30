import * as THREE from 'three';

export type TrailSample = { x: number; y: number; z: number; life: number };

export type RestoreRegion = {
  center: THREE.Vector3;
  targetRadius: number;
  radius: number;
  durationS: number;
  age: number;
  /** 0..1 completion of the wavefront */
  t: number;
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
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  /** Global fill 0..1 (debug / end state) */
  globalColor = 0;

  /** Optional top-down mask RT (permanent + soft trail splat). Built lazily. */
  private maskRT: THREE.WebGLRenderTarget | null = null;
  private maskScene: THREE.Scene | null = null;
  private maskCam: THREE.OrthographicCamera | null = null;
  private fadeMat: THREE.ShaderMaterial | null = null;
  private stampMat: THREE.ShaderMaterial | null = null;
  private stampMesh: THREE.Mesh | null = null;
  private readonly _stampPos = new THREE.Vector3();
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
  restore(center: THREE.Vector3, radius: number, durationS = 2.2): RestoreRegion {
    const r: RestoreRegion = {
      center: center.clone(),
      targetRadius: radius,
      radius: 0,
      durationS: Math.max(0.2, durationS),
      age: 0,
      t: 0,
    };
    this.restores.push(r);
    return r;
  }

  update(dt: number): void {
    this._accum += dt;
    for (const t of this.trail) t.life -= dt;
    this.trail = this.trail.filter((t) => t.life > 0);
    if (this._accum >= this.trailDepositInterval) {
      this._accum = 0;
      this.trail.push({ x: this.fox.x, y: this.fox.y, z: this.fox.z, life: this.trailLife });
      if (this.trail.length > this.trailMax) this.trail.shift();
    }
    for (const r of this.restores) {
      r.age += dt;
      r.t = Math.min(1, r.age / r.durationS);
      // ease-out cubic wavefront
      const e = 1 - Math.pow(1 - r.t, 3);
      r.radius = r.targetRadius * e;
    }
  }

  /** Saturation 0..1 at a world point (gameplay probes). */
  sample(p: THREE.Vector3): number {
    let s = this.globalColor;
    for (const r of this.restores) {
      const d = p.distanceTo(r.center);
      // soft noise-ish edge approx on CPU
      const edge = r.radius * 0.12;
      const local = 1 - THREE.MathUtils.smoothstep(r.radius - edge, r.radius + edge, d);
      s = Math.max(s, local);
    }
    const aura = 1 - Math.min(1, p.distanceTo(this.fox) / this.auraRadius);
    s = Math.max(s, Math.pow(Math.max(0, aura), 1.15));
    for (const t of this.trail) {
      const d = Math.hypot(p.x - t.x, p.y - t.y, p.z - t.z);
      const fall = 1 - Math.min(1, d / this.trailRadius);
      s = Math.max(s, fall * (t.life / this.trailLife));
    }
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

    this.stampMat = new THREE.ShaderMaterial({
      uniforms: {
        uStrength: { value: 1 },
        uNoiseAmp: { value: 0.08 },
        uTime: { value: 0 },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uStrength;
        uniform float uNoiseAmp;
        uniform float uTime;
        varying vec2 vUv;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
        float noise(vec2 p){
          vec2 i = floor(p); vec2 f = fract(p);
          float a = hash(i), b = hash(i+vec2(1.,0.)), c = hash(i+vec2(0.,1.)), d = hash(i+vec2(1.,1.));
          vec2 u = f*f*(3.-2.*f);
          return mix(a,b,u.x) + (c-a)*u.y*(1.-u.x) + (d-b)*u.x*u.y;
        }
        void main() {
          vec2 p = vUv * 2.0 - 1.0;
          float n = noise(p * 4.0 + uTime) * uNoiseAmp;
          float d = length(p) + n;
          float soft = 1.0 - smoothstep(0.55, 1.0, d);
          float ink = soft * soft * uStrength;
          gl_FragColor = vec4(ink, ink, ink, 1.0);
        }`,
    });
    this.stampMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.stampMat);
    this.stampMesh.frustumCulled = false;
  }

  private rebuildMaskCam(): void {
    if (!this.maskCam) return;
    const { minX, maxX, minZ, maxZ } = this.bounds;
    this.maskCam.left = minX;
    this.maskCam.right = maxX;
    this.maskCam.top = maxZ;
    this.maskCam.bottom = minZ;
    this.maskCam.position.set(0, 50, 0);
    this.maskCam.up.set(0, 0, -1);
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

    this.maskScene.clear();
    const stamps: Array<{ x: number; z: number; size: number; strength: number; noise: number }> = [];

    for (const r of this.restores) {
      if (r.radius > 0.01) {
        stamps.push({
          x: r.center.x,
          z: r.center.z,
          size: r.radius * 2.2,
          strength: 1,
          noise: 0.12,
        });
      }
    }
    stamps.push({
      x: this.fox.x,
      z: this.fox.z,
      size: this.auraRadius * 2.0,
      strength: 0.95,
      noise: 0.06,
    });
    for (const t of this.trail) {
      const life = t.life / this.trailLife;
      stamps.push({
        x: t.x,
        z: t.z,
        size: this.trailRadius * 2.0,
        strength: 0.7 * life,
        noise: 0.1,
      });
    }

    const tNow = performance.now() * 0.001;
    for (const s of stamps) {
      this.stampMesh.position.set(s.x, 0, s.z);
      this.stampMesh.scale.set(s.size, s.size, 1);
      this.stampMesh.rotation.x = -Math.PI / 2;
      this.stampMat.uniforms.uStrength!.value = s.strength;
      this.stampMat.uniforms.uNoiseAmp!.value = s.noise;
      this.stampMat.uniforms.uTime!.value = tNow;
      this.maskScene.add(this.stampMesh);
      renderer.render(this.maskScene, this.maskCam);
      this.maskScene.remove(this.stampMesh);
    }

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
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uFox = { value: field.fox.clone() };
      shader.uniforms.uAura = { value: field.auraRadius };
      shader.uniforms.uTrailRadius = { value: field.trailRadius };
      shader.uniforms.uTrailLife = { value: field.trailLife };
      shader.uniforms.uGlobalColor = { value: field.globalColor };
      shader.uniforms.uTrail = { value: new Float32Array(24 * 4) };
      shader.uniforms.uTrailCount = { value: 0 };
      // up to 4 restores
      shader.uniforms.uRestorePos = { value: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()] };
      shader.uniforms.uRestoreRad = { value: new Float32Array(4) };
      shader.uniforms.uRestoreCount = { value: 0 };
      shader.uniforms.uMaskMap = { value: field.getMaskTexture() };
      shader.uniforms.uUseMaskMap = { value: 0 };
      shader.uniforms.uBounds = {
        value: new THREE.Vector4(field.bounds.minX, field.bounds.maxX, field.bounds.minZ, field.bounds.maxZ),
      };
      shader.uniforms.uTime = { value: 0 };

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
          uniform float uTrail[96];
          uniform int uTrailCount;
          uniform vec3 uRestorePos[4];
          uniform float uRestoreRad[4];
          uniform int uRestoreCount;
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
              float n = (noise21(p.xz * 0.35 + uTime * 0.15) - 0.5) * rad * 0.14;
              float edge = rad * 0.18;
              float local = 1.0 - smoothstep(rad - edge + n, rad + edge * 0.5 + n, d);
              s = max(s, local);
            }
            float ad = distance(p, uFox);
            s = max(s, pow(1.0 - clamp(ad / uAura, 0.0, 1.0), 1.15));
            for (int i = 0; i < 24; i++) {
              if (i >= uTrailCount) break;
              vec3 tp = vec3(uTrail[i*4], uTrail[i*4+1], uTrail[i*4+2]);
              float life = uTrail[i*4+3];
              float td = distance(p, tp);
              float fall = 1.0 - clamp(td / uTrailRadius, 0.0, 1.0);
              s = max(s, fall * fall * (life / uTrailLife));
            }
            return clamp(s, 0.0, 1.0);
          }

          vec3 inkWash(vec3 color, vec3 worldPos, vec3 worldN) {
            float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
            // Faded sepia old-photograph grade (autumn art direction)
            vec3 sepia = vec3(
              luma * 1.08,
              luma * 0.90,
              luma * 0.62
            );
            vec3 shadow = vec3(0.18, 0.14, 0.10);
            vec3 paper  = vec3(0.93, 0.87, 0.74);
            vec3 ink = mix(shadow, sepia, smoothstep(0.02, 0.55, luma));
            ink = mix(ink, paper * (0.55 + luma * 0.55), smoothstep(0.42, 0.92, luma));
            // amber / ochre lift in mids (pressed-leaf warmth)
            ink = mix(ink, vec3(0.74, 0.56, 0.34), 0.16 * smoothstep(0.18, 0.58, luma));
            // paper grain + foxing blotches
            float g = (noise21(worldPos.xz * 7.0) - 0.5) * 0.10;
            g += (noise21(worldPos.xz * 22.0) - 0.5) * 0.045;
            g += (noise21(worldPos.xz * 48.0) - 0.5) * 0.02;
            float fox = smoothstep(0.62, 0.9, noise21(worldPos.xz * 1.6 + 3.1));
            ink += g;
            ink = mix(ink, ink * vec3(0.92, 0.78, 0.58), fox * 0.22);
            // soft wash hatch (not harsh charcoal)
            float hatch = step(0.55, fract((worldPos.x + worldPos.z) * 3.2 + luma));
            float shadowAmt = 1.0 - smoothstep(0.05, 0.35, luma);
            ink = mix(ink, ink * 0.86, shadowAmt * hatch * 0.4);
            float rim = pow(1.0 - max(0.0, dot(normalize(worldN), vec3(0.2, 0.85, 0.15))), 2.0);
            ink += rim * vec3(0.07, 0.05, 0.028);
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
          vec3 chroma = outgoingLight * (1.0 + edgeBoost * 0.12);
          float bleed = smoothstep(0.0, 0.35, cm);
          outgoingLight = mix(washed, chroma, mix(cm, bleed, 0.35));
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
    u.uTime!.value = performance.now() * 0.001;
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
    const rc = Math.min(4, this.restores.length);
    u.uRestoreCount!.value = rc;
    for (let i = 0; i < rc; i++) {
      posArr[i]!.copy(this.restores[i]!.center);
      radArr[i] = this.restores[i]!.radius;
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
