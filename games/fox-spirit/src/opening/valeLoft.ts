/**
 * The Loft — a Russetvale secret (DESIGN-worlds.md: side paths and secrets). Crates and hay bales stacked against the
 * east cottage (12, 95) climb to its roof, where a memory page lies: the Scribe's own house, before the rain. Two
 * actions only (jump across ≤ 0.6 m rises). Fixed layout, no build rand; per-tick check is scalar.
 */
import * as THREE from 'three';
import type { OpeningCtx } from './scene';
import { box, C, Kit } from './village';

/** [x, z, top above the ground, half-size] — a leaning pile against the cottage's east wall, north → south, each bale
 * 0.6 m above the last (jump apex 0.83 m) and touching it; the top bale sits a hop below the ridge */
const STEPS: ReadonlyArray<readonly [number, number, number, number]> = [0.6, 1.2, 1.8, 2.4, 3.0, 3.6, 4.2].map(
  (top, i) => [16.6 + (i % 2) * 0.25, 99.6 - i * 1.2, top, 0.62] as const,
);
/** the cottage ridge (its collider top is ground + 0.55 + eave 2.6 + rise 1.4) */
const ROOF = { x: 12.4, z: 95, top: 4.55 } as const;

export function buildValeLoft(ctx: OpeningCtx, opts: { foundAtLoad: boolean; onFound: () => void }) {
  const { scene, groundH, colliders } = ctx;
  const k = new Kit();
  STEPS.forEach(([x, z, top, half], i) => {
    const y0 = groundH(x, z);
    // crates below, a hay bale on top of each stack: reads as a farmyard pile, not a staircase
    const crates = Math.max(1, Math.floor(top / 0.6) - 1);
    for (let c = 0; c < crates; c++) k.add(box(half * 2, 0.58, half * 2), c % 2 ? C.timberDark : C.timber, [x, y0 + 0.29 + c * 0.6, z], [0, (i + c) * 0.21, 0], 0.012);
    k.add(box(half * 2.05, top - crates * 0.6, half * 1.8), C.thatch, [x, y0 + crates * 0.6 + (top - crates * 0.6) / 2, z], [0, i * 0.37, 0], 0.012);
    colliders.push({ kind: 'box', x, z, yaw: 0, hx: half + 0.08, hz: 0.6, top: y0 + top });
  });
  // a plank laid from the top bale onto the eaves: the last hop lands on the ridge, not in the gap beside the wall
  {
    const x = 15.75;
    const z = 93.2;
    const y0 = groundH(16.6, 92.4);
    k.add(box(1.5, 0.12, 1.9), C.timberDark, [x, y0 + 4.26, z], [0, 0.05, 0], 0.01);
    colliders.push({ kind: 'box', x, z, yaw: 0, hx: 0.75, hz: 0.95, top: y0 + 4.32 });
  }
  const pile = k.build();
  scene.add(pile);
  ctx.occluders.push(pile);
  // the memory page on the ridge, weighted with a pebble, glowing faintly
  const y = groundH(ROOF.x, ROOF.z) + ROOF.top;
  const page = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.68), new THREE.MeshBasicMaterial({ color: 0xffe2b0, side: THREE.DoubleSide, toneMapped: false }));
  page.rotation.set(-Math.PI / 2 + 0.2, 0, -0.4);
  page.position.set(ROOF.x, y + 0.06, ROOF.z);
  scene.add(page);
  const light = new THREE.PointLight(0xffc27a, opts.foundAtLoad ? 0.4 : 1.1, 5, 1.6);
  light.position.set(ROOF.x, y + 0.7, ROOF.z);
  scene.add(light);

  let found = opts.foundAtLoad;
  let t = 0;
  return {
    state: () => ({ found }),
    update(dt: number, fox: THREE.Vector3): void {
      if (fox.x < -350 || fox.x > 350) return;
      t += dt;
      page.position.y = y + 0.06 + Math.sin(t * 1.4) * 0.02;
      if (!found && Math.hypot(fox.x - ROOF.x, fox.z - ROOF.z) < 2.4 && fox.y > y - 0.35) {
        found = true;
        opts.onFound();
        ctx.captions.say('The Scribe’s own house, before the rain.');
        light.intensity = 2.5;
      }
    },
  };
}
