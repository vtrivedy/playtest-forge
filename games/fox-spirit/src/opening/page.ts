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
  const art = pageTexture();
  const page = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: art, side: THREE.DoubleSide, transparent: true, alphaTest: 0.02, fog: false }));
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
  let beatRate = 1;
  let nerve = 0.3;
  let turnDir = 0;
  const travel = new THREE.Vector3();
  let hopTo = 0;
  let wasDashing = false;
  let wasGrounded = true;
  /** sideways jink offset (world xz), eased back to the flight line */
  const side = new THREE.Vector3();
  /** jink goal: the offset eases toward it (never steps), and the goal itself relaxes back to the line */
  const sideGoal = new THREE.Vector3();
  /** arc distance still owed from a skip/jink, paid out smoothly rather than stepped */
  let sOwed = 0;
  /** the page rides a critically damped spring to its flight point, so no target step ever becomes a velocity step */
  const vel = new THREE.Vector3();
  const off = new THREE.Vector3();
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
      // the colour comes back from where you caught it, rolling out over the whole slice
      ctx.field.restore(new THREE.Vector3(pos.x, 0, pos.z), PAGE.payoff.r, 4, { edgeMax: 3 });
      return;
    }
    // every catch gives a slice back: a warm wash around where it was caught (the last one gives the whole slice)
    ctx.field.restore(new THREE.Vector3(pos.x, 0, pos.z), PAGE.payoff.step, 2.5, { edgeMax: 2.5 });
    stage = catches;
    s = 0;
    sOwed = 0;
    side.set(0, 0, 0);
    sideGoal.set(0, 0, 0);
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
      sideGoal.set((-az / al) * sign * TUNE.jink, 0, (ax / al) * sign * TUNE.jink);
      // on a lap it also darts ahead; a hopping page keeps to its perch (only the jink)
      if (!TUNE.hop[stage]) sOwed += 0.8;
      phase = 'fleeing';
      for (let i = 0; i < 8; i++) emit(pos, 0.9, 1.6);
    }
    if (phase === 'perched' || phase === 'fleeing') {
      const pounce = !(TUNE.hop[stage] && phase === 'fleeing') && (st.dashing || !st.grounded) && d < TUNE.reach && dy > -0.4 && dy < TUNE.reachY;
      if (pounce) caught();
      else if (d < 1.1 && st.grounded && t - lastSkip > 0.7) {
        lastSkip = t;
        // walked into it: a startled skip ahead (it wants a dash)
        if (!TUNE.hop[stage]) sOwed += TUNE.skip;
        skips++;
        for (let i = 0; i < 6; i++) emit(pos, 0.8, 1.2);
      }
    }
    // high stages: a leap at it from the next leaf startles it — it jerks up, then sags winded on the same perch,
    // so landing beneath it and springing straight up is the catch; dawdle under it and it flits to the other perch
    if (TUNE.hop[stage] && phase === 'perched' && launchStart && d < 4.6 && windedT <= 0) {
      windedT = TUNE.hopRest + 0.6;
      dodges++;
      sideGoal.set(0, 0.9, 0);
      for (let i = 0; i < 8; i++) emit(pos, 0.9, 1.4);
    }
    if (phase === 'perched' && d < TUNE.spookAt[stage]! && !(TUNE.hop[stage] && windedT > 0)) {
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
      sOwed = 0;
      phase = 'perched';
      windedT = TUNE.hopRest;
    }
    if (phase === 'fleeing') {
      if (d > TUNE.wait) phase = 'perched';
      else if (TUNE.hop[stage]) s += TUNE.hopSpeed * dt;
      else s += THREE.MathUtils.lerp(TUNE.fast, TUNE.slow, THREE.MathUtils.smoothstep(d, 1.5, TUNE.spook)) * (windedT > 0 ? 0.55 : 1) * dt;
    }
    if (phase === 'perched' || phase === 'fleeing') {
      const pay = sOwed * (1 - Math.exp(-dt * 7));
      sOwed -= pay;
      s += pay;
      place(stage, s, tmp);
      sideGoal.x *= Math.exp(-dt * 0.9);
      sideGoal.z *= Math.exp(-dt * 0.9);
      sideGoal.y *= Math.exp(-dt * 5);
      // the jink sweeps across over ~0.3 s; the startle's jerk up is quicker, and it has sagged back by the time a leaper lands
      const k = 1 - Math.exp(-dt * 9);
      side.x += (sideGoal.x - side.x) * k;
      side.z += (sideGoal.z - side.z) * k;
      side.y += (sideGoal.y - side.y) * (1 - Math.exp(-dt * 14));
      tmp.add(side);
      // exact critically damped step: x' = (x + (v + w x) dt) e^-w dt
      const w = 12;
      const e = Math.exp(-w * dt);
      off.subVectors(pos, tmp);
      const jx = vel.x + w * off.x, jy = vel.y + w * off.y, jz = vel.z + w * off.z;
      vel.set((vel.x - w * jx * dt) * e, (vel.y - w * jy * dt) * e, (vel.z - w * jz * dt) * e);
      pos.set(tmp.x + (off.x + jx * dt) * e, tmp.y + (off.y + jy * dt) * e, tmp.z + (off.z + jz * dt) * e);
    } else if (phase === 'flung') {
      flingT += dt;
      const k = Math.min(1, flingT / TUNE.fling);
      const e = k * k * (3 - 2 * k);
      pos.lerpVectors(flingFrom, flingTo, e);
      pos.y += Math.sin(k * Math.PI) * (6 + flingFrom.distanceTo(flingTo) * 0.15);
      if (Math.random() < dt * 30) emit(pos, 3, 0.3);
      if (dt > 0) vel.subVectors(pos, prev).divideScalar(dt);
      if (k >= 1) phase = 'perched';
    } else if (keptAt >= 0) {
      keptAt += dt;
      // the page rises over the fox, opens wide, then sinks into the ground as the wash spreads
      const k = Math.min(1, keptAt / 2.5);
      // rises well clear of the fox and opens, then lets go
      pos.set(fox.x, fox.y + 1.4 + 4 * Math.sin(Math.min(1, keptAt / 2) * Math.PI * 0.5), fox.z);
      body.scale.setScalar(1 + k * 4);
      (page.material as THREE.MeshBasicMaterial).opacity = 1 - THREE.MathUtils.smoothstep(keptAt, 2.5, 4.5);
      (glow.material as THREE.MeshBasicMaterial).opacity = 0.35 * (1 - THREE.MathUtils.smoothstep(keptAt, 2, 4));
      holder.visible = keptAt < 4.6;
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
    // it flies like a moth: the sheet folds along its spine and beats its two halves. Everything here is
    // damped: the beat rate, fold depth, heading, droop and glow ease toward their targets so nothing
    // snaps frame to frame (Vivek: "it weirdly jitters"). Beats stay ≤ ~3 Hz and shallow.
    const nerveGoal = phase === 'fleeing' || phase === 'flung' ? 1 : 1 - THREE.MathUtils.smoothstep(d, 3, 10) * 0.7;
    nerve = THREE.MathUtils.damp(nerve, nerveGoal, 3, dt);
    const rateGoal = phase === 'kept' ? 0.5 : windedT > 0 ? 0.6 : 0.9 + nerve * 2.1;
    beatRate = THREE.MathUtils.damp(beatRate, rateGoal, 4, dt);
    beat += dt * beatRate;
    const fold = phase === 'kept' ? 0.04 : (0.15 + 0.45 * nerve) * (0.55 + 0.45 * Math.sin(beat * Math.PI * 2));
    const arr = geo.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < arr.count; i++) {
      const x = base[i * 3]!;
      const ax = Math.abs(x);
      const a = fold * 1.1;
      const ripple = Math.sin(ax * 10 - beat * Math.PI * 2) * 0.01 * (ax / (W / 2));
      arr.setX(i, Math.sign(x) * ax * Math.cos(a));
      arr.setZ(i, ax * Math.sin(a) + ripple);
    }
    arr.needsUpdate = true;
    holder.position.copy(pos);
    holder.position.y += Math.sin(t * 1.6) * 0.06;
    // heading: perched it turns to face the fox; in flight it faces its smoothed travel direction.
    // Both ease in (wrapped), and tiny displacements never re-aim it.
    if (dt > 0) {
      travel.x = THREE.MathUtils.damp(travel.x, (pos.x - prev.x) / dt, 6, dt);
      travel.z = THREE.MathUtils.damp(travel.z, (pos.z - prev.z) / dt, 6, dt);
    }
    if (phase !== 'kept') {
      const moving = Math.hypot(travel.x, travel.z) > 0.4;
      const goal = phase === 'perched' || !moving ? Math.atan2(fox.x - pos.x, fox.z - pos.z) : Math.atan2(travel.x, travel.z);
      let dy = Math.atan2(Math.sin(goal - holder.rotation.y), Math.cos(goal - holder.rotation.y));
      // a goal near half a turn away would flip the short way every frame: keep turning the way it started
      if (Math.abs(dy) > 2.6 && turnDir !== 0 && Math.sign(dy) !== turnDir) dy += turnDir * Math.PI * 2;
      turnDir = Math.abs(dy) > 0.05 ? Math.sign(dy) : 0;
      // ease in, and never spin faster than ~200°/s however far it has to turn
      holder.rotation.y += THREE.MathUtils.clamp(dy * (1 - Math.exp(-dt * 4)), -3.5 * dt, 3.5 * dt);
    }
    glow.scale.x = Math.cos(fold * 1.1);
    body.rotation.z = Math.sin(t * 1.4) * 0.08 * nerve;
    // winded: the glow dims and the sheet sags — the window to catch it (eased, no flicker)
    if (phase !== 'kept') {
      const gm = glow.material as THREE.MeshBasicMaterial;
      gm.opacity = THREE.MathUtils.damp(gm.opacity, windedT > 0 ? 0.14 + 0.04 * Math.sin(t * 3) : 0.35, 6, dt);
    }
    body.position.y = THREE.MathUtils.damp(body.position.y, windedT > 0 ? -0.22 : 0, 5, dt);
    // upright and facing you while it watches; tipped forward into its flight like a moth when it runs
    body.rotation.x = THREE.MathUtils.damp(body.rotation.x, phase === 'fleeing' || phase === 'flung' ? -1.0 : 0, 4, dt);
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
      sideGoal.set(0, 0, 0);
      vel.set(0, 0, 0);
      sOwed = 0;
      s = 0;
      phase = 'perched';
      place(stage, 0, pos);
    },
    /** the page's inked scene (for the homecoming album page pinned at the well) */
    art,
    /** true once the third catch keeps it and its rise-and-fade has finished */
    settled: () => phase === 'kept' && keptAt > 4.6,
    /** for the hum: where it is, whether it's in flight, how many times it's been caught */
    voice: () => ({ pos, fleeing: phase === 'fleeing' || phase === 'flung', catches, kept: phase === 'kept' }),
    state: () => ({ stage, phase, catches, skips, dodges, winded: windedT > 0, yaw: +holder.rotation.y.toFixed(4), droop: +(body.position.y).toFixed(3), s: +s.toFixed(2), pos: pos.toArray().map((v) => +v.toFixed(4)) }),
  };
}
