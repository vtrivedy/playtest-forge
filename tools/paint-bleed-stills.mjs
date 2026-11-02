// Feathered / bleeding paint edges (Kit 09:19): lay one hearth-sized wash (r 8, edgeMax 1.2 — the size most
// beats use) on open meadow and shoot it from fixed lenses as it settles and ~60 s later, once colour has seeped out.
//   node tools/paint-bleed-stills.mjs --out /tmp/bleed
import { chromium } from 'playwright';
import { createServer } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const out = path.resolve(arg('out', '/tmp/bleed'));
fs.mkdirSync(out, { recursive: true });
// [camera position, look-at]
const LENSES = {
  // a hearth-sized wash on open meadow, seen the way the chase cam sees it and from above
  low: [[4, 3.2, 90], [-1, 0, 79]],
  high: [[-1, 16, 94], [-1, 0, 80]],
  // the chase-cam height over the plaza's hex paving at the wash's edge
  paving: [[-4, 2.4, 89], [-1, 0.3, 82]],
};
const server = await createServer({ configFile: 'games/fox-spirit/vite.config.ts', server: { port: 5200, host: '127.0.0.1', strictPort: true, hmr: false }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
page.setDefaultTimeout(600000);
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
try {
  await page.goto('http://127.0.0.1:5200/', { waitUntil: 'domcontentloaded', timeout: 300000 });
  await page.waitForFunction(() => window.__gameHooks?.ready === true, null, { timeout: 600000 });
  await page.evaluate(() => { const h = window.__gameHooks; h.setManual(true); h.audioContext?.()?.suspend?.(); h.teleport(-12, 96, 0); h.advance(30, 1 / 60, false);
    const c = window.__opening.camera.position.clone().set(-1, 0, 80);
    window.__opening.ctx.field.restore(c, 8, 2.2, { edgeMax: 1.2 }); });
  let at = 0;
  for (const [when, secs] of [['wet', 1.3], ['settled', 14], ['later', 60]]) {
    await page.evaluate((s) => window.__gameHooks.advance(Math.round(s * 60), 1 / 60, false), secs - at);
    at = secs;
    for (const [name, [p, l]] of Object.entries(LENSES)) {
      await page.evaluate(([p, l]) => {
        const cam = window.__opening.camera;
        window.__gameHooks.setManual(true);
        cam.position.set(...p);
        cam.lookAt(...l);
        cam.updateMatrixWorld();
        window.__gameHooks.advance(0, 1 / 60, true);
      }, [p, l]);
      await page.screenshot({ path: path.join(out, `${name}-${when}.png`) });
    }
  }
  console.log(JSON.stringify({ out, errors }));
} finally {
  await browser.close();
  await server.close();
}
