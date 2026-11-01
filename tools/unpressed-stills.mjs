// Local stills of the unpressed creatures (DESIGN-unpressed.md; SwiftShader): for each creature, the pressed
// drawing from a chase pose, then a fixed camera through the pop and performance via the dev hook.
//   node tools/unpressed-stills.mjs --out /tmp/up [--only heron] [--times 0.3,0.7,1.5,2.5,4,7] [--dash 1]
// --dash 1 triggers by a real Shift dash from the chase pose instead of the dev hook.
import { chromium } from 'playwright';
import { createServer } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const out = path.resolve(arg('out', '/tmp/unpressed-stills'));
const [W, H] = arg('size', '960x540').split('x').map(Number);
const times = arg('times', '0.3,0.7,1.5,2.5,4,7').split(',').map(Number);
const only = arg('only', '');
const dash = arg('dash', '0') === '1';
// [fox chase pose x, z, yaw (faces the drawing)], [camera, look] for the performance
const SHOTS = {
  hedgehog: { pose: [-2.9, 85.6, 2.6], cam: [[-4.4, 1.5, 86.6], [-2.6, 0.3, 84.6]], alive: [[-5.4, 1.2, 86.4], [-3.97, 0.2, 85.19]] },
  heron: { pose: [5.6, 77.0, 2.0], cam: [[5.2, 2.2, 77.6], [8.0, 2.4, 75.2]], alive: [[7.0, 6.3, 77.4], [9.25, 5.6, 75.35]] },
  deer: { pose: [26.8, 67.6, -2.49], cam: [[28.6, 11.4, 69.6], [25.3, 10.0, 64.6]], alive: [[27.6, 10.6, 64.6], [26.18, 10.1, 63.05]] },
};
fs.mkdirSync(out, { recursive: true });
const server = await createServer({ configFile: 'games/fox-spirit/vite.config.ts', server: { port: 5195, host: '127.0.0.1', strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: W, height: H } })).newPage();
page.setDefaultTimeout(600000);
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
try {
  await page.goto('http://127.0.0.1:5195/', { waitUntil: 'domcontentloaded', timeout: 300000 });
  await page.waitForFunction(() => window.__gameHooks?.ready === true, null, { timeout: 600000 });
  await page.evaluate(() => window.__gameHooks.setManual(true));
  for (const [id, s] of Object.entries(SHOTS)) {
    if (only && only !== id) continue;
    await page.evaluate(({ pose }) => {
      const h = window.__gameHooks;
      h.teleport(...pose);
      h.advance(60, 1 / 60, true);
    }, s);
    await page.screenshot({ path: path.join(out, `${id}-0-pressed.png`) });
    if (dash) {
      await page.keyboard.down('ShiftLeft');
      await page.evaluate(() => window.__gameHooks.advance(3, 1 / 60, false));
      await page.keyboard.up('ShiftLeft');
    } else await page.evaluate((id) => window.__gameHooks.unpress(id), id);
    let at = 0;
    for (const t of times) {
      const st = await page.evaluate(({ frames, cam, id }) => {
        const h = window.__gameHooks;
        h.advance(frames, 1 / 60, false);
        const c = window.__opening.camera;
        c.position.set(...cam[0]);
        c.lookAt(...cam[1]);
        c.updateMatrixWorld();
        h.advance(0, 1 / 60, true);
        return h.state().opening.unpressed.creatures.find((k) => k.id === id);
      }, { frames: Math.round((t - at) * 60), cam: s.cam, id });
      at = t;
      await page.screenshot({ path: path.join(out, `${id}-${t}.png`) });
      console.log(id, t, JSON.stringify(st));
    }
    if (s.alive) {
      await page.evaluate(({ cam }) => {
        const h = window.__gameHooks;
        h.advance(600, 1 / 60, false);
        const c = window.__opening.camera;
        c.position.set(...cam[0]);
        c.lookAt(...cam[1]);
        c.updateMatrixWorld();
        h.advance(0, 1 / 60, true);
      }, { cam: s.alive });
      await page.screenshot({ path: path.join(out, `${id}-alive.png`) });
    }
  }
} finally {
  await browser.close();
  await server.close();
}
