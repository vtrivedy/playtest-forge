// Fingerprint of the opening's shared build rand: the next ctx.rand() values after boot + collider count.
// Equal values on two builds ⇒ every builder that draws from ctx.rand laid out identically.
//   node tools/rand-fingerprint.mjs [--port 5197]
import { chromium } from 'playwright';
import { createServer } from 'vite';

const i = process.argv.indexOf('--port');
const port = i > 0 ? Number(process.argv[i + 1]) : 5197;
const server = await createServer({ configFile: 'games/fox-spirit/vite.config.ts', server: { port, host: '127.0.0.1', strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 320, height: 180 } })).newPage();
page.on('console', (m) => m.text().startsWith('RC') && console.log(m.text()));
try {
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded', timeout: 300000 });
  await page.waitForFunction(() => window.__gameHooks?.ready === true, null, { timeout: 600000 });
  const r = await page.evaluate(() => {
    const { ctx } = window.__opening;
    return { next: [ctx.rand(), ctx.rand(), ctx.rand()].map((v) => v.toFixed(8)), colliders: ctx.colliders.length };
  });
  console.log(JSON.stringify(r));
} finally {
  await browser.close();
  await server.close();
}
