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

/** pull the tapped stems out of the page (base64 int16: float JSON of minutes of audio exhausts the heap) and write
 *  stem-<name>.wav + mix.wav (stem sum) into `out`; returns the recorded seconds */
export async function saveStems(page, out, names = ['music', 'ambience', 'sfx']) {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const sr = await page.evaluate(() => window.__gameHooks.audioContext().sampleRate);
  const S = {};
  for (const k of names) {
    S[k] = [];
    for (const c of [0, 1]) {
      const b64 = await page.evaluate(({ k, c }) => {
        const chunks = window.__stems[k][c];
        const n = chunks.reduce((a, x) => a + x.length, 0);
        const o = new Int16Array(n);
        let i = 0;
        for (const x of chunks) for (let j = 0; j < x.length; j++) o[i++] = Math.max(-32768, Math.min(32767, Math.round(x[j] * 32767)));
        const u8 = new Uint8Array(o.buffer);
        let s = '';
        for (let j = 0; j < u8.length; j += 0x8000) s += String.fromCharCode(...u8.subarray(j, j + 0x8000));
        return btoa(s);
      }, { k, c });
      const buf = Buffer.from(b64, 'base64');
      S[k].push(new Int16Array(buf.buffer, buf.byteOffset, buf.length / 2));
    }
  }
  const n = Math.min(...Object.values(S).flatMap((x) => x.map((c) => c.length)));
  const wav = (name, L, R) => {
    const buf = Buffer.alloc(44 + n * 4);
    buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
    buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(sr, 24);
    buf.writeUInt32LE(sr * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
    for (let i = 0; i < n; i++) { buf.writeInt16LE(Math.max(-32768, Math.min(32767, L(i))), 44 + i * 4); buf.writeInt16LE(Math.max(-32768, Math.min(32767, R(i))), 46 + i * 4); }
    fs.writeFileSync(path.join(out, `${name}.wav`), buf);
  };
  for (const k of names) wav(`stem-${k}`, (i) => S[k][0][i], (i) => S[k][1][i]);
  wav('mix', (i) => names.reduce((a, k) => a + S[k][0][i], 0), (i) => names.reduce((a, k) => a + S[k][1][i], 0));
  return n / sr;
}
