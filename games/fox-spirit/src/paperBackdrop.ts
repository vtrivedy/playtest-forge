/**
 * A painted horizon for a foreign world (DESIGN-sumiro-look.md "paper sky"): one canvas wash wrapped on an open ring
 * that rides with the camera, so the horizon reads as a painting — cloud blooms bleeding into wet paper, three
 * layers of distant silhouettes paling with distance, paper tooth over everything. Painted once at build.
 */
import * as THREE from 'three';
import { rng } from './lookdevKit';

export type BackdropKind = 'press' | 'ashwater';

const W = 2048;
const H = 768;

function paint(kind: BackdropKind): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const g = cv.getContext('2d')!;
  const r = rng(kind === 'press' ? 5521 : 8813);
  // wet-in-wet cloud blooms in the upper sky: soft, granulated, a little warm ochre in the press paper
  const bloomTones = kind === 'press'
    ? ['120,118,140', '150,146,160', '176,160,128', '96,98,118']
    : ['70,78,84', '96,104,108', '140,146,146', '58,64,70'];
  for (let i = 0; i < (kind === 'press' ? 120 : 170); i++) {
    const x = r() * W;
    const y = H * (0.02 + r() * (kind === 'press' ? 0.5 : 0.45));
    const rad = 40 + r() * 170;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    const tone = bloomTones[Math.floor(r() * bloomTones.length)]!;
    const a = (kind === 'press' ? 0.07 : 0.12) + r() * 0.1;
    gr.addColorStop(0, `rgba(${tone},${a})`);
    gr.addColorStop(0.75, `rgba(${tone},${a * 0.6})`);
    gr.addColorStop(1, `rgba(${tone},0)`);
    g.fillStyle = gr;
    g.beginPath();
    g.ellipse(x, y, rad * (1.4 + r()), rad * (0.5 + r() * 0.3), 0, 0, Math.PI * 2);
    g.fill();
    // wrap: blooms that cross the seam paint on both ends
    if (x + rad * 2.4 > W) {
      g.save();
      g.translate(-W, 0);
      g.fill();
      g.restore();
    }
  }
  // silhouettes: three layers, palest and smallest farthest, each a wash with a darker settled foot
  const layers = kind === 'press'
    ? [{ base: 0.66, hMax: 0.3, tone: '150,150,168', a: 0.42 }, { base: 0.72, hMax: 0.36, tone: '104,102,124', a: 0.55 }, { base: 0.8, hMax: 0.42, tone: '52,50,66', a: 0.72 }]
    : [{ base: 0.62, hMax: 0.1, tone: '120,128,128', a: 0.45 }, { base: 0.68, hMax: 0.14, tone: '92,100,100', a: 0.55 }, { base: 0.76, hMax: 0.18, tone: '62,70,70', a: 0.7 }];
  g.filter = 'blur(1.5px)';
  for (const L of layers) {
    const base = H * L.base;
    if (kind === 'press') {
      // spire forest: narrow tapering stalks with drips at their feet
      for (let i = 0; i < 70; i++) {
        const x = r() * W;
        const h = H * L.hMax * (0.25 + r() * 0.75);
        const w = 10 + r() * 34;
        const tip = x + (r() - 0.5) * w * 0.8;
        g.fillStyle = `rgba(${L.tone},${L.a * (0.7 + r() * 0.3)})`;
        g.beginPath();
        g.moveTo(x - w, base + 6);
        g.quadraticCurveTo(x - w * 0.35, base - h * 0.45, tip, base - h);
        g.quadraticCurveTo(x + w * 0.4, base - h * 0.4, x + w, base + 6);
        g.closePath();
        g.fill();
      }
    } else {
      // low rolling hills with tree clumps
      g.fillStyle = `rgba(${L.tone},${L.a})`;
      g.beginPath();
      g.moveTo(0, H);
      const s = r() * 10;
      for (let x = 0; x <= W; x += 8) {
        const k = (x / W) * Math.PI * 2;
        const y = base - H * L.hMax * (0.5 + 0.3 * Math.sin(k * 3 + s) + 0.2 * Math.sin(k * 7 - s));
        g.lineTo(x, y);
      }
      g.lineTo(W, H);
      g.closePath();
      g.fill();
      for (let i = 0; i < 40; i++) {
        const x = r() * W;
        const k = (x / W) * Math.PI * 2;
        const y = base - H * L.hMax * (0.5 + 0.3 * Math.sin(k * 3 + s) + 0.2 * Math.sin(k * 7 - s));
        for (let j = 0; j < 5; j++) {
          g.beginPath();
          g.ellipse(x + (r() - 0.5) * 30, y - r() * 26, 10 + r() * 16, 10 + r() * 18, 0, 0, Math.PI * 2);
          g.fill();
        }
      }
    }
    // the layer's foot dissolves into mist
    const mist = g.createLinearGradient(0, base - 40, 0, base + 60);
    const mc = kind === 'press' ? '226,224,220' : '150,158,156';
    mist.addColorStop(0, `rgba(${mc},0)`);
    mist.addColorStop(1, `rgba(${mc},0.85)`);
    g.fillStyle = mist;
    g.fillRect(0, base - 40, W, 100);
  }
  g.filter = 'none';
  // below the last layer: the mist the world's fog matches
  g.fillStyle = kind === 'press' ? 'rgba(226,224,220,1)' : 'rgba(150,158,156,1)';
  g.fillRect(0, H * 0.84, W, H * 0.16);
  // paper tooth and flecks over the whole wash
  const img = g.getImageData(0, 0, W, H);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * 18;
    d[i] = Math.max(0, Math.min(255, d[i]! + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1]! + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2]! + n));
  }
  g.putImageData(img, 0, 0);
  if (kind === 'press') {
    // flung ink specks in the sky, as in the bible
    for (let i = 0; i < 160; i++) {
      g.fillStyle = `rgba(22,21,30,${0.35 + r() * 0.5})`;
      g.beginPath();
      g.arc(r() * W, H * (0.1 + r() * 0.6), 0.8 + r() * 2.6, 0, Math.PI * 2);
      g.fill();
    }
  }
  return cv;
}

/** the ring: open cylinder round the camera, painted inside; `follow` keeps it centred, `show` per world */
export function paintedBackdrop(scene: THREE.Scene, kind: BackdropKind) {
  const tex = new THREE.CanvasTexture(paint(kind));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.repeat.set(2, 1);
  const R = 220;
  const Hh = 190;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, side: THREE.BackSide, toneMapped: false });
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(R, R, Hh, 72, 1, true), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  mesh.visible = false;
  scene.add(mesh);
  return {
    mesh,
    /** centre on the camera; the ring's painted horizon (84% down) sits just above the snow bank's crest */
    follow(cam: THREE.Vector3, on: boolean): void {
      mesh.visible = on;
      if (!on) return;
      mesh.position.set(cam.x, cam.y + Hh * 0.34 + 12, cam.z);
    },
  };
}
