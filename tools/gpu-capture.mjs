import { captureFinale } from './finale-capture.mjs';
/** Modal-only hardware GL capture; see tools/modal/gpu_capture.py for entrypoint. */
import { chromium } from 'playwright';
import { captureLevels } from './levels-capture.mjs';
import { captureWindGap } from './windgap-capture.mjs';
import { captureMarshMouth } from './marshmouth-capture.mjs';
import { captureReed } from './reed-capture.mjs';
import { captureReedEntry } from './reed-entry-capture.mjs';
import { captureReedAftermath } from './reed-aftermath-capture.mjs';
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
    page.on('console', m => { if (!m.text().includes('toNonIndexed')) console.log('BROWSER', m.type(), m.text()); if (m.type() === 'error' || m.text().includes('Mismatch between texture format and sampler type')) { if (!errors.includes(m.text())) errors.push(m.text()); } if (m.text().startsWith('[quality]')) { log.push(m.text()); console.log(m.text()); } });
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
    if (name.startsWith('reachview-')) {
      // Validate the snapshot belonging to this PNG, after its staged teleport/lens.
      // This observes the same simulated water; it never sets a puzzle state.
      const { reach, reachMood } = report.shots[name].state;
      const expectedLevel = name.startsWith('reachview-low-') ? 'low' : 'high';
      const fillMatches = Number.isFinite(reach?.fill) && (expectedLevel === 'high' ? reach.fill >= .99 : reach.fill <= .02);
      const checks = {
        expectedLevel,
        actualLevel: reach?.level,
        fill: reach?.fill,
        moodWeight: reachMood?.k,
        waterMatches: reach?.level === expectedLevel && fillMatches,
        moodMatches: reachMood?.k === 1,
      };
      save(`${name}-acceptance.json`, checks);
      if (!checks.waterMatches) report.failures.push(`${name}: labelled ${expectedLevel.toUpperCase()} water state does not match PNG snapshot`);
      if (!checks.moodMatches) report.failures.push(`${name}: Reach mood is not fully blended at photo position`);
    }
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
        const cards = options.keyFrames.filter(frame => frame < count).map(frame => {
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
    const reviewCenter=await page.evaluate(()=>{
      const points=window.__gameHooks.debug.world.shadeSpots[0].patrol;
      return points.reduce((sum,p)=>[sum[0]+p[0]/points.length,sum[1]+p[2]/points.length],[0,0]);
    });
    let lens = null;
    const camera = async (actorId=actors[0].id) => {
      const framing=await page.evaluate(({previous,actorId})=>{
        const h=window.__gameHooks,actor=h.shades.state().actors.find(a=>a.id===actorId),fox=h.debug.fox.position;
        const [x,y,z]=actor.pos,fy=fox.y-(h.debug.foxFeetOffset??.02),V=fox.constructor;
        const dx=fox.x-x,dz=fox.z-z,d=Math.hypot(dx,dz)||1,ux=dx/d,uz=dz/d;
        const look=[x*.35+fox.x*.65,(y+(actor.height||3.1)*.5)*.35+(fy+(h.debug.foxHeight||1.25)*.5)*.65,z*.35+fox.z*.65];
        const side=Math.atan2(ux,-uz);
        const angles=[side-.65,side+Math.PI+.65,...[0,1,2,3,4,5,6,7].map(k=>k*Math.PI/4)];
        const positions=[...(previous?[previous]:[]),...angles.map(a=>[look[0]+Math.cos(a)*6,Math.max(y,fy)+2.5,look[2]+Math.sin(a)*6])];
        const testCamera=h.debug.camera.clone();
        const point=new V(),right=new V();
        let fallback=null;
        for(const pos of positions){
          let clearance;
          for(const fov of [48,52,56]){
          testCamera.position.fromArray(pos);testCamera.fov=fov;testCamera.lookAt(new V(...look));testCamera.updateProjectionMatrix();testCamera.updateMatrixWorld(true);
          right.setFromMatrixColumn(testCamera.matrixWorld,0);
          const bounds=(px,py,pz,height,width)=>{
            let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
            for(const side of [-1,1])for(const up of [0,height]){
              point.set(px,py+up,pz).addScaledVector(right,side*width/2).project(testCamera);
              minX=Math.min(minX,point.x);maxX=Math.max(maxX,point.x);minY=Math.min(minY,point.y);maxY=Math.max(maxY,point.y);
            }
            return {height:(maxY-minY)/2,inFrame:minX>-.94&&maxX<.94&&minY>-.94&&maxY<.94,bounds:[minX,maxX,minY,maxY]};
          };
          const foxBounds=bounds(fox.x,fy,fox.z,h.debug.foxHeight||1.25,2.8),shadeBounds=bounds(x,y,z,actor.height||3.1,2.4);
          const a=foxBounds.bounds,b=shadeBounds.bounds;
          const shared=Math.max(0,Math.min(a[1],b[1])-Math.max(a[0],b[0]))*Math.max(0,Math.min(a[3],b[3])-Math.max(a[2],b[2]));
          const overlap=shared/Math.max(1e-6,Math.min((a[1]-a[0])*(a[3]-a[2]),(b[1]-b[0])*(b[3]-b[2])));
          const fits=foxBounds.height>.19&&shadeBounds.height>.18&&foxBounds.inFrame&&shadeBounds.inFrame&&overlap<.3;
          if(!fits)continue;
          clearance??=!h.photoBlocker||(!h.photoBlocker(pos,[x,y+1.3,z])&&!h.photoBlocker(pos,[fox.x,fy+.6,fox.z]));
          const clear=clearance;
          const result={pos,look,fov,clear,noFit:false,overlap,fox:foxBounds,shade:shadeBounds};
          fallback??=result;
          if(clear)return result;
          }
        }
        return fallback||{pos:positions[1]||positions[0],look,fov:56,clear:false,noFit:true};
      },{previous:lens,actorId});
      lens=framing.pos;
      report.shadeReviewQuality??={};
      const counts=report.shadeReviewQuality[actorId]??={noFit:0,occluded:0};
      if(framing.noFit)counts.noFit++;else if(!framing.clear)counts.occluded++;
      await H('photo',framing.pos,framing.look,framing.fov);
    };
    const measurePair=async actorId=>page.evaluate(id=>{
      const h=window.__gameHooks,actor=h.shades.state().actors.find(a=>a.id===id),V=h.debug.fox.position.constructor;
      const point=new V();
      const bounds=(root,skinnedOnly)=>{
        if(!root)return null;
        root.updateWorldMatrix(true,true);
        let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity,minZ=Infinity,maxZ=-Infinity,vertices=0;
        root.traverse(mesh=>{
          if(!mesh.isMesh||(skinnedOnly&&!mesh.isSkinnedMesh))return;
          let ancestor=mesh;while(ancestor){if(!ancestor.visible)return;ancestor=ancestor.parent;}
          const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
          if(materials.every(m=>!m.visible||m.opacity===0))return;
          if(skinnedOnly&&/spirit[_-]?fx|wisps?|ember[_-]?wisp|smoulder|flame|spark|lick/i.test(mesh.name+' '+materials.map(m=>m.name).join(' ')))return;
          if(mesh.isSkinnedMesh)mesh.skeleton.update();
          for(let k=0;k<mesh.geometry.attributes.position.count;k++){
            mesh.getVertexPosition(k,point).applyMatrix4(mesh.matrixWorld).project(h.debug.camera);
            minX=Math.min(minX,point.x);maxX=Math.max(maxX,point.x);minY=Math.min(minY,point.y);maxY=Math.max(maxY,point.y);minZ=Math.min(minZ,point.z);maxZ=Math.max(maxZ,point.z);vertices++;
          }
        });
        return vertices?{heightFraction:(maxY-minY)/2,inFrame:minX>=-1&&maxX<=1&&minY>=-1&&maxY<=1&&minZ>=-1&&maxZ<=1,vertices,bounds:[minX,maxX,minY,maxY]}:null;
      };
      const core=h.debug.scene.getObjectByName(id)?.getObjectByName('shade-density-core');
      return {actorId:id,freed:actor.freed,method:'posed mesh vertices, shader displacement/alpha excluded',fox:bounds(h.debug.fox,true),shade:bounds(core,false),shadePresent:!actor.freed||actor.presence>.5,presence:actor.presence};
    },actorId);
    const pairOptions=(name,id,keyFrames)=>({traceEveryFrame:true,keyFrames,sample:frame=>keyFrames.includes(frame)?measurePair(id):undefined,label:(frame,state)=>{
      const p=state?.capture;
      return `${id} f${frame} p${p?.presence??'?'} fox ${p?.fox?(p.fox.heightFraction*100).toFixed(0):'?'}% shade ${p?.shade?(p.shade.heightFraction*100).toFixed(0):'?'}%`;
    }});
    const validatePair=name=>{
      const rows=report.videos[name].trace.filter(row=>row.state.capture?.shadePresent).map(row=>({frame:row.frame,...row.state.capture}));
      const failed=rows.filter(row=>!row.fox||!row.shade||row.fox.heightFraction<=.15||row.shade.heightFraction<=.15||!row.fox.inFrame||!row.shade.inFrame);
      save(`${name}-framing.json`,{passed:rows.length>0&&failed.length===0,minimumHeightFraction:.15,rows,failedFrames:failed.map(row=>row.frame)});
      if(!rows.length||failed.length)report.failures.push(`Shade pair framing below director bar in ${name}: ${JSON.stringify(failed.map(row=>({frame:row.frame,fox:row.fox,shade:row.shade})))}`);
    };
    const start = actors[0].pos;
    const safePosition = await page.evaluate(({start:[x,y,z],center:[cx,cz],actorId}) => {
      const col = window.__gameHooks.debug.world.collision;
      const patrol=window.__gameHooks.debug.world.shadeSpots[0].patrol;
      const guide=window.__gameHooks.debug.scene.getObjectByName(actorId+'-patrol-guide')?.children[0]?.geometry?.attributes.position;
      const samples=guide?Array.from({length:guide.count},(_,k)=>[guide.getX(k),guide.getZ(k)]):patrol.map(p=>[p[0],p[2]]);
      const clearance=window.__gameHooks.shades.tun.hitRadius+.65;
      let best=null,bestDistance=Infinity;
      for(let px=cx-5;px<=cx+5;px+=.25)for(let pz=cz-5;pz<=cz+5;pz+=.25){
        if(Math.hypot(px-cx,pz-cz)>4.8)continue;
        if(col.blocked(px,pz,y)||Math.abs(col.groundAt(px,pz,y+.1).y-y)>.2)continue;
        const distance=Math.hypot(px-x,pz-z);
        if(distance<bestDistance&&samples.every(q=>Math.hypot(q[0]-px,q[1]-pz)>clearance)){best=[px,y,pz];bestDistance=distance;}
      }
      if(best)return best;
      throw Error('No safe patrol observer position');
    }, {start,center:reviewCenter,actorId:actors[0].id});
    const observerYaw = Math.atan2(start[0]-safePosition[0],start[2]-safePosition[2]);
    await H('teleport', ...safePosition, observerYaw);
    await camera();
    await advance(0);
    await shot('shade-preview-before-rule-probes');
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
      const source=h.chem.updrafts.hearths[0].reactor;
      const reactor=new source.constructor('shade-rule-probe','hearth',[pos],source.tun);
      reactor.update(source.tun.igniteTime,()=>1,()=>true);
      reactor.update(.1,()=>0,()=>true);
      const gutter={state:reactor.state,holdLeft:reactor.holdLeft,heat:reactor.heat};
      reactor.restored=true;reactor.update(1,()=>0,()=>true);
      const restored={state:reactor.state,heat:reactor.heat};

      return {label:'Isolated public colour-field rule probe; staged aura/stroke samples, restored immediately; no encounter release forced',aura,strong,spent,gutter,restored};
    });
    if(rules.aura.raw<.9||rules.aura.supplied!==0||rules.strong.supplied!==1||rules.spent.supplied!==0||rules.gutter.holdLeft!==0||rules.gutter.state!=='guttering'||rules.restored.heat!==1||rules.restored.state!=='restored')throw Error(`Shade colour rules failed ${JSON.stringify(rules)}`);
    save('shade-colour-rules.json',rules);

    // Isolate patrol observation from attraction; restore the authored tuning before pursuit.
    const chaseDistance = await page.evaluate(() => {
      const tun=window.__gameHooks.shades.tun, old=tun.chaseDistance;
      if(typeof old==='number')tun.chaseDistance=0;
      return old;
    });
    await camera();
    await page.addStyleTag({content:'#hud > :not(#vignette), .lil-gui { visibility: hidden !important; }'});
    const originalDensity=await page.evaluate(()=>window.__gameHooks.shades.tun.inkDensity);
    if(typeof originalDensity==='number'){
      await H('advance',1,0,true);
      const pose=await H('state');
      const variants=[];
      const setDensity=async value=>page.evaluate(value=>{
        const h=window.__gameHooks;h.shades.tun.inkDensity=value;
        for(const actor of h.shades.state().actors)h.debug.scene.getObjectByName(actor.id)?.traverse(mesh=>{
          if(!mesh.isMesh)return;
          for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])if(material.uniforms?.uDensity)material.uniforms.uDensity.value=value;
        });
      },value);
      try{
        for(const density of [2,3,4]){
          await setDensity(density);
          await advance(0);
          const shotName=`shade-density-${density}`;
          await shot(shotName);variants.push({density,shot:shotName,framing:await measurePair(actors[0].id)});
        }
      }finally{
        await setDensity(originalDensity);
        await advance(0);
      }
      save('shade-density-variants.json',{label:'Same pose/time/camera, core absorption only; variants are not acceptance',chosenDefault:originalDensity,pose:{time:pose.t,fox:pose.pos,foxYaw:pose.foxYaw},variants});
    }
    await video('shade-patrol', 120, ()=>camera(), undefined, pairOptions('Patrol',actors[0].id,[0,30,60,90,119]));
    validatePair('shade-patrol');
    if((await page.evaluate(()=>window.__gameHooks.shades.state())).hits!==0)throw Error('Patrol observer was hit');
    await page.evaluate(value => { if(typeof value==='number')window.__gameHooks.shades.tun.chaseDistance=value; }, chaseDistance);
    if(typeof chaseDistance==='number') {
      save('shade-behavior-staging.json', {label:'10-second staged observer placement; live modes, terrain checks and attraction; no forced actor state', nearFrames:[90,300]});
      const transitions=[];
      let missingObserver=false;
      await video('shade-behavior', 600, async frame => {
        if(frame%15===0) {
          const observer = await page.evaluate(near => {
            const h=window.__gameHooks, actor=h.shades.state().actors[0];
            const [x,y,z]=actor.pos, col=h.debug.world.collision;
            const radii=near?[2.9]:[4.8,4.3,5.3,5.5];
            for(const radius of radii)for(let k=0;k<64;k++) {
              const a=k/64*Math.PI*2,px=x+Math.cos(a)*radius,pz=z+Math.sin(a)*radius;
              const floor=col.groundAt(px,pz,y+.5).y;
              if(Number.isFinite(floor)&&Math.abs(floor-y)<.3&&!col.blocked(px,pz,floor))
                return {pos:[px,floor,pz,Math.atan2(x-px,z-pz)],mode:actor.mode};
            }
            return null;
          },frame>=90&&frame<300);
          if(!observer){
            if(!missingObserver)report.failures.push('No safe staged shade behavior observer; release diagnostics continue');
            missingObserver=true;
          }else{
            if(transitions.at(-1)?.mode!==observer.mode)transitions.push({frame,mode:observer.mode});
            await H('teleport',...observer.pos);
          }
        }
        await camera();
      },undefined,pairOptions('Behavior',actors[0].id,[0,89,180,299,390,480,599]));
      validatePair('shade-behavior');
      const behavior=await page.evaluate(()=>window.__gameHooks.shades.state());
      save('shade-behavior-state.json',{transitions,state:behavior});
      const expected=['patrol','chase','return','patrol'];
      let observed=0;
      for(const transition of transitions)if(transition.mode===expected[observed])observed++;
      if(observed!==expected.length)report.failures.push(`Missing ordered live shade behavior cycle ${JSON.stringify(transitions)}`);
      if(behavior.hits!==0)report.failures.push('Staged behavior observer was hit');
    }
    await H('photoOff');
    await advance(30);
    await shot('shade-post-observer');
    // A separate fresh session preserves the actual sepia-to-local-color release moment.
    await boot(quality,true);lens=null;
    save('shade-release-session-start.json',{label:'Fresh sepia session after behavior review; the next two dash releases share this session, with staged fox starts only',state:await H('state'),game:await page.evaluate(()=>window.__game)});
    await H('setKeys', []);
    let p = (await page.evaluate(() => window.__gameHooks.shades.state().actors[0])).pos;
    const contactSetup = await page.evaluate(([x,y,z]) => {
      const col = window.__gameHooks.debug.world.collision;
      for (let k=0;k<128;k++) {
        const a=k/128*Math.PI*2, dx=Math.cos(a), dz=Math.sin(a);
        let safe=true;
        for(let r=.4;r<4.8&&safe;r+=.1) for(const width of [-.35,0,.35]) {
          const px=x+dx*r-dz*width,pz=z+dz*r+dx*width;
          if(col.blocked(px,pz,y)||Math.abs(col.groundAt(px,pz,y+.1).y-y)>.2) { safe=false; break; }
        }
        if(safe)return {pos:[x+dx*1.45,y,z+dz*1.45], direction:[dx,dz]};
      }
      throw Error('No 3m wall-free contact direction');
    }, p);
    save('shade-contact-setup.json', contactSetup);
    await H('teleport', ...contactSetup.pos, Math.atan2(-contactSetup.direction[0],-contactSetup.direction[1]));
    lens=null;
    await camera();
    let contactFrame=null;
    await H('setStick', -contactSetup.direction[0], -contactSetup.direction[1]);
    await video('shade-contact', 110, async i => {
      const current=await page.evaluate(()=>window.__gameHooks.shades.state());
      if(current.hits>0&&contactFrame===null){
        contactFrame=i-1;await H('setStick',null);
        const state=await H('state'),actor=current.actors[0];
        const dx=state.pos[0]-actor.pos[0],dz=state.pos[2]-actor.pos[2],length=Math.hypot(dx,dz)||1;
        save('shade-contact-impact.json',{frame:contactFrame,fox:state.pos,actor:actor.pos,direction:[dx/length,dz/length],planned:contactSetup.direction,angleDegrees:Math.acos(Math.max(-1,Math.min(1,(dx*contactSetup.direction[0]+dz*contactSetup.direction[1])/length)))*180/Math.PI});
      }
      await camera();
    }, (state,i)=>contactFrame!==null&&i>=contactFrame+61, { traceEveryFrame: true, keyFrames: [0, 6, 12, 18, 36, 60] });
    await H('setStick', null);
    const contact = await page.evaluate(() => window.__gameHooks.shades.state());
    const shadeContactFailures=[];
    const contactFailure=contact.hits !== 1 || contact.wisps !== 2 || contact.knockbackTravel < 2.9 || contact.knockbackTravel > 3.1 ? `Shade contact failed: ${JSON.stringify(contact)}` : null;
    if(contactFailure){shadeContactFailures.push(contactFailure);report.failures.push(contactFailure);}
    save('shade-contact-acceptance.json',{passed:!contactFailure,failure:contactFailure,contact,label:'Strict contact gate retained; release diagnostics continue before final failure'});
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
    const dashControllerBefore=await H('state');
    await H('setStick', ...dashSetup.direction);
    await H('setKeys', ['ShiftLeft']);
    lens=null;
    await camera();
    const dashControllerAfter=await video('shade-free', 120, async i => {
      if (i === 12) { await H('setKeys', []); await H('setStick', null); }
      await camera();
    }, undefined, pairOptions('Release',actors[0].id,[0,5,12,24,45,75,119]));
    validatePair('shade-free');
    save('shade-dash-controller.json',{before:dashControllerBefore.dash,after:dashControllerAfter.dash,label:'Actual controller activation; collisionActiveLastStep is the preceding simulated movement tick'});
    if(dashControllerBefore.dash&&dashControllerAfter.dash.used<=dashControllerBefore.dash.used)throw Error(`Shade dash input never activated controller ${JSON.stringify(dashControllerAfter.dash)}`);
    const freed = await page.evaluate(() => window.__gameHooks.shades.state());
    if (freed.frees !== 1 || !freed.actors[0].freed || freed.hits !== contact.hits || freed.wisps < contact.wisps) throw Error(`Shade freeing failed: ${JSON.stringify(freed)}`);
    // The original baseline predates the release wash; only the new attraction-enabled candidate owes this assertion.
    if(typeof chaseDistance==='number') {
      const wash=await page.evaluate(()=>{
        const h=window.__gameHooks,actor=h.shades.state().actors[0],field=h.debug.colorField;
        const stroke=field.strokes.find(s=>Math.abs(s.radius-h.shades.tun.drainRadius)<.001&&Math.abs(s.strength-1.2)<.001&&Math.hypot(s.a.x-actor.pos[0],s.a.z-actor.pos[2])<.05);
        return stroke?{life:stroke.life,strength:field.strokeStrength(stroke),radius:stroke.radius,center:stroke.a.toArray()}:null;
      });
      save('shade-release-wash.json',wash);
      if(!wash||wash.life<3.8||wash.strength<1)throw Error(`Missing six-second shade release wash ${JSON.stringify(wash)}`);
    }
    await shot('shade-wash-normal');
    const occlusionSaved=await page.evaluate(()=>{
      const h=window.__gameHooks,saved=[],seen=new Set();
      h.debug.scene.traverse(o=>{
        if(!o.isMesh)return;
        for(const material of Array.isArray(o.material)?o.material:[o.material]){
          const uniform=h.debug.renderer.properties.get(material).uniforms?.uOccStrength;
          if(uniform&&!seen.has(uniform)){seen.add(uniform);saved.push({material:material.uuid,value:uniform.value});}
        }
      });
      return saved;
    });
    const applyOcclusion=async saved=>page.evaluate(saved=>{
      const h=window.__gameHooks,values=new Map(saved.map(s=>[s.material,s.value])),actual=[];
      h.debug.scene.traverse(o=>{
        if(!o.isMesh)return;
        for(const material of Array.isArray(o.material)?o.material:[o.material])if(values.has(material.uuid)){
          const uniform=h.debug.renderer.properties.get(material).uniforms?.uOccStrength;
          if(uniform){uniform.value=values.get(material.uuid);actual.push({material:material.uuid,uniform});}
        }
      });
      h.debug.post.render();
      return actual.map(s=>({material:s.material,value:s.uniform.value}));
    },saved);
    try {
      await applyOcclusion(occlusionSaved.map(s=>({...s,value:0})));
      await shot('shade-wash-occlusion-disabled-diagnostic');
      save('shade-occlusion-isolation.json',{label:'Same simulation time, temporary renderer-uniform diagnostic only; zero touched or already-inactive uniforms is inconclusive',touched:occlusionSaved.length,inconclusive:!occlusionSaved.some(s=>s.value>.001),saved:occlusionSaved});
    } finally {
      const restored=await applyOcclusion(occlusionSaved);
      const matched=restored.length===occlusionSaved.length&&occlusionSaved.every(s=>restored.some(r=>r.material===s.material&&r.value===s.value));
      save('shade-occlusion-restore.json',{matched,restored});
      if(!matched)throw Error('Shade occlusion diagnostic did not restore exact uniform values');
    }
    await advance(180);
    await shot('shade-leaf-litter');
    await advance(600, false);
    if ((await page.evaluate(() => window.__gameHooks.shades.state().actors[0].leaves)) !== 0) throw Error('Leaf one-shot did not end empty');
    if (!(await page.evaluate(() => window.__gameHooks.shades.state().actors[0].freed))) throw Error('Shade respawned');
    await advance(0);
    await shot('shade-after-free');
    save('shade-acceptance.json', { passed:!contactFailure, releasePassed:true, contactFailures:[...shadeContactFailures], contact, freed, noRespawn: true, game: await page.evaluate(() => window.__game) });
    let edge = await page.evaluate(() => window.__gameHooks.shades.state().actors.find(a=>a.id==='shade-hill-high'));
    if(!edge || edge.freed)throw Error('No live high-hill Shade for clear encounter evidence');
    if(edge && !edge.freed){
      const approach=await page.evaluate(([x,y,z])=>{
        const col=window.__gameHooks.debug.world.collision;
        for(let k=0;k<128;k++){
          const a=k/128*Math.PI*2,dx=Math.cos(a),dz=Math.sin(a);let safe=true;
          for(let r=.55;r<4.6;r+=.1){const px=x+dx*r,pz=z+dz*r,fy=col.groundAt(px,pz,y+2.5).y;if(!Number.isFinite(fy)||Math.abs(fy-y)>2.4||col.blocked(px,pz,fy+.01)){safe=false;break;}}
          if(safe)return{pos:[x+dx*1.45,col.groundAt(x+dx*1.45,z+dz*1.45,y+2.5).y,z+dz*1.45],direction:[dx,dz]};
        }throw Error('No clear restored-edge contact lane');
      },edge.pos);
      const contactBefore=await page.evaluate(()=>window.__gameHooks.shades.state());
      await H('teleport',...approach.pos,0);
      const [cx,cy,cz]=edge.pos;
      await H('photo',[cx+5.5,cy+3.8,cz+5.5],[cx+approach.direction[0]*1.5,cy+1,cz+approach.direction[1]*1.5],48);
      await H('setStick',-approach.direction[0],-approach.direction[1]);let touch=null;
      await video('shade-clear-contact',110,async i=>{
        const state=await page.evaluate(()=>window.__gameHooks.shades.state());
        if(state.hits>contactBefore.hits&&touch===null){touch=i-1;await H('setStick',null);}
      },(_,i)=>touch!==null&&i>=touch+61,{traceEveryFrame:true,keyFrames:[0,6,12,18,36,60]});
      await H('setStick',null);
      const contactAfter=await page.evaluate(()=>window.__gameHooks.shades.state());
      const edgeFailure=contactAfter.hits!==contactBefore.hits+1||contactAfter.knockbackTravel<2.9?`Edge contact failed ${JSON.stringify(contactAfter)}`:null;
      if(edgeFailure){shadeContactFailures.push(edgeFailure);report.failures.push(edgeFailure);}
      save('shade-clear-contact-acceptance.json',{passed:!edgeFailure,failure:edgeFailure,approach,before:contactBefore,after:contactAfter});
      edge=await page.evaluate(()=>window.__gameHooks.shades.state().actors.find(a=>a.id==='shade-hill-high'));
      const setup=await page.evaluate(([x,y,z])=>{
        const col=window.__gameHooks.debug.world.collision;
        for(let k=0;k<128;k++){
          const a=k/128*Math.PI*2,dx=Math.cos(a),dz=Math.sin(a);let safe=true;
          for(let r=-2;r<3;r+=.1){const px=x+dx*r,pz=z+dz*r,fy=col.groundAt(px,pz,y+2.5).y;if(!Number.isFinite(fy)||Math.abs(fy-y)>2.4||col.blocked(px,pz,fy+.01)){safe=false;break;}}
          if(safe)return{pos:[x+dx*2.7,col.groundAt(x+dx*2.7,z+dz*2.7,y+2.5).y,z+dz*2.7],direction:[-dx,-dz],yaw:Math.atan2(-dx,-dz)};
        }throw Error('No safe restored-edge dash runway');
      },edge.pos);
      const before=await page.evaluate(()=>window.__gameHooks.shades.state());
      await H('teleport',...setup.pos,setup.yaw);
      const edgeControllerBefore=await H('state');
      await H('setStick',...setup.direction);await H('setKeys',['ShiftLeft']);
      lens=null;
      const edgeControllerAfter=await video('shade-clear-free',120,async i=>{if(i===12){await H('setKeys',[]);await H('setStick',null);}await camera('shade-hill-high');},undefined,pairOptions('Hill release','shade-hill-high',[0,5,12,24,36,48,75,119]));
      validatePair('shade-clear-free');
      save('shade-edge-dash-controller.json',{before:edgeControllerBefore.dash,after:edgeControllerAfter.dash});
      if(edgeControllerBefore.dash&&edgeControllerAfter.dash.used<=edgeControllerBefore.dash.used)throw Error(`Second Shade dash input never activated controller ${JSON.stringify(edgeControllerAfter.dash)}`);
      const after=await page.evaluate(()=>window.__gameHooks.shades.state());
      if(after.frees!==before.frees+1||after.hits!==before.hits||!after.actors.find(a=>a.id==='shade-hill-high')?.freed)throw Error(`Restored-edge dash failed ${JSON.stringify(after)}`);
      const releasedIds=after.actors.filter(a=>a.freed).map(a=>a.id);
      if(after.frees<2||releasedIds.length<2)throw Error(`Two distinct dash releases missing ${JSON.stringify(after)}`);
      save('shade-two-frees-acceptance.json',{passed:shadeContactFailures.length===0,releasePassed:true,contactFailures:[...shadeContactFailures],label:'Two staged fox teleports in the same session, distinct authored Shades freed by real controller dash; no forced actor release',first:freed,second:after,releasedIds,game:await page.evaluate(()=>window.__game)});
      await shot('shade-two-freed');
      await advance(180,false);await advance(0);await shot('shade-clear-litter');
      await advance(600,false);await advance(0);await shot('shade-clear-empty');
      const end=await page.evaluate(()=>window.__gameHooks.shades.state());
      if(end.actors.find(a=>a.id==='shade-hill-high').leaves!==0)throw Error('Edge dissolve did not end empty');
      save('shade-clear-acceptance.json',{passed:shadeContactFailures.length===0,releasePassed:true,contactFailures:[...shadeContactFailures],label:'Staged high-hill contact and real controller dash with clear exterior lens; no forced free',setup,before,after,end,game:await page.evaluate(()=>window.__game)});
    }
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


    // Stored contact failures survive later exceptions and keep the final process result failed.
  }
  if(wants('feel')) {
    await boot(quality,true);
    await page.addStyleTag({content:'.lil-gui,#hud{visibility:hidden!important}'});
    const y=await page.evaluate(()=>window.__gameHooks.debug.world.collision.highestAt(-1,80));
    await H('teleport',-1,y,80,Math.PI);await H('photoOff');await advance(30);
    const initial=await H('state');
    await video('feel',60*fps,async i=>{
      const st=await H('state'),t=i/fps,angle=t*.85;
      const target=[-1+Math.sin(angle+.6)*3,80+Math.cos(angle+.6)*3];
      const dx=target[0]-st.pos[0],dz=target[1]-st.pos[2],d=Math.hypot(dx,dz)||1;
      const speed=Math.min(.65,d/2);
      await H('setStick',dx/d*speed,dz/d*speed);
      const phase=t%10;
      await H('setKeys',phase<.35?['Space']:phase>5&&phase<5.06?['ShiftLeft']:[]);
    },undefined,{traceEveryFrame:true,keyFrames:Array.from({length:12},(_,i)=>i*5*fps)});
    await H('setKeys',[]);await H('setStick',null);
    const end=await H('state');
    save('feel-acceptance.json',{label:'60s scripted live-input movement loop, one staged start, no resets/forced poses; not human fun approval',seconds:60,initial,end,deaths:end.deaths-initial.deaths});
  }
  if (wants('showcase')) {
    await boot(quality,true);
    await page.addStyleTag({content:'.lil-gui,#hud{visibility:hidden!important}'});
    await H('photoOff');
    const n=Math.hypot(.684,.729),td=[-.684/n,-.729/n],tn=[.729/n,-.684/n];
    const sp=(s,t,y)=>[-48+td[0]*s+tn[0]*t,y,52+td[1]*s+tn[1]*t];
    const board=[.868243,-.496139];
    const segments=[
      {name:'Reedmarsh boardwalk walk',seconds:2,stick:board.map(v=>v*.18),reset:[62.5,.3,32.5]},
      {name:'Meadow path trot',seconds:2,stick:[0,-.45],reset:[0,null,82]},
      {name:'Meadow clearing gallop',seconds:2,stick:[0,-1],reset:[0,null,88]},
      {name:'Meadow carved turns',seconds:3,turn:true,reset:[0,null,80]},
      {name:'Meadow jump and recovery',seconds:2,stick:[0,-.45],jump:true,reset:[0,null,80]},
      {name:'Windmill entrance ascent',seconds:3,stick:td.map(v=>v*.18),reset:sp(-6,0,.1+1.9*.5/6.9)},
      {name:'Windmill slope jump and land',seconds:3,stick:td.map(v=>v*.18),jump:true,reset:sp(-4,0,.1+1.9*2.5/6.9)},
      {name:'Meadow dash',seconds:1,stick:[0,-1],dash:true,reset:[0,null,86]},
      {name:'Meadow brake and settle',seconds:2,stick:[0,0]},
      {name:'Meadow long drop and landing',seconds:2,stick:[0,0],reset:[0,null,80],drop:8,settle:0},
      {name:'Meadow standing gather and recovery',seconds:2,stick:[0,0],reset:[8,null,88],jump:true,standing:true},
    ];
    let cursor=0;for(const segment of segments){segment.start=cursor;cursor+=segment.seconds*fps;segment.end=cursor;}
    const at=i=>segments.find(segment=>i<segment.end);
    const keyFrames=segments.flatMap(segment=>segment.standing ? [0,1,2,3,5,8,15,30,45,65].map(f=>segment.start+f).concat(segment.end-1) : segment.drop ? [.08,.25,.4,.55,.7,1,1.5].map(t=>segment.start+Math.round(fps*t)).concat(segment.end-1) : [segment.start+Math.round(fps*.25),segment.end-1]);
    save('showcase-script.json',{label:'World1 live controller, staged segment cuts, fixed world-offset tracking photo lens; view angle varies with heading, no forced poses or grade',segments});
    await video('showcase',cursor,async i=>{
      const segment=at(i),local=i-segment.start;
      let stick=segment.stick;
      if(segment.turn){const angle=local/fps*2;stick=[Math.sin(angle)*.45,-Math.cos(angle)*.45];}
      if(local===0 && segment.reset){const reset=[...segment.reset];if(reset[1]===null)reset[1]=await page.evaluate(([x,z])=>window.__gameHooks.debug.world.collision.highestAt(x,z),[reset[0],reset[2]]);reset[1]+=segment.drop??0;const yaw=Math.atan2(stick[0],stick[1]);await H('teleport',...reset,yaw);await H('photoOff');await H('setStick',0,0);await H('setKeys',[]);await advance(segment.settle??18);}
      await H('setStick',...stick);
      await H('setKeys',segment.dash && local===0 ? ['ShiftLeft'] : segment.jump && local<Math.round(.25*fps)?['Space']:[]);
    },undefined,{traceEveryFrame:true,keyFrames,afterStep:async(i,state)=>{const[x,y,z]=state.pos;await H('photo',[x-5.6,y+1.6,z+2],[x,y+.65,z],42);}});
    await H('setKeys',[]);await H('setStick',null);
    const result=report.videos.showcase;
    const slope=segments.find(segment=>segment.name==='Windmill slope jump and land');
    const rows=result.trace.filter(row=>row.frame>=slope.start && row.frame<slope.end);
    const air=rows.findIndex(row=>!row.state.grounded);
    const landed=air>=0?rows.slice(air+1).find(row=>row.state.grounded):null;
    const pos=landed?.state.pos;
    const terraceS=pos ? (pos[0]+48)*td[0]+(pos[2]-52)*td[1] : null;
    const drop=segments.find(segment=>segment.drop);
    const dropRows=result.trace.filter(row=>row.frame>=drop.start && row.frame<drop.end);
    const longDropFallSeconds=dropRows.filter(row=>row.state.anim==='jump_fall').reduce((sum,row)=>sum+row.dt,0);
    const longDropLanded=dropRows.some(row=>row.state.grounded);
    const longDropHeldFrames=dropRows.filter(row=>row.state.anim==='jump_fall' && row.state.locomotion?.fallPoseHeld).length;
    const standing=segments.find(segment=>segment.standing);
    const standingRows=result.trace.filter(row=>row.frame>=standing.start && row.frame<standing.end);
    const standingWindupFrames=standingRows.filter(row=>row.state.locomotion?.windupActive).length;
    const standingJumpAirborne=standingRows.some(row=>!row.state.grounded);
    const standingJumpLanded=standingRows.at(-1)?.state.grounded ?? false;
    const acceptance={seconds:cursor/fps,frames:cursor,world:'Reedmarsh + Arrival Meadow + Windmill Rise',camera:'fixed world-offset tracking photo lens, rear on boardwalk/front-side on Windmill; not gameplay camera',longDropHeight:drop.drop,longDropFallSeconds,longDropLanded,longDropHeldFrames,standingWindupFrames,standingJumpAirborne,standingJumpLanded,slopeJumpAirborne:air>=0,slopeLanding:pos??null,terraceS,landedOnIncline:terraceS!==null && terraceS> -6.5 && terraceS<.4,deaths:(await H('state')).deaths};
    save('showcase-acceptance.json',acceptance);save('showcase.json',result);
    if(!acceptance.landedOnIncline || !longDropLanded || longDropFallSeconds<.4 || !longDropHeldFrames || standingWindupFrames<2 || !standingJumpAirborne || !standingJumpLanded || acceptance.deaths)throw Error('World showcase must complete incline landing, held long-fall pose, and standing gather/jump/land without deaths');
  }
  if (wants('worldgait')) {
    if(fps!==60)throw Error('World gait comparison requires60fps');
    await boot(quality,true);
    await page.addStyleTag({content:'.lil-gui,#hud{visibility:hidden!important}'});
    await H('setFeelPreset','brisk');
    const preflight=await page.evaluate(()=>{
      const h=window.__gameHooks,col=h.debug.world.collision,attempts=[];
      for(const x of [6,40,24]) {
        const failures=[];
        let previousY=null;
        for(let z=88;z>=68;z-=2) {
          const floor=col.highestAt(x,z),terrain=h.debug.world.terrainY(x,z),y=floor+.02;
          if(!Number.isFinite(floor) || Math.abs(floor-terrain)>.2 || (previousY!==null && Math.abs(floor-previousY)>.4))failures.push({z,footing:[floor,terrain,previousY]});
          previousY=floor;
          for(const lens of ['side','three-quarter']) {
            const camera=[x+4.7,y+1.2,z+(lens==='side'?.25:3.5)];
            const targets=[[x,y+.6,z],[x,y+.95,z],[x,y+.1,z-.45],[x,y+.1,z+.45]];
            const blockers=targets.map(target=>h.photoBlocker(camera,target));
            if(blockers.some(Boolean))failures.push({z,lens,blockers});
          }
        }
        attempts.push({x,failures});
        if(!failures.length)return {x,z:88,attempts};
      }
      return {x:null,z:88,attempts};
    });
    save('worldgait-preflight.json',preflight);
    if(preflight.x===null)throw Error('No clear terrain-only meadow review corridor');
    const segments=[];
    for(const lens of ['side','three-quarter']) for(const [gait,stick,seconds] of [['walk',.18,3],['trot',.45,3],['run',1,2]]) {
      await H('setKeys',[]);await H('setStick',0,0);await H('photoOff');
      const y=await page.evaluate(([x,z])=>window.__gameHooks.debug.world.collision.highestAt(x,z),[preflight.x,preflight.z]);
      await H('teleport',preflight.x,y,preflight.z,Math.PI);await advance(30);
      const name=`worldgait-${lens}-${gait}`, initial=await H('state');
      const visibility={sampledFrames:0,blocked:[]};
      const frameLens=async st=>{
        const [x,y,z]=st.pos;
        await H('photo',[x+4.7,y+1.2,z+(lens==='side'?.25:3.5)],[x,y+.6,z],38);
      };
      await frameLens(initial);
      await video(name,seconds*fps,async()=>{await H('setStick',0,-stick);},undefined,{
        traceEveryFrame:true,keyFrames:[0,Math.round(fps*.25),fps,seconds*fps-1],
        afterStep:async(i,st)=>{
          if(st.deaths!==initial.deaths)throw Error(`${name}: death`);
          await frameLens(st);
          {
            const [x,y,z]=st.pos, camera=[x+4.7,y+1.2,z+(lens==='side'?.25:3.5)];
            const blockers=await page.evaluate(([camera,targets])=>targets.map(target=>window.__gameHooks.photoBlocker(camera,target)),[camera,[[x,y+.6,z],[x,y+.95,z],[x,y+.1,z-.45],[x,y+.1,z+.45]]]);
            visibility.sampledFrames++;
            if(blockers.some(Boolean))visibility.blocked.push({frame:i,blockers});
          }
        }
      });
      await H('setStick',0,0);await H('setKeys',[]);await shot(`${name}-end`);
      const end=await H('state');
      const rows=report.videos[name].trace.filter(r=>r.frame>=fps),speeds=rows.map(r=>{const previous=report.videos[name].trace[r.frame-1].state.pos;return Math.hypot(r.state.pos[0]-previous[0],r.state.pos[2]-previous[2])/r.dt}).sort((a,b)=>a-b);
      const measured={medianSpeed:speeds[Math.floor(speeds.length/2)],groundedFraction:rows.filter(r=>r.state.grounded).length/rows.length,gaits:Object.fromEntries([...new Set(rows.map(r=>r.state.locomotion?.gait??r.state.anim))].map(g=>[g,rows.filter(r=>(r.state.locomotion?.gait??r.state.anim)===g).length]))};
      measured.expectedGaitFraction=(measured.gaits[gait]??0)/rows.length;
      measured.expectedSpeed=9*stick;
      measured.speedFraction=measured.medianSpeed/measured.expectedSpeed;
      segments.push({name,gait,stick,seconds,initial,end,measured,visibility,camera:`staged ${lens} tracking photo lens, live controller`,reset:[preflight.x,y,preflight.z]});
    }
    save('worldgait-acceptance.json',{label:'Six staged live-input movement segments on a disclosed preflighted Arrival Meadow line; world.group chest/head/feet rays checked every frame; manual full-frame visibility review still required; brisk preset9m/s; not gameplay-camera or continuous-route proof',segments,passed:segments.every(s=>s.end.deaths===s.initial.deaths && s.visibility.blocked.length===0 && s.measured.groundedFraction>.95 && s.measured.expectedGaitFraction>.9 && s.measured.speedFraction>.9 && s.measured.speedFraction<1.1)});
    if(segments.some(s=>s.visibility.blocked.length || s.measured.groundedFraction<=.95 || s.measured.expectedGaitFraction<=.9 || s.measured.speedFraction<=.9 || s.measured.speedFraction>=1.1))throw Error('World gait review requires clear chest/head/feet sight lines, grounded movement and measured requested gait/speed');
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
      window.__capturePadVertices={};
      for(const [id,bone] of Object.entries(window.__capturePaws)) {
        const samples=[];
        fox.traverse(mesh=>{
          if(!mesh.isSkinnedMesh || /fur|shell|glow|flame|spiritfx/i.test(mesh.name))return;
          const boneIndex=mesh.skeleton.bones.indexOf(bone);if(boneIndex<0)return;
          const indices=mesh.geometry.getAttribute('skinIndex'),weights=mesh.geometry.getAttribute('skinWeight');
          for(let i=0;i<indices.count;i++) {
            let weight=0;
            for(let j=0;j<4;j++)if(indices.getComponent(i,j)===boneIndex)weight+=weights.getComponent(i,j);
            if(weight>=.65)samples.push({mesh,index:i});
          }
        });
        window.__capturePadVertices[id]=samples;
      }
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
        const pads={}, updatedMeshes=new Set();
        for(const [id,samples] of Object.entries(window.__capturePadVertices)) {
          let closest=null;
          for(const {mesh,index} of samples) {
            if(!updatedMeshes.has(mesh)){mesh.skeleton.update();updatedMeshes.add(mesh);}
            const point=mesh.localToWorld(mesh.getVertexPosition(index,fox.position.clone()));
            const ground=world.collision.groundAt(point.x,point.z,feetY+.6).y;
            const clearance=point.y-ground;
            if(Number.isFinite(clearance) && (!closest || clearance<closest.clearance))closest={clearance,position:point.toArray(),ground,index,mesh:mesh.name};
          }
          pads[id]={...closest,vertexCount:samples.length};
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
        return { landmark: 'paw bone head after animation/IK; not a mesh toe measurement', feet, pads, padLandmark: 'lowest actual skinned core-mesh vertex with paw weight>=.65; fur/shader displacement excluded', body };
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
  if (wants('hub')) {
    await boot(quality, true);
    await page.addStyleTag({ content: '.lil-gui,#hud{visibility:hidden!important}' });
    // Natural spawn, gravity warm-up and untouched chase before any staging.
    await advance(60); await shot('hub-spawn-chase');
    save('hub-spawn-state.json', { staged: false, state: await H('state'), game: await page.evaluate(() => window.__game) });
    const y = await page.evaluate(() => window.__gameHooks.debug.world.collision.highestAt(0, 94));
    await H('teleport', 0, y, 94, Math.PI);
    const hubViews = [
      ['arrival', [16, 10, 108], [-5, 2, 81], 52],
      ['arrival-close', [8, 3.8, 98], [-10, 2, 85], 55],
      ['well', [-2, 4, 91], [-9, 2, 82], 52],
      ['west-exit', [-7, 7, 96], [-23, 2, 71], 56],
      ['east-exit', [2, 6, 99], [18, 2, 80], 56],
      ['north-exit', [0, 5, 97], [0, 2, 65], 55],
    ];
    for (const [name, lens, target, fov] of hubViews) {
      await H('photo', lens, target, fov); await advance(2); await shot(`hub-${name}`);
    }
    await H('photo', [8, 4.5, 101], [-8, 2, 86], 55); await advance(30);
    const initial = await H('state');
    await video('hub-arrive-idle', 15 * fps, async i => {
      // One staged starting point, then the live controller. Arrival pauses at the well lane.
      if (i < 3 * fps) await H('setStick', -.2, -.2); else await H('setStick', null);
    }, undefined, {keyFrames: [0, 2*fps, 4*fps, 7*fps, 10*fps, 14*fps]});
    await H('setStick', null);
    const end = await H('state');
    await H('photoOff'); await advance(30); await shot('hub-chase-arrived');
    save('hub-acceptance.json', {label: 'Staged start and fixed village lens, then live arrival input and idle; separate chase still; no forced poses', initial, end, deaths: end.deaths-initial.deaths, game: await page.evaluate(() => window.__game)});
    // Labelled review orbit: only the lens moves; the fox keeps its real idle pose.
    const orbitCameras = [];
    const targetGround = await page.evaluate(() => window.__gameHooks.debug.world.collision.highestAt(-10, 88));
    const orbitTarget = [-10, targetGround + 2, 88];
    const orbitLens = (angle, height) => [-9 + Math.sin(angle) * 30, height, 88 + Math.cos(angle) * 24];
    // One fixed clearance height avoids frame-to-frame camera pops. The ellipse
    // stays >2m outside every cottage roof footprint; low close/chase shots above
    // retain the player-scale views. Every captured pose is checked and logged.
    let orbitHeight = targetGround + 26;
    let orbitHeightSearchClear = false;
    for (const height of [6, 8, 10, 12, 14, 18, 22, 26].map(h => targetGround + h)) {
      let clear = true;
      for (let j = 0; j < 36 && clear; j++) clear = !(await H('photoBlocker', orbitLens(j / 36 * Math.PI * 2, height), orbitTarget));
      if (clear) { orbitHeight = height; orbitHeightSearchClear = true; break; }
    }
    let orbitBlocked = 0;
    await video('hub-orbit', 18 * fps, async i => {
      const lens = orbitLens(i / (18 * fps - 1) * Math.PI * 2, orbitHeight);
      const blocker = await H('photoBlocker', lens, orbitTarget);
      if (blocker) orbitBlocked++;
      orbitCameras.push({ frame: i, lens, target: orbitTarget, blocker });
      await H('photo', lens, orbitTarget, 58);
    }, undefined, {keyFrames: [0, 3*fps, 6*fps, 9*fps, 12*fps, 15*fps, 18*fps-1]});
    save('hub-orbit-cameras.json', { label: 'Staged context orbit; no actor pose override; fixed checked height and per-frame blockers', height: orbitHeight, heightSearchClear: orbitHeightSearchClear, probeAngles: 36, blockedFrames: orbitBlocked, cameras: orbitCameras });
    if (orbitBlocked) report.failures.push(`Hub context orbit has ${orbitBlocked} blocked review frames`);
    await H('photoOff');

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
    // Stage in the clear meadow: the former (6,78) lens sat inside the H-a shelf at (13,75.5).
    const heroY = await page.evaluate(() => window.__gameHooks.debug.world.collision.highestAt(0, 70));
    if (!Number.isFinite(heroY) || heroY < -24) throw Error('Hero still has no safe surface');
    await H('teleport', 0, heroY, 70, Math.PI); await advance(60, false);
    const hero = await H('getFoxPos');
    await H('photo', [hero.x + 3.5, hero.y + 0.7, hero.z - 4], [hero.x, hero.y + 0.5, hero.z], 30);
    await advance(3); await shot('still-hero');
    save('hero-stage-provenance.json', { label: 'STAGED visual review; lens relocated to clear H-a shelf', fox: [0, heroY, 70], previousFox: [6, 78], previousLensXZ: [9.5, 74], obstruction: 'H-a shelf centred13,75.5 radius4.5' });
    await H('forceRestore'); await advance(660, false);
    await poseStill('establish-restored', poses.establish);
  }
  if (wants('restoration') || wants('water')) {
    await boot(quality, true);
    await page.addStyleTag({ content: '#hud > :not(#vignette), .lil-gui { visibility: hidden !important; }' });
    const y = await page.evaluate(() => window.__gameHooks.debug.world.collision.highestAt(0, 70));
    if (!Number.isFinite(y) || y < -24) throw Error('Restoration review has no safe meadow surface');
    await H('teleport', 0, y, 70, Math.PI);
    await H('photo', [5, y + 6, 79], [-1, y, 70], 48);
    await advance(60); await shot('restoration-aura');
    await H('setStick', -1, 0); await H('setKeys', ['ShiftLeft']);
    await advance(6); await shot('restoration-dash');
    await advance(12);
    await H('setKeys', []); await H('setStick', null);
    await advance(60); await shot('restoration-wake');
    await advance(360); await shot('restoration-wake-decayed');
    // Reed Seedwell is at (95, 10), radius 35: the south front crosses z=45.
    // The meadow lens cannot see it, so use a separate fixed lens for the matched front pair.
    const framing = await page.evaluate(() => {
      const h = window.__gameHooks, attempts = [];
      for (const [x,z] of [[95,13],[93,10],[97,10],[95,7],[90,15]]) {
        const y = h.debug.world.collision.highestAt(x,z);
        if (!Number.isFinite(y) || y < -.5 || y > 4) continue;
        for (const lens of [[68,34,44],[65,34,18],[112,35,0],[78,40,-6],[95,45,30]]) {
          const blocker = h.photoBlocker(lens,[x,y+.6,z]);
          attempts.push({fox:[x,y,z],lens,blocker});
          if (!blocker) return {fox:[x,y,z],lens,look:[(x+95)/2,y+.6,(z+10)/2],attempts};
        }
      }
      return {attempts};
    });
    save('restoration-framing.json', framing);
    if (!framing.fox) throw Error('No unobstructed safe Reed restoration review lens');
    await H('teleport', ...framing.fox, Math.PI);
    await H('photo', framing.lens, framing.look, 60);
    await advance(1); await shot('restoration-front-before');
    // Existing staged latch hook exercises real Seedwell restore events, not a synthetic mask.
    await H('lightSeedwells');
    for (const [name, frames] of [['front-early', 18], ['front-mid', 42], ['settled', 240]]) {
      await advance(frames); await shot(`restoration-${name}`);
    }
    save('restoration-provenance.json', {
      label: 'STAGED fixed-lens visual review: real dash input, then staged public Seedwell latches',
      note: 'All three staged latches activate their normal Shade encounters; actors may enter the Reed frame.',
      state: await H('state'), game: await page.evaluate(() => window.__game),
    });
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
    const pondCaptureStart = await page.evaluate(() => {
      const d = window.__gameHooks.debug.scene.userData.waterCapture;
      if (!d) return null;
      d.bootGlError = d.glError; d.bootPriorGlError = d.priorGlError;
      d.glError = 0; d.priorGlError = 0; d.checkNextCopy = true;
      return {copies:d.copies,reflectionAttempts:d.reflectionAttempts,reflections:d.reflections,checkedCopies:d.checkedCopies,bootGlError:d.bootGlError,bootPriorGlError:d.bootPriorGlError};
    });
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
    await H('photo', [-6, 1.3, 78], [-24, -0.22, 68], 52); await advance(2); await shot('water-pond-grazing');
    await H('photo', [8, 12, 4], [8, -3.2, -7], 52); await advance(2); await shot('water-creek');
    const waterCapture = await page.evaluate(() => {
      const h = window.__gameHooks, d = h.debug.scene.userData.waterCapture;
      const buffer = h.debug.post.composer.readBuffer;
      return {after:d ?? null,expected:{width:buffer.width,height:buffer.height,type:buffer.texture.type,shadowType:h.debug.renderer.shadowMap.type}};
    });
    save('water-scene-capture.json', {before:pondCaptureStart,...waterCapture});
    const d = waterCapture.after, expected = waterCapture.expected;
    if (!d || !pondCaptureStart || d.copies <= pondCaptureStart.copies || d.reflections <= pondCaptureStart.reflections || d.checkedCopies <= pondCaptureStart.checkedCopies
      || d.shadowTypeAtFirstPrepare !== 1 || expected.shadowType !== 1 || d.type !== 1016 || d.type !== expected.type || d.width !== expected.width || d.height !== expected.height || d.glError || d.priorGlError || d.bootGlError || d.bootPriorGlError || d.invalidTargets) {
      report.failures.push(`Water scene capture gate failed: ${JSON.stringify({before:pondCaptureStart,...waterCapture})}`);
    }
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
    // Same fixed-step lifecycle as tools/fx-capture.ts, on the hardware renderer.
    // Contact sheet records actual cumulative steps (not wall-clock elapsed time).
    const lifecycle = [];
    const lifeShot = async (name, frame) => {
      await shot(`updraft-fx-${name}`);
      lifecycle.push({ name, frame, hearth: hearth(await H('state')), game: await page.evaluate(() => window.__game) });
    };
    await lifeShot('00-cold', 0);
    await H('teleport', hx - 1.4, hy, hz + 0.4, Math.PI);
    await H('photo', ...lens);
    let lifeFrame = 0;
    for (const target of [15, 30, 45, 90, 180]) {
      await advance(target - lifeFrame); lifeFrame = target;
      await lifeShot(`lit-${target}f`, target);
    }
    await H('teleport', hx - 14, hy, hz + 18, Math.PI); await H('photo', ...lens);
    for (const target of [60, 120, 180, 210, 240, 300, 360, 420]) {
      await advance(target + 180 - lifeFrame); lifeFrame = target + 180;
      await lifeShot(`decay-${target}f`, lifeFrame);
    }
    const sheet = await context.newPage();
    try {
      await sheet.setViewportSize({ width: 1600, height: 900 });
      const cards = lifecycle.map(f => `<figure><figcaption>${f.name} ${f.hearth.state} heat=${f.hearth.heat}</figcaption><img src="data:image/png;base64,${fs.readFileSync(path.join(out, `updraft-fx-${f.name}.png`)).toString('base64')}"></figure>`).join('');
      await sheet.setContent(`<style>*{box-sizing:border-box}body{margin:0;background:#211b16;color:#eadfc8;font:14px sans-serif;display:grid;grid-template-columns:repeat(4,1fr)}figure{margin:0}figcaption{height:26px;padding:5px}img{display:block;width:100%}</style>${cards}`);
      await sheet.evaluate(() => Promise.all([...document.images].map(im => im.decode())));
      await sheet.screenshot({ path: path.join(out, 'updraft-fx-contact.png'), fullPage: true });
    } finally { await sheet.close(); }
    save('updraft-fx-check.json', {
      effect: 'hearth-updraft', method: 'fx-capture lifecycle / fixed 60Hz / hardware GPU',
      ok: lifecycle[0].hearth.heat === 0 && lifecycle.some(f => f.hearth.heat >= 0.99) && lifecycle.at(-1).hearth.heat === 0,
      frames: lifecycle,
    });
    // Distance affordance lens: identical lit staging, camera 20m from column axis.
    await H('teleport', hx - 1.4, hy, hz + 0.4, Math.PI); await advance(30);
    await H('photo', [hx - 12, hy + 6, hz + 16], [hx, hy + 3, hz], 50);
    await advance(1); await shot('updraft-fx-distance-20m');
    await H('teleport', hx - 14, hy, hz + 18, Math.PI); await advance(480, false);
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
  if (wants('reed')) {
    await boot(quality, true);
    const opts = { H, advance, shot, video, save, page, fps, report };
    const mouth = await captureMarshMouth(opts, 'aura', 1);
    if (mouth.passed) {
      const entry = await captureReedEntry(opts);
      if (entry.passed) {
        const reed = await captureReed(opts);
        if (reed.passed) await captureReedAftermath(opts);
      }
    }
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
  if (wants('flow')) {
    // Independent segments: staged starts are explicit; movement afterward is real and unassisted.
    const segments = [{name:'mills',label:'cp-mills',seconds:24}, {name:'kiln',label:'SW1',seconds:15}, {name:'canopy',label:'cp-amber',seconds:26}, {name:'hill',label:'cp-arena',seconds:28}];
    for (const seg of segments) {
      await boot(quality, true);
      const route = await H('route'), idx = route.findIndex(w => w.label === seg.label), wp = route[idx];
      await H('teleport', wp.x, wp.y, wp.z, Math.PI);
      await H('autopilot', true, idx, {assist:false});
      await video(`flow-${seg.name}-staged-start`, seg.seconds * fps, async () => {}, st => !st.auto.active);
      await shot(`flow-${seg.name}-end`);
    }
  }
  const RH=(fn,...args)=>{if(fn==='teleport')args[0]-=70;if(fn==='photo'){args[0]=[args[0][0]-70,...args[0].slice(1)];args[1]=[args[1][0]-70,...args[1].slice(1)];}return H(fn,...args);};
  reachSafety: if (wants('reachsafe')) {
    await boot(quality,true);await RH('forceRestore');await advance(660,false);
    // Explicit staged setup for a supply-loss stress test; basin/float/seal states stay simulated.
    await RH('teleport',172,30,-110,Math.PI/2);await advance(20,false);
    const bank=await RH('state');save('reach-bank-checkpoint.json',bank);if(!bank.reach.recoveryVisited)report.failures.push('Reach bank recovery did not activate');
    await RH('teleport',173,30,-116,Math.PI/2);
    let supplied=await RH('state');
    for(let i=0;i<200&&!(supplied.reach.arrived&&supplied.reach.fill>=.6);i++){await advance(6,false);supplied=await RH('state');}
    save('reach-supply-loss-setup.json',supplied);
    if(!supplied.reach.arrived||supplied.reach.fill<.6||supplied.reach.restored){report.failures.push('Supply-loss setup did not reach a live partial fill');break reachSafety;}
    await RH('teleport',188,supplied.reach.floats[2].height,-129,Math.PI/2);await RH('photo',[170,44,-103],[188,33,-123],52);
    await video('reach-retained-supply-loss',8*fps,async i=>{
      if(i===0)await page.evaluate(()=>window.__gameHooks.chem.colorDrains.push(p=>p.x>100&&p.x<108));
    },undefined,{keyFrames:[0,2*fps,4*fps,6*fps]});
    const held=await RH('state');save('reach-retention-acceptance.json',held);
    if(!held.reach.retained||held.reach.fill<.98||held.reach.restored||held.reach.seal>0||!held.grounded)report.failures.push('Occupied float retention or no-false-latch test failed');
    const stoppedSource=held.chem.water.find(w=>w.id==='reach-spout');if(!stoppedSource||stoppedSource.flowing||stoppedSource.arriving||stoppedSource.heat>.01)report.failures.push('Reach source did not shut down after supply loss');
    // Keep the already-used support until a stable landing, including a brief hop.
    await RH('setKeys',['Space']);await advance(12);await shot('reach-retained-airborne');
    const airborne=await RH('state');save('reach-airborne-retention-acceptance.json',airborne);
    if(airborne.grounded||!airborne.reach.retained||airborne.reach.restored||airborne.reach.seal>0||Math.abs(airborne.reach.fill-held.reach.fill)>.001)report.failures.push('Reach support drained during airborne retained hop');
    await RH('setKeys',[]);await advance(90,false);
    const t0=(await RH('state')).t;
    await RH('photoOff');await RH('setStick',-1,0);
    await video('reach-boarding-recovery',8*fps,async()=>{},st=>st.deaths>held.deaths&&Math.hypot(st.pos[0]-101,st.pos[2]+130)<3);
    await RH('setStick',null);await advance(60);await shot('reach-recovered-bank');
    const recovered=await RH('state'),seconds=recovered.t-t0;
    save('reach-recovery-acceptance.json',{seconds,deathsBefore:held.deaths,deathsAfter:recovered.deaths,end:recovered});
    if(recovered.deaths!==held.deaths+1||seconds>10||Math.hypot(recovered.pos[0]-101,recovered.pos[2]+130)>3)report.failures.push('Reach boarding recovery exceeded safe checkpoint contract');
  }
  if (wants('reachview')) {
    await boot(quality,true);await RH('forceRestore');await advance(660,false);
    // Staged source hold uses real colour supply; no basin, seal or float state is assigned.
    await RH('teleport',173,30,-116,Math.PI/2);
    let high=await RH('state'),sourceHoldFrames=0,firstArrivalAt=null,latchAt=null;
    while(sourceHoldFrames<1800&&(!high.reach.restored||high.reach.fill<.99)){
      await advance(6,false);sourceHoldFrames+=6;high=await RH('state');
      if(high.reach.arrived&&firstArrivalAt===null)firstArrivalAt=sourceHoldFrames/60;
      if(high.reach.restored&&latchAt===null)latchAt=sourceHoldFrames/60;
    }
    await advance(240,false);high=await RH('state');
    save('reachview-setup.json',{strategy:'STAGED aura-only source hold, real parcels/inlet',firstArrivalAfterSeconds:firstArrivalAt,bellLatchedAfterSeconds:latchAt,sourceHoldSeconds:sourceHoldFrames/60,colourSettleSeconds:4,high});
    if(!high.reach.restored||high.reach.fill<.99)report.failures.push('Reach HIGH photo setup did not receive sustained water');
    await RH('teleport',150,38,-96,Math.PI/2);await RH('photo',[139,52,-91],[187,32,-118],52);await advance(2);await shot('reachview-high-arrival');
    await RH('teleport',187,36,-118,Math.PI/2);await RH('photo',[161,45,-107],[188,33,-120],52);await advance(2);await shot('reachview-high-basin');
    await RH('teleport',214,31,-137,Math.PI/2);
    await RH('photo',[218,33.5,-145],[194,33.5,-118],52);await advance(2);await shot('reachview-lower-islet');
    await RH('teleport',207,36,-123,-Math.PI/2);
    await RH('photo',[220,44,-122],[190,34,-119],52);await advance(2);await shot('reachview-payoff-vista');
    await RH('teleport',201,36,-121,-Math.PI/2);await RH('setStick',-1,0);await RH('setKeys',['ShiftLeft']);await advance(1);await RH('setKeys',[]);await RH('setStick',null);await advance(260,false);
    await RH('photo',[139,52,-91],[187,32,-118],52);await advance(2);await shot('reachview-low-matched');
    await RH('photo',[167,48,-99],[190,32,-121],52);await advance(2);await shot('reachview-low-lane');
    await RH('teleport',187,30,-118,Math.PI/2);await RH('photo',[161,45,-107],[188,33,-120],52);await advance(2);await shot('reachview-low-basin');
    const low=await RH('state');save('reachview-state.json',low);if(low.reach.level!=='low'||low.reach.fill>.02)report.failures.push('Reach LOW photo setup did not drain');
  }
  if (wants('reach')) {
    await boot(quality,true); await RH('forceRestore'); await advance(660,false);
    await H('teleport',12,38,-90,Math.PI/2); await advance(2); await shot('reach-summit-entry');
    const points=[{x:104,y:38,z:-90},{x:132,y:38,z:-90},{x:148,y:38,z:-90},{x:154,y:38,z:-102},{x:160,y:38,z:-108},{x:174,y:30,z:-130},{x:185,y:30,z:-128},{x:187,y:30,z:-118,shade:true},{x:174,y:30,z:-130},{x:169,y:30,z:-115,settle:true},{x:173,y:30,z:-115,dash:true,source:true},{x:187,y:30,z:-118,dash:true},{x:187,y:36.35,z:-118,wait:true},{x:189,y:36,z:-118},{x:196,y:36,z:-118,jump:true},{x:202,y:36,z:-118}].map(p=>({...p,x:p.x-70}));
    let phase=0,age=0,reached=false,painted=false,dashAttempt=-1,shadeShot=false;
    const events={shadeFreedAt:null,sourceActivatedAt:null,firstArrivalAt:null,bellLatchedAt:null};
    await video('reach-first-crossing',65*fps,async()=>{
      const st=await RH('state'),p=points[phase];age+=1/fps;
      const drinker=st.shades.actors.find(s=>s.id==='reach-drinker');
      const sourceWater=st.chem.water.find(w=>w.id==='reach-spout');
      if(drinker?.freed&&events.shadeFreedAt===null)events.shadeFreedAt=st.t;
      if(sourceWater?.flowing&&events.sourceActivatedAt===null)events.sourceActivatedAt=st.t;
      if(st.reach.arrived&&events.firstArrivalAt===null)events.firstArrivalAt=st.t;
      if(st.reach.restored&&events.bellLatchedAt===null)events.bellLatchedAt=st.t;
      if(p.shade){if(!drinker)throw Error('Reach drinker missing');p.x=drinker.pos[0];p.z=drinker.pos[2];}
      const dx=p.x-st.pos[0],dz=p.z-st.pos[2],d=Math.hypot(dx,dz);
      const ready=p.shade?drinker.freed:p.source?sourceWater?.flowing:p.settle?d<.3&&st.grounded&&Math.abs(st.pos[1]-p.y)<.6&&Math.hypot(st.vel[0],st.vel[2])<.7:d<.8&&st.pos[1]>=p.y-.4;
      if(p.shade&&drinker.freed&&!shadeShot){await shot('reach-drinker-released');shadeShot=true;}
      if(ready&&age>.15){if(phase===points.length-1)reached=st.grounded;else{phase++;age=0;painted=false;dashAttempt=-1;console.log('REACH PHASE',phase,JSON.stringify(st.reach));}}
      const q=points[phase];if(q.source&&painted&&age-dashAttempt>1&&!sourceWater?.flowing)painted=false;if(q.shade){q.x=drinker.pos[0];q.z=drinker.pos[2];if(painted&&age-dashAttempt>1)painted=false;}
      const vx=q.x-st.pos[0],vz=q.z-st.pos[2],len=Math.hypot(vx,vz);
      let sx=len>.2?vx/len*Math.min(1,len):0,sz=len>.2?vz/len*Math.min(1,len):0;
      const keys=q.jump?['Space']:[];
      if((q.dash||q.shade)&&len<3&&!painted&&(!q.shade||st.grounded)){if(Math.hypot(sx,sz)<.1){sx=1;sz=0;}keys.push('ShiftLeft');painted=true;dashAttempt=age;}
      await RH('setStick',sx,sz);await RH('setKeys',keys);
    },st=>reached&&st.reach.restored||st.deaths>0||age>12,{keyFrames:[0,10*fps,20*fps,25*fps]});
    await RH('setKeys',[]);await RH('setStick',null);await advance(30);await shot('reach-end');
    const end=await RH('state');if(end.reach.restored&&events.bellLatchedAt===null)events.bellLatchedAt=end.t;
    const eventOrder=Object.values(events).every(t=>t!==null)&&events.shadeFreedAt<events.sourceActivatedAt&&events.sourceActivatedAt<events.firstArrivalAt&&events.firstArrivalAt<events.bellLatchedAt;
    save('reach-acceptance.json',{phase,reached,strategy:'real dash release before source, then ferry',events,eventOrder,shadeFreed:end.shades.actors.find(s=>s.id==='reach-drinker')?.freed,end});
    if(!eventOrder)report.failures.push('Reach release/source/arrival/latch event order not observed');
    if(reached&&end.reach.restored){
      await RH('photo',[167,48,-99],[190,32,-121],52);
      let cycle=0,cycleAge=0,cyclePaint=false,ventHopIssued=false;
      const lowSeen={value:false};let lowLaneVisited=false,steamRise=false;
      await video('reach-level-cycle',30*fps,async()=>{
        const st=await RH('state');cycleAge+=1/fps;
        const targets=[[201,36,-121],[201,36,-121],[183,30,-128],[183,30,-128],[173,30,-124],[173,30,-124]].map(p=>[p[0]-70,p[1],p[2]]);
        const p=targets[cycle],dx=p[0]-st.pos[0],dz=p[2]-st.pos[2],d=Math.hypot(dx,dz);
        const atFooting=d<.8&&st.grounded&&Math.abs(st.pos[1]-p[1])<.6;
        const ready=cycle===0?st.reach.level==='low':cycle===1?st.reach.fill<.02:cycle===2?atFooting:cycle===3?cycleAge>1.2&&st.pos[1]>34:cycle===4?st.reach.level==='high':st.reach.fill>.99;
        if(ready&&cycleAge>.2&&cycle<5){if(cycle===1)lowSeen.value=true;if(cycle===2)lowLaneVisited=true;if(cycle===3)steamRise=true;cycle++;cycleAge=0;cyclePaint=false;ventHopIssued=false;console.log('REACH CYCLE',cycle,JSON.stringify(st.reach));}
        const t=targets[cycle],vx=t[0]-st.pos[0],vz=t[2]-st.pos[2],len=Math.hypot(vx,vz);
        let sx=len>.25?vx/len*Math.min(.8,len):0,sz=len>.25?vz/len*Math.min(.8,len):0;
        const steamHot=st.chem.hearths.some(h=>h.id==='reach-steam'&&h.heat>=.5);
        if(cycle===3&&cyclePaint&&cycleAge>.5&&st.grounded&&len<.8&&Math.hypot(st.vel[0],st.vel[2])<1&&steamHot)ventHopIssued=true;
        const keys=((cycle===2&&len>3)||(cycle===3&&ventHopIssued))?['Space']:[];
        if([0,3,4].includes(cycle)&&len<2.8&&st.grounded&&Math.abs(st.pos[1]-t[1])<.6&&!cyclePaint){
          // A dash needs a direction even after the fox has stopped at the lever.
          if(Math.hypot(sx,sz)<.1){sx=-1;sz=0;}
          keys.push('ShiftLeft');cyclePaint=true;
        }
        await RH('setStick',sx,sz);
        await RH('setKeys',keys);
      },st=>cycle===5&&st.reach.level==='high'&&st.reach.fill>.99||st.deaths>end.deaths||cycleAge>10,{keyFrames:[0,4*fps,8*fps,12*fps,16*fps]});
      await RH('setKeys',[]);await RH('setStick',null);await shot('reach-cycle-end');
      const cy=await RH('state');save('reach-cycle-acceptance.json',{cycle,lowSeen:lowSeen.value,lowLaneVisited,steamRise,end:cy});
      if(cycle!==5||!lowSeen.value||!lowLaneVisited||!steamRise||cy.reach.level!=='high'||!cy.reach.restored||cy.reach.fill<.99)report.failures.push('Reach reversible water cycle incomplete');
    }
    // Staged architecture views are separate from the real summit-to-basin traversal above.
    await RH('teleport',150,38,-96,Math.PI/2);await RH('photo',[139,52,-91],[187,32,-118],52);await advance(2);await shot('reach-overview');
    await RH('teleport',187,end.reach.raftHeight,-118,Math.PI/2);await RH('photo',[172,43,-99],[194,34,-121],52);await advance(2);await shot('reach-ferry-and-bell');
    if(!reached||!end.reach.restored||end.deaths||!end.shades.actors.find(s=>s.id==='reach-drinker')?.freed)report.failures.push('Reach first crossing incomplete');
  }
  if (wants('crown')) {
    await boot(quality, true);
    await H('forceRestore'); await advance(660, false);
    const afterFlood = await H('state');
    save('crown-after-valley-flood.json', afterFlood);
    if (afterFlood.crown.restored) throw Error('Valley flood solved the Crown remotely');
    await H('teleport', -10, 38, -87, -Math.PI / 2);
    await advance(2); await shot('crown-entry');
    const points = [
      {x:-19,z:-88,y:38}, {x:-22,z:-88,y:38}, {x:-39,z:-96,y:24}, {x:-37,z:-101,y:24},
      {x:-37,z:-101,y:30,jump:true}, {x:-43,z:-108,y:29},
      {x:-45,z:-112,y:29,dash:true}, {x:-45,z:-112,y:44,jump:true},
      {x:-19,z:-88,y:38,jump:true,land:true}, {x:-12,z:-88,y:38,land:true}, {x:-12,z:-93,y:38,land:true},
    ];
    let phase=0, age=0, reached=false;
    await video('crown-roundtrip-staged-start', 48 * fps, async () => {
      const st = await H('state'), p=points[phase];
      age += 1/fps;
      const dx=p.x-st.pos[0], dz=p.z-st.pos[2], d=Math.hypot(dx,dz);
      if (d<0.85 && st.pos[1]>=p.y-0.5 && (!p.land || st.grounded) && age>.25) {
        if(phase===points.length-1) reached=true;
        else { phase++; age=0; console.log('CROWN PHASE', phase, JSON.stringify(st.pos)); }
      }
      const target=points[phase], vx=target.x-st.pos[0], vz=target.z-st.pos[2], len=Math.hypot(vx,vz);
      const mag = Math.min(1,len / 1.2);
      await H('setStick',len>.2?vx/len*mag:0,len>.2?vz/len*mag:0);
      const keys=target.jump && !(target.land && len<1.2)?['Space']:[];
      if(target.dash && age<.06) keys.push('ShiftLeft');
      await H('setKeys',keys);
    }, st => reached || st.deaths>0 || age>9, {keyFrames:[0,3*fps,6*fps,9*fps,12*fps], traceEveryFrame:true});
    await H('setKeys',[]); await H('setStick',null); await shot('crown-end');
    const st=await H('state');
    save('crown-acceptance.json',{reached,phase,restored:st.crown.restored,deaths:st.deaths,end:st});
    if (!reached || !st.crown.restored || st.deaths || !st.grounded) report.failures.push('Crown round trip did not finish restored, grounded, and without deaths');
    // Prove the permanent walking fallback in both directions, with no jumping or staged movement.
    const walkOut = [[-12,38,-88],[-19,38,-88],[-22,38,-88],[-39,24,-96],[-41,24,-99],[-49,29,-101.5],[-49,29,-109],[-57,34,-113],[-53,34,-116]];
    const walk = [...walkOut, ...walkOut.slice(0,-1).reverse(),[-12,38,-88],[-12,38,-93]];
    let walkIdx=0, walkAge=0;
    await video('crown-walking-fallback', 50*fps, async () => {
      const q=await H('state'), p=walk[walkIdx], dx=p[0]-q.pos[0], dz=p[2]-q.pos[2], d=Math.hypot(dx,dz);
      walkAge+=1/fps;
      if(d<.55 && q.pos[1]>=p[1]-.5 && q.grounded && walkIdx<walk.length-1) {walkIdx++; walkAge=0; console.log('CROWN WALK',walkIdx,JSON.stringify(q.pos));}
      const target=walk[walkIdx], vx=target[0]-q.pos[0], vz=target[2]-q.pos[2], len=Math.hypot(vx,vz);
      await H('setKeys',[]); await H('setStick',len>.2?vx/len*Math.min(.65,len):0,len>.2?vz/len*Math.min(.65,len):0);
    }, q => q.deaths>0 || walkAge>9 || walkIdx===walk.length-1 && q.grounded && Math.hypot(q.pos[0]+12,q.pos[2]+93)<.7, {keyFrames:[0,5*fps,10*fps,15*fps]});
    await H('setStick',null); await advance(30); await shot('crown-walk-end');
    const walkEnd=await H('state'); save('crown-walk-acceptance.json',{walkIdx,of:walk.length,grounded:walkEnd.grounded,deaths:walkEnd.deaths,end:walkEnd.pos});
    if(walkIdx!==walk.length-1 || walkEnd.deaths) report.failures.push('Crown permanent walking fallback incomplete');

  }
  if (wants('finale')) await captureFinale({H,boot,video,shot,save,getPage:()=>page,fps,out,execFileSync,fs,path});
  if (wants('route') || wants('kilnroute')) {
    await boot(quality, true);
    const route = await H('route');
    save('route-waypoints.json', route);
    const from = Number(arg('route-from', '0')), requestedTo = Number(arg('route-to', '-1'));
    const kilnRoute = selected.split(',').includes('kilnroute');
    if (kilnRoute && selected.split(',').includes('route')) throw Error('Capture route and kilnroute separately to preserve distinct proof');
    if (kilnRoute && (from !== 0 || requestedTo !== -1)) throw Error('Kiln route requires natural spawn and its named endpoint; omit route-from/route-to');
    const kilnFeed = route.findIndex(w => w.label === 'SW1-feed');
    if (kilnRoute && kilnFeed < 0) throw Error('Kiln route requires an authored SW1-feed waypoint');
    const to = kilnRoute ? kilnFeed + 1 : requestedTo < 0 ? route.length : requestedTo;
    const regional = from > 0;
    const bounded = kilnRoute || requestedTo >= 0;
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || from >= to || to > route.length) throw Error('Invalid route waypoint interval');
    if (regional) {
      const wp = route[from];
      const floor = await page.evaluate(p => window.__gameHooks.debug.world.collision.groundAt(p.x, p.z, p.y + .5).y, wp);
      if (!Number.isFinite(floor) || floor < wp.y - 1) throw Error('Regional route start must be a walkable waypoint');
      await H('teleport', wp.x, floor, wp.z, Math.PI);
      await advance(3, false);
    }
    const start = await H('state');
    const spawnDistanceToFirst = Math.hypot(start.pos[0] - route[0].x, start.pos[1] - route[0].y, start.pos[2] - route[0].z);
    if (kilnRoute && start.zone !== 'Lanternhollow') throw Error('Kiln proof requires natural spawn in the built Lanternhollow hub');
    if (kilnRoute && start.seedwells.some(s => s.id === 'SW1' && s.lit)) throw Error('Kiln proof requires an initially unlit SW1');
    save('route-plan.json', { schemaVersion: 2, start: { pos: start.pos, seedwells: start.seedwells, deaths: start.deaths, auto: start.auto }, spawnDistanceToFirst, from, to, endpoint: route[to - 1].label ?? null, staged: regional, label: regional ? 'Staged regional start; real unassisted traversal; does not prove realm completion' : kilnRoute ? 'Continuous Lanternhollow-to-Kiln clear plus live endpoint idle; no full-realm claim' : bounded ? 'Continuous route from natural spawn to authored endpoint; does not prove realm completion' : 'Full unassisted restoration route' });
    await H('autopilot', true, from, { assist: false });
    let restoredAt, kilnLatchedAt, kilnCompletedAt, kilnCompletion, firstFeedCrossing, departedAt;
    let kilnStopped = false;
    const continuity = { maxStepMeters: 0, maxStepFrame: null, jumpLimitMeters: Math.max(3, 90 / fps), firstLargeStep: null };
    const encounter = { initialHits: start.shades.hits, minWisps: start.shades.wisps, knockbackTravelMeters: 0 };
    let previousPos = start.pos, previousKnockback = start.shades.knockbackTravel ?? 0, previousHits = start.shades.hits;
    const framing = { samples: 0, outside: 0, maxAbsX: 0, maxAbsY: 0, firstFailure: null, failures: [] };
    const name = regional ? `route-segment-staged-${from}-${to}` : kilnRoute ? 'route-continuous-kiln' : bounded ? `route-continuous-${to}` : 'route-unassisted';
    const budgetFrames = Number(arg('route-seconds', '360')) * fps;
    if (kilnRoute && budgetFrames < 60 * fps) throw Error('Kiln proof requires a capture budget of at least 60 seconds');
    const state = await video(name, budgetFrames, async () => {
      if (kilnCompletedAt !== undefined && !kilnStopped) {
        await H('autopilot', false, kilnCompletion.idx, { assist: false });
        await H('setKeys', []); await H('setStick', null);
        kilnStopped = true;
      }
    }, (st, i) => {
      if (kilnLatchedAt === undefined && st.seedwells.some(s => s.id === 'SW1' && s.lit)) kilnLatchedAt = i;
      if (kilnRoute) {
        const endpoint = route[to - 1];
        const distanceToFeed = Math.hypot(st.pos[0] - endpoint.x, st.pos[2] - endpoint.z);
        const nearFeed = distanceToFeed <= 3 && Math.abs(st.pos[1] - endpoint.y) <= 1;
        if (firstFeedCrossing === undefined && st.auto.idx >= to) firstFeedCrossing = { frame: i, pos: st.pos, distanceToFeed, grounded: st.grounded, kilnLit: st.seedwells.some(s => s.id === 'SW1' && s.lit) };
        if (kilnCompletedAt === undefined && st.auto.idx >= to && st.seedwells.some(s => s.id === 'SW1' && s.lit) && st.grounded && nearFeed) {
          kilnCompletedAt = i;
          kilnCompletion = { idx: st.auto.idx, pos: st.pos, t: st.t, distanceToFeed, grounded: st.grounded, shades: { hits: st.shades.hits, wisps: st.shades.wisps } };
        }
        if (kilnCompletedAt !== undefined && departedAt === undefined && distanceToFeed > 3) departedAt = i;
        // Explicit driver gate: real endpoint idle through 60s, never freeze physics/rendering.
        return st.deaths > 0 || kilnCompletedAt === undefined && !st.auto.active || kilnCompletedAt !== undefined && i + 1 >= 60 * fps;
      }
      if (bounded) return st.auto.idx >= to && (!kilnRoute || st.seedwells.some(s => s.id === 'SW1' && s.lit)) || !st.auto.active;
      if (st.restored && restoredAt === undefined) restoredAt = i;
      return restoredAt !== undefined && i - restoredAt >= 11 * fps || !st.auto.active && !st.restored;
    }, { traceEveryFrame: budgetFrames <= 60 * fps, sample: async (i, st) => {
      const audit = {};
      if (kilnRoute) {
        const step = Math.hypot(...st.pos.map((v, axis) => v - previousPos[axis]));
        if (step > continuity.maxStepMeters) { continuity.maxStepMeters = step; continuity.maxStepFrame = i; }
        if ((!Number.isFinite(step) || step > continuity.jumpLimitMeters) && continuity.firstLargeStep === null) continuity.firstLargeStep = { frame: i, meters: Number.isFinite(step) ? step : String(step), from: previousPos, to: st.pos };
        previousPos = st.pos;
        encounter.minWisps = Math.min(encounter.minWisps, st.shades.wisps);
        const knockback = st.shades.knockbackTravel ?? 0;
        encounter.knockbackTravelMeters += st.shades.hits > previousHits ? knockback : Math.max(0, knockback - previousKnockback);
        previousKnockback = knockback; previousHits = st.shades.hits;
        const ndc = await page.evaluate(() => {
          const { fox, camera } = window.__gameHooks.debug;
          const focus = fox.getWorldPosition(fox.position.clone());
          focus.y += 0.6;
          return focus.project(camera).toArray();
        });
        const inFrame = ndc.every(v => Number.isFinite(v) && Math.abs(v) <= 1);
        framing.samples++;
        if (Number.isFinite(ndc[0])) framing.maxAbsX = Math.max(framing.maxAbsX, Math.abs(ndc[0]));
        if (Number.isFinite(ndc[1])) framing.maxAbsY = Math.max(framing.maxAbsY, Math.abs(ndc[1]));
        const finite = ndc.every(Number.isFinite);
        const serialNdc = ndc.map(v => Number.isFinite(v) ? v : String(v));
        if (!inFrame) {
          framing.outside++;
          const failure = { frame: i, ndc: serialNdc, finite };
          framing.firstFailure ??= failure;
          if (framing.failures.length < 16) framing.failures.push(failure);
        }
        Object.assign(audit, { foxFocusNdc: serialNdc, foxFocusFinite: finite, foxFocusInFrame: inFrame });
      }
      // Bounded diagnostics for the camera stream's recorded hidden-wedge and
      // over-compressed stair frames. Run only on the remote capture worker.
      if (![765, 775, 780, 790, 800, 1080, 1110, 1140, 1620].includes(i)) return Object.keys(audit).length ? audit : undefined;
      const diagnostic = await page.evaluate(() => {
        const { renderer, scene, camera } = window.__gameHooks.debug;
        const materials = new Map();
        scene.traverse(o => {
          if (!o.isMesh) return;
          for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
            const u = renderer.properties.get(m).uniforms;
            if (m.isMeshStandardMaterial && !materials.has(m.uuid)) materials.set(m.uuid, {
              name: m.name, cutout: !!u?.uOccFox,
              centreDepth: u?.uOccFox?.value?.toArray(), radii: u?.uOccRad?.value?.toArray(), strength: u?.uOccStrength?.value,
            });
          }
        });
        return { camera: { position: camera.position.toArray(), quaternion: camera.quaternion.toArray(), projection: camera.projectionMatrix.toArray(), worldInverse: camera.matrixWorldInverse.toArray() }, drawingBuffer: [renderer.domElement.width, renderer.domElement.height], materials: [...materials.values()] };
      });
      save(`${name}-camera-frame-${i}.json`, diagnostic);
      await page.screenshot({ path: path.join(out, `${name}-camera-frame-${i}.png`) });
      return { ...audit, cameraDiagnostic: `${name}-camera-frame-${i}.json` };
    } });
    if (kilnRoute) save('route-framing.json', { ...framing, scope: 'Every encoded frame; fox focus point only, not full silhouette or occlusion' });
    await H('autopilot', false, state.auto.idx, { assist: false });
    await H('setKeys', []); await H('setStick', null); await shot('route-end');

    const endpointReached = kilnRoute ? kilnCompletion !== undefined && kilnCompletion.idx >= to : bounded ? state.auto.idx >= to : state.restored;
    const endpoint = route[to - 1];
    const endpointDistance = Math.hypot(state.pos[0] - endpoint.x, state.pos[2] - endpoint.z);
    const endpointStable = endpointDistance <= 3 && Math.abs(state.pos[1] - endpoint.y) <= 1 && state.grounded;
    const kilnLit = state.seedwells.some(s => s.id === 'SW1' && s.lit);
    const passed = endpointReached && (!kilnRoute || kilnLit && kilnLatchedAt !== undefined && kilnStopped && kilnCompletedAt < 60 * fps - 1 && departedAt === undefined && endpointStable && !state.auto.stalled && continuity.firstLargeStep === null && framing.samples === report.videos[name].frames && framing.outside === 0 && report.videos[name].frames >= 60 * fps) && !state.auto.assists && !state.deaths;
    const reason = passed ? 'passed' : state.deaths ? 'deaths' : state.auto.assists ? 'assisted' : endpointReached && kilnRoute && !kilnLit ? 'kiln-unlit' : kilnRoute && endpointReached && (!kilnStopped || kilnCompletedAt >= 60 * fps - 1) ? 'arrival-too-late-for-idle' : kilnRoute && endpointReached && departedAt !== undefined ? 'idle-drift' : kilnRoute && endpointReached && !endpointStable ? 'endpoint-drift' : state.auto.stalled ? 'stalled' : kilnRoute && continuity.firstLargeStep ? 'position-jump' : endpointReached && kilnRoute && framing.outside > 0 ? 'fox-out-of-frame' : kilnRoute && !endpointReached && firstFeedCrossing ? 'arrival-missing' : report.videos[name].frames >= Number(arg('route-seconds', '360')) * fps ? 'budget' : 'incomplete';
    const failureFrame = reason === 'idle-drift' ? departedAt : reason === 'fox-out-of-frame' ? framing.firstFailure.frame : reason === 'position-jump' ? continuity.firstLargeStep.frame : report.videos[name].frames - 1;
    const failurePhase = passed ? null : kilnCompletedAt === undefined || failureFrame < kilnCompletedAt ? 'pre-arrival' : 'post-arrival';
    save('route-acceptance.json', { schemaVersion: 3, passed, reason, from, to, staged: regional, postKiln: kilnRoute ? 'Live endpoint idle through 60s; bot and keys cleared, physics/rendering continue' : null, kilnLatchedAt, kilnCompletedAt, kilnCompletion, firstFeedCrossing, departedAt, failurePhase, failureFrame: passed ? null : failureFrame, postArrivalSeconds: kilnCompletedAt === undefined ? null : (report.videos[name].frames - kilnCompletedAt - 1) / fps, finalDistanceToFeed: endpointDistance, finalNearFeedStable: endpointStable, continuity: kilnRoute ? continuity : null, encounter: kilnRoute ? { ...encounter, finalHits: state.shades.hits, hitsBeforeArrival: kilnCompletion ? kilnCompletion.shades.hits - encounter.initialHits : state.shades.hits - encounter.initialHits, hitsAfterArrival: kilnCompletion ? state.shades.hits - kilnCompletion.shades.hits : null } : null, framing: kilnRoute ? { samples: framing.samples, outside: framing.outside, maxAbsX: framing.maxAbsX, maxAbsY: framing.maxAbsY, firstFailure: framing.firstFailure } : null, endpointArrivalSeconds: kilnCompletedAt === undefined ? null : (kilnCompletedAt + 1) / fps, duration: report.videos[name].duration, startPos: start.pos, spawnDistanceToFirst, endpoint: route[to - 1].label ?? null, endpointReached, kilnLit, auto: state.auto, restored: state.restored, deaths: state.deaths });
    if (!passed) report.failures.push(`Route ${reason}: ${JSON.stringify(state.auto)}, restored=${state.restored}, deaths=${state.deaths}, interval=${from}-${to}`);
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
      // Central arrival lane: keep the front camera and running fox clear of H-a and its rock wall.
      const stages = await page.evaluate(() => {
        const h = window.__gameHooks, col = h.debug.world.collision;
        return [[0,70],[-8,78],[-18,76],[20,62],[-20,52],[12,52],[28,54]].map(([x,z]) => {
          const y = col.highestAt(x,z), look = [x,y+0.5,z];
          const views = [[0,.6,-5.2],[3.5,.7,-4],[-5.6,.55,0],[-3.3,.9,4.4],[0,.9,5.4],[-.8,.95,-2.2]];
          const blockers = views.map(([dx,dy,dz]) => h.photoBlocker([x+dx,Math.max(y+dy,col.highestAt(x+dx,z+dz)+.3),z+dz],look));
          return {x,y,z,blockers,score:blockers.filter(Boolean).length};
        }).sort((a,b)=>a.score-b.score);
      });
      save(`fox-${state}-stages.json`, stages);
      const stage = stages[0];
      await H('teleport', stage.x, stage.y, stage.z, Math.PI);
      await advance(60, false);
      const p = await H('getFoxPos'), at = [p.x, p.y + 0.5, p.z];
      await page.addStyleTag({ content: '#hud > :not(#vignette), .lil-gui { visibility: hidden !important; }' });
      // fox faces -Z at yaw PI: "front" camera sits on -Z
      const views = { front: [0, 0.6, -5.2, 30], three_q: [3.5, 0.7, -4.0, 30], side: [-5.6, 0.55, 0, 30],
        back_three_q: [-3.3, 0.9, 4.4, 30], back: [0, 0.9, 5.4, 30], face: [-0.8, 0.95, -2.2, 26] };
      for (const [name, [dx, dy, dz, fov]] of Object.entries(views)) {
        const look = name === 'face' ? [p.x, p.y + 0.82, p.z - 0.45] : at;
        const cameraFloor = await page.evaluate(([x, z]) => window.__gameHooks.debug.world.collision.highestAt(x, z), [p.x + dx, p.z + dz]);
        await H('photo', [p.x + dx, Math.max(p.y + dy, cameraFloor + 0.3), p.z + dz], look, fov);
        await advance(3); await shot(`fox-${state}-${name}`);

      }
      await H('photoOff'); await advance(30); await shot(`fox-${state}-chase-idle`);
      await H('setKeys', ['KeyW']); await advance(70); await shot(`fox-${state}-chase-run`);
      await H('setKeys', ['KeyW', 'KeyA']); await advance(25); await shot(`fox-${state}-chase-turn`);
      await H('setKeys', []);
      // Labelled tracking review: live controller input, camera follows at hero-readable distance.
      await H('setKeys', ['KeyW']);
      await video(`fox-${state}-run-staged-close`, 2 * fps, async () => {
        const f = await H('getFoxPos');
        await H('photo', [f.x+2.7,f.y+0.9,f.z-3.0], [f.x,f.y+0.52,f.z], 34);
      });
      await H('setKeys', []); await H('photoOff');
    }
  }
  if (wants('turntable')) {
    // Character turntable: idle fox, camera orbits once at a fixed radius (restored grade).
    await boot(quality, true); await H('forceRestore'); await advance(660, false);
    const turntableY = await page.evaluate(() => window.__gameHooks.debug.world.collision.highestAt(0, 70));
    await H('teleport', 0, turntableY, 70, Math.PI); await advance(60, false);
    const p = await H('getFoxPos'), n = 8 * fps;
    await video('fox-turntable', n, async i => {
      const a = i / n * Math.PI * 2;
      const cx = p.x + Math.sin(a) * 3.4, cz = p.z - Math.cos(a) * 3.4;
      const floor = await page.evaluate(([x, z]) => window.__gameHooks.debug.world.collision.highestAt(x, z), [cx, cz]);
      await H('photo', [cx, Math.max(p.y + 0.75, floor + 0.3), cz], [p.x, p.y + 0.5, p.z], 34);
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
