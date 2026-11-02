/**
 * The Ash Warden (DESIGN-worlds.md story): a tall hooded ink silhouette that is always one step ahead — beside the arch
 * of the next world in the hub, above the weir in Ashwater, at the Press in the winter world — and dissolves into ink
 * motes as each world's last level is restored. In the Press it turns out to be the Scribe's own shadow.
 * No collider (it never blocks), own geometry, no build rand.
 */
import * as THREE from 'three';
import type { OpeningCtx } from './scene';
import type { WorldProgress } from '../worlds/progress';
import { KEEPING } from './layout';

type Post = { x: number; z: number; yaw: number; show: () => boolean; gone: () => boolean; y?: number };

function wardenFigure(): { root: THREE.Group; mats: THREE.MeshToonMaterial[] } {
  const ink = new THREE.MeshToonMaterial({ color: 0x15161b, transparent: true, opacity: 1 });
  const cloakIn = new THREE.MeshToonMaterial({ color: 0x24262e, transparent: true, opacity: 1 });
  const root = new THREE.Group();
  // a tall cloak, hood with two ear points (it was a fox once), a long tail of ink trailing on the ground
  const cloak = new THREE.Mesh(new THREE.ConeGeometry(0.75, 2.6, 9, 1, true), ink);
  cloak.position.y = 1.3;
  root.add(cloak);
  const inner = new THREE.Mesh(new THREE.ConeGeometry(0.7, 2.5, 9), cloakIn);
  inner.position.y = 1.24;
  root.add(inner);
  const hood = new THREE.Mesh(new THREE.SphereGeometry(0.36, 12, 9), ink);
  hood.position.set(0, 2.75, 0.05);
  hood.scale.set(1, 1.15, 1.1);
  root.add(hood);
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.42, 5), ink);
    ear.position.set(s * 0.2, 3.12, 0.02);
    ear.rotation.z = -s * 0.25;
    root.add(ear);
  }
  // two pale eyes
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xd8e2ea, transparent: true, opacity: 1, toneMapped: false });
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 4), eyeMat);
    eye.position.set(s * 0.11, 2.78, 0.36);
    root.add(eye);
  }
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.22, 2.2, 6).rotateX(Math.PI / 2), ink);
  tail.position.set(0.1, 0.18, -1.4);
  root.add(tail);
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true;
  });
  return { root, mats: [ink, cloakIn, eyeMat as unknown as THREE.MeshToonMaterial] };
}

export function buildWarden(ctx: OpeningCtx, progress: WorldProgress) {
  const { scene, groundH } = ctx;
  const posts: Post[] = [
    // hub: beside the arch of the next world to open, watching the fox
    { x: 0.6, z: 92.4, yaw: -2.4, show: () => progress.isRestored('russetvale', 'teach') && !progress.isVisited('ashwater', 'teach'), gone: () => false },
    { x: -12.6, z: 94.4, yaw: 2.6, show: () => progress.isVisited('ashwater', 'teach') && !progress.isVisited('press', 'teach'), gone: () => false },
    // Russetvale: glimpsed on the far crag once the Hearthtree has settled into a bridge, gone when the fox crosses
    { x: KEEPING.crag.x + 1.2, z: KEEPING.crag.z - 1.0, y: KEEPING.crag.top, yaw: -2.6, show: () => progress.isRestored('russetvale', 'develop') && !progress.isVisited('ashwater', 'teach'), gone: () => progress.isRestored('russetvale', 'combine') },
    // Ashwater: above the weir, the one who froze the sluices
    { x: 712, z: 117, yaw: Math.PI, show: () => true, gone: () => progress.isRestored('ashwater', 'combine') },
    // the Press: beside the Press itself — the Scribe's own shadow
    { x: -704, z: 58.5, yaw: 0.3, show: () => true, gone: () => progress.isRestored('press', 'combine') },
  ];
  const figs = posts.map((p) => {
    const f = wardenFigure();
    f.root.position.set(p.x, p.y ?? groundH(p.x, p.z), p.z);
    f.root.rotation.y = p.yaw;
    scene.add(f.root);
    return { ...f, fade: p.show() && !p.gone() ? 1 : 0 };
  });
  let t = 0;
  return {
    update(dt: number): void {
      t += dt;
      for (let i = 0; i < posts.length; i++) {
        const p = posts[i]!;
        const f = figs[i]!;
        const want = p.show() && !p.gone() ? 1 : 0;
        // appears slowly, dissolves faster (rising as it goes)
        f.fade += (want - f.fade) * Math.min(1, dt * (want > f.fade ? 0.8 : 1.6));
        f.root.visible = f.fade > 0.02;
        if (!f.root.visible) continue;
        for (const m of f.mats) m.opacity = f.fade;
        f.root.position.y = (p.y ?? groundH(p.x, p.z)) + (1 - f.fade) * 1.2 + Math.sin(t * 0.9 + i) * 0.04;
        f.root.scale.setScalar(0.9 + 0.1 * f.fade);
      }
    },
    state: () => figs.map((f) => +f.fade.toFixed(2)),
  };
}
