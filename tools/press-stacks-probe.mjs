// The Scribe's Stacks (opening/pressStacks.ts): input-only climb (stick + Space) from the snow to the reading stand.
//   node tools/press-stacks-probe.mjs  → k = stacks reached (9 = stand), caption = the secret page line
import { chromium } from 'playwright';
import { createServer } from 'vite';
const server = await createServer({ configFile: 'games/fox-spirit/vite.config.ts', server: { port: 5262, host: '127.0.0.1', strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e))); page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await page.goto('http://127.0.0.1:5262/?fresh');
await page.waitForFunction(() => window.__gameHooks?.ready === true, null, { timeout: 400000 });
const T = [[16,22.9],[15.8,25.2],[16.5,27.4],[17.9,29.2],[19.9,30.3],[22.2,30.7],[24.4,30.2],[26.3,29],[25.5,26.1]].map(([x, z]) => [x - 700, z + 85]);
const r = await page.evaluate((T) => { const h = window.__gameHooks; h.setManual(true); h.travel('press'); h.teleport(-684, 104, 0); h.advance(20, 1/30, false);
  let s = h.advance(0, 1/30, false); let k = 0; const log = []; let jumpT = 0;
  for (let i = 0; i < 2400 && k < T.length; i++) {
    const [tx, tz] = T[k]; const dx = tx - s.pos[0], dz = tz - s.pos[2]; const d = Math.hypot(dx, dz);
    if (d < 0.45 && s.grounded) { log.push([k, s.pos.map((v) => +v.toFixed(2))]); k++; continue; }
    h.setStick(dx / d * (d < 1 ? 0.5 : 1), dz / d * (d < 1 ? 0.5 : 1));
    if (s.grounded && jumpT <= 0 && d < 2.05 && d > 0.8) jumpT = k === T.length - 1 ? 22 : 12;
    h.setKeys(jumpT > 0 ? ['Space'] : []); jumpT--;
    s = h.advance(1, 1/30, false);
  }
  h.setStick(null); h.setKeys([]); s = h.advance(30, 1/30, false); h.advance(1, 1/30, true); return { k, log, pos: s.pos, cap: s.opening.captions };
}, T);
await page.screenshot({ path: '/tmp/stacks.png' });
console.log(JSON.stringify(r).slice(0, 900), errs.slice(0, 3));
await browser.close(); await server.close();
