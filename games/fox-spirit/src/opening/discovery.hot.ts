import * as THREE from 'three';
import type { OpeningCtx } from './scene';
import { CANOPY, JOGS, POP_UP_RUIN } from './layout';

const TO_CANOPY = [[-4, 88], [-3.2, 86.5], [-3.2, 80.5], [-0.2, 74.4], [-0.2, 71.5]] as const;
const HINTS = ['Follow the loose page', 'Shift · dash to catch it', 'Space · hold to spring from a leaf', 'Shift · dash into the folded tab', 'Space · jump across the paper', 'Let the paper unfold', 'Hold Space · land on the overlook'] as const;
type Action = 'follow' | 'dash' | 'spring' | 'unfold' | 'jump' | 'wait' | 'land';
type ActionIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;
const ACTIONS: readonly Action[] = ['follow', 'dash', 'spring', 'unfold', 'jump', 'wait', 'land'];
type PageView = { readonly pos: THREE.Vector3; readonly catches: number; readonly kept: boolean; readonly fleeing: boolean };
type CanopyView = { readonly lastLeaf: string | null };
type RuinView = { readonly firstOpen: boolean; readonly secondOpen: boolean; readonly opening: boolean; readonly overlookVisited: boolean };

type Leg = 'page' | 'gate' | 'entry' | 'middle' | 'high' | 'roost' | 'grove' | 'fold1' | 'jump1' | 'fold2' | 'jump2' | 'jump3' | 'catch' | 'land' | 'done';

function invitationLeaf(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 96;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#e2a64d';
  g.strokeStyle = '#c58c2d';
  g.lineWidth = 6;
  g.beginPath();
  g.moveTo(32, 5); g.lineTo(39, 27); g.lineTo(53, 17);
  g.lineTo(50, 38); g.lineTo(60, 43); g.lineTo(48, 60);
  g.lineTo(53, 76); g.lineTo(37, 72); g.lineTo(34, 92);
  g.lineTo(29, 92); g.lineTo(28, 73); g.lineTo(10, 78);
  g.lineTo(16, 60); g.lineTo(4, 47); g.lineTo(17, 38);
  g.lineTo(14, 18); g.lineTo(25, 27); g.closePath();
  g.fill(); g.stroke();
  g.strokeStyle = '#694522';
  g.lineWidth = 2;
  g.stroke();
  g.beginPath();
  g.moveTo(32, 80); g.lineTo(32, 24);
  g.moveTo(32, 53); g.lineTo(46, 36);
  g.moveTo(32, 53); g.lineTo(18, 36);
  g.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Guidance observes progression; only actual contacts/landings advance its traversal invitation. */
export function buildDiscovery(ctx: OpeningCtx, page: PageView, canopy: CanopyView, ruin: RuinView) {
  // cold:begin
  const target = new THREE.Vector3();
  const completionAt = new THREE.Vector3();
  let action: ActionIndex = 0;
  let active = true;
  const scraps = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.28, 0.4), new THREE.MeshBasicMaterial({ map: invitationLeaf(), side: THREE.DoubleSide, transparent: true, alphaTest: 0.05 }), 4);
  scraps.name = 'page-invitation';
  scraps.frustumCulled = false;
  ctx.scene.add(scraps);
  const matrix = new THREE.Matrix4();
  const rotation = new THREE.Quaternion();
  const flutter = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3(1, 1, 1);
  let leg: Leg = 'page';
  let seenCatches = -1;
  const landingToken = Symbol('grounded-overlook');
  // cold:end

  function setTarget(x: number, z: number, y: number, nextAction: ActionIndex): void {
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

  function onRuinLeaf(index: 0 | 1 | 2): boolean {
    const fox = ctx.fox.root.position;
    const q = index === 2 ? POP_UP_RUIN.overlook : POP_UP_RUIN.leaves[index]!;
    return !!ctx.player?.motion.grounded && Math.abs(fox.x - q.x) < 1.6 && Math.abs(fox.z - q.z) < 1.6 && Math.abs(fox.y - q.top) < 0.12;
  }

  function readOverlookLanding(): typeof landingToken | null {
    return ruin.overlookVisited && onRuinLeaf(2) ? landingToken : null;
  }

  function completeGuide(_contact: typeof landingToken): void {
    completionAt.copy(ctx.fox.root.position);
    leg = 'done';
    active = false;
  }

  function updateTarget(): void {
    const fox = ctx.fox.root.position;
    if (seenCatches !== page.catches) {
      seenCatches = page.catches;
      leg = page.kept ? 'land' : page.catches === 0 ? 'page' : page.catches === 1 ? 'gate' : 'grove';
    }
    if (leg === 'done') return;
    active = true;
    const landing = readOverlookLanding();
    if (page.kept && landing !== null) { completeGuide(landing); return; }
    if (page.catches === 1) {
      if (leg === 'gate' && fox.z < 73.3) leg = 'entry';
      else if (leg !== 'gate' && ctx.player?.motion.grounded && fox.y < ctx.groundH(fox.x, fox.z) + 0.15) leg = 'entry';
      if (leg === 'entry' && canopy.lastLeaf === 'entry') leg = 'middle';
      else if (leg === 'middle' && canopy.lastLeaf === 'middle') leg = 'high';
      else if (leg === 'high' && canopy.lastLeaf === 'high') leg = 'roost';
    }
    if (page.catches >= 2) {
      if (leg === 'land' && ctx.player?.motion.grounded && !onRuinLeaf(2)) {
        if (onRuinLeaf(1)) leg = 'jump3';
        else if (onRuinLeaf(0)) leg = 'fold2';
        else leg = ruin.firstOpen ? 'jump1' : 'fold1';
      }
      if (leg === 'grove' && fox.x < -21.5) leg = 'fold1';
      if (leg === 'fold1' && ruin.firstOpen) leg = 'jump1';
      if (leg === 'jump1' && onRuinLeaf(0)) leg = 'fold2';
      if (leg === 'fold2' && ruin.secondOpen) leg = 'jump2';
      if (leg === 'jump2' && onRuinLeaf(1)) leg = 'jump3';
      if (page.catches === 2 && leg === 'jump3' && onRuinLeaf(2)) leg = 'catch';
      if (leg !== 'grove' && leg !== 'fold1' && ctx.player?.motion.grounded && fox.y < POP_UP_RUIN.leaves[0].top - 0.15) leg = 'jump1';
    }
    if (leg === 'page') {
      target.copy(page.pos);
      action = page.fleeing && Math.hypot(page.pos.x - fox.x, page.pos.z - fox.z) < 2.6 ? 1 : 0;
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
    } else if (leg === 'land') {
      setTarget(POP_UP_RUIN.overlook.x, POP_UP_RUIN.overlook.z, POP_UP_RUIN.overlook.top + 0.2, 6);
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
    if (!active) return;
    const fox = ctx.fox.root.position;
    const dx = target.x - fox.x;
    const dz = target.z - fox.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 12) ctx.teach.offer(HINTS[action]!);
    const count = distance < 0.8 ? 0 : Math.min(4, Math.max(1, Math.ceil(distance / 2.25)));
    scraps.count = count;
    const step = Math.min(2.25, distance / Math.max(1, count));
    for (let i = 0; i < count; i++) {
      const along = (i + 1) * step;
      const blend = along / distance;
      position.set(fox.x + dx * blend, fox.y + (target.y - fox.y) * blend + 0.25 + Math.sin(t * 2 + i) * 0.1, fox.z + dz * blend);
      position.y = Math.max(position.y, ctx.groundH(position.x, position.z) + 0.3);
      euler.set(Math.sin(t * 1.7 + i) * 0.22, Math.sin(t * 1.2 + i) * 0.16, Math.sin(t * 1.5 + i * 2) * 0.25);
      flutter.setFromEuler(euler);
      rotation.copy(ctx.player!.cam.camera.quaternion).multiply(flutter);
      scale.setScalar(0.9 + Math.sin(t * 2 - i) * 0.08);
      scraps.setMatrixAt(i, matrix.compose(position, rotation, scale));
    }
    scraps.instanceMatrix.needsUpdate = true;
  });
  return {
    get finished() { return leg === 'done'; },
    state: () => ({ active, leg, completionAt: leg === 'done' ? completionAt.toArray() : null, target: target.toArray(), action: ACTIONS[action], hint: HINTS[action] }),
  };
}
