// Staged diagnosis only: inspect return landing and nearby alternatives, not route acceptance.
import {chromium} from 'playwright';
import {createServer} from 'vite';
import fs from 'node:fs';
import path from 'node:path';
const out=process.argv[2]??'/tmp/return-camera';fs.mkdirSync(out,{recursive:true});
const server=await createServer({configFile:'games/fox-spirit/vite.config.ts',server:{port:5252,host:'127.0.0.1',strictPort:true},logLevel:'error'});await server.listen();
const browser=await chromium.launch({headless:true,args:process.env.FOX_TEST_GPU==='1'?['--use-gl=angle','--use-angle=gl-egl','--ignore-gpu-blocklist']:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:640,height:360}});page.setDefaultTimeout(600000);
const evidence={staging:'dev travel and alternative placement; no route proof',beats:[],errors:[]};page.on('pageerror',e=>evidence.errors.push(String(e)));
try{
await page.goto('http://127.0.0.1:5252/?fresh&manual=1',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__gameHooks?.ready);
await page.evaluate(()=>{const h=window.__gameHooks;h.setManual(true);h.travel('ashwater');h.advance(90,1/60,false);h.travel('russetvale');});
for(const [name,x,z,yaw] of [['return',null,null,null],['south',-5,88,Math.PI],['middle',-5,90,Math.PI],['east',-2,87,Math.PI]]){
 const s=await page.evaluate(async({x,z,yaw})=>{
  const h=window.__gameHooks;if(x!==null)h.teleport(x,z,yaw);h.setStick(0,0);h.setKeys([]);h.advance(150,1/60,true);
  const T=await import('/node_modules/three/build/three.module.js');
  const {scene}=window.__opening.ctx,camera=window.__opening.camera;
  scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);
  const ray=new T.Raycaster();ray.setFromCamera(new T.Vector2(0,0),camera);
  const hits=ray.intersectObjects(scene.children,true).slice(0,8).map(i=>({distance:i.distance,point:i.point.toArray(),name:i.object.name,type:i.object.type,material:i.object.material?.type,parent:i.object.parent?.name}));
  return{hooks:h.state(),game:window.__game.state(),hits};
 },{x,z,yaw});
 await page.screenshot({path:path.join(out,name+'.png')});evidence.beats.push({name,...s});console.log(name,JSON.stringify(s.hits));
}
}finally{fs.writeFileSync(path.join(out,'evidence.json'),JSON.stringify(evidence,null,1));await browser.close();await server.close();}
