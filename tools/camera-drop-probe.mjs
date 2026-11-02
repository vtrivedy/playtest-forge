// Camera regression: full-slice input, chase stills and per-frame lens metrics.
// node tools/camera-drop-probe.mjs <out> [fallLag=0.07] [seconds=62] [port=5198] [--clip|--encode-only]
// Motion window: --clip --clip-from 64 --clip-seconds 6
// Optional: --dt 0.03333333333333333 --stills-at 65,72,80,89 --clip-beat 'unfold the way home' --clip-seconds 6 --size 640x360
// Region route: --route-module tools/REGION-route.mjs --check-from 1 (exports createSliceRoute and SLICE_START).
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const out = path.resolve(process.argv[2]);
const fallLag = Number(process.argv[3] ?? '0.07');
const seconds = Number(process.argv[4] ?? '62');
const port = Number(process.argv[5] ?? '5198');
const clip = process.argv.includes('--clip');
const missOverlook = process.argv.includes('--miss-overlook');
const sparseStills = process.argv.includes('--sparse-stills');
const checkSilhouette = process.argv.includes('--check-silhouette');
const option = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i < 0 ? fallback : process.argv[i + 1]; };
const routeModule = path.resolve(option('route-module', 'tools/opening-hero-route.mjs'));
const { createSliceRoute, SLICE_START, prepareSlice, SLICE_STAGING } = await import(pathToFileURL(routeModule).href);
if (typeof createSliceRoute !== 'function' || !SLICE_START || ![SLICE_START.x, SLICE_START.z, SLICE_START.yaw].every(Number.isFinite)) throw Error('Route module must export createSliceRoute and finite SLICE_START x/z/yaw');
const cameraHeightRaw = option('camera-height', '');
const cameraHeight = cameraHeightRaw === '' ? null : Number(cameraHeightRaw);
if (cameraHeight !== null && (!Number.isFinite(cameraHeight) || cameraHeight < .3 || cameraHeight > 3)) throw Error('camera-height must be in [.3,3]');
const startYawRaw = option('start-yaw', '');
const startYaw = startYawRaw === '' ? SLICE_START.yaw : Number(startYawRaw);
if (!Number.isFinite(startYaw)) throw Error('start-yaw must be finite');
const sliceStart = {...SLICE_START,yaw:startYaw};
if (prepareSlice !== undefined && typeof prepareSlice !== 'function') throw Error('prepareSlice must be a cold setup function');
const expectedBeat = option('expect-beat', '');
const checkFrom = Number(option('check-from', '60'));
if (!Number.isFinite(checkFrom) || checkFrom < 0 || checkFrom >= seconds) throw Error('check-from must be nonnegative and less than seconds');
const clipBeat = option('clip-beat', 'off the canopy');
const clipSeconds = Number(option('clip-seconds', '3'));
const clipFrom = option('clip-from', '') === '' ? null : Number(option('clip-from', ''));
if (clipFrom !== null && (!Number.isFinite(clipFrom) || clipFrom < 0)) throw Error('clip-from must be nonnegative');
const minDistanceRaw = option('min-distance', '');
const minDistance = minDistanceRaw === '' ? null : Number(minDistanceRaw);
if (minDistance !== null && (!Number.isFinite(minDistance) || minDistance < 1.2 || minDistance > 2.45)) throw Error('min-distance must be in [1.2, 2.45]');
const testDt = Number(option('dt', String(1 / 60)));
if (!Number.isFinite(testDt) || testDt <= 0 || testDt > .05) throw Error('dt must be in (0, .05]');
const stillFrames = option('stills-at', '').split(',').filter(Boolean).map(t => Math.round(Number(t) / testDt));
const [width, height] = option('size', '1280x720').split('x').map(Number);
if (![width, height].every(v => Number.isInteger(v) && v > 0) || !Number.isFinite(clipSeconds) || clipSeconds <= 0) throw Error('Invalid clip dimensions/duration');
const clipFrames = Math.round(clipSeconds / testDt / 2) * 2;
if (clip) fs.mkdirSync(path.join(out,'drop-frames'), {recursive:true});
function encodeDrop() {
  // Playwright ships a VP9 encoder with Chromium; no system ffmpeg install needed.
  const cache=path.dirname(path.dirname(path.dirname(chromium.executablePath())));
  const version=fs.readdirSync(cache).filter(n=>n.startsWith('ffmpeg-')).sort().at(-1);
  if(!version)throw new Error('Playwright ffmpeg bundle missing');
  const frames=fs.readdirSync(path.join(out,'drop-frames')).filter(n=>/^f\d{3}\.jpg$/.test(n)).sort();
  if(frames.length!==clipFrames/2)throw new Error(`Expected ${clipFrames/2} clip frames; found ${frames.length}`);
  execFileSync(path.join(cache,version,'ffmpeg-linux'),['-y','-v','error','-f','image2pipe','-framerate',String(1 / (2 * testDt)),'-vcodec','mjpeg','-i','pipe:0','-c:v','libvpx-vp9','-b:v','0','-crf','18','-deadline','realtime','-cpu-used','4','-pix_fmt','yuv420p',path.join(out,clipBeat === 'off the canopy' ? 'drop.webm' : 'clip.webm')],{input:Buffer.concat(frames.map(n=>fs.readFileSync(path.join(out,'drop-frames',n))))});
}
if(process.argv.includes('--encode-only')){encodeDrop();process.exit(0);}
fs.mkdirSync(out, {recursive:true});
const server = await createServer({configFile:'games/fox-spirit/vite.config.ts',server:{port,host:'127.0.0.1',strictPort:true},logLevel:'error'});
await server.listen();
const browser = await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader']});
const page = await (await browser.newContext({viewport:{width,height}})).newPage();
const errors=[];
page.on('pageerror',e=>errors.push(String(e)));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
page.setDefaultTimeout(300000);
try {
  await page.goto(`http://127.0.0.1:${port}/?manual=1`,{waitUntil:'domcontentloaded',timeout:180000});
  await page.waitForFunction(()=>window.__gameHooks?.ready===true);
  await page.evaluate(({source,start,fallLag,testDt,minDistance,cameraHeight,prepare})=>{
    const h=window.__gameHooks;
    h.setManual(true); h.camera.fallLag=fallLag; if(minDistance!==null)h.camera.minDistance=minDistance;
    if (cameraHeight !== null) h.camera.height = cameraHeight;
    if (prepare) new Function(`return (${prepare})`)()(h);
    h.teleport(start.x,start.z,start.yaw);
    window.__cameraProbe={route:new Function(`return (${source})`)()(),state:h.advance(1,testDt,false),f:0,beat:'',trace:[],apex:false,touchdown:-1,clipStart:-1,silhouette:[]};
  },{source:createSliceRoute.toString(),start:sliceStart,fallLag,testDt,minDistance,cameraHeight,prepare:prepareSlice?.toString()??null});
  let done=false, n=0, checkpoint=-1;
  while(!done){
    const result=await page.evaluate(({total,clip,clipBeat,clipFrames,testDt,stillFrames,clipFrom,missOverlook,sparseStills,checkSilhouette})=>{
      const p=window.__cameraProbe,h=window.__gameHooks,c=window.__opening.camera;
      let label='', captureFrame=null;
      for(let i=0;i<60 && p.f<total;i++,p.f++){
        const f=p.f,prev=p.state,input=p.route(f*testDt,prev);
        // Explicit input variant: walk off the second page instead of jumping to the overlook.
        if (missOverlook && input.beat === 'leap to the overlook') input.jump = false;
        if(prev.grounded)p.apex=false;
        const apex=!p.apex&&!prev.grounded&&prev.vel[1]>0&&prev.vel[1]-15*testDt<=0;
        if(apex)p.apex=true;
        const touch=p.touchdown>=0&&f===p.touchdown+2;
        const detail=input.beat==='off the canopy'&&f%8===0;
        if(p.clipStart<0 && (clipFrom === null ? input.beat===clipBeat : f * testDt >= clipFrom))p.clipStart=f;
        const timed = stillFrames.includes(f);
        const shot=timed||(!sparseStills&&(input.beat!==p.beat||apex||touch||detail));
        const clipFrame=clip&&p.clipStart>=0&&f-p.clipStart<clipFrames&&(f-p.clipStart)%2===0;
        p.beat=input.beat;
        h.setStick(input.x,input.z);
        h.setKeys([...(input.jump?['Space']:[]),...(input.dash?['ShiftLeft']:[]),...(input.interact?['KeyE']:[])]);
        const s=h.advance(1,testDt,shot||clipFrame);
        const lensPitch=-Math.asin(c.getWorldDirection(c.position.clone()).y)*180/Math.PI;
        p.state=s;
        if (clipFrame && checkSilhouette) {
          const point = c.position.clone();
          let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity,vertices=0;
          window.__opening.ctx.fox.model.traverse(mesh => {
            if (!mesh.isSkinnedMesh || !mesh.visible) return;
            for(let v=0;v<mesh.geometry.attributes.position.count;v++) {
              mesh.getVertexPosition(v,point);point.applyMatrix4(mesh.matrixWorld).project(c);
              minX=Math.min(minX,point.x);maxX=Math.max(maxX,point.x);
              minY=Math.min(minY,point.y);maxY=Math.max(maxY,point.y);vertices++;
            }
          });
          p.silhouette.push({f,vertices,minX,maxX,minY,maxY,inside:vertices>0&&minX>-.96&&maxX<.96&&minY>-.96&&maxY<.96});
        }
        p.trace.push({f,beat:p.beat,pos:s.pos,vel:s.vel,grounded:s.grounded,camera:s.camera,lensPitch,lastJump:s.lastJump,page:s.opening.page,canopy:s.opening.canopy,popUpRuin:s.opening.popUpRuin});
        if(!prev.grounded&&s.grounded)p.touchdown=f;
        if(shot||clipFrame){
          if(shot)label=timed?`${(f * testDt).toFixed(2)}s`:detail?`drop-${f}`:apex?'apex':touch?'touchdown+2':p.beat;
          if(clipFrame)captureFrame=(f-p.clipStart)/2;
          p.f++;break;
        }
      }
      return {done:p.f>=total,f:p.f,label,beat:p.beat,captureFrame};
    },{total:Math.round(seconds/testDt),clip,clipBeat,clipFrames,testDt,stillFrames,clipFrom,missOverlook,sparseStills,checkSilhouette});
    done=result.done;
    const bucket=Math.floor(result.f*testDt/10);
    if(bucket>checkpoint){
      checkpoint=bucket;
      const partial=await page.evaluate(()=>({trace:window.__cameraProbe.trace,silhouette:window.__cameraProbe.silhouette,cameraTunables:{...window.__gameHooks.camera},game:{mode:window.__game.mode,state:window.__game.state()}}));
      const pending=path.join(out,'checkpoint.json.tmp');
      fs.writeFileSync(pending,JSON.stringify({complete:false,frame:result.f,testDt,minDistance,missOverlook,...partial}));
      fs.renameSync(pending,path.join(out,'checkpoint.json'));
    }
    if(result.captureFrame!==null)await page.screenshot({path:path.join(out,'drop-frames',`f${String(result.captureFrame).padStart(3,'0')}.jpg`),type:'jpeg',quality:92});
    if(result.label){
      const name=`${String(++n).padStart(2,'0')}-${result.label.replaceAll(' ','-')}`;
      await page.screenshot({path:path.join(out,name+'.png')});
      console.log(result.f,name);
    }
  }
  const evidence=await page.evaluate(()=>({trace:window.__cameraProbe.trace,silhouette:window.__cameraProbe.silhouette,cameraTunables:{...window.__gameHooks.camera},game:{mode:window.__game.mode,state:window.__game.state()}}));
  const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
  fs.writeFileSync(path.join(out,'evidence.json'),JSON.stringify({...evidence,errors,fallLag,minDistance,missOverlook,testDt,seconds,sha,routeModule:path.relative(process.cwd(),routeModule),checkFrom,staging:SLICE_STAGING??'one start teleport; controller input thereafter',start:sliceStart,cameraHeight,clipBeat,clipFrom,clipSeconds,viewport:[width,height]},null,2));
  if (expectedBeat) {
    const actualBeat = evidence.trace.at(-1)?.beat;
    const routeCheck = {expectedBeat,actualBeat,pass:actualBeat===expectedBeat};
    fs.writeFileSync(path.join(out,'route-check.json'),JSON.stringify(routeCheck,null,2));
    console.log('ROUTE',JSON.stringify(routeCheck));
    if(!routeCheck.pass)process.exitCode=1;
  }
  const late = evidence.trace.filter(s => s.f * testDt >= checkFrom);
  if (late.length) {
    const minChestDistance = Math.min(...late.map(s => Math.hypot(s.camera.pos[0] - s.pos[0], s.camera.pos[1] - s.pos[1] - .6, s.camera.pos[2] - s.pos[2])));
    const maxPitch = Math.max(...late.map(s => Math.abs(s.lensPitch)));
    const maxStepSpeed = Math.max(0, ...late.slice(1).map((s, i) => Math.hypot(...s.camera.pos.map((v, axis) => v - late[i].camera.pos[axis])) / testDt));
    const cameraCheck = { fromSeconds: checkFrom, minChestDistance, maxPitch, maxStepSpeed, pass: minChestDistance >= 1.1 && maxPitch < 70 && maxStepSpeed < 24 && !errors.length };
    fs.writeFileSync(path.join(out, 'camera-check.json'), JSON.stringify(cameraCheck, null, 2));
    console.log('CAMERA', JSON.stringify(cameraCheck));
    if (process.argv.includes('--check-camera') && !cameraCheck.pass) process.exitCode = 1;
  }
  if (checkSilhouette) {
    const silhouettePass = evidence.silhouette.length > 0 && evidence.silhouette.every(s => s.inside);
    console.log('SILHOUETTE', JSON.stringify({frames:evidence.silhouette.length,pass:silhouettePass,viewportMarginFraction:.02,scope:'skinned geometry only; excludes shader wisps and occlusion'}));
    if (!silhouettePass) process.exitCode=1;
  }
  if(clip)encodeDrop();
  console.log('DONE',JSON.stringify({errors,final:evidence.game.state.opening.page}));
}finally{await browser.close();await server.close();}
