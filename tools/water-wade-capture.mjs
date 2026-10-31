/** Remote-only water visibility comparison; staged starts and tracking photo lenses. */
export async function captureWadeVisibility({ H, boot, video, shot, save, getPage, fps, quality }) {
  const views = [
    { name: 'side', offset: [0, 1.3, 5] },
    { name: 'rear-quarter', offset: [-4, 1.6, 1] },
    { name: 'low', offset: [-3, 0.75, 3] },
  ];
  const summary = [];
  for (const view of views) for (const enabled of [false, true]) {
    await boot(quality, true);
    await H('teleport', -22, -0.75, 70, Math.PI / 2);
    await H('setStick', 0, 0); await H('setKeys', []); await H('advance', 30, 1 / 60, false);
    const start = await H('state');
    const name = `pond-wade-${view.name}-${enabled ? 'focus' : 'authored'}`;
    const end = await video(name, 3 * fps, async () => {
      await H('setStick', 0.18, 0);
    }, undefined, {
      traceEveryFrame: true,
      keyFrames: [0, fps, 2 * fps, 3 * fps - 1],
      afterStep: async (_, state) => {
        const [x, y, z] = state.pos, [dx, dy, dz] = view.offset;
        await H('photo', [x + dx, y + dy, z + dz], [x, y + 0.4, z], 46);
        if (!enabled) await getPage().evaluate(() => {
          window.__gameHooks.debug.scene.traverse(o => {
            const focus = o.material?.uniforms?.uFocus;
            if (focus) focus.value.w = 0;
          });
        });
      },
      sample: async () => getPage().evaluate(() => {
        const focus = [];
        window.__gameHooks.debug.scene.traverse(o => {
          const uniform = o.material?.uniforms?.uFocus;
          if (uniform) focus.push({ water: o.position.toArray(), feet: uniform.value.toArray() });
        });
        return { waterVisibilityFocus: focus };
      }),
    });
    await H('setStick', null); await shot(`${name}-end`);
    if (end.deaths !== start.deaths) throw Error(`Wading visibility comparison died: ${name}`);
    summary.push({ name, enabled, view: view.offset, start: start.pos, end: end.pos, deaths: end.deaths - start.deaths });
  }
  save('pond-wade-visibility.json', {
    label: 'Staged fresh starts; identical live inputs; fixed world-offset tracking photo lenses. Not gameplay-camera route proof.',
    secondsPerVariant: 3, focusOffMethod: 'Only uFocus.w zeroed after simulation before draw', variants: summary,
  });
}
