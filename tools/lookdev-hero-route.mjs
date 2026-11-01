// Hero route for the 30 s goal clip in the P0 clearing (?lookdev=p0&play=1).
// Waypoint steering → world-relative analog stick + Space, through the same __gameHooks input path a
// player uses (setStick / setKeys). Deterministic: the fox's own state closes the loop.
//
//   const route = createHeroRoute();  // per capture
//   const input = route(t, state);    // { x, z, jump, beat } each sim step
//
// Beats: settle in sepia → walk out → run → jump onto the mossy rock (paint bloom) → run to the arch →
// jump the plinth (bloom) → through the arch, loop back across the clearing → open-ground leap (bloom)
// → wide run round the west side → last leap (bloom) → run on → hop → ease to a walk → turn 3/4 toward
// the lens (face beat) → hold.

export const HERO_START = { x: 0.6, z: 7.2, yaw: Math.PI };

const LEGS = [
  { beat: 'settle', hold: 1.5 },
  { beat: 'walk', to: [0.3, 4.6], mag: 0.22 },
  { beat: 'run', to: [-1.3, 2.6], mag: 1 },
  { beat: 'jump onto rock', to: [-2.2, 1.2], mag: 1, jumpAt: 1.45, arrive: 0.35 },
  { beat: 'rock', hold: 0.5 },
  { beat: 'run to arch', to: [-0.5, -2.5], mag: 1 },
  { beat: 'run to arch', to: [-0.3, -5.4], mag: 1 },
  { beat: 'jump the plinth', to: [-0.3, -8.0], mag: 1, jumpAt: 2.2, arrive: 0.6 },
  { beat: 'through the arch', to: [-0.2, -10.6], mag: 0.45 },
  { beat: 'loop back', to: [2.4, -10.8], mag: 1 },
  { beat: 'loop back', to: [3.9, -6.0], mag: 1 },
  { beat: 'loop back', to: [3.8, -0.5], mag: 1 },
  { beat: 'leap', to: [1.6, 2.4], mag: 1, jumpAt: 2.4, arrive: 0.8 },
  { beat: 'wide run', to: [-3.4, 4.4], mag: 1 },
  { beat: 'wide run', to: [-4.9, 0.2], mag: 1 },
  { beat: 'last leap', to: [-3.6, -2.6], mag: 1, jumpAt: 2.3, arrive: 0.8 },
  { beat: 'run on', to: [-0.9, -1.0], mag: 1 },
  { beat: 'hop', to: [1.2, 0.2], mag: 1, jumpAt: 1.5, arrive: 0.8 },
  { beat: 'ease', to: [1.9, 1.3], mag: 0.2 },
  // turn ~3/4 toward the lens so the face reads, then hold
  { beat: 'turn to camera', face: 50, mag: 0.06, time: 1.2 },
  { beat: 'look', hold: 99 },
];

export function createHeroRoute() {
  let leg = 0;
  let legT = 0;
  let jumpT = -1;
  let lastT = 0;
  return (t, state) => {
    const dt = Math.max(0, t - lastT);
    lastT = t;
    legT += dt;
    let L = LEGS[leg];
    const [px, , pz] = state.pos;
    const next = () => {
      leg = Math.min(LEGS.length - 1, leg + 1);
      legT = 0;
      jumpT = -1;
      L = LEGS[leg];
    };
    if ((L.hold !== undefined && legT >= L.hold) || (L.time !== undefined && legT >= L.time)) next();
    if (L.to) {
      const d = Math.hypot(L.to[0] - px, L.to[1] - pz);
      // a jump leg ends once the fox has landed; a run leg when it reaches the waypoint
      const landed = L.jumpAt !== undefined && jumpT >= 0 && state.grounded && legT - jumpT > 0.2;
      if ((L.jumpAt === undefined && d < (L.arrive ?? 0.7)) || landed) next();
    }
    if (L.hold !== undefined) return { x: 0, z: 0, jump: false, beat: L.beat };
    if (L.face !== undefined) {
      // a slow step round toward the camera, `face` degrees off the line of sight
      const [cx, , cz] = state.camera.pos;
      const a = Math.atan2(cx - px, cz - pz) + (L.face * Math.PI) / 180;
      return { x: Math.sin(a) * L.mag, z: Math.cos(a) * L.mag, jump: false, beat: L.beat };
    }
    const dx = L.to[0] - px;
    const dz = L.to[1] - pz;
    const d = Math.hypot(dx, dz) || 1;
    if (L.jumpAt !== undefined && jumpT < 0 && d <= L.jumpAt && state.grounded) jumpT = legT;
    const jump = jumpT >= 0 && legT - jumpT < 0.3;
    // once airborne toward a target, keep pushing so the jump carries onto it
    return { x: (dx / d) * L.mag, z: (dz / d) * L.mag, jump, beat: L.beat };
  };
}
