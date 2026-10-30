import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createMapleTree, createWindGrass, createStylizedWater } from '../../../src/render';

export type World = {
  group: THREE.Group;
  /** Materials safe to ColorField-patch (excludes maple leaves — keep autumn chroma) */
  materials: THREE.MeshStandardMaterial[];
  yAt: (x: number, z: number) => number;
  shrinePos: THREE.Vector3;
  spawnPos: THREE.Vector3;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  setGrassSat: (s: number) => void;
  update: (dt: number, t: number, foxPos?: THREE.Vector3) => void;
};

/** Soft radial bowl + terraces + path trench — key-art floating island. */
export function islandHeight(x: number, z: number, radius = 30): number {
  const ang = Math.atan2(z, x);
  const jagged = 1 + 0.07 * Math.sin(ang * 5.0) + 0.045 * Math.sin(ang * 11.0) + 0.03 * Math.sin(ang * 3.0 + 1.2);
  const r = Math.hypot(x, z) / (radius * jagged);
  if (r > 1.12) return -4;
  const dome = Math.pow(Math.max(0, 1 - r * r), 1.05) * 3.2;
  const ripples = Math.sin(x * 0.22) * Math.cos(z * 0.18) * 0.35 + Math.sin(x * 0.55 + z * 0.4) * 0.12;
  // Raised shrine hill to the north
  const shrineHill = Math.exp(-(x * x + (z + 12) * (z + 12)) / 38) * 4.2;
  // Arrival meadow dip south
  const meadow = Math.exp(-(x * x + (z - 16) * (z - 16)) / 55) * -0.55;
  // Soft path trench toward shrine (along -z)
  const pathX = Math.abs(x);
  const onPath = pathX < 2.4 && z < 18 && z > -16;
  const pathDip = onPath ? -0.22 * (1 - pathX / 2.4) : 0;
  // Cliff lip
  const lip = r > 0.82 && r < 0.98 ? 0.55 * Math.sin((r - 0.82) / 0.16 * Math.PI) : 0;
  const terrace = r > 0.5 && r < 0.72 ? 0.4 : 0;
  return dome + ripples + shrineHill + meadow + pathDip + lip + terrace;
}

function collectMats(root: THREE.Object3D, into: THREE.MeshStandardMaterial[]) {
  root.traverse((c) => {
    if (!(c as THREE.Mesh).isMesh) return;
    const m = (c as THREE.Mesh).material;
    const list = Array.isArray(m) ? m : [m];
    for (const mat of list) {
      if (mat && (mat as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
        const sm = mat as THREE.MeshStandardMaterial;
        if (!into.includes(sm)) into.push(sm);
      }
    }
  });
}

async function tryLoad(url: string): Promise<THREE.Group | null> {
  try {
    const gltf = await new GLTFLoader().loadAsync(url);
    return gltf.scene;
  } catch {
    return null;
  }
}

function makeTerrain(radius: number): {
  mesh: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
  yAt: (x: number, z: number) => number;
} {
  const seg = 128;
  const geo = new THREE.PlaneGeometry(radius * 2.35, radius * 2.35, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  // Parchment ground — paper-warm base with rust moss / path ink
  const cGrass = new THREE.Color(0xe8d2a8); // luminous parchment meadow
  const cMoss = new THREE.Color(0x9a5a38); // rust moss
  const cDirt = new THREE.Color(0x7a5538);
  const cPath = new THREE.Color(0xd4b888); // luminous worn path
  const cRock = new THREE.Color(0x5c5650);
  const cCliff = new THREE.Color(0x4a4540);
  const tmp = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = islandHeight(x, z, radius);
    pos.setY(i, y);
    const r = Math.hypot(x, z) / radius;
    const onPath = Math.abs(x) < 2.2 && z < 18 && z > -16;
    if (y < 0.35 || r > 0.92) tmp.copy(cCliff);
    else if (r > 0.78) tmp.copy(cRock);
    else if (onPath) tmp.copy(cPath);
    else if (z < -6) tmp.copy(cMoss);
    else if (Math.sin(x * 2.1 + z * 1.7) > 0.35) tmp.copy(cDirt);
    else tmp.copy(cGrass);
    tmp.offsetHSL(0, 0, Math.sin(x * 2.7 + z * 3.1) * 0.04);
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  // Soft fiber noise so ground reads as painted parchment, not plastic
  const cnv = document.createElement('canvas');
  cnv.width = 256; cnv.height = 256;
  const ctx = cnv.getContext('2d')!;
  ctx.fillStyle = '#e2cba0';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 9000; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const a = 0.04 + Math.random() * 0.08;
    ctx.fillStyle = Math.random() > 0.5 ? `rgba(90,60,35,${a})` : `rgba(210,180,130,${a})`;
    ctx.fillRect(x, y, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
  const parchmentMap = new THREE.CanvasTexture(cnv);
  parchmentMap.wrapS = parchmentMap.wrapT = THREE.RepeatWrapping;
  parchmentMap.repeat.set(14, 14);
  parchmentMap.colorSpace = THREE.SRGBColorSpace;

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    map: parchmentMap,
    roughness: 0.94,
    metalness: 0.0,
  });
  const mesh = new THREE.Mesh(geo, material);
  mesh.receiveShadow = true;
  mesh.castShadow = true;

  // Root-hung underside (key art)
  const underMat = new THREE.MeshStandardMaterial({
    color: 0x3a342e,
    roughness: 0.95,
    flatShading: true,
  });
  const under = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.92, 14, 48, 1, true), underMat);
  under.position.y = -6.5;
  under.castShadow = true;
  mesh.add(under);

  // Extra root tendrils
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const root = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.45, 5 + (i % 3), 5),
      underMat,
    );
    root.position.set(Math.cos(a) * radius * 0.55, -4.5, Math.sin(a) * radius * 0.55);
    root.rotation.z = Math.cos(a) * 0.45;
    root.rotation.x = Math.sin(a) * 0.45;
    root.castShadow = true;
    mesh.add(root);
  }

  return {
    mesh,
    material,
    yAt: (x, z) => {
      const h = islandHeight(x, z, radius);
      return h < -1 ? -4 : Math.max(0, h);
    },
  };
}

function proceduralArch(mat: THREE.MeshStandardMaterial): THREE.Group {
  const arch = new THREE.Group();
  const colL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 3.2, 0.5), mat);
  const colR = colL.clone();
  colL.position.set(-1.35, 1.6, 0);
  colR.position.set(1.35, 1.6, 0);
  // Weathered chips / broken capital
  const chipMat = mat;
  for (const col of [colL, colR]) {
    const chip = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.35), chipMat);
    chip.position.set((Math.random() - 0.5) * 0.15, 1.55, 0.28);
    chip.rotation.z = (Math.random() - 0.5) * 0.4;
    col.add(chip);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.5, 0.6), mat);
  lintel.position.set(0, 3.35, 0);
  // Broken corner on lintel
  const broken = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.35, 0.45), mat);
  broken.position.set(1.55, 3.15, 0.15);
  broken.rotation.set(0.2, 0.3, -0.35);
  arch.add(colL, colR, lintel, broken);
  arch.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) {
      c.castShadow = true;
      c.receiveShadow = true;
    }
  });
  return arch;
}

function proceduralShrine(): { group: THREE.Group; mats: THREE.MeshStandardMaterial[]; orb: THREE.Mesh } {
  const group = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: 0x8a7a68, roughness: 0.82, metalness: 0.05 });
  const glow = new THREE.MeshStandardMaterial({
    color: 0xffcc66,
    emissive: 0xffaa33,
    emissiveIntensity: 0.25,
    roughness: 0.4,
  });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.5, 0.4, 8), stone);
  base.position.y = 0.2;
  base.castShadow = true;
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.35, 2.0, 6), stone);
  pillar.position.y = 1.3;
  pillar.castShadow = true;
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 16), glow);
  orb.position.y = 2.55;
  orb.name = 'shrineOrb';
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.05, 8, 24), glow);
  ring.position.y = 2.55;
  ring.rotation.x = Math.PI / 2;
  group.add(base, pillar, orb, ring);
  return { group, mats: [stone, glow], orb };
}

export async function createWorld(scene: THREE.Scene): Promise<World> {
  const radius = 30;
  const group = new THREE.Group();
  scene.add(group);
  const materials: THREE.MeshStandardMaterial[] = [];

  const terrain = makeTerrain(radius);
  group.add(terrain.mesh);
  materials.push(terrain.material);
  collectMats(terrain.mesh, materials);

  const yAt = terrain.yAt;
  const spawnPos = new THREE.Vector3(0, yAt(0, 12) + 0.05, 12);
  const shrineXZ = { x: 0.4, z: -8.5 };
  const shrinePos = new THREE.Vector3(shrineXZ.x, yAt(shrineXZ.x, shrineXZ.z), shrineXZ.z);

  // Cloud sea / stylized water
  createStylizedWater(scene, { size: 160, y: -2.2 });

  // Wind grass (golden) — sync uSat from ColorField in main
  const grass = createWindGrass(scene, {
    count: 16000,
    radius: 28,
    bladeHeight: 0.14,
    bladeBaseW: 0.018,
    bladeTipW: 0.0025,
    pathClearHalfW: 2.8,
    color: 0x8a4e1e,       // rust root (restored)
    tipColor: 0xc9963a,    // muted gold tip
    monoColor: 0x3a3228,   // dark sepia root (readable against parchment ground)
    tipMono: 0xb59a72,     // lighter parchment tip for silhouette
    ySampler: (x, z) => {
      const h = yAt(x, z);
      return h > 0.3 && h < 5 ? h : -10;
    },
  });

  // Shrine
  let shrineOrb: THREE.Mesh | null = null;
  const shrineGlb = await tryLoad('/assets/env/procedural/shrine.glb');
  if (shrineGlb) {
    const box = new THREE.Box3().setFromObject(shrineGlb);
    const size = new THREE.Vector3();
    box.getSize(size);
    const s = 3.2 / Math.max(size.y, 0.001);
    shrineGlb.scale.setScalar(s);
    box.setFromObject(shrineGlb);
    shrineGlb.position.set(shrinePos.x, shrinePos.y - box.min.y, shrinePos.z);
    group.add(shrineGlb);
    collectMats(shrineGlb, materials);
    shrineGlb.traverse((c) => {
      if ((c as THREE.Mesh).isMesh && /orb|crystal|glow|ember/i.test(c.name)) {
        shrineOrb = c as THREE.Mesh;
      }
    });
  } else {
    const shrine = proceduralShrine();
    shrine.group.position.copy(shrinePos);
    group.add(shrine.group);
    materials.push(...shrine.mats);
    shrineOrb = shrine.orb;
  }

  // Maple trees — mix GLB + procedural
  const mapleGlb = await tryLoad('/assets/env/procedural/maple_tree.glb');
  const mapleSites: Array<[number, number, number]> = [
    [6.5, -10, 1.6],
    [-7.2, -8.5, 1.35],
    [4.2, 4.0, 1.1],
    [-5.5, 8.0, 1.0],
    [9.0, 12.0, 0.95],
    [-10.0, -2.0, 1.15],
    [2.8, -14.5, 1.85], // hero maple by shrine
    [-3.5, 16.0, 0.9],
    [12.0, -4.0, 1.05],
    [-12.5, 6.0, 1.0],
  ];
  const leafColors = [0xb8321f, 0xc45a28, 0xa8441f, 0xd4782a, 0xc9a04a];
  for (let i = 0; i < mapleSites.length; i++) {
    const [x, z, sc] = mapleSites[i]!;
    const y = yAt(x, z);
    if (y < 0.25) continue;
    if (mapleGlb) {
      const tree = mapleGlb.clone(true);
      const box = new THREE.Box3().setFromObject(tree);
      const size = new THREE.Vector3();
      box.getSize(size);
      const s = (sc * 5.8) / Math.max(size.y, 0.001);
      tree.scale.setScalar(s * (0.92 + (i % 3) * 0.08));
      box.setFromObject(tree);
      tree.position.set(x, y - box.min.y, z);
      tree.rotation.y = i * 1.7;
      tree.traverse((c) => {
        if ((c as THREE.Mesh).isMesh) {
          c.castShadow = true;
          c.receiveShadow = true;
          const mats = (c as THREE.Mesh).material;
          const list = Array.isArray(mats) ? mats : [mats];
          for (const raw of list) {
            const m = raw as THREE.MeshStandardMaterial;
            if (!m?.isMeshStandardMaterial) continue;
            // Vertex-colored leaf prims often lack a "Leaf" name — detect by vertexColors
            if (/leaf/i.test(m.name || '') || m.vertexColors) {
              if (!/bark|trunk|wood/i.test(m.name || '')) {
                m.name = m.name || 'MapleLeaf';
                if (!/bark/i.test(m.name)) {
                  m.emissive = new THREE.Color(leafColors[i % leafColors.length]!);
                  m.emissiveIntensity = 0.1;
                }
              }
            }
          }
        }
      });
      group.add(tree);
      collectMats(tree, materials);
    } else {
      const tree = createMapleTree(leafColors[i % leafColors.length]!, 0x3a2418);
      tree.position.set(x, y, z);
      tree.scale.setScalar(sc * 1.35);
      group.add(tree);
      collectMats(tree, materials);
    }
  }

  // Ruin arches along path
  const archGlb = await tryLoad('/assets/env/procedural/ruin_arch.glb');
  const ruinMat = new THREE.MeshStandardMaterial({ color: 0x7a6a55, roughness: 0.9, flatShading: true });
  materials.push(ruinMat);
  // Keep arches off the +Z camera→shrine axis so mid/end shots stay open
  const archSites: Array<[number, number, number]> = [
    [-7.5, 4.0, 0.55],   // west flank
    [8.0, -1.5, -0.7],   // east flank
    [-9.0, -10.0, 0.2],  // southwest approach wing (not in center frame)
  ];
  for (const [x, z, rot] of archSites) {
    const y = yAt(x, z);
    if (archGlb) {
      const a = archGlb.clone(true);
      const box = new THREE.Box3().setFromObject(a);
      const size = new THREE.Vector3();
      box.getSize(size);
      a.scale.setScalar(3.5 / Math.max(size.y, 0.001));
      box.setFromObject(a);
      a.position.set(x, y - box.min.y, z);
      a.rotation.y = rot;
      group.add(a);
      collectMats(a, materials);
    } else {
      const a = proceduralArch(ruinMat);
      a.position.set(x, y, z);
      a.rotation.y = rot;
      group.add(a);
    }
  }

  // Leaf piles
  const pileGlb = await tryLoad('/assets/env/procedural/leaf_pile.glb');
  for (let i = 0; i < 12; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 4 + Math.random() * 18;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r * 0.85 + 2;
    const y = yAt(x, z);
    if (y < 0.3) continue;
    if (pileGlb && i % 2 === 0) {
      const p = pileGlb.clone(true);
      p.scale.setScalar(0.7 + Math.random() * 0.6);
      const box = new THREE.Box3().setFromObject(p);
      p.position.set(x, y - box.min.y, z);
      p.rotation.y = Math.random() * Math.PI;
      group.add(p);
      collectMats(p, materials);
    } else {
      const col = leafColors[i % leafColors.length]!;
      const mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.95 });
      materials.push(mat);
      const pile = new THREE.Mesh(new THREE.SphereGeometry(0.55 + Math.random() * 0.35, 8, 6), mat);
      pile.scale.set(1.4, 0.35, 1.2);
      pile.position.set(x, y + 0.08, z);
      pile.castShadow = true;
      group.add(pile);
    }
  }


  // Dense fallen-leaf carpet along the critical path
  {
    const carpetCount = 180;
    const leafGeo = new THREE.PlaneGeometry(0.12, 0.15);
    const carpetDummy = new THREE.Object3D();
    for (let i = 0; i < carpetCount; i++) {
      const z = 14 - (i / carpetCount) * 26 + (Math.random() - 0.5) * 2.4;
      // Bias to path edges — keep center walkway readable
      const side = Math.random() < 0.5 ? -1 : 1;
      const x = side * (1.6 + Math.random() * 3.2);
      const y = yAt(x, z);
      if (y < 0.2) continue;
      const col = leafColors[i % leafColors.length]!;
      const mat = new THREE.MeshStandardMaterial({
        color: col,
        roughness: 0.92,
        metalness: 0,
        side: THREE.DoubleSide,
        // Keep leaves slightly emissive so sepia wash still reads autumn
        emissive: new THREE.Color(col),
        emissiveIntensity: 0.12,
      });
      materials.push(mat);
      const card = new THREE.Mesh(leafGeo, mat);
      card.position.set(x, y + 0.03 + Math.random() * 0.04, z);
      card.rotation.set(-Math.PI / 2 + (Math.random() - 0.5) * 0.35, Math.random() * Math.PI, (Math.random() - 0.5) * 0.4);
      card.scale.setScalar(0.45 + Math.random() * 0.4);
      card.castShadow = true;
      group.add(card);
    }
  }


  // Red autumn shrubs + extra maple litter tufts (restored-world density)
  {
    const shrubColors = [0x8a1e18, 0xa8281c, 0x6e1810, 0xb8321f, 0x7a2a14];
    for (let i = 0; i < 80; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 3.5 + Math.random() * 20;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r * 0.9;
      // keep center path clear for camera
      if (Math.abs(x) < 2.2 && z < 14 && z > -14) continue;
      const y = yAt(x, z);
      if (y < 0.35 || y > 5) continue;
      const col = shrubColors[i % shrubColors.length]!;
      const mat = new THREE.MeshStandardMaterial({
        color: col,
        roughness: 0.88,
        flatShading: true,
        emissive: new THREE.Color(col),
        emissiveIntensity: 0.06,
      });
      materials.push(mat);
      const shrub = new THREE.Group();
      const lobes = 3 + (i % 3);
      for (let L = 0; L < lobes; L++) {
        const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28 + Math.random() * 0.22, 0), mat);
        blob.position.set((Math.random() - 0.5) * 0.45, 0.25 + Math.random() * 0.35, (Math.random() - 0.5) * 0.45);
        blob.scale.set(1.1 + Math.random() * 0.4, 0.7 + Math.random() * 0.35, 1.0 + Math.random() * 0.3);
        blob.castShadow = true;
        shrub.add(blob);
      }
      shrub.position.set(x, y, z);
      shrub.scale.setScalar(0.85 + Math.random() * 0.7);
      group.add(shrub);
    }
    // Scattered maple leaf cards beyond the path carpet
    const litterGeo = new THREE.PlaneGeometry(0.11, 0.14);
    for (let i = 0; i < 180; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * 24;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const y = yAt(x, z);
      if (y < 0.3 || y > 5) continue;
      const col = leafColors[i % leafColors.length]!;
      const mat = new THREE.MeshStandardMaterial({
        color: col,
        roughness: 0.93,
        side: THREE.DoubleSide,
        emissive: new THREE.Color(col),
        emissiveIntensity: 0.1,
      });
      materials.push(mat);
      const card = new THREE.Mesh(litterGeo, mat);
      card.position.set(x, y + 0.025, z);
      card.rotation.set(-Math.PI / 2 + (Math.random() - 0.5) * 0.5, Math.random() * Math.PI, (Math.random() - 0.5) * 0.5);
      card.scale.setScalar(0.6 + Math.random() * 1.1);
      group.add(card);
    }
  }

  // Rocks (Kenney optional)
  const rockUrls = [
    '/assets/env/kenney/rock_largeA.glb',
    '/assets/env/kenney/rock_largeB.glb',
    '/assets/env/kenney/rock_smallA.glb',
  ];
  const rocks: THREE.Group[] = [];
  for (const url of rockUrls) {
    const r = await tryLoad(url);
    if (r) rocks.push(r);
  }
  for (let i = 0; i < 14; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 8 + Math.random() * 16;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const y = yAt(x, z);
    if (y < 0.25) continue;
    // Keep camera approach corridor clear (was crowding mid/end frames)
    if (Math.abs(x) < 4.5 && z < 16 && z > -14) continue;
    if (rocks.length) {
      const src = rocks[i % rocks.length]!;
      const rock = src.clone(true);
      rock.scale.setScalar(0.8 + Math.random() * 1.2);
      const box = new THREE.Box3().setFromObject(rock);
      rock.position.set(x, y - box.min.y, z);
      rock.rotation.y = Math.random() * Math.PI;
      group.add(rock);
      collectMats(rock, materials);
    } else {
      const mat = new THREE.MeshStandardMaterial({ color: 0x6a6560, roughness: 0.92, flatShading: true });
      materials.push(mat);
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.4 + Math.random() * 0.7, 0), mat);
      rock.position.set(x, y + 0.2, z);
      rock.castShadow = true;
      group.add(rock);
    }
  }

  // Distant satellite islets
  const satMat = new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 0.95, flatShading: true });
  materials.push(satMat);
  const sats: Array<[number, number, number, number]> = [
    [42, 6, -18, 3.2],
    [-38, 8, 22, 2.6],
    [28, 12, 36, 2.0],
    [-30, 5, -34, 2.8],
    [50, 10, 10, 1.8],
  ];
  for (const [sx, sy, sz, sc] of sats) {
    const sat = new THREE.Mesh(new THREE.DodecahedronGeometry(sc, 0), satMat);
    sat.position.set(sx, sy, sz);
    sat.scale.set(1.5, 0.5, 1.2);
    sat.castShadow = true;
    group.add(sat);
  }

  const bounds = { minX: -40, maxX: 40, minZ: -40, maxZ: 40 };

  // Maple leaves stay saturated (key art); ColorField only washes ground/stone/bark
  const patchable = materials.filter((m) => !/leaf/i.test(m.name || ''));

  return {
    group,
    materials: patchable,
    yAt,
    shrinePos,
    spawnPos,
    bounds,
    setGrassSat(s) {
      const u = (grass.mesh.material as THREE.ShaderMaterial).uniforms;
      if (u?.uSat) u.uSat.value = s;
    },
    update(_dt, t, foxPos) {
      grass.update(t, foxPos);
      if (shrineOrb) {
        shrineOrb.rotation.y = t * 0.9;
        shrineOrb.position.y = (shrineOrb.userData.baseY as number | undefined) ?? shrineOrb.position.y;
        if (shrineOrb.userData.baseY === undefined) shrineOrb.userData.baseY = shrineOrb.position.y;
        shrineOrb.position.y = (shrineOrb.userData.baseY as number) + Math.sin(t * 2) * 0.08;
      }
    },
  };
}
