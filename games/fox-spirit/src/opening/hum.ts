/**
 * Hearth hum (DESIGN v1 orientation: "hearths hum first"). Every lit hearth drones a low warm chord whose
 * loudness follows the fox's distance, so a lit hearth can be found by ear; cold ones are silent. The coal
 * crackles softly near the fox; the Runaway Page rustles (findable by ear) and chimes per catch. A Keeping
 * completion swells one rising chord. WebAudio starts on first input.
 */
import * as THREE from 'three';
import type { Hearth } from '../chem/updraft';

const HUM = { near: 3, far: 26, gain: 0.07, crackle: 0.025, rustle: 0.05 };

export function createHearthHum(opts: {
  hearths: Hearth[];
  fox: THREE.Object3D;
  coal: () => THREE.Vector3;
  /** the Runaway Page: a dry paper flutter you can find by ear; a rising note per catch */
  page?: () => { pos: THREE.Vector3; fleeing: boolean; catches: number; kept: boolean };
}) {
  let ctx: AudioContext | null = null;
  let master: GainNode;
  const voices: Array<{ h: Hearth; gain: GainNode }> = [];
  let crackle: GainNode;
  let rustle: GainNode;
  let rustleBand: BiquadFilterNode;
  let caught = 0;

  function start(): void {
    if (ctx) return;
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0.8;
    master.connect(ctx.destination);
    // each hearth: root + fifth + soft octave, a slow beat between detuned pairs, low-passed warm
    opts.hearths.forEach((h, i) => {
      const gain = ctx!.createGain();
      gain.gain.value = 0;
      const lp = ctx!.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 420;
      lp.connect(gain);
      gain.connect(master);
      const base = [55, 61.7, 49][i % 3]!;
      for (const [mul, amp, det] of [[1, 0.5, 0], [1, 0.35, 0.6], [1.5, 0.22, -0.4], [2, 0.12, 0.3]] as const) {
        const o = ctx!.createOscillator();
        o.type = mul === 1 ? 'sine' : 'triangle';
        o.frequency.value = base * mul + det;
        const a = ctx!.createGain();
        a.gain.value = amp;
        o.connect(a).connect(lp);
        o.start();
      }
      voices.push({ h, gain });
    });
    // coal crackle: sparse filtered noise bursts
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() < 0.0016 ? (Math.random() * 2 - 1) : d[i - 1] ? d[i - 1]! * 0.82 : 0;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1400;
    crackle = ctx.createGain();
    crackle.gain.value = 0;
    src.connect(hp).connect(crackle).connect(master);
    src.start();
    // page flutter: band-passed noise, amplitude-beaten like wingbeats
    const flutter = ctx.createBufferSource();
    const fb = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const fd = fb.getChannelData(0);
    for (let i = 0; i < fd.length; i++) fd[i] = (Math.random() * 2 - 1) * (0.55 + 0.45 * Math.sin((i / ctx.sampleRate) * Math.PI * 2 * 9));
    flutter.buffer = fb;
    flutter.loop = true;
    rustleBand = ctx.createBiquadFilter();
    rustleBand.type = 'bandpass';
    rustleBand.frequency.value = 2600;
    rustleBand.Q.value = 0.9;
    rustle = ctx.createGain();
    rustle.gain.value = 0;
    flutter.connect(rustleBand).connect(rustle).connect(master);
    flutter.start();
  }
  const unlock = () => {
    start();
    void ctx?.resume();
  };
  addEventListener('keydown', unlock);
  addEventListener('pointerdown', unlock);

  /** a short paper-bright arpeggio; one more note per catch, a full open chord when it is kept */
  function chime(n: number): void {
    if (!ctx) return;
    const t = ctx.currentTime;
    [523.3, 659.3, 784, 1046.5].slice(0, Math.min(4, n + 1)).forEach((hz, i) => {
      const o = ctx!.createOscillator();
      o.type = 'triangle';
      o.frequency.value = hz;
      const g = ctx!.createGain();
      g.gain.setValueAtTime(0, t + i * 0.09);
      g.gain.linearRampToValueAtTime(0.06, t + i * 0.09 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.09 + 1.4);
      o.connect(g).connect(master);
      o.start(t + i * 0.09);
      o.stop(t + i * 0.09 + 1.5);
    });
  }
  const fall = (d: number) => 1 - THREE.MathUtils.smoothstep(d, HUM.near, HUM.far);
  return {
    update(): void {
      if (!ctx) return;
      const f = opts.fox.position;
      const now = ctx.currentTime;
      for (const { h, gain } of voices) {
        const lit = h.reactor.restored ? 1 : h.reactor.heat * 0.5;
        gain.gain.setTargetAtTime(HUM.gain * lit * fall(f.distanceTo(h.base)), now, 0.25);
      }
      crackle.gain.setTargetAtTime(HUM.crackle * (1 - THREE.MathUtils.smoothstep(f.distanceTo(opts.coal()), 0.5, 7)), now, 0.2);
      const pg = opts.page?.();
      if (pg) {
        const near = 1 - THREE.MathUtils.smoothstep(f.distanceTo(pg.pos), 1, 28);
        rustle.gain.setTargetAtTime(pg.kept ? 0 : HUM.rustle * near * (pg.fleeing ? 1.6 : 0.7), now, 0.15);
        rustleBand.frequency.setTargetAtTime(pg.fleeing ? 3400 : 2400, now, 0.2);
        if (pg.catches > caught) {
          caught = pg.catches;
          chime(pg.kept ? 4 : caught);
        }
      }
    },
    /** the Keeping lets go: one rising open chord, swelling then fading over ~6 s */
    swell(): void {
      if (!ctx) return;
      const t = ctx.currentTime;
      [110, 164.8, 220, 277.2, 329.6].forEach((hz, i) => {
        const o = ctx!.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(hz * 0.98, t + i * 0.35);
        o.frequency.linearRampToValueAtTime(hz, t + i * 0.35 + 2);
        const g = ctx!.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.05, t + i * 0.35 + 1.4);
        g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.35 + 6.5);
        o.connect(g).connect(master);
        o.start(t + i * 0.35);
        o.stop(t + i * 0.35 + 7);
      });
    },
    state: () => ({ running: ctx?.state === 'running', voices: voices.map(({ h, gain }) => ({ id: h.spot.id, gain: +gain.gain.value.toFixed(4) })) }),
  };
}
