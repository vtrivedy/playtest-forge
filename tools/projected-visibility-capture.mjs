/** Remote GPU mask evidence. Counts opaque-scene coverage, never artistic quality. */
export function projectedVisibilityReview({ getPage, fs, path, out, name, save, fps }) {
  const fractions = [], heights = [], worst = [];
  let edgeFrames = 0;
  let samples = 0, invalid = 0, errors = 0, amodalMass = 0, visibleMass = 0;
  return {
    async sample(frame) {
      // boot() enables setManual(true); only the video loop advances simulation.
      const sampleTime = await getPage().evaluate(() => window.__gameHooks.state().t);
      const result = await getPage().evaluate(() => window.__gameHooks.debug.cameraVisibility?.measure() ?? null);
      if (!result) return null;
      samples++;
      const valid = result.amodalPixels > 0 && result.targetMeshes > 0 && Number.isFinite(result.fraction)
        && result.fraction >= 0 && result.fraction <= 1.001 && result.glError === 0;
      if (result.glError) errors++;
      if (!valid) invalid++;
      else {
        fractions.push(result.fraction); heights.push(result.projectedHeightFraction);
        if (result.touchesViewportEdge) edgeFrames++;
        amodalMass += result.amodalPixels; visibleMass += result.visiblePixels;
      }
      const fraction = valid ? result.fraction : -1, bucket = Math.floor(frame / fps);
      const same = worst.findIndex(record => record.bucket === bucket);
      const largest = worst.reduce((index, record, i) => index < 0 || record.fraction > worst[index].fraction ? i : index, -1);
      const replace = same >= 0 ? fraction < worst[same].fraction : worst.length < 6 || fraction < worst[largest].fraction;
      if (replace) {
        const masks = await getPage().evaluate(() => window.__gameHooks.debug.cameraVisibility.captureLast());
        if (!masks) throw Error('Visibility probe has no matching mask images');
        const record = { frame, bucket, fraction, valid, masks, real: await getPage().screenshot({ type: 'png' }) };
        if (await getPage().evaluate(() => window.__gameHooks.state().t) !== sampleTime) throw Error('Visibility evidence advanced outside the manual frame');
        if (same >= 0) worst[same] = record;
        else if (worst.length < 6) worst.push(record);
        else worst[largest] = record;
      }
      return { ...result, valid };
    },
    async finish() {
      const evidence = [];
      for (const record of worst.sort((a, b) => a.fraction - b.fraction)) {
        const stem = `${name}-visibility-${String(record.frame).padStart(5, '0')}`;
        for (const key of ['amodal', 'visible']) fs.writeFileSync(path.join(out, `${stem}-${key}.png`), Buffer.from(record.masks[key].split(',')[1], 'base64'));
        fs.writeFileSync(path.join(out, `${stem}-real.png`), record.real);
        evidence.push({ frame: record.frame, fraction: record.fraction, valid: record.valid,
          amodal: `${stem}-amodal.png`, visible: `${stem}-visible.png`, real: `${stem}-real.png` });
      }
      const sorted = [...fractions].sort((a, b) => a - b);
      const result = { method: 'physical-fox-vs-opaque-world-pixels', samples, invalid, errors,
        minimum: sorted[0] ?? null, mean: fractions.length ? fractions.reduce((a, b) => a + b, 0) / fractions.length : null,
        pixelMassFraction: amodalMass ? visibleMass / amodalMass : null,
        framesAtLeastHalfBody: fractions.filter(value => value >= .5).length,
        framesAtLeast95PercentBody: fractions.filter(value => value >= .95).length,
        minimumProjectedHeight: heights.length ? Math.min(...heights) : null,
        framesAtLeast12PercentHeight: heights.filter(value => value >= .12).length,
        viewportEdgeFrames: edgeFrames,
        evidence, scope: 'Opaque/alpha-tested Standard/Basic world vs physical Standard fox; excludes refraction, glass, volumes and wisps. Masks must be inspected. Not artistic readability.' };
      save(`${name}-projected-visibility.json`, result);
      await getPage().evaluate(() => window.__gameHooks.debug.cameraVisibility?.dispose());
      return result;
    },
  };
}
