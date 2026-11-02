/** Physical hub progress markers, redrawn by progress events rather than per-frame polling. */
import * as THREE from 'three';
import { WORLD_IDS, WORLD_CATALOGUE, type WorldId, type WorldProgress } from './progress';
export interface SeedwellPlacement { world: WorldId; x: number; z: number; y: number; yaw?: number }
export function buildSeedwells(scene: THREE.Scene, progress: WorldProgress, placements: readonly SeedwellPlacement[]): { dispose(): void } {
  const root = new THREE.Group(); root.name = 'Three Seedwells'; scene.add(root);
  const fills = new Map<WorldId, THREE.Mesh[]>();
  const resources: { dispose(): void }[] = [];
  function material(color: THREE.ColorRepresentation, metalness = 0) { const value = new THREE.MeshStandardMaterial({ color, roughness: .65, metalness }); resources.push(value); return value; }
  function cylinder(radius: number, height: number, mat: THREE.Material) { const geo = new THREE.CylinderGeometry(radius, radius, height, 32); resources.push(geo); const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = true; mesh.receiveShadow = true; return mesh; }
  for (const placement of placements) {
    const def = WORLD_CATALOGUE[placement.world], well = new THREE.Group(); well.position.set(placement.x, placement.y, placement.z); well.rotation.y = placement.yaw ?? 0; root.add(well);
    const stone = material('#625b67'), rim = material('#b8a28a'), wash = material(def.color, .16);
    const base = cylinder(.95, .25, stone); base.position.y = .125; well.add(base);
    const body = cylinder(.73, .92, stone); body.position.y = .66; well.add(body);
    const geo = new THREE.TorusGeometry(.77, .10, 8, 40); resources.push(geo);
    const crown = new THREE.Mesh(geo, rim); crown.rotation.x = Math.PI / 2; crown.position.y = 1.15; well.add(crown);
    const segments: THREE.Mesh[] = [];
    for (let i = 0; i < 3; i++) {
      const band = cylinder(.75, .19, wash); band.position.y = .36 + i * .27; band.visible = false; segments.push(band); well.add(band);
    }
    fills.set(placement.world, segments);
    const water = cylinder(.67, .04, wash); water.position.y = 1.14; water.visible = false; well.add(water);
    segments.push(water);
    const timber = material('#584331');
    const postGeo = new THREE.CylinderGeometry(.045, .055, 1.15, 6); resources.push(postGeo);
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(postGeo, timber); post.position.set(side * .7, 1.35, -.035); post.castShadow = true; well.add(post);
    }
    const leafGeo = new THREE.OctahedronGeometry(.18, 0); resources.push(leafGeo);
    const leaf = new THREE.Mesh(leafGeo, wash); leaf.scale.set(.7, 1.4, .18); leaf.rotation.z = -.4; leaf.position.y = 1.39; leaf.visible = false; well.add(leaf); segments.push(leaf);
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 144;
    const g = canvas.getContext('2d')!; g.fillStyle = '#302837'; g.beginPath(); g.roundRect(0, 0, 512, 144, 20); g.fill();
    g.textAlign = 'center'; g.fillStyle = '#fff2d8'; g.font = '38px Georgia, serif'; g.fillText(`${def.well} Seedwell`, 256, 57); g.font = '27px Georgia, serif'; g.fillStyle = def.color; g.fillText(def.name, 256, 109);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; resources.push(texture);
    const signMat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide, toneMapped: false }); resources.push(signMat);
    const signGeo = new THREE.PlaneGeometry(2.3, .65); resources.push(signGeo);
    const sign = new THREE.Mesh(signGeo, signMat); sign.position.set(0, 1.85, 0); well.add(sign);
  }
  function sync() {
    for (const world of WORLD_IDS) {
      const segments = fills.get(world); if (!segments) continue;
      let count = 0;
      if (progress.isRestored(world, 'teach')) count++;
      if (progress.isRestored(world, 'develop')) count++;
      if (progress.isRestored(world, 'combine')) count++;
      for (let i = 0; i < 3; i++) segments[i]!.visible = i < count;
      segments[3]!.visible = count === 3;
      segments[4]!.visible = count === 3;
    }
  }
  sync(); const unsubscribe = progress.subscribe(sync);
  return { dispose() { unsubscribe(); scene.remove(root); for (const resource of resources) resource.dispose(); } };
}
