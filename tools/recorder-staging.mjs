/** Browser-side recorder staging. Call push() synchronously after the game's render.
 * Safe to transfer installRecorderStaging.toString() into a browser evaluate call.
 * A persistent 2D canvas decouples capture from WebGL's cleared default framebuffer.
 */
export function installRecorderStaging(source) {
  if (!(source instanceof HTMLCanvasElement)) throw new Error('Recorder source must be a canvas');
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const context = canvas.getContext('2d', {alpha:false});
  if (!context) throw new Error('Recorder staging needs a 2D context');
  const stream = canvas.captureStream(0);
  const track = stream.getVideoTracks()[0];
  if (typeof track?.requestFrame !== 'function') {
    stream.getTracks().forEach(track => track.stop());
    throw new Error('Recorder staging needs CanvasCaptureMediaStreamTrack.requestFrame');
  }
  let stopped = false;
  let frames = 0;
  return {
    canvas, stream,
    push() {
      if (stopped) throw new Error('Recorder staging has stopped');
      if (canvas.width !== source.width || canvas.height !== source.height) {
        canvas.width = source.width;
        canvas.height = source.height;
      }
      context.drawImage(source, 0, 0);
      track.requestFrame();
      frames++;
    },
    stop() {
      if (!stopped) stream.getTracks().forEach(track => track.stop());
      stopped = true;
    },
    get frames() { return frames; },
  };
}
