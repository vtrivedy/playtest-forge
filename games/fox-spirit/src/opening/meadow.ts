/**
 * Arrival Meadow: ground, the H-a rock shelf, trees and rocks. (Skeleton stand-in — @ember owns the art.)
 */
import * as THREE from 'three';
import { buildDistance, buildMaple, buildRock, hewn, inked, toon } from '../lookdevKit';
import type { OpeningCtx } from './scene';
import { BOUNDS, pathDist, SHELF } from './layout';

export function buildMeadow(ctx: OpeningCtx): void {
  const { scene, groundH, rand, colliders } = ctx;
  const geo = new THREE.PlaneGeometry(BOUNDS.rx * 3, BOUNDS.rz * 3.4, 160, 130);
  geo.rotateX(-Math.PI / 2);
  geo.translate(BOUNDS.cx, 0, BOUNDS.cz);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const col = new Float32Array(pos.count * 3);
  const sage = new THREE.Color(0x414739);
  const ochre = new THREE.Color(0x655d45);
  const dirt = new THREE.Color(0x92856a);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, groundH(x, z));
    const n = Math.sin(x * 0.23 + Math.cos(z * 0.19) * 2) * 0.5 + 0.5;
    c.copy(sage).lerp(ochre, THREE.MathUtils.smoothstep(n, 0.5, 0.6) * 0.65);
    c.lerp(dirt, 1 - THREE.MathUtils.smoothstep(pathDist(x, z) + Math.sin(z * 2.3 + x) * 0.14, 0.65, 1.6));
    col.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, toon(0xffffff, { vertexColors: true, hatchWeight: 0.22 }));
  ground.receiveShadow = true;
  scene.add(ground);

  // H-a shelf: a 5 m stone step with no ramp; the hearth at its foot is the way up
  const g0 = groundH(SHELF.x, SHELF.z);
  const shelf = inked(hewn(new THREE.BoxGeometry(SHELF.w, SHELF.rise + 2, SHELF.d, 3, 3, 3), rand, 0.04), toon(0x8a7a66), 0.03);
  shelf.position.set(SHELF.x, g0 + SHELF.rise / 2 - 1, SHELF.z);
  shelf.rotation.y = SHELF.yaw;
  scene.add(shelf);
  colliders.push({ kind: 'box', x: SHELF.x, z: SHELF.z, yaw: SHELF.yaw, hx: SHELF.w / 2, hz: SHELF.d / 2, top: g0 + SHELF.rise });

  const trees: Array<[number, number, number, 'hero' | 'grove']> = [[-12, 72, 1.2, 'hero'], [20, 66, 1.3, 'grove'], [-4, 66, 1.0, 'grove'], [22, 84, 1.1, 'grove']];
  for (const [x, z, s, kind] of trees) {
    const y = groundH(x, z);
    const t = buildMaple(rand, s, kind, Math.floor(rand() * 4), y);
    t.position.set(x, y - 0.1, z);
    t.rotation.y = rand() * 6;
    scene.add(t);
    colliders.push({ kind: 'post', x, z, r: 0.45 * s });
  }
  for (const [x, z, s] of [[2, 70, 0.7], [-8, 76, 0.55], [8, 82, 0.6]] as const) {
    const r = buildRock(rand, s);
    r.position.set(x, groundH(x, z) + s * 0.25, z);
    scene.add(r);
    colliders.push({ kind: 'cap', x, z, r: s * 1.1, base: groundH(x, z), h: s * 0.95 });
  }
  buildDistance(scene, rand);
}
