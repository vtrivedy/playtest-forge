import * as THREE from 'three';

/** Scene colour behind transparent water, shared by all skins in one scene. */
export function sceneWaterSampler(scene: THREE.Scene): SceneWaterSampler {
  const existing = samplers.get(scene);
  if (existing) return existing;
  let texture = new THREE.FramebufferTexture(1, 1);
  let captureArmed = false;
  const reflections = new Map<THREE.Object3D, (renderer: THREE.WebGLRenderer, camera: THREE.Camera) => boolean>();
  const diagnostics = { prepared: 0, copies: 0, reflectionAttempts: 0, reflections: 0, width: 0, height: 0, type: 0, glError: 0, priorGlError: 0, invalidTargets: 0, checkedCopies: 0, checkNextCopy: true };
  scene.userData.waterCapture = diagnostics;
  const skins = new Set<THREE.Object3D>();
  const uniforms = {
    uSceneWaterColor: { value: texture },
    uSceneWaterSize: { value: new THREE.Vector2(1, 1) },
  };
  const sampler = {
    uniforms,
    register(skin: THREE.Object3D, reflect?: (renderer: THREE.WebGLRenderer, camera: THREE.Camera) => boolean) {
      skins.add(skin); skin.renderOrder = -20; skin.userData.forgeSkipAO = true;
      if (reflect) reflections.set(skin, reflect);
    },
    prepare(renderer: THREE.WebGLRenderer, camera: THREE.Camera) {
      captureArmed = false;
      scene.updateMatrixWorld(true); camera.updateMatrixWorld(true);
      const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
      for (const [skin, reflect] of reflections) {
        let visible = skin.visible;
        for (let parent = skin.parent; parent; parent = parent.parent) visible = visible && parent.visible;
        if (visible && skin.layers.test(camera.layers) && skin instanceof THREE.Mesh && frustum.intersectsObject(skin)) { diagnostics.reflectionAttempts++; if (reflect(renderer, camera)) diagnostics.reflections++; }
      }
      diagnostics.prepared++;
      captureArmed = true;
    },
    release(skin: THREE.Object3D) {
      skins.delete(skin); reflections.delete(skin);
      if (!skins.size) { texture.dispose(); samplers.delete(scene); }
    },
    withoutSkins(render: () => void) {
      const visibility = Array.from(skins, skin => [skin, skin.visible] as const);
      // These point sprites are sized for the canvas, not a512 reflection target.
      scene.traverse(object => { if (object instanceof THREE.Points && !skins.has(object)) visibility.push([object, object.visible]); });
      for (const [skin] of visibility) skin.visible = false;
      try { render(); } finally { for (const [skin, visible] of visibility) skin.visible = visible; }
    },
    capture(renderer: THREE.WebGLRenderer) {
      if (!captureArmed) return;
      const target = renderer.getRenderTarget();
      if (!target || target.samples > 0) {
        diagnostics.invalidTargets++; captureArmed = false;
        if (diagnostics.invalidTargets === 1) console.error('Scene water requires the forge single-sample composer colour target');
        return;
      }
      const width = target.width, height = target.height;
      const type = target.texture.type, format = target.texture.format;
      if (texture.image.width !== width || texture.image.height !== height || texture.type !== type || texture.format !== format) {
        texture.dispose(); texture = new THREE.FramebufferTexture(width, height);
        texture.type = type; texture.format = format;
        texture.minFilter = texture.magFilter = THREE.LinearFilter;
        uniforms.uSceneWaterColor.value = texture;
      }
      uniforms.uSceneWaterSize.value.set(width, height);
      // The forge composer uses a single-sample colour target. Match its type
      // (usually half float) rather than clipping HDR into an 8-bit copy.
      const context = diagnostics.checkNextCopy ? renderer.getContext() : null;
      if (context) {
        for (let i = 0; i < 8; i++) {
          const error = context.getError();
          if (!error) break;
          diagnostics.priorGlError ||= error;
        }
      }
      renderer.copyFramebufferToTexture(texture);
      if (context) {
        diagnostics.glError ||= context.getError();
        diagnostics.checkedCopies++; diagnostics.checkNextCopy = false;
      }
      diagnostics.copies++; diagnostics.width = width; diagnostics.height = height; diagnostics.type = type;
      captureArmed = false;
    },
  };
  samplers.set(scene, sampler);
  return sampler;
}

type SceneWaterSampler = {
  uniforms: {
    uSceneWaterColor: { value: THREE.FramebufferTexture };
    uSceneWaterSize: { value: THREE.Vector2 };
  };
  register(skin: THREE.Object3D, reflect?: (renderer: THREE.WebGLRenderer, camera: THREE.Camera) => boolean): void;
  prepare(renderer: THREE.WebGLRenderer, camera: THREE.Camera): void;
  release(skin: THREE.Object3D): void;
  withoutSkins(render: () => void): void;
  capture(renderer: THREE.WebGLRenderer): void;
};
const samplers = new WeakMap<THREE.Scene, SceneWaterSampler>();

export const sceneWaterFragment = /* glsl */ `
  uniform sampler2D uSceneWaterColor;
  uniform vec2 uSceneWaterSize;
  vec3 sceneWaterColor(vec2 offset) {
    vec2 uv = gl_FragCoord.xy / uSceneWaterSize;
    float screenEdge = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
    uv = clamp(uv + offset * smoothstep(0.0, 0.04, screenEdge), vec2(0.001), vec2(0.999));
    vec3 color = texture2D(uSceneWaterColor, uv).rgb;
    return color;
  }
`;

/** Explicit composer pre-pass: reflection once, then one armed scene-colour copy. */
export function prepareSceneWater(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera): void {
  samplers.get(scene)?.prepare(renderer, camera);
}
