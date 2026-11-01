// Camera regression: full-slice input, chase stills and per-frame lens metrics.
// node tools/camera-drop-probe.mjs <out> [fallLag=0.07] [seconds=62] [port=5198] [--clip]
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { createSliceRoute, SLICE_START } from './opening-hero-route.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const out = path.resolve(process.argv[2]);
const fallLag = Number(process.argv[3] ?? '0.07');
const seconds = Number(process.argv[4] ?? '62');
const port = Number(process.argv[5] ?? '5198');
const clip = process.argv.includes('--clip');
if (clip) fs.mkdirSync(path.join(out,'drop-frames'), {recursive:true});
fs.mkdirSync(out, {recursive:true});
const server = await createServer({configFile:'games/fox-spirit/vite.config.ts',server:{port,host:'127.0.0.1',strictPort:true},logLevel:'error'});
await server.listen();
const browser = await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader']});
const page = await (await browser.newContext({viewport:{width:1280,height:720}})).newPage();
const errors=[];
page.on('pageerror',e=>errors.push(String(e)));
page.setDefaultTimeout(300000);
try {
  await page.goto(`http://127.0.0.1:${port}/`,{waitUntil:'domcontentloaded',timeout:180000});
  await page.waitForFunction(()=>window.__gameHooks?.ready===true);
  await page.evaluate(({source,start,fallLag})=>{
    const h=window.__gameHooks;
    h.setManual(true); h.camera.fallLag=fallLag;
    h.teleport(start.x,start.z,start.yaw);
    window.__cameraProbe={route:new Function(`return (${source})`)()(),state:h.advance(1,1/60,false),f:0,beat:'',trace:[],apex:false,touchdown:-1,clipStart:-1};
  },{source:createSliceRoute.toString(),start:SLICE_START,fallLag});
  let done=false, n=0;
  while(!done){
    const result=await page.evaluate(({total,clip})=>{
      const p=window.__cameraProbe,h=window.__gameHooks,c=window.__opening.camera;
      let label='', captureFrame=null;
      for(let i=0;i<60 && p.f<total;i++,p.f++){
        const f=p.f,prev=p.state,input=p.route(f/60,prev);
        if(prev.grounded)p.apex=false;
        const apex=!p.apex&&!prev.grounded&&prev.vel[1]>0&&prev.vel[1]-15/60<=0;
        if(apex)p.apex=true;
        const touch=p.touchdown>=0&&f===p.touchdown+2;
        const detail=input.beat==='off the canopy'&&f%8===0;
        if(input.beat==='off the canopy'&&p.clipStart<0)p.clipStart=f;
        const shot=input.beat!==p.beat||apex||touch||detail;
        const clipFrame=clip&&p.clipStart>=0&&f-p.clipStart<180&&(f-p.clipStart)%2===0;
        p.beat=input.beat;
        h.setStick(input.x,input.z);
        h.setKeys([...(input.jump?['Space']:[]),...(input.dash?['ShiftLeft']:[])]);
        const s=h.advance(1,1/60,shot||clipFrame);
        const lensPitch=-Math.asin(c.getWorldDirection(c.position.clone()).y)*180/Math.PI;
        p.state=s;
        p.trace.push({f,beat:p.beat,pos:s.pos,vel:s.vel,grounded:s.grounded,camera:s.camera,lensPitch,lastJump:s.lastJump,page:s.opening.page,canopy:s.opening.canopy,popUpRuin:s.opening.popUpRuin});
        if(!prev.grounded&&s.grounded)p.touchdown=f;
        if(shot||clipFrame){
          if(shot)label=detail?`drop-${f}`:apex?'apex':touch?'touchdown+2':p.beat;
          if(clipFrame)captureFrame=(f-p.clipStart)/2;
          p.f++;break;
        }
      }
      return {done:p.f>=total,f:p.f,label,beat:p.beat,captureFrame};
    },{total:Math.round(seconds*60),clip});
    done=result.done;
    if(result.captureFrame!==null)await page.screenshot({path:path.join(out,'drop-frames',`f${String(result.captureFrame).padStart(3,'0')}.jpg`),type:'jpeg',quality:92});
    if(result.label){
      const name=`${String(++n).padStart(2,'0')}-${result.label.replaceAll(' ','-')}`;
      await page.screenshot({path:path.join(out,name+'.png')});
      console.log(result.f,name);
    }
  }
  const evidence=await page.evaluate(()=>({trace:window.__cameraProbe.trace,game:{mode:window.__game.mode,state:window.__game.state()}}));
  const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
  fs.writeFileSync(path.join(out,'evidence.json'),JSON.stringify({...evidence,errors,fallLag,seconds,sha},null,2));
  if(clip)execFileSync('ffmpeg',['-y','-v','error','-framerate','30','-i',path.join(out,'drop-frames/f%03d.jpg'),'-c:v','libx264','-crf','18','-pix_fmt','yuv420p',path.join(out,'drop.mp4')]);
  console.log('DONE',JSON.stringify({errors,final:evidence.game.state.opening.page}));
}finally{await browser.close();await server.close();}
