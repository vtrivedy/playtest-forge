/**
 * Offline Hearthsong render for listening (hearthsong.html, tools/hearthsong-render.mjs): a scripted walk through
 * the places with the colour coming back and a few moments, rendered faster than real time to PCM.
 */
import { createMusic } from './music';
import { PLACES, compileSong } from './score';
import { MIX } from '../audio';

type Leg = { t: number; place: string; restored: number; cue?: boolean; kind?: number; snow?: boolean };

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
  { t: 225, place: 'hollow', restored: 1, cue: true, kind: 1 },
  { t: 232, place: 'hollow', restored: 1, cue: true, kind: 1 },
  { t: 245, place: 'hollow', restored: 1, snow: true },
  { t: 262, place: 'hollow', restored: 1, cue: true, kind: 3 },
];

/** Millbrook: arrive, the dam bursts (cue), the orchard, the lookout */
export const WALK_MILL: Leg[] = [
  { t: 0, place: 'leaf-lane', restored: 0.6 },
  { t: 20, place: 'millbrook', restored: 0.7 },
  { t: 30, place: 'millbrook', restored: 0.8, cue: true },
  { t: 90, place: 'orchard', restored: 0.9 },
  { t: 140, place: 'lookout', restored: 1 },
];
/** the Hermitage: up the hanger lane to the desk */
export const WALK_HERMITAGE: Leg[] = [
  { t: 0, place: 'village', restored: 0.6 },
  { t: 15, place: 'hillside', restored: 0.7 },
  { t: 40, place: 'hermitage', restored: 0.8 },
  { t: 70, place: 'hermitage', restored: 0.9, cue: true },
  { t: 140, place: 'hermitage', restored: 1 },
];
/** conductor stress: a moment every 7 s (most must be dropped), then the finale's moments and the end */
export const WALK_CUES: Leg[] = [
  ...Array.from({ length: 30 }, (_, i) => ({ t: 3 + i * 7, place: i % 2 ? 'village' : 'hearth', restored: 1, cue: true })),
  { t: 215, place: 'hollow', restored: 1, cue: true, kind: 1 },
  { t: 218, place: 'hollow', restored: 1, cue: true, kind: 1 },
  { t: 221, place: 'hollow', restored: 1, cue: true, kind: 1 },
  { t: 240, place: 'hollow', restored: 1, cue: true, kind: 3 },
  { t: 250, place: 'hollow', restored: 1, cue: true, kind: 3 },
  { t: 340, place: 'hollow', restored: 1, cue: true },
];
export const WALKS: Record<string, Leg[]> = { main: WALK, mill: WALK_MILL, hermitage: WALK_HERMITAGE, cues: WALK_CUES };

/**
 * Trace conformance: the worklet's bar-line reports must be a behaviour of tla/Hearthsong.tla (projected onto
 * what the worklet reports). Returns the violations (empty = conforms).
 */
export function checkTrace(reps: number[][], gap: number, bars: number, breathBars: number): string[] {
  const bad: string[] = [];
  const SW = ['idle', 'armed', 'singing', 'fading'];
  for (let i = 0; i < reps.length; i++) {
    const [bar, breath, swell, , since, , ending, forces] = reps[i]!;
    const at = `report ${i} (bar ${bar}${breath ? ' breath' : ''}, ${SW[swell!]}, ending ${ending})`;
    if (swell === 2 && breath) bad.push(`${at}: singing in a breath`);
    if (ending === 2 && (swell !== 2 || bar! < bars - 4)) bad.push(`${at}: coda off the last line or not singing`);
    if (ending === 3 && swell !== 0) bad.push(`${at}: done but not idle`);
    if (i === 0) continue;
    const p = reps[i - 1]!;
    if (ending! < p[6]! && !(p[6] === 3 && ending === 4)) bad.push(`${at}: ending went backwards from ${p[6]}`);
    if (p[6] === 4 && ending !== 4) bad.push(`${at}: left the epilogue`);
    const playing = (ending === 0 || ending === 4) && (p[6] === 0 || p[6] === 4);
    if (playing) {
      // bar walk: tune 0..bars-1, breath 0..breathBars-1
      const ok = p[1] ? (bar === p[0]! + 1 && breath === 1) || (bar === 0 && breath === 0 && p[0] === breathBars - 1) : (bar === p[0]! + 1 && breath === 0) || (bar === 0 && breath === 1 && p[0] === bars - 1);
      if (!ok && !(ending === 4 && p[6] === 3)) bad.push(`${at}: bar walk ${p[0]}${p[1] ? 'b' : ''} -> ${bar}${breath ? 'b' : ''}`);
      // a swell starts only if rested, or a finale moment spent one of its forces
      if (swell === 2 && p[2] !== 2 && since !== 0) bad.push(`${at}: swell start without since reset`);
      // judge against the state before it was armed (an armed swell may wait out a breath across reports)
      let j = i - 1;
      while (j > 0 && reps[j]![2] === 1) j--;
      const q = reps[j]!;
      if (swell === 2 && p[2] !== 2 && q[4]! < gap && forces! >= q[7]!) bad.push(`${at}: unforced swell inside the gap (since ${q[4]})`);
      if (p[2] === 2 && swell === 0) bad.push(`${at}: singing straight to idle`);
    }
  }
  return bad;
}

export async function renderHearthsong(seconds: number, walk: Leg[] = WALK, seed = 1): Promise<{ sr: number; l: string; r: string; marks: Leg[]; check: string[]; reports: number; trace: number[][] }> {
  const sr = 48000;
  const ac = new OfflineAudioContext(2, Math.ceil(sr * seconds), sr);
  const bus = ac.createGain();
  bus.gain.value = MIX.music;
  bus.connect(ac.destination);
  const reps: number[][] = [];
  const m = createMusic(ac, bus, seed, (r) => reps.push(Array.from(r)));
  if (!(await m.ready)) throw new Error('worklet failed');
  const at = (id: string) => PLACES.find((p) => p.id === id)!;
  let li = 0;
  for (let t = 0; t < seconds; t += 0.1) {
    while (li + 1 < walk.length && walk[li + 1]!.t <= t) {
      li++;
      if (walk[li]!.cue) m.cue(walk[li]!.kind ?? 0, walk[li]!.t);
      if (walk[li]!.snow) m.snow();
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
  // let the last port messages land
  await new Promise((r) => setTimeout(r, 200));
  const song = compileSong();
  const check = checkTrace(reps, song.swell.gap, song.bars, song.breathBars);
  return { sr, l: enc(buf.getChannelData(0)), r: enc(buf.getChannelData(1)), marks: walk.filter((w) => w.t < seconds), check, reports: reps.length, trace: reps };
}
