// Runtime integration diagnostic, NOT an earned-route proof: stage source and saved teach fact.
import { chromium } from 'playwright';
import { createServer } from 'vite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const out = process.argv[2] || `/captures/hazel/hearthbound-runtime-${Date.now()}`;
await fs.mkdir(out,{recursive:true});
const server=await createServer({configFile:'games/fox-spirit/vite.config.ts',server:{port:5197,host:'127.0.0.1',strictPort:true},logLevel:'error'});
await server.listen();
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const evidence={staging:'Each case boots independently. Learned case injects saved russetvale teach only. Teleport to authored ember; keyboard E and Shift drive pickup/dash. Does not prove earning or walking to source.',errors:[],cases:[]};
try {
 for(const learned of [false,true]) {
  const context=await browser.newContext({viewport:{width:960,height:540}});
  if(learned) await context.addInitScript(()=>localStorage.setItem('russet-vale-worlds-v1',JSON.stringify({version:1,worlds:{russetvale:{restored:['teach'],visited:['teach']}}})));
  const page=await context.newPage();page.on('pageerror',e=>evidence.errors.push(String(e)));
  await page.goto('http://127.0.0.1:5197/?manual=1');
  await page.waitForFunction(()=>window.__gameHooks?.ready,null,{timeout:120000});
  const initial=await page.evaluate(()=>{const h=window.__gameHooks;h.setManual(true);const s=h.advance(1,1/60,false);const p=s.opening.carry.position;h.teleport(p[0],p[2]-.6,0);return h.advance(12,1/60,true)});
  await page.keyboard.down('e');
  const pickup=await page.evaluate(()=>window.__gameHooks.advance(1,1/60,true));
  await page.keyboard.up('e');
  assert.ok(pickup.opening.carry.carried,'pickup succeeds');
  await page.screenshot({path:`${out}/${learned?'learned':'locked'}-pickup.png`});
  await page.keyboard.down('Shift');
  const dash=await page.evaluate(()=>window.__gameHooks.advance(1,1/60,true));
  await page.keyboard.up('Shift');
  assert.equal(dash.opening.carry.carried,learned,'runtime ability controls retention');
  assert.equal(dash.opening.carry.dashDrops,learned?0:1);
  assert.equal(dash.opening.carry.carriedDashes,learned?1:0);
  const after=await page.evaluate(()=>window.__gameHooks.advance(8,1/60,true));
  await page.screenshot({path:`${out}/${learned?'learned':'locked'}-dash.png`});
  // Inspection lens only: preserve the action state and view the mouth from the side.
  await page.evaluate(()=>{const {camera,ctx}=window.__opening;const p=ctx.fox.root.position;camera.position.set(p.x+1.5,p.y+.8,p.z+1.5);camera.lookAt(p.x,p.y+.35,p.z);window.__gameHooks.advance(0,1/60,true)});
  await page.screenshot({path:`${out}/${learned?'learned':'locked'}-side.png`});
  evidence.cases.push({learned,initial,pickup,dash,after});
  await context.close();
 }
 assert.deepEqual(evidence.errors,[]);
 evidence.pass=true;
} finally {
 await fs.writeFile(`${out}/evidence.json`,JSON.stringify(evidence,null,2));
 await browser.close();await server.close();
}
console.log(`PASS Hearthbound runtime locked/unlocked: ${out}`);
