import * as THREE from 'three';

export type MotionInput = {
  speed: number; grounded: boolean; yaw: number; verticalSpeed: number;
  groundAt: (x: number, z: number, ceiling: number) => number;
};
const GAITS = {
  walk: { sweep: .48, duty: .65, phases: [ .25, .75, 0, .5 ] },
  trot: { sweep: .72, duty: .48, phases: [ 0, .5, .5, 0 ] },
  run: { sweep: .95, duty: .34, phases: [ .55, .46, 0, .08 ] },
};
type Gait = keyof typeof GAITS;
const v = () => new THREE.Vector3();
const q = () => new THREE.Quaternion();

/** Authored pose is evaluated first; contact correction only moves a two-bone chain. */
export class AuthoredLocomotion {
  params = { walkSpeed: 1.4, trotSpeed: 3.5, gallopSpeed: 6.5, strideScale: 1,
    plantStrength: .85, maxCorrection: .16, turnLean: .045, tailLag: .1, debug: false };
  metrics = { gait: 'idle', phase: 0, playback: 1, stanceFeet: 0, maxPlantError: 0,
    maxCorrection: 0, turnRate: 0, clipWeights: {} as Record<string, number> };
  input: MotionInput = { speed: 0, grounded: true, yaw: 0, verticalSpeed: 0, groundAt: () => 0 };
  private feet: { upper: THREE.Object3D; lower: THREE.Object3D; paw: THREE.Object3D;
    planted: boolean; anchor: THREE.Vector3; clearance: number; dot: THREE.Mesh }[] = [];
  private debugGroup = new THREE.Group();
  private yaw = 0;
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
    this.spine = root.getObjectByName('Body');
    this.tailBone = root.getObjectByName('Tail1');
    const floor = new THREE.Box3().setFromObject(root).min.y;
    for (const [upper, lower, paw] of [
      ['FrontUpperLegL','FrontLowerLegL','FrontPawL'],
      ['FrontUpperLegR','FrontLowerLegR','FrontPawR'],
      ['BackLegL','BackUpperLegL','BackLowerLegL'],
      ['BackLegR','BackUpperLegR','BackLowerLegR'],
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
  blend(dt: number, active: string) {
    if (active !== 'run' && active !== 'walk' && active !== 'trot') {
      for (const name of Object.keys(GAITS)) {
        if (name !== active) this.actions.get(name)?.setEffectiveWeight(0);
      }
      return;
    }
    const speed=this.input.speed;
    const w = THREE.MathUtils.smoothstep(speed,this.params.walkSpeed,this.params.trotSpeed);
    const r = THREE.MathUtils.smoothstep(speed,this.params.trotSpeed,this.params.gallopSpeed);
    const weights = {walk:1-w,trot:w*(1-r),run:r};
    let dominant: Gait='walk';
    for (const name of Object.keys(GAITS) as Gait[]) if (weights[name]>weights[dominant]) dominant=name;
    const old=this.actions.get(this.metrics.gait);
    const phase=old ? (old.time/old.getClip().duration)%1 : 0;
    for (const name of Object.keys(GAITS) as Gait[]) {
      const action=this.actions.get(name); if (!action) continue;
      if (!action.isRunning()) action.reset().play();
      action.enabled=true; action.paused=false;
      action.stopFading();
      action.setEffectiveWeight(weights[name]);
      // Stance displacement / stance time = nominal root speed. No arbitrary minimum cadence.
      const data=GAITS[name];
      const nominal=data.sweep*this.armScale/(data.duty*action.getClip().duration);
      const rate=speed/Math.max(.01,nominal*this.params.strideScale);
      action.setEffectiveTimeScale(rate);
      if (this.metrics.gait!==dominant && old) action.time=phase*action.getClip().duration;
      if (name===dominant) this.metrics.playback=rate;
    }
    this.metrics.gait=dominant;
    this.metrics.clipWeights=weights;
  }
  afterMixer(dt: number, active: string) {
    const step=Math.max(dt,.00001);
    const dy=Math.atan2(Math.sin(this.input.yaw-this.yaw),Math.cos(this.input.yaw-this.yaw));
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
    overlay(this.spine,new THREE.Vector3(0,1,0),this.lean);
    overlay(this.tailBone,new THREE.Vector3(0,0,1),THREE.MathUtils.clamp(this.tail,-.3,.3));
    this.root.updateWorldMatrix(true,true);
    const gait=this.metrics.gait as Gait;
    const data=GAITS[gait];
    const action=this.actions.get(gait);
    const phase=action ? (action.time/action.getClip().duration)%1 : 0;
    this.metrics.phase=phase;
    this.metrics.stanceFeet=0; this.metrics.maxPlantError=0; this.metrics.maxCorrection=0;
    const locomoting=['run','walk','trot'].includes(active);
    this.debugGroup.visible=this.params.debug;
    this.feet.forEach((foot,i)=>{
      const paw=foot.paw.getWorldPosition(v());
      const ph=data ? (phase-data.phases[i]+1)%1 : 0;
      const stance=this.input.grounded && (locomoting ? !!data && ph<data.duty : active==='idle');
      if (stance) {
        const ground=this.input.groundAt(paw.x,paw.z,this.group.position.y+.6);
        if (!Number.isFinite(ground)) {foot.planted=false;return;}
        if (!foot.planted) foot.anchor.copy(paw);
        foot.anchor.y=ground+foot.clearance;
        const delta=foot.anchor.clone().sub(paw);
        this.metrics.maxPlantError=Math.max(this.metrics.maxPlantError,Math.hypot(delta.x,delta.z));
        delta.clampLength(0,this.params.maxCorrection).multiplyScalar(this.params.plantStrength);
        this.metrics.maxCorrection=Math.max(this.metrics.maxCorrection,delta.length());
        // Save both joints so correction cannot accumulate when a clip doesn't key that bone.
        for (const bone of [foot.upper,foot.lower]) this.overlays.push({bone,rotation:bone.quaternion.clone()});
        this.solve(foot.upper,foot.lower,foot.paw,paw.add(delta));
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
    const bend=b.clone().sub(a).addScaledVector(direction,-b.clone().sub(a).dot(direction)).normalize();
    if(bend.lengthSq()<.1)return;
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
