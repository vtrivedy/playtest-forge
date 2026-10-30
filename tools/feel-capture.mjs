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
} else if (mode === 'video') {
  // UNASSISTED traversal from spawn, rendered every 2nd 60 Hz step → 30 fps video
  const seconds = Number(arg('seconds', '14'));
  const tag = arg('tag', 'traversal');
  const frames = `${out}/_frames-${tag}`;
  fs.rmSync(frames, { recursive: true, force: true });
  fs.mkdirSync(frames, { recursive: true });
  await boot();
  await H('autopilot', true, 0, { assist: false });
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
  save(`${tag}-unassisted`, { label: 'UNASSISTED video — spawn start, bot input, 60 Hz sim, 30 fps render', end: st });
}

fs.writeFileSync(`${out}/capture-errors-${mode}.json`, JSON.stringify(errors, null, 2));
console.log('errors', errors.length);
await browser.close();
if (server) await server.close();
process.exit(0);
