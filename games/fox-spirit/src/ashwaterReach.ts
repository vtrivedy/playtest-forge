import * as THREE from 'three';
import type GUI from 'lil-gui';
import { createColorField } from '../../../src/render';
import { boxCollider } from './collision';
import type { Realm } from './russetvale';
import { Bucket, PAL, rockSlab, stairFlight, ruinArch, stoneBlock, trs, kilnBowl, hangingRoot, rng } from './russetKit';
import { waterSpots, type createWater } from './chem/water';
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
  const tun = { fillRate: 0.22, drainRate: 0.16, warningTime: 1, rise: 6, latchTime: 2 };
  let fill = 0, warning = 0, seal = 0, retained = false, arrived = false, open = false;
  const saveKey = 'fox-spirit:ashwater:bell';
  let restored = false;
  try { if (new URLSearchParams(location.search).has('fresh')) localStorage.removeItem(saveKey); restored = localStorage.getItem(saveKey) === '1'; } catch { /* unsaved play */ }
  if (restored) fill = seal = 1;
  function shelf(x: number, y: number, z: number, w: number, d: number, seed: number) {
    rockSlab(rock, { x, z, top: y, bottom: y - 6, w, d, seed, rough: 0.45, topColor: PAL.stone, overhang: 0.5 });
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
  shelf(150,38,-96,18,24,951);
  bridge([154,38,-102],[160,38,-108],3.4,952);
  bridge([160,38,-108],[174,30,-130],3.4,957);
  shelf(184,30,-118,46,32,953);
  shelf(204,36,-118,18,19,954);
  shelf(214,36,-142,14,12,955);
  bridge([205,36,-127],[214,36,-139],3.5,956);
  ruinArch(stone,207,36,-119,0,{span:4.5,pillarH:6.5,seed:960,broken:.3});
  ruinArch(stone,216,36,-143,.2,{span:3,pillarH:3.2,seed:961,broken:.5});
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
  const waterMat=new THREE.MeshPhysicalMaterial({color:0x8a6441,roughness:.3,metalness:.2,transparent:true,opacity:.6});
  const pool=new THREE.Mesh(new THREE.PlaneGeometry(11,9),waterMat); pool.rotation.x=-Math.PI/2; pool.position.set(187,29.8,-118); group.add(pool);
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
  for(const m of nature.build(group)){field.patchMaterial(m);mats.push(m);}
  let water: ReturnType<typeof createWater>;
  function restoreSource(duration=3){const w=water.waters.find(w=>w.spot.id===source);if(w)w.reactor.restored=true;if(!field.restores.length)field.restore(new THREE.Vector3(190,30,-118),55,duration);}
  return {
    contains:(p:THREE.Vector3)=>p.x>138,
    supplyAt:(p:THREE.Vector3)=>field.sample(p),
    init(renderer:THREE.WebGLRenderer){field.initMask(renderer);},
    attach(w:typeof water,gui:GUI){water=w;const f=gui.addFolder('Ashwater Reach');f.add(tun,'fillRate',.05,.5,.01);f.add(tun,'drainRate',.02,.5,.01);f.add(tun,'warningTime',.8,4,.1);f.add(tun,'latchTime',.5,5,.1);f.close();if(restored)restoreSource(.2);},
    sync(dt:number,base:ReturnType<typeof createColorField>){field.trail=[];field.strokes=[];field.update(dt);field.setFox(base.fox);field.trail=base.trail.map(t=>({...t}));field.strokes=base.strokes.map(t=>({...t}));field.renderMask(dt);for(const m of mats)field.syncMaterial(m);},
    update(dt:number,fox:THREE.Vector3,feetY:number,grounded:boolean,flood:boolean){
      open=flood;gate.enabled=!open;gateMesh.visible=!open;
      arrived=water.arriving(source);
      const occupied=grounded&&Math.abs(fox.x-187)<3.2&&Math.abs(fox.z+118)<3.6&&Math.abs(feetY-raftCol.top0)<.7;
      retained=false;
      if(restored){fill=1;seal=1;}
      else if(arrived){warning=tun.warningTime;fill=Math.min(1,fill+dt*tun.fillRate);}
      else if(warning>0)warning=Math.max(0,warning-dt);
      else if(occupied&&fill>0)retained=true;
      else fill=Math.max(0,fill-dt*tun.drainRate);
      if(!restored){seal=THREE.MathUtils.clamp(seal+(arrived&&fill>=.98?dt:-dt)/tun.latchTime,0,1);if(seal>=1){restored=true;restoreSource();try{localStorage.setItem(saveKey,'1');}catch{}}}
      raft.position.y=30+tun.rise*fill;raftCol.top0=raftCol.top1=raft.position.y;raftCol.bottom=raft.position.y-.5;
      pool.position.y=29.8+tun.rise*fill;
      waterMat.color.setHex(retained?0x69543a:0x8a6441);
    },
    state(){return {open,arrived,fill:Number(fill.toFixed(3)),raftHeight:Number(raft.position.y.toFixed(3)),warning:Number(warning.toFixed(2)),retained,seal:Number(seal.toFixed(3)),restored,source};},
  };
}
