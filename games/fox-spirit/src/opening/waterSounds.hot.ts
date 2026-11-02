/**
 * Millbrook water and wheel (Ember, swarm4), synthesized on the opening's graph — no files, nothing allocated per
 * frame: every voice is a persistent source whose gain/filter is automated.
 *
 * - brook: soft band-limited noise + sparse bubbles (short rising sines), heard at the nearest point of the bed,
 *   only while it flows (`flow` 0..1); silent when dry.
 * - wheel: a hollow wooden knock per paddle and a slosh that follows the turn (`turn` 0..1 = speed).
 * - burst: one soft whoosh and splash where the leaf dam gives way.
 */
import * as THREE from 'three';
import type { OpeningAudio } from './audio';

export const WATER = {
  /** the bed under the bubbles: kept low and always moving (a steady noise band reads as a fan or an engine) */
  brook: 0.05,
  bubbles: 0.075,
  /** bubbles per second at full flow */
  bubbleRate: 38,
  wheelKnock: 0.04,
  slosh: 0.025,
  /** paddles per second at full turn */
  paddleRate: 1.6,
  burst: 0.06,
};
const BUBBLES = 12;

export type WaterSounds = ReturnType<typeof createWaterSounds>;

export function createWaterSounds(o: { audio: OpeningAudio; brook: ReadonlyArray<THREE.Vector3>; wheel: THREE.Vector3; seed?: number }) {
  // cold:begin (construction only)
  const { audio } = o;
  const ac = audio.ac;
  let seed = o.seed ?? 11;
  const len = ac.sampleRate * 3;
  const nb = ac.createBuffer(1, len, ac.sampleRate);
  const nd = nb.getChannelData(0);
  for (let i = 0; i < len; i++) nd[i] = ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  const noise = (out: AudioNode, offset: number) => {
    const s = ac.createBufferSource();
    s.buffer = nb;
    s.loop = true;
    s.connect(out);
    s.start(0, offset);
  };
  // brook: noise → band → gain → panner at the nearest bed point
  const brookPan = audio.at(o.brook[0] ?? o.wheel, 6);
  const brookGain = ac.createGain();
  brookGain.gain.value = 0;
  brookGain.connect(brookPan);
  const brookBand = new BiquadFilterNode(ac, { type: 'bandpass', frequency: 1100, Q: 1.3 });
  const brookLow = new BiquadFilterNode(ac, { type: 'lowpass', frequency: 1600, Q: 0.3 });
  brookBand.connect(brookLow).connect(brookGain);
  noise(brookBand, 0.3);
  // bubbles: persistent sines, retuned and enveloped per bubble
  const bubbleOut = ac.createGain();
  bubbleOut.gain.value = 0;
  bubbleOut.connect(brookPan);
  const bOsc: OscillatorNode[] = [];
  const bEnv: GainNode[] = [];
  for (let i = 0; i < BUBBLES; i++) {
    const osc = new OscillatorNode(ac, { type: 'sine', frequency: 500 });
    const g = new GainNode(ac, { gain: 0 });
    osc.connect(g).connect(bubbleOut);
    osc.start();
    bOsc.push(osc);
    bEnv.push(g);
  }
  // wheel: a wooden knock (resonant band on noise) and a slosh (low noise), at the wheel
  const wheelPan = audio.at(o.wheel, 3);
  const knock = new GainNode(ac, { gain: 0 });
  const knockBand = new BiquadFilterNode(ac, { type: 'bandpass', frequency: 200, Q: 2.5 });
  knockBand.connect(knock).connect(wheelPan);
  noise(knockBand, 1.1);
  const slosh = new GainNode(ac, { gain: 0 });
  const sloshLow = new BiquadFilterNode(ac, { type: 'lowpass', frequency: 700, Q: 0.5 });
  sloshLow.connect(slosh).connect(wheelPan);
  noise(sloshLow, 2.2);
  // burst: a band sweep (whoosh) and a low splash, placed where it happens
  const burstPan = audio.at(o.wheel, 6);
  const whoosh = new GainNode(ac, { gain: 0 });
  const whooshBand = new BiquadFilterNode(ac, { type: 'bandpass', frequency: 300, Q: 1.2 });
  whooshBand.connect(whoosh).connect(burstPan);
  noise(whooshBand, 0.7);
  const splash = new GainNode(ac, { gain: 0 });
  const splashLow = new BiquadFilterNode(ac, { type: 'lowpass', frequency: 900, Q: 0.4 });
  splashLow.connect(splash).connect(burstPan);
  noise(splashLow, 1.7);
  const nearest = new THREE.Vector3();
  let nextBubble = 0;
  let bubbleI = 0;
  let paddle = 0;
  let bubbles = 0;
  let knocks = 0;
  let bursts = 0;
  let nextMurmur = 0;
  // cold:end

  function rand(): number {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  }

  /** per frame: the fox (listener side), how much water runs (0 dry … 1 full), how fast the wheel turns (0 … 1) */
  function update(fox: THREE.Vector3, flow: number, turn: number, dt: number): void {
    if (ac.state !== 'running') return;
    const now = ac.currentTime;
    // the nearest point on the bed (segments, not just their ends) carries the brook
    let best = Infinity;
    for (let i = 0; i + 1 < o.brook.length; i++) {
      const a = o.brook[i]!;
      const b = o.brook[i + 1]!;
      const abx = b.x - a.x;
      const abz = b.z - a.z;
      const t = Math.min(1, Math.max(0, ((fox.x - a.x) * abx + (fox.z - a.z) * abz) / (abx * abx + abz * abz || 1)));
      const px = a.x + abx * t;
      const pz = a.z + abz * t;
      const d = (fox.x - px) ** 2 + (fox.z - pz) ** 2;
      if (d < best) {
        best = d;
        nearest.set(px, a.y + (b.y - a.y) * t, pz);
      }
    }
    if (o.brook.length === 1) nearest.copy(o.brook[0]!);
    brookPan.positionX.setTargetAtTime(nearest.x, now, 0.3);
    brookPan.positionY.setTargetAtTime(nearest.y, now, 0.3);
    brookPan.positionZ.setTargetAtTime(nearest.z, now, 0.3);
    // murmur: the bed's level and colour wander every few hundred ms
    if (now >= nextMurmur) {
      nextMurmur = now + 0.15 + rand() * 0.35;
      brookGain.gain.setTargetAtTime(WATER.brook * flow * (0.35 + rand() * 0.9), now, 0.12);
      brookBand.frequency.setTargetAtTime(700 + rand() * 900, now, 0.15);
    }
    bubbleOut.gain.setTargetAtTime(WATER.bubbles * flow, now, 0.8);
    if (flow > 0.05 && now >= nextBubble) {
      // irregular, never a pulse: exponential gaps around the rate
      nextBubble = now + (-Math.log(1 - rand() * 0.95) / (WATER.bubbleRate * flow));
      const osc = bOsc[bubbleI]!;
      const env = bEnv[bubbleI]!;
      bubbleI = (bubbleI + 1) % BUBBLES;
      // a real bubble is a few ms of a fast upward chirp: long ones read as beeps
      const f0 = 600 + rand() * rand() * 1900;
      const len = 0.004 + rand() * 0.01;
      osc.frequency.setValueAtTime(f0, now);
      osc.frequency.exponentialRampToValueAtTime(f0 * (1.3 + rand() * 0.5), now + len * 2);
      env.gain.setValueAtTime(0, now);
      env.gain.linearRampToValueAtTime(0.3 + rand() * 0.7, now + 0.002);
      env.gain.setTargetAtTime(0, now + 0.002, len);
      bubbles++;
    }
    // the wheel: one soft knock per paddle; the slosh swells with each paddle's dip
    if (turn > 0.02) {
      // each paddle dips and lifts: the slosh swells through its stroke
      slosh.gain.setTargetAtTime(WATER.slosh * turn * (0.4 + 0.6 * Math.sin(Math.PI * paddle) ** 2), now, 0.08);
      paddle += dt * WATER.paddleRate * turn;
      if (paddle >= 1) {
        paddle -= 1;
        knock.gain.setValueAtTime(0, now);
        knock.gain.linearRampToValueAtTime(WATER.wheelKnock * (0.7 + rand() * 0.4) * Math.min(1, turn * 1.5), now + 0.01);
        knock.gain.setTargetAtTime(0, now + 0.01, 0.035);
        knockBand.frequency.setValueAtTime(170 + rand() * 70, now);
        knocks++;
      }
    } else slosh.gain.setTargetAtTime(0, now, 0.5);
  }

  /** the leaf dam gives way here: one soft whoosh and a splash */
  function burst(at: THREE.Vector3): void {
    if (ac.state !== 'running') return;
    const now = ac.currentTime;
    burstPan.positionX.setValueAtTime(at.x, now);
    burstPan.positionY.setValueAtTime(at.y, now);
    burstPan.positionZ.setValueAtTime(at.z, now);
    whoosh.gain.setValueAtTime(0, now);
    // a slow swell, not a strike (a 0.35 s rise to 1.8 kHz read as a whip)
    whoosh.gain.linearRampToValueAtTime(WATER.burst, now + 0.7);
    whoosh.gain.setTargetAtTime(0, now + 0.9, 0.6);
    whooshBand.frequency.setValueAtTime(250, now);
    whooshBand.frequency.exponentialRampToValueAtTime(1000, now + 0.8);
    whooshBand.frequency.exponentialRampToValueAtTime(350, now + 2.2);
    splash.gain.setValueAtTime(0, now + 0.6);
    splash.gain.linearRampToValueAtTime(WATER.burst * 0.8, now + 0.75);
    splash.gain.setTargetAtTime(0, now + 0.8, 0.5);
    bursts++;
  }

  // cold:begin (built once)
  return { update, burst, state: () => ({ bubbles, knocks, bursts }) };
  // cold:end
}
