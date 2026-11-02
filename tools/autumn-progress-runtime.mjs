// Staged mechanism starts. Real keyboard actions earn progress; never forces heat or completion.
import { chromium } from 'playwright';
import { createServer } from 'vite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
const motion = process.argv.includes('--motion');
const out = process.argv[2] || `/captures/hazel/autumn-progress-${Date.now()}`;
await fs.mkdir(out, { recursive: true });
const server = await createServer({ configFile: 'games/fox-spirit/vite.config.ts', server: { port: 5199, host: '127.0.0.1', strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const evidence = { sha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), scope: 'Saved teach fixture, staged mechanism starts, real E and Shift. Keeping solved before Millbrook to verify prerequisites. Reload uses the earned saved facts. Not an uninterrupted route or unaided discovery.', errors: [], samples: [] };
const context = await browser.newContext({ viewport: { width: 960, height: 540 } });
const page = await context.newPage();
page.setDefaultTimeout(120000);
page.on('pageerror', e => evidence.errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') evidence.errors.push(m.text()); });
async function advance(n, render = false) { return page.evaluate(([n, render]) => window.__gameHooks.advance(n, 1 / 60, render), [n, render]); }
async function stage(x, z, yaw = 0) { await page.evaluate(([x, z, yaw]) => { const h = window.__gameHooks; h.setKeys([]); h.setStick(0, 0); h.teleport(x, z, yaw); h.advance(15, 1 / 60, false); }, [x, z, yaw]); }
async function key(k, n = 1) { await page.keyboard.down(k); await advance(n); await page.keyboard.up(k); await advance(1); }
async function sample(label) { const state = await advance(1, true); evidence.samples.push({ label, state }); await fs.writeFile(`${out}/evidence.partial.json`, JSON.stringify(evidence, null, 2)); await page.screenshot({ path: `${out}/${label}.png` }); return state; }
async function settleTree() {
  if (!motion) return advance(480);
  await fs.mkdir(`${out}/frames`, { recursive: true });
  evidence.motion = { scope: 'Eight simulation seconds at the staged root bowl, real placement -> ignition -> fall -> settled bridge.', simulationHz: 60, captureFps: 12, silent: true, frames: 0 };
  for (let i = 0; i < 96; i++) {
    await advance(5, true);
    await page.screenshot({ path: `${out}/frames/f${String(i).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 85 });
    evidence.motion.frames++;
  }
}
const solved = s => s.opening.worlds.progress.worlds.russetvale.restored;
try {
  await page.goto('http://127.0.0.1:5199/?manual=1');
  await page.waitForFunction(() => window.__gameHooks?.ready);
  await page.evaluate(() => localStorage.setItem('russet-vale-worlds-v1', JSON.stringify({ version: 1, worlds: { russetvale: { restored: ['teach'] } } })));
  await page.reload(); await page.waitForFunction(() => window.__gameHooks?.ready);
  const K = await page.evaluate(async () => (await import('/src/opening/layout.ts')).KEEPING);
  const M = await page.evaluate(async () => (await import('/src/opening/millbrookLayout.ts')).MILLBROOK);
  const boot = await sample('01-teach-only'); assert.deepEqual(solved(boot), ['teach']);
  await stage(K.coal.x, K.coal.z); await key('e');
  await stage(24.17, 80.65, Math.atan2(K.steam.x - 24.17, K.steam.z - 80.65));
  await key('e'); await advance(360);
  const steam = await sample('02-steam'); assert.ok(steam.opening.chemistry.steamLatched);
  await key('e');
  await stage(29.0, 77.35, Math.atan2(K.root.x - 29.0, K.root.z - 77.35));
  await key('e'); await settleTree();
  const tree = await sample('03-keeping-before-mill');
  assert.ok(tree.opening.keeping.bridge); assert.equal(tree.opening.keeping.impacts, 1);
  assert.equal(tree.opening.chemistry.releases, 1); assert.deepEqual(solved(tree), ['teach']);
  // Dash crosses the real leaf-dam trigger. No developer burst hook.
  await stage(M.dam.x + 1.8, M.dam.z, -Math.PI / 2);
  await page.evaluate(() => window.__gameHooks.setStick(-1, 0));
  await key('Shift', 16); await page.evaluate(() => window.__gameHooks.setStick(0, 0));
  await advance(1800);
  const mill = await sample('04-kiln-earned');
  assert.equal(mill.opening.millrace.phase, 'burst'); assert.ok(mill.opening.millrace.turning);
  assert.ok(mill.opening.millWeir.lit); assert.deepEqual(solved(mill), ['teach', 'develop', 'combine']);
  assert.equal(mill.opening.finale.kindles, 0);
  await page.keyboard.press('Tab'); await sample('05-earned-album'); await page.keyboard.press('Tab');
  evidence.saved = await page.evaluate(() => JSON.parse(localStorage.getItem('russet-vale-worlds-v1')));
  await page.reload(); await page.waitForFunction(() => window.__gameHooks?.ready); await advance(60);
  const reload = await sample('06-earned-reload');
  assert.deepEqual(solved(reload), ['teach', 'develop', 'combine']);
  assert.ok(reload.opening.millWeir.lit && reload.opening.millrace.turning && reload.opening.keeping.bridge);
  assert.equal(reload.opening.keeping.stair, 'open'); assert.ok(reload.opening.chemistry.completed);
  assert.equal(reload.opening.keeping.impacts, 0); assert.equal(reload.opening.chemistry.releases, 0);
  assert.equal(reload.opening.finale.kindles, 0);
  await stage(K.hinge.x + K.fall.x * K.span * .5, K.hinge.z + K.fall.z * K.span * .5, Math.atan2(K.fall.x, K.fall.z));
  const bridge = await sample('07-saved-bridge-support');
  assert.ok(bridge.grounded); assert.ok(Math.abs(bridge.pos[1] - (K.terrace.top + .12)) < .03);
  await stage(M.kiln.x + 1.6, M.kiln.z, -Math.PI / 2); await sample('08-saved-kiln');
  await advance(1800); const quiet = await sample('09-quiet-later');
  assert.equal(quiet.opening.keeping.impacts, 0); assert.equal(quiet.opening.chemistry.releases, 0);
  assert.equal(quiet.opening.crown.released, false);
  assert.deepEqual(evidence.errors, []); evidence.completed = true;
} finally {
  await fs.writeFile(`${out}/evidence.json`, JSON.stringify(evidence, null, 2));
  await browser.close(); await server.close();
}
if (motion && evidence.completed) execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '12', '-i', `${out}/frames/f%04d.jpg`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', `${out}/keeping-fall.mp4`]);
console.log(`Autumn mechanism/progress/reload PASS: ${out}`);
