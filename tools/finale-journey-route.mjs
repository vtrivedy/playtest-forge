import { createKeepingRoute, KEEPING_START } from './opening-hero-route.mjs';
export const SLICE_START = KEEPING_START;
export const SLICE_STAGING = 'One initial hearth placement; original Keeping route then live pickup, bridge crossing, glide and placement. No forced progression or camera.';

// Embed the shared factory so browser-side probes can serialize the complete input route.
export const createSliceRoute = new Function(`return function createFinaleJourneyRoute() {
  const keeping = (${createKeepingRoute.toString()})();
  let onward = false, step = 0, since = 0, last = 0;
  const legs = [
    {beat:'return over the bridge',to:[27.8,72.6]},
    {beat:'round the root bowl',to:[29.7,75.3]},
    {beat:'recover warmth at the root',to:[28.31,76.20],pickupReach:true},
    {beat:'take warmth onward',action:'pickup'},
    {beat:'carry round the bowl',to:[29.7,75.3]},
    {beat:'carry onto the bridge',to:[27.8,72.6]},
    {beat:'carry across the bridge',to:[26.2,66.2]},
    {beat:'to the crag edge',to:[25.6,63.8]},
    {beat:'glide with warmth',to:[21.4,46],glide:true},
    {beat:'approach the Press',to:[21.0,40.7],reach:.15},
    {beat:'set warmth in the cradle',action:'place'},
    {beat:'let the year turn',hold:true},
  ];
  return (t,s) => {
    const dt = Math.max(0,t-last);last=t;
    if(!onward) {
      const input = keeping(t,s);
      if(input.beat!=='a leaf comes down')return {...input,complete:false};
      onward=true;since=0;
    }
    since+=dt;
    let leg=legs[step];
    const next=()=>{step++;since=0;leg=legs[step];};
    const carried=s.opening.carry.carried;
    if(leg.pickupReach && s.opening.carry.canPickup)next();
    if(leg.action && since>.25 && (leg.action==='pickup'?carried:s.opening.finale.phase!=='sealed'))next();
    if(leg.glide && since>1 && s.grounded && s.pos[1]<3)next();
    else if(leg.to && !leg.glide && Math.hypot(leg.to[0]-s.pos[0],leg.to[1]-s.pos[2])<(leg.reach??.45))next();
    const dx=leg.to?leg.to[0]-s.pos[0]:0,dz=leg.to?leg.to[1]-s.pos[2]:0,d=Math.hypot(dx,dz);
    const mag=leg.glide?1:.5;
    return {x:d>.05?dx/d*mag:0,z:d>.05?dz/d*mag:0,jump:!!leg.glide && since>.9,dash:false,
      interact:!!leg.action && since<dt*1.1,beat:leg.beat,complete:leg.hold && s.opening.finale.card==='done'};
  };
}`)();
export function verifySlice(s) {
  const o=s.opening;
  return {steam:o.chemistry.steamLatched,keeping:o.chemistry.completed,bridge:o.keeping.phase==='bridge',
    realCarry:o.carry.pickups>=4 && o.carry.placements>=3,emberPlaced:!o.carry.carried,
    finaleKindled:o.finale.kindles===1,snow:o.finale.snow>0,kitsCurled:o.finale.kits.every(k=>k==='curled'),
    cardShown:o.finale.cardShows===1,cardDone:o.finale.card==='done'};
}
