/**
 * The fox's own sounds (audio-DESIGN.md): a footfall per paw plant (Kenney footsteps, CC0) on the surface under
 * the paw, a cloth flick on take-off, a soft thud on landing scaled by impact, and air over the ears while
 * gliding. In the head (no panner): the camera is always just behind the fox.
 */
import * as THREE from 'three';
import type { OpeningAudio } from './audio';
import { CANOPY, POP_UP_RUIN } from './layout';

type Surface = 'grass' | 'leaf' | 'wood' | 'stone';
export const FOLEY = { step: 0.32, hind: 0.45, jump: 0.35, land: 0.7, glide: 0.09 };

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
      // four paws: never two plants closer than 90 ms (a gallop's paired paws read as one)
      if (now - lastStep < 0.09) return;
      lastStep = now;
      const s = surface(at);
      counts[s]++;
      const pace = THREE.MathUtils.clamp(speed / 3.2, 0.35, 1.15);
      const gain = FOLEY.step * pace * (hind ? FOLEY.hind : 1);
      const rate = 0.94 + Math.random() * 0.12;
      if (s === 'leaf') audio.playOne('step-grass', 5, { gain: gain * 0.8, rate: rate * 1.25 });
      else audio.playOne(`step-${s}`, 5, { gain: s === 'grass' ? gain : gain * 0.75, rate });
    },
    update(st: { grounded: boolean; gliding: boolean; vel: number[]; speed: number }): void {
      if (ac.state !== 'running') return;
      const now = ac.currentTime;
      if (wasGrounded && !st.grounded && (st.vel[1] ?? 0) > 1) audio.playOne('cloth', 4, { gain: FOLEY.jump, rate: 1.1 });
      wasGrounded = st.grounded;
      const v = Math.hypot(st.vel[0] ?? 0, st.vel[1] ?? 0, st.vel[2] ?? 0);
      airGain.gain.setTargetAtTime(st.gliding && !st.grounded ? FOLEY.glide * (0.5 + Math.min(1, v / 8)) : 0, now, 0.12);
      band.frequency.setTargetAtTime(400 + Math.min(10, v) * 90, now, 0.2);
    },
    land(at: THREE.Vector3, impact: number): void {
      const s = surface(at);
      audio.playOne('land', 3, { gain: FOLEY.land * (0.35 + 0.65 * impact) });
      audio.playOne(s === 'leaf' ? 'step-grass' : `step-${s}`, 5, { gain: FOLEY.step * (0.6 + impact), rate: 0.85, delay: 0.015 });
    },
    state: () => ({ steps: { ...counts }, glide: +airGain.gain.value.toFixed(3) }),
  };
}
