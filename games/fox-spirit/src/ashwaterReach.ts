import * as THREE from 'three';
import type GUI from 'lil-gui';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { createColorField } from '../../../src/render';
import { boxCollider } from './collision';
import type { Realm } from './russetvale';
import { Bucket, PAL, rockSlab, stairFlight, ruinArch, stoneBlock, trs, kilnBowl, hangingRoot, hangingSpire, rng } from './russetKit';
import { waterSpots, type createWater } from './chem/water';
import { createInlets } from './chem/inlet';
import { loadNatureKit } from './russetNature';
import { weatheredSurface } from './worldSurfaces';

/** Water stores height: an arriving front fills a basin and raises its ferry. */
export async function createAshwaterReach(scene: THREE.Scene, world: Realm) {
  const group = new THREE.Group(); group.name = 'ashwater-reach'; scene.add(group);
  const rock = new Bucket(), stone = new Bucket(), wood = new Bucket(), roots = new Bucket();
  const col = world.collision;
  const field = createColorField({ auraRadius: 3.4, trailLife: 3, trailRadius: 2.6, bounds: { minX: 135, maxX: 230, minZ: -160, maxZ: -80 }, maskSize: 256 });
  const mats: THREE.MeshStandardMaterial[] = [];
  const source = 'reach-spout';
  const tun = { fillRate: 0.4, drainRate: 0.6, warningTime: 1, rise: 6, latchTime: 2 };
  let level: 'low' | 'high' = 'high';
  let wasDash=false, toggleCooldown=0, drinks=false, refillDelay=0;
  let fill = 0, warning = 0, seal = 0, retained = false, arrived = false, open = false;
  const saveKey = 'fox-spirit:ashwater:bell';
  let restored = false;
  try { if (new URLSearchParams(location.search).has('fresh')) localStorage.removeItem(saveKey); restored = localStorage.getItem(saveKey) === '1'; } catch { /* unsaved play */ }
  if (restored) fill = seal = 1;
  function shelf(x: number, y: number, z: number, w: number, d: number, seed: number) {
    rockSlab(rock, { x, z, top: y, bottom: y - 6, w, d, seed, rough: 0.45, topColor: PAL.stone, overhang: 0.5 });
    // Existing walkable shelf, with a long eroded visual underside instead of a flat box.
    for (let k = 0; k < (w > 25 ? 3 : 2); k++) {
      const a = seed * 0.7 + k * 2.4;
      hangingSpire(rock, x + Math.cos(a) * w * 0.14, y - 5.5, z + Math.sin(a) * d * 0.14,
        Math.min(w, d) * (0.24 + k * 0.025), 19 + seed % 13 + k * 6, seed * 10 + k);
    }
    col.add(boxCollider({ x, z, w: w - 0.4, d: d - 0.4, top: y, bottom: y - 6, tag: 'reach-stone' }));
  }
  function bridge(a: [number, number, number], b: [number, number, number], width: number, seed: number) {
    const [ax, ay, az] = a, [bx, by, bz] = b, len = Math.hypot(bx-ax,bz-az), yaw = Math.atan2(bx-ax,bz-az);
    if (ay === by) stoneBlock(stone, trs((ax+bx)/2, ay-.3, (az+bz)/2, yaw), width, .6, len+.4, seed, .12);
    else stairFlight(stone, {x:ax,y:ay,z:az}, {x:bx,y:by,z:bz}, width, seed);
    col.add(boxCollider({x:(ax+bx)/2,z:(az+bz)/2,w:width,d:len+.4,yaw,top:ay,top1:by,bottom:Math.min(ay,by)-1,tag:'reach-causeway'}));
  }
  // Physical traversal between realms; no scene teleport. Broad bays interrupt the long bridge.
  bridge([12,38,-90],[148,38,-90],4.5,910);
  for (const x of [40,76,112]) {
    shelf(x,38,-90,9,9,920+x);
    ruinArch(stone,x,38,-90,Math.PI/2,{span:4.7,pillarH:3.2,broken:x===76?.45:0,seed:940+x});
  }
  // The deck remains exactly where it was; ruined arches give its span a structural read.
  for (const x of [58, 94, 130]) ruinArch(stone, x, 10.8, -90, 0, { span: 30, pillarH: 9, broken: x === 94 ? 0.18 : 0, seed: 4800 + x });
  shelf(150,38,-96,18,24,951);
  bridge([154,38,-102],[160,38,-108],3.4,952);
  bridge([160,38,-108],[174,30,-130],3.4,957);
  shelf(184,30,-118,46,32,953);
  shelf(204,36,-118,18,19,954);
  shelf(214,31,-137,14,12,955);
  bridge([205,36,-127],[214,31,-134],3.5,956);
  ruinArch(stone,207,36,-119,0,{span:4.5,pillarH:6.5,seed:960,broken:.3});
  ruinArch(stone,216,31,-139,.2,{span:3,pillarH:3.2,seed:961,broken:.5});
  kilnBowl(stone,201,36,-122,203,37,-121,962);
  // A source/flume/basin relationship readable from the arrival shelf.
  for (const x of [171.6,176.4]) stoneBlock(stone,trs(x,32,-116),.9,4.5,1.4,970+Math.round(x),.1);
  stoneBlock(stone,trs(174,34,-116),6,.6,2.1,975,.1);
  waterSpots.push({id:source,realm:'ashwater',lip:new THREE.Vector3(174,33.7,-116),foot:new THREE.Vector3(174,30.5,-116),width:2.2,
    probes:[new THREE.Vector3(173,30.7,-116)],path:[new THREE.Vector3(174,30.4,-116),new THREE.Vector3(180,30.35,-117),new THREE.Vector3(187,30.3,-118)]});
  // Basin rim and high-water notch. Supporting floor remains dry-safe stone.
  for (const z of [-123,-113]) stoneBlock(stone,trs(187,30.35,z),12,.7,.6,980+z,.08);
  for(let i=0;i<7;i++) stoneBlock(stone,trs(192.2,30.4+i*.9,-118),.4,.2,1.2,990+i,.04);
  const raft = new THREE.Group(); raft.name='reach-ferry'; group.add(raft);
  for(let i=0;i<9;i++) stoneBlock(wood,trs(-2.8+i*.7,-.2,0),.65,.4,7,1010+i,.05);
  const timber = new THREE.MeshStandardMaterial({vertexColors:true,roughness:.9}); weatheredSurface(timber,true); field.patchMaterial(timber); mats.push(timber);
  const ferry = wood.toMesh(timber,{cast:true,receive:true,boxUV:1.4}); if(ferry) raft.add(ferry);
  raft.position.set(187,30,-118);
  const raftCol=col.add(boxCollider({x:187,z:-118,w:6.2,d:7,top:30,bottom:29.5,tag:'reach-ferry'}));
  const waterMat=new THREE.MeshPhysicalMaterial({color:0x34433c,roughness:.22,metalness:.2,transparent:true,opacity:.24});
  const pool=new THREE.Mesh(new THREE.PlaneGeometry(22,24),waterMat); pool.rotation.x=-Math.PI/2; pool.position.set(187,29.8,-118); group.add(pool);
  const mirror=new Reflector(new THREE.PlaneGeometry(22,24),{color:0x53685e,textureWidth:512,textureHeight:512,clipBias:.03,multisample:0});
  mirror.rotation.x=-Math.PI/2;mirror.position.set(187,29.79,-118);group.add(mirror);
  // Portal leaf-seal opens after W1's flood; the bridge itself never vanishes.
  const gate=col.add(boxCollider({x:28,z:-90,w:1,d:4.5,top:42,bottom:37,tag:'reach-flood-gate'}));
  const gateMat=new THREE.MeshStandardMaterial({color:0x55412c,transparent:true,opacity:.8,roughness:1});
  const gateMesh=new THREE.Mesh(new THREE.BoxGeometry(.4,4.2,4.5),gateMat); gateMesh.position.set(28,40,-90); group.add(gateMesh);
  const rr=rng(1050); for(let i=0;i<12;i++) hangingRoot(roots,rr,165+rr()*48,29.8,-132+rr()*2,4+rr()*5,new THREE.Vector2(0,1),.13);
  for(const [bucket,name] of [[rock,'rv-rock'],[stone,'rv-stone'],[roots,'rv-bark']] as const) {
    const mat=world.materials.find(m=>m.name===name)!.clone(); mat.userData.cfRestoredChroma=.6; field.patchMaterial(mat); mats.push(mat);
    const mesh=bucket.toMesh(mat,{cast:true,receive:true,boxUV:name==='rv-rock'?4:1.6}); if(mesh)group.add(mesh);
  }
  const nature=await loadNatureKit();
  nature.place('twisted_3',211,36,-124,{scale:.5,yaw:1.2,gaps:.35,hue:PAL.russet,hue2:PAL.gold});
  nature.place('twisted_1',174,30,-130,{scale:.4,yaw:2,gaps:.4,hue:PAL.leafBrown,hue2:PAL.copper});
  nature.place('twisted_2',193,30,-127,{scale:.4,yaw:.8,gaps:.4,hue:PAL.russet,hue2:PAL.gold,avoid:[{x:187,y:35,z:-118,r:5}]});
  for(const m of nature.build(group)){field.patchMaterial(m);mats.push(m);}
  const bellMat=new THREE.MeshStandardMaterial({color:0x8b5832,metalness:.6,roughness:.5,emissive:0xc17530,emissiveIntensity:.02});
  const bell=new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(.9,0),new THREE.Vector2(.65,.25),new THREE.Vector2(.55,1.05),new THREE.Vector2(.2,1.35),new THREE.Vector2(0,1.45)],20),bellMat);
  bell.position.set(207,40.5,-119);group.add(bell);field.patchMaterial(bellMat);mats.push(bellMat);
  const hanger=new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,2.3,6),bellMat);hanger.position.set(207,43.1,-119);group.add(hanger);
  // Pale basin piers give the rising water a fixed reference; the inlet seal sits on the high-water notch.
  const basin=new Bucket();for(const x of[181.3,192.7])for(const z of[-122.8,-113.2])stoneBlock(basin,trs(x,33,z),.45,6.5,.45,1100+Math.round(x+z),.06);
  const basinMesh=basin.toMesh(mats[2]!,{cast:true,receive:true,boxUV:1.6});if(basinMesh)group.add(basinMesh);
  const floats=[{mesh:raft,c:raftCol,x:187,z:-118,base:30}];
  for(const [x,z] of [[192,-124],[188,-129]]){
    const b=new Bucket();for(let i=0;i<4;i++)stoneBlock(b,trs((i-1.5)*.6,-.2,0),.55,.4,3.4,1200+i+x,.06);
    const m=b.toMesh(timber,{cast:true,receive:true,boxUV:1.4})!;const g=new THREE.Group();g.add(m);g.position.set(x,30,z);group.add(g);
    const c=col.add(boxCollider({x,z,w:2.5,d:3.4,top:30,bottom:29.5,tag:'reach-float'}));floats.push({mesh:g,c,x,z,base:30});
  }
  // Fixed low lane and sunken ferryman's niche: inaccessible under HIGH water.
  const low=new Bucket();ruinArch(low,181,30,-128,Math.PI/2,{span:2.4,pillarH:1.5,seed:1220,broken:.4});
  stoneBlock(low,trs(179.5,30.4,-130),2.5,.5,1,1221,.08);
  const lowMesh=low.toMesh(mats[2]!,{cast:true,receive:true,boxUV:1.6});if(lowMesh)group.add(lowMesh);
  world.hearthSpots.push({id:'reach-steam',x:181,y:30,z:-128,height:13});
  world.shadeSpots.push({id:'reach-drinker',speed:1.6,patrol:[[183,30,-120],[186,30,-122],[190,30,-120],[186,30,-116]]});
  world.checkpoints.push({pos:new THREE.Vector3(171,30,-130),lit:false});
  const handles=[[173,30,-124],[201,36,-121]];
  const handleMeshes:THREE.Mesh[]=[];
  for(const [x,y,z] of handles){const m=new THREE.Mesh(new THREE.CylinderGeometry(.12,.12,2.2,8),timber);m.position.set(x,y+1,z);m.rotation.z=.5;group.add(m);handleMeshes.push(m);}
  const mistCanvas=document.createElement('canvas');mistCanvas.width=mistCanvas.height=64;
  const mistCtx=mistCanvas.getContext('2d')!;const mistGradient=mistCtx.createRadialGradient(32,32,5,32,32,32);mistGradient.addColorStop(0,'rgba(255,255,255,.55)');mistGradient.addColorStop(.6,'rgba(255,255,255,.3)');mistGradient.addColorStop(1,'rgba(255,255,255,0)');mistCtx.fillStyle=mistGradient;mistCtx.fillRect(0,0,64,64);
  const mistMat=new THREE.MeshBasicMaterial({color:0xb2b4a4,map:new THREE.CanvasTexture(mistCanvas),transparent:true,opacity:.25,depthWrite:false,side:THREE.DoubleSide});
  const mist=new THREE.Mesh(new THREE.PlaneGeometry(25,27),mistMat);mist.rotation.x=-Math.PI/2;mist.position.set(187,30.1,-118);group.add(mist);
  let inlet: ReturnType<typeof createInlets>;
  let water: ReturnType<typeof createWater>;
  function restoreSource(duration=3){const w=water.waters.find(w=>w.spot.id===source);if(w)w.reactor.restored=true;if(!field.restores.length)field.restore(new THREE.Vector3(190,30,-118),55,duration);}
  return {
    contains:(p:THREE.Vector3)=>p.x>138,
    supplyAt:(p:THREE.Vector3)=>Math.hypot(p.x-181,p.z+128)<1.5&&p.y<32?(fill>.2?0:field.strokeAt(p)):field.sample(p),
    init(renderer:THREE.WebGLRenderer){field.initMask(renderer);},
    attach(w:typeof water,gui:GUI){water=w;
      inlet=createInlets(scene,[{seedwell:0,source,pos:new THREE.Vector3(192.2,36,-118),sealAt:new THREE.Vector3(192.2,36.12,-118),pillar:new THREE.Vector3(192.7,30,-118),latchTime:tun.latchTime}],new THREE.MeshStandardMaterial({color:0x6d5036,roughness:.8}));
      if(restored){inlet.inlets[0]!.latched=true;inlet.inlets[0]!.seal=1;}
      const f=gui.addFolder('Ashwater Reach');f.add(tun,'fillRate',.05,.5,.01);f.add(tun,'drainRate',.02,1,.01);f.add(tun,'warningTime',.8,4,.1);f.add(tun,'latchTime',.5,5,.1).onChange((v:number)=>{inlet.inlets[0]!.latchTime=v;});f.close();if(restored)restoreSource(.2);},
    sync(dt:number,base:ReturnType<typeof createColorField>){field.trail=[];field.strokes=[];field.update(dt);field.setFox(base.fox);field.trail=base.trail.map(t=>({...t}));field.strokes=base.strokes.map(t=>({...t}));field.renderMask(dt);for(const m of mats)field.syncMaterial(m);},
    update(dt:number,fox:THREE.Vector3,feetY:number,grounded:boolean,flood:boolean,dashing:boolean,drained:boolean){
      open=flood;gate.enabled=!open;gateMesh.visible=!open;
      toggleCooldown=Math.max(0,toggleCooldown-dt);drinks=drained&&!restored;
      if(dashing&&!wasDash&&toggleCooldown===0&&handles.some(([x,y,z])=>Math.hypot(fox.x-x,fox.z-z)<3&&Math.abs(feetY-y)<2)){level=level==='high'?'low':'high';toggleCooldown=.6;warning=tun.warningTime;refillDelay=level==='high'?1.8:0;}
      wasDash=dashing;
      for(const h of handleMeshes)h.rotation.z=level==='high'?.5:-.5;
      refillDelay=Math.max(0,refillDelay-dt);
      arrived=level==='high'&&refillDelay<=0&&water.arriving(source);
      const occupied=grounded&&floats.some(f=>Math.abs(fox.x-f.x)<f.c.hx+.1&&Math.abs(fox.z-f.z)<f.c.hz+.1&&Math.abs(feetY-f.c.top0)<.7);
      retained=false;
      if(level==='high'&&arrived){warning=tun.warningTime;fill=Math.min(1,fill+dt*tun.fillRate);}
      else if(warning>0)warning=Math.max(0,warning-dt);
      else if(occupied&&fill>0)retained=true;
      else fill=Math.max(0,fill-dt*tun.drainRate);
      if(drinks&&!occupied)fill=Math.max(0,fill-dt*tun.drainRate*.5);
      const latched=inlet.update(dt,()=>level==='high'&&arrived&&fill>=.98&&!retained);seal=inlet.inlets[0]!.seal;if(!restored&&latched.length){restored=true;restoreSource();try{localStorage.setItem(saveKey,'1');}catch{}}
      bellMat.emissiveIntensity=.02+seal*.7;bell.rotation.z=restored?Math.sin(field.time*1.7)*.07:0;
      for(const f of floats){f.mesh.position.y=f.base+tun.rise*fill;f.c.top0=f.c.top1=f.mesh.position.y;f.c.bottom=f.mesh.position.y-.5;}
      pool.position.y=29.8+tun.rise*fill;mirror.position.y=pool.position.y-.015;
      mist.position.y=pool.position.y+.2;waterMat.color.setHex(retained?0x4b4940:0x34433c);
    },
    submergedAt(p:THREE.Vector3,feet:number){return fill>.2&&p.x>176&&p.x<198&&p.z>-130&&p.z<-106&&feet<pool.position.y-.8;},
    state(){return {level,refillDelay:Number(refillDelay.toFixed(2)),drinks,floats:floats.map(f=>({x:f.x,z:f.z,height:Number(f.mesh.position.y.toFixed(2))})),open,arrived,fill:Number(fill.toFixed(3)),raftHeight:Number(raft.position.y.toFixed(3)),warning:Number(warning.toFixed(2)),retained,seal:Number(seal.toFixed(3)),restored,source};},
  };
}
