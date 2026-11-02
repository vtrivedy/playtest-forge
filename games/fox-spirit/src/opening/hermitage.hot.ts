/**
 * The Hermitage's drying lines (DESIGN-hermitage.md, tla/Hermitage.tla): the Scribe pegged autumn leaves
 * on three lines to press them flat for the Album. Run or dash under a line and its pegs give: the leaves
 * lift on the ridge wind, turn over, and drift south toward the village. When every line is free the
 * plateau paints. At the desk a caption names the place, once. No per-frame allocation.
 */
import * as THREE from 'three';
import { mapleLeafGeometry, RAMP_WORLD, toon } from '../lookdevKit';
import type { OpeningCtx } from './scene';
import { box, C, cyl, Kit } from './village';
import { HERMITAGE } from './hermitageLayout';

export const DRYING = {
  /** leaves pegged per line, line height (m) */
  perLine: 16,
  height: 1.25,
  /** fox reach to a line (m, xz) and minimum speed (m/s) that frees it */
  reach: 0.85,
  minSpeed: 1.2,
  /** lift, wind toward the village, flutter */
  lift: [2.4, 4.2] as const,
  wind: { x: 0.4, z: -1.9 },
  sway: 0.9,
  terminal: 0.45,
  /** seconds a freed leaf drifts at most (×3) before it settles */
  drift: 26,
  paintR: 22,
  paintSecs: 3.6,
};

export function createDryingLines(ctx: OpeningCtx) {
  const F = DRYING;
  const H = HERMITAGE;
  const { scene, groundH, rand } = ctx;
  const L = H.lines.length;
  const N = L * F.perLine;

  // poles and strings (static)
  const k = new Kit();
  const lineY = new Float32Array(L * 2);
  H.lines.forEach(([ax, az, bx, bz], i) => {
    for (const [x, z, j] of [[ax, az, 0], [bx, bz, 1]] as const) {
      const y = groundH(x, z);
      lineY[i * 2 + j] = y + F.height + 0.1;
      // each pole its own chase-cam fade root: the lens can end up right beside one (Sorrel, 32 s hold)
      const pk = new Kit();
      pk.add(cyl(0.05, 0.06, F.height + 0.3, 6), C.timber, [x, y + (F.height + 0.3) / 2, z], [(rand() - 0.5) * 0.08, 0, (rand() - 0.5) * 0.08], 0.012);
      const pole = pk.build();
      scene.add(pole);
      ctx.occluders.push(pole);
      ctx.colliders.push({ kind: 'post', x, z, r: 0.1 });
    }
    const a = new THREE.Vector3(ax, lineY[i * 2]!, az);
    const b = new THREE.Vector3(bx, lineY[i * 2 + 1]!, bz);
    const pts = Array.from({ length: 9 }, (_, t) => a.clone().lerp(b, t / 8).setY(THREE.MathUtils.lerp(a.y, b.y, t / 8) - 0.16 * 4 * (t / 8) * (1 - t / 8)));
    k.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.012, 4), C.rope, [0, 0, 0], [0, 0, 0], 0.004);
  });
  scene.add(k.build());

  // the pressed leaves: flat, hung by their stems, each with a little peg. "Here the Scribe kept every autumn":
  // pressed, they keep their colour on the sepia plateau — plain toon, no paper patch (DESIGN-corridors.md), so
  // the Hermitage shows a line of red-gold from the hanger lane and the village
  const leafMat = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: RAMP_WORLD });
  leafMat.side = THREE.DoubleSide;
  const leafGeo = mapleLeafGeometry(0.26).rotateX(Math.PI / 2).translate(0, -0.26, 0);
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, N);
  leaves.frustumCulled = false;
  scene.add(leaves);
  const pegs = new THREE.InstancedMesh(box(0.03, 0.09, 0.03), toon(C.timberDark), N);
  pegs.frustumCulled = false;
  scene.add(pegs);
  const LEAF = [0xb4502e, 0xc8763c, 0x9a4a2a, 0xd09040, 0xa83c24, 0x8a5a34];
  const col = new THREE.Color();
  const p = new Float32Array(N * 3);
  const v = new Float32Array(N * 3);
  const r = new Float32Array(N * 3);
  const w = new Float32Array(N * 3);
  const age = new Float32Array(N);
  /** 0 pegged, 1 flying, 2 settled */
  const st = new Uint8Array(N);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const pos = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  const zero = new THREE.Vector3(0, 0, 0);
  for (let i = 0; i < L; i++) {
    const [ax, az, bx, bz] = H.lines[i]!;
    const yaw = Math.atan2(bx - ax, bz - az) + Math.PI / 2;
    for (let j = 0; j < F.perLine; j++) {
      const n = i * F.perLine + j;
      const t = (j + 0.7) / (F.perLine + 0.4);
      const o = n * 3;
      p[o] = ax + (bx - ax) * t;
      p[o + 2] = az + (bz - az) * t;
      p[o + 1] = THREE.MathUtils.lerp(lineY[i * 2]!, lineY[i * 2 + 1]!, t) - 0.16 * 4 * t * (1 - t);
      r[o] = (rand() - 0.5) * 0.15;
      r[o + 1] = yaw + (rand() - 0.5) * 0.3;
      r[o + 2] = (rand() - 0.5) * 0.4;
      w[o] = (rand() - 0.5) * 7;
      w[o + 1] = (rand() - 0.5) * 7;
      w[o + 2] = (rand() - 0.5) * 7;
      leaves.setColorAt(n, col.setHex(LEAF[n % LEAF.length]!));
    }
  }

  // the leaves letting go are heard at their line (Ember's samples; options made once, events only)
  const leafSound = H.lines.map(([ax, az, bx, bz], i) => ({ at: new THREE.Vector3((ax + bx) / 2, (lineY[i * 2]! + lineY[i * 2 + 1]!) / 2, (az + bz) / 2), gain: 0.14, rate: 0.9 }));
  const paperSound = leafSound.map((o) => ({ at: o.at, gain: 0.08, rate: 0.8, delay: 0.25 }));
  const freed = new Uint8Array(L);
  let freeCount = 0;
  let painted = false;
  let captioned = false;
  const paintAt = new THREE.Vector3(H.plateau.x, 0, H.plateau.z);
  const PAINT_OPTS = { edgeMax: 2.4 };
  const last = new THREE.Vector3().copy(ctx.fox.root.position);

  function place(n: number): void {
    const o = n * 3;
    pos.set(p[o]!, p[o + 1]!, p[o + 2]!);
    e.set(r[o]!, r[o + 1]!, r[o + 2]!);
    q.setFromEuler(e);
    leaves.setMatrixAt(n, m4.compose(pos, q, one));
    if (st[n] === 0) {
      pos.y += 0.02;
      pegs.setMatrixAt(n, m4.compose(pos, q, one));
    } else pegs.setMatrixAt(n, m4.compose(pos, q, zero));
  }
  for (let n = 0; n < N; n++) place(n);

  function free(i: number): void {
    freed[i] = 1;
    freeCount++;
    for (let n = i * F.perLine; n < (i + 1) * F.perLine; n++) {
      const o = n * 3;
      st[n] = 1;
      age[n] = 0;
      v[o] = F.wind.x * (0.5 + rand());
      v[o + 1] = F.lift[0] + rand() * (F.lift[1] - F.lift[0]);
      v[o + 2] = F.wind.z * (0.5 + rand());
    }
    ctx.audio.play('soft-leaf', leafSound[i]);
    ctx.audio.play('soft-paper', paperSound[i]);
    ctx.audio.cue('hermitage-leaves');
    if (freeCount === L && !painted) {
      painted = true;
      ctx.field.restore(paintAt, F.paintR, F.paintSecs, PAINT_OPTS);
      ctx.audio.cue('hermitage');
    }
  }

  function update(dt: number, t: number): void {
    const f = ctx.fox.root.position;
    const speed = dt > 0 ? Math.hypot(f.x - last.x, f.z - last.z) / dt : 0;
    last.copy(f);
    if (!captioned && Math.hypot(f.x - H.desk.x, f.z - H.desk.z) < 2.2) {
      captioned = true;
      ctx.captions.say('Here the Scribe kept every autumn');
    }
    if (speed > F.minSpeed) {
      for (let i = 0; i < L; i++) {
        if (freed[i]) continue;
        const [ax, az, bx, bz] = H.lines[i]!;
        const dx = bx - ax;
        const dz = bz - az;
        const u = Math.min(1, Math.max(0, ((f.x - ax) * dx + (f.z - az) * dz) / (dx * dx + dz * dz)));
        if (Math.hypot(f.x - ax - u * dx, f.z - az - u * dz) < F.reach) free(i);
      }
    }
    if (freeCount === 0) return;
    for (let n = 0; n < N; n++) {
      if (st[n] !== 1) continue;
      const o = n * 3;
      age[n] = age[n]! + dt;
      // lift fades into a slow tumbling fall, carried on the ridge wind toward the village
      v[o + 1] = THREE.MathUtils.damp(v[o + 1]!, -F.terminal, 0.7, dt);
      p[o] = p[o]! + (v[o]! + Math.sin(t * 1.9 + n) * F.sway) * dt;
      p[o + 1] = p[o + 1]! + v[o + 1]! * dt;
      p[o + 2] = p[o + 2]! + (v[o + 2]! + Math.cos(t * 1.4 + n * 0.7) * F.sway * 0.6) * dt;
      r[o] = r[o]! + w[o]! * dt * 0.3;
      r[o + 1] = r[o + 1]! + w[o + 1]! * dt * 0.3;
      r[o + 2] = r[o + 2]! + w[o + 2]! * dt * 0.3;
      const g = groundH(p[o]!, p[o + 2]!) + 0.02;
      if (p[o + 1]! <= g || age[n]! > F.drift * 3) {
        p[o + 1] = Math.max(g, Math.min(p[o + 1]!, g + 0.02));
        st[n] = 2;
        r[o] = 0;
        r[o + 2] = 0;
      }
      place(n);
    }
    leaves.instanceMatrix.needsUpdate = true;
    pegs.instanceMatrix.needsUpdate = true;
  }
  ctx.onUpdate(update);
  return {
    /** dev: free every line */
    freeAll(): void {
      for (let i = 0; i < L; i++) if (!freed[i]) free(i);
    },
    state() {
      return { freed: Array.from(freed), painted, captioned };
    },
  };
}
