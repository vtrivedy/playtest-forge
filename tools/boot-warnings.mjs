// Boot the opening once and print every console warning/error and page error (boot-time checks: lanes, budgets).
//   node tools/boot-warnings.mjs
import { chromium } from 'playwright';
import { createServer } from 'vite';

const server = await createServer({ configFile: 'games/fox-spirit/vite.config.ts', server: { port: 5199, host: '127.0.0.1', strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 320, height: 180 } })).newPage();
page.on('console', (m) => (m.type() === 'warning' || m.type() === 'error') && console.log(m.type().toUpperCase(), m.text()));
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
try {
  await page.goto('http://127.0.0.1:5199/', { waitUntil: 'domcontentloaded', timeout: 300000 });
  await page.waitForFunction(() => window.__gameHooks?.ready === true, null, { timeout: 600000 });
  await page.evaluate(() => window.__gameHooks.advance(30, 1 / 60, true));
} finally {
  await browser.close();
  await server.close();
}
