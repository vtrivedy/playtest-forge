import * as THREE from 'three';

export type SkyParams = {
  /** Top zenith */
  zenith: THREE.Color;
  /** Horizon */
  horizon: THREE.Color;
  /** Below-horizon / ground bounce */
  nadir: THREE.Color;
  sunDir: THREE.Vector3;
  sunColor: THREE.Color;
  sunSize: number;
  sunBloom: number;
  cloudAmount: number;
  cloudScale: number;
  time: number;
};

export type PaintedSky = {
  mesh: THREE.Mesh;
  params: SkyParams;
  update: (dt: number) => void;
  dispose: () => void;
};

/** Fullscreen-ish skydome with painted gradient + soft sun + cheap clouds. */
export function createPaintedSky(scene: THREE.Scene, overrides: Partial<SkyParams> = {}): PaintedSky {
  const params: SkyParams = {
    zenith: new THREE.Color(overrides.zenith ?? 0x8a929c),
    horizon: new THREE.Color(overrides.horizon ?? 0xc8ced4),
    nadir: new THREE.Color(overrides.nadir ?? 0x5a6068),
    sunDir: (overrides.sunDir ?? new THREE.Vector3(0.45, 0.55, 0.35)).normalize(),
    sunColor: new THREE.Color(overrides.sunColor ?? 0xe8eef2),
    sunSize: overrides.sunSize ?? 0.04,
    sunBloom: overrides.sunBloom ?? 0.35,
    cloudAmount: overrides.cloudAmount ?? 0.72,
    cloudScale: overrides.cloudScale ?? 1.2,
    time: 0,
  };

  const uniforms = {
    uZenith: { value: params.zenith },
    uHorizon: { value: params.horizon },
    uNadir: { value: params.nadir },
    uSunDir: { value: params.sunDir },
    uSunColor: { value: params.sunColor },
    uSunSize: { value: params.sunSize },
    uSunBloom: { value: params.sunBloom },
    uCloudAmount: { value: params.cloudAmount },
    uCloudScale: { value: params.cloudScale },
    uTime: { value: 0 },
  };

  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vDir = normalize(position);
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uZenith, uHorizon, uNadir, uSunDir, uSunColor;
      uniform float uSunSize, uSunBloom, uCloudAmount, uCloudScale, uTime;
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
        float h = d.y;
        vec3 col = mix(uHorizon, uZenith, smoothstep(0.0, 0.75, max(h, 0.0)));
        col = mix(uNadir, col, smoothstep(-0.35, 0.05, h));

        // soft sun disc + bloom
        float sd = 1.0 - dot(d, normalize(uSunDir));
        float sun = smoothstep(uSunSize * 2.5, uSunSize * 0.15, sd);
        float bloom = exp(-sd * (8.0 / max(0.05, uSunBloom))) * uSunBloom;
        col += uSunColor * (sun * 1.4 + bloom);

        // cheap drifting clouds on upper hemisphere
        if (h > 0.02) {
          vec2 uv = d.xz / max(0.15, d.y) * uCloudScale;
          uv += vec2(uTime * 0.01, uTime * 0.006);
          float c = fbm(uv);
          float clouds = smoothstep(0.55, 0.78, c) * uCloudAmount * smoothstep(0.02, 0.35, h);
          col = mix(col, mix(col, vec3(1.0, 0.96, 0.92), 0.85), clouds);
        }

        gl_FragColor = vec4(col, 1.0);
      }`,
  });

  const mesh = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
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
      uniforms.uHorizon.value = params.horizon;
      uniforms.uNadir.value = params.nadir;
      uniforms.uSunDir.value.copy(params.sunDir).normalize();
      uniforms.uSunColor.value = params.sunColor;
      uniforms.uSunSize.value = params.sunSize;
      uniforms.uSunBloom.value = params.sunBloom;
      uniforms.uCloudAmount.value = params.cloudAmount;
      uniforms.uCloudScale.value = params.cloudScale;
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
  const hemi = new THREE.HemisphereLight(0xc8d0d8, 0x3a4048, 0.7);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xe8eef5, 2.1);
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

  const fill = new THREE.DirectionalLight(0x88aaff, 0.5);
  fill.position.set(-12, 7, -6);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xc0c8d8, 0.35);
  rim.position.set(-2, 5, -14);
  scene.add(rim);

  return { key, fill, rim, hemi };
}
