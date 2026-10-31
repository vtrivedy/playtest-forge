/** CPU encounter integration check. Loads the real CC0 GLB; never starts a browser or renderer. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { createShades } from '../games/fox-spirit/src/encounters/shades';

const originalFetch = globalThis.fetch;
THREE.DefaultLoadingManager.setURLModifier(url => url.startsWith('/assets/') ? `http://shade.test${url}` : url);
globalThis.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (url.startsWith('http://shade.test/assets/')) return new Response(await readFile(new URL(url).pathname.slice(1))); 
  return originalFetch(input, init);
};
Object.defineProperty(globalThis, 'ProgressEvent', { value: class extends Event {
  constructor(type: string, options: object) { super(type); Object.assign(this, options); }
} });

try {
  const scene = new THREE.Scene();
  const sys = await createShades(scene, [{ id: 'test', patrol: [[0,0,0],[4,0,0],[4,0,4],[0,0,4]] }], () => 0);
  let t = 0;
  const step = (seconds: number, fox: THREE.Vector3, dash = false) => {
    const events = [];
    for (let k = 0; k < Math.round(seconds * 60); k++) { t += 1/60; events.push(...sys.update(1/60, t, fox, dash)); }
    return events;
  };
  const state = () => sys.state()[0]!;
  step(3, new THREE.Vector3(30,0,30));
  assert.equal(state().mode, 'patrol');
  const patrolPos = new THREE.Vector3().fromArray(state().pos);
  const near = patrolPos.clone().add(new THREE.Vector3(2.8,0,0));
  step(1.5, near);
  assert.equal(state().mode, 'chase');
  const approachEvents = step(6, near);
  assert.equal(approachEvents.filter(e => e.type === 'hit').length, 0, 'attraction must stop outside contact');
  assert.equal(state().mode, 'chase', 'near stationary warmth should hold attention');
  assert.ok(Math.hypot(state().pos[0]!-near.x,state().pos[2]!-near.z)<=2, 'attracted animal must remain close');
  assert.ok(Math.hypot(state().pos[0]!-near.x,state().pos[2]!-near.z)>=sys.tun.hitRadius+.6, 'stationary fox keeps contact clearance');
  step(1/60, new THREE.Vector3(30,0,30));
  assert.equal(state().mode, 'return');
  for(let k=0;k<480&&state().mode!=='patrol';k++)step(1/60,new THREE.Vector3(30,0,30));
  assert.equal(state().mode, 'patrol', 'must reach fixed return target');
  assert.ok(Math.abs(state().attractionRest-sys.tun.chaseRest)<.02,'successful return starts full authored rest');
  for(let k=0;k<Math.floor((sys.tun.chaseRest+sys.tun.chaseDelay-.05)*60);k++){
    const waiting=new THREE.Vector3().fromArray(state().pos).add(new THREE.Vector3(2.8,0,0));
    step(1/60,waiting);
    assert.equal(state().mode,'patrol','successful return requires rest plus fresh notice delay');
  }
  for(let k=0;k<12;k++)step(1/60,new THREE.Vector3().fromArray(state().pos).add(new THREE.Vector3(2.8,0,0)));
  assert.equal(state().mode,'chase','successful-return attraction resumes after fresh notice');
  step(8,new THREE.Vector3(30,0,30));
  sys.resetSweep();
  const target = new THREE.Vector3().fromArray(state().pos);
  assert.equal(sys.drains(target), true);
  const events = step(1/60, target, true);
  assert.equal(events.filter(e => e.type === 'freed').length, 1);
  assert.equal(sys.drains(target), false);
  assert.equal(state().mode, 'released');
  step(1.5, new THREE.Vector3(30,0,30));
  assert.equal(state().presence, 0);
  assert.equal(state().smokeParticles, 144, 'motes outlive body');
  step(10, new THREE.Vector3(30,0,30));
  assert.equal(state().smokeParticles, 0);
  assert.equal(state().leaves, 0);
  const leaves = scene.children.find(o => (o as THREE.InstancedMesh).isInstancedMesh) as THREE.InstancedMesh;
  const completedVersion = leaves.instanceMatrix.version;
  const completedColorVersion = leaves.instanceColor!.version;
  step(2, new THREE.Vector3(30,0,30));
  assert.equal(leaves.instanceMatrix.version, completedVersion, 'completed leaves must stop uploading transforms');
  assert.equal(leaves.instanceColor!.version, completedColorVersion, 'completed leaves must stop uploading colors');
  // Authored route heights can differ from sampled terrain; return arrival is horizontal.
  const sloped = await createShades(new THREE.Scene(), [{ id:'slope', patrol:[[0,0,0],[4,0,0],[4,0,4],[0,0,4]] }], () => .5);
  for(let k=0;k<180;k++) sloped.update(1/60,k/60,new THREE.Vector3(30,0,30),false);
  const nearSlope=new THREE.Vector3().fromArray(sloped.state()[0]!.pos).add(new THREE.Vector3(2.8,0,0));
  for(let k=0;k<90;k++) sloped.update(1/60,3+k/60,nearSlope,false);
  assert.equal(sloped.state()[0]!.mode,'chase');
  for(let k=0;k<480;k++) sloped.update(1/60,5+k/60,new THREE.Vector3(30,0,30),false);
  assert.equal(sloped.state()[0]!.mode,'patrol','height mismatch must not trap return');
  let wall=true;
  const obstructed=await createShades(new THREE.Scene(),[{id:'wall',patrol:[[0,0,0],[4,0,0],[4,0,4],[0,0,4]]}],()=>0,undefined,()=>wall);
  for(let k=0;k<180;k++) obstructed.update(1/60,k/60,new THREE.Vector3(30,0,30),false);
  assert.equal(obstructed.state()[0]!.mode,'patrol','blocked patrol must keep its route target moving');
  assert.deepEqual(obstructed.state()[0]!.pos,[0,0,0],'wall must prevent displacement');
  wall=false;
  for(let k=0;k<180;k++) obstructed.update(1/60,3+k/60,new THREE.Vector3(30,0,30),false);
  assert.ok(new THREE.Vector3().fromArray(obstructed.state()[0]!.pos).length()>1,'patrol must recover when obstacle clears');
  // Activation and off-route release use the same contact rules as the initial patrol.
  const gated = await createShades(new THREE.Scene(), [{id:'gated',afterLatch:'SW1',patrol:[[0,0,0],[4,0,0],[4,0,4],[0,0,4]]}],()=>0);
  gated.update(1/60,0,new THREE.Vector3(0,0,0),true);
  assert.equal(gated.state().length,0,'unlatched actors must stay inactive');
  assert.equal(gated.drains(new THREE.Vector3(0,0,0)),false);
  gated.activateAfterLatch('SW2');
  assert.equal(gated.state().length,0,'unrelated latch cannot activate actor');
  gated.activateAfterLatch('SW1');
  assert.equal(gated.state().length,1);
  const observer=new THREE.Vector3(2.8,0,0);
  for(let k=0;k<100;k++) gated.update(1/60,k/60,observer,false);
  assert.equal(gated.state()[0]!.mode,'chase');
  gated.resetSweep();
  const pursuing=new THREE.Vector3().fromArray(gated.state()[0]!.pos);
  const release=gated.update(1/60,2,pursuing,true);
  assert.equal(release.filter(e=>e.type==='freed').length,1,'dash must release during chase');
  assert.equal(gated.state()[0]!.mode,'released');
  assert.equal(gated.drains(pursuing),false);

  let chaseWall=false;
  const recovery=await createShades(new THREE.Scene(),[{id:'recovery',patrol:[[0,0,0],[4,0,0],[4,0,4],[0,0,4]]}],()=>0,undefined,()=>chaseWall);
  for(let k=0;k<100;k++)recovery.update(1/60,k/60,observer,false);
  assert.equal(recovery.state()[0]!.mode,'chase');
  chaseWall=true;
  recovery.update(1/60,2,observer,false);
  assert.equal(recovery.state()[0]!.mode,'return','blocked attraction must retreat');
  // Keep observer far so a resumed patrol cannot attract again during the recovery proof.
  let recovered=false;
  for(let k=0;k<120;k++){
    recovery.update(1/60,2+k/60,new THREE.Vector3(30,0,30),false);
    if(recovery.state()[0]!.mode==='patrol'){recovered=true;break;}
  }
  assert.equal(recovered,true,'blocked return must resume patrol after its timeout');
  const restSeconds=recovery.state()[0]!.attractionRest;
  assert.ok(Math.abs(restSeconds-recovery.tun.chaseRest)<.02,'blocked return starts full authored rest');
  chaseWall=false;
  for(let k=0;k<Math.floor((recovery.tun.chaseRest+recovery.tun.chaseDelay-.05)*60);k++){
    const nearby=new THREE.Vector3().fromArray(recovery.state()[0]!.pos).add(new THREE.Vector3(2.8,0,0));
    recovery.update(1/60,4+k/60,nearby,false);
    assert.equal(recovery.state()[0]!.mode,'patrol','blocked return requires rest plus fresh notice delay');
  }
  for(let k=0;k<12;k++){
    const nearby=new THREE.Vector3().fromArray(recovery.state()[0]!.pos).add(new THREE.Vector3(2.8,0,0));
    recovery.update(1/60,7+k/60,nearby,false);
  }
  assert.equal(recovery.state()[0]!.mode,'chase','attraction resumes after rest plus notice delay');

  // A real local obstruction on the way home must produce a detour, not a mode-only reset.
  let detourWall:THREE.Vector3|null=null;
  const detour=await createShades(new THREE.Scene(),[{id:'detour',patrol:[[0,0,0],[4,0,0],[4,0,4],[0,0,4]]}],()=>0,undefined,(x,z)=>detourWall!==null&&Math.hypot(x-detourWall.x,z-detourWall.z)<.16);
  let departure:THREE.Vector3|null=null;
  const lure=new THREE.Vector3(0,0,2.8);
  for(let k=0;k<240;k++){
    detour.update(1/60,k/60,lure,false);
    if(detour.state()[0]!.mode==='chase'){departure=new THREE.Vector3().fromArray(detour.state()[0]!.pos);break;}
  }
  assert.ok(departure,'detour fixture must enter pursuit');
  for(let k=0;k<50;k++)detour.update(1/60,4+k/60,lure,false);
  const away=new THREE.Vector3().fromArray(detour.state()[0]!.pos);
  assert.ok(away.distanceTo(departure!)>.4,'detour fixture needs a real off-route excursion');
  detourWall=away.clone().lerp(departure!,.5);
  let arrived=false;
  for(let k=0;k<600;k++){
    detour.update(1/60,5+k/60,new THREE.Vector3(30,0,30),false);
    if(detour.state()[0]!.mode==='patrol'){
      arrived=new THREE.Vector3().fromArray(detour.state()[0]!.pos).distanceTo(departure!)<.45;
      break;
    }
  }
  assert.equal(arrived,true,'detour must reach the route, not just time out into patrol');
  const patrolDetour=await createShades(new THREE.Scene(),[{id:'patrol-detour',patrol:[[0,0,0],[4,0,0],[4,0,4],[0,0,4]]}],()=>0,undefined,(x,z)=>Math.hypot(x-1,z+.35)<.4);
  for(let k=0;k<180;k++)patrolDetour.update(1/60,k/60,new THREE.Vector3(30,0,30),false);
  assert.ok(patrolDetour.state()[0]!.pos[0]!>1.5,'patrol must move beyond a post instead of freezing off-route');
  const sweepFixture=async(id:string,from:THREE.Vector3,to:THREE.Vector3)=>{
    const system=await createShades(new THREE.Scene(),[{id,patrol:[[0,0,0],[4,0,0],[4,0,4],[0,0,4]]}],()=>0);
    system.tun.speed=0;
    system.update(1/60,0,from,false);
    return system.update(1/60,1/60,to,true);
  };
  const grazing=await sweepFixture('air-graze',new THREE.Vector3(-.2,3,1.59),new THREE.Vector3(.1,3.15,1.59));
  assert.equal(grazing.filter(e=>e.type==='freed').length,1,'rising grazing dash must enter the cylindrical animal volume');
  const rising=await sweepFixture('air-rise',new THREE.Vector3(-3,0,0),new THREE.Vector3(3,6,0));
  assert.equal(rising.filter(e=>e.type==='freed').length,1,'crossing the volume counts even when final feet rise above its cap');
  const above=await sweepFixture('air-above',new THREE.Vector3(-3,4,0),new THREE.Vector3(3,4,0));
  assert.equal(above.length,0,'a dash entirely above the animal must not release it');
  // Mirror the capture's ten-second observer schedule on a controlled loop.
  // Actual authored terrain still belongs to the remote GPU playtest.
  const behavior=await createShades(new THREE.Scene(),[{id:'behavior',patrol:[[0,0,0],[4,0,0],[4,0,4],[0,0,4]]}],()=>0);
  const modes:string[]=[];
  const stagedFox=new THREE.Vector3(20,0,20);
  for(let frame=0;frame<600;frame++){
    if(frame%15===0){
      const actor=behavior.state()[0]!;
      if(modes.at(-1)!==actor.mode)modes.push(actor.mode);
      stagedFox.fromArray(actor.pos).add(new THREE.Vector3(frame>=90&&frame<300?2.9:4.8,0,0));
    }
    const events=behavior.update(1/60,frame/60,stagedFox,false);
    assert.equal(events.length,0,'staged observer must stay outside contact');
  }
  const expectedModes=['patrol','chase','return','patrol'];
  let observedModes=0;
  for(const mode of modes)if(mode===expectedModes[observedModes])observedModes++;
  assert.equal(observedModes,expectedModes.length,`capture observer schedule must show complete cycle: ${modes}`);
  console.log(JSON.stringify({ result: 'PASS', checks: ['real GLB load', 'patrol', 'delayed chase', 'attraction stops outside contact', 'return completes', 'dash frees once', 'drain ends', 'motes outlive body', 'one-shots end', 'completed leaves stop uploads', 'terrain-height mismatch return', 'blocked patrol recovery', 'latch activation', 'dash during chase', 'blocked chase retreats', 'return stall recovery', 'quiet patrol after return', 'return detours around obstruction', 'patrol detours around obstruction', 'rising grazing dash cylinder hit', 'sweep crosses vertical slab', 'dash above animal misses', 'ten-second ordered observer cycle'], final: state() }, null, 2));
} finally { globalThis.fetch = originalFetch; THREE.DefaultLoadingManager.setURLModifier(url => url); }
