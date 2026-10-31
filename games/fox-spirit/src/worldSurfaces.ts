import * as THREE from 'three';

/** CC0 library scans, projected in metres so merged and scaled props share a surface. */
export function weatheredSurface(mat: THREE.MeshStandardMaterial, timber = false, timberCoordinates: 'world' | 'local' = 'world'): void {
  const hullTimber = timber && timberCoordinates === 'local';
  const texture = new THREE.TextureLoader().load(timber
    ? '/assets/library/textures/bark_brown_02/bark_brown_02_Diffuse_1k.jpg'
    : '/assets/library/textures/ambientcg/Bricks085/Bricks085_1K-JPG_Color.jpg');
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  const topTexture = timber ? texture : new THREE.TextureLoader().load('/assets/library/textures/ambientcg/Rock035/Rock035_1K-JPG_Color.jpg');
  topTexture.wrapS = topTexture.wrapT = THREE.RepeatWrapping;
  topTexture.colorSpace = THREE.SRGBColorSpace;
  topTexture.anisotropy = 8;
  const prev = mat.onBeforeCompile;
  const key = mat.customProgramCacheKey();
  mat.onBeforeCompile = (shader, renderer) => {
    prev.call(mat, shader, renderer);
    shader.uniforms.uWSScan = { value: texture };
    shader.uniforms.uWSTop = { value: topTexture };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWSPoint; varying vec3 vWSNormal;')
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        vWSPoint = ${hullTimber ? 'transformed' : '(modelMatrix * vec4(transformed, 1.0)).xyz'};
        vWSNormal = ${hullTimber ? 'normalize(objectNormal)' : 'normalize(mat3(modelMatrix) * objectNormal)'};`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uWSScan; uniform sampler2D uWSTop; varying vec3 vWSPoint; varying vec3 vWSNormal;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 wsWeights = pow(abs(normalize(vWSNormal)), vec3(4.0));
        wsWeights /= max(dot(wsWeights, vec3(1.0)), 0.001);
        vec3 wsP = vWSPoint * ${hullTimber ? 'vec3(0.72, 0.16, 0.08)' : timber ? 'vec3(0.72, 0.16, 0.72)' : 'vec3(0.25)'};
        vec3 wsScan = texture2D(uWSScan, wsP.zy).rgb * wsWeights.x
          + texture2D(uWSTop, wsP.xz).rgb * wsWeights.y
          + texture2D(uWSScan, wsP.xy).rgb * wsWeights.z;
        float wsValue = dot(wsScan, vec3(0.3, 0.59, 0.11));
        diffuseColor.rgb *= clamp(0.38 + wsValue * 2.2, 0.36, 1.3);
        ${hullTimber ? `
        // Hull-space grain follows the physical lengthwise planks as they rise.
        // Geometry supplies board seams; avoid painting diagonal joints over it.
        float wsGrain = sin(vWSPoint.x * 22.0 + sin(vWSPoint.z * 0.65) * 1.8);
        diffuseColor.rgb *= 0.93 + 0.07 * wsGrain;
        ` : timber ? `
        // Broad grain stays legible through the painterly post; no noisy photo hue.
        float wsGrain = sin((vWSPoint.x + vWSPoint.z) * 22.0 + sin(vWSPoint.y * 0.7) * 1.8);
        diffuseColor.rgb *= 0.91 + 0.09 * wsGrain;
        float wsBoard = floor((vWSPoint.x + vWSPoint.z) / 0.28);
        float wsJoint = smoothstep(0.014, 0.042, abs(fract((vWSPoint.x + vWSPoint.z) / 0.28) - 0.5));
        diffuseColor.rgb *= mix(0.58, 1.0, wsJoint) * (0.91 + sin(wsBoard * 7.13) * 0.09);
        ` : `
        float wsPatch = sin(vWSPoint.x * 1.3 + sin(vWSPoint.z * 1.8)) * sin(vWSPoint.z * 0.8 + vWSPoint.y * 0.7);
        float wsMoss = smoothstep(0.0, 0.6, wsPatch) * (0.2 + 0.8 * smoothstep(0.3, 0.85, vWSNormal.y));
        float wsRunoff = sin((vWSPoint.x + vWSPoint.z) * 2.7 + sin(vWSPoint.y * 0.23));
        diffuseColor.rgb *= 1.0 - smoothstep(0.3, 0.9, wsRunoff) * 0.24 * (1.0 - abs(vWSNormal.y));
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.63, 0.72, 0.43), wsMoss * 0.7);
        `}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor * (0.8 + wsValue * 0.55), 0.65, 1.0);`)
      .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
        // Screen derivatives add soft relief without UV seams on merged props.
        normal = normalize(normal + vec3(-dFdx(wsValue), -dFdy(wsValue), 0.0) * 1.8);`);
  };
  mat.customProgramCacheKey = () => `${key}|world-surface-${hullTimber ? 'hull-timber' : timber ? 'timber' : 'stone'}`;
  mat.needsUpdate = true;
}
