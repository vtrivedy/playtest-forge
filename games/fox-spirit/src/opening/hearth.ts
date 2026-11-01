/** First heat teach. Art comes from the existing chemistry kit; no second reactor implementation. */
import * as THREE from 'three';
import { createUpdrafts, type HearthSpot } from '../chem/updraft';
import type { SupplyFn } from '../chem/reactor';

export const OPENING_HEARTH = { x: 5.6, z: 74.2 };

export function createOpeningHearth(opts: {
  scene: THREE.Scene;
  groundH: (x: number, z: number) => number;
  fox: THREE.Object3D;
  /** ColorField's temporary paint supply. The local aura guarantees run-past ignition too. */
  supplyAt?: SupplyFn;
  onIgnite?: (at: THREE.Vector3) => void;
  /** Additional coal-only volumes; opening/chemistry updates these separately. */
  extraSpots?: HearthSpot[];
}) {
  let latched = false;
  let complete = false;
  let ignition: 'aura' | 'dash' | null = null;
  let dashing = false;
  const updrafts = createUpdrafts(opts.scene, [{
    id: 'H-a', ...OPENING_HEARTH,
    y: opts.groundH(OPENING_HEARTH.x, OPENING_HEARTH.z), height: 9,
  }, ...(opts.extraSpots ?? [])], {
    onIgnite(h) {
      if (h.spot.id !== 'H-a') return;
      latched = true;
      ignition = dashing ? 'dash' : 'aura';
      // Reactor.update finishes this ignition frame; next update takes its restored branch.
      h.reactor.restored = true;
      opts.onIgnite?.(h.base.clone());
    },
  });
  const hud = document.createElement('div');
  hud.dataset.openingTeach = 'heat';
  Object.assign(hud.style, {
    position: 'fixed', left: '50%', bottom: '7%', transform: 'translateX(-50%)',
    color: '#f4e5cb', background: 'rgba(43,35,30,.76)', padding: '10px 18px',
    borderRadius: '5px', font: '16px Georgia,serif', textAlign: 'center',
    pointerEvents: 'none', maxWidth: '80vw', transition: 'opacity .4s',
  });
  document.body.append(hud);
  let elapsed = 0;
  return {
    updrafts,
    update(dt: number, t: number, player?: { dashing?: boolean; grounded?: boolean; pos?: number[] }) {
      elapsed += dt;
      dashing = player?.dashing ?? false;
      const fox = opts.fox.position;
      updrafts.hearths[0]!.update(dt, t, p => {
        const distance = Math.hypot(p.x - fox.x, p.z - fox.z);
        const aura = 1 - THREE.MathUtils.smoothstep(distance, dashing ? 2 : 1.5, dashing ? 3.2 : 2.5);
        return Math.max(aura, opts.supplyAt?.(p) ?? 0);
      }, false);
      const near = Math.hypot(fox.x - OPENING_HEARTH.x, fox.z - OPENING_HEARTH.z) < 12;
      const ride = updrafts.lastRide;
      if (ride?.hearth === 'H-a' && ride.landFeetY !== null && ride.landFeetY > ride.baseY + 2) complete = true;
      hud.textContent = latched ? 'Space · jump and hold to ride the warm air' : 'Bring your colour to the cold hearth · run close or Shift dash';
      hud.style.opacity = !complete && near && elapsed > 2 ? '1' : '0';
    },
    state() {
      return { ...updrafts.state(), latched, ignition, complete };
    },
  };
}
