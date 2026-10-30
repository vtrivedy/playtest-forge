import * as THREE from 'three';

export type MotionInput = {
  speed: number; grounded: boolean; yaw: number; verticalSpeed: number;
  groundAt: (x: number, z: number, ceiling: number) => number;
};
import GAITS from '../../../assets/hero/spirit_fox.loco.json';
type Gait = keyof typeof GAITS;
const v = () => new THREE.Vector3();
const q = () => new THREE.Quaternion();

/** Authored pose is evaluated first; contact correction only moves a two-bone chain. */
export class AuthoredLocomotion {
  params = { trotSpeed: 2.6, gallopSpeed: 5.5,
    plantStrength: 1, maxCorrection: .16, turnLean: .045, tailLag: .1, debug: false };
  metrics = { gait: 'idle', phase: 0, playback: 1, stanceFeet: 0, maxPlantError: 0, maxResidual: 0,
    maxCorrection: 0, turnRate: 0, clipWeights: {} as Record<string, number> };
  input: MotionInput = { speed: 0, grounded: true, yaw: 0, verticalSpeed: 0, groundAt: () => 0 };
  private feet: { upper: THREE.Object3D; lower: THREE.Object3D; paw: THREE.Object3D;
    planted: boolean; anchor: THREE.Vector3; clearance: number; dot: THREE.Mesh }[] = [];
  private debugGroup = new THREE.Group();
  private phase = 0;
  private lastActive = '';
  private lastGait = '';
  reset() {
    this.beforeMixer();
    for (const foot of this.feet) foot.planted=false;
    this.turn=0; this.yaw=this.group.rotation.y; this.pitch=0;
  }
  private yaw = 0;
  private pitch = 0;
  private turn = 0;
  private lean = 0;
  private tail = 0;
  private armScale = 1;
  private spine?: THREE.Object3D;
  private tailBone?: THREE.Object3D;
  private overlays: { bone: THREE.Object3D; rotation: THREE.Quaternion }[] = [];
  constructor(private root: THREE.Object3D, private group: THREE.Group,
    private actions: Map<string, THREE.AnimationAction>) {
    root.updateWorldMatrix(true, true);
    const arm = root.getObjectByName('SpiritFox_Armature');
    this.armScale = arm ? arm.getWorldScale(v()).x : root.getWorldScale(v()).x;
    this.yaw=group.rotation.y;
    this.spine = root.getObjectByName('Body');
    this.tailBone = root.getObjectByName('Tail1');
    const floor = new THREE.Box3().setFromObject(root).min.y;
    for (const [upper, lower, paw] of [
      ['FrontUpperLegL','FrontLowerLegL','FrontPawL'],
      ['FrontUpperLegR','FrontLowerLegR','FrontPawR'],
      ['BackLegL','BackUpperLegL','BackPawL'],
      ['BackLegR','BackUpperLegR','BackPawR'],
    ]) {
      const find = (name: string) => root.getObjectByName(name) ?? root.getObjectByName(name.replace(/([LR])$/, '.$1'));
      const a=find(upper), b=find(lower), c=find(paw);
      if (!a || !b || !c) continue;
      const dot = new THREE.Mesh(new THREE.SphereGeometry(.025,6,4), new THREE.MeshBasicMaterial({color:0xffcc44, depthTest:false}));
      this.debugGroup.add(dot);
      this.feet.push({upper:a,lower:b,paw:c,planted:false,anchor:v(),clearance:c.getWorldPosition(v()).y-floor,dot});
    }
    this.debugGroup.name='LocomotionContactDebug';
    group.add(this.debugGroup);
  }
  /** Undo last frame's additive layer before the mixer supplies the next authored pose. */
  beforeMixer() {
    for (const o of this.overlays) o.bone.quaternion.copy(o.rotation);
    this.overlays.length=0;
  }
  fadeSeconds = .16;
  private weights = new Map<string,number>([['idle',1]]);
  blend(dt: number, active: string) {
    if (active!==this.lastActive) { for (const foot of this.feet) foot.planted=false; this.lastActive=active; }
    const locomoting=['run','walk','trot'].includes(active);
    const speed=this.input.speed;
    const walkToTrot=THREE.MathUtils.smoothstep(speed,this.params.trotSpeed-.3,this.params.trotSpeed+.3);
    const trotToGallop=THREE.MathUtils.smoothstep(speed,this.params.gallopSpeed-.5,this.params.gallopSpeed+.5);
    const weights = {walk:1-walkToTrot,trot:walkToTrot*(1-trotToGallop),run:trotToGallop};
    let dominant: Gait='walk';
    for (const name of Object.keys(GAITS) as Gait[]) if (weights[name]>weights[dominant]) dominant=name;
    const stride = (Object.keys(GAITS) as Gait[]).reduce((sum,name) =>
      sum + weights[name]*GAITS[name].stride*this.armScale, 0);
    if(locomoting) this.phase=(this.phase+dt*speed/Math.max(.01,stride))%1;
    const alpha=this.fadeSeconds<=0 ? 1 : 1-Math.exp(-4*dt/this.fadeSeconds);
    for(const [name,action] of this.actions) {
      const target=locomoting ? (weights[name as Gait] ?? 0) : name===active ? 1 : 0;
      const weight=THREE.MathUtils.lerp(this.weights.get(name) ?? 0,target,alpha);
      this.weights.set(name,weight);
      if(weight>1e-5 && !action.isScheduled()) action.play();
      action.enabled=true;
      action.setEffectiveWeight(weight);
      if(name in GAITS) {
        action.paused=false;
        action.time=this.phase*action.getClip().duration;
        action.setEffectiveTimeScale(0);
        if(name===dominant)this.metrics.playback=speed*action.getClip().duration/Math.max(.01,stride);
      }
    }
    if (this.lastGait!==dominant) { for(const foot of this.feet)foot.planted=false; this.lastGait=dominant; }
    this.metrics.gait=locomoting ? dominant : active;
    this.metrics.clipWeights=Object.fromEntries(this.weights);
  }
  afterMixer(dt: number, active: string) {
    const step=Math.max(dt,.00001);
    let dy=Math.atan2(Math.sin(this.input.yaw-this.yaw),Math.cos(this.input.yaw-this.yaw));
    if(Math.abs(dy)>1)dy=0;
    this.yaw=this.input.yaw;
    this.turn=THREE.MathUtils.damp(this.turn,dy/step,12,dt);
    this.metrics.turnRate=this.turn;
    this.lean=THREE.MathUtils.damp(this.lean,THREE.MathUtils.clamp(-this.turn*this.input.speed*this.params.turnLean,-.22,.22),10,dt);
    this.tail=THREE.MathUtils.damp(this.tail,-this.turn*this.params.tailLag,7,dt);
    const overlay=(bone:THREE.Object3D|undefined,axis:THREE.Vector3,angle:number)=>{
      if (!bone) return;
      this.overlays.push({bone,rotation:bone.quaternion.clone()});
      bone.quaternion.multiply(q().setFromAxisAngle(axis,angle));
    };
    const forward=new THREE.Vector3(Math.sin(this.input.yaw),0,Math.cos(this.input.yaw));
    const front=this.group.position.clone().addScaledVector(forward,.45);
    const back=this.group.position.clone().addScaledVector(forward,-.45);
    const fg=this.input.groundAt(front.x,front.z,this.group.position.y+.8);
    const bg=this.input.groundAt(back.x,back.z,this.group.position.y+.8);
    const slope=this.input.grounded && Number.isFinite(fg) && Number.isFinite(bg) ? -Math.atan2(fg-bg,.9) : 0;
    this.pitch=THREE.MathUtils.damp(this.pitch,THREE.MathUtils.clamp(slope,-.4,.4),10,dt);
    this.overlays.push({bone:this.root,rotation:this.root.quaternion.clone()});
    this.root.quaternion.premultiply(q().setFromEuler(new THREE.Euler(this.pitch,0,this.lean)));
    overlay(this.tailBone,new THREE.Vector3(0,0,1),THREE.MathUtils.clamp(this.tail,-.3,.3));
    this.root.updateWorldMatrix(true,true);
    const gait=this.metrics.gait as Gait;
    const data=GAITS[gait];
    const action=this.actions.get(gait);
    const phase=this.phase;
    this.metrics.phase=phase;
    this.metrics.stanceFeet=0; this.metrics.maxPlantError=0; this.metrics.maxResidual=0; this.metrics.maxCorrection=0;
    const locomoting=['run','walk','trot'].includes(active);
    this.debugGroup.visible=this.params.debug;
    this.feet.forEach((foot,i)=>{
      const paw=foot.paw.getWorldPosition(v());
      
      const support=(Object.keys(GAITS) as Gait[]).reduce((sum,name)=> {
        const d=GAITS[name].contacts[i]; const p=(phase-d.phase+1)%1;
        return sum+(p<d.duty ? (this.metrics.clipWeights[name] ?? 0) : 0);
      },0);
      const stance=this.input.grounded && (locomoting ? support>.55 : active==='idle');
      if (stance) {
        const ground=this.input.groundAt(paw.x,paw.z,this.group.position.y+.6);
        if (!Number.isFinite(ground)) {foot.planted=false;return;}
        if (!foot.planted) foot.anchor.copy(paw);
        if(active==='idle')foot.anchor.lerp(paw,1-Math.exp(-5*dt));
        foot.anchor.y=ground+foot.clearance;
        const delta=foot.anchor.clone().sub(paw);
        this.metrics.maxPlantError=Math.max(this.metrics.maxPlantError,Math.hypot(delta.x,delta.z));
        delta.clampLength(0,this.params.maxCorrection).multiplyScalar(this.params.plantStrength);
        this.metrics.maxCorrection=Math.max(this.metrics.maxCorrection,delta.length());
        // Save both joints so correction cannot accumulate when a clip doesn't key that bone.
        for (const bone of [foot.upper,foot.lower,foot.paw]) this.overlays.push({bone,rotation:bone.quaternion.clone()});
        const padRotation=foot.paw.getWorldQuaternion(q());
        this.solve(foot.upper,foot.lower,foot.paw,paw.add(delta));
        const padParent=foot.paw.parent!.getWorldQuaternion(q());
        foot.paw.quaternion.copy(padParent.invert().multiply(padRotation));
        foot.paw.updateWorldMatrix(false,true);
        const corrected=foot.paw.getWorldPosition(v());
        this.metrics.maxResidual=Math.max(this.metrics.maxResidual,corrected.distanceTo(foot.anchor));
        this.metrics.stanceFeet++;
      }
      foot.planted=stance;
      foot.dot.position.copy(this.group.worldToLocal(foot.anchor.clone()));
      foot.dot.visible=stance;
    });
    if (!locomoting) this.metrics.gait=active;
  }
  private solve(upper:THREE.Object3D, lower:THREE.Object3D, paw:THREE.Object3D,target:THREE.Vector3) {
    const a=upper.getWorldPosition(v()), b=lower.getWorldPosition(v()), c=paw.getWorldPosition(v());
    const l1=a.distanceTo(b),l2=b.distanceTo(c); if(l1<.001||l2<.001)return;
    const direction=target.clone().sub(a).normalize();
    const distance=THREE.MathUtils.clamp(a.distanceTo(target),Math.abs(l1-l2)+.0001,l1+l2-.0001);
    const bend=b.clone().sub(a).addScaledVector(direction,-b.clone().sub(a).dot(direction));
    if(bend.lengthSq()<1e-8) bend.crossVectors(new THREE.Vector3(1,0,0).applyQuaternion(this.group.quaternion),direction);
    bend.normalize();
    const along=(l1*l1+distance*distance-l2*l2)/(2*distance);
    const joint=a.clone().addScaledVector(direction,along).addScaledVector(bend,Math.sqrt(Math.max(0,l1*l1-along*along)));
    const aim=(bone:THREE.Object3D,from:THREE.Vector3,to:THREE.Vector3)=>{
      const world=bone.getWorldQuaternion(q());
      const correction=q().setFromUnitVectors(from.normalize(),to.normalize());
      const parent=bone.parent?.getWorldQuaternion(q()) ?? q();
      bone.quaternion.copy(parent.invert().multiply(correction.multiply(world)));
      bone.updateWorldMatrix(false,true);
    };
    aim(upper,b.clone().sub(a),joint.clone().sub(a));
    const elbow=lower.getWorldPosition(v()),end=paw.getWorldPosition(v());
    aim(lower,end.sub(elbow),target.clone().sub(elbow));
  }
}
