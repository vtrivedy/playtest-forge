/**
 * Hearthsong on the opening's graph (DESIGN-music-ember.md): the worklet synth → a warm synthesized room → the
 * music bus. Loading is async (addModule); until the node exists `update` / `cue` do nothing.
 */
import workletUrl from './hearthsong.worklet.hot.ts?worker&url';
import { compileSong } from './score';
import { createMusicDriver, type MusicDriver } from './music.hot';

export type Music = ReturnType<typeof createMusic>;

/** a 3.2 s stereo room: decorrelated noise under an exponential tail that darkens as it decays */
function roomImpulse(ac: BaseAudioContext): AudioBuffer {
  const len = Math.floor(ac.sampleRate * 3.2);
  const buf = ac.createBuffer(2, len, ac.sampleRate);
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / ac.sampleRate;
      const k = 0.55 - 0.45 * Math.min(1, t / 2.4);
      lp += (rand() - lp) * k;
      d[i] = lp * Math.exp(-t * 2.1) * (t < 0.012 ? t / 0.012 : 1);
    }
  }
  return buf;
}

export function createMusic(ac: BaseAudioContext, out: AudioNode, seed = 1) {
  const song = compileSong();
  let driver: MusicDriver | null = null;
  const reported = { bar: -1, breath: false, swell: 'idle', pass: 0, since: 0, shaded: false };
  const SWELLS = ['idle', 'armed', 'singing', 'fading'];
  let cues = 0;
  const dry = ac.createGain();
  dry.gain.value = 0.8;
  dry.connect(out);
  const room = ac.createConvolver();
  room.buffer = roomImpulse(ac);
  const wet = ac.createGain();
  wet.gain.value = 0.42;
  room.connect(wet).connect(out);
  const ready = ac.audioWorklet
    .addModule(workletUrl)
    .then(() => {
      const node = new AudioWorkletNode(ac, 'hearthsong', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2], processorOptions: { song, seed } });
      node.connect(dry);
      node.connect(room);
      node.port.onmessage = (e: MessageEvent<Float64Array>) => {
        const r = e.data;
        reported.bar = r[0]!;
        reported.breath = r[1] === 1;
        reported.swell = SWELLS[r[2]!] ?? '?';
        reported.pass = r[3]!;
        reported.since = r[4]!;
        reported.shaded = r[5] === 1;
      };
      driver = createMusicDriver(ac, node);
      return true;
    })
    .catch((err) => {
      console.warn('Hearthsong worklet failed', err);
      return false;
    });
  return {
    ready,
    /** per frame: where the fox is and how much colour is back */
    update(x: number, z: number, restored: number, at?: number): void {
      driver?.update(x, z, restored, at);
    },
    /** a moment: the lead sings from the next bar line, if the music has rested (≥ SWELL.gap bars) */
    cue(at?: number): void {
      if (!driver) return;
      cues++;
      driver.cue(cues, at);
    },
    state: () => ({ ready: driver !== null, ...reported, cues, levels: driver?.levels() ?? null }),
  };
}
