// Ink glyph stones probe (DESIGN-glyphs.md): stage once in the east meadow, then real stick input only.
// Runs a wrong-order pass (expects a gutter), then the lintel order (moon → leaf → flame) → shrine opens →
// dash the freed kit page → the kit trots home. Stills at each beat.
//   node tools/glyphs-probe.mjs [outDir]
import { chromium } from 'playwright';
import { createServer } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

const out = path.resolve(process.argv[2] ?? '/tmp/glyphs-probe');
fs.mkdirSync(out, { recursive: true });
const server = await createServer({ configFile: 'games/fox-spirit/vite.config.ts', server: { port: 5196, host: '127.0.0.1', strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
page.setDefaultTimeout(600000);
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
const log = [];
try {
  await page.goto('http://127.0.0.1:5196/', { waitUntil: 'domcontentloaded', timeout: 300000 });
  await page.waitForFunction(() => window.__gameHooks?.ready === true, null, { timeout: 600000 });
  await page.evaluate(() => { window.__gameHooks.setManual(true); window.__gameHooks.teleport(17, 86, 1.6); window.__gameHooks.advance(30, 1 / 60, false); });
  const walk = (pts) => page.evaluate((pts) => {
    const h = window.__gameHooks;
    let s;
    for (const [x, z] of pts) for (let i = 0; i < 900; i++) {
      s = h.advance(1, 1 / 60, false);
      const dx = x - s.pos[0], dz = z - s.pos[2], d = Math.hypot(dx, dz);
      if (d < 0.35) break;
      h.setStick(dx / d, dz / d);
    }
    h.setStick(0, 0);
    s = h.advance(10, 1 / 60, false);
    return { pos: s.pos.map((v) => +v.toFixed(2)), glyphs: s.opening.glyphs };
  }, pts);
  const shot = async (name) => { await page.evaluate(() => window.__gameHooks.advance(1, 1 / 60, true)); await page.screenshot({ path: path.join(out, `${name}.png`) }); };
  // wrong order: leaf first lights nothing; then moon lights; then flame out of turn gutters it
  log.push(['wrong: past leaf', await walk([[20.4, 89.6]])]);
  await shot('01-leaf-read');
  log.push(['wrong: to moon', await walk([[24, 84], [29.4, 82.6]])]);
  await shot('02-moon-lit');
  log.push(['wrong: flame out of turn', await walk([[29.6, 88.5], [28.9, 90.8]])]);
  await shot('03-gutter');
  // wait for the trail to dry
  await page.evaluate(() => window.__gameHooks.advance(720, 1 / 60, false));
  // the lintel: read it
  log.push(['read lintel', await walk([[30.0, 88.6]])]);
  await shot('04-lintel-read');
  await page.evaluate(() => window.__gameHooks.advance(720, 1 / 60, false));
  // the order: moon → leaf → flame
  log.push(['order: moon', await walk([[29.0, 86.0], [29.4, 82.6]])]);
  log.push(['order: leaf', await walk([[24.5, 85.2], [22.2, 86.6], [21.6, 89.8]])]);
  await shot('05-two-lit');
  log.push(['order: flame', await walk([[25.5, 91.2], [28.6, 91.0]])]);
  await page.evaluate(() => window.__gameHooks.advance(150, 1 / 60, false));
  await shot('06-solved');
  // review lenses: the lit flame stone, and the open shrine from the meadow
  // (review stills only: the fox is parked by the lens so the chase-cam fade never hides the subject)
  const lens = async (name, cam, look) => { await page.evaluate(([cam, look]) => { const h = window.__gameHooks; h.teleport(cam[0] + (look[0] - cam[0]) * 0.35, cam[2] + (look[2] - cam[2]) * 0.35, 0); h.advance(20, 1 / 60, false); const c = window.__opening.camera; c.position.set(...cam); c.lookAt(...look); c.updateMatrixWorld(); window.__gameHooks.advance(0, 1 / 60, true); }, [cam, look]); await page.screenshot({ path: path.join(out, `${name}.png`) }); };
  log.push(['after solve', await page.evaluate(() => window.__gameHooks.state().opening.glyphs)]);
  await lens('06a-leaf-front', [22.0, 1.1, 94.0], [21.0, 1.0, 90.6]);
  await lens('06a2-leaf-side', [25.0, 1.0, 89.2], [21.0, 1.0, 90.6]);
  await lens('06b-flame-lit', [28.0, 1.5, 95.0], [29.4, 1.0, 91.6]);
  await lens('06c-shrine', [27.6, 1.7, 89.4], [32.0, 1.2, 88.6]);
  // to the open shrine, dash the kit page
  log.push(['to shrine', await walk([[29.8, 88.6]])]);
  // face the open door by stick (no teleport), then a real Shift dash at the page
  await page.evaluate(() => { const h = window.__gameHooks; h.setStick(1, 0); h.advance(12, 1 / 60, false); });
  await page.keyboard.down('ShiftLeft');
  await page.evaluate(() => window.__gameHooks.advance(4, 1 / 60, false));
  await page.keyboard.up('ShiftLeft');
  await page.evaluate(() => { window.__gameHooks.setStick(0, 0); window.__gameHooks.advance(50, 1 / 60, false); });
  await shot('07-kit-pop');
  const end = await page.evaluate(() => { const s = window.__gameHooks.advance(1500, 1 / 60, true); return s.opening.unpressed.creatures.find((c) => c.id === 'kit'); });
  log.push(['kit after 25 s', end]);
  await page.evaluate(() => { const c = window.__opening.camera; c.position.set(-3.6, 1.4, 89.6); c.lookAt(-6.0, 0.2, 87.8); c.updateMatrixWorld(); window.__gameHooks.advance(0, 1 / 60, true); });
  await page.screenshot({ path: path.join(out, '08-kit-home.png') });
} finally {
  fs.writeFileSync(path.join(out, 'evidence.json'), JSON.stringify({ log, errors }, null, 2));
  for (const [k, v] of log) console.log(k, JSON.stringify(v));
  console.log('errors', errors.length);
  await browser.close();
  await server.close();
}
