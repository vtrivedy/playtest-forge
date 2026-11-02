import { chromium } from 'playwright';
import { createServer } from 'vite';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createSliceRoute, SLICE_START } from './opening-hero-route.mjs';
const out=process.argv[2] || '/captures/sorrel/homecoming-natural-slice';
const hz=Number(process.env.SLICE_HZ || 60);
if(![30,60,120].includes(hz))throw new Error('SLICE_HZ must be 30, 60, or 120');
fs.mkdirSync(out,{recursive:true});
const evidence={sha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),hz,staging:`Only initial shared SLICE_START teleport; shared real-stick/jump/dash slice route thereafter. Manual ${hz} Hz; named rendered chase views, no camera override.`,samples:[],errors:[]};
const save=()=>fs.writeFileSync(`${out}/evidence.json`,JSON.stringify(evidence,null,2));
const server=await createServer({configFile:'games/fox-spirit/vite.config.ts',server:{port:5238,host:'127.0.0.1',strictPort:true},logLevel:'error'});
await server.listen();
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:640,height:360}});page.setDefaultTimeout(300000);
page.on('pageerror',e=>evidence.errors.push(String(e)));
try {
 await page.goto('http://127.0.0.1:5238/?manual=1',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__gameHooks?.ready);
 await page.evaluate(({source,start})=>{const h=window.__gameHooks;h.setManual(true);h.teleport(start.x,start.z,start.yaw);window.__sliceProbe={route:new Function(`return (${source})`)()(),state:h.advance(60,1/60,false),frame:0};},{source:createSliceRoute.toString(),start:SLICE_START});
 for(let second=1;second<=150;second++){
  const sample=await page.evaluate(({second,hz})=>{
   const h=window.__gameHooks,p=window.__sliceProbe;let input;
   for(let i=0;i<hz;i++){
    input=p.route(p.frame/hz,p.state);h.setStick(input.x,input.z);h.setKeys([...(input.jump?['Space']:[]),...(input.dash?['ShiftLeft']:[])]);
    p.state=h.advance(1,1/hz,i===hz-1);p.frame++;
   }
   const cam=window.__opening.camera;
   return {t:second,beat:input.beat,complete:input.complete,game:window.__game.state(),path:window.__opening.ctx.player.cam.pathState(),camera:{pos:cam.position.toArray(),quat:cam.quaternion.toArray(),fov:cam.fov}};
  },{second,hz});
  evidence.samples.push(sample);save();
  if([1,45,70,72,75,80,90,110,130,150].includes(second))await page.screenshot({path:`${out}/${String(second).padStart(3,'0')}s.png`});
  if(second%10===0)console.log(second,sample.beat,JSON.stringify({home:sample.game.opening.homecoming,finale:sample.game.opening.finale}));
 }
 const last=evidence.samples.at(-1),g=last.game.opening;
 evidence.checks={complete:last.complete,pageKept:g.page.phase==='kept',pagePinned:g.homecoming.pinned,optionalWellRemainsIncomplete:!g.homecoming.full,optionalCreaturesRemainPressed:g.unpressed.creatures.every(c=>c.phase==='pressed'),onward:g.finale.onward===48,revealSeen:evidence.samples.some(x=>x.path!==null),finalFollow:last.path===null,noErrors:evidence.errors.length===0,finite:evidence.samples.every(x=>[...x.camera.pos,...x.camera.quat,...x.game.pos].every(Number.isFinite))};
 save();console.log(JSON.stringify(evidence.checks));if(Object.values(evidence.checks).some(v=>!v))process.exitCode=1;
}finally{save();await browser.close();await server.close();}
