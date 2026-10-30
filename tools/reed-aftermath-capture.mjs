/** Continues a successful live SW2 solve. Never boots, restores or resets position. */
export async function captureReedAftermath({ H, advance, shot, video, save, page, fps, report }) {
  const initial = await H('state');
  if (!initial.seedwells.find(s => s.id === 'SW2').lit) throw Error('Reed aftermath requires the preceding real SW2 latch');
  const authored = await page.evaluate(() => {
    const r = window.__gameHooks.debug.world.reedRegion;
    return { causeway: r.causeway.map(p => p.toArray()), page: r.ruinPage.toArray(), pageFound: r.pageFound };
  });
  await H('setKeys', []); await H('setStick', 0, 0); await advance(2);
  await shot('reed-aftermath-00-live-latched-source');
  const timeline = [], input = [], transitions = [];
  const descend = [[110, 32], [110, 34], [110, 36], [110, 38], [110, 40], [110, 42]];
  const ascend = [[110, 40], [110, 38], [110, 36], [110, 34], [110, 32], [110, 31.8]];
  // The east wing bypass keeps the walk off the aqueduct's raised recovery roofs.
  const marsh = [[115, 31.8], [115, 6], [110, 0], [95, 0], [82, 0], [70, 0]];
  let phase = 'glide-to-ruin', phaseAt = 0, lastPhase = '', waypoint = 0, airborne = false;
  let finished = false, failure = null, bestDistance = Infinity, progressAt = 0, pageFoundAt = null;
  const change = (next, frame) => { phase = next; phaseAt = frame; waypoint = 0; bestDistance = Infinity; progressAt = frame; };
  const steer = async (x, z, st, cap) => {
    const dx = x - st.pos[0], dz = z - st.pos[2], d = Math.hypot(dx, dz), mag = Math.min(cap, d / 0.7);
    const stick = d > 0.05 ? [dx / d * mag, dz / d * mag] : [0, 0];
    await H('setStick', ...stick); return { distance: d, stick };
  };
  await video('reed-aftermath-live', 45 * fps, async frame => {
    const st = await H('state');
    const physical = await page.evaluate(([x, y, z]) => {
      const world = window.__gameHooks.debug.world, g = world.collision.groundAt(x, z, y + 0.25);
      return { pageFound: world.reedRegion.pageFound, ground: g.y, groundTag: g.collider?.tag ?? 'terrain',
        causewayEnabled: world.collision.colliders.filter(c => c.tag === 'reed-causeway' && c.enabled).length };
    }, st.pos);
    timeline.push({ frame, t: st.t, phase, waypoint, pos: st.pos, vel: st.vel, grounded: st.grounded,
      gliding: st.gliding, deaths: st.deaths, feel: st.feel, camera: st.camera, ...physical });
    if (physical.pageFound && pageFoundAt === null) pageFoundAt = st.t;
    if (phase !== lastPhase) {
      transitions.push({ phase, frame, t: st.t, pos: st.pos });
      await shot(`reed-aftermath-${String(transitions.length).padStart(2, '0')}-${phase}`); lastPhase = phase;
    }
    let keys = [], stick = [0, 0];
    if (st.deaths > initial.deaths) { failure = 'respawn during restored exploration'; finished = true; }
    if (!finished && phase === 'glide-to-ruin') {
      keys = ['Space']; const aim = await steer(110, 31.8, st, 0.8); stick = aim.stick;
      if (!st.grounded) airborne = true;
      if (airborne && st.grounded) {
        if (aim.distance < 1 && st.pos[1] < 1) change('ruin-descent', frame);
        else { failure = 'glide landed before ruin stair'; finished = true; }
      } else if (frame - phaseAt > 12 * fps) { failure = 'glide did not reach ruin stair'; finished = true; }
    } else if (!finished && ['ruin-descent', 'ruin-ascent', 'restored-marsh', 'causeway'].includes(phase)) {
      const path = phase === 'ruin-descent' ? descend : phase === 'ruin-ascent' ? ascend : phase === 'restored-marsh' ? marsh : authored.causeway.map(p => [p[0], p[2]]);
      const cap = phase.startsWith('ruin-') ? 0.4 : 1;
      const target = path[waypoint], aim = await steer(...target, st, cap); stick = aim.stick;
      if (aim.distance < bestDistance - 0.12) { bestDistance = aim.distance; progressAt = frame; }
      if (aim.distance < (phase.startsWith('ruin-') ? 0.3 : 0.6)) {
        waypoint++; bestDistance = Infinity; progressAt = frame;
        if (waypoint >= path.length) {
          if (phase === 'ruin-descent') change('page', frame);
          else if (phase === 'ruin-ascent') change('restored-marsh', frame);
          else if (phase === 'restored-marsh') change('causeway', frame);
          else { change('hill-entry', frame); finished = true; }
        }
      } else if (frame - progressAt > 3 * fps) { failure = `physical stall in ${phase} at waypoint${waypoint}:${target}`; finished = true; }
    } else if (!finished && phase === 'page') {
      await H('setStick', 0, 0);
      if (physical.pageFound) { await shot('reed-aftermath-page-found'); change('ruin-ascent', frame); }
      else if (frame - phaseAt > 2 * fps) { failure = 'reached room but pressed page did not register'; finished = true; }
    }
    if (frame >= 44.5 * fps) { failure = '45s aftermath deadline'; finished = true; }
    if (finished) { keys = []; stick = [0, 0]; await H('setStick', 0, 0); }
    input.push({ frame, phase, stick, keys }); await H('setKeys', keys);
  }, () => finished);
  await H('setKeys', []); await H('setStick', 0, 0); await advance(1); await shot('reed-aftermath-final');
  const end = await H('state'), found = await page.evaluate(() => window.__gameHooks.debug.world.reedRegion.pageFound);
  const target = authored.causeway.at(-1);
  const reachedHill = end.grounded && Math.hypot(end.pos[0] - target[0], end.pos[2] - target[2]) < 1.3 && end.pos[1] > 11.5;
  const acceptance = { passed: found && reachedHill && end.deaths === initial.deaths, phase, failure,
    provenance: 'Continuous continuation of actual SW2 latch. No boot, forced restore or position reset. Live jump/glide to ruin stair, walk to pressed page and back, restored-ground walk around recovery wings, then authored causeway to hill. Actual follow camera throughout.',
    start: initial.pos, end: end.pos, failedPhysicalPosition: failure ? end.pos : null,
    deaths: end.deaths - initial.deaths, pageFound: found, pageFoundAt, reachedHill, transitions, authored,
    metrics: end.feel, game: await page.evaluate(() => window.__game) };
  save('reed-aftermath-acceptance.json', acceptance); save('reed-aftermath-timeline.json', timeline); save('reed-aftermath-input.json', input);
  if (!acceptance.passed) report?.failures.push(`Reed aftermath:${failure ?? phase}, page=${found}, hill=${reachedHill}, end=${end.pos}`);
  const { game: _game, authored: _authored, ...metadata } = acceptance;
  console.log('REED_AFTERMATH', JSON.stringify(metadata)); await H('setStick', null); return acceptance;
}
