import * as THREE from 'three';
import { createStylizedTree } from '../../../src/render/foliage';

/** Soft radial island height with jagged silhouette. */
export function islandHeight(x: number, z: number, radius = 12): number {
  const ang = Math.atan2(z, x);
  const jagged = 1 + 0.08 * Math.sin(ang * 5.0) + 0.05 * Math.sin(ang * 11.0);
  const r = Math.hypot(x, z) / (radius * jagged);
  if (r > 1.08) return -2;
  const dome = Math.pow(Math.max(0, 1 - r * r), 1.1) * 2.5;
  const ripples = Math.sin(x * 0.55) * Math.cos(z * 0.45) * 0.2;
  const terrace = r > 0.55 && r < 0.78 ? 0.32 : 0;
  return dome + ripples + terrace;
}

export function createIslandMesh(radius = 12): {
  mesh: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
  yAt: (x: number, z: number) => number;
} {
  const seg = 110;
  const geo = new THREE.PlaneGeometry(radius * 2.3, radius * 2.3, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const cGrass = new THREE.Color(0xc9a04a);
  const cDirt = new THREE.Color(0x8a4a28);
  const cLitter = new THREE.Color(0xa8441f);
  const cRock = new THREE.Color(0x6a5a4a);
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = islandHeight(x, z, radius);
    pos.setY(i, y);
    const r = Math.hypot(x, z) / radius;
    if (y < 0.18) tmp.copy(cRock);
    else if (r > 0.8) tmp.copy(cDirt);
    else {
      // leaf-litter splotches (painterly restored carpet)
      const litter = Math.sin(x * 4.2 + z * 3.7) * Math.cos(x * 2.1 - z * 5.3);
      tmp.copy(litter > 0.35 ? cLitter : litter > 0.05 ? cDirt : cGrass);
    }
    tmp.offsetHSL(0, 0, Math.sin(x * 3.1 + z * 2.7) * 0.045);
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.88,
    metalness: 0.02,
  });
  const mesh = new THREE.Mesh(geo, material);
  mesh.receiveShadow = true;
  mesh.castShadow = true;

  const under = new THREE.Mesh(
    new THREE.ConeGeometry(radius * 0.95, 7.5, 56, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x3a2e24, roughness: 0.94, flatShading: true }),
  );
  under.position.y = -3.4;
  under.castShadow = true;
  mesh.add(under);

  return {
    mesh,
    material,
    yAt: (x, z) => Math.max(0, islandHeight(x, z, radius)),
  };
}

export function scatterProps(
  scene: THREE.Scene,
  yAt: (x: number, z: number) => number,
  mats: THREE.MeshStandardMaterial[],
): THREE.Object3D[] {
  const objs: THREE.Object3D[] = [];
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x6e5a44, roughness: 0.92, flatShading: true });
  mats.push(rockMat);

  for (let i = 0; i < 22; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 2.5 + Math.random() * 8.5;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const y = yAt(x, z);
    if (y < 0.2) continue;
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.22 + Math.random() * 0.65, 0),
      rockMat,
    );
    rock.position.set(x, y + 0.12, z);
    rock.rotation.set(Math.random(), Math.random(), Math.random());
    rock.castShadow = true;
    rock.receiveShadow = true;
    scene.add(rock);
    objs.push(rock);
  }

  // ruin arch (concept key art)
  const ruinMat = new THREE.MeshStandardMaterial({ color: 0x7a6a55, roughness: 0.9, flatShading: true });
  mats.push(ruinMat);
  const arch = new THREE.Group();
  const colL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 2.2, 0.35), ruinMat);
  const colR = colL.clone();
  colL.position.set(-1.0, 1.1, 0);
  colR.position.set(1.0, 1.1, 0);
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.35, 0.4), ruinMat);
  lintel.position.set(0, 2.3, 0);
  arch.add(colL, colR, lintel);
  const ax = -4.5;
  const az = 2.5;
  arch.position.set(ax, yAt(ax, az), az);
  arch.rotation.y = 0.6;
  arch.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) {
      c.castShadow = true;
      c.receiveShadow = true;
    }
  });
  scene.add(arch);
  objs.push(arch);

  const leafMats: THREE.MeshStandardMaterial[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.35;
    const r = 4.8 + (i % 3) * 1.6;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const y = yAt(x, z);
    if (y < 0.3) continue;
    const leaf = i % 4 === 0 ? 0xb8321f : i % 4 === 1 ? 0xc45a28 : i % 4 === 2 ? 0xa8441f : 0xd4782a;
    const tree = createStylizedTree(leaf, 0x4a3020);
    tree.position.set(x, y, z);
    tree.scale.setScalar(0.8 + (i % 3) * 0.18);
    scene.add(tree);
    objs.push(tree);
    tree.traverse((c) => {
      if ((c as THREE.Mesh).isMesh) {
        const m = (c as THREE.Mesh).material as THREE.MeshStandardMaterial;
        if (!leafMats.includes(m)) {
          leafMats.push(m);
          mats.push(m);
        }
      }
    });
  }


  // hero maple near path (keyart accent)
  {
    const hx = 3.2, hz = -1.5;
    const hy = yAt(hx, hz);
    if (hy > 0.25) {
      const hero = createStylizedTree(0xb8321f, 0x3a2418);
      hero.position.set(hx, hy, hz);
      hero.scale.setScalar(1.45);
      scene.add(hero);
      objs.push(hero);
      hero.traverse((c) => {
        if ((c as THREE.Mesh).isMesh) {
          const m = (c as THREE.Mesh).material as THREE.MeshStandardMaterial;
          if (!leafMats.includes(m)) {
            leafMats.push(m);
            mats.push(m);
          }
        }
      });
    }
  }

  // distant satellite islands (silhouette like key art)
  const satMat = new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 0.95, flatShading: true });
  mats.push(satMat);
  const sats: Array<[number, number, number, number]> = [
    [18, 4, -8, 2.2],
    [-16, 6, 10, 1.8],
    [10, 9, 16, 1.4],
    [-12, 3, -14, 2.0],
  ];
  for (const [sx, sy, sz, sc] of sats) {
    const sat = new THREE.Mesh(new THREE.DodecahedronGeometry(sc, 0), satMat);
    sat.position.set(sx, sy, sz);
    sat.scale.set(1.4, 0.55, 1.1);
    sat.castShadow = true;
    scene.add(sat);
    objs.push(sat);
  }

  return objs;
}

export function createShrine(yAt: (x: number, z: number) => number): {
  group: THREE.Group;
  materials: THREE.MeshStandardMaterial[];
  position: THREE.Vector3;
} {
  const group = new THREE.Group();
  const x = 0.5;
  const z = -3.2;
  const y = yAt(x, z);
  group.position.set(x, y, z);

  const stone = new THREE.MeshStandardMaterial({ color: 0x8a7a68, roughness: 0.82, metalness: 0.05 });
  const glow = new THREE.MeshStandardMaterial({
    color: 0xffcc66,
    emissive: 0xffaa33,
    emissiveIntensity: 0.2,
    roughness: 0.4,
  });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 0.35, 8), stone);
  base.position.y = 0.175;
  base.castShadow = true;
  group.add(base);

  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 1.6, 6), stone);
  pillar.position.y = 1.0;
  pillar.castShadow = true;
  group.add(pillar);

  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.35, 24, 16), glow);
  orb.position.y = 2.05;
  orb.name = 'shrineOrb';
  group.add(orb);

  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.04, 8, 24), glow);
  ring.position.y = 2.05;
  ring.rotation.x = Math.PI / 2;
  group.add(ring);

  return { group, materials: [stone, glow], position: group.position.clone() };
}

/** Wispy multicolored fox — cream body + rainbow spirit tail (turnaround ref). */
/** Burnt-orange ember fox (autumn turnaround ref). Fully saturated — do not ColorField-patch. */
export function createFoxStandIn(): {
  group: THREE.Group;
  materials: THREE.MeshStandardMaterial[];
  tail: THREE.Mesh;
} {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0xd4682a,
    emissive: 0x882200,
    emissiveIntensity: 0.18,
    roughness: 0.55,
  });
  const creamMat = new THREE.MeshStandardMaterial({
    color: 0xf2e6d4,
    roughness: 0.6,
  });
  const pawMat = new THREE.MeshStandardMaterial({ color: 0x2a221c, roughness: 0.7 });
  const emberMat = new THREE.MeshStandardMaterial({
    color: 0xff8a30,
    emissive: 0xff5a1a,
    emissiveIntensity: 1.35,
    roughness: 0.25,
    transparent: true,
    opacity: 0.95,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xffc857,
    emissive: 0xffaa33,
    emissiveIntensity: 1.2,
    roughness: 0.3,
  });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.28, 18, 14), bodyMat);
  body.scale.set(1.0, 0.9, 1.35);
  body.position.y = 0.38;
  body.castShadow = true;
  group.add(body);

  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), creamMat);
  chest.scale.set(0.9, 1.1, 0.5);
  chest.position.set(0, 0.36, 0.28);
  group.add(chest);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 16, 14), bodyMat);
  head.position.set(0, 0.6, 0.3);
  head.castShadow = true;
  group.add(head);

  const snout = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), creamMat);
  snout.scale.set(0.8, 0.7, 1.2);
  snout.position.set(0, 0.55, 0.45);
  group.add(snout);

  for (const sx of [-1, 1] as const) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.18, 5), bodyMat);
    ear.position.set(0.1 * sx, 0.78, 0.24);
    ear.rotation.z = sx * 0.28;
    group.add(ear);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), goldMat);
    tip.position.set(0.1 * sx, 0.88, 0.22);
    group.add(tip);
  }

  // ember tail plume
  const tail = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10), emberMat);
  tail.scale.set(0.7, 0.7, 2.8);
  tail.position.set(0, 0.42, -0.58);
  group.add(tail);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), goldMat);
  tip.position.set(0, 0.45, -1.05);
  group.add(tip);

  for (const [px, pz] of [
    [-0.12, 0.16],
    [0.12, 0.16],
    [-0.12, -0.14],
    [0.12, -0.14],
  ] as const) {
    const paw = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), pawMat);
    paw.position.set(px, 0.07, pz);
    group.add(paw);
  }

  return { group, materials: [bodyMat, creamMat, pawMat, emberMat, goldMat], tail };
}
