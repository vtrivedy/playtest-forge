import {chromium} from 'playwright';
import {createServer} from 'vite';
import {createSliceRoute as opening,createKeepingRoute,SLICE_START} from './opening-hero-route.mjs';
import {createSliceRoute as journey} from './journey-camera-route.mjs';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const out=process.argv[2]||'/captures/fern/journey';fs.mkdirSync(out,{recursive:true});
const ev={sha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),staging:'Initial wake teleport only; controller input for the whole journey.',samples:[],errors:[]};
const server=await createServer({configFile:'games/fox-spirit/vite.config.ts',server:{host:'127.0.0.1',port:5195,strictPort:true},logLevel:'error'});await server.listen();
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:640,height:360}});page.setDefaultTimeout(600000);page.on('pageerror',e=>ev.errors.push(String(e)));
const save=()=>fs.writeFileSync(out+'/evidence.json',JSON.stringify(ev,null,2));
try{
 await page.goto('http://127.0.0.1:5195/');await page.waitForFunction(()=>window.__gameHooks?.ready);
 await page.evaluate(({sources,start})=>{const h=window.__gameHooks;h.setManual(true);h.teleport(start.x,start.z,start.yaw);const f=sources.map(source=>new Function(`return (${source})`)());window.__journey={route:f[2](f[0],f[1]),s:h.advance(1,1/60,false),f:0,beat:''};},{sources:[opening.toString(),createKeepingRoute.toString(),journey.toString()],start:SLICE_START});
 for(let second=1;second<=260;second++){
  const rows=await page.evaluate(()=>{const h=window.__gameHooks,r=window.__journey,rows=[];for(let i=0;i<60;i++){const input=r.route(r.f/60,r.s);h.setStick(input.x,input.z);h.setKeys([...(input.jump?['Space']:[]),...(input.dash?['ShiftLeft']:[]),...(input.interact?['KeyE']:[])]);r.s=h.advance(1,1/60,false);r.f++;if(input.beat!==r.beat||i===59){rows.push({t:r.f/60,beat:input.beat,changed:input.beat!==r.beat,complete:input.complete,s:r.s});r.beat=input.beat;}}return rows;});
  ev.samples.push(...rows);if(rows.some(r=>r.changed)||[75,78,82,150].includes(second)){await page.evaluate(()=>window.__gameHooks.advance(0,1/60,true));await page.screenshot({path:`${out}/${String(second).padStart(3,'0')}s.jpg`,type:'jpeg',quality:88});console.log(second,rows.at(-1).beat,JSON.stringify(rows.at(-1).s.pos));}save();if(rows.at(-1).complete)break;
 }
 ev.final=await page.evaluate(()=>window.__game.state());const s=ev.final;
 ev.checks={page:s.opening.homecoming.pinned,hearth:s.opening.hearth.latched,steam:s.opening.chemistry.steamLatched,roots:s.opening.chemistry.completed,bridge:s.opening.keeping.phase==='bridge',crossed:s.pos[1]>8&&Math.hypot(s.pos[0]-26,s.pos[2]-65.2)<3,complete:ev.samples.at(-1).complete,finite:ev.samples.every(r=>[...r.s.pos,...r.s.camera.pos].every(Number.isFinite)),noErrors:ev.errors.length===0};
 console.log(JSON.stringify(ev.checks));if(!Object.values(ev.checks).every(Boolean))process.exitCode=1;
}finally{save();await browser.close();await server.close();}
