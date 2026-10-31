/** CPU-only real-asset cutout audit; no browser, textures, WebGL or rendering.
 * npx tsx tools/occlusion-mesh-audit.ts > audit.json
 * Compare posed paw-vertex coverage with the unchanged legacy ellipse at full
 * foreground depth/strength. This is a regression metric, not visual approval.
 */
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { createOcclusionFader } from '../games/fox-spirit/src/occlusion';
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
for(const [name,act] of actions){const once=/^(jump_up|jump_fall|land|burst|skid)$/.test(name);act.setLoop(once?THREE.LoopOnce:THREE.LoopRepeat,once?1:Infinity);act.clampWhenFinished=once;}
const loco=new AuthoredLocomotion(root,group,actions);


const meshes:THREE.SkinnedMesh[]=[];
root.traverse(o=>{if((o as THREE.SkinnedMesh).isSkinnedMesh && !/glow|flame|spiritfx/i.test(o.name))meshes.push(o as THREE.SkinnedMesh)});
root.updateMatrixWorld(true);

const pawVertices:{mesh:THREE.SkinnedMesh,index:number,paw:string}[]=[];
for(const name of ['front_paw_l','front_paw_r','hind_paw_l','hind_paw_r']) {
 const bone=root.getObjectByName(name)!;
 for(const mesh of meshes) {
  const bi=mesh.skeleton.bones.indexOf(bone as THREE.Bone),ix=mesh.geometry.getAttribute('skinIndex'),wt=mesh.geometry.getAttribute('skinWeight');
  if(bi<0)continue;
  for(let i=0;i<ix.count;i++){let w=0;for(let j=0;j<4;j++)if(ix.getComponent(i,j)===bi)w+=wt.getComponent(i,j);if(w>=.65)pawVertices.push({mesh,index:i,paw:name});}
 }
}
if(!pawVertices.length)throw Error('No core-mesh paw vertices');
const scene=new THREE.Scene();scene.add(group);const mat=new THREE.MeshStandardMaterial();scene.add(new THREE.Mesh(new THREE.BoxGeometry(),mat));
const fader=createOcclusionFader(scene,{solidAt:()=>-Infinity,exclude:group});
const shader={vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader,uniforms:{}} as Parameters<typeof mat.onBeforeCompile>[0];
mat.onBeforeCompile(shader,{} as THREE.WebGLRenderer);
const rows:any[]=[];const extents:any[]=[];const publicPads=Array.from({length:4},()=>new THREE.Vector3());
for(const [anim,speed,grounded,verticalSpeed] of [['idle',0,true,0],['walk',1.62,true,0],['trot',3.6,true,0],['run',9,true,0],['glide',8,false,-2.7],['jump_up',4,false,5],['jump_fall',4,false,-5]] as const) {
 loco.reset();group.position.set(0,.02,0);group.rotation.y=0;
 const bounds={minX:Infinity,maxX:-Infinity,minY:Infinity,maxY:-Infinity,minZ:Infinity,maxZ:-Infinity};
 const stats=new Map<string,any>();
 for(let frame=0;frame<120;frame++) {
  group.position.z+=speed/60;group.updateMatrixWorld(true);
  loco.input={speed,grounded,yaw:0,verticalSpeed,groundAt:()=>0};
  loco.beforeMixer();loco.blend(1/60,anim as any);mixer.update(1/60);loco.afterMixer(1/60,anim as any);root.updateMatrixWorld(true);for(const mesh of meshes)mesh.skeleton.update();
  if(grounded && frame<60)continue;
  const vertices=pawVertices.map(p=>({p:p.mesh.localToWorld(p.mesh.getVertexPosition(p.index,new THREE.Vector3())),paw:p.paw}));
  for(const {p} of vertices){bounds.minX=Math.min(bounds.minX,p.x-group.position.x);bounds.maxX=Math.max(bounds.maxX,p.x-group.position.x);bounds.minY=Math.min(bounds.minY,p.y-group.position.y);bounds.maxY=Math.max(bounds.maxY,p.y-group.position.y);bounds.minZ=Math.min(bounds.minZ,p.z-group.position.z);bounds.maxZ=Math.max(bounds.maxZ,p.z-group.position.z);}
  loco.writeFootPoints(publicPads);
  for(const screenHeight of [720,1080]) for(const [name,dx,dy,dz,roll] of [['chase',2,1.2,3,0],['side',3,1,0,0],['low',2,-1.2,2,0],['high',2,5,2,0],['rolled',2,1.2,3,.3]] as const) {
   const feetPosition=group.position.clone().add(new THREE.Vector3(0,-.02,0));const cam=new THREE.PerspectiveCamera(54,16/9,.1,100);cam.position.copy(feetPosition).add(new THREE.Vector3(dx,dy,dz));cam.lookAt(feetPosition.clone().add(new THREE.Vector3(0,.6,0)));cam.rotateZ(roll);cam.updateMatrixWorld();
   const sizedRenderer={getDrawingBufferSize:(o:THREE.Vector2)=>o.set(screenHeight*16/9,screenHeight)} as THREE.WebGLRenderer;
   fader.update(1/60,cam,sizedRenderer,feetPosition,1.25,0,publicPads);
   const line=(shader.uniforms.uOccFox.value as THREE.Vector4).w+(shader.uniforms.uOccFootFade.value as number);
   const key=`${name}-${screenHeight}`;const st=stats.get(key)??{samples:0,below:0,minMargin:Infinity,minTrim:1,minLegacyCut:1,minCut:1,reduced:0,worst:null};
   for(const v of vertices){const p=v.p.clone().project(cam);if(p.z < -1 || p.z > 1)continue;const px=(p.x*.5+.5)*screenHeight*16/9,py=(p.y*.5+.5)*screenHeight,margin=py-line;
    const fox=shader.uniforms.uOccFox.value as THREE.Vector4,rad=shader.uniforms.uOccRad.value as THREE.Vector2,fade=shader.uniforms.uOccFootFade.value as number;
    const ellipseR=Math.hypot((px-fox.x)/rad.x,(py-fox.y)/rad.y);const legacy=1-THREE.MathUtils.smoothstep(ellipseR,.45,1);const trim=THREE.MathUtils.smoothstep(py,fox.w,fox.w+fade),cut=legacy*trim;st.minTrim=Math.min(st.minTrim,trim);st.minLegacyCut=Math.min(st.minLegacyCut,legacy);st.minCut=Math.min(st.minCut,cut);if(cut<legacy-1e-6)st.reduced++; st.samples++;if(margin<0)st.below++;if(margin<st.minMargin){st.minMargin=margin;st.worst={frame,paw:v.paw,world:v.p.toArray(),screenY:py,fullClearanceY:line};}}
   stats.set(key,st);
  }
 }
 extents.push({anim,speed,...bounds});
 for(const [camera,st] of stats)rows.push({anim,speed,camera,...st});
}
const before=publicPads.map(p=>p.clone()),identities=[...publicPads],oldInverse=group.matrixWorld.clone().invert();
group.position.add(new THREE.Vector3(2,1,3));group.rotation.y+=.3;const intended=new THREE.Matrix4().compose(group.position,group.quaternion,group.scale);
const expected=before.map(p=>p.applyMatrix4(oldInverse).applyMatrix4(intended));loco.writeFootPoints(publicPads);
const staleMatrixMaxError=Math.max(...publicPads.map((p,i)=>p.distanceTo(expected[i])));if(staleMatrixMaxError>1e-6)throw Error(`Stale pad matrices ${staleMatrixMaxError}`);if(publicPads.some((p,i)=>p!==identities[i]))throw Error('Pad read replaced caller vectors');
const sourceSha256=createHash('sha256').update(fs.readFileSync('games/fox-spirit/src/locomotion.ts')).update(fs.readFileSync('games/fox-spirit/src/occlusion.ts')).digest('hex');
console.log(JSON.stringify({sourceSha256,staleMatrixMaxError,callerVectorsReused:true,scope:'CPU actual paw vertices weighted >=.65, live public writeFootPoints + production fader uniforms. Assumed full foreground depth gate/strength1; full ellipse*trim reported vs legacy ellipse. No browser/render. Correct createFox .02m group feetOffset and once/clamp actions. Fixed camera stress poses, not route playback. Partial ellipse clearance is pre-existing; reduced counts only additional trim loss. Fixed-camera synthetic poses, not visible gameplay proof. FX/shells excluded.',pawVertices:pawVertices.length,extents,rows},null,2));
