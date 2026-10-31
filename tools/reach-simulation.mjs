/** CPU diagnostic only: npx tsx tools/reach-simulation.mjs > coupled-invariants.json
 * Uses actual Reach/Water/Shade logic and native GLBs. Images and support architecture are stubs.
 * Scripted fox coordinates do not validate controller feel, real boarding, rendering or visual quality.
 */
import {createWater,waterSpots} from '../games/fox-spirit/src/chem/water.ts';
import {createShades} from '../games/fox-spirit/src/encounters/shades.ts';
import { fileURLToPath } from 'node:url';
import {readFile} from 'node:fs/promises';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as THREE from 'three';
import {createAshwaterReach} from '../games/fox-spirit/src/ashwaterReach.ts';
import {setRuinSupportGeometry} from '../games/fox-spirit/src/russetKit.ts';
import {CollisionWorld} from '../games/fox-spirit/src/collision.ts';
import {createColorField} from '../src/render/colorField.ts';
THREE.TextureLoader.prototype.load=function(_url,onLoad){const t=new THREE.Texture();queueMicrotask(()=>onLoad?.(t));return t;};
GLTFLoader.prototype.loadAsync=async function(path){const b=await readFile(fileURLToPath(new URL('..'+path, import.meta.url)));return this.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'http://reach.test/assets/');};
Object.assign(globalThis,{self:globalThis});
Object.assign(globalThis,{location:{search:'?fresh'},localStorage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}},document:{createElement:()=>({width:64,height:64,getContext:()=>({createRadialGradient:()=>({addColorStop:()=>{}}),fillRect:()=>{}})})}});
async function fixture(){
waterSpots.splice(3);setRuinSupportGeometry(new THREE.BoxGeometry(.61,1.9,.61));
const scene=new THREE.Scene(),world={group:new THREE.Group(),collision:new CollisionWorld(()=>-100),materials:[],hearthSpots:[],shadeSpots:[],checkpoints:[]};
const reach=await createAshwaterReach(scene,world),water=createWater(scene,world.collision);
const shades=await createShades(scene,world.shadeSpots,(x,z,y)=>world.collision.groundAt(x,z,y).y,undefined,(x,z,y)=>world.collision.blocked(x,z,y));
const gui={addFolder:()=>({add:()=>({onChange:()=>{}}),close:()=>{}})};reach.attach(water,gui);
const field=createColorField();let t=0,injected=false;const trajectory=[];const dt=1/60,centre=new THREE.Vector3(117,30,-118);
function step(fox,grounded=true){t+=dt;field.setFox(fox.clone().add(new THREE.Vector3(0,.25,0)));field.update(dt);shades.update(dt,t,fox,false);reach.sync(dt,field);const drain=p=>injected&&p.x>100&&p.x<108||shades.drains(p),supply=p=>!drain(p)?reach.supplyAt(p):field.strokeAt(p)>1?1:0;water.update(dt,t,supply,drain);reach.update(dt,fox,fox.y-.4,grounded,true,false,shades.drains(centre));if(Math.round(t*60)%30===0)trajectory.push({t:Number(t.toFixed(2)),shade:shades.state()[0],fill:reach.state().fill,arrived:reach.state().arrived});}
for(let i=0;i<660;i++)step(new THREE.Vector3(0,1,90));for(let i=0;i<20;i++)step(new THREE.Vector3(102,30.4,-110));
return{reach,water,shades,step,trajectory,cut(){injected=true;}};
}
async function main(){
const aura=await fixture();let firstArrival=null,latched=null;
for(let i=0;i<1800;i++){aura.step(new THREE.Vector3(103,30.4,-116));const st=aura.reach.state();if(st.arrived&&firstArrival===null)firstArrival=(i+1)/60;if(st.restored&&latched===null)latched=(i+1)/60;}
if(!aura.reach.state().restored)throw Error('Held aura did not latch within30 seconds');
const auraResult={firstArrival,latched,end:aura.reach.state(),trajectory:aura.trajectory};
if(aura.trajectory.some(s=>s.shade.pos[1]>31))throw Error("Shade rode moving architecture");
const safe=await fixture();let frames=0;while(frames<1200&&!(safe.reach.state().arrived&&safe.reach.state().fill>=.6)){safe.step(new THREE.Vector3(103,30.4,-116));frames++;}
const setup=safe.reach.state();if(!setup.arrived||setup.fill<.6||setup.restored)throw Error('No live partial fill for stress setup');safe.cut();
for(let i=0;i<480;i++){const h=safe.reach.state().floats[2].height;safe.step(new THREE.Vector3(118,h+.4,-129));}
const retained=safe.reach.state();
const source=safe.water.state().find(s=>s.id==='reach-spout');if(!source||source.flowing||source.arriving||source.heat>.01)throw Error("Injected source did not stop");if(!retained.retained||retained.seal!==0||retained.restored||retained.fill<.98)throw Error('Real-water retention/no-false-latch failed');
for(let i=0;i<60;i++){const h=safe.reach.state().floats[2].height;safe.step(new THREE.Vector3(118,h+1.6,-129),false);}
const airborne=safe.reach.state();if(!airborne.retained||airborne.fill!==retained.fill||airborne.seal!==0||airborne.restored)throw Error('Airborne retained route failed');
for(let i=0;i<180;i++)safe.step(new THREE.Vector3(101,30.4,-130));const drained=safe.reach.state();if(drained.fill!==0)throw Error('Stable ground did not release retained water');
console.log(JSON.stringify({kind:'CPU actual Water parcels, Shade controller and Reach inlet; scripted static/occupied/airborne fox coordinates, dummy images/support architecture, no renderer/fox controller',aura:auraResult,safety:{sourceHoldSeconds:frames/60,setup,source,retained,airborne,drained,trajectory:safe.trajectory}},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
