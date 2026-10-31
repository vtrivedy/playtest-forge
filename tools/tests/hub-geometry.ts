import * as THREE from 'three';
import assert from 'node:assert/strict';
import { createLanternhollow, HUB_HOUSES, HUB_PATHS, HUB_FESTOON_POSTS, hubPathDistance } from '../../games/fox-spirit/src/regionLanternhollow.ts';
import { outlineR, MEADOW_TREES } from '../../games/fox-spirit/src/russetvale.ts';
import { Bucket } from '../../games/fox-spirit/src/russetKit.ts';
import { CollisionWorld, colliderTopAt } from '../../games/fox-spirit/src/collision.ts';
// CPU geometry only. Canvas drawing is stubbed; no renderer/browser is created.
const originalDocument = globalThis.document;
globalThis.document = { createElement: () => ({
  width: 512, height: 96,
  getContext: () => ({ fillRect() {}, fillText() {},
    createRadialGradient: () => ({ addColorStop() {} }),
  }),
}) } as unknown as Document;
const b = {stone:new Bucket(),wood:new Bucket(),plaster:new Bucket(),roof:new Bucket(),lamp:new Bucket(),dark:new Bucket()};
const col = new CollisionWorld(()=>0), group = new THREE.Group();
let hub!: ReturnType<typeof createLanternhollow>;
try {
  hub = createLanternhollow(group, col, () => 0, b, [], { wood: new THREE.MeshStandardMaterial(), roof: new THREE.MeshStandardMaterial(), lamp: new THREE.MeshStandardMaterial(), dark: new THREE.MeshStandardMaterial() });
} finally {
  if (originalDocument === undefined) Reflect.deleteProperty(globalThis, 'document');
  else globalThis.document = originalDocument;
}
// Practical lights stay allocated while the spatial mood fades their intensity.
const practicals = group.children.filter((o): o is THREE.PointLight => (o as THREE.PointLight).isPointLight);
assert.equal(practicals.length, 3);
hub.update(1, 1);
assert.ok(hub.state().well > 0 && hub.state().porch > 0);
assert.equal(hub.state().well, practicals[0].intensity);
assert.equal(hub.state().porch, practicals[1].intensity);
assert.equal(hub.state().plaza, practicals[2].intensity);
hub.update(2, 0);
assert.equal(hub.state().well, 0);
assert.equal(hub.state().porch, 0);
assert.equal(hub.state().plaza, 0);
for (const [x,z] of HUB_FESTOON_POSTS) assert.ok(hubPathDistance(x,z) >= 2.3, `Festoon post crowds path: ${x},${z}`);
for (const p of hub.festoon.pendants) assert.ok(p.bottom >= p.ground + 3, 'Pendant must clear jumping fox');
assert.ok(practicals.every(light => light.visible), 'fading must not change shader light count');
const spriteHits: THREE.Intersection[] = [];
const probe = new THREE.Raycaster();
let smokeProbes = 0;
group.traverse(o => { if ((o as THREE.Sprite).isSprite) { o.raycast(probe, spriteHits); smokeProbes++; } });
if(smokeProbes !== 8 || spriteHits.length) throw Error('Decorative smoke entered camera-free blocker probes');
for (const path of HUB_PATHS.filter(p => p[1] >= 100 || p[3] >= 100)) {
  for (const [x,z] of [[path[0],path[1]],[path[2],path[3]]]) {
    assert.ok(outlineR(Math.atan2(z,x))-Math.hypot(x,z) >= 4.5, `Arrival lane crowds cliff: ${x},${z}`);
  }
}
let maxError=0;
for (const house of HUB_HOUSES) {
  for (const [x,z] of MEADOW_TREES) {
    assert.ok(Math.abs(x-house.x) > house.w/2+.8 || Math.abs(z-house.z) > house.d/2+.8, `Fixed tree overlaps cottage roof: ${x},${z}`);
  }
  // The jagged island edge is tighter than its nominal ellipse at the south-west.
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = house.x + sx * (house.w / 2 + .6), z = house.z + sz * (house.d / 2 + .6);
    assert.ok(outlineR(Math.atan2(z, x)) - Math.hypot(x, z) >= 2, `Cottage roof crowds cliff at ${x},${z}`);
  }
  // Pond transition ends at ellipse1.5. Include the rear winter-store footprint.
  const pileX = house.x + house.w / 2 + .35, pileZ = house.z - house.d / 2 - .7;
  for (const [cx,cz,w,d] of [[house.x,house.z,house.w,house.d],[pileX,pileZ,.8,.72]]) {
    for (const sx of [-1,1]) for (const sz of [-1,1]) {
      const x = cx + sx*w/2, z = cz + sz*d/2;
      assert.ok(((x+18)/15)**2+((z-70)/9)**2 >= 1.5, `Cottage/store sinks into pond at ${x},${z}`);
    }
  }
  const roofs=col.colliders.filter(c=>c.tag==='hub-roof' && Math.abs(c.x-house.x)<.01 && Math.abs(c.z-house.z)<house.d/2+.47);
  if(roofs.length!==12)throw Error('Missing roof strips');
  for(const c of roofs)for(const end of [-1,1]){
    const z=c.z+end*c.hz,y=colliderTopAt(c,c.x,z,1e-8)!;
    let closest=Infinity;
    for(let i=0;i<b.roof.pos.length;i+=3){
      const x0=b.roof.pos[i], y0=b.roof.pos[i+1], z0=b.roof.pos[i+2];
      if(Math.abs(z0-z)<1e-5 && Math.abs(Math.abs(x0-house.x)-(house.w/2+.45))<1e-5)closest=Math.min(closest,Math.abs(y0-y));
    }
    if(closest>1e-5)throw Error(`Roof mismatch ${house.x},${z}: ${closest}`);
    maxError=Math.max(maxError,closest);
  }
}
for(const [x,z] of [[0,90],[0,88],[0,80],[4.5,74.2],[13,75.5],[21,64],[-10,64],[-34,56]]){
  for(const c of col.colliders) if(colliderTopAt(c,x,z,.55)!==null)throw Error(`Hub blocks route ${x},${z}: ${c.tag}`);
}
// Sweep the full authored meadow approach, not only its waypoint endpoints.
const arrivalRoute = [[0,90],[0,80],[4.5,74.2],[13,75.5],[21,64],[-10,64],[-34,56]];
let routeSweeps=0;
for(let k=0;k<arrivalRoute.length-1;k++) {
  const [ax,az]=arrivalRoute[k], [bx,bz]=arrivalRoute[k+1];
  const steps=Math.ceil(Math.hypot(bx-ax,bz-az)*10);
  for(let i=0;i<=steps;i++) {
    const x=ax+(bx-ax)*i/steps,z=az+(bz-az)*i/steps;
    for(const c of col.colliders) if(colliderTopAt(c,x,z,.55)!==null)throw Error(`Arrival route blocked by ${c.tag} at ${x},${z}`);
    routeSweeps++;
  }
}
for(const [ax,az,bx,bz] of HUB_PATHS) {
  const steps=Math.ceil(Math.hypot(bx-ax,bz-az)*10);
  for(let i=0;i<=steps;i++){
    const x=ax+(bx-ax)*i/steps,z=az+(bz-az)*i/steps;
    for(const c of col.colliders)if(['hub-cottage','hub-bench','hub-well','hub-pulley-post','hub-woodpile','hub-festoon-post','hub-market'].includes(c.tag ?? '') && colliderTopAt(c,x,z,.4)!==null)throw Error(`Path clips ${c.tag} at ${x},${z}`);
  }
}
console.log(JSON.stringify({arrivalRouteSweepSamples:routeSweeps,smokeCameraFreeProbes:smokeProbes,pathSegmentsClear:HUB_PATHS.length,roofStrips:HUB_HOUSES.length*12,maxMeshColliderError:maxError,routePointsClear:8,colliders:col.colliders.length,vertices:Object.values(b).reduce((n,k)=>n+k.vertexCount,0)},null,2));
