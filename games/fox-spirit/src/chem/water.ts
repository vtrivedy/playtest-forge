import * as THREE from 'three';
import type GUI from 'lil-gui';
import { Reactor, type SupplyFn } from './reactor';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { boxCollider, type CollisionWorld } from '../collision';

export type WaterSpot = { id: string; lip: THREE.Vector3; foot: THREE.Vector3; path: THREE.Vector3[]; width: number; wash?: boolean; probes?: THREE.Vector3[]; channel?: boolean; gate?: boolean };
type Parcel = { head: number; tail: number; live: boolean };
export const waterSpots: WaterSpot[] = [{
  id: 'marsh-mouth', lip: new THREE.Vector3(57, 3.5, 36), foot: new THREE.Vector3(57, 0, 36),
  path: [new THREE.Vector3(57, 0, 36), new THREE.Vector3(62.034, 0, 32.736)], width: 2.2, wash: true,
}, {
  id: 'reed-falls', lip: new THREE.Vector3(100, 15, 18), foot: new THREE.Vector3(100, 10, 18), width: 1.8,
  probes: [new THREE.Vector3(100, 15, 18), new THREE.Vector3(100, 12.5, 18), new THREE.Vector3(100, 10, 18)],
  path: [[100, 6, 18], [104, 5.2, 22.7627], [94, 4, 23.7627], [92, 3.2, 17], [95, 2.3, 10]].map(p => new THREE.Vector3(p[0], p[1], p[2])),
}, {
  id: 'pond-grotto', lip: new THREE.Vector3(-30, 3, 62), foot: new THREE.Vector3(-30, 0, 62), width: 2.4, channel: false, gate: true,
  probes: [new THREE.Vector3(-30, 0.7, 62), new THREE.Vector3(-30, 2, 62)],
  path: [new THREE.Vector3(-30, -0.16, 62), new THREE.Vector3(-29, -0.18, 65), new THREE.Vector3(-25, -0.18, 68)],
}];

/** Advected slugs preserve both fronts: stopping supply never clears a whole flume instantly. */
export function createWater(scene: THREE.Scene, collision: CollisionWorld, gui?: GUI) {
  const tun = { speed: 8, threshold: 0.3, igniteTime: 0.6, holdTime: 3, gutterTime: 2 };
  const stone = new THREE.MeshStandardMaterial({ color: 0x75664d, roughness: 0.94 });
  const masonry: THREE.BufferGeometry[] = [];
  const block = (x: number, y: number, z: number, w: number, h: number, d: number, yaw = 0, solid = false) => {
    const g = new RoundedBoxGeometry(w, h, d, 2, Math.min(0.14, w * 0.12, h * 0.12, d * 0.12));
    const matrix = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(1, 1, 1));
    g.applyMatrix4(matrix); masonry.push(g);
    if (solid) collision.add(boxCollider({ x, z, w, d, yaw, top: y + h / 2, bottom: y - h / 2, tag: 'water-masonry' }));
  };
  // The source is a broken stone spout; the hanging sheet ends in still droplets.
  block(55.8, 1.25, 35.6, 1.5, 3.1, 1.4, 0.2, true);
  block(56.4, 3.05, 36, 2.1, 0.55, 1.4, 0, true);
  // Reed aqueduct: two piers, a reachable launch at y6, and the lip walk at y15.
  for (const x of [95, 105]) block(x, 6.4, 20, 1.2, 16.4, 1.2, 0, true);
  block(100, 14.65, 20, 11.2, 0.7, 3.8, 0, true);
  block(95, 5.65, 18, 5, 0.7, 4.2, 0, true);
  for (let i = 0; i < 10; i++) {
    const f = (i + 1) / 10, top = 2 + f * 4;
    block(91 + f * 3.5, (2 + top) / 2, 10 + f * 6.1, 2.4, top - 2 + 0.05, 0.8, 0, true);
  }
  // S1: a small roofed grotto behind the pond falls, with stable ground on both sides.
  for (const x of [-31.65, -28.35]) block(x, 1.35, 60.4, 0.75, 3.3, 4.8, 0, true);
  block(-30, 3.05, 60.4, 4.1, 0.6, 4.8, 0, true);
  block(-30, 1.35, 58.1, 4.1, 3.3, 0.75, 0, true);
  block(-30, -0.2, 60.5, 3.2, 0.45, 4.8, 0, true);
  const foamColor = new THREE.Color();
  const warningColor = new THREE.Color(0xb09b67);
  const waters = waterSpots.map(spot => {
    const reactor = new Reactor(spot.id, 'water', spot.probes ?? [spot.lip.clone(), spot.foot.clone().setY(0.6)], tun);
    const glass = new THREE.MeshPhysicalMaterial({ color: 0xc7c6af, roughness: 0.22, metalness: 0, transmission: 0, thickness: 0.3, transparent: true, opacity: 0.88, emissive: 0x775832, emissiveIntensity: 0.18, side: THREE.DoubleSide });
    const animation = { uWaterTime: { value: 0 }, uWaterFlow: { value: 0 } };
    glass.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, animation);
      shader.vertexShader = 'uniform float uWaterTime; uniform float uWaterFlow; varying vec2 vWaterP;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvWaterP = position.xy; transformed.z += sin(position.y * 3.4 - uWaterTime * 8.0) * 0.045 * uWaterFlow;');
      shader.fragmentShader = 'uniform float uWaterTime; uniform float uWaterFlow; varying vec2 vWaterP;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\nfloat streak = pow(max(0.0, sin(vWaterP.x * 22.0 + sin(vWaterP.y * 1.5 - uWaterTime * 7.0))), 10.0); diffuseColor.rgb += vec3(0.12, 0.115, 0.095) * streak * uWaterFlow;');
    };
    const gate = spot.gate ? collision.add(boxCollider({ x: spot.lip.x, z: spot.lip.z, w: spot.width, d: 0.2, top: spot.lip.y, bottom: spot.foot.y, tag: 'frozen-water' })) : null;
    const height = spot.lip.y - spot.foot.y;
    const fallGeo = new THREE.PlaneGeometry(spot.width * 0.8, height, 12, 24);
    const positions = fallGeo.attributes.position!;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i), y = positions.getY(i);
      positions.setXYZ(i, x * (1 + 0.12 * Math.sin(y * 2.4)), y, Math.sin(x * 8 + y * 0.6) * 0.13 + Math.sin(y * 3.1) * 0.06);
    }
    fallGeo.computeVertexNormals();
    const fall = new THREE.Mesh(fallGeo, glass);
    fall.position.copy(spot.lip).lerp(spot.foot, 0.5); fall.castShadow = true; scene.add(fall);
    const light = new THREE.PointLight(0xffb55e, 3, 7, 2); light.position.copy(fall.position); scene.add(light);
    const curve = new THREE.CatmullRomCurve3(spot.path, false, 'centripetal');
    const length = curve.getLength();
    const cells = Math.ceil(length / 0.25);
    const surfaceMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2, metalness: 0.04, transparent: true, opacity: 0.85, emissive: 0x263d36, emissiveIntensity: 0.12 });
    const surface = new THREE.InstancedMesh(new THREE.PlaneGeometry(spot.width * 0.94, length / cells + 0.03), surfaceMat, cells);
    const flowD = new THREE.InstancedBufferAttribute(new Float32Array(cells), 1);
    const wetState = new THREE.InstancedBufferAttribute(new Float32Array(cells), 1);
    wetState.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < cells; i++) flowD.setX(i, (i + 0.5) * length / cells);
    surface.geometry.setAttribute('aFlowD', flowD); surface.geometry.setAttribute('aWet', wetState);
    surfaceMat.onBeforeCompile = shader => {
      shader.uniforms.uWaterTime = animation.uWaterTime;
      shader.vertexShader = 'attribute float aFlowD; attribute float aWet; varying float vFlowD; varying float vWet; varying vec2 vWaterUV; uniform float uWaterTime;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\nvFlowD = aFlowD - (uv.y - 0.5) * ${(length / cells).toFixed(6)}; vWet = aWet; vWaterUV = uv;`);
      shader.fragmentShader = 'uniform float uWaterTime; varying float vFlowD; varying float vWet; varying vec2 vWaterUV;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
        float drift = vFlowD - uWaterTime * 8.0;
        float foam = pow(max(0.0, sin(drift * 2.2 + sin(vWaterUV.x * 11.0) * 0.6)), 14.0);
        float edgeFoam = pow(abs(vWaterUV.x - 0.5) * 2.0, 10.0) * (0.5 + 0.5 * sin(drift * 3.0));
        diffuseColor.rgb += vec3(0.23, 0.22, 0.17) * (foam * 0.65 + edgeFoam * 0.35) * vWet;
      `);
      shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
        vec3 ripple = vec3(sin(vFlowD * 3.4 - uWaterTime * 8.0) * 0.19, 0.0, sin(vWaterUV.x * 16.0 + vFlowD * 2.1 - uWaterTime * 6.0) * 0.14);
        normal = normalize(normal + (viewMatrix * vec4(ripple, 0.0)).xyz * vWet);
      `);
    };
    surface.instanceMatrix.setUsage(THREE.DynamicDrawUsage); surface.frustumCulled = false; scene.add(surface);
    const stamp = new THREE.Object3D();
    const samples = Array.from({ length: cells }, (_, i) => {
      const d = (i + 0.5) * length / cells;
      const p = curve.getPointAt(d / length), tangent = curve.getTangentAt(d / length);
      const yaw = Math.atan2(tangent.x, tangent.z);
      const bed = new THREE.Mesh(new THREE.BoxGeometry(spot.width, 0.2, length / cells + 0.03), stone);
      bed.position.copy(p).add(new THREE.Vector3(0, -0.16, 0)); bed.rotation.y = yaw; bed.receiveShadow = true;
      if (spot.wash) scene.add(bed);
      else if (spot.channel !== false) { bed.updateMatrix(); masonry.push(bed.geometry.clone().applyMatrix4(bed.matrix)); }
      stamp.position.copy(p); stamp.rotation.set(-Math.PI / 2, 0, yaw); stamp.scale.setScalar(0); stamp.updateMatrix(); surface.setMatrixAt(i, stamp.matrix);
      const collider = boxCollider({ x: p.x, z: p.z, w: spot.width, d: length / cells + 0.04, yaw, top: p.y - 0.05, bottom: p.y - 0.4, tag: 'water-washed' });
      collider.enabled = true;
      if (i % 4 === 0 && spot.channel !== false) {
        const mid = curve.getPointAt(Math.min(1, (d + length / cells * 1.5) / length));
        collider.x = mid.x; collider.z = mid.z; collider.hz *= 4; collider.top0 = collider.top1 = mid.y - 0.05;
        collision.add(collider);
      }
      bed.visible = !spot.wash;
      if (!spot.wash && spot.channel !== false) {
        for (const side of [-1, 1]) block(p.x + Math.cos(yaw) * side * spot.width * 0.53, p.y + 0.1, p.z - Math.sin(yaw) * side * spot.width * 0.53, 0.2, 0.48, length / cells + 0.03, yaw);
        if (i % 16 === 0) block(p.x, (p.y - 2) / 2, p.z, 0.7, p.y + 2, 0.8, yaw);
      }
      return { d, p, bed, yaw, index: i, collider, wet: false };
    });
    return { spot, reactor, gate, fall, animation, glass, light, length, surface, wetState, stamp, samples, parcels: [] as Parcel[], flowing: false, arriving: false };
  });
  const masonryMesh = new THREE.Mesh(mergeGeometries(masonry.map(g => g.index ? g.toNonIndexed() : g)), stone); masonryMesh.castShadow = true; masonryMesh.receiveShadow = true; scene.add(masonryMesh);
  masonry.forEach(g => g.dispose());
  if (gui) { const f = gui.addFolder('Water'); f.add(tun, 'threshold', 0.05, 0.9, 0.05); f.add(tun, 'speed', 2, 16, 0.5); f.add(tun, 'igniteTime', 0.1, 2, 0.05); f.add(tun, 'holdTime', 0, 10, 0.1); f.add(tun, 'gutterTime', 0.2, 5, 0.1); f.close(); }
  function crossingAt(x: number, z: number): boolean | null {
    for (const w of waters) {
      if (!w.spot.wash) continue;
      let nearest = w.samples[0]!, distance = Infinity;
      for (const s of w.samples) {
        const d = (s.p.x - x) ** 2 + (s.p.z - z) ** 2;
        if (d < distance) { distance = d; nearest = s; }
      }
      if (distance < (w.spot.width * 0.48) ** 2) return nearest.wet;
    }
    return null;
  }
  return {
    tun, waters,
    arriving(id: string) { return waters.some(w => w.spot.id === id && w.arriving); },
    restoreAll() { for (const w of waters) w.reactor.restored = true; },
    restoreWithin(pos: THREE.Vector3, radius: number) { for (const w of waters) if (Math.hypot(w.spot.lip.x - pos.x, w.spot.lip.z - pos.z) <= radius) w.reactor.restored = true; },
    update(dt: number, time: number, supply: SupplyFn, drainedAt?: (p: THREE.Vector3) => boolean) {
      for (const w of waters) {
        w.reactor.update(dt, supply, drainedAt);
        const flowing = w.reactor.heat >= 1 - 1e-6 && w.reactor.state !== 'guttering' && w.reactor.state !== 'cold';
        if (flowing && !w.flowing) w.parcels.push({ head: 0, tail: 0, live: true });
        if (!flowing && w.flowing) for (const p of w.parcels) p.live = false;
        w.flowing = flowing;
        if (w.gate) w.gate.enabled = !flowing;
        const warning = w.reactor.state === 'holding' ? THREE.MathUtils.clamp(1 - w.reactor.holdLeft / 0.8, 0, 1) : 0;
        const travel = tun.speed * dt;
        for (const p of w.parcels) { p.head += travel; if (!p.live) p.tail += travel; }
        // A Shade cuts a moving slug, leaving the water already downstream to run out.
        // New water cannot cross the cut. Releasing the drain starts a fresh front there.
        if (!w.reactor.restored && drainedAt) for (const s of w.samples) {
          if (!drainedAt(s.p)) continue;
          for (const p of [...w.parcels]) if (p.tail <= s.d && p.head > s.d) {
            if (p.head - s.d > travel + 1e-6) w.parcels.push({ head: p.head, tail: s.d + travel, live: false });
            p.head = s.d;
          }
        }
        w.parcels = w.parcels.filter(p => p.tail < w.length + 1 && p.tail <= p.head);
        for (const s of w.samples) {
          s.wet = w.parcels.some(p => s.d <= p.head && s.d >= p.tail);
          s.bed.visible = !w.spot.wash || s.wet; s.collider.enabled = true;
          w.stamp.position.copy(s.p); w.stamp.position.y += 0.06 + Math.sin(s.d * 3 - time * 7) * 0.018;
          w.stamp.rotation.set(-Math.PI / 2, 0, s.yaw); w.stamp.scale.setScalar(s.wet || w.spot.wash ? 1 : 0); w.stamp.updateMatrix();
          w.surface.setMatrixAt(s.index, w.stamp.matrix);
          w.wetState.setX(s.index, s.wet ? 1 : 0);
          if (s.wet) { foamColor.setRGB(0.12, 0.20, 0.16); foamColor.lerp(warningColor, warning * 0.55); }
          else foamColor.set(0x261f18);
          w.surface.setColorAt(s.index, foamColor);
        }
        w.surface.instanceMatrix.needsUpdate = true;
        w.wetState.needsUpdate = true;
        if (w.surface.instanceColor) w.surface.instanceColor.needsUpdate = true;
        w.arriving = w.parcels.some(p => p.head >= w.length && p.tail < w.length);
        w.animation.uWaterTime.value = time; w.animation.uWaterFlow.value = flowing ? 1 : 0;
        w.glass.color.set(0xc7c6af).lerp(foamColor.set(0x81988a), w.reactor.heat);
        w.glass.roughness = flowing ? 0.18 : 0.25;
        w.glass.opacity = 0.88 - 0.36 * w.reactor.heat;
        w.glass.emissiveIntensity = 0.12 + w.reactor.heat * 0.18 + warning * (0.12 + Math.sin(time * 12) * 0.07);
        w.light.intensity = 2 + w.reactor.heat * 3;
        const fallBottom = flowing ? w.spot.path[0]!.y : w.spot.foot.y;
        w.fall.scale.y = (w.spot.lip.y - fallBottom) / (w.spot.lip.y - w.spot.foot.y);
        w.fall.position.y = (w.spot.lip.y + fallBottom) / 2;
        w.fall.scale.x = 1 + (flowing ? Math.sin(time * 9) * 0.035 : 0);
      }
    },
    inkAt(x: number, z: number) { return crossingAt(x, z) === false; },
    washedAt(x: number, z: number) { return crossingAt(x, z) === true; },
    state() { return waters.map(w => ({ id: w.spot.id, state: w.reactor.state, heat: w.reactor.heat, flowing: w.flowing, arriving: w.arriving, length: w.length, wetMeters: w.samples.filter(s => s.wet).length * w.length / w.samples.length, fronts: w.parcels.map(p => ({ head: p.head, tail: p.tail })) })); },
  };
}
