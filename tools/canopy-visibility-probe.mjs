// Staged ground positions; tests the actual chase camera and shared opening fade.
import { chromium } from 'playwright';
import { createServer } from 'vite';
import fs from 'node:fs';
const out=process.argv[2]||'/captures/tallow/canopy-visibility-01';fs.mkdirSync(out,{recursive:true});
const server=await createServer({configFile:'games/fox-spirit/vite.config.ts',server:{port:5198,host:'127.0.0.1',strictPort:true},logLevel:'error'});await server.listen();
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:960,height:540}});page.setDefaultTimeout(120000);
const result={staging:'Ground positions around leaves; ordinary chase camera, no camera override.',errors:[],samples:[],checks:[]};page.on('pageerror',e=>result.errors.push(String(e)));
try{
 await page.goto('http://127.0.0.1:5198');await page.waitForFunction(()=>window.__gameHooks?.ready);
 await page.evaluate(()=>window.__gameHooks.setManual(true));
 let best=null;
 for(const [x,z] of [[-.2,71.5],[.9,67.1],[-1,64.7]])for(const yaw of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
  const s=await page.evaluate(([x,z,yaw])=>{const h=window.__gameHooks;h.setStick(0,0);h.setKeys([]);h.teleport(x,z,yaw);return h.advance(120,1/60,false)},[x,z,yaw]);
  result.samples.push({x,z,yaw,state:s});
  if(!best||s.opening.canopy.lensTucked>best.state.opening.canopy.lensTucked){best={x,z,yaw,state:s};await page.evaluate(()=>window.__gameHooks.advance(0,1/60,true));await page.screenshot({path:out+'/blocked-chase.png'});}
 }
 result.checks.push({name:'near-lens blade tucks',pass:best.state.opening.canopy.lensTucked>0,detail:best});
 result.recovered=await page.evaluate(()=>{const h=window.__gameHooks;h.teleport(-8,72,Math.PI);return h.advance(180,1/60,true)});
 await page.screenshot({path:out+'/clear-chase.png'});
 result.checks.push({name:'clear view recovers blade',pass:result.recovered.opening.visibility.faded===0&&result.recovered.opening.canopy.lensTucked===0});
 result.game=await page.evaluate(()=>window.__game.state());
}finally{fs.writeFileSync(out+'/evidence.json',JSON.stringify(result,null,2));await browser.close();await server.close();}
console.log(JSON.stringify({out,checks:result.checks,errors:result.errors}));
if(result.errors.length||result.checks.some(c=>!c.pass))process.exitCode=1;
