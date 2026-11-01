// Free-play checks for the first Keeping: the edges a player finds that the hero route never walks.
// Stick + Space/Shift/E input only after a STAGED start teleport per scenario (disclosed in evidence.json).
//   node tools/keeping-freeplay-probe.mjs --out /tmp/keeping-freeplay
import { chromium } from 'playwright';
import { createServer } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const out = path.resolve(arg('out', '/tmp/keeping-freeplay'));
fs.mkdirSync(out, { recursive: true });
const server = await createServer({ configFile: 'games/fox-spirit/vite.config.ts', server: { port: 5198, host: '127.0.0.1', strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
page.setDefaultTimeout(300000);
const evidence = { staging: 'one teleport per scenario start (fresh page); every later action is stick/Space/Shift/E', results: [], errors: [] };
page.on('pageerror', (e) => evidence.errors.push(String(e)));

async function boot() {
  await page.goto('http://127.0.0.1:5198/', { waitUntil: 'domcontentloaded', timeout: 300000 });
  await page.waitForFunction(() => window.__gameHooks?.ready === true, null, { timeout: 600000 });
  await page.evaluate(() => window.__gameHooks.setManual(true));
}
/** walk toward [x, z] (optionally holding keys) until within r or `max` seconds; returns the last state */
const drive = (to, o = {}) => page.evaluate(({ to, o }) => {
  const h = window.__gameHooks;
  let s = h.state();
  const frames = Math.round((o.max ?? 15) * 60);
  for (let f = 0; f < frames; f++) {
    const dx = to[0] - s.pos[0], dz = to[1] - s.pos[2], d = Math.hypot(dx, dz);
    if (o.untilY !== undefined ? s.pos[1] > o.untilY : d < (o.r ?? 0.5) && (!o.grounded || s.grounded)) break;
    const mag = d < 0.05 ? 0 : o.mag ?? 0.6;
    h.setStick(dx / (d || 1) * mag, dz / (d || 1) * mag);
    h.setKeys(f < (o.tap ?? 0) || o.hold ? o.keys ?? [] : []);
    s = h.advance(1, 1 / 60, false);
  }
  if (o.untilY !== undefined) return s;
  h.setStick(null);
  h.setKeys([]);
  return h.advance(20, 1 / 60, false);
}, { to, o });
const key = (k, frames = 2) => page.evaluate(({ k, frames }) => {
  const h = window.__gameHooks;
  h.setKeys([k]);
  h.advance(frames, 1 / 60, false);
  h.setKeys([]);
  return h.advance(10, 1 / 60, false);
}, { k, frames });
const stage = (x, z, yaw) => page.evaluate(({ x, z, yaw }) => { const h = window.__gameHooks; h.teleport(x, z, yaw); return h.advance(30, 1 / 60, false); }, { x, z, yaw });
const shot = (name) => page.evaluate(() => window.__gameHooks.advance(1, 1 / 60, true)).then(() => page.screenshot({ path: path.join(out, `${name}.png`) }));
function check(name, pass, detail) {
  evidence.results.push({ name, pass: !!pass, detail });
  console.log(pass ? 'PASS' : 'FAIL', name, JSON.stringify(detail));
}
const c = (s) => s.opening.carry;
/** from anywhere in the meadow: round the shelf's west face to H-a, let it light, ride it, glide onto the shelf */
async function rideHome() {
  await drive([7.5, 81], { max: 25, r: 0.8 });
  await drive([4.3, 74.9], { max: 15 });
  await page.evaluate(() => window.__gameHooks.advance(150, 1 / 60, false));
  await drive([4.3, 74.8], { keys: ['Space'], hold: true, max: 8, untilY: 7, mag: 0.25 });
  return drive([13, 75.5], { keys: ['Space'], hold: true, max: 12, r: 0.8, grounded: true });
}

try {
  // 1. walk off the ledge carrying: lands in the meadow still carrying, rides H-a back up with it
  await boot();
  await stage(14.6, 76.95, 0);
  let s = await key('KeyE');
  check('pickup at cradle', c(s).carried, c(s).position);
  s = await drive([15.4, 79.6]);
  s = await drive([12.5, 82.5], { max: 6, r: 0.4 });
  check('walk off the ledge keeps the coal', c(s).carried && s.pos[1] < 2, { pos: s.pos, carried: c(s).carried });
  s = await rideHome();
  check('H-a ride back to the shelf carrying', c(s).carried && s.pos[1] > 4.5, { pos: s.pos, carried: c(s).carried, hearth: s.opening.hearth.latched });
  await shot('01-back-on-shelf-carrying');

  // 2. jump off the ledge and dash in the air: the coal stays on the ledge at the last grounded spot
  await boot();
  await stage(14.6, 76.95, 0);
  await key('KeyE');
  s = await drive([17.4, 82]);
  const ledgeFoot = s.pos;
  s = await page.evaluate(() => {
    const h = window.__gameHooks;
    h.setStick(-0.8, 0.6);
    h.setKeys(['Space']);
    h.advance(12, 1 / 60, false);
    h.setKeys(['ShiftLeft']);
    h.advance(2, 1 / 60, false);
    h.setKeys([]);
    return h.advance(150, 1 / 60, false);
  });
  check('air dash-drop leaves the coal on the ledge', !c(s).carried && c(s).dashDrops === 1 && Math.abs(c(s).position[1] - 4.957) < 0.1, { coal: c(s).position, ledgeFoot, fox: s.pos });
  await shot('02-dash-drop-coal-on-ledge');
  s = await rideHome();
  const coalAt = c(s).position;
  s = await drive([15.4, 79.6]);
  s = await drive([coalAt[0], coalAt[2]], { r: 0.6 });
  s = await key('KeyE');
  check('recover the dash-dropped coal', c(s).carried, { fox: s.pos, coal: c(s).position });

  // 3. place the coal anywhere on the meadow and walk away: it keeps burning where it was set down
  await boot();
  await stage(14.6, 76.95, 0);
  await key('KeyE');
  await drive([15.4, 79.6]);
  await drive([12.5, 82.5], { max: 6, r: 0.4 });
  s = await key('KeyE');
  const set = c(s).position;
  s = await drive([-3, 81], { max: 20 });
  s = await page.evaluate(() => window.__gameHooks.advance(600, 1 / 60, false));
  check('placed coal keeps burning, no cooling', !c(s).carried && c(s).heat === 1 && Math.hypot(c(s).position[0] - set[0], c(s).position[2] - set[2]) < 0.01, { set, now: c(s).position, heat: c(s).heat });

  // 4. walk off the far crag into the vista valley: the meadow stays reachable on foot (no soft-lock)
  await boot();
  await page.evaluate(() => { const h = window.__gameHooks; h.keepingRelease(); h.advance(400, 1 / 60, false); });
  await stage(26.2, 66.2, Math.PI);
  s = await drive([22, 52], { max: 10, r: 0.6 });
  const valley = s.pos;
  s = await drive([4, 72], { max: 40, r: 1 });
  check('vista valley walks back to the meadow', Math.hypot(s.pos[0] - 4, s.pos[2] - 72) < 2, { valley, end: s.pos });
  await shot('04-back-from-valley');
} catch (e) {
  evidence.errors.push(String(e?.stack ?? e));
  console.log('ERROR', e);
} finally {
  fs.writeFileSync(path.join(out, 'evidence.json'), JSON.stringify(evidence, null, 2));
  await browser.close();
  await server.close();
}
