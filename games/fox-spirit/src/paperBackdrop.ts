/**
 * A painted horizon for a foreign world (DESIGN-sumiro-look.md "paper sky"): one canvas wash wrapped on a sphere
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
  if (kind === 'press') {
    // the paper itself: warm at the zenith, whitening into the snow haze at the horizon
    const sky = g.createLinearGradient(0, 0, 0, H * 0.84);
    sky.addColorStop(0, 'rgb(196,190,178)');
    sky.addColorStop(0.6, 'rgb(220,216,206)');
    sky.addColorStop(1, 'rgb(226,224,220)');
    g.fillStyle = sky;
    g.fillRect(0, 0, W, H);
  }
  if (kind === 'ashwater') {
    // a low ceiling of rain cloud: the whole ring is sky, dark above, paling to the wet light at the horizon
    const sky = g.createLinearGradient(0, 0, 0, H * 0.7);
    sky.addColorStop(0, 'rgb(92,98,102)');
    sky.addColorStop(0.55, 'rgb(150,156,156)');
    sky.addColorStop(1, 'rgb(186,190,186)');
    g.fillStyle = sky;
    g.fillRect(0, 0, W, H);
  }
  // wet-in-wet cloud blooms in the upper sky: soft, granulated, a little warm ochre in the press paper
  const bloomTones = kind === 'press'
    ? ['120,118,140', '150,146,160', '176,160,128', '96,98,118']
    : ['70,78,84', '96,104,108', '140,146,146', '58,64,70'];
  g.filter = kind === 'press' ? 'blur(10px)' : 'blur(22px)';
  for (let i = 0; i < (kind === 'press' ? 170 : 260); i++) {
    const x = r() * W;
    const y = H * (0.02 + r() * (kind === 'press' ? 0.5 : 0.45));
    const rad = 40 + r() * 170;
    const tone = bloomTones[Math.floor(r() * bloomTones.length)]!;
    const a = (kind === 'press' ? 0.12 : 0.06) + r() * (kind === 'press' ? 0.14 : 0.07);
    // rain cloud lies in long low smears; the press paper blooms rounder. The gradient is drawn in the ellipse's own
    // scaled space so it fades to nothing at the rim (a circular gradient clipped by a flat ellipse leaves a hard lid)
    const sx = kind === 'press' ? 1.4 + r() : 2.6 + r() * 2;
    const sy = kind === 'press' ? 0.5 + r() * 0.3 : 0.22 + r() * 0.18;
    for (const wrap of x + rad * sx > W ? [0, -W] : [0]) {
      g.save();
      g.translate(x + wrap, y);
      g.scale(sx, sy);
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, rad);
      gr.addColorStop(0, `rgba(${tone},${a})`);
      gr.addColorStop(0.55, `rgba(${tone},${a * 0.6})`);
      gr.addColorStop(1, `rgba(${tone},0)`);
      g.fillStyle = gr;
      g.beginPath();
      g.arc(0, 0, rad, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
  }
  // silhouettes: three layers, palest and smallest farthest, each a wash with a darker settled foot
  const layers = kind === 'press'
    ? [{ base: 0.66, hMax: 0.3, tone: '150,150,168', a: 0.42 }, { base: 0.72, hMax: 0.36, tone: '104,102,124', a: 0.55 }, { base: 0.8, hMax: 0.42, tone: '52,50,66', a: 0.72 }]
    : [{ base: 0.62, hMax: 0.1, tone: '120,128,128', a: 0.45 }, { base: 0.68, hMax: 0.14, tone: '92,100,100', a: 0.55 }, { base: 0.76, hMax: 0.18, tone: '62,70,70', a: 0.7 }];
  g.filter = kind === 'press' ? 'blur(1.5px)' : 'blur(5px)';
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
      for (let i = 0; i < 24; i++) {
        const x = r() * W;
        const k = (x / W) * Math.PI * 2;
        const y = base - H * L.hMax * (0.5 + 0.3 * Math.sin(k * 3 + s) + 0.2 * Math.sin(k * 7 - s));
        for (let j = 0; j < 5; j++) {
          g.beginPath();
          g.ellipse(x + (r() - 0.5) * 36, y - r() * 18, 14 + r() * 18, 6 + r() * 12, 0, 0, Math.PI * 2);
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
  tex.wrapT = THREE.ClampToEdgeWrapping;
  const R = 220;
  // a closed sphere round the camera, painted by elevation: the canvas spans EL0 → EL1 (horizon at 84% down sits
  // ~3° up, just above the snow bank's crest); below it the mist row, above it the zenith row. Opaque and depth-writing:
  // the islands sit outside the shared sky dome, so nothing behind it may show through
  const EL0 = THREE.MathUtils.degToRad(-4.8);
  const EL1 = THREE.MathUtils.degToRad(38);
  const geo = new THREE.SphereGeometry(R, 72, 36);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const uv = geo.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const el = Math.asin(THREE.MathUtils.clamp(pos.getY(i) / R, -1, 1));
    uv.setY(i, THREE.MathUtils.clamp((el - EL0) / (EL1 - EL0), 0.002, 0.998));
  }
  const mat = new THREE.MeshBasicMaterial({ map: tex, fog: false, side: THREE.BackSide, toneMapped: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.visible = false;
  scene.add(mesh);
  return {
    mesh,
    /** centre on the camera */
    follow(cam: THREE.Vector3, on: boolean): void {
      mesh.visible = on;
      if (!on) return;
      mesh.position.copy(cam);
    },
  };
}
