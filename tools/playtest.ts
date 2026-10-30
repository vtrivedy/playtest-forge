/**
 * Headless playtest harness — Chromium + SwiftShader WebGL.
 * Drives keyboard, screenshots, webm, reads window.__game.
 *
 *   npx tsx tools/playtest.ts --game fox-spirit --seconds 30
 *   npx tsx tools/playtest.ts --game fox-spirit --script shrine --port 5180
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
const scriptName = arg('script', game.includes('fox') ? 'shrine' : 'wander')!;
fs.mkdirSync(outDir, { recursive: true });

type Step = { down: string[]; ms: number; tap?: boolean };

const SCRIPTS: Record<string, Step[]> = {
  shrine: [
    { down: ['KeyW'], ms: 700 },
    { down: ['KeyW', 'Space'], ms: 90, tap: true },
    { down: ['KeyW'], ms: 500 },
    { down: ['KeyW', 'ShiftLeft'], ms: 70, tap: true },
    { down: ['KeyW'], ms: 800 },
    { down: ['KeyW', 'Space'], ms: 120, tap: true },
    { down: ['KeyW'], ms: 700 },
    { down: ['KeyW', 'ShiftLeft'], ms: 70, tap: true },
    { down: ['KeyW'], ms: 900 },
    { down: ['KeyW', 'Space'], ms: 900 }, // glide
    { down: ['KeyW'], ms: 1100 },
    { down: ['KeyW', 'Space'], ms: 100, tap: true },
    { down: ['KeyW'], ms: 1200 },
  ],
  wander: [
    { down: ['KeyW'], ms: 600 },
    { down: ['Space'], ms: 80, tap: true },
    { down: ['KeyW', 'Space'], ms: 700 },
    { down: ['KeyD'], ms: 400 },
    { down: ['ShiftLeft'], ms: 50, tap: true },
    { down: ['KeyW', 'KeyA'], ms: 500 },
    { down: ['Space'], ms: 80, tap: true },
    { down: ['KeyW', 'Space'], ms: 800 },
    { down: ['KeyA'], ms: 450 },
    { down: ['KeyS', 'KeyD'], ms: 400 },
    { down: ['Space'], ms: 80, tap: true },
    { down: ['ShiftLeft'], ms: 50, tap: true },
    { down: ['KeyW'], ms: 500 },
  ],
  'feel-probe': [
    // Stand still, short tap jump
    { down: ['Space'], ms: 60, tap: true },
    { down: [], ms: 1100 },
    // Full hold jump (no glide cut — release after apex)
    { down: ['Space'], ms: 450 },
    { down: [], ms: 1100 },
    // Full hold + glide
    { down: ['Space'], ms: 1400 },
    { down: [], ms: 500 },
    // Run + dash
    { down: ['KeyW'], ms: 400 },
    { down: ['KeyW', 'ShiftLeft'], ms: 60, tap: true },
    { down: ['KeyW'], ms: 500 },
  ],
};

async function waitForServer(url: string, timeoutMs = 45_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 404) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Server did not come up at ${url}`);
}

async function play(page: import('playwright').Page): Promise<void> {
  const sequence = SCRIPTS[scriptName] ?? SCRIPTS.wander!;
  const end = Date.now() + seconds * 1000;
  let i = 0;
  const samples: unknown[] = [];
  while (Date.now() < end) {
    const step = sequence[i % sequence.length]!;
    for (const k of step.down) await page.keyboard.down(k);
    await page.waitForTimeout(step.ms);
    for (const k of step.down) await page.keyboard.up(k);
    if (step.tap) await page.waitForTimeout(40);
    i += 1;
    const state = await page.evaluate(
      () => (window as unknown as { __game?: { status: string; feel?: unknown } }).__game,
    );
    if (state?.feel) samples.push({ t: Date.now(), ...state.feel, status: state.status });
    if (state && (state.status === 'won' || state.status === 'lost')) break;
  }
  fs.writeFileSync(path.join(outDir, 'feel-samples.json'), JSON.stringify(samples, null, 2));
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

  await page.goto(baseUrl, { waitUntil: 'load', timeout: 60_000 });
  await page.waitForTimeout(800);

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
    JSON.stringify(
      { game, script: scriptName, seconds, metrics, finishedAt: new Date().toISOString() },
      null,
      2,
    ),
  );

  await context.close();
  await browser.close();

  const videos = fs
    .readdirSync(outDir)
    .filter((f) => f.endsWith('.webm'))
    .map((f) => ({ f, m: fs.statSync(path.join(outDir, f)).mtimeMs }))
    .sort((a, b) => b.m - a.m);
  if (videos[0]) fs.renameSync(path.join(outDir, videos[0].f), path.join(outDir, 'playtest.webm'));

  console.log(JSON.stringify({ ok: true, outDir, script: scriptName, metrics }, null, 2));
} finally {
  if (vite?.pid) {
    try {
      process.kill(-vite.pid, 'SIGTERM');
    } catch {
      try {
        vite.kill('SIGTERM');
      } catch {
        /* */
      }
    }
  }
}
