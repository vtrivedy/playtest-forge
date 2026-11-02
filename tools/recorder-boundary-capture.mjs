/** Hardware recorder diagnostic; production game stays unchanged. See DESIGN-recorder-boundary.md. */
import {chromium} from 'playwright';
import {installRecorderStaging} from './recorder-staging.mjs';
import {createSliceRoute, SLICE_START} from './complete-journey-route.mjs';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {once} from 'node:events';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const arg=(key,fallback)=>process.argv.includes(`--${key}`)?process.argv[process.argv.indexOf(`--${key}`)+1]:fallback;
const repo=path.resolve(arg('repo',process.cwd())), out=path.resolve(arg('out','/captures/reed/recorder-boundary'));
const seconds=Number(arg('route-seconds','120')),fps=Number(arg('fps','30'));
const [width,height]=arg('size','1280x720').split('x').map(Number);
const backend=arg('backend','egl'),paths=arg('paths','paired'),variant=arg('variant','baseline');
if(!['baseline','preserve','no-aa','finish'].includes(variant))throw Error('Unknown renderer variant');
if(!['native','staged','paired','compositor'].includes(paths))throw Error('Unknown capture paths');
fs.mkdirSync(out,{recursive:true});fs.mkdirSync(path.join(out,'compositor'),{recursive:true});
const report={source:execFileSync('git',['-C',repo,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),captureToolSha:createHash('sha256').update(fs.readFileSync(new URL(import.meta.url))).digest('hex'),fps,seconds,viewport:[width,height],backend,paths,variant,errors:[],compositor:[],label:'Matched native WebGL + persistent 2D MediaRecorder streams and independent CDP compositor JPEGs. One initial wake placement, fixed-clock inputs on a real-time rAF; no later teleports or forced progression.'};
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
const types={'.js':'text/javascript','.html':'text/html','.css':'text/css','.glb':'model/gltf-binary','.ogg':'audio/ogg','.jpg':'image/jpeg','.png':'image/png'};
const root=path.join(repo,'dist/fox-spirit');
const server=http.createServer((req,res)=>{
 if(req.url==='/favicon.ico'){res.writeHead(204).end();return;}
 const url=new URL(req.url,'http://localhost');
 const file=path.resolve(root,`.${url.pathname==='/'?'/index.html':url.pathname}`);
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404).end();return;}
 res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
});
server.listen(0,'127.0.0.1');await once(server,'listening');
let browser;
try{
 browser=await chromium.launch({headless:true,channel:'chromium',ignoreDefaultArgs:['--enable-unsafe-swiftshader'],args:['--no-sandbox','--disable-gpu-sandbox','--disable-dev-shm-usage','--enable-gpu','--use-gl=angle',backend==='swiftshader'?'--use-angle=swiftshader':'--use-angle=gl-egl','--ignore-gpu-blocklist','--disable-background-timer-throttling','--disable-renderer-backgrounding',...(backend==='swiftshader'?['--enable-unsafe-swiftshader']:[])]});
 const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
 page.setDefaultTimeout(180000);page.on('pageerror',e=>report.errors.push(String(e)));
 page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 await page.addInitScript(({variant})=>{
  if(variant==='preserve'||variant==='no-aa'){
   const original=HTMLCanvasElement.prototype.getContext;
   HTMLCanvasElement.prototype.getContext=function(kind,options,...rest){
    if(kind==='webgl2'||kind==='webgl')options=variant==='preserve'?{...options,preserveDrawingBuffer:true}:{...options,antialias:false};
    return original.call(this,kind,options,...rest);
   };
  }
  let seed=42;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 },{variant});
 await page.goto(`http://127.0.0.1:${server.address().port}/?manual=1`);
 await page.waitForFunction(()=>window.__gameHooks?.ready);
 report.gl=await page.evaluate(()=>{const gl=window.__opening.ctx.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');return{renderer:ext&&gl.getParameter(ext.UNMASKED_RENDERER_WEBGL),attributes:gl.getContextAttributes()};});
 if(backend!=='swiftshader'&&!/nvidia/i.test(report.gl.renderer))throw Error('Hardware renderer required: '+JSON.stringify(report.gl));
 await page.keyboard.press('KeyW');
 await page.evaluate(({start})=>{const h=window.__gameHooks;h.setManual(true);h.teleport(start.x,start.z,start.yaw);h.advance(1,1/60,true);h.audioContext().resume();},{start:SLICE_START});
 await page.screenshot({path:path.join(out,'start.png')});
 const cdp=await page.context().newCDPSession(page);
 cdp.on('Page.screencastFrame',event=>{
  const index=report.compositor.length,file=`frame-${String(index).padStart(5,'0')}.jpg`;
  fs.writeFileSync(path.join(out,'compositor',file),Buffer.from(event.data,'base64'));
  report.compositor.push({file,timestamp:event.metadata.timestamp});
  cdp.send('Page.screencastFrameAck',{sessionId:event.sessionId}).catch(e=>report.errors.push(String(e)));
 });
 if(paths==='paired'||paths==='compositor')await cdp.send('Page.startScreencast',{format:'jpeg',quality:70,maxWidth:640,maxHeight:360,everyNthFrame:3});
 await page.evaluate(({stageSource,routeSource,fps,paths,variant})=>{
  const h=window.__gameHooks,renderer=window.__opening.ctx.renderer,source=renderer.domElement,gl=renderer.getContext();
  h.advance(0,1/fps,true);
  const stage=(paths==='native'||paths==='compositor')?null:new Function(`return (${stageSource})`)()(source);
  const streams={},records={};
  if(paths==='native'||paths==='paired')streams.native=source.captureStream(fps);
  if(stage)streams.staged=stage.stream;
  for(const[key,video]of Object.entries(streams)){
   const stream=new MediaStream([...video.getVideoTracks(),...h.audioTap().getAudioTracks()]);
   const chunks=[],rec=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8,opus',videoBitsPerSecond:6000000});
   rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};rec.start(1000);records[key]={rec,chunks,video};
  }
  const probe=window.__recorderBoundary={stage,records,route:new Function(`return (${routeSource})`)()(),state:h.state(),ticks:0,fps,started:performance.now(),last:0,samples:[]};
  const sample=document.createElement('canvas');sample.width=32;sample.height=18;
  const pixels=sample.getContext('2d',{willReadFrequently:true});
  function saveSample(){
   pixels.drawImage(stage?stage.canvas:source,0,0,32,18);const data=pixels.getImageData(0,0,32,18).data;
   let sum=0;for(let j=0;j<data.length;j+=4)sum+=.2126*data[j]+.7152*data[j+1]+.0722*data[j+2];
   probe.samples.push({tick:probe.ticks,wall:(performance.now()-probe.started)/1000,luma:sum/(32*18),state:probe.state});
  }
  function tick(now){
   if(probe.stop)return;
   if(now-probe.last>=1000/fps-.5){
    probe.last=now;
    const input=probe.route(probe.ticks/fps,probe.state);
    h.setStick(input.x,input.z);h.setKeys(input.jump?(input.dash?jumpDash:jump):(input.dash?dash:none));
    probe.state=h.advance(1,1/fps,true);if(variant==='finish')gl.finish();if(stage)stage.push();probe.ticks++;
    if(probe.ticks%fps===0)saveSample();
   }
   probe.raf=requestAnimationFrame(tick);
  }
  const jump=['Space'],dash=['ShiftLeft'],jumpDash=['Space','ShiftLeft'],none=[];
  probe.raf=requestAnimationFrame(tick);
 },{stageSource:installRecorderStaging.toString(),routeSource:createSliceRoute.toString(),fps,paths,variant});
 for(let elapsed=0;elapsed<seconds;elapsed+=10){await page.waitForTimeout(Math.min(10,seconds-elapsed)*1000);console.log('recorder wall seconds',Math.min(elapsed+10,seconds));}
 const result=await page.evaluate(async()=>{
  const p=window.__recorderBoundary;p.stop=true;cancelAnimationFrame(p.raf);
  const videos={};for(const[key,v]of Object.entries(p.records)){
   await new Promise(resolve=>{v.rec.onstop=resolve;v.rec.stop();});
   const data=new Uint8Array(await new Blob(v.chunks,{type:v.rec.mimeType}).arrayBuffer());
   let binary='';for(let i=0;i<data.length;i+=8192)binary+=String.fromCharCode(...data.subarray(i,i+8192));videos[key]=btoa(binary);
   v.video.getTracks().forEach(track=>track.stop());
  }if(p.stage)p.stage.stop();return{videos,startEpochMs:performance.timeOrigin+p.started,ticks:p.ticks,simulationSeconds:p.ticks/p.fps,stagedFrames:p.stage?p.stage.frames:0,samples:p.samples,game:window.__gameHooks.state(),wallSeconds:(performance.now()-p.started)/1000};
 });
 if(paths==='paired'||paths==='compositor')await cdp.send('Page.stopScreencast');
 for(const[key,data]of Object.entries(result.videos))fs.writeFileSync(path.join(out,key+'.webm'),Buffer.from(data,'base64'));
 delete result.videos;Object.assign(report,result);
 await page.evaluate(()=>window.__gameHooks.advance(0,1/30,true));await page.screenshot({path:path.join(out,'end.png')});
 save();console.log(JSON.stringify({ticks:report.ticks,simulationSeconds:report.simulationSeconds,compositorFrames:report.compositor.length,errors:report.errors}));
}finally{save();if(browser)await browser.close();server.close();}
