/**
 * Ashwater Reach (DESIGN-ashwater.md, tla/Ashwater.tla): world II, a rain marsh at x = +700. Three levels in one
 * south → north run, each a physical gate the fox opens with what it has:
 *   Low Sluice (teach):  dash through the reed dam → the channel drains → walk its bed to Reed Island → earns Reedskim
 *   Reed Pond (develop): Reedskim raises reed mats over the pond → jump mat to mat to the Mill Shore
 *   Weir Heart (combine): mats out to the islet, dash its dam → the Mill Pool drains → its steps climb the weir →
 *                         glide off the weir's lip to the Reed Seedwell on its own ledge
 * Cool rain palette (teal water, moss, peat, slate) with warm lanterns — the vale's sepia paint does not reach here.
 * This file builds (allocations allowed); every per-frame step lives in ashwater.hot.ts.
 */
import * as THREE from 'three';
import { RAMP_WORLD, rng } from '../lookdevKit';
import type { Collider } from '../lookdevPlay';
import type { OpeningCtx } from './scene';
import { ash, ASH_ORIGIN, ASH_SPAWN, DAM_A, DAM_B, H, ISLET, LEDGE, MAT_HALF, MATS, SEEDWELL, STEP_HALF, STEPS, WATER, WEIR, waterAt } from './ashwaterLayout';
import { updateAshwater, type AshRig } from './ashwater.hot';

const C = {
  moss: new THREE.Color(0x5f8a5a), peat: new THREE.Color(0x4b4a3c), sedge: new THREE.Color(0x8a9a5b), bank: new THREE.Color(0x6e7a64),
  water: 0x2f6f78, reed: 0x7f8f4c, reedDry: 0x9a8a55, slate: 0x6f7c84, timber: 0x4f3d30, mat: 0xb3a565, lantern: 0xffb25a, glow: 0x7fe3d8,
};
const LEVEL_IDS = ['teach', 'develop', 'combine'] as const;

/** an unpatched toon: the marsh keeps its own colour (the vale's sketch/paint field is not wired here) */
const marsh = (color: THREE.ColorRepresentation, extra: THREE.MeshToonMaterialParameters = {}) =>
  new THREE.MeshToonMaterial({ color, gradientMap: RAMP_WORLD, ...extra });

export function buildAshwater(
  ctx: OpeningCtx,
  opts: { complete: (level: (typeof LEVEL_IDS)[number]) => boolean; hasReedskim: () => boolean },
) {
  const { scene, colliders } = ctx;
  const rand = rng(7071);
  const root = new THREE.Group();
  root.name = 'ashwater';
  scene.add(root);

  // ---- ground: one sheet over the oval, vertex-coloured moss / sedge / peat by height and wetness
  const SIZE = 150;
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, 150, 150);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const col = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + ASH_ORIGIN.x;
    const z = pos.getZ(i) + ASH_ORIGIN.z;
    const h = H(x, z);
    pos.setY(i, h);
    const wet = THREE.MathUtils.smoothstep(-h, 0.1, 0.8);
    c.copy(C.moss).lerp(C.sedge, 0.5 + 0.5 * Math.sin(x * 0.37 + z * 0.23)).lerp(C.peat, wet);
    if (h > 2) c.lerp(C.bank, 0.5);
    c.toArray(col, i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, marsh(0xffffff, { vertexColors: true }));
  ground.position.set(ASH_ORIGIN.x, 0, ASH_ORIGIN.z);
  ground.receiveShadow = true;
  root.add(ground);

  // ---- water: the channel and the pool drop when drained; the pond holds
  const waterMat = new THREE.MeshStandardMaterial({ color: C.water, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.86, emissive: 0x0d2a2e });
  const waterMesh = (id: keyof typeof WATER) => {
    const w = WATER[id];
    const m = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(150, w.x1 - w.x0) + 1.4, w.z1 - w.z0 + 1.4).rotateX(-Math.PI / 2), waterMat);
    const at = ash((Math.max(-75, w.x0) + Math.min(75, w.x1)) / 2, (w.z0 + w.z1) / 2);
    m.position.set(at.x, w.full, at.z);
    root.add(m);
    return m;
  };
  const water = { channel: waterMesh('channel'), pond: waterMesh('pond'), pool: waterMesh('pool') };

  // ---- reeds: blades along every bank, thick at the water's edge
  const blade = new THREE.ConeGeometry(0.05, 1.3, 4).translate(0, 0.65, 0);
  const REEDS = 2600;
  const reeds = new THREE.InstancedMesh(blade, marsh(C.reed), REEDS);
  const tint = new THREE.Color();
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const sc = new THREE.Vector3();
  const p = new THREE.Vector3();
  let n = 0;
  for (let tries = 0; n < REEDS && tries < REEDS * 12; tries++) {
    const lx = (rand() - 0.5) * 140;
    const lz = (rand() - 0.5) * 130;
    const x = ASH_ORIGIN.x + lx;
    const z = ASH_ORIGIN.z + lz;
    const h = H(x, z);
    if (waterAt(x, z) !== null || h > 5 || h < -0.3) continue;
    // reeds crowd the water's edge and the rim; keep the walking line (lx ≈ 0) and the gates readable
    const edge = h < 0.05 ? 1 : 0.25;
    if (rand() > edge || (Math.abs(lx) < 4 && lz < 40) || Math.hypot(lx - DAM_A.lx, lz - DAM_A.lz) < 3.5) continue;
    p.set(x, h - 0.05, z);
    e.set((rand() - 0.5) * 0.35, rand() * 6.28, (rand() - 0.5) * 0.35);
    q.setFromEuler(e);
    sc.set(1, 0.6 + rand() * 0.9, 1);
    reeds.setMatrixAt(n, m4.compose(p, q, sc));
    reeds.setColorAt(n, tint.set(rand() < 0.3 ? C.reedDry : C.reed));
    n++;
  }
  reeds.count = n;
  root.add(reeds);

  // ---- reed dams: a slumped stack of cut reeds on the sluice culvert and on the mill race islet
  const damBlade = new THREE.CylinderGeometry(0.06, 0.06, 1.6, 4).rotateZ(Math.PI / 2);
  const dam = (lx: number, lz: number) => {
    const g = new THREE.Group();
    const at = ash(lx, lz);
    g.position.set(at.x, H(at.x, at.z), at.z);
    const mat = marsh(C.reedDry);
    for (let i = 0; i < 46; i++) {
      const b = new THREE.Mesh(damBlade, mat);
      b.position.set((rand() - 0.5) * 2.2, 0.15 + rand() * 1.1, (rand() - 0.5) * 1.4);
      b.rotation.set(rand() * 0.6, rand() * 3.14, (rand() - 0.5) * 0.5);
      b.castShadow = true;
      g.add(b);
    }
    root.add(g);
    const col: Extract<Collider, { kind: 'post' }> = { kind: 'post', x: at.x, z: at.z, r: 1.1 };
    colliders.push(col);
    return { g, col };
  };
  const damA = dam(DAM_A.lx, DAM_A.lz);
  const damB = dam(DAM_B.lx, DAM_B.lz);
  // the sluice culvert the dam chokes: a slate mouth on the channel bank behind it
  const slate = marsh(C.slate);
  const timber = marsh(C.timber);
  const sluiceAt = ash(DAM_A.lx, WATER.channel.z0 - 0.3);
  const sluice = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.2, 1.0), slate);
  sluice.position.set(sluiceAt.x, H(sluiceAt.x, sluiceAt.z) - 0.2, sluiceAt.z);
  root.add(sluice);

  // ---- reed mats over the pond (sunk until Reedskim)
  const matGeo = new THREE.CylinderGeometry(MAT_HALF * 1.12, MAT_HALF * 1.2, 0.16, 9);
  const matMat = marsh(C.mat);
  const mats: THREE.Object3D[] = [];
  const matCols: Extract<Collider, { kind: 'box' }>[] = [];
  for (const [lx, lz] of MATS) {
    const at = ash(lx, lz);
    const mesh = new THREE.Mesh(matGeo, matMat);
    mesh.position.set(at.x, WATER.pond.full - 0.6, at.z);
    mesh.rotation.y = rand() * 3;
    mesh.visible = false;
    mesh.castShadow = true;
    root.add(mesh);
    mats.push(mesh);
    const col: Extract<Collider, { kind: 'box' }> = { kind: 'box', x: at.x, z: at.z, yaw: 0, hx: MAT_HALF, hz: MAT_HALF, top: -100 };
    colliders.push(col);
    matCols.push(col);
  }

  // ---- the Mill Pool's steps up the weir wall, and the weir itself: plank face, a mill and its wheel
  for (const st of STEPS) {
    const at = ash(0, st.lz);
    const bottom = -1.1;
    const s = new THREE.Mesh(new THREE.BoxGeometry(STEP_HALF.x * 2, st.top - bottom, STEP_HALF.z * 2 + 0.1), slate);
    s.position.set(at.x, (st.top + bottom) / 2, at.z);
    s.castShadow = s.receiveShadow = true;
    root.add(s);
    colliders.push({ kind: 'box', x: at.x, z: at.z, yaw: 0, hx: STEP_HALF.x, hz: STEP_HALF.z, top: st.top });
  }
  for (let i = -7; i <= 7; i++) {
    if (Math.abs(i) < 1) continue;
    const at = ash(i * 2.1, WEIR.z0 - 0.15);
    const plank = new THREE.Mesh(new THREE.BoxGeometry(2.0, WEIR.top + 1.2, 0.25), timber);
    plank.position.set(at.x, (WEIR.top - 1.2) / 2, at.z);
    root.add(plank);
  }
  const millAt = ash(-9, 41);
  const mill = new THREE.Group();
  mill.position.set(millAt.x, WEIR.top, millAt.z);
  const wall = new THREE.Mesh(new THREE.BoxGeometry(6, 3.4, 5), marsh(0x8f9a94));
  wall.position.y = 1.7;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(4.8, 2.4, 4).rotateY(Math.PI / 4), marsh(0x45535d));
  roof.position.y = 4.6;
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.18, 6, 14), timber);
  wheel.position.set(3.4, 1.4, 0);
  wheel.rotation.y = Math.PI / 2;
  mill.add(wall, roof, wheel);
  root.add(mill);
  colliders.push({ kind: 'box', x: millAt.x, z: millAt.z, yaw: 0, hx: 3.3, hz: 2.8, top: WEIR.top + 3.4 });

  // ---- the Reed Seedwell on its ledge: a slate basin; restored, a teal column of light rises from it
  const wellAt = ash(SEEDWELL.lx, SEEDWELL.lz);
  const basin = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.35, 6, 14).rotateX(Math.PI / 2), slate);
  basin.position.set(wellAt.x, LEDGE.top + 0.3, wellAt.z);
  root.add(basin);
  colliders.push({ kind: 'post', x: wellAt.x, z: wellAt.z, r: 1.5 });
  const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 14, 14, 1, true), new THREE.MeshBasicMaterial({ color: C.glow, transparent: true, opacity: 0.55, side: THREE.DoubleSide, toneMapped: false, depthWrite: false }));
  glow.geometry.translate(0, 7, 0);
  glow.position.set(wellAt.x, LEDGE.top + 0.3, wellAt.z);
  glow.visible = false;
  root.add(glow);

  // ---- lanterns along the way: warm notes in the rain, at each gate
  const lanternMat = new THREE.MeshBasicMaterial({ color: C.lantern, toneMapped: false });
  for (const [lx, lz] of [[2.6, -40], [-8.5, -36.5], [2.6, -20], [-3.2, -10], [3.5, 16], [-17, 22], [17, 22], [19, 38], [27, 37.5]] as const) {
    const at = ash(lx, lz);
    const y = H(at.x, at.z);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.7, 5), timber);
    post.position.set(at.x, y + 0.85, at.z);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.32, 0.26), lanternMat);
    lamp.position.set(at.x, y + 1.75, at.z);
    root.add(post, lamp);
  }
  // the landing boardwalk under the spawn
  const spawnAt = ash(ASH_SPAWN.lx, ASH_SPAWN.lz);
  for (let i = 0; i < 9; i++) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.12, 0.42), timber);
    plank.position.set(spawnAt.x, H(spawnAt.x, spawnAt.z + 4 + i * 0.48) + 0.04, spawnAt.z + 4 + i * 0.48);
    plank.rotation.y = (rand() - 0.5) * 0.06;
    root.add(plank);
  }
  // the dam islet: a hummock of sedge with a stake
  const isletAt = ash(ISLET.lx, ISLET.lz);
  const stake = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.2, 5), timber);
  stake.position.set(isletAt.x + 1.6, H(isletAt.x + 1.6, isletAt.z) + 1.1, isletAt.z);
  root.add(stake);

  // ---- the rig
  const say = (t: string) => ctx.captions.say(t);
  const rig: AshRig = {
    fox: ctx.fox.root,
    motion: () => ctx.player?.motion ?? null,
    hasReedskim: opts.hasReedskim,
    teleport: (x, z, yaw) => ctx.player?.teleport(x, z, yaw),
    teach: ctx.teach.offer,
    events: {
      burstA: () => {
        ctx.audio.cue('millrace-burst');
        say('The low sluice runs again.');
      },
      burstB: () => {
        ctx.audio.cue('millrace-burst');
        say('The mill pool lets go.');
      },
      complete: (level) => {
        opts.complete(LEVEL_IDS[level]);
        if (level === 0) say('The reeds will hold you now.');
        if (level === 2) {
          ctx.audio.cue('finale-kindle');
          say('The Reed Seedwell fills.');
        }
      },
      splash: () => ctx.audio.play('soft-paper', { at: ctx.fox.root.position.clone(), gain: 0.1, rate: 0.6 }),
    },
    waterMesh: water,
    damA: damA.g,
    damB: damB.g,
    damACol: damA.col,
    damBCol: damB.col,
    mats,
    matCols,
    glow,
    safe: new THREE.Vector3(spawnAt.x, 0, spawnAt.z),
    s: { burstA: -1, burstB: -1, channelY: WATER.channel.full, poolY: WATER.pool.full, matK: 0, glowK: 0, done: 0, safeYaw: ASH_SPAWN.yaw, splashes: 0, inMarsh: 0 },
  };
  ctx.onUpdate((dt) => updateAshwater(rig, dt));

  return {
    spawn: { x: spawnAt.x, z: spawnAt.z, yaw: ASH_SPAWN.yaw },
    state: () => ({
      damA: rig.s.burstA >= 0, damB: rig.s.burstB >= 0, channelY: +rig.s.channelY.toFixed(2), poolY: +rig.s.poolY.toFixed(2),
      mats: +Math.min(1, rig.s.matK).toFixed(2), done: LEVEL_IDS.filter((_, i) => (rig.s.done & (1 << i)) !== 0), splashes: rig.s.splashes, glow: +rig.s.glowK.toFixed(2),
    }),
  };
}

export type Ashwater = ReturnType<typeof buildAshwater>;
