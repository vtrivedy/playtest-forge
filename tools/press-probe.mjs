// The Scribe's Press, played with stick + Space/Shift only after ONE staged placement (the dev travel hook drops the
// fox at the Press spawn, as walking through the hub arch does). Beats: brazier → seal → gate → membrane air-dash →
// draft ride → shelf → brazier → iced membrane → air-dash → draft ride → ledge. Stills + evidence.json.
//   node tools/press-probe.mjs --out /tmp/press-probe [--port 5214]
import { chromium } from 'playwright';
import { createServer } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const out = path.resolve(arg('out', '/tmp/press-probe'));
const port = Number(arg('port', 5214));
fs.mkdirSync(out, { recursive: true });
const server = await createServer({ configFile: 'games/fox-spirit/vite.config.ts', server: { port, host: '127.0.0.1', strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
page.setDefaultTimeout(600000);
const evidence = { staging: 'one dev travel("press") at the start; every later action is stick/Space/Shift', beats: [], errors: [] };
page.on('pageerror', (e) => evidence.errors.push(String(e)));
await page.goto(`http://127.0.0.1:${port}/?fresh`, { waitUntil: 'domcontentloaded', timeout: 600000 });
await page.waitForFunction(() => window.__gameHooks?.ready === true, null, { timeout: 600000 });
// Inkstep needs Russetvale's page home only for the hub arch; the Press levels themselves gate on their own progress
await page.evaluate(() => {
  const h = window.__gameHooks;
  h.setManual(true);
  h.travel('press');
  h.advance(60, 1 / 60, false);
});
const L = (lx, lz) => [-700 + lx, 85 + lz];
/** walk toward world [x, z] until within r (or max s) */
const walk = (to, o = {}) => page.evaluate(({ to, o }) => {
  const h = window.__gameHooks;
  let s = h.state();
  for (let f = 0; f < (o.max ?? 20) * 60; f++) {
    const dx = to[0] - s.pos[0], dz = to[1] - s.pos[2], d = Math.hypot(dx, dz);
    if (d < (o.r ?? 0.6)) break;
    h.setStick(dx / d * (o.mag ?? 1), dz / d * (o.mag ?? 1));
    h.setKeys([]);
    s = h.advance(1, 1 / 60, false);
  }
  h.setStick(null);
  return h.advance(10, 1 / 60, false);
}, { to, o });
/** jump toward `dir` and air-dash at the top (cracks a membrane), land, step back onto it, jump into the draft and
 *  hold glide straight up until `glideTo[2]`, then drift to [glideTo[0], glideTo[1]] */
const breakAndRide = (dir, center, glideTo, holdS) => page.evaluate(({ dir, center, glideTo, holdS }) => {
  const h = window.__gameHooks;
  let s;
  h.setStick(dir[0] * 0.2, dir[1] * 0.2);
  h.setKeys(['Space']);
  s = h.advance(14, 1 / 60, false);
  h.setKeys(['Space', 'ShiftLeft']);
  s = h.advance(3, 1 / 60, false);
  h.setStick(null);
  h.setKeys([]);
  s = h.advance(70, 1 / 60, false);
  for (let f = 0; f < 240; f++) {
    const dx = center[0] - s.pos[0], dz = center[1] - s.pos[2], d = Math.hypot(dx, dz);
    if (d < 0.25) break;
    h.setStick(dx / d * 0.5, dz / d * 0.5);
    s = h.advance(1, 1 / 60, false);
  }
  h.setStick(null);
  s = h.advance(20, 1 / 60, false);
  let peak = s.pos[1];
  h.setKeys(['Space']);
  for (let f = 0; f < holdS * 60; f++) {
    const up = s.pos[1] < glideTo[2];
    const dx = glideTo[0] - s.pos[0], dz = glideTo[1] - s.pos[2], d = Math.hypot(dx, dz) || 1;
    h.setStick(up ? null : dx / d, up ? 0 : dz / d);
    h.setKeys(s.grounded && f > 30 ? [] : ['Space']);
    s = h.advance(1, 1 / 60, false);
    peak = Math.max(peak, s.pos[1]);
    if (s.grounded && f > 30) break;
  }
  h.setStick(null);
  h.setKeys([]);
  s = h.advance(20, 1 / 60, false);
  return { ...s, peak };
}, { dir, center, glideTo, holdS });
const shot = async (name) => {
  const s = await page.evaluate(() => window.__gameHooks.advance(1, 1 / 60, true));
  await page.screenshot({ path: path.join(out, `${name}.jpg`), quality: 85 });
  const b = { name, pos: s.pos.map((v) => +v.toFixed(2)), press: s.opening.press, progress: s.opening.worlds?.progress?.worlds?.press ?? null };
  evidence.beats.push(b);
  console.log(name, JSON.stringify(b));
  return s;
};

await shot('00-spawn');
await walk(L(-8.6, 26), { r: 0.3 });
await shot('01-brazier');
await walk(L(0, 20), { r: 0.4 });
await walk(L(0, 16.4), { r: 0.3, max: 3 });
await page.evaluate(() => window.__gameHooks.advance(100, 1 / 60, false));
await shot('02-seal-thawed');
await walk(L(0, 8), { r: 0.5 });
await shot('03-through-gate');
await walk(L(0, -0.2), { r: 0.3 });
await walk(L(0, -1.0), { r: 0.2, mag: 0.3, max: 2 });
await shot('04-before-membrane');
let s = await breakAndRide([0, -1], L(0, -3.6), [...L(0, -9), 7.6], 8);
console.log('ride1 peak', s.peak);
await shot('05-on-shelf');
await walk(L(10.6, -13.4), { r: 0.3 });
await shot('06-brazier-b');
await walk(L(0, -17.2), { r: 0.3 });
await page.evaluate(() => window.__gameHooks.advance(80, 1 / 60, false));
await shot('07-ice-melted');
await walk(L(0, -14.4), { r: 0.3 });
await walk(L(0, -16.0), { r: 0.25, mag: 0.4 });
s = await breakAndRide([0, -1], L(0, -18.6), [...L(0, -24), 12.2], 8);
console.log('ride2 peak', s.peak);
await shot('08-ledge');
await page.evaluate(() => { const h = window.__gameHooks; h.setStick(0.6, 0.8); h.advance(40, 1 / 60, false); h.setStick(null); h.advance(60, 1 / 60, false); });
await shot('09-the-press');
// save re-entry: a plain reload (no ?fresh) rebuilds the solved Press from the saved progress
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded', timeout: 600000 });
await page.waitForFunction(() => window.__gameHooks?.ready === true, null, { timeout: 600000 });
evidence.reload = await page.evaluate(() => { const h = window.__gameHooks; h.setManual(true); h.travel('press'); return h.advance(30, 1 / 60, false).opening.press; });
console.log('reload', JSON.stringify(evidence.reload));
fs.writeFileSync(path.join(out, 'evidence.json'), JSON.stringify(evidence, null, 2));
const last = evidence.beats.at(-1);
console.log(JSON.stringify({ done: last.press?.done, progress: last.progress, errors: evidence.errors.length }));
await browser.close();
await server.close();
process.exit(0);
