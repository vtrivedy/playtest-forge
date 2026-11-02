import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const out = path.resolve(process.env.OUT || '/captures/rook/audio-live');
const url = process.env.URL || 'http://127.0.0.1:5180/';
const seconds = Number(process.env.SECONDS || 45);
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, args: [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist',
] });
try {
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    const connect = AudioNode.prototype.connect;
    const contexts = new Map();
    let capture;
    const ensure = () => {
      if (capture) return capture;
      const ctx = new AudioContext();
      const output = ctx.createMediaStreamDestination();
      const analyser = ctx.createAnalyser(); analyser.fftSize = 2048;
      connect.call(analyser, output);
      capture = { ctx, output, analyser, samples: [], contexts };
      return capture;
    };
    AudioNode.prototype.connect = function (...args) {
      const result = connect.apply(this, args);
      if (args[0] === this.context.destination) {
        const c = ensure();
        if (this.context !== c.ctx) {
          let entry = contexts.get(this.context);
          if (!entry) {
            const tap = this.context.createMediaStreamDestination();
            const bridge = c.ctx.createMediaStreamSource(tap.stream);
            connect.call(bridge, c.analyser);
            entry = { tap, nodes: new WeakSet() }; contexts.set(this.context, entry);
          }
          if (!entry.nodes.has(this)) {
            connect.call(this, entry.tap, args[1] || 0); entry.nodes.add(this);
          }
        }
      }
      return result;
    };
    window.__audioCaptureStart = async () => {
      const c = ensure(); await c.ctx.resume();
      const canvas = document.querySelector('canvas');
      const video = canvas.captureStream(15);
      const stream = new MediaStream([...video.getVideoTracks(), ...c.output.stream.getAudioTracks()]);
      const mimeType = ['video/webm;codecs=vp8,opus', 'video/webm'].find(MediaRecorder.isTypeSupported);
      c.recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 1800000 });
      c.chunks = []; c.recorder.ondataavailable = e => { if (e.data.size) c.chunks.push(e.data); };
      c.started = performance.now();
      const data = new Float32Array(c.analyser.fftSize);
      c.timer = setInterval(() => {
        c.analyser.getFloatTimeDomainData(data);
        let peak = 0, sum = 0;
        for (const v of data) { peak = Math.max(peak, Math.abs(v)); sum += v * v; }
        c.samples.push({ seconds: (performance.now() - c.started) / 1000, peak, rms: Math.sqrt(sum / data.length) });
      }, 25);
      c.recorder.start(1000);
    };
    window.__audioCaptureStop = async () => {
      const c = capture; clearInterval(c.timer);
      await new Promise(resolve => { c.recorder.onstop = resolve; c.recorder.stop(); });
      const blob = new Blob(c.chunks, { type: c.recorder.mimeType });
      const data = new Uint8Array(await blob.arrayBuffer());
      let binary = ''; for (let i = 0; i < data.length; i += 8192) binary += String.fromCharCode(...data.subarray(i, i + 8192));
      return { base64: btoa(binary), mimeType: c.recorder.mimeType, samples: c.samples,
        contexts: [...c.contexts.keys()].map(ctx => ({ state: ctx.state, sampleRate: ctx.sampleRate })) };
    };
  });
  await page.goto(url, { waitUntil: 'networkidle', timeout: 180000 });
  await page.waitForFunction(() => window.__gameHooks?.ready, null, { timeout: 180000 });
  const state = () => page.evaluate(() => typeof window.__game?.state === 'function' ? window.__game.state() : window.__game);
  const before = await state();
  // Trusted first input unlocks the game's graph; capture starts immediately after it.
  await page.keyboard.press('KeyW');
  await page.evaluate(() => { window.__gameHooks.setManual(true); window.__gameHooks.advance(0, 1 / 60, true); });
  await page.screenshot({ path: path.join(out, 'start.png'), timeout: 180000 });
  await page.evaluate(() => { window.__gameHooks.setManual(false); return window.__audioCaptureStart(); });
  const events = [];
  const start = Date.now();
  const act = async (keys, ms) => {
    events.push({ seconds: (Date.now() - start) / 1000, keys, durationMs: ms });
    for (const key of keys) await page.keyboard.down(key);
    await page.waitForTimeout(ms);
    for (const key of keys) await page.keyboard.up(key);
  };
  await act(['KeyW'], 1500);
  await act(['KeyW', 'Space'], 1800);
  await act([], 1200);
  await act(['KeyW', 'ShiftLeft'], 700);
  await act([], Math.max(1000, seconds * 1000 - (Date.now() - start)));
  const after = await state();
  const recording = await page.evaluate(() => window.__audioCaptureStop());
  await page.evaluate(() => { window.__gameHooks.setManual(true); window.__gameHooks.advance(0, 1 / 60, true); });
  await page.screenshot({ path: path.join(out, 'end.png'), timeout: 180000 });
  await fs.writeFile(path.join(out, 'live.webm'), Buffer.from(recording.base64, 'base64'));
  delete recording.base64;
  const peak = Math.max(0, ...recording.samples.map(s => s.peak));
  const silentSamples = recording.samples.filter(s => s.rms < 0.00001).length;
  const report = { label: 'Real-time scripted keyboard audio/video capture; no full-route or subjective listening claim',
    url, before, after, events, errors, peak, silentSamples, ...recording };
  await fs.writeFile(path.join(out, 'evidence.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ out, peak, silentSamples, samples: recording.samples.length, contexts: recording.contexts, errors }));
  if (!recording.contexts.length || peak < 0.0000001) throw new Error('Captured mix is silent; evidence retained for diagnosis');
  if (errors.length) throw new Error('Page errors detected; inspect evidence.json');
} finally { await browser.close(); }
