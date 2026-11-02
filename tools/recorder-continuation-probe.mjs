// Does route completion precede the reveal? Keep ticking after complete; no forced story state.
import {chromium} from 'playwright';
import {createServer} from 'vite';
import {createSliceRoute,SLICE_START} from './opening-hero-route.mjs';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const out=process.argv[2]||'/captures/fern/recorder-continuation';fs.mkdirSync(out,{recursive:true});
const ev={sha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),staging:'Normal boot; initial wake teleport only. Shared route called and simulation advanced every frame through 90 seconds, including after complete.',samples:[],errors:[]};
const server=await createServer({configFile:'games/fox-spirit/vite.config.ts',server:{host:'127.0.0.1',port:5195,strictPort:true},logLevel:'error'});await server.listen();
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:640,height:360}});page.setDefaultTimeout(600000);page.on('pageerror',e=>ev.errors.push(String(e)));
const save=()=>fs.writeFileSync(out+'/evidence.json',JSON.stringify(ev,null,2));
try{
 await page.goto('http://127.0.0.1:5195/');await page.waitForFunction(()=>window.__gameHooks?.ready);
 await page.evaluate(({source,start})=>{const h=window.__gameHooks;h.setManual(true);h.teleport(start.x,start.z,start.yaw);window.__continuation={route:new Function(`return (${source})`)()(),s:h.advance(1,1/60,false),f:0};},{source:createSliceRoute.toString(),start:SLICE_START});
 for(let second=1;second<=90;second++){
  const rows=await page.evaluate(()=>{const h=window.__gameHooks,r=window.__continuation,rows=[];for(let i=0;i<60;i++){const input=r.route(r.f/60,r.s);h.setStick(input.x,input.z);h.setKeys([...(input.jump?['Space']:[]),...(input.dash?['ShiftLeft']:[])]);r.s=h.advance(1,1/60,i===59);r.f++;const record={t:r.f/60,beat:input.beat,complete:input.complete,s:r.s};if(input.beat==='homecoming'&&!r.arrived){r.arrived=true;rows.push({...record,event:'arrival'});}if(input.complete&&!r.completed){r.completed=true;rows.push({...record,event:'firstComplete'});}if(i===59)rows.push(record);}return rows;});
  ev.samples.push(...rows);if(second>=72 && [72,74,78,82,90].includes(second))await page.screenshot({path:`${out}/${second}s.png`});if(second%10===0){save();console.log('seconds',second);}
 }
 const shot=r=>Number(/shot=([\d.]+)/.exec(r.s.camera.boom)?.[1]);const done=ev.samples.find(r=>r.event==='firstComplete');const arrival=ev.samples.find(r=>r.event==='arrival');
 ev.checks={arrived:!!arrival,completed:!!done,onwardBeforeCompletion:ev.samples.some(r=>!r.complete&&r.s.opening.finale.onward===48),revealBeforeCompletion:ev.samples.some(r=>!r.complete&&shot(r)>.99),clockContinues:!!done&&ev.samples.at(-1).s.opening.finale.t>done.s.opening.finale.t+10,cameraReturns:shot(ev.samples.at(-1))===0,onlyPage:ev.samples.at(-1).s.opening.homecoming.lit.join(',')==='page',finite:ev.samples.every(r=>r.s.pos.every(Number.isFinite)),noErrors:ev.errors.length===0};
 console.log(JSON.stringify({arrival:arrival?.t,complete:done?.t,checks:ev.checks}));if(!Object.values(ev.checks).every(Boolean))process.exitCode=1;
}finally{save();await browser.close();await server.close();}
