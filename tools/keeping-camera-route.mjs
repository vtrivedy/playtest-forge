// Reuse the authored natural Carry→steam→root-hearth route, without any release/debug hook.
export {KEEPING_START as SLICE_START,createKeepingRoute as createSliceRoute} from './opening-hero-route.mjs';
export const SLICE_STAGING='one initial placement beside the first hearth; controller input and real heat/Carry progression thereafter; no forced Keeping or paint';
export function verifySlice(s){return{steam:s.opening.chemistry.steamLatched,completed:s.opening.chemistry.completed,bridge:s.opening.keeping.phase==='bridge',onCrag:s.pos[1]>8&&Math.hypot(s.pos[0]-26,s.pos[2]-65.2)<3};}
