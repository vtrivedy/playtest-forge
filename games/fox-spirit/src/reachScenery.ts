import * as THREE from 'three';
import { Bucket, rng } from './russetKit';

/** Original Reach geometry, built in metres. No external asset or texture dependency. */
export function dressReach(group: THREE.Group, patch: (mat: THREE.MeshStandardMaterial) => void) {
  const bark = new Bucket(), reeds = new Bucket(), leaves = new Bucket(), stone = new Bucket();
  const random = rng(73104);
  const barkColor = new THREE.Color(0x505754), reedColor = new THREE.Color(0x777c69);
  function branch(points: number[][], radius: number) {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p as [number, number, number])));
    const geo = new THREE.TubeGeometry(curve, 8, radius, 6, false);
    // Taper the final half gently, including the end cap silhouette.
    const pos = geo.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const t = Math.floor(i / 7) / 8, centre = curve.getPointAt(t);
      const p = new THREE.Vector3().fromBufferAttribute(pos, i).sub(centre).multiplyScalar(1 - t * .83).add(centre);
      pos.setXYZ(i, p.x, p.y, p.z);
    }
    geo.computeVertexNormals(); bark.add(geo, undefined, barkColor); geo.dispose();
  }
  // Open crowns keep the ferry and bell readable; fine hanging twigs suggest willow/alder.
  for (const [x, y, z, h] of [[176,30,-131,8],[195,30,-110,10],[210,36,-125,9],[217,31,-140,7],[179,30,-109,6]]) {
    branch([[x,y,z],[x+.3,y+h*.4,z-.2],[x-.5,y+h*.78,z+.4],[x+.2,y+h,z]], .28);
    for (let j = 0; j < 5; j++) {
      const a = j * 2.4 + x, reach = 1.5 + random() * 1.7;
      const dx = Math.cos(a) * reach, dz = Math.sin(a) * reach, by = y+h*(.52+j*.065);
      branch([[x,by,z],[x+dx*.5,by+.9,z+dz*.5],[x+dx,by+.3,z+dz],[x+dx*1.15,by-1.4,z+dz*1.15]], .09);
      // Sparse, slender copper leaves, never a maple canopy mass.
      for (let k = 0; k < 7; k++) {
        const t = k/7, ly = by+.2-t*1.7;
        const geo = new THREE.SphereGeometry(.12, 5, 3);
        const matrix = new THREE.Matrix4().compose(new THREE.Vector3(x+dx*(1+t*.15),ly,z+dz*(1+t*.15)),new THREE.Quaternion().setFromEuler(new THREE.Euler(.1,a,.3)),new THREE.Vector3(.55,2.3,.35));
        leaves.add(geo, matrix, new THREE.Color(k%3 ? 0x987346 : 0x8b583c)); geo.dispose();
      }
    }
    // Exposed root knees around the flooded trunk, rather than lush ground-cover.
    for (let j=0;j<4;j++) { const a=j*Math.PI/2; branch([[x+Math.cos(a)*1.2,y,z+Math.sin(a)*1.2],[x+Math.cos(a)*.55,y+.5,z+Math.sin(a)*.55],[x,y+1,z]],.14); }
  }
  // Bank clusters stay clear of the source, handles, ferry and low-lane line.
  for (const [cx,cz] of [[177,-108],[183,-107],[197,-111],[198,-126],[189,-132],[174,-133]]) {
    for (let i=0;i<16;i++) {
      const x=cx+(random()-.5)*2.8,z=cz+(random()-.5)*1.7,h=.6+random()*1.1;
      const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(x,30,z),new THREE.Vector3(x+.08,30+h*.6,z),new THREE.Vector3(x+.23,30+h,z+.1)]);
      const stem=new THREE.TubeGeometry(curve,3,.018,3,false); reeds.add(stem,undefined,reedColor);stem.dispose();
      const head=new THREE.CylinderGeometry(.045,.06,.27,5);head.translate(x+.23,30+h,z+.1);leaves.add(head,undefined,new THREE.Color(0x816448));head.dispose();
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
    const mat=new THREE.MeshStandardMaterial({color,vertexColors:true,roughness:.88});mat.name=name;patch(mat);
    const mesh=bucket.toMesh(mat,{cast:true,receive:true});if(mesh)group.add(mesh);
  }
}

/** Local basin surface: quiet teal depth with restrained moving reflection, no pale foam disc. */
export function createReachWater(group: THREE.Group) {
  const mat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,
    uniforms:{uTime:{value:0},uDeep:{value:new THREE.Color(0x223f40)},uSky:{value:new THREE.Color(0x9ba9a6)}},
    vertexShader:`varying vec2 vUv; varying vec3 vWorld;
      void main(){vUv=uv;vec4 w=modelMatrix*vec4(position,1.);vWorld=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader:`uniform float uTime;uniform vec3 uDeep,uSky;varying vec2 vUv;varying vec3 vWorld;
      void main(){
        vec2 p=(vUv-.5)*2.;float r=length(p);
        float edge=r+.018*sin(p.x*26.+sin(p.y*17.))+.012*sin(p.y*32.);
        float alpha=smoothstep(1.,.89,edge);if(alpha<.005)discard;
        float a=vWorld.x*.6+vWorld.z*.83-uTime*.36;
        float b=vWorld.x*1.9-vWorld.z*.74+uTime*.45;
        vec3 n=normalize(vec3(cos(a)*.035+cos(b)*.018,1.,sin(a)*.04));
        vec3 view=normalize(cameraPosition-vWorld);float fres=pow(1.-max(dot(n,view),0.),3.);
        float reflection=smoothstep(.35,.9,sin(a*.37+sin(b*.28)*.5))*.12;
        vec3 color=mix(uDeep,uSky,.12+fres*.48+reflection);
        float ripple=pow(max(0.,sin(a*3.+sin(b))*.5+.5),18.);
        color+=uSky*ripple*.045;
        // Broken, thin tide edge, rather than a white filled ellipse.
        float shore=smoothstep(.85,.93,edge)*(1.-smoothstep(.94,.99,edge));
        color=mix(color,vec3(.31,.36,.30),shore*.3);
        gl_FragColor=vec4(color,alpha*(.83+fres*.12));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`});
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(22,24),mat);mesh.rotation.x=-Math.PI/2;mesh.position.set(187,29.8,-118);mesh.name='reach-water';group.add(mesh);
  // The same small wake follows each hull, independently of the fixed watermarks.
  const wakes:THREE.Mesh[]=[];
  const wakeMat=new THREE.MeshBasicMaterial({color:0x91aaa3,transparent:true,opacity:.18,depthWrite:false,side:THREE.DoubleSide});
  for(const [x,z,rx,rz] of [[187,-118,3.3,3.7],[192,-124,1.4,1.9],[188,-129,1.4,1.9]]) {
    const geo=new THREE.RingGeometry(.95,1,48);geo.scale(rx,rz,1);
    const wake=new THREE.Mesh(geo,wakeMat);wake.rotation.x=-Math.PI/2;wake.position.set(x,30,z);group.add(wake);wakes.push(wake);
  }
  return {mesh,update(time:number,fill:number){mat.uniforms.uTime!.value=time;mesh.position.y=29.8+6*fill;for(const [i,w] of wakes.entries()){w.position.y=mesh.position.y+.025;w.scale.setScalar(1+Math.sin(time*.8+i)*.025);w.visible=fill>.035;}}};
}
