// Static free-play sweep of the opening slice: builds meadow + village colliders headless, flood-fills
// walkable cells from the spawn (step 0.22 m, jump +0.7 m, drops free) and reports pockets you can enter
// but not walk/jump back out of, plus whether the shelf top is reachable only via the updraft.
//   npx tsx tools/opening-walk-sweep.ts
import * as THREE from 'three';
import { buildMeadow } from '../games/fox-spirit/src/opening/meadow';
import { buildVillage } from '../games/fox-spirit/src/opening/village';
import { groundH, SPAWN, BOUNDS, SHELF } from '../games/fox-spirit/src/opening/layout';
import type { Collider } from '../games/fox-spirit/src/lookdevPlay';
import { rng } from '../games/fox-spirit/src/lookdevKit';

function top(c: Collider, x: number, z: number): number {
  const dx = x - c.x, dz = z - c.z;
  if (c.kind === 'post') return dx * dx + dz * dz < c.r * c.r ? Infinity : -Infinity;
  if (c.kind === 'cap') { const k = 1 - (dx * dx + dz * dz) / (c.r * c.r); return k > 0 ? c.base + c.h * Math.sqrt(k) : -Infinity; }
  const cos = Math.cos(c.yaw), sin = Math.sin(c.yaw);
  const lx = dx * cos - dz * sin, lz = dx * sin + dz * cos;
  return Math.abs(lx) < c.hx && Math.abs(lz) < c.hz ? c.top : -Infinity;
}
const ctx: any = { scene: new THREE.Scene(), rand: rng(11), groundH, colliders: [] as Collider[], cutout: [], occluders: [], onUpdate() {} };
buildMeadow(ctx);
buildVillage(ctx);
const cols: Collider[] = ctx.colliders;
const surf = (x: number, z: number) => { let y = groundH(x, z); for (const c of cols) y = Math.max(y, top(c, x, z)); return y; };
const S = 0.25, x0 = BOUNDS.cx - BOUNDS.rx * 1.1, z0 = BOUNDS.cz - BOUNDS.rz * 1.1;
const NX = Math.ceil((BOUNDS.rx * 2.2) / S), NZ = Math.ceil((BOUNDS.rz * 2.2) / S);
const H = new Float32Array(NX * NZ);
for (let i = 0; i < NX; i++) for (let j = 0; j < NZ; j++) H[i * NZ + j] = surf(x0 + i * S, z0 + j * S);
const idx = (x: number, z: number) => Math.round((x - x0) / S) * NZ + Math.round((z - z0) / S);
function fill(start: number[], climb: number, rev = false): Uint8Array {
  const seen = new Uint8Array(NX * NZ); const q = [...start]; for (const s of q) seen[s] = 1;
  while (q.length) {
    const a = q.pop()!; const ai = Math.floor(a / NZ), aj = a % NZ;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const bi = ai + di, bj = aj + dj; if (bi < 0 || bj < 0 || bi >= NX || bj >= NZ) continue;
      const b = bi * NZ + bj; if (seen[b] || !Number.isFinite(H[b]!)) continue;
      const ok = rev ? H[a]! <= H[b]! + climb : H[b]! <= H[a]! + climb;
      if (ok) { seen[b] = 1; q.push(b); }
    }
  }
  return seen;
}
const spawn = idx(SPAWN.x, SPAWN.z);
const reach = fill([spawn], 0.7);
const back = fill([spawn], 0.7, true);
let pockets = 0; const ex: string[] = [];
for (let k = 0; k < NX * NZ; k++) if (reach[k] && !back[k]) { pockets++; if (ex.length < 12) ex.push(`(${(x0 + Math.floor(k / NZ) * S).toFixed(1)},${(z0 + (k % NZ) * S).toFixed(1)}) y${H[k]!.toFixed(2)}`); }
let n = 0; for (const r of reach) n += r;
console.log(`cells reachable ${n}, soft-lock pockets ${pockets}`, ex.join(' '));
console.log('shelf top reachable without updraft:', !!reach[idx(SHELF.x, SHELF.z)]);
