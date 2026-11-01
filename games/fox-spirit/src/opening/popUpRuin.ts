/** Permanent paper-stone folds. Design: docs/design/swarm3/pop-up-ruin-DESIGN.md. */
import * as THREE from 'three';
import { hewn, inked, toon } from '../lookdevKit';
import type { Collider } from '../lookdevPlay';
import type { OpeningCtx } from './scene';
import { POP_UP_RUIN as R } from './layout';

export const RUIN_FEEL = { unfold: 0.55, hitRadius: 1.35 };
type Fold = {
  pivot: THREE.Group;
  spindle: THREE.Group;
  x: number; z: number; y: number;
  elapsed: number; phase: 'folded' | 'opening' | 'open';
  land: () => void;
  guard?: Collider;
  housing?: THREE.Object3D;
};

export function buildPopUpRuin(ctx: OpeningCtx): { state(): Record<string, unknown> } {
  const root = new THREE.Group();
  root.name = 'pop-up ruin';
  ctx.scene.add(root);

  const stone = toon(0x827263, { contour: 0.5, hatchWeight: 0.35 });
  const paper = toon(0xa99672, { contour: 0.4, hatchWeight: 0.15 });
  const brass = toon(0xb67a43, { contour: 0.5 });
  const ink = toon(0x48382b);
  const etched = new THREE.MeshBasicMaterial({ color: 0x574432, fog: true });
  const folds: Fold[] = [];
  let reached = false;
  let returns = 0;
  let misses = 0;
  let hadLanding = false;
  let lastDash = -1;

  const box = (w: number, h: number, d: number, mat: THREE.Material, rough = 0.015) =>
    inked(hewn(new THREE.BoxGeometry(w, h, d, 2, 1, 2), ctx.rand, rough), mat, 0.018, true);
  function spindle(x: number, y: number, z: number): THREE.Group {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const axle = inked(new THREE.CylinderGeometry(0.16, 0.16, 1.4, 8), brass, 0.018, true);
    axle.rotation.x = Math.PI / 2;
    axle.position.y = 0.18;
    g.add(axle);
    // A split brass leaf, held shut by the spindle; it spreads when the route is restored.
    for (const side of [-1, 1]) {
      const leaf = box(0.32, 0.045, 0.42, brass);
      leaf.position.set(0, 0.38, side * 0.2);
      leaf.rotation.x = side * 0.35;
      g.add(leaf);
    }
    g.scale.setScalar(0.55);
    root.add(g);
    return g;
  }

  // The final terrace is visible from the start, sitting above a broken ashlar fan.
  const O = R.overlook;
  const terrace = box(O.width, 0.24, O.depth, paper);
  terrace.position.set(O.x, O.top - 0.12, O.z);
  root.add(terrace);
  ctx.occluders.push(terrace);
  ctx.colliders.push({ kind: 'box', x: O.x, z: O.z, yaw: 0, hx: O.width / 2, hz: O.depth / 2, top: O.top });
  for (const dz of [-1.2, 0, 1.2]) {
    const base = ctx.groundH(O.x, O.z + dz);
    const support = box(1.0, O.top - base - 0.24, 0.85, stone, 0.05);
    support.position.set(O.x - 0.7, (O.top + base - 0.24) / 2, O.z + dz);
    root.add(support);
  }
  // Broken jambs frame the village view rather than boxing in the fox.
  for (const dz of [-1.5, 1.5]) {
    for (let i = 0; i < 3; i++) {
      const block = box(0.55, 0.5, 0.55, stone, 0.035);
      block.position.set(O.x - 1.4, O.top + 0.25 + i * 0.51, O.z + dz);
      block.rotation.y = dz * 0.03 + i * 0.04;
      root.add(block);
    }
  }

  for (const side of [-1, 1]) {
    const brokenArch = box(0.58, 0.45, 0.85, stone, 0.035);
    brokenArch.position.set(O.x - 1.4, O.top + 1.65, O.z + side * 1.2);
    brokenArch.rotation.x = side * 0.55;
    root.add(brokenArch);
  }

  R.leaves.forEach((p) => {
    // Approach edge is the hinge. The printed face is visible closed; the leaf opens away from the fox.
    const pivot = new THREE.Group();
    const ax = Math.cos(p.yaw), az = -Math.sin(p.yaw);
    pivot.position.set(p.x + ax * R.width / 2, p.top - 0.12, p.z + az * R.width / 2);
    pivot.rotation.set(0, p.yaw, -Math.PI / 2);
    root.add(pivot);
    ctx.occluders.push(pivot);
    const slab = box(R.width, 0.24, R.depth, paper);
    slab.position.x = -R.width / 2;
    pivot.add(slab);
    // Inset ribs keep the broad surface legible as a folded architectural leaf.
    for (const dz of [-1.45, 1.45]) {
      const rib = box(R.width - 0.1, 0.045, 0.12, ink);
      rib.position.set(-R.width / 2, 0.14, dz);
      pivot.add(rib);
    }
    for (const x of [0.22, R.width / 2, R.width - 0.22]) {
      const crease = box(0.045, 0.03, R.depth - 0.6, brass);
      crease.position.set(-x, 0.145, 0);
      pivot.add(crease);
    }
    // Engraved arch/vein: visible in pressed ink, quiet under the restored paper palette.
    const stroke = (points: number[][], radius = 0.018) => {
      const curve = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(-x!, 0.15, z!)));
      pivot.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 16, radius, 4, false), etched));
    };
    stroke([[0.45, -1.05], [1.6, -1.05], [2.8, 0], [1.6, 1.05], [0.45, 1.05]]);
    stroke([[0.55, 0], [1.65, 0], [2.8, 0]], 0.022);
    for (const side of [-1, 1]) stroke([[1.3, 0], [1.7, side * 0.43], [1.9, side * 0.75]], 0.013);
    const marker = spindle(p.x + ax * (R.width / 2 + 0.06), p.top, p.z + az * (R.width / 2 + 0.06));
    marker.rotation.y = p.yaw;
    const gx = p.x + ax * (R.width / 2 + 0.2);
    const gz = p.z + az * (R.width / 2 + 0.2);
    const base = ctx.groundH(gx, gz);
    const guard: Collider = { kind: 'cap', x: gx, z: gz, r: 0.65, base, h: p.top + 0.18 - base };
    ctx.colliders.push(guard);
    const housing = inked(new THREE.CylinderGeometry(0.28, 0.65, guard.h, 6), stone, 0.02, true);
    housing.position.set(gx, base + guard.h / 2, gz);
    root.add(housing);
    folds.push({
      pivot, spindle: marker, x: marker.position.x, y: p.top, z: marker.position.z,
      elapsed: 0, phase: 'folded', guard, housing,
      land: () => ctx.colliders.push({ kind: 'box', x: p.x, z: p.z, yaw: p.yaw, hx: R.width / 2, hz: R.depth / 2, top: p.top }),
    });
  });

  // Southern return: a paper fan becomes low steps only after an overlook dash.
  const returnPivot = new THREE.Group();
  returnPivot.position.set(O.x, O.top - 0.12, O.z + O.depth / 2);
  returnPivot.rotation.x = Math.PI / 2;
  root.add(returnPivot);
  const steps = 20;
  const length = R.returnEnd.z - returnPivot.position.z;
  const endY = ctx.groundH(R.returnEnd.x, R.returnEnd.z) + 0.08;
  for (let i = 0; i < steps; i++) {
    const z = (i + 0.5) * length / steps;
    const drop = (O.top - endY) * (i + 1) / steps;
    const tread = box(2.5, 0.14, length / steps + 0.025, paper);
    tread.position.set(0, -drop, z);
    returnPivot.add(tread);
  }
  const returnMarker = spindle(O.x, O.top, O.z + 0.9);
  folds.push({
    pivot: returnPivot, spindle: returnMarker, x: O.x, z: O.z + 0.9, y: O.top,
    elapsed: 0, phase: 'folded',
    land: () => {
      for (let i = 0; i < steps; i++) {
        ctx.colliders.push({ kind: 'box', x: O.x, z: returnPivot.position.z + (i + 0.5) * length / steps,
          yaw: 0, hx: 1.25, hz: length / steps / 2 + 0.015, top: O.top - (O.top - endY) * (i + 1) / steps - 0.05 });
      }
    },
  });

  if (new URLSearchParams(location.search).has('gui')) {
    void import('lil-gui').then(({ default: GUI }) => {
      const gui = new GUI({ title: 'pop-up ruin' });
      gui.add(RUIN_FEEL, 'unfold', 0.25, 1.2, 0.05);
      gui.add(RUIN_FEEL, 'hitRadius', 0.8, 1.6, 0.05);
    });
  }
  ctx.onUpdate((dt, t) => {
    if (!ctx.player) return;
    const s = ctx.player.state();
    const p = ctx.fox.root.position;
    const dash = Number(s.dashesUsed);
    const inside = (q: typeof R.leaves[number], margin = 0) => {
      const dx = p.x - q.x, dz = p.z - q.z;
      return Math.abs(dx * Math.cos(q.yaw) - dz * Math.sin(q.yaw)) < R.width / 2 + margin && Math.abs(dx * Math.sin(q.yaw) + dz * Math.cos(q.yaw)) < R.depth / 2 + margin;
    };
    const onLeaf = R.leaves.some(q => inside(q) && Math.abs(p.y - q.top) < 0.12 && s.grounded);
    if (onLeaf) hadLanding = true;
    if (hadLanding && s.grounded && !onLeaf && p.y < R.leaves[0].top - 0.12) { misses++; hadLanding = false; }
    if (s.grounded && Math.abs(p.x - O.x) < 1.5 && Math.abs(p.z - O.z) < 1.6 && Math.abs(p.y - O.top) < 0.12) { reached = true; hadLanding = false; }
    folds.forEach((f, i) => {
      const eligible = i === 0 || (i === 1 ? folds[0]!.phase === 'open' : reached);
      const within = Math.hypot(p.x - f.x, p.z - f.z) < RUIN_FEEL.hitRadius && Math.abs(p.y - f.y) < 1.1;
      // Only east-side approaches activate leaves: the slab's sweep stays clear of the fox.
      const clear = i === 2 ? p.z < O.z + O.depth / 2 - 0.3 : (p.x - R.leaves[i]!.x) * Math.cos(R.leaves[i]!.yaw) - (p.z - R.leaves[i]!.z) * Math.sin(R.leaves[i]!.yaw) > R.width / 2 + 0.32;
      if (f.phase === 'folded' && eligible && within && clear && s.dashing && dash !== lastDash) {
        f.phase = 'opening';
        lastDash = dash;
      }
      if (f.phase === 'opening') {
        f.elapsed += dt;
        const u = Math.min(1, f.elapsed / RUIN_FEEL.unfold);
        const eased = 1 - (1 - u) ** 3;
        const angle = Math.PI / 2 * (1 - eased) + Math.sin(u * Math.PI * 2) * 0.035 * Math.sin(u * Math.PI);
        if (i < 2) f.pivot.rotation.z = -angle;
        else f.pivot.rotation.x = angle;
        if (f.housing) f.housing.scale.y = 1 - eased * 0.85;
        const underLeaf = i < 2 && inside(R.leaves[i]!, 0.1) && p.y < R.leaves[i]!.top - 0.05;
        const alongReturn = THREE.MathUtils.clamp((p.z - returnPivot.position.z) / length, 0, 1);
        const returnTop = THREE.MathUtils.lerp(O.top, endY, alongReturn) - 0.05;
        const underReturn = i === 2 && Math.abs(p.x - O.x) < 1.35 && p.z > returnPivot.position.z - 0.1 && p.z < R.returnEnd.z + 0.1 && p.y < returnTop - 0.05;
        const under = underLeaf || underReturn;
        if (u >= 1 && !under) {
          if (f.guard) { const n = ctx.colliders.indexOf(f.guard); if (n >= 0) ctx.colliders.splice(n, 1); }
          if (f.housing) f.housing.visible = false;
          f.phase = 'open'; f.land();
          if (i === 2) {
            returns++;
            ctx.field.restore(new THREE.Vector3((R.leaves[0].x + R.overlook.x) / 2, O.top, (R.leaves[0].z + O.z) / 2), 7, 1.3, { edgeMax: 0.8 });
          }
        }
      }
      f.spindle.scale.setScalar(0.55 * (f.phase === 'folded' && eligible ? 1 + Math.sin(t * 3.2) * 0.06 : 1));
      f.spindle.rotation.x = f.phase === 'open' ? 0.25 : 0;
    });
  });
  return { state: () => ({ folds: folds.map(f => ({ phase: f.phase, progress: +Math.min(1, f.elapsed / RUIN_FEEL.unfold).toFixed(3) })), reached, returns, misses, tunables: { ...RUIN_FEEL } }) };
}
