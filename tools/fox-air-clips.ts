/** Re-author the fox air arc clips in assets/hero/spirit_fox.glb (DESIGN-loco-flow.md §P0.1).
 *
 *   npx tsx tools/fox-air-clips.ts [--rev f973fd3] [--out assets/hero/spirit_fox.glb] [--dry]
 *
 * jump_up / jump_apex / jump_fall / land are resampled at 60 fps from the authored source clip and reshaped with
 * world-pitch layers (Blender `wrot` idiom) and pelvis translation, keyed over normalized clip time. Only those four
 * animations get new samplers; mesh, skin, FX bone tracks and every other clip are byte-identical. The source is always
 * the authored GLB at git `--rev` (the last pre-edit Blender bake), so re-running to tune never compounds edits. */
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FOX_RIG } from '../games/fox-spirit/src/foxRig';
Object.assign(globalThis, { self: globalThis, ProgressEvent: class extends Event { constructor(type: string, init: Record<string, unknown>) { super(type); Object.assign(this, init); } } });

const arg = (k: string, d: string) => process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : d;
const rev = arg('--rev', 'f973fd3'), out = arg('--out', 'assets/hero/spirit_fox.glb');
const FPS = 60;

const bytes = execFileSync('git', ['show', `${rev}:assets/hero/spirit_fox.glb`], { maxBuffer: 1 << 28 });
const jsonLength = bytes.readUInt32LE(12);
const doc = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
const binLength = bytes.readUInt32LE(20 + jsonLength);
const bin = bytes.subarray(28 + jsonLength, 28 + jsonLength + binLength);

// Load a material-free copy for posing.
const light = JSON.parse(JSON.stringify(doc));
light.buffers[0].uri = `data:application/octet-stream;base64,${bin.toString('base64')}`;
delete light.images; delete light.textures; delete light.samplers; delete light.materials;
for (const mesh of light.meshes) for (const primitive of mesh.primitives) delete primitive.material;
const gltf = await new GLTFLoader().parseAsync(JSON.stringify(light), '');
const scene = gltf.scene;
scene.updateMatrixWorld(true);
const box = new THREE.Box3().setFromObject(scene);
const metre = (box.max.y - box.min.y) / 1.25; // game height is 1.25 m
const bone = (n: string) => { const b = scene.getObjectByName(n); if (!b) throw new Error(`bone ${n} missing`); return b; };
const facing = Math.sign(bone(FOX_RIG.head).getWorldPosition(new THREE.Vector3()).z - bone(FOX_RIG.pelvis).getWorldPosition(new THREE.Vector3()).z);

// ---- pose edit helpers (actor frame: +Y up, fox faces `facing`·Z) ----
const X = new THREE.Vector3(1, 0, 0);
/** Swing a bone about the actor's lateral axis. +deg swings a downward-hanging bone backward (toward the tail). */
function pitch(name: string, deg: number) {
  if (Math.abs(deg) < 1e-4) return;
  const b = bone(name); b.updateWorldMatrix(true, false);
  const parent = b.parent!.getWorldQuaternion(new THREE.Quaternion());
  const world = b.getWorldQuaternion(new THREE.Quaternion());
  const r = new THREE.Quaternion().setFromAxisAngle(X, THREE.MathUtils.degToRad(deg * facing));
  b.quaternion.copy(parent.invert().multiply(r.multiply(world)));
  b.updateWorldMatrix(false, true);
}
/** Move a bone in actor space (metres, +y up, +z forward). */
function shift(name: string, y: number, z = 0) {
  const b = bone(name); b.updateWorldMatrix(true, false);
  const world = b.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, y * metre, z * metre * facing));
  b.position.copy(b.parent!.worldToLocal(world));
  b.updateWorldMatrix(false, true);
}
type Legs = { arm: number; fore: number; wrist: number; thigh: number; shin: number; hock: number; toe: number };
const ZERO: Legs = { arm: 0, fore: 0, wrist: 0, thigh: 0, shin: 0, hock: 0, toe: 0 };
const mix = (a: Legs, b: Legs, t: number) => Object.fromEntries(Object.keys(a).map((k) => [k, a[k as keyof Legs] + (b[k as keyof Legs] - a[k as keyof Legs]) * t])) as Legs;
const scale = (a: Legs, k: number) => mix(ZERO, a, k);
function legs(l: Legs) {
  for (const s of ['l', 'r'] as const) {
    const f = FOX_RIG.foreleg(s), h = FOX_RIG.hindleg(s);
    pitch(f.upper, l.arm); pitch(f.lower, l.fore); pitch(f.paw, l.wrist);
    pitch(h.thigh, l.thigh); pitch(h.shin, l.shin); pitch(h.foot, l.hock); pitch(h.paw, l.toe);
  }
}
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeOut = (x: number) => 1 - (1 - clamp01(x)) ** 2;
const smooth = (x: number) => { const t = clamp01(x); return t * t * (3 - 2 * t); };

/** Air poses (degrees). TUCK = gathered hang: fores folded under the chest, hinds drawn forward under the belly.
 * REACH = fores reaching forward-down for the ground, hinds streaming back. PUSH = takeoff stretch. */
const TUCK: Legs = { arm: 4, fore: 96, wrist: 48, thigh: -58, shin: 44, hock: -26, toe: 20 };
const REACH: Legs = { arm: -26, fore: 4, wrist: 16, thigh: 18, shin: 4, hock: 16, toe: 10 };
const PUSH: Legs = { arm: -18, fore: 72, wrist: 40, thigh: 8, shin: -12, hock: 10, toe: 14 };

type Edit = { name: string; duration: number; sourceTime: (u: number, sourceDuration: number) => number; pose: (u: number) => void };
const EDITS: Edit[] = [
  { // anticipation: crouch deepens (easeOut, first ~half = the grounded windup), then hinds drive back + fores lift and fold.
    name: 'jump_up', duration: .2, sourceTime: (u, d) => u * d,
    pose(u) {
      const crouch = u < .45 ? easeOut(u / .45) : 1 - smooth((u - .45) / .25);
      const push = smooth((u - .4) / .5);
      shift(FOX_RIG.pelvis, -.06 * crouch);
      pitch(FOX_RIG.spine[3], 5 * crouch); pitch(FOX_RIG.neck[0], -4 * crouch);
      legs(mix(scale({ ...ZERO, thigh: -8, shin: 10, hock: -8, arm: 6, fore: 8 }, crouch), PUSH, push));
    } },
  { // gathered hang (loop): a slow breath of the tuck, never straight-down legs.
    name: 'jump_apex', duration: .5, sourceTime: (u, d) => u * d,
    pose(u) {
      const g = 1 + .1 * Math.sin(2 * Math.PI * u);
      legs(scale(TUCK, g));
    } },
  { // fall: tuck unfolds into the landing reach.
    name: 'jump_fall', duration: .4, sourceTime: (u, d) => u * d,
    pose(u) { legs(mix(TUCK, REACH, smooth(u / .8))); } },
  { // land: starts already compressing from the reach (authored frame 0 stood up), absorbs by ~0.07 s, recovers by 0.3 s.
    name: 'land', duration: .3, sourceTime: (u, d) => (.2 + .8 * u) * d,
    pose(u) {
      const absorb = u < .22 ? easeOut(u / .22) : 1 - smooth((u - .22) / .7);
      const reach = 1 - smooth(u / .35);
      shift(FOX_RIG.pelvis, -.05 * absorb);
      pitch(FOX_RIG.spine[3], 4 * absorb);
      legs(mix(scale({ ...ZERO, arm: 4, fore: 10, wrist: -6, thigh: -6, shin: 8, hock: -6 }, absorb), scale(REACH, .6), reach * .5));
    } },
];

// ---- resample + write ----
const fxNodes = new Set<string>(FOX_RIG.fx);
const nodeNames: string[] = doc.nodes.map((n: { name?: string }) => n.name ?? '');
const extra: Buffer[] = [];
let tail = binLength + ((4 - (binLength % 4)) % 4);
const pushAccessor = (data: Float32Array, type: 'SCALAR' | 'VEC3' | 'VEC4', minmax = false) => {
  const buf = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  doc.bufferViews.push({ buffer: 0, byteOffset: tail, byteLength: buf.length });
  extra.push(buf); tail += buf.length;
  const accessor: Record<string, unknown> = { bufferView: doc.bufferViews.length - 1, componentType: 5126, count: data.length / ({ SCALAR: 1, VEC3: 3, VEC4: 4 })[type], type };
  if (minmax) { accessor.min = [Math.min(...data)]; accessor.max = [Math.max(...data)]; }
  doc.accessors.push(accessor);
  return doc.accessors.length - 1;
};
for (const edit of EDITS) {
  const anim = doc.animations.find((a: { name: string }) => a.name === edit.name);
  const clip = gltf.animations.find((c) => c.name === edit.name);
  if (!anim || !clip) throw new Error(`clip ${edit.name} missing`);
  // Sample tracks directly: the mixer skips re-writing constant tracks, which would compound the edits.
  const tracks = clip.tracks.map((t) => {
    const [node, prop] = t.name.split('.');
    return { target: (bone(node) as unknown as Record<string, { fromArray(a: ArrayLike<number>): void }>)[prop], interpolant: (t as THREE.KeyframeTrack & { createInterpolant(): THREE.Interpolant }).createInterpolant() };
  });
  const n = Math.round(edit.duration * FPS) + 1;
  const times = new Float32Array(n);
  const channels = (anim.channels as { sampler: number; target: { node: number; path: string } }[])
    .filter((c) => !fxNodes.has(nodeNames[c.target.node]) && (c.target.path === 'rotation' || c.target.path === 'translation'));
  const data = channels.map((c) => new Float32Array(n * (c.target.path === 'rotation' ? 4 : 3)));
  let lowest = Infinity, lowestAt = 0;
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    times[i] = u * edit.duration;
    const t = Math.min(clip.duration, edit.sourceTime(u, clip.duration));
    for (const tr of tracks) tr.target.fromArray(tr.interpolant.evaluate(t));
    scene.updateMatrixWorld(true);
    edit.pose(u);
    scene.updateMatrixWorld(true);
    const py = bone(FOX_RIG.pelvis).getWorldPosition(new THREE.Vector3()).y;
    if (py < lowest) { lowest = py; lowestAt = times[i]; }
    channels.forEach((c, k) => {
      const b = bone(nodeNames[c.target.node]);
      (c.target.path === 'rotation' ? b.quaternion : b.position).toArray(data[k], i * (c.target.path === 'rotation' ? 4 : 3));
    });
  }
  // Keep quaternion keys on one hemisphere so LINEAR interpolation never takes the long way.
  channels.forEach((c, k) => {
    if (c.target.path !== 'rotation') return;
    const d = data[k];
    for (let i = 1; i < n; i++) if (d[i * 4] * d[i * 4 - 4] + d[i * 4 + 1] * d[i * 4 - 3] + d[i * 4 + 2] * d[i * 4 - 2] + d[i * 4 + 3] * d[i * 4 - 1] < 0)
      for (let j = 0; j < 4; j++) d[i * 4 + j] *= -1;
  });
  const input = pushAccessor(times, 'SCALAR', true);
  channels.forEach((c, k) => {
    anim.samplers.push({ input, output: pushAccessor(data[k], c.target.path === 'rotation' ? 'VEC4' : 'VEC3'), interpolation: 'LINEAR' });
    c.sampler = anim.samplers.length - 1;
  });
  // FX tracks keep their authored samplers; stretch nothing (they loop on their own clip time).
  console.log(`${edit.name}: ${n} keys / ${edit.duration}s, ${channels.length} bone channels, pelvis lowest ${((lowest - box.min.y) / metre).toFixed(3)} m at ${lowestAt.toFixed(3)} s`);
}
// Drop samplers no channel references any more (accessors stay; a few hundred bytes).
for (const anim of doc.animations) {
  const used = [...new Set((anim.channels as { sampler: number }[]).map((c) => c.sampler))].sort((a, b) => a - b);
  const remap = new Map(used.map((s, i) => [s, i]));
  anim.samplers = used.map((s) => anim.samplers[s]);
  for (const c of anim.channels) c.sampler = remap.get(c.sampler);
}
const newBin = Buffer.concat([bin, Buffer.alloc((4 - (binLength % 4)) % 4), ...extra]);
const pad4 = (b: Buffer, fill: number) => Buffer.concat([b, Buffer.alloc((4 - (b.length % 4)) % 4, fill)]);
const binChunk = pad4(newBin, 0);
doc.buffers[0].byteLength = newBin.length;
const jsonChunk = pad4(Buffer.from(JSON.stringify(doc)), 0x20);
const header = Buffer.alloc(12); header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4);
header.writeUInt32LE(12 + 8 + jsonChunk.length + 8 + binChunk.length, 8);
const chunk = (type: number, body: Buffer) => { const h = Buffer.alloc(8); h.writeUInt32LE(body.length, 0); h.writeUInt32LE(type, 4); return Buffer.concat([h, body]); };
if (!process.argv.includes('--dry')) {
  fs.writeFileSync(out, Buffer.concat([header, chunk(0x4e4f534a, jsonChunk), chunk(0x004e4942, binChunk)]));
  console.log(`wrote ${out}`);
}
