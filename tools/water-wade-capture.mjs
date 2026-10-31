/** Remote-only water visibility comparison; staged starts and tracking photo lenses. */
export async function captureWadeVisibility({ H, boot, video, shot, save, getPage, fps, quality }) {
  const views = [
    { name: 'side', offset: [0, 1.3, 5] },
    { name: 'rear-quarter', offset: [-4, 1.6, 1] },
    { name: 'low', offset: [-3, 0.75, 3] },
  ];
  const summary = [];
  for (const view of views) {
    await boot(quality, true);
    await H('teleport', -22, -0.75, 70, Math.PI / 2);
    await H('setStick', 0, 0); await H('setKeys', []); await H('advance', 30, 1 / 60, false);
    const start = await H('state');
    const name = `pond-wade-${view.name}`;
    const before = await getPage().evaluate(() => {
      const h = window.__gameHooks, d = h.debug.scene.userData.waterCapture;
      const buffer = h.debug.post.composer.readBuffer;
      return { waterScene: d ? { ...d } : null, expected: { width: buffer.width, height: buffer.height, type: buffer.texture.type, shadowType: h.debug.renderer.shadowMap.type } };
    });
    const end = await video(name, 3 * fps, async () => {
      await getPage().evaluate(() => {
        const d = window.__gameHooks.debug.scene.userData.waterCapture;
        if (d) d.checkNextCopy = true;
      });
      await H('setStick', 0.18, 0);
    }, undefined, {
      traceEveryFrame: true,
      keyFrames: [0, fps, 2 * fps, 3 * fps - 1],
      afterStep: async (_, state) => {
        const [x, y, z] = state.pos, [dx, dy, dz] = view.offset;
        await H('photo', [x + dx, y + dy, z + dz], [x, y + 0.4, z], 46);
      },
      sample: async () => getPage().evaluate(() => {
        return { waterScene: window.__gameHooks.debug.scene.userData.waterCapture ?? null };
      }),
    });
    await H('setStick', null); await shot(`${name}-end`);
    const after = await getPage().evaluate(() => {
      const h = window.__gameHooks, d = h.debug.scene.userData.waterCapture;
      const buffer = h.debug.post.composer.readBuffer;
      return { waterScene: d ? { ...d } : null, expected: { width: buffer.width, height: buffer.height, type: buffer.texture.type, shadowType: h.debug.renderer.shadowMap.type }, finalGlError: h.debug.renderer.getContext().getError() };
    });
    const d = after.waterScene, initial = before.waterScene, expected = after.expected;
    const rendererPassed = !!d && !!initial && d.copies > initial.copies && d.checkedCopies > initial.checkedCopies
      && d.shadowTypeAtFirstPrepare === 1 && expected.shadowType === 1
      && d.type === 1016 && d.type === expected.type && d.width === expected.width && d.height === expected.height
      && !d.glError && !d.priorGlError && !d.invalidTargets && !after.finalGlError;
    save(`${name}-renderer.json`, { before, after, rendererPassed });
    if (!rendererPassed) throw Error(`Wading renderer gate failed: ${name}; see ${name}-renderer.json`);
    if (end.deaths !== start.deaths) throw Error(`Wading visibility comparison died: ${name}`);
    summary.push({ name, view: view.offset, start: start.pos, end: end.pos, deaths: end.deaths - start.deaths, rendererPassed, renderer: `${name}-renderer.json` });
  }
  save('pond-wade-visibility.json', {
    label: 'Staged fresh starts; identical live inputs; fixed world-offset tracking photo lenses. Not gameplay-camera route proof.',
    secondsPerView: 3, water: 'Current scene refraction; no opacity override', views: summary,
  });
}
