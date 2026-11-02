// The Loft (opening/valeLoft.ts): input-only climb (stick + Space) up the bale pile and plank onto the east cottage ridge.
//   node tools/vale-loft-probe.mjs  → k = 9 means every bale, the plank and the ridge; caption = the memory line
import { chromium } from 'playwright';
import { createServer } from 'vite';
const server = await createServer({ configFile: 'games/fox-spirit/vite.config.ts', server: { port: 5268, host: '127.0.0.1', strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } }); page.setDefaultTimeout(600000);
const errs = []; page.on('pageerror', (e) => errs.push(String(e))); page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await page.goto('http://127.0.0.1:5268/?fresh');
await page.waitForFunction(() => window.__gameHooks?.ready === true);
const T = [[16.6,99.6],[16.85,98.4],[16.6,97.2],[16.85,96.0],[16.6,94.8],[16.85,93.6],[16.6,92.4],[15.6,93.4],[13.4,94.4]];
const r = await page.evaluate((T) => { const h = window.__gameHooks; h.setManual(true); h.teleport(17.0, 102.6, Math.PI); h.advance(20, 1/30, false);
  let s = h.advance(0, 1/30, false); let k = 0; const log = []; let jumpT = 0;
  for (let i = 0; i < 2400 && k < T.length; i++) {
    const [tx, tz] = T[k]; const dx = tx - s.pos[0], dz = tz - s.pos[2]; const d = Math.hypot(dx, dz);
    if (d < 0.45 && s.grounded) { log.push([k, s.pos.map((v) => +v.toFixed(2))]); k++; continue; }
    h.setStick(dx / d * (d < 1 ? 0.5 : 1), dz / d * (d < 1 ? 0.5 : 1));
    if (s.grounded && jumpT <= 0 && d < (k === 8 ? 2.2 : 1.3) && d > 0.5) jumpT = k === 8 ? 16 : 12;
    h.setKeys(jumpT > 0 ? ['Space'] : []); jumpT--;
    s = h.advance(1, 1/30, false);
  }
  h.setStick(null); h.setKeys([]); s = h.advance(30, 1/30, false); h.advance(1, 1/30, true); return { k, log, pos: s.pos.map((v) => +v.toFixed(2)), cap: s.opening.captions };
}, T);
await page.screenshot({ path: '/tmp/loft.png' });
console.log(JSON.stringify(r).slice(0, 700), errs.slice(0, 3));
await browser.close(); await server.close();
