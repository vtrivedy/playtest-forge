// Russetvale captures: establishing shots (photo mode) + gameplay shots + optional autopilot run.
// Usage: node tools/_russet-capture.mjs [--port 5185] [--out DIR] [--shots a,b] [--auto] [--size 1280x720]
import { chromium } from 'playwright';
import { createServer } from 'vite';
import fs from 'node:fs';

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const has = (k) => process.argv.includes(`--${k}`);
const port = Number(arg('port', '5185'));
const out = arg('out', '/workspace/siyu/playtest-forge-artifacts/russetvale');
const [vw, vh] = arg('size', '1280x720').split('x').map(Number);
const only = arg('shots', '');
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

// name → { fox:[x,y,z] (feet), photo?:[pos,look,fov], restored?, seedwells?, wait }
const SHOTS = {
  // key-art composition: from the meadow's west rim looking NE across the realm to the hill
  'establish-sepia': { fox: [0, 0, 80], photo: [[-60, 46, 120], [10, 14, -40], 52] },
  'establish-restored': { fox: [0, 38, -84], photo: [[-60, 46, 120], [10, 14, -40], 52], restored: true, wait: 9000 },
  'keyart-hill': { fox: [-2, 38, -84], photo: [[30, 44, -52], [-4, 36, -88], 50] },
  'keyart-hill-restored': { fox: [-2, 38, -84], photo: [[30, 44, -52], [-4, 36, -88], 50], restored: true, wait: 9000 },
  'underside': { fox: [0, 0, 80], photo: [[-190, -22, 150], [-20, -10, 30], 50] },
  'portal-frame1': { fox: [0, 0, 90] },
  'meadow-play': { fox: [6, 0, 70] },
  'terraces-play': { fox: [-60.7, 6, 37.5] },
  'chasm-play': { fox: [-79.5, 14, 13.6] },
  'marsh-play': { fox: [69, 0.4, 28.2] },
  'amberwood-play': { fox: [-13, 10.6, -26.2] },
  'bridge-play': { fox: [0, 8, -31.2], seedwells: true, wait: 4500 },
  'hill-play': { fox: [6.4, 22.4, -74.5], seedwells: true },
  'shrine-play': { fox: [0, 38, -84] },
};

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'],
});
const ctx = await browser.newContext({ viewport: { width: vw, height: vh } });
const page = await ctx.newPage();
page.setDefaultTimeout(120000);
const errors = [];
page.on('pageerror', (e) => { errors.push(String(e)); console.log('PAGEERROR', String(e)); });
page.on('console', (m) => {
  const t = m.text();
  if (m.type() === 'error') { errors.push(t); console.log('CONSERR', t); }
  else if (t.includes('[russetvale]')) console.log(t);
});

async function boot() {
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => !!(window.__game && window.__gameHooks), null, { timeout: 180000 });
  await page.waitForTimeout(1500);
  // let shaders compile and a few sim seconds render before any shot
  await page.waitForFunction(() => window.__gameHooks.state().t > 1.5, null, { timeout: 600000 });
}


async function fps() {
  return page.evaluate(() => new Promise((res) => {
    let n = 0;
    const t0 = performance.now();
    const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else res(n / ((performance.now() - t0) / 1000)); };
    requestAnimationFrame(f);
  }));
}

await boot();
console.log('fps', (await fps()).toFixed(1));

if (has('auto')) {
  // full critical-path run with the bot, through real physics
  const t0 = Date.now();
  await page.evaluate(() => window.__gameHooks.autopilot(true, 0));
  let last = '';
  let shotN = 0;
  const maxMs = Number(arg('maxmin', '40')) * 60000;
  while (Date.now() - t0 < maxMs) {
    await page.waitForTimeout(5000);
    const st = await page.evaluate(() => window.__gameHooks.state());
    const g = await page.evaluate(() => window.__game);
    const line = `${((Date.now() - t0) / 1000).toFixed(0)}s sim=${g.elapsedSec} ${st.zone} auto=${st.auto.idx}/${st.auto.of} assists=${st.auto.assists} embers=${st.embers}/${st.emberTotal} sw=${st.seedwells.map((s) => (s.lit ? 1 : 0)).join('')} bridge=${st.bridge.toFixed(2)} deaths=${st.deaths} ${g.notes.find((n) => n.startsWith('pos='))}`;
    if (line !== last) console.log(line);
    last = line;
    if (has('autoshots') && shotN < 40) await page.screenshot({ path: `${out}/auto-${String(shotN++).padStart(2, '0')}.png` });
    if (st.restored || !st.auto.active) {
      await page.waitForTimeout(7000);
      await page.screenshot({ path: `${out}/auto-final.png` });
      console.log('AUTO DONE', JSON.stringify(st));
      break;
    }
  }
} else {
  const names = only ? only.split(',') : Object.keys(SHOTS);
  let booted = true;
  for (const name of names) {
    const s = SHOTS[name];
    if (!s) continue;
    if (!booted || s.restored || s.seedwells) {
      await boot();
    }
    booted = !(s.restored || s.seedwells);
    if (s.seedwells) await page.evaluate(() => window.__gameHooks.lightSeedwells());
    await page.evaluate(([x, y, z]) => window.__gameHooks.teleport(x, y, z), s.fox);
    if (s.restored) await page.evaluate(() => window.__gameHooks.forceRestore());
    if (s.photo) await page.evaluate(([p, l, f]) => window.__gameHooks.photo(p, l, f), s.photo);
    else await page.evaluate(() => window.__gameHooks.photoOff());
    // wait in *sim* seconds (swiftshader runs ~2 fps; dt is capped at 0.05)
    const simWait = (s.wait ?? 2500) / 1000;
    const t0 = await page.evaluate(() => window.__gameHooks.state().t);
    await page.waitForFunction((t) => window.__gameHooks.state().t > t, t0 + simWait, { timeout: 600000 });
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    await page.screenshot({ path: `${out}/${name}.png` });
    const st = await page.evaluate(() => window.__gameHooks.state());
    console.log(name, JSON.stringify({ zone: st.zone, sw: st.seedwells.map((q) => q.lit), restored: st.restored }));
  }
}
fs.writeFileSync(`${out}/capture-errors.json`, JSON.stringify(errors, null, 2));
console.log('errors', errors.length);
await browser.close();
if (server) await server.close();
process.exit(0);
