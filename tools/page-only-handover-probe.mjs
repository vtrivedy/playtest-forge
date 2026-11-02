// Natural shared slice after one initial wake placement; no forced page/creature/Keeping state.
import { chromium } from 'playwright';
import {createServer} from 'vite';
import {createSliceRoute,SLICE_START} from './opening-hero-route.mjs';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
function checksFor(ev) {
const shot=s=>Number(/shot=([\d.]+)/.exec(s.camera?.boom ?? '')?.[1] ?? NaN);
const holds=ev.trace.filter(r=>'hold' in r);
return {
 arrived:ev.trace.some(r=>r.beat==='homecoming'),
 pagePinned:ev.final.opening.homecoming.pinned,
 optionalNotRequired:!ev.final.opening.homecoming.full && ev.final.opening.homecoming.lit.length===1 && ev.final.opening.homecoming.lit[0]==='page',
 onward48:ev.final.opening.finale.onward===48,
 reveal:holds.some(r=>shot(r.s)>.99),
 cameraReturns:shot(holds.at(-1).s)===0,
 noPrematureShot:ev.trace.filter(r=>'beat' in r && r.beat!=='homecoming').every(r=>shot(r.s)===0),
 completeHoldFrames:holds.length===100,
 finiteCamera:ev.trace.every(r=>r.s.camera.pos.every(Number.isFinite) && Number.isFinite(shot(r.s))),
 noErrors:ev.errors.length===0
};
}
if(process.argv[2]==='--check-evidence') {
 const checks=checksFor(JSON.parse(fs.readFileSync(process.argv[3],'utf8')));
 console.log(JSON.stringify(checks));
 process.exit(Object.values(checks).every(Boolean)?0:1);
}
const out=process.argv[2] || 'playtest-output/fox-spirit/page-only-handover';fs.mkdirSync(out,{recursive:true});
const ev={sha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),staging:'Only initial wake teleport, shared createSliceRoute; real stick/jump/dash thereafter. No release, page, creature or Keeping hooks.',trace:[],errors:[]};
const server=await createServer({configFile:'games/fox-spirit/vite.config.ts',server:{port:5194,host:'127.0.0.1',strictPort:true},logLevel:'error'});await server.listen();const b=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader']});const p=await b.newPage({viewport:{width:640,height:360}});p.setDefaultTimeout(600000);p.on('pageerror',e=>ev.errors.push(String(e)));
try{await p.goto('http://127.0.0.1:5194/?manual=1');await p.waitForFunction(()=>window.__gameHooks?.ready);
await p.evaluate(({source,start})=>{const h=window.__gameHooks;h.setManual(true);h.teleport(start.x,start.z,start.yaw);window.__fern={route:new Function(`return (${source})`)()(),s:h.advance(60,1/60,false),f:0,lastBeat:'',homeAt:null};},{source:createSliceRoute.toString(),start:SLICE_START});
let done=false;while(!done){const r=await p.evaluate(()=>{const h=window.__gameHooks,r=window.__fern,trace=[];let shot=false;for(let i=0;i<120 && r.f<12000;i++){const input=r.route(r.f/60,r.s);h.setStick(input.x,input.z);h.setKeys([...(input.jump?['Space']:[]),...(input.dash?['ShiftLeft']:[])]);r.s=h.advance(1,1/60,false);r.f++;if(input.beat!==r.lastBeat){trace.push({f:r.f,beat:input.beat,s:r.s});r.lastBeat=input.beat;shot=true;}if(input.beat==='homecoming'){r.homeAt??=r.f;break;}}return {f:r.f,trace,homeAt:r.homeAt,done:r.homeAt!==null||r.f>=12000,shot};});ev.trace.push(...r.trace);done=r.done;if(r.shot){await p.evaluate(()=>window.__gameHooks.advance(0,1/60,true));await p.screenshot({path:out+'/route-'+String(r.f).padStart(5,'0')+'.jpg',type:'jpeg',quality:85});console.log('route',r.f,r.trace.map(t=>t.beat).join(', '));}fs.writeFileSync(out+'/evidence.json',JSON.stringify(ev));}
ev.arrival=await p.evaluate(()=>window.__game.state());
for(let i=0;i<100;i++){const s=await p.evaluate(()=>{const h=window.__gameHooks;h.setStick(0,0);h.setKeys([]);return h.advance(6,1/60,true)});ev.trace.push({hold:(i+1)/10,s});await p.screenshot({path:out+'/hold-'+String(i).padStart(3,'0')+'.jpg',type:'jpeg',quality:86});if(i%20===0)console.log('hold',i);}
ev.final=await p.evaluate(()=>window.__game.state());
ev.checks=checksFor(ev);
console.log(JSON.stringify(ev.checks));
if(!Object.values(ev.checks).every(Boolean))process.exitCode=1;
}finally{fs.writeFileSync(out+'/evidence.json',JSON.stringify(ev));await b.close();await server.close();}
