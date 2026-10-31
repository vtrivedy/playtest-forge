import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { sceneWaterSampler, sceneWaterFragment } from './waterScene';

export type StylizedWater = {
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
  update: (t: number) => void;
  dispose: () => void;
};

/** Gentle scene-refracted water with an optional planar scenery reflection. */
export function createStylizedWater(
  scene: THREE.Scene,
  opts: { size?: number; y?: number; colorDeep?: number; colorShallow?: number; shoreRadius?: number; reflection?: boolean; reflectionDistance?: number; depthTint?: number } = {},
): StylizedWater {
  const size = opts.size ?? 80;
  const shoreRadius = opts.shoreRadius ?? 1;
  const sceneSampler = sceneWaterSampler(scene);
  const uniforms = {
    ...sceneSampler.uniforms,
    uReflectionMap: { value: null as THREE.Texture | null },
    uReflectionMatrix: { value: new THREE.Matrix4() },
    uReflectionOn: { value: 0 },
    uDepthTint: { value: THREE.MathUtils.clamp(opts.depthTint ?? 0.12, 0.025, 0.4) },
    uTime: { value: 0 },
    uReveal: { value: 1 },
    uHalf: { value: size * 0.5 },
    uShoreRadius: { value: shoreRadius },
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
      varying vec4 vReflection;
      uniform mat4 uReflectionMatrix;
      void main() {
        vec3 p = position;
        vLocal = position.xy / uHalf;
        float w1 = sin(p.x * 0.55 + uTime * 0.65) * 0.025;
        float w2 = cos(p.y * 0.43 + uTime * 0.48) * 0.018;
        // PlaneGeometry is local XY; local Z displaces along the water normal.
        p.z += w1 + w2;
        vec4 wpos = modelMatrix * vec4(p, 1.0);
        vWorld = wpos.xyz;
        vReflection = uReflectionMatrix * vec4(p, 1.0);
        vN = normalize(mat3(modelMatrix) * normalize(vec3(-cos(p.x*0.55+uTime*0.65)*0.55*0.025, sin(p.y*0.43+uTime*0.48)*0.43*0.018, 1.0)));
        gl_Position = projectionMatrix * viewMatrix * wpos;
      }`,
    fragmentShader: sceneWaterFragment + /* glsl */ `
      uniform vec3 uDeep, uShallow, uSky;
      uniform float uShoreRadius, uTime, uReflectionOn, uDepthTint, uReveal;
      uniform sampler2D uReflectionMap;
      varying vec3 vWorld;
      varying vec3 vN;
      varying vec2 vLocal;
      varying vec4 vReflection;
      void main() {
        vec3 V = normalize(cameraPosition - vWorld);
        vec2 q = vWorld.xz;
        float a = dot(q, vec2(0.72, 0.38)) - uTime * 0.55;
        float b = dot(q, vec2(-0.31, 0.64)) + uTime * 0.38;
        vec3 N = normalize(vN + vec3(cos(a) * 0.055, 0.0, cos(b) * 0.045));
        float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 5.0);
        float r = length(vLocal);
        float depth = 1.0 - smoothstep(0.15, 1.0, r);
        vec3 rippleView = mat3(viewMatrix) * vec3(N.x - vN.x, 0.0, N.z - vN.z);
        // Recede inside the existing mesh support; outward noise would expose
        // the square plane boundary at the ellipse's four axis intercepts.
        float shoreBrush = (2.0 + sin(q.x * 0.41 + sin(q.y * 0.23)) + sin(q.y * 0.57 + q.x * 0.19)) * 0.004;
        float shore = (1.0 - smoothstep(uShoreRadius * 0.90, uShoreRadius, r + shoreBrush)) * uReveal;
        vec3 bed = sceneWaterColor(rippleView.xy * 0.06 * shore);
        vec3 tint = mix(vec3(0.94, 0.97, 0.91), vec3(0.66, 0.82, 0.73), depth);
        vec3 absorption = mix(uShallow, uDeep * 0.85, depth);
        vec3 refracted = mix(bed * tint, absorption, 0.025 + depth * (uDepthTint - 0.025));
        float bedLight = sin(a + sin(b) * 0.55) * sin(b * 1.3) * 0.5 + 0.5;
        refracted += bed * bedLight * (1.0 - depth) * 0.025;
        vec3 reflection = uSky * (0.75 + 0.10 * sin(a * 0.3 + b * 0.2));
        if (uReflectionOn > 0.5) {
          vec2 mirrorUV = vReflection.xy / vReflection.w + N.xz * 0.025;
          vec2 mirrorStep = vec2(1.5 / 512.0);
          vec2 mirrorCentre = clamp(mirrorUV, mirrorStep, vec2(1.0) - mirrorStep);
          reflection = texture2D(uReflectionMap, mirrorCentre).rgb * 0.40
            + texture2D(uReflectionMap, mirrorCentre + vec2(mirrorStep.x, 0.0)).rgb * 0.15
            + texture2D(uReflectionMap, mirrorCentre - vec2(mirrorStep.x, 0.0)).rgb * 0.15
            + texture2D(uReflectionMap, mirrorCentre + vec2(0.0, mirrorStep.y)).rgb * 0.15
            + texture2D(uReflectionMap, mirrorCentre - vec2(0.0, mirrorStep.y)).rgb * 0.15;
        }
        vec3 col = mix(refracted, reflection, 0.02 + fres * 0.94);
        // Scene colour already contains the bed: avoid blending it a second time.
        gl_FragColor = vec4(col, shore);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });

  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size * shoreRadius, size * shoreRadius, 64, 64), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = opts.y ?? -1.2;
  mesh.receiveShadow = true;
  scene.add(mesh);
  const reflector = opts.reflection ? new Reflector(mesh.geometry, { textureWidth: 512, textureHeight: 512, multisample: 0, clipBias: 0.003 }) : null;
  if (reflector) {
    reflector.matrixAutoUpdate = false;
    const mirrorMaterial = reflector.material as THREE.ShaderMaterial;
    uniforms.uReflectionMap.value = reflector.getRenderTarget().texture;
    uniforms.uReflectionMatrix.value = mirrorMaterial.uniforms.textureMatrix!.value as THREE.Matrix4;
  }
  sceneSampler.register(mesh, reflector ? (renderer, camera) => {
    reflector.matrixWorld.copy(mesh.matrixWorld);
    const planeNormal = new THREE.Vector3(0, 0, 1).transformDirection(mesh.matrixWorld);
    const view = new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld).sub(new THREE.Vector3().setFromMatrixPosition(mesh.matrixWorld));
    uniforms.uReflectionOn.value = planeNormal.dot(view) > 0 && view.lengthSq() <= (opts.reflectionDistance ?? 100) ** 2 ? 1 : 0;
    if (!uniforms.uReflectionOn.value) return false;
    const target = renderer.getRenderTarget(), xr = renderer.xr.enabled, shadows = renderer.shadowMap.autoUpdate, shadowRequested = renderer.shadowMap.needsUpdate;
    reflector.getReflectionCamera(camera).layers.mask = camera.layers.mask;
    renderer.shadowMap.needsUpdate = false;
    // Reflector's implementation consumes the first three standard hook arguments.
    const renderMirror = reflector.onBeforeRender as (renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) => void;
    sceneSampler.withoutSkins(() => {
      try { renderMirror.call(reflector, renderer, scene, camera); }
      finally { renderer.xr.enabled = xr; renderer.shadowMap.autoUpdate = shadows; renderer.shadowMap.needsUpdate = shadowRequested; renderer.setRenderTarget(target); }
    });
    return true;
  } : undefined);
  mesh.onBeforeRender = renderer => sceneSampler.capture(renderer);

  return {
    mesh,
    material,
    update(t) {
      uniforms.uTime.value = t;
    },
    dispose() {
      sceneSampler.release(mesh);
      reflector?.dispose();
      mesh.geometry.dispose();
      material.dispose();
      scene.remove(mesh);
    },
  };
}
