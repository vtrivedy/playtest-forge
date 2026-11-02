/**
 * Offline Hearthsong render for listening (hearthsong.html, tools/hearthsong-render.mjs): a scripted walk through
 * the places with the colour coming back and a few moments, rendered faster than real time to PCM.
 */
import { createMusic } from './music';
import { PLACES } from './score';
import { MIX } from '../audio';

type Leg = { t: number; place: string; restored: number; cue?: boolean };

/** default listening walk: sepia village → hearth (lit, cue) → canopy → ruin → glyphs → keeping (cue) → vista */
export const WALK: Leg[] = [
  { t: 0, place: 'village', restored: 0 },
  { t: 25, place: 'hearth', restored: 0.05 },
  { t: 32, place: 'hearth', restored: 0.2, cue: true },
  { t: 60, place: 'canopy', restored: 0.35 },
  { t: 75, place: 'canopy', restored: 0.45, cue: true },
  { t: 100, place: 'ruin', restored: 0.5 },
  { t: 130, place: 'glyphs', restored: 0.6 },
  { t: 150, place: 'keeping', restored: 0.8, cue: true },
  { t: 185, place: 'vista', restored: 1 },
  { t: 210, place: 'village', restored: 1, cue: true },
];

export async function renderHearthsong(seconds: number, walk: Leg[] = WALK, seed = 1): Promise<{ sr: number; l: string; r: string; marks: Leg[] }> {
  const sr = 48000;
  const ac = new OfflineAudioContext(2, Math.ceil(sr * seconds), sr);
  const bus = ac.createGain();
  bus.gain.value = MIX.music;
  bus.connect(ac.destination);
  const m = createMusic(ac, bus, seed);
  if (!(await m.ready)) throw new Error('worklet failed');
  const at = (id: string) => PLACES.find((p) => p.id === id)!;
  let li = 0;
  for (let t = 0; t < seconds; t += 0.1) {
    while (li + 1 < walk.length && walk[li + 1]!.t <= t) {
      li++;
      if (walk[li]!.cue) m.cue(walk[li]!.t);
    }
    const a = walk[li]!;
    const b = walk[Math.min(walk.length - 1, li + 1)]!;
    // travel takes the last 8 s of each leg
    const k = b.t > a.t ? Math.min(1, Math.max(0, (t - (b.t - 8)) / 8)) : 0;
    const pa = at(a.place);
    const pb = at(b.place);
    m.update(pa.x + (pb.x - pa.x) * k, pa.z + (pb.z - pa.z) * k, a.restored + (b.restored - a.restored) * k, t);
  }
  const buf = await ac.startRendering();
  const enc = (d: Float32Array) => {
    const i16 = new Int16Array(d.length);
    for (let i = 0; i < d.length; i++) i16[i] = Math.max(-32768, Math.min(32767, Math.round(d[i]! * 32767)));
    const u8 = new Uint8Array(i16.buffer);
    let s = '';
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
    return btoa(s);
  };
  return { sr, l: enc(buf.getChannelData(0)), r: enc(buf.getChannelData(1)), marks: walk.filter((w) => w.t < seconds) };
}
