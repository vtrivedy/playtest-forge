/**
 * Kickable leaf piles (DESIGN-leaf-piles.md): mounded piles of fallen maple leaves beside the paths. Run through
 * one and it bursts into a swirl of leaves that flutter down where they fall; a dash kicks harder. Scattered leaves
 * can be kicked again. A toy: no colliders, no counter.
 */
import * as THREE from 'three';
import { toon } from '../lookdevKit';
import type { OpeningCtx } from './scene';
import { LEAF_PILES } from './layout';

export const LEAF_FEEL = {
  /** leaves per pile, pile radius (m), mound height (m) */
  perPile: 70,
  radius: 0.65,
  height: 0.28,
  /** fox speed (m/s) that kicks; reach (m) running / dashing */
  minSpeed: 2.2,
  reach: 0.8,
  dashReach: 1.4,
  /** launch: outward and up speeds (m/s) at a run; dash multiplier */
  out: [1.2, 2.6] as const,
  up: [2.8, 4.6] as const,
  dash: 1.6,
  /** a landing faster than this (m/s) puffs the leaves within landReach, at strength land */
  landSpeed: 4,
  landReach: 1.5,
  land: 1.3,
  /** falling: drag toward a slow terminal flutter (m/s) and a side sway */
  terminal: 0.75,
  sway: 0.8,
};
/** a sharp-notched five-lobed maple leaf with a stem, flat in xz (reads as a leaf, not a confetti pentagon) */
function leafGeometry(size: number): THREE.BufferGeometry {
  const P = [[0, 0.26], [0.055, 0.13], [0.17, 0.2], [0.14, 0.07], [0.27, 0.08], [0.19, -0.03], [0.25, -0.1], [0.07, -0.13], [0.025, -0.17], [0.012, -0.3], [-0.012, -0.3], [-0.025, -0.17], [-0.07, -0.13], [-0.25, -0.1], [-0.19, -0.03], [-0.27, 0.08], [-0.14, 0.07], [-0.17, 0.2], [-0.055, 0.13]];
  const sh = new THREE.Shape();
  P.forEach(([x, y], i) => (i ? sh.lineTo(x! * size * 3.7, y! * size * 3.7) : sh.moveTo(x! * size * 3.7, y! * size * 3.7)));
  sh.closePath();
  const g = new THREE.ShapeGeometry(sh);
  g.rotateX(-Math.PI / 2);
  return g;
}
const COLOURS = [0xb4502e, 0xc8763c, 0x9a4a2a, 0xd09040, 0x8a5a34, 0xa83c24];

export function buildLeafPiles(ctx: OpeningCtx, piles: ReadonlyArray<{ x: number; z: number }> = LEAF_PILES) {
  const { scene, rand, groundH } = ctx;
  const F = LEAF_FEEL;
  const N = piles.length * F.perPile;
  const mat = toon(0xffffff);
  mat.side = THREE.DoubleSide;
  const mesh = new THREE.InstancedMesh(leafGeometry(0.1), mat, N);
  mesh.frustumCulled = false;
  mesh.receiveShadow = true;
  scene.add(mesh);
  const col = new THREE.Color();
  // per leaf: position, velocity, rotation (euler), spin, resting flag, sway phase
  const pos = new Float32Array(N * 3);
  const vel = new Float32Array(N * 3);
  const rot = new Float32Array(N * 3);
  const spin = new Float32Array(N * 3);
  const resting = new Uint8Array(N).fill(1);
  const phase = new Float32Array(N);
  let i = 0;
  for (const p of piles) {
    for (let k = 0; k < F.perPile; k++, i++) {
      const a = rand() * Math.PI * 2;
      const r = Math.sqrt(rand()) * F.radius;
      const x = p.x + Math.cos(a) * r;
      const z = p.z + Math.sin(a) * r;
      const mound = F.height * (1 - (r / F.radius) ** 2) * (0.6 + 0.4 * rand());
      pos.set([x, groundH(x, z) + 0.02 + mound, z], i * 3);
      rot.set([(rand() - 0.5) * 0.9, rand() * 6.28, (rand() - 0.5) * 0.9], i * 3);
      phase[i] = rand() * 6.28;
      mesh.setColorAt(i, col.setHex(COLOURS[Math.floor(rand() * COLOURS.length)]!));
    }
  }
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const one = new THREE.Vector3(1, 1, 1);
  const v3 = new THREE.Vector3();
  const write = (j: number) => {
    v3.set(pos[j * 3]!, pos[j * 3 + 1]!, pos[j * 3 + 2]!);
    q.setFromEuler(e.set(rot[j * 3]!, rot[j * 3 + 1]!, rot[j * 3 + 2]!));
    mesh.setMatrixAt(j, m4.compose(v3, q, one));
  };
  for (let j = 0; j < N; j++) write(j);
  mesh.instanceMatrix.needsUpdate = true;

  let kicks = 0;
  let lastSound = -1;
  let clock = 0;
  let flying = 0;
  let wasGrounded = true;
  let fallSpeed = 0;
  ctx.onUpdate((dt) => {
    clock += dt;
    const st = ctx.player?.state() as { speed?: number; dashing?: boolean; grounded?: boolean; vel?: number[] } | undefined;
    const fox = ctx.fox.root.position;
    const speed = Math.hypot(st?.vel?.[0] ?? 0, st?.vel?.[2] ?? 0);
    const dashing = !!st?.dashing;
    let launched = 0;
    // a hard landing puffs the leaves out all round the paws (off the canopy, a heron fling, a long glide)
    const grounded = st?.grounded ?? true;
    const landed = grounded && !wasGrounded && fallSpeed > F.landSpeed;
    if (!grounded) fallSpeed = Math.max(0, -(st?.vel?.[1] ?? 0));
    wasGrounded = grounded;
    if (speed > F.minSpeed || dashing || landed) {
      const reach = landed ? F.landReach : dashing ? F.dashReach : F.reach;
      const k = landed ? F.land : dashing ? F.dash : 1;
      for (let j = 0; j < N; j++) {
        if (!resting[j]) continue;
        const dx = pos[j * 3]! - fox.x;
        const dz = pos[j * 3 + 2]! - fox.z;
        const d = Math.hypot(dx, dz);
        if (d > reach || Math.abs(pos[j * 3 + 1]! - fox.y) > 1.2) continue;
        // away from the fox, biased along its travel, and up
        const ox = d > 1e-3 ? dx / d : rand() - 0.5;
        const oz = d > 1e-3 ? dz / d : rand() - 0.5;
        const tx = (st?.vel?.[0] ?? 0) / Math.max(speed, 1e-3);
        const tz = (st?.vel?.[2] ?? 0) / Math.max(speed, 1e-3);
        const out = (F.out[0] + rand() * (F.out[1] - F.out[0])) * k;
        vel[j * 3] = (ox * 0.7 + tx * 0.5) * out;
        vel[j * 3 + 1] = (F.up[0] + rand() * (F.up[1] - F.up[0])) * Math.sqrt(k);
        vel[j * 3 + 2] = (oz * 0.7 + tz * 0.5) * out;
        spin.set([(rand() - 0.5) * 14, (rand() - 0.5) * 10, (rand() - 0.5) * 14], j * 3);
        resting[j] = 0;
        launched++;
        flying++;
      }
    }
    if (launched >= 6) {
      kicks++;
      if (clock - lastSound > 0.4) {
        lastSound = clock;
        ctx.audio.play('soft-leaf', { at: fox.clone(), gain: 0.12 + Math.min(0.1, launched * 0.002), rate: 0.9 + rand() * 0.2 });
      }
    }
    if (!flying) return;
    for (let j = 0; j < N; j++) {
      if (resting[j]) continue;
      const b = j * 3;
      // heavy air: horizontal drift decays, the fall is capped at a slow flutter that sways side to side
      vel[b] *= Math.exp(-1.2 * dt);
      vel[b + 2] *= Math.exp(-1.2 * dt);
      vel[b + 1] -= 9.8 * dt;
      if (vel[b + 1]! < -F.terminal) vel[b + 1] = THREE.MathUtils.damp(vel[b + 1]!, -F.terminal, 8, dt);
      const falling = vel[b + 1]! < 0 ? 1 : 0;
      const sw = Math.sin(clock * 3.2 + phase[j]!) * F.sway * falling;
      pos[b] += (vel[b]! + sw * Math.cos(phase[j]!)) * dt;
      pos[b + 1] += vel[b + 1]! * dt;
      pos[b + 2] += (vel[b + 2]! + sw * Math.sin(phase[j]!)) * dt;
      rot[b] += spin[b]! * dt;
      rot[b + 1] += spin[b + 1]! * dt;
      rot[b + 2] += spin[b + 2]! * dt;
      const g = groundH(pos[b]!, pos[b + 2]!) + 0.02;
      if (pos[b + 1]! <= g && vel[b + 1]! <= 0) {
        // settle flat on the ground, a little askew
        pos[b + 1] = g;
        rot[b] = (rand() - 0.5) * 0.3;
        rot[b + 2] = (rand() - 0.5) * 0.3;
        resting[j] = 1;
        flying--;
      }
      write(j);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return { state: () => ({ piles: piles.length, kicks, flying }) };
}
