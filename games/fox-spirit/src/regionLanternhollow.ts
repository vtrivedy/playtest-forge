import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Bucket, PAL, trs } from './russetKit';
import { boxCollider, cylCollider, type CollisionWorld } from './collision';

/** Domestic scale, kept outside the existing arrival/hearth route. Original geometry. */
export const HUB_HOUSES = [
  { x: -24, z: 89, w: 5.2, d: 4.2, eave: 2.6, rise: 1.4, chimney: true },
  { x: -34, z: 84, w: 5.6, d: 4.6, eave: 2.8, rise: 1.6, chimney: false },
  { x: 17, z: 93, w: 5.2, d: 4.2, eave: 2.6, rise: 1.4, chimney: false },
];
export const HUB_PATHS = [
  [-24, 92, -20, 92], [-20, 92, -8, 88], [-34, 87, -28, 93], [-28, 93, -24, 92], [-8, 88, -4, 88], [-4, 88, -3, 81], [-3, 81, 0, 80],
  [17, 96, 8, 98], [8, 98, 0, 94], [0, 80, 9, 88], [9, 88, 25, 88],
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
  return Math.hypot(x + 10, z - 91) < 2 || Math.hypot(x + 3, z - 78) < .7 || Math.hypot(x + 10, z - 67) < .7 || Math.hypot(x - 25, z - 88) < .7 || hubPathDistance(x, z) < 2.3 || Math.hypot(x + 8, z - 85) < 3.4 ||
    HUB_HOUSES.some(h => Math.abs(x - h.x) < h.w / 2 + 1.2 && Math.abs(z - h.z) < h.d / 2 + 1.2);
}

type HubBuckets = { stone: Bucket; wood: Bucket; plaster: Bucket; roof: Bucket; lamp: Bucket; dark: Bucket };

export function createLanternhollow(
  parent: THREE.Group, col: CollisionWorld, ground: (x: number, z: number) => number,
  b: HubBuckets, labelMaterials: THREE.MeshStandardMaterial[],
) {
  const windowAmber = new THREE.Color(0xe9a860);
  const plaster = new THREE.Color(0xc0ac86), roof = new THREE.Color(0x80513b), dark = new THREE.Color(0x30261e);
  const rounded = (bucket: Bucket, x: number, y: number, z: number, w: number, h: number, d: number, tint: THREE.Color, radius = .06) => {
    const g = new RoundedBoxGeometry(w, h, d, 2, Math.min(radius, w / 4, h / 4, d / 4));
    bucket.add(g, trs(x, y, z), tint); g.dispose();
  };
  const box = (bucket: Bucket, x: number, y: number, z: number, w: number, h: number, d: number, tint: THREE.Color) => rounded(bucket, x, y, z, w, h, d, tint);
  const beam = (a: THREE.Vector3, c: THREE.Vector3, r: number) => {
    const delta = c.clone().sub(a), g = new THREE.CylinderGeometry(r, r * 1.1, delta.length(), 8);
    const m = new THREE.Matrix4().compose(a.clone().add(c).multiplyScalar(.5), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()), new THREE.Vector3(1, 1, 1));
    b.wood.add(g, m, PAL.wood); g.dispose();
  };
  const lamp = (x: number, y: number, z: number) => {
    beam(new THREE.Vector3(x, y + .3, z), new THREE.Vector3(x, y + .65, z), .025);
    box(b.dark, x, y, z, .36, .52, .32, dark);
    box(b.lamp, x, y, z + .17, .23, .32, .025, PAL.gold);
    box(b.lamp, x + .19, y, z, .025, .32, .18, PAL.gold);
    box(b.roof, x, y + .3, z, .48, .1, .44, roof);
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

    // A shallow stack is tucked into the solid wall footprint, never in the lane.
    for (let row = 0; row < 2; row++) for (let log = 0; log < 3 - row; log++) {
      const zz = h.z - .7 + log * .22 + row * .11;
      beam(new THREE.Vector3(h.x + h.w / 2 - .45, y + .48 + row * .18, zz),
        new THREE.Vector3(h.x + h.w / 2 + .08, y + .48 + row * .18, zz), .1);
    }

    // Broad bowed roof, sampled once for BOTH mesh and collision (no floating roof collider).
    const halfD = h.d / 2 + .46, halfW = h.w / 2 + .45, steps = 12;
    const height = (z: number) => y + h.eave + h.rise * Math.cos(z / halfD * Math.PI / 2);
    for (let k = 0; k < steps; k++) {
      const z0 = -halfD + k / steps * halfD * 2, z1 = -halfD + (k + 1) / steps * halfD * 2;
      const y0 = height(z0), y1 = height(z1);
      const profile = new THREE.Shape();
      profile.moveTo(z0, y0); profile.lineTo(z1, y1); profile.lineTo(z1, y1 - .15); profile.lineTo(z0, y0 - .15); profile.closePath();
      const g = new THREE.ExtrudeGeometry(profile, { depth: halfW * 2, bevelEnabled: false, steps: 1 });
      // profile x -> world z, extrusion -> world x; yaw -pi/2 gives z=profile x.
      b.roof.add(g, trs(h.x + halfW, 0, h.z, -Math.PI / 2), roof.clone().multiplyScalar(.95 + .05 * Math.sin(k * 2.3)));
      g.dispose();
      col.add(boxCollider({ x: h.x, z: h.z + (z0 + z1) / 2, w: halfW * 2, d: z1 - z0, top: y0, top1: y1, bottom: y + h.eave - .18, tag: 'hub-roof' }));
      for (const sx of [-1, 1]) beam(new THREE.Vector3(h.x + sx * halfW, y0 - .04, h.z + z0), new THREE.Vector3(h.x + sx * halfW, y1 - .04, h.z + z1), .065);
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
      box(b.stone, h.x - 1.6, y + 3.8, h.z - .4, .75, 3.6, .75, PAL.stoneDark);
      box(b.stone, h.x - 1.6, y + 5.55, h.z - .4, 1, .2, 1, PAL.stone);
      col.add(boxCollider({ x: h.x - 1.6, z: h.z - .4, w: 1, d: 1, top: y + 5.65, bottom: y + 2, tag: 'hub-chimney' }));
    }
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

  const by = ground(-10, 91);
  box(b.wood, -10, by + .72, 91, 2.2, .16, .7, PAL.wood);
  for (const dx of [-.85, .85]) box(b.wood, -10 + dx, by + .275, 91, .16, .85, .58, PAL.wood);
  col.add(boxCollider({ x: -10, z: 91, w: 2.2, d: .7, top: by + .8, bottom: by, tag: 'hub-bench' }));

  // Three modest hand-lettered fingerposts; letters are generated locally, never downloaded.
  for (const [name, x, z, tx, tz] of [
    ['WINDMILL RISE', -10, 67, -34, 56], ['REEDMARSH', 25, 88, 57, 40], ['AMBERWOOD', -3, 78, 0, 12],
  ] as const) {
    const y = ground(x, z), yaw = Math.atan2(-(tz - z), tx - x);
    beam(new THREE.Vector3(x, y - .15, z), new THREE.Vector3(x, y + 1.9, z), .09);
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
      sign.position.set(x + Math.sin(faceYaw) * .067, y + 1.65, z + Math.cos(faceYaw) * .067); sign.rotation.y = faceYaw;
      parent.add(sign);
    }
  }
}
