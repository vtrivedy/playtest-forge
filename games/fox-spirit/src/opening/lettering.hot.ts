/** Lettering's per-frame step (lettering.ts builds the planes): fit to the lens, set opacity. No allocation. */
import type * as THREE from 'three';

/** `y` is the plane centre's NDC height; `x` (with `left`) puts the plane's left edge at that NDC x instead of centring */
export type LetterPlane = { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; aspect: number; heightFrac: number; y: number; x: number; left: boolean };

const DIST = 1;
const DEG = Math.PI / 180;

/** place the plane `DIST` in front of the camera at its NDC height and size; hidden (not drawn) at zero opacity */
export function fitLetterPlane(p: LetterPlane, cam: THREE.PerspectiveCamera, opacity: number): void {
  p.mesh.visible = opacity > 0.002;
  p.mat.opacity = opacity;
  if (!p.mesh.visible) return;
  const halfH = Math.tan(cam.fov * 0.5 * DEG) * DIST;
  let h = 2 * halfH * p.heightFrac;
  const maxW = 2 * halfH * cam.aspect * 0.94;
  if (h * p.aspect > maxW) h = maxW / p.aspect;
  p.mesh.scale.set(h * p.aspect, h, 1);
  const w = h * p.aspect;
  p.mesh.position.set(p.left ? halfH * cam.aspect * p.x + w * 0.5 : 0, halfH * p.y, -DIST);
}
