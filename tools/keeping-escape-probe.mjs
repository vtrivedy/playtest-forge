// Staged floor starts; controller walks escape waypoints. Opening HUD uses real route inputs.
import {chromium} from 'playwright';
import {createServer} from 'vite';
import fs from 'node:fs';
const out=process.argv[2]||'/tmp/keeping-escape';fs.mkdirSync(out,{recursive:true});
const server=await createServer({configFile:'games/fox-spirit/vite.config.ts',server:{port:5198,host:'127.0.0.1',strictPort:true},logLevel:'error'});await server.listen();
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:960,height:540},recordVideo:{dir:out}});page.setDefaultTimeout(120000);const errors=[];page.on('pageerror',e=>errors.push(String(e)));
try{
await page.goto('http://127.0.0.1:5198/');await page.waitForFunction(()=>window.__gameHooks?.ready);
const result=await page.evaluate(async()=>{
const h=window.__gameHooks;h.setManual(true);const samples=[];
const snap=label=>{const state=h.advance(1,1/60,false);samples.push({label,state,hud:document.querySelector('[data-opening-teach="heat"]').style.opacity});return state};
const stage=(x,z)=>{h.setKeys([]);h.setStick(0,0);h.teleport(x,z,0);h.advance(20,1/60,false)};
const {createKeepingRoute,KEEPING_START}=await import('/@fs/work/tools/opening-hero-route.mjs');const route=createKeepingRoute();stage(KEEPING_START.x,KEEPING_START.z);
let s=h.state();for(let i=0;i<2400;i++){const input=route(i/60,s);h.setStick(input.x,input.z);h.setKeys(input.jump?['Space']:[]);s=h.advance(1,1/60,false);if(input.beat==='shelf reveal'&&s.grounded)break;}
snap('shelf-landing');h.setKeys([]);h.setStick(0,0);h.advance(60,1/60,false);snap('shelf-hud-retired');
const paths=[['north',[[22.6,78],[24.3,73.9],[24.9,71.5],[23.5,69],[20.5,66.2],[12,65]]],['gorge',[[27.5,69.5],[24,70.3],[23.2,68.6],[20.5,66.2],[12,65]]]];
const walks=[];
for(const [name,path] of paths){stage(...path[0]);snap(`${name}-start`);for(const p of path.slice(1)){let state;for(let i=0;i<900;i++){state=h.state();const dx=p[0]-state.pos[0],dz=p[1]-state.pos[2],d=Math.hypot(dx,dz);if(d<.35)break;h.setStick(dx/d,dz/d);h.advance(1,1/60,false);}h.setStick(0,0);state=snap(`${name}-${p.join(',')}`);walks.push({name,target:p,pos:state.pos,pass:Math.hypot(p[0]-state.pos[0],p[1]-state.pos[2])<.4});}}
return {samples,walks};});
await page.evaluate(()=>window.__gameHooks.advance(1,1/60,true));await page.screenshot({path:`${out}/escape-end.png`});
await page.evaluate(()=>{const h=window.__gameHooks;h.setStick(0,0);h.teleport(14.6,76.95,0);h.advance(60,1/60,true)});await page.screenshot({path:`${out}/shelf-hud-retired.png`});
const landing=result.samples.find(s=>s.label==='shelf-hud-retired');result.assertions=[{name:'successful H-a landing retires HUD',pass:landing.state.opening.hearth.complete&&landing.hud==='0'},...result.walks.map(w=>({name:`${w.name} reaches ${w.target}`,pass:w.pass})),{name:'no page errors',pass:errors.length===0}];result.errors=errors;fs.writeFileSync(`${out}/evidence.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result.assertions));if(result.assertions.some(a=>!a.pass))process.exitCode=1;
}finally{await browser.close();await server.close();}
