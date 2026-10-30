import * as THREE from 'three';

/**
 * Colour chemistry (docs/design/world-1.md §1.2). A Reactor is anything that acts while coloured:
 * it reads supply at its probes, warms over `igniteTime`, holds `holdTime` after supply ends, then
 * gutters over `gutterTime` (visible warning, output ramps down). Restored reactors never cool.
 */
export type ReactorKind = 'hearth' | 'wind' | 'water' | 'root';
export type ReactorState = 'cold' | 'burning' | 'holding' | 'guttering' | 'restored';

export type ReactorTunables = {
  /** Supply at any probe ≥ this lights the reactor */
  threshold: number;
  igniteTime: number;
  holdTime: number;
  gutterTime: number;
};

/** Supply probe: 0..1 temporary colour (aura/trail) at a world point. Dash strokes / Shade drain plug in here. */
export type SupplyFn = (p: THREE.Vector3) => number;

export class Reactor {
  heat = 0;
  state: ReactorState = 'cold';
  restored = false;
  /** Seconds of hold left once supply ends */
  holdLeft = 0;
  /** Max supply seen at the probes this tick (debug) */
  supply = 0;
  /** Seconds since supply last ended (−1 while supplied or cold) */
  sinceSupply = -1;
  /** Fired once per cold → lit transition */
  onIgnite?: () => void;

  constructor(
    readonly id: string,
    readonly kind: ReactorKind,
    readonly probes: THREE.Vector3[],
    readonly tun: ReactorTunables,
  ) {}

  /** `drainedAt`: probe sits in a Shade's drain — an unsupplied reactor there skips its hold (§1.2 step 3) */
  update(dt: number, supplyAt: SupplyFn, drainedAt?: (p: THREE.Vector3) => boolean): void {
    if (this.restored) {
      this.heat = 1;
      this.state = 'restored';
      return;
    }
    let s = 0;
    for (const p of this.probes) s = Math.max(s, supplyAt(p));
    this.supply = s;
    const t = this.tun;
    if (s >= t.threshold) {
      if (this.state === 'cold') this.onIgnite?.();
      this.heat = t.igniteTime > 0 ? Math.min(1, this.heat + dt / t.igniteTime) : 1;
      this.holdLeft = t.holdTime;
      this.sinceSupply = -1;
      this.state = 'burning';
      return;
    }
    if (this.state === 'cold') return;
    if (this.holdLeft > 0 && drainedAt && this.probes.some(drainedAt)) this.holdLeft = 0;
    this.sinceSupply = this.sinceSupply < 0 ? dt : this.sinceSupply + dt;
    if (this.holdLeft > 0) {
      this.holdLeft -= dt;
      this.state = 'holding';
      return;
    }
    this.heat = t.gutterTime > 0 ? Math.max(0, this.heat - dt / t.gutterTime) : 0;
    this.state = this.heat > 0 ? 'guttering' : 'cold';
    if (this.state === 'cold') this.sinceSupply = -1;
  }
}
