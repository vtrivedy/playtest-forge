// Camera route derived from Bramble's tools/millbrook-walk.mjs at8db8b83.
// One staged lane-mouth start; no forced restores or mid-route placements.
export const SLICE_START = {x:-36,z:89,yaw:-1.4};
export function createSliceRoute() {
const ROUTE = [
  ['wake', null, { hold: 1.5 }],
  ['plaza west', [-12.5, 89.4]],
  ['cottage lane', [-18.7, 87.4]],
  ['west cottages', [-29.2, 87.6]],
  ['last cottage', [-35.5, 89.2]],
  ['into the lane', [-46, 90.4]],
  ['lane bend', [-55, 88.7]],
  ['lane mouth', [-63.5, 86.7]],
  ['valley opens', [-69.5, 87.6], { hold: 1.5 }],
  ['mill door', [-71.4, 91.4]],
  ['mill east wall', [-68.4, 92.0]],
  ['past the kiln', [-63.2, 95.0]],
  ['north of the mill', [-68.0, 100.6]],
  ['above the dam', [-71.6, 101.6], { hold: 1.0 }],
  ['dash the dam', [-75.2, 101.4], { dash: true, mag: 1 }],
  ['watch it run', null, { hold: 6.5 }],
  ['to the kiln', [-66.4, 97.4]],
  ['kiln waking', null, { hold: 4, until: 'kiln' }],
  ['onto the kiln', [-65.65, 96.14], { jump: true, mag: 0.4 }],
  ['ride the warm air', null, { lift: true }],
  ['glide to the weir', [-70.5, 106.3], { glide: true }],
  ['on the weir', null, { hold: 3 }],
  ['drop to the valley', [-67.6, 101.0], { glide: true }],
  ['east of the mill', [-67.4, 93.0]],
  ['to the bridge', [-70, 87.6]],
  ['bridge approach', [-75, 85.6]],
  ['bridge east', [-76.2, 86.0]],
  ['bridge deck', [-79, 87]],
  ['bridge west', [-81.8, 88]],
  ['off the bridge', [-83.2, 88.2]],
  ['orchard', [-88, 84.5]],
  ['foot of the hill', [-93.5, 80.5]],
  ['climb', [-95.5, 75.5]],
  ['lookout', [-97.9, 72.8]],
  ['the view', null, { hold: 4, face: [-60, 84] }],
];
  let beat=5, entered=0, previousTime=0, airborne=false, launchY=null, first=true;
  return (t,s) => {
    if(first){entered=t;previousTime=t;first=false;}
    const dt=Math.max(0,t-previousTime);previousTime=t;
    if(beat>=ROUTE.length)return {x:0,z:0,jump:false,dash:false,beat:'complete Millbrook'};
    const [name,to,o={}] = ROUTE[beat];
    const [x,y,z]=s.pos;
    let ix=0,iz=0,jump=false,dash=false,arrived=false;
    if(o.lift){
      launchY??=y;
      const dx=-65.65-x,dz=96.14-z,d=Math.hypot(dx,dz)||1,mag=Math.min(.3,d*.7);
      ix=dx/d*mag;iz=dz/d*mag;jump=true;
      arrived=y>launchY+8.5 || (s.opening.millWeir && y>launchY+5 && s.vel[1]<.2);
      if(arrived)launchY=null;
    }else if(to){
      const dx=to[0]-x,dz=to[1]-z,d=Math.hypot(dx,dz),mag=o.mag??1;
      ix=d>.001?dx/d*mag:0;iz=d>.001?dz/d*mag:0;
      if(o.glide){if(!s.grounded)airborne=true;arrived=airborne&&s.grounded||d<.9;}
      else arrived=d<((name.startsWith('bridge') || name === 'off the bridge') ? .2 : o.dash ? 1.2 : o.jump ? 1.7 : .9);
      jump=!!o.glide;dash=!!o.dash&&d<3.2;
    }else{
      if(o.face){const dx=o.face[0]-x,dz=o.face[1]-z,d=Math.hypot(dx,dz)||1;ix=dx/d*.05;iz=dz/d*.05;}
      const waiting=o.until==='kiln'&&!s.opening.millWeir?.lit;
      arrived=!waiting && t-entered>=(o.hold??0);
      if(waiting)entered+=dt;
    }
    if(arrived){beat++;entered=t;airborne=false;}
    return {x:ix,z:iz,jump,dash,beat:name};
  };
}
