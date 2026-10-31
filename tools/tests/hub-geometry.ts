import * as THREE from 'three';
import { createLanternhollow, HUB_HOUSES, HUB_PATHS } from '../../games/fox-spirit/src/regionLanternhollow.ts';
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
try {
  createLanternhollow(group, col, () => 0, b, []);
} finally {
  if (originalDocument === undefined) Reflect.deleteProperty(globalThis, 'document');
  else globalThis.document = originalDocument;
}
const spriteHits: THREE.Intersection[] = [];
const probe = new THREE.Raycaster();
let smokeProbes = 0;
group.traverse(o => { if ((o as THREE.Sprite).isSprite) { o.raycast(probe, spriteHits); smokeProbes++; } });
if(smokeProbes !== 8 || spriteHits.length) throw Error('Decorative smoke entered camera-free blocker probes');
let maxError=0;
for (const house of HUB_HOUSES) {
  const roofs=col.colliders.filter(c=>c.tag==='hub-roof' && Math.abs(c.x-house.x)<.01);
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
    for(const c of col.colliders)if(['hub-cottage','hub-bench','hub-well','hub-pulley-post','hub-woodpile'].includes(c.tag ?? '') && colliderTopAt(c,x,z,.4)!==null)throw Error(`Path clips hub collider at ${x},${z}`);
  }
}
console.log(JSON.stringify({arrivalRouteSweepSamples:routeSweeps,smokeCameraFreeProbes:smokeProbes,pathSegmentsClear:HUB_PATHS.length,roofStrips:36,maxMeshColliderError:maxError,routePointsClear:8,colliders:col.colliders.length,vertices:Object.values(b).reduce((n,k)=>n+k.vertexCount,0)},null,2));
