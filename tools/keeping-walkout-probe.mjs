// Physical soft-lock walk-outs: stage the fox on the floor under the Keeping place and steer it by stick
// along waypoints back to the open meadow (no jumps, no teleports after staging). Pass = every leg reached.
//   node tools/keeping-walkout-probe.mjs
import { chromium } from 'playwright';
import { createServer } from 'vite';
const server = await createServer({ configFile: 'games/fox-spirit/vite.config.ts', server: { port: 5197, host: '127.0.0.1', strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 320, height: 200 } });
let fail = false;
try {
  await page.goto('http://127.0.0.1:5197/', { waitUntil: 'domcontentloaded', timeout: 300000 });
  await page.waitForFunction(() => window.__gameHooks?.ready === true, null, { timeout: 600000 });
  const routes = {
    // under the ledge / steam pad, out past the terrace's SW corner and where the SE ridge column was
    pit: [[22.6, 78.0], [24.3, 73.9], [24.9, 71.5], [23.5, 69.0], [20.5, 66.2], [12, 65]],
    // the same pit with a player's straight steer through the slot (Flint's free-play waypoints)
    slot: [[22.6, 78.0], [24.3, 73.9], [23.5, 69.0], [20.5, 66.2], [12, 65]],
    // the gorge floor under the bridge
    gorge: [[27.5, 69.5], [24, 70.3], [23.2, 68.6], [20.5, 66.2], [12, 65]],
    // inside the bend, under the shoulder side
    bend: [[22.4, 80.2], [22.3, 77.8], [24.3, 73.9], [24.9, 71.5], [20.5, 66.2], [12, 65]],
  };
  for (const [name, pts] of Object.entries(routes)) {
    const log = await page.evaluate((pts) => {
      const h = window.__gameHooks;
      h.setManual(true);
      h.teleport(pts[0][0], pts[0][1], 0);
      h.advance(30, 1 / 60, false);
      const out = [];
      for (const [x, z] of pts.slice(1)) {
        let s;
        let n = 0;
        for (; n < 900; n++) {
          s = h.advance(1, 1 / 60, false);
          const dx = x - s.pos[0], dz = z - s.pos[2], d = Math.hypot(dx, dz);
          if (d < 0.35) break;
          h.setStick(dx / d, dz / d);
        }
        out.push({ to: [x, z], at: s.pos, ok: n < 900 });
        if (n >= 900) break;
      }
      h.setStick(0, 0);
      return out;
    }, pts);
    const ok = log.length === pts.length - 1 && log.every((l) => l.ok);
    if (!ok) fail = true;
    console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(log));
  }
} finally {
  await browser.close();
  await server.close();
}
process.exit(fail ? 1 : 0);
