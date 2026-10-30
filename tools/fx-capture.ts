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
  const shot = (name: string) => page.screenshot({ path: path.join(outDir, `${name}.png`), timeout: 120_000 });

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
  // SwiftShader runs ~0.25× game speed: these span ~0.3–4 s of game time
  // game clock stops at 'won' — mirror the game's dt clamp with our own rAF counter
  // string form: tsx keepNames would inject __name() into a function body
  await page.evaluate(`(() => {
    window.__fxT = 0;
    let last = performance.now();
    const loop = (now) => { window.__fxT += Math.min((now - last) / 1000, 0.05); last = now; requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  })()`);
  const gameT = () => page.evaluate(() => (window as unknown as { __fxT: number }).__fxT);
  const t0 = await gameT();
  for (const [i, gs] of [0.08, 0.35, 0.9, 2.2].entries()) {
    while ((await gameT()) - t0 < gs) await page.waitForTimeout(100);
    await shot(`06-restore-${i}`);
  }
  while ((await gameT()) - t0 < 6) await page.waitForTimeout(200);
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
