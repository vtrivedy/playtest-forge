/**
 * Ink glyph stones (DESIGN-glyphs.md): a reading puzzle on the verbs the fox already has. Three standing
 * stones in the east meadow carry glyphs that only show while freshly painted by the aura; the paper-door
 * shrine's lintel, read the same way, gives the order. Paint the stones in that order before the lit ones
 * gutter (a soft window, no fail) and the door unfolds onto what was sealed inside.
 */
import * as THREE from 'three';
import { hewn, inked, toon } from '../lookdevKit';
import type { OpeningCtx } from './scene';
import { GLYPHS } from './layout';

type GlyphId = (typeof GLYPHS.stones)[number]['id'];

/** paint (0..1 aura/trail supply at the stone) that reveals a glyph and counts as touching it */
export const GLYPH_FEEL = { reveal: 0.16, touch: 0.22, open: 1.8 };

const INK = '#2a1a10';

/** a glyph drawn in brush ink on transparent paper, 256² */
function glyphTexture(id: GlyphId | 'seal', fill = false): THREE.CanvasTexture {
  const S = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d')!;
  // the outline is ink; the filled version is white so its material colour tints it (the lit ember)
  g.strokeStyle = fill ? '#ffffff' : INK;
  g.fillStyle = fill ? '#ffffff' : INK;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.lineWidth = 14;
  g.beginPath();
  if (id === 'leaf') {
    // a maple: five pointed lobes with deep sinuses (the two by the stem smaller), stem and midrib
    for (let i = 0; i <= 120; i++) {
      const a = (i / 120) * Math.PI * 2;
      const u = (((a * 5) / (Math.PI * 2) + 0.5) % 1 + 1) % 1;
      const tri = 1 - Math.abs(u - 0.5) * 2;
      const down = Math.abs(Math.atan2(Math.sin(a), -Math.cos(a)));
      const lower = 1 - 0.45 * THREE.MathUtils.smoothstep(down, 1.9, 2.8);
      const r = (52 + 54 * Math.pow(tri, 0.85) * lower) * (1 + 0.07 * Math.abs(Math.sin(a * 30)));
      const x = 128 + Math.sin(a) * r;
      const y = 124 - Math.cos(a) * r;
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.closePath();
    if (fill) g.fill();
    g.moveTo(128, 124);
    g.lineTo(128, 240);
    g.moveTo(128, 124);
    g.lineTo(128, 40);
  } else if (id === 'flame') {
    g.moveTo(128, 22);
    g.bezierCurveTo(196, 96, 214, 150, 186, 196);
    g.bezierCurveTo(160, 236, 96, 236, 70, 196);
    g.bezierCurveTo(44, 150, 70, 110, 104, 84);
    g.bezierCurveTo(100, 118, 116, 140, 132, 146);
    g.bezierCurveTo(118, 104, 126, 60, 128, 22);
    if (fill) g.fill();
  } else if (id === 'moon') {
    g.arc(128, 128, 96, Math.PI * 0.35, Math.PI * 1.65, false);
    g.arc(160, 128, 74, Math.PI * 1.55, Math.PI * 0.45, true);
    g.closePath();
    if (fill) g.fill();
  } else {
    // the shrine's seal: a fox-eared ring with a knot
    g.arc(128, 136, 80, 0, Math.PI * 2);
    g.moveTo(70, 84);
    g.lineTo(92, 26);
    g.lineTo(118, 64);
    g.moveTo(186, 84);
    g.lineTo(164, 26);
    g.lineTo(138, 64);
  }
  g.stroke();
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** a torn parchment door leaf with an ink border */
function doorTexture(): THREE.CanvasTexture {
  const W = 128;
  const H = 320;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const g = cv.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, '#efe0c2');
  grad.addColorStop(1, '#cdb08a');
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(42,26,16,0.85)';
  g.lineWidth = 5;
  g.strokeRect(10, 10, W - 20, H - 20);
  g.lineWidth = 2;
  for (let y = 40; y < H - 30; y += 34) {
    g.beginPath();
    g.moveTo(22, y);
    g.lineTo(W - 22, y + 6);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function decal(tex: THREE.Texture, size: number, color: number, additive = false): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshBasicMaterial({
      map: tex, color, transparent: true, opacity: 0, depthWrite: false, fog: true,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, polygonOffset: true, polygonOffsetFactor: -2,
    }),
  );
  return m;
}

/** WebAudio on first input (as the hearth hum): rising chime per lit stone, a soft fall on gutter, a chord on open */
function createGlyphAudio() {
  let ac: AudioContext | null = null;
  let out: GainNode;
  const start = () => {
    if (ac) return;
    ac = new AudioContext();
    out = ac.createGain();
    out.gain.value = 0.5;
    out.connect(ac.destination);
  };
  addEventListener('keydown', start, { once: true });
  addEventListener('pointerdown', start, { once: true });
  const note = (hz: number, at: number, peak: number, len: number, type: OscillatorType = 'sine') => {
    if (!ac) return;
    const t = ac.currentTime + at;
    const o = ac.createOscillator();
    o.type = type;
    o.frequency.value = hz;
    const g = ac.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + len + 0.05);
  };
  const SCALE = [523, 587, 659, 784, 880];
  return {
    lit(step: number) {
      note(SCALE[step + 1]!, 0, 0.08, 1.4);
      note(SCALE[step + 1]! * 2, 0.04, 0.025, 0.9);
    },
    gutter() {
      for (const [i, hz] of [392, 330, 262].entries()) note(hz, i * 0.12, 0.04, 0.6, 'triangle');
    },
    open() {
      for (const [i, hz] of [523, 659, 784, 1047].entries()) note(hz, i * 0.09, 0.06, 2.4);
    },
  };
}

export function buildGlyphs(ctx: OpeningCtx, opts: { onSolved?: () => void } = {}) {
  const { scene, rand, groundH, colliders, field } = ctx;
  const stoneMat = toon(0x8a7c6a, { contour: 0.5 });
  const audio = createGlyphAudio();

  const stones = GLYPHS.stones.map((s) => {
    const y = groundH(s.x, s.z);
    const g = new THREE.Group();
    g.position.set(s.x, y, s.z);
    g.rotation.y = s.yaw;
    scene.add(g);
    const mat = stoneMat.clone();
    mat.onBeforeCompile = stoneMat.onBeforeCompile;
    mat.customProgramCacheKey = stoneMat.customProgramCacheKey;
    // a standing stone: a four-sided taper (flat faces for the glyph), rough-hewn, leaning a little,
    // its top knocked off at a slant and its foot sunk in moss
    const geo = new THREE.CylinderGeometry(0.5, 0.75, 2.0, 4, 3, false, Math.PI / 4);
    geo.scale(1, 1, 0.4);
    const pos = geo.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) if (pos.getY(i) > 0.9) pos.setY(i, pos.getY(i) - 0.22 * (pos.getX(i) + 0.5));
    const slab = inked(hewn(geo, rand, 0.05), mat, 0.022, true);
    // the lean is on a body group so the glyph decals lean with the stone (they are not under the slab:
    // the chase-cam fade clones whatever is under an occluder)
    const body = new THREE.Group();
    body.position.y = 0.9;
    body.rotation.z = (rand() - 0.5) * 0.1;
    body.rotation.x = (rand() - 0.5) * 0.06;
    body.add(slab);
    g.add(body);
    const moss = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), toon(0x5e5c3a, { contour: 0.4 }));
    moss.scale.set(0.85, 0.16, 0.5);
    moss.receiveShadow = true;
    g.add(moss);
    // only the slab fades for the chase cam: the fade clones materials, and the decals' must stay ours
    ctx.occluders.push(slab);
    colliders.push({ kind: 'post', x: s.x, z: s.z, r: 0.55 });
    const tex = glyphTexture(s.id);
    // the glyph on both faces: ink when painted, an ember fill + glow once lit in turn
    const faces = [1, -1].map((side) => {
      const ink = decal(tex, 0.62, 0xffffff);
      ink.position.set(0, 0.15, side * 0.182);
      if (side < 0) ink.rotation.y = Math.PI;
      const glow = decal(glyphTexture(s.id, true), 0.64, 0xffa040);
      glow.position.set(0, 0.15, side * 0.178);
      if (side < 0) glow.rotation.y = Math.PI;
      body.add(ink, glow);
      return { ink, glow };
    });
    return { ...s, y, faces, mat, slab, reveal: 0, painted: false, lit: false, litPulse: 0, warm: 0 };
  });

  // ---- the shrine: two posts, a lintel with the order, a back slab, a two-leaf paper door
  const sh = GLYPHS.shrine;
  const shY = groundH(sh.x, sh.z);
  const shrine = new THREE.Group();
  shrine.position.set(sh.x, shY, sh.z);
  shrine.rotation.y = sh.yaw;
  scene.add(shrine);
  for (const s of [-1, 1]) {
    const post = inked(hewn(new THREE.BoxGeometry(0.42, 2.5, 0.42, 1, 3, 1), rand, 0.06), stoneMat, 0.022, true);
    post.position.set(s * 0.95, 1.2, 0);
    shrine.add(post);
    ctx.occluders.push(post);
  }
  const lintel = inked(hewn(new THREE.BoxGeometry(2.6, 0.5, 0.5, 3, 1, 1), rand, 0.05), stoneMat, 0.022, true);
  lintel.position.set(0, 2.62, 0);
  shrine.add(lintel);
  ctx.occluders.push(lintel);
  const back = inked(hewn(new THREE.BoxGeometry(1.6, 2.4, 0.3, 2, 2, 1), rand, 0.05), toon(0x6e6254, { contour: 0.5 }), 0.022, true);
  back.position.set(0, 1.2, -0.75);
  shrine.add(back);
  ctx.occluders.push(back);
  {
    const cs = Math.cos(sh.yaw);
    const sn = Math.sin(sh.yaw);
    const at = (lx: number, lz: number) => ({ x: sh.x + lx * cs + lz * sn, z: sh.z - lx * sn + lz * cs });
    for (const s of [-1, 1]) colliders.push({ kind: 'post', ...at(s * 0.95, 0), r: 0.3 });
    colliders.push({ kind: 'box', ...at(0, -0.75), yaw: sh.yaw, hx: 0.8, hz: 0.2, top: shY + 2.4 });
  }
  // the order: three small glyphs on the lintel's face, read by painting the shrine
  // the order is inked twice: small on the lintel, and at the fox's eye-line across the closed door
  const lintelGlyphs = GLYPHS.order.flatMap((id, i) => {
    const d = decal(glyphTexture(id), 0.42, 0xffffff);
    d.position.set((i - 1) * 0.72, 2.62, 0.27);
    const e = decal(glyphTexture(id), 0.44, 0xffffff);
    e.position.set((i - 1) * 0.48, 0.95, 0.09);
    e.userData.door = true;
    shrine.add(d, e);
    return [d, e];
  });
  // the door: two parchment leaves hinged on the posts, sealed with the fox mark
  const doorMat = new THREE.MeshToonMaterial({ map: doorTexture(), side: THREE.DoubleSide });
  const leaves = [-1, 1].map((s) => {
    const hinge = new THREE.Group();
    hinge.position.set(s * 0.74, 0, 0.05);
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.74, 2.3, 0.03), doorMat);
    leaf.position.set(-s * 0.37, 1.15, 0);
    leaf.castShadow = true;
    hinge.add(leaf);
    shrine.add(hinge);
    return hinge;
  });
  const seal = decal(glyphTexture('seal'), 0.5, 0x8a2a14);
  seal.position.set(0, 1.85, 0.08);
  (seal.material as THREE.MeshBasicMaterial).opacity = 0.9;
  shrine.add(seal);
  const doorBlock = { kind: 'box' as const, x: sh.x, z: sh.z, yaw: sh.yaw, hx: 0.8, hz: 0.06, top: shY + 2.3 };
  colliders.push(doorBlock);

  let progress = 0;
  let litAt = 0;
  let solved = false;
  let openT = -1;
  let gutters = 0;
  let clock = 0;
  const probe = new THREE.Vector3();

  let lastGutter = '';
  function gutter(why: string): void {
    if (progress === 0) return;
    lastGutter = why;
    for (const s of stones) s.lit = false;
    progress = 0;
    gutters++;
    audio.gutter();
  }
  function solve(): void {
    if (solved) return;
    solved = true;
    openT = 0;
    audio.open();
    colliders.splice(colliders.indexOf(doorBlock), 1);
    opts.onSolved?.();
  }

  ctx.onUpdate((dt) => {
    clock += dt;
    // read the paint at each stone (aura / trail supply at its foot)
    for (const s of stones) {
      probe.set(s.x, s.y, s.z);
      const p = field.sample(probe);
      const was = s.painted;
      s.painted = p >= GLYPH_FEEL.touch;
      s.reveal = THREE.MathUtils.damp(s.reveal, s.lit ? 1 : THREE.MathUtils.smoothstep(p, GLYPH_FEEL.reveal * 0.5, GLYPH_FEEL.touch), 6, dt);
      if (solved) continue;
      const next = GLYPHS.order[progress];
      if (s.id === next && s.painted && !s.lit) {
        s.lit = true;
        s.litPulse = 1;
        litAt = clock;
        audio.lit(progress);
        progress++;
        if (progress === GLYPHS.order.length) solve();
      } else if (!was && s.painted && !s.lit && s.id !== next) gutter(s.id);
    }
    if (!solved && progress > 0 && clock - litAt > GLYPHS.window) gutter('time');
    for (const s of stones) {
      s.litPulse = Math.max(0, s.litPulse - dt * 1.5);
      const breath = 0.75 + 0.25 * Math.sin(clock * 2.4 + s.x);
      // a lit stone warms from inside: its whole face glows ember, readable from across the meadow
      s.warm = THREE.MathUtils.damp(s.warm, s.lit ? 1 : 0, 4, dt);
      s.mat.emissive.setRGB(0.55 * s.warm * breath, 0.2 * s.warm * breath, 0.04 * s.warm);
      for (const f of s.faces) {
        // when the chase cam fades the stone, its glyph fades with it (never a glyph floating in air)
        const fade = (s.slab.material as THREE.Material).opacity;
        (f.ink.material as THREE.MeshBasicMaterial).opacity = s.reveal * fade;
        
        (f.glow.material as THREE.MeshBasicMaterial).opacity = s.warm * fade;
        f.glow.scale.setScalar(1 + s.litPulse * 0.25);
      }
    }
    // the lintel reads by the shrine's own paint
    probe.set(sh.x + 1.2 * Math.sin(sh.yaw), shY, sh.z + 1.2 * Math.cos(sh.yaw));
    const lp = solved ? 1 : THREE.MathUtils.smoothstep(field.sample(probe), GLYPH_FEEL.reveal * 0.5, GLYPH_FEEL.touch);
    lintelGlyphs.forEach((d, j) => {
      const i = j >> 1;
      const m = d.material as THREE.MeshBasicMaterial;
      // the door copy leaves with the door
      const gone = d.userData.door && openT >= 0 ? 0 : 1;
      m.opacity = THREE.MathUtils.damp(m.opacity, Math.max(lp, progress > i ? 1 : 0) * gone, 6, dt);
      m.color.set(progress > i || solved ? 0xd8601c : 0xffffff);
    });
    // the door unfolds: a pop-up flap swing with one overshoot, the seal fading
    if (openT >= 0) {
      openT += dt;
      const u = Math.min(1, openT / GLYPH_FEEL.open);
      const k = u < 1 ? 1 - Math.exp(-5 * u) * Math.cos(u * 7) : 1;
      leaves.forEach((h, i) => (h.rotation.y = (i === 0 ? 1 : -1) * -1.75 * k));
      (seal.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - Math.min(1, openT * 2));
    }
  });

  return {
    /** dev: open the shrine without solving */
    solve,
    state() {
      return {
        progress,
        solved,
        gutters,
        lastGutter,
        order: [...GLYPHS.order],
        stones: stones.map((s) => ({ id: s.id, painted: s.painted, lit: s.lit, reveal: +s.reveal.toFixed(2) })),
      };
    },
  };
}
