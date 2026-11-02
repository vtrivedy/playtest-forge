/**
 * Lettering: the slice's few words drawn into the rendered frame, not the DOM, so every capture path (screenshot or
 * MediaRecorder on the canvas) sees exactly what the player sees. One camera-fixed plane per line group; its canvas is
 * redrawn only when the words change. Per-frame fit + fade live in lettering.hot.ts.
 */
import * as THREE from 'three';
import type { LetterPlane } from './lettering.hot';

/** `outline` is the warm-dark stroke width as a fraction of the font size. */
export type LetterLine = { text: string; px: number; italic?: boolean; spacing?: number; alpha?: number; outline?: number };
/** `left`: anchor the plane's left edge at NDC `x` and set text flush left on a dark panel (teach hints) */
export type LetterOpts = { x?: number; left?: boolean; panel?: boolean };

const FONT = 'Georgia, "DejaVu Serif", "Liberation Serif", serif';

/**
 * A plane `heightFrac` of the view tall, centred at NDC `y`, its canvas `cw`×`ch` (the plane keeps that aspect and
 * shrinks to fit narrow views). Add `mesh` to the camera (which must itself be in the scene).
 */
export function createLetterPlane(cw: number, ch: number, heightFrac: number, y: number, o: LetterOpts = {}): LetterPlane & { draw: (lines: LetterLine[]) => void } {
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
    x: o.x ?? 0,
    left: o.left ?? false,
    draw(lines) {
      g.clearRect(0, 0, cw, ch);
      const left = o.left ?? false;
      const pad = ch * 0.22;
      g.textAlign = left ? 'left' : 'center';
      if (o.panel) {
        // a soft dark ink panel sized to the widest line, like the old DOM teach box
        let wmax = 0;
        for (const l of lines) {
          g.font = `${l.italic ? 'italic ' : ''}${l.px}px ${FONT}`;
          wmax = Math.max(wmax, g.measureText(l.text).width);
        }
        const pw = Math.min(cw, wmax + pad * 2);
        g.fillStyle = 'rgba(43,35,30,0.78)';
        g.beginPath();
        (g as CanvasRenderingContext2D & { roundRect: (...a: number[]) => void }).roundRect(left ? 0 : (cw - pw) / 2, 0, pw, ch, ch * 0.16);
        g.fill();
      }
      g.textBaseline = 'middle';
      let total = 0;
      for (const l of lines) total += l.px * 1.25;
      let at = (ch - total) / 2;
      for (const l of lines) {
        at += l.px * 0.625;
        g.font = `${l.italic ? 'italic ' : ''}${l.px}px ${FONT}`;
        (g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${(l.spacing ?? 0) * l.px}px`;
        g.globalAlpha = l.alpha ?? 1;
        // a soft warm-dark halo so cream letters read over snow, sky and fire alike
        g.shadowColor = 'rgba(38,20,10,0.75)';
        g.shadowBlur = o.panel ? 0 : l.px * 0.28;
        g.shadowOffsetY = l.px * 0.04;
        g.fillStyle = '#fff3dc';
        const tx = left ? pad : cw / 2;
        if (l.outline) {
          g.strokeStyle = '#35251e';
          g.lineJoin = 'round';
          g.lineWidth = l.px * l.outline;
          g.strokeText(l.text, tx, at);
        }
        g.fillText(l.text, tx, at);
        if (!o.panel) g.fillText(l.text, tx, at);
        at += l.px * 0.625;
      }
      g.globalAlpha = 1;
      tex.needsUpdate = true;
    },
  };
  return plane;
}
