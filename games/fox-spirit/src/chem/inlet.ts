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
  /** Bowl centre the element must reach */
  pos: THREE.Vector3;
  /** Pillar foot (the bowl hangs from an arm over the column) */
  pillar: THREE.Vector3;
  latchTime: number;
};

export type Inlet = InletSpot & {
  seal: number;
  fed: boolean;
  latched: boolean;
  bed: THREE.MeshStandardMaterial;
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
  const inlets: Inlet[] = spots.map((s) => {
    const bed = ash.clone();
    bed.emissiveIntensity = 0.03;
    const mesh = new THREE.Mesh(bedGeo, bed);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(s.pos.x, s.pos.y + 0.12, s.pos.z);
    scene.add(mesh);
    return { ...s, seal: 0, fed: false, latched: false, bed };
  });

  return {
    inlets,
    /** Advance seals; returns seedwell indices that latched this tick */
    update(dt: number, fed: (p: THREE.Vector3) => boolean): number[] {
      const out: number[] = [];
      for (const i of inlets) {
        if (i.latched) {
          i.bed.emissiveIntensity = 2.4;
          continue;
        }
        i.fed = fed(i.pos);
        i.seal = THREE.MathUtils.clamp(i.seal + (i.fed ? dt : -dt) / i.latchTime, 0, 1);
        i.bed.emissiveIntensity = 0.03 + i.seal * 2.4;
        if (i.seal >= 1) {
          i.latched = true;
          out.push(i.seedwell);
        }
      }
      return out;
    },
  };
}
