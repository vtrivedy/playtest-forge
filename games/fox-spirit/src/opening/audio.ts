/**
 * The opening's one sound graph (docs/design/swarm3/audio-DESIGN.md): music (phrases) ┐
 *                                                                  ambience ───────────┼→ master → limiter → out (+ record tap)
 *                                                                  sfx (3D) ───────────┘
 * One AudioContext for the whole slice, created suspended and resumed on the first key/pointer. The listener is
 * the rendered camera. Silence is the default (KNOWLEDGE.md § Quiet audio redesign): no music at boot or idle —
 * one finite harp phrase arrives on a moment (`cue`) and is followed by quiet; wind is a soft synth breath
 * shaped by height; birds are rare single distant calls once the colour is back. Samples live in `sfx/`
 * (CC0, assets/library/CREDITS.md); synth voices build on `ac` and connect to `sfx` or `at(pos)`.
 */
import * as THREE from 'three';

const FILES = import.meta.glob('./sfx/*.ogg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const URLS = Object.fromEntries(Object.entries(FILES).map(([k, v]) => [k.replace('./sfx/', '').replace('.ogg', ''), v]));

export const MIX = {
  master: 0, // muted by vivek (Nov 1): mix rejected as intrusive; unmuted only after an independent listening verdict
  /** phrases are cut to −20 dBFS RMS; this puts them near −32 dBFS in the mix */
  music: 0.25,
  ambience: 1,
  sfx: 0.9,
  /** a cue within this long of the last phrase's start is dropped (no backlog, no stacking) */
  musicGap: 30,
  /** moments → harp phrases (Meadow Thoughts, Écrivain, CC0); each plays once, then quiet */
  cues: { hearth: ['phrase-hearth'], page: ['phrase-page-1', 'phrase-page-2'], keeping: ['phrase-keeping'], home: ['phrase-home'] } as Record<string, string[]>,
  /** wind: soft band-limited noise; ~−44 dBFS on the ground, up to ~−38 high up */
  wind: { ground: 0.012, high: 0.024, centre: 420 },
  /** birds: single distant calls, only once the colour is back; gaps random in [min, max] s */
  birds: { gain: 0.05, min: 28, max: 70, after: 0.3, near: 18, far: 34 },
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

  // wind: pink-ish noise through a soft band-pass whose level and centre drift in slow gusts (no recording: the
  // field recordings carried traffic rumble and hidden birds)
  const wn = ac.createBuffer(1, ac.sampleRate * 4, ac.sampleRate);
  const wd = wn.getChannelData(0);
  for (let i = 0, b = 0; i < wd.length; i++) wd[i] = b = b * 0.985 + (Math.random() * 2 - 1) * 0.12;
  const windSrc = ac.createBufferSource();
  windSrc.buffer = wn;
  windSrc.loop = true;
  const windBand = new BiquadFilterNode(ac, { type: 'bandpass', frequency: MIX.wind.centre, Q: 0.6 });
  const windLow = new BiquadFilterNode(ac, { type: 'lowpass', frequency: 1400 });
  const wind = ac.createGain();
  wind.gain.value = 0;
  windSrc.connect(windBand).connect(windLow).connect(wind).connect(ambience);
  windSrc.start();
  let gust = 0;
  let gustTo = 0.5;

  // birds: one call at a time, somewhere off to the side and far, with long random gaps
  let nextBird = MIX.birds.min;
  let lastBird = -1;
  let birdCalls = 0;
  const birdIds = Object.keys(URLS).filter((k) => k.startsWith('bird-'));

  // music: finite phrases on moments; quiet otherwise
  let lastCue = -Infinity;
  let phraseId = '';
  let phraseEnds = 0;
  const cueCounts: Record<string, number> = {};
  const cued: { cue: string; phrase: string; t: number }[] = [];
  /** a moment happened (first hearth, a page caught, the Keeping, home): play its phrase if the music has rested */
  function cue(name: string): void {
    const list = MIX.cues[name];
    if (!list || ac.state !== 'running' || ac.currentTime - lastCue < MIX.musicGap) return;
    const n = cueCounts[name] ?? 0;
    const id = list[n % list.length]!;
    const buf = buffers.get(id);
    if (!buf) return;
    cueCounts[name] = n + 1;
    const now = ac.currentTime;
    lastCue = now;
    const src = ac.createBufferSource();
    src.buffer = buf;
    const g = ac.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(1, now + 0.4);
    src.connect(g).connect(music);
    src.start(now);
    src.onended = () => g.disconnect();
    phraseId = id;
    phraseEnds = now + buf.duration;
    cued.push({ cue: name, phrase: id, t: +now.toFixed(2) });
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
    /** per frame: listener = camera; wind follows height, birds wait for the colour */
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
      // wind: slow gusts (a random walk toward a new target every few seconds), louder and brighter up high
      if (Math.abs(gust - gustTo) < 0.02) gustTo = Math.random();
      gust += (gustTo - gust) * 0.004;
      const aloft = THREE.MathUtils.smoothstep(height, 1, 8);
      const level = THREE.MathUtils.lerp(MIX.wind.ground, MIX.wind.high, aloft) * (0.6 + 0.6 * gust);
      wind.gain.setTargetAtTime(level, now, 0.6);
      windBand.frequency.setTargetAtTime(MIX.wind.centre * (0.8 + 0.5 * gust + 0.4 * aloft), now, 0.8);
      // birds
      if (restored > MIX.birds.after && now >= nextBird && birdIds.length) {
        let i = Math.floor(Math.random() * birdIds.length);
        if (i === lastBird) i = (i + 1) % birdIds.length;
        lastBird = i;
        const ang = Math.random() * Math.PI * 2;
        const r = THREE.MathUtils.lerp(MIX.birds.near, MIX.birds.far, Math.random());
        const at = new THREE.Vector3(p.x + Math.cos(ang) * r, p.y + 4 + Math.random() * 6, p.z + Math.sin(ang) * r);
        play(birdIds[i]!, { at, gain: MIX.birds.gain * (0.7 + Math.random() * 0.5), rate: 0.94 + Math.random() * 0.12 });
        birdCalls++;
        nextBird = now + THREE.MathUtils.lerp(MIX.birds.min, MIX.birds.max, Math.random());
      } else if (restored <= MIX.birds.after) nextBird = Math.max(nextBird, now + 8);
    },
    state: () => ({
      context: ac.state,
      master: MIX.master,
      music: { phrase: ac.currentTime < phraseEnds ? phraseId : null, cued: cued.slice(-6) },
      ambience: { wind: +wind.gain.value.toFixed(4), birdCalls, nextBirdIn: +Math.max(0, nextBird - ac.currentTime).toFixed(1) },
      loaded: buffers.size,
      files: Object.keys(URLS).length,
      counts: { ...counts },
      last: log.slice(-8),
      /** every one-shot played since start (≤600), for capture tools */
      log: log.slice(),
    }),
  };
}
