import * as THREE from 'three';

export type SkyParams = {
  /** Top zenith (cool violet in key art) */
  zenith: THREE.Color;
  /** Mid-sky band between horizon and zenith (amber) */
  mid: THREE.Color;
  /** Horizon (warm peach) */
  horizon: THREE.Color;
  /** Below-horizon / ground bounce */
  nadir: THREE.Color;
  /** Low layered mist the horizon dissolves into — match scene fog */
  mist: THREE.Color;
  sunDir: THREE.Vector3;
  sunColor: THREE.Color;
  sunSize: number;
  sunBloom: number;
  /** Warm forward-scatter glow hugging the horizon under the sun */
  horizonGlow: number;
  /** Soft painted god rays fanning from the sun (0 = off) */
  godRays: number;
  /** Height of the mist band above the horizon (dir.y units) */
  mistHeight: number;
  cloudAmount: number;
  cloudScale: number;
  /** Paper / pigment grain amount (painterly) */
  grain: number;
  time: number;
};

export type PaintedSky = {
  mesh: THREE.Mesh;
  params: SkyParams;
  update: (dt: number) => void;
  dispose: () => void;
};

/**
 * Painted skydome: three-stop gradient (peach horizon → amber → cool violet zenith),
 * low sun disc with forward-scatter horizon glow, painted god-ray fan, drifting
 * watercolor clouds and a layered mist band at the horizon that matches scene fog.
 * Dome follows the camera so it always sits inside the far plane.
 */
export function createPaintedSky(scene: THREE.Scene, overrides: Partial<SkyParams> = {}): PaintedSky {
  const params: SkyParams = {
    zenith: new THREE.Color(overrides.zenith ?? 0x8a86a8),
    mid: new THREE.Color(overrides.mid ?? 0xe0a868),
    horizon: new THREE.Color(overrides.horizon ?? 0xf4c89a),
    nadir: new THREE.Color(overrides.nadir ?? 0x9a8478),
    mist: new THREE.Color(overrides.mist ?? 0xdcc0a4),
    sunDir: (overrides.sunDir ?? new THREE.Vector3(0.45, 0.55, 0.35)).clone().normalize(),
    sunColor: new THREE.Color(overrides.sunColor ?? 0xffd9a0),
    sunSize: overrides.sunSize ?? 0.006,
    sunBloom: overrides.sunBloom ?? 0.35,
    horizonGlow: overrides.horizonGlow ?? 0.6,
    godRays: overrides.godRays ?? 0.35,
    mistHeight: overrides.mistHeight ?? 0.08,
    cloudAmount: overrides.cloudAmount ?? 0.72,
    cloudScale: overrides.cloudScale ?? 1.2,
    grain: overrides.grain ?? 0.03,
    time: 0,
  };

  const uniforms = {
    uZenith: { value: params.zenith },
    uMid: { value: params.mid },
    uHorizon: { value: params.horizon },
    uNadir: { value: params.nadir },
    uMist: { value: params.mist },
    uSunDir: { value: params.sunDir.clone() },
    uSunColor: { value: params.sunColor },
    uSunSize: { value: params.sunSize },
    uSunBloom: { value: params.sunBloom },
    uHorizonGlow: { value: params.horizonGlow },
    uGodRays: { value: params.godRays },
    uMistHeight: { value: params.mistHeight },
    uCloudAmount: { value: params.cloudAmount },
    uCloudScale: { value: params.cloudScale },
    uGrain: { value: params.grain },
    uTime: { value: 0 },
  };

  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vDir = normalize(position);
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uZenith, uMid, uHorizon, uNadir, uMist, uSunDir, uSunColor;
      uniform float uSunSize, uSunBloom, uHorizonGlow, uGodRays, uMistHeight;
      uniform float uCloudAmount, uCloudScale, uGrain, uTime;
      varying vec3 vDir;

      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float noise(vec2 p){
        vec2 i=floor(p), f=fract(p);
        float a=hash(i), b=hash(i+vec2(1.,0.)), c=hash(i+vec2(0.,1.)), d=hash(i+vec2(1.,1.));
        vec2 u=f*f*(3.-2.*f);
        return mix(a,b,u.x)+(c-a)*u.y*(1.-u.x)+(d-b)*u.x*u.y;
      }
      float fbm(vec2 p){
        float v=0., a=0.5;
        for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.05; a*=0.5; }
        return v;
      }

      void main() {
        vec3 d = normalize(vDir);
        vec3 s = normalize(uSunDir);
        float h = d.y;
        float az = atan(d.z, d.x);

        // three-stop painted gradient; sun side of the sky runs warmer
        float sunSide = 0.5 + 0.5 * dot(normalize(d.xz + 1e-4), normalize(s.xz + 1e-4));
        float hp = max(h, 0.0);
        vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.22, hp));
        col = mix(col, uZenith, smoothstep(0.12 + 0.18 * sunSide, 0.85, hp));
        col = mix(col, uMid * 1.05, (1.0 - smoothstep(0.0, 0.35, hp)) * sunSide * 0.35);

        // below horizon → cloud-sea mist, then nadir
        col = mix(uNadir, col, smoothstep(-0.45, 0.0, h));

        // forward-scatter glow along the horizon under the sun
        float sd = 1.0 - dot(d, s);
        float band = exp(-abs(h - s.y * 0.35) * 9.0);
        col += uSunColor * uHorizonGlow * band * pow(sunSide, 4.0) * 0.4;

        // painted god-ray fan (angular streaks around the sun axis, above mist)
        vec3 up = abs(s.y) > 0.95 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
        vec3 t1 = normalize(cross(s, up));
        vec3 t2 = cross(t1, s);
        float ang = atan(dot(d, t2), dot(d, t1));
        float rays = noise(vec2(ang * 7.0, uTime * 0.04)) * 0.6 + noise(vec2(ang * 17.0 + 3.1, uTime * 0.03)) * 0.4;
        rays = smoothstep(0.42, 0.9, rays);
        float rayFall = exp(-sd * 3.2) * smoothstep(0.0, 0.03, sd);
        col += uSunColor * rays * rayFall * uGodRays * 0.6 * smoothstep(-0.05, 0.08, h);

        // drifting watercolor clouds on upper hemisphere, lit from the sun side
        if (h > 0.0) {
          vec2 uv = d.xz / max(0.18, d.y) * uCloudScale;
          uv += vec2(uTime * 0.01, uTime * 0.006);
          float c = fbm(uv);
          float clouds = smoothstep(0.52, 0.8, c) * uCloudAmount * smoothstep(0.03, 0.4, h);
          vec3 cloudCol = mix(mix(uMid, uHorizon, 0.5), vec3(1.0, 0.94, 0.86), 0.45);
          cloudCol = mix(cloudCol * vec3(0.86, 0.84, 0.95), cloudCol + uSunColor * 0.25, pow(sunSide, 2.0));
          col = mix(col, cloudCol, clouds * 0.8);
        }

        // layered horizon mist: two wavy bands so far land sinks into haze
        float m1 = smoothstep(uMistHeight + 0.05 * fbm(vec2(az * 3.0, 1.7) + uTime * 0.004), -0.02, h);
        float m2 = smoothstep(uMistHeight * 2.4 + 0.08 * fbm(vec2(az * 1.7 + 4.0, 0.3) - uTime * 0.003), uMistHeight * 0.5, h);
        vec3 mistLit = uMist + uSunColor * 0.18 * pow(sunSide, 2.0);
        col = mix(col, mistLit, clamp(m2 * 0.25 + m1 * 0.6, 0.0, 0.8));

        // sun disc + bloom on top of mist (disc can exceed 1.0 to feed bloom)
        float sun = smoothstep(uSunSize * 2.5, uSunSize * 0.15, sd);
        float bloom = exp(-sd * (18.0 / max(0.05, uSunBloom))) * uSunBloom;
        col += uSunColor * (sun * 1.6 + bloom);

        // paper grain
        col *= 1.0 + (fbm(d.xy * 90.0 + d.z * 37.0) - 0.5) * uGrain * 2.0;

        gl_FragColor = vec4(col, 1.0);
      }`,
  });

  const mesh = new THREE.Mesh(new THREE.SphereGeometry(400, 48, 24), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  // dome centred on the camera — keeps r=400 inside far plane from any spawn
  mesh.onBeforeRender = (_r, _s, camera) => {
    mesh.position.copy(camera.position);
    mesh.updateMatrixWorld();
  };
  scene.add(mesh);
  // keep env subtle if no HDRI
  scene.background = null;

  return {
    mesh,
    params,
    update(dt) {
      params.time += dt;
      uniforms.uTime.value = params.time;
      uniforms.uZenith.value = params.zenith;
      uniforms.uMid.value = params.mid;
      uniforms.uHorizon.value = params.horizon;
      uniforms.uNadir.value = params.nadir;
      uniforms.uMist.value = params.mist;
      uniforms.uSunDir.value.copy(params.sunDir).normalize();
      uniforms.uSunColor.value = params.sunColor;
      uniforms.uSunSize.value = params.sunSize;
      uniforms.uSunBloom.value = params.sunBloom;
      uniforms.uHorizonGlow.value = params.horizonGlow;
      uniforms.uGodRays.value = params.godRays;
      uniforms.uMistHeight.value = params.mistHeight;
      uniforms.uCloudAmount.value = params.cloudAmount;
      uniforms.uCloudScale.value = params.cloudScale;
      uniforms.uGrain.value = params.grain;
    },
    dispose() {
      mesh.geometry.dispose();
      mat.dispose();
      scene.remove(mesh);
    },
  };
}

/** Golden-hour key / fill / rim matching art direction. */
export function applyLookdevLights(scene: THREE.Scene): {
  key: THREE.DirectionalLight;
  fill: THREE.DirectionalLight;
  rim: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
} {
  const hemi = new THREE.HemisphereLight(0xffe2c0, 0x4a3828, 0.65);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xffd4a0, 2.5);
  key.position.set(10, 18, 8);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 70;
  key.shadow.camera.left = -22;
  key.shadow.camera.right = 22;
  key.shadow.camera.top = 22;
  key.shadow.camera.bottom = -22;
  key.shadow.bias = -0.00025;
  key.shadow.normalBias = 0.035;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xc08050, 0.45);
  fill.position.set(-12, 7, -6);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xffaa66, 0.55);
  rim.position.set(-2, 5, -14);
  scene.add(rim);

  return { key, fill, rim, hemi };
}
