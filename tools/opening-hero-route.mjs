// 75 s opening beat, driven entirely through player input. No mid-route teleports or camera overrides.
export const OPENING_START = { x: -5.2, z: 92.5, yaw: Math.atan2(2.2, -11.5) };

export function createOpeningRoute() {
  let phase = 0;
  let since = 0;
  let last = 0;
  let launchY = null;
  const path = [
    { beat: 'wake in paper', hold: 5 },
    { beat: 'first colour', to: [-7.2, 88], mag: 0.2 },
    { beat: 'well path', to: [-4, 88], mag: 0.28 },
    { beat: 'gate approach', to: [-3.2, 86.5], mag: 0.28 },
    { beat: 'through the gate', to: [-3.2, 80.5], mag: 0.4 },
    { beat: 'village to meadow', to: [0, 80], mag: 0.4 },
    { beat: 'turn toward hearth', to: [5.6, 81], mag: 0.28 },
    { beat: 'cold hearth', to: [5.6, 77.5], mag: 0.28 },
    { beat: 'cold hearth pause', hold: 5 },
    { beat: 'bring the warmth', to: [4.3, 74.8], mag: 0.3 },
    { beat: 'hearth lit', hold: 5 },
    { beat: 'ride the warm air', lift: true },
    { beat: 'glide to shelf', to: [13, 75.5], mag: 1, glide: true },
    { beat: 'shelf landing', hold: 6 },
    { beat: 'shelf overlook', to: [14, 73], mag: 0.25 },
    { beat: 'warmth carries on', hold: Infinity },
  ];
  return (t, state) => {
    since += Math.max(0, t - last);
    last = t;
    const [x, y, z] = state.pos;
    let leg = path[phase];
    const next = () => { phase = Math.min(phase + 1, path.length - 1); since = 0; leg = path[phase]; };
    if (leg.hold !== undefined && since >= leg.hold) next();
    if (leg.to && Math.hypot(x - leg.to[0], z - leg.to[1]) < (leg.glide ? 0.7 : 0.55)) next();
    if (leg.lift) {
      launchY ??= y;
      if (y > launchY + 7.1) next();
    }
    if (leg.hold !== undefined) return { x: 0, z: 0, jump: false, dash: false, beat: leg.beat };
    // Remain inside the full-strength core while holding jump. Input stops horizontal drift.
    const to = leg.lift ? [4.3, 74.8] : leg.to;
    const dx = to[0] - x;
    const dz = to[1] - z;
    const d = Math.hypot(dx, dz) || 1;
    const mag = leg.lift ? Math.min(0.3, d * 0.7) : leg.mag;
    return { x: dx / d * mag, z: dz / d * mag, jump: !!(leg.lift || leg.glide), dash: false, beat: leg.beat };
  };
}

// First Keeping deliverable (~85 s): start beside H-a, ride onto the shelf, then Carry → steam → root-hearth →
// the Hearthtree settles into a bridge → cross it while the Crown answers. Input only (stick, Space, Shift, E);
// waits read __game state (carry / chemistry / keeping) so the beat ends when the world has actually answered.
export const KEEPING_START = { x: 4.6, z: 77.2, yaw: Math.PI };

export function createKeepingRoute() {
  let phase = 0;
  let since = 0;
  let last = 0;
  let launchY = null;
  const op = (s) => s.opening ?? {};
  const path = [
    { beat: 'warm the hearth', to: [4.3, 74.9], mag: 0.3 },
    { beat: 'hearth lit', hold: 2.5, until: (s) => op(s).hearth?.latched, min: 1.2 },
    { beat: 'ride the warm air', lift: [4.3, 74.8], rise: 7.1 },
    { beat: 'glide to shelf', to: [13, 75.5], mag: 1, glide: true },
    { beat: 'shelf reveal', hold: 3 },
    { beat: 'to the coal', to: [14.6, 76.95], mag: 0.35 },
    { beat: 'pick up the coal', interact: true, until: (s) => op(s).carry?.carried, hold: 1 },
    { beat: 'carry along the ledge', to: [15.4, 79.6], mag: 0.6 },
    { beat: 'round the bend', to: [19.4, 84.3], mag: 0.75 },
    { beat: 'dash', dash: true, toward: [24.4, 80.9], hold: 0.5 },
    { beat: 'dash-drop', hold: 1.4 },
    { beat: 'back for the coal', toCoal: true, mag: 0.45 },
    { beat: 'pick it back up', interact: true, until: (s) => op(s).carry?.carried, hold: 1 },
    // spring and root-hearth have rim lips: the route stops at the rim and Carry sets the coal into the bowl
    { beat: 'to the spring', to: [24.2, 80.6], mag: 0.6, reach: 0.2 },
    { beat: 'set it in the spring', interact: true, until: (s) => !op(s).carry?.carried, hold: 1 },
    { beat: 'steam wakes', hold: 9, until: (s) => op(s).chemistry?.steamLatched, min: 2.5 },
    { beat: 'steam rising', hold: 1.5 },
    { beat: 'take the coal again', interact: true, until: (s) => op(s).carry?.carried, hold: 1 },
    { beat: 'ride the steam', lift: [24.95, 79.36], rise: 6.5 },
    { beat: 'glide to the terrace', to: [29.3, 77.7], mag: 0.8, glide: true },
    { beat: 'to the root-hearth', to: [29.0, 77.35], mag: 0.3, reach: 0.2 },
    { beat: 'set warmth at the roots', interact: true, until: (s) => !op(s).carry?.carried, hold: 1 },
    { beat: 'the roots take it', hold: 10, until: (s) => op(s).chemistry?.completed, min: 1 },
    { beat: 'the tree finishes falling', hold: 7, until: (s) => op(s).keeping?.phase === 'bridge', min: 4.5 },
    { beat: 'round the bowl', to: [29.7, 75.3], mag: 0.35 },
    { beat: 'onto the bridge', to: [27.8, 72.6], mag: 0.35 },
    { beat: 'cross the bridge', to: [26.2, 66.2], mag: 0.45 },
    { beat: 'the Crown answers', hold: 4 },
    { beat: 'a leaf comes down', hold: Infinity },
  ];
  return (t, state) => {
    since += Math.max(0, t - last);
    last = t;
    const [x, y, z] = state.pos;
    let leg = path[phase];
    const next = () => { phase = Math.min(phase + 1, path.length - 1); since = 0; launchY = null; leg = path[phase]; };
    const waitDone = leg.until ? leg.until(state) && since >= (leg.min ?? 0.2) : false;
    if (leg.hold !== undefined && (since >= leg.hold || waitDone)) next();
    const coal = op(state).carry?.position;
    const target = () => (leg.toCoal && coal ? [coal[0], coal[2]] : leg.to);
    let to = target();
    if (to && Math.hypot(x - to[0], z - to[1]) < (leg.reach ?? (leg.glide ? 0.8 : leg.toCoal ? 0.75 : 0.55))) next();
    if (leg.lift) {
      launchY ??= y;
      if (y > launchY + leg.rise) next();
    }
    to = target();
    // E is edge-triggered by the controller: press on the first frame of the beat only
    const interact = !!leg.interact && since < 1 / 30;
    if (leg.dash) {
      const dx = leg.toward[0] - x, dz = leg.toward[1] - z, d = Math.hypot(dx, dz) || 1;
      return { x: dx / d, z: dz / d, jump: false, dash: since < 1 / 30, interact: false, beat: leg.beat };
    }
    if (leg.hold !== undefined && !leg.lift) return { x: 0, z: 0, jump: false, dash: false, interact, beat: leg.beat };
    // lifts: stay inside the column core while holding jump; glides keep jump held toward the landing
    const aim = leg.lift ?? to;
    const dx = aim[0] - x;
    const dz = aim[1] - z;
    const d = Math.hypot(dx, dz) || 1;
    const mag = leg.lift ? Math.min(0.3, d * 0.7) : leg.mag;
    return { x: dx / d * mag, z: dz / d * mag, jump: !!(leg.lift || leg.glide), dash: false, interact, beat: leg.beat };
  };
}

// Full-slice deliverable for phase 2 (~100 s): wake, chase the Runaway Page round the well, climb the canopy chain
// to catch it again, cross to the west grove, unfold the pop-up ruin and catch it on the overlook — the meadow paints.
// Input only (stick, Space, Shift); every step waits on __game state. No teleports after the wake spot.
export const SLICE_START = OPENING_START;

export function createSliceRoute() {
  let step = 0;
  let since = 0;
  let last = 0;
  let mark = null;
  const page = (s) => s.opening?.page ?? {};
  const canopy = (s) => s.opening?.canopy ?? {};
  const steer = (s, to, mag = 1, lead = 0) => {
    const dx = to[0] - s.pos[0] - (s.vel?.[0] ?? 0) * lead, dz = to[1] - s.pos[2] - (s.vel?.[2] ?? 0) * lead;
    const d = Math.hypot(dx, dz);
    return d > 0.05 ? { x: (dx / d) * mag, z: (dz / d) * mag } : { x: 0, z: 0 };
  };
  const near = (s, to, r) => Math.hypot(s.pos[0] - to[0], s.pos[2] - to[1]) < r;
  const walk = (beat, to, r = 0.5, mag = 1) => ({ beat, run: (s) => ({ ...steer(s, to, mag), done: near(s, to, r) }) });
  const hold = (beat, secs) => ({ beat, run: () => ({ x: 0, z: 0, done: since >= secs }) });
  const S = [
    hold('wake in paper', 3),
    { beat: 'the page bolts', run: (s, f) => {
      const p = page(s), d = Math.hypot(p.pos[0] - s.pos[0], p.pos[2] - s.pos[2]);
      return { ...steer(s, [p.pos[0], p.pos[2]]), dash: d < 2.2 && Math.floor(since * 60) % 12 === 0, done: p.catches >= 1 };
    } },
    hold('it flings away', 2.5),
    walk('to the gate', [-3.2, 86.5], 0.4),
    walk('through the gate', [-3.2, 80.5]),
    walk('to the canopy', [-0.2, 74.4]),
    { beat: 'onto the first leaf', run: (s) => ({ ...steer(s, [-0.2, 71.5]), jump: since > 0.25, done: (canopy(s).launches ?? 0) > 0 }) },
    ...['middle', 'high', 'roost'].map((id) => ({ beat: `spring to ${id}`, run: (s) => {
      const l = (canopy(s).leaves ?? []).find((q) => q.id === id) ?? { x: 0, z: 0 };
      return { ...steer(s, [l.x, l.z], 1, 0.3), jump: true, done: canopy(s).lastLeaf === id || page(s).catches >= 2 };
    } })),
    { beat: 'caught on the roost', run: (s) => ({ x: 0, z: 0, jump: page(s).catches < 2, done: page(s).catches >= 2 && since > 1.5 }) },
    walk('off the canopy', [-4.5, 66.5]),
    walk('across the meadow', [-6, 77.5]),
    walk('toward the grove', [-14, 80]),
    walk('grove edge', [-20, 79]),
    walk('to the folded ruin', [-23.6, 75], 0.15),
    { beat: 'dash the first fold', run: (s) => ({ x: since < 0.6 ? -0.08 : since < 1.0 ? -1 : 0, z: 0, dash: since > 0.75 && since < 0.95, done: since > 1.8 }) },
    walk('back to the run-up', [-22.5, 75], 0.15),
    { beat: 'leap to the first page', run: (s) => {
      if (s.pos[0] > -24.3 && mark === null) return { x: -1, z: 0, done: false };
      mark ??= since;
      return { ...steer(s, [-26.7, 75]), jump: true, done: since - mark > 0.4 && s.grounded };
    } },
    walk('to the second fold', [-28.2, 74.8], 0.15),
    { beat: 'dash the second fold', run: (s) => ({ x: 0, z: since < 0.6 ? -0.08 : since < 1.0 ? -1 : 0, dash: since > 0.75 && since < 0.95, done: since > 1.8 }) },
    walk('back for the climb', [-28.4, 75.7], 0.15),
    { beat: 'leap north', run: (s) => {
      if (s.pos[2] > 73.9 && mark === null) return { x: 0, z: -1, done: false };
      mark ??= since;
      return { ...steer(s, [-28.4, 71.2]), jump: true, done: since - mark > 0.4 && s.grounded };
    } },
    walk('to the edge', [-29.4, 71], 0.15),
    { beat: 'leap to the overlook', run: (s) => {
      if (s.pos[0] < -27.7 && mark === null) return { x: 1, z: 0, done: false };
      mark ??= since;
      return { ...steer(s, [-24.6, 71]), jump: true, done: page(s).phase === 'kept' || (since - mark > 0.4 && s.grounded) };
    } },
    { beat: 'catch it on the overlook', run: (s) => {
      const p = page(s);
      if (p.phase === 'kept') return { x: 0, z: 0, done: true };
      // rests winded on the other perch: leap at it
      const go = p.phase === 'perched' && p.winded;
      return { ...(go ? steer(s, [p.pos[0], p.pos[2]]) : { x: 0, z: 0 }), jump: go, done: false };
    } },
    hold('the meadow paints', Infinity),
  ];
  return (t, state) => {
    since += Math.max(0, t - last);
    last = t;
    let st = S[step];
    let r = st.run(state);
    if (r.done && step < S.length - 1) {
      step++;
      since = 0;
      mark = null;
      st = S[step];
      r = st.run(state);
    }
    return { x: r.x ?? 0, z: r.z ?? 0, jump: !!r.jump, dash: !!r.dash, interact: false, beat: st.beat };
  };
}
