import * as THREE from 'three';
import { rotateBoneWorld } from './rig';

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _d = new THREE.Vector3();
const _q = new THREE.Quaternion();

/**
 * Planar FABRIK. `joints` arrive holding the current (rest-relative) pose, which seeds the solve so knees and
 * hocks keep their natural bend side; every iteration projects the inner joints onto the leg plane
 * (through the base, normal `planeN`). Solves in place; returns true when the target was reachable.
 */
export function fabrik(joints: THREE.Vector3[], lengths: number[], target: THREE.Vector3, planeN: THREE.Vector3, iterations = 8): boolean {
  const n = joints.length - 1;
  const base = _a.copy(joints[0]);
  const reach = lengths.reduce((s, l) => s + l, 0);
  const dist = base.distanceTo(target);
  if (dist >= reach) {
    _d.copy(target).sub(base).normalize();
    for (let i = 1; i <= n; i++) joints[i].copy(joints[i - 1]).addScaledVector(_d, lengths[i - 1]);
    return false;
  }
  for (let it = 0; it < iterations; it++) {
    joints[n].copy(target);
    for (let i = n - 1; i >= 0; i--) {
      _d.copy(joints[i]).sub(joints[i + 1]).normalize();
      joints[i].copy(joints[i + 1]).addScaledVector(_d, lengths[i]);
    }
    joints[0].copy(base);
    for (let i = 0; i < n; i++) {
      _d.copy(joints[i + 1]).sub(joints[i]).normalize();
      joints[i + 1].copy(joints[i]).addScaledVector(_d, lengths[i]);
    }
    for (let i = 1; i < n; i++) {
      _b.copy(joints[i]).sub(base);
      joints[i].addScaledVector(planeN, -_b.dot(planeN));
    }
    if (joints[n].distanceToSquared(target) < 1e-8) break;
  }
  return true;
}

/** Rotate each chain bone (minimal arc) so its head→child direction matches the solved joint positions. */
export function applyChain(chain: THREE.Bone[], end: THREE.Object3D, solved: THREE.Vector3[]) {
  for (let i = 0; i < chain.length; i++) {
    const child = i + 1 < chain.length ? chain[i + 1] : end;
    chain[i].getWorldPosition(_a);
    child.getWorldPosition(_b);
    const cur = _b.sub(_a).normalize();
    const want = _d.copy(solved[i + 1]).sub(solved[i]).normalize();
    if (cur.dot(want) > 0.999999) continue;
    _q.setFromUnitVectors(cur, want);
    rotateBoneWorld(chain[i], _q);
  }
}
