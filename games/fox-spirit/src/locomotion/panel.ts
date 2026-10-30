import type GUI from 'lil-gui';
import type { Locomotion } from './locomotion';
import type { MoveParams } from './controller';
import { GAITS } from './gait';

/** lil-gui folders for every locomotion tunable (also reachable as window.__gameHooks.loco.params / .move). */
export function createLocoPanel(gui: GUI, loco: Locomotion, move: MoveParams) {
  const p = loco.params;
  const f = gui.addFolder('Locomotion');
  f.add(p, 'debug').name('debug draw').listen();
  const fm = f.addFolder('Momentum');
  fm.add(move, 'accel', 4, 60, 0.5);
  fm.add(move, 'decel', 4, 60, 0.5);
  fm.add(move, 'skidDecel', 8, 80, 0.5);
  fm.add(move, 'lateralAccel', 8, 120, 1).name('lateralAccel (turn radius)');
  fm.add(move, 'pivotRate', 2, 20, 0.1);
  fm.add(move, 'skidAngle', 1.2, 3.1, 0.01);
  fm.add(move, 'skidSpeed', 1, 10, 0.1);
  fm.add(move, 'jumpWindup', 0, 0.15, 0.005);
  for (const n of GAITS) {
    const fg = f.addFolder(`Gait · ${n}`);
    const g = p.gaits[n];
    fg.add(g, 'speed', 0.3, 12, 0.05);
    fg.add(g, 'freq', 0.5, 5, 0.05);
    fg.add(g, 'duty', 0.15, 0.85, 0.01);
    fg.add(g, 'stepHeight', 0, 0.4, 0.005);
    fg.add(g, 'bob', 0, 0.15, 0.002);
    fg.close();
  }
  const ff = f.addFolder('Feet');
  ff.add(p, 'idleSpeed', 0, 1, 0.01);
  ff.add(p, 'idleStepDist', 0.02, 0.4, 0.005);
  ff.add(p, 'idleStepTime', 0.06, 0.6, 0.01);
  ff.add(p, 'strideLead', 0, 1, 0.01);
  ff.add(p, 'overreach', 0.9, 1.3, 0.01);
  ff.add(p, 'airPoseRate', 2, 40, 0.5);
  const fb = f.addFolder('Body');
  fb.add(p, 'pitchAccel', 0, 0.05, 0.001);
  fb.add(p, 'maxPitch', 0, 0.6, 0.01);
  fb.add(p, 'lean', 0, 1.5, 0.01);
  fb.add(p, 'maxRoll', 0, 0.6, 0.01);
  fb.add(p, 'spineBend', 0, 0.5, 0.005);
  fb.add(p, 'maxBend', 0, 0.8, 0.01);
  fb.add(p, 'gallopFlex', 0, 0.4, 0.005);
  fb.add(p, 'headStabilize', 0, 1, 0.01);
  fb.add(p, 'headLook', 0, 0.5, 0.005);
  fb.add(p, 'bodyRate', 1, 30, 0.5);
  const fc = f.addFolder('Crouch / jump');
  fc.add(p, 'crouchStiffness', 20, 600, 5);
  fc.add(p, 'crouchDamping', 1, 60, 0.5);
  fc.add(p, 'landCrouch', 0, 0.4, 0.005);
  fc.add(p, 'windupCrouch', 0, 0.3, 0.005);
  fc.add(p, 'takeoffStretch', 0, 0.2, 0.005);
  fc.add(p, 'skidPitch', 0, 0.5, 0.005);
  fc.add(p, 'skidSquat', 0, 0.3, 0.005);
  const ft = f.addFolder('Tail');
  ft.add(p, 'tailStiffness', 1, 80, 0.5);
  ft.add(p, 'tailStiffnessTip', 0.5, 40, 0.5);
  ft.add(p, 'tailDrag', 0, 20, 0.1);
  ft.add(p, 'tailGravity', 0, 20, 0.1);
  ft.add(p, 'tailSway', 0, 0.3, 0.005);
  f.close();
  return f;
}
