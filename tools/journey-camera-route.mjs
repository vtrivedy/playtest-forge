import {createSliceRoute as createOpening, createKeepingRoute as createKeeping} from './opening-hero-route.mjs';
export {SLICE_START} from './opening-hero-route.mjs';
export const SLICE_STAGING='One initial wake placement; input-only opening, ten-second homecoming reveal, walk to hearth, then real Carry/steam/Keeping progression. No forced story state or subsequent teleports.';

// Factories are injectable so browser probes can run the same route without module plumbing.
function createJourneyRoute(openingFactory, keepingFactory) {
  const opening = openingFactory();
  let homeAt = null;
  let keeping = null;
  let keepingAt = 0;
  let endAt = null;
  let leg = 0;
  const way = [[-4,88],[-3.2,86.5],[-3.2,80.5],[0,80],[5.6,81],[4.6,77.2]];
  return (t,s) => {
    if (keeping) {
      const input=keeping(t-keepingAt,s);
      if(input.beat==='a leaf comes down') endAt ??= t;
      return {...input,complete:endAt!==null && t-endAt>=6};
    }
    const first = opening(t,s);
    if (first.beat !== 'homecoming') return {...first,complete:false};
    homeAt ??= t;
    if (t-homeAt < 10) return {...first,complete:false};
    while (leg<way.length && Math.hypot(s.pos[0]-way[leg][0],s.pos[2]-way[leg][1])<0.4) leg++;
    if (leg===way.length) {
      keeping = keepingFactory();
      keepingAt = t;
      return {...keeping(0,s),complete:false};
    }
    const dx=way[leg][0]-s.pos[0],dz=way[leg][1]-s.pos[2],d=Math.hypot(dx,dz)||1;
    return {x:dx/d*0.75,z:dz/d*0.75,jump:false,dash:false,interact:false,beat:'follow warmth '+(leg+1),complete:false};
  };
}

// Capture tools transfer factories with toString(). Inline the canonical factories
// into that transfer, so there is one maintained source for each gameplay route.
export const createSliceRoute = new Function(`return function createSliceRoute() {
  const openingFactory = (${createOpening.toString()});
  const keepingFactory = (${createKeeping.toString()});
  return (${createJourneyRoute.toString()})(openingFactory, keepingFactory);
}`)();
export function verifySlice(s) {
  return {
    pageHome:s.opening.homecoming.pinned,
    steam:s.opening.chemistry.steamLatched,
    roots:s.opening.chemistry.completed,
    bridge:s.opening.keeping.phase==='bridge',
    onCrag:s.pos[1]>8 && Math.hypot(s.pos[0]-26,s.pos[2]-65.2)<3,
  };
}
