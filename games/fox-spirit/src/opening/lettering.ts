/**
 * Lettering: the slice's few words drawn into the rendered frame, not the DOM, so every capture path (screenshot or
 * MediaRecorder on the canvas) sees exactly what the player sees. One camera-fixed plane per line group; its canvas is
 * redrawn only when the words change. Per-frame fit + fade live in lettering.hot.ts.
 */
import * as THREE from 'three';
import type { LetterPlane } from './lettering.hot';

export type LetterLine = { text: string; px: number; italic?: boolean; spacing?: number; alpha?: number };

const FONT = 'Georgia, "DejaVu Serif", "Liberation Serif", serif';

/**
 * A plane `heightFrac` of the view tall, centred at NDC `y`, its canvas `cw`×`ch` (the plane keeps that aspect and
 * shrinks to fit narrow views). Add `mesh` to the camera (which must itself be in the scene).
 */
export function createLetterPlane(cw: number, ch: number, heightFrac: number, y: number): LetterPlane & { draw: (lines: LetterLine[]) => void } {
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const g = canvas.getContext('2d')!;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = 4;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false, fog: false, opacity: 0 });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
  mesh.renderOrder = 10000;
  mesh.frustumCulled = false;
  mesh.visible = false;
  mesh.userData.forgeSkipAO = true;
  const plane: LetterPlane & { draw: (lines: LetterLine[]) => void } = {
    mesh,
    mat,
    aspect: cw / ch,
    heightFrac,
    y,
    draw(lines) {
      g.clearRect(0, 0, cw, ch);
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      const total = lines.reduce((a, l) => a + l.px * 1.25, 0);
      let at = (ch - total) / 2;
      for (const l of lines) {
        at += l.px * 0.625;
        g.font = `${l.italic ? 'italic ' : ''}${l.px}px ${FONT}`;
        (g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${(l.spacing ?? 0) * l.px}px`;
        g.globalAlpha = l.alpha ?? 1;
        // a soft warm-dark halo so cream letters read over snow, sky and fire alike
        g.shadowColor = 'rgba(38,20,10,0.75)';
        g.shadowBlur = l.px * 0.28;
        g.shadowOffsetY = l.px * 0.04;
        g.fillStyle = '#fff3dc';
        g.fillText(l.text, cw / 2, at);
        g.fillText(l.text, cw / 2, at);
        at += l.px * 0.625;
      }
      g.globalAlpha = 1;
      tex.needsUpdate = true;
    },
  };
  return plane;
}
