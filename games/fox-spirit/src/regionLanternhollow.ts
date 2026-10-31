import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Bucket, PAL, trs } from './russetKit';
import { boxCollider, cylCollider, type CollisionWorld } from './collision';

/** Development comparison control; default selected from the captured 1x/2.5x/4x comparison. */
export const HUB_PRACTICAL = { strength: 2.5 };

/** Domestic scale, kept outside the existing arrival/hearth route. Original geometry. */
export const HUB_FESTOON_POSTS = [[-12, 86.4], [6.6, 89.4]] as const;

export const HUB_HOUSES = [
  { x: -18, z: 92, w: 5.2, d: 4.2, eave: 2.6, rise: 1.4, chimney: true },
  { x: -28.5, z: 84.4, w: 5.6, d: 4.6, eave: 2.8, rise: 2.1, chimney: false },
  { x: 12, z: 95, w: 5.2, d: 4.2, eave: 2.6, rise: 1.4, chimney: false },
  { x: -18, z: 84.6, w: 4.2, d: 3.8, eave: 2.3, rise: 1.2, chimney: false },
  { x: -9, z: 99.6, w: 4.4, d: 3.6, eave: 2.3, rise: 1.25, chimney: false },
  { x: -37, z: 86, w: 5, d: 4, eave: 2.5, rise: 1.45, chimney: false },
];
export const HUB_PATHS = [
  [-18, 95, -14, 95], [-14, 95, -12.5, 89.5], [-12.5, 89.5, -8, 88], [-29.2, 87.5, -24, 88.3], [-24, 88.3, -18.7, 87.2], [-18.7, 87.2, -14, 87.8], [-14, 87.8, -12.5, 89.5],
  [-9.7, 102.3, -5.7, 102.3], [-5.7, 102.3, -5, 100.5], [-5, 100.5, 0, 94],
  [-37.7, 88.7, -34, 90], [-34, 90, -32, 88.5], [-32, 88.5, -29.2, 87.5], [-8, 88, -4, 88], [-4, 88, -3, 81], [-3, 81, 0, 80],
  [12, 98, 8, 99], [8, 99, 0, 94], [0, 80, 9, 88], [9, 88, 25, 88],
  [25, 88, 40, 68], [40, 68, 57, 40], [0, 80, -3, 45], [-3, 45, 0, 12],
] as const;

export function hubPathDistance(x: number, z: number): number {
  let d = Math.max(0, Math.hypot(x + 8, z - 85) - 1.5);
  for (const [ax, az, bx, bz] of HUB_PATHS) {
    const dx = bx - ax, dz = bz - az;
    const t = THREE.MathUtils.clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1);
    d = Math.min(d, Math.hypot(x - ax - t * dx, z - az - t * dz) * (Math.min(az, bz) < 72 ? 1.8 : 1));
  }
  return d;
}

/** Exclude random vegetation/rocks from doorsteps, the well and new paths. */
export function hubClearance(x: number, z: number): boolean {
  return Math.hypot(x + 5, z - 92) < 1.7 || Math.hypot(x + 23.6, z - 85.2) < 1.2 || Math.hypot(x + 22.4, z - 85.1) < 1 || HUB_FESTOON_POSTS.some(([px, pz]) => Math.hypot(x - px, z - pz) < .9) || Math.hypot(x + 10, z - 91) < 2 || Math.hypot(x + 3, z - 78) < .7 || Math.hypot(x + 10, z - 67) < .7 || Math.hypot(x - 25, z - 88) < .7 || hubPathDistance(x, z) < 2.3 || Math.hypot(x + 8, z - 85) < 3.4 ||
    HUB_HOUSES.some(h => Math.abs(x - h.x) < h.w / 2 + 1.2 && Math.abs(z - h.z) < h.d / 2 + 1.2);
}

type LampBuckets = { wood: Bucket; roof: Bucket; lamp: Bucket; dark: Bucket };
type DecorMaterials = Record<keyof LampBuckets, THREE.MeshStandardMaterial>;
type HubBuckets = { stone: Bucket; wood: Bucket; plaster: Bucket; roof: Bucket; lamp: Bucket; dark: Bucket };

export function createLanternhollow(
  parent: THREE.Group, col: CollisionWorld, ground: (x: number, z: number) => number,
  b: HubBuckets, labelMaterials: THREE.MeshStandardMaterial[], decorMaterials: DecorMaterials,
) {
  const windowAmber = new THREE.Color(0xe9a860);
  const plaster = new THREE.Color(0xc0ac86), roof = new THREE.Color(0x80513b), dark = new THREE.Color(0x30261e);
  const rounded = (bucket: Bucket, x: number, y: number, z: number, w: number, h: number, d: number, tint: THREE.Color, radius = .06) => {
    const g = new RoundedBoxGeometry(w, h, d, 2, Math.min(radius, w / 4, h / 4, d / 4));
    bucket.add(g, trs(x, y, z), tint); g.dispose();
  };
  const box = (bucket: Bucket, x: number, y: number, z: number, w: number, h: number, d: number, tint: THREE.Color) => rounded(bucket, x, y, z, w, h, d, tint);
  const beam = (a: THREE.Vector3, c: THREE.Vector3, r: number, wood = b.wood) => {
    const delta = c.clone().sub(a), g = new THREE.CylinderGeometry(r, r * 1.1, delta.length(), 8);
    const m = new THREE.Matrix4().compose(a.clone().add(c).multiplyScalar(.5), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()), new THREE.Vector3(1, 1, 1));
    wood.add(g, m, PAL.wood); g.dispose();
  };
  const lamp = (x: number, y: number, z: number, scale = 1, hangerTop = .65, target: LampBuckets = b) => {
    beam(new THREE.Vector3(x, y + .3 * scale, z), new THREE.Vector3(x, y + hangerTop * scale, z), .025 * scale, target.wood);
    box(target.dark, x, y, z, .36 * scale, .52 * scale, .32 * scale, dark);
    for (const side of [-1, 1]) {
      box(target.lamp, x, y, z + side * .17 * scale, .23 * scale, .32 * scale, .025 * scale, PAL.gold);
      box(target.lamp, x + side * .19 * scale, y, z, .025 * scale, .32 * scale, .18 * scale, PAL.gold);
    }
    box(target.roof, x, y + .3 * scale, z, .48 * scale, .1 * scale, .44 * scale, roof);
  };

  for (const [index, h] of HUB_HOUSES.entries()) {
    // The sunk footing absorbs gentle terrain variation without raising a floating deck.
    const y = ground(h.x, h.z);
    box(b.stone, h.x, y + .12, h.z, h.w + .2, .8, h.d + .2, PAL.stoneDark);
    box(b.plaster, h.x, y + h.eave / 2, h.z, h.w, h.eave, h.d, plaster.clone().multiplyScalar(index === 1 ? .92 : 1));
    col.add(boxCollider({ x: h.x, z: h.z, w: h.w + .2, d: h.d + .2, top: y + h.eave, bottom: y - .8, tag: 'hub-cottage' }));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      box(b.wood, h.x + sx * (h.w / 2 - .08), y + h.eave / 2, h.z + sz * h.d / 2, .14, h.eave, .18, PAL.wood);
    }
    box(b.wood, h.x, y + .65, h.z + h.d / 2 + .025, h.w, .14, .12, PAL.wood);
    box(b.wood, h.x, y + h.eave - .12, h.z + h.d / 2 + .025, h.w, .16, .15, PAL.wood);
    // Inset door/shutters sit on solid walls; this slice does not imply enterable interiors.
    box(b.dark, h.x - .7, y + .83, h.z + h.d / 2 + .07, 1.05, 1.65, .08, dark);
    box(b.wood, h.x - .7, y + .78, h.z + h.d / 2 + .12, .91, 1.5, .08, PAL.wood.clone().multiplyScalar(.8));
    for (const dx of [-.28, 0, .28]) box(b.wood, h.x - .7 + dx, y + .78, h.z + h.d / 2 + .17, .025, 1.4, .035, PAL.bark);
    box(b.dark, h.x + 1.15, y + 1.45, h.z + h.d / 2 + .07, .94, .84, .08, dark);
    box(b.lamp, h.x + 1.15, y + 1.45, h.z + h.d / 2 + .12, .72, .64, .025, windowAmber);
    box(b.wood, h.x + 1.15, y + 1.45, h.z + h.d / 2 + .15, .075, .72, .07, PAL.wood);
    box(b.wood, h.x + 1.15, y + 1.45, h.z + h.d / 2 + .15, .8, .075, .07, PAL.wood);
    for (const dx of [-.58, .58]) box(b.wood, h.x + 1.15 + dx, y + 1.45, h.z + h.d / 2 + .12, .25, .85, .1, PAL.wood);
    lamp(h.x - 1.65, y + 1.9, h.z + h.d / 2 + .3);
    beam(new THREE.Vector3(h.x - 1.65, y + 2.55, h.z + h.d / 2), new THREE.Vector3(h.x - 1.65, y + 2.55, h.z + h.d / 2 + .3), .04);

    // End walls face the arrival/well lenses: a quiet timber frame and inset
    // window give these broad plaster surfaces a domestic scale at chase distance.
    for (const sx of [-1, 1]) {
      const side = h.x + sx * (h.w / 2 + .035);
      for (const yy of [.65, h.eave - .12])
        box(b.wood, side, y + yy, h.z, .11, .12, h.d, PAL.wood);
      box(b.wood, side, y + h.eave / 2, h.z - .65, .12, h.eave, .13, PAL.wood);
      box(b.dark, side + sx * .035, y + 1.5, h.z + .55, .08, .96, .85, dark);
      box(b.lamp, side + sx * .08, y + 1.5, h.z + .55, .025, .76, .65, windowAmber);
      box(b.wood, side + sx * .105, y + 1.5, h.z + .55, .06, .82, .065, PAL.wood);
      box(b.wood, side + sx * .105, y + 1.5, h.z + .55, .06, .065, .72, PAL.wood);
      box(b.wood, side + sx * .09, y + .98, h.z + .55, .19, .1, 1.02, PAL.wood);
    }

    // Structural braces break the broad end-wall plaster into credible timber bays.
    for (const sx of [-1, 1]) {
      const xx = h.x + sx * (h.w / 2 + .035);
      for (const zz of [-1, 1]) beam(
        new THREE.Vector3(xx, y + h.eave - .2, h.z + zz * (h.d / 2 - .2)),
        new THREE.Vector3(xx, y + h.eave - .8, h.z + zz * (h.d / 2 - .85)), .045);
    }
    // Visible, grounded winter stores: safely behind the doorstep paths.
    const pileX = h.x + h.w / 2 + .35, pileZ = h.z - h.d / 2 - .7;
    const pileY = ground(pileX, pileZ) - .04;
    for (let row = 0; row < 2; row++) for (let log = 0; log < 3 - row; log++) {
      const xx = pileX + (log - 1 + row * .5) * .25;
      beam(new THREE.Vector3(xx, pileY + .14 + row * .23, pileZ - .35),
        new THREE.Vector3(xx, pileY + .14 + row * .23, pileZ + .35), .13);
    }
    col.add(boxCollider({ x: pileX, z: pileZ, w: .8, d: .72, top: pileY + .52, bottom: pileY - .15, tag: 'hub-woodpile' }));

    // A gently rounded pitched roof: one profile feeds mesh, gables and collision.
    const halfD = h.d / 2 + .46, halfW = h.w / 2 + .45, steps = 12;
    const height = (z: number) => {
      const t = Math.abs(z) / halfD, ridgeRound = .12;
      const rise = 1 - (Math.hypot(t, ridgeRound) - ridgeRound) / (Math.hypot(1, ridgeRound) - ridgeRound);
      return y + h.eave + h.rise * rise;
    };
    for (let k = 0; k < steps; k++) {
      const z0 = -halfD + k / steps * halfD * 2, z1 = -halfD + (k + 1) / steps * halfD * 2;
      const y0 = height(z0), y1 = height(z1);
      const profile = new THREE.Shape();
      profile.moveTo(z0, y0); profile.lineTo(z1, y1); profile.lineTo(z1, y1 - .25); profile.lineTo(z0, y0 - .25); profile.closePath();
      const g = new THREE.ExtrudeGeometry(profile, { depth: halfW * 2, bevelEnabled: false, steps: 1 });
      // profile x -> world z, extrusion -> world x; yaw -pi/2 gives z=profile x.
      b.roof.add(g, trs(h.x + halfW, 0, h.z, -Math.PI / 2), roof.clone().multiplyScalar(.95 + .05 * Math.sin(k * 2.3)));
      g.dispose();
      col.add(boxCollider({ x: h.x, z: h.z + (z0 + z1) / 2, w: halfW * 2, d: z1 - z0, top: y0, top1: y1, bottom: y + h.eave - .18, tag: 'hub-roof' }));
      const edgeDrop = .11 * Math.hypot(1, (y1 - y0) / (z1 - z0));
      for (const sx of [-1, 1]) beam(new THREE.Vector3(h.x + sx * halfW, y0 - edgeDrop, h.z + z0), new THREE.Vector3(h.x + sx * halfW, y1 - edgeDrop, h.z + z1), .10);
    }
    // Broad, low-contrast course lips break the smooth roof shell without a
    // noisy tile grid. All trim stays within 3 cm of the authored roof surface.
    for (let k = 2; k < steps; k += 2) {
      const zz = -halfD + k / steps * halfD * 2;
      const lip = new THREE.CylinderGeometry(.025, .025, halfW * 2 - .08, 6);
      const transform = new THREE.Matrix4().compose(
        new THREE.Vector3(h.x, height(zz), h.z + zz),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2),
        new THREE.Vector3(1, 1, 1),
      );
      b.roof.add(lip, transform, roof.clone().multiplyScalar(.86)); lip.dispose();
    }
    // Close the narrow gap between the wall plate and bowed roof at front/back.
    const plateHeight = height(h.d / 2) - (y + h.eave);
    for (const sz of [-1, 1]) box(b.plaster, h.x, y + h.eave + plateHeight / 2, h.z + sz * (h.d / 2 - .06), h.w, plateHeight + .03, .16, plaster);
    // Gable ends close the space beneath the roof, using the exact same arc.
    for (const sx of [-1, 1]) {
      const shape = new THREE.Shape(); shape.moveTo(-halfD + .46, y + h.eave);
      for (let k = 0; k <= steps; k++) { const zz = -h.d / 2 + k / steps * h.d; shape.lineTo(zz, height(zz) - .12); }
      shape.lineTo(h.d / 2, y + h.eave); shape.closePath();
      const g = new THREE.ExtrudeGeometry(shape, { depth: .12, bevelEnabled: false });
      b.plaster.add(g, trs(h.x + sx * h.w / 2 + (sx < 0 ? .12 : 0), 0, h.z, -Math.PI / 2), plaster); g.dispose();
    }
    if (h.chimney) {
      box(b.stone, h.x - 1.6, y + 3.35, h.z - .4, .75, 2.1, .75, PAL.stoneDark);
      box(b.stone, h.x - 1.6, y + 4.45, h.z - .4, 1, .2, 1, PAL.stone);
      col.add(boxCollider({ x: h.x - 1.6, z: h.z - .4, w: 1, d: 1, top: y + 4.55, bottom: y + 2.3, tag: 'hub-chimney' }));
    }
  }

  // Low market stores occupy the gap between the western end walls.
  {
    const x = -23.6, z = 85.2, y = ground(x, z);
    box(b.wood, x, y + .32, z, .85, .64, .7, PAL.wood);
    for (const side of [-1, 1]) {
      box(b.wood, x, y + .11, z + side * .365, .9, .12, .065, PAL.bark);
      box(b.wood, x, y + .54, z + side * .365, .9, .12, .065, PAL.bark);
      beam(new THREE.Vector3(x - .36, y + .16, z + side * .37), new THREE.Vector3(x + .36, y + .49, z + side * .37), .045);
    }
    col.add(boxCollider({ x, z, w: .95, d: .8, top: y + .66, bottom: y - .15, tag: 'hub-market' }));
    const bx = -22.4, bz = 85.1, by = ground(bx, bz), r = .38;
    const shell = new THREE.CylinderGeometry(r, r * .82, .56, 12);
    b.wood.add(shell, trs(bx, by + .28, bz), PAL.wood.clone().multiplyScalar(.9)); shell.dispose();
    for (const yy of [.10, .49]) {
      const band = new THREE.TorusGeometry(yy < .2 ? r * .86 : r * .98, .025, 4, 12);
      const matrix = new THREE.Matrix4().makeRotationX(Math.PI / 2); matrix.setPosition(bx, by + yy, bz);
      b.dark.add(band, matrix, dark); band.dispose();
    }
    col.add(cylCollider({ x: bx, z: bz, r: r + .03, top: by + .56, bottom: by - .15, tag: 'hub-market' }));
  }
  // A few half-buried flagstones identify the well lane without creating steps.
  for (let i = 0; i < 7; i++) {
    const t = (i + .5) / 7, x = THREE.MathUtils.lerp(-12.5, -8, t), z = THREE.MathUtils.lerp(89.5, 88, t);
    const g = new THREE.CylinderGeometry(.24 + (i % 3) * .035, .27, .1, 7);
    g.rotateY(i * 1.17); // rotate before sampling terrain, never after the fit
    const p = g.getAttribute('position');
    for (let v = 0; v < p.count; v++) p.setY(v, ground(x + p.getX(v), z + p.getZ(v)) + p.getY(v) - .025);
    g.computeVertexNormals(); b.stone.add(g, trs(x, 0, z), PAL.stone.clone().multiplyScalar(.8)); g.dispose();
  }

  // Domestic dry well: visible earth floor, low masonry ring, timber rope/pulley.
  const wx = -8, wz = 85, wy = ground(wx, wz);
  for (let k = 0; k < 12; k++) {
    const a = k / 12 * Math.PI * 2, x = wx + Math.sin(a) * 1.3, z = wz + Math.cos(a) * 1.3;
    const g = new RoundedBoxGeometry(.69, 1.05, .43, 2, .06);
    b.stone.add(g, trs(x, wy + .325, z, a), PAL.stone.clone().multiplyScalar(.88 + .1 * Math.sin(k * 4))); g.dispose();
    col.add(boxCollider({ x, z, w: .75, d: .54, yaw: a, top: wy + .93, bottom: wy - .5, tag: 'hub-well' }));
    const coping = new RoundedBoxGeometry(.75, .16, .54, 2, .04);
    b.stone.add(coping, trs(x, wy + .85, z, a), PAL.stone); coping.dispose();

  }
  // A worn stone maple relief identifies the Great Well without Seedwell glow.
  box(b.stone, wx, wy + .52, wz + 1.56, .7, .55, .1, PAL.stoneDark);
  const crest = new THREE.Shape();
  const leaf = [[0, .26], [.055, .13], [.17, .2], [.14, .07], [.27, .08],
    [.19, -.03], [.25, -.1], [.07, -.13], [.025, -.17], [.025, -.25],
    [-.025, -.25], [-.025, -.17], [-.07, -.13], [-.25, -.1], [-.19, -.03],
    [-.27, .08], [-.14, .07], [-.17, .2], [-.055, .13]];
  leaf.forEach(([x, y], i) => i ? crest.lineTo(x!, y!) : crest.moveTo(x!, y!)); crest.closePath();
  const relief = new THREE.ExtrudeGeometry(crest, { depth: .025, bevelEnabled: true, bevelSize: .012, bevelThickness: .008, bevelSegments: 1, steps: 1 });
  b.stone.add(relief, trs(wx, wy + .53, wz + 1.62), PAL.stone); relief.dispose();
  for (const sx of [-1, 1]) {
    const x = wx + sx * 1.9;
    beam(new THREE.Vector3(x, wy - .15, wz), new THREE.Vector3(x - sx * .15, wy + 3.15, wz), .13);
    col.add(cylCollider({ x, z: wz, r: .18, top: wy + 1.2, bottom: wy - .5, tag: 'hub-pulley-post' }));
  }
  const arch = new THREE.QuadraticBezierCurve3(new THREE.Vector3(wx - 1.75, wy + 3.15, wz), new THREE.Vector3(wx, wy + 4, wz), new THREE.Vector3(wx + 1.75, wy + 3.15, wz));
  const archGeo = new THREE.TubeGeometry(arch, 16, .14, 8, false); b.wood.add(archGeo, undefined, PAL.wood); archGeo.dispose();
  const pulley = new THREE.TorusGeometry(.24, .05, 8, 16); b.wood.add(pulley, trs(wx, wy + 3.25, wz), PAL.wood); pulley.dispose();
  beam(new THREE.Vector3(wx + .2, wy + 3.25, wz), new THREE.Vector3(wx + .2, wy + .35, wz), .018);
  lamp(wx + 1.35, wy + 2.1, wz + .22);
  beam(new THREE.Vector3(wx + 1.77, wy + 2.75, wz), new THREE.Vector3(wx + 1.35, wy + 2.75, wz + .22), .04);

  // Two real, short-range practical pools. No light discs or false restoration.
  const wellLight = new THREE.PointLight(0xffb665, 4, 5, 2);
  wellLight.position.set(wx + 1.15, wy + 1.8, wz + .85); parent.add(wellLight);
  const bramble = HUB_HOUSES[0]!;
  const porchLight = new THREE.PointLight(0xffb665, 3, 4.5, 2);
  porchLight.position.set(bramble.x - 1.65, ground(bramble.x, bramble.z) + 1.8, bramble.z + bramble.d / 2 + .85);
  parent.add(porchLight);

  // One quiet festoon gives the plaza a lantern-village silhouette.
  const festoonBuckets: LampBuckets = { wood: new Bucket(), roof: new Bucket(), lamp: new Bucket(), dark: new Bucket() };
  const endpoints = HUB_FESTOON_POSTS.map(([x, z]) => new THREE.Vector3(x, ground(x, z) + 4.2, z));
  const originalPosts = endpoints.map(p => p.clone());
  const middle = endpoints[0]!.clone().add(endpoints[1]!).multiplyScalar(.5); middle.y -= 1;
  const cord = new THREE.QuadraticBezierCurve3(endpoints[0]!, middle, endpoints[1]!);
  const pendantT = [.20, .37, .72, .84];
  const scale = .75, hangerTop = .48, bottomDrop = (hangerTop + .26) * scale;
  let lift = 0;
  for (const t of pendantT) {
    const point = cord.getPoint(t);
    lift = Math.max(lift, ground(point.x, point.z) + 3.05 - (point.y - bottomDrop));
  }
  // Curve endpoints retain these Vector3 references, so the lift also raises post tops.
  cord.v0.y += lift; cord.v1.y += lift; cord.v2.y += lift;
  for (const [i, [x, z]] of HUB_FESTOON_POSTS.entries()) {
    const gy = ground(x, z), top = endpoints[i]!.y;
    beam(new THREE.Vector3(x, gy - .15, z), new THREE.Vector3(x, top, z), .13);
    box(b.roof, x, top, z, .32, .08, .32, roof);
    col.add(cylCollider({ x, z, r: .18, top: top + .04, bottom: gy - .2, tag: 'hub-festoon-post' }));
  }
  const cordGeo = new THREE.TubeGeometry(cord, 40, .018, 6, false);
  festoonBuckets.wood.add(cordGeo, undefined, PAL.bark); cordGeo.dispose();
  const cordSpecs = [{ name: 'plaza', curve: cord, stations: pendantT,
    supports: ['plaza-west-post', 'plaza-east-post'] }];
  const roofHook = (houseIndex: number, side: number) => {
    const house = HUB_HOUSES[houseIndex]!;
    const y = ground(house.x, house.z) + house.eave + house.rise;
    const x = house.x + side * (house.w / 2 + .45);
    // Ridge extension overlaps the gable framing; upright overlaps its joint.
    beam(new THREE.Vector3(x - side * .6, y - .08, house.z),
      new THREE.Vector3(x, y - .08, house.z), .065, festoonBuckets.wood);
    const tip = new THREE.Vector3(x, y + .45, house.z);
    beam(new THREE.Vector3(x, y - .16, house.z), tip, .055, festoonBuckets.wood);
    return tip;
  };
  const addRoofCord = (name: string, start: THREE.Vector3, end: THREE.Vector3, supports: string[]) => {
    const control = start.clone().add(end).multiplyScalar(.5); control.y -= .35;
    const curve = new THREE.QuadraticBezierCurve3(start, control, end);
    const geometry = new THREE.TubeGeometry(curve, 24, .018, 6, false);
    festoonBuckets.wood.add(geometry, undefined, PAL.bark); geometry.dispose();
    cordSpecs.push({ name, curve, stations: [.2, .4, .6, .8], supports });
  };
  addRoofCord('bramble', roofHook(0, 1), endpoints[0]!.clone(), ['bramble-east-ridge', 'plaza-west-post']);
  addRoofCord('market', roofHook(1, 1), roofHook(3, -1), ['archive-east-ridge', 'pond-cottage-west-ridge']);
  const cords = cordSpecs.map(spec => {
    const pendants = spec.stations.map(t => {
      const point = spec.curve.getPoint(t);
      lamp(point.x, point.y - hangerTop * scale, point.z, scale, hangerTop, festoonBuckets);
      // Check the whole lamp footprint, including the wider cap, against terrain.
      let highestGround = -Infinity;
      for (const dx of [-.18, 0, .18]) for (const dz of [-.165, 0, .165])
        highestGround = Math.max(highestGround, ground(point.x + dx, point.z + dz));
      return { point, bottom: point.y - bottomDrop, ground: highestGround };
    });
    let cordClearance = Infinity;
    for (let i = 0; i <= 100; i++) {
      const p = spec.curve.getPoint(i / 100);
      cordClearance = Math.min(cordClearance, p.y - .018 - ground(p.x, p.z));
    }
    return { ...spec, pendants, cordClearance };
  });
  const pendants = cords.flatMap(c => c.pendants);
  for (const key of ['wood', 'roof', 'lamp', 'dark'] as const) {
    const mesh = festoonBuckets[key].toMesh(decorMaterials[key], { cast: false });
    if (mesh) { mesh.name = `hub-festoon-${key}`; mesh.userData.cameraDecoration = true; parent.add(mesh); }
  }
  parent.userData.hubFestoon = { posts: endpoints.map(p => p.toArray()), originalPosts: originalPosts.map(p => p.toArray()), lift,
    cords: cords.map(c => ({ name: c.name, supports: c.supports,
      endpoints: [c.curve.v0.toArray(), c.curve.v2.toArray()], control: c.curve.v1.toArray(),
      cordClearance: c.cordClearance,
      pendants: c.pendants.map(p => ({ pos: p.point.toArray(), bottom: p.bottom, ground: p.ground })) })),
    pendants: pendants.map(p => ({ pos: p.point.toArray(), bottom: p.bottom, ground: p.ground })) };
  const bounce = cord.getPoint(.62);
  const plazaLight = new THREE.PointLight(0xffb665, 3, 6, 2);
  plazaLight.position.set(bounce.x, ground(bounce.x, bounce.z) + 2.5, bounce.z); parent.add(plazaLight);

  // A communal cooking pot, distinct from the realm's tall traversal braziers.
  const hx = -5, hz = 92, hy = ground(hx, hz);
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2;
    const g = new RoundedBoxGeometry(.32, .25, .24, 2, .035);
    b.stone.add(g, trs(hx + Math.cos(a) * .5, hy + .125, hz + Math.sin(a) * .5, -a), PAL.stoneDark); g.dispose();
  }
  const ash = new THREE.CylinderGeometry(.4, .4, .06, 12);
  b.dark.add(ash, trs(hx, hy + .05, hz), dark); ash.dispose();
  const pot = new THREE.SphereGeometry(.3, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  b.dark.add(pot, trs(hx, hy + .68, hz), dark); pot.dispose();
  const lid = new THREE.CylinderGeometry(.31, .31, .04, 16);
  b.dark.add(lid, trs(hx, hy + .7, hz), dark); lid.dispose();
  box(b.dark, hx, hy + .745, hz, .13, .05, .07, dark);
  for (const side of [-1, 1]) {
    const handle = new THREE.TorusGeometry(.1, .025, 5, 12);
    const m = new THREE.Matrix4().makeRotationY(Math.PI / 2); m.setPosition(hx + side * .32, hy + .63, hz);
    b.dark.add(handle, m, dark); handle.dispose();
  }
  for (let i = 0; i < 3; i++) {
    const a = i / 3 * Math.PI * 2;
    const g = new THREE.CylinderGeometry(.025, .035, .58, 6);
    b.dark.add(g, trs(hx + Math.cos(a) * .25, hy + .36, hz + Math.sin(a) * .25), dark); g.dispose();
  }
  col.add(cylCollider({ x: hx, z: hz, r: .67, top: hy + .25, bottom: hy - .1, tag: 'hub-cooking-ring' }));
  col.add(cylCollider({ x: hx, z: hz, r: .45, top: hy + .77, bottom: hy + .25, tag: 'hub-cooking-pot' }));
  const fireLight = new THREE.PointLight(0xffa653, 4, 5, 2);
  fireLight.position.set(hx, hy + .7, hz); parent.add(fireLight);
  const flameGeometry = new THREE.SphereGeometry(1, 10, 8);
  const flamePos = flameGeometry.getAttribute('position');
  for (let v = 0; v < flamePos.count; v++) {
    const t = (flamePos.getY(v) + 1) * .5, taper = 1 - t * .75;
    flamePos.setXYZ(v, flamePos.getX(v) * taper, t, flamePos.getZ(v) * taper);
  }
  const flameMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color(2, .48, .06),
    transparent: true, opacity: .28, depthWrite: false, blending: THREE.AdditiveBlending });
  const flames = Array.from({ length: 3 }, (_, i) => {
    const mesh = new THREE.Mesh(flameGeometry, flameMaterial);
    mesh.name = `hub-cooking-flame-${i}`; mesh.userData.forgeSkipAO = true;
    mesh.userData.cameraDecoration = true; mesh.raycast = () => {};
    parent.add(mesh); return mesh;
  });

  const by = ground(-10, 91);
  box(b.wood, -10, by + .72, 91, 2.2, .16, .7, PAL.wood);
  for (const dx of [-.85, .85]) box(b.wood, -10 + dx, by + .275, 91, .16, .85, .58, PAL.wood);
  col.add(boxCollider({ x: -10, z: 91, w: 2.2, d: .7, top: by + .8, bottom: by, tag: 'hub-bench' }));

  // Soft domestic smoke, distinct from a reactor/updraft: no bright ribbon or glow.
  const smokeCanvas = document.createElement('canvas');
  smokeCanvas.width = smokeCanvas.height = 32;
  const smokeCtx = smokeCanvas.getContext('2d')!;
  const gradient = smokeCtx.createRadialGradient(16, 16, 0, 16, 16, 16);
  gradient.addColorStop(0, 'rgba(255,255,255,.7)');
  gradient.addColorStop(.45, 'rgba(255,255,255,.3)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  smokeCtx.fillStyle = gradient; smokeCtx.fillRect(0, 0, 32, 32);
  const smokeTexture = new THREE.CanvasTexture(smokeCanvas);
  const chimney = HUB_HOUSES.find(h => h.chimney)!;
  const chimneyY = ground(chimney.x, chimney.z) + 4.6;
  const smoke = Array.from({ length: 8 }, () => {
    const mat = new THREE.SpriteMaterial({ map: smokeTexture, color: 0xa99b86, transparent: true, opacity: 0, depthWrite: false });
    const puff = new THREE.Sprite(mat);
    // Decorative smoke must not enter world/photography collision probes. Sprite
    // raycasts require a camera, while the photo-blocker ray intentionally has none.
    puff.raycast = () => {};
    parent.add(puff); return puff;
  });

  // Three modest hand-lettered fingerposts; letters are generated locally, never downloaded.
  const postSightGeometry = new THREE.CylinderGeometry(.09, .099, 1.59, 8);
  const postSightMaterial = new THREE.MeshBasicMaterial({ visible: false });
  for (const [name, x, z, tx, tz] of [
    ['WINDMILL RISE', -10, 67, -34, 56], ['REEDMARSH', 25, 88, 57, 40], ['AMBERWOOD', -3, 78, 0, 12],
  ] as const) {
    const y = ground(x, z), yaw = Math.atan2(-(tz - z), tx - x);
    beam(new THREE.Vector3(x, y - .15, z), new THREE.Vector3(x, y + 1.44, z), .09);
    // The rendered post is batched with house timber. Keep its sight query
    // precise without drawing a second post or introducing a gameplay collider.
    const postSight = new THREE.Mesh(postSightGeometry, postSightMaterial);
    postSight.name = 'hub-sign-post-sight';
    postSight.position.set(x, y + .645, z);
    postSight.userData.isOccluder = true;
    parent.add(postSight);
    const board = new THREE.BoxGeometry(2.3, .42, .12);
    b.wood.add(board, trs(x, y + 1.65, z, yaw), PAL.wood); board.dispose();
    for (const back of [false, true]) {
      const faceYaw = yaw + (back ? Math.PI : 0);
      const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 96;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#6a4a32'; ctx.fillRect(0, 0, 512, 96);
      ctx.fillStyle = '#ead7b3'; ctx.font = 'bold 42px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(back ? '←  ' + name : name + '  →', 256, 49);
      const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
      const mat = new THREE.MeshStandardMaterial({ name: 'hub-sign', map: texture, roughness: .95 });
      labelMaterials.push(mat);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.2, .38), mat);
      sign.userData.isOccluder = true;
      sign.position.set(x + Math.sin(faceYaw) * .067, y + 1.65, z + Math.cos(faceYaw) * .067); sign.rotation.y = faceYaw;
      parent.add(sign);
    }
  }
  return {
    festoon: { posts: endpoints, pendants, cords },
    state: () => ({ well: wellLight.intensity, porch: porchLight.intensity, plaza: plazaLight.intensity, hearth: fireLight.intensity }),
    update(time: number, dusk: number) {
    const flicker = 1 + Math.sin(time * 1.3) * .04;
    wellLight.intensity = 4 * dusk * flicker * HUB_PRACTICAL.strength;
    porchLight.intensity = 3 * dusk * flicker * HUB_PRACTICAL.strength;
    plazaLight.intensity = 3 * dusk * flicker * HUB_PRACTICAL.strength;
    fireLight.intensity = 4 * dusk * flicker * HUB_PRACTICAL.strength;
    for (const [i, flame] of flames.entries()) {
      const phase = time * 2.2 + i * 2.1;
      flame.position.set(hx + Math.cos(i * 2.1) * .16 + Math.sin(phase) * .018, hy + .12, hz + Math.sin(i * 2.1) * .16);
      flame.scale.set(.14, .22 + Math.sin(phase * 1.3) * .025, .14);
      flame.rotation.z = Math.sin(phase) * .09;
    }
    for (const [i, puff] of smoke.entries()) {
      const age = (time / 4.5 + i / smoke.length) % 1;
      puff.position.set(chimney.x - 1.6 + age * 1.15 + Math.sin(age * 5 + i) * .08,
        chimneyY + age * 1.4, chimney.z - .4 + age * .2);
      const size = .25 + age * .65;
      puff.scale.set(size, size * 1.15, 1);
      puff.material.opacity = Math.sin(age * Math.PI) * .075;
      puff.material.rotation = i * 1.7 + age * .3;
    }
    },
  };
}
