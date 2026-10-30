// Lookdev + perf captures on the manual sim clock: sepia and restored stills (hill, marsh, shrine,
// key-art establishing) plus a per-frame profile (draw calls, triangles, ms/frame) on SwiftShader.
//
//   node tools/look-capture.mjs --tag before            # → playtest-output/fox-spirit/look/before/
//   node tools/look-capture.mjs --tag after --q auto    # quality tier via ?q= (auto|low|med|high)
//   node tools/look-capture.mjs --tag after --shots marsh --states sepia
import { chromium } from 'playwright';
import { createServer } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const tag = arg('tag', 'after');
const q = arg('q', '');
const port = Number(arg('port', '5196'));
const out = path.resolve(arg('out', `playtest-output/fox-spirit/look/${tag}`));
const [vw, vh] = arg('size', '1280x720').split('x').map(Number);
const only = arg('shots', '');
const states = arg('states', 'sepia,restored').split(',');
fs.mkdirSync(out, { recursive: true });

let server = null;
try {
  const r = await fetch(`http://127.0.0.1:${port}/`);
  if (!r.ok) throw new Error('down');
} catch {
  server = await createServer({ configFile: 'games/fox-spirit/vite.config.ts', server: { port, host: '127.0.0.1', strictPort: true }, logLevel: 'error' });
  await server.listen();
}

// fox feet + optional staged photo [pos, look, fov]; gameplay shots use the follow camera
const SHOTS = {
  establish: { fox: [0, 0, 80], yaw: Math.PI, photo: [[-60, 46, 120], [10, 14, -40], 52] },
  hill: { fox: [-2, 38, -84], yaw: Math.PI, photo: [[30, 44, -52], [-4, 36, -88], 50] },
  marsh: { fox: [69, 0.4, 28.2], yaw: Math.PI },
  shrine: { fox: [0, 38, -84], yaw: Math.PI },
  meadow: { fox: [6, 0, 70], yaw: Math.PI },
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
  else if (t.startsWith('[quality]')) console.log(t);
});

const H = (fn, ...a) => page.evaluate(([f, args]) => window.__gameHooks[f](...args), [fn, a]);
const advance = (frames, render = true) => H('advance', frames, 1 / 60, render);

await page.goto(`http://127.0.0.1:${port}/${q ? `?q=${q}` : ''}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => !!(window.__game && window.__gameHooks?.advance), null, { timeout: 300000 });
await H('setManual', true);
await advance(30);

const report = { tag, q: q || 'default', viewport: [vw, vh], perf: {}, shots: {} };
const names = only ? only.split(',') : Object.keys(SHOTS);

async function stage(name) {
  const s = SHOTS[name];
  await H('teleport', ...s.fox, s.yaw);
  if (s.photo) await H('photo', ...s.photo);
  else await H('photoOff');
  await advance(90, false); // settle camera + fox
  await advance(2);
}

for (const state of states) {
  if (state === 'restored') {
    await H('forceRestore');
    await advance(660, false); // full 6 s flood + cinematic hold
  }
  for (const name of names) {
    await stage(name);
    if (name === 'marsh' || name === 'meadow') report.perf[`${state}-${name}`] = await H('perf', 4);
    await page.screenshot({ path: `${out}/${state}-${name}.png` });
    const st = await H('state');
    report.shots[`${state}-${name}`] = { pos: st.pos, camera: st.camera.pos, restored: st.restored, fx: st.fx, game: await page.evaluate(() => window.__game) };
    console.log('shot', `${state}-${name}`, JSON.stringify(report.perf[`${state}-${name}`] ?? ''));
  }
}
report.errors = errors;
fs.writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
console.log('errors', errors.length);
await browser.close();
if (server) await server.close();
process.exit(0);
