/**
 * Headless playtest harness — Chromium + SwiftShader WebGL.
 * Drives keyboard, screenshots, webm, reads window.__game.
 *
 *   npx tsx tools/playtest.ts --game creature-island --seconds 25
 */
import { chromium } from 'playwright';
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}

const game = arg('game', 'creature-island')!;
const seconds = Number(arg('seconds', '25'));
const outDir = path.resolve(arg('out', path.join(root, 'playtest-output', game))!);
const port = Number(arg('port', '5173'));
const urlOverride = arg('url');
fs.mkdirSync(outDir, { recursive: true });

async function waitForServer(url: string, timeoutMs = 45_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 404) return;
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Server did not come up at ${url}`);
}

async function play(page: import('playwright').Page): Promise<void> {
  // Creature platformer pattern: run, jump, glide, dash, gather
  const end = Date.now() + seconds * 1000;
  // Fox-spirit shrine is at -Z from spawn; bias forward + occasional jump/dash/glide.
  const sequence: Array<{ down: string[]; up?: string[]; ms: number }> = game.includes('fox')
    ? [
        { down: ['KeyW'], ms: 700 },
        { down: ['KeyW', 'Space'], ms: 120 },
        { down: ['KeyW'], ms: 500 },
        { down: ['KeyW', 'ShiftLeft'], ms: 80 },
        { down: ['KeyW'], ms: 600 },
        { down: ['KeyW', 'Space'], ms: 900 }, // glide toward shrine
        { down: ['KeyW'], ms: 700 },
        { down: ['KeyA', 'KeyW'], ms: 300 },
        { down: ['KeyD', 'KeyW'], ms: 300 },
        { down: ['KeyW'], ms: 800 },
        { down: ['KeyW', 'ShiftLeft'], ms: 80 },
        { down: ['KeyW'], ms: 900 },
      ]
    : [
        { down: ['KeyW'], ms: 600 },
        { down: ['Space'], ms: 80 },
        { down: ['KeyW', 'Space'], ms: 700 },
        { down: ['KeyD'], ms: 400 },
        { down: ['ShiftLeft'], ms: 50 },
        { down: ['KeyW', 'KeyA'], ms: 500 },
        { down: ['Space'], ms: 80 },
        { down: ['KeyW', 'Space'], ms: 800 },
        { down: ['KeyA'], ms: 450 },
        { down: ['KeyS', 'KeyD'], ms: 400 },
        { down: ['Space'], ms: 80 },
        { down: ['ShiftLeft'], ms: 50 },
        { down: ['KeyW'], ms: 500 },
      ];
  let i = 0;
  while (Date.now() < end) {
    const step = sequence[i % sequence.length]!;
    for (const k of step.down) await page.keyboard.down(k);
    await page.waitForTimeout(step.ms);
    for (const k of step.down) await page.keyboard.up(k);
    i += 1;
    const state = await page.evaluate(() => (window as unknown as { __game?: { status: string } }).__game);
    if (state && (state.status === 'won' || state.status === 'lost')) break;
  }
}

let vite: ChildProcess | undefined;
const baseUrl = urlOverride ?? `http://127.0.0.1:${port}/`;

try {
  if (!urlOverride) {
    vite = spawn(
      'npx',
      ['vite', '--config', `games/${game}/vite.config.ts`, '--host', '127.0.0.1', '--port', String(port)],
      { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], detached: true },
    );
    vite.stdout?.on('data', (d) => process.stdout.write(`[vite] ${d}`));
    vite.stderr?.on('data', (d) => process.stderr.write(`[vite] ${d}`));
    await waitForServer(baseUrl);
  }

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
      '--disable-gpu-sandbox',
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: outDir, size: { width: 1280, height: 720 } },
  });
  const page = await context.newPage();
  page.on('pageerror', (err) => console.error('[pageerror]', err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.error('[console.error]', msg.text());
  });

  await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 60_000 });
  await page.waitForTimeout(800);

  // Do NOT call canvas.getContext — three.js already owns the WebGL2 context.
  const info = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const g = (window as unknown as { __game?: unknown }).__game;
    return { hasCanvas: Boolean(canvas), game: g };
  });
  console.log('[probe]', JSON.stringify(info));

  await page.screenshot({ path: path.join(outDir, 'shot-start.png') });
  await play(page);
  await page.screenshot({ path: path.join(outDir, 'shot-mid.png') });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(outDir, 'shot-end.png') });

  const metrics = await page.evaluate(() => (window as unknown as { __game?: unknown }).__game ?? null);
  fs.writeFileSync(
    path.join(outDir, 'metrics.json'),
    JSON.stringify({ game, seconds, metrics, finishedAt: new Date().toISOString() }, null, 2),
  );

  await context.close();
  await browser.close();

  const videos = fs
    .readdirSync(outDir)
    .filter((f) => f.endsWith('.webm'))
    .map((f) => ({ f, m: fs.statSync(path.join(outDir, f)).mtimeMs }))
    .sort((a, b) => b.m - a.m);
  if (videos[0]) fs.renameSync(path.join(outDir, videos[0].f), path.join(outDir, 'playtest.webm'));

  console.log(JSON.stringify({ ok: true, outDir, metrics }, null, 2));
} finally {
  if (vite?.pid) {
    try { process.kill(-vite.pid, 'SIGTERM'); } catch { try { vite.kill('SIGTERM'); } catch { /* */ } }
  }
}
