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
  const cGrass = new THREE.Color(0x3ecf7a);
  const cDirt = new THREE.Color(0x7a6848);
  const cRock = new THREE.Color(0x5c626a);
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = islandHeight(x, z, radius);
    pos.setY(i, y);
    const r = Math.hypot(x, z) / radius;
    if (y < 0.18) tmp.copy(cRock);
    else if (r > 0.8) tmp.copy(cDirt);
    else tmp.copy(cGrass);
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
    new THREE.MeshStandardMaterial({ color: 0x454950, roughness: 0.94, flatShading: true }),
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
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x6a7078, roughness: 0.92, flatShading: true });
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
  const ruinMat = new THREE.MeshStandardMaterial({ color: 0x7a8088, roughness: 0.9, flatShading: true });
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
    const tree = createStylizedTree(0x2f9a52, 0x5a4030);
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

  // distant satellite islands (silhouette like key art)
  const satMat = new THREE.MeshStandardMaterial({ color: 0x5a6068, roughness: 0.95, flatShading: true });
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

  const stone = new THREE.MeshStandardMaterial({ color: 0x8a9098, roughness: 0.82, metalness: 0.05 });
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
export function createFoxStandIn(): {
  group: THREE.Group;
  materials: THREE.MeshStandardMaterial[];
  tail: THREE.Mesh;
} {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0xfff4e8,
    emissive: 0xffd0e8,
    emissiveIntensity: 0.08,
    roughness: 0.55,
  });
  const pawMat = new THREE.MeshStandardMaterial({ color: 0xd4b896, roughness: 0.7 });
  const spiritMat = new THREE.MeshStandardMaterial({
    color: 0xff66cc,
    emissive: 0xaa44ff,
    emissiveIntensity: 1.1,
    roughness: 0.25,
    transparent: true,
    opacity: 0.92,
  });
  const emblemMat = new THREE.MeshStandardMaterial({
    color: 0xffd56a,
    emissive: 0xffaa33,
    emissiveIntensity: 1.4,
    roughness: 0.35,
  });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.28, 18, 14), bodyMat);
  body.scale.set(1.05, 0.95, 1.25);
  body.position.y = 0.38;
  body.castShadow = true;
  group.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 14), bodyMat);
  head.position.set(0, 0.62, 0.26);
  head.castShadow = true;
  group.add(head);

  for (const sx of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.2, 5), bodyMat);
    ear.position.set(0.11 * sx, 0.82, 0.2);
    ear.rotation.z = sx * 0.28;
    group.add(ear);
    const inner = new THREE.Mesh(
      new THREE.ConeGeometry(0.04, 0.12, 4),
      new THREE.MeshStandardMaterial({ color: 0x3a3038, roughness: 0.6 }),
    );
    inner.position.set(0.11 * sx, 0.78, 0.22);
    inner.rotation.z = sx * 0.28;
    group.add(inner);
  }

  // spirit flame tuft
  const tuft = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), spiritMat);
  tuft.scale.set(0.7, 1.4, 0.7);
  tuft.position.set(0, 0.92, 0.18);
  group.add(tuft);

  // chest emblem
  const emblem = new THREE.Mesh(new THREE.CircleGeometry(0.07, 8), emblemMat);
  emblem.position.set(0, 0.42, 0.34);
  group.add(emblem);

  // rainbow wispy tail — elongated emissive blob (particles handle the rest)
  const tail = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), spiritMat);
  tail.scale.set(0.65, 0.65, 2.6);
  tail.position.set(0, 0.42, -0.55);
  group.add(tail);

  // simple paws
  for (const [px, pz] of [
    [-0.12, 0.16],
    [0.12, 0.16],
    [-0.12, -0.14],
    [0.12, -0.14],
  ] as const) {
    const paw = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), pawMat);
    paw.position.set(px, 0.08, pz);
    group.add(paw);
  }

  return { group, materials: [bodyMat, pawMat, spiritMat, emblemMat], tail };
}
