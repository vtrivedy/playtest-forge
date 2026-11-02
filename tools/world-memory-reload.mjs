// Injected saved facts, native Album keys, real scene reload. No physical-climb claim.
import { chromium } from 'playwright';
import { createServer } from 'vite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const out = process.argv[2] || `/captures/hazel/memory-reload-${Date.now()}`;
await fs.mkdir(out, { recursive: true });
const evidence = { scope: 'Saved optional-memory fixtures; no physical acquisition or portal claim.', errors: [], cases: [], completed: false };
const server = await createServer({ configFile: 'games/fox-spirit/vite.config.ts', server: { port: 5263, host: '127.0.0.1', strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  for (const secrets of [[], ['press-stacks'], ['vale-loft'], ['press-stacks', 'vale-loft']]) {
    const label = secrets.length === 2 ? 'both' : secrets[0] || 'neither';
    const context = await browser.newContext({ viewport: { width: 960, height: 540 } });
    const page = await context.newPage();
    page.on('pageerror', e => evidence.errors.push(String(e)));
    // One injection only: the second navigation must read what the first boot left in storage.
    await page.goto('http://127.0.0.1:5263/?manual=1');
    await page.evaluate(secrets => localStorage.setItem('russet-vale-worlds-v1', JSON.stringify({ version: 1, worlds: {}, secrets })), secrets);
    const result = { secrets, loads: [] };
    evidence.cases.push(result);
    for (let load = 0; load < 2; load++) {
      await page.reload();
      await page.waitForFunction(() => window.__gameHooks?.ready, null, { timeout: 120000 });
      const boot = await page.evaluate(() => window.__gameHooks.advance(60, 1 / 60, true));
      assert.deepEqual(boot.opening.worlds.progress.secrets, secrets);
      for (const world of Object.values(boot.opening.worlds.progress.worlds)) {
        assert.equal(world.fill, 0);
        assert.equal(world.ability, null);
        assert.deepEqual(world.restored, []);
      }
      await page.evaluate(() => {
        window.__memoryText = [];
        const original = CanvasRenderingContext2D.prototype.fillText;
        CanvasRenderingContext2D.prototype.fillText = function (value, ...args) {
          window.__memoryText.push(String(value));
          return original.call(this, value, ...args);
        };
      });
      await page.keyboard.press('Tab');
      for (let i = 0; i < 4; i++) await page.keyboard.press('BracketRight');
      const pages = [];
      for (const [secret, title] of [['press-stacks', 'Everyone, together, laughing'], ['vale-loft', 'The house before the rain']]) {
        await page.evaluate(() => { window.__memoryText = []; window.__gameHooks.advance(1, 1 / 60, true); });
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');
        await page.evaluate(() => window.__gameHooks.advance(1, 1 / 60, true));
        const text = await page.evaluate(() => window.__memoryText);
        const found = secrets.includes(secret);
        assert.equal(text.includes(title), found, `${label}/${secret}: earned title visibility`);
        assert.equal(text.includes('A loose binding'), !found, `${label}/${secret}: missing-page visibility`);
        pages.push({ secret, found, text });
        await page.screenshot({ path: `${out}/${label}-${load}-${secret}.png` });
        await page.keyboard.press('BracketRight');
      }
      await page.keyboard.press('Tab');
      const closed = await page.evaluate(() => window.__gameHooks.advance(1, 1 / 60, true));
      assert.equal(closed.opening.worlds.mapOpen, false);
      result.loads.push({ boot, pages, closed });
      await fs.writeFile(`${out}/evidence.partial.json`, JSON.stringify(evidence, null, 2));
    }
    await context.close();
  }
  assert.deepEqual(evidence.errors, []);
  evidence.completed = true;
} finally {
  await fs.writeFile(`${out}/evidence.json`, JSON.stringify(evidence, null, 2));
  await browser.close();
  await server.close();
}
console.log(`PASS independent optional-memory reloads: ${out}`);
