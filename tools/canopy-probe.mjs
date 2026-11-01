// Disclosed staged-start live keyboard probe. No launch/velocity/physics state is forced.
import { chromium } from 'playwright';
import { createServer } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
const arg = (k,d) => {const i=process.argv.indexOf('--'+k);return i<0?d:process.argv[i+1]};
const out=path.resolve(arg('out','/captures/tallow/canopy-greybox-01'));
fs.mkdirSync(out,{recursive:true});
const server=await createServer({configFile:'games/fox-spirit/vite.config.ts',server:{port:5198,host:'127.0.0.1',strictPort:true},logLevel:'error'});
await server.listen();
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader']});
const captureSize=process.argv.includes('--motion')?{width:480,height:270}:{width:960,height:540};
const context=await browser.newContext({viewport:captureSize,recordVideo:{dir:out,size:captureSize}});
const page=await context.newPage();page.setDefaultTimeout(120000);
const result={staging:'Per-profile teleport to first leaf top; all takeoff and flight driven by real Space input. Comparisons alter only launchSpeed tunable.',errors:[],checks:[],samples:[]};
page.on('pageerror',e=>result.errors.push(String(e)));
const motion=process.argv.includes('--motion');
const routeOnly=process.argv.includes('--route-only');
let frameCount=0;
const step=async(n=1)=>{frameCount+=n;return page.evaluate(([n,m])=>window.__gameHooks.advance(n,1/60,m),[n,motion && frameCount%6===0]);};
const shot=async(name)=>{await page.evaluate(()=>window.__gameHooks.advance(0,1/60,true));await page.screenshot({path:path.join(out,name+'.png')});};
const check=(name,pass,detail)=>{result.checks.push({name,pass,detail});fs.writeFileSync(path.join(out,'progress.json'),JSON.stringify(result,null,2));};
try{
 await page.goto('http://127.0.0.1:5198');await page.waitForFunction(()=>window.__gameHooks?.ready);await page.evaluate(()=>window.__gameHooks.setManual(true));
 if(!routeOnly){
 for(const [label,launchSpeed] of [['gentle',8.66],['lively',10.25]]){
  await page.keyboard.up('Space');
  await page.evaluate(v=>{const h=window.__gameHooks;Object.assign(h.canopy,{launchSpeed:v});h.setKeys([]);h.setStick(0,0);h.teleport(-.2,71.5,Math.PI);h.advance(15,1/60,false);},launchSpeed);
  const initial=await step();await shot(label+'-contact');
  await page.keyboard.down('Space');
  let s, launched=false;
  for(let i=0;i<240;i++){
   s=await step();
   if(s.opening.canopy.launches>initial.opening.canopy.launches){launched=true;break;}
  }
  check(label+' top landing launches',launched,s);
  await shot(label+'-release');
  for(let i=0;i<100;i++){s=await step();if(s.vel[1]<=0)break;}
  result.samples.push({label,state:s});await shot(label+'-apex');
  const flight=s.opening.canopy.activeFlight;
  check(label+' apex in target band',!!flight&&flight.apex-flight.y>(label==='gentle'?2.25:3.15)&&flight.apex-flight.y<(label==='gentle'?2.75:3.8),flight);
  await page.keyboard.up('Space');await step(150);await shot(label+'-landed');
 }
 // Stationary released input must settle and remain still.
 await page.evaluate(()=>{const h=window.__gameHooks;h.teleport(-.2,71.5,Math.PI);h.setKeys([]);h.setStick(0,0)});
 const start=await step(20);const idle=await step(180);
 check('released leaf remains walkable',idle.grounded&&idle.opening.canopy.launches===start.opening.canopy.launches,idle);
 await shot('idle-walkable');
 }
 // Route attempt starts staged on entry; Space launches, world-stick steers only.
 await page.evaluate(()=>{const h=window.__gameHooks;h.canopy.launchSpeed=8.66;h.teleport(-.2,71.5,Math.PI);h.setKeys([]);h.setStick(0,0)});
 const before=await step(15);
 await page.keyboard.down('Space');
 let route=before;
 for(let i=0;i<240;i++){route=await step();if(route.opening.canopy.launches>before.opening.canopy.launches)break;}
 const targets=route.opening.canopy.leaves.slice(1);
 for(const target of targets){
  let reached=false;
  for(let i=0;i<400;i++){
   const [x,,z]=route.pos;const [vx,,vz]=route.vel;
   const dx=target.x-x-vx*.3,dz=target.z-z-vz*.3;const len=Math.hypot(dx,dz);
   await page.evaluate(([x,z])=>window.__gameHooks.setStick(x,z),len>.02?[dx/len,dz/len]:[0,0]);
   route=await step();
   if(route.opening.canopy.lastLeaf===target.id){reached=true;break;}
   if(route.grounded&&route.pos[1]<-.3)break;
  }
  result.samples.push({label:'route-'+target.id,state:route});
  check('route reaches '+target.id,reached,route.opening.canopy);
  await shot('route-'+target.id);
  if(!reached)break;
 }
 await page.keyboard.up('Space');
 // Enter high leaf footprint from ground: underside must remain traversable.
 await page.evaluate(()=>{const h=window.__gameHooks;h.setKeys([]);h.teleport(.9,68.8,Math.PI);h.setStick(0,-1)});
 const underStart=await step(1);const under=await step(60);
 check('walk beneath elevated leaf without spring',under.pos[2]<67.2&&under.pos[1]<.1&&under.opening.canopy.launches===underStart.opening.canopy.launches,under);
 await shot('underside-walk');
 await page.evaluate(()=>{const h=window.__gameHooks;h.setKeys([]);h.teleport(.9,68.8,Math.PI);h.setStick(0,-1)});
 const dashStart=await step();await page.keyboard.down('Shift');const dashed=await step(16);await page.keyboard.up('Shift');
 check('dash below leaf never springs',dashed.opening.canopy.launches===dashStart.opening.canopy.launches&&dashed.dashesUsed>dashStart.dashesUsed,dashed);
 await shot('underside-dash');
 result.final=await step();
}finally{
 fs.writeFileSync(path.join(out,'evidence.json'),JSON.stringify(result,null,2));
 await context.close();await browser.close();await server.close();
}
console.log(JSON.stringify({out,checks:result.checks.map(({name,pass})=>({name,pass})),errors:result.errors}));
if(result.errors.length||result.checks.some(c=>!c.pass))process.exitCode=1;
