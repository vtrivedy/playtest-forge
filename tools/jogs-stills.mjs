// Chase-cam stills along the slice's meadow jogs (gate → canopy → meadow → west grove), fox parked facing
// the next beat, so the path-side leads can be judged at the eye the player has.
//   node tools/jogs-stills.mjs [outDir] [--hare 1]
// --hare 1 also dashes the hare off its waymark stone and walks the jog after it (chase cam), with stills.
import { chromium } from 'playwright';
import { createServer } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

const out = path.resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : '/tmp/jogs-stills');
const hare = process.argv.includes('--hare');
fs.mkdirSync(out, { recursive: true });
// [name, from x, z, toward x, z]
const POSES = [
  ['1-gate-to-canopy', -3.2, 82.0, -0.2, 74.4],
  ['2a-hare-stone', -1.4, 65.0, -3.6, 67.4],
  ['2-off-canopy', -4.0, 66.0, -6, 77.5],
  ['3-meadow-north', -5.6, 72.5, -6, 77.5],
  ['4-turn-west', -6.4, 77.6, -14, 80],
  ['5-toward-grove', -11.0, 79.2, -20, 79],
  ['6-grove-edge', -18.0, 79.2, -23.6, 75],
];
const server = await createServer({ configFile: 'games/fox-spirit/vite.config.ts', server: { port: 5197, host: '127.0.0.1', strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
page.setDefaultTimeout(600000);
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
try {
  await page.goto('http://127.0.0.1:5197/', { waitUntil: 'domcontentloaded', timeout: 300000 });
  await page.waitForFunction(() => window.__gameHooks?.ready === true, null, { timeout: 600000 });
  await page.evaluate(() => window.__gameHooks.setManual(true));
  for (const [name, x, z, tx, tz] of POSES) {
    await page.evaluate(([x, z, yaw]) => { const h = window.__gameHooks; h.teleport(x, z, yaw); h.advance(90, 1 / 60, true); }, [x, z, Math.atan2(tx - x, tz - z)]);
    await page.screenshot({ path: path.join(out, `${name}.png`) });
  }
  if (hare) {
    const log = [];
    await page.evaluate(() => { const h = window.__gameHooks; h.teleport(-2.2, 66.0, Math.atan2(-1.4, 1.4)); h.advance(30, 1 / 60, false); });
    await page.keyboard.down('ShiftLeft');
    await page.evaluate(() => window.__gameHooks.advance(4, 1 / 60, false));
    await page.keyboard.up('ShiftLeft');
    const hareState = () => page.evaluate(() => window.__gameHooks.state().opening.unpressed.creatures.find((c) => c.id === 'hare'));
    for (const [i, f] of [[1, 40], [2, 80]]) {
      await page.evaluate((f) => window.__gameHooks.advance(f, 1 / 60, true), f);
      await page.screenshot({ path: path.join(out, `h${i}-pop.png`) });
      log.push(await hareState());
    }
    // follow it along the jog by stick (it leads), a still per leg; lag once and watch it sit up and wait
    const walk = (to, mag) => page.evaluate(([to, mag]) => {
      const h = window.__gameHooks;
      let s;
      for (let i = 0; i < 900; i++) {
        s = h.advance(1, 1 / 60, false);
        const dx = to[0] - s.pos[0], dz = to[1] - s.pos[2], d = Math.hypot(dx, dz);
        if (d < 0.5) break;
        h.setStick((dx / d) * mag, (dz / d) * mag);
      }
      h.setStick(0, 0);
      h.advance(0, 1 / 60, true);
      return { fox: s.pos.map((v) => +v.toFixed(2)), hare: s.opening.unpressed.creatures.find((k) => k.id === 'hare') };
    }, [to, mag]);
    const legs = [[-4.8, 66.4], [-5.0, 69.4], [-5.6, 73.4], [-7.2, 78.2], [-11.5, 80.0], [-16.8, 79.9], [-20.6, 78.2]];
    const closeLens = (name) => page.evaluate(() => {
      const h = window.__gameHooks;
      const a = h.state().opening.unpressed.creatures.find((k) => k.id === 'hare').at;
      const c = window.__opening.camera;
      c.position.set(a[0] + 1.3, a[1] + 0.6, a[2] - 0.9);
      c.lookAt(a[0], a[1] + 0.25, a[2]);
      c.updateMatrixWorld();
      h.advance(0, 1 / 60, true);
    }).then(() => page.screenshot({ path: path.join(out, `${name}.png`) }));
    for (const [i, to] of legs.entries()) {
      if (i === 2) await closeLens('h4c-bound');
      log.push(await walk(to, 0.75));
      await page.screenshot({ path: path.join(out, `h${i + 3}-leg.png`) });
      if (i === 3) {
        await page.evaluate(() => {
          // review lens: from over the lagging fox's shoulder toward the waiting hare
          const h = window.__gameHooks;
          const s = h.advance(240, 1 / 60, false);
          const a = s.opening.unpressed.creatures.find((k) => k.id === 'hare').at;
          const c = window.__opening.camera;
          c.position.set(s.pos[0] + (s.pos[0] - a[0]) * 0.12, s.pos[1] + 1.1, s.pos[2] + (s.pos[2] - a[2]) * 0.12);
          c.lookAt(a[0], a[1] + 0.3, a[2]);
          c.updateMatrixWorld();
          h.advance(0, 1 / 60, true);
        });
        await page.screenshot({ path: path.join(out, 'h6b-waits.png') });
        log.push(await hareState());
      }
    }
    await page.evaluate(() => window.__gameHooks.advance(180, 1 / 60, true));
    await page.screenshot({ path: path.join(out, 'h10-sits.png') });
    await page.evaluate(() => { window.__gameHooks.advance(300, 1 / 60, false); const c = window.__opening.camera; c.position.set(-20.4, 1.0, 79.2); c.lookAt(-22.0, 0.3, 77.4); c.updateMatrixWorld(); window.__gameHooks.advance(0, 1 / 60, true); });
    await page.screenshot({ path: path.join(out, 'h11-alive.png') });
    log.push(await hareState());
    for (const l of log) console.log(JSON.stringify(l));
  }
} finally {
  console.log('errors', errors.length, errors.slice(0, 3));
  await browser.close();
  await server.close();
}
