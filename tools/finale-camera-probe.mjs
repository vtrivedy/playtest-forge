// Finale route with real input (DESIGN-finale.md). STAGED start: the Keeping is settled with the dev release, the fox
// is teleported to the ember on the shelf (E picks it up for real) and then onto the far crag carrying it. From there
// every step is live controller input: run off the crag's south lip holding jump → glide into Press Hollow → walk to
// the cradle → E sets the ember down → the finale plays; then rest, and finally walk out of the hollow to the meadow.
//   node tools/finale-camera-probe.mjs [outDir] [--clip]
// Offline 60Hz simulation, trace every 2 steps. --clip: traversal at15fps, title shot at2fps.
// Preserve trace and __game before encoding externally; staged setup does not prove discovery.
import { chromium } from 'playwright';
import { createServer } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const out = path.resolve(args[0] && !args[0].startsWith('--') ? args[0] : '/tmp/finale-camera');
const clip = args.includes('--clip');
fs.mkdirSync(out, { recursive: true });
const server = await createServer({ configFile: 'games/fox-spirit/vite.config.ts', server: { port: 5196, host: '127.0.0.1', strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 480, height: 270 } })).newPage();
page.setDefaultTimeout(600000);
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
const trace = [];
const sha = execFileSync('git', ['rev-parse','HEAD'], {encoding:'utf8'}).trim();
const notes = [];
let frame = 0;
const save = () => fs.writeFileSync(path.join(out, 'trace.json'), JSON.stringify({ sha, staging: "Keeping dev-release; ember pickup; teleport to far crag; controller thereafter", notes, errors, trace }, null, 0));
try {
  await page.goto('http://127.0.0.1:5196/', { waitUntil: 'domcontentloaded', timeout: 300000 });
  await page.waitForFunction(() => window.__gameHooks?.ready === true, null, { timeout: 600000 });
  await page.keyboard.press('KeyM');
  // staged: settle the Keeping, pick up the ember on the shelf, stand on the far crag facing the vista
  notes.push(['staged', await page.evaluate(() => {
    const h = window.__gameHooks;
    h.setManual(true);
    h.keepingRelease();
    h.advance(600, 1 / 60, false);
    const c = h.state().opening.carry.position;
    h.teleport(c[0] + 0.5, c[2] + 0.4, Math.PI);
    h.advance(10, 1 / 60, false);
    h.setKeys(['KeyE']);
    h.advance(2, 1 / 60, false);
    h.setKeys([]);
    const carried = h.state().opening.carry.carried;
    h.teleport(25.6, 63.8, Math.PI);
    h.advance(30, 1 / 60, false);
    const s = h.state();
    return { carried, keeping: s.opening.keeping.phase, pos: s.pos, finale: s.opening.finale.phase };
  })]);
  // live input legs: [target x, z, keys, until]; the stick points at the target (unit, world-relative)
  const legs = [
    // run south off the crag lip and hold jump the whole way down: glide
    { to: [21.4, 46], keys: ['Space'], jumpAt: 0.9, until: (s) => s.grounded && s.pos[1] < 3, max: 600 },
    // walk to the cradle (stops short; E sets the ember in the bowl ahead of the feet)
    { to: 'cradle', keys: [], until: (s, d) => d < 0.35, max: 900 },
    { to: null, keys: ['KeyE'], until: () => true, max: 2 },
    // rest by the cradle while the finale plays to the card and past it
    { to: null, keys: [], until: (s) => s.opening.finale.card === 'done', max: 60 * 60 },
    // walk out of the hollow back into the meadow
    { to: [14.5, 50], keys: [], until: (s, d) => d < 0.8, max: 900 },
    { to: [11.5, 58], keys: [], until: (s, d) => d < 0.8, max: 900 },
    { to: [6, 66], keys: [], until: (s, d) => d < 0.8, max: 900 },
  ];
  for (const [li, leg] of legs.entries()) {
    let done = false;
    for (let n = 0; n < leg.max && !done; n += 2) {
      const r = await page.evaluate(([leg, n]) => {
        const h = window.__gameHooks;
        let s = h.state();
        let d = 0;
        if (leg.to) {
          const c = s.opening.finale.cradle;
          const radius = Math.max(.0001, Math.hypot(s.pos[0] - c[0], s.pos[2] - c[1]));
          const to = leg.to === 'cradle' ? [c[0] + (s.pos[0] - c[0]) / radius * .9, c[1] + (s.pos[2] - c[1]) / radius * .9] : leg.to;
          const dx = to[0] - s.pos[0], dz = to[1] - s.pos[2];
          d = Math.hypot(dx, dz);
          h.setStick(dx / d, dz / d);
        } else h.setStick(null);
        const keys = leg.jumpAt != null && n < leg.jumpAt * 60 ? [] : leg.keys;
        h.setKeys(keys);
        s = h.advance(2, 1 / 60, false);
        const c=window.__opening.camera;
        const cam={pos:c.position.toArray(),pitch:-Math.asin(c.getWorldDirection(c.position.clone()).y)*180/Math.PI};
        return { cam, s: { pos: s.pos, grounded: s.grounded, gliding: s.gliding, speed: s.speed, opening: { carry: { carried: s.opening.carry.carried, position: s.opening.carry.position }, finale: s.opening.finale } }, d };
      }, [{ to: leg.to, keys: leg.keys, jumpAt: leg.jumpAt }, n]);
      frame += 2;
      const s = r.s;
      trace.push([frame, li, s.pos.map((v) => +v.toFixed(3)), s.grounded, s.gliding, s.opening.carry.carried, s.opening.finale.phase, s.opening.finale.card, r.cam]);
      if (clip && ((li < 2 && n % 4 === 0) || (li === 3 && (s.opening.finale.card !== 'hidden') && n % 30 === 0) || ((li === 4 && n < 180 || li === 6) && n % 4 === 0))) {
        await page.evaluate(() => window.__gameHooks.advance(0, 1 / 60, true));
        await page.screenshot({ path: path.join(out, `f${String(frame / 2).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 80 });
      }
      done = leg.until({ ...s, grounded: s.grounded }, r.d);
    }
    await page.evaluate(() => window.__gameHooks.advance(0, 1/60, true));
    await page.screenshot({path:path.join(out, `leg${li}.png`)});
    fs.writeFileSync(path.join(out, 'game.json'), JSON.stringify(await page.evaluate(()=>({mode:window.__game.mode,state:window.__game.state()}))));
    notes.push([`leg${li}`, { done, frame, last: trace[trace.length - 1] }]);
    console.log(`leg ${li}: ${done ? "PASS" : "FAIL"} at ${(frame/60).toFixed(2)}s`);
    save();
    if (!done) throw new Error(`leg ${li} did not complete`);
  }
  await page.evaluate(() => window.__gameHooks.setStick(null));

} catch (e) {
  errors.push(String(e?.stack ?? e));
} finally {
  save();
  const checks = [];
  for (let leg=0; leg<7; leg++) {
    const rows=trace.filter(r=>r[1]===leg && r[0]>60);
    if(!rows.length) continue;
    const minChestDistance=Math.min(...rows.map(r=>Math.hypot(r[8].pos[0]-r[2][0], r[8].pos[1]-r[2][1]-.6, r[8].pos[2]-r[2][2])));
    const maxPitch=Math.max(...rows.map(r=>Math.abs(r[8].pitch)));
    const maxLensSpeed=Math.max(0,...rows.slice(1).map((r,i)=>Math.hypot(...r[8].pos.map((v,j)=>v-rows[i][8].pos[j]))*30));
    checks.push({leg,minChestDistance,maxPitch,maxLensSpeed,pass:minChestDistance>=1.1 && maxPitch<70 && maxLensSpeed<24});
  }
  fs.writeFileSync(path.join(out,'camera-check.json'),JSON.stringify({sha,checks,errors,pass:checks.length===7 && checks.every(c=>c.pass) && !errors.length},null,2));
  console.log(JSON.stringify({errors,checks}));
  if (checks.length!==7 || checks.some(c=>!c.pass)) process.exitCode=1;
  if (errors.length) process.exitCode = 1;
  await browser.close();
  await server.close();
}
