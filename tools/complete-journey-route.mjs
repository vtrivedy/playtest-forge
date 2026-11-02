import {createSliceRoute as createJourney} from './journey-camera-route.mjs';
import {createSliceRoute as createFinale,verifySlice as verifyFinale} from './finale-journey-route.mjs';
export {SLICE_START} from './journey-camera-route.mjs';
export const SLICE_STAGING='One initial wake placement; canonical page chase/homecoming, Keeping journey, recover ember, bridge/glide/Press placement and rest. No later teleports or forced progression.';
export const createSliceRoute = new Function(`return function createCompleteJourneyRoute() {
  const journey = (${createJourney.toString()})();
  const finaleFactory = (${createFinale.toString()});
  let finale = null, finaleAt = 0;
  return (t,s) => {
    if(!finale) {
      const input = journey(t,s);
      if(!input.complete)return {...input,complete:false};
      finale=finaleFactory(true);finaleAt=t;
    }
    return finale(t-finaleAt,s);
  };
}`)();
export function verifySlice(s) {
  return {pageHome:s.opening.homecoming.pinned,...verifyFinale(s)};
}
