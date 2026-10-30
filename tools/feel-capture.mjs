// Fox-spirit camera/feel captures on a manual sim clock (SwiftShader renders ~2 fps, so the
// harness steps fixed 1/60 s physics and renders only when it needs a frame).
//
//   node tools/feel-capture.mjs --mode shots     # staged stills (teleport → settle → shot)
//   node tools/feel-capture.mjs --mode honest    # unassisted bot run from spawn, no teleports
//   node tools/feel-capture.mjs --mode presets   # spring vs brisk: probes + honest bot run each
//   node tools/feel-capture.mjs --mode video     # frame-stepped traversal video from spawn (ffmpeg)
//
// Every output is labelled: STAGED (teleported / photo-framed) vs UNASSISTED (spawn, real input + physics).
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const mode = arg('mode', 'shots');
const port = Number(arg('port', '5193'));
const out = path.resolve(arg('out', 'playtest-output/fox-spirit/feel'));
const [vw, vh] = arg('size', '800x450').split('x').map(Number);
const preset = arg('feel', 'brisk');
fs.mkdirSync(out, { recursive: true });

let server = null;
try {
  const r = await fetch(`http://127.0.0.1:${port}/`);
  if (!r.ok) throw new Error('down');
} catch {
  server = await createServer({ configFile: 'games/fox-spirit/vite.config.ts', server: { port, host: '127.0.0.1', strictPort: true }, logLevel: 'error' });
  await server.listen();
}

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'],
});
const ctx = await browser.newContext({ viewport: { width: vw, height: vh } });
const page = await ctx.newPage();
page.setDefaultTimeout(300000);
const errors = [];
page.on('pageerror', (e) => { errors.push(String(e)); console.log('PAGEERROR', String(e)); });
page.on('console', (m) => { if (m.type() === 'error') { errors.push(m.text()); console.log('CONSERR', m.text()); } });

async function boot(feel = preset) {
  await page.goto(`http://127.0.0.1:${port}/?feel=${feel}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => !!(window.__game && window.__gameHooks?.advance), null, { timeout: 300000 });
  await page.evaluate(() => window.__gameHooks.setManual(true));
}
const H = (fn, ...a) => page.evaluate(([f, args]) => window.__gameHooks[f](...args), [fn, a]);
const advance = (frames, render = true) => H('advance', frames, 1 / 60, render);
const shot = async (name) => {
  await page.screenshot({ path: `${out}/${name}.png`, timeout: 300000 });
  console.log('shot', name);
};
const save = (name, data) => fs.writeFileSync(`${out}/${name}.json`, JSON.stringify(data, null, 2));

/** Unassisted bot run from spawn: no teleports, no assists; stops at the first stall. */
async function honestRun(maxSimS = 600) {
  await H('autopilot', true, 0, { assist: false });
  let st;
  for (let t = 0; t < maxSimS; t += 5) {
    st = await advance(300, false);
    if (!st.auto.active || st.restored) break;
  }
  return {
    label: 'UNASSISTED — spawn start, bot drives real input through physics, no teleports/assists',
    reachedWaypoint: st.auto.idx,
    of: st.auto.of,
    stalledAt: st.auto.stalled || null,
    restored: st.restored,
    seedwells: st.seedwells.filter((s) => s.lit).length,
    embers: `${st.embers}/${st.emberTotal}`,
    deaths: st.deaths,
    simSeconds: Number(st.t.toFixed(1)),
    zone: st.zone,
    preset: st.preset,
  };
}

/** Synthetic feel probes on flat meadow (STAGED: teleported). */
async function probes() {
  const res = {};
  const at = async () => { await H('teleport', 6, 0, 60, Math.PI); await H('setKeys', []); await advance(30, false); };
  const run = async (keys, frames) => { await H('setKeys', keys); return advance(frames, false); };
  await at();
  let st = await run(['Space'], 50); st = await run([], 70);
  res.standingFullJump = { apex: st.feel.apex, air: st.feel.air };
  await at();
  st = await run(['Space'], 5); st = await run([], 70);
  res.tapHop = { apex: st.feel.apex, air: st.feel.air };
  await at();
  await run(['KeyW'], 60); st = await run(['KeyW', 'Space'], 40); st = await run(['KeyW'], 50);
  res.runningFullJump = { apex: st.feel.apex, dist: st.feel.lastDist, air: st.feel.air };
  await at();
  await run(['KeyW'], 60); await run(['KeyW', 'Space'], 26); await run(['KeyW', 'Space', 'ShiftLeft'], 2); st = await run(['KeyW'], 70);
  res.jumpAirDash = { dist: st.feel.lastDist };
  await at();
  await run(['KeyW'], 40); await run(['KeyW', 'ShiftLeft'], 2); st = await run(['KeyW'], 30);
  res.groundDash = { dist: st.feel.lastDashDist };
  // glide: drop in 14 m above the flat meadow, hold jump + forward until touchdown
  await H('teleport', 6, 14, 60, Math.PI);
  st = await run(['KeyW', 'Space'], 420); st = await run(['KeyW'], 30);
  res.glide = { dist: st.feel.glideDist, drop: st.feel.glideDrop, ratio: st.feel.glideRatio };
  await H('setKeys', []);
  return { label: 'STAGED probe — teleported to flat ground, scripted keys, fixed 60 Hz', ...res };
}

if (mode === 'shots') {
  // Same spots as the "before" set, settled on the traversal camera (STAGED: teleported)
  const SPOTS = {
    'shrine-play': [0, 38, -84],
    'hill-play': [6.4, 22.4, -74.5],
    'amberwood-play': [-13, 10.6, -26.2],
    'chasm-play': [-79.5, 14, 13.6],
    'meadow-play': [6, 0, 70],
  };
  await boot();
  for (const [name, p] of Object.entries(SPOTS)) {
    await H('teleport', ...p);
    await H('setKeys', []);
    await advance(150, false);
    await advance(1);
    await shot(`after/${name}`);
  }
  // run a beat north on the meadow so look-ahead + recentre show
  await H('teleport', 6, 0, 70, Math.PI);
  await H('setKeys', ['KeyW']);
  await advance(80, false); await advance(1);
  await shot('after/meadow-run');
  // airborne: running jump off the chasm lip — landing should be in frame
  await H('teleport', -79.5, 14, 13.6, Math.PI);
  await H('setKeys', []); await advance(40, false);
  await H('setKeys', ['KeyW']); await advance(30, false);
  await H('setKeys', ['KeyW', 'Space']); await advance(26, false); await advance(1);
  await shot('after/chasm-airborne');
  await H('setKeys', []);
  // occluder: lone maple trunk between lens and fox on the summit
  await H('teleport', 8.5, 38, -89.4, 0);
  await H('setKeys', []);
  await advance(90, false); await advance(1);
  console.log('occlusion', JSON.stringify((await H('state')).camera));
  await shot('after/occluded-trunk');
  // silhouette / FX-off truthfulness
  await H('teleport', 6, 0, 70, Math.PI);
  await advance(60, false);
  await H('setFxEnabled', false);
  await advance(2);
  const fxOff = await H('state');
  await shot('after/fx-off');
  await H('setFxEnabled', true);
  await advance(2);
  const fxOn = await H('state');
  save('after/fx-truth', { label: 'STAGED', fxOff: fxOff.fx, fxOn: fxOn.fx });
  console.log('fx', JSON.stringify(fxOff.fx), JSON.stringify(fxOn.fx));
} else if (mode === 'honest') {
  await boot();
  const r = await honestRun(Number(arg('maxsim', '600')));
  save(`honest-${preset}`, r);
  await advance(1);
  await shot(`honest-${preset}-end`);
  console.log(JSON.stringify(r));
} else if (mode === 'presets') {
  const result = {};
  for (const name of ['spring', 'brisk']) {
    await boot(name);
    const pr = await probes();
    await boot(name);
    const hr = await honestRun(Number(arg('maxsim', '600')));
    result[name] = { probes: pr, honest: hr };
    console.log(name, JSON.stringify(result[name]));
  }
  save('presets', result);
} else if (mode === 'framing') {
  // UNASSISTED full route; sample the traversal camera every 2 sim frames
  await boot();
  await H('autopilot', true, 0, { assist: false });
  const acc = { frames: 0, air: 0, landingInFrame: 0, foxHigh: 0, foxLow: 0, foxOff: 0, pops: 0, maxCamSpeed: 0, occluded: 0, dist: [], events: [], misses: [], shotFrames: 0, airAll: 0, longestMiss: 0, missByPhase: {} };
  let missRun = 0;
  let prev = null;
  let st;
  for (let i = 0; i < 60 * 200; i++) {
    st = await advance(2, false);
    const c = st.camera.pos;
    const p = st.pos;
    const [fx, fy] = st.camera.foxNdc;
    acc.frames++;
    acc.dist.push(Math.hypot(c[0] - p[0], c[2] - p[2]));
    if (Math.abs(fx) > 1 || Math.abs(fy) > 1) acc.foxOff++;
    else if (fy > 0.45) acc.foxHigh++;
    else if (fy < -0.75) acc.foxLow++;
    if (st.camera.occlusion > 0.5) acc.occluded++;
    if (!st.grounded) {
      acc.airAll++;
      const lnd = st.camera.landingNdc;
      const ok = lnd && Math.abs(lnd[0]) < 0.95 && Math.abs(lnd[1]) < 0.95;
      if (!ok) { missRun += 2 / 60; acc.longestMiss = Math.max(acc.longestMiss, missRun); } else missRun = 0;
      if (!ok && lnd) { const ph = st.anim; acc.missByPhase[ph] = (acc.missByPhase[ph] ?? 0) + 1; }
    } else missRun = 0;
    if (!st.grounded && st.camera.landingNdc) {
      acc.air++;
      const [lx, ly] = st.camera.landingNdc;
      if (Math.abs(lx) < 0.95 && Math.abs(ly) < 0.95) acc.landingInFrame++;
      else if (acc.misses.length < 40) acc.misses.push(`t=${st.t.toFixed(2)} ${st.anim} fox=${p.map((q) => q.toFixed(1))} land=${lx.toFixed(2)},${ly.toFixed(2)} ${st.camera.internals}`);
    }
    if (prev) {
      const v = Math.hypot(c[0] - prev[0], c[1] - prev[1], c[2] - prev[2]) / (2 / 60);
      acc.maxCamSpeed = Math.max(acc.maxCamSpeed, v);
      const inShot = !/shot=0\.00/.test(st.camera.internals);
      if (v > 26 && !inShot) acc.pops++;
      if (inShot) acc.shotFrames++;
      if (((v > 26 && !inShot) || Math.abs(fx) > 1 || Math.abs(fy) > 1) && acc.events.length < 60) {
        acc.events.push(`t=${st.t.toFixed(2)} wp=${st.auto.idx} ${st.anim} v=${v.toFixed(0)} fox=${p.map((q) => q.toFixed(1))} cam=${c.map((q) => q.toFixed(1))} ndc=${fx.toFixed(2)},${fy.toFixed(2)} g=${st.grounded} ${st.camera.internals}`);
      }
    }
    prev = c;
    if (!st.auto.active || st.restored) break;
  }
  acc.dist.sort((a, b) => a - b);
  const r = {
    label: 'UNASSISTED framing — full route from spawn, traversal camera sampled every 2 frames',
    reached: `${st.auto.idx}/${st.auto.of}`, restored: st.restored, stalled: st.auto.stalled || null, simSeconds: Number(st.t.toFixed(1)),
    stops: 'at restoration (the wellspring step itself is not walked)',
    predictionCoveragePct: Number((100 * acc.air / Math.max(1, acc.airAll)).toFixed(1)),
    landingInFramePct: Number((100 * acc.landingInFrame / Math.max(1, acc.air)).toFixed(1)),
    longestLandingMissS: Number(acc.longestMiss.toFixed(2)),
    landingMissByAnim: acc.missByPhase,
    foxHighPct: Number((100 * acc.foxHigh / acc.frames).toFixed(1)),
    foxLowPct: Number((100 * acc.foxLow / acc.frames).toFixed(1)),
    foxOffscreenPct: Number((100 * acc.foxOff / acc.frames).toFixed(2)),
    occlusionCutPct: Number((100 * acc.occluded / acc.frames).toFixed(1)),
    camDist: { p10: acc.dist[Math.floor(acc.dist.length * 0.1)].toFixed(2), p50: acc.dist[Math.floor(acc.dist.length * 0.5)].toFixed(2), p90: acc.dist[Math.floor(acc.dist.length * 0.9)].toFixed(2) },
    traversalPops: acc.pops, shotFrames: acc.shotFrames, maxCamSpeed: Number(acc.maxCamSpeed.toFixed(1)),
    events: acc.events,
    landingMisses: acc.misses,
  };
  save(`framing-${arg('tag', 'now')}`, r);
  console.log(JSON.stringify(r));
} else if (mode === 'moments') {
  // UNASSISTED stills: run the route from spawn and grab the first frame of each situation
  await boot();
  await H('autopilot', true, 0, { assist: false });
  const want = {
    occluded: (st) => st.camera.occlusion > 0.85,
    'marsh-hop-apex': (st) => st.anim === 'jump_apex' && st.zone.startsWith('C'),
    'drop-tilt': (st) => !st.grounded && st.camera.landingNdc && st.pos[1] > 15 && st.anim === 'jump_fall',
    glide: (st) => st.gliding && st.t > 50,
    land: (st) => st.anim === 'land',
    dash: (st) => st.anim === 'dash',
    'occluded-late': (st) => st.camera.occlusion > 0.85 && st.t > 60,
  };
  const got = {};
  let st;
  for (let i = 0; i < 60 * 130 && Object.keys(got).length < Object.keys(want).length; i++) {
    st = await advance(1, false);
    for (const [k, f] of Object.entries(want)) {
      if (!got[k] && f(st)) {
        await advance(0); // render the triggering state itself (no extra sim step)
        got[k] = { t: st.t, zone: st.zone, anim: st.anim, camera: { foxNdc: st.camera.foxNdc, landingNdc: st.camera.landingNdc, occlusion: st.camera.occlusion } };
        await shot(`moments/${k}`);
      }
    }
    if (!st.auto.active) break;
  }
  save('moments/index', { label: 'UNASSISTED stills — first frame of each situation on the bot run from spawn', got });
} else if (mode === 'steer') {
  // KEYBOARD steering with the bot OFF (STAGED start on open meadow): does the camera-relative basis +
  // auto-recentre do what a player expects? Heading = fox velocity direction, yaw = camera steering yaw.
  await boot();
  const deg = (r) => Number(((r * 180) / Math.PI).toFixed(1));
  const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const heading = (st) => Math.atan2(st.vel[0], st.vel[2]);
  const tests = {
    'W 3s': [[['KeyW'], 180]],
    'W+D 3s': [[['KeyW', 'KeyD'], 180]],
    'D 4s': [[['KeyD'], 240]],
    'S toward lens 2s': [[['KeyS'], 120]],
    'W then S reversal': [[['KeyW'], 90], [['KeyS'], 90]],
    'W + orbit 60° mid-run': [[['KeyW'], 60], ['orbit', Math.PI / 3], [['KeyW'], 120]],
  };
  const res = {};
  for (const [name, seq] of Object.entries(tests)) {
    await H('teleport', -20, 0, 66, Math.PI);
    await H('setKeys', []);
    await advance(40, false);
    const s0 = await H('state');
    const trace = [];
    let first = null;
    let flipT = null;
    let t = 0;
    for (const stepDef of seq) {
      if (stepDef[0] === 'orbit') { await H('orbit', stepDef[1]); continue; }
      await H('setKeys', stepDef[0]);
      for (let i = 0; i < stepDef[1]; i += 6) {
        const st = await advance(6, false);
        t += 0.1;
        const sp = Math.hypot(st.vel[0], st.vel[2]);
        if (sp > 2 && first === null) first = heading(st);
        if (name.includes('reversal') && stepDef[0][0] === 'KeyS' && flipT === null && first !== null && sp > 2 && Math.abs(wrapA(heading(st) - first)) > 2.6) flipT = t;
        trace.push({ t: Number(t.toFixed(1)), x: Number(st.pos[0].toFixed(2)), z: Number(st.pos[2].toFixed(2)), heading: deg(heading(st)), camYaw: deg(st.camera.yaw), speed: Number(sp.toFixed(2)) });
      }
    }
    const end = trace[trace.length - 1];
    res[name] = {
      headingChangeDeg: first === null ? null : deg(wrapA((end.heading * Math.PI) / 180 - first)),
      camYawChangeDeg: deg(wrapA(((end.camYaw - deg(s0.camera.yaw)) * Math.PI) / 180)),
      travelled: Number(Math.hypot(end.x - s0.pos[0], end.z - s0.pos[2]).toFixed(2)),
      reversalS: flipT,
      trace: trace.filter((_, i) => i % 3 === 0),
    };
    console.log(name, JSON.stringify({ ...res[name], trace: undefined }));
  }
  await H('setKeys', []);
  save('steer', { label: 'STAGED start (meadow teleport), KEYBOARD input only, autopilot off, 60 Hz', res });
} else if (mode === 'video') {
  // UNASSISTED traversal from spawn, rendered every 2nd 60 Hz step → 30 fps video
  const seconds = Number(arg('seconds', '14'));
  const tag = arg('tag', 'traversal');
  const frames = `${out}/_frames-${tag}`;
  fs.rmSync(frames, { recursive: true, force: true });
  fs.mkdirSync(frames, { recursive: true });
  await boot();
  await H('autopilot', true, 0, { assist: false });
  // --skip: fast-forward the same unassisted run without rendering (no teleport)
  const skip = Number(arg('skip', '0'));
  for (let t = 0; t < skip; t += 5) await advance(Math.min(5, skip - t) * 60, false);
  const n = Math.round(seconds * 30);
  for (let i = 0; i < n; i++) {
    await advance(2);
    await page.screenshot({ path: `${frames}/${String(i).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 82 });
    if (i % 30 === 0) {
      const st = await H('state');
      console.log(`frame ${i}/${n} wp=${st.auto.idx} ${st.anim} ${st.zone}`);
    }
  }
  const st = await H('state');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '30', '-i', `${frames}/%04d.jpg`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '24', `${out}/${tag}-unassisted.mp4`]);
  fs.rmSync(frames, { recursive: true, force: true });
  save(`${tag}-unassisted`, { label: `UNASSISTED video — spawn start (fast-forwarded ${skip}s unrendered), bot input, 60 Hz sim, 30 fps render`, end: st });
}

fs.writeFileSync(`${out}/capture-errors-${mode}.json`, JSON.stringify(errors, null, 2));
console.log('errors', errors.length);
await browser.close();
if (server) await server.close();
process.exit(0);
