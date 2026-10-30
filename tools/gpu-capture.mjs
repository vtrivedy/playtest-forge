/** Modal-only hardware GL capture; see tools/modal/gpu_capture.py for entrypoint. */
import { chromium } from 'playwright';
import { captureLevels } from './levels-capture.mjs';
import { captureWindGap } from './windgap-capture.mjs';
import { captureMarshMouth } from './marshmouth-capture.mjs';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
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
const errors = [], log = [], report = { viewport: [width, height], fps, backend, quality, seed: 42, captureToolSha: createHash('sha256').update(fs.readFileSync(new URL(import.meta.url))).digest('hex'), perf: {}, shots: {}, videos: {}, failures: [] };
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
  async function boot(q = 'high', fixedClock = false, query = '') {
    if (page) await page.close();
    page = await context.newPage();
    page.setDefaultTimeout(180000);
    page.on('pageerror', e => { errors.push(String(e)); console.error('PAGEERROR', String(e)); });
    page.on('console', m => { if (!m.text().includes('toNonIndexed')) console.log('BROWSER', m.type(), m.text()); if (m.type() === 'error') errors.push(m.text()); if (m.text().startsWith('[quality]')) { log.push(m.text()); console.log(m.text()); } });
    await page.goto(`http://127.0.0.1:5180/?q=${q}&fresh${query}`, { waitUntil: 'networkidle' });
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
    establish: { fox: [0, 1, 90], photo: [[-60, 46, 120], [10, 14, -40], 52] },
    hill: { fox: [-2, 38, -84], photo: [[30, 44, -52], [-4, 36, -88], 50] },
    marsh: { fox: [69, 0.4, 28.2] }, shrine: { fox: [-5, 38, -83.5], photo: [[18, 47, -62], [0, 39, -88], 50] }, meadow: { fox: [6, 0, 70] },
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
  async function video(name, frameCount, beforeFrame, stop, options = {}) {
    await page.addStyleTag({ content: '#hud > :not(#vignette), .lil-gui { visibility: hidden !important; }' });
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
        const dt = options.dt?.(i) ?? 1 / 60;
        state = await H('advance', 60 / fps, dt, false);
        if (options.afterStep) await options.afterStep(i, state);
        await H('advance', 0, dt, true);
        state = await H('state');
        if (options.sample) state.capture = await options.sample(i, state);
        if (options.traceEveryFrame) trace.push({ frame: i, dt, state, ...(i % fps === 0 ? { game: await page.evaluate(() => window.__game) } : {}) });
        if (state.look.quality !== quality) throw Error(`Capture quality changed: ${JSON.stringify(state.look)}`);
        const jpeg = await page.screenshot({ type: 'jpeg', quality: 96, animations: 'disabled' });
        if (encoderError) throw encoderError;
        if (!encoder.stdin.write(jpeg)) await once(encoder.stdin, 'drain');
        count++;
        if (i % fps === 0) {
          if (await page.evaluate(() => window.__gameHooks.debug.renderer.getContext().isContextLost())) throw Error(`Context lost at video frame ${i}`);
          if (!options.traceEveryFrame) trace.push({ frame: i, state, game: await page.evaluate(() => window.__game) });
          console.log('FRAME', name, i, 'sim', state.t.toFixed(2), 'wp', state.auto.idx, 'restored', state.restored);
        }
        if (options.keyFrames?.includes(i) || i % (10 * fps) === 0 || state.restore.phase !== 'idle' && state.restore.age <= 8 && i % (fps / 2) === 0) { const filename = `${name}-${String(i).padStart(5, '0')}.png`; await page.screenshot({ path: path.join(out, filename) }); frames.push(filename); }
        if (stop?.(state, i)) break;
      }
    } finally { encoder.stdin.end(); }
    const [code] = await completed;
    if (code !== 0) throw Error(`ffmpeg ${name} exited ${code}`);
    const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', output], { encoding: 'utf8' }));
    const stream = probe.streams[0];
    if (stream.width !== width || stream.height !== height || stream.r_frame_rate !== `${fps}/1` || Number(stream.nb_frames) !== count) throw Error(`Invalid video: ${JSON.stringify(stream)}`);
    report.videos[name] = { frames: count, duration: count / fps, wallSeconds: (Date.now() - started) / 1000, start, end: state, simulationHz: options.dt ? 'variable; see per-frame dt in trace' : 60, stepsPerVideoFrame: 60 / fps, seed: 42, trace, reviewFrames: frames, ffprobe: probe, audio: 'Silent: fixed-clock rendering; audio capture optional and omitted' };
    save(`${name}.json`, report.videos[name]);
    if (options.keyFrames) {
      const sheetPage = await context.newPage();
      try {
        await sheetPage.setViewportSize({ width: 1920, height: 1080 });
        const cards = options.keyFrames.map(frame => {
          const filename = `${name}-${String(frame).padStart(5, '0')}.png`;
          const label = options.label?.(frame, trace.find(sample => sample.frame === frame)?.state) ?? `${name} frame ${frame}`;
          return `<figure><figcaption>${label}</figcaption><img src="data:image/png;base64,${fs.readFileSync(path.join(out, filename)).toString('base64')}"></figure>`;
        }).join('');
        await sheetPage.setContent(`<style>*{box-sizing:border-box}body{margin:0;background:#211b16;color:#eadfc8;font:16px sans-serif;display:grid;grid-template-columns:repeat(4,1fr)}figure{margin:0}figcaption{height:30px;padding:6px}img{display:block;width:100%}</style>${cards}`);
        await sheetPage.evaluate(() => Promise.all([...document.images].map(image => image.decode())));
        await sheetPage.screenshot({ path: path.join(out, `${name}-contact-sheet.png`), fullPage: true });
      } finally { await sheetPage.close(); }
    }
    return state;
  }
  if (wants('shade')) {
    await boot(quality, true);
    const actors = await page.evaluate(() => window.__gameHooks.shades.state().actors);
    if (!actors.length) throw Error('No Shade encounter authored');
    save('shade-script.json', { label: 'STAGED placement, live patrol/contact and real controller dash; no forced free or health edit', actor: actors[0] });
    let lens = null;
    const camera = async () => {
      const actor = await page.evaluate(() => window.__gameHooks.shades.state().actors[0]);
      const [x,y,z] = actor.pos;
      if(!lens){
        const dx=x+112,dz=z+24,d=Math.hypot(dx,dz)||1;
        lens=[x+dx/d*8,y+3.6,z+dz/d*8];
      }
      await H('photo', lens, [x,y+1.2,z],48);
    };
    const start = actors[0].pos;
    const safePosition = await page.evaluate(([x,y,z]) => {
      const col = window.__gameHooks.debug.world.collision;
      const patrol=window.__gameHooks.debug.world.shadeSpots[0].patrol;
      for(let px=-117;px<=-107;px+=.25)for(let pz=-29;pz<=-19;pz+=.25){
        if(Math.hypot(px+112,pz+24)>4.8)continue;
        if(col.blocked(px,pz,y)||Math.abs(col.groundAt(px,pz,y+.1).y-y)>.2)continue;
        if(patrol.every(q=>Math.hypot(q[0]-px,q[2]-pz)>2.1))return [px,y,pz];
      }
      throw Error('No safe patrol observer position');
    }, start);
    const observerYaw = Math.atan2(start[0]-safePosition[0],start[2]-safePosition[2]);
    await H('teleport', ...safePosition, observerYaw);
    const probe = await H('shadesProbe');
    if (!probe.draining || probe.weak > 0) throw Error(`Drain probe failed ${JSON.stringify(probe)}`);
    save('shade-drain-probe.json', probe);
    const rules = await page.evaluate(() => {
      const h=window.__gameHooks,field=h.debug.colorField;
      const pos=field.fox.clone().fromArray(h.shades.state().actors[0].pos);
      const original=field.fox.clone(); field.fox.copy(pos);
      const aura={raw:field.sample(pos),supplied:h.chem.supplyAt(pos)};
      const stroke=field.stroke(pos,pos,{life:6,strength:1.8,radius:1});
      const strong={strength:field.strokeAt(pos),supplied:h.chem.supplyAt(pos)};
      stroke.strength=1;
      const spent={strength:field.strokeAt(pos),supplied:h.chem.supplyAt(pos)};
      field.strokes.splice(field.strokes.indexOf(stroke),1);field.fox.copy(original);
      return {label:'Isolated public colour-field rule probe; staged aura/stroke samples, restored immediately; no encounter release forced',aura,strong,spent};
    });
    if(rules.aura.raw<.9||rules.aura.supplied!==0||rules.strong.supplied!==1||rules.spent.supplied!==0)throw Error(`Shade colour rules failed ${JSON.stringify(rules)}`);
    save('shade-colour-rules.json',rules);

    await camera();
    await video('shade-patrol', 120, camera, undefined, { traceEveryFrame: true, keyFrames: [0, 30, 60, 90, 119] });
    if((await page.evaluate(()=>window.__gameHooks.shades.state())).hits!==0)throw Error('Patrol observer was hit');
    await H('photoOff');
    await advance(30);
    await shot('shade-chase');
    await H('setKeys', []);
    let p = (await page.evaluate(() => window.__gameHooks.shades.state().actors[0])).pos;
    const contactSetup = await page.evaluate(([x,y,z]) => {
      const col = window.__gameHooks.debug.world.collision;
      for (let k=0;k<128;k++) {
        const a=k/128*Math.PI*2, dx=Math.cos(a), dz=Math.sin(a);
        let safe=true;
        for(let r=.55;r<4.6;r+=.1) {
          const px=x+dx*r,pz=z+dz*r;
          if(col.blocked(px,pz,y)||Math.abs(col.groundAt(px,pz,y+.1).y-y)>.2) { safe=false; break; }
        }
        if(safe)return {pos:[x+dx*1.45,y,z+dz*1.45], direction:[dx,dz]};
      }
      throw Error('No 3m wall-free contact direction');
    }, p);
    save('shade-contact-setup.json', contactSetup);
    await H('teleport', ...contactSetup.pos, Math.PI);
    lens=null;
    await camera();
    let contactFrame=null;
    await H('setStick', -contactSetup.direction[0], -contactSetup.direction[1]);
    await video('shade-contact', 110, async i => {
      const current=await page.evaluate(()=>window.__gameHooks.shades.state());
      if(current.hits>0&&contactFrame===null){contactFrame=i-1;await H('setStick',null);}
      await camera();
    }, (state,i)=>contactFrame!==null&&i>=contactFrame+61, { traceEveryFrame: true, keyFrames: [0, 6, 12, 18, 36, 60] });
    await H('setStick', null);
    const contact = await page.evaluate(() => window.__gameHooks.shades.state());
    if (contact.hits !== 1 || contact.wisps !== 2 || contact.knockbackTravel < 2.9 || contact.knockbackTravel > 3.1) throw Error(`Shade contact failed: ${JSON.stringify(contact)}`);
    p = contact.actors[0].pos;
    const dashSetup = await page.evaluate(([x,y,z]) => {
      const col=window.__gameHooks.debug.world.collision;
      for(let k=0;k<128;k++){
        const a=k/128*Math.PI*2,dx=Math.cos(a),dz=Math.sin(a);let safe=true;
        for(let r=.1;r<3.1;r+=.1)if(col.blocked(x+dx*r,z+dz*r,y)||Math.abs(col.groundAt(x+dx*r,z+dz*r,y+.1).y-y)>.2){safe=false;break;}
        if(safe)return {pos:[x+dx*2.7,y,z+dz*2.7], direction:[-dx,-dz],yaw:Math.atan2(-dx,-dz)};
      }throw Error('No clear dash approach');
    },p);
    save('shade-dash-setup.json',dashSetup);
    await H('teleport', ...dashSetup.pos, dashSetup.yaw);
    await H('setStick', ...dashSetup.direction);
    await H('setKeys', ['ShiftLeft']);
    lens=null;
    await camera();
    await video('shade-free', 120, async i => {
      if (i === 12) { await H('setKeys', []); await H('setStick', null); }
      await camera();
    }, undefined, { traceEveryFrame: true, keyFrames: [0, 5, 12, 24, 45, 75, 119] });
    const freed = await page.evaluate(() => window.__gameHooks.shades.state());
    if (freed.frees !== 1 || !freed.actors[0].freed || freed.hits !== contact.hits || freed.wisps < contact.wisps) throw Error(`Shade freeing failed: ${JSON.stringify(freed)}`);
    await advance(180);
    await shot('shade-leaf-litter');
    await advance(600, false);
    if ((await page.evaluate(() => window.__gameHooks.shades.state().actors[0].leaves)) !== 0) throw Error('Leaf one-shot did not end empty');
    if (!(await page.evaluate(() => window.__gameHooks.shades.state().actors[0].freed))) throw Error('Shade respawned');
    await advance(0);
    await shot('shade-after-free');
    save('shade-acceptance.json', { contact, freed, noRespawn: true, game: await page.evaluate(() => window.__game) });
    // Separate live third-person take: same encounter and controller, actual keyboard events.
    await boot(quality, true);
    const live = await page.evaluate(() => {
      const actor=window.__gameHooks.shades.state().actors[0];
      const [x,y,z]=actor.pos,col=window.__gameHooks.debug.world.collision;
      for(let k=0;k<128;k++){
        const a=k/128*Math.PI*2,dx=Math.cos(a),dz=Math.sin(a);let safe=true;
        for(let r=-2;r<3;r+=.1)if(col.blocked(x+dx*r,z+dz*r,y)||Math.abs(col.groundAt(x+dx*r,z+dz*r,y+.1).y-y)>.2){safe=false;break;}
        if(safe)return {pos:[x+dx*2.6,y,z+dz*2.6],yaw:Math.atan2(-dx,-dz)};
      }throw Error('No clear live dash approach');
    });
    await H('teleport', ...live.pos, live.yaw);
    await H('advance', 1, 0, true);
    await page.keyboard.down('w');
    await page.keyboard.down('Shift');
    await video('shade-play', 120, async i => {
      if(i===12){await page.keyboard.up('w');await page.keyboard.up('Shift');}
    }, undefined, {traceEveryFrame:true,keyFrames:[0,6,12,24,45,90,119]});
    const liveResult=await page.evaluate(()=>window.__gameHooks.shades.state());
    if(liveResult.frees!==1||liveResult.hits!==0)throw Error(`Live dash failed ${JSON.stringify(liveResult)}`);
    save('shade-live-acceptance.json',{label:'STAGED start, actual W + Shift keyboard, normal third-person camera, no forced release',start:live,end:liveResult,game:await page.evaluate(()=>window.__game)});
    const flume = await page.evaluate(() => window.__gameHooks.shades.state().actors.find(a=>a.id==='shade-flume'));
    if(flume){
      await H('teleport',95,6,18,0);
      await H('photo',[103,10,31],[99,5,23],48);
      await video('shade-flume',120,async()=>{},undefined,{traceEveryFrame:true,keyFrames:[0,30,60,90,119]});
      const result=await page.evaluate(()=>window.__gameHooks.shades.state().actors.find(a=>a.id==='shade-flume'));
      if(result.pos[1]<3.5||result.pos[1]>7)throw Error('Flume Shade left elevated channel');
      save('shade-flume-acceptance.json',{actor:result,game:await page.evaluate(()=>window.__game)});
      for(const [id,observer,lens,target] of [
        ['shade-hill-low',[8,12,-67],[11,20,-60],[0,15,-68.7]],
        ['shade-hill-high',[8,32.8,-79.5],[12,41,-73],[0,35,-80.5]],
      ]){
        await H('teleport',...observer,0);await H('photo',lens,target,48);
        await video(id,90,async()=>{},undefined,{traceEveryFrame:true,keyFrames:[0,30,60,89]});
        const actor=await page.evaluate(id=>window.__gameHooks.shades.state().actors.find(a=>a.id===id),id);
        if(!actor)throw Error(`Missing ${id}`);
        save(`${id}-acceptance.json`,actor);
      }

    }


  }
  if (wants('gait')) {
    if (fps !== 60) throw Error('Gait capture requires 60 fps for identical input-edge timing');
    await boot(quality, true, '&gym=gait');
    const gym = await page.evaluate(() => window.__gameHooks.gym);
    if (!gym) throw Error('Target ref has no gait gym; merge capture tooling first');
    await H('teleport', gym.origin[0] - 20, gym.origin[1], gym.origin[2], Math.PI / 2);
    await H('setStick', 0, 0);
    await page.evaluate(() => {
      const fox = window.__gameHooks.debug.fox;
      window.__capturePaws = Object.fromEntries(Object.entries({ LF: 'front_paw_l', RF: 'front_paw_r', LH: 'hind_paw_l', RH: 'hind_paw_r' }).map(([id, name]) => [id, fox.getObjectByName(name)]));
    });
    // Times are output seconds; slow motion advances 1/240s per 60fps frame.
    const segments = [
      { name: 'idle', seconds: 1, stick: [0, 0] },
      { name: 'walk', seconds: 2, stick: [.18, 0] },
      { name: 'trot', seconds: 2, stick: [.45, 0] },
      { name: 'gallop', seconds: 2, stick: [1, 0] },
      { name: 'gallop-quarter-speed', seconds: 3, stick: [1, 0], slow: true },
      { name: 'tight-left', seconds: 1, stick: [0, -1] },
      { name: 'reverse', seconds: 1, stick: [0, 1] },
      { name: 'tight-right', seconds: 1, stick: [-1, 0] },
      { name: 'hard-stop', seconds: 1, stick: [0, 0] },
      { name: 'jump-land', seconds: 2, stick: [.45, 0], jump: true, reset: [610, 0, 0] },
      { name: 'dash', seconds: 1, stick: [1, 0], dash: true, reset: [610, 0, 0] },
      { name: 'slope-up', seconds: 3, stick: [.6, 0], reset: [653, 0, 0] },
      { name: 'slope-down', seconds: 3, stick: [.6, 0], reset: [673, 12 * Math.tan(Math.PI / 12), 0] },
    ];
    let cursor = 0;
    for (const segment of segments) { segment.start = cursor; cursor += segment.seconds * fps; segment.end = cursor; }
    const segmentAt = i => segments.find(s => i < s.end);
    const keyFrames = [...new Set(segments.flatMap(s => s.slow || s.jump ? Array.from({ length: 8 }, (_, i) => s.start + Math.round(i * (s.slow ? s.end - s.start - 1 : fps) / 7)) : [s.start + Math.round(fps * .25), Math.min(s.end - 1, s.start + fps)]))].sort((a, b) => a - b);
    save('gait-script.json', { label: 'Live controller; staged resets for jump, dash and slopes; walk/trot/gallop are requested speed bands', segments, keyFrames, gym });
    await video('gait', cursor, async i => {
      const segment = segmentAt(i), local = i - segment.start;
      if (local === 0) {
        if (segment.reset) await H('teleport', ...segment.reset, Math.PI / 2);
        await H('setStick', ...segment.stick);
      }
      await H('setKeys', segment.jump && local < .18 * fps ? ['Space'] : segment.dash && local === 0 ? ['ShiftLeft'] : []);
    }, undefined, {
      dt: i => segmentAt(i).slow ? 1 / 240 : 1 / 60,
      sample: async (i, state) => page.evaluate(feetY => {
        const { fox, world } = window.__gameHooks.debug;
        fox.updateWorldMatrix(true, true);
        const feet = {};
        for (const [id, bone] of Object.entries(window.__capturePaws)) {
          if (!bone) { feet[id] = { missing: true }; continue; }
          const point = bone.getWorldPosition(fox.position.clone());
          const ground = world.collision.groundAt(point.x, point.z, feetY + .6).y;
          feet[id] = { position: point.toArray(), ground: Number.isFinite(ground) ? ground : null, clearance: Number.isFinite(ground) ? point.y - ground : null };
        }
        const hip = fox.getObjectByName('pelvis'), chest = fox.getObjectByName('spine_04');
        let body = null;
        if (hip && chest) {
          const a = hip.getWorldPosition(fox.position.clone()), b = chest.getWorldPosition(fox.position.clone());
          const yaw = fox.rotation.y, center = fox.position;
          const ahead = world.collision.groundAt(center.x + Math.sin(yaw) * .4, center.z + Math.cos(yaw) * .4, feetY + .6).y;
          const behind = world.collision.groundAt(center.x - Math.sin(yaw) * .4, center.z - Math.cos(yaw) * .4, feetY + .6).y;
          body = { hip: a.toArray(), chest: b.toArray(), pitch: Math.atan2(b.y - a.y, Math.hypot(b.x - a.x, b.z - a.z)), floorPitch: Math.atan2(ahead - behind, .8) };
        }
        return { landmark: 'paw bone head after animation/IK; not a mesh toe measurement', feet, body };
      }, state.pos[1]),
      keyFrames, traceEveryFrame: true, label: (i, st) => `${segmentAt(i).name} | f${i} | ${st.gait ?? st.locomotion?.gait ?? st.anim ?? 'unreported'} ${Math.hypot(st.vel[0], st.vel[2]).toFixed(2)}m/s`,
      afterStep: async (i, state) => {
        const [x, , z] = state.pos;
        if (state.deaths) throw Error(`Gait course death at frame ${i}`);
        if (!segmentAt(i).name.startsWith('slope') && (x >= 650 || x <= 550 || Math.abs(z) >= 20)) throw Error(`Flat gait left the flat course at frame ${i}`);
        await page.evaluate(([x, z, jumping]) => {
          const ground = window.__gameHooks.debug.world.collision.highestAt(x, z);
          window.__gameHooks.photo([x, ground + (jumping ? 1.7 : 1.35), z + (jumping ? 5.8 : 4.8)], [x, ground + (jumping ? 1.1 : .8), z], 42);
        }, [x, z, !!segmentAt(i).jump]);
      },
    });
    await H('setKeys', []); await H('setStick', null);
    await shot('gait-end');
    report.videos.gait.game = await page.evaluate(() => window.__game);
    save('gait.json', report.videos.gait);
  }
  if (wants('stills')) {
    await boot(quality, true);
    await page.addStyleTag({ content: '#hud > :not(#vignette), .lil-gui { visibility: hidden !important; }' });
    async function poseStill(name, pose) {
      const [x, , z] = pose.fox;
      const y = await page.evaluate(([x, z]) => window.__gameHooks.debug.world.collision.highestAt(x, z), [x, z]);
      if (!Number.isFinite(y) || y < -24) throw Error(`Still ${name} has no safe surface`);
      await H('teleport', x, y, z, Math.PI);
      if (pose.photo) await H('photo', ...pose.photo);
      await advance(30);
      const state = await H('state');
      if (state.deaths || state.pos[1] < y - .2) throw Error(`Still ${name} fell off its staged surface`);
      await shot(`still-${name}`);
    }
    for (const [name, pose] of Object.entries(poses)) await poseStill(name, pose);
    // Keep the staged hero clear of the arrival hearth added at (5.6,74.2).
    const heroY = await page.evaluate(() => window.__gameHooks.debug.world.collision.highestAt(6, 78));
    if (!Number.isFinite(heroY) || heroY < -24) throw Error('Hero still has no safe surface');
    await H('teleport', 6, heroY, 78, Math.PI); await advance(60, false);
    const hero = await H('getFoxPos');
    await H('photo', [hero.x + 3.5, hero.y + 0.7, hero.z - 4], [hero.x, hero.y + 0.5, hero.z], 30);
    await advance(3); await shot('still-hero');
    await H('forceRestore'); await advance(660, false);
    await poseStill('establish-restored', poses.establish);
  }
  if (wants('water')) {
    await boot(quality, true);
    const stagingY = await page.evaluate(() => window.__gameHooks.debug.world.collision.highestAt(51.4, 42.5));
    await H('teleport', 51.4, stagingY, 42.5, Math.PI);
    const lens = [[64, 7, 44], [59, 0.5, 34], 48];
    await H('photo', ...lens); await advance(10); await shot('water-frozen');
    const timeline = [];
    await video('water-cycle', 12 * fps, async i => {
      if (i === 0) { await H('teleport', 56, 0.3, 37, Math.PI); await H('photo', ...lens); }
      if (i === Math.round(1.4 * fps)) { await H('teleport', 51.4, stagingY, 42.5, Math.PI); await H('photo', ...lens); }
      if ([Math.round(0.3 * fps), Math.round(0.8 * fps), 2 * fps, 6 * fps, 8 * fps, 11 * fps].includes(i)) {
        await shot(`water-${i}`);
        timeline.push({ frame: i, state: (await H('state')).chem.water });
      }
    });
    await H('teleport', 55.8, 0.3, 37.2, Math.PI); await H('photo', ...lens); await H('setStick', 0, 0);
    const crossingStart = await H('state');
    const crossingEnd = await video('water-crossing', 4 * fps, async i => {
      if (i === fps) await H('setStick', 0.839, -0.544);
      if (i === Math.round(2.1 * fps)) await H('setStick', 0, 0);
      if ([fps, Math.round(1.5 * fps), 3 * fps].includes(i)) await shot(`water-crossing-${i}`);
    });
    await H('setStick', null);
    const crossed = crossingEnd.deaths === crossingStart.deaths && crossingEnd.pos[0] > 62;
    if (!crossed) report.failures.push('Water crossing failed: inspect crossing trace');
    save('water-acceptance.json', { cycle: timeline, crossing: crossingEnd, crossingDeaths: crossingEnd.deaths - crossingStart.deaths, crossed });
    await H('teleport', 95, 2, 10, Math.PI);
    await H('photo', [113, 15, 37], [98, 8, 19], 52); await advance(2); await shot('water-reed-frozen');
    await H('teleport', 100, 15, 19.2, Math.PI);
    await H('photo', [113, 15, 37], [98, 8, 19], 52);
    await video('water-reed-feed', 14 * fps, async i => {
      if ([fps, 5 * fps, 10 * fps, 13 * fps].includes(i)) await shot(`water-reed-${i}`);
    });
    save('water-reed-result.json', await H('state'));
    await H('teleport', -30, 0, 65, Math.PI); await H('setStick', 0, 0);
    await H('photo', [-23, 5, 70], [-30, 1, 61], 48); await advance(2); await shot('water-pond-frozen');
    await video('water-pond-grotto', 8 * fps, async i => {
      if (i === 15) { await H('setStick', 0, -1); await H('setKeys', ['ShiftLeft']); }
      if (i === 40) await H('setKeys', []);
      if (i === 95) await H('setStick', 0, 0);
      if ([30, 60, 100, 300].includes(i)) await shot(`water-pond-${i}`);
    });
    await H('setStick', null); await H('setKeys', []);
    save('water-pond-result.json', await H('state'));
    await H('photo', [-7, 7, 79], [-23, 0, 66], 52); await advance(2); await shot('water-pond-vista');
  }
  if (wants('updraft')) {
    // Heat element acceptance (docs/design/world-1.md §5.4): real inputs, no assists.
    // A: run past the cold H-a hearth, jump into its column, ride it onto the 5 m shelf, watch hold → gutter.
    // B: light it again, hover in the column (jump held, no steering) until it gutters under the glider.
    // C: dash through the cold hearth, walk away; measure lit time. K: SW1 Kiln with its Shade (aura vs dash).
    await boot(quality, true);
    await page.addStyleTag({ content: '#hud > :not(#vignette), .lil-gui { visibility: hidden !important; }' });
    const hearthOf = (st, id) => st.chem.hearths.find(h => h.id === id);
    const hearth = st => hearthOf(st, 'H-a');
    const h0 = hearth(await H('state'));
    const [hx, hy, hz] = h0.pos;
    const summary = { hearth: h0, A: {}, B: {}, C: {}, K: {} };
    const lens = [[hx - 6, hy + 8, hz + 11], [hx + 2, hy + 3, hz - 1], 50];
    await H('teleport', hx - 12, hy, hz + 16, Math.PI); await H('photo', ...lens); await advance(30); await shot('updraft-still-cold');
    const runFrom = [hx - 1.4, hy, hz + 9];
    for (const variant of ['A', 'B']) {
      await H('photoOff');
      await H('teleport', ...runFrom, Math.PI); await advance(40);
      let phase = 'run', i0 = -1, landed = -1, minVyGutter = Infinity;
      const keyFrames = [], timeline = [];
      const name = variant === 'A' ? 'updraft-ride' : 'updraft-hover';
      await video(name, 13 * fps, async i => {
        const st = await H('state'), hs = hearth(st), [x, y] = st.pos;
        timeline.push({ i, t: st.t, pos: st.pos, vy: st.vel[1], grounded: st.grounded, gliding: st.gliding, heat: hs.heat, state: hs.state, supply: hs.supply });
        if (hs.state === 'guttering' && !st.grounded) minVyGutter = Math.min(minVyGutter, st.vel[1]);
        if (phase === 'run' && st.pos[2] < hz + 0.2) { phase = 'ride'; i0 = i; keyFrames.push(i); }
        if (phase === 'ride' && st.grounded && i - i0 > 20) { phase = 'stand'; landed = i; keyFrames.push(i); }
        if (phase === 'ride' && (i - i0) % 30 === 15 && keyFrames.length < 6) keyFrames.push(i);
        if (phase === 'stand' && (i - landed) === 150 && keyFrames.length < 8) keyFrames.push(i);
        if (variant === 'A' && phase === 'stand' && i - landed === 40) await H('photo', [hx - 6, hy + 8, hz + 11], [hx + 2, hy + 3, hz - 1], 50);
        let keys = [];
        if (phase === 'run') keys = ['KeyW'];
        else if (phase === 'ride' && variant === 'B') keys = ['Space'];
        else if (phase === 'ride') keys = st.vel[1] < 0 && x > hx + 3.2 ? (x > hx + 6.5 ? [] : ['KeyD']) : ['KeyD', 'Space'];
        else if (variant === 'A' && i - landed < 20) keys = ['KeyD'];
        await H('setKeys', keys);
      }, (st, i) => phase === 'stand' && i - landed > 5.5 * fps, { keyFrames, label: (f, st) => st ? `${name} f${f} y=${st.pos[1].toFixed(2)} heat=${hearth(st).heat.toFixed(2)} ${hearth(st).state}` : `${name} f${f}` });
      const after = await H('state');
      const firstLit = timeline.find(r => r.heat > 0);
      const lastSupplied = [...timeline].reverse().find(r => r.supply >= after.chem.tun.threshold);
      const holdEnd = timeline.find(r => lastSupplied && r.t > lastSupplied.t && r.state === 'guttering');
      const cold = timeline.find(r => holdEnd && r.t > holdEnd.t && r.state === 'cold');
      summary[variant] = {
        ignitedAtS: firstLit ? Number((firstLit.t - timeline[0].t).toFixed(3)) : null,
        holdS: lastSupplied && holdEnd ? Number((holdEnd.t - lastSupplied.t).toFixed(3)) : null,
        gutterS: holdEnd && cold ? Number((cold.t - holdEnd.t).toFixed(3)) : null,
        minVyWhileGutteringAirborne: Number.isFinite(minVyGutter) ? Number(minVyGutter.toFixed(3)) : null,
        ride: after.chem.lastRide, end: { pos: after.pos, grounded: after.grounded, deaths: after.deaths },
      };
      save(`${name}-timeline.json`, timeline);
      await H('setKeys', []); await H('photoOff');
      await advance(300, false); // let it go cold before the next variant
    }
    { // C: dash stroke — run toward the hearth, dash past it, keep running; lit time from the timeline
      await H('teleport', ...runFrom, Math.PI); await advance(40);
      const tl = [];
      for (let i = 0; i < 16 * 60; i++) {
        const st = await H('state'), [, , z] = st.pos;
        const keys = i < 600 ? ['KeyW'] : [];
        if (z < hz + 4.5 && !tl.dashed) { keys.push('ShiftLeft'); tl.dashed = st.t; }
        await H('setKeys', keys);
        await H('advance', 1, 1 / 60, false);
        const hs = hearth(st);
        tl.push({ t: st.t, heat: hs.heat, state: hs.state, supply: hs.supply });
      }
      const lit = tl.filter(r => r.heat > 0);
      summary.C = { dashedAt: tl.dashed, litFrom: lit[0]?.t ?? null, litTo: lit.at(-1)?.t ?? null, litS: lit.length ? Number((lit.at(-1).t - lit[0].t).toFixed(2)) : 0,
        suppliedS: Number((tl.filter(r => r.supply >= 0.3).length / 60).toFixed(2)) };
      await H('setKeys', []);
    }
    { // D: falling entry from the opposite (shelf) side — light it, step off the shelf lip, glide into the column
      await H('teleport', hx - 1.4, hy, hz + 0.4, Math.PI); await advance(20);
      await H('teleport', hx + 6.5, hy + 5.3, hz, -Math.PI / 2); await advance(10);
      let left = -1;
      const tl = [];
      await video('updraft-fall-entry', 9 * fps, async i => {
        const st = await H('state');
        tl.push({ i, pos: st.pos, vy: st.vel[1], grounded: st.grounded, gliding: st.gliding, heat: hearth(st).heat });
        if (left < 0 && !st.grounded) left = i;
        const over = Math.abs(st.pos[0] - hx) < 1.0;
        await H('setKeys', left < 0 ? ['KeyW'] : over || st.vel[1] > 0 ? ['Space'] : ['KeyW', 'Space']);
      }, (st, i) => left > 0 && st.grounded && i - left > 30, { keyFrames: [10, 40, 70, 100, 140, 200] });
      const ride = (await H('state')).chem.lastRide;
      summary.D = { ride, minVyBeforeLift: Math.min(...tl.map(r => r.vy)), peak: Math.max(...tl.map(r => r.pos[1])) };
      await H('setKeys', []); await advance(300, false);
    }
    // debug view of the column volume + lit still (staged, lit by standing at the bowl)
    await H('teleport', hx - 1.4, hy, hz + 0.4, Math.PI); await advance(20);
    await page.evaluate(() => document.body.classList.add('debug-on'));
    await H('photo', ...lens); await advance(30); await shot('updraft-still-debug');
    await page.evaluate(() => document.body.classList.remove('debug-on')); await advance(2); await shot('updraft-still-lit');
    await H('photoOff');
    { // K: SW1 Kiln — aura alone next to H2 under the Shade, then a dash through H2 → latch
      const st0 = await H('state');
      const h2 = hearthOf(st0, 'H2');
      const sw = { x: -112, z: -24 };
      const dx = h2.pos[0] - sw.x, dz = h2.pos[2] - sw.z, dl = Math.hypot(dx, dz), ux = dx / dl, uz = dz / dl;
      const yaw = Math.atan2(ux, uz);
      await H('teleport', sw.x - ux * 2, 20, sw.z - uz * 2, yaw); await advance(30);
      const tl = [];
      let phase = 'aura', p0 = 0;
      await video('kiln', 14 * fps, async i => {
        const st = await H('state'), hs = hearthOf(st, 'H2'), inlet = st.chem.inlets[0];
        tl.push({ i, t: st.t, phase, pos: st.pos, heat: hs.heat, state: hs.state, supply: hs.supply, seal: inlet.seal, lit: st.seedwells[0].lit, shades: st.chem.shades });
        let keys = [];
        if (phase === 'aura') { keys = i < 30 ? ['KeyW'] : []; if (i > 30 + 5 * fps) { phase = 'back'; p0 = i; } }
        else if (phase === 'back') { keys = ['KeyS']; if (i - p0 > 35) { phase = 'dash'; p0 = i; } }
        else if (phase === 'dash') { keys = i - p0 < 12 ? ['KeyW'] : i - p0 === 12 ? ['KeyW', 'ShiftLeft'] : []; if (i - p0 > 20) { phase = 'wait'; p0 = i; } }
        await H('setKeys', keys);
      }, (st, i) => phase === 'wait' && i - p0 > 6 * fps, { keyFrames: [0, 60, 200, 330, 400, 460, 560, 700] });
      const aura = tl.filter(r => r.phase === 'aura');
      const end = await H('state');
      summary.K = { auraMaxSeal: Math.max(...aura.map(r => r.seal)), auraLatched: aura.some(r => r.lit), latched: end.seedwells[0].lit,
        latchedAtS: (() => { const r = tl.find(q => q.lit); const d = tl.find(q => q.phase === 'dash'); return r && d ? Number((r.t - d.t).toFixed(2)) : null; })(), shades: end.chem.shades, deaths: end.deaths };
      save('kiln-timeline.json', tl);
    }
    save('updraft-acceptance.json', summary);
    console.log('UPDRAFT', JSON.stringify(summary));
  }
  if (wants('marshmouth')) {
    for (const variant of ['aura', 'dash']) for (let trial = 1; trial <= 3; trial++) {
      await boot(quality, true);
      await captureMarshMouth({ H, advance, shot, video, save, page, fps, report }, variant, trial);
    }
  }
  if (wants('windgap')) {
    await boot(quality, true);
    await captureWindGap({ H, advance, shot, video, save, page, fps, report });
  }
  if (wants('levels')) {
    await boot(quality, true);
    await captureLevels({ H, advance, shot, video, save, page, fps, quality, report });
  }
  if (wants('wind')) {
    // Wind river acceptance (world-1.md §3.3 beat 6): SW1 latched → ride H2 up, glide into the river, land on the arena rim.
    await boot(quality, true);
    await page.addStyleTag({ content: '#hud > :not(#vignette), .lil-gui { visibility: hidden !important; }' });
    await H('lightSeedwells'); await advance(240, false);
    const st0 = await H('state');
    const h2 = st0.chem.hearths.find(h => h.id === 'H2');
    const [hx, hy, hz] = h2.pos;
    // stand 1.6 m west of H2 facing east (along the river's first leg)
    const yawE = Math.atan2(1, 0.45);
    await H('teleport', hx - 1.6, 20, hz - 0.7, yawE); await advance(30);
    let phase = 'jump', t0 = 0;
    const tl = [];
    await video('wind-river', 26 * fps, async i => {
      const st = await H('state');
      tl.push({ i, pos: st.pos, vel: st.vel, gliding: st.gliding, grounded: st.grounded, wind: st.chem.wind[0] });
      let keys = [];
      if (phase === 'jump') { keys = ['KeyD', 'Space']; if (i > 4) phase = 'rise'; }
      else if (phase === 'rise') { keys = ['Space']; if (st.pos[1] > 27 || (st.vel[1] < 0.5 && i > 60)) { phase = 'ride'; t0 = i; } }
      else if (phase === 'ride') { keys = ['KeyW', 'Space']; if (st.grounded) phase = 'landed'; }
      await H('setKeys', keys);
    }, (st, i) => phase === 'landed' && i > 30, { keyFrames: [0, 60, 150, 300, 450, 600, 750, 900] });
    const end = await H('state');
    const peak = Math.max(...tl.map(r => r.pos[1]));
    const landedArena = end.grounded && Math.hypot(end.pos[0], end.pos[2] + 60) < 20 && end.pos[1] > 10;
    const summary = { end: end.pos, grounded: end.grounded, landedArena, peak, wind: end.chem.wind, rideFrames: tl.length - t0 };
    save('wind-acceptance.json', summary); save('wind-timeline.json', tl.filter((_, k) => k % 10 === 0));
    console.log('WIND', JSON.stringify(summary));
    await H('setKeys', []);
  }
  if (wants('growth')) {
    // Growth element acceptance (docs/design/world-1.md §1.3, §1.5): Creek Root bridge over the creek gorge.
    // X: stand by the cold knot, follow the growth front across (never ahead of it), watch hold → warning → wither.
    // R: stop mid-bridge past the hold: the occupied root must be retained (no fall), then wither once off it.
    // D: dash along the knot from cold, walk away: grown + lit time.
    await boot(quality, true);
    await page.addStyleTag({ content: '#hud > :not(#vignette), .lil-gui { visibility: hidden !important; }' });
    const rootOf = st => st.chem.growth.roots.find(r => r.id === 'creek');
    const r0 = rootOf(await H('state'));
    const [kx, ky, kz] = r0.knot;
    const path = await page.evaluate(() => window.__gameHooks.chem.growth.roots.find(r => r.spot.id === 'creek').curve.getSpacedPoints(48).map(p => [p.x, p.y, p.z]));
    const summary = { root: r0, X: {}, R: {}, D: {} };
    const side = [[kx - 7.5, ky + 3.4, kz + 1.5], [kx + 0.8, ky - 0.6, kz - 7], 50];
    const high = [[kx - 6, ky + 9, kz + 6], [kx + 0.8, ky - 1.5, kz - 6.5], 50];
    const start = [kx + 1.3, ky, kz + 1.4];
    await H('teleport', start[0] - 6, ky, start[2] + 6, Math.PI); await H('photo', ...high); await advance(30); await shot('growth-still-cold');
    // steer: world-space stick toward the path, holding ≥ gap m behind the front; stop = hold position
    const nearest = (x, z) => { let bi = 0, bd = Infinity; path.forEach(([px, , pz], i) => { const d = (px - x) ** 2 + (pz - z) ** 2; if (d < bd) { bd = d; bi = i; } }); return bi; };
    const segLen = r0.length / (path.length - 1);
    async function follow(st, gap, holdAtS = Infinity) {
      const r = rootOf(st), [x, , z] = st.pos;
      const i = nearest(x, z), foxS = i * segLen;
      const onIt = Math.hypot(path[i][0] - x, path[i][2] - z) < 0.9 && i > 0;
      if (!onIt && i === 0) { const [tx, , tz] = path[1]; const d = Math.hypot(tx - x, tz - z); if (r.front < gap + 1.2) return H('setStick', 0, 0); return H('setStick', (tx - x) / d, (tz - z) / d); }
      if (foxS >= holdAtS) return H('setStick', 0, 0);
      if (foxS > r.front - gap && r.front < r.length) return H('setStick', 0, 0);
      const j = Math.min(path.length - 1, i + 3), [tx, , tz] = j === path.length - 1 && i >= path.length - 3 ? [path.at(-1)[0] + 0.3, 0, path.at(-1)[2] - 2.5] : path[j];
      const d = Math.hypot(tx - x, tz - z) || 1;
      return H('setStick', (tx - x) / d * 0.75, (tz - z) / d * 0.75);
    }
    for (const variant of ['X', 'R']) {
      await H('teleport', ...start, Math.PI); await H('photo', ...side); await advance(20);
      const tl = [], keyFrames = [0];
      let crossed = -1, onBridge = -1, mark = {};
      const name = variant === 'X' ? 'growth-cross' : 'growth-retain';
      await video(name, (variant === 'X' ? 16 : 20) * fps, async i => {
        const st = await H('state'), r = rootOf(st);
        tl.push({ i, t: st.t, pos: st.pos, grounded: st.grounded, heat: r.heat, state: r.state, front: r.front, wither: r.wither, retained: r.retained, cols: r.collidersOn, deaths: st.deaths });
        const tag = (k, cond) => { if (cond && mark[k] === undefined) { mark[k] = i; keyFrames.push(i); } };
        tag('lit', r.heat > 0.5); tag('third', r.grown > 0.34); tag('twoThirds', r.grown > 0.67); tag('grown', r.grown >= 1);
        tag('warn', r.state === 'guttering'); tag('wither', r.wither > 0.5); tag('witherHalf', r.wither > r.length * 0.5);
        if (onBridge < 0 && r.retained) { onBridge = i; keyFrames.push(i); }
        if (crossed < 0 && st.pos[2] < path.at(-1)[2] - 0.5 && st.grounded) { crossed = i; keyFrames.push(i); }
        if (variant === 'X') await follow(st, 1.4);
        else if (mark.grown === undefined || i - mark.grown < 8 * fps) await follow(st, 1.4, r0.length * 0.5);
        else await follow(st, 0);
      }, (st, i) => variant === 'X' ? crossed > 0 && rootOf(st).front === 0 && i - crossed > 30 : crossed > 0 && rootOf(st).front === 0 && i - crossed > 30, { keyFrames, label: (f, st) => st ? `${name} f${f} heat=${rootOf(st).heat.toFixed(2)} ${rootOf(st).state} front=${rootOf(st).front.toFixed(1)} wither=${rootOf(st).wither.toFixed(1)}${rootOf(st).retained ? ' RETAINED' : ''}` : `${name} f${f}` });
      await H('setStick', null);
      const lit = tl.find(r => r.heat > 0), grown = tl.find(r => r.front >= r0.length - 0.01), warn = tl.find(r => r.state === 'guttering'), gone = tl.find(r => warn && r.t > warn.t && r.front === 0);
      const offBridge = tl.filter(r => !r.retained && r.grounded && r.pos[1] < ky - 1.5);
      summary[variant] = {
        growS: lit && grown ? Number((grown.t - lit.t).toFixed(2)) : null,
        holdS: grown && warn ? Number((warn.t - grown.t).toFixed(2)) : null,
        warnS: warn ? Number(((tl.find(r => r.t > warn.t && r.wither > 0)?.t ?? NaN) - warn.t).toFixed(2)) : null,
        witherS: gone ? Number((gone.t - (tl.find(r => r.wither > 0)?.t ?? gone.t)).toFixed(2)) : null,
        maxRetainedS: Number((tl.filter(r => r.retained).length / fps).toFixed(2)),
        fellIntoGorge: offBridge.length > 0, crossedAtFrame: crossed, deaths: tl.at(-1)?.deaths,
        minLeadM: Math.min(...tl.filter(r => r.retained && r.front < r0.length).map(r => r.front - nearest(r.pos[0], r.pos[2]) * segLen)),
      };
      save(`${name}-timeline.json`, tl);
      await H('photoOff'); await advance(240, false);
    }
    { // D: dash along the cold knot, keep going; lit/grown timeline
      await H('teleport', kx + 5, ky, kz + 0.4, -Math.PI / 2); await advance(30);
      const tl = [];
      for (let i = 0; i < 12 * 60; i++) {
        const st = await H('state'), r = rootOf(st);
        await H('setStick', i < 200 ? -1 : 0, 0);
        if (i === 14) await H('setKeys', ['ShiftLeft']); else if (i === 16) await H('setKeys', []);
        await H('advance', 1, 1 / 60, false);
        tl.push({ t: st.t, heat: r.heat, state: r.state, supply: r.supply, front: r.front });
      }
      await H('setStick', null);
      const lit = tl.filter(r => r.heat > 0);
      summary.D = { litS: lit.length ? Number((lit.at(-1).t - lit[0].t).toFixed(2)) : 0, grew: Math.max(...tl.map(r => r.front)), suppliedS: Number((tl.filter(r => r.supply >= 0.3).length / 60).toFixed(2)) };
      await advance(400, false);
    }
    // lit + grown stills, then the debug view of colliders/probes
    await H('teleport', kx + 1.2, ky, kz + 1.1, Math.PI); await advance(6 * 60, false);
    await H('photo', ...high); await advance(2); await shot('growth-still-grown');
    await H('photo', ...side); await advance(2); await shot('growth-still-grown-side');
    await page.evaluate(() => document.body.classList.add('debug-on')); await advance(2); await shot('growth-still-debug');
    await page.evaluate(() => document.body.classList.remove('debug-on')); await H('photoOff');
    save('growth-acceptance.json', summary);
    console.log('GROWTH', JSON.stringify(summary));
  }
  if (wants('route')) {
    await boot(quality, true);
    const route = await H('route');
    save('route-waypoints.json', route);
    const from = Number(arg('route-from', '0')), requestedTo = Number(arg('route-to', '-1'));
    const regional = from > 0 || requestedTo >= 0, to = requestedTo < 0 ? route.length : requestedTo;
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || from >= to || to > route.length) throw Error('Invalid route waypoint interval');
    if (regional) {
      const wp = route[from];
      const floor = await page.evaluate(p => window.__gameHooks.debug.world.collision.groundAt(p.x, p.z, p.y + .5).y, wp);
      if (!Number.isFinite(floor) || wp.ground === false || floor < wp.y - 1) throw Error('Regional route start must be a walkable waypoint');
      await H('teleport', wp.x, floor, wp.z, Math.PI);
      await advance(3, false);
    }
    save('route-plan.json', { from, to, label: regional ? 'Staged regional start; real unassisted traversal; does not prove realm completion' : 'Full unassisted restoration route' });
    await H('autopilot', true, from, { assist: false });
    let restoredAt;
    const name = regional ? `route-segment-staged-${from}-${to}` : 'route-unassisted';
    const state = await video(name, Number(arg('route-seconds', '360')) * fps, async () => {}, (st, i) => {
      if (regional) return st.auto.idx >= to || !st.auto.active;
      if (st.restored && restoredAt === undefined) restoredAt = i;
      return restoredAt !== undefined && i - restoredAt >= 11 * fps || !st.auto.active && !st.restored;
    });
    await H('autopilot', false, state.auto.idx, { assist: false }); await shot('route-end');
    if ((regional ? state.auto.idx < to : !state.restored) || state.auto.assists || state.deaths) report.failures.push(`Route incomplete or assisted: ${JSON.stringify(state.auto)}, restored=${state.restored}, deaths=${state.deaths}, interval=${from}-${to}`);
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
      // Open meadow between the portal (z85) and broken arch (z64).
      const reviewY = await page.evaluate(() => window.__gameHooks.debug.world.collision.highestAt(6, 78));
      await H('teleport', 6, reviewY, 78, Math.PI);
      await advance(60, false);
      const p = await H('getFoxPos'), at = [p.x, p.y + 0.5, p.z];
      await page.addStyleTag({ content: '#hud > :not(#vignette), .lil-gui { visibility: hidden !important; }' });
      // fox faces -Z at yaw PI: "front" camera sits on -Z
      const views = { front: [0, 0.6, -5.2, 30], three_q: [3.5, 0.7, -4.0, 30], side: [-5.6, 0.55, 0, 30],
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
  if (wants('turntable')) {
    // Character turntable: idle fox, camera orbits once at a fixed radius (restored grade).
    await boot(quality, true); await H('forceRestore'); await advance(660, false);
    const turntableY = await page.evaluate(() => window.__gameHooks.debug.world.collision.highestAt(6, 78));
    await H('teleport', 6, turntableY, 78, Math.PI); await advance(60, false);
    const p = await H('getFoxPos'), n = 8 * fps;
    await video('fox-turntable', n, async i => {
      const a = i / n * Math.PI * 2;
      await H('photo', [p.x + Math.sin(a) * 3.4, p.y + 0.75, p.z - Math.cos(a) * 3.4], [p.x, p.y + 0.5, p.z], 34);
    });
  }
} catch (e) { report.failures.push(String(e.stack || e)); throw e; }
finally {
  report.errors = errors; report.qualityLog = log;
  save('report.json', report); save('perf.json', report.perf);
  if (browser) await browser.close();
  server.close();
}
if (report.failures.length || errors.length) { console.error('CAPTURE FAILURES', report.failures, errors); process.exitCode = 1; }
