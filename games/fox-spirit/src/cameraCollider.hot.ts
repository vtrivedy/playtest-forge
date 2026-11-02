import type { Collider } from './lookdevPlay';

const LENS_RING = new Float64Array(18);
for (let i = 0; i < 8; i++) {
  LENS_RING[2 + i * 2] = Math.cos(i * Math.PI / 4);
  LENS_RING[3 + i * 2] = Math.sin(i * Math.PI / 4);
}

export function colliderTop(c: Collider, x: number, z: number): number {
  const dx = x - c.x;
  const dz = z - c.z;
  if (c.kind === 'post') return dx * dx + dz * dz < c.r * c.r ? Infinity : -Infinity;
  if (c.kind === 'cap') {
    const k = 1 - (dx * dx + dz * dz) / (c.r * c.r);
    return k > 0 ? c.base + c.h * Math.sqrt(k) : -Infinity;
  }
  const cos = Math.cos(c.yaw);
  const sin = Math.sin(c.yaw);
  const lx = dx * cos - dz * sin;
  const lz = dx * sin + dz * cos;
  return Math.abs(lx) < c.hx && Math.abs(lz) < c.hz ? c.top : -Infinity;
}

/** Same nine-point sphere footprint as the controller, without per-query arrays. */
export function lensVolumeBlocked(colliders: readonly Collider[], x: number, y: number, z: number, radius: number): boolean {
  for (let i = 0; i < colliders.length; i++) {
    const c = colliders[i]!;
    if (c.kind === 'box' && c.oneWay) continue;
    for (let j = 0; j < LENS_RING.length; j += 2) {
      if (colliderTop(c, x + LENS_RING[j]! * radius, z + LENS_RING[j + 1]! * radius) > y - radius) return true;
    }
  }
  return false;
}
