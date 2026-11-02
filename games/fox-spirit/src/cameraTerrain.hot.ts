/** Analytic body-width sight test; terrain can mask a shoulder while the centre segment stays clear. */
export function terrainBodyVisibility(
  fx: number, fy: number, fz: number, lx: number, ly: number, lz: number,
  terrainAt: (x: number, z: number) => number, width: number,
): number {
  const dx = lx - fx, dz = lz - fz, length = Math.hypot(dx, dz);
  if (length < .1) return 1;
  const sx = dz / length * width, sz = -dx / length * width;
  let visibility = 0;
  for (let side = -1; side <= 1; side++) {
    const bx = fx + side * sx, bz = fz + side * sz;
    let margin = Infinity;
    // Leave the supporting ground directly under the feet out of the view reserve.
    for (let i = 1; i <= 11; i++) {
      const t = i / 12;
      const x = bx + (lx - bx) * t, z = bz + (lz - bz) * t;
      const y = fy + .18 + (ly - fy - .18) * t;
      margin = Math.min(margin, y - terrainAt(x, z));
    }
    const u = Math.max(0, Math.min(1, (margin + .1) / .16));
    visibility += u * u * (3 - 2 * u);
  }
  return visibility / 3;
}
