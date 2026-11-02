/**
 * The other worlds in the one scene (DESIGN-worlds.md): Ashwater Reach and the Scribe's Press islands, the hub arches
 * north of the Great Well that take the fox there, the return arches, and each world's sky / fog / light / weather.
 * Build-time code here; the per-frame part is `update` (no allocation: preallocated colours, scalar state).
 */
import * as THREE from 'three';
import type { OpeningCtx } from './scene';
import { WELL } from './layout';
import { ashwaterE, HUB_ARCHES, hubArrival, outward, pressE, RETURN_ARCH_BACK, WORLDS, worldAt, type WorldId } from './worlds';
import { RAMP_WORLD, rng, toon } from '../lookdevKit';
import { bakeCells } from './bake';
import { box, C, cyl, Kit } from './village';

type Arch = { x: number; z: number; nx: number; nz: number; to: WorldId; open: () => boolean; glow: THREE.Mesh };


const ARCH_COLOR: Record<WorldId, number> = { russetvale: 0xc8622e, ashwater: 0x3f7f8c, press: 0xe8e6e0 };

function buildArch(k: Kit, x: number, y: number, z: number, yaw: number, banner: number): void {
  k.at(x, y, z, yaw, () => {
    for (const s of [-1, 1]) k.add(cyl(0.16, 0.2, 3.1, 7), C.timberDark, [s * 1.25, 1.55, 0], [0, 0, 0], 0.016);
    k.add(box(3.1, 0.26, 0.34), C.timberDark, [0, 3.1, 0], [0, 0, 0], 0.016);
    k.add(box(2.2, 0.16, 0.24), C.timber, [0, 2.75, 0], [0, 0, 0], 0.012);
    // the destination's colour hangs in the arch: a banner each side
    for (const s of [-1, 1]) k.add(box(0.42, 1.1, 0.04), banner, [s * 0.85, 2.15, 0.13], [0, 0, 0], 0.006);
  });
}

/** a painted name board: the world's name in ink on old paper with its colour as a band */
function plaqueTexture(name: string, band: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 108;
  const g = c.getContext('2d')!;
  g.fillStyle = '#e9dfc8';
  g.fillRect(0, 0, 512, 108);
  g.fillStyle = `#${band.toString(16).padStart(6, '0')}`;
  g.fillRect(0, 92, 512, 16);
  g.strokeStyle = '#2b2018';
  g.lineWidth = 6;
  g.strokeRect(3, 3, 506, 102);
  g.fillStyle = '#2b2018';
  g.font = 'italic 54px Georgia, serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(name, 256, 48, 480);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function islandGround(scene: THREE.Scene, cx: number, cz: number, size: number, colour: (x: number, z: number, h: number, c: THREE.Color) => void, groundH: (x: number, z: number) => number): void {
  const geo = new THREE.PlaneGeometry(size, size, 110, 110);
  geo.rotateX(-Math.PI / 2);
  geo.translate(cx, 0, cz);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const col = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = groundH(x, z);
    pos.setY(i, h);
    colour(x, z, h, c);
    col.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, toon(0xffffff, { vertexColors: true, hatchWeight: 0.2 }));
  m.receiveShadow = true;
  scene.add(m);
}

/** precipitation: one instanced streak/flake field that follows the camera (rain in Ashwater, snow in the Press) */
function buildWeather(scene: THREE.Scene) {
  const N = 900;
  const geo = new THREE.PlaneGeometry(0.02, 0.5);
  const mat = new THREE.MeshBasicMaterial({ color: 0xcfd8e0, transparent: true, opacity: 0, depthWrite: false, fog: true, side: THREE.DoubleSide });
  const mesh = new THREE.InstancedMesh(geo, mat, N);
  mesh.frustumCulled = false;
  mesh.visible = false;
  scene.add(mesh);
  const r = rng(733);
  const seed = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) {
    seed[i * 4] = (r() - 0.5) * 30;
    seed[i * 4 + 1] = r() * 14;
    seed[i * 4 + 2] = (r() - 0.5) * 30;
    seed[i * 4 + 3] = 0.7 + r() * 0.6;
  }
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const sc = new THREE.Vector3();
  return {
    mesh,
    /** kind 1 rain, 2 snow; k fades it in */
    update(t: number, cam: THREE.Vector3, kind: number, k: number): void {
      mesh.visible = k > 0.01;
      if (!mesh.visible) return;
      mat.opacity = (kind === 1 ? 0.35 : 0.85) * k;
      mat.color.set(kind === 1 ? 0xb9c6d2 : 0xffffff);
      const fall = kind === 1 ? 11 : 1.2;
      const sx = kind === 1 ? 1 : 3.5;
      const sy = kind === 1 ? 1 : 0.07;
      for (let i = 0; i < N; i++) {
        const o = i * 4;
        const y = 14 - ((seed[o + 1]! + t * fall * seed[o + 3]!) % 14);
        const sway = kind === 2 ? Math.sin(t * 0.7 + i) * 0.6 : 0;
        p.set(cam.x + seed[o]! + sway, cam.y - 5 + y, cam.z + seed[o + 2]!);
        sc.set(sx, sy, 1);
        m4.compose(p, q, sc);
        mesh.setMatrixAt(i, m4);
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}

export function buildWorlds(ctx: OpeningCtx, opts: { hubOpen: (to: WorldId) => boolean }) {
  const { scene, groundH, colliders } = ctx;
  const k = new Kit();
  const arches: Arch[] = [];
  const glowMat = (c: number) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const addArch = (x: number, z: number, nx: number, nz: number, to: WorldId, open: () => boolean) => {
    const yaw = Math.atan2(nx, nz);
    buildArch(k, x, groundH(x, z), z, yaw, ARCH_COLOR[to]);
    // posts collide; the opening between them stays walkable
    for (const s of [-1, 1]) ctx.colliders.push({ kind: 'post', x: x + Math.cos(yaw) * s * 1.25, z: z - Math.sin(yaw) * s * 1.25, r: 0.22 });
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 2.6), glowMat(ARCH_COLOR[to]));
    glow.position.set(x, groundH(x, z) + 1.35, z);
    glow.rotation.y = yaw;
    scene.add(glow);
    // the destination's name on a board under the lintel, readable from both sides (in the canvas, so clips carry it)
    const plaque = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.5), new THREE.MeshBasicMaterial({ map: plaqueTexture(WORLDS[to].name, ARCH_COLOR[to]), transparent: true, side: THREE.DoubleSide, toneMapped: false }));
    plaque.position.set(x, groundH(x, z) + 3.5, z);
    plaque.rotation.y = yaw + Math.PI;
    scene.add(plaque);
    arches.push({ x, z, nx, nz, to, open, glow });
  };
  // hub: through the arch, away from the well
  for (const a of HUB_ARCHES) {
    const dx = a.x - WELL.x;
    const dz = a.z - WELL.z;
    const l = Math.hypot(dx, dz);
    addArch(a.x, a.z, dx / l, dz / l, a.to, () => opts.hubOpen(a.to));
  }
  // each island: a return arch behind its spawn (walk back out through it, south)
  for (const id of ['ashwater', 'press'] as const) {
    const w = WORLDS[id];
    const o = outward(id === 'ashwater' ? ashwaterE : pressE, w.spawn);
    addArch(w.spawn.x + o.x * RETURN_ARCH_BACK, w.spawn.z + o.z * RETURN_ARCH_BACK, o.x, o.z, 'russetvale', () => true);
  }

  // Ashwater Reach's ground, water and puzzle are Cedar's (ashwater.ts); this module gives it the rain and sky

  // ---- The Scribe's Press: snowfield under ink spires, standing page slabs
  const P = WORLDS.press.origin;
  const snow = new THREE.Color(0xbfc5cf);
  const blue = new THREE.Color(0x9eabbf);
  const ink = new THREE.Color(0x2a2c33);
  islandGround(scene, P.x, P.z, 150, (x, z, _h, c) => {
    const n = Math.sin(x * 0.3 + Math.cos(z * 0.21) * 2) * 0.5 + 0.5;
    c.copy(snow).lerp(blue, n * 0.45);
    c.lerp(ink, THREE.MathUtils.smoothstep(pressE(x, z), 0, 4) * 0.85);
  }, groundH);
  const rp = rng(6203);
  const inkMat = toon(0x24262c, { contour: 0.4 });
  const pageMat = toon(0xd6d0c2, { contour: 0.6 });
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2 + rp() * 0.2;
    const rr = 44 + rp() * 6;
    const x = P.x + Math.cos(a) * rr;
    const z = P.z + Math.sin(a) * rr;
    const h = 8 + rp() * 14;
    const spire = new THREE.Mesh(new THREE.ConeGeometry(1.6 + rp() * 1.5, h, 5), inkMat);
    spire.position.set(x, groundH(x, z) + h / 2 - 1, z);
    spire.rotation.set((rp() - 0.5) * 0.15, rp() * 6, (rp() - 0.5) * 0.15);
    scene.add(spire);
  }
  // the Press's interior (ridge, shelf, ledge, page dressing) is press.ts; only the rim spires stand here
  const built = k.build();
  scene.add(built);
  ctx.occluders.push(built);

  const weather = buildWeather(scene);
  // Ashwater's low mist line (Kit 21:56: "autumn with rain on, not a marsh"): soft sheets lying on the water a hand
  // above the reeds' feet, drifting slowly; painted once into a canvas, never per frame
  const mistTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d')!;
    const r = rng(8812);
    for (let i = 0; i < 70; i++) {
      const x = r() * 256;
      const y = r() * 256;
      const rad = 18 + r() * 60;
      const grd = g.createRadialGradient(x, y, 0, x, y, rad);
      grd.addColorStop(0, 'rgba(255,255,255,0.32)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, 256, 256);
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(3, 3);
    return t;
  })();
  const mistSheets: THREE.Mesh[] = [];
  // kept below the fox's chest (a veil over the hero is a fail): the sheets lie on the water, the fox stands through them
  for (const [h, op, rot] of [[-0.12, 0.38, 0.3], [0.12, 0.2, 1.7]] as const) {
    const m = new THREE.Mesh(
      new THREE.CircleGeometry(70, 40).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: mistTex, color: 0xb9c6c4, transparent: true, opacity: op, depthWrite: false, fog: true }),
    );
    m.position.set(WORLDS.ashwater.origin.x, h, WORLDS.ashwater.origin.z);
    m.rotation.y = rot;
    m.renderOrder = 2;
    scene.add(m);
    mistSheets.push(m);
  }
  // travelling turns a page: a paper wash covers the lens at the jump and clears over ~0.6 s
  const fadeMat = new THREE.MeshBasicMaterial({ color: 0xe9dfc8, transparent: true, opacity: 0, depthTest: false, depthWrite: false, toneMapped: false, fog: false });
  const fade = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), fadeMat);
  fade.position.set(0, 0, -0.3);
  fade.renderOrder = 9999;
  fade.frustumCulled = false;
  let fadeK = 0;

  // ---- per frame (no allocation)
  const top = new THREE.Color();
  const mid = new THREE.Color();
  const hor = new THREE.Color();
  const mist = new THREE.Color();
  let blend = 0;
  let current: WorldId = 'russetvale';
  let lastWorld: WorldId = 'russetvale';
  let px = NaN;
  let pz = NaN;
  let time = 0;
  let travelled = 0;
  return {
    get active(): WorldId {
      return current;
    },
    /**
     * Arch crossings: the fox steps from one side of an open arch to the other between its posts → travel.
     * Returns the destination spawn to teleport to, or null.
     */
    crossing(x: number, z: number): WorldId | null {
      let hit: WorldId | null = null;
      if (Number.isFinite(px)) {
        for (const a of arches) {
          if (!a.open()) continue;
          const s0 = (px - a.x) * a.nx + (pz - a.z) * a.nz;
          const s1 = (x - a.x) * a.nx + (z - a.z) * a.nz;
          const side = Math.abs((x - a.x) * a.nz - (z - a.z) * a.nx);
          if (s0 < 0 && s1 >= 0 && side < 1.05) hit = a.to;
        }
      }
      px = x;
      pz = z;
      return hit;
    },
    /** after a teleport: forget the last position so the landing isn't read as a crossing */
    resetCrossing(): void {
      px = NaN;
      pz = NaN;
      travelled++;
      fadeK = 1;
    },
    /**
     * Coming home from `from`: stand 2.6 m inside that world's hub arch facing the well (the old wake spot sat under
     * the other arch's lintel and the return lens filled with timber — Reed's world-tour stills).
     */
    hubArrival(from: WorldId): { x: number; z: number; yaw: number } {
      return hubArrival(from, WELL);
    },
    /** the paper wash rides on the lens */
    attach(camera: THREE.Camera): void {
      camera.add(fade);
      if (!camera.parent) scene.add(camera);
    },
    get travels(): number {
      return travelled;
    },
    update(dt: number, foxX: number, camPos: THREE.Vector3, sky: { setWorld: (a: THREE.Color, b: THREE.Color, c: THREE.Color, d: THREE.Color, k: number) => void }, fog: THREE.FogExp2 | null, key: THREE.DirectionalLight): void {
      time += dt;
      fadeK = Math.max(0, fadeK - dt * 1.7);
      fadeMat.opacity = fadeK * fadeK * (3 - 2 * fadeK);
      fade.visible = fadeK > 0;
      current = worldAt(foxX);
      if (current !== lastWorld) {
        blend = 0;
        lastWorld = current;
      }
      blend = Math.min(1, blend + dt * 0.8);
      for (let i = 0; i < mistSheets.length; i++) {
        mistSheets[i]!.visible = current === 'ashwater';
        mistSheets[i]!.rotation.y += dt * (0.004 + i * 0.003);
      }
      for (const a of arches) (a.glow.material as THREE.MeshBasicMaterial).opacity = a.open() ? 0.28 + 0.1 * Math.sin(time * 2 + a.x) : 0;
      const look = WORLDS[current].look;
      if (!look) {
        weather.update(time, camPos, 0, 0);
        return;
      }
      top.set(look.sky[0]);
      mid.set(look.sky[1]);
      hor.set(look.sky[2]);
      mist.set(look.mist);
      sky.setWorld(top, mid, hor, mist, blend);
      if (fog) {
        fog.color.copy(mist);
        fog.density = look.fog;
      }
      key.color.set(look.key);
      weather.update(time, camPos, look.precip, blend);
    },
  };
}
export type Worlds = ReturnType<typeof buildWorlds>;
