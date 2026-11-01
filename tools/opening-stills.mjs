// Local stills of the opening slice at named chase-cam poses (art iteration; SwiftShader).
//   node tools/opening-stills.mjs --out /tmp/os [--poses spawn,meadow,overview,...] [--paint 1]
// Chase poses teleport the fox; free poses (`cam`) park it and frame the art camera directly.
import { chromium } from 'playwright';
import { createServer } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const out = path.resolve(arg('out', '/tmp/opening-stills'));
const [W, H] = arg('size', '960x540').split('x').map(Number);
// fox pose [x, z, yaw]; the chase cam settles behind it
const POSES = {
  spawn: [-6, 92, Math.PI * 0.92],
  well: [-5.5, 87.5, Math.PI * 0.75],
  meadow: [-1.5, 80, Math.PI * 0.85],
  hearth: [2.6, 77.5, Math.PI * 0.75],
  shelf: [3.4, 71.5, Math.PI * 0.55],
  back: [9, 66, -0.2],
  dashstop: [4.3, 72.95, Math.PI * 0.95],
};
// free cameras: [camera xyz, look xyz] (fox parked at spawn)
const CAMS = {
  overview: [[-34, 26, 112], [4, 0, 76]],
  shelfwide: [[-7, 5.5, 88], [13, 3.5, 74]],
  hearthclose: [[0.5, 2.4, 80.5], [7, 1.2, 72.5]],
  ridge: [[-2, 3, 64], [16, 5, 78]],
  village: [[6, 7, 66], [-10, 1, 92]],
  crown: [[27.6, 11.6, 75.5], [8, 40, -42]],
  crownwide: [[-5, 3.2, 93], [2, 18, -42]],
};
const paint = arg('paint', '0') === '1';
// --respond S: play the Crown's Keeping response for S seconds before the stills
const respond = Number(arg('respond', '0'));
const pick = arg('poses', [...Object.keys(POSES), ...Object.keys(CAMS)].join(',')).split(',');
fs.mkdirSync(out, { recursive: true });
const server = await createServer({ configFile: 'games/fox-spirit/vite.config.ts', server: { port: 5193, host: '127.0.0.1', strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: W, height: H } })).newPage();
page.setDefaultTimeout(600000);
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
page.on('console', (m) => m.type() === 'error' && console.log('CONSERR', m.text()));
try {
  await page.goto('http://127.0.0.1:5193/', { waitUntil: 'domcontentloaded', timeout: 300000 });
  await page.waitForFunction(() => window.__gameHooks?.ready === true, null, { timeout: 600000 });
  await page.evaluate((paint) => {
    window.__gameHooks.setManual(true);
    if (!paint) return;
    const { ctx } = window.__opening;
    ctx.field.restore(ctx.fox.root.position.clone().set(-4, 0, 80), 90, 0.01, { edgeMax: 2.5 });
  }, paint);
  if (respond > 0) await page.evaluate((s) => { window.__gameHooks.crownRespond(); window.__gameHooks.advance(Math.round(s * 60), 1 / 60, false); }, respond);
  for (const name of pick) {
    const t0 = Date.now();
    const cam = CAMS[name];
    const [x, z, yaw] = POSES[name] ?? POSES.spawn;
    await page.evaluate(({ x, z, yaw, cam }) => {
      const h = window.__gameHooks;
      h.teleport(x, z, yaw);
      h.advance(90, 1 / 60, false);
      if (!cam) return void h.advance(1, 1 / 60, true);
      const c = window.__opening.camera;
      c.position.set(...cam[0]);
      c.lookAt(...cam[1]);
      c.updateMatrixWorld();
      h.advance(0, 1 / 60, true);
    }, { x, z, yaw, cam });
    await page.screenshot({ path: path.join(out, `${name}.png`) });
    console.log(name, Date.now() - t0, 'ms');
  }
} finally {
  await browser.close();
  await server.close();
}
