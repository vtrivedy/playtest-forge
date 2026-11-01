// Heron fling probe (DESIGN-unpressed.md): unpress the heron, stand out from it, hop onto its back by stick +
// held Space, then steer to the shelf. Needs the controller's onGroundContact hook (canopy branch) wired to
// unpressed.contact.  node tools/unpressed-fling-probe.mjs [held|tap] [outDir] [home]
// `home`: run the homecoming first (the heron wheels over the well and returns) and fling after it is back.
import { chromium } from 'playwright';
import { createServer } from 'vite';
const server = await createServer({ configFile: 'games/fox-spirit/vite.config.ts', server: { port: 5198, host: '127.0.0.1', strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.on('pageerror', (e) => console.log('ERR', String(e)));
await page.goto('http://127.0.0.1:5198/', { waitUntil: 'domcontentloaded', timeout: 300000 });
await page.waitForFunction(() => window.__gameHooks?.ready === true, null, { timeout: 600000 });
const held = process.argv[2] !== 'tap';
const out = process.argv[3] ?? '/tmp';
const home = process.argv[4] === 'home';
await page.exposeFunction('__shot', async (k) => { await page.screenshot({ path: `${out}/fling-${k}.png` }); });
const r = await page.evaluate(async ([held, home]) => {

  const h = window.__gameHooks; h.setManual(true);
  const { UNPRESSED, SHELF } = await import('/src/opening/layout.ts');
  h.unpress('heron'); h.advance(420, 1/60, false);
  if (home) { h.homecoming(); h.advance(900, 1/60, false); }
  const st = h.state().opening.unpressed.creatures.find((c) => c.id === 'heron');
  const [hx, hy, hz] = st.at; const o = UNPRESSED.heron.out;
  // stand 1.6 m out from the heron, facing it
  h.teleport(hx + o.x * 1.6, hz + o.z * 1.6, Math.atan2(-o.x, -o.z)); h.advance(30, 1/60, false);
  const log = []; let peak = -9, s; let j0 = -1;
  for (let i = 0; i < 300; i++) {
    s = h.advance(0, 1/60, false) ?? h.state();
    s = h.state();
    const onTo = s.pos[1] < 1.5 && (j0 < 0 || i < j0 + 30) ? [hx, hz] : [SHELF.x, SHELF.z];
    const dx = onTo[0] - s.pos[0], dz = onTo[1] - s.pos[2], d = Math.hypot(dx, dz) || 1;
    h.setStick(dx / d, dz / d);
    if (j0 < 0 && Math.hypot(hx - s.pos[0], hz - s.pos[2]) < 1.05) j0 = i;
    const jump = j0 >= 0 && (held ? i < j0 + 200 : i < j0 + 8);
    h.setKeys(jump ? ['Space'] : []);
    s = h.advance(1, 1/60, j0 >= 0 && [j0 - 25, j0 + 8, j0 + 20, j0 + 40, j0 + 70, j0 + 110].includes(i));
    if (j0 >= 0 && [j0 - 25, j0 + 8, j0 + 20, j0 + 40, j0 + 70, j0 + 110].includes(i)) await window.__shot?.(i - j0);
    peak = Math.max(peak, s.pos[1]);
    if (i % 20 === 0) log.push([i, s.pos.map((v) => +v.toFixed(2)), s.grounded]);
  }
  h.setKeys([]); h.setStick(0, 0); s = h.advance(60, 1/60, true);
  return { heron: st, peak, end: s.pos, flings: s.opening.unpressed.flings, log };
}, [held, home]);
console.log(JSON.stringify(r));
await page.screenshot({ path: `${out}/fling-end.png` });
await browser.close(); await server.close();
