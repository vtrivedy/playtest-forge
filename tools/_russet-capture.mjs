// Russetvale captures on the manual sim clock (deterministic on SwiftShader) + optional autopilot run.
//   node tools/_russet-capture.mjs --tag before                  # all poses, sepia + restored
//   node tools/_russet-capture.mjs --tag p1 --shots shrine-close --states sepia
//   node tools/_russet-capture.mjs --auto [--from N]             # unassisted critical-path run (rAF clock)
// Output: /workspace/siyu/playtest-forge-artifacts/russetvale2/<tag>/<state>-<shot>.png + report.json
import { chromium } from 'playwright';
import { createServer } from 'vite';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const has = (k) => process.argv.includes(`--${k}`);
const port = Number(arg('port', '5185'));
const tag = arg('tag', 'after');
const out = arg('out', `/workspace/siyu/playtest-forge-artifacts/russetvale2/${tag}`);
const [vw, vh] = arg('size', '1280x720').split('x').map(Number);
const only = arg('shots', '');
const states = arg('states', 'sepia,restored').split(',');
const q = arg('q', 'high'); // quality tier (?q=): judge the look at the shipping tier, not SwiftShader's auto-low
fs.mkdirSync(out, { recursive: true });

// in-process dev server (survives other streams' `pkill vite` sweeps)
let server = null;
try {
  const r = await fetch(`http://127.0.0.1:${port}/`);
  if (!r.ok) throw new Error('down');
} catch {
  server = await createServer({ configFile: 'games/fox-spirit/vite.config.ts', server: { port, host: '127.0.0.1', strictPort: true }, logLevel: 'error' });
  await server.listen();
}

// name → { fox:[x,y,z] (feet), yaw, photo?:[pos,look,fov] }. Gameplay shots use the follow camera.
const SHOTS = {
  'keyart-hill': { fox: [-2, 38, -84], yaw: Math.PI, photo: [[30, 44, -52], [-4, 36, -88], 50] },
  // 6.9 m from the Wellspring: outside its 5.2 m trigger so the sepia still stays sepia
  'shrine-play': { fox: [-2.5, 38, -82.6], yaw: Math.PI },
  establish: { fox: [0, 0, 80], yaw: Math.PI, photo: [[-60, 46, 120], [10, 14, -40], 52] },
  marsh: { fox: [69, 0.4, 28.2], yaw: Math.PI },
  amberwood: { fox: [-13, 10.6, -26.2], yaw: Math.PI },
  // close masonry + hill face (not in the brief's five, used for look passes)
  'shrine-close': { fox: [-3, 38, -80.5], yaw: Math.PI, photo: [[6.5, 40.2, -78.5], [0, 40, -89], 50] },
  'hill-face': { fox: [6.4, 22.4, -74.5], yaw: Math.PI, photo: [[6, 30, -50], [0, 27, -82], 55] },
  'hill-play': { fox: [6.4, 22.4, -71.5], yaw: Math.PI },
};

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'],
});
const ctx = await browser.newContext({ viewport: { width: vw, height: vh } });
const page = await ctx.newPage();
page.setDefaultTimeout(300000);
const errors = [];
page.on('pageerror', (e) => { errors.push(String(e)); console.log('PAGEERROR', String(e)); });
page.on('console', (m) => {
  const t = m.text();
  if (m.type() === 'error') { errors.push(t); console.log('CONSERR', t); }
  else if (t.includes('[russetvale]')) console.log(t);
});

const H = (fn, ...a) => page.evaluate(([f, args]) => window.__gameHooks[f](...args), [fn, a]);
const advance = (frames, render = true) => H('advance', frames, 1 / 60, render);

async function boot(manual) {
  await page.goto(`http://127.0.0.1:${port}/${has('auto') ? '' : `?q=${q}`}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => !!(window.__game && window.__gameHooks?.advance), null, { timeout: 300000 });
  if (manual) {
    await H('setManual', true);
    await advance(30);
  } else {
    await page.waitForFunction(() => window.__gameHooks.state().t > 1.5, null, { timeout: 600000 });
  }
}

const git = (...a) => { try { return execFileSync('git', a, { encoding: 'utf8' }).trim(); } catch { return '?'; } };

if (has('auto')) {
  // full critical-path run with the bot, through real physics; assists disabled (stall = stop)
  await boot(false);
  const t0 = Date.now();
  const from = Number(arg('from', '0'));
  if (from > 0) {
    await page.evaluate((i) => { const w = window.__gameHooks.route()[i]; window.__gameHooks.teleport(w.x, w.y, w.z); }, from);
  }
  await page.evaluate(([i, assist]) => window.__gameHooks.autopilot(true, i, { assist }), [from, has('assist')]);
  let last = '';
  const maxMs = Number(arg('maxmin', '60')) * 60000;
  while (Date.now() - t0 < maxMs) {
    await page.waitForTimeout(5000);
    const st = await page.evaluate(() => window.__gameHooks.state());
    const g = await page.evaluate(() => window.__game);
    const line = `${((Date.now() - t0) / 1000).toFixed(0)}s sim=${st.t.toFixed(1)} ${st.zone} auto=${st.auto.idx}/${st.auto.of} assists=${st.auto.assists} embers=${st.embers}/${st.emberTotal} sw=${st.seedwells.map((s) => (s.lit ? 1 : 0)).join('')} bridge=${st.bridge.toFixed(2)} deaths=${st.deaths} stalled=${st.auto.stalled} ${g.notes.find((n) => n.startsWith('pos='))}`;
    if (line !== last) console.log(line);
    last = line;
    if (st.restored || !st.auto.active) {
      await page.waitForTimeout(3000);
      await page.screenshot({ path: `${out}/auto-final.png` });
      console.log('AUTO DONE', JSON.stringify({ ...st, camera: undefined }));
      break;
    }
  }
} else {
  const names = only ? only.split(',') : Object.keys(SHOTS);
  const report = { tag, commit: git('rev-parse', '--short', 'HEAD'), dirty: git('status', '--porcelain', '--untracked-files=no') !== '', shots: {}, failures: [] };
  for (const state of states) {
    await boot(true); // fresh session per state
    if (state === 'restored') {
      await H('forceRestore');
      await advance(660, false); // 6 s flood + cinematic hold
    }
    for (const name of names) {
      const s = SHOTS[name];
      if (!s) continue;
      await H('teleport', ...s.fox, s.yaw);
      if (s.photo) await H('photo', ...s.photo);
      else await H('photoOff');
      await advance(90, false);
      await advance(2);
      const st = await H('state');
      if (st.restored !== (state === 'restored')) {
        report.failures.push(`${state}-${name}: restored=${st.restored}`);
        console.log('STATE MISMATCH', state, name);
        continue;
      }
      await page.screenshot({ path: `${out}/${state}-${name}.png`, timeout: 120000 });
      report.shots[`${state}-${name}`] = { pos: st.pos, camera: st.camera.pos, photo: st.camera.photo, restored: st.restored, game: await page.evaluate(() => window.__game) };
      console.log('shot', `${state}-${name}`);
    }
  }
  report.errors = errors;
  fs.writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
}
console.log('errors', errors.length);
await browser.close();
if (server) await server.close();
process.exit(0);
