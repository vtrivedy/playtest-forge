// Follows only the invitation actually drawn in the game. No route array or story/debug controls.
import {chromium} from 'playwright';
import {createServer, preview} from 'vite';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
const arg=(name,fallback)=>{const i=process.argv.indexOf(`--${name}`);return i<0?fallback:process.argv[i+1]};
const out=arg('out','/captures/hazel/discovery');
const seconds=Number(arg('seconds','180'));
const renderEvery=Number(arg('render-every','0'));
const width=Number(arg('width','640')),height=Math.round(width*9/16);
fs.mkdirSync(`${out}/frames`,{recursive:true});
const evidence={commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),tool:'Visible-cue follower; no authored route coordinates, no teleports, no forced state. Reads public invitation, position/velocity and grounded feedback.',seconds,errors:[],trace:[]};
const server=arg('production','0')==='1'?await preview({configFile:'games/fox-spirit/vite.config.ts',preview:{host:'127.0.0.1',port:5224,strictPort:true},logLevel:'error'}):await createServer({configFile:'games/fox-spirit/vite.config.ts',server:{host:'127.0.0.1',port:5224,strictPort:true},logLevel:'error'});
if(server.listen)await server.listen();
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width,height}});page.setDefaultTimeout(180000);page.on('pageerror',e=>evidence.errors.push(String(e)));
try{
 await page.goto('http://127.0.0.1:5224/?manual=1');await page.waitForFunction(()=>window.__gameHooks?.ready);
 await page.evaluate(()=>{const h=window.__gameHooks;h.setManual(true);window.__discoveryProbe={f:0,s:h.advance(1,1/60,false),rows:[]};});
 let image=0;
 for(let tick=0;tick<seconds*60;){
  const r=await page.evaluate(({limit,renderEvery})=>{
   const p=window.__discoveryProbe,h=window.__gameHooks;let shot=false;
   for(let i=0;i<60&&p.f<limit;i++){
    const s=p.s,c=s.opening.discovery;
    if(!c)throw new Error('Build has no visible invitation');
    let x=0,z=0,jump=false,dash=false;
    if(c.active&&c.action!=='wait'){
     const dx=c.target[0]-s.pos[0]-(s.vel?.[0]??0)*0.18,dz=c.target[2]-s.pos[2]-(s.vel?.[2]??0)*0.18;
     const d=Math.hypot(dx,dz),mag=Math.min(1,d*1.4);
     if(d>0.06){x=dx/d*mag;z=dz/d*mag;}
     dash=(c.action==='dash'&&d<2.2||c.action==='unfold'&&d<2.1)&&p.f%24===0;
     jump=c.action==='spring'||c.action==='jump'&&d<4.2;
     p.groundFrames=s.grounded?(p.groundFrames??0)+1:0;
     if(p.groundFrames>24&&p.f%36===0)jump=false;
     const bearing=Math.atan2(dx,dz),error=Math.atan2(Math.sin(bearing-s.yaw),Math.cos(bearing-s.yaw));
     if(dash&&Math.abs(error)>0.22)dash=false;
     if(c.action==='unfold'&&Math.abs(error)>0.22){x*=0.22;z*=0.22;}
    }
    h.setStick(x,z);h.setKeys(jump?(dash?['Space','ShiftLeft']:['Space']):dash?['ShiftLeft']:[]);
    shot=renderEvery>0&&p.f%renderEvery===0;
    p.s=h.advance(1,1/60,shot);p.f++;
    if(p.f%15===0)p.rows.push({t:p.f/60,pos:p.s.pos,grounded:p.s.grounded,vel:p.s.vel,cue:p.s.opening.discovery,page:p.s.opening.page,canopy:p.s.opening.canopy.lastLeaf,ruin:p.s.opening.popUpRuin});
    if(shot)break;
   }
   const rows=p.rows;p.rows=[];return{f:p.f,shot,rows,s:p.s};
  },{limit:seconds*60,renderEvery});
  tick=r.f;evidence.trace.push(...r.rows);
  if(r.shot)await page.screenshot({path:`${out}/frames/f${String(image++).padStart(5,'0')}.jpg`});
  if(tick%600===0){console.log(JSON.stringify({t:tick/60,pos:r.s.pos,cue:r.s.opening.discovery,page:r.s.opening.page.catches}));fs.writeFileSync(`${out}/evidence.partial.json`,JSON.stringify(evidence));}
 }
 evidence.game=await page.evaluate(()=>window.__game.state());
 await page.evaluate(()=>window.__gameHooks.advance(0,1/60,true));await page.screenshot({path:`${out}/end.png`});
 evidence.checks={firstCatch:evidence.game.opening.page.catches>0,canopy:evidence.game.opening.canopy.roostVisits>0,overlook:evidence.game.opening.popUpRuin.reached,kept:evidence.game.opening.page.phase==='kept',noErrors:evidence.errors.length===0};
 console.log(JSON.stringify(evidence.checks));
 if(renderEvery&&image>0)execFileSync('ffmpeg',['-y','-v','error','-framerate',String(60/renderEvery),'-i',`${out}/frames/f%05d.jpg`,'-c:v','libx264','-pix_fmt','yuv420p',`${out}/discovery.mp4`]);
}finally{fs.writeFileSync(`${out}/evidence.json`,JSON.stringify(evidence,null,2));await browser.close();await server.close();}
