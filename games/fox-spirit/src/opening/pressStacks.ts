/**
 * The Scribe's Stacks — a side climb in the Press (DESIGN-worlds.md: side paths and secrets). East of the arrival, a
 * spiral of frozen page-stacks rises to a high reading stand above the ink ridge; on it lies a page the Scribe never
 * pressed. Pure platforming with the two actions (jump + glide across the gaps); the reward is the view over the ridge
 * to the Press and a story line. Own fixed layout, no build rand; per-tick check is scalar.
 */
import * as THREE from 'three';
import type { OpeningCtx } from './scene';
import { toon } from '../lookdevKit';

const O = { x: -700, z: 85 } as const;
/** a spiral of stacks round (22, 24): each 0.55 m higher (jump apex 0.83 m), 2.3 m apart centre to centre */
const C = { lx: 22, lz: 24.5, r: 6.2, a0: 3.4, step: 2.3 / 6.2 } as const;
const STEPS: ReadonlyArray<readonly [number, number, number, number]> = Array.from({ length: 8 }, (_, i) => {
  const a = C.a0 - i * C.step;
  return [C.lx + Math.cos(a) * C.r, C.lz + Math.sin(a) * C.r, 0.55 * (i + 1), 1.05] as const;
});
/** the reading stand at the spiral's heart, one more hop up from the last stack */
const STAND = (() => {
  const a = C.a0 - 8 * C.step;
  return { lx: C.lx + Math.cos(a) * (C.r - 2.4), lz: C.lz + Math.sin(a) * (C.r - 2.4), rise: 0.55 * 8 + 0.5, half: 1.4 };
})();

export function buildPressStacks(ctx: OpeningCtx) {
  const { scene, groundH, colliders } = ctx;
  const g = new THREE.Group();
  g.name = 'press-stacks';
  const paper = toon(0xddd5c2, { contour: 0.7 });
  const ink = toon(0x25272e);
  const ice = new THREE.MeshToonMaterial({ color: 0xa8c8dc, transparent: true, opacity: 0.8 });
  // tops are absolute (from the first stack's footing) so the snow drift under each stack can't make a step too tall
  const base = groundH(O.x + STEPS[0]![0], O.z + STEPS[0]![1]);
  const add = (lx: number, lz: number, riseAbs: number, half: number, i: number) => {
    const x = O.x + lx;
    const z = O.z + lz;
    const y0 = groundH(x, z);
    const rise = Math.max(0.3, base + riseAbs - y0);
    const yaw = (i * 0.37) % 0.6 - 0.3;
    const stack = new THREE.Group();
    stack.position.set(x, y0, z);
    stack.rotation.y = yaw;
    // a stack of pressed pages, slightly fanned, with an ink-bound cover on top and ice in the seams
    const layers = Math.max(2, Math.round(rise / 0.35));
    for (let k = 0; k < layers; k++) {
      const h = (rise + 0.4) / layers;
      const m = new THREE.Mesh(new THREE.BoxGeometry(half * 2 * (0.96 + 0.04 * Math.sin(k * 1.7 + i)), h * 0.92, half * 2), k === layers - 1 ? ink : paper);
      m.position.set(Math.sin(k * 2.1 + i) * 0.05, -0.4 + h * (k + 0.5), Math.cos(k * 1.3 + i) * 0.05);
      m.rotation.y = Math.sin(k * 0.9 + i) * 0.06;
      m.castShadow = true;
      m.receiveShadow = true;
      stack.add(m);
    }
    const frost = new THREE.Mesh(new THREE.BoxGeometry(half * 2.02, 0.05, half * 2.02), ice);
    frost.position.y = rise + 0.02;
    stack.add(frost);
    g.add(stack);
    colliders.push({ kind: 'box', x, z, yaw, hx: half, hz: half, top: y0 + rise });
    return { x, z, top: y0 + rise };
  };
  STEPS.forEach(([lx, lz, rise, half], i) => add(lx, lz, rise, half, i));
  const stand = add(STAND.lx, STAND.lz, STAND.rise, STAND.half, 9);
  // the unpressed page on the stand: warm, curling, lit from within
  const pageMat = new THREE.MeshBasicMaterial({ color: 0xffe2b0, side: THREE.DoubleSide, toneMapped: false });
  const page = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.68, 4, 4), pageMat);
  page.rotation.set(-Math.PI / 2 + 0.25, 0, 0.3);
  page.position.set(stand.x, stand.top + 0.08, stand.z);
  scene.add(page);
  const light = new THREE.PointLight(0xffc27a, 1.2, 6, 1.6);
  light.position.set(stand.x, stand.top + 0.8, stand.z);
  scene.add(light);
  scene.add(g);
  ctx.occluders.push(g);

  let found = false;
  let t = 0;
  return {
    state: () => ({ found }),
    update(dt: number, fox: THREE.Vector3): void {
      if (fox.x > -350) return;
      t += dt;
      page.position.y = stand.top + 0.1 + Math.sin(t * 1.6) * 0.03;
      if (!found && Math.hypot(fox.x - stand.x, fox.z - stand.z) < STAND.half + 0.3 && fox.y > stand.top - 0.3) {
        found = true;
        ctx.captions.say('A page never pressed: all of them, laughing.');
        light.intensity = 3;
      }
    },
  };
}
