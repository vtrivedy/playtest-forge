import * as THREE from 'three';

export type StylizedWater = {
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
  update: (t: number) => void;
  dispose: () => void;
};

/** Soft stylized water plane — reflections approximated via sky tint + fresnel. */
export function createStylizedWater(
  scene: THREE.Scene,
  opts: { size?: number; y?: number; colorDeep?: number; colorShallow?: number } = {},
): StylizedWater {
  const size = opts.size ?? 80;
  const uniforms = {
    uTime: { value: 0 },
    uHalf: { value: size * 0.5 },
    uDeep: { value: new THREE.Color(opts.colorDeep ?? 0x3a4038) },
    uShallow: { value: new THREE.Color(opts.colorShallow ?? 0x6a7860) },
    uSky: { value: new THREE.Color(0xe6bf98) },
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
        float w1 = sin(p.x * 0.35 + uTime * 1.1) * 0.08;
        float w2 = cos(p.y * 0.28 + uTime * 0.9) * 0.06;
        // plane is XZ; geometry PlaneGeometry → local y is up after rot
        p.z += w1 + w2;
        vec4 wpos = modelMatrix * vec4(p, 1.0);
        vWorld = wpos.xyz;
        vN = normalize(mat3(modelMatrix) * normalize(vec3(-cos(p.x*0.35+uTime*1.1)*0.35*0.08, 1.0, 0.0)));
        gl_Position = projectionMatrix * viewMatrix * wpos;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uDeep, uShallow, uSky;
      uniform float uTime;
      varying vec3 vWorld;
      varying vec3 vN;
      varying vec2 vLocal;
      void main() {
        vec3 V = normalize(cameraPosition - vWorld);
        float fres = pow(1.0 - max(0.0, dot(normalize(vN), V)), 3.0);
        float bands = sin(vWorld.x * 0.8 + vWorld.z * 0.55 + uTime * 1.5) * 0.5 + 0.5;
        vec3 col = mix(uDeep, uShallow, bands * 0.45 + 0.2);
        col = mix(col, uSky, fres * 0.65);
        // radial fade into sky mist — no hard square edge at the horizon
        float r = length(vLocal);
        col = mix(col, uSky, smoothstep(0.25, 0.85, r));
        float alpha = mix(0.72, 0.92, fres) * smoothstep(1.0, 0.7, r);
        gl_FragColor = vec4(col, alpha);
      }`,
  });

  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size, 64, 64), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = opts.y ?? -1.2;
  mesh.receiveShadow = true;
  scene.add(mesh);

  return {
    mesh,
    material,
    update(t) {
      uniforms.uTime.value = t;
    },
    dispose() {
      mesh.geometry.dispose();
      material.dispose();
      scene.remove(mesh);
    },
  };
}
