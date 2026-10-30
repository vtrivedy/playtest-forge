/**
 * In-engine fox turntable capture — orbits the hero, saves frames + strip.
 *
 *   npx tsx tools/fox-turntable.ts
 *   npx tsx tools/fox-turntable.ts --anim run --fx 0
 */
import { chromium } from 'playwright';
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const port = Number(process.env.PORT || 5180);
const anim = process.argv.includes('--anim')
  ? process.argv[process.argv.indexOf('--anim') + 1]
  : 'idle';
const fxOn = !process.argv.includes('--fx') || process.argv[process.argv.indexOf('--fx') + 1] !== '0';
const outDir = path.resolve(
  process.argv.includes('--out')
    ? process.argv[process.argv.indexOf('--out') + 1]
    : path.join(root, 'playtest-output', 'fox-spirit', 'turntable'),
);
fs.mkdirSync(outDir, { recursive: true });

function startVite(): ChildProcess {
  const child = spawn(
    'npx',
    ['vite', '--config', 'games/fox-spirit/vite.config.ts', '--port', String(port), '--strictPort'],
    { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  return child;
}

async function waitReady(url: string, ms = 60_000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error('vite not ready');
}

async function main() {
  const vite = startVite();
  const url = `http://127.0.0.1:${port}/`;
  try {
    await waitReady(url);
    const browser = await chromium.launch({
      headless: true,
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
    });
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.goto(url, { waitUntil: 'load', timeout: 60_000 });
    await page.waitForTimeout(1200);

    const info = await page.evaluate(
      ({ anim, fxOn }) => {
        const h = (window as unknown as {
          __gameHooks?: {
            runTurntable?: (o: { anim: string; fx: boolean }) => void;
            hasClips?: boolean;
            getAnim?: () => string;
            setFxEnabled?: (on: boolean) => void;
          };
        }).__gameHooks;
        h?.runTurntable?.({ anim, fx: fxOn });
        return { hasClips: h?.hasClips ?? false, anim: h?.getAnim?.() ?? '?', hasHook: Boolean(h?.runTurntable) };
      },
      { anim, fxOn },
    );
    console.log('[turntable]', info);

    // Capture 8 yaw angles (~orbit period ~11s at 0.55 rad/s; sample every ~1.4s)
    const angles = [0, 45, 90, 135, 180, 225, 270, 315];
    for (let i = 0; i < angles.length; i++) {
      await page.waitForTimeout(i === 0 ? 400 : 1400);
      const file = path.join(outDir, `yaw-${String(angles[i]).padStart(3, '0')}.png`);
      await page.screenshot({ path: file });
      console.log('wrote', file);
    }

    // Also force run pose strip
    await page.evaluate(() => {
      const h = (window as unknown as { __gameHooks?: { runTurntable?: (o: { anim: string; fx: boolean }) => void } })
        .__gameHooks;
      h?.runTurntable?.({ anim: 'run', fx: false });
    });
    await page.waitForTimeout(500);
    for (let i = 0; i < 4; i++) {
      await page.waitForTimeout(200);
      await page.screenshot({ path: path.join(outDir, `run-frame-${i}.png`) });
    }

    // Side-by-side note file
    fs.writeFileSync(
      path.join(outDir, 'README.md'),
      `# Fox in-engine turntable\n\nanim=${anim} fx=${fxOn}\nhasClips=${info.hasClips} playing=${info.anim}\n\nCompare to assets/concept/fox-turnaround.jpg\n`,
    );

    await browser.close();
    console.log('turntable done →', outDir);
  } finally {
    try { vite.kill('SIGKILL'); } catch { /* */ }
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
