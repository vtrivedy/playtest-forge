import * as THREE from 'three';
import type { ColorField } from '../../../src/render';
import type { AutumnParticles, EmberMotes } from '../../../src/render';
import type { FollowCamera } from './camera';
import type { GameAudio } from './audio';
import type { Hud } from './hud';

export type RestoreCinematic = {
  active: boolean;
  /** Call once when shrine wakes */
  trigger: () => void;
  update: (dt: number) => void;
};

/**
 * Trailer money shot: camera pull-back, ColorField autumn wavefront,
 * leaf/ember burst, music swell, HUD flash.
 */
export function createRestoreCinematic(opts: {
  colorField: ColorField;
  shrinePos: THREE.Vector3;
  radius?: number;
  durationS?: number;
  autumnFX: AutumnParticles;
  motes?: EmberMotes;
  camera: FollowCamera;
  audio: GameAudio;
  hud: Hud;
}): RestoreCinematic {
  const radius = opts.radius ?? 26;
  const durationS = opts.durationS ?? 3.6;
  let active = false;
  let age = 0;
  let region: { radius: number; targetRadius: number } | null = null;
  let sparkTrickle = 0;
  // ember bowl in the shrine niche (3.2 m shrine, niche faces +Z) — just in front of the stone so sparks aren't buried
  const burstAt = opts.shrinePos.clone().add(new THREE.Vector3(0, 1.2, 1.35));

  return {
    get active() {
      return active;
    },
    set active(v) {
      active = v;
    },
    trigger() {
      if (active) return;
      active = true;
      age = 0;
      region = opts.colorField.restore(opts.shrinePos, radius, durationS);
      opts.camera.setPullBack(2.2, 2.2);
      opts.audio.play('shrine');
      opts.audio.swell(4.5);
      opts.hud.flashRestore();
      opts.hud.setPrompt('Autumn restored');
      opts.autumnFX.setWavefront(opts.shrinePos, 2, 1.4);
      opts.autumnFX.swirl(opts.shrinePos, 110);
      opts.motes?.burst(burstAt, { count: 80, speed: [2, 4.5], lift: 0.4, buoyancy: 0.5, drag: 1.6, flash: 1.8, size: [0.05, 0.1] });
      sparkTrickle = 1.8;
    },
    update(dt) {
      if (!active) return;
      age += dt;
      // after the first pop, a thinning plume of embers keeps rising off the shrine
      if (sparkTrickle > 0) {
        sparkTrickle -= dt;
        opts.motes?.burst(burstAt, { count: Math.random() < sparkTrickle * 0.6 ? 2 : 1, speed: [0.3, 1.2], lift: 0.8, life: [1.4, 2.6], buoyancy: 1, size: [0.04, 0.08] });
      }
      const r = region?.radius ?? Math.min(radius, (age / durationS) * radius);
      const strength = 1.1 + Math.sin(age * 3) * 0.15;
      opts.autumnFX.setWavefront(opts.shrinePos, r, strength);
      if (age > durationS + 1.5) {
        // hold soft wavefront at full
        opts.autumnFX.setWavefront(opts.shrinePos, radius, 0.35);
      }
    },
  };
}
