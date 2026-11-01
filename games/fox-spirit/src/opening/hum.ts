/**
 * Hearth hum (DESIGN v1 orientation: "hearths hum first"). Every lit hearth drones a low warm chord whose
 * loudness follows the fox's distance, so a lit hearth can be found by ear; cold ones are silent. The coal
 * crackles softly near the fox. A Keeping completion swells one rising chord. WebAudio starts on first input.
 */
import * as THREE from 'three';
import type { Hearth } from '../chem/updraft';

const HUM = { near: 3, far: 26, gain: 0.07, crackle: 0.025 };

export function createHearthHum(opts: { hearths: Hearth[]; fox: THREE.Object3D; coal: () => THREE.Vector3 }) {
  let ctx: AudioContext | null = null;
  let master: GainNode;
  const voices: Array<{ h: Hearth; gain: GainNode }> = [];
  let crackle: GainNode;

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
  }
  const unlock = () => {
    start();
    void ctx?.resume();
  };
  addEventListener('keydown', unlock);
  addEventListener('pointerdown', unlock);

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
