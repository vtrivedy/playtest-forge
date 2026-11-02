/**
 * Hearth hum (DESIGN v1 orientation: "hearths hum first"). Every lit hearth drones a low warm chord whose
 * loudness follows the fox's distance, so a lit hearth can be found by ear; cold ones are silent. Lit hearths
 * and the carried coal crackle where they are; a hearth catching swells and the music dips under it. The Runaway
 * Page turns a soft page when it startles and gives a low chime per catch (no continuous rustle).
 * A Keeping completion swells one rising chord. All on the opening's one graph (audio.ts), placed in 3D.
 */
import * as THREE from 'three';
import type { Hearth } from '../chem/updraft';
import type { OpeningAudio } from './audio';

/**
 * Levels for a gentle mix (Kit :1144; DESIGN-audio-moss.md): nothing here runs as a bed the player can't get away
 * from. A lit hearth hums and crackles only within a few metres (`near`..`far`); the coal crackles only close to
 * the fox; the page has no continuous rustle (its 9 Hz flutter read as a pulse); flaps are rate-limited soft paper turns.
 */
const HUM = { near: 2, far: 8, gain: 0.03, crackle: 0.12, flap: 0.14, flapGap: 1.5 };

export function createHearthHum(opts: {
  audio: OpeningAudio;
  hearths: Hearth[];
  fox: THREE.Object3D;
  coal: () => THREE.Vector3;
  /** the Runaway Page: a soft page turn per startle; a low note per catch */
  page?: () => { pos: THREE.Vector3; fleeing: boolean; catches: number; flaps: number; kept: boolean };
}) {
  const { audio } = opts;
  const ac = audio.ac;
  // each hearth: root + fifth + soft octave, a slow beat between detuned pairs, low-passed warm; panned at the
  // hearth (the panner's own roll-off is pushed out past `far` so the loudness stays the authored curve)
  const voices = opts.hearths.map((h, i) => {
    const gain = ac.createGain();
    gain.gain.value = 0;
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    lp.connect(gain).connect(audio.at(h.base, HUM.far));
    const base = [55, 61.7, 49][i % 3]!;
    for (const [mul, amp, det] of [[1, 0.5, 0], [1, 0.35, 0.6], [1.5, 0.22, -0.4], [2, 0.12, 0.3]] as const) {
      const o = ac.createOscillator();
      o.type = mul === 1 ? 'sine' : 'triangle';
      o.frequency.value = base * mul + det;
      const a = ac.createGain();
      a.gain.value = amp;
      o.connect(a).connect(lp);
      o.start();
    }
    const crackle = audio.loop('hearth-crackle', audio.at(h.base, 2));
    return { h, gain, crackle, lit: h.reactor.restored };
  });
  // the coal crackles where it is (carried, set down, in a bowl)
  const coalPan = audio.at(opts.coal(), 1.5);
  const coalCrackle = audio.loop('hearth-crackle', coalPan);
  let caught = 0;
  let flapped = 0;
  let lastFlap = -Infinity;

  /** a short paper-bright arpeggio; one more note per catch, a full open chord when it is kept */
  function chime(n: number): void {
    const t = ac.currentTime;
    [523.3, 659.3, 784, 1046.5].slice(0, Math.min(4, n + 1)).forEach((hz, i) => {
      const o = ac.createOscillator();
      o.type = 'sine';
      o.frequency.value = hz / 2;
      const g = ac.createGain();
      g.gain.setValueAtTime(0, t + i * 0.09);
      g.gain.linearRampToValueAtTime(0.025, t + i * 0.09 + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.09 + 1.4);
      o.connect(g).connect(audio.sfx);
      o.start(t + i * 0.09);
      o.stop(t + i * 0.09 + 1.5);
    });
  }
  const fall = (d: number) => 1 - THREE.MathUtils.smoothstep(d, HUM.near, HUM.far);
  const set = (p: PannerNode, v: THREE.Vector3) => {
    const now = ac.currentTime;
    p.positionX.setTargetAtTime(v.x, now, 0.03);
    p.positionY.setTargetAtTime(v.y, now, 0.03);
    p.positionZ.setTargetAtTime(v.z, now, 0.03);
  };
  return {
    update(): void {
      if (ac.state !== 'running') return;
      const f = opts.fox.position;
      const now = ac.currentTime;
      for (const v of voices) {
        const { h, gain, crackle } = v;
        const lit = h.reactor.restored ? 1 : h.reactor.heat * 0.5;
        gain.gain.setTargetAtTime(HUM.gain * lit * fall(f.distanceTo(h.base)), now, 0.25);
        crackle.set(HUM.crackle * lit * fall(f.distanceTo(h.base)), 0.4);
        if (h.reactor.restored && !v.lit) {
          // a hearth catches: a soft whump of fire and the music makes room for it
          audio.play('steam-1', { at: h.base, gain: 0.35, rate: 0.55 });
          audio.duck(0.5, 2.5);
        }
        v.lit = h.reactor.restored;
      }
      const c = opts.coal();
      set(coalPan, c);
      coalCrackle.set(HUM.crackle * (1 - THREE.MathUtils.smoothstep(f.distanceTo(c), 1, 6)), 0.2);
      const pg = opts.page?.();
      if (pg) {
        if (pg.flaps > flapped) {
          flapped = pg.flaps;
          if (now - lastFlap >= HUM.flapGap) {
            lastFlap = now;
            audio.play('soft-paper', { at: pg.pos, gain: HUM.flap, rate: 0.9 + Math.random() * 0.1 });
          }
        }
        if (pg.catches > caught) {
          caught = pg.catches;
          audio.play('soft-paper', { at: pg.pos, gain: 0.3, rate: 0.75 });
          chime(pg.kept ? 4 : caught);
          audio.duck(pg.kept ? 0.3 : 0.5, pg.kept ? 6 : 2);
        }
      }
    },
    /** the Keeping lets go: one rising open chord, swelling then fading over ~6 s (the music steps aside) */
    swell(): void {
      if (ac.state !== 'running') return;
      audio.duck(0.35, 5);
      const t = ac.currentTime;
      [110, 164.8, 220, 277.2, 329.6].forEach((hz, i) => {
        const o = ac.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(hz * 0.98, t + i * 0.35);
        o.frequency.linearRampToValueAtTime(hz, t + i * 0.35 + 2);
        const g = ac.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.05, t + i * 0.35 + 1.4);
        g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.35 + 6.5);
        o.connect(g).connect(audio.sfx);
        o.start(t + i * 0.35);
        o.stop(t + i * 0.35 + 7);
      });
    },
    state: () => ({ running: ac.state === 'running', voices: voices.map(({ h, gain }) => ({ id: h.spot.id, gain: +gain.gain.value.toFixed(4) })) }),
  };
}
