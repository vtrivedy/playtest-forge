/** Modal-only hardware GL capture; see tools/modal/gpu_capture.py for entrypoint. */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
const arg = (k, d) => process.argv.includes(`--${k}`) ? process.argv[process.argv.indexOf(`--${k}`) + 1] : d;
const repo = arg('repo', process.cwd()), out = arg('out', '/tmp/gpu-capture');
const selected = arg('shots', 'all');
const backend = arg('backend', 'egl'), quality = arg('quality', 'high'), fps = Number(arg('fps', '60'));
const [width, height] = arg('size', '1920x1080').split('x').map(Number);
if (![30, 60].includes(fps) || ![width, height].every(n => Number.isInteger(n) && n > 0)) throw Error('Invalid size/fps');
if (!['vulkan', 'egl', 'gl', 'swiftshader'].includes(backend)) throw Error('Unknown backend');
const wants = k => selected === 'all' || selected.split(',').includes(k);
fs.mkdirSync(out, { recursive: true });
const save = (name, data) => fs.writeFileSync(path.join(out, name), JSON.stringify(data, null, 2));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml', '.wasm': 'application/wasm' };
const server = http.createServer((req, res) => {
  if (req.url === '/gpu-cube.html') {
    res.setHeader('Content-Type', 'text/html');
    res.end(`<html><body style="margin:0"><script type="module">
      import * as THREE from '/gpu-three.js';
      const renderer = new THREE.WebGLRenderer(); renderer.setSize(${width}, ${height}); document.body.append(renderer.domElement);
      const scene = new THREE.Scene(); scene.background = new THREE.Color(0x173247);
      const camera = new THREE.PerspectiveCamera(50, ${width}/${height}, .1, 100); camera.position.z = 4;
      const cube = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshNormalMaterial()); scene.add(cube);
      window.cubeProbe = () => { cube.rotation.x += .1; cube.rotation.y += .1; renderer.render(scene,camera);
        const gl = renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
        return {lost: gl.isContextLost(), renderer: ext && gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)}; };
      window.cubeProbe();
    </script></body></html>`); return;
  }
  if (req.url === '/gpu-three.js' || req.url === '/three.core.js') {
    res.setHeader('Content-Type', 'text/javascript');
    fs.createReadStream(path.join(repo, 'node_modules/three/build', req.url === '/gpu-three.js' ? 'three.module.js' : 'three.core.js')).pipe(res); return;
  }
  if (req.url === '/favicon.ico') { res.writeHead(204).end(); return; }
  const url = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const builtFile = path.resolve(repo, 'dist/fox-spirit', `.${url}`);
  const base = url.startsWith('/assets/') && !fs.existsSync(builtFile) ? repo : path.join(repo, 'dist/fox-spirit');
  const file = path.resolve(base, `.${url === '/' ? '/index.html' : url}`);
  if (!file.startsWith(`${path.resolve(base)}/`)) { res.writeHead(403).end(); return; }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404).end(); return; }
  res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});
server.listen(5180, '127.0.0.1');
await once(server, 'listening');
const errors = [], log = [], report = { viewport: [width, height], fps, backend, quality, seed: 42, perf: {}, shots: {}, videos: {}, failures: [] };
let browser;
try {
  const headed = backend === 'gl';
  let xvfb;
  if (headed) { xvfb = spawn('Xvfb', [':99', '-screen', '0', `${width}x${height}x24`, '-ac']); process.env.DISPLAY = ':99'; await new Promise(r => setTimeout(r, 1000)); }
  const backendArgs = backend === 'vulkan' ? ['--use-gl=angle', '--use-angle=vulkan', '--enable-features=Vulkan', '--disable-vulkan-surface']
    : backend === 'egl' ? ['--use-gl=angle', '--use-angle=gl-egl']
    : backend === 'gl' ? ['--use-gl=angle', '--use-angle=gl']
    : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
  browser = await chromium.launch({ headless: !headed, channel: 'chromium',
    ignoreDefaultArgs: ['--enable-unsafe-swiftshader'], args: [
    '--no-sandbox', '--disable-gpu-sandbox', '--disable-dev-shm-usage', '--enable-gpu', ...backendArgs,
    '--disable-gpu-watchdog', '--disable-gpu-process-crash-limit', '--ignore-gpu-blocklist',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
    ...(arg('verbose', 'false') === 'true' ? ['--enable-logging=stderr', '--v=1'] : []),
  ] });
  if (xvfb) browser.on('disconnected', () => xvfb.kill());
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const cube = await context.newPage();
  await cube.goto('http://127.0.0.1:5180/gpu-cube.html');
  await cube.waitForFunction(() => !!window.cubeProbe);
  const cubeSamples = [];
  for (let i = 0; i < 60; i++) cubeSamples.push(await cube.evaluate(() => window.cubeProbe()));
  save('cube.json', cubeSamples);
  await cube.screenshot({ path: path.join(out, 'cube.png') });
  console.log('CUBE', JSON.stringify(cubeSamples.at(-1)));
  if (cubeSamples.some(s => s.lost || !s.renderer || backend !== 'swiftshader' && !/nvidia/i.test(s.renderer))) throw Error('Cube hardware probe failed');
  await cube.close();
  if (arg('cube-only', 'false') === 'true') { await browser.close(); server.close(); process.exit(0); }
  // Suppress automatic frames; the existing advance hook drives simulation and rendering.
  await context.addInitScript(() => {
    let seed = 42;
    Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    document.addEventListener('webglcontextlost', e => console.warn('CONTEXT LOSS EVENT', e.target.width, e.target.height, e.target.isConnected, e.statusMessage), true);
    window.requestAnimationFrame = () => 0;
    window.cancelAnimationFrame = () => {};
  });
  let page;
  const H = (fn, ...args) => page.evaluate(([f, a]) => {
    if (f === 'advance' && window.__gpuFixedClock) window.__gpuTime += a[0] * a[1] * 1000;
    return window.__gameHooks[f](...a);
  }, [fn, args]);
  const advance = (n, render = true) => H('advance', n, 1 / 60, render);
  async function boot(q = 'high', fixedClock = false) {
    if (page) await page.close();
    page = await context.newPage();
    page.setDefaultTimeout(180000);
    page.on('pageerror', e => { errors.push(String(e)); console.error('PAGEERROR', String(e)); });
    page.on('console', m => { if (!m.text().includes('toNonIndexed')) console.log('BROWSER', m.type(), m.text()); if (m.type() === 'error') errors.push(m.text()); if (m.text().startsWith('[quality]')) { log.push(m.text()); console.log(m.text()); } });
    await page.goto(`http://127.0.0.1:5180/?q=${q}`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => !!(window.__game && window.__gameHooks?.advance), null, { polling: 100 });
    await H('setManual', true);
    if (fixedClock) await page.evaluate(() => {
      window.__gpuFixedClock = true;
      window.__gpuTime = window.__gameHooks.state().t * 1000;
      Object.defineProperty(performance, 'now', { value: () => window.__gpuTime });
    });
    const gl = await page.evaluate(() => {
      const gl = window.__gameHooks.debug.renderer.getContext();
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      return { canvas: [gl.canvas.width, gl.canvas.height, gl.canvas.isConnected], lost: gl.isContextLost(), error: gl.getError(), renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), vendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR), version: gl.getParameter(gl.VERSION) };
    });
    const cdp = await browser.newBrowserCDPSession();
    save('gpu-diagnostics.json', await cdp.send('SystemInfo.getInfo').catch(e => ({error: String(e)})));
    await cdp.detach();
    save('renderer.json', gl); fs.writeFileSync(path.join(out, 'renderer.txt'), gl.renderer + '\n');
    console.log('HARDWARE PROBE', JSON.stringify(gl));
    if (gl.lost || !gl.renderer || backend !== 'swiftshader' && (!/nvidia/i.test(gl.renderer) || /swiftshader|llvmpipe|lavapipe|software|subzero/i.test(gl.renderer))) throw Error(`Hardware GPU required: ${gl.renderer}`);
    report.renderer = gl;
    await advance(30);
    if (await page.evaluate(() => window.__gameHooks.debug.renderer.getContext().isContextLost())) throw Error('WebGL context lost after warmup');
    return H('state');
  }
  async function shot(name) {
    await page.screenshot({ path: path.join(out, `${name}.png`), animations: 'disabled' });
    report.shots[name] = { state: await H('state'), game: await page.evaluate(() => window.__game) };
  }
  await boot(quality);
  await shot('hardware-probe');
  const poses = {
    establish: { fox: [0, 0, 80], photo: [[-60, 46, 120], [10, 14, -40], 52] },
    hill: { fox: [-2, 38, -84], photo: [[30, 44, -52], [-4, 36, -88], 50] },
    marsh: { fox: [69, 0.4, 28.2] }, shrine: { fox: [0, 38, -79] }, meadow: { fox: [6, 0, 70] },
  };
  if (wants('perf')) {
    for (const q of ['low', 'med', 'high']) for (const state of ['sepia', 'restored']) {
      await boot(q);
      if (state === 'restored') { await H('forceRestore'); await advance(660, false); }
      for (const [name, pose] of Object.entries(poses)) {
        await H('teleport', ...pose.fox, Math.PI);
        if (pose.photo) await H('photo', ...pose.photo);
        await advance(90, false); await advance(2);
        const st = await H('state');
        if (st.restored !== (state === 'restored')) throw Error(`Unexpected restoration at ${state}-${name}`);
        await H('perf', 8); // shader/cache warmup excluded
        const samples = [];
        for (let i = 0; i < 9; i++) samples.push(await H('perf', 4));
        const sorted = [...samples].sort((a, b) => a.msPerFrame - b.msPerFrame);
        const median = sorted[Math.floor(sorted.length / 2)];
        report.perf[`${q}-${state}-${name}`] = { ...median, fps: Number((1000 / median.msPerFrame).toFixed(2)), samples, method: 'median of 9 perf(4) GPU-synchronized render-only batches; simulation paused' };
        console.log('PERF', q, state, name, JSON.stringify(median));
        await shot(`${q}-${state}-${name}`);
        save('perf.json', report.perf);
      }
    }
  }
  async function video(name, frameCount, beforeFrame, stop) {
    const started = Date.now(), trace = [], frames = [], start = await H('state');
    const output = path.join(out, `${name}.mp4`);
    const encoder = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-vcodec', 'mjpeg', '-i', 'pipe:0', '-an', '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', output], { stdio: ['pipe', 'ignore', 'inherit'] });
    let encoderError;
    encoder.stdin.on('error', e => { encoderError = e; });
    const completed = once(encoder, 'close');
    let state, count = 0;
    try {
      for (let i = 0; i < frameCount; i++) {
        await beforeFrame(i);
        state = await advance(60 / fps);
        if (state.look.quality !== quality) throw Error(`Capture quality changed: ${JSON.stringify(state.look)}`);
        const jpeg = await page.screenshot({ type: 'jpeg', quality: 96, animations: 'disabled' });
        if (encoderError) throw encoderError;
        if (!encoder.stdin.write(jpeg)) await once(encoder.stdin, 'drain');
        count++;
        if (i % fps === 0) {
          if (await page.evaluate(() => window.__gameHooks.debug.renderer.getContext().isContextLost())) throw Error(`Context lost at video frame ${i}`);
          trace.push({ frame: i, state, game: await page.evaluate(() => window.__game) });
          console.log('FRAME', name, i, 'sim', state.t.toFixed(2), 'wp', state.auto.idx, 'restored', state.restored);
        }
        if (i % (10 * fps) === 0 || state.restore.phase !== 'idle' && state.restore.age <= 8 && i % (fps / 2) === 0) { const filename = `${name}-${String(i).padStart(5, '0')}.png`; await page.screenshot({ path: path.join(out, filename) }); frames.push(filename); }
        if (stop?.(state, i)) break;
      }
    } finally { encoder.stdin.end(); }
    const [code] = await completed;
    if (code !== 0) throw Error(`ffmpeg ${name} exited ${code}`);
    const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', output], { encoding: 'utf8' }));
    const stream = probe.streams[0];
    if (stream.width !== width || stream.height !== height || stream.r_frame_rate !== `${fps}/1` || Number(stream.nb_frames) !== count) throw Error(`Invalid video: ${JSON.stringify(stream)}`);
    report.videos[name] = { frames: count, duration: count / fps, wallSeconds: (Date.now() - started) / 1000, start, end: state, simulationHz: 60, stepsPerVideoFrame: 60 / fps, seed: 42, trace, reviewFrames: frames, ffprobe: probe, audio: 'Silent: fixed-clock rendering; audio capture optional and omitted' };
    save(`${name}.json`, report.videos[name]);
    return state;
  }
  if (wants('route')) {
    await boot(quality, true);
    save('route-waypoints.json', await H('route'));
    await H('autopilot', true, 0, { assist: false });
    let restoredAt;
    const state = await video('route-unassisted', Number(arg('route-seconds', '360')) * fps, async () => {}, (st, i) => {
      if (st.restored && restoredAt === undefined) restoredAt = i;
      return restoredAt !== undefined && i - restoredAt >= 11 * fps || !st.auto.active && !st.restored;
    });
    await shot('route-end');
    if (!state.restored || state.auto.assists || state.deaths) report.failures.push(`Route incomplete or assisted: ${JSON.stringify(state.auto)}, restored=${state.restored}, deaths=${state.deaths}`);
  }
  if (wants('orbit')) {
    await boot(quality, true); await H('forceRestore'); await advance(660, false);
    await H('teleport', 0, 38, -84, Math.PI);
    const n = Number(arg('orbit-seconds', '20')) * fps;
    await video('restored-orbit-staged', n, async i => {
      const a = -0.65 + i / (n - 1) * Math.PI * 0.7;
      await H('photo', [Math.sin(a) * 125, 66 + Math.sin(i / n * Math.PI) * 12, -18 + Math.cos(a) * 125], [0, 15, -25], 52);
    });
    await shot('orbit-end');
  }
  if (wants('fox')) {
    // Character review: staged stills around the fox (concept turnaround angles + face), then the real chase cam.
    for (const state of ['sepia', 'restored']) {
      await boot(quality, true);
      if (state === 'restored') { await H('forceRestore'); await advance(660, false); }
      await H('teleport', ...poses.meadow.fox, Math.PI);
      await advance(60, false);
      const p = await H('getFoxPos'), at = [p.x, p.y + 0.5, p.z];
      // fox faces -Z at yaw PI: "front" camera sits on -Z
      const views = { front: [0, 0.6, -5.2, 30], three_q: [-3.5, 0.7, -4.0, 30], side: [-5.6, 0.55, 0, 30],
        back_three_q: [-3.3, 0.9, 4.4, 30], back: [0, 0.9, 5.4, 30], face: [-0.8, 0.95, -2.2, 26] };
      for (const [name, [dx, dy, dz, fov]] of Object.entries(views)) {
        const look = name === 'face' ? [p.x, p.y + 0.82, p.z - 0.45] : at;
        await H('photo', [p.x + dx, p.y + dy, p.z + dz], look, fov);
        await advance(3); await shot(`fox-${state}-${name}`);
      }
      await H('photoOff'); await advance(30); await shot(`fox-${state}-chase-idle`);
      await H('setKeys', ['KeyW']); await advance(70); await shot(`fox-${state}-chase-run`);
      await H('setKeys', ['KeyW', 'KeyA']); await advance(25); await shot(`fox-${state}-chase-turn`);
      await H('setKeys', []);
    }
  }
} catch (e) { report.failures.push(String(e.stack || e)); throw e; }
finally {
  report.errors = errors; report.qualityLog = log;
  save('report.json', report); save('perf.json', report.perf);
  if (browser) await browser.close();
  server.close();
}
if (report.failures.length || errors.length) { console.error('CAPTURE FAILURES', report.failures, errors); process.exitCode = 1; }
