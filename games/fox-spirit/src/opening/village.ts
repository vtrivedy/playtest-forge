/**
 * Lanternhollow in the Pressed Ink → Living Cel kit: chunky timber-and-plaster cottages under thick
 * overhanging roofs, the Great Well with its little roof and bucket, lanes of flagstones, festoon lanterns.
 * Shapes are big and readable (Legends: Arceus prop language); every part is toon + paint patch + ink hull.
 */
import * as THREE from 'three';
import { hewn, inked, jitter, toon } from '../lookdevKit';
import type { OpeningCtx } from './scene';
import { HOUSES, PATHS, WELL } from './layout';

const C = {
  plaster: 0xd8c6a4,
  plasterShade: 0xc9b38f,
  timber: 0x5b3e2c,
  timberDark: 0x3f2a1f,
  stone: 0x8e8577,
  stoneDark: 0x6f665b,
  roof: [0x6f4a43, 0x765045, 0x5f4a45],
  ridge: 0x4b3530,
  amber: 0xe7a85a,
  door: 0x6a4630,
  flag: 0x9c917c,
};

const mats = new Map<string, THREE.MeshToonMaterial>();
function mat(color: number, contour = 0): THREE.MeshToonMaterial {
  const key = `${color}:${contour}`;
  let m = mats.get(key);
  if (!m) mats.set(key, (m = toon(color, { contour })));
  return m;
}

type V3 = [number, number, number];
/** inked toon part placed in `parent` */
function part(parent: THREE.Object3D, geo: THREE.BufferGeometry, color: number, at: V3, rot: V3 = [0, 0, 0], ink = 0.016): THREE.Mesh {
  const m = inked(geo, mat(color), ink);
  m.position.set(...at);
  m.rotation.set(...rot);
  parent.add(m);
  return m;
}

/** pitched-roof gable: triangle prism `w` wide (x), `d` deep (z), `h` tall */
function gableGeometry(d: number, h: number, depth: number): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(-d / 2, 0);
  s.lineTo(d / 2, 0);
  s.lineTo(0, h);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
  g.translate(0, 0, -depth / 2);
  g.rotateY(Math.PI / 2);
  return g;
}

/** round-topped door / window opening as a thin slab */
function archSlab(w: number, h: number, t: number): THREE.BufferGeometry {
  const s = new THREE.Shape();
  const r = w / 2;
  s.moveTo(-r, 0);
  s.lineTo(r, 0);
  s.lineTo(r, h - r);
  s.absarc(0, h - r, r, 0, Math.PI, false);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 1, curveSegments: 10 });
  g.translate(0, 0, -t / 2);
  return g;
}

function cottage(ctx: OpeningCtx, h: (typeof HOUSES)[number], index: number): THREE.Group {
  const { rand } = ctx;
  const g = new THREE.Group();
  const y0 = Math.min(...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => ctx.groundH(h.x + (sx * h.w) / 2, h.z + (sz * h.d) / 2))));
  g.position.set(h.x, y0, h.z);
  const { w, d, eave, rise } = h;
  const front = d / 2;

  // stone footing, sunk so uneven ground never shows a gap
  part(g, hewn(new THREE.BoxGeometry(w + 0.35, 0.9, d + 0.35, 4, 1, 3), rand, 0.035), C.stoneDark, [0, 0.05, 0], [0, 0, 0], 0.02);
  // plaster box (slightly bowed walls keep it hand-made)
  part(g, jitter(new THREE.BoxGeometry(w, eave, d, 4, 3, 3), 0.012, rand), index % 2 ? C.plasterShade : C.plaster, [0, 0.45 + eave / 2 - 0.05, 0]);
  const wallTop = 0.4 + eave;

  // timber frame: corner posts, sill + wall plate, front braces
  const post = (x: number, z: number) => part(g, new THREE.BoxGeometry(0.2, eave + 0.05, 0.2), C.timber, [x, 0.42 + eave / 2, z]);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) post((sx * w) / 2, (sz * d) / 2);
  for (const sz of [-1, 1]) {
    part(g, new THREE.BoxGeometry(w + 0.12, 0.18, 0.16), C.timber, [0, 0.55, (sz * d) / 2 + 0.02]);
    part(g, new THREE.BoxGeometry(w + 0.12, 0.2, 0.18), C.timber, [0, wallTop - 0.08, (sz * d) / 2 + 0.02]);
  }
  for (const sx of [-1, 1]) {
    part(g, new THREE.BoxGeometry(0.16, 0.2, d + 0.12), C.timber, [(sx * w) / 2 + 0.02, wallTop - 0.08, 0]);
    // end-wall diagonal brace
    const len = Math.hypot(d * 0.42, eave * 0.55);
    part(g, new THREE.BoxGeometry(0.11, len, 0.12), C.timber, [(sx * w) / 2 + 0.03, 0.55 + eave * 0.42, -d * 0.18], [Math.atan2(d * 0.42, eave * 0.55), 0, 0]);
  }

  // gables + thick overhanging roof slabs
  const gableH = rise;
  for (const sx of [-1, 1]) part(g, gableGeometry(d, gableH, 0.16), index % 2 ? C.plasterShade : C.plaster, [(sx * (w - 0.1)) / 2, wallTop, 0]);
  const over = 0.55;
  const slope = Math.atan2(rise, d / 2);
  const run = Math.hypot(d / 2 + over, rise + over * Math.tan(slope));
  const roofColor = C.roof[index % C.roof.length]!;
  const thick = 0.32;
  for (const sz of [-1, 1]) {
    const geo = hewn(new THREE.BoxGeometry(w + over * 2, thick, run, 5, 1, 4), rand, 0.025);
    const cz = sz * (d / 4 + over / 2 - 0.05);
    const cy = wallTop + rise / 2 - (over / 2) * Math.tan(slope) + thick * 0.35;
    part(g, geo, roofColor, [0, cy, cz], [sz * slope, 0, 0], 0.022);
  }
  // ridge cap
  const ridge = new THREE.CylinderGeometry(0.2, 0.2, w + over * 2 + 0.1, 8);
  ridge.rotateZ(Math.PI / 2);
  part(g, ridge, C.ridge, [0, wallTop + rise + thick * 0.55, 0], [0, 0, 0], 0.02);

  // round-topped door + stone step, shuttered windows with warm panes
  const doorX = -w * 0.18;
  part(g, archSlab(1.0, 1.75, 0.1), C.timberDark, [doorX, 0.42, front + 0.04]);
  part(g, archSlab(0.82, 1.62, 0.1), C.door, [doorX, 0.45, front + 0.09]);
  part(g, hewn(new THREE.BoxGeometry(1.25, 0.28, 0.6, 2, 1, 1), rand, 0.04), C.stone, [doorX, 0.18, front + 0.38], [0, 0, 0], 0.018);
  const win = (x: number, y: number, z: number, yaw: number) => {
    const wg = new THREE.Group();
    wg.position.set(x, y, z);
    wg.rotation.y = yaw;
    g.add(wg);
    part(wg, new THREE.BoxGeometry(0.78, 0.7, 0.08), C.amber, [0, 0, 0.02]);
    part(wg, new THREE.BoxGeometry(0.92, 0.12, 0.14), C.timber, [0, -0.4, 0.06]);
    part(wg, new THREE.BoxGeometry(0.06, 0.7, 0.1), C.timber, [0, 0, 0.07]);
    for (const s of [-1, 1]) part(wg, new THREE.BoxGeometry(0.34, 0.8, 0.07), C.timber, [s * 0.6, 0, 0.08], [0, s * 0.35, 0]);
  };
  win(w * 0.22, 0.45 + eave * 0.55, front + 0.02, 0);
  for (const sx of [-1, 1]) win((sx * w) / 2 + sx * 0.02, 0.45 + eave * 0.55, d * 0.12, sx * Math.PI / 2);

  if (h.chimney) {
    // stacked-stone chimney through the back slope
    const cg = new THREE.Group();
    cg.position.set(-w * 0.3, wallTop, -d * 0.22);
    g.add(cg);
    for (let k = 0; k < 5; k++) {
      const s = 0.82 - k * 0.04;
      part(cg, hewn(new THREE.BoxGeometry(s, 0.42, s, 1, 1, 1), rand, 0.05), k % 2 ? C.stone : C.stoneDark, [(rand() - 0.5) * 0.06, k * 0.4, (rand() - 0.5) * 0.06], [0, rand() * 0.2, 0], 0.018);
    }
    part(cg, hewn(new THREE.BoxGeometry(1.0, 0.16, 1.0, 1, 1, 1), rand, 0.04), C.stoneDark, [0, 2.05, 0], [0, 0, 0], 0.018);
  }

  // doorstep life: barrel and a crate stack beside the door, woodpile at the back
  const barrel = new THREE.CylinderGeometry(0.32, 0.28, 0.72, 10);
  part(g, barrel, C.timber, [doorX - 0.95, ctx.groundH(h.x + doorX - 0.95, h.z + front + 0.5) - y0 + 0.36, front + 0.5], [0, 0, 0], 0.016);
  part(g, hewn(new THREE.BoxGeometry(0.55, 0.5, 0.55, 1, 1, 1), rand, 0.03), C.door, [w * 0.42, ctx.groundH(h.x + w * 0.42, h.z + front + 0.55) - y0 + 0.25, front + 0.55], [0, 0.3, 0], 0.016);
  for (let row = 0; row < 2; row++)
    for (let k = 0; k < 3 - row; k++) {
      const log = new THREE.CylinderGeometry(0.13, 0.13, 0.8, 7);
      log.rotateZ(Math.PI / 2);
      part(g, log, k % 2 ? C.timber : C.door, [w * 0.15 + (k - 1 + row * 0.5) * 0.27, 0.45 + 0.13 + row * 0.23, -front - 0.38], [0, 0, 0], 0.012);
    }
  return g;
}

function greatWell(ctx: OpeningCtx): THREE.Group {
  const { rand } = ctx;
  const g = new THREE.Group();
  const y = ctx.groundH(WELL.x, WELL.z);
  g.position.set(WELL.x, y, WELL.z);
  // chunky stone ring + coping
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2;
    part(g, hewn(new THREE.BoxGeometry(0.9, 0.85, 0.5, 1, 1, 1), rand, 0.06), k % 3 ? C.stone : C.stoneDark, [Math.sin(a) * 1.25, 0.32, Math.cos(a) * 1.25], [0, a, 0], 0.02);
  }
  const coping = new THREE.TorusGeometry(1.28, 0.2, 6, 20);
  coping.rotateX(Math.PI / 2);
  part(g, jitter(coping, 0.03, rand), C.stoneDark, [0, 0.82, 0], [0, 0, 0], 0.02);
  // dark water disc
  const water = new THREE.Mesh(new THREE.CircleGeometry(1.05, 20), new THREE.MeshBasicMaterial({ color: 0x1d1a1c }));
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.45;
  g.add(water);
  // timber posts, crossbeam with a crank, and a little shingled roof
  for (const s of [-1, 1]) part(g, new THREE.BoxGeometry(0.22, 2.5, 0.22), C.timber, [s * 1.35, 1.25, 0]);
  const axle = new THREE.CylinderGeometry(0.1, 0.1, 2.9, 8);
  axle.rotateZ(Math.PI / 2);
  part(g, axle, C.timberDark, [0, 1.85, 0]);
  part(g, new THREE.BoxGeometry(0.08, 0.5, 0.08), C.timberDark, [1.55, 1.65, 0.12], [0, 0, 0.4]);
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.75, 4), mat(0x8a7357));
  rope.position.set(0.1, 1.45, 0);
  g.add(rope);
  part(g, new THREE.CylinderGeometry(0.2, 0.16, 0.3, 9), C.timber, [0.1, 1.0, 0]);
  for (const s of [-1, 1]) part(g, hewn(new THREE.BoxGeometry(3.4, 0.16, 1.25, 3, 1, 2), rand, 0.03), C.roof[0]!, [0, 2.6, s * 0.48], [s * 0.62, 0, 0], 0.02);
  const ridge = new THREE.CylinderGeometry(0.11, 0.11, 3.5, 7);
  ridge.rotateZ(Math.PI / 2);
  part(g, ridge, C.ridge, [0, 2.95, 0]);
  return g;
}

function flagstones(ctx: OpeningCtx): THREE.InstancedMesh {
  const { rand } = ctx;
  const stone = hewn(new THREE.CylinderGeometry(0.32, 0.36, 0.12, 7), rand, 0.06);
  const pts: THREE.Matrix4[] = [];
  const q = new THREE.Quaternion();
  for (const [ax, az, bx, bz] of PATHS) {
    if (Math.min(az, bz) < 78) continue; // meadow paths are worn earth, not flagged
    const len = Math.hypot(bx - ax, bz - az);
    for (let s = 0.4; s < len; s += 0.62 + rand() * 0.25) {
      const t = s / len;
      const side = (rand() - 0.5) * 0.9;
      const nx = -(bz - az) / len;
      const nz = (bx - ax) / len;
      const x = ax + (bx - ax) * t + nx * side;
      const z = az + (bz - az) * t + nz * side;
      q.setFromEuler(new THREE.Euler(0, rand() * 6, 0));
      const sc = 0.75 + rand() * 0.5;
      pts.push(new THREE.Matrix4().compose(new THREE.Vector3(x, ctx.groundH(x, z) - 0.02, z), q, new THREE.Vector3(sc, 1, sc * (0.8 + rand() * 0.3))));
    }
  }
  const mesh = new THREE.InstancedMesh(stone, mat(C.flag), pts.length);
  pts.forEach((m, i) => mesh.setMatrixAt(i, m));
  mesh.receiveShadow = true;
  return mesh;
}

/** lantern post (unlit paper by day; the lantern is a warm note once painted) */
function lanternPost(ctx: OpeningCtx, x: number, z: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, ctx.groundH(x, z), z);
  part(g, new THREE.BoxGeometry(0.16, 2.4, 0.16), C.timber, [0, 1.2, 0]);
  part(g, new THREE.BoxGeometry(0.7, 0.12, 0.12), C.timber, [0.28, 2.3, 0]);
  part(g, new THREE.BoxGeometry(0.28, 0.36, 0.28), C.amber, [0.52, 1.98, 0]);
  part(g, new THREE.ConeGeometry(0.26, 0.2, 4), C.ridge, [0.52, 2.24, 0], [0, Math.PI / 4, 0]);
  return g;
}

export function buildVillage(ctx: OpeningCtx): void {
  const { scene, colliders } = ctx;
  HOUSES.forEach((h, i) => {
    const c = cottage(ctx, h, i);
    scene.add(c);
    ctx.occluders.push(c);
    colliders.push({ kind: 'box', x: h.x, z: h.z, yaw: 0, hx: h.w / 2 + 0.2, hz: h.d / 2 + 0.2, top: c.position.y + 0.4 + h.eave + h.rise });
    // doorstep barrel + crate
    colliders.push({ kind: 'post', x: h.x - h.w * 0.18 - 0.95, z: h.z + h.d / 2 + 0.5, r: 0.34 });
  });
  const well = greatWell(ctx);
  scene.add(well);
  ctx.occluders.push(well);
  colliders.push({ kind: 'post', x: WELL.x, z: WELL.z, r: 1.55 });
  scene.add(flagstones(ctx));
  for (const [x, z] of [[-12, 86.4], [6.6, 89.4], [-3.2, 82], [-14.5, 95.8]] as const) {
    scene.add(lanternPost(ctx, x, z));
    colliders.push({ kind: 'post', x, z, r: 0.14 });
  }
}
