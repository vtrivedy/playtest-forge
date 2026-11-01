// Homecoming at the well (DESIGN-homecoming.md) stills: free every creature (dev unpress; the fox shadows the
// hare along its jog so it leads), then force the kept page (dev hook) and watch the well: the page pinned,
// lanterns kindling as each comes home, the heron's wheel, the hare's walk back, the well filled with light.
//   node tools/homecoming-stills.mjs [outDir]
import { chromium } from 'playwright';
import { createServer } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

const out = path.resolve(process.argv[2] ?? '/tmp/homecoming-stills');
fs.mkdirSync(out, { recursive: true });
const server = await createServer({ configFile: 'games/fox-spirit/vite.config.ts', server: { port: 5194, host: '127.0.0.1', strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
page.setDefaultTimeout(600000);
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
const log = [];
try {
  await page.goto('http://127.0.0.1:5194/', { waitUntil: 'domcontentloaded', timeout: 300000 });
  await page.waitForFunction(() => window.__gameHooks?.ready === true, null, { timeout: 600000 });
  log.push(['freed', await page.evaluate(() => {
    const h = window.__gameHooks;
    h.setManual(true);
    for (const id of ['hedgehog', 'heron', 'kit', 'hare']) h.unpress(id);
    // shadow the hare so it leads all the way to the ruin entry
    let s;
    for (let i = 0; i < 80; i++) {
      s = h.advance(30, 1 / 60, false);
      const c = s.opening.unpressed.creatures.find((k) => k.id === 'hare');
      if (c.phase === 'alive') break;
      if (c.phase === 'performing') h.teleport(c.at[0] + 1.2, c.at[2] - 1.2, 0);
    }
    s = h.advance(1500, 1 / 60, false);
    return s.opening.unpressed.creatures.map((c) => [c.id, c.phase]);
  })]);
  const lens = async (name, cam, look, frames = 0) => {
    const st = await page.evaluate(([cam, look, frames]) => {
      const h = window.__gameHooks;
      h.advance(frames, 1 / 60, false);
      const c = window.__opening.camera;
      c.position.set(...cam);
      c.lookAt(...look);
      c.updateMatrixWorld();
      return h.advance(0, 1 / 60, true).opening.homecoming;
    }, [cam, look, frames]);
    await page.screenshot({ path: path.join(out, `${name}.png`) });
    log.push([name, st]);
  };
  // the fox parked on the lane mouth, out of the review lens
  await page.evaluate(() => { window.__gameHooks.teleport(-3.0, 90.5, 0); window.__gameHooks.advance(20, 1 / 60, false); });
  const CAM = [-2.6, 1.9, 89.6];
  const WELL = [-8, 1.3, 85];
  await lens('01-well-before', CAM, WELL);
  await page.evaluate(() => window.__gameHooks.homecoming());
  await lens('02-pinned', CAM, WELL, 70);
  await lens('02b-page-close', [-7.6, 1.2, 87.4], [-9.2, 1.0, 85.4]);
  await lens('03-heron-wheel', [-1.6, 1.4, 92.0], [-8, 5.0, 84], 300);
  await lens('04-hare-home', CAM, [-9.6, 0.6, 87.0], 300);
  await lens('05-all-lit', CAM, WELL, 360);
  await lens('06-well-full', [-5.0, 2.6, 88.0], [-8, 0.6, 85], 120);
  await lens('07-lanterns-close', [-6.2, 1.4, 87.4], [-8, 2.0, 85], 30);
  log.push(['creatures', await page.evaluate(() => window.__gameHooks.state().opening.unpressed.creatures)]);
} finally {
  fs.writeFileSync(path.join(out, 'evidence.json'), JSON.stringify({ log, errors }, null, 2));
  for (const [k, v] of log) console.log(k, JSON.stringify(v));
  console.log('errors', errors.length, errors.slice(0, 3));
  await browser.close();
  await server.close();
}
