// Ad-hoc stills anywhere in the opening world (map/region art iteration; SwiftShader) + draw-call budget.
//   node tools/world-stills.mjs --out /tmp/ws [--chase name:x,z,yaw;...] [--cam name:x,y,z:lx,ly,lz;...] [--paint 1] [--size 960x540]
// Chase stills teleport the fox and let the follow camera settle; cam stills frame the camera directly.
// Prints renderer.info (calls / triangles) per still so world growth stays inside a budget.
import { chromium } from 'playwright';
import { createServer } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const out = path.resolve(arg('out', '/tmp/world-stills'));
const [W, H] = arg('size', '960x540').split('x').map(Number);
const nums = (s) => s.split(',').map(Number);
const list = (s) => (s ? s.split(';').filter(Boolean).map((e) => e.split(':')) : []);
const shots = [
  ...list(arg('chase', '')).map(([name, p]) => ({ name, pose: nums(p) })),
  ...list(arg('cam', '')).map(([name, p, l]) => ({ name, cam: [nums(p), nums(l)] })),
];
const paint = arg('paint', '0') === '1';
// --pre "<js>": run in the page before the stills (e.g. "__gameHooks.millBurst(); __gameHooks.advance(600, 1/60, false)")
const pre = arg('pre', '');
fs.mkdirSync(out, { recursive: true });
const server = await createServer({ configFile: 'games/fox-spirit/vite.config.ts', server: { port: 5194, host: '127.0.0.1', strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: W, height: H } })).newPage();
page.setDefaultTimeout(600000);
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
page.on('console', (m) => m.type() === 'error' && console.log('CONSERR', m.text()));
const report = [];
try {
  await page.goto('http://127.0.0.1:5194/', { waitUntil: 'domcontentloaded', timeout: 300000 });
  await page.waitForFunction(() => window.__gameHooks?.ready === true, null, { timeout: 600000 });
  await page.evaluate((paint) => {
    window.__gameHooks.setManual(true);
    if (!paint) return;
    const { ctx } = window.__opening;
    ctx.field.restore(ctx.fox.root.position.clone().set(-30, 0, 80), 160, 0.01, { edgeMax: 2.5 });
  }, paint);
  if (pre) await page.evaluate(pre);
  for (const s of shots) {
    const info = await page.evaluate(({ pose, cam }) => {
      const h = window.__gameHooks;
      const { ctx, camera } = window.__opening;
      if (pose) {
        h.teleport(pose[0], pose[1], pose[2]);
        h.advance(90, 1 / 60, false);
      }
      ctx.renderer.info.autoReset = false;
      ctx.renderer.info.reset();
      if (cam) {
        camera.position.set(...cam[0]);
        camera.lookAt(...cam[1]);
        camera.updateMatrixWorld();
        h.advance(0, 1 / 60, true);
      } else h.advance(1, 1 / 60, true);
      const r = ctx.renderer.info.render;
      const st = h.state();
      return { calls: r.calls, triangles: r.triangles, fox: st.pos };
    }, s);
    await page.screenshot({ path: path.join(out, `${s.name}.png`) });
    report.push({ name: s.name, ...info });
    console.log(s.name, JSON.stringify(info));
  }
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 1));
} finally {
  await browser.close();
  await server.close();
}
