import * as THREE from 'three';
import { heroSoftUniforms, HERO_SOFT_VERTEX, HERO_SOFT_FRAGMENT } from '../cameraSoftOcclusion';
import type GUI from 'lil-gui';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler.js';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Shade (docs/design/world-1.md §3.8): an ink silhouette of an animal caught mid-stride when the Keeping
 * struck. It drifts along an authored closed patrol and drains temporary colour within `drainRadius`:
 * aura/trail and spent dash strokes (≤ 1) read as 0 there, and unsupplied reactors in it skip their hold.
 * A dash through it frees it: it comes apart into leaves. Contact without a dash knocks the fox back.
 */
export type ShadeSpot = { id: string; patrol: Array<[number, number, number]>; speed?: number; afterLatch?: string };

export type ShadeTunables = { drainRadius: number; speed: number; hitRadius: number; knockback: number; bob: number; releaseTime: number; invulnerability: number; debug: boolean; inkOpacity: number; inkSize: number; inkDensity: number; noticeDistance: number; noticeTime: number; leafSize: number; chaseDistance: number; chaseDelay: number; chaseLeash: number; chaseRest: number };
export const SHADE_DEFAULTS: ShadeTunables = { drainRadius: 3, speed: 1.25, hitRadius: 1.1, knockback: 3, bob: 0.12, releaseTime: 1.2, invulnerability: 1, debug: false, inkOpacity: 0.17, inkSize: 0.55, inkDensity: 4, noticeDistance: 6, noticeTime: 0.3, leafSize: 0.14, chaseDistance: 3.8, chaseDelay: 1.2, chaseLeash: 4, chaseRest: 3 };

type ShadeActor = {
  active: boolean;
  afterLatch?: string;
  id: string;
  curve: THREE.CatmullRomCurve3;
  length: number;
  u: number;
  speed?: number;
  pos: THREE.Vector3;
  heading: number;
  group: THREE.Group;
  mat: THREE.ShaderMaterial;
  layers: THREE.ShaderMaterial[];
  mode: 'patrol' | 'chase' | 'return' | 'released';
  nearTime: number;
  returnStall: number;
  returnBest: number;
  attractionRest: number;
  detourSide: number;
  smoke: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  pool: THREE.Mesh;
  /** 1 = present, falls to 0 while freed */
  presence: number;
  freed: boolean;
  leaves: THREE.InstancedMesh;
  leafSeeds: Array<{ p: THREE.Vector3; velocity: THREE.Vector3; phase: number; landed: THREE.Vector3 | null }>;
  releaseAge: number;
  releaseStart: number;
  debug: THREE.Group;
  poolSampleAt: THREE.Vector3;
  poolRadius: number;
  notice: number;
  noticeYaw: number;
};

/** Bake the licensed library animal in one authored gallop pose. No live skeleton or hero code. */
async function animalGeometry(): Promise<THREE.BufferGeometry> {
  const gltf = await new GLTFLoader().loadAsync('/assets/library/animals/quaternius_stag.glb');
  const mixer = new THREE.AnimationMixer(gltf.scene);
  const headLow = gltf.animations.find(c => c.name === 'Idle_Headlow')!;
  const lowAction = mixer.clipAction(headLow).play();
  mixer.setTime(headLow.duration * 0.4);
  const memoryNeck = ['Neck1', 'Neck2', 'Neck3', 'Head'].map(name => {
    const bone = gltf.scene.getObjectByName(name)!;
    return { bone, q: bone.quaternion.clone() };
  });
  lowAction.stop();
  const clip = gltf.animations.find(c => c.name === 'Walk')!;
  mixer.clipAction(clip).play();
  mixer.setTime(clip.duration * 0.32);
  // Keep the authored mid-stride legs, but borrow the animal's own lowered-head pose.
  for (const { bone, q } of memoryNeck) bone.quaternion.copy(q);
  gltf.scene.updateMatrixWorld(true);
  const parts: THREE.BufferGeometry[] = [];
  const v = new THREE.Vector3();
  gltf.scene.traverse(o => {
    const mesh = o as THREE.SkinnedMesh;
    if (!mesh.isMesh) return;
    if (mesh.isSkinnedMesh) mesh.skeleton.update();
    const source = mesh.geometry;
    const g = new THREE.BufferGeometry();
    const positions = new Float32Array(source.attributes.position!.count * 3);
    for (let i = 0; i < source.attributes.position!.count; i++) {
      mesh.getVertexPosition(i, v).applyMatrix4(mesh.matrixWorld);
      v.toArray(positions, i * 3);
    }
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    if (source.index) g.setIndex(source.index.clone());
    parts.push(g.index ? g.toNonIndexed() : g);
  });
  const g = mergeVertices(mergeGeometries(parts)!, 0.0001);
  g.computeBoundingBox();
  const box = g.boundingBox!;
  const size = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());
  g.translate(-centre.x, -box.min.y, -centre.z);
  // An elongated ink memory: a tall narrow animal, still recognisably mid-stride.
  const scale = 3.1 / size.y;
  g.scale(scale * 0.82, scale, scale * 0.82);
  g.computeVertexNormals();
  g.computeBoundingBox();
  mixer.stopAllAction();
  mixer.uncacheRoot(gltf.scene);
  return g;
}

const NOISE = /* glsl */ `
  float h3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float n3(vec3 x) {
    vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z);
  }`;

function inkMaterial(): THREE.ShaderMaterial {
  const material = new THREE.ShaderMaterial({
    uniforms: { ...heroSoftUniforms(), uTime: { value: 0 }, uPresence: { value: 1 }, uSeed: { value: 0 }, uNoticeYaw: { value: 0 }, uLayer: { value: 0 }, uDensity: { value: 3 }, uReleaseAge: { value: -1 } },
    vertexShader: /* glsl */ `
      ${HERO_SOFT_VERTEX}
      uniform float uTime, uPresence, uSeed, uNoticeYaw, uLayer;
      varying vec3 vWorldN; varying vec3 vN; varying vec3 vV; varying vec3 vP; varying float vY;
      ${NOISE}
      void main() {
        vec3 p = position;
        float head = smoothstep(1.45, 2.05, p.y) * smoothstep(0.15, 0.55, p.z);
        float angle = uNoticeYaw * head;
        vec3 pivot = vec3(0.0, 1.45, 0.48);
        vec3 q = p - pivot;
        q.xz = mat2(cos(angle), -sin(angle), sin(angle), cos(angle)) * q.xz;
        p = pivot + q;
        // wavering: the ink never quite holds still; it boils more toward the feet
        float w = (1.0 - smoothstep(0.0, 1.6, p.y)) * 0.015 + 0.025;
        p += normal * (n3(p * 3.0 + vec3(0.0, uTime * 1.3, uSeed)) - 0.5) * w * 2.0;
        p.x += sin(uTime * 1.7 + p.y * 2.0 + uSeed) * 0.075;
        // freeing: the body lifts and spreads as it comes apart
        p += normal * ((1.0 - uPresence) * 0.035 + uLayer * 0.025);
        vP = p; vY = p.y;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vCameraOccluderDepth = -mv.z;
        vN = normalize(normalMatrix * normal);
        vWorldN = normalize(mat3(modelMatrix) * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      ${HERO_SOFT_FRAGMENT}
      uniform float uTime, uPresence, uSeed, uNoticeYaw, uLayer, uDensity, uReleaseAge;
      varying vec3 vWorldN; varying vec3 vN; varying vec3 vV; varying vec3 vP; varying float vY;
      ${NOISE}
      void main() {
        float n = n3(vP * 2.4 + vec3(uLayer * 0.37, -uTime * 0.32, uSeed));
        float billow = n3(vP * 5.0 + vec3(uTime * 0.14, uLayer, 0.0));
        float rim = pow(1.0 - abs(dot(vN, vV)), 2.2);
        // Density varies through separate shells: broad translucent wash, never a black plate.
        float legFade = smoothstep(0.02, 0.45, vY);
        float density = mix(0.2, 1.0, smoothstep(0.12, 0.76, n * 0.75 + billow * 0.25));
        float dissolve = smoothstep(1.0 - uPresence - 0.12, 1.0 - uPresence + 0.24, n);
        vec3 core = vec3(0.035, 0.024, 0.016);
        vec3 light = vec3(0.15, 0.10, 0.065);
        float wrap = dot(normalize(vWorldN), normalize(vec3(-0.4, 0.8, 0.5))) * 0.5 + 0.5;
        vec3 col = mix(core, light, wrap * 0.45 + n * 0.25 + rim * 0.18);
        // The remaining animal warms briefly before its ink unspools into motes.
        float releaseWarmth = smoothstep(0.08, 0.32, uReleaseAge);
        vec3 amber = mix(vec3(0.25, 0.09, 0.025), vec3(0.65, 0.30, 0.075), wrap * 0.6 + n * 0.25);
        col = mix(col, amber, releaseWarmth);
        float alpha = (uLayer < 0.5 ? 1.0-exp(-uDensity*density) : 0.11*density) * legFade;
        alpha *= (1.0 - smoothstep(0.42, 1.0, rim)) * dissolve * uPresence;
        gl_FragColor = vec4(col, alpha * cameraHeroAlpha());
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
    fog: false,
    transparent: true,
    depthWrite: false,
  });
  material.userData.heroSoftOccluder = true;
  return material;
}

/** Animal-volume ink wisps: original analytic sprites, no texture or external asset. */
function inkWisps(seed: number, source: THREE.BufferGeometry) {
  const g = new THREE.BufferGeometry();
  // Sample the real animal surface, pulling inward to populate its depth instead of a halo plane.
  const count = 144;
  const points = new Float32Array(count * 3);
  const vertex = new THREE.Vector3();
  let randomState=31+seed*167;
  // Runtime Three includes the seeded RNG setter; the installed declaration predates it.
  const sampler=new MeshSurfaceSampler(new THREE.Mesh(source)) as MeshSurfaceSampler & {setRandomGenerator(random:()=>number):MeshSurfaceSampler};
  sampler.setRandomGenerator(()=>{
    randomState=(Math.imul(randomState,1664525)+1013904223)>>>0;
    return randomState/4294967296;
  });
  sampler.build();
  for (let k = 0; k < count; k++) {
    sampler.sample(vertex);
    vertex.x *= 0.65 + (k % 7) * 0.05;
    vertex.z *= 0.8;
    vertex.toArray(points, k * 3);
  }
  g.setAttribute('position', new THREE.BufferAttribute(points, 3));
  g.setAttribute('aPhase', new THREE.BufferAttribute(Float32Array.from({length:count}, (_,k)=>(k*.618+seed*.13)%1),1));
  const mat=new THREE.ShaderMaterial({
    uniforms:{...heroSoftUniforms(),uTime:{value:0},uPresence:{value:1},uOpacity:{value:.16},uSize:{value:.65},uPixelScale:{value:540},uReleased:{value:0},uReleaseAge:{value:0},uReleaseStart:{value:0}},
    vertexShader:`${HERO_SOFT_VERTEX}
      attribute float aPhase; uniform float uTime,uPresence,uSize,uPixelScale,uReleased,uReleaseAge,uReleaseStart; varying float vAge; varying float vPhase;
      void main(){
        float clock=uReleased>.5?uReleaseStart:uTime;
        float age=fract(aPhase+clock*.22);vAge=age;vPhase=aPhase;
        vec3 p=position; p.y+=age*.55;
        p.x+=sin(age*4.+aPhase*19.)*.12*age;
        p.z-=age*.25;
        if(uReleased>.5){
          p.y+=uReleaseAge*(.9+aPhase*.8);
          p.x+=sin(aPhase*31.+uReleaseAge)*uReleaseAge*.35;
          p.z+=cos(aPhase*23.+uReleaseAge*.7)*uReleaseAge*.35;
        }
        vec4 mv=modelViewMatrix*vec4(p,1.);
        vCameraOccluderDepth=-mv.z;
        gl_Position=projectionMatrix*mv;
        gl_PointSize=clamp(uSize*(.55+age)*projectionMatrix[1][1]*uPixelScale/max(.1,-mv.z),1.,180.);
      }`,
    fragmentShader:`${HERO_SOFT_FRAGMENT}
      uniform float uTime,uPresence,uOpacity,uReleased,uReleaseAge; varying float vAge; varying float vPhase;
      ${NOISE}
      void main(){
        vec2 q=(gl_PointCoord-.5)*2.;q.x+=sin(q.y*3.+vPhase*23.+uTime*.6)*.15;
        float edge=1.-smoothstep(.2,1.,length(q*vec2(1.1,.85)));
        float grain=n3(vec3(q*3.,vPhase*13.+uTime*.2));
        float life=sin(vAge*3.14159265);
        if(uReleased>.5) life=mix(life,.8,smoothstep(0.,.25,uReleaseAge))*(1.-smoothstep(.6+vPhase*.4,2.+vPhase*.4,uReleaseAge));
        float presence=uReleased>.5?1.:uPresence;
        float a=edge*edge*(.35+grain*.65)*life*uOpacity*presence;
        vec3 color=mix(vec3(.16,.12,.09),vec3(.42,.23,.095),uReleased*smoothstep(.15,1.8,uReleaseAge));
        gl_FragColor=vec4(color,a*cameraHeroAlpha());
        #include <colorspace_fragment>
      }`,
    transparent:true,depthWrite:false,depthTest:true,
  });
  mat.userData.heroSoftOccluder = true;
  const smoke=new THREE.Points(g,mat);smoke.frustumCulled=false;
  const size=new THREE.Vector2();
  smoke.onBeforeRender=renderer=>{mat.uniforms.uPixelScale!.value=renderer.getDrawingBufferSize(size).y*.5;};
  return smoke;
}

function poolMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPresence: { value: 1 }, uRadius: { value: 3 }, uReleased: {value:0}, uReleaseAge: {value:0} },
    vertexShader: /* glsl */ `attribute float aValid; varying float vValid; varying float vUp; varying vec2 vUv; void main() { vValid = aValid; vUp = abs(normal.y); vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uPresence, uReleased, uReleaseAge;
      varying vec2 vUv; varying float vValid; varying float vUp;
      ${NOISE}
      void main() {
        vec2 q = vUv - 0.5;
        float r = length(q) * 2.0;
        float n = n3(vec3(q * 6.0, uTime * 0.25));
        float a = (1.0 - smoothstep(0.55 + n * 0.25, 1.0, r)) * 0.34 * uPresence;

        vec3 color = vec3(0.008, 0.005, 0.003);
        if(uReleased > 0.5){
          float wave = clamp(uReleaseAge/1.4,0.0,1.0);
          a=(1.0-smoothstep(0.025,0.16,abs(r-wave + (n-.5)*.13)))*(1.0-smoothstep(0.7,1.5,uReleaseAge))*.5;
          color=vec3(.3,.12,.025);
        }
        gl_FragColor = vec4(color, a * smoothstep(0.2, 0.8, vValid) * smoothstep(0.55,0.85,vUp));
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
}

/** Intersect the swept feet segment with the authored vertical animal hit cylinder. */
function crossesShade(from:THREE.Vector3,to:THREE.Vector3,origin:THREE.Vector3,radius:number):boolean {
  const x=from.x-origin.x,z=from.z-origin.z,dx=to.x-from.x,dz=to.z-from.z;
  const a=dx*dx+dz*dz,c=x*x+z*z-radius*radius;
  let enter=0,exit=1;
  if(a<1e-12){
    if(c>=0)return false;
  }else{
    const b=2*(x*dx+z*dz),discriminant=b*b-4*a*c;
    if(discriminant<=0)return false;
    const root=Math.sqrt(discriminant);
    enter=Math.max(enter,(-b-root)/(2*a));
    exit=Math.min(exit,(-b+root)/(2*a));
  }
  const y=from.y-origin.y,dy=to.y-from.y;
  if(Math.abs(dy)<1e-12){
    if(y<=-.5||y>=3.2)return false;
  }else{
    const bottom=(-.5-y)/dy,top=(3.2-y)/dy;
    enter=Math.max(enter,Math.min(bottom,top));
    exit=Math.min(exit,Math.max(bottom,top));
  }
  return enter<exit;
}

export type ShadeState = { id: string; pos: number[]; freed: boolean; mode: ShadeActor['mode']; presence: number; smokeParticles: number; notice: number; noticeYaw: number; heading: number; releaseAge: number; leaves: number; attractionRest: number; height: number };

export type ShadeSystem = {
  readonly tun: ShadeTunables;
  /** True if p is inside an active Shade's drain */
  drains: (p: THREE.Vector3) => boolean;
  /** Advance patrols; returns contact/free events for the fox */
  update: (dt: number, t: number, fox: THREE.Vector3, dashing: boolean) => Array<{ type: 'freed' | 'hit'; id: string; pos: THREE.Vector3 }>;
  resetSweep: () => void;
  activateAfterLatch: (id: string) => void;
  /** Reuse renderer volumes while preserving live actor precision; excludes inactive/freed actors. */
  writeDrainVolumes: (volumes: Array<{ center: THREE.Vector3; radius: number }>) => void;
  state: () => ShadeState[];
};

export async function createShades(scene: THREE.Scene, spots: ShadeSpot[], groundAt: (x: number, z: number, y: number) => number, gui?: GUI, blocked: (x: number, z: number, y: number) => boolean = () => false): Promise<ShadeSystem> {
  const tun = { ...SHADE_DEFAULTS };
  const geo = await animalGeometry();
  const animalHeight=geo.boundingBox!.max.y-geo.boundingBox!.min.y;
  const leafGeo = leafGeometry();
  const leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, side: THREE.DoubleSide, transparent: true, depthWrite: false });
  const matrix = new THREE.Matrix4();
  const leafColor = new THREE.Color();
  const inkColor = new THREE.Color(0x514334);
  const autumnColors = [0xa8441f, 0xb86c2d, 0xc9a04a, 0x9f3821].map(c => new THREE.Color(c));
  const poolGeo = new THREE.PlaneGeometry(2, 2, 16, 16).rotateX(-Math.PI / 2);
  const shades: ShadeActor[] = spots.map((s, i) => {
    const curve = new THREE.CatmullRomCurve3(s.patrol.map(([x, y, z]) => new THREE.Vector3(x, y, z)), true, 'centripetal');
    const mat = inkMaterial();
    mat.uniforms.uSeed!.value = i * 7.3;
    const group = new THREE.Group();
    group.name=s.id;
    const body = new THREE.Mesh(geo, mat);
    body.name='shade-density-core';
    body.castShadow = false;
    body.renderOrder = 2;
    group.add(body);
    const layers: THREE.ShaderMaterial[] = [];
    for (let layer = 1; layer <= 4; layer++) {
      const material = mat.clone();
      material.uniforms.uLayer!.value = layer;
      material.side = layer % 2 ? THREE.BackSide : THREE.FrontSide;
      const wash = new THREE.Mesh(geo, material);
      wash.renderOrder = layer % 2 ? 1 : 3;
      group.add(wash);
      layers.push(material);
    }
    const smoke=inkWisps(i, geo);
    smoke.renderOrder=4;
    group.add(smoke);
    scene.add(group);
    const poolGeometry = poolGeo.clone();
    poolGeometry.setAttribute('aValid', new THREE.BufferAttribute(new Float32Array(poolGeometry.attributes.position!.count).fill(1), 1));
    const pool = new THREE.Mesh(poolGeometry, poolMaterial());
    pool.renderOrder = 0;
    scene.add(pool);
    const leaves = new THREE.InstancedMesh(leafGeo, leafMat.clone(), 20);
    leaves.visible = false;
    leaves.frustumCulled = false;
    leaves.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(leaves);
    const leafSeeds = Array.from({ length: 20 }, (_, k) => {
      const source = geo.attributes.position!;
      const p = new THREE.Vector3().fromBufferAttribute(source, (k * 167 + i * 31) % source.count);
      return { p, velocity: new THREE.Vector3(Math.sin(k * 2.4) * 0.12, 0.8 + (k % 7) * 0.1, Math.cos(k * 1.7) * 0.4), phase: k * 2.399, landed: null };
    });
    const debug = new THREE.Group();
    debug.name=s.id+'-patrol-guide';
    const line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(curve.getPoints(96)), new THREE.LineBasicMaterial({ color: 0xc9a04a }));
    debug.add(line);
    const ring = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 64 }, (_, k) => new THREE.Vector3(Math.cos(k / 64 * Math.PI * 2), 0.05, Math.sin(k / 64 * Math.PI * 2)))), new THREE.LineBasicMaterial({ color: 0xe08a2b }));
    debug.add(ring);
    debug.visible = false;
    scene.add(debug);
    return { layers, mode: 'patrol', nearTime: 0, returnStall: 0, returnBest: Infinity, attractionRest: 0, detourSide: i%2?1:-1, notice: 0, noticeYaw: 0, active: !s.afterLatch, afterLatch: s.afterLatch, poolSampleAt: new THREE.Vector3(Infinity, Infinity, Infinity), poolRadius: 0, leaves, leafSeeds, releaseAge: 0, releaseStart: 0, debug, id: s.id, curve, length: curve.getLength(), u: 0, speed: s.speed, pos: curve.getPointAt(0), heading: 0, group, mat, smoke, pool, presence: 1, freed: false };
  });
  const tmp = new THREE.Vector3();
  let previousFox: THREE.Vector3 | null = null;
  const sys: ShadeSystem = {
    tun,
    resetSweep() { previousFox = null; },
    activateAfterLatch(id) { for (const s of shades) if (s.afterLatch === id) s.active = true; },
    drains(p) {
      for (const s of shades) if (s.active && !s.freed && Math.hypot(p.x - s.pos.x, p.z - s.pos.z) < tun.drainRadius && Math.abs(p.y - s.pos.y) < 4) return true;
      return false;
    },
    update(dt, t, fox, dashing) {
      const ev: Array<{ type: 'freed' | 'hit'; id: string; pos: THREE.Vector3 }> = [];
      for (const s of shades) {
        if (!s.active) { s.group.visible = false; s.pool.visible = false; s.debug.visible = false; continue; }
        s.group.visible = s.presence > 0 || (s.freed && s.releaseAge < 2.4); s.pool.visible = s.freed ? s.releaseAge < 1.5 : true;
        s.smoke.material.uniforms.uTime!.value=t;
        s.smoke.material.uniforms.uReleased!.value=s.freed?1:0;
        s.smoke.material.uniforms.uReleaseAge!.value=s.releaseAge;
        s.smoke.material.uniforms.uReleaseStart!.value=s.releaseStart;
        s.smoke.material.uniforms.uPresence!.value=s.presence;
        s.smoke.material.uniforms.uOpacity!.value=tun.inkOpacity*(1+s.notice*.4);
        s.smoke.material.uniforms.uSize!.value=tun.inkSize;
        if (s.freed) {
          s.releaseAge += dt;
          const age = s.releaseAge;
          s.leaves.visible = age < 10;
          const base = s.group.position;
          for (let k = 0; s.leaves.visible && k < s.leafSeeds.length; k++) {
            const seed = s.leafSeeds[k]!;
            const p = seed.p.clone().applyAxisAngle(THREE.Object3D.DEFAULT_UP, s.heading);
            p.add(base).addScaledVector(seed.velocity.clone().applyAxisAngle(THREE.Object3D.DEFAULT_UP,s.heading), age);
            p.add(new THREE.Vector3(Math.sin(age*2+seed.phase)*.14,0,Math.cos(age*1.6+seed.phase)*.22).applyAxisAngle(THREE.Object3D.DEFAULT_UP,s.heading));
            p.y -= age * age * 0.75;
            if (!seed.landed) {
              const floor = groundAt(p.x, p.z, Math.max(base.y + seed.p.y, p.y) + 0.2);
              if (Number.isFinite(floor) && p.y <= floor + 0.035) seed.landed = p.clone().setY(floor + 0.035);
            }
            if (seed.landed) p.copy(seed.landed);
            const fade = Math.min(1, age * 9) * (1 - THREE.MathUtils.smoothstep(age, 8, 10));
            const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(age * 1.8 + seed.phase, seed.phase + age, Math.sin(age + seed.phase)));
            if (seed.landed) q.setFromEuler(new THREE.Euler(-Math.PI / 2, 0, seed.phase));
            const size = tun.leafSize * fade * (0.88 + (k % 5) * 0.06);
            matrix.compose(p, q, new THREE.Vector3(size, size, size));
            s.leaves.setMatrixAt(k, matrix);
            leafColor.copy(inkColor).lerp(autumnColors[k % 4]!, 0.3 + 0.7 * THREE.MathUtils.smoothstep(age, 0.05 + (k % 4) * 0.025, 0.5));
            s.leaves.setColorAt(k, leafColor);
          }
          if (s.leaves.visible) {
            s.leaves.instanceMatrix.needsUpdate = true;
            if (s.leaves.instanceColor) s.leaves.instanceColor.needsUpdate = true;
          }
          s.presence = Math.max(0, s.presence - dt / tun.releaseTime);
          s.group.visible = s.presence > 0 || (s.freed && s.releaseAge < 2.4);
          s.pool.visible = s.freed ? s.releaseAge < 1.5 : true;
        } else {
          if(s.mode==='patrol') s.u = (s.u + (dt * (s.speed ?? tun.speed)) / s.length) % 1;
          const patrol = s.curve.getPointAt(s.u);
          const distance = Math.hypot(fox.x-s.pos.x,fox.z-s.pos.z);
          const onLevel = Math.abs(fox.y-s.pos.y)<2;
          s.attractionRest = Math.max(0, s.attractionRest-dt);
          s.nearTime = s.attractionRest===0 && distance < tun.chaseDistance && onLevel ? s.nearTime + dt : 0;
          if (s.mode === 'chase' && (distance > 7 || !onLevel || Math.hypot(s.pos.x-patrol.x,s.pos.z-patrol.z)>tun.chaseLeash)) { s.mode='return'; s.returnBest=Infinity; s.returnStall=0; }
          if (s.mode === 'patrol' && s.nearTime > tun.chaseDelay) s.mode='chase';
          if (s.mode === 'return' && Math.hypot(s.pos.x-patrol.x,s.pos.z-patrol.z)<.4) { s.mode='patrol'; s.nearTime=0; s.attractionRest=tun.chaseRest; }
          const target = s.mode === 'chase' ? fox : patrol;
          tmp.copy(target).sub(s.pos).setY(0);
          const remaining=tmp.length();
          if (remaining>.02) {
            const desired=Math.atan2(tmp.x,tmp.z);
            // Attraction draws near; the player chooses contact rather than being hunted into repeated hits.
            const travel = s.mode==='chase' ? Math.max(0, remaining-tun.hitRadius-.65) : remaining;
            const step=Math.min(travel,dt*(s.speed??tun.speed)*(s.mode==='chase'?1.25:1));
            // Motion follows a validated step; visual yaw damps independently of travel.
            const canStep=(angle:number)=>{
              const dx=tmp.x/remaining,dz=tmp.z/remaining,c=Math.cos(angle),sn=Math.sin(angle);
              const nx=s.pos.x+(dx*c-dz*sn)*step,nz=s.pos.z+(dx*sn+dz*c)*step;
              const floor=groundAt(nx,nz,s.pos.y+1);
              return Number.isFinite(floor)&&Math.abs(floor-s.pos.y)<.6&&!blocked(nx,nz,floor)?new THREE.Vector3(nx,floor,nz):null;
            };
            let destination=canStep(0);
            if(!destination&&s.mode!=='chase'){
              for(const side of [s.detourSide,-s.detourSide]){
                for(const angle of [.6,1.2,1.66]){
                  destination=canStep(angle*side);
                  if(destination){s.detourSide=side;break;}
                }
                if(destination)break;
              }
            }
            if(destination) {
              const movementYaw=step>1e-6?Math.atan2(destination.x-s.pos.x,destination.z-s.pos.z):desired;
              s.heading+=Math.atan2(Math.sin(movementYaw-s.heading),Math.cos(movementYaw-s.heading))*(1-Math.exp(-dt*2.4));
              s.pos.copy(destination);
            } else {
              s.heading+=Math.atan2(Math.sin(desired-s.heading),Math.cos(desired-s.heading))*(1-Math.exp(-dt*2.4));
              if(s.mode==='chase'){
                s.mode='return';
                s.returnStall=0;
                s.returnBest=Infinity;
              }
            }
          }
          if(s.mode==='return'){
            const gap=Math.hypot(s.pos.x-patrol.x,s.pos.z-patrol.z);
            if(gap<s.returnBest-.04){s.returnBest=gap;s.returnStall=0;}
            else s.returnStall+=dt;
            // An unreachable route point must not trap a shade in an endless lateral orbit.
            if(s.returnStall>1.5){s.mode='patrol';s.nearTime=0;s.returnStall=0;s.attractionRest=tun.chaseRest;}
          }
          const near = Math.hypot(fox.x-s.pos.x,fox.z-s.pos.z)<tun.noticeDistance && Math.abs(fox.y-s.pos.y)<3;
          s.notice=THREE.MathUtils.damp(s.notice,near?1:0,3/tun.noticeTime,dt);
          const facing=Math.atan2(fox.x-s.pos.x,fox.z-s.pos.z)-s.heading;
          const yaw=Math.atan2(Math.sin(facing),Math.cos(facing));
          s.noticeYaw=THREE.MathUtils.damp(s.noticeYaw,near?THREE.MathUtils.clamp(yaw,-.45,.45):0,3/tun.noticeTime,dt);
          // drift: a slow bob, as if the ink were suspended in water
          const gy = groundAt(s.pos.x, s.pos.z, s.pos.y + 2);
          if (Number.isFinite(gy) && Math.abs(gy - s.pos.y) < 1) s.pos.y = gy;
          // Sweep the fox segment so a fast dash cannot skip a narrow animal between frames.
          // Teleport/reset hooks explicitly clear the previous endpoint.
          if (crossesShade(previousFox??fox,fox,s.pos,tun.hitRadius+(dashing ? 0.5 : 0))) {
            if (dashing) {
              s.freed = true;
              s.mode = 'released';
              s.releaseAge = 0;
              s.releaseStart = t;
              ev.push({ type: 'freed', id: s.id, pos: s.pos.clone().setY(s.pos.y + 1.5) });
            } else ev.push({ type: 'hit', id: s.id, pos: s.pos.clone() });
          }
        }
        s.debug.visible = tun.debug && !s.freed;
        const ring = s.debug.children[1]!;
        ring.position.copy(s.pos);
        ring.scale.setScalar(tun.drainRadius);
        if (!s.freed) s.group.position.set(s.pos.x, s.pos.y + tun.bob + Math.sin(t * 1.3 + s.u * 20) * tun.bob - Math.sin(s.notice*Math.PI)*.07, s.pos.z);
        s.group.rotation.y = s.heading;
        s.mat.uniforms.uNoticeYaw!.value = s.noticeYaw;
        s.mat.uniforms.uTime!.value = t;
        s.mat.uniforms.uPresence!.value = s.presence;
        s.mat.uniforms.uDensity!.value = tun.inkDensity;
        s.mat.uniforms.uReleaseAge!.value = s.freed ? s.releaseAge : -1;
        for (const material of s.layers) {
          material.uniforms.uTime!.value=t;
          material.uniforms.uPresence!.value=s.presence;
          material.uniforms.uDensity!.value=tun.inkDensity;
          material.uniforms.uReleaseAge!.value=s.freed?s.releaseAge:-1;
          material.uniforms.uNoticeYaw!.value=s.noticeYaw;
        }
        if (!s.freed && (s.poolSampleAt.distanceToSquared(s.pos) > 0.0144 || s.poolRadius !== tun.drainRadius)) {
          const positions = s.pool.geometry.attributes.position!;
          const valid = s.pool.geometry.attributes.aValid!;
          for (let k=0;k<positions.count;k++) {
            const x=s.pos.x+positions.getX(k)*tun.drainRadius;
            const z=s.pos.z+positions.getZ(k)*tun.drainRadius;
            const floor=groundAt(x,z,s.pos.y+2);
            const onGround=Number.isFinite(floor)&&Math.abs(floor-s.pos.y)<2;
            valid.setX(k,onGround?1:0);
            positions.setY(k,onGround?(floor-s.pos.y+0.04)/tun.drainRadius:0);
          }
          s.pool.geometry.computeVertexNormals();
          positions.needsUpdate=true;
          valid.needsUpdate=true;
          s.poolSampleAt.copy(s.pos);
          s.poolRadius=tun.drainRadius;
        }
        s.pool.position.copy(s.pos);
        s.pool.scale.setScalar(tun.drainRadius);
        const pm = s.pool.material as THREE.ShaderMaterial;
        pm.uniforms.uReleased!.value = s.freed ? 1 : 0;
        pm.uniforms.uReleaseAge!.value = s.releaseAge;
        pm.uniforms.uTime!.value = t;
        pm.uniforms.uPresence!.value = s.presence;
      }
      previousFox = fox.clone();
      return ev;
    },
    writeDrainVolumes(volumes) {
      let count = 0;
      for (const s of shades) {
        if (!s.active || s.freed) continue;
        const volume = volumes[count] ?? (volumes[count] = { center: new THREE.Vector3(), radius: tun.drainRadius });
        volume.center.copy(s.pos);
        volume.radius = tun.drainRadius;
        count++;
      }
      volumes.length = count;
    },
    state() {
      return shades.filter(s => s.active).map((s) => ({ id: s.id, height: Number(animalHeight.toFixed(3)), pos: s.pos.toArray().map((v) => Number(v.toFixed(2))), freed: s.freed, mode: s.mode, presence: Number(s.presence.toFixed(3)), smokeParticles: s.group.visible ? s.smoke.geometry.attributes.position!.count : 0, notice: Number(s.notice.toFixed(3)), noticeYaw: Number(s.noticeYaw.toFixed(3)), heading: Number(s.heading.toFixed(4)), attractionRest: Number(s.attractionRest.toFixed(3)), releaseAge: Number(s.releaseAge.toFixed(3)), leaves: s.leaves.visible ? s.leaves.count : 0 }));
    },
  };
  if (gui) {
    const f = gui.addFolder('Encounters › Shades');
    f.add(tun, 'drainRadius', 1, 6, 0.1);
    f.add(tun, 'hitRadius', 0.5, 2.5, 0.05);
    f.add(tun, 'knockback', 0, 6, 0.1).name('knockback metres');
    f.add(tun, 'speed', 0, 5, 0.1);
    f.add(tun, 'bob', 0, 0.6, 0.01);
    f.add(tun, 'releaseTime', 0.4, 2, 0.05);
    f.add(tun, 'invulnerability', 0.3, 2, 0.05);
    f.add(tun, 'inkOpacity',0,.4,.01);
    f.add(tun, 'inkSize',.2,1.5,.05);
    f.add(tun, 'inkDensity',1,5,.1).name('core optical density');
    f.add(tun, 'noticeDistance',3,10,.25);
    f.add(tun, 'chaseDistance',2,6,.1);
    f.add(tun, 'chaseDelay',.4,3,.1);
    f.add(tun, 'chaseLeash',2,6,.1);
    f.add(tun, 'chaseRest',1,6,.1).name('rest after return');
    f.add(tun, 'noticeTime',.15,.6,.05);
    f.add(tun, 'leafSize',.06,.22,.01);
    f.add(tun, 'debug');
    f.close();
  }
  return sys;
}

/** Lobed maple leaf, about 15 cm long in world space; a gently cupped midrib. */
function leafGeometry() {
  const shape = new THREE.Shape();
  const outline = [[0,-1.1],[-.1,-.5],[-.64,-.52],[-.4,-.14],[-1,.08],[-.63,.36],[-.74,.83],[-.27,.61],[0,1.35],[.27,.61],[.74,.83],[.63,.36],[1,.08],[.4,-.14],[.64,-.52],[.1,-.5]];
  shape.moveTo(outline[0]![0]!, outline[0]![1]!);
  for (const [x,y] of outline.slice(1)) shape.lineTo(x!,y!);
  shape.closePath();
  const g = new THREE.ShapeGeometry(shape);
  const p = g.attributes.position!;
  for(let i=0;i<p.count;i++) p.setZ(i, .12 * (1 - Math.min(1, Math.abs(p.getX(i)))));
  g.computeVertexNormals();
  return g;
}
