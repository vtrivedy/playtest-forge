/**
 * Walkable-surface collision for Russetvale.
 * Heightfield terrain + oriented boxes (optionally ramped along local Z) + vertical cylinders.
 * Surfaces are one-way from below; walls block when a top is more than STEP_UP above the feet.
 */

export const STEP_UP = 0.6;
const BODY_H = 0.9;

export type Collider = {
  kind: 'box' | 'cyl';
  x: number;
  z: number;
  /** box: half extents in local X / Z. cyl: radius in hx */
  hx: number;
  hz: number;
  yaw: number;
  /** Top height at local -hz and +hz (equal for flat). Cylinders use top0. */
  top0: number;
  top1: number;
  bottom: number;
  /** Bounce multiplier on jump velocity (crown pads) */
  bounce?: number;
  /** Disabled colliders are skipped (ghost-ink, ungrown bridge) */
  enabled: boolean;
  tag?: string;
  cos: number;
  sin: number;
};

export function boxCollider(o: {
  x: number;
  z: number;
  w: number;
  d: number;
  yaw?: number;
  top: number;
  top1?: number;
  bottom?: number;
  bounce?: number;
  tag?: string;
}): Collider {
  const yaw = o.yaw ?? 0;
  return {
    kind: 'box',
    x: o.x,
    z: o.z,
    hx: o.w / 2,
    hz: o.d / 2,
    yaw,
    top0: o.top,
    top1: o.top1 ?? o.top,
    bottom: o.bottom ?? Math.min(o.top, o.top1 ?? o.top) - 3,
    bounce: o.bounce,
    enabled: true,
    tag: o.tag,
    cos: Math.cos(yaw),
    sin: Math.sin(yaw),
  };
}

export function cylCollider(o: {
  x: number;
  z: number;
  r: number;
  top: number;
  bottom?: number;
  bounce?: number;
  tag?: string;
}): Collider {
  return {
    kind: 'cyl',
    x: o.x,
    z: o.z,
    hx: o.r,
    hz: o.r,
    yaw: 0,
    top0: o.top,
    top1: o.top,
    bottom: o.bottom ?? o.top - 3,
    bounce: o.bounce,
    enabled: true,
    tag: o.tag,
    cos: 1,
    sin: 0,
  };
}

/** Top height of collider at (x,z), or null if outside its footprint. */
export function colliderTopAt(c: Collider, x: number, z: number, pad = 0): number | null {
  const dx = x - c.x;
  const dz = z - c.z;
  if (c.kind === 'cyl') {
    if (dx * dx + dz * dz > (c.hx + pad) * (c.hx + pad)) return null;
    return c.top0;
  }
  // world → local (yaw rotates local +Z toward world (sin, cos))
  const lx = dx * c.cos - dz * c.sin;
  const lz = dx * c.sin + dz * c.cos;
  if (Math.abs(lx) > c.hx + pad || Math.abs(lz) > c.hz + pad) return null;
  if (c.top0 === c.top1) return c.top0;
  const t = Math.min(1, Math.max(0, (lz + c.hz) / (2 * c.hz)));
  return c.top0 + (c.top1 - c.top0) * t;
}

/** Local → world for a box collider frame (handy for dressing). */
export function boxLocalToWorld(c: Collider, lx: number, lz: number): { x: number; z: number } {
  return { x: c.x + lx * c.cos + lz * c.sin, z: c.z - lx * c.sin + lz * c.cos };
}

export class CollisionWorld {
  colliders: Collider[] = [];
  constructor(public terrain: (x: number, z: number) => number) {}

  add<T extends Collider>(c: T): T {
    this.colliders.push(c);
    return c;
  }

  /** Highest walkable surface under (x,z) reachable from feetY (≤ feetY + STEP_UP). */
  groundAt(x: number, z: number, feetY: number): { y: number; collider: Collider | null } {
    let best = this.terrain(x, z);
    if (best > feetY + STEP_UP) best = -Infinity;
    let bestC: Collider | null = null;
    for (const c of this.colliders) {
      if (!c.enabled) continue;
      const top = colliderTopAt(c, x, z);
      if (top === null || top > feetY + STEP_UP) continue;
      if (top > best) {
        best = top;
        bestC = c;
      }
    }
    return { y: best, collider: bestC };
  }

  /** True when moving into (x,z) at feetY would walk into a wall. */
  blocked(x: number, z: number, feetY: number): boolean {
    if (this.terrain(x, z) > feetY + STEP_UP + 0.02) return true;
    for (const c of this.colliders) {
      if (!c.enabled) continue;
      const top = colliderTopAt(c, x, z);
      if (top === null) continue;
      if (top > feetY + STEP_UP + 0.02 && c.bottom < feetY + BODY_H) return true;
    }
    return false;
  }

  /** Highest surface of any kind at (x,z) — camera floor / dressing. */
  highestAt(x: number, z: number): number {
    let best = this.terrain(x, z);
    for (const c of this.colliders) {
      if (!c.enabled) continue;
      const top = colliderTopAt(c, x, z);
      if (top !== null && top > best) best = top;
    }
    return best;
  }
}
