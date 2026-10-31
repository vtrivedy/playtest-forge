import * as THREE from 'three';

/** Uniform cubic approximation with mirrored ends: smooth the surface, never move a rig joint. */
export class TailBrushCurve extends THREE.Curve<THREE.Vector3> {
  constructor(private readonly points: readonly THREE.Vector3[]) {
    super();
    this.arcLengthDivisions = 1000;
  }
  override getPoint(t: number, out = new THREE.Vector3()) {
    const last = this.points.length - 1;
    const x = THREE.MathUtils.clamp(t, 0, 1) * last;
    const i = Math.min(last - 1, Math.floor(x)), u = x - i, u2 = u * u, u3 = u2 * u;
    const point = (index: number) => index < 0
      ? this.points[0]!.clone().multiplyScalar(2).sub(this.points[1]!)
      : index > last ? this.points[last]!.clone().multiplyScalar(2).sub(this.points[last - 1]!) : this.points[index]!;
    return out.copy(point(i - 1)).multiplyScalar((1 - 3 * u + 3 * u2 - u3) / 6)
      .addScaledVector(point(i), (4 - 6 * u2 + 3 * u3) / 6)
      .addScaledVector(point(i + 1), (1 + 3 * u + 3 * u2 - 3 * u3) / 6)
      .addScaledVector(point(i + 2), u3 / 6);
  }
}

/** Shape-preserving cubic: no zero-slope terrace at every profile knot. Radii are metres. */
export function tailProfileAt(t: number, profile: readonly (readonly [number, number])[]) {
  t = THREE.MathUtils.clamp(t, profile[0]![0], profile[profile.length - 1]![0]);
  const h = profile.slice(1).map((p, i) => p[0] - profile[i]![0]);
  const d = h.map((span, i) => (profile[i + 1]![1] - profile[i]![1]) / span);
  const slopes = profile.map((_, i) => {
    if (i === 0) return d[0]!;
    if (i === profile.length - 1) return d[d.length - 1]!;
    if (d[i - 1]! * d[i]! <= 0) return 0;
    const w1 = 2 * h[i]! + h[i - 1]!, w2 = h[i]! + 2 * h[i - 1]!;
    return (w1 + w2) / (w1 / d[i - 1]! + w2 / d[i]!);
  });
  const end = profile.length - 1;
  const i = Math.min(end - 1, Math.max(0, profile.findIndex((p) => p[0] >= t) - 1));
  const a = profile[i]!, b = profile[i + 1]!, span = b[0] - a[0];
  const u = THREE.MathUtils.clamp((t - a[0]) / span, 0, 1), u2 = u * u, u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * a[1] + (u3 - 2 * u2 + u) * span * slopes[i]!
    + (-2 * u3 + 3 * u2) * b[1] + (u3 - u2) * span * slopes[i + 1]!;
}
