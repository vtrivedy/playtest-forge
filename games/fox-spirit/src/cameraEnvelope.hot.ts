import * as THREE from 'three';

const ESCAPE_ANGLES = [15, -15, 30, -30, 45, -45, 60, -60, 90, -90, 120, -120, 150, -150, 180];
const MAX_PITCH_TAN = Math.tan(THREE.MathUtils.degToRad(55));

type EnvelopeOptions = {
  params: { minDistance: number; distance: number; clearance: number; sideBias: number };
  previousLens: THREE.Vector3;
  surfaceAt?: (x: number, z: number, refY: number) => number;
  lensBlocked?: (x: number, y: number, z: number, radius: number) => boolean;
  yaw: () => number;
  sightFraction: (focus: THREE.Vector3, lens: THREE.Vector3) => number;
};

/** Workspace belongs to the rig; every query reuses it, including candidate checks. */
export function createCameraEnvelope(opts: EnvelopeOptions) {
  const freeLens = new THREE.Vector3();
  const candidateLens = new THREE.Vector3();
  const previousLens = opts.previousLens;
  const params = opts.params;
  let focus = previousLens, lens = previousLens;
  let dt = 0, ux = 0, uz = 1, best = Infinity, previousFree = false;

  function bodyRadius(point: THREE.Vector3): number {
    return Math.max(params.minDistance, Math.abs(point.y - focus.y) / MAX_PITCH_TAN);
  }
  function bodyClear(point: THREE.Vector3): boolean {
    return Math.hypot(point.x - focus.x, point.z - focus.z) >= bodyRadius(point) - .00001;
  }
  function floorClearAt(x: number, y: number, z: number): boolean {
    const floor = opts.surfaceAt?.(x, z, y + 1.5);
    return floor === undefined || !Number.isFinite(floor) || y >= floor + params.clearance * .8 - .00001;
  }
  function floorClear(point: THREE.Vector3): boolean {
    return floorClearAt(point.x, point.y, point.z);
  }
  function liftCandidate(maximumStep: number): void {
    const floor = opts.surfaceAt?.(candidateLens.x, candidateLens.z, candidateLens.y + 1.5);
    if (floor === undefined || !Number.isFinite(floor) || candidateLens.y >= floor + params.clearance * .8) return;
    const needed = floor + params.clearance * .8 + .01;
    if (previousLens.y < needed) {
      candidateLens.copy(previousLens);
      candidateLens.y += Math.min(maximumStep, needed - previousLens.y);
    } else candidateLens.y = needed;
    const travel = candidateLens.distanceTo(previousLens);
    if (travel > maximumStep) candidateLens.lerpVectors(previousLens, candidateLens, maximumStep / travel);
  }
  function pathClear(): boolean {
    const steps = Math.max(1, Math.ceil(candidateLens.distanceTo(previousLens) / .1));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const x = THREE.MathUtils.lerp(previousLens.x, candidateLens.x, t);
      const y = THREE.MathUtils.lerp(previousLens.y, candidateLens.y, t);
      const z = THREE.MathUtils.lerp(previousLens.z, candidateLens.z, t);
      if (opts.lensBlocked!(x, y, z, .2) || !floorClearAt(x, y, z)) return false;
    }
    return true;
  }
  function check(x: number, z: number, standoff = .35): void {
    const blocked = opts.lensBlocked!;
    // Escape laterally at the last clear height before descending past a platform.
    candidateLens.set(x, previousFree ? Math.max(lens.y, previousLens.y) : lens.y, z);
    if (previousFree) {
      const travel = candidateLens.distanceTo(previousLens), maximumStep = Math.max(.08, 16 * dt);
      if (travel > maximumStep) candidateLens.lerpVectors(previousLens, candidateLens, maximumStep / travel);
      liftCandidate(maximumStep);
    }
    const cx = candidateLens.x - focus.x, cz = candidateLens.z - focus.z;
    const cr = Math.hypot(cx, cz), minimumRoom = bodyRadius(candidateLens);
    if (cr < minimumRoom) {
      candidateLens.x = focus.x + (cr > .01 ? cx / cr : ux) * minimumRoom;
      candidateLens.z = focus.z + (cr > .01 ? cz / cr : uz) * minimumRoom;
    }
    const cost = candidateLens.distanceToSquared(lens) * .2 + (previousFree ? candidateLens.distanceToSquared(previousLens) * .8 : 0);
    if (cost >= best || !floorClear(candidateLens) || blocked(candidateLens.x, candidateLens.y, candidateLens.z, standoff)) return;
    if (previousFree && !pathClear()) return;
    const visibility = opts.sightFraction(focus, candidateLens);
    const visibleCost = cost + (1 - visibility) * params.distance * params.distance * 4;
    if (visibleCost >= best) return;
    best = visibleCost;
    freeLens.copy(candidateLens);
  }
  function update(nextFocus: THREE.Vector3, nextLens: THREE.Vector3, nextDt: number, firstFrame: boolean): boolean {
    const blocked = opts.lensBlocked;
    if (!blocked) return false;
    focus = nextFocus; lens = nextLens; dt = nextDt;
    const desiredFree = !blocked(lens.x, lens.y, lens.z, .35) && bodyClear(lens);
    if (desiredFree) {
      // Release an elevated escape pose along a checked segment instead of
      // dropping straight back to the unconstrained spring in one frame.
      const travel = lens.distanceTo(previousLens), maximumStep = Math.max(.08, 12 * dt);
      if (!firstFrame && travel > maximumStep && bodyClear(previousLens) && floorClear(previousLens)
        && !blocked(previousLens.x, previousLens.y, previousLens.z, .2)) {
        candidateLens.lerpVectors(previousLens, lens, maximumStep / travel);
        liftCandidate(maximumStep);
        const clear = bodyClear(candidateLens) && floorClear(candidateLens) && pathClear();
        if (clear) { lens.copy(candidateLens); return true; }
      }
      if (firstFrame || travel <= maximumStep) return false;
      // A direct release can cross the platform edge. Keep using the escape
      // search until a continuous path back to the spring becomes clear.
    }
    const dx = lens.x - focus.x, dz = lens.z - focus.z;
    const range = Math.hypot(dx, dz);
    ux = range > .01 ? dx / range : Math.sin(opts.yaw() + params.sideBias);
    uz = range > .01 ? dz / range : Math.cos(opts.yaw() + params.sideBias);
    best = Infinity;
    previousFree = !firstFrame && !blocked(previousLens.x, previousLens.y, previousLens.z, .2);
    const previousClear = previousFree && bodyClear(previousLens);
    const minimum = bodyRadius(lens);
    const maximum = Math.max(range, params.distance, minimum) + .8;
    for (let r = minimum; r <= maximum + .001; r += .1) check(focus.x + ux * r, focus.z + uz * r);
    const sideRange = Math.max(range, minimum);
    for (let i = 0; i < ESCAPE_ANGLES.length; i++) {
      const a = THREE.MathUtils.degToRad(ESCAPE_ANGLES[i]!), c = Math.cos(a), s = Math.sin(a);
      check(focus.x + (ux * c + uz * s) * sideRange, focus.z + (uz * c - ux * s) * sideRange);
    }
    // A nearby post can block every direction aimed around the distant fox.
    // Try a local detour before falling back to the previous clear pose.
    if (!Number.isFinite(best) && previousFree) {
      const step = Math.max(.08, 16 * dt);
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        check(previousLens.x + Math.sin(a) * step, previousLens.z + Math.cos(a) * step, .2);
      }
    }
    if (Number.isFinite(best)) lens.copy(freeLens);
    else if (previousClear && floorClear(previousLens)) { lens.copy(previousLens); return true; }
    return Number.isFinite(best);
  }
  return update;
}
