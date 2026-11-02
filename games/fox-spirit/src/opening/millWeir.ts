/**
 * Millbrook's second beat (DESIGN-millbrook.md): the turning wheel works the bellows, the bellows wake
 * the cold malting kiln beside the mill, and the kiln's warm air lifts the fox high enough to glide up
 * onto the Weir Stones, the rock shelf where the brook's spring falls into the valley.
 * Static build here; the bellows/kiln/fall runtime is millWeir.hot.ts.
 */
import * as THREE from 'three';
import { hewn, inked, jitter, toon } from '../lookdevKit';
import type { OpeningCtx } from './scene';
import { column } from './meadow';
import { box, C, cyl, Kit } from './village';
import { MILLBROOK, waterY } from './millbrookLayout';

/** the kiln: a broad two-step plinth round a blackened bowl, the bellows on its mill side */
export function buildKiln(ctx: OpeningCtx) {
  const { rand, groundH, scene, colliders } = ctx;
  const K = MILLBROOK.kiln;
  const y = groundH(K.x, K.z);
  const g = new THREE.Group();
  g.position.set(K.x, y, K.z);
  scene.add(g);
  ctx.occluders.push(g);
  for (const [w, h, y0, tone] of [[2.7, 0.36, -0.08, 0x7a7062], [2.1, 0.3, 0.28, 0x8b8273]] as const) {
    const m = inked(hewn(new THREE.BoxGeometry(w, h, w, 2, 1, 2), rand, 0.05), toon(tone, { contour: 0.5 }), 0.022, true);
    m.position.y = y0 + h / 2;
    m.rotation.y = rand() * 0.4;
    g.add(m);
  }
  const n = 9;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2 + 0.04;
    const a1 = ((i + 1) / n) * Math.PI * 2 - 0.04;
    const s = new THREE.Shape();
    s.absarc(0, 0, 1.25, a0, a1, false);
    s.absarc(0, 0, 0.86, a1, a0, true);
    s.closePath();
    const h = 0.55 + rand() * 0.16;
    const geo = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 3 });
    geo.rotateX(-Math.PI / 2);
    const stone = inked(hewn(geo, rand, 0.03), toon(new THREE.Color(0x5a4f46).multiplyScalar(0.85 + rand() * 0.25), { contour: 0.5 }), 0.022, true);
    stone.position.y = 0.55;
    g.add(stone);
  }
  colliders.push({ kind: 'cap', x: K.x, z: K.z, r: 1.3, base: y, h: 1.1 });

  // bellows on a trestle between the mill wall and the kiln, its nozzle into the bowl
  const toMill = Math.atan2(MILLBROOK.mill.x - K.x, MILLBROOK.mill.z - K.z);
  const frame = new Kit();
  frame.at(K.x, y, K.z, toMill, () => {
    for (const s of [-1, 1]) frame.add(box(0.12, 0.7, 0.12), C.timberDark, [s * 0.45, 0.35, 2.1]);
    frame.add(box(1.1, 0.1, 0.9), C.timber, [0, 0.72, 2.1]);
    // the lay shaft from the mill wall: the wheel's turn reaches the bellows through it
    frame.add(cyl(0.07, 0.07, 1.6, 8, 'z'), C.timberDark, [0.62, 1.05, 2.95]);
    frame.add(cyl(0.16, 0.16, 0.12, 10, 'z'), C.timberDark, [0.62, 1.05, 2.2]);
  });
  const frameMesh = frame.build();
  scene.add(frameMesh);
  // the moving parts: one board hinged at the nozzle end, a leather belly that swells with it
  const bellows = new THREE.Group();
  bellows.position.set(K.x + Math.sin(toMill) * 1.55, y + 0.86, K.z + Math.cos(toMill) * 1.55);
  bellows.rotation.y = toMill;
  scene.add(bellows);
  const bk = new Kit();
  bk.add(box(0.7, 0.06, 1.1), C.door, [0, 0, 0.55]);
  bk.add(new THREE.ConeGeometry(0.09, 0.5, 6).rotateX(-Math.PI / 2), C.timberDark, [0, 0.05, -0.18]);
  bellows.add(bk.build());
  const lid = new THREE.Group();
  lid.position.set(0, 0.06, 0);
  bellows.add(lid);
  const lk = new Kit();
  lk.add(box(0.7, 0.06, 1.1), C.door, [0, 0.06, 0.55]);
  lk.add(box(0.1, 0.1, 0.35), C.timberDark, [0, 0.12, 1.2]);
  lid.add(lk.build());
  const belly = new THREE.Mesh(jitter(new THREE.CylinderGeometry(0.34, 0.34, 1.0, 10, 1), 0.04, rand).rotateX(Math.PI / 2), toon(C.cloth[1]!));
  belly.position.set(0, 0.06, 0.55);
  belly.scale.set(1, 0.25, 1);
  bellows.add(belly);
  return { lid, belly };
}

/**
 * The Weir Stones: jointed columns on the valley's north edge, moss turf top, a spring pool on it whose
 * water spills over the east lip as a thin fall into the brook's head.
 */
export function buildWeir(ctx: OpeningCtx) {
  const { rand, groundH, scene, colliders } = ctx;
  const R = MILLBROOK.weir;
  const g0 = groundH(R.x, R.z);
  const root = new THREE.Group();
  root.position.set(R.x, 0, R.z);
  root.rotation.y = R.yaw;
  scene.add(root);
  for (const lx of [-2.6, 0, 2.6]) {
    for (const lz of [-2.6, 0, 2.6]) {
      const c = column(rand, lx + (rand() - 0.5) * 0.4, lz + (rand() - 0.5) * 0.4, 1.95, g0 - 2, R.top, true);
      root.add(c);
      ctx.occluders.push(c);
    }
  }
  colliders.push({ kind: 'box', x: R.x, z: R.z, yaw: R.yaw, hx: R.half, hz: R.half, top: R.top });
  // taller columns behind (north): the shelf backs onto the rim, never a climb
  for (const [lx, lz, r, h] of [[-3.6, -4.8, 2.1, 3.2], [0.6, -5.2, 2.3, 4.1], [4.2, -4.4, 1.9, 2.6]] as const) {
    root.add(column(rand, lx, lz, r, g0 - 2, R.top + h, h < 3.5));
    const c = Math.cos(R.yaw);
    const s = Math.sin(R.yaw);
    colliders.push({ kind: 'post', x: R.x + lx * c + lz * s, z: R.z - lx * s + lz * c, r: r * 0.95 });
  }
  // the spring pool on top and its fall over the east lip
  const pool = new THREE.Mesh(new THREE.CircleGeometry(1.25, 20).rotateX(-Math.PI / 2), toon(0x6f979c, { hatchWeight: 0.15 }));
  pool.position.set(R.x + R.lip.x * 1.3, R.top + 0.04, R.z + R.lip.z * 1.3);
  scene.add(pool);
  const k = new Kit();
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const r = 0.16 + rand() * 0.14;
    k.add(jitter(new THREE.DodecahedronGeometry(r, 0), 0.2, rand), i % 2 ? C.stoneField : C.stoneCool, [pool.position.x + Math.cos(a) * 1.35, R.top + r * 0.3, pool.position.z + Math.sin(a) * 1.35], [rand(), rand(), rand()], 0.014, [1.2, 0.7, 1]);
  }
  for (let j = 0; j < 7; j++) {
    const h = 0.6 + rand() * 0.6;
    const a = rand() * 6.28;
    k.add(new THREE.ConeGeometry(0.03, h, 3), j % 2 ? C.leaf : C.thatchDark, [pool.position.x + Math.cos(a) * 1.5, R.top + h / 2, pool.position.z + Math.sin(a) * 1.5], [(rand() - 0.5) * 0.3, 0, (rand() - 0.5) * 0.3], 0.006);
  }
  scene.add(k.build());
  // the fall: a narrow ribbon from the lip down to the brook head (flecks run down it at runtime)
  const lipX = R.x + R.lip.x * R.half;
  const lipZ = R.z + R.lip.z * R.half;
  const footX = R.fall.x;
  const footZ = R.fall.z;
  const footY = waterY(footZ);
  const fall = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1, 1, 6), toon(0x9cb8b4, { hatchWeight: 0.1 }));
  fall.material.side = THREE.DoubleSide;
  const p = fall.geometry.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const v = 0.5 - p.getY(i); // 0 at the lip → 1 at the foot
    const x = THREE.MathUtils.lerp(lipX, footX, v * v);
    const z = THREE.MathUtils.lerp(lipZ, footZ, v * v);
    const yy = THREE.MathUtils.lerp(R.top + 0.05, footY, Math.sqrt(v));
    // across the fall: perpendicular to its run
    const ax = -(footZ - lipZ);
    const az = footX - lipX;
    const al = Math.hypot(ax, az) || 1;
    p.setXYZ(i, x + (p.getX(i) * ax) / al, yy, z + (p.getX(i) * az) / al);
  }
  fall.geometry.computeVertexNormals();
  fall.geometry.computeBoundingSphere();
  scene.add(fall);
  return { lip: new THREE.Vector3(lipX, R.top, lipZ), foot: new THREE.Vector3(footX, footY, footZ) };
}
