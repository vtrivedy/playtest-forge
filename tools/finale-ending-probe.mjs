// Ending legibility probe (DESIGN-finale.md § Sell the ending on screen). Staged: dev Keeping release, park the fox
// by the Press, force the finale; after snow the fox walks through the curled kits (they must make room), stops
// by the ember, and the composed rest shot + in-frame card play. Saves screenshots and a metrics log:
//   kitNearMin (hero↔kit, m) over the rest hold, foxPx in the held shot, card opacity, kit phases.
//   node tools/finale-ending-probe.mjs [outDir] [--frames]   (--frames: 30 fps stills of the hold → hold.mp4)
import { chromium } from 'playwright';
import { createServer } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const out = path.resolve(args[0] && !args[0].startsWith('--') ? args[0] : '/tmp/finale-ending');
const frames = args.includes('--frames');
fs.mkdirSync(out, { recursive: true });
const port = 5197;
const server = await createServer({ configFile: 'games/fox-spirit/vite.config.ts', server: { port, host: '127.0.0.1', strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
page.setDefaultTimeout(600000);
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const log = [];
const metrics = { kitNearMin: 99, kitNearMinRest: 99, disturbs: 0, foxPxHold: [], cardMax: 0 };
const save = () => fs.writeFileSync(path.join(out, 'log.json'), JSON.stringify({ metrics, log, errors }, null, 1));
const H = (fn, ...a) => page.evaluate(([fn, a]) => window.__gameHooks[fn](...a), [fn, a]);
const fin = () => page.evaluate(() => ({ ...window.__gameHooks.state().opening.finale, foxPx: window.__gameHooks.foxScreenPx(), fox: window.__gameHooks.state().pos }));
const shot = async (name) => {
  await H('advance', 0, 1 / 60, true);
  await page.screenshot({ path: path.join(out, `${name}.png`) });
  log.push([name, await fin()]);
  save();
};
// step n frames, tracking the kit metrics each frame (in-page, no render)
const step = (n, stick) => page.evaluate(([n, stick]) => {
  const h = window.__gameHooks;
  if (stick) h.setStick(stick[0], stick[1]); else h.setStick(0, 0);
  let near = 99, shuffles = 0, prev = null, cardMax = 0;
  for (let i = 0; i < n; i++) {
    const f = h.advance(1, 1 / 60, false).opening.finale;
    if (f.kits.some((k) => k !== 'pressed' && k !== 'drifting')) near = Math.min(near, f.kitNear);
    const sh = f.kits.filter((k) => k === 'shuffling').length;
    if (prev !== null && sh > prev) shuffles += sh - prev;
    prev = sh;
  }
  return { near, shuffles };
}, [n, stick]);
try {
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded', timeout: 300000 });
  await page.waitForFunction(() => window.__gameHooks?.ready === true, null, { timeout: 600000 });
  await page.keyboard.press('KeyM');
  await H('setManual', true);
  await page.evaluate(() => { const h = window.__gameHooks; h.keepingRelease(); h.advance(600, 1 / 60, false); h.teleport(20.0, 42.2, Math.PI + 0.3); h.advance(90, 1 / 60, false); h.finale(); });
  // the fox waits out the release well back from the ember (outside the 4.2 m rest radius), so the card waits for it
  await page.evaluate(() => { const h = window.__gameHooks; h.teleport(18.2, 46.0, Math.PI + 0.3); });
  await step(21 * 60);
  await shot('01-snow');
  // all kits home? wait for them
  for (let i = 0; i < 20; i++) {
    const f = await fin();
    if (f.kits.every((k) => k === 'curled')) break;
    await step(60);
  }
  await shot('02-kits-curled');
  // walk through the ring of kits: toward the cradle, across it, and back
  const f0 = await fin();
  const [cx, cz] = f0.cradle;
  const walkTo = async (tx, tz, maxFrames) => {
    let r = { near: 99, shuffles: 0 };
    for (let k = 0; k < maxFrames; k += 6) {
      const p = (await fin()).fox;
      const dx = tx - p[0], dz = tz - p[2];
      const d = Math.hypot(dx, dz);
      if (d < 0.3) break;
      const s = Math.min(1, d) * 0.6;
      const q = await step(6, [(dx / d) * s, (dz / d) * s]);
      r.near = Math.min(r.near, q.near); r.shuffles += q.shuffles;
    }
    return r;
  };
  const w1 = await walkTo(cx, cz, 400);
  const w2 = await walkTo(cx + (cx - f0.fox[0]) * 0.25, cz + (cz - f0.fox[2]) * 0.25, 200);
  const w3 = await walkTo(cx + 0.4, cz + 0.3, 200);
  metrics.disturbs = w1.shuffles + w2.shuffles + w3.shuffles;
  metrics.walkNearMin = Math.min(w1.near, w2.near, w3.near);
  await shot('03-walked-through');
  // stand still: kits resettle, fox lies down, card + composed shot (--frames: record this as a 30 fps clip)
  const restStart = await step(60);
  metrics.kitNearMin = restStart.near;
  let fi = 0;
  for (let t = 0; t < 32; t++) {
    let q = { near: 99 };
    if (frames) {
      for (let k = 0; k < 15; k++) {
        const r = await step(2);
        q.near = Math.min(q.near, r.near);
        await H('advance', 0, 1 / 60, true);
        await page.screenshot({ path: path.join(out, `h${String(fi++).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 85 });
      }
    } else q = await step(30);
    metrics.kitNearMinRest = Math.min(metrics.kitNearMinRest, q.near);
    const f = await fin();
    metrics.cardMax = Math.max(metrics.cardMax, f.card === 'showing' ? 1 : 0);
    if (f.card === 'showing' || f.card === 'done') metrics.foxPxHold.push(+f.foxPx.toFixed(1));
    if (t % 4 === 1) await shot(`10-rest-${String(t).padStart(2, '0')}`);
  }
  if (frames) execFileSync('ffmpeg', ['-y', '-v', 'error', '-framerate', '30', '-pattern_type', 'glob', '-i', path.join(out, 'h*.jpg'), '-pix_fmt', 'yuv420p', path.join(out, 'hold.mp4')]);
  // the player moves on: the lens hands back, play continues in the snow
  await step(90, [0.8, 0]);
  await shot('20-moved-on');
} catch (e) {
  errors.push(String(e?.stack ?? e));
} finally {
  save();
  console.log(JSON.stringify({ errors, metrics }, null, 1));
  await browser.close();
  await server.close();
}
