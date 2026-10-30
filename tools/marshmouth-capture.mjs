/** Marsh Mouth regression: caller boots a fresh game before EACH aura/dash trial. */
export async function captureMarshMouth({ H, advance, shot, video, save, page, fps, report }, variant = 'aura', trial = 1) {
  if (!['aura', 'dash'].includes(variant)) throw Error('Marsh Mouth variant must be aura or dash');
  const name = `marshmouth-${variant}-${trial}`;
  const ground = await page.evaluate(() => window.__gameHooks.debug.world.collision.highestAt(54, 40));
  await H('setKeys', []); await H('setStick', 0, 0);
  await H('teleport', 54, ground, 40, Math.atan2(3, -4));
  await advance(12);
  const initial = await H('state');
  if (initial.chem.water.find(w => w.id === 'marsh-mouth').heat > 0.01) throw Error('Fresh Marsh Mouth trial must begin cold');
  const overview = async suffix => {
    await H('photo', [61, 7.5, 42], [59, 0.8, 34.5], 50); await advance(1);
    await shot(`${name}-${suffix}`); await H('photoOff'); await advance(1);
  };
  await overview('frozen');
  const timeline = [], transitions = [], input = [];
  let phase = 'boardwalk', phaseAt = 0, lastPhase = '', finished = false, dashSent = false, crossedAt = null;
  let waypoint = 0, flowingCaptured = false, failure = null;
  const approach = [[55.2, 37.5], [56.6, 36.5]], crossing = [[57, 36], [62.034, 32.736], [64.5, 31.4]];
  const change = (next, frame) => { phase = next; phaseAt = frame; waypoint = 0; };
  const record = async (frame, state, label = phase) => {
    const physical = await page.evaluate(([x, y, z]) => {
      const { water } = window.__gameHooks.chem;
      const col = window.__gameHooks.debug.world.collision;
      const w = water.waters.find(q => q.spot.id === 'marsh-mouth');
      return { washedAtFox: water.washedAt(x, z), inkAtFox: water.inkAt(x, z),
        ground: col.groundAt(x, z, y + 0.15).y,
        groundTag: col.groundAt(x, z, y + 0.15).collider?.tag ?? 'terrain',
        sourceSupply: w.reactor.supply, holdLeft: w.reactor.holdLeft,
        washedSamples: Array.from({ length: 7 }, (_, i) => {
          const x = 57 + (62.034 - 57) * i / 6, z = 36 + (32.736 - 36) * i / 6;
          return { x, z, washed: water.washedAt(x, z), ink: water.inkAt(x, z), bedY: col.groundAt(x, z, 0.4).y };
        }) };
    }, state.pos);
    timeline.push({ frame, t: state.t, phase: label, pos: state.pos, vel: state.vel, grounded: state.grounded,
      deaths: state.deaths, water: state.chem.water.find(w => w.id === 'marsh-mouth'), ...physical });
    return physical;
  };
  const steer = async (x, z, state) => {
    const dx = x - state.pos[0], dz = z - state.pos[2], d = Math.hypot(dx, dz), mag = Math.min(1, d / 0.5);
    const stick = d > 0.03 ? [dx / d * mag, dz / d * mag] : [0, 0];
    await H('setStick', ...stick); return { distance: d, stick };
  };
  await video(name, 14 * fps, async frame => {
    const st = await H('state');
    await record(frame, st);
    if (lastPhase !== phase) {
      transitions.push({ phase, frame, t: st.t, pos: st.pos });
      await shot(`${name}-${String(transitions.length).padStart(2, '0')}-${phase}`); lastPhase = phase;
    }
    if (st.deaths > initial.deaths) { failure = 'death'; finished = true; await H('setStick', 0, 0); await H('setKeys', []); return; }
    let stick = [0, 0], keys = [];
    if (phase === 'boardwalk' || phase === 'return') {
      const target = approach[waypoint], result = await steer(...target, st); stick = result.stick;
      if (result.distance < 0.24) { waypoint++; if (waypoint >= approach.length) change(phase === 'return' ? 'cross' : 'melt', frame); }
    } else if (phase === 'melt') {
      await H('setStick', 0, 0);
      const water = st.chem.water.find(w => w.id === 'marsh-mouth');
      if (water.wetMeters >= water.length - 0.05) {
        if (!flowingCaptured) { await overview('flowing'); flowingCaptured = true; }
        change(variant === 'dash' ? 'retreat-dash' : 'cross', frame);
      } else if (frame - phaseAt > 4 * fps) { failure = 'melt/front timeout'; finished = true; }
    } else if (phase === 'retreat-dash') {
      // Stamp the source while retreating along the same safe boardwalk. A forward
      // 16 m/s dash into cold water would outrun its 8 m/s advancing front.
      const dx = 54 - 56.6, dz = 40 - 36.5, d = Math.hypot(dx, dz); stick = [dx / d, dz / d];
      await H('setStick', ...stick);
      if (!dashSent) { keys = ['ShiftLeft']; dashSent = true; }
      if (frame - phaseAt > 0.3 * fps) change('return', frame);
    } else if (phase === 'cross') {
      const target = crossing[waypoint], result = await steer(...target, st); stick = result.stick;
      if (result.distance < 0.28) { waypoint++; if (waypoint >= crossing.length) { crossedAt = st.t; change('crossed', frame); finished = true; } }
    } else await H('setStick', 0, 0);
    if (frame > 13.5 * fps) { failure = 'route timeout'; finished = true; }
    input.push({ frame, phase, stick, keys }); await H('setKeys', keys);
  }, () => finished);
  await H('setKeys', []); await H('setStick', 0, 0); await advance(1);
  await shot(`${name}-crossing-end`);
  const crossed = await H('state');
  // Retain natural supply loss → hold → refreeze. Fixed 60Hz sim, 0.1s observations;
  // no staged reset and no temporary element flag is changed.
  let warningCaptured = false, refrozen = false;
  for (let i = 0; i < 140; i++) {
    await advance(6, false);
    const st = await H('state'), water = st.chem.water.find(w => w.id === 'marsh-mouth');
    await record(`cool-${i}`, st, 'cooling');
    if (!warningCaptured && water.state === 'guttering') { await overview('refreezing'); warningCaptured = true; }
    if (water.state === 'cold' && water.wetMeters === 0) { refrozen = true; break; }
  }
  await overview('refrozen'); await H('setStick', null);
  const end = await H('state');
  const passed = crossedAt !== null && crossed.grounded && Math.hypot(crossed.pos[0] - 64.5, crossed.pos[2] - 31.4) < 0.8 && end.deaths === initial.deaths;
  const acceptance = { variant, trial, passed, failure, crossedAt, endOfCrossing: crossed.pos, deaths: end.deaths - initial.deaths,
    dashSent, flowingCaptured, warningCaptured, refrozen, transitions, metrics: end.feel,
    provenance: 'Fresh game required. One STAGED start at(54,40); real world-stick controller movement afterward. Aura trial uses no dash. Dash trial naturally warms water, stamps the source with a safe retreat dash, then crosses within stroke life. No forced element or intermediate reset. Overview stills use a labelled fixed photo lens; traversal video uses chase camera.',
    game: await page.evaluate(() => window.__game) };
  save(`${name}-acceptance.json`, acceptance); save(`${name}-timeline.json`, timeline); save(`${name}-input.json`, input);
  if (!passed) report?.failures.push(`${name}: ${failure ?? 'crossing not reached'}, deaths=${acceptance.deaths}, end=${crossed.pos}`);
  console.log('MARSHMOUTH', JSON.stringify(acceptance));
  return acceptance;
}
