import * as THREE from 'three';
import type { OpeningCtx } from './scene';
import { CANOPY, JOGS, POP_UP_RUIN } from './layout';

const TO_CANOPY = [[-4, 88], [-3.2, 86.5], [-3.2, 80.5], [-0.2, 74.4], [-0.2, 71.5]] as const;
const HINTS = ['Follow the loose page', 'Shift · dash to catch it', 'Space · hold to spring from a leaf', 'Shift · dash into the folded tab', 'Space · jump across the paper', 'Let the paper unfold'] as const;
type Action = 'follow' | 'dash' | 'spring' | 'unfold' | 'jump' | 'wait';
const ACTIONS: readonly Action[] = ['follow', 'dash', 'spring', 'unfold', 'jump', 'wait'];
type PageView = { readonly pos: THREE.Vector3; readonly catches: number; readonly kept: boolean };
type CanopyView = { readonly lastLeaf: string | null };
type RuinView = { readonly firstOpen: boolean; readonly secondOpen: boolean; readonly reached: boolean; readonly opening: boolean };

type Leg = 'page' | 'gate' | 'entry' | 'middle' | 'high' | 'roost' | 'grove' | 'fold1' | 'jump1' | 'fold2' | 'jump2' | 'jump3' | 'catch' | 'done';

/** Guidance observes progression; only actual contacts/landings advance its traversal invitation. */
export function buildDiscovery(ctx: OpeningCtx, page: PageView, canopy: CanopyView, ruin: RuinView) {
  // cold:begin
  const target = new THREE.Vector3();
  let action = 0;
  let active = true;
  const scraps = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.12, 0.2), new THREE.MeshBasicMaterial({ color: 0xe7a947, side: THREE.DoubleSide, transparent: true, opacity: 0.8 }), 20);
  scraps.name = 'page-invitation';
  scraps.frustumCulled = false;
  ctx.scene.add(scraps);
  const matrix = new THREE.Matrix4();
  const rotation = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3(1, 1, 1);
  const hud = document.createElement('div');
  hud.dataset.openingTeach = 'page';
  Object.assign(hud.style, { position: 'fixed', left: '16px', top: '16px', color: '#f7e6c4', background: 'rgba(43,35,30,.78)', padding: '10px 15px', borderRadius: '4px', font: '16px Georgia,serif', pointerEvents: 'none', maxWidth: '250px' });
  document.body.append(hud);
  let previousAction = -1;
  let leg: Leg = 'page';
  let seenCatches = -1;
  // cold:end

  function setTarget(x: number, z: number, y: number, nextAction: number): void {
    target.set(x, y, z);
    action = nextAction;
  }

  function followLine(line: ReadonlyArray<readonly [number, number]>): void {
    const fox = ctx.fox.root.position;
    let best = Infinity;
    let next = 1;
    for (let i = 0; i + 1 < line.length; i++) {
      const a = line[i]!;
      const b = line[i + 1]!;
      const dx = b[0] - a[0];
      const dz = b[1] - a[1];
      const u = Math.max(0, Math.min(1, ((fox.x - a[0]) * dx + (fox.z - a[1]) * dz) / (dx * dx + dz * dz)));
      const d = Math.hypot(fox.x - a[0] - u * dx, fox.z - a[1] - u * dz);
      if (d < best) { best = d; next = i + 1; }
    }
    if (next + 1 < line.length && Math.hypot(fox.x - line[next]![0], fox.z - line[next]![1]) < 0.8) next++;
    const q = line[next]!;
    setTarget(q[0], q[1], ctx.groundH(q[0], q[1]) + 0.35, 0);
  }

  function onRuinLeaf(index: number): boolean {
    const fox = ctx.fox.root.position;
    const q = POP_UP_RUIN.leaves[index]!;
    return !!ctx.player?.motion.grounded && Math.abs(fox.x - q.x) < 1.6 && Math.abs(fox.z - q.z) < 1.6 && Math.abs(fox.y - q.top) < 0.12;
  }

  function updateTarget(): void {
    const fox = ctx.fox.root.position;
    if (seenCatches !== page.catches) {
      seenCatches = page.catches;
      leg = page.kept ? 'done' : page.catches === 0 ? 'page' : page.catches === 1 ? 'gate' : 'grove';
    }
    active = !page.kept;
    if (!active) { leg = 'done'; return; }
    if (page.catches === 1) {
      if (leg === 'gate' && fox.z < 73.3) leg = 'entry';
      else if (leg !== 'gate' && ctx.player?.motion.grounded && fox.y < ctx.groundH(fox.x, fox.z) + 0.15) leg = 'entry';
      if (leg === 'entry' && canopy.lastLeaf === 'entry') leg = 'middle';
      else if (leg === 'middle' && canopy.lastLeaf === 'middle') leg = 'high';
      else if (leg === 'high' && canopy.lastLeaf === 'high') leg = 'roost';
    }
    if (page.catches === 2) {
      if (leg === 'grove' && fox.x < -21.5) leg = 'fold1';
      if (leg === 'fold1' && ruin.firstOpen) leg = 'jump1';
      if (leg === 'jump1' && onRuinLeaf(0)) leg = 'fold2';
      if (leg === 'fold2' && ruin.secondOpen) leg = 'jump2';
      if (leg === 'jump2' && onRuinLeaf(1)) leg = 'jump3';
      if (leg === 'jump3' && ruin.reached) leg = 'catch';
      if (leg !== 'grove' && leg !== 'fold1' && ctx.player?.motion.grounded && fox.y < POP_UP_RUIN.leaves[0].top - 0.15) leg = 'jump1';
    }
    if (leg === 'page') {
      target.copy(page.pos);
      action = 1;
    } else if (leg === 'gate') {
      followLine(TO_CANOPY);
    } else if (leg === 'entry' || leg === 'middle' || leg === 'high' || leg === 'roost') {
      const index = leg === 'entry' ? 0 : leg === 'middle' ? 1 : leg === 'high' ? 2 : 3;
      const leaf = CANOPY[index]!;
      if (leg === 'roost' && canopy.lastLeaf === 'roost') target.copy(page.pos);
      else target.set(leaf.x, ctx.groundH(leaf.x, leaf.z) + leaf.rise + 0.15, leaf.z);
      action = 2;
    } else if (leg === 'grove') {
      followLine(JOGS.line);
    } else if (ruin.opening) {
      target.copy(fox);
      action = 5;
    } else if (leg === 'fold1') {
      const aligned = Math.abs(fox.z - 75) < 0.2 && fox.x < -23.3;
      setTarget(aligned ? -24.4 : -23.6, 75, ctx.groundH(-23.6, 75) + 0.4, aligned ? 3 : 0);
    } else if (leg === 'jump1') {
      setTarget(-26.7, 75, POP_UP_RUIN.leaves[0].top + 0.2, fox.x > -24.3 ? 0 : 4);
    } else if (leg === 'fold2') {
      const aligned = Math.abs(fox.x + 28.4) < 0.2 && fox.z < 75.05;
      setTarget(-28.4, aligned ? 73.8 : 74.8, POP_UP_RUIN.leaves[0].top + 0.3, aligned ? 3 : 0);
    } else if (leg === 'jump2') {
      setTarget(-28.4, 71.1, POP_UP_RUIN.leaves[1].top + 0.2, fox.z > 73.9 ? 0 : 4);
    } else if (leg === 'jump3') {
      setTarget(POP_UP_RUIN.overlook.x, POP_UP_RUIN.overlook.z, POP_UP_RUIN.overlook.top + 0.2, fox.x < -27.7 ? 0 : 4);
    } else {
      target.copy(page.pos);
      action = 4;
    }
  }

  ctx.onUpdate((_dt, t) => {
    updateTarget();
    scraps.visible = active;
    hud.hidden = !active;
    if (!active) return;
    if (previousAction !== action) {
      hud.textContent = HINTS[action]!;
      previousAction = action;
    }
    const fox = ctx.fox.root.position;
    const dx = target.x - fox.x;
    const dz = target.z - fox.z;
    const distance = Math.hypot(dx, dz);
    const length = Math.min(6, distance);
    for (let i = 0; i < scraps.count; i++) {
      const u = ((i / scraps.count + t * 0.27) % 1);
      const along = u * length;
      const blend = distance > 0.01 ? along / distance : 0;
      position.set(fox.x + dx * blend, fox.y + (target.y - fox.y) * blend + 0.35 + Math.sin(t * 3 + i) * 0.13, fox.z + dz * blend);
      position.y = Math.max(position.y, ctx.groundH(position.x, position.z) + 0.18);
      euler.set(t * 2.1 + i, t * 1.3 + i * 2, Math.sin(t + i));
      rotation.setFromEuler(euler);
      scale.setScalar(Math.sin(u * Math.PI) * 0.85);
      scraps.setMatrixAt(i, matrix.compose(position, rotation, scale));
    }
    scraps.instanceMatrix.needsUpdate = true;
  });
  return {
    state: () => ({ active, leg, target: target.toArray(), action: ACTIONS[action], hint: HINTS[action] }),
  };
}
