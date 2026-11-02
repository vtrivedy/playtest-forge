// Ashwater no-bypass check: from the weir, running jumps held into glides toward the shelf/ledge must NOT land on
// them without the flood (the Weir Heart insight is the flooded cistern). Prints reachedShelf per try (null = blocked).
//   node tools/ashwater-bypass-check.mjs
import { chromium } from 'playwright';
import { createServer } from 'vite';
const server = await createServer({ configFile: 'games/fox-spirit/vite.config.ts', server: { port: 5207, host: '127.0.0.1', strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 320, height: 180 } })).newPage();
page.setDefaultTimeout(900000);
await page.goto('http://127.0.0.1:5207/?fresh');
await page.waitForFunction(() => window.__gameHooks?.ready === true, null, { timeout: 600000 });
const tries = [[12.9, 37, 14.2, 28], [12.9, 37, 15.2, 30], [10, 37, 18, 27], [12.5, 38, 13.9, 30.2]];
const res = await page.evaluate((tries) => {
  const h = window.__gameHooks; h.setManual(true); h.ashwater(); h.advance(20, 1/60, false);
  const out = [];
  for (const [sx, sz, tx, tz] of tries) {
    h.teleport(700 + sx, 80 + sz, Math.PI); h.advance(20, 1/60, false);
    let maxY = -9, best = null;
    for (let n = 0; n < 240; n++) {
      const s = h.state(); const dx = 700 + tx - s.pos[0], dz = 80 + tz - s.pos[2], d = Math.hypot(dx, dz);
      h.setStick(dx / d, dz / d); h.setKeys(d < 4.5 ? ['Space'] : []); h.advance(1, 1/60, false);
      const lx = s.pos[0] - 700, lz = s.pos[2] - 80;
      if (s.grounded && lx > 13.3 && lz < 30.6 && s.pos[1] > 4.5) best = [lx, lz, s.pos[1]];
      maxY = Math.max(maxY, s.pos[1]);
    }
    h.setKeys([]); out.push({ from: [sx, sz], to: [tx, tz], reachedShelf: best });
  }
  return out;
}, tries);
console.log(JSON.stringify(res));
await browser.close(); await server.close();
