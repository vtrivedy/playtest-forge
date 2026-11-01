/**
 * FX lookdev capture for fox-spirit.
 *
 * Legacy (wall-clock, autopilot route + restore):
 *   npx tsx tools/fx-capture.ts --port 5187 --out playtest-output/fox-spirit/fx
 *
 * VFX lookdev loop (fixed-step contact sheet) — see .claude/skills/vfx-lookdev-loop:
 *   npx tsx tools/fx-capture.ts --effect hearth-updraft --out playtest-forge-artifacts/sprint2/fx/hearth-updraft/r1
 *
 * Requires chem/updraft on the branch (s2-design → main). Uses setManual + advance.
 */
import { chromium } from 'playwright';
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}
const port = Number(arg('port', '5187'));
const effect = arg('effect');
const outDir = path.resolve(root, arg('out', effect ? `playtest-forge-artifacts/sprint2/fx/${effect}/r0` : 'playtest-output/fox-spirit/fx')!);
fs.mkdirSync(outDir, { recursive: true });
const url = `http://127.0.0.1:${port}/?world=russetvale&q=high&seed=1`;

type Hooks = Record<string, (...a: unknown[]) => unknown>;

let vite: ChildProcess | undefined;
try {
  vite = spawn('npx', ['vite', '--config', 'games/fox-spirit/vite.config.ts', '--host', '127.0.0.1', '--port', String(port)], {
    cwd: root,
    stdio: 'ignore',
    detached: true,
  });
  for (let t = Date.now(); Date.now() - t < 60_000; ) {
    try {
      await fetch(`http://127.0.0.1:${port}/`);
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
  await page.goto(url, { waitUntil: 'load', timeout: 90_000 });
  await page.waitForFunction(() => Boolean((window as unknown as { __gameHooks?: unknown }).__gameHooks), null, { timeout: 90_000 });
  await page.waitForTimeout(1200);

  const H = (name: string, ...args: unknown[]) =>
    page.evaluate(({ name, args }) => (window as unknown as { __gameHooks: Hooks }).__gameHooks[name]!(...args), { name, args });
  const advance = (n: number, render = true) =>
    page.evaluate(({ n, render }) => {
      const h = (window as unknown as { __gameHooks: Hooks }).__gameHooks;
      h.setManual?.(true);
      return h.advance?.(n, 1 / 60, render);
    }, { n, render });
  const shot = (name: string) => page.screenshot({ path: path.join(outDir, `${name}.png`), timeout: 120_000 });

  if (effect === 'hearth-updraft') {
    // Lifecycle: cold → ignite → hold → gutter frames. Needs chem on the branch.
    await H('setManual', true);
    const st0 = (await H('state')) as { chem?: { hearths?: Array<{ id: string; pos: number[]; heat: number; state: string }> } };
    const ha = st0.chem?.hearths?.find((h) => h.id === 'H-a') ?? st0.chem?.hearths?.[0];
    if (!ha) {
      const msg = 'hearth-updraft: no chem.hearths (land s2-design chem first).';
      fs.writeFileSync(path.join(outDir, 'check.json'), JSON.stringify({ ok: false, error: msg }, null, 2));
      console.error(msg);
      await browser.close();
      process.exitCode = 2;
    } else {
      const [hx, hy, hz] = ha.pos;
      const lens: [[number, number, number], [number, number, number], number] = [
        [hx - 6, hy + 8, hz + 11],
        [hx + 2, hy + 3, hz - 1],
        50,
      ];
      const frames: Array<{ name: string; heat: number; state: string }> = [];
      const capture = async (name: string) => {
        const st = (await H('state')) as { chem: { hearths: Array<{ id: string; heat: number; state: string }> } };
        const h = st.chem.hearths.find((x) => x.id === ha.id)!;
        frames.push({ name, heat: h.heat, state: h.state });
        await shot(name);
      };

      await H('teleport', hx - 12, hy, hz + 16, Math.PI);
      await H('photo', ...lens);
      await advance(45);
      await capture('00-cold');

      // stand in the probe ring to supply colour → ignite
      await H('teleport', hx - 1.4, hy, hz + 0.4, Math.PI);
      await H('photo', ...lens);
      let litFrames = 0;
      for (const [i, n] of [15, 30, 45, 90, 180].entries()) {
        await advance(n - litFrames);
        litFrames = n;
        await capture(`${String(i + 1).padStart(2, '0')}-lit-${n}f`);
      }
      // walk away, wait hold → gutter → cold (hold ~3 s + gutter ~0.8 s)
      await H('teleport', hx - 14, hy, hz + 18, Math.PI);
      await H('photo', ...lens);
      for (const [i, n] of [60, 120, 180, 240, 300, 360, 420].entries()) {
        await advance(60);
        await capture(`${String(i + 6).padStart(2, '0')}-decay-${n}f`);
      }

      // crude contact strip
      const { spawnSync } = await import('node:child_process');
      const list = frames.map((f) => path.join(outDir, `${f.name}.png`)).filter((p) => fs.existsSync(p));
      if (list.length) {
        spawnSync(
          'python3',
          [
            '-c',
            `
from PIL import Image, ImageDraw
from pathlib import Path
paths = ${JSON.stringify(list)}
ims = [Image.open(p).convert('RGB') for p in paths]
for im in ims: im.thumbnail((320, 180))
cols = min(5, len(ims)); rows = (len(ims) + cols - 1) // cols
sheet = Image.new('RGB', (cols*320, rows*200), (16,14,12))
d = ImageDraw.Draw(sheet)
for i, im in enumerate(ims):
  r, c = divmod(i, cols)
  sheet.paste(im, (c*320, r*200+22))
  d.text((c*320+6, r*200+4), Path(paths[i]).stem, fill=(240,200,140))
sheet.save(${JSON.stringify(path.join(outDir, 'contact.png'))})
print('contact', len(ims))
`,
          ],
          { encoding: 'utf8' },
        );
      }
      const check = {
        ok: true,
        effect: 'hearth-updraft',
        frames,
        note: 'SwiftShader smoke only — judge glow on Modal GPU / q=high with real GPU',
      };
      fs.writeFileSync(path.join(outDir, 'check.json'), JSON.stringify(check, null, 2));
      fs.writeFileSync(path.join(outDir, 'game.json'), JSON.stringify(await page.evaluate(() => (window as unknown as { __game?: unknown }).__game), null, 2));
      console.log(JSON.stringify(check));
    }
  } else if (effect) {
    // Generic: prefer stageFx when present
    const has = await page.evaluate(
      (id) => typeof (window as unknown as { __gameHooks: Hooks }).__gameHooks.stageFx === 'function',
      effect,
    );
    if (!has) {
      const msg = `--effect ${effect}: no __gameHooks.stageFx yet; implement stageFx or use hearth-updraft.`;
      fs.writeFileSync(path.join(outDir, 'check.json'), JSON.stringify({ ok: false, error: msg }, null, 2));
      console.error(msg);
      process.exitCode = 2;
    } else {
      await H('setManual', true);
      await H('stageFx', effect, { seed: 1 });
      const times = [0, 0.15, 0.35, 0.6, 1.0, 1.5, 2.2, 3.0];
      let advanced = 0;
      for (let i = 0; i < times.length; i++) {
        const target = Math.round(times[i]! * 60);
        await advance(Math.max(0, target - advanced));
        advanced = target;
        await shot(`${String(i).padStart(2, '0')}-t${times[i]}`);
      }
      fs.writeFileSync(path.join(outDir, 'check.json'), JSON.stringify({ ok: true, effect, times }, null, 2));
    }
  } else {
    // Legacy path (kept for existing callers)
    await shot('01-start-pickups');
    await page.evaluate('window.__gameHooks.autopilot(true)');
    await page.waitForTimeout(2500);
    await shot('02-run-leaves');
    await page.waitForTimeout(2500);
    await shot('03-collect');
    await page.waitForTimeout(2500);
    await shot('04-after-collect');
    await page.evaluate('window.__gameHooks.autopilot(false)');
    await page.evaluate('window.__gameHooks.teleport(0, 38.2, -81.5)');
    await page.waitForTimeout(900);
    await shot('05-shrine-before');
    await page.evaluate('window.__gameHooks.photo([7, 43, -73], [0, 40.5, -89], 50)');
    await page.waitForTimeout(600);
    await shot('05b-shrine-photo-before');
    await page.evaluate(() => (window as unknown as { __gameHooks: { forceRestore: () => void } }).__gameHooks.forceRestore());
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
  }

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
