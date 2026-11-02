// The leaf lane breathes: walk the fox down the sunken lane with real stick input and check gusts fire, leaves fly
// past and the gust is placed in 3D; saves stills mid-gust. Staged start: teleport onto the lane's east end.
//   node tools/lane-wind-probe.mjs --out /tmp/lane-wind
import { chromium } from 'playwright';
import { createServer } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const out = path.resolve(arg('out', '/tmp/lane-wind'));
fs.mkdirSync(out, { recursive: true });
const server = await createServer({ configFile: 'games/fox-spirit/vite.config.ts', server: { port: 5199, host: '127.0.0.1', strictPort: true, hmr: false }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
page.setDefaultTimeout(600000);
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
try {
  await page.goto('http://127.0.0.1:5199/', { waitUntil: 'domcontentloaded', timeout: 300000 });
  await page.waitForFunction(() => window.__gameHooks?.ready === true, null, { timeout: 600000 });
  await page.evaluate(() => window.__gameHooks.setManual(true));
  await page.keyboard.press('ShiftRight');
  await page.evaluate(() => { const h = window.__gameHooks; h.teleport(-37.5, 88.8, -1.4); h.advance(30, 1 / 60, false); });
  const shots = [];
  let s;
  // walk west down the lane, one rendered still every ~1.5 s while leaves are in the air
  for (let leg = 0; leg < 14; leg++) {
    s = await page.evaluate(() => {
      const h = window.__gameHooks;
      let st;
      for (let f = 0; f < 90; f++) {
        const p = h.state().pos;
        const tx = p[0] > -46 ? -46 : p[0] > -55 ? -55 : -63.5;
        const tz = p[0] > -46 ? 90.6 : p[0] > -55 ? 88.8 : 86.6;
        const d = Math.hypot(tx - p[0], tz - p[2]) || 1;
        h.setStick(((tx - p[0]) / d) * 0.45, ((tz - p[2]) / d) * 0.45);
        st = h.advance(1, 1 / 60, f === 89);
      }
      return { pos: st.pos, wind: st.opening.laneWind };
    });
    if (s.wind.flying > 2 && shots.length < 4) {
      const f = path.join(out, `gust-${shots.length}.png`);
      await page.screenshot({ path: f });
      shots.push({ f, ...s });
    }
  }
  const ev = { final: s, shots, errors };
  fs.writeFileSync(path.join(out, 'evidence.json'), JSON.stringify(ev, null, 1));
  console.log(JSON.stringify(ev));
} finally {
  await browser.close();
  await server.close();
}
