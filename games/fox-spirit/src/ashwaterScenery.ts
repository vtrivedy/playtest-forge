/**
 * Ashwater Reach, set to the bible (refs/bible/bible-ashwater.jpg, DESIGN-sumiro-look.md Ashwater shots): heavy
 * grass tussocks on the banks, mossy stones where the water meets them, the drawn ground falling away past the rim,
 * and the overcast painted horizon (its tree clumps are painted: modelled ones read as lollipops in the rain fog). Scenery only: nothing here collides, and it keeps off every collider, water
 * body and puzzle piece Cedar's ashwater.ts registered. Build-time code.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rng } from './lookdevKit';
import type { OpeningCtx } from './opening/scene';
import { ASH_ORIGIN, E, H, waterAt } from './opening/ashwaterLayout';
import { inkWash } from './inkWash';
import { paintedBackdrop } from './paperBackdrop';
import type { Collider } from './lookdevPlay';

const { smoothstep } = THREE.MathUtils;

/**
 * Ashwater's ground as drawn. Where anything walks (the mask stops at E 1) it is the terrain H, so feet, camera and lint
 * agree; past E 3 the reed bank crests and falls away to the flooded flats, instead of H's rim climbing into a 30 m
 * wall that cut the rain sky off in a bowl. The backdrop's mist takes over below the horizon.
 */
export function ashVisualH(x: number, z: number): number {
  const e = E(x, z);
  if (e <= 3) return H(x, z);
  const bank = H(x, z) - Math.max(0, e + 5) * 1.6 + 8 * 1.6;
  return bank + 0.8 * smoothstep(e, 3, 5) - 13 * smoothstep(e, 5, 16);
}

/** one tussock: blades fanning from a crown, bent by their own weight; vertex colour dark at the root, straw at tips */
function tussockGeometry(r: () => number): THREE.BufferGeometry {
  const blades: THREE.BufferGeometry[] = [];
  const n = 22 + Math.floor(r() * 14);
  const root = new THREE.Color(0x26301f);
  const mid = new THREE.Color(0x4f5c37);
  const tipC = [new THREE.Color(0x8a8a55), new THREE.Color(0x6d7a45), new THREE.Color(0x9a8f5e)];
  const c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const h = 0.45 + r() * 0.75;
    const g = new THREE.PlaneGeometry(0.05, h, 1, 4).translate(0, h / 2, 0);
    const pos = g.getAttribute('position') as THREE.BufferAttribute;
    const col = new Float32Array(pos.count * 3);
    const lean = 0.25 + r() * 0.6;
    const tip = tipC[Math.floor(r() * 3)]!;
    for (let k = 0; k < pos.count; k++) {
      const t = pos.getY(k) / h;
      // taper to a point and droop
      pos.setX(k, pos.getX(k) * (1 - t));
      pos.setZ(k, lean * t * t * h);
      c.copy(root).lerp(mid, Math.min(1, t * 2)).lerp(tip, Math.max(0, t * 1.4 - 0.4));
      col.set([c.r, c.g, c.b], k * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.rotateY(r() * Math.PI * 2);
    g.translate((r() - 0.5) * 0.3, 0, (r() - 0.5) * 0.3);
    blades.push(g);
  }
  const m = mergeGeometries(blades)!;
  m.computeVertexNormals();
  return m;
}

/** a rounded stream stone, flattened, lumpy */
function stoneGeometry(r: () => number): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(1, 2);
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const s = r() * 9;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const k = 1 + 0.14 * Math.sin(x * 3 + s) * Math.sin(z * 2.6 - s) + 0.08 * Math.sin(y * 4 + s);
    pos.setXYZ(i, x * k, Math.max(y * k * 0.55, -0.2), z * k * (0.8 + 0.3 * Math.sin(s)));
  }
  g.computeVertexNormals();
  return g;
}

/** horizontal clearance from a point to a registered collider (m) */
function clearance(c: Collider, x: number, z: number): number {
  if (c.kind === 'post') return Math.hypot(x - c.x, z - c.z) - c.r;
  if (c.kind === 'cap') return Math.hypot(x - c.x, z - c.z) - c.r;
  const dx = x - c.x;
  const dz = z - c.z;
  const cs = Math.cos(c.yaw);
  const sn = Math.sin(c.yaw);
  const lx = Math.abs(dx * cs - dz * sn) - c.hx;
  const lz = Math.abs(dx * sn + dz * cs) - c.hz;
  return Math.hypot(Math.max(lx, 0), Math.max(lz, 0)) + Math.min(Math.max(lx, lz), 0);
}

export function buildAshwaterScenery(ctx: OpeningCtx) {
  const { scene, colliders } = ctx;
  const root = new THREE.Group();
  root.name = 'ashwater-scenery';
  scene.add(root);
  const r = rng(9431);
  const O = ASH_ORIGIN;
  const wet = (x: number, z: number) => waterAt(x, z) !== null || waterAt(x + 1.2, z) !== null || waterAt(x - 1.2, z) !== null || waterAt(x, z + 1.2) !== null || waterAt(x, z - 1.2) !== null;
  const nearWater = (x: number, z: number) => waterAt(x + 3, z) !== null || waterAt(x - 3, z) !== null || waterAt(x, z + 3) !== null || waterAt(x, z - 3) !== null;
  const free = (x: number, z: number, pad: number) => {
    for (const c of colliders) if (clearance(c, x, z) < pad) return false;
    return true;
  };
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const v = new THREE.Vector3();
  const s = new THREE.Vector3();

  // ---- tussocks (shots 1, 3): thick on the banks, sparse on the open moss, never in water or on a puzzle piece
  const grassMat = inkWash(0xffffff, { vertexColors: true, scale: 0.6, tide: 0.2, drip: 0, side: THREE.DoubleSide });
  const kinds = [0, 1, 2, 3].map(() => tussockGeometry(r));
  const per = kinds.map(() => [] as THREE.Matrix4[]);
  for (let i = 0; i < 5000 && per.reduce((a, b) => a + b.length, 0) < 1500; i++) {
    const x = O.x + (r() - 0.5) * 132;
    const z = O.z + (r() - 0.5) * 124;
    if (E(x, z) > -1.5 || wet(x, z)) continue;
    // banks hold most of the grass; the open moss keeps one in four
    if (!nearWater(x, z) && r() > 0.5) continue;
    if (!free(x, z, 1.2)) continue;
    const k = 0.8 + r() * 0.7;
    m4.compose(v.set(x, H(x, z) - 0.05, z), q.setFromEuler(e.set(0, r() * 6.3, 0)), s.set(k, k * (0.8 + r() * 0.5), k));
    per[Math.floor(r() * kinds.length)]!.push(m4.clone());
  }
  kinds.forEach((g, i) => {
    const list = per[i]!;
    if (!list.length) return;
    const im = new THREE.InstancedMesh(g, grassMat, list.length);
    list.forEach((m, j) => im.setMatrixAt(j, m));
    im.receiveShadow = true;
    root.add(im);
  });

  // ---- bank stones (shot 3): mossy stones heaped where the banks meet the water, low enough to step over
  const stoneMat = inkWash(0x5d625c, { scale: 0.9, tide: 0.6, drip: 0.3 });
  const stone = stoneGeometry(r);
  const STONES = 320;
  const stones = new THREE.InstancedMesh(stone, stoneMat, STONES);
  let ns = 0;
  for (let i = 0; i < 4000 && ns < STONES; i++) {
    const x = O.x + (r() - 0.5) * 132;
    const z = O.z + (r() - 0.5) * 124;
    if (E(x, z) > -1 || waterAt(x, z) !== null || !nearWater(x, z) || !free(x, z, 1.0)) continue;
    const k = 0.12 + r() * r() * 0.3;
    m4.compose(v.set(x, H(x, z) - k * 0.2, z), q.setFromEuler(e.set(0, r() * 6.3, 0)), s.set(k * (1 + r() * 0.6), k, k));
    stones.setMatrixAt(ns++, m4);
  }
  stones.count = ns;
  stones.castShadow = true;
  stones.receiveShadow = true;
  root.add(stones);

  const backdrop = paintedBackdrop(scene, 'ashwater');
  return { root, backdrop };
}
