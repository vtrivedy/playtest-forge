import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
const out = '/workspace/siyu/playtest-forge-artifacts/audio';
await fs.mkdir(out, { recursive: true });
const server = spawn('npx', ['vite', '--config', 'games/fox-spirit/vite.config.ts', '--host', '127.0.0.1', '--port', '5183'], { stdio: 'ignore', detached: true });
let browser;
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch('http://127.0.0.1:5183')).ok) break; } catch {} await new Promise(r => setTimeout(r, 200)); }
  browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:5183', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__gameHooks?.state);
  const before = await page.evaluate(() => window.__gameHooks.state());
  if (before.audio.state !== 'locked') throw Error('Audio unlocked before gesture');
  await page.evaluate(root => { window.__audioRoot = root; }, process.cwd().replace(/^\//, ''));
  const report = [];
  for (const name of ['footstep-leaf', 'footstep-stone', 'land', 'jump', 'dash', 'ember', 'ember-streak', 'shrine', 'bird', 'cricket', 'glide', 'ambience-sepia', 'ambience-restored', 'ambience-crossfade']) {
    const rendered = await page.evaluate(async name => {
      const modulePath = new URL('./src/audio/synthesis.ts', location.origin + '/@fs/' + window.__audioRoot + '/').pathname;
      const { cue, noiseBuffer, ambience, breath } = await import(modulePath);
      const duration = name.startsWith('ambience') ? 14 : name === 'shrine' ? 9 : 3;
      const ctx = new OfflineAudioContext(1, duration * 24000, 24000), master = ctx.createGain(), limiter = ctx.createDynamicsCompressor();
      master.gain.value = 0.55; limiter.threshold.value = -18; limiter.knee.value = 12; limiter.ratio.value = 3;
      limiter.attack.value = 0.008; limiter.release.value = 0.25; master.connect(limiter).connect(ctx.destination);
      const noise = noiseBuffer(ctx, 8);
      if (name.startsWith('ambience')) {
        const p = ambience(ctx, master, noise, false), w = ambience(ctx, master, noise, true);
        if (name === 'ambience-crossfade') {
          p.gain.setValueAtTime(1, 0); p.gain.linearRampToValueAtTime(0, 10);
          w.gain.setValueAtTime(0, 0); w.gain.linearRampToValueAtTime(1, 10);
        } else (name.endsWith('sepia') ? p : w).gain.setValueAtTime(1, 0);
        if (!name.endsWith('sepia')) { cue(ctx, master, noise, 'bird', 7); cue(ctx, master, noise, 'cricket', 11); breath(ctx, master, noise, 4, 1.5, 2100, 0.018, 700, 0.25); }
      } else if (name === 'glide') breath(ctx, master, noise, 0.1, 2.6, 1500, 0.075, 1500, 0.2);
      else cue(ctx, master, noise, name.startsWith('footstep') ? 'footstep' : name.startsWith('ember') ? 'ember' : name, 0.1, { stone: name.endsWith('stone'), streak: name.endsWith('streak') ? 6 : 0 });
      const buffer = await ctx.startRendering(), data = buffer.getChannelData(0);
      let peak = 0, sum = 0; const bytes = new Uint8Array(data.length * 2), view = new DataView(bytes.buffer);
      for (let i = 0; i < data.length; i++) { peak = Math.max(peak, Math.abs(data[i])); sum += data[i] * data[i]; view.setInt16(i * 2, Math.round(Math.max(-1, Math.min(1, data[i])) * 32767), true); }
      let binary = ''; for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      return { base64: btoa(binary), peak, rms: Math.sqrt(sum / data.length), duration };
    }, name);
    const data = Buffer.from(rendered.base64, 'base64'), header = Buffer.alloc(44);
    header.write('RIFF', 0); header.writeUInt32LE(36 + data.length, 4); header.write('WAVEfmt ', 8); header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22); header.writeUInt32LE(24000, 24); header.writeUInt32LE(48000, 28);
    header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34); header.write('data', 36); header.writeUInt32LE(data.length, 40);
    await fs.writeFile(path.join(out, `${name}.wav`), Buffer.concat([header, data]));
    if (rendered.peak >= 0.99 || rendered.rms < 0.0001) throw Error(`Invalid level: ${name}`);
    report.push({ name, peak: rendered.peak, rms: rendered.rms, duration: rendered.duration });
  }
  await page.keyboard.press('KeyW'); await page.waitForTimeout(300);
  const unlocked = await page.evaluate(() => window.__gameHooks.state());
  if (unlocked.audio.state !== 'running') throw Error('Gesture did not unlock audio');
  await page.keyboard.press('KeyM'); await page.waitForTimeout(150);
  const muted = await page.evaluate(() => window.__gameHooks.state());
  if (!muted.audio.muted || muted.audio.masterGain > 0.02) throw Error('M did not silence the graph');
  await page.keyboard.press('KeyM');
  for (const keys of [['KeyW'], ['KeyW', 'Space'], ['KeyW', 'ShiftLeft'], ['Space']]) {
    for (const k of keys) await page.keyboard.down(k);
    await page.waitForTimeout(1200);
    for (const k of keys) await page.keyboard.up(k);
    await page.waitForTimeout(500);
  }
  await page.screenshot({ path: path.join(out, 'audio-traversal.png') });
  const traversal = await page.evaluate(() => ({ game: window.__game, state: window.__gameHooks.state() }));
  await page.evaluate(() => { window.__gameHooks.teleportToShrine(); window.__gameHooks.forceRestore(); });
  await page.waitForTimeout(8000);
  await page.screenshot({ path: path.join(out, 'audio-restoration.png') });
  const restored = await page.evaluate(() => ({ game: window.__game, state: window.__gameHooks.state() }));
  if (errors.length) throw Error(errors.join('\n'));
  await fs.writeFile(path.join(out, 'review.json'), JSON.stringify({ report, before, unlocked, muted, traversal, restored, pageErrors: errors }, null, 2));
  console.log(JSON.stringify({ rendered: report.length, pageErrors: errors, traversal: traversal.state.audio, restored: restored.state.audio }));
} finally { await browser?.close(); try { process.kill(-server.pid, 'SIGTERM'); } catch {} }
