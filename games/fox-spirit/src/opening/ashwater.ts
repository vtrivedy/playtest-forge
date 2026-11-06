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
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RAMP_WORLD, rng } from '../lookdevKit';
import type { Collider } from '../lookdevPlay';
import type { OpeningCtx } from './scene';
import { ash, ASH_ORIGIN, ASH_SPAWN, CISTERN, GULLY, SOAK, SECRETS, SHELF, SILL, THICKET, DAM_A2, DAM_A, DAM_B, DAM_C, H, ISLET, LEDGE, MAT_HALF, MATS, PUNT, SEEDWELL, STEP_HALF, STEPS, WATER, WEIR, waterAt } from './ashwaterLayout';
import { updateAshwater, type AshRig } from './ashwater.hot';
import { buildAshwaterPuddles } from './ashwaterGround';

const C = {
  moss: new THREE.Color(0x3c493d), peat: new THREE.Color(0x35352f), mud: new THREE.Color(0x3b322b), levee: new THREE.Color(0x74664e), sedge: new THREE.Color(0x505a40), bank: new THREE.Color(0x505e55),
  water: 0x2a6a74, reed: 0x6f8a3e, reedDry: 0xa08a4e, willow: 0x4f7f6a, pad: 0x5d8f3f, bloom: 0xf2e6c4, slate: 0x6f7c84, timber: 0x4f3d30, mat: 0xb3a565, lantern: 0xffb25a, glow: 0x7fe3d8,
};
const LEVEL_IDS = ['teach', 'develop', 'combine'] as const;

/** an unpatched toon: the marsh keeps its own colour (the vale's sketch/paint field is not wired here) */
const marsh = (color: THREE.ColorRepresentation, extra: THREE.MeshToonMaterialParameters = {}) =>
  new THREE.MeshToonMaterial({ color, gradientMap: RAMP_WORLD, ...extra });

export function buildAshwater(
  ctx: OpeningCtx,
  opts: {
    complete: (level: (typeof LEVEL_IDS)[number]) => boolean;
    hasReedskim: () => boolean;
    isRestored?: (level: (typeof LEVEL_IDS)[number]) => boolean;
    /** side places (the Album keeps their pages): found already at load, and the moment one is found */
    secretFound?: (which: 'ashwater-roof' | 'ashwater-mooring') => boolean;
    onSecret?: (which: 'ashwater-roof' | 'ashwater-mooring') => void;
  },
) {
  const { scene, colliders } = ctx;
  const rand = rng(7071);
  const root = new THREE.Group();
  root.name = 'ashwater';
  /** tall pieces the chase camera may look through (the cistern walls, the weir pier, the mill) */
  const occluders: THREE.Object3D[] = [];
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
    // moss on the hummocks, sedge in the hollows, black-brown mud wherever the ground dips toward water,
    // pale dug peat on the levees, slate-green on the weir and the rim
    const wet = 1 - THREE.MathUtils.smoothstep(h, -0.6, 0.12);
    const w = waterAt(x, z) !== null ? 1 : 0;
    c.copy(C.moss).lerp(C.sedge, 0.5 + 0.5 * Math.sin(x * 0.37 + z * 0.23));
    c.lerp(C.peat, wet * 0.6).lerp(C.mud, Math.max(wet * 0.7, w * 0.8));
    if (h > 0.32 && h < 0.75 && w === 0) c.lerp(C.levee, 0.35);
    if (h > 2) c.lerp(C.bank, 0.6);
    c.toArray(col, i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, marsh(0xffffff, { vertexColors: true }));
  ground.position.set(ASH_ORIGIN.x, 0, ASH_ORIGIN.z);
  ground.receiveShadow = true;
  root.add(ground);
  root.add(buildAshwaterPuddles(geo));

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
  const water = { channel: waterMesh('channel'), channelE: waterMesh('channelE'), pond: waterMesh('pond'), pool: waterMesh('pool') };

  // ---- reeds: clumps, not spikes — fanned sedge tufts everywhere wet, and cattail stands (brown heads on stalks)
  // crowding the water's edge; vertex-coloured (dark base → lighter tips, brown heads), tinted per clump
  const blade = new THREE.ConeGeometry(0.05, 1.3, 4).translate(0, 0.65, 0);
  const paint = (g: THREE.BufferGeometry, base: THREE.Color, tip: THREE.Color, h: number) => {
    const ps = g.getAttribute('position') as THREE.BufferAttribute;
    const cs = new Float32Array(ps.count * 3);
    const t = new THREE.Color();
    for (let i = 0; i < ps.count; i++) t.copy(base).lerp(tip, Math.min(1, Math.max(0, ps.getY(i) / h))).toArray(cs, i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(cs, 3));
    return g;
  };
  const sedgeBase = new THREE.Color(0x2f4a2a), sedgeTip = new THREE.Color(0x8aa35a);
  const fan = (count: number, len: number, lean: number, w: number) =>
    Array.from({ length: count }, (_, i) => {
      const a = (i / count) * Math.PI * 2 + rand() * 0.5;
      const l = len * (0.7 + rand() * 0.5);
      const g = new THREE.ConeGeometry(w, l, 3).translate(0, l / 2, 0);
      g.rotateX(lean * (0.5 + rand() * 0.6)).rotateY(a).translate(Math.sin(a) * 0.06, 0, Math.cos(a) * 0.06);
      return paint(g, sedgeBase, sedgeTip, l);
    });
  const sedgeGeo = mergeGeometries(fan(9, 0.75, 0.55, 0.035))!;
  const cattailParts = fan(6, 1.25, 0.25, 0.03);
  for (let k = 0; k < 3; k++) {
    const a = rand() * 6.28, r = 0.12;
    const stalk = paint(new THREE.CylinderGeometry(0.012, 0.016, 1.7, 4).translate(Math.sin(a) * r, 0.85, Math.cos(a) * r), sedgeBase, new THREE.Color(0x6f7f45), 1.7);
    const head = new THREE.CapsuleGeometry(0.045, 0.22, 2, 5).translate(Math.sin(a) * r, 1.62, Math.cos(a) * r);
    paint(head, new THREE.Color(0x5a3a22), new THREE.Color(0x6b4529), 2);
    cattailParts.push(stalk.toNonIndexed(), head.toNonIndexed());
  }
  const cattailGeo = mergeGeometries(cattailParts.map((g) => (g.index ? g.toNonIndexed() : g)))!;
  const reedMat = marsh(0xffffff, { vertexColors: true });
  const REEDS = 3400;
  const sedges = new THREE.InstancedMesh(sedgeGeo, reedMat, REEDS);
  const cattails = new THREE.InstancedMesh(cattailGeo, reedMat, 1400);
  const tint = new THREE.Color();
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const sc = new THREE.Vector3();
  const p = new THREE.Vector3();
  let n = 0, nc = 0;
  for (let tries = 0; n < REEDS && tries < REEDS * 14; tries++) {
    const lx = (rand() - 0.5) * 140;
    const lz = (rand() - 0.5) * 130;
    const x = ASH_ORIGIN.x + lx;
    const z = ASH_ORIGIN.z + lz;
    const h = H(x, z);
    if (waterAt(x, z) !== null || h > 5 || h < -0.3) continue;
    // reeds crowd the water's edge and the rim; keep the walking line (lx ≈ 0) and the gates readable
    const edge = h < 0.05 ? 1 : h > 1.5 ? 0.5 : 0.22;
    if (rand() > edge || (Math.abs(lx) < 4 && lz < 40) || Math.hypot(lx - DAM_A.lx, lz - DAM_A.lz) < 3.5) continue;
    p.set(x, h - 0.04, z);
    e.set((rand() - 0.5) * 0.2, rand() * 6.28, (rand() - 0.5) * 0.2);
    q.setFromEuler(e);
    const big = 0.8 + rand() * 0.7;
    sc.set(big, big * (0.8 + rand() * 0.5), big);
    m4.compose(p, q, sc);
    tint.setRGB(0.85 + rand() * 0.25, 0.85 + rand() * 0.25, 0.8 + rand() * 0.2);
    if (h < 0.08 && nc < 1400 && rand() < 0.45) {
      cattails.setMatrixAt(nc, m4);
      cattails.setColorAt(nc++, tint);
    } else {
      sedges.setMatrixAt(n, m4);
      sedges.setColorAt(n++, tint);
    }
  }
  sedges.count = n;
  cattails.count = nc;
  root.add(sedges, cattails);

  // ---- reed dams: a slumped stack of cut reeds on the sluice culvert and on the mill race islet
  const damBlade = new THREE.CylinderGeometry(0.06, 0.06, 1.6, 4).rotateZ(Math.PI / 2);
  const dam = (lx: number, lz: number) => {
    const g = new THREE.Group();
    const at = ash(lx, lz);
    g.position.set(at.x, H(at.x, at.z), at.z);
    const mat = marsh(C.reedDry);
    for (let i = 0; i < 90; i++) {
      const b = new THREE.Mesh(damBlade, mat);
      b.position.set((rand() - 0.5) * 2.6, 0.15 + rand() * 1.5 * (1 - Math.abs(rand() - 0.5)), (rand() - 0.5) * 1.8);
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
  const damA2 = dam(DAM_A2.lx, DAM_A2.lz);
  damA2.g.position.y = -1.0;
  const damB = dam(DAM_B.lx, DAM_B.lz);
  const damC = dam(DAM_C.lx, DAM_C.lz);
  // the sluice culvert the dam chokes: a slate mouth on the channel bank behind it
  const slate = marsh(C.slate);
  const timber = marsh(C.timber);
  // the sluice gate the dam chokes: two timber posts and a plank gate on the channel bank behind it
  const sluiceAt = ash(DAM_A.lx, WATER.channel.z0 - 0.2);
  const sluiceY = H(sluiceAt.x, sluiceAt.z);
  for (const sx of [-1.7, 1.7]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.32, 2.6, 0.32), timber);
    post.position.set(sluiceAt.x + sx, sluiceY + 0.5, sluiceAt.z);
    root.add(post);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.3, 0.34), timber);
  beam.position.set(sluiceAt.x, sluiceY + 1.8, sluiceAt.z);
  const gate = new THREE.Mesh(new THREE.BoxGeometry(3.1, 1.1, 0.14), marsh(0x6a5440));
  gate.position.set(sluiceAt.x, sluiceY - 0.2, sluiceAt.z);
  root.add(beam, gate);

  // ---- where the drained channel goes (DESIGN-sumiro-play.md §3): water running down the sluice gully into the soak
  // in the marsh's low corner. A ribbon draped on the gully bed, its streak texture scrolled downhill by the hot step
  const streaks = document.createElement('canvas');
  streaks.width = 64;
  streaks.height = 256;
  {
    const g = streaks.getContext('2d')!;
    // a body of water (grey base: alpha ≈ 0.35) with brighter streaks running in it
    g.fillStyle = '#5a5a5a';
    g.fillRect(0, 0, 64, 256);
    const rs = rng(8803);
    for (let i = 0; i < 70; i++) {
      const x = rs() * 64, y = rs() * 256, len = 14 + rs() * 50, a = 0.45 + rs() * 0.55;
      const grad = g.createLinearGradient(0, y, 0, y + len);
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(0.5, `rgba(255,255,255,${a})`);
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.fillRect(x, y, 1.5 + rs() * 2.5, len);
    }
  }
  const flowTex = new THREE.CanvasTexture(streaks);
  flowTex.wrapS = flowTex.wrapT = THREE.RepeatWrapping;
  // (alphaMap reads green: the canvas is an opaque black → white ramp, Reed :815)
  const flowMat = new THREE.MeshStandardMaterial({ color: C.water, emissive: 0xb8d6d8, emissiveIntensity: 0.55, emissiveMap: flowTex, alphaMap: flowTex, roughness: 0.1, transparent: true, opacity: 0, depthWrite: false });
  // the sluice's culvert runs under the bank (the dam chokes its intake) and comes out at a slate headwall at the
  // gully's head; the water shows from the outlet down
  const outlet = ash(GULLY.ax, GULLY.az + 0.5);
  const headwall = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.3, 0.5), marsh(C.slate));
  headwall.position.set(outlet.x, GULLY.bed0 + 0.45, outlet.z + 0.25);
  headwall.castShadow = true;
  const pipe = new THREE.Mesh(new THREE.CircleGeometry(0.42, 16), new THREE.MeshBasicMaterial({ color: 0x0b0f10 }));
  pipe.position.set(outlet.x, GULLY.bed0 + 0.42, outlet.z - 0.01);
  pipe.rotation.y = Math.PI;
  root.add(headwall, pipe);
  const gullyPath: ReadonlyArray<readonly [number, number]> = [[GULLY.ax, GULLY.az + 0.4], [GULLY.bx, GULLY.bz], [SOAK.lx, SOAK.lz]];
  let flowLen = 0;
  for (let i = 1; i < gullyPath.length; i++) flowLen += Math.hypot(gullyPath[i]![0] - gullyPath[i - 1]![0], gullyPath[i]![1] - gullyPath[i - 1]![1]);
  const SEG = 48;
  const flowPos = new Float32Array((SEG + 1) * 2 * 3);
  const flowUv = new Float32Array((SEG + 1) * 2 * 2);
  const flowIdx: number[] = [];
  for (let k = 0; k <= SEG; k++) {
    // the point at arc length u along the path, and its side normal
    let u = (k / SEG) * flowLen;
    let j = 1;
    for (; j < gullyPath.length - 1; j++) {
      const l = Math.hypot(gullyPath[j]![0] - gullyPath[j - 1]![0], gullyPath[j]![1] - gullyPath[j - 1]![1]);
      if (u <= l) break;
      u -= l;
    }
    const [ax, az] = gullyPath[j - 1]!;
    const [bx, bz] = gullyPath[j]!;
    const l = Math.hypot(bx - ax, bz - az) || 1;
    const t = Math.min(1, u / l);
    const cx = ax + (bx - ax) * t, cz = az + (bz - az) * t;
    const nx = -(bz - az) / l, nz = (bx - ax) / l;
    const w = 0.55 + 0.35 * (k / SEG);
    for (let side = 0; side < 2; side++) {
      const sx = cx + nx * w * (side ? 1 : -1), sz = cz + nz * w * (side ? 1 : -1);
      const at = ash(sx, sz);
      const v = (k * 2 + side) * 3;
      flowPos[v] = at.x;
      flowPos[v + 1] = Math.max(H(at.x, at.z), H(ash(cx, cz).x, ash(cx, cz).z)) + 0.07;
      flowPos[v + 2] = at.z;
      flowUv[(k * 2 + side) * 2] = side;
      flowUv[(k * 2 + side) * 2 + 1] = (k / SEG) * flowLen * 0.18;
    }
    if (k < SEG) flowIdx.push(k * 2, k * 2 + 1, k * 2 + 2, k * 2 + 1, k * 2 + 3, k * 2 + 2);
  }
  const flowGeo = new THREE.BufferGeometry();
  flowGeo.setAttribute('position', new THREE.BufferAttribute(flowPos, 3));
  flowGeo.setAttribute('uv', new THREE.BufferAttribute(flowUv, 2));
  flowGeo.setIndex(flowIdx);
  flowGeo.computeVertexNormals();
  const flow = new THREE.Mesh(flowGeo, flowMat);
  flow.visible = false;
  root.add(flow);
  // the soak: a reed-ringed hollow that fills with what the channel lets go
  const soakAt = ash(SOAK.lx, SOAK.lz);
  const soak = new THREE.Mesh(new THREE.CircleGeometry(SOAK.r + 1.2, 28).rotateX(-Math.PI / 2), waterMat);
  soak.position.set(soakAt.x, SOAK.low, soakAt.z);
  root.add(soak);

  // ---- reed mats over the pond (sunk until Reedskim): bundles of cut reed lashed into a raft with a bound rim and
  // a few green tips still standing; they ride low and sink under a fox that lingers
  const strand = new THREE.CylinderGeometry(0.045, 0.045, MAT_HALF * 2.1, 5).rotateZ(Math.PI / 2);
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 26; i++) {
    const g = strand.clone().rotateY((i / 26) * Math.PI + (rand() - 0.5) * 0.25);
    g.translate((rand() - 0.5) * 0.2, 0.05 + (i % 3) * 0.04, (rand() - 0.5) * 0.2);
    parts.push(g);
  }
  const matGeo = mergeGeometries(parts)!;
  const rimGeo = new THREE.TorusGeometry(MAT_HALF * 0.92, 0.07, 5, 16).rotateX(Math.PI / 2).translate(0, 0.1, 0);
  const tipGeo = mergeGeometries(Array.from({ length: 7 }, (_, i) => new THREE.ConeGeometry(0.03, 0.55 + (i % 3) * 0.15, 4).translate(Math.cos(i * 0.9) * MAT_HALF * 0.75, 0.32, Math.sin(i * 0.9) * MAT_HALF * 0.75)))!;
  const matMat = marsh(C.mat);
  const rimMat = marsh(0x6b5a34);
  const tipMat = marsh(C.reed);
  const mats: THREE.Object3D[] = [];
  const matCols: Extract<Collider, { kind: 'box' }>[] = [];
  for (const [lx, lz] of MATS) {
    const at = ash(lx, lz);
    const mesh = new THREE.Group();
    const body = new THREE.Mesh(matGeo, matMat);
    body.castShadow = body.receiveShadow = true;
    mesh.add(body, new THREE.Mesh(rimGeo, rimMat), new THREE.Mesh(tipGeo, tipMat));
    mesh.position.set(at.x, WATER.pond.full - 0.6, at.z);
    mesh.rotation.y = rand() * 3;
    mesh.visible = false;
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
  occluders.push(mill);
  colliders.push({ kind: 'box', x: millAt.x, z: millAt.z, yaw: 0, hx: 3.3, hz: 2.8, top: WEIR.top + 3.4 });

  // ---- the Reed Seedwell on its ledge: a slate basin; restored, a teal column of light rises from it
  const wellAt = ash(SEEDWELL.lx, SEEDWELL.lz);
  const basin = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.35, 6, 14).rotateX(Math.PI / 2), slate);
  basin.position.set(wellAt.x, LEDGE.top + 0.3, wellAt.z);
  root.add(basin);
  colliders.push({ kind: 'post', x: wellAt.x, z: wellAt.z, r: 1.5 });
  // the fill: a soft additive beam, bright at the water and fading to nothing as it rises (not a solid tube)
  const fade = document.createElement('canvas');
  fade.width = 4;
  fade.height = 128;
  const fg = fade.getContext('2d')!;
  const grad = fg.createLinearGradient(0, 0, 0, 128);
  // (alphaMap reads the green channel: an opaque black → white ramp, not alpha on white — Reed :815)
  grad.addColorStop(0, '#000000');
  grad.addColorStop(0.55, '#595959');
  grad.addColorStop(1, '#ffffff');
  fg.fillStyle = grad;
  fg.fillRect(0, 0, 4, 128);
  const glowMat = new THREE.MeshBasicMaterial({ color: C.glow, alphaMap: new THREE.CanvasTexture(fade), transparent: true, opacity: 0.22, side: THREE.DoubleSide, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending });
  const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.75, 12, 20, 1, true), glowMat);
  glow.geometry.translate(0, 6, 0);
  glow.position.set(wellAt.x, LEDGE.top + 0.3, wellAt.z);
  root.add(glow);
  // its water (lit with the column) and a ring of leaning slates, like the vale's well stones, with reeds between
  const pool = new THREE.Mesh(new THREE.CircleGeometry(1.15, 18).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: C.glow, transparent: true, opacity: 0.55, toneMapped: false }));
  pool.position.set(wellAt.x, LEDGE.top + 0.42, wellAt.z);
  root.add(pool);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    const h = 1.3 + rand() * 0.9;
    const stone = new THREE.Mesh(new THREE.BoxGeometry(0.55, h, 0.32), slate);
    stone.position.set(wellAt.x + Math.sin(a) * 2.4, LEDGE.top + h / 2 - 0.1, wellAt.z + Math.cos(a) * 2.4);
    stone.rotation.set((rand() - 0.5) * 0.15, a, (rand() - 0.5) * 0.2);
    stone.castShadow = true;
    root.add(stone);
    occluders.push(stone);
    colliders.push({ kind: 'post', x: stone.position.x, z: stone.position.z, r: 0.3 });
    for (let k = 0; k < 6; k++) {
      const b = new THREE.Mesh(blade, marsh(C.reed));
      const ba = a + 0.5 + (rand() - 0.5) * 0.4;
      b.position.set(wellAt.x + Math.sin(ba) * (2.0 + rand() * 0.6), LEDGE.top - 0.05, wellAt.z + Math.cos(ba) * (2.0 + rand() * 0.6));
      b.scale.set(1, 0.6 + rand() * 0.6, 1);
      root.add(b);
    }
  }

  // ---- lanterns along the way: warm notes in the rain, at each gate
  const lanternMat = new THREE.MeshBasicMaterial({ color: C.lantern, toneMapped: false });
  for (const [lx, lz] of [[2.6, -40], [-8.5, -36.5], [2.6, -20], [-3.2, -10], [3.5, 16], [-17, 22], [17, 22], [13.5, 36.5], [20.5, 22.5]] as const) {
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

  // ---- lily pads on the pond (clear of the mats' line) and willows hanging over the rim: the marsh's silhouette
  const padGeo = new THREE.CircleGeometry(0.45, 9, 0.3, Math.PI * 1.85).rotateX(-Math.PI / 2);
  const pads = new THREE.InstancedMesh(padGeo, marsh(C.pad, { side: THREE.DoubleSide }), 220);
  let np = 0;
  for (let tries = 0; np < 220 && tries < 3000; tries++) {
    const lx = (rand() - 0.5) * 120;
    const lz = WATER.pond.z0 + 0.8 + rand() * (WATER.pond.z1 - WATER.pond.z0 - 1.6);
    if (Math.abs(lx) < 4 || (lz > -1.5 && lz < 2.5 && lx > 0 && lx < 26)) continue;
    const at = ash(lx, lz);
    if (waterAt(at.x, at.z) !== 'pond') continue;
    p.set(at.x, WATER.pond.full + 0.02, at.z);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * 6.28);
    sc.setScalar(0.6 + rand() * 0.9);
    pads.setMatrixAt(np++, m4.compose(p, q, sc));
  }
  pads.count = np;
  root.add(pads);
  const willowLeaf = marsh(C.willow);
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + rand() * 0.2;
    const lx = Math.sin(a) * 58, lz = Math.cos(a) * 54;
    const at = ash(lx, lz);
    const y = H(at.x, at.z);
    const w = new THREE.Group();
    w.position.set(at.x, y, at.z);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.4, 3.4, 6).translate(0, 1.7, 0), timber);
    trunk.rotation.z = (rand() - 0.5) * 0.3;
    w.add(trunk);
    for (let k = 0; k < 5; k++) {
      // drooping curtains of leaves: tall soft lobes hanging off the crown
      const lobe = new THREE.Mesh(new THREE.IcosahedronGeometry(1.3, 1).scale(0.8, 1.7, 0.8), willowLeaf);
      lobe.position.set((rand() - 0.5) * 2.4, 3.0 + rand() * 0.8, (rand() - 0.5) * 2.4);
      lobe.castShadow = true;
      w.add(lobe);
    }
    w.scale.setScalar(1 + rand() * 0.6);
    root.add(w);
  }

  // ---- the Ferrykeeper (DESIGN-worlds story): a heron pressed flat mid-wade at the Mill Pool's edge, its bill on the
  // pole of the last ferry. When the Seedwell fills it unpresses — paper gains depth and colour — and flies off north
  const heronShape = new THREE.Shape();
  heronShape.moveTo(-0.55, 0.95); // tail
  heronShape.quadraticCurveTo(-0.2, 1.25, 0.25, 1.15); // back
  heronShape.quadraticCurveTo(0.45, 1.35, 0.32, 1.55); // neck S
  heronShape.quadraticCurveTo(0.25, 1.78, 0.42, 1.86); // crown
  heronShape.lineTo(0.95, 1.78); // bill
  heronShape.lineTo(0.42, 1.76);
  heronShape.quadraticCurveTo(0.3, 1.6, 0.4, 1.42);
  heronShape.quadraticCurveTo(0.42, 1.1, 0.22, 0.9); // breast
  heronShape.lineTo(0.08, 0.86);
  heronShape.lineTo(0.1, 0.0); // front leg
  heronShape.lineTo(0.05, 0.0);
  heronShape.lineTo(0.0, 0.84);
  heronShape.lineTo(-0.1, 0.84);
  heronShape.lineTo(-0.2, 0.0); // back leg
  heronShape.lineTo(-0.25, 0.0);
  heronShape.lineTo(-0.2, 0.86);
  heronShape.quadraticCurveTo(-0.45, 0.88, -0.55, 0.95);
  const heronGeo = new THREE.ExtrudeGeometry(heronShape, { depth: 0.26, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.03, bevelSegments: 1 }).translate(0, 0, -0.13);
  const heronMat = marsh(0xd8cfb8);
  const heron = new THREE.Mesh(heronGeo, heronMat);
  const heronAt = ash(-6.5, 18.2);
  heron.position.set(heronAt.x, H(heronAt.x, heronAt.z), heronAt.z);
  heron.rotation.y = -0.4;
  heron.scale.set(1.3, 1.3, 0.08);
  heron.castShadow = true;
  root.add(heron);
  const heronCol: Extract<Collider, { kind: 'post' }> = { kind: 'post', x: heronAt.x, z: heronAt.z, r: 0.45 };
  colliders.push(heronCol);
  // the last ferry: a flat punt moored by the weir's east end; it rides whatever the cistern holds (PUNT)
  const puntAt = ash(PUNT.lx, PUNT.lz);
  const punt = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(PUNT.hx * 2, 0.3, PUNT.hz * 2), timber);
  hull.position.y = -0.05;
  const thwart = new THREE.Mesh(new THREE.BoxGeometry(PUNT.hx * 2, 0.12, 0.16), marsh(0x6a5440));
  thwart.position.set(0, 0.14, 0.4);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 3.4, 5), timber);
  pole.position.set(-1.0, 0.9, 0.3);
  pole.rotation.set(0.25, 0, 0.9);
  punt.add(hull, thwart, pole);
  punt.position.set(puntAt.x, WATER.pool.full + 0.05, puntAt.z);
  hull.castShadow = true;
  root.add(punt);
  const puntCol: Extract<Collider, { kind: 'box' }> = { kind: 'box', x: puntAt.x, z: puntAt.z, yaw: 0, hx: PUNT.hx, hz: PUNT.hz, top: WATER.pool.full + PUNT.rise };
  colliders.push(puntCol);

  // ---- the cistern: slate walls west, south and east of the Mill Pool (the weir is its north side); the south wall's
  // gate stands open over a dry or low pool and shuts as a flood rises
  const wallMat = marsh(0x6c7880);
  const W = WATER.pool, T2 = CISTERN.wall / 2;
  const cWall = (x0: number, x1: number, z0: number, z1: number) => {
    const a = ash((x0 + x1) / 2, (z0 + z1) / 2);
    const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, CISTERN.wallTop + 1.3, z1 - z0), wallMat);
    m.position.set(a.x, (CISTERN.wallTop - 1.3) / 2, a.z);
    m.castShadow = m.receiveShadow = true;
    root.add(m);
    occluders.push(m);
    colliders.push({ kind: 'box', x: a.x, z: a.z, yaw: 0, hx: (x1 - x0) / 2, hz: (z1 - z0) / 2, top: CISTERN.wallTop });
  };
  cWall(W.x0 - CISTERN.wall, W.x0, W.z0 - CISTERN.wall, WEIR.z0);
  cWall(W.x1, W.x1 + CISTERN.wall, W.z0 - CISTERN.wall, SHELF.z1);
  // the east wall's north end rises into a tall slate pier beside the weir: nothing on the weir steps onto the wall
  {
    const a = ash((SHELF.x0 + W.x1 + CISTERN.wall) / 2, (SHELF.z1 + WEIR.z0) / 2);
    const hx = (W.x1 + CISTERN.wall - SHELF.x0) / 2, hz = (WEIR.z0 - SHELF.z1) / 2;
    const pier = new THREE.Mesh(new THREE.BoxGeometry(hx * 2, 7.6, hz * 2), wallMat);
    pier.position.set(a.x, 2.5, a.z);
    pier.castShadow = true;
    root.add(pier);
    occluders.push(pier);
    colliders.push({ kind: 'box', x: a.x, z: a.z, yaw: 0, hx, hz, top: 6.3 });
  }
  cWall(W.x0, CISTERN.gate.x0, W.z0 - CISTERN.wall, W.z0);
  cWall(CISTERN.gate.x1, W.x1, W.z0 - CISTERN.wall, W.z0);
  cWall(SHELF.x0, SHELF.x1, SHELF.z0, SHELF.z1);
  const gateAt = ash(0, W.z0 - T2);
  const cGate = new THREE.Mesh(new THREE.BoxGeometry(CISTERN.gate.x1 - CISTERN.gate.x0, CISTERN.wallTop + 1.3, CISTERN.wall * 0.6), marsh(0x5a4636));
  cGate.position.set(gateAt.x, -4, gateAt.z);
  root.add(cGate);
  const gateCol: Extract<Collider, { kind: 'box' }> = { kind: 'box', x: gateAt.x, z: gateAt.z, yaw: 0, hx: (CISTERN.gate.x1 - CISTERN.gate.x0) / 2, hz: T2, top: -100 };
  colliders.push(gateCol);
  // a ramp from the gate down to the cistern floor, walkable when drained
  for (let i = 0; i < 4; i++) {
    const r = ash(0, W.z0 + 0.4 + i * 0.7);
    const top = -0.2 - i * 0.25;
    colliders.push({ kind: 'box', x: r.x, z: r.z, yaw: 0, hx: 2.0, hz: 0.35, top });
    const step = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.3, 0.7), slate);
    step.position.set(r.x, top - 0.15, r.z);
    root.add(step);
  }

  // ---- the sill between the channel's reaches (slate, a culvert mouth on its west face) and the west reach's
  // north-bank reed thicket (a wall of cut reed bundles the fox cannot climb)
  {
    const a = ash(0, (WATER.channel.z0 + WATER.channel.z1) / 2);
    const len = WATER.channel.z1 - WATER.channel.z0 + 2;
    const sill = new THREE.Mesh(new THREE.BoxGeometry(SILL.x1 - SILL.x0, 1.2, len), slate);
    sill.position.set(a.x, SILL.top - 0.6, a.z);
    root.add(sill);
    colliders.push({ kind: 'box', x: a.x, z: a.z, yaw: 0, hx: (SILL.x1 - SILL.x0) / 2, hz: len / 2, top: SILL.top });
    const t = ash((THICKET.x0 + THICKET.x1) / 2, (THICKET.z0 + THICKET.z1) / 2);
    colliders.push({ kind: 'box', x: t.x, z: t.z, yaw: 0, hx: (THICKET.x1 - THICKET.x0) / 2, hz: (THICKET.z1 - THICKET.z0) / 2, top: THICKET.top });
    const stalk = new THREE.ConeGeometry(0.07, 2.6, 4).translate(0, 1.0, 0);
    const n = Math.round((THICKET.x1 - THICKET.x0) * 5);
    const wall = new THREE.InstancedMesh(stalk, marsh(C.reedDry), n);
    for (let i = 0; i < n; i++) {
      const x = ASH_ORIGIN.x + THICKET.x0 + rand() * (THICKET.x1 - THICKET.x0);
      const z = ASH_ORIGIN.z + THICKET.z0 + rand() * (THICKET.z1 - THICKET.z0);
      p.set(x, H(x, z) - 0.1, z);
      e.set((rand() - 0.5) * 0.25, rand() * 6, (rand() - 0.5) * 0.25);
      q.setFromEuler(e);
      sc.set(1, 0.8 + rand() * 0.5, 1);
      wall.setMatrixAt(i, m4.compose(p, q, sc));
    }
    root.add(wall);
  }

  // ---- the drowned roof in the channel's west reach: a slate ridge and a chimney, dry once the sluice runs
  {
    const at = ash(SECRETS.roof.lx, SECRETS.roof.lz);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(3.2, 1.6, 4).rotateY(Math.PI / 4).scale(1, 1, 0.6), marsh(0x47545e));
    roof.position.set(at.x, -0.55, at.z - 1.2);
    const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.4, 0.5), slate);
    chimney.position.set(at.x + 1.2, 0.0, at.z - 1.0);
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.12, 1.4), timber);
    door.position.set(at.x - 0.6, -0.95, at.z + 1.4);
    door.rotation.y = 0.4;
    root.add(roof, chimney, door);
    occluders.push(roof, chimney);
    colliders.push({ kind: 'box', x: roof.position.x, z: roof.position.z, yaw: 0, hx: 2.0, hz: 1.2, top: 0.2 });
  }
  // the Ferrykeeper's mooring on the islet: a lantern that still burns on its stake
  {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.34, 0.28), new THREE.MeshBasicMaterial({ color: C.lantern, toneMapped: false }));
    lamp.position.set(isletAt.x + 1.6, H(isletAt.x + 1.6, isletAt.z) + 2.25, isletAt.z);
    root.add(lamp);
  }

  // ---- the rig
  const say = (t: string) => ctx.captions.say(t);
  const rig: AshRig = {
    fox: ctx.fox.root,
    motion: () => ctx.player?.motion ?? null,
    hasReedskim: opts.hasReedskim,
    teleport: (x, z, yaw) => ctx.player?.teleport(x, z, yaw),
    teach: ctx.teach.offer,
    events: {
      place: () => say('Where the flood was always meant to go.'),
      secret: (which) => {
        // the Album's page toast speaks the place's line (no caption on top of it)
        if (opts.onSecret) opts.onSecret(which === 0 ? 'ashwater-roof' : 'ashwater-mooring');
        else say(which === 0 ? 'A home, under the reeds.' : 'The last ferry never left.');
      },
      burstA: () => {
        ctx.audio.cue('millrace-burst');
        say('The low sluice runs again.');
      },
      burstA2: () => {
        ctx.audio.cue('millrace-burst');
        say('The east reach falls quiet.');
      },
      burstB: () => {
        ctx.audio.cue('millrace-burst');
        say('The mill pool lets go.');
      },
      burstC: () => {
        ctx.audio.cue('millrace-burst');
        say('The race floods the cistern.');
      },
      complete: (level) => {
        opts.complete(LEVEL_IDS[level]);
        if (level === 0) say('The reeds will hold you now.');
        if (level === 1) say('The Ferrykeeper still waits.');
        if (level === 2) {
          ctx.audio.cue('finale-kindle');
          // (the Album's page toast carries the revelation line; the caption names the place)
          say('The Reed Seedwell fills.');
        }
      },
      splash: () => ctx.audio.play('soft-paper', { at: ctx.fox.root.position.clone(), gain: 0.1, rate: 0.6 }),
    },
    waterMesh: water,
    flow,
    flowMat,
    flowTex,
    soak,
    damA: damA.g,
    damA2: damA2.g,
    damA2Col: damA2.col,
    damB: damB.g,
    damC: damC.g,
    damACol: damA.col,
    damBCol: damB.col,
    damCCol: damC.col,
    punt,
    puntCol,
    cGate,
    gateCol,
    mats,
    matCols,
    matLoad: new Float32Array(MATS.length),
    glow,
    glowMat,
    heron,
    heronMat,
    heronCol,
    safe: new THREE.Vector3(spawnAt.x, 0, spawnAt.z),
    s: { burstA: -1, burstA2: -1, burstB: -1, burstC: -1, channelY: WATER.channel.full, channelEY: WATER.channelE.full, poolY: WATER.pool.full, matK: 0, glowK: 0, done: 0, safeYaw: ASH_SPAWN.yaw, splashes: 0, inMarsh: 0, heronT: 0, heronY: heron.position.y, heronZ: heron.position.z, clock: 0, lastSplash: -9, secrets: 0, places: 0 },
  };
  // a saved game re-enters the marsh as it was left: drained channel / pool, burst dams, a lit Seedwell (no captions)
  const was = (l: (typeof LEVEL_IDS)[number]) => opts.isRestored?.(l) ?? false;
  if (was('teach')) {
    rig.s.burstA = 999;
    rig.s.places |= 1;
    rig.s.burstA2 = 999;
    damA2.col.r = 0.001;
    rig.s.done |= 1;
    damA.col.r = 0.001;
  }
  if (was('develop')) rig.s.done |= 2;
  if (opts.secretFound?.('ashwater-roof')) rig.s.secrets |= 1;
  if (opts.secretFound?.('ashwater-mooring')) rig.s.secrets |= 2;
  if (was('combine')) {
    rig.s.burstB = 999;
    rig.s.done |= 4;
    rig.s.glowK = 1;
    // the Ferrykeeper already flew
    rig.s.heronT = 99;
    damB.col.r = 0.001;
  }
  ctx.onUpdate((dt) => updateAshwater(rig, dt));

  return {
    occluders,
    spawn: { x: spawnAt.x, z: spawnAt.z, yaw: ASH_SPAWN.yaw },
    state: () => ({
      damA: rig.s.burstA >= 0, damA2: rig.s.burstA2 >= 0, damB: rig.s.burstB >= 0, flood: rig.s.burstC >= 0, channelY: +rig.s.channelY.toFixed(2), poolY: +rig.s.poolY.toFixed(2), gullyRun: +rig.flowMat.opacity.toFixed(2), soakY: +rig.soak.position.y.toFixed(2),
      secrets: rig.s.secrets, places: rig.s.places, mats: +Math.min(1, rig.s.matK).toFixed(2), done: LEVEL_IDS.filter((_, i) => (rig.s.done & (1 << i)) !== 0), splashes: rig.s.splashes, glow: +rig.s.glowK.toFixed(2),
    }),
  };
}

export type Ashwater = ReturnType<typeof buildAshwater>;
