import * as THREE from 'three';
import { boxCollider, cylCollider, type CollisionWorld } from './collision';
import { Bucket, PAL, trs } from './russetKit';
import type { Root, RootSpot } from './chem/growth';
import type { HearthSpot } from './chem/updraft';

/** Only physical layout here: all root growth/retention and lift remain in chem/. */
export const HEARTWOOD = {
  x: -10, z: -36, top: 17.5, radius: 2.5, turns: 2.4,
  roots: ['heartwood-K1', 'heartwood-K2'] as const,
};
export type AmberwoodRegion = {
  rootSpots: RootSpot[];
  hearth: HearthSpot;
  socket: THREE.Vector3;
  /** Socket feed requires grown, living root; direct colour never latches SW3. */
  feeds: (roots: ReadonlyArray<Root>) => boolean;
  patrol: Array<[number, number, number]>;
};

/** Interior floor must match the heightfield as well as the authored collider. */
export function heartwoodGround(x: number, z: number, ground: number): number {
  const d = Math.hypot(x - HEARTWOOD.x, z - HEARTWOOD.z);
  if (d < 3.95) return 0;
  // A broad, shallow southern doorstep blends back into the forest floor.
  if (z > HEARTWOOD.z && z < HEARTWOOD.z + 6 && Math.abs(x - HEARTWOOD.x) < 1.6) {
    return THREE.MathUtils.lerp(0, ground, THREE.MathUtils.smoothstep(z - HEARTWOOD.z, 3.95, 6));
  }
  return ground;
}

/** Replace the old sw3-trunk cylinder and its full CylinderGeometry block with
 * this helper. Keep the outside canopy pads and split-crown kit maples. Supply
 * the realm's existing textured, ColorField-patched bark material. */
export function createAmberwoodRegion(parent: THREE.Group, col: CollisionWorld, barkMaterial: THREE.Material): AmberwoodRegion {
  const { x, z, top, radius, turns } = HEARTWOOD;
  const bark = new Bucket();
  const n = 64, outer = 3.9, inner = 3.3;
  const color = new THREE.Color();
  // Tangential wall pieces are solid annulus sectors with real inner faces,
  // rather than a single-sided cylinder masquerading as a hollow tree.
  const sector = (a0: number, a1: number, bottom: number, height: number, i: number) => {
    const positions: number[] = [], colors: number[] = [];
    const p = (r: number, a: number, y: number) => new THREE.Vector3(x + Math.sin(a) * r, y, z + Math.cos(a) * r);
    const corners = [p(inner, a0, bottom), p(inner, a1, bottom), p(outer, a0, bottom), p(outer, a1, bottom),
      p(inner, a0, bottom + height), p(inner, a1, bottom + height), p(outer, a0, bottom + height), p(outer, a1, bottom + height)];
    // All six faces; material remains FrontSide and normals face the cavity.
    const faces = [[0, 4, 5, 1], [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3], [4, 6, 7, 5], [0, 1, 3, 2]];
    for (const [a, b, c, d] of faces) for (const j of [a!, b!, c!, a!, c!, d!]) {
      const q = corners[j]!; positions.push(q.x, q.y, q.z);
      color.copy(PAL.bark).lerp(PAL.barkLight, 0.18 + 0.14 * Math.sin(i * 2.3 + q.y * 0.21));
      colors.push(color.r, color.g, color.b);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); g.computeVertexNormals(); bark.add(g); g.dispose();
    const a = (a0 + a1) / 2;
    col.add(boxCollider({ x: x + Math.sin(a) * 3.6, z: z + Math.cos(a) * 3.6,
      w: 2 * outer * Math.sin((a1 - a0) / 2) + 0.015, d: outer - inner, yaw: a,
      top: bottom + height, bottom, tag: 'heartwood-wall' }));
  };
  for (let i = 0; i < n; i++) {
    const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2;
    const mid = (a0 + a1) / 2;
    const doorway = Math.abs(Math.atan2(Math.sin(mid), Math.cos(mid))) < Math.asin(1.2 / inner);
    sector(a0, a1, doorway ? 3.4 : -0.25, doorway ? top - 3.4 : top + 0.25, i);
    // A softly broken crown makes the shell legible against the canopy.
    if (i % 5 === 0) {
      const h = 0.65 + (i % 7) * 0.18;
      const shard = new THREE.ConeGeometry(0.42, h, 5);
      bark.add(shard, trs(x + Math.sin(mid) * 3.6, top + h / 2, z + Math.cos(mid) * 3.6, mid), PAL.bark); shard.dispose();
    }
  }
  const floor = new THREE.CylinderGeometry(3.34, 3.34, 0.3, 48);
  bark.add(floor, trs(x, -0.15, z), PAL.barkLight.clone().lerp(PAL.soilUmber, 0.55)); floor.dispose();
  col.add(cylCollider({ x, z, r: 3.34, top: 0, bottom: -0.3, tag: 'heartwood-floor' }));

  // Thin annuli catch a missed ramp without blocking the central thermal.
  const ring = (y: number, r0: number, r1: number, tag: string) => {
    const count = 48;
    for (let i = 0; i < count; i++) {
      const a = (i + 0.5) / count * Math.PI * 2, r = (r0 + r1) / 2;
      const width = 2 * r1 * Math.sin(Math.PI / count) + 0.025;
      const plank = new THREE.BoxGeometry(width, 0.22, r1 - r0);
      bark.add(plank, trs(x + Math.sin(a) * r, y - 0.11, z + Math.cos(a) * r, a), PAL.barkLight.clone().lerp(PAL.rustMoss, 0.22)); plank.dispose();
      col.add(boxCollider({ x: x + Math.sin(a) * r, z: z + Math.cos(a) * r, w: width, d: r1 - r0, yaw: a, top: y, bottom: y - 0.22, tag }));
    }
  };
  for (const y of [4.5, 9, 13.5]) ring(y, 1.65, 3.28, 'heartwood-catch');
  ring(10, 1.65, 3.28, 'heartwood-ring');
  // The basin stands on an actual crown landing; the root meets its outer rim.
  const crown = new THREE.CylinderGeometry(2.05, 2.15, 0.45, 24);
  bark.add(crown, trs(x, top - 0.225, z), PAL.barkLight); crown.dispose();
  col.add(cylCollider({ x, z, r: 2.05, top, bottom: top - 0.45, tag: 'heartwood-crown' }));

  const point = (t: number): [number, number, number] => {
    const a = t * turns * Math.PI * 2;
    return [x + Math.sin(a) * radius, top * t, z + Math.cos(a) * radius];
  };
  const path = (t0: number) => {
    const steps = Math.ceil((1 - t0) * 96);
    return Array.from({ length: steps + 1 }, (_, i) => point(t0 + (1 - t0) * i / steps));
  };
  // K2 counter-spirals from the ring into the same socket; keeping it on a
  // distinct line avoids coincident root meshes after permanent restoration.
  const alternate = Array.from({ length: 49 }, (_, i) => {
    const t = i / 48, a = turns * Math.PI * 2 + (1 - t) * 1.1 * Math.PI * 2;
    return [x + Math.sin(a) * radius, 10 + (top - 10) * t, z + Math.cos(a) * radius] as [number, number, number];
  });
  const p0 = point(0), p2 = alternate[0]!, pEnd = point(1);
  const rootSpots: RootSpot[] = [
    { id: HEARTWOOD.roots[0], knot: new THREE.Vector3(p0[0] - 0.7, 0, p0[2] - 0.5), path: path(0), segments: 4, width: 1.6, restoredBy: 'SW3' },
    { id: HEARTWOOD.roots[1], knot: new THREE.Vector3(p2[0], 10, p2[2]), path: alternate, segments: 2, width: 1.6, restoredBy: 'SW3' },
  ];
  const mesh = bark.toMesh(barkMaterial, { boxUV: 2 });
  if (mesh) { mesh.name = 'Hollow maple heartwood'; parent.add(mesh); }
  return {
    rootSpots,
    hearth: { id: 'heartwood-hearth', x, y: 0, z, height: 12 },
    socket: new THREE.Vector3(...pEnd),
    feeds: (roots) => roots.some(r => (HEARTWOOD.roots as readonly string[]).includes(r.spot.id)
      && r.reactor.heat >= 0.5 && r.front >= r.length - 0.01 && r.wither <= 0),
    patrol: Array.from({ length: 10 }, (_, i) => {
      const a = i / 10 * Math.PI * 2;
      return [x + Math.sin(a) * 1.55, 0, z + Math.cos(a) * 1.55] as [number, number, number];
    }),
  };
}
