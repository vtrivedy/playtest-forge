// Physical stair regression. Staged starts; E uses real keys, traversal uses the controller stick.
import {chromium} from 'playwright';
import {createServer} from 'vite';
import fs from 'node:fs';
const out=process.argv[2]||'/tmp/keeping-stair-probe'; fs.mkdirSync(out,{recursive:true});
const server=await createServer({configFile:'games/fox-spirit/vite.config.ts',server:{port:5199,host:'127.0.0.1',strictPort:true},logLevel:'error'});await server.listen();
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:960,height:540},recordVideo:{dir:out,size:{width:960,height:540}}});page.setDefaultTimeout(120000);
const evidence={staging:'Source, basin, stair bottom, root and bridge starts teleported. Real E pickup/place; ascent/descent uses controller stick. No jump, forced heat, latch or release. Not uninterrupted route completion.',samples:[],errors:[]};page.on('pageerror',e=>evidence.errors.push(String(e)));
async function sample(label,shot=false){const state=await page.evaluate(()=>window.__gameHooks.advance(1,1/60,true));evidence.samples.push({label,state});if(shot)await page.screenshot({path:`${out}/${label}.png`});return state;}
async function stage(x,z,yaw=0){await page.evaluate(([x,z,yaw])=>{const h=window.__gameHooks;h.setKeys([]);h.setStick(0,0);h.teleport(x,z,yaw);h.advance(15,1/60,false);},[x,z,yaw]);}
async function advance(n){return page.evaluate(n=>window.__gameHooks.advance(n,1/60,false),n);}
async function key(k,n=1){await page.keyboard.down(k);await advance(n);await page.keyboard.up(k);await advance(1);}
try{
await page.goto('http://127.0.0.1:5199/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__gameHooks?.ready);await page.evaluate(()=>window.__gameHooks.setManual(true));
const K=await page.evaluate(async()=> (await import('/src/opening/layout.ts')).KEEPING);
await stage(K.coal.x,K.coal.z);await key('e');await sample('01-carry',true);
await stage(K.steam.x,K.steam.z);await advance(360);await sample('02-carried-basin-reject');await key('e');await advance(360);await sample('03-steam',true);
// Stage at basin; recover coal, then physically follow unfolded stair up and down.
await key('e');await sample('stair-coal-recovered');
const local=(x,z)=>({x:K.terrace.x+x*Math.cos(K.terrace.yaw)+z*Math.sin(K.terrace.yaw),z:K.terrace.z-x*Math.sin(K.terrace.yaw)+z*Math.cos(K.terrace.yaw)});
async function walkTo(p,label){let s;for(let i=0;i<360;i++){s=await page.evaluate(p=>{const h=window.__gameHooks;const q=h.advance(1,1/60,false).pos;const dx=p.x-q[0],dz=p.z-q[2],d=Math.hypot(dx,dz);h.setStick(d>.08?dx/d:0,d>.08?dz/d:0);return h.advance(1,1/60,false)},p);if(Math.hypot(p.x-s.pos[0],p.z-s.pos[2])<.15)break;}await page.evaluate(()=>window.__gameHooks.setStick(0,0));await advance(10);return sample(label,true);}
const bottom=local(2.85,-3.58),top=local(-2.4,-3.58);
await stage(bottom.x,bottom.z);await sample('stair-bottom',true);
await walkTo(top,'stair-ascent');
// Independently stage at the top so failed ascent cannot make descent a false pass.
await stage(top.x,top.z);await sample('stair-top-staged',true);
await walkTo(bottom,'stair-descent');
await walkTo(top,'stair-reascent');

await stage(K.root.x,K.root.z);await key('e');await advance(480);await sample('06-root-bridge',true);
await stage(K.hinge.x+K.fall.x*K.span*.5,K.hinge.z+K.fall.z*K.span*.5,Math.atan2(K.fall.x,K.fall.z));await advance(30);await sample('07-bridge-collision',true);
evidence.expected={terraceTop:K.terrace.top,bridgeTop:K.terrace.top+.12};
const at=label=>evidence.samples.find(s=>s.label===label).state;
const C=s=>s.opening.chemistry;
evidence.assertions=[
['carried coal rejects basin ignition',!C(at('02-carried-basin-reject')).steamLatched],
['placed coal latches steam',C(at('03-steam')).steamLatched],
['stair ascent reaches terrace',Math.abs(at('stair-ascent').pos[1]-K.terrace.top)<.2],['stair descent reaches basin',Math.abs(at('stair-descent').pos[1]-K.steam.y)<.2],
['stair reascent reaches terrace',Math.abs(at('stair-reascent').pos[1]-K.terrace.top)<.2],
['coal retained throughout traversal',['stair-bottom','stair-ascent','stair-descent','stair-reascent'].every(label=>at(label).opening.carry.carried)],
['recovery preserves steam',at('stair-coal-recovered').opening.carry.carried&&C(at('stair-coal-recovered')).steamLatched],
['root releases bridge exactly once',C(at('06-root-bridge')).releases===1&&at('06-root-bridge').opening.keeping.impacts===1],
['bridge supports player',at('07-bridge-collision').grounded&&Math.abs(at('07-bridge-collision').pos[1]-evidence.expected.bridgeTop)<.03],
['no page errors',evidence.errors.length===0]
].map(([name,pass])=>({name,pass}));
fs.writeFileSync(`${out}/evidence.json`,JSON.stringify(evidence,null,2));console.log(JSON.stringify({out,assertions:evidence.assertions,states:evidence.samples.filter(s=>!s.label.startsWith('lift-')).map(s=>({label:s.label,pos:s.state.pos,carry:s.state.opening.carry.carried,chem:s.state.opening.chemistry,keeping:s.state.opening.keeping}))},null,2));
if(evidence.assertions.some(a=>!a.pass))throw Error('Authored Keeping regression failed; inspect evidence.json');
}finally{await browser.close();await server.close();}
