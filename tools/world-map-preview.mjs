import { chromium } from 'playwright';
import fs from 'node:fs/promises';
const browser = await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});
const page = await browser.newPage({viewport:{width:1280,height:720}});
// Explicit component fixture, never an integrated puzzle or portal acceptance run.
const errors=[]; page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:5180/?manual');
await page.waitForFunction(()=>window.__gameHooks?.ready,{timeout:120000});
await page.evaluate(()=>{window.__gameHooks.setStick(.6,0);window.__gameHooks.advance(60);window.__gameHooks.setStick(0,0);window.__gameHooks.advance(10)});
const nativeMap=await page.evaluate(()=>typeof window.__game.state().opening.worlds?.mapOpen==='boolean');
if(nativeMap){
 await page.keyboard.press('Tab');
 if(!await page.evaluate(()=>window.__game.state().opening.worlds.mapOpen))throw Error('native Album did not open');
 await page.keyboard.press('BracketRight');
 await page.evaluate(()=>window.__gameHooks.advance(1));
 await fs.mkdir('/tmp/hazel-map-preview',{recursive:true});
 await page.screenshot({path:'/tmp/hazel-map-preview/native-story-1280.png'});
 await page.keyboard.press('BracketLeft');
 await page.keyboard.press('Tab');
 if(await page.evaluate(()=>window.__game.state().opening.worlds.mapOpen))throw Error('native Album did not close');
}
await page.evaluate(async()=>{
 window.__albumText=[];
 const originalFillText=CanvasRenderingContext2D.prototype.fillText;
 CanvasRenderingContext2D.prototype.fillText=function(value,...args){window.__albumText.push(String(value));return originalFillText.call(this,value,...args)};
 const {createWorldProgress}=await import('/src/worlds/progress.ts');
 const {createPageMap}=await import('/src/worlds/pageMap.ts');
 const p=createWorldProgress();
 p.visit('russetvale','teach');
 p.complete('ashwater','teach'); p.complete('ashwater','develop');
 p.complete('press','teach'); p.complete('press','develop'); p.complete('press','combine');
 const keyTarget=new EventTarget();
 window.__mapPreview={progress:p,keyTarget,map:createPageMap(window.__opening.camera,p,keyTarget)};
 window.__mapPreview.map.setOpen(true); window.__gameHooks.advance(1);
});
await fs.mkdir('/tmp/hazel-map-preview',{recursive:true});
await page.screenshot({path:'/tmp/hazel-map-preview/album-1280.png'});
await page.setViewportSize({width:960,height:540});
await page.waitForTimeout(250);
await page.evaluate(()=>{window.__mapPreview.map.step();window.__gameHooks.advance(2)});
await page.waitForTimeout(100);
await page.screenshot({path:'/tmp/hazel-map-preview/album-960.png'});
const storyChecks=[];
for(const world of ['russetvale','ashwater','press']){
 await page.evaluate(()=>{window.__albumText=[]});
 await page.evaluate(()=>window.__mapPreview.keyTarget.dispatchEvent(new KeyboardEvent('keydown',{code:'BracketRight'})));
 await page.evaluate(()=>window.__gameHooks.advance(1));
 await page.screenshot({path:`/tmp/hazel-map-preview/story-${world}-960.png`});
 const visibleText=await page.evaluate(()=>window.__albumText);
 const missing=visibleText.filter(t=>t==='A page still missing').length;
 const expectedMissing={russetvale:3,ashwater:1,press:0}[world];
 const spoiler=world==='ashwater'&&visibleText.includes('Upstream');
 storyChecks.push({world,missing,expectedMissing,spoiler,visibleText});
 if(missing!==expectedMissing||spoiler)throw Error(`story reveal invariant failed: ${world}`);
}
await page.evaluate(()=>window.__mapPreview.keyTarget.dispatchEvent(new KeyboardEvent('keydown',{code:'BracketRight'})));
await page.evaluate(()=>window.__gameHooks.advance(1));
await page.screenshot({path:'/tmp/hazel-map-preview/map-return-960.png'});

await page.evaluate(()=>window.__mapPreview.keyTarget.dispatchEvent(new KeyboardEvent('keydown',{code:'Tab'})));
const closed=await page.evaluate(()=>{window.__gameHooks.advance(1);return !window.__mapPreview.map.isOpen()});
await page.screenshot({path:'/tmp/hazel-map-preview/closed-badge-960.png'});
await page.evaluate(()=>window.__mapPreview.keyTarget.dispatchEvent(new KeyboardEvent('keydown',{code:'Tab'})));
const open=await page.evaluate(()=>window.__mapPreview.map.isOpen());
await page.evaluate(async()=>{
 const {buildSeedwells}=await import('/src/worlds/seedwells.ts');
 const THREE=await import('/@fs/work/node_modules/.vite/deps/three.js');
 const {createPostStack}=await import('/@fs/work/src/render/index.ts');
 const renderer=window.__opening.ctx.renderer;
 const scene=new THREE.Scene(); scene.background=new THREE.Color('#a8b6bf');
 scene.add(new THREE.HemisphereLight('#f2ede0','#625760',2));
 const light=new THREE.DirectionalLight('#fff1d4',3); light.position.set(-3,7,4); light.castShadow=true; scene.add(light);
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(50,50),new THREE.MeshStandardMaterial({color:'#8d9a8c',roughness:.9})); floor.rotation.x=-Math.PI/2; floor.receiveShadow=true; scene.add(floor);
 buildSeedwells(scene,window.__mapPreview.progress,[{world:'russetvale',x:-3,z:0,y:0},{world:'ashwater',x:0,z:0,y:0},{world:'press',x:3,z:0,y:0}]);
 const camera=new THREE.PerspectiveCamera(44,960/540,.1,100);camera.position.set(4,4,11);camera.lookAt(0,1,0);camera.updateMatrixWorld(true);
 const post=createPostStack(renderer,scene,camera,{bloomStrength:.2,pixelRatio:1});post.setSize(960,540);post.render();
});
await page.screenshot({path:'/tmp/hazel-map-preview/seedwells-960.png'});
await fs.writeFile('/tmp/hazel-map-preview/state.json',JSON.stringify(await page.evaluate(()=>({game:window.__game.state(),progress:window.__mapPreview.progress.snapshot()})),null,2));
await fs.writeFile('/tmp/hazel-map-preview/story-checks.json',JSON.stringify(storyChecks,null,2));
if(errors.length || !closed || !open) throw Error(JSON.stringify({errors,closed,open,nativeRealKeyboard:nativeMap}));
console.log(JSON.stringify({errors,closed,open,nativeRealKeyboard:nativeMap})); await browser.close();
