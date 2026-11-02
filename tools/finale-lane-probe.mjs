// South lane (DESIGN-finale.md) walkability, input only: from the meadow (6,66) down the lane into Press Hollow and
// back out, steering the stick at each waypoint. Fails if any leg stalls (no progress for 3 s).
//   node tools/finale-lane-probe.mjs [outDir]
import { chromium } from 'playwright';
import { createServer } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

const out = path.resolve(process.argv[2] ?? '/tmp/finale-lane');
fs.mkdirSync(out, { recursive: true });
const server = await createServer({ configFile: 'games/fox-spirit/vite.config.ts', server: { port: 5199, host: '127.0.0.1', strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 640, height: 360 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
const legs = [];
try {
  await page.goto('http://127.0.0.1:5199/');
  await page.waitForFunction(() => window.__gameHooks?.ready === true, null, { timeout: 600000 });
  const route = [[7.5, 63.5], [12.5, 53], [18.8, 44.2], [20.5, 41.5], [18.8, 44.2], [12.5, 53], [7.5, 63.5], [6, 67]];
  await page.evaluate(() => { const h = window.__gameHooks; h.setManual(true); h.teleport(6, 66.5, Math.PI); h.advance(20, 1 / 60, false); });
  for (const to of route) {
    const r = await page.evaluate((to) => {
      const h = window.__gameHooks;
      let s = h.state(), best = Infinity, still = 0, n = 0;
      for (; n < 60 * 30; n++) {
        const dx = to[0] - s.pos[0], dz = to[1] - s.pos[2], d = Math.hypot(dx, dz);
        if (d < 0.6) break;
        if (d < best - 0.05) { best = d; still = 0; } else if (++still > 180) break;
        h.setStick(dx / d, dz / d);
        s = h.advance(1, 1 / 60, false);
      }
      h.setStick(null);
      return { to, pos: s.pos.map((v) => +v.toFixed(2)), frames: n, ok: Math.hypot(to[0] - s.pos[0], to[1] - s.pos[2]) < 0.6 };
    }, to);
    legs.push(r);
    if (!r.ok) { await page.screenshot({ path: path.join(out, `stall-${legs.length}.png`) }); break; }
  }
} catch (e) { errors.push(String(e?.stack ?? e)); }
fs.writeFileSync(path.join(out, 'lane.json'), JSON.stringify({ legs, errors }, null, 1));
console.log(JSON.stringify({ errors, legs }));
await browser.close();
await server.close();
