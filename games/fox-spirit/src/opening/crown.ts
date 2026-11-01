/**
 * The Still Crown: the Summit's pressed maple on the horizon, the slice's north star (DESIGN v1 attractor
 * ladder: far Crown → mid arrested tree → near reactions). A flat ink-wash silhouette that fades into the
 * sky mist, one limb held stiffly up the way the Scribe pressed it. When a Keeping completes that limb
 * lets go — it settles into a relaxed arc and sheds a stream of warm leaves; one leaf drifts down by the fox.
 */
import * as THREE from 'three';
import { canopyPad, jitter, mapleLeafGeometry, plumeGeometry } from '../lookdevKit';
import type { OpeningCtx } from './scene';
import { CROWN } from './layout';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
/** silhouette tones, near → far value step; tinted toward the sky mist each frame */
const STONE = 0x8a776a;
const BARK = 0x5a4438;
const PRESSED: [number, number, number] = [0xb09878, 0x9c8468, 0x84705e];
const EMBER = 0xd8743a;
const SHED = 48;

function silhouette(color: number, vertexColors = false): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color, vertexColors, fog: false });
}

export function createCrown(ctx: OpeningCtx, mist: THREE.Color) {
  const { rand } = ctx;
  const root = new THREE.Group();
  root.name = 'still-crown';
  root.position.set(CROWN.x, CROWN.y, CROWN.z);
  root.rotation.y = CROWN.yaw;
  root.scale.setScalar(CROWN.scale);
  ctx.scene.add(root);
  const mats: Array<{ m: THREE.MeshBasicMaterial; base: THREE.Color; mistK: number }> = [];
  const mat = (color: number, mistK: number, vertexColors = false) => {
    const m = silhouette(vertexColors ? 0xffffff : color, vertexColors);
    mats.push({ m, base: m.color.clone(), mistK });
    return m;
  };

  // the Summit: a stack of weathered columns (same language as the shelf ridge) narrowing to a crag
  const stone = mat(STONE, 0.5);
  const COLS: Array<[number, number, number, number]> = [
    [0, 0, 7, 30], [-6, 3, 5.5, 22], [5.5, -2, 5, 25], [2, 5, 4, 34], [-3, -4, 4.2, 28], [9, 3, 4, 14], [-10, -1, 4.5, 12],
  ];
  for (const [x, z, r, h] of COLS) {
    const g = jitter(new THREE.CylinderGeometry(r * 0.55, r, h, 7, 4), 0.06 * r, rand, 0.4);
    g.translate(x, h / 2 - 2, z);
    root.add(new THREE.Mesh(g, stone));
  }
  const crag = 33;

  // the Crown tree: a gnarled trunk off the crag, a tiered canopy, and the one arrested limb
  const bark = mat(BARK, 0.38);
  const trunk = new THREE.CatmullRomCurve3([V(1, crag - 2, 2), V(2.5, crag + 6, 1), V(0.5, crag + 13, 2.5), V(1.5, crag + 18, 1.5)]);
  root.add(new THREE.Mesh(plumeGeometry(trunk, (t) => THREE.MathUtils.lerp(2.2, 0.8, t) + (1 - THREE.MathUtils.smoothstep(t, 0, 0.15)) * 1.6, 20, 9, 0), bark));
  const canopy = mat(0xffffff, 0.42, true);
  const PADS: Array<[number, number, number, number]> = [
    [1.5, crag + 21, 1.5, 7.5], [-5, crag + 17, 3, 5], [7.5, crag + 16.5, 0, 4.5], [2, crag + 15, -5, 4.2], [-1, crag + 14, 5.5, 4],
  ];
  for (const [x, y, z, r] of PADS) {
    const pad = new THREE.Mesh(canopyPad(rand, r, r * 0.7, PRESSED), canopy);
    pad.position.set(x, y, z);
    pad.rotation.y = rand() * 6.28;
    root.add(pad);
    // limbs feeding each lobe
    const from = trunk.getPointAt(0.45 + rand() * 0.3);
    root.add(new THREE.Mesh(plumeGeometry(new THREE.CatmullRomCurve3([from, from.clone().lerp(V(x, y - r * 0.4, z), 0.5).add(V(0, -1, 0)), V(x, y - r * 0.4, z)]), (t) => THREE.MathUtils.lerp(0.7, 0.25, t), 8, 6, 0), bark));
  }
  // the arrested limb pivots at its fork; pressed = rigid, reaching straight up out of the crown
  const limb = new THREE.Group();
  const fork = trunk.getPointAt(0.7);
  limb.position.copy(fork);
  root.add(limb);
  const limbCurve = new THREE.CatmullRomCurve3([V(0, 0, 0), V(-3.5, 4, 0.5), V(-8, 7.5, 0.5), V(-12.5, 9, 0)]);
  limb.add(new THREE.Mesh(plumeGeometry(limbCurve, (t) => THREE.MathUtils.lerp(0.9, 0.12, t), 14, 6, 0), bark));
  const limbPad = new THREE.Mesh(canopyPad(rand, 3.2, 2.2, PRESSED), canopy);
  const tip = limbCurve.getPointAt(0.92);
  limbPad.position.copy(tip);
  limb.add(limbPad);
  const POSE = { pressed: 0.62, released: -0.32 };
  limb.rotation.z = POSE.pressed;

  // shed leaves: crown-scale maple leaves that leave the limb pad and drift down the mountain face
  const leafGeo = mapleLeafGeometry(1).rotateX(Math.PI / 2);
  const leafMat = new THREE.MeshBasicMaterial({ color: EMBER, side: THREE.DoubleSide, transparent: true, fog: false });
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, SHED);
  leaves.frustumCulled = false;
  leaves.count = 0;
  root.add(leaves);
  const shed = Array.from({ length: SHED }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), spin: rand() * 6, age: -1, delay: 0, life: 9 + rand() * 6 }));

  // the hero leaf: one real-scale leaf that finds the fox, so the response is felt up close too
  const hero = new THREE.Mesh(mapleLeafGeometry(0.22).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: EMBER, side: THREE.DoubleSide, transparent: true }));
  hero.visible = false;
  ctx.scene.add(hero);
  const heroState = { age: -1, from: new THREE.Vector3() };

  let released = false;
  let release = 0;
  let leavesOut = 0;
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const s = new THREE.Vector3();

  function respond(): void {
    if (released) return;
    released = true;
    release = 0;
    shed.forEach((l, i) => {
      l.age = 0;
      l.delay = 0.6 + (i / SHED) * 5 + rand() * 0.8;
    });
    const f = ctx.fox.root.position;
    heroState.age = 0;
    heroState.from.set(f.x + 1.6, f.y + 5.5, f.z - 1.2);
  }

  ctx.onUpdate((dt, t) => {
    for (const { m, base, mistK } of mats) m.color.copy(base).lerp(mist, mistK);
    if (!released) {
      // pressed: the limb trembles very slightly, never sways
      limb.rotation.z = POSE.pressed + Math.sin(t * 7.3) * 0.002;
      return;
    }
    release += dt;
    // the limb gives: a slow ease past rest, a small rebound, then breathing in the wind it now feels
    const k = 1 - Math.exp(-release * 0.9);
    const rebound = Math.sin(release * 2.2) * Math.exp(-release * 0.7) * 0.08;
    limb.rotation.z = THREE.MathUtils.lerp(POSE.pressed, POSE.released, k) + rebound + Math.sin(t * 0.7) * 0.02 * k;
    limb.updateMatrixWorld(true);
    let n = 0;
    for (const l of shed) {
      if (l.age < 0) continue;
      l.age += dt;
      const a = l.age - l.delay;
      if (a < 0) continue;
      if (a < dt * 1.5) {
        l.p.copy(tip).add(V((rand() - 0.5) * 5, (rand() - 0.5) * 3, (rand() - 0.5) * 5)).applyMatrix4(limb.matrix);
        l.v.set(-1.5 - rand() * 2, -1.2 - rand(), (rand() - 0.5) * 2);
      }
      if (a > l.life) continue;
      l.p.addScaledVector(l.v, dt);
      l.p.x += Math.sin(a * 1.3 + l.spin) * dt * 2.2;
      e.set(a * 1.7 + l.spin, a * 0.9, Math.sin(a * 2 + l.spin) * 0.8);
      s.setScalar(1.6 * Math.min(1, a * 2) * (1 - THREE.MathUtils.smoothstep(a, l.life - 2, l.life)));
      leaves.setMatrixAt(n++, m4.compose(l.p, q.setFromEuler(e), s));
    }
    leaves.count = n;
    leaves.instanceMatrix.needsUpdate = true;
    leavesOut = Math.max(leavesOut, n);
    if (heroState.age >= 0) {
      heroState.age += dt;
      const a = heroState.age - 1.2;
      hero.visible = a > 0 && a < 9;
      if (hero.visible) {
        // a falling-leaf rock: side-to-side pendulum, settling to the ground near the fox
        const fall = Math.min(1, a / 8);
        const y = heroState.from.y - 5.3 * (1 - Math.pow(1 - fall, 1.6));
        hero.position.set(heroState.from.x + Math.sin(a * 1.6) * 0.9 - a * 0.15, Math.max(ctx.groundH(hero.position.x, hero.position.z) + 0.03, y), heroState.from.z + Math.cos(a * 0.8) * 0.3);
        hero.rotation.set(Math.sin(a * 1.6) * 0.7 * (1 - fall), a * 0.6, Math.cos(a * 1.6) * 0.4 * (1 - fall));
        (hero.material as THREE.MeshBasicMaterial).opacity = 1 - THREE.MathUtils.smoothstep(a, 7.5, 9);
      }
    }
  });

  return {
    respond,
    /** world point to frame the Crown from review shots */
    focus: () => root.localToWorld(V(0, crag + 12, 0)),
    state: () => ({ released, release: +release.toFixed(2), limb: +limb.rotation.z.toFixed(3), leaves: leavesOut, heroLeaf: hero.visible }),
  };
}
