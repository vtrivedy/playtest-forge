/**
 * Static scenery baking: collapse a built prop (a maple is ~30 meshes) into one mesh per material,
 * so a much bigger world keeps its draw calls. Bake only what never moves or fades per part.
 * Materials merge when they would render identically (same shader key, colour, paint params).
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

function materialKey(m: THREE.Material): string {
  // ink hulls share one cached material per width; anything else unknown stays separate
  if (!(m instanceof THREE.MeshToonMaterial)) return m.uuid;
  const lk = m.userData.lk as string | undefined;
  if (lk === undefined) return m.uuid;
  return ['toon', m.customProgramCacheKey(), m.color.getHexString(), m.vertexColors, m.side, m.gradientMap?.uuid ?? '', m.transparent, lk].join('|');
}

/** world-space geometry with only position / normal (/ colour), non-indexed so any two merge */
function prepared(mesh: THREE.Mesh, toRoot: THREE.Matrix4, colours: boolean): THREE.BufferGeometry {
  const src = mesh.geometry;
  const g = (src.index ? src.toNonIndexed() : src.clone()) as THREE.BufferGeometry;
  if (!g.getAttribute('normal')) g.computeVertexNormals();
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && !(colours && k === 'color')) g.deleteAttribute(k);
  if (colours && !g.getAttribute('color')) {
    const n = g.getAttribute('position').count;
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
  }
  g.applyMatrix4(toRoot);
  return g;
}

/**
 * Bake every static mesh under each root into shared buckets: one Mesh per material (and one
 * InstancedMesh per instanced material). Returns the baked group in world space; roots are dropped.
 */
export function bakeStatic(roots: THREE.Object3D[], name = 'baked', thin = 1): THREE.Group {
  const out = new THREE.Group();
  out.name = name;
  const meshes = new Map<string, { material: THREE.Material; cast: boolean; receive: boolean; ink: boolean; geos: THREE.BufferGeometry[] }>();
  const instanced = new Map<string, { src: THREE.InstancedMesh; matrices: THREE.Matrix4[]; colours: THREE.Color[] }>();
  const m4 = new THREE.Matrix4();
  for (const root of roots) {
    root.updateMatrixWorld(true);
    root.traverse((o) => {
      if ((o as THREE.InstancedMesh).isInstancedMesh) {
        const im = o as THREE.InstancedMesh;
        const key = `${materialKey(im.material as THREE.Material)}|${im.geometry.uuid}|${im.castShadow}`;
        const b = instanced.get(key) ?? { src: im, matrices: [], colours: [] };
        // `thin` keeps every n-th instance (far scenery: leaf cards that only break a distant contour)
        for (let i = 0; i < im.count; i += thin) {
          im.getMatrixAt(i, m4);
          b.matrices.push(m4.clone().premultiply(im.matrixWorld));
          const c = new THREE.Color(1, 1, 1);
          if (im.instanceColor) im.getColorAt(i, c);
          b.colours.push(c);
        }
        instanced.set(key, b);
        return;
      }
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || Array.isArray(mesh.material)) return;
      const material = mesh.material as THREE.Material;
      const key = `${materialKey(material)}|${mesh.castShadow}|${mesh.receiveShadow}`;
      const b = meshes.get(key) ?? { material, cast: mesh.castShadow, receive: mesh.receiveShadow, ink: !!mesh.userData.ink, geos: [] };
      b.geos.push(prepared(mesh, mesh.matrixWorld, !!(material as THREE.MeshToonMaterial).vertexColors));
      meshes.set(key, b);
    });
  }
  for (const b of meshes.values()) {
    const merged = mergeGeometries(b.geos);
    if (!merged) continue;
    merged.computeBoundingSphere();
    const m = new THREE.Mesh(merged, b.material);
    m.castShadow = b.cast;
    m.receiveShadow = b.receive;
    m.userData.ink = b.ink;
    out.add(m);
  }
  for (const b of instanced.values()) {
    const im = new THREE.InstancedMesh(b.src.geometry, b.src.material, b.matrices.length);
    b.matrices.forEach((mx, i) => {
      im.setMatrixAt(i, mx);
      im.setColorAt(i, b.colours[i]!);
    });
    im.castShadow = b.src.castShadow;
    im.receiveShadow = b.src.receiveShadow;
    im.computeBoundingSphere();
    out.add(im);
  }
  return out;
}

/** Bake roots in square cells of `cell` metres (keeps frustum culling working over a big area) */
export function bakeCells(roots: THREE.Object3D[], cell: number, name = 'baked', thin = 1): THREE.Group[] {
  const cells = new Map<string, THREE.Object3D[]>();
  const p = new THREE.Vector3();
  for (const r of roots) {
    r.updateMatrixWorld(true);
    r.getWorldPosition(p);
    const key = `${Math.floor(p.x / cell)},${Math.floor(p.z / cell)}`;
    const list = cells.get(key) ?? [];
    list.push(r);
    cells.set(key, list);
  }
  return [...cells.entries()].map(([k, list]) => bakeStatic(list, `${name}:${k}`, thin));
}
