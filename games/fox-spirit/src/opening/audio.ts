/**
 * The opening's one sound graph (docs/design/swarm3/audio-DESIGN.md): music → duck ┐
 *                                                                  ambience ──────┼→ master → limiter → out (+ record tap)
 *                                                                  sfx (3D) ──────┘
 * One AudioContext for the whole slice, created suspended and resumed on the first key/pointer. The listener is
 * the rendered camera. Samples live in `sfx/` (CC0, assets/library/CREDITS.md) and play by file name;
 * synth voices (hum, glyph chimes, creature shimmer) build on `ac` and connect to `sfx` or `at(pos)`.
 */
import * as THREE from 'three';

const FILES = import.meta.glob('./sfx/*.ogg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const URLS = Object.fromEntries(Object.entries(FILES).map(([k, v]) => [k.replace('./sfx/', '').replace('.ogg', ''), v]));

export const MIX = {
  master: 1,
  /** the bed sits ~ −20 LUFS, effects on top */
  music: 0.75,
  ambience: 0.5,
  sfx: 0.9,
  /** music fades in over this after the first input (s) */
  fadeIn: 4,
  /** playlist crossfade (s) */
  crossfade: 5,
  playlist: ['music-hush-hamlet', 'music-apple-cider'],
  /** the hush-hamlet edit is a seamless loop: play it twice before moving on */
  repeats: { 'music-hush-hamlet': 2 } as Record<string, number>,
  /** per-track trim to one loudness (sources: Hush Hamlet −17.3, Apple Cider −14.8 LUFS integrated) */
  trim: { 'music-hush-hamlet': 1, 'music-apple-cider': 0.75 } as Record<string, number>,
};

export type PlayOpts = {
  /** world position: placed through an HRTF panner; omitted = in the head (the fox's own sounds) */
  at?: THREE.Vector3;
  gain?: number;
  /** playback rate (pitch), 1 = as recorded */
  rate?: number;
  /** seconds from now */
  delay?: number;
};

export type OpeningAudio = ReturnType<typeof createOpeningAudio>;

export function createOpeningAudio() {
  const ac = new AudioContext();
  const master = ac.createGain();
  master.gain.value = MIX.master;
  // brick-wall-ish: the bus never clips however many events land at once
  const limiter = ac.createDynamicsCompressor();
  limiter.threshold.value = -6;
  limiter.knee.value = 2;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.2;
  master.connect(limiter).connect(ac.destination);
  /** post-limiter tap for capture tooling (exactly what the speakers get) */
  const record = ac.createMediaStreamDestination();
  limiter.connect(record);

  const bus = (gain: number) => {
    const g = ac.createGain();
    g.gain.value = gain;
    g.connect(master);
    return g;
  };
  const duckGain = ac.createGain();
  duckGain.connect(master);
  const music = ac.createGain();
  music.gain.value = 0;
  music.connect(duckGain);
  const ambience = bus(MIX.ambience);
  const sfx = bus(MIX.sfx);

  const buffers = new Map<string, AudioBuffer>();
  const loading = new Map<string, Promise<AudioBuffer | null>>();
  function load(id: string): Promise<AudioBuffer | null> {
    const url = URLS[id];
    if (!url) return Promise.resolve(null);
    let p = loading.get(id);
    if (!p) {
      p = fetch(url)
        .then((r) => r.arrayBuffer())
        .then((b) => ac.decodeAudioData(b))
        .then((buf) => (buffers.set(id, buf), buf))
        .catch(() => null);
      loading.set(id, p);
    }
    return p;
  }
  // the short effects decode up front; music decodes when it is first needed
  for (const id of Object.keys(URLS)) if (!id.startsWith('music-')) void load(id);

  /** a panner input at a world position (inverse distance, ~silent past 60 m) */
  function at(pos: THREE.Vector3, ref = 3): PannerNode {
    const p = new PannerNode(ac, { panningModel: 'HRTF', distanceModel: 'inverse', refDistance: ref, maxDistance: 60, rolloffFactor: 1.1, positionX: pos.x, positionY: pos.y, positionZ: pos.z });
    p.connect(sfx);
    return p;
  }

  const log: { id: string; t: number }[] = [];
  const counts: Record<string, number> = {};
  /** one-shot sample by file name (no-op until decoded or while the context is locked) */
  function play(id: string, o: PlayOpts = {}): void {
    const buf = buffers.get(id);
    if (!buf || ac.state !== 'running') return;
    const src = ac.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = o.rate ?? 1;
    const g = ac.createGain();
    g.gain.value = o.gain ?? 1;
    const out = o.at ? at(o.at) : sfx;
    src.connect(g).connect(out);
    src.start(ac.currentTime + (o.delay ?? 0));
    src.onended = () => {
      g.disconnect();
      if (out !== sfx) out.disconnect();
    };
    counts[id] = (counts[id] ?? 0) + 1;
    log.push({ id, t: +ac.currentTime.toFixed(2) });
    if (log.length > 30) log.shift();
  }
  /** pick one of `${base}-0..n-1` (never the same one twice running) */
  const last = new Map<string, number>();
  function playOne(base: string, n: number, o: PlayOpts = {}): void {
    let i = Math.floor(Math.random() * n);
    if (n > 1 && i === last.get(base)) i = (i + 1) % n;
    last.set(base, i);
    play(`${base}-${i}`, o);
  }

  /** a looping sample with its own gain (and optional panner you can move); starts at 0 gain */
  function loop(id: string, out: AudioNode = sfx) {
    const gain = ac.createGain();
    gain.gain.value = 0;
    gain.connect(out);
    let src: AudioBufferSourceNode | null = null;
    void load(id).then((buf) => {
      if (!buf) return;
      src = ac.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.connect(gain);
      // a random phase so two copies of one loop never comb together
      src.start(0, Math.random() * buf.duration);
    });
    return { gain: gain.gain, set: (v: number, tc = 0.2) => gain.gain.setTargetAtTime(v, ac.currentTime, tc) };
  }

  // ambience beds
  const wind = loop('amb-wind', ambience);
  const birds = loop('amb-birds', ambience);

  // music: a playlist that crossfades track to track; a repeat of a seamless loop edit starts exactly on its seam
  const SEQ = MIX.playlist.flatMap((id) => Array<string>(MIX.repeats[id] ?? 1).fill(id));
  let seqI = 0;
  let nextAt = -1;
  let scheduling = false;
  let musicStarted = false;
  let trackId = '';
  async function schedule(): Promise<void> {
    scheduling = true;
    const id = SEQ[seqI % SEQ.length]!;
    const prev = SEQ[(seqI + SEQ.length - 1) % SEQ.length]!;
    const next = SEQ[(seqI + 1) % SEQ.length]!;
    const buf = await load(id);
    scheduling = false;
    if (!buf) return;
    const start = Math.max(ac.currentTime + 0.05, nextAt);
    const src = ac.createBufferSource();
    src.buffer = buf;
    const g = ac.createGain();
    const fadeIn = seqI > 0 && prev !== id;
    const level = MIX.trim[id] ?? 1;
    g.gain.setValueAtTime(fadeIn ? 0 : level, start);
    if (fadeIn) g.gain.linearRampToValueAtTime(level, start + MIX.crossfade);
    const end = start + buf.duration;
    if (next !== id) {
      g.gain.setValueAtTime(level, end - MIX.crossfade);
      g.gain.linearRampToValueAtTime(0, end);
    }
    src.connect(g).connect(music);
    src.start(start);
    src.onended = () => g.disconnect();
    nextAt = next === id ? end : end - MIX.crossfade;
    trackId = id;
    seqI++;
  }

  let duckUntil = 0;
  /** dip the music under a key moment: down to `depth` (0..1 of full) for `hold` s, then back over 1.5 s */
  function duck(depth = 0.45, hold = 1.5): void {
    const now = ac.currentTime;
    duckGain.gain.cancelScheduledValues(now);
    duckGain.gain.setTargetAtTime(depth, now, 0.08);
    duckUntil = Math.max(duckUntil, now + hold);
  }

  const unlock = () => {
    void ac.resume().then(() => {
      if (musicStarted) return;
      musicStarted = true;
      music.gain.setValueAtTime(0, ac.currentTime);
      music.gain.linearRampToValueAtTime(MIX.music, ac.currentTime + MIX.fadeIn);
      void schedule();
    });
  };
  addEventListener('keydown', unlock);
  addEventListener('pointerdown', unlock);

  const fwd = new THREE.Vector3();
  const up = new THREE.Vector3();
  let restored = 0;
  let height = 0;
  return {
    ac,
    /** effects bus (in the head); `at(pos)` gives a 3D input that feeds it */
    sfx,
    at,
    record,
    play,
    playOne,
    loop,
    duck,
    /** per frame: listener = camera; ambience follows the colour and the fox's height; music scheduler */
    update(camera: THREE.Camera, o: { restored: number; height: number }): void {
      if (ac.state !== 'running') return;
      const now = ac.currentTime;
      const L = ac.listener;
      camera.getWorldDirection(fwd);
      up.set(0, 1, 0).applyQuaternion(camera.quaternion);
      const p = camera.position;
      L.positionX.setTargetAtTime(p.x, now, 0.02);
      L.positionY.setTargetAtTime(p.y, now, 0.02);
      L.positionZ.setTargetAtTime(p.z, now, 0.02);
      L.forwardX.setTargetAtTime(fwd.x, now, 0.02);
      L.forwardY.setTargetAtTime(fwd.y, now, 0.02);
      L.forwardZ.setTargetAtTime(fwd.z, now, 0.02);
      L.upX.setTargetAtTime(up.x, now, 0.02);
      L.upY.setTargetAtTime(up.y, now, 0.02);
      L.upZ.setTargetAtTime(up.z, now, 0.02);
      restored += (o.restored - restored) * 0.02;
      height += (o.height - height) * 0.05;
      // sepia is wind-only and sparse; the birds come back with the colour
      wind.set(0.55 + 0.45 * THREE.MathUtils.smoothstep(height, 1, 8), 0.8);
      birds.set(0.15 + 0.85 * THREE.MathUtils.smoothstep(restored, 0.05, 0.6), 1.2);
      // queue the next source a few seconds ahead so it starts sample-accurately on time
      if (musicStarted && !scheduling && nextAt > 0 && now >= nextAt - 3) void schedule();
      if (duckUntil && now >= duckUntil) {
        duckUntil = 0;
        duckGain.gain.cancelScheduledValues(now);
        duckGain.gain.setTargetAtTime(1, now, 0.5);
      }
    },
    state: () => ({
      context: ac.state,
      music: { track: trackId || null, gain: +music.gain.value.toFixed(3), duck: +duckGain.gain.value.toFixed(3) },
      ambience: { wind: +wind.gain.value.toFixed(3), birds: +birds.gain.value.toFixed(3) },
      loaded: buffers.size,
      files: Object.keys(URLS).length,
      counts: { ...counts },
      last: log.slice(-8),
    }),
  };
}
