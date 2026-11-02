/**
 * The fox's own sounds (audio-DESIGN.md): a soft pad per forepaw plant, shaped by the surface under the paw (a
 * short low-passed noise thump — recorded footsteps read as clicks and taps in every listening pass), a cloth
 * flick on take-off, a deeper pad on landing scaled by impact, and air over the ears while gliding. In the head
 * (no panner): the camera is always just behind the fox.
 */
import * as THREE from 'three';
import type { OpeningAudio } from './audio';
import { CANOPY, POP_UP_RUIN } from './layout';

type Surface = 'grass' | 'leaf' | 'wood' | 'stone';
export const FOLEY = { step: 0.05, jump: 0.05, land: 0.12, glide: 0.04, warmth: 1800, gap: 0.16 };
/** pad colour per surface: low-pass (Hz), resonance, decay (s) */
const PAD: Record<Surface, { lp: number; q: number; decay: number; gain: number }> = {
  grass: { lp: 420, q: 0.5, decay: 0.05, gain: 0.7 },
  leaf: { lp: 900, q: 0.6, decay: 0.07, gain: 0.8 },
  wood: { lp: 300, q: 2.5, decay: 0.08, gain: 1 },
  stone: { lp: 650, q: 0.8, decay: 0.035, gain: 0.8 },
};

export function createFoxFoley(o: { audio: OpeningAudio; groundH: (x: number, z: number) => number }) {
  const { audio } = o;
  const ac = audio.ac;
  // glide: looped noise through a soft band-pass that opens with air speed
  const noise = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
  const nd = noise.getChannelData(0);
  for (let i = 0, b = 0; i < nd.length; i++) nd[i] = b = b * 0.97 + (Math.random() * 2 - 1) * 0.03;
  const air = ac.createBufferSource();
  air.buffer = noise;
  air.loop = true;
  const band = ac.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = 500;
  band.Q.value = 0.7;
  const airGain = ac.createGain();
  airGain.gain.value = 0;
  air.connect(band).connect(airGain).connect(audio.sfx);
  air.start();
  // paws are soft: every footfall/jump/land goes through one gentle low-pass (no crisp Foley clicks)
  const warm = new BiquadFilterNode(ac, { type: 'lowpass', frequency: FOLEY.warmth, Q: 0.5 });
  warm.connect(audio.sfx);

  const burst = ac.createBuffer(1, Math.round(ac.sampleRate * 0.25), ac.sampleRate);
  const bd = burst.getChannelData(0);
  for (let i = 0; i < bd.length; i++) bd[i] = Math.random() * 2 - 1;
  /** one soft pad: noise through the surface's low-pass under a quick rise and short exponential fall */
  function pad(s: Surface, gain: number, deeper = 1): void {
    const p = PAD[s];
    const t = ac.currentTime;
    const src = ac.createBufferSource();
    src.buffer = burst;
    src.playbackRate.value = 0.85 + Math.random() * 0.3;
    const lp = new BiquadFilterNode(ac, { type: 'lowpass', frequency: p.lp / deeper, Q: p.q });
    const g = ac.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain * p.gain, t + 0.006);
    g.gain.setTargetAtTime(0, t + 0.006, p.decay * deeper);
    src.connect(lp).connect(g).connect(warm);
    src.start(t, Math.random() * 0.1, 0.15 * deeper);
    src.onended = () => g.disconnect();
  }

  /** what the paw is on: the terrain is grass; raised tops are canopy leaves, paper ruin (card) or stone/timber props */
  function surface(at: THREE.Vector3): Surface {
    if (at.y - o.groundH(at.x, at.z) < 0.12) return 'grass';
    if (CANOPY.some((l) => Math.hypot(at.x - l.x, at.z - l.z) < 1.6)) return 'leaf';
    if (Math.hypot(at.x - POP_UP_RUIN.overlook.x, at.z - 73) < 4.5) return 'wood';
    return 'stone';
  }
  const counts: Record<Surface, number> = { grass: 0, leaf: 0, wood: 0, stone: 0 };
  let lastStep = 0;
  let wasGrounded = true;
  return {
    footfall(at: THREE.Vector3, hind: boolean, speed: number): void {
      const now = ac.currentTime;
      // only the forepaws speak, and never two within 160 ms: a soft two-beat pad, not a four-beat patter
      if (hind || now - lastStep < FOLEY.gap) return;
      lastStep = now;
      const s = surface(at);
      counts[s]++;
      const pace = THREE.MathUtils.clamp(speed / 3.2, 0.35, 1.15);
      // uneven like real paws (a metronomic patter reads as a ticking clock)
      const gain = FOLEY.step * pace * (0.6 + Math.random() * 0.7);
      pad(s, gain);
    },
    update(st: { grounded: boolean; gliding: boolean; vel: number[]; speed: number }): void {
      if (ac.state !== 'running') return;
      const now = ac.currentTime;
      if (wasGrounded && !st.grounded && (st.vel[1] ?? 0) > 1) audio.playOne('cloth', 4, { gain: FOLEY.jump, rate: 1.1, out: warm });
      wasGrounded = st.grounded;
      const v = Math.hypot(st.vel[0] ?? 0, st.vel[1] ?? 0, st.vel[2] ?? 0);
      airGain.gain.setTargetAtTime(st.gliding && !st.grounded ? FOLEY.glide * (0.5 + Math.min(1, v / 8)) : 0, now, 0.12);
      band.frequency.setTargetAtTime(400 + Math.min(10, v) * 90, now, 0.2);
    },
    land(at: THREE.Vector3, impact: number): void {
      pad(surface(at), FOLEY.land * (0.35 + 0.65 * impact), 1.6);
    },
    state: () => ({ steps: { ...counts }, glide: +airGain.gain.value.toFixed(3) }),
  };
}
