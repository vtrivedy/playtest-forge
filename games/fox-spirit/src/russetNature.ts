import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rng, vnoise3 } from './russetKit';

/**
 * CC0 Quaternius Stylized Nature MegaKit pieces (assets/env/quaternius/nature.glb), restyled
 * for Russetvale: crowns get soft clump normals and interior shading so they light as a few
 * large painterly masses, leaves take a per-clump autumn hue, and sun-backlit foliage glows
 * warm. Placements are baked into world space and merged per material × 64 m cell.
 */
export type NatureVariant =
  | 'twisted_1' | 'twisted_2' | 'twisted_3' | 'twisted_4' | 'twisted_5'
  | 'tree_1' | 'tree_2' | 'tree_3' | 'tree_4' | 'tree_5'
  | 'dead_1' | 'dead_2'
  | 'bush_red' | 'bush_leafy' | 'fern' | 'grass_wispy';

export const TWISTED: NatureVariant[] = ['twisted_1', 'twisted_2', 'twisted_3', 'twisted_4', 'twisted_5'];
export const ROUND: NatureVariant[] = ['tree_1', 'tree_2', 'tree_3', 'tree_4', 'tree_5'];

type Part = {
  geo: THREE.BufferGeometry;
  mat: THREE.MeshStandardMaterial;
  /** foliage: per-vertex clump id + interior shade; bark/grass: null */
  clump: Uint16Array | null;
  shade: Float32Array | null;
  nClumps: number;
};

type Variant = { parts: Part[]; height: number; trunkR: number };

export type PlaceOpts = {
  yaw?: number;
  scale?: number;
  /** fraction of the crown opened into coherent gaps (0 = as authored) */
  gaps?: number;
  /** vertical squash (ground-hugging masses) */
  squash?: number;
  /** foliage base hue; per-clump jitter between `hue` and `hue2` */
  hue: THREE.Color;
  hue2?: THREE.Color;
  bark?: THREE.Color;
  /** drop foliage triangles inside these spheres (keeps route jumps clear) */
  avoid?: Array<{ x: number; y: number; z: number; r: number }>;
  cast?: boolean;
};

export type NatureKit = {
  height(v: NatureVariant): number;
  /** One tree whose foliage gets its own (unpatched) material + mesh; bark joins the shared cells. */
  standalone(v: NatureVariant, x: number, y: number, z: number, o: PlaceOpts & { name: string }): THREE.Mesh;
  trunkR(v: NatureVariant): number;
  /** leaf-triangle count of a placement that would fall inside `avoid` */
  blocked(v: NatureVariant, x: number, y: number, z: number, o: Pick<PlaceOpts, 'yaw' | 'scale' | 'avoid'>): number;
  place(v: NatureVariant, x: number, y: number, z: number, o: PlaceOpts): void;
  build(group: THREE.Group): THREE.MeshStandardMaterial[];
};

const CELL = 64;

/**
 * Foliage that reaches into the near camera plane (reeds, bush cards, low branches) dissolves
 * with an ordered dither instead of filling the screen with one flat blade.
 */
export function nearCameraFade(mat: THREE.Material, near = 0.7, far = 2.2): void {
  const prev = mat.onBeforeCompile;
  const prevKey = mat.customProgramCacheKey();
  mat.onBeforeCompile = (shader, renderer) => {
    prev.call(mat, shader, renderer);
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <clipping_planes_fragment>',
      `#include <clipping_planes_fragment>
      {
        vec2 ncP = mod(floor(gl_FragCoord.xy), 4.0);
        vec2 ncLo = mod(ncP, 2.0);
        vec2 ncHi = floor(ncP * 0.5);
        float ncB = (4.0 * mod(2.0 * ncLo.x + 3.0 * ncLo.y, 4.0) + mod(2.0 * ncHi.x + 3.0 * ncHi.y, 4.0) + 0.5) / 16.0;
        if (ncB > smoothstep(${near.toFixed(2)}, ${far.toFixed(2)}, vViewPosition.z)) discard;
      }`,
    );
  };
  mat.customProgramCacheKey = () => `${prevKey}|near-fade`;
  mat.needsUpdate = true;
}

/** Sun-backlit foliage: light through thin leaves facing away from the camera toward the sun. */
function foliageShader(mat: THREE.MeshStandardMaterial, o: { translucency: number; texMix: number }): void {
  mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <map_fragment>',
        `#ifdef USE_MAP
          vec4 nkTex = texture2D(map, vMapUv);
          float nkL = dot(nkTex.rgb, vec3(0.3, 0.5, 0.2));
          diffuseColor.rgb *= mix(1.0, clamp(nkL * 2.2, 0.6, 1.25), ${o.texMix.toFixed(2)});
          diffuseColor.a *= nkTex.a;
          // keep far crowns full: mip averaging thins alpha below the cutoff
          vec2 nkSz = vec2(textureSize(map, 0));
          vec2 nkDx = dFdx(vMapUv * nkSz);
          vec2 nkDy = dFdy(vMapUv * nkSz);
          diffuseColor.a *= 1.0 + max(0.0, 0.5 * log2(max(dot(nkDx, nkDx), dot(nkDy, nkDy)))) * 0.3;
        #endif`,
      )
      .replace(
        '#include <lights_fragment_end>',
        `#include <lights_fragment_end>
        #if NUM_DIR_LIGHTS > 0
          for (int nkI = 0; nkI < NUM_DIR_LIGHTS; nkI++) {
            float nkBack = pow(clamp(dot(-geometryViewDir, directionalLights[nkI].direction), 0.0, 1.0), 3.0);
            float nkWrap = clamp(dot(-geometryNormal, directionalLights[nkI].direction) * 0.5 + 0.5, 0.0, 1.0);
            reflectedLight.directDiffuse += directionalLights[nkI].color * diffuseColor.rgb * nkBack * nkWrap * ${o.translucency.toFixed(2)};
          }
        #endif`,
      );
  };
  mat.customProgramCacheKey = () => `russet-foliage-${o.translucency}-${o.texMix}`;
}

/** k-means clumps over the foliage vertices → soft normals + interior darkening. */
function softenFoliage(geo: THREE.BufferGeometry, k: number): { clump: Uint16Array; shade: Float32Array } {
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const n = pos.count;
  const r = rng(n * 31 + k);
  const box = new THREE.Box3().setFromBufferAttribute(pos);
  const centre = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const C: THREE.Vector3[] = [];
  for (let i = 0; i < k; i++) C.push(new THREE.Vector3().fromBufferAttribute(pos, Math.floor(r() * n)));
  const clump = new Uint16Array(n);
  const p = new THREE.Vector3();
  for (let it = 0; it < 8; it++) {
    const sum = C.map(() => new THREE.Vector4());
    for (let i = 0; i < n; i++) {
      p.fromBufferAttribute(pos, i);
      let best = 0;
      let bd = Infinity;
      for (let c = 0; c < k; c++) {
        const d = p.distanceToSquared(C[c]!);
        if (d < bd) {
          bd = d;
          best = c;
        }
      }
      clump[i] = best;
      sum[best]!.x += p.x;
      sum[best]!.y += p.y;
      sum[best]!.z += p.z;
      sum[best]!.w++;
    }
    for (let c = 0; c < k; c++) if (sum[c]!.w) C[c]!.set(sum[c]!.x, sum[c]!.y, sum[c]!.z).divideScalar(sum[c]!.w);
  }
  const rad = new Float32Array(k);
  for (let i = 0; i < n; i++) {
    p.fromBufferAttribute(pos, i);
    rad[clump[i]!] = Math.max(rad[clump[i]!]!, p.distanceTo(C[clump[i]!]!));
  }
  const nor = geo.getAttribute('normal') as THREE.BufferAttribute;
  const shade = new Float32Array(n);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < n; i++) {
    p.fromBufferAttribute(pos, i);
    const c = clump[i]!;
    a.copy(p).sub(C[c]!);
    const local = a.length() / Math.max(0.01, rad[c]!);
    a.normalize();
    b.copy(p).sub(centre).multiply(new THREE.Vector3(1, 1.4, 1)).normalize();
    a.multiplyScalar(0.65).addScaledVector(b, 0.35).addScaledVector(up, 0.2).normalize();
    nor.setXYZ(i, a.x, a.y, a.z);
    // interior + underside darker, outer sunlit shell lighter
    const h = THREE.MathUtils.clamp((p.y - box.min.y) / Math.max(0.01, size.y), 0, 1);
    shade[i] = THREE.MathUtils.lerp(0.3, 0.92, THREE.MathUtils.smoothstep(local, 0.15, 0.95)) * THREE.MathUtils.lerp(0.72, 1.08, h);
  }
  nor.needsUpdate = true;
  return { clump, shade };
}

export async function loadNatureKit(): Promise<NatureKit> {
  const gltf = await new GLTFLoader().loadAsync('/assets/env/quaternius/nature.glb');
  const foliageMat = (name: string, src: THREE.MeshStandardMaterial) => {
    const m = new THREE.MeshStandardMaterial({
      name,
      map: src.map,
      vertexColors: true,
      roughness: 0.82,
      metalness: 0,
      alphaTest: 0.42,
      side: THREE.DoubleSide,
    });
    foliageShader(m, { translucency: src.name === 'Leaves' || src.name === 'Grass' ? 0.3 : 0.5, texMix: src.name === 'Leaves' ? 0.6 : src.name === 'Grass' ? 0 : 0.3 });
    m.userData.src = src;
    nearCameraFade(m);
    return m;
  };
  // our materials, keyed by source material name
  const mats = new Map<string, THREE.MeshStandardMaterial>();
  const matFor = (src: THREE.MeshStandardMaterial): THREE.MeshStandardMaterial => {
    let m = mats.get(src.name);
    if (m) return m;
    const foliage = src.transparent || src.name.startsWith('Leaves') || src.name === 'Texture_Leaves' || src.name === 'Grass';
    if (src.name.startsWith('Bark')) {
      m = new THREE.MeshStandardMaterial({
        name: `rv-nature-${src.name}`,
        map: src.map,
        normalMap: src.normalMap,
        normalScale: new THREE.Vector2(0.9, 0.9),
        vertexColors: true,
        roughness: 0.92,
        metalness: 0,
      });
    } else if (foliage) {
      m = foliageMat(`rv-nature-${src.name}`, src);
    } else {
      throw new Error(`nature kit: unexpected material ${src.name}`);
    }
    m.userData.foliage = foliage;
    mats.set(src.name, m);
    return m;
  };

  const variants = new Map<string, Variant>();
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    // multi-material pieces load as a group of primitives under the piece's node
    const key = mesh.parent && mesh.parent !== gltf.scene ? mesh.parent.name : mesh.name;
    let v = variants.get(key);
    if (!v) {
      v = { parts: [], height: 0, trunkR: 0.4 };
      variants.set(key, v);
    }
    const geo = mesh.geometry.clone();
    geo.applyMatrix4(mesh.matrixWorld);
    for (const att of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(att)) geo.deleteAttribute(att);
    const mat = matFor(mesh.material as THREE.MeshStandardMaterial);
    let clump: Uint16Array | null = null;
    let shade: Float32Array | null = null;
    let nClumps = 1;
    if (mat.userData.foliage) {
      nClumps = THREE.MathUtils.clamp(Math.round(geo.getAttribute('position').count / 450), 2, 9);
      ({ clump, shade } = softenFoliage(geo, nClumps));
    }
    v.parts.push({ geo, mat, clump, shade, nClumps });
    geo.computeBoundingBox();
    v.height = Math.max(v.height, geo.boundingBox!.max.y);
    if (!mat.userData.foliage && mat.name.includes('Bark')) {
      // trunk radius from bark verts 0.5–1.5 m up
      const pos = geo.getAttribute('position');
      let rr = 0;
      let cnt = 0;
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i);
        if (y > 0.5 && y < 1.5) {
          rr += Math.hypot(pos.getX(i), pos.getZ(i));
          cnt++;
        }
      }
      if (cnt) v.trunkR = rr / cnt;
    }
  });

  const cells = new Map<string, { mat: THREE.MeshStandardMaterial; cast: boolean; geos: THREE.BufferGeometry[] }>();
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const Y = new THREE.Vector3(0, 1, 0);
  const tmp = new THREE.Vector3();
  const c = new THREE.Color();
  const matrixFor = (x: number, y: number, z: number, yaw = 0, s = 1, squash = 1) =>
    m4.compose(new THREE.Vector3(x, y, z), q.setFromAxisAngle(Y, yaw), new THREE.Vector3(s, s * squash, s));

  /**
   * Foliage triangles to keep: outside every avoid sphere and, when `gaps` > 0, outside coherent
   * noise holes (~`gaps` of the crown) so crowns layer into separate masses with sky and
   * branches showing through instead of one solid puff.
   */
  const keepTris = (geo: THREE.BufferGeometry, avoid: PlaceOpts['avoid'], gaps = 0, seed = 0, freq = 0.45): number[] | null => {
    const idx = geo.getIndex();
    const pos = geo.getAttribute('position');
    if (!idx || (!avoid?.length && gaps <= 0)) return null;
    const keep: number[] = [];
    for (let t = 0; t < idx.count; t += 3) {
      const a = idx.getX(t);
      const b = idx.getX(t + 1);
      const d = idx.getX(t + 2);
      tmp.set(
        (pos.getX(a) + pos.getX(b) + pos.getX(d)) / 3,
        (pos.getY(a) + pos.getY(b) + pos.getY(d)) / 3,
        (pos.getZ(a) + pos.getZ(b) + pos.getZ(d)) / 3,
      );
      if (gaps > 0 && vnoise3(tmp.x * freq + seed, tmp.y * freq * 1.3, tmp.z * freq - seed) < gaps) continue;
      if (!avoid?.some((s) => tmp.distanceTo(new THREE.Vector3(s.x, s.y, s.z)) < s.r)) keep.push(a, b, d);
    }
    return keep;
  };

  const kit: NatureKit = {
    height: (v) => variants.get(v)!.height,
    trunkR: (v) => variants.get(v)!.trunkR,
    blocked(v, x, y, z, o) {
      const M = matrixFor(x, y, z, o.yaw, o.scale);
      let n = 0;
      for (const part of variants.get(v)!.parts) {
        if (!part.mat.userData.foliage) continue;
        const g = part.geo.clone().applyMatrix4(M);
        const keep = keepTris(g, o.avoid);
        if (keep) n += (g.getIndex()!.count - keep.length) / 3;
        g.dispose();
      }
      return n;
    },
    standalone(v, x, y, z, o) {
      const V = variants.get(v)!;
      const before = new Map([...cells].map(([key, e]) => [key, e.geos.length]));
      kit.place(v, x, y, z, o);
      const geos: THREE.BufferGeometry[] = [];
      let src: THREE.MeshStandardMaterial | null = null;
      for (const [key, e] of cells) {
        if (!e.mat.userData.foliage) continue;
        const own = V.parts.some((p) => p.mat === e.mat);
        if (!own) continue;
        const start = before.get(key) ?? 0;
        if (e.geos.length <= start) continue;
        geos.push(...e.geos.splice(start));
        src = e.mat.userData.src as THREE.MeshStandardMaterial;
        if (!e.geos.length) cells.delete(key);
      }
      if (!geos.length || !src) throw new Error(`Standalone foliage missing for ${v}`);
      const mesh = new THREE.Mesh(mergeGeometries(geos, false), foliageMat(o.name, src));
      for (const g of geos) g.dispose();
      mesh.castShadow = o.cast ?? true;
      mesh.receiveShadow = true;
      mesh.userData.isOccluder = true;
      return mesh;
    },
    place(v, x, y, z, o) {
      const V = variants.get(v);
      if (!V) throw new Error(`nature kit: no variant ${v}`);
      const r = rng(Math.floor(x * 73 + z * 191 + y * 7) + 99991);
      const M = matrixFor(x, y, z, o.yaw, o.scale, o.squash);
      for (const part of V.parts) {
        const g = part.geo.clone().applyMatrix4(M);
        const n = g.getAttribute('position').count;
        const col = new Float32Array(n * 3);
        if (part.clump && part.shade) {
          const hues: THREE.Color[] = [];
          for (let k = 0; k < part.nClumps; k++) {
            const h = o.hue.clone().lerp(o.hue2 ?? o.hue, r());
            hues.push(h.offsetHSL((r() - 0.5) * 0.03, (r() - 0.5) * 0.08, (r() - 0.5) * 0.08));
          }
          for (let i = 0; i < n; i++) {
            c.copy(hues[part.clump[i]!]!).multiplyScalar(part.shade[i]!);
            col.set([c.r, c.g, c.b], i * 3);
          }
        } else {
          c.copy(o.bark ?? new THREE.Color(1, 1, 1));
          for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
        }
        g.setAttribute('color', new THREE.BufferAttribute(col, 3));
        if (part.mat.userData.foliage) {
          const keep = keepTris(g, o.avoid, o.gaps ?? 0, r() * 100, 0.45 / (o.scale ?? 1));
          if (keep) g.setIndex(keep);
        }
        const cast = o.cast ?? true;
        const key = `${part.mat.name}:${Math.floor(x / CELL)}:${Math.floor(z / CELL)}:${cast}`;
        let e = cells.get(key);
        if (!e) {
          e = { mat: part.mat, cast, geos: [] };
          cells.set(key, e);
        }
        e.geos.push(g);
      }
    },
    build(group) {
      for (const e of cells.values()) {
        if (!e.geos.length) continue;
        const g = mergeGeometries(e.geos, false);
        for (const s of e.geos) s.dispose();
        if (!g) continue;
        g.computeBoundingSphere();
        const mesh = new THREE.Mesh(g, e.mat);
        mesh.castShadow = e.cast;
        mesh.receiveShadow = true;
        mesh.name = e.mat.name;
        if (e.mat.userData.foliage) mesh.userData.isOccluder = true;
        group.add(mesh);
      }
      cells.clear();
      return [...mats.values()];
    },
  };
  return kit;
}
