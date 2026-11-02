/**
 * A soft plucked-string note (Karplus–Strong), rendered once per pitch into a buffer: the creature and lantern notes
 * sit with the solo-harp music phrases instead of reading as bare sine tones (Flint :1426). Dark by construction:
 * a soft tonal excitation and a two-tap average with damping that rolls the top end off as it rings.
 */
const cache = new Map<string, AudioBuffer>();

export function pluck(ac: BaseAudioContext, hz: number, secs = 2.6): AudioBuffer {
  const key = `${Math.round(hz * 10)}:${secs}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const sr = ac.sampleRate;
  const n = Math.floor(sr * secs);
  const buf = ac.createBuffer(1, n, sr);
  const out = buf.getChannelData(0);
  const period = Math.max(2, Math.round(sr / hz));
  const line = new Float32Array(period);
  // a soft, tonal excitation (three partials + a breath of noise), so the attack is a gentle pluck, not a click
  for (let i = 0; i < period; i++) {
    const ph = (2 * Math.PI * i) / period;
    line[i] = Math.sin(ph) + 0.45 * Math.sin(2 * ph) + 0.2 * Math.sin(3 * ph) + 0.08 * (Math.random() * 2 - 1);
  }
  let idx = 0;
  let peak = 0;
  for (let i = 0; i < n; i++) {
    const a = line[idx]!;
    const b = line[(idx + 1) % period]!;
    line[idx] = 0.998 * 0.5 * (a + b);
    out[i] = a;
    peak = Math.max(peak, Math.abs(a));
    idx = (idx + 1) % period;
  }
  // normalise, short fade-in and a fade-out at the end of the buffer
  const fadeIn = Math.floor(sr * 0.006);
  const fadeOut = Math.floor(sr * 0.3);
  for (let i = 0; i < n; i++) {
    let g = 1 / (peak || 1);
    if (i < fadeIn) g *= i / fadeIn;
    if (i > n - fadeOut) g *= (n - i) / fadeOut;
    out[i]! *= g;
  }
  cache.set(key, buf);
  return buf;
}
