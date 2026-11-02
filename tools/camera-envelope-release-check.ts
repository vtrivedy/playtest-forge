import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createCameraEnvelope } from '../games/fox-spirit/src/cameraEnvelope.hot';

// The desired lens is free below a ledge, but its straight release segment
// intersects that ledge. Both the free and obstructed exits must remain gradual.
for (const dt of [1 / 30, 1 / 60, 1 / 120]) for (const ledge of [false, true]) {
  const previous = new THREE.Vector3(0, 3, 3);
  const lens = new THREE.Vector3(0, 1, 3);
  const focus = new THREE.Vector3(0, .6, 0);
  const blocked = (x: number, y: number, z: number, r: number) => ledge
    && x + r > -.5 && x - r < .5 && z + r > 2.5 && z - r < 3.5
    && y + r > 1.5 && y - r < 2.6;
  const update = createCameraEnvelope({
    params: { minDistance: 1.5, distance: 2.45, clearance: .2, sideBias: 0 },
    previousLens: previous, surfaceAt: () => 0, lensBlocked: blocked,
    yaw: () => 0, sightFraction: () => 1,
  });
  update(focus, lens, dt, false);
  assert.ok(lens.distanceTo(previous) <= (ledge ? 16 : 12) * dt + 1e-5, `release snapped (ledge=${ledge})`);
  assert.ok(!blocked(lens.x, lens.y, lens.z, .2), 'release entered ledge');
  for (let i=1; i<=12; i++) {
    const p = previous.clone().lerp(lens, i / 12);
    assert.ok(!blocked(p.x, p.y, p.z, .2), 'release segment crossed ledge');
  }
  assert.ok(lens.y >= .16 && Math.hypot(lens.x, lens.z) >= 1.5, 'release lost floor/body room');
}
console.log('camera envelope: free release and obstructed release remain gradual');

// A raised strip just beyond the previous lens blocks a downward release. The
// camera must climb continuously over it and recover, rather than hold forever.
for (const dt of [1 / 30, 1 / 60, 1 / 120]) {
  const previous = new THREE.Vector3(0, 3, 8);
  const goal = new THREE.Vector3(0, 1.6, 2.45);
  const lens = goal.clone(), focus = new THREE.Vector3(0, .6, 0);
  const floor = (_x: number, z: number) => z > 6.8 && z < 7.9 ? 3.15 : 0;
  const update = createCameraEnvelope({
    params: { minDistance: 1.8, distance: 2.45, clearance: .35, sideBias: 0 },
    previousLens: previous, surfaceAt: floor, lensBlocked: () => false,
    yaw: () => 0, sightFraction: () => 1,
  });
  for (let i=0; i<Math.ceil(2/dt); i++) {
    lens.copy(goal);update(focus,lens,dt,false);
    assert.ok(lens.distanceTo(previous)<=16*dt+1e-5,'ridge recovery snapped');
    assert.ok(lens.y>=floor(lens.x,lens.z)+.28-1e-5,'ridge recovery entered terrain');
    previous.copy(lens);
  }
  assert.ok(lens.distanceTo(goal)<.1,'camera stayed stranded behind the terrain ridge');
}
console.log('camera envelope: terrain-ridge release recovers continuously at30/60/120Hz');

// The last clear pose can be closer than the preferred standoff to a post.
// Recovery needs a local detour; only sampling around the fox leaves it stuck.
for (const dt of [1 / 30, 1 / 60, 1 / 120]) {
  const previous=new THREE.Vector3(0,3,8),goal=new THREE.Vector3(0,1.6,2.45);
  const lens=goal.clone(),focus=new THREE.Vector3(0,.6,0);
  const blocked=(x:number,_y:number,z:number,r:number)=>Math.hypot(x,z-7.3)<.4+r;
  const update=createCameraEnvelope({params:{minDistance:1.8,distance:2.45,clearance:.35,sideBias:0},previousLens:previous,surfaceAt:()=>0,lensBlocked:blocked,yaw:()=>0,sightFraction:(from,to)=>{
    // Visibility ray against the same post, as the live camera's proxy raycast does.
    const dx=to.x-from.x,dz=to.z-from.z,fx=from.x,fz=from.z-7.3;
    const a=dx*dx+dz*dz,b=2*(fx*dx+fz*dz),c=fx*fx+fz*fz-.4*.4;
    const disc=b*b-4*a*c;if(disc<0||a===0)return 1;
    const hit=(-b-Math.sqrt(disc))/(2*a);return hit>0&&hit<1?hit:1;
  }});
  for(let i=0;i<Math.ceil(2/dt);i++){
    lens.copy(goal);update(focus,lens,dt,false);
    assert.ok(lens.distanceTo(previous)<=16*dt+1e-5,'local post recovery snapped');
    assert.ok(!blocked(lens.x,lens.y,lens.z,.2),'local post recovery entered post');
    previous.copy(lens);
  }
  assert.ok(lens.distanceTo(goal)<.1,'camera stayed stranded behind the nearby post');
}
console.log('camera envelope: local post detour recovers continuously at30/60/120Hz');
