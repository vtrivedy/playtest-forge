// Per-frame cost of the opening at named spots (SwiftShader; relative numbers only): sim step, state(), render.
//   node tools/perf-probe.mjs [--at "name:x,z;..."]
import { chromium } from 'playwright';
import { createServer } from 'vite';

const i = process.argv.indexOf('--at');
const spots = (i > 0 ? process.argv[i + 1] : 'village:-6,92;lane:-46,90.4;mill:-70,90').split(';').map((e) => {
  const [name, p] = e.split(':');
  const [x, z] = p.split(',').map(Number);
  return [name, x, z];
});
const server = await createServer({ configFile: 'games/fox-spirit/vite.config.ts', server: { port: 5196, host: '127.0.0.1', strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
page.setDefaultTimeout(600000);
try {
  await page.goto('http://127.0.0.1:5196/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__gameHooks?.ready === true, null, { timeout: 600000 });
  const r = await page.evaluate((spots) => {
    const h = window.__gameHooks;
    h.setManual(true);
    const out = {};
    for (const [name, x, z] of spots) {
      h.teleport(x, z, -1.5);
      h.advance(5, 1 / 60, false);
      let t = performance.now();
      h.advance(30, 1 / 60, false);
      out[`${name}:sim ms`] = +((performance.now() - t) / 30).toFixed(2);
      t = performance.now();
      for (let k = 0; k < 30; k++) h.state();
      out[`${name}:state ms`] = +((performance.now() - t) / 30).toFixed(2);
      t = performance.now();
      h.advance(3, 1 / 60, true);
      out[`${name}:sim+render ms`] = +((performance.now() - t) / 3).toFixed(1);
    }
    return out;
  }, spots);
  console.log(JSON.stringify(r, null, 1));
} finally {
  await browser.close();
  await server.close();
}
