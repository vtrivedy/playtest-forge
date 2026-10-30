/** SW2 live solve. Caller boots fresh and passes its current page; one staged start only. */
export async function captureReed({ H, advance, shot, video, save, page, fps, report }) {
  const initial = await H('state');
  if (initial.seedwells.find(s => s.id === 'SW2').lit) throw Error('Reed capture requires an unlatched SW2');
  await H('setKeys', []); await H('setStick', 0, 0);
  await H('teleport', 90, 1.2, 15, Math.atan2(2.4, -2.4)); await advance(10);
  await shot('reed-00-staged-hummock');
  const timeline = [], input = [], transitions = [];
  const approach = [[92.4, 12.6], [95, 10], [98.4, 10.5], [96, 16.1], [95, 17]];
  let phase = 'pier-stair', phaseAt = 0, waypoint = 0, lastPhase = '', finished = false, failure = null;
  let overviewCaptured = false, litAt = null, hpAirborne = false, progressAt = 0, bestDistance = Infinity;
  const change = (next, frame) => { phase = next; phaseAt = frame; bestDistance = Infinity; progressAt = frame; };
  const steer = async (x, z, st, cap = 0.6) => {
    const dx = x - st.pos[0], dz = z - st.pos[2], d = Math.hypot(dx, dz), mag = Math.min(cap, d / 0.75);
    const stick = d > 0.06 ? [dx / d * mag, dz / d * mag] : [0, 0];
    await H('setStick', ...stick); return { distance: d, stick };
  };
  await video('reed-live-solve', 45 * fps, async frame => {
    const st = await H('state'), water = st.chem.water.find(w => w.id === 'reed-falls');
    const inlet = st.chem.inlets.find(q => q.seedwell === 'SW2');
    const hp = st.chem.hearths.find(h => h.id === 'HP');
    const physical = await page.evaluate(([x, y, z]) => {
      const col = window.__gameHooks.debug.world.collision, g = col.groundAt(x, z, y + 0.25);
      const source = window.__gameHooks.chem.water.waters.find(w => w.spot.id === 'reed-falls');
      return { ground: g.y, groundTag: g.collider?.tag ?? 'terrain', sourceSupply: source.reactor.supply,
        sourceHold: source.reactor.holdLeft, sourceRestored: source.reactor.restored };
    }, st.pos);
    timeline.push({ frame, t: st.t, phase, waypoint, pos: st.pos, vel: st.vel, grounded: st.grounded,
      gliding: st.gliding, water, inlet, hp, deaths: st.deaths, shades: st.shades,
      feel: st.feel, camera: st.camera, ...physical });
    if (phase !== lastPhase) {
      transitions.push({ phase, frame, t: st.t, pos: st.pos });
      await shot(`reed-${String(transitions.length).padStart(2, '0')}-${phase}`); lastPhase = phase;
    }
    let keys = [], stick = [0, 0];
    if (st.deaths > initial.deaths) { failure = 'respawn during physical route'; finished = true; }
    if (!finished && phase === 'pier-stair') {
      const target = approach[waypoint], aim = await steer(...target, st); stick = aim.stick;
      if (aim.distance < bestDistance - 0.12) { bestDistance = aim.distance; progressAt = frame; }
      if (aim.distance < 0.28) { waypoint++; bestDistance = Infinity; progressAt = frame; }
      if (waypoint >= approach.length) change('wake-HP', frame);
      else if (frame - progressAt > 3 * fps) { failure = `physical stair stall at waypoint${waypoint}:${approach[waypoint]}`; finished = true; }
    } else if (!finished && phase === 'wake-HP') {
      await H('setStick', 0, 0);
      if (hp.heat >= 0.95 && st.grounded && st.pos[1] >= 5.8) change('ride-HP', frame);
      else if (frame - phaseAt > 5 * fps) { failure = 'HP did not light on reachable pier'; finished = true; }
    } else if (!finished && phase === 'ride-HP') {
      keys = ['Space'];
      if (!st.grounded) hpAirborne = true;
      if (st.pos[1] > 7.1) { const aim = await steer(95, 18, st, 0.7); stick = aim.stick; }
      else await H('setStick', 0, 0);
      if (st.pos[1] >= 15.7) change('aqueduct-landing', frame);
      else if (frame - phaseAt > 8 * fps) { failure = 'HP ride did not reach aqueduct'; finished = true; }
    } else if (!finished && phase === 'aqueduct-landing') {
      keys = ['Space']; const aim = await steer(95.8, 19.8, st, 0.5); stick = aim.stick;
      if (hpAirborne && st.grounded && st.pos[1] >= 14.8) change('falls-lip', frame);
      else if (frame - phaseAt > 6 * fps) { failure = 'could not land on aqueduct'; finished = true; }
    } else if (!finished && phase === 'falls-lip') {
      const aim = await steer(100, 19, st, 0.45); stick = aim.stick;
      if (aim.distance < 0.4 && st.grounded && st.pos[1] >= 14.8) change('water-feed', frame);
      else if (frame - phaseAt > 5 * fps) { failure = 'physical obstruction on aqueduct lip'; finished = true; }
    } else if (!finished && phase === 'water-feed') {
      const aim = await steer(100, 19, st, 0.25); stick = aim.stick;
      if (!overviewCaptured && water.wetMeters >= water.length * 0.35) {
        // Explicitly staged lens only: source high on the aqueduct, moving front,
        // full flume and SW2 basin fit in the same retained shot.
        await H('photo', [114, 22, 31], [98, 8, 17], 50); await advance(1);
        await shot('reed-source-front-basin-overview'); await H('photoOff'); await advance(1); overviewCaptured = true;
      }
      if (st.seedwells.find(s => s.id === 'SW2').lit) { litAt = st.t; change('latched', frame); finished = true; }
      else if (frame - phaseAt > 22 * fps) { failure = 'arriving water did not complete 7s seal; inspect Shade cuts and inlet timeline'; finished = true; }
    }
    if (frame >= 44.5 * fps) { failure = '45s solve deadline'; finished = true; }
    if (finished) { keys = []; stick = [0, 0]; await H('setStick', 0, 0); }
    input.push({ frame, phase, stick, keys }); await H('setKeys', keys);
  }, () => finished);
  await H('setKeys', []); await H('setStick', 0, 0); await advance(1);
  await shot('reed-final');
  const end = await H('state');
  const passed = end.seedwells.find(s => s.id === 'SW2').lit && end.deaths === initial.deaths;
  const acceptance = {
    provenance: 'One STAGED start on hummock(90,15)y1.2. Live stick follows incoming island stair, east aqueduct stair, jump/hold HP column, aqueduct landing, sustained aura at frozen falls lip. No color, source, inlet, latch, velocity or intermediate position forced. Overview stages camera only.',
    passed, phase, failure, failedPhysicalPosition: failure ? end.pos : null, end: end.pos,
    deaths: end.deaths - initial.deaths, litAt, overviewCaptured, transitions,
    maxSeal: Math.max(...timeline.map(r => r.inlet.seal)), maxHeight: Math.max(...timeline.map(r => r.pos[1])),
    finalWater: end.chem.water.find(w => w.id === 'reed-falls'), finalInlet: end.chem.inlets.find(q => q.seedwell === 'SW2'),
    metrics: end.feel, updraftRide: end.chem.lastRide, game: await page.evaluate(() => window.__game),
  };
  save('reed-acceptance.json', acceptance); save('reed-timeline.json', timeline); save('reed-input.json', input);
  if (!passed) report?.failures.push(`Reed live solve failed:${failure ?? phase}, end=${end.pos}, maxSeal=${acceptance.maxSeal}`);
  const { game: _game, ...metadata } = acceptance; console.log('REED', JSON.stringify(metadata));
  await H('setStick', null); return acceptance;
}
