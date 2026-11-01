/**
 * Wellspring restore money shot — deterministic capture of the real event.
 *
 *   npx tsx tools/money-shot.ts [--q high] [--w 1280 --h 720] [--seed 7] [--fps 30] [--hud]
 *                               [--out ../playtest-forge-artifacts/money-shot/latest]
 *
 * Fixed RNG seed (Math.random is replaced before the game boots) + the game's manual sim clock:
 * every frame is exactly 1/fps of simulation, independent of how slow the (software) GPU is.
 * Sequence: reset restoration → fox 7.5 m out on the approach (outside the 5.2 m trigger) →
 * assert restored=false → hold W so the fox walks into the live trigger → one real ignition.
 * Writes every frame (frames/), the four checkpoint PNGs + __game/state JSON, states.jsonl,
 * meta.json and money-shot.mp4 (ffmpeg, H.264, fps).
 */
import { chromium } from 'playwright';
import { spawnSync } from 'node:child_process';
import { createServer, type ViteDevServer } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}
const flag = (name: string) => process.argv.includes(`--${name}`);
const port = Number(arg('port', '5293'));
const quality = arg('q', 'high');
const W = Number(arg('w', '1280'));
const H = Number(arg('h', '720'));
const seed = Number(arg('seed', '7'));
const fps = Number(arg('fps', '30'));
/** Sim substeps per video frame (physics at fps × substeps Hz) */
const sub = Number(arg('sub', '2'));
const seconds = Number(arg('seconds', '6'));
/** Sequence age at the first video frame: after the 0.35 s blend-in, once the fox's walk-in trail has faded */
const startAge = Number(arg('start', '0.4'));
const showHud = flag('hud');
/** Fast iteration: simulate every frame but only render + save the checkpoint stills (no MP4) */
const stillsOnly = flag('stills');
const outDir = path.resolve(root, arg('out', '../playtest-forge-artifacts/money-shot/latest'));
const framesDir = path.join(outDir, 'frames');
fs.rmSync(framesDir, { recursive: true, force: true });
fs.mkdirSync(framesDir, { recursive: true });
const url = `http://127.0.0.1:${port}/?world=russetvale&q=${quality}`;

/** Checkpoints by sequence age (s since the fox entered the trigger); ignition is at 1.0 s */
const CHECKPOINTS: Array<[string, number]> = [
  ['01-sepia', 0.6],
  ['02-ignition', 1.2],
  ['03-mid-front', 3.1],
  ['04-pullback', 4.4],
  ['05-settled', 6.0],
];

type State = {
  restored: boolean;
  t: number;
  pos: [number, number, number];
  gait: string;
  restore: { phase: string; age: number; floodAge: number; frontRadius: number; inputLocked: boolean; path: { t: number; w: number; yielding: boolean } | null };
  camera: { pos: number[]; fov: number; foxNdc: [number, number]; yaw: number };
  look: { grade: number; quality: string };
};

let vite: ViteDevServer | undefined;
try {
  // in-process server, no HMR / file watching: edits landing mid-capture must not reload the page
  vite = await createServer({ configFile: path.join(root, 'games/fox-spirit/vite.config.ts'), server: { port, host: '127.0.0.1', strictPort: true, hmr: false, watch: null }, logLevel: 'error' });
  await vite.listen();
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
  });
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  page.on('crash', () => console.error('[crash] page crashed'));
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  page.on('console', (m) => m.type() === 'error' && console.error('[console.error]', m.text()));
  // seeded RNG before any game module runs (mulberry32)
  await page.addInitScript(`(() => {
    let a = ${seed} >>> 0;
    Math.random = () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  })()`);
  await page.goto(url, { waitUntil: 'load', timeout: 90_000 });
  await page.waitForFunction('Boolean(window.__gameHooks)', null, { timeout: 120_000 });
  await page.evaluate('window.__gameHooks.setManual(true)');
  if (!showHud) {
    await page.addStyleTag({ content: '#title-card,#ember-count,#prompt,#restore-flash,#debug-panel{display:none!important}' });
  }
  const H_ = 'window.__gameHooks';
  const state = () => page.evaluate(`${H_}.state()`) as Promise<State>;
  const advance = (frames: number, dt: number, render = true) =>
    page.evaluate(`${H_}.advance(${frames}, ${dt}, ${render})`) as Promise<State>;

  // ---- clean sepia start: restoration reset, fox outside the trigger on the stair approach
  const reset = await page.evaluate(`${H_}.resetRestore()`);
  // last summit waypoint of the stair route (the real approach), 7.4 m from the basin, facing it
  await page.evaluate(`${H_}.teleport(-5, 38, -83.5, Math.atan2(5, -5.5))`);
  await advance(60, 1 / 60, false);
  let s = await state();
  const dist0 = Math.hypot(s.pos[0] - 0, s.pos[2] + 89);
  if (s.restored || s.restore.phase !== 'idle' || dist0 <= 5.2) throw new Error(`not a clean start: ${JSON.stringify({ reset, restored: s.restored, phase: s.restore.phase, dist0 })}`);
  console.log(`clean start: restored=${s.restored} dist=${dist0.toFixed(2)} m (trigger 5.2 m)`);

  // ---- walk into the live trigger (real input, real event)
  await page.evaluate(`${H_}.setKeys(['KeyW'])`);
  let walkFrames = 0;
  for (; walkFrames < 600; walkFrames++) {
    s = await advance(1, 1 / 60, false);
    if (s.restore.phase !== 'idle') break;
  }
  await page.evaluate(`${H_}.setKeys([])`);
  if (s.restore.phase === 'idle') throw new Error(`fox never reached the Wellspring trigger: ${JSON.stringify({ pos: s.pos, gait: s.gait, restored: s.restored })}`);
  if (s.restored) throw new Error('restored=true at trigger time — ignition must come later');
  console.log(`trigger after ${(walkFrames / 60).toFixed(2)} s walk at pos ${s.pos.map((v) => v.toFixed(2)).join(',')}`);

  // ---- run (unrecorded) through the blend-in, then the sequence at fixed sim time per frame
  while (s.restore.age < startAge - 1e-6) s = await advance(1, 1 / 60, true);
  // ---- the sequence: fixed sim time per frame
  const total = Math.round(seconds * fps);
  const states: string[] = [];
  const checkpoints: Record<string, unknown> = {};
  let next = 0;
  const t0 = Date.now();
  for (let f = 0; f < total; f++) {
    s = f === 0 ? await advance(0, 1 / 60, !stillsOnly) : await advance(sub, 1 / (fps * sub), !stillsOnly);
    const file = path.join(framesDir, `${String(f).padStart(5, '0')}.png`);
    const due = next < CHECKPOINTS.length && s.restore.age >= CHECKPOINTS[next]![1] - 1e-6;
    if (stillsOnly && due) s = await advance(0, 1 / 60, true);
    if (!stillsOnly || due) await page.screenshot({ path: file, timeout: 120_000 });
    const row = {
      f,
      age: Number(s.restore.age.toFixed(4)),
      floodAge: Number(s.restore.floodAge.toFixed(4)),
      front: Number(s.restore.frontRadius.toFixed(2)),
      restored: s.restored,
      locked: s.restore.inputLocked,
      path: s.restore.path,
      grade: Number(s.look.grade.toFixed(3)),
      fox: s.pos.map((v) => Number(v.toFixed(3))),
      gait: s.gait,
      cam: s.camera.pos.map((v) => Number(v.toFixed(3))),
      fov: Number(s.camera.fov.toFixed(2)),
    };
    states.push(JSON.stringify(row));
    while (next < CHECKPOINTS.length && s.restore.age >= CHECKPOINTS[next]![1] - 1e-6) {
      const [name] = CHECKPOINTS[next]!;
      fs.copyFileSync(file, path.join(outDir, `${name}.png`));
      const game = await page.evaluate('window.__game');
      checkpoints[name] = { frame: f, state: row, game };
      fs.writeFileSync(path.join(outDir, `${name}.json`), JSON.stringify({ seed, quality, simAge: s.restore.age, state: s, game }, null, 2));
      console.log(`${name}: f=${f} age=${s.restore.age.toFixed(3)} flood=${s.restore.floodAge.toFixed(3)} front=${s.restore.frontRadius.toFixed(1)} restored=${s.restored}`);
      next++;
    }
    if (f % 30 === 0) console.log(`frame ${f}/${total} (${((Date.now() - t0) / 1000 / (f + 1)).toFixed(2)} s/frame)`);
  }
  fs.writeFileSync(path.join(outDir, 'states.jsonl'), states.join('\n') + '\n');

  // ---- hand-back: the camera must yield to play and keep the movement heading
  await page.evaluate(`${H_}.setKeys(['KeyW'])`);
  for (let i = 0; i < 20; i++) s = await advance(3, 1 / 60, false);
  await page.evaluate(`${H_}.setKeys([])`);
  s = await advance(1, 1 / 60, true);
  await page.screenshot({ path: path.join(outDir, '06-return.png'), timeout: 120_000 });
  const returnCheck = { path: s.restore.path, foxNdc: s.camera.foxNdc, yaw: s.camera.yaw, pos: s.pos };
  console.log('return:', JSON.stringify(returnCheck));

  fs.writeFileSync(
    path.join(outDir, 'meta.json'),
    JSON.stringify({ seed, quality, viewport: [W, H], fps, substeps: sub, frames: total, walkInS: walkFrames / 60, checkpoints: Object.fromEntries(Object.entries(checkpoints).map(([k, v]) => [k, (v as { state: unknown }).state])), returnCheck }, null, 2),
  );
  await browser.close();
  const mp4 = path.join(outDir, 'money-shot.mp4');
  const ff = stillsOnly ? { status: 0 } : spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', path.join(framesDir, '%05d.png'), '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4], { stdio: 'inherit' });
  if (ff.status !== 0) throw new Error('ffmpeg failed');
  if (!stillsOnly) console.log(`wrote ${mp4}`);
} finally {
  await vite?.close();
}
