// Staged saved-fact diagnostic; does not prove earning the facts or walking through arches.
import { chromium } from 'playwright';
import { createServer } from 'vite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const out = process.argv[2] || `/captures/hazel/world-save-${Date.now()}`;
await fs.mkdir(out, { recursive: true });
const server = await createServer({ configFile: 'games/fox-spirit/vite.config.ts', server: { port: 5198, host: '127.0.0.1', strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const evidence = { scope: 'Injected completed facts; native Tab and developer world travel. Reconstruction diagnostic only.', errors: [], cases: [] };
try {
  for (const restored of [['teach'], ['teach', 'develop', 'combine']]) {
    const context = await browser.newContext({ viewport: { width: 960, height: 540 } });
    await context.addInitScript(restored => localStorage.setItem('russet-vale-worlds-v1', JSON.stringify({ version: 1, worlds: { russetvale: { restored }, ashwater: { restored } } })), restored);
    const page = await context.newPage();
    page.on('pageerror', e => evidence.errors.push(String(e)));
    await page.goto('http://127.0.0.1:5198/?manual=1');
    await page.waitForFunction(() => window.__gameHooks?.ready, null, { timeout: 120000 });
    const boot = await page.evaluate(() => window.__gameHooks.advance(60, 1 / 60, true));
    const label = restored.length === 1 ? 'teach' : 'full';
    await page.screenshot({ path: `${out}/${label}-hub.png` });
    assert.ok(boot.opening.worlds.progress.worlds.russetvale.restored.includes('teach'));
    const marsh = await page.evaluate(() => { window.__gameHooks.travel('ashwater'); return window.__gameHooks.advance(180, 1 / 60, true); });
    await page.screenshot({ path: `${out}/${label}-marsh.png` });
    await page.keyboard.press('Tab');
    await page.evaluate(() => window.__gameHooks.advance(2, 1 / 60, true));
    await page.screenshot({ path: `${out}/${label}-album.png` });
    const cameraDistance = Math.hypot(...marsh.camera.pos.map((v, i) => v - marsh.pos[i]));
    evidence.cases.push({ restored, boot, marsh, cameraDistance, physicalMatchesSave: restored.every(level => marsh.opening.ashwater.done.includes(level)) });
    await context.close();
  }
  assert.deepEqual(evidence.errors, []);
  assert.ok(evidence.cases.every(c => c.physicalMatchesSave), 'saved Ashwater facts must reconstruct physical completion');
  assert.ok(evidence.cases.every(c => c.cameraDistance < 12), 'travel must leave no lens in the old world');
  evidence.completed = true;
} finally {
  await fs.writeFile(`${out}/evidence.json`, JSON.stringify(evidence, null, 2));
  await browser.close(); await server.close();
}
console.log(`Save reconstruction diagnostic complete: ${out}`);
