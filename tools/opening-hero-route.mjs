// 75 s opening beat, driven entirely through player input. No mid-route teleports or camera overrides.
export const OPENING_START = { x: -6, z: 92, yaw: Math.PI };

export function createOpeningRoute() {
  let phase = 0;
  let since = 0;
  let last = 0;
  let launchY = null;
  const path = [
    { beat: 'wake in paper', hold: 3 },
    { beat: 'first colour', to: [-7.2, 88], mag: 0.28 },
    { beat: 'well path', to: [-4, 88], mag: 0.5 },
    { beat: 'village to meadow', to: [0, 80], mag: 0.75 },
    { beat: 'cold hearth', to: [5.6, 77.5], mag: 0.5 },
    { beat: 'cold hearth pause', hold: 2 },
    { beat: 'bring the warmth', to: [5.6, 74.2], mag: 0.45 },
    { beat: 'hearth lit', hold: 2 },
    { beat: 'ride the warm air', lift: true },
    { beat: 'glide to shelf', to: [13, 75.5], mag: 1, glide: true },
    { beat: 'shelf landing', hold: 4 },
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
    const to = leg.lift ? [5.6, 74.2] : leg.to;
    const dx = to[0] - x;
    const dz = to[1] - z;
    const d = Math.hypot(dx, dz) || 1;
    const mag = leg.lift ? Math.min(0.3, d * 0.7) : leg.mag;
    return { x: dx / d * mag, z: dz / d * mag, jump: !!(leg.lift || leg.glide), dash: false, beat: leg.beat };
  };
}
