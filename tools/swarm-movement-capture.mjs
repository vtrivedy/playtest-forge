// Matched main/lookdev chase-camera evidence. Claim the capture slot in #swarm first.
// node tools/swarm-movement-capture.mjs --source /path/to/repo --mode main --out /absolute/new/dir
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const arg = (key, fallback) => {
  const i = process.argv.indexOf(`--${key}`);
  return i < 0 ? fallback : process.argv[i + 1];
};
const source = path.resolve(arg('source', '.'));
const mode = arg('mode', 'lookdev');
const out = path.resolve(arg('out', 'playtest-output/fox-spirit/swarm-movement'));
const seconds = Number(arg('seconds', '30'));
const port = Number(arg('port', '5197'));
if (!['main', 'lookdev'].includes(mode) || !(seconds > 0 && seconds <= 30)) throw Error('Use --mode main|lookdev and --seconds in (0,30]');
if (fs.existsSync(out)) throw Error(`Output already exists. Use a fresh attempt directory: ${out}`);
const probeOnly = process.argv.includes('--probe');
const fps = 30;
const count = Math.round(seconds * fps);
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: source, encoding: 'utf8' }).trim();
const dirty = execFileSync('git', ['status', '--porcelain'], { cwd: source, encoding: 'utf8' }).trim();
if (dirty) throw Error(`Capture source must be clean so its SHA is reproducible:\n${dirty}`);
fs.mkdirSync(path.join(out, 'frames'), { recursive: true });
const toolHash = createHash('sha256').update(fs.readFileSync(fileURLToPath(import.meta.url))).digest('hex');
// Gait comes from analog magnitude; run is a trace label, not a key input.
function inputAt(t) {
  if (t < 2 || (t >= 20 && t < 22) || t >= 28) return { x: 0, z: 0, run: false, jump: false, beat: 'idle / settle' };
  const run = t >= 8 && t < 20;
  const magnitude = run ? 0.8 : 0.14;
  const angle = (t - 2) * Math.PI / 3;
  const jump = (t >= 16 && t < 16.12) || (t >= 25 && t < 26);
  return { x: Math.sin(angle) * magnitude, z: -Math.cos(angle) * magnitude, run, jump, beat: jump ? 'jump' : run ? 'run / turn' : 'walk / turn' };
}
const keyFrames = new Set([0, 5, 11, 16.35, 18, 27].map(t => Math.min(count - 1, Math.round(t * fps))));
const errors = [];
const trace = [];
const manifest = { sha, dirty, toolHash, mode, source, seconds: count / fps, fps, resolution: [1280, 720], staging: 'One initial safe-ground placement. Real chase camera. World-space analog input and jump key thereafter. No resets, photo camera, or forced solves.', errors };
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2));
fs.copyFileSync(fileURLToPath(import.meta.url), path.join(out, 'capture-tool.mjs'));
const server = await createServer({ configFile: path.join(source, 'games/fox-spirit/vite.config.ts'), server: { port, host: '127.0.0.1', strictPort: true }, logLevel: 'error' });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  page.setDefaultTimeout(300000);
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`http://127.0.0.1:${port}/${mode === 'main' ? '?fresh=1' : '?lookdev=p0&play=1'}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => !!window.__gameHooks?.advance, null, { timeout: 300000 });
  manifest.start = await page.evaluate(mode => {
    const h = window.__gameHooks;
    h.setManual(true);
    if (mode === 'main') {
      h.autopilot(false);
      h.setKeys([]);
      h.setStick(0, 0);
      const y = h.debug.world.collision.highestAt(0, 56);
      if (!Number.isFinite(y)) throw Error('No safe baseline meadow floor');
      h.teleport(0, y, 56, Math.PI);
    } else {
      h.setPaint('half');
      h.teleport(0.6, 3.2, Math.PI);
    }
    h.advance(30, 1 / 60);
    return h.state();
  }, mode);
  console.log(`Ready ${mode} ${sha.slice(0, 7)}. Recording ${count} frames.`);
  for (let i = 0; i < count; i++) {
    const input = { ...inputAt(i / fps), probeOnly };
    const state = await page.evaluate(input => {
      const h = window.__gameHooks;
      h.setStick(input.x, input.z);
      h.setKeys(input.jump ? ['Space'] : []);
      h.advance(2, 1 / 60, !input.probeOnly);
      return h.state();
    }, input);
    trace.push({ frame: i, time: (i + 1) / fps, input, state });
    if (!probeOnly) await page.screenshot({ path: path.join(out, 'frames', `f${String(i).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 90, timeout: 300000 });
    if (probeOnly && keyFrames.has(i)) await page.evaluate(() => window.__gameHooks.advance(0, 1 / 60, true));
    if (keyFrames.has(i)) await page.screenshot({ path: path.join(out, `still-${String(i).padStart(4, '0')}.png`), timeout: 300000 });
    if (i % 30 === 0) { fs.writeFileSync(path.join(out, 'trace.json'), JSON.stringify(trace)); console.log(`frame ${i}/${count}`); }
  }
  manifest.game = await page.evaluate(() => window.__game);
  const airborne = trace.filter(f => f.state.grounded === false);
  manifest.observed = {
    start: trace[0]?.state.pos,
    end: trace.at(-1)?.state.pos,
    deaths: trace.at(-1)?.state.deaths ?? null,
    airborneFrames: airborne.length,
    maxHorizontalSpeed: Math.max(...trace.map(f => Math.hypot(f.state.vel?.[0] ?? 0, f.state.vel?.[2] ?? 0))),
    positionBounds: [0, 1, 2].map(axis => ({ min: Math.min(...trace.map(f => f.state.pos[axis])), max: Math.max(...trace.map(f => f.state.pos[axis])) })),
    note: 'Recorded controller telemetry. Contact or subjective feel approval requires a separate visual review.',
  };
  fs.writeFileSync(path.join(out, 'trace.json'), JSON.stringify(trace));
  if (errors.length) throw Error(`${errors.length} browser errors. See manifest.`);
  if (probeOnly) {
    manifest.complete = true;
    console.log(`Probe complete ${out}/trace.json`);
  } else {
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-framerate', String(fps), '-i', path.join(out, 'frames/f%04d.jpg'), '-c:v', 'libx264', '-preset', 'fast', '-crf', '20', '-pix_fmt', 'yuv420p', path.join(out, 'movement.mp4')]);
    const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=width,height,r_frame_rate,nb_frames', '-of', 'json', path.join(out, 'movement.mp4')], { encoding: 'utf8' }));
    manifest.probe = probe;
    if (Math.abs(Number(probe.format.duration) - count / fps) > 1 / fps) throw Error('Encoded duration differs from simulation');
    manifest.complete = true;
    console.log(`Complete ${out}/movement.mp4 (${probe.format.duration}s)`);
  }
} catch (e) {
  manifest.failure = String(e);
  throw e;
} finally {
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2));
  if (browser) await browser.close();
  await server.close();
}
