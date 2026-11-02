// Sample-exact stem recording off the main thread: an AudioWorklet tap batches each bus into 4096-frame chunks and
// posts them (port messages queue while the main thread is busy; nothing is dropped or repeated). The old
// ScriptProcessor taps ran on the main thread and, under SwiftShader load, dropped ~8 % of buffers and looped
// stale ones (a 15 s 'buzz' in a grand-route capture that was never in the game's output).
//   await page.evaluate(installStemTap, ['music', 'ambience', 'sfx'])  → window.__stems[name][ch] = Float32Array[]
export async function installStemTap(names) {
  const h = window.__gameHooks;
  const ac = h.audioContext();
  const b = h.audioBuses();
  const code = `class StemTap extends AudioWorkletProcessor {
    constructor() { super(); this.n = 0; this.l = new Float32Array(4096); this.r = new Float32Array(4096); }
    process(inputs) {
      const i = inputs[0];
      const L = i[0], R = i[1] || i[0];
      if (!L) return true;
      for (let k = 0; k < L.length; k++) { this.l[this.n] = L[k]; this.r[this.n] = R[k]; if (++this.n === 4096) { this.port.postMessage([this.l, this.r], [this.l.buffer, this.r.buffer]); this.l = new Float32Array(4096); this.r = new Float32Array(4096); this.n = 0; } }
      return true;
    }
  }
  registerProcessor('stem-tap', StemTap);`;
  await ac.audioWorklet.addModule(URL.createObjectURL(new Blob([code], { type: 'application/javascript' })));
  window.__stems = {};
  window.__keep = [];
  for (const name of names) {
    window.__stems[name] = [[], []];
    const tap = new AudioWorkletNode(ac, 'stem-tap', { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 2, channelCountMode: 'explicit' });
    tap.port.onmessage = (e) => { window.__stems[name][0].push(e.data[0]); window.__stems[name][1].push(e.data[1]); };
    const mute = ac.createGain();
    mute.gain.value = 0;
    b[name].connect(tap).connect(mute).connect(ac.destination);
    window.__keep.push(tap);
  }
}
