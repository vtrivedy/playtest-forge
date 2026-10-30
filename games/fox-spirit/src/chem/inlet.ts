import * as THREE from 'three';
import type { Hearth } from './updraft';

/**
 * Seedwell inlets (docs/design/world-1.md §1.4): a Seedwell latches only when an element's output
 * feeds its inlet continuously for `latchTime`. Direct fox colour never fills a seal. The seal fills at
 * 1/latchTime per second while fed and drains at the same rate while not.
 */
export type InletSpot = {
  /** Index into realm.seedwells */
  seedwell: number;
  /** Designed source. 'reed-falls' = water arrival; otherwise heat: any hearth whose column holds the bowl feeds it (geometry decides, not the name) */
  source: string;
  /** Bowl centre the element must reach */
  pos: THREE.Vector3;
  /** Where the carved seal sits (on the Seedwell lip) */
  sealAt: THREE.Vector3;
  /** Pillar foot (the bowl hangs from an arm over the column) */
  pillar: THREE.Vector3;
  latchTime: number;
};

export type Inlet = InletSpot & {
  seal: number;
  fed: boolean;
  latched: boolean;
  bed: THREE.MeshStandardMaterial;
  ring: THREE.ShaderMaterial;
};

/** Heat feed: a hearth with heat ≥ 0.5 whose column contains the bowl */
export function heatFeeds(h: Hearth, p: THREE.Vector3, radius: number): boolean {
  if (h.reactor.heat < 0.5) return false;
  const dy = p.y - h.base.y;
  return dy >= 0 && dy <= h.height && Math.hypot(p.x - h.base.x, p.z - h.base.z) <= radius;
}

export function createInlets(scene: THREE.Scene, spots: InletSpot[], ash: THREE.MeshStandardMaterial) {
  // the dish masonry is realm art (russetKit.kilnBowl); the ash bed in it warms as the seal fills
  const bedGeo = new THREE.CircleGeometry(0.56, 20);
  const sealGeo = new THREE.RingGeometry(0.55, 1.15, 64, 1);
  const inlets: Inlet[] = spots.map((s) => {
    const bed = s.source === 'reed-falls' ? new THREE.MeshStandardMaterial({ color: 0x737e6a, roughness: 0.24, metalness: 0.08, emissive: 0x665537 }) : ash.clone();
    bed.emissiveIntensity = 0.03;
    const mesh = new THREE.Mesh(bedGeo, bed);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(s.pos.x, s.pos.y + 0.12, s.pos.z);
    scene.add(mesh);
    // the seal: two carved rings on the Seedwell's lip that fill with ember light around their circumference
    const ring = sealMaterial();
    const seal = new THREE.Mesh(sealGeo, ring);
    seal.rotation.x = -Math.PI / 2;
    seal.position.copy(s.sealAt);
    seal.renderOrder = 2;
    scene.add(seal);
    return { ...s, seal: 0, fed: false, latched: false, bed, ring };
  });

  return {
    inlets,
    /** Advance seals; returns seedwell indices that latched this tick */
    update(dt: number, fed: (i: Inlet) => boolean): number[] {
      const out: number[] = [];
      for (const i of inlets) {
        if (i.latched) {
          i.bed.emissiveIntensity = 2.4;
          i.ring.uniforms.uFill!.value = 1;
          continue;
        }
        i.fed = fed(i);
        i.seal = THREE.MathUtils.clamp(i.seal + (i.fed ? dt : -dt) / i.latchTime, 0, 1);
        i.bed.emissiveIntensity = 0.03 + i.seal * 2.4;
        i.ring.uniforms.uFill!.value = i.seal;
        i.ring.uniforms.uFed!.value += ((i.fed ? 1 : 0) - i.ring.uniforms.uFed!.value) * Math.min(1, dt * 6);
        if (i.seal >= 1) {
          i.latched = true;
          out.push(i.seedwell);
        }
      }
      return out;
    },
  };
}

/** Two concentric carved grooves; ember light runs round them clockwise as the seal fills, and drains back. */
function sealMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uFill: { value: 0 }, uFed: { value: 0 } },
    vertexShader: /* glsl */ `varying vec2 vP; void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uFill, uFed;
      varying vec2 vP;
      void main() {
        float r = length(vP);
        float a = fract(atan(vP.y, vP.x) / 6.2832 + 0.25);
        float g1 = 1.0 - smoothstep(0.0, 0.05, abs(r - 0.72));
        float g2 = 1.0 - smoothstep(0.0, 0.05, abs(r - 1.0));
        // outer ring fills over the first half, inner ring over the second
        float f1 = step(a, clamp(uFill * 2.0, 0.0, 1.0));
        float f2 = step(a, clamp(uFill * 2.0 - 1.0, 0.0, 1.0));
        float lit = g2 * f1 + g1 * f2;
        float groove = (g1 + g2) * 0.35;
        vec3 col = mix(vec3(0.06, 0.05, 0.045), vec3(1.0, 0.55, 0.18) * (1.6 + uFed * 0.8), lit);
        float alpha = max(groove, lit);
        if (alpha < 0.02) discard;
        gl_FragColor = vec4(col, alpha);
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
}
