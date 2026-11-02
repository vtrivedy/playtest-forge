// The Scribe's Stacks (opening/pressStacks.ts): input-only climb (stick + Space) from the snow to the reading stand.
//   node tools/press-stacks-probe.mjs  → k = stacks reached (9 = stand), caption = the secret page line
import { chromium } from 'playwright';
import { createServer } from 'vite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const out = process.argv[2] || `/captures/hazel/stacks-secret-${Date.now()}`;
await fs.mkdir(out, { recursive: true });
const evidence = { scope: 'Developer travel and staged climb start; then input-only platforming. Not a hub route or unaided secret discovery.', errors: [], completed: false };
const server = await createServer({ configFile: 'games/fox-spirit/vite.config.ts', server: { port: 5262, host: '127.0.0.1', strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
const errs = evidence.errors; page.on('pageerror', (e) => errs.push(String(e))); page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
try {
await page.goto('http://127.0.0.1:5262/?fresh&manual=1');
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
  h.setStick(null); h.setKeys([]); s = h.advance(30, 1/30, false); h.advance(1, 1/30, true); return { k, log, game: s, save: localStorage.getItem('russet-vale-worlds-v1') };
}, T);
evidence.climb = r;
await page.screenshot({ path: `${out}/climb.png` });
await fs.writeFile(`${out}/evidence.partial.json`, JSON.stringify(evidence, null, 2));
assert.equal(r.k, T.length, 'input climb reaches all stacks and stand');
assert.deepEqual(r.game.opening.worlds.progress.secrets, ['press-stacks']);
for (const world of Object.values(r.game.opening.worlds.progress.worlds)) {
  assert.equal(world.fill, 0, 'optional page cannot fill a Seedwell');
  assert.equal(world.ability, null, 'optional page cannot grant an ability');
}
await page.keyboard.press('Tab');
await page.evaluate(() => window.__gameHooks.advance(1, 1/60, true));
await page.screenshot({ path: `${out}/earned-memory.png` });
evidence.album = await page.evaluate(() => window.__game.state());
assert.equal(evidence.album.opening.worlds.mapOpen, true);
await page.evaluate(() => history.replaceState(null, '', '/?manual=1'));
await page.reload();
await page.waitForFunction(() => window.__gameHooks?.ready, null, { timeout: 120000 });
evidence.reload = await page.evaluate(() => window.__gameHooks.advance(60, 1/60, true));
assert.deepEqual(evidence.reload.opening.worlds.progress.secrets, ['press-stacks']);
await page.evaluate(() => { window.__gameHooks.travel('press'); window.__gameHooks.teleport(-674.5,111.1,0); });
evidence.revisit = await page.evaluate(() => window.__gameHooks.advance(60, 1/60, true));
await page.screenshot({ path: `${out}/revisited-stand.png` });
assert.notEqual(evidence.revisit.opening.captions.showing, 'A page never pressed: everyone, together, laughing.', 'saved stand stays quiet');
assert.deepEqual(errs, []);
evidence.completed = true;
console.log(`PASS Stacks climb, optional memory, reload: ${out}`);
} finally {
  await fs.writeFile(`${out}/evidence.json`, JSON.stringify(evidence, null, 2));
  await browser.close(); await server.close();
}
