// Independent Hermitage terrain/collider access review: staged starts only, then live movement input.
import { chromium } from 'playwright';
import { createServer, preview } from 'vite';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const out=process.argv[2] || 'playtest-output/fox-spirit/hermitage-access';
const production=process.argv.includes('--production');
fs.mkdirSync(out,{recursive:true});
const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const server=production
 ? await preview({configFile:'games/fox-spirit/vite.config.ts',preview:{port:5223,host:'127.0.0.1',strictPort:true},logLevel:'error'})
 : await createServer({configFile:'games/fox-spirit/vite.config.ts',server:{port:5223,host:'127.0.0.1',strictPort:true},logLevel:'error'});
if(!production)await server.listen();
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:640,height:360}});page.setDefaultTimeout(180000);
const errors=[];page.on('pageerror',e=>errors.push(String(e)));
const evidence={sha,runtime:production?'vite-production-preview':'vite-dev',staging:'Each case has an explicit initial teleport; no teleport after movement starts; no forced Hermitage state; no coal carried.',cases:[],errors};
try {
 await page.goto('http://127.0.0.1:5223/?manual=1',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__gameHooks?.ready);
 await page.evaluate(()=>window.__gameHooks.setManual(true));
 const cases=[
 {id:'north-lane-desk-lines-return',start:[-9.7,102.3],legs:[[-12.6,108.2],[-14.2,114.6],[-11.4,120.8],[-7.6,124.6],[-7,129.4],[-8.2,134],[-8.6,135.4],[-11.6,129.65],[-7,129.4],[.2,130],[-7,129.4],[-10,134],[-12.3,138.7],[-10,134],[-7,129.4],[-7.6,124.6],[-11.4,120.8],[-14.2,114.6],[-12.6,108.2],[-9.7,102.3]],arrival:6},
 ];
 for(const test of cases){
  const result=await page.evaluate(test=>{
   const h=window.__gameHooks;h.setStick(0,0);h.setKeys([]);h.teleport(test.start[0],test.start[1],Math.PI);let s=h.advance(30,1/60,false);
   const trace=[],legs=[],images=[];let frame=0;
   for(let i=0;i<test.legs.length;i++){
    const goal=test.legs[i];let done=false,min=Infinity;
    for(let f=0;f<900;f+=6){
     const dx=goal[0]-s.pos[0],dz=goal[1]-s.pos[2],d=Math.hypot(dx,dz);min=Math.min(min,d);
     if(d<.55){done=true;break;}
     h.setStick(dx/(d||1),dz/(d||1));s=h.advance(6,1/60,false);frame+=6;
     trace.push({frame,leg:i,pos:s.pos,grounded:s.grounded,gliding:s.gliding,camera:s.camera});
    }
    legs.push({id:i,goal,done,minDistance:min,pos:s.pos});
    if(done&&(i===test.arrival||i===12)){h.advance(0,1/60,true);images.push({name:i===12?'leaves-released':'desk-arrival',data:document.querySelector('canvas').toDataURL()});}
    if(!done)break;
   }
   h.setStick(0,0);h.setKeys([]);h.advance(30,1/60,true);
   return {id:test.id,required:test.required!==false,legs,trace,images,game:{mode:window.__game.mode,state:window.__game.state()}};
  },test);
  for(const im of result.images){fs.writeFileSync(`${out}/${test.id}-${im.name}.png`,Buffer.from(im.data.split(',')[1],'base64'));}
  delete result.images;
  evidence.cases.push(result);console.log(JSON.stringify({id:result.id,legs:result.legs}));
  fs.writeFileSync(`${out}/evidence.tmp`,JSON.stringify(evidence,null,2));fs.renameSync(`${out}/evidence.tmp`,`${out}/evidence.json`);
  await page.screenshot({path:`${out}/${test.id}.png`});
 }
 evidence.checks={allLegsComplete:evidence.cases.filter(c=>c.required).every(c=>c.legs.every(l=>l.done)),finite:evidence.cases.every(c=>c.trace.every(r=>r.pos.every(Number.isFinite))),noErrors:errors.length===0,allLinesFreed:evidence.cases.every(c=>c.game.state.opening.hermitage.freed.every(Boolean)),plateauPainted:evidence.cases.every(c=>c.game.state.opening.hermitage.painted),deskCaption:evidence.cases.every(c=>c.game.state.opening.hermitage.captioned)};
 fs.writeFileSync(`${out}/evidence.tmp`,JSON.stringify(evidence,null,2));fs.renameSync(`${out}/evidence.tmp`,`${out}/evidence.json`);console.log(JSON.stringify(evidence.checks));
 if(Object.values(evidence.checks).some(v=>!v))process.exitCode=1;
}finally{await browser.close();if(production)await new Promise(resolve=>server.httpServer.close(resolve));else await server.close();}
