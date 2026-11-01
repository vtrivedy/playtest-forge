/** Placed warmth feeds the shipped reactors. Color and carried heat cannot complete a Keeping. */
import * as THREE from 'three';
import type { Hearth, UpdraftSystem } from '../chem/updraft';

export type CoalHeatSource = {
  position: THREE.Vector3;
  carried: boolean;
  heat: number;
};

export function createKeepingChemistry(opts: {
  updrafts: UpdraftSystem;
  steamId: string;
  rootId: string;
  coal: () => CoalHeatSource;
  /** Reconnect a permanent walking route so warmth can be picked back up. */
  onSteam?: (at: THREE.Vector3) => void;
  /** The place owns the authored tree settle; this event fires exactly once. */
  onComplete?: (at: THREE.Vector3) => void;
}) {
  const find = (id: string): Hearth => {
    const h = opts.updrafts.hearths.find(h => h.spot.id === id);
    if (!h) throw new Error(`Keeping chemistry missing hearth: ${id}`);
    return h;
  };
  const steam = find(opts.steamId);
  const root = find(opts.rootId);
  if (steam === root) throw new Error('Steam and root-hearth must be distinct heat reactions');
  let steamLatched = false;
  let completed = false;
  let steamReactions = 0;
  let releases = 0;
  const target = new THREE.Vector3();

  /** Placement is forgiving around the bowl, but rejects coals on another floor. */
  function supply(h: Hearth, coal: CoalHeatSource): number {
    if (coal.carried || !Number.isFinite(coal.heat) || coal.heat <= 0) return 0;
    target.set(h.spot.x, h.spot.y, h.spot.z);
    const dy = coal.position.y - target.y;
    if (dy < -0.5 || dy > 1.6) return 0;
    const d = Math.hypot(coal.position.x - target.x, coal.position.z - target.z);
    return THREE.MathUtils.clamp(coal.heat, 0, 1) * (1 - THREE.MathUtils.smoothstep(d, 1.1, 2.2));
  }

  return {
    steam,
    root,
    update(dt: number, t: number) {
      const coal = opts.coal();
      for (const h of [steam, root]) {
        const heat = supply(h, coal);
        h.update(dt, t, () => heat, false);
      }
      // Existing reactors provide the ignition ramp; no parallel timer or fuel currency.
      if (!steamLatched && steam.reactor.heat >= 1 - 1e-6) {
        steamLatched = true;
        steamReactions++;
        steam.reactor.restored = true;
        steam.flare = 0.6;
        opts.onSteam?.(steam.base.clone());
      }
      if (!completed && root.reactor.heat >= 1 - 1e-6) {
        completed = true;
        releases++;
        root.reactor.restored = true;
        root.flare = 1.4;
        opts.onComplete?.(root.base.clone());
      }
    },
    state() {
      const reaction = (h: Hearth) => ({
        id: h.spot.id,
        position: [h.spot.x, h.spot.y, h.spot.z],
        heat: +h.reactor.heat.toFixed(3),
        supply: +h.reactor.supply.toFixed(3),
        state: h.reactor.state,
        restored: h.reactor.restored,
      });
      return {
        steam: reaction(steam), root: reaction(root),
        steamLatched, completed, steamReactions, releases,
      };
    },
  };
}
