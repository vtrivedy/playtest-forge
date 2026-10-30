import * as THREE from 'three';
import type { ColorField } from '../../../src/render';
import type { AutumnParticles } from '../../../src/render';
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
  camera: FollowCamera;
  audio: GameAudio;
  hud: Hud;
}): RestoreCinematic {
  const radius = opts.radius ?? 26;
  const durationS = opts.durationS ?? 3.6;
  let active = false;
  let age = 0;
  let region: { radius: number; targetRadius: number } | null = null;

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
    },
    update(dt) {
      if (!active) return;
      age += dt;
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
