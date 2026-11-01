/** One persistent ember. Setting warmth down is care; it never runs out. */
import * as THREE from 'three';
import { RAMP_WORLD } from '../lookdevKit';

export const CARRY = {
  pickupRadius: 1.25,
  pickupHeight: 0.85,
  bowlReach: 1.6,
  emberSize: 0.115,
  glow: 0.7,
  /** Mouth-corner offset keeps the coal visible beside the head from chase view. */
  mouthSide: 0.27,
  mouthForward: 0.18,
  mouthLower: 0.07,
};

type CarryPlayer = { grounded: boolean; dashing?: boolean };
export type CoalHeatSource = { position: THREE.Vector3; carried: boolean; heat: number };

export function createCarry(opts: {
  scene: THREE.Scene;
  fox: THREE.Object3D;
  /** Authored source hearth's reachable coal position, at feet height. */
  source: THREE.Vector3;
  /** Actual walkable floor, including shelf and route; Infinity rejects a blocker. */
  surfaceAt: (x: number, z: number) => number;
  /** Authored bowl beds on the same walkable floor; optional for other scenes. */
  bowls?: THREE.Vector3[];
}) {
  if (new URLSearchParams(location.search).has('gui')) {
    void import('lil-gui').then(({ default: GUI }) => {
      const gui = new GUI({ title: 'Carry feel' });
      gui.add(CARRY, 'pickupRadius', 0.6, 2, 0.05);
      gui.add(CARRY, 'bowlReach', 1.2, 1.8, 0.05);
      gui.add(CARRY, 'emberSize', 0.07, 0.18, 0.005);
      gui.add(CARRY, 'glow', 0.2, 1.5, 0.05);
      gui.add(CARRY, 'mouthSide', 0, 0.3, 0.01);
      gui.add(CARRY, 'mouthForward', 0, 0.35, 0.01);
      gui.add(CARRY, 'mouthLower', 0, 0.2, 0.01);
      gui.close();
    });
  }
  const ember = new THREE.Group();
  ember.name = 'keeping-coal';
  const crust = new THREE.MeshToonMaterial({ color: 0x382b2a, gradientMap: RAMP_WORLD });
  const fire = new THREE.MeshToonMaterial({ color: 0xed9a49, emissive: 0xe65d1e, emissiveIntensity: CARRY.glow, gradientMap: RAMP_WORLD });
  const core = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), fire);
  core.scale.set(1, 0.8, 1.12);
  ember.add(core);
  const crustGeometry = new THREE.DodecahedronGeometry(1, 0);
  for (let i = 0; i < 5; i++) {
    const a = i * Math.PI * 2 / 5;
    const shard = new THREE.Mesh(crustGeometry, crust);
    shard.position.set(Math.cos(a) * 0.54, i % 2 ? 0.22 : -0.2, Math.sin(a) * 0.54);
    shard.rotation.set(i * 0.6, a, i * 0.9);
    shard.scale.set(0.55, 0.6, 0.55);
    shard.castShadow = true;
    ember.add(shard);
  }
  ember.scale.setScalar(CARRY.emberSize);
  opts.scene.add(ember);

  // Quiet painted halo, not an additive pickup beacon. It remains after placement.
  const halo = new THREE.Mesh(
    new THREE.CircleGeometry(0.32, 24),
    new THREE.MeshBasicMaterial({ color: 0xcd8646, transparent: true, opacity: 0.18, depthWrite: false }),
  );
  halo.rotation.x = -Math.PI / 2;
  opts.scene.add(halo);
  const sparkGeometry = new THREE.OctahedronGeometry(0.016, 0);
  const sparks = Array.from({ length: 5 }, () => new THREE.Mesh(sparkGeometry, fire));
  for (const spark of sparks) opts.scene.add(spark);

  const glyph = document.createElement('div');
  glyph.dataset.keepingCarry = 'glyph';
  Object.assign(glyph.style, {
    position: 'fixed', bottom: '15%', left: '50%', transform: 'translateX(-50%)',
    color: '#f4e5cb', background: 'rgba(43,35,30,.78)', padding: '7px 14px',
    border: '1px solid rgba(222,173,105,.28)', borderRadius: '5px',
    font: '15px Georgia,serif', pointerEvents: 'none', opacity: '0',
  });
  document.body.append(glyph);

  let carried = false;
  let grounded = true;
  let dashing = false;
  let pulse = 0;
  let pickups = 0, placements = 0, dashDrops = 0, recoveries = 0;
  let lastAction: 'source' | 'pickup' | 'place' | 'dash-drop' | 'recover' = 'source';
  const position = opts.source.clone();
  const safe = opts.source.clone();
  const rollFrom = opts.source.clone();
  let rollTime = 0;
  const head = opts.fox.getObjectByName('head');
  const held = new THREE.Vector3();
  const forward = new THREE.Vector3();
  const side = new THREE.Vector3();

  function canPickup(): boolean {
    const p = opts.fox.position;
    const inBowl = opts.bowls?.some(b => b.distanceToSquared(position) < 0.01);
    return !carried && Math.hypot(position.x - p.x, position.z - p.z) <= (inBowl ? Math.max(CARRY.pickupRadius, CARRY.bowlReach + 0.15) : CARRY.pickupRadius)
      && Math.abs(position.y - p.y) <= CARRY.pickupHeight;
  }
  function place(at: THREE.Vector3, action: 'place' | 'dash-drop' | 'recover'): void {
    carried = false;
    rollTime = 0;
    position.copy(at);
    pulse = 1;
    lastAction = action;
    if (action === 'place') placements++;
    if (action === 'dash-drop') dashDrops++;
    if (action === 'recover') recoveries++;
    sync(0);
  }
  function sync(t: number): void {
    if (carried) {
      opts.fox.updateWorldMatrix(true, true);
      if (head) head.getWorldPosition(held);
      else held.copy(opts.fox.position).add(new THREE.Vector3(0, 0.45, 0));
      forward.set(0, 0, 1).applyQuaternion(opts.fox.quaternion);
      side.set(1, 0, 0).applyQuaternion(opts.fox.quaternion);
      position.copy(held).addScaledVector(forward, CARRY.mouthForward).addScaledVector(side, CARRY.mouthSide);
      position.y -= CARRY.mouthLower;
      ember.position.copy(position);
    } else {
      const progress = 1 - rollTime / 0.35;
      ember.position.lerpVectors(rollFrom, position, progress * progress * (3 - 2 * progress));
      ember.position.y += CARRY.emberSize * 0.8;
    }
    ember.scale.setScalar(CARRY.emberSize * (1 + 0.12 * pulse));
    halo.visible = !carried;
    halo.position.copy(position).add(new THREE.Vector3(0, 0.022, 0));
    for (let i = 0; i < sparks.length; i++) {
      const phase = (t * 0.55 + i / sparks.length) % 1;
      const a = i * 2.4 + t * 0.3;
      const r = (0.04 + phase * 0.09) * (1 + pulse);
      sparks[i]!.position.copy(ember.position).add(new THREE.Vector3(Math.cos(a) * r, 0.05 + phase * 0.36, Math.sin(a) * r));
      sparks[i]!.scale.setScalar(Math.sin(phase * Math.PI));
    }
  }
  sync(0);

  return {
    interact(): boolean {
      if (!grounded || dashing) return false;
      if (carried) {
        // Only authored same-storey bowls accept warmth ahead of the feet.
        const p = opts.fox.position;
        const floor = opts.surfaceAt(p.x, p.z);
        if (!Number.isFinite(floor) || Math.abs(floor - p.y) > 0.3) return false;
        const bed = opts.bowls?.filter(b => Math.abs(b.y - floor) < 0.3 && Math.hypot(b.x - p.x, b.z - p.z) <= CARRY.bowlReach)
          .sort((a, b) => a.distanceToSquared(p) - b.distanceToSquared(p))[0];
        place(bed ?? new THREE.Vector3(p.x, floor, p.z), 'place');
        if (bed) {
          rollFrom.set(p.x, floor, p.z);
          rollTime = 0.35;
          sync(0);
        }
        return true;
      }
      if (!canPickup()) return false;
      carried = true;
      pickups++;
      pulse = 1;
      lastAction = 'pickup';
      sync(0);
      return true;
    },
    beforeDash(lastGrounded: THREE.Vector3): void {
      safe.copy(lastGrounded);
      if (carried) place(safe, 'dash-drop');
    },
    /** Call only after an actual fall/respawn, not during ordinary exploration. */
    recover(at: THREE.Vector3): void {
      safe.copy(at);
      if (carried) return;
      place(safe, 'recover');
    },
    update(dt: number, t: number, player: CarryPlayer): void {
      grounded = player.grounded;
      dashing = player.dashing ?? false;
      if (grounded && Number.isFinite(opts.surfaceAt(opts.fox.position.x, opts.fox.position.z))) safe.copy(opts.fox.position);
      rollTime = Math.max(0, rollTime - dt);
      pulse = Math.max(0, pulse - dt * 2.5);
      fire.emissiveIntensity = CARRY.glow * (1 + 0.08 * Math.sin(t * 4) + pulse * 0.4);
      sync(t);
      glyph.textContent = carried ? 'E · set warmth down' : 'E · carry warmth';
      const teach = carried ? placements === 0 : pickups === 0 && canPickup();
      glyph.style.opacity = grounded && !dashing && teach ? '1' : '0';
    },
    heatSource(): CoalHeatSource {
      return { position: position.clone(), carried, heat: 1 };
    },
    state() {
      return {
        carried, heat: 1, cooling: false, position: position.toArray(), lastGrounded: safe.toArray(),
        canPickup: grounded && !dashing && canPickup(), canPlace: carried && grounded && !dashing,
        pickups, placements, dashDrops, recoveries, lastAction, rolling: rollTime > 0,
      };
    },
  };
}

export type CarrySystem = ReturnType<typeof createCarry>;
