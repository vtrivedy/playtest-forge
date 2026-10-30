import * as THREE from 'three';
import { boxCollider, type CollisionWorld } from './collision';
import { Bucket, PAL, rockSlab, ruinColumn, leafShape } from './russetKit';

export const REED_SHADE_PATROL = { speed: 1.1, patrol: [
  [103, 5.1, 23], [108, 5, 26], [108, 5, 29],
  [94, 5, 29], [92, 5, 27], [98, 4.7, 24],
] as Array<[number, number, number]> };

/** The ruin is a real depression, not a room hidden below an uncut heightfield.
 * Apply this to groundRaw's final result so terrain visuals and physics agree. */
export function reedRuinGround(x: number, z: number, ground: number): number {
  const dx = Math.abs(x - 110), dz = Math.abs(z - 40);
  // Approach corridor slopes down from ordinary ground into the chamber.
  if (dx < 1.8 && z >= 31.8 && z < 39.8) {
    const t = THREE.MathUtils.clamp((z - 31.8) / 7.4, 0, 1);
    return Math.min(ground, 0.2 - 6.2 * t);
  }
  if (dx >= 5.8 || dz >= 6.4) return ground;
  const edge = Math.min(1, Math.max(0, Math.min((5.8 - dx) / 0.8, (6.4 - dz) / 0.8)));
  return THREE.MathUtils.lerp(ground, -6, edge);
}

export type ReedmarshRegion = {
  /** Call on SW2 latch, including restoration loaded from a save. */
  restore: () => void;
  causeway: ReadonlyArray<THREE.Vector3>;
  ruinPage: THREE.Vector3;
  readonly pageFound: boolean;
  visit: (pos: THREE.Vector3, feetY: number) => boolean;
};

/** Stonework uses the realm's supplied textured, ColorField-patched material.
 * No renderer, material pipeline, water source or locomotion ownership here. */
export function createReedmarshRegion(
  parent: THREE.Group,
  collision: CollisionWorld,
  stoneMaterial: THREE.Material,
): ReedmarshRegion {
  const stone = new Bucket();
  const causewayBucket = new Bucket();
  const routeColliders: ReturnType<typeof boxCollider>[] = [];
  const slab = (x: number, z: number, w: number, d: number, top: number, bottom: number, seed: number) => {
    rockSlab(stone, { x, z, w, d, top, bottom, seed, rough: 0.48, topColor: PAL.stone.clone().lerp(PAL.rustMoss, 0.16) });
    collision.add(boxCollider({ x, z, w, d, top, bottom, tag: 'reed-recovery' }));
  };
  // Broad intermediate catch at y9; a miss from the y15 aqueduct is a 6 m fall.
  // Its east/west wings extend beyond both piers; y5 landings finish the descent.
  // Keep the waterfall/flume and HP column open: these are balconies, not a
  // solid plate through the moving water.
  slab(92, 20, 3, 10, 9, 8.25, 921);
  slab(107.5, 20, 3, 10, 9, 8.25, 926);
  slab(100, 24, 12, 2, 9, 8.25, 927);
  // Catch directly below the falls lip; leave HP and the stair approach open.
  slab(100, 18, 4.2, 2.2, 9, 8.25, 928);
  slab(89, 20, 5, 10, 5, 4.25, 922);
  slab(111, 20, 5, 10, 5, 4.25, 923);
  // Separate wings catch misses without roofing over the island or stair.
  slab(91.5, 12.5, 3, 5, 5, 4.25, 924);
  slab(105.5, 12.5, 7, 5, 5, 4.25, 929);
  slab(100, 27.5, 18, 5, 5, 4.25, 925);
  // Small, clear steps at the west edge let a caught fox return to HP y6.
  for (let i = 0; i < 8; i++) slab(90.5 + i * 0.55, 16.7, 1.1, 2, 5 + (i + 1) * 0.5, 4.5, 930 + i);

  const causeway = [
    new THREE.Vector3(70, -1.8, 0),
    new THREE.Vector3(63, 1.1, -12),
    new THREE.Vector3(52, 2.2, -24),
    new THREE.Vector3(40, 4.6, -36),
    new THREE.Vector3(35, 7.8, -48),
    new THREE.Vector3(32, 9.8, -56),
    new THREE.Vector3(18, 12, -58),
    new THREE.Vector3(14.5, 12, -58),
  ];
  // Ramped collider tops match the visible inclined paving exactly. Broad joint
  // platforms overlap segment ends so the fox cannot catch a triangle seam.
  for (let i = 0; i < causeway.length - 1; i++) {
    const a = causeway[i]!, b = causeway[i + 1]!;
    const dx = b.x - a.x, dz = b.z - a.z, length = Math.hypot(dx, dz), yaw = Math.atan2(dx, dz);
    const center = a.clone().add(b).multiplyScalar(0.5);
    const ramp = new THREE.BoxGeometry(4.2, 0.65, length + 0.24, 1, 1, 6);
    const pos = ramp.attributes.position!;
    for (let j = 0; j < pos.count; j++) {
      const t = (pos.getZ(j) + length / 2) / length;
      pos.setY(j, pos.getY(j) + THREE.MathUtils.lerp(a.y, b.y, t) - 0.325);
    }
    ramp.computeVertexNormals();
    const matrix = new THREE.Matrix4().makeRotationY(yaw); matrix.setPosition(center.x, 0, center.z);
    causewayBucket.add(ramp, matrix, PAL.stone.clone().lerp(PAL.pathEarth, 0.35)); ramp.dispose();
    const c = collision.add(boxCollider({ x: center.x, z: center.z, w: 4.2, d: length + 0.24, yaw, top: a.y - (b.y - a.y) * 0.12 / length, top1: b.y + (b.y - a.y) * 0.12 / length, bottom: Math.min(a.y, b.y) - 0.7, tag: 'reed-causeway' }));
    c.enabled = false; routeColliders.push(c);
    // Broken low piers make the path identifiable from the aqueduct skyline.
    ruinColumn(stone, a.x + 3, a.y - 1, a.z, 2.2, 950 + i, 0.35);
  }
  const causewayMesh = causewayBucket.toMesh(stoneMaterial, { boxUV: 3 });
  if (causewayMesh) { causewayMesh.name = 'Reed Causeway'; causewayMesh.visible = false; parent.add(causewayMesh); }

  // The sunken ruin's descending stair is visible once the ink clears. A
  // shallow stair from the bank reaches the page chamber at -6.
  rockSlab(stone, { x: 110, z: 40, w: 9.5, d: 10.5, top: -6, bottom: -7, seed: 971, rough: 0.4, topColor: PAL.stoneDark });
  collision.add(boxCollider({ x: 110, z: 40, w: 9.5, d: 10.5, top: -6, bottom: -7, tag: 'reed-ruin-floor' }));
  for (let i = 0; i < 16; i++) {
    const top = 0.4 - (i + 1) * 0.4;
    slab(110, 32 + i * 0.45, 2.8, 0.65, top, top - 0.8, 980 + i);
  }
  // Staggered broken columns frame a recognisable room without trapping camera.
  for (const [x, z, h] of [[106, 42, 3.6], [114, 42, 2.7], [106, 37, 1.8], [114, 37, 3.2]]) ruinColumn(stone, x!, -6, z!, h!, 1000 + x! + z!, 0.5);
  const stoneMesh = stone.toMesh(stoneMaterial, { boxUV: 3 });
  if (stoneMesh) { stoneMesh.name = 'Reed recovery and sunken ruin'; parent.add(stoneMesh); }
  const pagePos = new THREE.Vector3(110, -5.94, 42);
  const paper = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.72, 3, 2), new THREE.MeshStandardMaterial({ color: 0xcbb88e, roughness: 1, side: THREE.DoubleSide }));
  paper.rotation.set(-Math.PI / 2, 0, 0.18); paper.position.copy(pagePos); parent.add(paper);
  // A pressed leaf on a torn page, seen only after finding the room. No glint.
  const leaf = new THREE.Mesh(leafShape(0.28, 0.44), new THREE.MeshStandardMaterial({ color: 0x8e4e2a, roughness: 1, side: THREE.DoubleSide }));
  leaf.rotation.copy(paper.rotation); leaf.position.copy(pagePos).add(new THREE.Vector3(0.06, 0.006, 0)); parent.add(leaf);
  let restored = false, found = false;
  try { found = !new URLSearchParams(location.search).has('fresh') && localStorage.getItem('fox-spirit:album:reed-page') === 'found'; } catch { /* save unavailable */ }
  paper.visible = leaf.visible = !found;
  return {
    get pageFound() { return found; },
    visit(pos, feetY) {
      if (!restored || found || Math.abs(feetY + 6) > 0.8 || Math.hypot(pos.x - pagePos.x, pos.z - pagePos.z) > 1.6) return false;
      found = true; paper.visible = leaf.visible = false;
      try { localStorage.setItem('fox-spirit:album:reed-page', 'found'); } catch { /* save unavailable */ }
      return true;
    },
    restore() { if (restored) return; restored = true; for (const c of routeColliders) c.enabled = true; if (causewayMesh) causewayMesh.visible = true; },
    causeway,
    ruinPage: pagePos,
  };
}
