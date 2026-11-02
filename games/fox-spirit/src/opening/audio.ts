/**
 * The opening's one sound graph (docs/design/swarm3/audio-DESIGN.md): music (Hearthsong) ┐
 *                                                                  ambience ───────────┼→ master → limiter → out (+ record tap)
 *                                                                  sfx (3D) ───────────┘
 * One AudioContext for the whole slice, created suspended and resumed on the first key/pointer. The listener is
 * the rendered camera. Music is Hearthsong (music/, DESIGN-music-ember.md): one synthesized lullaby that plays
 * throughout, leaning into each place and filling in as the colour returns; a moment (`cue`) lets its lead sing.
 * Wind is a soft synth breath shaped by height. No birds (Vivek: "constant birds"). Samples live in `sfx/`
 * (CC0, assets/library/CREDITS.md); synth voices build on `ac` and connect to `sfx` or `at(pos)`.
 */
import * as THREE from 'three';
import { createMusic } from './music/music';

// the old harp phrases and bird calls stay on disk (provenance) but are not shipped
const FILES = import.meta.glob(['./sfx/*.ogg', '!./sfx/bird-*.ogg', '!./sfx/phrase-*.ogg'], { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const URLS = Object.fromEntries(Object.entries(FILES).map(([k, v]) => [k.replace('./sfx/', '').replace('.ogg', ''), v]));

export const MIX = {
  /** unity: the level every review capture is measured at */
  master: 1,
  /** Hearthsong bus (its own levels live in music/score.ts + the worklet) */
  music: 0.32,
  ambience: 1,
  sfx: 0.9,
  /** wind: gusts of soft pink noise that come and go (silent between them); faint on the ground, fuller up high */
  wind: { ground: 0.006, high: 0.03, dark: 450, open: 2200 },
};

export type PlayOpts = {
  /** world position: placed through an HRTF panner; omitted = in the head (the fox's own sounds) */
  at?: THREE.Vector3;
  gain?: number;
  /** playback rate (pitch), 1 = as recorded */
  rate?: number;
  /** seconds from now */
  delay?: number;
  /** route into this node instead of the sfx bus (e.g. a module's own filter); ignored with `at` */
  out?: AudioNode;
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
  const music = ac.createGain();
  music.gain.value = MIX.music;
  music.connect(master);
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
  // everything is short: decode it all up front
  for (const id of Object.keys(URLS)) void load(id);

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
    const out = o.at ? at(o.at) : o.out ?? sfx;
    src.connect(g).connect(out);
    src.start(ac.currentTime + (o.delay ?? 0));
    src.onended = () => {
      g.disconnect();
      if (o.at) out.disconnect();
    };
    counts[id] = (counts[id] ?? 0) + 1;
    log.push({ id, t: +ac.currentTime.toFixed(2) });
    if (log.length > 600) log.shift();
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

  // wind: pink noise under a low-pass that opens as a gust rises; between gusts it falls away to nothing (a steady
  // band of noise reads as a fan or an engine, not air)
  const wn = ac.createBuffer(1, ac.sampleRate * 4, ac.sampleRate);
  const wd = wn.getChannelData(0);
  for (let i = 0, b0 = 0, b1 = 0, b2 = 0; i < wd.length; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99765 * b0 + w * 0.099046;
    b1 = 0.963 * b1 + w * 0.2965164;
    b2 = 0.57 * b2 + w * 1.0526913;
    wd[i] = (b0 + b1 + b2 + w * 0.1848) * 0.11;
  }
  const windSrc = ac.createBufferSource();
  windSrc.buffer = wn;
  windSrc.loop = true;
  const windLow = new BiquadFilterNode(ac, { type: 'lowpass', frequency: MIX.wind.dark, Q: 0.4 });
  const windHigh = new BiquadFilterNode(ac, { type: 'highpass', frequency: 90 });
  const wind = ac.createGain();
  wind.gain.value = 0;
  windSrc.connect(windHigh).connect(windLow).connect(wind).connect(ambience);
  windSrc.start();
  let gust = 0;
  let gustTo = 0.5;
  let lastTick = 0;

  const song = createMusic(ac, music);
  const cued: { cue: string; t: number }[] = [];
  /**
   * a moment happened (first hearth, a page caught, the Keeping, home): the song's lead may sing. The finale's
   * moments are stronger: kindle/open sing even inside the rest gap, snow thins the song, rest plays it home and ends it.
   */
  function cue(name: string): void {
    if (ac.state !== 'running') return;
    if (name === 'finale-snow') song.snow();
    else song.cue(name === 'finale-rest' ? 3 : name === 'finale-kindle' || name === 'finale-open' ? 1 : 0);
    cued.push({ cue: name, t: +ac.currentTime.toFixed(2) });
    if (cued.length > 12) cued.shift();
  }

  const unlock = () => void ac.resume();
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
    /** pre-master buses, for capture tools (stems work while the master is muted) */
    buses: { music, ambience, sfx },
    at,
    record,
    play,
    playOne,
    loop,
    cue,
    /** per frame: listener = camera; wind follows height; the song follows the fox and the colour */
    update(camera: THREE.Camera, o: { restored: number; height: number; x: number; z: number }): void {
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
      // wind: a slow random walk; only its upper part is heard, so gusts arrive, swell and leave silence behind
      if (Math.abs(gust - gustTo) < 0.02) gustTo = Math.random();
      gust += (gustTo - gust) * (1 - Math.exp(-(now - lastTick) * 0.24));
      lastTick = now;
      const swell = Math.max(0, (gust - 0.35) / 0.65) ** 1.5;
      const aloft = THREE.MathUtils.smoothstep(height, 1, 8);
      wind.gain.setTargetAtTime(THREE.MathUtils.lerp(MIX.wind.ground, MIX.wind.high, aloft) * swell, now, 0.5);
      windLow.frequency.setTargetAtTime(THREE.MathUtils.lerp(MIX.wind.dark, MIX.wind.open, Math.max(swell, aloft * 0.6)), now, 0.6);
      song.update(o.x, o.z, restored);
    },
    state: () => ({
      context: ac.state,
      master: MIX.master,
      music: { ...song.state(), cued: cued.slice(-6) },
      ambience: { wind: +wind.gain.value.toFixed(4) },
      loaded: buffers.size,
      files: Object.keys(URLS).length,
      counts: { ...counts },
      last: log.slice(-8),
      /** every one-shot played since start (≤600), for capture tools */
      log: log.slice(),
    }),
  };
}
