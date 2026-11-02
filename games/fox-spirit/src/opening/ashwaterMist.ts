import * as THREE from 'three';
import { ASH_ORIGIN, WATER } from './ashwaterLayout';

/** Mist may drift, but cannot veil the fox walking below it in a drained bed. */
export class AshwaterMistMaterial extends THREE.MeshBasicMaterial {
  // A private member keeps the mist-sheet material type distinct from an unmasked basic material.
  private readonly drainedBedMask = true;

  constructor(map: THREE.Texture, opacity: number) {
    super({ map, color: 0xb9c6c4, transparent: true, opacity, depthWrite: false, fog: true });
    const f = (n: number) => n.toFixed(3);
    const masks = [WATER.channel, WATER.channelE, WATER.pool].map((w) =>
      `smoothstep(0.0, 1.25, max(max(${f(w.x0)} - mistLocal.x, mistLocal.x - ${f(w.x1)}), max(${f(w.z0)} - mistLocal.y, mistLocal.y - ${f(w.z1)})))`,
    ).join(' * ');
    this.onBeforeCompile = (shader) => {
      // World coordinates keep the clear beds fixed while each sheet rotates slowly.
      shader.vertexShader = `varying vec2 vMistWorldXZ;\n${shader.vertexShader}`.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvMistWorldXZ = (modelMatrix * vec4(transformed, 1.0)).xz;',
      );
      shader.fragmentShader = `varying vec2 vMistWorldXZ;\n${shader.fragmentShader}`.replace(
        '#include <map_fragment>',
        `#include <map_fragment>\nvec2 mistLocal = vMistWorldXZ - vec2(${f(ASH_ORIGIN.x)}, ${f(ASH_ORIGIN.z)});\ndiffuseColor.a *= ${masks};`,
      );
    };
  }

  override customProgramCacheKey(): string {
    return `ashwater-mist-drained-beds-${this.drainedBedMask}`;
  }
}
