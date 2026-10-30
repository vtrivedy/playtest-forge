/** Real-input wind-gap transfer test. Caller boots a fresh game and passes its live page. */
export async function captureWindGap({ H, advance, shot, video, save, page, fps, report }) {
  const norm = Math.hypot(0.684, 0.729), dx = -0.684 / norm, dz = -0.729 / norm;
  const toWorld = (s, t) => [-48 + dx * s - dz * t, 52 + dz * s + dx * t];
  const toTerrace = ([x, , z]) => ({ s: (x + 48) * dx + (z - 52) * dz, t: -(x + 48) * dz + (z - 52) * dx });
  const expectedSource = toWorld(38.8, 2.5);
  const windSpot = await page.evaluate(([ex, ez]) => {
    const spots = window.__gameHooks.debug.world.windSpots;
    return spots.map(w => ({ ...w, distance: Math.hypot(w.source[0] - ex, w.source[2] - ez) })).sort((a, b) => a.distance - b.distance)[0];
  }, expectedSource);
  if (!windSpot || windSpot.distance > 3) throw Error('Wind-gap capture requires the terrace current at sp(38.8,2.5)');
  const start = toWorld(37, 2.5);
  await H('setKeys', []); await H('setStick', 0, 0);
  await H('teleport', start[0], 14, start[1], Math.atan2(dx, dz));
  await advance(12);
  const initial = await H('state');
  await shot('windgap-00-staged-approach');
  const timeline = [], transitions = [];
  let phase = 'approach', phaseAt = 0, lastPhase = '', finished = false, airborne = false;
  const change = (next, frame) => { phase = next; phaseAt = frame; };
  const aim = async (s, t, st) => {
    const [x, z] = toWorld(s, t), ax = x - st.pos[0], az = z - st.pos[2], d = Math.hypot(ax, az);
    const mag = Math.min(1, d / 0.6);
    await H('setStick', d > 0.03 ? ax / d * mag : 0, d > 0.03 ? az / d * mag : 0);
  };
  await video('windgap-transfer', 12 * fps, async frame => {
    const st = await H('state'), terrace = toTerrace(st.pos);
    const current = st.chem.wind.find(w => w.id === windSpot.id);
    timeline.push({ frame, t: st.t, phase, pos: st.pos, vel: st.vel, terrace, grounded: st.grounded,
      gliding: st.gliding, current, deaths: st.deaths, feel: st.feel, camera: st.camera });
    if (lastPhase !== phase) {
      transitions.push({ phase, frame, t: st.t, pos: st.pos, terrace });
      await shot(`windgap-${String(transitions.length).padStart(2, '0')}-${phase}`);
      lastPhase = phase;
    }
    if (st.deaths !== initial.deaths) { change('failed-respawn', frame); finished = true; await H('setStick', 0, 0); await H('setKeys', []); return; }
    let keys = [];
    if (phase === 'approach') {
      await aim(38.7, 2.5, st);
      if (terrace.s >= 38.45) change('wake', frame);
    } else if (phase === 'wake') {
      await H('setStick', 0, 0);
      if (current.heat >= 0.98) change('jump', frame);
      else if (frame - phaseAt > 4 * fps) { change('failed-wake', frame); finished = true; }
    } else if (phase === 'jump' || phase === 'glide') {
      keys = ['Space']; await aim(63.5, 2.5, st);
      if (!st.grounded) airborne = true;
      if (phase === 'jump' && st.gliding) change('glide', frame);
      if (airborne && st.grounded) {
        change(terrace.s >= 60.45 && st.pos[1] >= 13.8 ? 'landed-far-terrace' : 'failed-low-catch', frame);
        finished = true;
      } else if (terrace.s > 65 || frame - phaseAt > 8 * fps) { change('failed-no-landing', frame); finished = true; }
    } else await H('setStick', 0, 0);
    await H('setKeys', keys);
  }, () => finished);
  await H('setKeys', []); await H('setStick', 0, 0); await advance(1);
  await shot('windgap-final');
  const end = await H('state'), terrace = toTerrace(end.pos);
  const crossing = timeline.filter(r => r.terrace.s >= 40.5 && r.terrace.s <= 60.5);
  const passed = phase === 'landed-far-terrace' && end.grounded && terrace.s >= 60.45 && end.pos[1] >= 13.8 && end.deaths === initial.deaths;
  const acceptance = {
    provenance: 'One STAGED start at sp(37,2.5), y14. Live world-stick approach, natural aura wake, held jump/glide thereafter. No forced element, movement, restore or intermediate teleport.',
    current: windSpot, phase, transitions, passed, end: end.pos, terrace, deaths: end.deaths - initial.deaths,
    crossingFrames: crossing.length, crossingSeconds: crossing.length / fps,
    minimumGapFeetY: crossing.length ? Math.min(...crossing.map(r => r.pos[1])) : null,
    minimumGapHeat: crossing.length ? Math.min(...crossing.map(r => r.current.heat)) : null,
    maxHeight: Math.max(...timeline.map(r => r.pos[1])), metrics: end.feel,
    game: await page.evaluate(() => window.__game),
  };
  save('windgap-acceptance.json', acceptance); save('windgap-timeline.json', timeline);
  if (!passed) report?.failures.push(`Windmill gap failed: phase=${phase}, s=${terrace.s.toFixed(2)}, y=${end.pos[1].toFixed(2)}`);
  await H('setStick', null);
  console.log('WINDGAP', JSON.stringify(acceptance));
  return acceptance;
}
