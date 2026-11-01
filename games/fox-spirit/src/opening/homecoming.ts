/**
 * Homecoming at the well (DESIGN-homecoming.md): once the Runaway Page is kept, the slice comes together at the
 * Great Well. The page is pinned to the west post in colour; the freed creatures come home (the hare walks back
 * from the ruin, the heron wheels over once); each homecoming kindles a paper lantern under the hood. Five lit:
 * the well fills with warm light and motes rise out of it.
 */
import * as THREE from 'three';
import { inked, toon } from '../lookdevKit';
import type { OpeningCtx } from './scene';
import { HOMECOMING } from './layout';

type Page = { art: THREE.Texture; settled: () => boolean };
type Unpressed = { goHome: (id: 'hare' | 'heron') => boolean; home: () => string[]; state: () => { creatures: { id: string; phase: string }[] } };

/** unlit: dull, unoiled paper in the hood's shade, so each kindling reads as a step */
const PAPER = new THREE.Color(0x7a6a58);
const AMBER = new THREE.Color(0xc8601c);

export function buildHomecoming(ctx: OpeningCtx, page: Page, unpressed: Unpressed) {
  const { scene } = ctx;
  const H = HOMECOMING;
  const frame = new THREE.Group();
  frame.position.set(H.well.x, H.well.y, H.well.z);
  frame.rotation.y = H.well.yaw;
  scene.add(frame);

  // the kept page, pinned to the west post's lane face (coloured: plain basic material, lit by nothing)
  const pin = new THREE.Group();
  pin.position.set(H.pin.lx, H.pin.ly, H.pin.lz);
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.48, 1, 4), new THREE.MeshBasicMaterial({ map: page.art, side: THREE.DoubleSide, transparent: true, alphaTest: 0.02 }));
  sheet.position.y = -0.2;
  pin.add(sheet);
  const tack = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), toon(0x3a2516));
  tack.position.set(0, 0, 0.012);
  pin.add(tack);
  pin.visible = false;
  frame.add(pin);

  // five paper lanterns hanging from the hood's eaves, unlit (paper) until a homecoming kindles one
  const lanterns = H.lanterns.map(([lx, lz], i) => {
    const g = new THREE.Group();
    const drop = 0.22 + (i % 2) * 0.08;
    g.position.set(lx, H.eave, lz);
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, drop, 4), toon(0x3a2a1c));
    cord.position.y = -drop / 2;
    g.add(cord);
    const body = new THREE.Group();
    body.position.y = -drop - 0.17;
    g.add(body);
    const paper = new THREE.MeshToonMaterial({ color: PAPER });
    const shade = inked(new THREE.SphereGeometry(0.15, 12, 8).scale(1, 1.2, 1), paper, 0.012, true);
    body.add(shade);
    for (const y of [0.17, -0.17]) {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.04, 8), toon(0x4a3020));
      cap.position.y = y;
      body.add(cap);
    }
    // the flame-glow inside: a warm core that blooms through the paper when lit
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.155, 12, 8).scale(1, 1.2, 1), new THREE.MeshBasicMaterial({ color: 0xff7a1e, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
    body.add(core);
    frame.add(g);
    return { g, body, paper, core, lit: -1, seed: i * 1.7 };
  });
  const light = new THREE.PointLight(0xffb060, 0, 7, 1.6);
  light.position.set(0, 1.8, 0);
  frame.add(light);

  // the well filled with light: a warm disc on the water and motes rising out of the shaft
  const fill = new THREE.Mesh(new THREE.CircleGeometry(1.0, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffc27a, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }));
  fill.position.y = 0.57;
  frame.add(fill);
  const MOTES = 28;
  const motes = new THREE.InstancedMesh(new THREE.SphereGeometry(0.03, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffd28a, transparent: true, opacity: 0.9, toneMapped: false }), MOTES);
  motes.visible = false;
  frame.add(motes);
  const moteSeed = Array.from({ length: MOTES }, () => [ctx.rand() * 6.28, ctx.rand() * 0.8, ctx.rand() * 4] as const);
  const m4 = new THREE.Matrix4();

  // a soft chime per lantern, rising a step each time
  let ac: AudioContext | null = null;
  const chime = (step: number) => {
    try {
      ac ??= new AudioContext();
      const t = ac.currentTime;
      for (const [mul, gain] of [[1, 0.06], [2, 0.02], [3.01, 0.01]] as const) {
        const o = ac.createOscillator();
        const g = ac.createGain();
        o.type = 'sine';
        o.frequency.value = [523, 587, 659, 784, 880][step]! * mul;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(gain, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
        o.connect(g).connect(ac.destination);
        o.start(t);
        o.stop(t + 2.3);
      }
    } catch {
      /* no audio */
    }
  };

  let forced = false;
  let pinned = -1;
  let sent = false;
  const queue: string[] = [];
  const kindled: string[] = [];
  let since = H.gap;
  let full = -1;
  let clock = 0;

  ctx.onUpdate((dt) => {
    clock += dt;
    since += dt;
    if (!(forced || page.settled())) return;
    // the page comes home first
    if (pinned < 0) {
      pinned = 0;
      pin.visible = true;
      queue.push('page');
    }
    if (pinned >= 0) {
      pinned += dt;
      // pinned with a little bounce, then it stirs in the wind about its tack
      const pop = Math.min(1, pinned / 0.5);
      pin.scale.setScalar(pop < 1 ? 0.2 + 0.8 * (1 - Math.pow(1 - pop, 3)) * (1 + 0.12 * Math.sin(pop * Math.PI)) : 1);
      pin.rotation.z = Math.sin(clock * 1.3) * 0.05 + Math.sin(clock * 3.1) * 0.015;
      pin.rotation.x = -0.06 - Math.max(0, Math.sin(clock * 0.9)) * 0.12;
    }
    // the freed come home: the hare walks back, the heron wheels over (each once, whenever it is free)
    for (const c of unpressed.state().creatures) {
      if (c.phase !== 'alive') continue;
      if (c.id === 'hare' || c.id === 'heron') unpressed.goHome(c.id);
    }
    sent = true;
    for (const id of unpressed.home()) if (!queue.includes(id)) queue.push(id);
    // kindle the next waiting homecoming, one at a time
    const next = queue.find((id) => !kindled.includes(id));
    if (next && since >= H.gap && kindled.length < lanterns.length) {
      lanterns[kindled.length]!.lit = 0;
      chime(kindled.length);
      kindled.push(next);
      since = 0;
    }
    let glow = 0;
    for (const l of lanterns) {
      if (l.lit < 0) continue;
      l.lit += dt;
      const k = THREE.MathUtils.smoothstep(l.lit, 0, 0.6);
      const flick = 0.92 + 0.08 * Math.sin(clock * 9 + l.seed) * Math.sin(clock * 5.3 + l.seed * 2);
      (l.core.material as THREE.MeshBasicMaterial).opacity = 0.5 * k * flick;
      // lit paper glows amber, not white: the paper tints warm and the flame shows through as an orange bloom
      l.paper.color.copy(PAPER).lerp(AMBER, k);
      l.paper.emissive.setHex(0x8a3204).multiplyScalar(k * flick);
      // a kindling swell, then a slow sway on its cord
      l.body.scale.setScalar(1 + 0.18 * Math.sin(Math.min(1, l.lit / 0.5) * Math.PI));
      l.g.rotation.z = Math.sin(clock * 1.1 + l.seed) * 0.05;
      glow += k * flick;
    }
    light.intensity = glow * 1.4;
    if (full < 0 && kindled.length === lanterns.length && lanterns.every((l) => l.lit > 0.6)) full = 0;
    if (full >= 0) {
      full += dt;
      const k = THREE.MathUtils.smoothstep(full, 0, 3);
      (fill.material as THREE.MeshBasicMaterial).opacity = 0.55 * k * (0.85 + 0.15 * Math.sin(clock * 2));
      light.intensity += k * 2.5;
      motes.visible = true;
      for (let i = 0; i < MOTES; i++) {
        const [a, r, ph] = moteSeed[i]!;
        const u = ((full * 0.25 + ph / 4) % 1 + 1) % 1;
        const life = Math.min(1, full / (ph + 0.5));
        const rr = r * (1 - u * 0.5);
        m4.makeScale(life * (1 - u), life * (1 - u), life * (1 - u)).setPosition(Math.cos(a + u * 3) * rr, 0.6 + u * 3.6, Math.sin(a + u * 3) * rr);
        motes.setMatrixAt(i, m4);
      }
      motes.instanceMatrix.needsUpdate = true;
    }
  });

  return {
    /** dev: treat the page as kept and settled, with the colour the kept page rolls out (review stills) */
    force(): void {
      if (forced) return;
      forced = true;
      ctx.field.restore(new THREE.Vector3(H.well.x, 0, H.well.z), 30, 0.5, { edgeMax: 2.5 });
    },
    state: () => ({ pinned: pinned >= 0, sent, home: unpressed.home(), lit: kindled, full: full >= 0 }),
  };
}
