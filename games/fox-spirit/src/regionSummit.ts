import * as THREE from 'three';
import { boxCollider, type CollisionWorld } from './collision';
import { Bucket, stoneBlock, trs } from './russetKit';
import type { Root, RootSpot } from './chem/growth';
import type { Hearth, HearthSpot, UpdraftTunables } from './chem/updraft';
import { heatFeeds } from './chem/inlet';

export const SUMMIT_REPAIR = {
  rootId: 'summit-KS', hearthId: 'summit-hearth', latchTime: 2,
  floorY: 38, hearthY: 39.56, basinY: 40.86,
  lintelColdBottom: 40.62, lintelThickness: 0.55, lift: 1.5,
};
export type SummitRepair = {
  rootSpot: RootSpot;
  hearthSpot: HearthSpot;
  basin: THREE.Vector3;
  /** Call after growth update; flooded keeps the repair permanent. */
  update: (dt: number, roots: ReadonlyArray<Root>, flooded: boolean) => void;
  /** Integrator accumulates normal two-second inlet seal from this output. */
  feeds: (hearth: Hearth | undefined, radius: number) => boolean;
  /** Clip real lift and existing column FX against the moving stone underside. */
  fitColumn: (hearth: Hearth | undefined, tun: UpdraftTunables) => void;
  state: () => { rootLive: boolean; rootGrown: number; lintelLift: number; clearance: boolean };
};

/** A root lifts a real stone obstruction while a separate hearth heats the
 * existing basin. No proximity trigger or separate renderer/effect system. */
export function createSummitRepair(parent: THREE.Group, col: CollisionWorld, stoneMaterial: THREE.Material): SummitRepair {
  const s = SUMMIT_REPAIR;
  const stone = new Bucket();
  // Match the three tiers already drawn by domedShrine(scale1.3). Their0.52m
  // rises are within STEP_UP and repair the old single, low plinth collider.
  for (const [w, y] of [[5.98, 38.52], [5.2, 39.04], [4.42, 39.56]]) {
    col.add(boxCollider({ x: 0, z: -89, w: w!, d: w!, top: y!, bottom: 37.9, tag: 'summit-plinth-step' }));
  }
  // Fallen lintel rests beside the front altar, across the hearth's column.
  // Its rounded, mottled masonry uses the world's existing textured material.
  stoneBlock(stone, trs(0, s.lintelThickness / 2, 0, 0.035), 4.5, s.lintelThickness, 3.7, 12001, 0.1);
  const lintel = stone.toMesh(stoneMaterial, { boxUV: 1.6 })!;
  lintel.name = 'Wellspring fallen lintel';
  lintel.position.set(0, s.lintelColdBottom, -87.6); parent.add(lintel);
  const c = col.add(boxCollider({ x: 0, z: -87.6, w: 4.5, d: 3.7, yaw: 0.035,
    top: s.lintelColdBottom + s.lintelThickness, bottom: s.lintelColdBottom, tag: 'summit-lintel' }));
  const socket = new Bucket();
  // Broken feet at either end tell the player which stone has fallen. They
  // stay outside the hearth axis and leave its southern approach open.
  for (const x of [-2.55, 2.55]) {
    stoneBlock(socket, trs(x, 39.0, -88.0), 0.65, 1.8, 0.95, 12020 + Math.round(x * 10), 0.12);
    col.add(boxCollider({ x, z: -88, w: 0.65, d: 0.95, top: 39.9, bottom: 38, tag: 'summit-lintel-foot' }));
  }
  const feet = socket.toMesh(stoneMaterial, { boxUV: 1.6 }); if (feet) parent.add(feet);
  const rootSpot: RootSpot = {
    id: s.rootId,
    // a long, low climb from the apron to the lintel's underside (a short steep root read as a ribbon)
    knot: new THREE.Vector3(-6.8, 38, -84.2),
    path: [[-6.3, 38.1, -84.4], [-5.1, 38.5, -85.0], [-3.9, 39.3, -85.8], [-3.0, 40.5, -86.7], [-2.2, 41.5, -87.3], [-1.7, 42.12, -87.6]],
    segments: 2, width: 1.4,
    // Flood explicitly restores this root; no local Seedwell bypasses repair.
  };
  const hearthSpot: HearthSpot = { id: s.hearthId, x: 0, y: s.hearthY, z: -87, height: 9 };
  const basin = new THREE.Vector3(0, s.basinY, -89);
  let lift = 0, rootLive = false, rootGrown = 0;
  return {
    rootSpot, hearthSpot, basin,
    update(dt, roots, flooded) {
      const r = roots.find(q => q.spot.id === s.rootId);
      if (flooded && r) r.reactor.restored = true;
      rootGrown = r ? Math.max(0, Math.min(1, r.grown)) : 0;
      rootLive = flooded || !!r && r.reactor.heat >= 0.5 && r.wither <= 0 && rootGrown >= 0.999;
      // The root reaches the underside during its last growth segment. The
      // lintel follows that support, then settles if the live root expires.
      const support = r && r.reactor.heat >= 0.5 && r.wither <= 0 ? THREE.MathUtils.smoothstep(rootGrown, 0.6, 1) : 0;
      lift = THREE.MathUtils.damp(lift, flooded ? s.lift : support * s.lift, 6, dt);
      lintel.position.y = s.lintelColdBottom + lift;
      c.bottom = lintel.position.y; c.top0 = c.top1 = c.bottom + s.lintelThickness;
    },
    fitColumn(hearth, tun) {
      if (!hearth) return;
      hearth.height = Math.max(0.12, c.bottom - hearth.base.y);
      hearth.layout(tun);
    },
    feeds(hearth, radius) {
      return rootLive && lift >= s.lift - 0.05 && !!hearth && heatFeeds(hearth, basin, radius);
    },
    state: () => ({ rootLive, rootGrown: Number(rootGrown.toFixed(3)), lintelLift: Number(lift.toFixed(3)), clearance: lift >= s.lift - 0.05 }),
  };
}
