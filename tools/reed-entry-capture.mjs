/** Continuous Marsh Mouth → lily pads → SW2 entry. Caller retains the live game/page. */
export async function captureReedEntry({ H, advance, shot, video, save, page, fps, report }) {
  const initial = await H('state');
  if (Math.hypot(initial.pos[0] - 64.5, initial.pos[2] - 31.4) > 1.5) throw Error('Reed entry must continue the real Marsh Mouth crossing near(64.5,31.4)');
  const targets = [
    { id: 'near-hummock', x: 69, z: 28, y: 0.4 },
    { id: 'reed-pad-0', x: 73.5, z: 25, y: 0.25 },
    { id: 'reed-pad-1', x: 77.5, z: 22.5, y: 0.25 },
    { id: 'reed-pad-2', x: 81.5, z: 20, y: 0.25 },
    { id: 'reed-pad-3', x: 85.5, z: 17.5, y: 0.25 },
    { id: 'far-hummock', x: 90, z: 15, y: 1.2 },
  ];
  const timeline = [], input = [], landings = [];
  let targetIndex = 0, phase = 'release', releasedSteps = 0, airborne = false, finished = false, failure = null;
  let jumpAt = 0, lastLabel = '', bestDistance = Infinity, progressAt = 0;
  await H('setKeys', []); await H('setStick', 0, 0); await advance(1);
  await shot('reed-entry-00-live-boardwalk');
  await video('reed-entry-lily-pads', 20 * fps, async frame => {
    const st = await H('state'), target = targets[targetIndex];
    const physical = await page.evaluate(([x, y, z]) => {
      const world = window.__gameHooks.debug.world, g = world.collision.groundAt(x, z, y + 0.25);
      return { ground: g.y, groundTag: g.collider?.tag ?? 'terrain' };
    }, st.pos);
    const dx = target.x - st.pos[0], dz = target.z - st.pos[2], distance = Math.hypot(dx, dz);
    const padStates = st.chem.growth?.pads ?? [];
    timeline.push({ frame, t: st.t, phase, targetIndex, target, distance, pos: st.pos, vel: st.vel,
      grounded: st.grounded, gliding: st.gliding, deaths: st.deaths, pads: padStates,
      feel: st.feel, camera: st.camera, ...physical });
    const label = `${targetIndex}-${target.id}-${phase}`;
    if (lastLabel !== label) { await shot(`reed-entry-${label}`); lastLabel = label; }
    let keys = [], stick = [0, 0];
    if (st.deaths > initial.deaths) { failure = `death before ${target.id}`; finished = true; }
    if (!finished && phase === 'release') {
      await H('setStick', 0, 0);
      // Count simulation frames, not output frames (30fps capture steps twice).
      releasedSteps += 60 / fps;
      if (releasedSteps >= 3 && st.grounded) {
        phase = 'jump'; jumpAt = frame; airborne = false; bestDistance = Infinity; progressAt = frame;
      }
    } else if (!finished && phase === 'jump') {
      keys = ['Space'];
      const magnitude = Math.min(0.95, distance / 0.7);
      stick = distance > 0.06 ? [dx / distance * magnitude, dz / distance * magnitude] : [0, 0];
      await H('setStick', ...stick);
      if (!st.grounded) airborne = true;
      if (distance < bestDistance - 0.1) { bestDistance = distance; progressAt = frame; }
      if (airborne && st.grounded && Math.abs(st.pos[1] - target.y) < 0.4 && distance < 0.85) {
        landings.push({ target: target.id, frame, t: st.t, pos: st.pos, groundTag: physical.groundTag,
          pad: padStates.find(p => p.id === target.id) ?? null });
        await shot(`reed-entry-landed-${target.id}`);
        targetIndex++;
        if (targetIndex >= targets.length) { phase = 'hummock-reached'; finished = true; }
        else { phase = 'release'; releasedSteps = 0; keys = []; stick = [0, 0]; await H('setStick', 0, 0); }
      } else if (airborne && st.grounded && st.pos[1] < target.y - 0.6) {
        failure = `landed below ${target.id} on ${physical.groundTag}`; finished = true;
      } else if (frame - jumpAt > 4 * fps || frame - progressAt > 3 * fps) {
        failure = `physical jump/landing stall toward ${target.id}`; finished = true;
      }
    }
    if (frame >= 19.5 * fps) { failure = '20s lily-pad entry deadline'; finished = true; }
    if (finished) { keys = []; stick = [0, 0]; await H('setStick', 0, 0); }
    input.push({ frame, phase, targetIndex, stick, keys }); await H('setKeys', keys);
  }, () => finished);
  await H('setKeys', []); await H('setStick', 0, 0); await advance(1); await shot('reed-entry-final');
  const end = await H('state');
  const passed = landings.length === targets.length && end.grounded && Math.hypot(end.pos[0] - 90, end.pos[2] - 15) < 1 && Math.abs(end.pos[1] - 1.2) < 0.4 && end.deaths === initial.deaths;
  const acceptance = { passed, phase, failure, start: initial.pos, end: end.pos, failedPhysicalPosition: failure ? end.pos : null,
    deaths: end.deaths - initial.deaths, landings, metrics: end.feel, finalPads: end.chem.growth?.pads ?? [],
    provenance: 'Uninterrupted continuation from Marsh Mouth. No boot, teleport, forced element, restore or pad state. Real held jump/glide from boardwalk to near hummock, four naturally awakened lily pads, then far hummock. Three 60Hz simulation frames with jump released between landings. Follow camera throughout.',
    game: await page.evaluate(() => window.__game) };
  save('reed-entry-acceptance.json', acceptance); save('reed-entry-timeline.json', timeline); save('reed-entry-input.json', input);
  if (!passed) report?.failures.push(`Reed entry:${failure ?? phase}, landings=${landings.length}/6, end=${end.pos}`);
  const { game: _game, ...metadata } = acceptance; console.log('REED_ENTRY', JSON.stringify(metadata));
  await H('setStick', null); return acceptance;
}
