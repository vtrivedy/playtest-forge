// Regional camera regression. Setup placements and real dash inputs are staged;
// the recorded fall/retries use the ordinary controller and follow camera.
export const SLICE_START = { x: -28.4, z: 71, yaw: Math.PI / 2 };
export const SLICE_STAGING = 'two setup placements and real dashes open the ruin folds; one placement on the second leaf; recorded walk-off and jump retries thereafter; no forced page/fold/restore state';

export function prepareSlice(h) {
  h.setStick(0, 0);
  h.setKeys([]);
  h.teleport(-23.6, 75, -Math.PI / 2);
  h.advance(30, 1 / 60, false);
  h.setStick(-1, 0);
  h.setKeys(['ShiftLeft']);
  h.advance(15, 1 / 60, false);
  h.setStick(0, 0);
  h.setKeys([]);
  h.advance(90, 1 / 60, false);
  h.teleport(-28.2, 74.8, Math.PI);
  h.advance(30, 1 / 60, false);
  h.setStick(0, -1);
  h.setKeys(['ShiftLeft']);
  h.advance(15, 1 / 60, false);
  h.setStick(0, 0);
  h.setKeys([]);
  h.advance(90, 1 / 60, false);
  const folds = h.state().opening.popUpRuin.folds;
  if (folds[0].phase !== 'open' || folds[1].phase !== 'open') throw Error('Staged real dashes did not open both ruin folds');
}

export function createSliceRoute() {
  return (t, s) => {
    if (t < 1.5) return { x: 0, z: 0, jump: false, dash: false, beat: 'second leaf start' };
    if (t < 4) return { x: .65, z: 0, jump: false, dash: false, beat: 'walk off toward overlook' };
    if (t < 5) return { x: 0, z: 0, jump: false, dash: false, beat: 'missed landing' };
    if (t < 11) return { x: .3, z: 0, jump: (t - 5) % 1.2 < .6, dash: false, beat: 'jump retries below overlook' };
    return { x: 0, z: 0, jump: false, dash: false, beat: 'ledge drop complete' };
  };
}

export function verifySlice(s) {
  return {
    firstFold: s.opening.popUpRuin.folds[0].phase === 'open',
    secondFold: s.opening.popUpRuin.folds[1].phase === 'open',
    belowLeaf: s.pos[1] < .3,
    grounded: s.grounded,
  };
}
