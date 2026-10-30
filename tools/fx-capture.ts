/**
 * FX lookdev capture for fox-spirit — leaves, ember pickups, collect burst, restore burst.
 *
 *   npx tsx tools/fx-capture.ts --port 5187 --out playtest-output/fox-spirit/fx
 */
import { chromium } from 'playwright';
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}
const port = Number(arg('port', '5187'));
const outDir = path.resolve(root, arg('out', 'playtest-output/fox-spirit/fx'));
fs.mkdirSync(outDir, { recursive: true });
const url = `http://127.0.0.1:${port}/`;

let vite: ChildProcess | undefined;
try {
  vite = spawn('npx', ['vite', '--config', 'games/fox-spirit/vite.config.ts', '--host', '127.0.0.1', '--port', String(port)], {
    cwd: root,
    stdio: 'ignore',
    detached: true,
  });
  for (let t = Date.now(); Date.now() - t < 45_000; ) {
    try {
      await fetch(url);
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('crash', () => console.error('[crash] page crashed'));
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  page.on('console', (m) => m.type() === 'error' && console.error('[console.error]', m.text()));
  await page.goto(url, { waitUntil: 'load', timeout: 60_000 });
  await page.waitForFunction(() => Boolean((window as unknown as { __gameHooks?: unknown }).__gameHooks), null, { timeout: 60_000 });
  await page.waitForTimeout(1500);
  const shot = (name: string) => page.screenshot({ path: path.join(outDir, `${name}.png`) });

  await shot('01-start-pickups');
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(900);
  await shot('02-run-leaves');
  await page.waitForTimeout(700);
  await shot('03-collect');
  await page.waitForTimeout(500);
  await page.keyboard.up('KeyW');
  await shot('04-after-collect');

  await page.evaluate(() => (window as unknown as { __gameHooks: { teleportToShrine: () => void } }).__gameHooks.teleportToShrine());
  await page.waitForTimeout(900);
  await shot('05-shrine-before');
  await page.evaluate(() => (window as unknown as { __gameHooks: { forceRestore: () => void } }).__gameHooks.forceRestore());
  for (const [i, ms] of [400, 700, 1000, 1500].entries()) {
    await page.waitForTimeout(ms);
    await shot(`06-restore-${i}`);
  }
  await page.waitForTimeout(2500);
  await shot('07-restored-leaves');
  const game = await page.evaluate(() => (window as unknown as { __game?: unknown }).__game);
  fs.writeFileSync(path.join(outDir, 'game.json'), JSON.stringify(game, null, 2));
  console.log(JSON.stringify(game));
  await browser.close();
} finally {
  if (vite?.pid) {
    try {
      process.kill(-vite.pid, 'SIGTERM');
    } catch {
      /* */
    }
  }
}
