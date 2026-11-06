// The Scribe's Press, played with stick + Space/Shift only after ONE staged placement (the dev travel hook drops the
// fox at the Press spawn, as walking through the hub arch does). Beats: brazier → seal → gate → membrane air-dash →
// draft ride → shelf → brazier → relay → near brazier → iced membrane → air-dash → re-warm → ride the short draft
// carrying warmth onto the pillar (its brazier lights, the seam thaws, the stair stands) → climb → ledge.
//   node tools/press-probe.mjs --out /tmp/press-probe [--port 5214] [--from shelf]
// --from shelf (iteration only, not route proof): a saved teach+develop and one teleport onto the Archive shelf.
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
const from = arg('from', 'spawn');
fs.mkdirSync(out, { recursive: true });
const server = await createServer({ configFile: 'games/fox-spirit/vite.config.ts', server: { port, host: '127.0.0.1', strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
page.setDefaultTimeout(600000);
const evidence = { staging: 'one dev travel("press") at the start; every later action is stick/Space/Shift', beats: [], errors: [] };
page.on('pageerror', (e) => evidence.errors.push(String(e)));
if (from === 'shelf') {
  await page.goto(`http://127.0.0.1:${port}/?fresh`, { waitUntil: 'domcontentloaded', timeout: 600000 });
  await page.evaluate(() => localStorage.setItem('russet-vale-worlds-v1', JSON.stringify({ version: 1, worlds: { press: { restored: ['teach', 'develop'], visited: ['teach', 'develop'] } }, secrets: [] })));
  evidence.staging = 'ITERATION ONLY: saved teach+develop, travel("press"), one teleport onto the Archive shelf';
}
await page.goto(`http://127.0.0.1:${port}/${from === 'shelf' ? '' : '?fresh'}`, { waitUntil: 'domcontentloaded', timeout: 600000 });
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
  let s = h.advance(1, 1 / 60, false);
  if (dir) {
    h.setStick(dir[0] * 0.2, dir[1] * 0.2);
    h.setKeys(['Space']);
    s = h.advance(14, 1 / 60, false);
    h.setKeys(['Space', 'ShiftLeft']);
    s = h.advance(3, 1 / 60, false);
    h.setStick(null);
    h.setKeys([]);
    s = h.advance(70, 1 / 60, false);
  }
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
/** step into the draft at `center`, jump and hold glide to the crest, then air-dash south holding glide */
const inkstepFromCrest = (center) => page.evaluate((center) => {
  const h = window.__gameHooks;
  let s = h.advance(1, 1 / 60, false);
  for (let f = 0; f < 240; f++) {
    const dx = center[0] - s.pos[0], dz = center[1] - s.pos[2], d = Math.hypot(dx, dz);
    if (d < 0.25) break;
    h.setStick(dx / d * 0.5, dz / d * 0.5);
    s = h.advance(1, 1 / 60, false);
  }
  h.setStick(null);
  s = h.advance(20, 1 / 60, false);
  h.setKeys(['Space']);
  let best = s.pos[1];
  let still = 0;
  for (let f = 0; f < 240 && still < 8; f++) {
    s = h.advance(1, 1 / 60, false);
    if (s.pos[1] > best + 0.005) { best = s.pos[1]; still = 0; } else if (f > 20) still++;
  }
  h.setStick(0, -1);
  h.setKeys(['Space', 'ShiftLeft']);
  s = h.advance(4, 1 / 60, false);
  h.setKeys(['Space']);
  s = h.advance(50, 1 / 60, false);
  h.setStick(null);
  h.setKeys([]);
  return h.advance(40, 1 / 60, false);
}, center);
/** a running hop onto world [x, z]: steer there holding Space for the first 14 frames, until landed within 0.4 m */
const hop = (to) => page.evaluate((to) => {
  const h = window.__gameHooks;
  let s = h.state();
  for (let n = 0; n < 120; n++) {
    const dx = to[0] - s.pos[0], dz = to[1] - s.pos[2], d = Math.hypot(dx, dz);
    if (d < 0.4 && s.grounded && n > 14) break;
    const k = Math.min(1, d / 0.8);
    h.setStick(d > 0.05 ? (dx / d) * k : 0, d > 0.05 ? (dz / d) * k : 0);
    h.setKeys(n < 14 ? ['Space'] : []);
    s = h.advance(1, 1 / 60, false);
  }
  h.setStick(null);
  h.setKeys([]);
  return h.advance(6, 1 / 60, false);
}, to);
const shot = async (name) => {
  const s = await page.evaluate(() => window.__gameHooks.advance(1, 1 / 60, true));
  await page.screenshot({ path: path.join(out, `${name}.jpg`), quality: 85 });
  const b = { name, pos: s.pos.map((v) => +v.toFixed(2)), press: s.opening.press, progress: s.opening.worlds?.progress?.worlds?.press ?? null };
  evidence.beats.push(b);
  console.log(name, JSON.stringify(b));
  return s;
};

let s;
if (from === 'shelf') {
  await page.evaluate(() => { const h = window.__gameHooks; h.teleport(-700, 85 - 9, Math.PI); h.advance(60, 1 / 60, false); });
  s = await shot('05-on-shelf');
} else {
await shot('00-spawn');
// the direct try: lit brazier → seal fades on the way (the puzzle's lesson), then the relay
await walk(L(-20.6, 27.4), { r: 0.3 });
await shot('01-brazier');
await walk(L(0, 18), { r: 0.4 });
await shot('01b-faded-at-seal');
await walk(L(-20.6, 27.4), { r: 0.3 });
await walk(L(-7.6, 29.8), { r: 0.3 });
await shot('01c-relay-lit');
await walk(L(-1, 21), { r: 0.4 });
await walk(L(0, 16.4), { r: 0.3, max: 3 });
await page.evaluate(() => window.__gameHooks.advance(100, 1 / 60, false));
await shot('02-seal-thawed');
await walk(L(0, 8), { r: 0.5 });
await shot('03-through-gate');
await walk(L(0, -0.2), { r: 0.3 });
await walk(L(0, -1.0), { r: 0.2, mag: 0.3, max: 2 });
await shot('04-before-membrane');
// the Folded Archive: crack the floor membrane (dash across it), ride its short draft to the crest — it tops out
// under the shelf — and air-dash into the frozen sheet hung across the alcove (Inkstep, in the air)
s = await breakAndRide([0, -1], L(0, -3.6), [...L(0, -3.6), 99], 3.2);
evidence.floorDraftOnly = { peak: +s.peak.toFixed(2), shelfTop: s.opening.press.shelfTop, sillTop: s.opening.press.sillTop };
console.log('floor draft alone', JSON.stringify(evidence.floorDraftOnly));
await shot('04b-floor-draft-under-shelf');
s = await inkstepFromCrest(L(0, -3.6));
console.log('crest inkstep', JSON.stringify({ pos: s.pos.map((v) => +v.toFixed(2)), faceTorn: s.opening.press.faceTorn }));
await shot('04c-face-torn');
if (s.pos[1] < s.opening.press.sillTop - 0.3) s = await breakAndRide(null, L(0, -3.6), [...L(0, -7.3), s.opening.press.sillTop + 0.7], 6);
console.log('in alcove', s.pos.map((v) => +v.toFixed(2)));
s = await breakAndRide(null, L(0, -7.3), [...L(0, -10.5), s.opening.press.shelfTop + 0.9], 8);
console.log('chimney ride peak', s.peak);
s = await shot('05-on-shelf');
}
const shelfY = s.pos[1];
// the direct try first: the near brazier is too far from the lit one (the warmth fades on the way)
await walk(L(28.6, -10.5), { r: 0.3 });
await shot('06-brazier-b');
await walk(L(14, -19.6), { r: 0.3 });
await shot('06b-relay-b');
await walk(L(8.4, -11.2), { r: 0.3 });
await shot('06c-near-brazier');
await walk(L(5.6, -12.4), { r: 0.3 });
await page.evaluate(() => window.__gameHooks.advance(80, 1 / 60, false));
await shot('07-ice-melted');
// crack it: come round to its north, face south, jump and air-dash over it (Inkstep)
await walk(L(4, -8.4), { r: 0.3 });
await walk(L(4, -10.6), { r: 0.2, mag: 0.4 });
await page.evaluate(() => {
  const h = window.__gameHooks;
  h.setStick(0, -0.2); h.setKeys(['Space']); h.advance(14, 1 / 60, false);
  h.setKeys(['Space', 'ShiftLeft']); h.advance(3, 1 / 60, false);
  h.setStick(null); h.setKeys([]); h.advance(70, 1 / 60, false);
});
await shot('07b-short-draft');
// the short draft alone: ride it and try for the ledge (falls short — the ledge is out of the column's reach)
s = await breakAndRide(null, L(4, -13.2), [...L(4, -20.6), shelfY + 4.0], 6);
evidence.shortDraftTry = { peakAboveShelf: +(s.peak - shelfY).toFixed(2), landedAboveShelf: +(s.pos[1] - shelfY).toFixed(2), pos: s.pos.map((v) => +v.toFixed(2)), ledgeRise: 4.6 };
console.log('short draft try', JSON.stringify(evidence.shortDraftTry));
await shot('07c-short-draft-falls-short');
// warmth up the draft: re-warm at the near brazier, step into the draft, ride, glide onto the pillar
await walk(L(8.4, -11.2), { r: 0.3 });
s = await page.evaluate(() => window.__gameHooks.advance(1, 1 / 60, false));
console.log('warm before ride', s.opening.press.warm);
s = await breakAndRide(null, L(4, -13.2), [...L(4, -17), shelfY + 3.5], 6);
console.log('ride to pillar peak above shelf', +(s.peak - shelfY).toFixed(2), 'pos', s.pos.map((v) => +v.toFixed(2)));
await shot('08-pillar-kindled');
await page.evaluate(() => window.__gameHooks.advance(150, 1 / 60, false));
await shot('08b-seam-running');
await page.evaluate(() => window.__gameHooks.advance(240, 1 / 60, false));
await shot('08c-stair-stands');
// down off the pillar's west side, round to the stair's foot, climb south
await walk(L(0.6, -17.5), { r: 0.4, max: 4 });
await walk(L(-1.6, -12.6), { r: 0.4 });
await walk(L(-4.5, -10.4), { r: 0.3 });
for (let i = 0; i < 8; i++) s = await hop(L(-4.5, -11.2 - (i + 0.5) * 1.225));
s = await hop(L(-4.5, -22.6));
console.log('climbed to', s.pos.map((v) => +v.toFixed(2)), 'above shelf', +(s.pos[1] - shelfY).toFixed(2));
await shot('08d-ledge');
await page.evaluate(() => { const h = window.__gameHooks; h.setStick(0.6, 0.8); h.advance(40, 1 / 60, false); h.setStick(null); h.advance(60, 1 / 60, false); });
await shot('09-the-press');
await page.evaluate(() => { const h = window.__gameHooks; h.setStick(-0.7, -0.7); h.advance(25, 1 / 60, false); h.setStick(null); h.advance(240, 1 / 60, false); });
await shot('10-scribe-lever');
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
