/** Windmill Rise acceptance. One labelled staged start; all subsequent motion is live controller input. */
export async function captureLevels({ boot, H, advance, shot, video, save, page, fps, quality, report }) {
  await boot(quality, true);
  const initial = await H('state');
  const hearth = initial.chem.hearths.find(h => h.id === 'H2');
  if (!hearth) throw Error('Levels capture requires H2');
  if (initial.seedwells[0].lit) throw Error('Levels capture must start with SW1 cold');
  const [hx, hy, hz] = hearth.pos;
  const controls = await page.evaluate(() => window.__gameHooks.debug.world.windSpots.find(w => w.id === 'wind-river').path);
  const path = [];
  for (let i = 0; i < controls.length - 1; i++) {
    const a = controls[i], b = controls[i + 1];
    const steps = Math.ceil(Math.hypot(b[0] - a[0], b[2] - a[2]) / 0.5);
    for (let j = 0; j < steps; j++) path.push(a.map((v, k) => v + (b[k] - v) * j / steps));
  }
  path.push(controls.at(-1));
  // Dash east along the inner side of the bowl, remaining on the 12.4 m ledge.
  const stagedStart = [hx - 3, hy, hz - 1.4];
  await H('teleport', ...stagedStart, Math.PI / 2);
  await H('setStick', 0, 0); await H('setKeys', []); await advance(8);
  await shot('levels-00-staged-cold-start');
  const timeline = [], transitions = [];
  let phase = 'dash', phaseAt = 0, lastPhase = '', nearest = 0, finished = false;
  let dashSent = false, latchedAt = null, enteredRiverAt = null;
  const phaseChange = (next, frame) => { phase = next; phaseAt = frame; };
  const aim = async (x, z, speed = 1) => {
    const st = timeline.at(-1), dx = x - st.pos[0], dz = z - st.pos[2], d = Math.hypot(dx, dz);
    await H('setStick', d > 0.08 ? dx / d * Math.min(speed, d / 0.75) : 0, d > 0.08 ? dz / d * Math.min(speed, d / 0.75) : 0);
  };
  await video('levels-kiln-to-hill', 40 * fps, async frame => {
    const st = await H('state');
    const h2 = st.chem.hearths.find(h => h.id === 'H2');
    timeline.push({ frame, t: st.t, phase, pos: st.pos, vel: st.vel, grounded: st.grounded, gliding: st.gliding,
      heat: h2.heat, supply: h2.supply, seal: st.chem.inlets[0].seal, lit: st.seedwells[0].lit,
      wisps: st.shades.wisps, deaths: st.deaths, feel: st.feel, camera: st.camera });
    if (phase !== lastPhase) {
      transitions.push({ phase, frame, t: st.t, pos: st.pos });
      await shot(`levels-${String(transitions.length).padStart(2, '0')}-${phase}`);
      lastPhase = phase;
    }
    if (st.deaths > initial.deaths) { phaseChange('failed-respawn', frame); finished = true; await H('setStick', 0, 0); await H('setKeys', []); return; }
    let keys = [];
    if (phase === 'dash') {
      await H('setStick', 1, 0);
      if (!dashSent) { keys = ['ShiftLeft']; dashSent = true; }
      if (st.pos[0] >= hx + 0.7 || frame > fps * 0.5) phaseChange('seal', frame);
    } else if (phase === 'seal') {
      await H('setStick', 0, 0);
      if (st.seedwells[0].lit) { latchedAt = st.t; phaseChange('takeoff', frame); }
      else if (frame - phaseAt > 10 * fps) { phaseChange('failed-latch', frame); finished = true; }
    } else if (phase === 'takeoff') {
      keys = ['Space'];
      // Centre the rider in the column after clearing the brazier's collision top.
      if (st.pos[1] > hy + 1.1) await aim(hx, hz);
      else await H('setStick', 0, 0);
      if (st.pos[1] >= 27.4) phaseChange('river', frame);
      else if (frame - phaseAt > 8 * fps) { phaseChange('failed-rise', frame); finished = true; }
    } else if (phase === 'river') {
      keys = ['Space'];
      let best = Infinity;
      // Monotonic progress avoids turning back toward a previous river segment.
      for (let j = Math.max(0, nearest - 4); j < path.length; j++) {
        const d = Math.hypot(st.pos[0] - path[j][0], st.pos[2] - path[j][2]);
        if (d < best) { best = d; nearest = j; }
      }
      const target = path[Math.min(path.length - 1, nearest + 8)];
      await aim(target[0], target[2]);
      if (best < 3 && enteredRiverAt === null) enteredRiverAt = st.t;
      if (nearest >= path.length - 9 || Math.hypot(st.pos[0] + 18, st.pos[2] + 65) < 4) phaseChange('land', frame);
      else if (st.grounded) { phaseChange('failed-river', frame); finished = true; }
    } else if (phase === 'land') {
      keys = ['Space']; await aim(-18, -65, 0.6);
      if (st.grounded) { phaseChange('landed', frame); finished = true; }
    } else { await H('setStick', 0, 0); }
    await H('setKeys', keys);
  }, () => finished);
  await H('setKeys', []); await H('setStick', null); await advance(1);
  await shot('levels-final');
  const end = await H('state');
  const landedArena = end.grounded && end.pos[0] > -36 && end.pos[0] < 5 && end.pos[2] < -45 && end.pos[2] > -78 && end.pos[1] >= 10;
  const acceptance = {
    provenance: 'STAGED initial ledge reset; live controller dash/jump/glide/world-stick input thereafter. No forced color, latch, restore, wind, velocity or position.',
    stagedStart, phase, transitions, latchedAt, enteredRiverAt, end: end.pos,
    sw1Latched: end.seedwells[0].lit, landedArena, deaths: end.deaths - initial.deaths,
    maxHeight: Math.max(...timeline.map(r => r.pos[1])),
    maxSeal: Math.max(...timeline.map(r => r.seal)), metrics: end.feel,
    updraftRide: end.chem.lastRide, game: await page.evaluate(() => window.__game),
    passed: end.seedwells[0].lit && landedArena && end.deaths === initial.deaths,
  };
  save('levels-acceptance.json', acceptance); save('levels-timeline.json', timeline);
  if (!acceptance.passed) report?.failures.push(`Windmill Rise keyboard route failed: phase=${phase}, SW1=${acceptance.sw1Latched}, arena=${landedArena}, end=${end.pos}`);
  console.log('LEVELS', JSON.stringify(acceptance));
  return acceptance;
}
