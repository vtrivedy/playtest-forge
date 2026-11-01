/**
 * Runaway Page (docs/design/swarm3/runaway-page-DESIGN.md): a torn Album page that will not be kept.
 * It perches and watches; inside a few metres it bolts along its stage's flight loop, rubber-banded just
 * under the fox's run so a dash (or a pounce from the air) is the catch. Three catches, one per stage;
 * each flings it to the next stage along a long visible arc. The last gives the meadow back for good.
 */
import * as THREE from 'three';
import type { OpeningCtx } from './scene';
import { PAGE } from './layout';

const TUNE = {
  /** fox distance (m) at which a perched page bolts / stops fleeing and waits */
  spook: 4.5,
  wait: 9,
  /** flee speed (m/s) far → near: just over the fox's 3.2 run, so running alone never closes the last metre */
  slow: 1.6,
  fast: 3.5,
  /** catch: dash or airborne contact, horizontal / vertical reach from the fox's feet */
  reach: 1.35,
  reachY: 1.25,
  /** walking into it: it skips ahead this far */
  skip: 1.8,
  fling: 2.6,
  /** a dash launched from this far reads as a lunge it can see coming: it jinks aside unless winded.
   *  Stage 1 lets a point-blank dash land (teach); later stages dodge every fresh lunge — bait, then catch */
  dodgeFrom: [1.0, 0, 0],
  dodgeTo: 4.2,
  jink: 2.4,
  /** after a dodge it is winded for a moment: slower, glow dims — the opening (shrinks per stage) */
  winded: [1.8, 1.4, 1.1],
  /** high stages hop perch to perch (leaf to leaf, flap to flap) instead of running laps; spook radius per stage */
  hop: [false, true, true],
  spookAt: [4.5, 2.2, 2.2],
  /** after a hop it rests, winded, on the new perch */
  hopRest: 2.2,
  /** a hop is a quick flit (m/s along its arc) */
  hopSpeed: 5,
};

type Phase = 'perched' | 'fleeing' | 'flung' | 'kept';

/** closed flight loop with arc-length lookup */
function loop(points: ReadonlyArray<readonly [number, number, number]>) {
  const pts = points.map(([x, y, z]) => new THREE.Vector3(x, y, z));
  const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
  const length = curve.getLength();
  // arc position of each even control point: the perches a hopping page rests on
  const perches = pts.filter((_, i) => i % 2 === 0).map((p) => {
    let best = 0, bd = Infinity;
    for (let k = 0; k <= 400; k++) {
      const d = curve.getPointAt(k / 400).distanceToSquared(p);
      if (d < bd) [bd, best] = [d, (k / 400) * length];
    }
    return best;
  });
  return { curve, length, perches, at: (s: number, out: THREE.Vector3) => curve.getPointAt((((s / length) % 1) + 1) % 1, out) };
}

function pageTexture(): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 192;
  cv.height = 256;
  const g = cv.getContext('2d')!;
  g.fillStyle = '#efdcb4';
  g.fillRect(0, 0, 192, 256);
  // a pressed autumn scene inked on the page: hills, a lone maple, a sun
  g.strokeStyle = '#3a2516';
  g.lineWidth = 3;
  g.fillStyle = '#c8763c';
  g.beginPath();
  g.arc(130, 70, 22, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#9a6d4a';
  g.beginPath();
  g.moveTo(0, 190);
  g.quadraticCurveTo(60, 140, 110, 180);
  g.quadraticCurveTo(150, 150, 192, 175);
  g.lineTo(192, 256);
  g.lineTo(0, 256);
  g.fill();
  g.stroke();
  g.beginPath();
  g.moveTo(62, 175);
  g.lineTo(66, 120);
  g.stroke();
  g.fillStyle = '#b4502e';
  g.beginPath();
  g.arc(66, 112, 20, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  // torn edge: bite the right side
  g.globalCompositeOperation = 'destination-out';
  g.beginPath();
  g.moveTo(192, 0);
  for (let y = 0; y <= 256; y += 16) g.lineTo(184 - ((y / 16) % 2) * 9, y);
  g.lineTo(192, 256);
  g.fill();
  g.globalCompositeOperation = 'source-over';
  g.strokeStyle = 'rgba(58,37,22,0.8)';
  g.lineWidth = 6;
  g.strokeRect(3, 3, 186, 250);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildRunawayPage(ctx: OpeningCtx) {
  const stages = PAGE.stages.map(loop);
  const W = 0.62;
  const H = 0.8;
  const SEG = 10;
  const geo = new THREE.PlaneGeometry(W, H, SEG, 1);
  const base = Float32Array.from(geo.getAttribute('position').array);
  const page = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: pageTexture(), side: THREE.DoubleSide, transparent: true, alphaTest: 0.5, fog: false }));
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.6, H * 1.45), new THREE.MeshBasicMaterial({ color: 0xffb066, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  glow.position.z = -0.01;
  const body = new THREE.Group();
  body.add(glow, page);
  const holder = new THREE.Group();
  holder.add(body);
  ctx.scene.add(holder);

  // paper flecks trailing behind it; while flung they linger as a ribbon that shows where it went
  const FLECKS = 60;
  const flecks = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.06, 0.08), new THREE.MeshBasicMaterial({ color: 0xf2dcb0, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }), FLECKS);
  flecks.frustumCulled = false;
  ctx.scene.add(flecks);
  const fleck = Array.from({ length: FLECKS }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), age: 99, life: 1 }));
  let nextFleck = 0;
  const emit = (at: THREE.Vector3, life: number, spread: number) => {
    const f = fleck[nextFleck++ % FLECKS]!;
    f.p.copy(at);
    f.v.set((Math.random() - 0.5) * spread, -0.2 - Math.random() * 0.3, (Math.random() - 0.5) * spread);
    f.age = 0;
    f.life = life;
  };

  let stage = 0;
  let phase: Phase = 'perched';
  let s = 0;
  let catches = 0;
  let skips = 0;
  let lastSkip = -1;
  let dodges = 0;
  let windedT = 0;
  let beat = 0;
  let hopTo = 0;
  let wasDashing = false;
  let wasGrounded = true;
  /** sideways jink offset (world xz), eased back to the flight line */
  const side = new THREE.Vector3();
  let flingT = 0;
  let keptAt = -1;
  const pos = new THREE.Vector3();
  const prev = new THREE.Vector3();
  const flingFrom = new THREE.Vector3();
  const flingTo = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  /** flight points carry height above the base terrain (props and raised places are authored into the height) */
  const place = (st: number, sv: number, out: THREE.Vector3) => {
    stages[st]!.at(sv, out);
    out.y += ctx.groundH(out.x, out.z);
    return out;
  };
  place(0, 0, pos);

  function caught(): void {
    catches++;
    flingFrom.copy(pos);
    for (let i = 0; i < 24; i++) emit(pos, 1.6, 2.4);
    if (catches >= PAGE.stages.length) {
      phase = 'kept';
      keptAt = 0;
      ctx.field.restore(new THREE.Vector3(PAGE.payoff.x, 0, PAGE.payoff.z), PAGE.payoff.r, 6, { edgeMax: 3 });
      return;
    }
    stage = catches;
    s = 0;
    place(stage, 0, flingTo);
    phase = 'flung';
    flingT = 0;
  }

  ctx.onUpdate((dt, t) => {
    const player = ctx.player;
    if (!player) return;
    const st = player.state() as { dashing?: boolean; grounded?: boolean };
    const fox = ctx.fox.root.position;
    prev.copy(pos);
    const d = Math.hypot(fox.x - pos.x, fox.z - pos.z);
    const dy = pos.y - fox.y;
    const dashStart = !!st.dashing && !wasDashing;
    wasDashing = !!st.dashing;
    // in the high stages a spring/jump toward it is the lunge it watches for
    const launchStart = !st.grounded && wasGrounded;
    wasGrounded = !!st.grounded;
    windedT = Math.max(0, windedT - dt);
    if ((phase === 'perched' || phase === 'fleeing') && dashStart && windedT <= 0 && d > TUNE.dodgeFrom[stage]! && d < TUNE.dodgeTo) {
      // it sees the lunge: a quick jink across the fox's line and a little ahead
      dodges++;
      windedT = TUNE.winded[stage]!;
      const ax = pos.x - fox.x, az = pos.z - fox.z, al = Math.hypot(ax, az) || 1;
      const sign = Math.random() < 0.5 ? -1 : 1;
      side.set((-az / al) * sign * TUNE.jink, 0, (ax / al) * sign * TUNE.jink);
      s += 0.8;
      phase = 'fleeing';
      for (let i = 0; i < 8; i++) emit(pos, 0.9, 1.6);
    }
    if (phase === 'perched' || phase === 'fleeing') {
      const pounce = !(TUNE.hop[stage] && phase === 'fleeing') && (st.dashing || !st.grounded) && d < TUNE.reach && dy > -0.4 && dy < TUNE.reachY;
      if (pounce) caught();
      else if (d < 1.1 && st.grounded && t - lastSkip > 0.7) {
        lastSkip = t;
        // walked into it: a startled skip ahead (it wants a dash)
        s += TUNE.skip;
        skips++;
        for (let i = 0; i < 6; i++) emit(pos, 0.8, 1.2);
      }
    }
    const seesLeap = TUNE.hop[stage] && launchStart && d < 3.8;
    if (phase === 'perched' && (d < TUNE.spookAt[stage]! || seesLeap) && !(TUNE.hop[stage] && windedT > 0)) {
      phase = 'fleeing';
      if (TUNE.hop[stage]) {
        // pick the next perch along the loop
        const L = stages[stage]!;
        const here = ((s % L.length) + L.length) % L.length;
        const ahead = L.perches.map((p) => (p - here + L.length) % L.length).filter((x) => x > 0.5);
        hopTo = s + Math.min(...ahead);
      }
    }
    if (phase === 'fleeing' && TUNE.hop[stage] && s >= hopTo) {
      s = hopTo;
      phase = 'perched';
      windedT = TUNE.hopRest;
    }
    if (phase === 'fleeing') {
      if (d > TUNE.wait) phase = 'perched';
      else if (TUNE.hop[stage]) s += TUNE.hopSpeed * dt;
      else s += THREE.MathUtils.lerp(TUNE.fast, TUNE.slow, THREE.MathUtils.smoothstep(d, 1.5, TUNE.spook)) * (windedT > 0 ? 0.55 : 1) * dt;
    }
    if (phase === 'perched' || phase === 'fleeing') {
      place(stage, s, tmp);
      side.multiplyScalar(Math.exp(-dt * 0.9));
      tmp.add(side);
      pos.lerp(tmp, 1 - Math.exp(-dt * 10));
    } else if (phase === 'flung') {
      flingT += dt;
      const k = Math.min(1, flingT / TUNE.fling);
      const e = k * k * (3 - 2 * k);
      pos.lerpVectors(flingFrom, flingTo, e);
      pos.y += Math.sin(k * Math.PI) * (6 + flingFrom.distanceTo(flingTo) * 0.15);
      if (Math.random() < dt * 30) emit(pos, 3, 0.3);
      if (k >= 1) phase = 'perched';
    } else if (keptAt >= 0) {
      keptAt += dt;
      // the page rises over the fox, opens wide, then sinks into the ground as the wash spreads
      const k = Math.min(1, keptAt / 3);
      pos.set(fox.x, fox.y + 1.2 + 2.2 * Math.sin(Math.min(1, keptAt / 1.5) * Math.PI * 0.5) - Math.max(0, keptAt - 3) * 1.5, fox.z);
      body.scale.setScalar(1 + k * 5);
      (page.material as THREE.MeshBasicMaterial).opacity = 1 - THREE.MathUtils.smoothstep(keptAt, 4, 6);
      (glow.material as THREE.MeshBasicMaterial).opacity = 0.35 * (1 - THREE.MathUtils.smoothstep(keptAt, 3, 5));
      holder.visible = keptAt < 6.5;
    }
    // camera interest: while the chase is on, ease the lens round behind the fox so the page stays in frame
    // (a soft Z-target: the chase cam alone recentres on the run direction, which loses a jinking page)
    if ((phase === 'fleeing' || (phase === 'perched' && d < 8)) && d > 0.8) {
      const cam = player.cam;
      const goal = Math.atan2(fox.x - pos.x, fox.z - pos.z);
      let dYaw = goal - cam.getYaw();
      dYaw = Math.atan2(Math.sin(dYaw), Math.cos(dYaw));
      const w = 1 - THREE.MathUtils.smoothstep(d, 8, 12);
      cam.orbit(THREE.MathUtils.clamp(dYaw, -1, 1) * Math.min(1, dt * 2.2) * w);
    }
    // it flies like a moth: the sheet folds along its spine and beats its two halves, slow and shallow
    // while it watches, quick and deep in flight; a ripple runs out along each half
    const nerve = phase === 'fleeing' || phase === 'flung' ? 1 : 1 - THREE.MathUtils.smoothstep(d, 3, 10) * 0.7;
    beat += dt * (phase === 'kept' ? 1 : 2.2 + nerve * 9 + (windedT > 0 ? -4 : 0));
    const fold = phase === 'kept' ? 0.05 : (0.25 + 0.75 * nerve) * (0.55 + 0.45 * Math.sin(beat * Math.PI * 2));
    const arr = geo.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < arr.count; i++) {
      const x = base[i * 3]!;
      const ax = Math.abs(x);
      const a = fold * 1.1;
      const ripple = Math.sin(ax * 14 - beat * 9) * 0.015 * (ax / (W / 2));
      arr.setX(i, Math.sign(x) * ax * Math.cos(a));
      arr.setZ(i, ax * Math.sin(a) + ripple);
    }
    arr.needsUpdate = true;
    holder.position.copy(pos);
    holder.position.y += Math.sin(t * 2.3) * 0.08;
    // perched it faces the fox; in flight it faces where it is going, rolled into the turn
    const look = phase === 'perched' ? Math.atan2(fox.x - pos.x, fox.z - pos.z) : Math.atan2(pos.x - prev.x, pos.z - prev.z) || holder.rotation.y;
    holder.rotation.y = phase === 'kept' ? holder.rotation.y : look;
    glow.scale.x = Math.cos(fold * 1.1);
    body.rotation.z = Math.sin(t * 3.1) * 0.15 * nerve;
    // winded: the glow gutters and the sheet droops — the window to catch it
    if (phase !== 'kept') (glow.material as THREE.MeshBasicMaterial).opacity = windedT > 0 ? 0.12 + 0.08 * Math.sin(t * 20) : 0.35;
    body.position.y = windedT > 0 ? -0.25 * Math.min(1, windedT) : 0;
    // upright and facing you while it watches; tipped forward into its flight like a moth when it runs
    body.rotation.x = THREE.MathUtils.damp(body.rotation.x, phase === 'fleeing' || phase === 'flung' ? -1.0 : 0, 6, dt);
    if (phase === 'fleeing' && Math.random() < dt * 14) emit(pos, 1.2, 0.5);
    // flecks
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const sc = new THREE.Vector3();
    let n = 0;
    for (const f of fleck) {
      if (f.age >= f.life) continue;
      f.age += dt;
      f.v.y -= dt * 0.6;
      f.p.addScaledVector(f.v, dt);
      q.setFromEuler(new THREE.Euler(f.age * 5, f.age * 3, 0));
      sc.setScalar(1 - f.age / f.life);
      flecks.setMatrixAt(n++, m.compose(f.p, q, sc));
    }
    flecks.count = n;
    flecks.instanceMatrix.needsUpdate = true;
  });

  return {
    /** dev: jump to a stage's start perch (review stills) */
    toStage(n: number): void {
      stage = Math.max(0, Math.min(PAGE.stages.length - 1, n));
      catches = stage;
        side.set(0, 0, 0);
      s = 0;
      phase = 'perched';
      place(stage, 0, pos);
    },
    /** for the hum: where it is, whether it's in flight, how many times it's been caught */
    voice: () => ({ pos, fleeing: phase === 'fleeing' || phase === 'flung', catches, kept: phase === 'kept' }),
    state: () => ({ stage, phase, catches, skips, dodges, winded: windedT > 0, s: +s.toFixed(2), pos: pos.toArray().map((v) => +v.toFixed(2)) }),
  };
}
