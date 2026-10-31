import * as THREE from 'three';
import { Bucket, rng } from './russetKit';
import { weatheredSurface } from './worldSurfaces';
import { loadNatureKit, type NatureVariant } from './russetNature';
import { cylCollider, type Collider } from './collision';

/** Original Reach geometry, built in metres. No new asset downloads; bark reuses the existing CC0 surface library. */
export async function dressReach(group: THREE.Group, patch: (mat: THREE.MeshStandardMaterial) => void) {
  const bark = new Bucket(), joints = new Bucket(), reeds = new Bucket(), leaves = new Bucket(), stone = new Bucket();
  const random = rng(73104);
  const nature=await loadNatureKit();
  const trunks: Collider[]=[];
  const breeze = { value: 0 };
  const twigRadius=.025;
  bark.aux=[];joints.aux=[];reeds.aux=[];leaves.aux=[];
  const barkColor = new THREE.Color(0x505754), reedColor = new THREE.Color(0x777c69);
  function branch(points: number[][], radius: number) {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p as [number, number, number])));
    const geo = new THREE.TubeGeometry(curve, 8, radius, 6, false);
    // Taper the final half gently, including the end cap silhouette.
    const pos = geo.getAttribute('position');
    const weights=new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) {
      const t = Math.floor(i / 7) / 8, centre = curve.getPointAt(t);
      const p = new THREE.Vector3().fromBufferAttribute(pos, i).sub(centre).multiplyScalar(1 - t * .83).add(centre);
      pos.setXYZ(i, p.x, p.y, p.z);
      weights[i]=radius<.12?t*t:0;
    }
    geo.setAttribute('leafy',new THREE.BufferAttribute(weights,1));
    geo.computeVertexNormals(); bark.add(geo, undefined, barkColor); geo.dispose();
  }
  // Open crowns keep the ferry and bell readable; fine hanging twigs suggest willow/alder.
  const trees=[[176,30,-131,8],[187,30,-110.5,10],[210,36,-125,9],[217,31,-140,7],[175,30,-106,6]];
  for (const [index,[x, y, z, h]] of trees.entries()) {
    const variant: NatureVariant=index%2?'dead_1':'dead_2';
    const scale=h/nature.height(variant);
    nature.place(variant,x,y,z,{scale,yaw:x*.31,hue:barkColor,bark:barkColor});
    trunks.push(cylCollider({x,z,r:nature.trunkR(variant)*scale+.15,top:y+h*.75,bottom:y-.5,tag:'reach-trunk'}));
  }
  const treeStart=group.children.length;
  for(const mat of nature.build(group))patch(mat);
  const treeMeshes=group.children.slice(treeStart).filter(o=>{
    const mesh=o as THREE.Mesh;if(!mesh.isMesh)return false;
    const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
    return materials.some(m=>m.name.includes('Bark'));
  }) as THREE.Mesh[];
  for(const mesh of treeMeshes)mesh.geometry.computeBoundingBox();
  const triangle=new THREE.Triangle(),near=new THREE.Vector3();
  // Geometry is baked in the group's local frame by NatureKit. Find a real bark
  // attachment rather than assuming that a crooked trunk follows its root axis.
  function barkAnchor(point:THREE.Vector3){
    let best=Infinity;const result=new THREE.Vector3();
    for(const mesh of treeMeshes){
      const geo=mesh.geometry;if(geo.boundingBox!.distanceToPoint(point)>1)continue;
      const p=geo.getAttribute('position'),index=geo.index,n=index?.count??p.count;
      for(let i=0;i<n;i+=3){
        triangle.a.fromBufferAttribute(p,index?index.getX(i):i);
        triangle.b.fromBufferAttribute(p,index?index.getX(i+1):i+1);
        triangle.c.fromBufferAttribute(p,index?index.getX(i+2):i+2);
        triangle.closestPointToPoint(point,near);if(Math.abs(near.y-point.y)>.5)continue;
        const d=point.distanceToSquared(near);
        if(d<best){best=d;result.copy(near);}
      }
    }
    if(!Number.isFinite(best))throw new Error('Reach twig has no nearby bark surface');
    return result;
  }
  for(const [x,y,z,h] of trees){
    for (let j = 0; j < 5; j++) {
      const a = j * 2.4 + x, reach = 1.5 + random() * 1.7;
      const dx = Math.cos(a) * reach, dz = Math.sin(a) * reach, by = y+h*(.52+j*.065);
      const root=barkAnchor(new THREE.Vector3(x,by,z));
      // A small closed bark joint seals the open tube end without pushing through
      // thin upper branches. Its centre touches the actual native bark surface.
      const joint=new THREE.SphereGeometry(twigRadius*1.25,8,6);joint.translate(root.x,root.y,root.z);
      joints.add(joint,undefined,barkColor);joint.dispose();
      branch([[root.x,root.y,root.z],[root.x+dx*.5,root.y+.9,root.z+dz*.5],[root.x+dx,root.y+.3,root.z+dz],[root.x+dx*1.15,root.y-1.4,root.z+dz*1.15]], twigRadius);
      // Sparse, slender copper leaves, never a maple canopy mass.
      for (let k = 0; k < 7; k++) {
        const t = k/7, ly = root.y+.2-t*1.7;
        const geo = new THREE.SphereGeometry(.035, 5, 3);
        const matrix = new THREE.Matrix4().compose(new THREE.Vector3(root.x+dx*(1+t*.15),ly,root.z+dz*(1+t*.15)),new THREE.Quaternion().setFromEuler(new THREE.Euler(.1,a,.3)),new THREE.Vector3(.55,1.8,.35));
        leaves.auxDefault=1;leaves.add(geo, matrix, new THREE.Color(k%3 ? 0x987346 : 0x8b583c)); geo.dispose();
      }
    }
  }
  // Bank clusters stay clear of the source, handles, ferry and low-lane line.
  for (const [cx,cz] of [[176,-106.5],[183,-104.5],[193,-104],[198,-132],[189,-132],[174,-133]]) {
    for (let i=0;i<16;i++) {
      const x=cx+(random()-.5)*2.8,z=cz+(random()-.5)*1.7,h=.6+random()*1.1;
      if(trees.some(([tx,ty,tz])=>ty===30&&Math.hypot(x!-tx!,z!-tz!)<1.45))continue;
      const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(x,30,z),new THREE.Vector3(x+.08,30+h*.6,z),new THREE.Vector3(x+.23,30+h,z+.1)]);
      const stem=new THREE.TubeGeometry(curve,3,.018,3,false);
      const weight=new Float32Array(stem.getAttribute('position').count);for(let j=0;j<weight.length;j++)weight[j]=Math.floor(j/4)/3;
      stem.setAttribute('leafy',new THREE.BufferAttribute(weight,1)); reeds.add(stem,undefined,reedColor);stem.dispose();
      const head=new THREE.CylinderGeometry(.045,.06,.27,5);head.translate(x+.23,30+h,z+.1);leaves.auxDefault=1;leaves.add(head,undefined,new THREE.Color(0x816448));head.dispose();
    }
  }
  // Pale mooring posts remain fixed; wet dark feet measure the water's rise.
  for (const x of [181.3,192.7]) for (const z of [-122.8,-113.2]) {
    for(let i=0;i<7;i++) {
      const geo=new THREE.BoxGeometry(.65,.08,.65);geo.translate(x,30+i*.9,z);
      stone.add(geo,undefined,new THREE.Color(i<2?0x52615d:0xa6aaa0));geo.dispose();
    }
  }
  for (const [bucket,color,name] of [[bark,0xffffff,'reach-willow'],[reeds,0xffffff,'reach-reeds'],[leaves,0xffffff,'reach-copper-leaves'],[stone,0xffffff,'reach-watermarks']] as const) {
    const mat=new THREE.MeshStandardMaterial({color,vertexColors:true,roughness:.88});mat.name=name;
    if(bucket===bark)weatheredSurface(mat,true);
    if(bucket.aux){
      const prev=mat.onBeforeCompile,key=mat.customProgramCacheKey();
      mat.onBeforeCompile=(shader,renderer)=>{
        prev.call(mat,shader,renderer);shader.uniforms.uReachBreeze=breeze;
        shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform float uReachBreeze; attribute float leafy;')
          .replace('#include <begin_vertex>',`#include <begin_vertex>
            transformed.x += sin(uReachBreeze*.65 + position.x*.27 + position.z*.2)*.035*leafy;
            transformed.z += cos(uReachBreeze*.51 + position.z*.31)*.025*leafy;`);
      };
      mat.customProgramCacheKey=()=>`${key}|reach-breeze-v1`;
    }
    patch(mat);
    const mesh=bucket.toMesh(mat,{cast:true,receive:true});if(mesh)group.add(mesh);
    if(bucket===bark){const knots=joints.toMesh(mat,{cast:true,receive:true});if(knots){knots.name='reach-twig-joints';group.add(knots);}}
  }
  return {trunks,update(time:number){breeze.value=time;}};
}

/** Local basin surface: quiet teal depth with restrained moving reflection, no pale foam disc. */
export function createReachWater(group: THREE.Group) {
  const mat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,fog:true,
    uniforms:{...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),...{uTime:{value:0},uDeep:{value:new THREE.Color(0x1d3635)},uSky:{value:new THREE.Color(0x7f9690)}}},
    vertexShader:`#include <fog_pars_vertex>
      varying vec2 vUv; varying vec3 vWorld;
      void main(){vUv=uv;vec4 w=modelMatrix*vec4(position,1.);vWorld=w.xyz;vec4 mvPosition=viewMatrix*w;gl_Position=projectionMatrix*mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader:`#include <fog_pars_fragment>
      uniform float uTime;uniform vec3 uDeep,uSky;varying vec2 vUv;varying vec3 vWorld;
      void main(){
        vec2 p=(vUv-.5)*2.;float r=length(p);
        float edge=length(vec2(p.x*12./11.55,p.y*13./12.55))+.008*sin(p.x*26.+sin(p.y*17.))+.006*sin(p.y*32.);
        float alpha=1.-smoothstep(.98,1.015,edge);
        vec2 bankP=vec2(p.x*12./11.35,-p.y*13./12.35);
        float bankAngle=atan(bankP.y,bankP.x);
        bool spillway=cos(bankAngle)<-.9||(sin(bankAngle)<-.45&&cos(bankAngle)<.55);
        if(spillway)alpha=1.-smoothstep(.975,1.,length(vec2(p.x*12./11.55,p.y*13./12.55)));
        else alpha=1.-smoothstep(1.,1.025,length(bankP));
        if(alpha<.005)discard;
        float a=vWorld.x*.6+vWorld.z*.83-uTime*.36;
        float b=vWorld.x*1.9-vWorld.z*.74+uTime*.45;
        vec3 n=normalize(vec3(cos(a)*.035+cos(b)*.018,1.,sin(a)*.04));
        vec3 view=normalize(cameraPosition-vWorld);float fres=pow(1.-max(dot(n,view),0.),3.);
        float reflection=smoothstep(.35,.9,sin(a*.37+sin(b*.28)*.5))*.04;
        vec3 color=mix(uDeep,uSky,.08+fres*.42+reflection);
        float ripple=pow(max(0.,sin(a*3.+sin(b))*.5+.5),18.);
        color+=uSky*ripple*.015;
        // Broken, thin tide edge, rather than a white filled ellipse.
        float shore=smoothstep(.85,.93,edge)*(1.-smoothstep(.94,.99,edge));
        float shoreBreak=smoothstep(.2,.65,sin(vWorld.x*2.7+sin(vWorld.z*1.9))*.5+.5);
        color=mix(color,vec3(.31,.36,.30),spillway?0.:shore*.2*shoreBreak);
        gl_FragColor=vec4(color,alpha*(.95+fres*.04));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`});
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(24,26),mat);mesh.rotation.x=-Math.PI/2;mesh.position.set(187,29.8,-118);mesh.name='reach-water';mesh.renderOrder=0;group.add(mesh);
  // Open west/south spillways have a falling body down to the cistern floor.
  // This closes the visible air gap beneath HIGH water without blocking LOW traversal.
  const curtainPositions:number[]=[],curtainUV:number[]=[],curtainIndices:number[]=[];
  for(let i=0;i<=48;i++){
    const a=(150+i/48*165)*Math.PI/180;
    for(const y of [0,1]){curtainPositions.push(Math.cos(a)*11.55,y,Math.sin(a)*12.55);curtainUV.push(i/48,y);}
    if(i<48){const j=i*2;curtainIndices.push(j,j+1,j+2,j+1,j+3,j+2);}
  }
  const curtainGeo=new THREE.BufferGeometry();curtainGeo.setAttribute('position',new THREE.Float32BufferAttribute(curtainPositions,3));curtainGeo.setAttribute('uv',new THREE.Float32BufferAttribute(curtainUV,2));curtainGeo.setIndex(curtainIndices);
  const curtainMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,fog:true,
    uniforms:{...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),uTime:mat.uniforms.uTime!,uHeight:{value:0}},
    vertexShader:`#include <fog_pars_vertex>
      varying vec2 vUv;
      void main(){vUv=uv;vec4 mvPosition=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader:`#include <fog_pars_fragment>
      uniform float uTime,uHeight;varying vec2 vUv;
      void main(){
        float metres=vUv.y*uHeight;
        float strands=.5+.5*sin(vUv.x*97.+sin(vUv.x*31.)*2.+sin(metres*2.4+uTime*4.)*.5);
        float flow=.5+.5*sin(metres*3.+uTime*5.+sin(vUv.x*45.));
        float breakup=smoothstep(.12,.5,flow);
        float sheet=smoothstep(.55,.85,strands)*mix(breakup,1.,smoothstep(0.,uHeight,metres)*.6);
        float lip=smoothstep(max(0.,uHeight-.15),max(.001,uHeight),metres);
        float foot=1.-smoothstep(0.,.22,metres);
        vec3 color=mix(vec3(.035,.08,.075),vec3(.16,.24,.21),sheet*.5+flow*.12);
        color=mix(color,vec3(.32,.43,.38),lip*.4+foot*.5);
        float edge=smoothstep(0.,.025,vUv.x)*(1.-smoothstep(.975,1.,vUv.x));
        // Separated spill clusters: neither the lip nor the foot bridges dry gaps.
        float clusters=smoothstep(.3,.65,sin(vUv.x*29.+sin(vUv.x*13.)*1.7));
        float coverage=edge*clusters*sheet;
        if(coverage<.12)discard;
        gl_FragColor=vec4(color,min(.92,coverage*(.76+lip*.18+foot*.2)));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`});
  const curtain=new THREE.Mesh(curtainGeo,curtainMat);curtain.position.set(187,30.02,-118);curtain.name='reach-spillway-water';curtain.renderOrder=-1;curtain.visible=false;group.add(curtain);
  // The same small wake follows each hull, independently of the fixed watermarks.
  const wakes:THREE.Mesh[]=[];
  const wakeMat=new THREE.MeshBasicMaterial({color:0x91aaa3,transparent:true,opacity:.06,depthWrite:false,side:THREE.DoubleSide});
  for(const [x,z,rx,rz] of [[187,-118,3.3,3.7],[192,-124,1.4,1.9],[188,-129,1.4,1.9]]) {
    const geo=new THREE.RingGeometry(.97,1,32,1,.15*Math.PI,.6*Math.PI);geo.scale(rx,rz,1);
    const wake=new THREE.Mesh(geo,wakeMat);wake.rotation.x=-Math.PI/2;wake.position.set(x,30,z);wake.renderOrder=1;group.add(wake);wakes.push(wake);
  }
  return {mesh,update(time:number,fill:number,rise=6,fillRate=0){mat.uniforms.uTime!.value=time;mesh.position.y=29.8+rise*fill;curtain.visible=mesh.position.y>30.06;curtainMat.uniforms.uHeight!.value=Math.max(.001,mesh.position.y-30.02);curtain.scale.y=Math.max(.001,mesh.position.y-30.02);wakeMat.opacity=.025+Math.min(.08,Math.abs(fillRate)*.16);for(const [i,w] of wakes.entries()){w.position.y=mesh.position.y+.025;w.scale.setScalar(1+Math.sin(time*.8+i)*.025);w.visible=fill>.035;}}};
}
