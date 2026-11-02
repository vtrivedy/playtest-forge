import { chromium } from 'playwright';
import { createServer } from 'vite';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const out=process.argv[2] || '/captures/sorrel/homecoming-reveal';
const moving=process.argv.includes('--move');
const remote=process.argv.includes('--remote');
fs.mkdirSync(`${out}/frames`,{recursive:true});
const evidence={sha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),moving,remote,simulationHz:30,captureFps:15,staging:'Dev free creatures + page; manual simulation, ordinary authored camera; remote mode starts at (28,76); world stick starts at 2s in move run.',samples:[],errors:[]};
const save=()=>fs.writeFileSync(`${out}/evidence.json`,JSON.stringify(evidence,null,2));
const port=moving?5237:5236;
const server=await createServer({configFile:'games/fox-spirit/vite.config.ts',server:{port,host:'127.0.0.1',strictPort:true},logLevel:'error'});
await server.listen();
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:640,height:360}});page.setDefaultTimeout(300000);
page.on('pageerror',e=>evidence.errors.push(String(e)));
try{
 await page.goto(`http://127.0.0.1:${port}/?manual=1`,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__gameHooks?.ready);
 await page.evaluate((remote)=>{
  const h=window.__gameHooks;h.setManual(true);
  for(const id of ['hedgehog','heron','kit','hare'])h.unpress(id);
  for(let i=0;i<80;i++){
   const s=h.advance(30,1/60,false),c=s.opening.unpressed.creatures.find(k=>k.id==='hare');
   if(c.phase==='alive')break;
   if(c.phase==='performing')h.teleport(c.at[0]+1.2,c.at[2]-1.2,0);
  }
  h.advance(1500,1/60,false);h.teleport(remote?28:-5,remote?76:88,Math.PI);h.advance(60,1/60,false);h.homecoming();
 },remote);
 let full=false;
 for(let i=0;i<3600;i++){
  const st=await page.evaluate(()=>{const h=window.__gameHooks;h.advance(1,1/30,false);return {full:h.state().opening.homecoming.full,path:window.__opening.ctx.player.cam.pathState()};});
  if(st.full && (remote || st.path)){full=true;evidence.trigger=st;break;}
 }
 if(!full)throw new Error('No full-well camera path within 120 simulated seconds');
 console.log('trigger',JSON.stringify(evidence.trigger));save();
 for(let i=0;i<240;i++){
  const sample=await page.evaluate(({i,moving})=>{
   const h=window.__gameHooks;
   if(moving && i===60)h.setStick(0,-1);
   if(moving && i===120)h.setStick(0,0);
   h.advance(1,1/30,i%2===1);
   const c=window.__opening.camera;
   return {t:(i+1)/30,game:window.__game.state(),path:window.__opening.ctx.player.cam.pathState(),camera:{pos:c.position.toArray(),quat:c.quaternion.toArray(),fov:c.fov}};
  },{i,moving});
  evidence.samples.push(sample);
  if(i%2===1)await page.screenshot({path:`${out}/frames/${String((i-1)/2).padStart(4,'0')}.jpg`,type:'jpeg',quality:85});
  if(i%30===29){save();console.log('seconds',(i+1)/30,'path',JSON.stringify(sample.path));}
 }
 const s=evidence.samples;
 const onset=s.find(x=>x.game.opening.finale.onward===48)?.t;
 evidence.checks={triggered:!!evidence.trigger?.path,wellFull:s.every(x=>x.game.opening.homecoming.full),onwardFadeIn:onset>=0.5 && onset<=1 && s.filter(x=>x.t>=1).every(x=>x.game.opening.finale.onward===48),naturalEnd:!moving?s.at(-1).path===null:true,yields:moving?s.some(x=>x.t>2 && x.t<4 && x.path?.yielding):true,ended:s.at(-1).path===null,finite:s.every(x=>[...x.camera.pos,...x.camera.quat,...x.game.pos].every(Number.isFinite)),noErrors:evidence.errors.length===0};
 if(remote){
  evidence.checks.triggered=evidence.trigger?.full===true;
  evidence.checks.remoteHasNoReveal=evidence.trigger.path===null && s.every(x=>x.path===null);
  evidence.checks.cameraStaysNearFox=s.every(x=>Math.hypot(x.camera.pos[0]-x.game.pos[0],x.camera.pos[2]-x.game.pos[2])<15);
 }
 save();console.log(JSON.stringify(evidence.checks));if(Object.values(evidence.checks).some(v=>!v))process.exitCode=1;
}finally{save();await browser.close();await server.close();}
