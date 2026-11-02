import { chromium } from 'playwright';
import { createServer } from 'vite';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const out=process.argv[2] || '/captures/sorrel/homecoming-handover';
fs.mkdirSync(out,{recursive:true});
const evidence={sha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),staging:'Dev unpress/homecoming/Keeping release; explicit setup teleports. Real E pickup. Ordinary chase camera.',samples:[],errors:[]};
const server=await createServer({configFile:'games/fox-spirit/vite.config.ts',server:{port:5235,host:'127.0.0.1',strictPort:true},logLevel:'error'});
await server.listen();
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:640,height:360}});page.setDefaultTimeout(180000);
page.on('pageerror',e=>evidence.errors.push(String(e)));
const save=()=>fs.writeFileSync(`${out}/evidence.json`,JSON.stringify(evidence,null,2));
const snap=async name=>{
 const game=await page.evaluate(()=>({mode:window.__game.mode,state:window.__game.state()}));
 evidence.samples.push({name,game});save();
 await page.screenshot({path:`${out}/${name}.png`});
 console.log(name,JSON.stringify(game.state.opening.finale),JSON.stringify(game.state.opening.homecoming));
};
try{
 await page.goto('http://127.0.0.1:5235/?manual=1',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__gameHooks?.ready);
 await page.evaluate(()=>{const h=window.__gameHooks;h.setManual(true);h.teleport(-5,88,Math.PI);h.advance(60,1/60,true);});
 await snap('01-before');
 await page.evaluate(()=>{
  const h=window.__gameHooks;
  for(const id of ['hedgehog','heron','kit','hare'])h.unpress(id);
  for(let i=0;i<80;i++){
   const s=h.advance(30,1/60,false),c=s.opening.unpressed.creatures.find(k=>k.id==='hare');
   if(c.phase==='alive')break;
   if(c.phase==='performing')h.teleport(c.at[0]+1.2,c.at[2]-1.2,0);
  }
  h.advance(1500,1/60,false);h.homecoming();h.teleport(-5,88,Math.PI);h.advance(2400,1/30,true);
 });
 await snap('02-full-shelf');
 await page.evaluate(()=>{
  const h=window.__gameHooks;let s=h.state();
  for(let i=0;i<240;i++){
   const dx=-3-s.pos[0],dz=81-s.pos[2],d=Math.hypot(dx,dz);
   h.setStick(d>.55?dx/d:0,d>.55?dz/d:0);s=h.advance(1,1/30,false);
  }
  h.setStick(0,0);h.advance(30,1/30,true);
 });
 await snap('02b-gateward-input');
 await page.evaluate(()=>{const h=window.__gameHooks;h.keepingRelease();h.advance(900,1/60,true);});
 await snap('03-settled-shelf');
 await page.evaluate(()=>{
  const h=window.__gameHooks,c=h.state().opening.carry.position;
  h.teleport(c[0]+3,c[2],Math.PI);h.advance(180,1/60,true);
 });
 await snap('04-near-faded');
 await page.evaluate(()=>{
  const h=window.__gameHooks,c=h.state().opening.carry.position;
  h.teleport(c[0]+.5,c[2]+.4,Math.PI);h.advance(30,1/60,false);h.setKeys(['KeyE']);h.advance(2,1/60,false);h.setKeys([]);
  h.advance(180,1/60,true);
 });
 await snap('05-picked-up');
 await page.evaluate(async()=>{
  const {KEEPING}=await import('/src/opening/layout.ts');const h=window.__gameHooks;
  h.teleport(KEEPING.root.x+.5,KEEPING.root.z,Math.PI);h.advance(30,1/30,false);
  h.setKeys(['KeyE']);h.advance(2,1/30,false);h.setKeys([]);h.advance(30,1/30,false);
  h.teleport(-5,88,Math.atan2(20,-11));h.advance(180,1/30,true);
 });
 await snap('06-root-resting');
 const states=Object.fromEntries(evidence.samples.map(s=>[s.name,s.game.state]));
 evidence.checks={beforeOff:states['01-before'].opening.finale.onward===0,wellFull:states['02-full-shelf'].opening.homecoming.full,shelfOn:states['02-full-shelf'].opening.finale.onward===48,settledShelfOn:states['03-settled-shelf'].opening.finale.onward===48,nearOff:states['04-near-faded'].opening.finale.onward===0,pickup:states['05-picked-up'].opening.carry.carried,pickupOff:states['05-picked-up'].opening.finale.onward===0,rootOn:states['06-root-resting'].opening.finale.onward===48,rootNotCarried:!states['06-root-resting'].opening.carry.carried,rootMoved:Math.hypot(states['06-root-resting'].opening.carry.position[0]-states['02-full-shelf'].opening.carry.position[0],states['06-root-resting'].opening.carry.position[2]-states['02-full-shelf'].opening.carry.position[2])>5,finite:evidence.samples.every(s=>s.game.state.pos.every(Number.isFinite)),noErrors:evidence.errors.length===0};
 save();console.log(JSON.stringify(evidence.checks));if(Object.values(evidence.checks).some(v=>!v))process.exitCode=1;
}finally{save();await browser.close();await server.close();}
