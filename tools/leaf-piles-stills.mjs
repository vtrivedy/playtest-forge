// Kickable leaf piles (DESIGN-leaf-piles.md): run through one pile and dash through another by real stick/Shift
// input, chase-cam stills through each burst and its settle.
//   node tools/leaf-piles-stills.mjs [outDir]
import { chromium } from 'playwright';
import { createServer } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

const out = path.resolve(process.argv[2] ?? '/tmp/leaf-piles');
fs.mkdirSync(out, { recursive: true });
const server = await createServer({ configFile: 'games/fox-spirit/vite.config.ts', server: { port: 5192, host: '127.0.0.1', strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
page.setDefaultTimeout(600000);
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
const log = [];
try {
  await page.goto('http://127.0.0.1:5192/', { waitUntil: 'domcontentloaded', timeout: 300000 });
  await page.waitForFunction(() => window.__gameHooks?.ready === true, null, { timeout: 600000 });
  await page.evaluate(() => window.__gameHooks.setManual(true));
  // [name, start x,z, through x,z, dash]
  for (const [name, sx, sz, tx, tz, dash] of [['run', -5.0, 66.6, -5.2, 70.6, false], ['dash', -6.6, 71.6, -6.8, 75.0, true]]) {
    await page.evaluate(([sx, sz, tx, tz]) => { const h = window.__gameHooks; h.teleport(sx, sz, Math.atan2(tx - sx, tz - sz)); h.advance(30, 1 / 60, false); }, [sx, sz, tx, tz]);
    await page.screenshot({ path: path.join(out, `${name}-0-before.png`) });
    for (const [i, frames] of [0, 14, 16, 30, 150].entries()) {
      const st = await page.evaluate(([tx, tz, frames, dash, first]) => {
        const h = window.__gameHooks;
        let s = h.state();
        const n = first ? 150 : frames;
        for (let k = 0; k < n; k++) {
          const dx = tx - s.pos[0], dz = tz - s.pos[2], d = Math.hypot(dx, dz);
          // run at the pile, through it and on
          if (first) h.setStick(dx / (d || 1), dz / (d || 1));
          if (dash && first && d < 2.4 && d > 2.0) h.setKeys(['ShiftLeft']);
          else h.setKeys([]);
          s = h.advance(1, 1 / 60, false);
          if (first && d < 0.3) break;
        }
        h.setKeys([]);
        h.setStick(0, 0);
        return h.advance(0, 1 / 60, true).opening.leafPiles;
      }, [tx, tz, frames, dash, i === 0]);
      await page.screenshot({ path: path.join(out, `${name}-${i + 1}.png`) });
      log.push([name, i + 1, st]);
    }
  }
} finally {
  for (const l of log) console.log(JSON.stringify(l));
  console.log('errors', errors.length, errors.slice(0, 2));
  await browser.close();
  await server.close();
}
