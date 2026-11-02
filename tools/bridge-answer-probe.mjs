// The Hearthtree bridge answers the fox: release the tree (dev hook), let the leaf storm settle, walk the fox
// across the trunk with real stick input and check leaves were kicked up and the wood creaked. Saves a still.
//   node tools/bridge-answer-probe.mjs --out /tmp/bridge-answer
import { chromium } from 'playwright';
import { createServer } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const out = path.resolve(arg('out', '/tmp/bridge-answer'));
fs.mkdirSync(out, { recursive: true });
const server = await createServer({ configFile: 'games/fox-spirit/vite.config.ts', server: { port: 5198, host: '127.0.0.1', strictPort: true, hmr: false }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
page.setDefaultTimeout(600000);
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
try {
  await page.goto('http://127.0.0.1:5198/', { waitUntil: 'domcontentloaded', timeout: 300000 });
  await page.waitForFunction(() => window.__gameHooks?.ready === true, null, { timeout: 600000 });
  await page.evaluate(() => window.__gameHooks.setManual(true));
  await page.keyboard.press('ShiftRight');
  await page.evaluate(() => {
    const h = window.__gameHooks;
    h.keepingRelease();
    h.advance(60 * 25, 1 / 60, false); // the storm settles onto the bridge
    h.teleport(27.6, 72.6, -2.9);
    h.advance(30, 1 / 60, false);
    const before = h.state().opening.keeping.answered;
    // walk the trunk toward the crag (world-relative stick), then hop once
    const trace = [];
    for (let f = 0; f < 75; f++) {
      h.setStick(-0.27, -0.96);
      h.setKeys(f === 90 ? ['Space'] : []);
      const s = h.advance(1, 1 / 60, false);
      if (f % 15 === 0) trace.push(s.pos.map((v) => +v.toFixed(2)));
    }
    h.advance(1, 1 / 60, true);
    window.__probe = { before, trace };
  });
  await page.screenshot({ path: path.join(out, 'walking.png') });
  const r = await page.evaluate(() => {
    const h = window.__gameHooks;
    const { before, trace } = window.__probe;
    for (let f = 75; f < 150; f++) {
      h.setStick(-0.27, -0.96);
      h.setKeys(f === 90 ? ['Space'] : []);
      const s = h.advance(1, 1 / 60, false);
      if (f % 15 === 0) trace.push(s.pos.map((v) => +v.toFixed(2)));
    }
    h.setStick(0, 0);
    h.setKeys([]);
    const s = h.advance(20, 1 / 60, true);
    return { before, after: s.opening.keeping.answered, phase: s.opening.keeping.phase, counts: s.opening.audio.counts, trace };
  });
  await page.screenshot({ path: path.join(out, 'bridge.png') });
  fs.writeFileSync(path.join(out, 'evidence.json'), JSON.stringify({ ...r, errors }, null, 1));
  console.log(JSON.stringify({ ...r, errors }));
} finally {
  await browser.close();
  await server.close();
}
