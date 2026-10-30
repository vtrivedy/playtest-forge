import { chromium } from 'playwright';
import { createServer } from 'vite';
const server = await createServer({ configFile: 'games/fox-spirit/vite.config.ts', server: { port: 5193, host: '127.0.0.1', strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 320, height: 180 } })).newPage();
page.setDefaultTimeout(300000);
await page.goto('http://127.0.0.1:5193/');
await page.waitForFunction(() => !!window.__gameHooks?.advance);
const H = (fn, ...a) => page.evaluate(([f, args]) => window.__gameHooks[f](...args), [fn, a]);
await H('setManual', true);
await H('autopilot', true, 0, { assist: false });
const [t0, t1] = [Number(process.argv[2] || 12), Number(process.argv[3] || 17)];
let st = await H('advance', Math.round(t0 * 60), 1 / 60, false);
for (let t = t0; t < t1; t += 0.2) {
  st = await H('advance', 12, 1 / 60, false);
  const c = st.camera.pos, p = st.pos;
  const d = Math.hypot(c[0] - p[0], c[2] - p[2]);
  console.log(st.t.toFixed(1), 'wp', st.auto.idx, st.anim.padEnd(9), 'fox', p.map((v) => v.toFixed(1)).join(','), 'camH', d.toFixed(2), 'camY-fox', (c[1] - p[1]).toFixed(2), 'fov', st.camera.fov.toFixed(1), 'occ', st.camera.occlusion.toFixed(2));
}
await browser.close(); await server.close(); process.exit(0);
