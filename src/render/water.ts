import * as THREE from 'three';

export type StylizedWater = {
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
  /** Optional feet focus preserves tinted leg visibility while wading. */
  update: (t: number, feetFocus?: THREE.Vector3) => void;
  dispose: () => void;
};

/** Soft stylized water plane — reflections approximated via sky tint + fresnel. */
export function createStylizedWater(
  scene: THREE.Scene,
  opts: { size?: number; y?: number; colorDeep?: number; colorShallow?: number; shoreRadius?: number } = {},
): StylizedWater {
  const size = opts.size ?? 80;
  const shoreRadius = opts.shoreRadius ?? 1;
  const uniforms = {
    uTime: { value: 0 },
    uHalf: { value: size * 0.5 },
    uShoreRadius: { value: shoreRadius },
    uDeep: { value: new THREE.Color(opts.colorDeep ?? 0x3a4038) },
    uShallow: { value: new THREE.Color(opts.colorShallow ?? 0x6a7860) },
    uSky: { value: new THREE.Color(0xe6bf98) },
    uFocus: { value: new THREE.Vector4(0, 0, 0, 0) },
  };

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms,
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uHalf;
      varying vec3 vWorld;
      varying vec3 vN;
      varying vec2 vLocal;
      void main() {
        vec3 p = position;
        vLocal = position.xy / uHalf;
        float w1 = sin(p.x * 0.55 + uTime * 0.65) * 0.025;
        float w2 = cos(p.y * 0.43 + uTime * 0.48) * 0.018;
        // plane is XZ; geometry PlaneGeometry → local y is up after rot
        p.z += w1 + w2;
        vec4 wpos = modelMatrix * vec4(p, 1.0);
        vWorld = wpos.xyz;
        vN = normalize(mat3(modelMatrix) * normalize(vec3(-cos(p.x*0.55+uTime*0.65)*0.55*0.025, sin(p.y*0.43+uTime*0.48)*0.43*0.018, 1.0)));
        gl_Position = projectionMatrix * viewMatrix * wpos;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec4 uFocus;
      uniform vec3 uDeep, uShallow, uSky;
      uniform float uShoreRadius;
      uniform float uTime;
      varying vec3 vWorld;
      varying vec3 vN;
      varying vec2 vLocal;
      void main() {
        vec3 V = normalize(cameraPosition - vWorld);
        // Broad crossed swells bend reflections without a noisy photographic normal map.
        vec2 q = vWorld.xz;
        float a = dot(q, vec2(0.72, 0.38)) - uTime * 0.55;
        float b = dot(q, vec2(-0.31, 0.64)) + uTime * 0.38;
        vec3 N = normalize(vN + vec3(cos(a) * 0.055, 0.0, cos(b) * 0.045));
        float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 4.0);
        float r = length(vLocal);
        // Authored elliptical basin: transparent shallows darken toward the centre.
        // This is a depth suggestion, not a scene-depth/refraction buffer.
        float depth = 1.0 - smoothstep(0.15, 1.0, r);
        float bedLight = sin(a + sin(b) * 0.55) * sin(b * 1.3) * 0.5 + 0.5;
        vec3 body = mix(uShallow * 0.66, uDeep * 0.7, depth);
        body += uShallow * bedLight * (1.0 - depth) * 0.075;
        vec3 R = reflect(-V, N);
        float skyWash = smoothstep(-0.15, 0.65, R.y);
        float reflectedGrove = sin(R.x * 8.0 + R.z * 5.0 + sin(a) * 0.16) * 0.5 + 0.5;
        vec3 reflection = mix(uDeep * 0.55, uSky * 1.1, skyWash);
        reflection *= 0.82 + reflectedGrove * 0.18;
        vec3 col = mix(body, reflection, 0.08 + fres * 0.85);
        // Narrow, broken amber glints, deliberately far below white/bloom.
        float glint = pow(max(0.0, sin(a * 2.1 + sin(b) * 0.6)), 24.0);
        glint *= smoothstep(0.25, 0.8, sin(b * 1.8) * 0.5 + 0.5);
        vec3 glintLight = uSky * glint * (0.025 + fres * 0.065);
        col += glintLight;
        float shore = 1.0 - smoothstep(uShoreRadius * 0.90, uShoreRadius, r);
        float alpha = mix(0.72, 0.95, depth) + fres * 0.04;
        // Align the clarity with rays covering submerged legs, rather than a
        // floor-revealing disc centred on the fox's feet.
        float sub = vWorld.y - uFocus.y;
        float wade = uFocus.w * smoothstep(0.04, 0.18, sub);
        float legRay = (max(0.0, sub) * 0.5) / max(V.y, 0.12);
        vec2 legHit = vWorld.xz - V.xz * legRay;
        float legMask = wade * (1.0 - smoothstep(0.35, 0.95, length(legHit - uFocus.xz)));
        float alphaScale = mix(1.0, 0.35, legMask);
        col = mix(col, body, legMask * 0.3);
        col += glintLight * (1.0 / alphaScale - 1.0);
        gl_FragColor = vec4(col, alpha * shore * alphaScale);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });

  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size * shoreRadius, size * shoreRadius, 64, 64), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = opts.y ?? -1.2;
  mesh.receiveShadow = true;
  scene.add(mesh);

  let lastUpdate: number | null = null;
  return {
    mesh,
    material,
    update(t, feetFocus) {
      uniforms.uTime.value = t;
      const dt = lastUpdate === null ? 0 : THREE.MathUtils.clamp(t - lastUpdate, 0, 0.1);
      lastUpdate = t;
      const focus = uniforms.uFocus.value;
      if (feetFocus) focus.set(feetFocus.x, feetFocus.y, feetFocus.z, focus.w);
      focus.w = THREE.MathUtils.damp(focus.w, feetFocus ? 1 : 0, 12, dt);
    },
    dispose() {
      mesh.geometry.dispose();
      material.dispose();
      scene.remove(mesh);
    },
  };
}
