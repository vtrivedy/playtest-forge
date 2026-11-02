/**
 * Homecoming at the well (DESIGN-homecoming.md): once the Runaway Page is kept, the slice comes together at the
 * Great Well. The page is pinned to the west post in colour; the freed creatures come home (the hare walks back
 * from the ruin, the heron wheels over once); each homecoming kindles a paper lantern under the hood. Five lit:
 * the well fills with warm light and motes rise out of it.
 */
import * as THREE from 'three';
import { inked, toon } from '../lookdevKit';
import type { OpeningCtx } from './scene';
import { HOMECOMING, POP_UP_RUIN } from './layout';

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
    // the glow: a warm shell clear of the paper (no coplanar flicker) that blooms when lit
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.175, 12, 8).scale(1, 1.2, 1), new THREE.MeshBasicMaterial({ color: 0xff7a1e, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
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
  // the beacon: when the page is pinned, a warm shaft and sparks rise out of the well for a while, tall enough
  // to be seen from the ruin's overlook where the page is kept, so the slice's end points back home
  const BEACON = { secs: 14, height: 16, sparks: 48 };
  // a soft camera-facing light shaft: bright warm core, transparent edges, fading out toward its top
  const shaftTex = (() => {
    const cv = document.createElement('canvas');
    cv.width = 64;
    cv.height = 256;
    const g = cv.getContext('2d')!;
    const img = g.createImageData(64, 256);
    for (let y = 0; y < 256; y++)
      for (let x = 0; x < 64; x++) {
        const u = (x - 31.5) / 32;
        const v = y / 255;
        const a = Math.exp(-u * u * 6) * Math.pow(v, 0.7) * Math.min(1, (1 - v) * 12);
        img.data.set([255, 255, 255, Math.round(255 * a)], (y * 64 + x) * 4);
      }
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const shaft = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, BEACON.height).translate(0, BEACON.height / 2 + 0.6, 0),
    new THREE.MeshBasicMaterial({ color: 0xff8424, map: shaftTex, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, fog: false }),
  );
  shaft.visible = false;
  frame.add(shaft);
  const sparks = new THREE.InstancedMesh(new THREE.SphereGeometry(0.12, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffc070, transparent: true, toneMapped: false, fog: false }), BEACON.sparks);
  sparks.visible = false;
  frame.add(sparks);
  // the ember trail: a low stream of warm motes drifting from the ruin's overlook, down past its entry and across
  // the meadow to the well while the beacon burns: a lower anchor in the chase frame that shows the way home
  const TRAIL = { motes: 42, speed: 2.6, y: 1.1 };
  const trailPath = new THREE.CatmullRomCurve3(
    [[POP_UP_RUIN.overlook.x, POP_UP_RUIN.overlook.z], [-23.0, 75.6], ...H.harePath.map((p) => [p.x, p.z]), [H.well.x - 1.2, H.well.z + 0.6]].map(
      ([x, z]) => new THREE.Vector3(x!, ctx.groundH(x!, z!) + TRAIL.y, z!),
    ),
  );
  trailPath.points[0]!.y = POP_UP_RUIN.overlook.top + 1.4;
  const trailLen = trailPath.getLength();
  const trail = new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffa040, toneMapped: false }), TRAIL.motes);
  trail.frustumCulled = false;
  trail.visible = false;
  scene.add(trail);
  const trailSeed = Array.from({ length: TRAIL.motes }, () => [ctx.rand(), ctx.rand() * 6.28, 0.6 + ctx.rand() * 0.6] as const);
  const tp = new THREE.Vector3();
  const sparkSeed = Array.from({ length: BEACON.sparks }, () => [ctx.rand() * 6.28, ctx.rand() * 0.5, ctx.rand()] as const);
  const MOTES = 28;
  const motes = new THREE.InstancedMesh(new THREE.SphereGeometry(0.03, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffd28a, transparent: true, opacity: 0.9, toneMapped: false }), MOTES);
  motes.visible = false;
  frame.add(motes);
  const moteSeed = Array.from({ length: MOTES }, () => [ctx.rand() * 6.28, ctx.rand() * 0.8, ctx.rand() * 4] as const);
  const m4 = new THREE.Matrix4();

  // sound (DESIGN-audio-moss.md): each kindling is one quiet sine bell a pentatonic step higher;
  // the well filling swells a warm open chord and dips the music under it
  const ac = ctx.audio.ac;
  const world = new THREE.Vector3();
  const at = (o: THREE.Object3D) => o.getWorldPosition(world).clone();
  const STEPS = [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3];
  const kindleSound = (i: number) => {
    if (ac.state !== 'running') return;
    // a soft sine bell: slow-ish attack, long gentle tail, low-passed, one pentatonic step higher per lantern
    const t = ac.currentTime;
    const out = ctx.audio.at(at(lanterns[i]!.body));
    for (const [mul, amp] of [[1, 0.028], [2, 0.006]] as const) {
      const o = ac.createOscillator();
      o.type = 'sine';
      o.frequency.value = 392 * STEPS[i]! * mul;
      const f = ac.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 1600;
      const g = ac.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(amp, t + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
      o.connect(f).connect(g).connect(out);
      o.start(t);
      o.stop(t + 2.7);
    }
  };
  const swell = () => {
    if (ac.state !== 'running') return;
    ctx.audio.duck(0.4, 4.5);
    const t = ac.currentTime;
    const out = ctx.audio.at(at(fill), 6);
    [130.8, 196, 261.6, 329.6, 392].forEach((hz, i) => {
      const o = ac.createOscillator();
      o.type = i % 2 ? 'triangle' : 'sine';
      o.frequency.value = hz;
      const g = ac.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.018, t + 0.8 + i * 0.4 + 1.6);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 6.5);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + 6.6);
    });
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
      ctx.audio.play('soft-pin', { at: at(pin), gain: 0.08, rate: 0.85 });
      queue.push('page');
    }
    if (pinned >= 0) {
      pinned += dt;
      const b = THREE.MathUtils.smoothstep(pinned, 0, 1.5) * (1 - THREE.MathUtils.smoothstep(pinned, BEACON.secs - 4, BEACON.secs));
      shaft.visible = sparks.visible = b > 0.001;
      if (shaft.visible) {
        (shaft.material as THREE.MeshBasicMaterial).opacity = 0.85 * b * (0.9 + 0.1 * Math.sin(clock * 1.7));
        // turn the shaft to the camera (about its own vertical axis)
        const cam = ctx.player?.cam.camera;
        if (cam) shaft.rotation.y = Math.atan2(cam.position.x - H.well.x, cam.position.z - H.well.z) - H.well.yaw;
        for (let i = 0; i < BEACON.sparks; i++) {
          const [a, r, ph] = sparkSeed[i]!;
          const u = (pinned * 0.16 + ph) % 1;
          const k = b * Math.sin(u * Math.PI);
          m4.makeScale(k, k, k).setPosition(Math.cos(a + u * 4) * r, 0.7 + u * BEACON.height, Math.sin(a + u * 4) * r);
          sparks.setMatrixAt(i, m4);
        }
        sparks.instanceMatrix.needsUpdate = true;
      }
      // the trail runs a little longer than the shaft so its last motes arrive home
      const tb = THREE.MathUtils.smoothstep(pinned, 0, 1) * (1 - THREE.MathUtils.smoothstep(pinned, BEACON.secs, BEACON.secs + 5));
      trail.visible = tb > 0.001;
      if (trail.visible) {
        for (let i = 0; i < TRAIL.motes; i++) {
          const [ph, wob, size] = trailSeed[i]!;
          const u = (ph + (pinned * TRAIL.speed) / trailLen) % 1;
          trailPath.getPointAt(u, tp);
          tp.y += Math.sin(clock * 1.3 + wob) * 0.25;
          tp.x += Math.sin(clock * 0.9 + wob * 2) * 0.3;
          const k = tb * size * Math.min(1, u * 12, (1 - u) * 6);
          m4.makeScale(k, k, k).setPosition(tp.x, tp.y, tp.z);
          trail.setMatrixAt(i, m4);
        }
        trail.instanceMatrix.needsUpdate = true;
      }
      // pinned with a little bounce, then it stirs in the wind about its tack
      const pop = Math.min(1, pinned / 0.5);
      pin.scale.setScalar(pop < 1 ? 0.2 + 0.8 * (1 - Math.pow(1 - pop, 3)) * (1 + 0.12 * Math.sin(pop * Math.PI)) : 1);
      // one slow, shallow sway (no fast component: a pinned page at rest must read still, not jittery)
      pin.rotation.z = Math.sin(clock * 0.8) * 0.035;
      pin.rotation.x = -0.08 - (0.5 + 0.5 * Math.sin(clock * 0.6)) * 0.06;
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
      kindleSound(kindled.length);
      kindled.push(next);
      since = 0;
    }
    let glow = 0;
    for (const l of lanterns) {
      if (l.lit < 0) continue;
      l.lit += dt;
      const k = THREE.MathUtils.smoothstep(l.lit, 0, 0.6);
      // a slow candle breath, not a flicker
      const flick = 0.96 + 0.04 * Math.sin(clock * 2.2 + l.seed) * Math.sin(clock * 1.3 + l.seed * 2);
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
    if (full < 0 && kindled.length === lanterns.length && lanterns.every((l) => l.lit > 0.6)) {
      full = 0;
      swell();
    }
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
