import * as THREE from 'three';
import type GUI from 'lil-gui';
import { Reactor, type SupplyFn } from './reactor';
import { boxCollider, type CollisionWorld } from '../collision';

export type WaterSpot = { id: string; lip: THREE.Vector3; foot: THREE.Vector3; path: THREE.Vector3[]; width: number; wash?: boolean };
type Parcel = { head: number; tail: number; live: boolean };
export const waterSpots: WaterSpot[] = [{
  id: 'marsh-mouth', lip: new THREE.Vector3(57, 3.5, 36), foot: new THREE.Vector3(57, -1.3, 36),
  path: [new THREE.Vector3(57, -1.3, 36), new THREE.Vector3(63, -1.3, 32)], width: 2.2, wash: true,
}];

/** Advected slugs preserve both fronts: stopping supply never clears a whole flume instantly. */
export function createWater(scene: THREE.Scene, collision: CollisionWorld, gui?: GUI) {
  const tun = { speed: 8, threshold: 0.3, igniteTime: 0.6, holdTime: 3, gutterTime: 2 };
  const stone = new THREE.MeshStandardMaterial({ color: 0x75664d, roughness: 0.94 });
  const waters = waterSpots.map(spot => {
    const reactor = new Reactor(spot.id, 'water', [spot.lip.clone(), spot.foot.clone().setY(0.6)], tun);
    const glass = new THREE.MeshPhysicalMaterial({ color: 0xb17b39, roughness: 0.22, metalness: 0, transmission: 0.25, thickness: 1.3, transparent: true, opacity: 0.88, emissive: 0x8f4818, emissiveIntensity: 0.18 });
    const height = spot.lip.y - spot.foot.y;
    const fall = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.95, height, 11, 12, true), glass);
    fall.position.copy(spot.lip).lerp(spot.foot, 0.5); fall.castShadow = true; scene.add(fall);
    const light = new THREE.PointLight(0xffb55e, 3, 7, 2); light.position.copy(fall.position); scene.add(light);
    const curve = new THREE.CatmullRomCurve3(spot.path, false, 'centripetal');
    const length = curve.getLength();
    const cells = Math.ceil(length / 0.25);
    const samples = Array.from({ length: cells }, (_, i) => {
      const d = (i + 0.5) * length / cells;
      const p = curve.getPointAt(d / length), tangent = curve.getTangentAt(d / length);
      const yaw = Math.atan2(tangent.x, tangent.z);
      const bed = new THREE.Mesh(new THREE.BoxGeometry(spot.width, 0.2, length / cells + 0.03), stone);
      bed.position.copy(p).add(new THREE.Vector3(0, -0.16, 0)); bed.rotation.y = yaw; bed.receiveShadow = true; scene.add(bed);
      const mat = new THREE.MeshStandardMaterial({ color: 0x879c91, roughness: 0.28, metalness: 0.08, transparent: true, opacity: 0.85, emissive: 0x263d36, emissiveIntensity: 0.12 });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(spot.width * 0.94, length / cells + 0.03), mat);
      mesh.rotation.set(-Math.PI / 2, 0, -yaw); mesh.position.copy(p).add(new THREE.Vector3(0, 0.06, 0)); mesh.visible = false; scene.add(mesh);
      const collider = boxCollider({ x: p.x, z: p.z, w: spot.width, d: length / cells + 0.04, yaw, top: p.y - 0.05, bottom: p.y - 0.4, tag: 'water-washed' });
      collider.enabled = false; if (spot.wash) collision.add(collider);
      return { d, p, mesh, mat, collider, wet: false };
    });
    return { spot, reactor, fall, glass, light, length, samples, parcels: [] as Parcel[], flowing: false, arriving: false };
  });
  if (gui) { const f = gui.addFolder('Water'); f.add(tun, 'speed', 2, 16, 0.5); f.add(tun, 'igniteTime', 0.1, 2, 0.05); f.add(tun, 'holdTime', 0, 10, 0.1); f.add(tun, 'gutterTime', 0.2, 5, 0.1); f.close(); }
  return {
    tun, waters,
    update(dt: number, time: number, supply: SupplyFn, drainedAt?: (p: THREE.Vector3) => boolean) {
      for (const w of waters) {
        w.reactor.update(dt, supply, drainedAt);
        const flowing = w.reactor.heat >= 1 - 1e-6 && w.reactor.state !== 'guttering' && w.reactor.state !== 'cold';
        if (flowing && !w.flowing) w.parcels.push({ head: 0, tail: 0, live: true });
        if (!flowing && w.flowing) { const p = w.parcels.at(-1); if (p) p.live = false; }
        w.flowing = flowing;
        for (const p of w.parcels) { p.head += tun.speed * dt; if (!p.live) p.tail += tun.speed * dt; }
        w.parcels = w.parcels.filter(p => p.tail < w.length + 1);
        let blocked = Infinity;
        for (const s of w.samples) if (drainedAt?.(s.p)) { blocked = s.d; break; }
        for (const s of w.samples) {
          s.wet = s.d < blocked && w.parcels.some(p => s.d <= p.head && s.d >= p.tail);
          s.mesh.visible = s.wet; s.collider.enabled = s.wet;
          s.mesh.position.y = s.p.y + 0.06 + Math.sin(s.d * 3 - time * 7) * 0.018;
          const foam = Math.pow(Math.max(0, Math.sin(s.d * 4 - time * 9)), 12);
          s.mat.color.setRGB(0.34 + foam * 0.18, 0.43 + foam * 0.17, 0.38 + foam * 0.15);
        }
        w.arriving = blocked > w.length && w.parcels.some(p => p.head >= w.length && p.tail < w.length);
        w.glass.color.set(flowing ? 0x81988a : 0xb17b39);
        w.glass.roughness = flowing ? 0.18 : 0.25;
        w.glass.opacity = flowing ? 0.52 : 0.88;
        w.glass.emissiveIntensity = 0.12 + w.reactor.heat * 0.28;
        w.light.intensity = 2 + w.reactor.heat * 3;
        w.fall.scale.x = 1 + (flowing ? Math.sin(time * 9) * 0.035 : 0);
      }
    },
    washedAt(x: number, z: number) { return waters.some(w => w.spot.wash && w.samples.some(s => s.wet && Math.hypot(s.p.x - x, s.p.z - z) < w.spot.width * 0.48)); },
    state() { return waters.map(w => ({ id: w.spot.id, state: w.reactor.state, heat: w.reactor.heat, flowing: w.flowing, arriving: w.arriving, length: w.length, wetMeters: w.samples.filter(s => s.wet).length * w.length / w.samples.length, fronts: w.parcels.map(p => ({ head: p.head, tail: p.tail })) })); },
  };
}
