// Ashwater Reach (world II) route probe: staged start on the landing (dev hook `ashwater`), then stick/keys only through
// all three levels — dash the sluice dam, cross the drained channel, hop the reed mats, dash the islet dam, climb the
// drained pool's steps, glide to the Seedwell. Saves beat screenshots + state + a pass/fail summary.
//   node tools/ashwater-probe.mjs [outDir] [--frames]   (--frames: 10 fps stills → route.mp4)
import { chromium } from 'playwright';
import { createServer } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const out = path.resolve(args[0] && !args[0].startsWith('--') ? args[0] : '/tmp/ashwater-probe');
const frames = args.includes('--frames');
fs.mkdirSync(out, { recursive: true });
const port = 5201;
const server = await createServer({ configFile: 'games/fox-spirit/vite.config.ts', server: { port, host: '127.0.0.1', strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
page.setDefaultTimeout(900000);
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
const log = [];
let fi = 0;
const O = { x: 700, z: 80 };
const state = () => page.evaluate(() => { const s = window.__gameHooks.state(); return { pos: s.pos.map((v) => +v.toFixed(2)), grounded: s.grounded, ash: s.opening.ashwater }; });
const shot = async (name) => {
  await page.evaluate(() => window.__gameHooks.advance(0, 1 / 60, true));
  await page.screenshot({ path: path.join(out, `${name}.png`) });
  log.push([name, await state()]);
};
/** steer (world stick) toward local (lx, lz); optional jump (held = glide) / dash; returns when within reach */
const go = async (lx, lz, o = {}) => {
  const r = await page.evaluate(([x, z, o]) => {
    const h = window.__gameHooks;
    let n = 0;
    for (; n < (o.max ?? 900); n++) {
      const s = h.state();
      const dx = x - s.pos[0], dz = z - s.pos[2], d = Math.hypot(dx, dz);
      if (d < (o.reach ?? 0.35) && (!o.land || s.grounded)) break;
      const k = Math.min(1, d / 0.8) * (o.speed ?? 1);
      h.setStick(d > 0.05 ? (dx / d) * k : 0, d > 0.05 ? (dz / d) * k : 0);
      const keys = [];
      // a running jump: hold Space from the moment the fox is within `jumpAt` of the target (default: at once)
      if (o.jump && d < (o.jumpAt ?? 99)) o.jumped = o.jumped ?? n;
      if (o.jump && o.jumped !== undefined && n - o.jumped < (o.hold ?? 40)) keys.push('Space');
      if (o.dash && n >= (o.dashAt ?? 0) && n < (o.dashAt ?? 0) + 4) keys.push('ShiftLeft');
      h.setKeys(keys);
      h.advance(1, 1 / 60, false);
    }
    h.setKeys([]);
    return n;
  }, [O.x + lx, O.z + lz, o]);
  if (frames) {
    await page.evaluate(() => window.__gameHooks.advance(0, 1 / 60, true));
    await page.screenshot({ path: path.join(out, `f${String(fi++).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 80 });
  }
  return r;
};
const settle = (n) => page.evaluate((n) => { const h = window.__gameHooks; h.setStick(0, 0); h.setKeys([]); h.advance(n, 1 / 60, false); }, n);
try {
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded', timeout: 300000 });
  await page.waitForFunction(() => window.__gameHooks?.ready === true, null, { timeout: 600000 });
  await page.keyboard.press('KeyM');
  await page.evaluate(() => { const h = window.__gameHooks; h.setManual(true); h.ashwater(); h.advance(60, 1 / 60, false); });
  await shot('00-landing');
  // Level 1, Low Sluice: try the channel first (it is deep: the fox is put back), then dash the dam
  await go(0, -31.5, { max: 400 });
  await settle(30);
  log.push(['wade-test', await state()]);
  await go(-6.5, -35.4);
  await shot('01-dam');
  await go(-12.5, -35.2, { dash: true, dashAt: 2, max: 90, reach: 0.6 });
  await settle(240);
  await shot('02-drained');
  for (const [x, z] of [[-3, -33], [0, -28.5], [0, -20], [0, -13]]) await go(x, z);
  await settle(90);
  await shot('03-reed-island');
  // Level 2, Reed Pond: running jumps mat to mat, the branch out to the islet first
  const hop = async (x, z) => { await go(x, z, { jump: true, jumpAt: 2.3, hold: 14, max: 240, reach: 0.6, land: true }); };
  const M = [[-0.8, -6.0], [0.8, -3.0], [0, 0]];
  const B = [[3.2, 0.5], [6.4, 0.2], [9.6, 0.7], [12.8, 0.4], [16.0, 0.8], [19.2, 0.6], [22.6, 1.0]];
  await go(-0.8, -10.2);
  for (const [x, z] of M) await hop(x, z);
  await shot('04-mats');
  for (const [x, z] of B) await hop(x, z);
  // Level 3 part: dash the islet's dam
  await go(26.2, 1.0, { dash: true, dashAt: 1, max: 60, reach: 0.6 });
  await settle(240);
  await shot('05-pool-drained');
  for (const [x, z] of [...B.slice(0, -1).reverse(), [0, 0], [-0.9, 3.0], [0.6, 6.0], [-0.5, 9.0], [0.4, 12.0], [0, 15.2]]) await hop(x, z);
  await go(0, 17.5);
  await shot('06-mill-shore');
  // the drained pool and its steps
  await go(0, 26.8);
  for (let i = 0; i < 7; i++) await go(0, 28.3 + i * 0.86, { jump: true, hold: 14, max: 120, reach: 0.4, land: true });
  await go(0, 36.5, { jump: true, hold: 14, max: 120, land: true });
  await shot('07-weir');
  await go(14, 40);
  await go(26.5, 40.5, { jump: true, hold: 200, max: 400, reach: 0.8, land: true });
  await settle(200);
  await shot('08-seedwell');
} catch (e) {
  errors.push(String(e?.stack ?? e));
} finally {
  const last = log.length ? log[log.length - 1][1] : null;
  fs.writeFileSync(path.join(out, 'log.json'), JSON.stringify({ log, errors, pass: !!last && last.ash.done.length === 3 }, null, 1));
  if (frames && fi > 0) execFileSync('ffmpeg', ['-y', '-v', 'error', '-framerate', '6', '-i', path.join(out, 'f%04d.jpg'), '-pix_fmt', 'yuv420p', path.join(out, 'route.mp4')]);
  console.log(JSON.stringify({ errors, last }, null, 1));
  await browser.close();
  await server.close();
}
