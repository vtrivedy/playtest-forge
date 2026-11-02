// Natural Keeping-to-Press journey; optional continuous finale frames, no progression hooks.
import {chromium} from 'playwright';
import {createServer,preview} from 'vite';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createSliceRoute,SLICE_START,SLICE_STAGING,verifySlice} from './finale-journey-route.mjs';
const out=process.argv[2];
if(!out)throw Error('Usage: node tools/finale-journey-probe.mjs OUT [--production] [--motion]');
const production=process.argv.includes('--production'),motion=process.argv.includes('--motion');
fs.mkdirSync(out,{recursive:true});if(motion)fs.mkdirSync(`${out}/frames`,{recursive:true});
const ev={sha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),runtime:production?'production':'dev',hz:30,captureHz:motion?10:0,staging:SLICE_STAGING,routeSource:createSliceRoute.toString(),samples:[],beats:[],errors:[]};
const save=()=>{fs.writeFileSync(`${out}/evidence.tmp`,JSON.stringify(ev,null,2));fs.renameSync(`${out}/evidence.tmp`,`${out}/evidence.json`);};
const options={configFile:'games/fox-spirit/vite.config.ts',logLevel:'error'};
const server=production?await preview({...options,preview:{host:'127.0.0.1',port:5242,strictPort:true}}):await createServer({...options,server:{host:'127.0.0.1',port:5242,strictPort:true}});
if(!production)await server.listen();
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader']});
const p=await browser.newPage({viewport:{width:640,height:360}});p.setDefaultTimeout(300000);p.on('pageerror',e=>ev.errors.push(String(e)));
try{
 await p.goto('http://127.0.0.1:5242/?manual=1',{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.__gameHooks?.ready);
 await p.evaluate(({source,start})=>{const h=window.__gameHooks;h.setManual(true);h.teleport(start.x,start.z,start.yaw);window.__journey={route:new Function(`return (${source})`)()(),state:h.advance(1,1/30,false),f:0,beat:'',motionAt:null};},{source:createSliceRoute.toString(),start:SLICE_START});
 let done=false,n=0;
 while(!done){
  const r=await p.evaluate(motion=>{
   const h=window.__gameHooks,j=window.__journey,samples=[],beats=[];let shot='',motionFrame=null;
   for(let i=0;i<90&&j.f<5400;i++){
    const input=j.route(j.f/30,j.state);h.setStick(input.x,input.z);h.setKeys([...(input.jump?['Space']:[]),...(input.dash?['ShiftLeft']:[]),...(input.interact?['KeyE']:[])]);
    j.state=h.advance(1,1/30,false);j.f++;
    const beatChanged=input.beat!==j.beat;j.beat=input.beat;
    if(j.state.opening.finale.phase!=='sealed')j.motionAt??=j.f;
    const s={f:j.f,t:j.f/30,input,game:j.state};
    if(j.f%30===0)samples.push(s);
    if(beatChanged){beats.push(s);shot=input.beat;}
    if(motion&&j.motionAt!==null&&j.f-j.motionAt<1350&&(j.f-j.motionAt)%3===0)motionFrame=(j.f-j.motionAt)/3;
    if(beatChanged||j.f%450===0||motionFrame!==null){h.advance(0,1/30,true);if(!shot&&j.f%450===0)shot=`${j.f/30}s`;break;}
   }
   return{f:j.f,done:j.f>=5400,samples,beats,shot,motionFrame,state:j.state};
  },motion);
  ev.samples.push(...r.samples);ev.beats.push(...r.beats);ev.final=r.state;done=r.done;
  if(r.motionFrame!==null)await p.screenshot({path:`${out}/frames/f${String(r.motionFrame).padStart(4,'0')}.jpg`,type:'jpeg',quality:88});
  if(r.shot){const name=`${String(++n).padStart(2,'0')}-${r.shot.replaceAll(' ','-')}`;await p.screenshot({path:`${out}/${name}.png`});console.log(r.f,r.shot,r.state.pos,r.state.opening.finale.phase);}
  save();
 }
 ev.checks={...verifySlice(ev.final),finite:ev.samples.every(x=>[...x.game.pos,...x.game.camera.pos].every(Number.isFinite)),noErrors:ev.errors.length===0};save();console.log(JSON.stringify(ev.checks));if(Object.values(ev.checks).some(x=>!x))process.exitCode=1;
}finally{save();await browser.close();if(production)await new Promise(resolve=>server.httpServer.close(resolve));else await server.close();}
