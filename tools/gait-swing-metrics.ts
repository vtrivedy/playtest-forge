/** Pure CPU animation/IK diagnostic; visual acceptance still requires GPU playback. */
import fs from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { AuthoredLocomotion } from '../games/fox-spirit/src/locomotion';
Object.assign(globalThis,{self:globalThis,ProgressEvent:class extends Event {constructor(type:string,init:Record<string,unknown>){super(type);Object.assign(this,init);}}});
const bytes=fs.readFileSync('assets/hero/spirit_fox.glb');
const jsonLength=bytes.readUInt32LE(12);
const doc=JSON.parse(bytes.subarray(20,20+jsonLength).toString());
const bin=bytes.subarray(28+jsonLength);
doc.buffers[0].uri=`data:application/octet-stream;base64,${bin.toString('base64')}`;
delete doc.images;delete doc.textures;delete doc.samplers;delete doc.materials;
for(const mesh of doc.meshes)for(const primitive of mesh.primitives)delete primitive.material;
const gltf=await new GLTFLoader().parseAsync(JSON.stringify(doc),'');
const root=gltf.scene;const group=new THREE.Group();group.add(root);
const box=new THREE.Box3().setFromObject(root);root.scale.setScalar(1.25/(box.max.y-box.min.y));
const scaled=new THREE.Box3().setFromObject(root);root.position.y-=scaled.min.y;
const center=scaled.getCenter(new THREE.Vector3());root.position.x-=center.x;root.position.z-=center.z;
const mixer=new THREE.AnimationMixer(root);const actions=new Map(gltf.animations.map(c=>[c.name,mixer.clipAction(c)]));
const loco=new AuthoredLocomotion(root,group,actions);

const names=['front_paw_l','front_paw_r','hind_paw_l','hind_paw_r'];
const paws=names.map(n=>root.getObjectByName(n)!);
const clearance=paws.map(p=>p.getWorldPosition(new THREE.Vector3()).y);
const all:number[]=[];const grounded:number[]=[];let prev:THREE.Vector3[]=[];
for(let i=0;i<600;i++) {
 group.position.z+=9/60;group.updateMatrixWorld(true);
 loco.input={speed:9,grounded:true,yaw:0,verticalSpeed:0,groundAt:()=>0};
 loco.beforeMixer();loco.blend(1/60,'run');mixer.update(1/60);loco.afterMixer(1/60,'run');
 const now=paws.map(p=>p.getWorldPosition(new THREE.Vector3()));
 if(i>300)for(let j=0;j<4;j++) {
  const speed=Math.hypot(now[j].x-prev[j].x,now[j].z-prev[j].z)*60;
  all.push(speed);
  if(Math.abs(now[j].y-clearance[j])<=.03 && Math.abs(prev[j].y-clearance[j])<=.03)grounded.push(speed);
 }
 prev=now;
}
const stats=(a:number[])=>{a.sort((x,y)=>x-y);return{n:a.length,median:a[Math.floor(a.length*.5)],p95:a[Math.floor(a.length*.95)],max:a[a.length-1]}};
console.log(JSON.stringify({nearFloor:stats(grounded),all:stats(all)}));
