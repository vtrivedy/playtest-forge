// scratch probe (not committed): real restore sequence, override the lens at given ages, report fox framing
//   npx tsx tools/_probe-shot.ts <outDir> '<json [{age, cams:[{name, frame?, pos?, look?, fov?}]}]>'
// frame 'fox' = restore.ts approach frame (x right of fox facing basin, y up from S, z back along approach); 'world' = offset from S.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
const port = 5294;
const out = process.argv[2]!;
const plan = JSON.parse(process.argv[3]!) as Array<{ age: number; cams: Array<{ name: string; frame?: string; pos?: number[]; look?: number[]; fov?: number; dyaw?: number; js?: string }> }>;
const q = process.env.Q ?? 'high';
fs.mkdirSync(out, { recursive: true });
const vite = spawn('npx', ['vite', '--config', 'games/fox-spirit/vite.config.ts', '--host', '127.0.0.1', '--port', String(port)], { stdio: 'ignore', detached: true });
const url = `http://127.0.0.1:${port}/?q=${q}`;
try {
  for (let t = Date.now(); Date.now() - t < 45000; ) { try { await fetch(url); break; } catch { await new Promise((r) => setTimeout(r, 250)); } }
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  await page.addInitScript(`(() => { let a = 7; Math.random = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })()`);
  await page.goto(url, { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction('Boolean(window.__gameHooks)', null, { timeout: 120000 });
  await page.addStyleTag({ content: '#title-card,#ember-count,#prompt,#restore-flash,#debug-panel{display:none!important}' });
  await page.evaluate(`(() => { const H = window.__gameHooks; H.setManual(true); H.resetRestore(); H.teleport(-5, 38, -83.5, Math.atan2(5, -5.5)); H.advance(60, 1/60, false); H.setKeys(['KeyW']);
    let s; for (let i = 0; i < 600; i++) { s = H.advance(1, 1/60, false); if (s.restore.phase !== 'idle') break; } H.setKeys([]); window.__trig = s.pos; return s.restore.phase; })()`);
  for (const step of plan) {
    await page.evaluate(`(() => { const H = window.__gameHooks; let s = H.state(); while (s.restore.age < ${step.age} - 1e-6) s = H.advance(1, 1/60, false); })()`);
    for (const c of step.cams) {
      const r = await page.evaluate(`(() => {
        const H = window.__gameHooks; const cam = H.debug.camera; const fox = H.debug.fox; const V = cam.position.constructor;
        const S = new V(0, 38, -89); const ap = new V(-0.9, 0, 3.75).normalize(); const rt = new V(ap.z, 0, -ap.x);
        const kp = (f, v) => f === 'world' ? new V(S.x + v[0], S.y + v[1], S.z + v[2]) : S.clone().addScaledVector(rt, v[0]).setY(S.y + v[1]).addScaledVector(ap, v[2]);
        const c = ${JSON.stringify(c)};
        if (c.js) eval(c.js);
        if (c.dyaw !== undefined) { fox.rotation.y = Math.atan2(-ap.x, -ap.z) + c.dyaw; }
        if (c.pos) { cam.position.copy(kp(c.frame ?? 'fox', c.pos)); cam.lookAt(kp(c.frame ?? 'fox', c.look)); cam.fov = c.fov ?? cam.fov; cam.updateProjectionMatrix(); cam.updateMatrixWorld(); }
        let y0 = 9, y1 = -9, x0 = 9, x1 = -9; const p = new V();
        fox.updateMatrixWorld(true);
        fox.traverse((o) => { if (!o.isMesh || !o.visible || !o.geometry?.attributes?.position) return; const a = o.geometry.attributes.position; const n = a.count; const st = Math.max(1, Math.floor(n / 400));
          for (let i = 0; i < n; i += st) { p.fromBufferAttribute(a, i); if (o.isSkinnedMesh) o.applyBoneTransform(i, p); p.applyMatrix4(o.matrixWorld).project(cam); if (p.z > 1) continue; y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); } });
        const b = new V(0, 40.9, -89).project(cam);
        H.advance(0, 1/60, true);
        const s = H.state();
        return { age: +s.restore.age.toFixed(3), front: +s.restore.frontRadius.toFixed(1), foxH: +((y1 - y0) / 2).toFixed(3), foxX: [+((x0 + 1) / 2).toFixed(2), +((x1 + 1) / 2).toFixed(2)], foxY: [+((1 - y1) / 2).toFixed(2), +((1 - y0) / 2).toFixed(2)], basin: [+((b.x + 1) / 2).toFixed(2), +((1 - b.y) / 2).toFixed(2)], cam: cam.position.toArray().map((v) => +v.toFixed(2)), foxPos: fox.position.toArray().map((v) => +v.toFixed(2)), rt: rt.toArray().map((v)=>+v.toFixed(3)), ap: ap.toArray().map((v)=>+v.toFixed(3)) };
      })()`);
      console.log(c.name, JSON.stringify(r));
      await page.screenshot({ path: `${out}/${c.name}.png`, timeout: 120000 });
    }
  }
  await browser.close();
} finally {
  try { process.kill(-vite.pid!, 'SIGTERM'); } catch { /* */ }
}
