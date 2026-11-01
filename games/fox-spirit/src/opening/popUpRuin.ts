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
  const undercroft = toon(0x464d50, { contour: 0.7, hatchWeight: 0.4 });
  const ink = toon(0x48382b);
  // Original ink illustration. Transparent paper print takes the same light/fog as the world.
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 768;
  const g = canvas.getContext('2d')!;
  g.translate(0, 768); g.rotate(-Math.PI / 2);
  g.strokeStyle = '#433d37'; g.fillStyle = '#595045'; g.lineCap = 'round'; g.lineJoin = 'round';
  const stroke = (points: number[][], width = 5, close = false, fill = false) => {
    g.beginPath(); points.forEach(([x,y], i) => i ? g.lineTo(x!,y!) : g.moveTo(x!,y!));
    if (close) g.closePath(); if (fill) g.fill(); g.lineWidth = width; g.stroke();
  };
  // Jagged ashlar piers and pointed voussoirs, with an empty doorway as the focal silhouette.
  stroke([[140,620],[154,335],[209,333],[211,287],[274,240],[306,217],[383,151],[462,220],[501,245],[561,290],[560,340],[615,344],[632,620]], 5);
  stroke([[237,611],[248,365],[283,318],[333,278],[384,230],[438,279],[490,320],[526,368],[535,612]], 4);
  stroke([[140,620],[237,611],[248,365],[211,333],[154,335]], 3, true);
  stroke([[535,612],[632,620],[615,344],[560,340],[526,368]], 3, true);
  g.fillStyle='#746957';
  for (let j=0;j<5;j++) for (const side of [-1,1]) {
    const x=side<0?154:542, y=381+j*44;
    stroke([[x,y],[x+66,y-4],[x+65,y+31],[x+2,y+34]],2,true);
    stroke([[x+12,y+8],[x+46,y+6]],1.5);
    for (let k=0;k<4;k++) stroke([[x+9+k*12,y+23],[x+15+k*12,y+14]],1);
  }
  for (let i=0;i<9;i++) {
    const t=i/8, x=211+t*350, y=338-Math.sin(t*Math.PI)*180;
    stroke([[x,y],[x+(384-x)*.15,y+39]],3);
  }
  // Ivy, fallen stones, grass and ink hatching make a picture, not an architectural diagram.
  for (let i=0;i<22;i++) {
    const y=340+i*12, x=181+Math.sin(i*.8)*15;
    stroke([[x,y],[x+17,y+18],[x+5,y+25]],2);
    stroke([[x+10,y+14],[x-7,y+5],[x-12,y+18]],1.5,true,true);
  }
  for (let i=0;i<18;i++) {
    const x=95+i*34,y=628+Math.sin(i*2.2)*13;
    stroke([[x-5,y+19],[x,y],[x+8,y+13]],2);
    if(i%3===0)stroke([[x,y+22],[x+23,y+16],[x+34,y+26],[x+9,y+31]],2,true);
  }
  stroke([[110,687],[312,678],[458,686],[653,674]],3);
  stroke([[468,112],[480,103],[491,113],[502,105],[513,113]],3);
  stroke([[540,157],[549,151],[557,159]],2);
  const print = new THREE.CanvasTexture(canvas); print.colorSpace = THREE.SRGBColorSpace;
  print.anisotropy = 4;
  const printMaterial = new THREE.MeshBasicMaterial({ map: print, transparent: true, depthWrite: false, fog: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
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
    // A folded parchment pull-tab, stitched across the crease.
    for (const side of [-1, 1]) {
      const tab = box(0.42, 0.035, 0.66, paper, 0.025);
      tab.position.set(0, 0.17, side * 0.29);
      tab.rotation.x = side * 0.32;
      g.add(tab);
    }
    for (const z of [-0.48, -0.24, 0, 0.24, 0.48]) {
      const stitch = box(0.2, 0.018, 0.025, ink, 0);
      stitch.position.set(0, 0.21 - Math.abs(z) * 0.14, z);
      g.add(stitch);
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
    const support = box(1.0, O.top - base - 0.24, 0.85, undercroft, 0.05);
    support.position.set(O.x - 0.7, (O.top + base - 0.24) / 2, O.z + dz);
    root.add(support);
  }
  // Narrow tapered remnants and a broken pointed arch; open sky stays between them.
  for (const side of [-1, 1]) {
    const pier = inked(hewn(new THREE.CylinderGeometry(0.24, 0.37, 1.85, 5, 3), ctx.rand, 0.045), stone, 0.014, true);
    pier.position.set(O.x - 1.4, O.top + 0.925, O.z + side * 1.5);
    pier.rotation.y = side * 0.2; root.add(pier);
    for (let i = 0; i < 3; i++) {
      const arch = box(0.33, 0.3, 0.5, stone, 0.035);
      arch.position.set(O.x - 1.4, O.top + 1.83 + i * 0.27, O.z + side * (1.4 - i * 0.19));
      arch.rotation.x = side * 0.54; root.add(arch);
    }
    const foot = box(0.7, 0.12, 0.8, undercroft, 0.03);
    foot.position.set(O.x - 1.4, O.top + 0.06, O.z + side * 1.5); root.add(foot);
  }

  R.leaves.forEach((p) => {
    // Approach edge is the hinge. The printed face is visible closed; the leaf opens away from the fox.
    const pivot = new THREE.Group();
    const ax = Math.cos(p.yaw), az = -Math.sin(p.yaw);
    pivot.position.set(p.x + ax * R.width / 2, p.top - 0.12, p.z + az * R.width / 2);
    pivot.rotation.set(0, p.yaw, -Math.PI / 2);
    root.add(pivot);
    ctx.occluders.push(pivot);
    // A torn illustrated page, rather than timber rails: its picture becomes the path.
    const outline = new THREE.Shape();
    const corners = [[-R.width, -R.depth / 2], [0, -R.depth / 2], [0, R.depth / 2], [-R.width, R.depth / 2]];
    corners.forEach(([x, z], edge) => {
      const [nx, nz] = corners[(edge + 1) % 4]!;
      for (let j = 0; j < 14; j++) {
        const t = j / 14, nick = j % 3 === 1 ? 0.065 : 0.018;
        const px = x! + (nx! - x!) * t + (edge === 1 ? -nick : edge === 3 ? nick : 0);
        const pz = z! + (nz! - z!) * t + (edge === 0 ? nick : edge === 2 ? -nick : 0);
        if (!edge && !j) outline.moveTo(px, -pz); else outline.lineTo(px, -pz);
      }
    });
    outline.closePath();
    const pageGeo = new THREE.ExtrudeGeometry(outline, { depth: 0.24, bevelEnabled: false, steps: 1 });
    pageGeo.rotateX(-Math.PI / 2); pageGeo.translate(0, -0.12, 0);
    pivot.add(inked(pageGeo, paper, 0.009, true));
    const illustration = new THREE.Mesh(new THREE.PlaneGeometry(R.width - 0.24, R.depth - 0.24), printMaterial);
    illustration.rotation.x = -Math.PI / 2;
    illustration.position.set(-R.width / 2, 0.126, 0);
    pivot.add(illustration);
    // Cloth tabs bridge the hinge; small dark stitches make the fold direction explicit.
    for (const z of [-1.18, 0, 1.18]) {
      const tab = box(0.26, 0.035, 0.25, paper, 0);
      tab.position.set(-0.055, 0.135, z); pivot.add(tab);
      for (const dz of [-0.075, 0.075]) {
        const stitch = box(0.15, 0.012, 0.018, ink, 0);
        stitch.position.set(-0.06, 0.159, z + dz); pivot.add(stitch);
      }
    }
    const crease = box(0.025, 0.015, R.depth - 0.15, ink, 0);
    crease.position.set(-0.2, 0.135, 0); pivot.add(crease);
    const marker = spindle(p.x + ax * (R.width / 2 + 0.06), p.top, p.z + az * (R.width / 2 + 0.06));
    marker.rotation.y = p.yaw;
    const gx = p.x + ax * (R.width / 2 + 0.2);
    const gz = p.z + az * (R.width / 2 + 0.2);
    const base = ctx.groundH(gx, gz);
    const guard: Collider = { kind: 'cap', x: gx, z: gz, r: 0.65, base, h: p.top + 0.18 - base };
    ctx.colliders.push(guard);
    const housing = new THREE.Group();
    // Three ashlar courses keep the safety stop readable as a ruined pier.
    const mortar = new THREE.Mesh(new THREE.CylinderGeometry(0.265, 0.635, guard.h - 0.018, 6), undercroft);
    housing.add(mortar);
    for (let course = 0; course < 3; course++) {
      const lo = course / 3, hi = (course + 1) / 3;
      const radius = (t: number) => THREE.MathUtils.lerp(0.65, 0.28, t);
      const block = inked(new THREE.CylinderGeometry(radius(hi), radius(lo), guard.h / 3 - 0.022, 6), stone, 0.012, true);
      block.position.y = guard.h * ((lo + hi) / 2 - 0.5);
      housing.add(block);
      // Stagger the fine joints on each exposed facet without adding a heavy grid.
      for (let face = 0; face < 6; face++) {
        const angle = (face + 0.5) * Math.PI / 3;
        const joint = new THREE.Mesh(new THREE.BoxGeometry(0.014, guard.h / 3 - 0.035, 0.012), undercroft);
        joint.position.set(Math.sin(angle) * radius((lo + hi) / 2) * 0.87, block.position.y, Math.cos(angle) * radius((lo + hi) / 2) * 0.87);
        joint.rotation.set(0, angle, 0);
        housing.add(joint);
      }
    }
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
        const slap = u > 0.5 ? Math.sin((u - 0.5) * Math.PI * 4) * (1 - u) * 0.23 : 0;
        const angle = Math.PI / 2 * (1 - eased) + slap;
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
