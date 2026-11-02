# Recorder staging — bounded local experiment

`tools/recorder-staging.mjs` provides a capture-only helper. It copies the rendered WebGL canvas immediately to a persistent 2D canvas and explicitly requests that frame. It is **not enabled in the game or existing capture tools**. Kit's external landing recorder source was requested but is not present in this checkout. No game runtime, renderer setting, camera or controller changed.

Two real browser runs compare native WebGL captureStream(30) and staged captureStream(0)/requestFrame on the same live rendered controller inputs. Each retains both WebM streams, screenshot, window.__game, decoded per-frame luminance and errors. Both start normally, use ordinary stick inputs and never force story progression. All encoded frames were decoded with ffmpeg and measured at32×18, using mean RGB luminance below12/255 as the full-dark threshold.

| Local run | Wall time | Render/push calls | Native decoded | Staged decoded | Dark frames |
| --- | ---: | ---: | ---: | ---: | ---: |
|480×270|21.718s|10|6|6|0 in either|
|160×90|40.028s|33|29|30|0 in either|

Zero JavaScript errors in either run. Minimum decoded luminance is139.53/136.05(native/staged) in the first run and139.87/136.23 in the second. These samples establish that the helper records the game locally and does not introduce black frames in these small samples. The GPU black blink is **not reproduced or resolved** by this experiment. Software rendering is extremely slow, and recorder frames can coalesce; push count is not an encoded-frame guarantee.

Reviewed both native screenshots: the fox and surrounding courtyard remain readable, with normal color aura and third-person view. The160px output is diagnostic only. No visual runtime correction was justified. The second run rechecks the helper with more encoded frames after the first run's sparse result. TypeScript, feel lint and camera release checks pass. Production build passes with the existing chunk-size warning.

## Integration into the external recorder

Import `installRecorderStaging` in Node and transfer its function source using the same method as the route factory. In the browser, call it once with the existing game WebGL canvas. Supply `stage.stream.getVideoTracks()` to the existing audio/video MediaRecorder, retaining its current audio track(s). In the existing driver, call `stage.push()` **synchronously immediately after each rendered advance**, before returning/yielding from that callback. Stop the MediaRecorder before calling `stage.stop()`. Merely running push in an unrelated timer would retain the original transient-buffer risk. The helper never asks for another WebGL context.

```js
const stage = installRecorderStaging(window.__opening.ctx.renderer.domElement);
const stream = new MediaStream([
  ...stage.stream.getVideoTracks(),
  ...window.__gameHooks.audioTap().getAudioTracks(),
]);
// Existing MediaRecorder and existing driver:
window.__gameHooks.advance(1, dt, true);
stage.push();
// After MediaRecorder has emitted its final data:
stage.stop();
```

Reproduce local A/B: `SIZE=160x90 SECONDS=40 node tools/recorder-staging-probe.mjs /captures/fern/recorder-staging-small`.

Artifacts: `/captures/fern/recorder-staging/` and `/captures/fern/recorder-staging-small/`. Compact evidence is [recorder-staging-results.json](recorder-staging-results.json). A live GPU A/B rerun remains required before recommending this as a fix. No integration or repaired-GPU claim is made.
