/** Pure CPU animation/IK diagnostic; visual acceptance still requires GPU playback. */
import fs from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { AuthoredLocomotion } from '../games/fox-spirit/src/locomotion';
import { applyFoxLimbRig } from '../games/fox-spirit/src/foxLimbRig';
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
applyFoxLimbRig(root, gltf.animations);
const loco=new AuthoredLocomotion(root,group,actions);

for(let i=0;i<120;i++){loco.input={speed:0,grounded:true,yaw:0,verticalSpeed:0,groundAt:()=>0};loco.beforeMixer();loco.blend(1/60,'idle');mixer.update(1/60);loco.afterMixer(1/60,'idle');}
for(const f of (loco as any).feet) console.log('PAD',f.paw.name,f.paw.getWorldPosition(new THREE.Vector3()).toArray(),f.paw.localToWorld(f.padLocal.clone()).toArray(),f.anchor.toArray(),f.padLocal.toArray());
root.updateMatrixWorld(true);
root.traverse(o=>{
 const mesh=o as THREE.SkinnedMesh;if(!mesh.isSkinnedMesh)return;mesh.skeleton.update();
 const si=mesh.geometry.getAttribute('skinIndex'),sw=mesh.geometry.getAttribute('skinWeight');
 for(const name of ['front_paw_l','front_paw_r','hind_paw_l','hind_paw_r']){
  const bi=mesh.skeleton.bones.findIndex(b=>b.name===name);let min=Infinity;let info:any=null;
  for(let i=0;i<si.count;i++) {let w=0;for(let j=0;j<4;j++)if(si.getComponent(i,j)===bi)w+=sw.getComponent(i,j);if(w<.65)continue;const p=mesh.localToWorld(mesh.getVertexPosition(i,new THREE.Vector3()));if(p.y<min){min=p.y;info={w,index:i,p:p.toArray()}};}
  if(info)console.log('MESH',mesh.name,name,info);
 }
});
