// Follows only the invitation actually drawn in the game. No route array or story/debug controls.
import {chromium} from 'playwright';
import {createServer, preview} from 'vite';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createDiscoveryPolicy} from './lib/discovery-policy.mjs';
import {createDiscoveryObserver} from './lib/discovery-observer.mjs';
const arg=(name,fallback)=>{const i=process.argv.indexOf(`--${name}`);return i<0?fallback:process.argv[i+1]};
const out=arg('out','/captures/hazel/discovery');
const seconds=Number(arg('seconds','180'));
const renderEvery=Number(arg('render-every','0'));
const port=Number(arg('port','5224'));
const mistake=arg('mistake','none');
const perception=arg('perception','rendered');
const width=Number(arg('width','640')),height=Math.round(width*9/16);
if(fs.existsSync(`${out}/frames`)&&fs.readdirSync(`${out}/frames`).length)throw new Error('Output already has frames; use a fresh directory to preserve evidence');
fs.mkdirSync(`${out}/frames`,{recursive:true});
const evidence={toolSha256:createHash('sha256').update(fs.readFileSync(new URL(import.meta.url))).digest('hex'),policySha256:createHash('sha256').update(createDiscoveryPolicy.toString()).digest('hex'),observerSha256:createHash('sha256').update(createDiscoveryObserver.toString()).digest('hex'),commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),tool:'Route-independent invitation follower; no teleports or forced state. Rendered mode observes only fragment instances inside camera viewport and shown hint text; geometry observation, not pixel vision or an occlusion guarantee. Semantic mode is a separate instrumentation control.',seconds,mistake,perception,capture:{clock:'fixed 60Hz simulation, offline screenshots',fps:renderEvery?60/renderEvery:0,audio:false},completed:false,errors:[],trace:[]};
const server=arg('production','0')==='1'?await preview({configFile:'games/fox-spirit/vite.config.ts',preview:{host:'127.0.0.1',port,strictPort:true},logLevel:'error'}):await createServer({configFile:'games/fox-spirit/vite.config.ts',server:{host:'127.0.0.1',port,strictPort:true},logLevel:'error'});
if(server.listen)await server.listen();
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width,height}});page.setDefaultTimeout(180000);page.on('pageerror',e=>evidence.errors.push(String(e)));
try{
 await page.goto(`http://127.0.0.1:${port}/?manual=1`);await page.waitForFunction(()=>window.__gameHooks?.ready);
 await page.evaluate(({source,observer})=>{const h=window.__gameHooks;h.setManual(true);window.__discoveryProbe={f:0,s:h.advance(1,1/60,false),rows:[],policy:new Function(`return (${source})`)()(),injected:false,missLeft:0,observe:new Function(`return (${observer})`)()(window.__opening.ctx.scene,window.__opening.camera,window.__opening.ctx.fox.root)};},{source:createDiscoveryPolicy.toString(),observer:createDiscoveryObserver.toString()});
 let image=0,lastSaved=0;
 for(let tick=0;tick<seconds*60;){
  const r=await page.evaluate(({limit,renderEvery,mistake,perception})=>{
   const p=window.__discoveryProbe,h=window.__gameHooks;let shot=false;
   for(let i=0;i<60&&p.f<limit;i++){
    const s=p.s,c=s.opening.discovery;
    if(!c)throw new Error('Build has no visible invitation');
    const seen=perception==='rendered'?p.observe(p.f/60,s.opening.teach?.showing):c;
    let {x,z,jump,dash}=p.policy(seen,{pos:s.pos,vel:s.vel,yaw:s.yaw,grounded:s.grounded});
    if(seen.search){x=Math.sin(s.yaw+1.4)*0.15;z=Math.cos(s.yaw+1.4)*0.15;}
    if(!p.injected&&!s.grounded&&(mistake==='spring'&&c.action==='spring'||mistake==='ruin'&&c.leg==='jump2')){
     p.injected=true;p.missLeft=72;
    }
    if(p.missLeft>0){x=0.7;z=0.7;jump=false;dash=false;p.missLeft--;}

    h.setStick(x,z);h.setKeys(jump?(dash?['Space','ShiftLeft']:['Space']):dash?['ShiftLeft']:[]);
    shot=renderEvery>0&&p.f%renderEvery===0;
    p.s=h.advance(1,1/60,shot);p.f++;
    if(p.f%15===0||c.leg!==p.s.opening.discovery.leg)p.rows.push({transition:c.leg!==p.s.opening.discovery.leg?`${c.leg}->${p.s.opening.discovery.leg}`:null,injected:p.injected,observed:perception==='rendered'?{active:seen.active,target:[...seen.target],action:seen.action,search:seen.search}:null,t:p.f/60,pos:p.s.pos,grounded:p.s.grounded,vel:p.s.vel,cue:p.s.opening.discovery,teach:p.s.opening.teach,page:p.s.opening.page,canopy:p.s.opening.canopy.lastLeaf,ruin:p.s.opening.popUpRuin});
    if(shot)break;
   }
   const rows=p.rows;p.rows=[];return{f:p.f,shot,rows,s:p.s};
  },{limit:seconds*60,renderEvery,mistake,perception});
  tick=r.f;evidence.trace.push(...r.rows);
  if(r.shot)await page.screenshot({path:`${out}/frames/f${String(image++).padStart(5,'0')}.jpg`});
  if(tick-lastSaved>=600){lastSaved=tick;console.log(JSON.stringify({t:tick/60,pos:r.s.pos,cue:r.s.opening.discovery,page:r.s.opening.page.catches}));fs.writeFileSync(`${out}/evidence.partial.json`,JSON.stringify(evidence));}
 }
 evidence.game=await page.evaluate(()=>window.__game.state());
 fs.writeFileSync(`${out}/evidence.partial.json`,JSON.stringify(evidence));
 await page.evaluate(()=>window.__gameHooks.advance(0,1/60,true));await page.screenshot({path:`${out}/end.png`});
 evidence.checks={firstCatch:evidence.game.opening.page.catches>0,canopy:evidence.game.opening.canopy.roostVisits>0,overlook:evidence.game.opening.popUpRuin.reached,kept:evidence.game.opening.page.phase==='kept',noErrors:evidence.errors.length===0,finite:evidence.trace.every(r=>r.pos.every(Number.isFinite)),noCompetingHearthHint:evidence.trace.every(r=>!r.cue.active||!/cold hearth|warm air/.test(r.teach?.showing??'')),landingGates:evidence.trace.filter(r=>['jump1->fold2','jump1->jump2','jump2->jump3','jump3->catch'].includes(r.transition)).every(r=>r.grounded),mistakeInjected:mistake==='none'||evidence.trace.some(r=>r.injected)};
 evidence.frames=image;
 evidence.completed=true;
 console.log(JSON.stringify(evidence.checks));
 if(!Object.values(evidence.checks).every(Boolean))process.exitCode=1;
 if(renderEvery&&image>0)execFileSync('ffmpeg',['-y','-v','error','-framerate',String(60/renderEvery),'-i',`${out}/frames/f%05d.jpg`,'-c:v','libx264','-pix_fmt','yuv420p',`${out}/discovery.mp4`]);
}finally{fs.writeFileSync(`${out}/evidence.json`,JSON.stringify(evidence,null,2));await browser.close();await server.close();}
