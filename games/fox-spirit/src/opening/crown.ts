/**
 * The Still Crown: the Summit's pressed maple on the horizon, the slice's north star (DESIGN v1 attractor
 * ladder: far Crown → mid arrested tree → near reactions). A flat ink-wash silhouette that fades into the
 * sky mist, one limb held stiffly up the way the Scribe pressed it. When a Keeping completes that limb
 * lets go — it settles into a relaxed arc and sheds a stream of warm leaves; one leaf drifts down by the fox.
 */
import * as THREE from 'three';
import { canopyPad, inked, jitter, mapleLeafGeometry, plumeGeometry, rng } from '../lookdevKit';
import type { OpeningCtx } from './scene';
import { CROWN, VISTA } from './layout';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
/** silhouette tones, near → far value step; tinted toward the sky mist each frame */
const STONE = 0x8a776a;
const BARK = 0x5a4438;
const PRESSED: [number, number, number] = [0xb09878, 0x9c8468, 0x84705e];
const EMBER = 0xd8743a;
/** shed leaves glow a step hotter than the coat so the far response reads at chase distance */
const SHED_EMBER = 0xf2954a;
const SHED = 90;
/** the finale's leaf river: every lobe lets go */
const FALL = 360;

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

  // foothills down the vista gap: three paper layers, darker near → paler far, so the valley reads deep
  const HILLS: Array<[number, number, number, number, number]> = [
    // [along the fall line past the crag, across, half-width, height, mist]
    [34, -16, 22, 4, 0.18], [40, 17, 20, 3, 0.2], [70, -30, 30, 7, 0.35], [78, 26, 28, 6, 0.36], [120, 0, 46, 1, 0.55], [125, -52, 34, 18, 0.6], [128, 54, 36, 20, 0.6],
  ];
  for (const [a, c, w, h, k] of HILLS) {
    const hill = new THREE.Mesh(jitter(new THREE.IcosahedronGeometry(1, 2), 0.14, rand, 0.7), mat(0x7c6a5c, k));
    hill.position.set(VISTA.x + VISTA.dx * a + VISTA.dz * c, -14, VISTA.z + VISTA.dz * a - VISTA.dx * c);
    hill.scale.set(w, h + 14, w * 0.6);
    hill.rotation.y = Math.atan2(VISTA.dx, VISTA.dz);
    ctx.scene.add(hill);
  }

  // the Summit: a stack of weathered columns (same language as the shelf ridge) narrowing to a crag
  const stone = mat(STONE, 0.36);
  const COLS: Array<[number, number, number, number]> = [
    [0, 0, 9, 44], [-7, 3, 8, 34], [6.5, -2, 7.5, 38], [2, 6, 6, 47], [-3, -5, 6.5, 40], [12, 3, 7, 26], [-13, -1, 7.5, 22], [19, -3, 8, 14], [-21, 2, 8.5, 12], [0, -10, 9, 18], [3, 11, 8, 20],
  ];
  for (const [x, z, r, h] of COLS) {
    const g = jitter(new THREE.CylinderGeometry(r * 0.55, r, h, 7, 4), 0.06 * r, rand, 0.4);
    g.translate(x, h / 2 - 2, z);
    root.add(inked(g, stone, 0.03));
  }
  const crag = 44;

  // the Crown tree: a gnarled trunk off the crag, flat tiered lobes, bare limbs past the crown,
  // and the one arrested limb (local −x = screen-left from the shelf, so it swings in the picture plane)
  const bark = mat(BARK, 0.38);
  const trunk = new THREE.CatmullRomCurve3([V(1, crag - 2, 2), V(2.8, crag + 6, 1), V(0.2, crag + 12, 1.5), V(1.8, crag + 17, 1)]);
  root.add(inked(plumeGeometry(trunk, (t) => THREE.MathUtils.lerp(2.0, 0.7, t) + (1 - THREE.MathUtils.smoothstep(t, 0, 0.15)) * 1.6, 20, 9, 0), bark, 0.03, true));
  const canopy = mat(0xffffff, 0.42, true);
  const branch = (from: THREE.Vector3, to: THREE.Vector3, r0: number, r1: number) =>
    root.add(inked(plumeGeometry(new THREE.CatmullRomCurve3([from, from.clone().lerp(to, 0.5).add(V(0, -0.8, 0)), to]), (t) => THREE.MathUtils.lerp(r0, r1, t), 8, 6, 0), bark, 0.024, true));
  const PADS: Array<[number, number, number, number]> = [
    [2.5, crag + 20.5, 0.5, 4.6], [-1.5, crag + 19, 2, 3.4], [7.5, crag + 18.5, -1, 3.6], [10.5, crag + 14.5, 0.5, 3.2], [-3.5, crag + 14, 1, 3], [5, crag + 12, 2.5, 2.8], [6, crag + 22.5, 1, 2.4],
  ];
  const pads: THREE.Object3D[] = [];
  for (const [x, y, z, r] of PADS) {
    const pad = inked(canopyPad(rand, r, r * 0.42, PRESSED), canopy, 0.03, true);
    pads.push(pad);
    pad.position.set(x, y, z);
    pad.rotation.y = rand() * 6.28;
    root.add(pad);
    branch(trunk.getPointAt(0.45 + rand() * 0.3), V(x, y - r * 0.3, z), 0.7, 0.25);
  }
  // bare limbs reach past the lobes so the crown's outline breaks against the sky
  branch(trunk.getPointAt(0.85), V(12.5, crag + 23, -0.5), 0.5, 0.06);
  branch(trunk.getPointAt(0.95), V(5, crag + 27, 1), 0.4, 0.05);
  const limb = new THREE.Group();
  const fork = trunk.getPointAt(0.42);
  limb.position.copy(fork);
  root.add(limb);
  // a long bare reach with one held cluster of leaves at its hand: the leaves the Scribe would not let fall
  const limbCurve = new THREE.CatmullRomCurve3([V(0, 0, 0), V(-5, 2.4, 0.4), V(-11, 3.6, 0.4), V(-17, 3, 0)]);
  limb.add(inked(plumeGeometry(limbCurve, (t) => THREE.MathUtils.lerp(0.9, 0.1, t), 16, 6, 0), bark, 0.024, true));
  const held = mat(0xffffff, 0.3, true);
  const limbPad = inked(canopyPad(rand, 2.2, 1.1, [0xc29068, 0xa87452, 0x8a5e46]), held, 0.03, true);
  const tip = limbCurve.getPointAt(0.9);
  limbPad.position.copy(tip);
  limb.add(limbPad);
  // pressed: held stiffly up and out like a hand raised against the wind; released: hangs and breathes
  const POSE = { pressed: -0.62, released: 0.42 };
  limb.rotation.z = POSE.pressed;

  // shed leaves: crown-scale maple leaves that leave the limb pad and drift down the mountain face
  const leafGeo = mapleLeafGeometry(1).rotateX(Math.PI / 2);
  const leafMat = new THREE.MeshBasicMaterial({ color: SHED_EMBER, side: THREE.DoubleSide, transparent: true, fog: false });
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, SHED);
  leaves.frustumCulled = false;
  leaves.count = 0;
  root.add(leaves);
  const shed = Array.from({ length: SHED }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), spin: rand() * 6, age: -1, delay: 0, life: 9 + rand() * 6 }));

  // a warm wash blooms behind the Crown as it lets go: the far response must read at a glance
  const washTex = (() => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const g = cv.getContext('2d')!;
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,190,120,1)');
    grad.addColorStop(0.45, 'rgba(240,150,80,0.35)');
    grad.addColorStop(1, 'rgba(240,150,80,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(cv);
  })();
  const wash = new THREE.Sprite(new THREE.SpriteMaterial({ map: washTex, color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  wash.position.set(0, crag + 16, -6);
  wash.scale.setScalar(70);
  root.add(wash);
  const heldEntry = mats.find((x) => x.m === held)!;
  const heldBase = heldEntry.base.clone();

  // the hero leaf: one real-scale leaf that finds the fox, so the response is felt up close too
  const hero = new THREE.Mesh(mapleLeafGeometry(0.22).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: EMBER, side: THREE.DoubleSide, transparent: true }));
  hero.visible = false;
  ctx.scene.add(hero);
  const heroState = { age: -1, from: new THREE.Vector3() };

  // the finale: every lobe lets go in a long river of leaves down the mountain, and the Crown stands bare in the snow
  const river = new THREE.InstancedMesh(leafGeo, leafMat, FALL);
  river.frustumCulled = false;
  river.count = 0;
  root.add(river);
  const riverSeed = new Float32Array(FALL * 5);
  // own seeded stream: the finale's river must not shift the shared ctx.rand sequence later builders (and replays) use
  const riverRand = rng(0xc20f4);
  for (let i = 0; i < FALL; i++) riverSeed.set([Math.floor(riverRand() * pads.length), riverRand(), riverRand(), riverRand(), riverRand()], i * 5);
  const padScale = pads.map((p) => p.scale.x);
  let fallT = -1;
  const rv = new THREE.Vector3();

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
      l.delay = 0.3 + (i / SHED) * 4 + rand() * 0.6;
    });
    const f = ctx.fox.root.position;
    heroState.age = 0;
    heroState.from.set(f.x + 1.6, f.y + 5.5, f.z - 1.2);
  }

  /** the finale's river: analytic per leaf (no per-frame allocation) */
  function stepFall(dt: number): void {
    fallT += dt;
    let n = 0;
    for (let i = 0; i < pads.length; i++) {
      // lobes thin out one after another over ~9 s, the held cluster last
      const k = 1 - THREE.MathUtils.smoothstep(fallT, 0.5 + i * 0.9, 4 + i * 0.9);
      pads[i]!.scale.setScalar(padScale[i]! * Math.max(0.001, k));
      pads[i]!.visible = k > 0.002;
    }
    limbPad.scale.setScalar(Math.max(0.001, 1 - THREE.MathUtils.smoothstep(fallT, 6, 10)));
    for (let i = 0; i < FALL; i++) {
      const o = i * 5;
      const a = fallT - (i / FALL) * 9 - riverSeed[o + 1]! * 0.8;
      const life = 11 + riverSeed[o + 2]! * 6;
      if (a < 0 || a > life) continue;
      const pad = pads[riverSeed[o]!]!;
      const r = 3 + riverSeed[o + 3]! * 2;
      rv.set(
        pad.position.x + (riverSeed[o + 3]! - 0.5) * r * 2 - (1.6 + riverSeed[o + 4]! * 2.4) * a + Math.sin(a * 1.3 + i) * 1.4,
        pad.position.y + (riverSeed[o + 4]! - 0.5) * 3 - (1.1 + riverSeed[o + 2]!) * a,
        pad.position.z + (riverSeed[o + 2]! - 0.5) * r * 2 + (riverSeed[o + 1]! - 0.5) * 2 * a,
      );
      e.set(a * 1.7 + i, a * 0.9, Math.sin(a * 2 + i) * 0.8);
      s.setScalar(3.2 * Math.min(1, a * 2) * (1 - THREE.MathUtils.smoothstep(a, life - 2, life)));
      river.setMatrixAt(n++, m4.compose(rv, q.setFromEuler(e), s));
    }
    river.count = n;
    river.instanceMatrix.needsUpdate = true;
  }

  ctx.onUpdate((dt, t) => {
    for (const { m, base, mistK } of mats) m.color.copy(base).lerp(mist, mistK);
    if (fallT >= 0) stepFall(dt);
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
    // the held cluster warms and the wash swells, then settles to an afterglow
    (wash.material as THREE.SpriteMaterial).opacity = 0.55 * THREE.MathUtils.smoothstep(release, 0, 1.5) * (0.45 + 0.55 * Math.exp(-release * 0.25));
    heldEntry.base.copy(heldBase).lerp(new THREE.Color(SHED_EMBER), THREE.MathUtils.smoothstep(release, 0, 2) * 0.8);
    heldEntry.mistK = 0.3 * (1 - THREE.MathUtils.smoothstep(release, 0, 2));
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
      s.setScalar(3 * Math.min(1, a * 2) * (1 - THREE.MathUtils.smoothstep(a, l.life - 2, l.life)));
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
    /** the finale: the Crown lets go of every leaf it was holding (also answers, if it hadn't yet) */
    letGo(): void {
      respond();
      if (fallT < 0) fallT = 0;
    },
    /** world point to frame the Crown from review shots */
    focus: () => root.localToWorld(V(0, crag + 12, 0)),
    state: () => ({ released, release: +release.toFixed(2), fall: +fallT.toFixed(2), limb: +limb.rotation.z.toFixed(3), leaves: leavesOut, heroLeaf: hero.visible }),
  };
}
