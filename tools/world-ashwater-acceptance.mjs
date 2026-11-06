// Independent fresh-boot hub-entry acceptance; Ashwater waypoints derived from Cedar's route.
// node tools/world-ashwater-acceptance.mjs [outDir]
import {playPressInputRoute} from './lib/press-input-route.mjs';
import {createDiscoveryPolicy} from './lib/discovery-policy.mjs';
import {createDiscoveryObserver} from './lib/discovery-observer.mjs';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const out = path.resolve(args[0] && !args[0].startsWith('--') ? args[0] : '/tmp/ashwater-probe');
const frames = args.includes('--frames');
const marshClip = args.includes('--marsh-clip');
const pressRoute = args.includes('--press-route');
const entryTour = args.includes('--entry-tour') || pressRoute;
let tourPassed = false;
const started=Date.now();
fs.mkdirSync(out, { recursive: true });
const port = Number(process.env.ACCEPT_PORT ?? 5251);
const server = await createServer({ configFile: 'games/fox-spirit/vite.config.ts', server: { port, host: '127.0.0.1', strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, args: process.env.FOX_TEST_GPU==='1' ? ['--use-gl=angle','--use-angle=gl-egl','--ignore-gpu-blocklist'] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 640, height: 360 } })).newPage();
page.setDefaultTimeout(900000);
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if(m.type()==='error') errors.push(`console: ${m.text()}`); });
const log = [];
const commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
let fi = 0;
const O = { x: 700, z: 80 };
const state = () => page.evaluate(() => { const s = window.__gameHooks.state(); return { pos: s.pos.map((v) => +v.toFixed(2)), grounded: s.grounded, ash: s.opening.ashwater, hooks:s, game:window.__game.state(), timing:window.__routeTiming }; });
const shot = async (name) => {
  await page.evaluate(() => window.__gameHooks.advance(0, 1 / 60, true));
  await page.screenshot({ path: path.join(out, `${name}.png`) });
  log.push([name, await state()]);
  fs.writeFileSync(path.join(out,'partial.json'),JSON.stringify({commit,log,errors,completed:false},null,1));
  console.log(JSON.stringify({beat:name,pos:log.at(-1)[1].pos,elapsedSeconds:(Date.now()-started)/1000}));
};
/** steer (world stick) toward local (lx, lz); optional jump (held = glide) / dash; returns when within reach */
const go = async (lx, lz, o = {}) => {
  const r = await page.evaluate(([x, z, o]) => {
    const h = window.__gameHooks;
    let n = 0;
    const startingWorld=h.state().opening.worlds.active;
    for (; n < (o.max ?? 900); n++) {
      const s = h.state();
      if(s.opening.worlds.active!==startingWorld)break;
      const dx = x - s.pos[0], dz = z - s.pos[2], d = Math.hypot(dx, dz);
      if (d < (o.reach ?? 0.35) && (!o.land || s.grounded)) break;
      const k = Math.min(1, d / 0.8) * (o.speed ?? 1);
      h.setStick(d > 0.05 ? (dx / d) * k : 0, d > 0.05 ? (dz / d) * k : 0);
      const keys = [];
      // a running jump: hold Space from the moment the fox is within `jumpAt` of the target (default: at once)
      if (o.jump && d < (o.jumpAt ?? 99)) o.jumped = o.jumped ?? n;
      if (o.jump && o.jumped !== undefined && n - o.jumped < (o.hold ?? 40)) keys.push('Space');
      if (o.dash && n >= (o.dashAt ?? 0) && n < (o.dashAt ?? 0) + 4) keys.push('ShiftLeft');
      h.setKeys(keys);
      h.advance(1, 1 / 60, false);
    }
    h.setKeys([]);h.setStick(0,0);
    return n;
  }, [O.x + lx, O.z + lz, o]);
  if (frames) {
    await page.evaluate(() => window.__gameHooks.advance(0, 1 / 60, true));
    await page.screenshot({ path: path.join(out, `f${String(fi++).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 80 });
  }
  return r;
};
const settle = (n) => page.evaluate((n) => { const h = window.__gameHooks; h.setStick(0, 0); h.setKeys([]); h.advance(n, 1 / 60, false); }, n);
try {
  await page.goto(`http://127.0.0.1:${port}/?fresh&manual=1`, { waitUntil: 'domcontentloaded', timeout: 300000 });
  await page.waitForFunction(() => window.__gameHooks?.ready === true, null, { timeout: 600000 });
  await page.keyboard.press('KeyM');
  await page.evaluate(() => { const h = window.__gameHooks; h.setManual(true);
    const advance=h.advance.bind(h);
    const timing=window.__routeTiming={totalSeconds:0,byWorld:{russetvale:0,ashwater:0,press:0}};
    h.advance=(frames=1,dt=1/60,render=true)=>{
      const world=h.state().opening.worlds.active;
      timing.totalSeconds+=frames*dt;
      timing.byWorld[world]+=frames*dt;
      return advance(frames,dt,render);
    };
  });
  console.log('boot-ready');
  const gl=await page.evaluate(()=>{const gl=window.__opening.ctx.renderer.getContext(),e=gl.getExtension('WEBGL_debug_renderer_info');return e&&gl.getParameter(e.UNMASKED_RENDERER_WEBGL);});
  console.log(JSON.stringify({renderer:gl}));
  if(process.env.FOX_TEST_GPU==='1'&&!/nvidia/i.test(gl))throw Error('Hardware GPU required');
  await page.evaluate(({policy,observer})=>{
    const h=window.__gameHooks, follow=new Function(`return (${policy})`)()(), observe=new Function(`return (${observer})`)()(window.__opening.ctx.scene,window.__opening.camera,window.__opening.ctx.fox.root);
    for(let f=0;f<5400;f++){
      const s=h.state(), cue=observe(f/60,s.opening.teach?.showing);
      let {x,z,jump,dash}=follow(cue,s);
      if(cue.search){x=Math.sin(s.yaw+1.4)*.15;z=Math.cos(s.yaw+1.4)*.15;}
      h.setStick(x,z);h.setKeys([...(jump?['Space']:[]),...(dash?['ShiftLeft']:[])]);h.advance(1,1/60,false);
    }
  },{policy:createDiscoveryPolicy.toString(),observer:createDiscoveryObserver.toString()});
  await shot('00-discovery');
  if(!(await state()).hooks.opening.popUpRuin.reached)throw Error('Fresh discovery did not finish');
  // World-space route home; ordinary steering through the clearing to the hub arch.
  await go(-25.7-O.x,69.6-O.z,{speed:.08,reach:.45});
  await settle(30);
  await page.evaluate(()=>{const h=window.__gameHooks;h.setStick(.057,.057);h.advance(36,1/60,false);h.setKeys(['ShiftLeft']);h.advance(4,1/60,false);h.setKeys([]);h.setStick(0,0);h.advance(100,1/60,false);});
  for(const [x,z] of [[-24.4,72.1],[-24.4,75.7],[-20,79],[-14,80],[-6,77.5],[-3.2,80.5],[-3.2,86.5],[-4,88],[-7.2,88]])await go(x-O.x,z-O.z,{speed:.6,reach:.5});
  await settle(600);
  await shot('00-homecoming');
  if(!(await state()).hooks.opening.homecoming.pinned)throw Error('Page not physically home');
  for(const [x,z] of [[-4,88],[-2,90],[-1,93]])await go(x-O.x,z-O.z);
  await settle(120);
  await shot('01-hub-entry');
  if((await state()).hooks.opening.worlds.active!=='ashwater')throw Error('Hub arch did not enter Ashwater');
  if((await state()).game.opening.teach.showing==='Follow the warm light home')throw Error('Autumn hint leaked into Ashwater');
  await shot('00-landing');
  if (marshClip) {
    // Continuous walking review after physical hub arrival, before the puzzle route.
    // 6 simulated seconds at 12 fps; input only, no placement or progress setters.
    for (let f = 0; f < 72; f++) {
      await page.evaluate(f => {
        const h = window.__gameHooks;
        h.setStick(f < 36 ? 0.45 : -0.45, 0.15);
        h.setKeys([]);
        h.advance(5, 1 / 60, true);
      }, f);
      await page.screenshot({path: path.join(out, `marsh-${String(f).padStart(4,'0')}.jpg`), type:'jpeg', quality:85});
    }
    await shot('00-marsh-walk');
    await go(0,-46,{max:900});
    await settle(60);
  }
  if (entryTour) {
    const expectWorld = async (world, travels, name) => {
      await settle(150);
      await shot(name);
      const s = (await state()).hooks.opening.worlds;
      if(s.active !== world || s.travels !== travels) throw Error(`${name}: expected ${world}/${travels}, got ${s.active}/${s.travels}`);
    };
    // Ashwater arrival faces inward; its return arch stands three metres behind the spawn.
    await go(0, -52, {max:600});
    await expectWorld('russetvale', 2, 'tour-02-home');
    for(const [x,z] of [[-6,89],[-9.5,90],[-11,95]]) await go(x-O.x,z-O.z);
    await expectWorld('press', 3, 'tour-03-press');
    if(pressRoute){
      await playPressInputRoute(page, name=>shot(`press-${name}`));
      await go(-700-O.x,123-O.z,{max:1800});
    }
    // The snowfield return arch is behind its arrival, following the island's outward gradient.
    await go(-700-O.x,132-O.z,{max:600});
    await expectWorld('russetvale', 4, 'tour-04-home');
    for(const [x,z] of [[-4,88],[-2,90],[-1,93]]) await go(x-O.x,z-O.z);
    await expectWorld('ashwater', 5, 'tour-05-reentry');
    tourPassed = true;
  } else {
  // Level 1, Low Sluice: try the channel first (it is deep: the fox is put back), then dash the dam
  await go(0, -31.5, { max: 400 });
  await settle(30);
  log.push(['wade-test', await state()]);
  await go(-6.5, -35.4);
  await shot('01-dam');
  await go(-12.5, -35.2, { dash: true, dashAt: 2, max: 90, reach: 0.6 });
  await settle(240);
  await shot('02-drained');
  const westOnly = (await state()).ash;
  if (!westOnly.damA || westOnly.damA2) throw Error('First sluice must drain only the west reach');
  for (const [x, z] of [[-14, -29], [-30, -28.6], [-43.5, -28.0]]) await go(x, z, { max: 900 });
  await settle(60);
  await shot('02b-roof');
  await go(-6, -28.5, { max: 900 });
  await go(-0.9, -28.5, { dash: true, dashAt: 1, max: 60, reach: 0.6 });
  await settle(240);
  await shot('02c-east-reach');
  if (!(await state()).ash.damA2) throw Error('Culvert did not drain east reach');
  for (const [x, z] of [[-1.0, -28.5], [2.5, -28.5], [2.5, -20], [0, -13]]) await go(x, z, { max: 900 });
  await settle(90);
  await shot('03-reed-island');
  // Level 2, Reed Pond: running jumps mat to mat, the branch out to the islet first
  const hop = async (x, z) => { await go(x, z, { jump: true, jumpAt: 2.3, hold: 14, max: 240, reach: 0.6, land: true }); };
  const M = [[-0.8, -6.0], [0.8, -3.0], [0, 0]];
  const B = [[3.2, 0.5], [6.4, 0.2], [9.6, 0.7], [12.8, 0.4], [16.0, 0.8], [19.2, 0.6], [22.6, 1.0]];
  await go(-0.8, -10.2);
  await hop(M[0][0], M[0][1]);
  const splashesBefore = (await state()).ash.splashes;
  await settle(200);
  await shot('03b-mat-sank');
  if ((await state()).ash.splashes <= splashesBefore) throw Error('Standing on a reed mat did not sink it and return the fox');
  await go(-0.8, -10.2);
  for (const [x, z] of M) await hop(x, z);
  await shot('04-mats');
  for (const [x, z] of B) await hop(x, z);
  // Level 3 part: dash the islet's dam
  await go(26.2, 1.0, { dash: true, dashAt: 1, max: 60, reach: 0.6 });
  await settle(240);
  await shot('05-pool-drained');
  for (const [x, z] of [...B.slice(0, -1).reverse(), [0, 0], [-0.9, 3.0], [0.6, 6.0], [-0.5, 9.0], [0.4, 12.0], [0, 15.2]]) await hop(x, z);
  await go(0, 17.5);
  await shot('06-mill-shore');
  // Enter the drained cistern and climb the weir before flooding it from inside.
  await go(0, 19.6);
  await go(0, 22.8);
  await go(0, 26.9);
  for (let i = 0; i < 9; i++) await go(0, 27.75 + i * 0.68, { jump: true, hold: 14, max: 120, reach: 0.4, land: true });
  await go(0, 35.2, { jump: true, hold: 14, max: 120, land: true });
  await shot('07-weir');
  const drainedPool = (await state()).ash.poolY;
  await go(2.0, 37.2);
  await go(6.5, 37.2, { dash: true, dashAt: 1, max: 60, reach: 0.6 });
  await settle(600);
  await shot('07b-flooded');
  const flooded = (await state()).ash;
  if (!flooded.flood || flooded.poolY <= drainedPool + 1) throw Error('Weir gate did not raise the cistern');
  await go(12.75, 35.4);
  await shot('07c-weir-edge');
  await go(12.75, 32.3, { max: 200, reach: 0.5 });
  await shot('07d-punt');
  await go(12.75, 30.1);
  await go(14.2, 30.0, { max: 200, reach: 0.4 });
  await shot('07e-wall');
  await go(14.2, 27.0);
  await go(15.3, 26.0);
  await go(18.0, 26.5);
  await settle(200);
  await shot('08-seedwell');
  const completed = (await state()).hooks.opening.worlds.progress.worlds.ashwater;
  if(completed.ability!=='Reedskim' || completed.fill!==1 || completed.restored.length!==3)throw Error('Physical Ashwater completion did not earn Reedskim and fill Reed');
  const secrets = (await state()).hooks.opening.worlds.progress.secrets;
  if (!['ashwater-roof','ashwater-mooring'].every(id => secrets.includes(id))) throw Error('Physical side places did not earn both canonical memories');
  await page.keyboard.press('Tab');
  await shot('09-album');
  await page.keyboard.press('Tab');
  }
} catch (e) {
  errors.push(String(e?.stack ?? e));
} finally {
  const last = log.length ? log[log.length - 1][1] : null;
  fs.writeFileSync(path.join(out, 'log.json'), JSON.stringify({ commit, provenance:"Fresh boot; rendered invitation follower then movement only; no teleport or progress setters", log, errors, pass: errors.length===0 && !!last && (entryTour ? tourPassed : last.ash.done.length === 3) }, null, 1));
  if (marshClip) execFileSync('ffmpeg', ['-y', '-v', 'error', '-framerate', '12', '-i', path.join(out, 'marsh-%04d.jpg'), '-pix_fmt', 'yuv420p', path.join(out, 'marsh-walk.mp4')]);
  if (frames && fi > 0) execFileSync('ffmpeg', ['-y', '-v', 'error', '-framerate', '6', '-i', path.join(out, 'f%04d.jpg'), '-pix_fmt', 'yuv420p', path.join(out, 'route.mp4')]);
  console.log(JSON.stringify({ errors, last:last?{pos:last.pos,ash:last.ash}:null }, null, 1));
  process.exitCode=errors.length===0 && (entryTour ? tourPassed : last?.ash.done.length===3) ? 0 : 1;
  await browser.close();
  await server.close();
}
