import {chromium} from 'playwright';
import {createServer} from 'vite';
import {installRecorderStaging} from './recorder-staging.mjs';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const out=process.argv[2]||'/captures/fern/recorder-staging';
const seconds=Number(process.env.SECONDS||20);
const [width,height]=(process.env.SIZE||'480x270').split('x').map(Number);
fs.mkdirSync(out,{recursive:true});
const ev={sha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),label:'Live software A/B recorder experiment; ordinary controller stick, no forced story state.',seconds,viewport:[width,height],errors:[]};
const server=await createServer({configFile:'games/fox-spirit/vite.config.ts',server:{host:'127.0.0.1',port:5197,strictPort:true},logLevel:'error'});await server.listen();
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width,height}});page.setDefaultTimeout(180000);page.on('pageerror',e=>ev.errors.push(String(e)));
try {
 await page.goto('http://127.0.0.1:5197/?manual=1');await page.waitForFunction(()=>window.__gameHooks?.ready);
 await page.evaluate(({source})=>{
  const h=window.__gameHooks;h.setManual(true);h.advance(1,1/30,true);
  const canvas=window.__opening.ctx.renderer.domElement;
  const stage=new Function(`return (${source})`)()(canvas);
  const streams={native:canvas.captureStream(30),staged:stage.stream};
  const records={};for(const [key,stream]of Object.entries(streams)){
   const chunks=[],rec=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8',videoBitsPerSecond:1800000});
   rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};rec.start(1000);records[key]={rec,chunks,stream};
  }
  const r=window.__stagingProbe={stage,records,ticks:0,start:performance.now(),last:0};
  function tick(now){if(r.stop)return;if(now-r.last>=1000/30){r.last=now;h.setStick(r.ticks<150?0.3:0,r.ticks<150?-0.5:0);h.advance(1,1/30,true);stage.push();r.ticks++;}r.raf=requestAnimationFrame(tick)}
  r.raf=requestAnimationFrame(tick);
 },{source:installRecorderStaging.toString()});
 await page.waitForTimeout(seconds*1000);
 const result=await page.evaluate(async()=>{
  const r=window.__stagingProbe;r.stop=true;cancelAnimationFrame(r.raf);
  const videos={};for(const[key,v]of Object.entries(r.records)){
   await new Promise(resolve=>{v.rec.onstop=resolve;v.rec.stop()});
   const data=new Uint8Array(await new Blob(v.chunks,{type:v.rec.mimeType}).arrayBuffer());
   let binary='';for(let i=0;i<data.length;i+=8192)binary+=String.fromCharCode(...data.subarray(i,i+8192));videos[key]=btoa(binary);
   v.stream.getTracks().forEach(t=>t.stop());
  }r.stage.stop();return{videos,ticks:r.ticks,elapsed:(performance.now()-r.start)/1000,stagedFrames:r.stage.frames,game:window.__game.state()};
 });
 for(const[key,data]of Object.entries(result.videos))fs.writeFileSync(`${out}/${key}.webm`,Buffer.from(data,'base64'));
 delete result.videos;Object.assign(ev,result);
 await page.evaluate(()=>window.__gameHooks.advance(0,1/30,true));await page.screenshot({path:`${out}/end.png`});
 console.log(JSON.stringify({ticks:ev.ticks,elapsed:ev.elapsed,stagedFrames:ev.stagedFrames,errors:ev.errors}));
}finally{fs.writeFileSync(`${out}/evidence.json`,JSON.stringify(ev,null,2));await browser.close();await server.close()}
