/**
 * Unfaded blockers (the ruin's unregistered stair fold hid the fox while every numeric camera gate passed):
 * anything solid that stands taller than the fox's head must belong to a chase-cam occlusion root, or the
 * lens can sit behind it with the fox unseen. Checked once at boot over the built colliders; console.warn lists
 * offenders. Scenery with no collider is out of scope (it never stands where the fox can be hidden at 1 m).
 */
import * as THREE from 'three';
import { colliderTop, type Collider } from '../lookdevPlay';

export function unfadedBlockers(colliders: Collider[], roots: THREE.Object3D[], groundH: (x: number, z: number) => number, minHeight = 1.4): string[] {
  const boxes = roots.map((r) => {
    r.updateWorldMatrix(true, true);
    return new THREE.Box3().setFromObject(r);
  });
  const out: string[] = [];
  for (const c of colliders) {
    if (c.kind === 'box' && c.oneWay) continue;
    const top = c.kind === 'post' ? Infinity : colliderTop(c, c.x, c.z);
    const h = top - groundH(c.x, c.z);
    if (c.kind !== 'post' && h < minHeight) continue;
    if (c.kind === 'post' && c.r < 0.25) continue;
    const covered = boxes.some((b) => c.x >= b.min.x - 0.2 && c.x <= b.max.x + 0.2 && c.z >= b.min.z - 0.2 && c.z <= b.max.z + 0.2);
    if (!covered) out.push(`${c.kind} at (${c.x.toFixed(1)}, ${c.z.toFixed(1)}) h ${Number.isFinite(h) ? h.toFixed(1) : '∞'} has no occlusion root`);
  }
  return out;
}
