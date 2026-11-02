/**
 * The far lip of Press Hollow (Kit's naive run, 22bfeb4 seed 1: the fox climbed the hollow's west wall, walked down
 * the lip into the vista valley and wandered to z −220, y −10.7, off the end of the world). A post-and-rope rail
 * along the lip, ~6 m past the Press, closes it: 1 m high (the fox's jump apex is ~0.83 m) and low enough that the
 * Crown still reads over it from the bridge and the hollow. Fixed spacing, no build rand.
 */
import * as THREE from 'three';
import type { OpeningCtx } from './scene';
import { FINALE, VISTA } from './layout';
import { C, cyl, Kit } from './village';

/** metres along the fall line past the crag (the lip starts at FINALE.hollow.lip) and the half-width across it */
export const EDGE = { a: FINALE.hollow.lip + 1.5, half: 34, step: 2.6, height: 1.0, reach: 4 } as const;

export function buildWorldEdge(ctx: OpeningCtx): void {
  const { groundH, colliders, scene } = ctx;
  const V = VISTA;
  const k = new Kit();
  const yaw = Math.atan2(V.dx, V.dz);
  const at = (c: number) => ({ x: V.x + V.dx * EDGE.a + V.dz * c, z: V.z + V.dz * EDGE.a - V.dx * c });
  const n = Math.round((EDGE.half * 2) / EDGE.step);
  const posts: THREE.Vector3[] = [];
  for (let i = 0; i <= n; i++) {
    const c = -EDGE.half + i * EDGE.step;
    const p = at(c);
    posts.push(new THREE.Vector3(p.x, groundH(p.x, p.z), p.z));
  }
  posts.forEach((p, i) => {
    const lean = ((i * 7) % 5) / 5 - 0.4;
    k.add(cyl(0.06, 0.08, EDGE.height + 0.15, 6), C.timberDark, [p.x, p.y + (EDGE.height + 0.15) / 2 - 0.1, p.z], [lean * 0.08, 0, lean * 0.06], 0.012);
    const q = posts[i + 1];
    if (!q) return;
    // two sagging ropes between posts
    for (const h of [0.55, 0.92]) {
      const a = p.clone().setY(p.y + h);
      const b = q.clone().setY(q.y + h);
      const pts = Array.from({ length: 5 }, (_, t) => a.clone().lerp(b, t / 4).setY(THREE.MathUtils.lerp(a.y, b.y, t / 4) - 0.12 * 4 * (t / 4) * (1 - t / 4)));
      k.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 8, 0.014, 4), C.rope, [0, 0, 0], [0, 0, 0], 0.004);
    }
    // one box per span. Its collision reaches well above the 1 m rail: on the hollow's side walls the ground climbs
    // ~1 m per m across the lip, and a fox dropping diagonally off the wall cleared a rail-height box (seed 1 retest)
    const mid = p.clone().add(q).multiplyScalar(0.5);
    colliders.push({ kind: 'box', x: mid.x, z: mid.z, yaw, hx: EDGE.step / 2 + 0.05, hz: 0.25, top: Math.max(p.y, q.y) + EDGE.height + EDGE.reach });
  });
  const rail = k.build();
  scene.add(rail);
  // a solid blocker taller than the fox belongs to a chase-cam occlusion root (blockers.ts)
  ctx.occluders.push(rail);
}
