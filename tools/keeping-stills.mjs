// Local stills of the first Keeping's place (ledge, steam spring, terrace, Hearthtree, crag; SwiftShader).
//   node tools/keeping-stills.mjs --out /tmp/ks [--poses a,b] [--paint 1] [--settle 0|<seconds after release>]
// Chase poses teleport the fox (the chase cam settles behind it); free poses frame the art camera directly.
// --settle N releases the Hearthtree through the dev hook and advances N seconds before every pose.
import { chromium } from 'playwright';
import { createServer } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const out = path.resolve(arg('out', '/tmp/keeping-stills'));
const [W, H] = arg('size', '960x540').split('x').map(Number);
// fox pose [x, z, yaw]
const POSES = {
  cradle: [14.2, 76.8, 0.9],
  bend: [17.4, 81.6, 0.6],
  ledge: [21.2, 84.2, 2.2],
  spring: [23.6, 80.6, 2.4],
  terrace: [29.6, 77.4, -2.9],
  bridge: [27.4, 71.0, -2.9],
  crag: [26.2, 66.6, -2.9],
};
const CAMS = {
  // the reveal from the shelf landing
  reveal: [[9, 7.4, 77.5], [27, 13, 72]],
  // the whole place from the meadow below
  wide: [[0, 3.2, 93], [24, 8, 74]],
  // side-on across the gorge: tree, terrace and crag in one frame
  gorge: [[10, 12, 66], [27, 11, 70.5]],
  aerial: [[2, 34, 102], [22, 4, 72]],
  // the tree itself, from over the ridge
  tree: [[14, 15, 80], [27.5, 13, 70.5]],
  // looking back along the fallen trunk from the crag
  across: [[24.6, 11.6, 61.8], [28, 9.6, 74]],
};
const paint = arg('paint', '0') === '1';
const settle = Number(arg('settle', '0'));
const pick = arg('poses', [...Object.keys(POSES), ...Object.keys(CAMS)].join(',')).split(',');
fs.mkdirSync(out, { recursive: true });
const server = await createServer({ configFile: 'games/fox-spirit/vite.config.ts', server: { port: 5194, host: '127.0.0.1', strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: W, height: H } })).newPage();
page.setDefaultTimeout(600000);
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
page.on('console', (m) => m.type() === 'error' && console.log('CONSERR', m.text()));
try {
  await page.goto('http://127.0.0.1:5194/', { waitUntil: 'domcontentloaded', timeout: 300000 });
  await page.waitForFunction(() => window.__gameHooks?.ready === true, null, { timeout: 600000 });
  const st = await page.evaluate(({ paint, settle }) => {
    const h = window.__gameHooks;
    h.setManual(true);
    if (paint) {
      const { ctx } = window.__opening;
      ctx.field.restore(ctx.fox.root.position.clone().set(16, 0, 74), 90, 0.01, { edgeMax: 2.5 });
    }
    if (settle > 0) {
      h.keepingRelease();
      h.advance(Math.round(settle * 60), 1 / 60, false);
    }
    return h.state().opening.keeping;
  }, { paint, settle });
  console.log('keeping', JSON.stringify(st));
  for (const name of pick) {
    const t0 = Date.now();
    const cam = CAMS[name];
    const [x, z, yaw] = POSES[name] ?? POSES.cradle;
    const s = await page.evaluate(({ x, z, yaw, cam }) => {
      const h = window.__gameHooks;
      h.teleport(x, z, yaw);
      h.advance(90, 1 / 60, false);
      if (!cam) {
        h.advance(1, 1 / 60, true);
        return h.state().pos;
      }
      const c = window.__opening.camera;
      c.position.set(...cam[0]);
      c.lookAt(...cam[1]);
      c.updateMatrixWorld();
      h.advance(0, 1 / 60, true);
      return h.state().pos;
    }, { x, z, yaw, cam });
    await page.screenshot({ path: path.join(out, `${name}.png`) });
    console.log(name, JSON.stringify(s), Date.now() - t0, 'ms');
  }
} finally {
  await browser.close();
  await server.close();
}
