/** Canopy spring playground. Controller owns physics; this module owns top-contact intent. */
import * as THREE from 'three';
import { toon, inked } from '../lookdevKit';
import type { OpeningCtx } from './scene';
import { CANOPY } from './layout';

export const CANOPY_FEEL = { launchSpeed: 8.66, loadTime: 0.12, bow: 0.19 };

export function buildCanopy(ctx: OpeningCtx) {
  const leaves = CANOPY.map((a) => {
    const top = ctx.groundH(a.x, a.z) + a.rise;
    ctx.colliders.push({ kind: 'box', x: a.x, z: a.z, yaw: 0, hx: 0.94, hz: 0.85, top, oneWay: true });
    const root = new THREE.Group();
    root.name = `canopy-${a.id}`;
    root.position.set(a.x, top, a.z);
    ctx.scene.add(root);
    const shape = new THREE.Shape();
    const outline = [[0,-1.4],[-.28,-.8],[-.85,-1.02],[-.72,-.42],[-1.4,-.28],[-1.03,.12],[-1.23,.69],[-.58,.53],[-.5,1.05],[-.22,.84],[0,1.48],[.22,.84],[.5,1.05],[.58,.53],[1.23,.69],[1.03,.12],[1.4,-.28],[.72,-.42],[.85,-1.02],[.28,-.8]];
    // Broad, rounded shoulders keep the maple silhouette from reading as a star.
    const rounding = 0.23;
    for (let i = 0; i < outline.length; i++) {
      const previous = outline[(i + outline.length - 1) % outline.length]!;
      const current = outline[i]!, next = outline[(i + 1) % outline.length]!;
      const beforeX = current[0]! + (previous[0]! - current[0]!) * rounding;
      const beforeZ = current[1]! + (previous[1]! - current[1]!) * rounding;
      if (i === 0) shape.moveTo(beforeX, beforeZ);
      else shape.lineTo(beforeX, beforeZ);
      shape.quadraticCurveTo(current[0]!, current[1]!, current[0]! + (next[0]! - current[0]!) * rounding, current[1]! + (next[1]! - current[1]!) * rounding);
    }
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.065, bevelEnabled: true, bevelSize: 0.045, bevelThickness: 0.025, bevelSegments: 1, steps: 1, curveSegments: 14 });
    geo.rotateX(-Math.PI / 2);
    const points = geo.getAttribute('position');
    for (let j = 0; j < points.count; j++) {
      const x = points.getX(j), z = points.getZ(j);
      const curl = Math.pow(Math.max(0, Math.abs(x) - 0.55), 2) * 0.95 + Math.pow(Math.max(0, Math.abs(z) - 0.95), 2) * 0.6;
      points.setY(j, points.getY(j) - 0.09 + curl - Math.pow(Math.max(0, z - 0.65), 2) * 0.42);
    }
    geo.computeVertexNormals();
    const material = new THREE.MeshToonMaterial({ color: 0xc6bda4 });
    const blade = inked(geo, material, 0.009, true);
    blade.castShadow = blade.receiveShadow = true;
    root.add(blade);
    // Raised dark veins remain legible above the curled paper blade.
    const veins = new THREE.Group();
    const veinMat = new THREE.MeshToonMaterial({ color: 0x51442e });
    const line = (from: THREE.Vector3, to: THREE.Vector3, radius: number) => {
      const d = to.clone().sub(from);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.15, radius, d.length(), 5), veinMat);
      m.position.copy(from).addScaledVector(d, 0.5);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
      veins.add(m);
    };
    line(new THREE.Vector3(0, 0.12, -1.18), new THREE.Vector3(0, 0.12, 1.25), 0.035);
    for (const z of [-0.65, -0.15, 0.35, 0.75]) for (const side of [-1, 1]) {
      line(new THREE.Vector3(0, 0.12, z - 0.22), new THREE.Vector3(side * (0.95 - Math.abs(z) * 0.42), 0.12, z + 0.15), 0.009);
    }
    root.add(veins);
    // Fade blade, ink and veins together when a leaf masks the chase-camera fox.
    ctx.occluders.push(root);
    const stemMat = toon(0x675c3b);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(a.x + 0.75, ctx.groundH(a.x + 0.75, a.z - 1), a.z - 1),
      new THREE.Vector3(a.x + 0.5, top - a.rise * 0.45, a.z - 0.6),
      new THREE.Vector3(a.x, top - 0.06, a.z),
    ]);
    const stem = inked(new THREE.TubeGeometry(curve, 16, 0.24, 8, false), stemMat, 0.012, true);
    stem.castShadow = true;
    ctx.scene.add(stem);
    return { ...a, top, root, blade, veins, material, touched: false, contact: false, latched: false, dwell: 0, compression: 0, pulse: 0, lensScale: 1 };
  });
  let launches = 0, contacts = 0, retries = 0, roostVisits = 0;
  let lastLeaf: string | null = null;
  let flight: { id: string; y: number; apex: number; time: number; apexTime: number } | null = null;
  let lastFlight: Record<string, unknown> | null = null;
  let onRoute = false;
  const contact = (at: THREE.Vector3, _arrival: number, held: boolean, dt: number): number | null => {
    const leaf = leaves.find(l => Math.abs(at.x - l.x) < 0.94 && Math.abs(at.z - l.z) < 0.85 && Math.abs(at.y - l.top) < 0.06);
    if (!leaf) return null;
    if (!leaf.contact) {
      if (flight) {
        lastFlight = { from: flight.id, to: leaf.id, apexGain: +(flight.apex - flight.y).toFixed(3), timeToApex: +flight.apexTime.toFixed(3), airTime: +flight.time.toFixed(3) };
        flight = null;
      }
      contacts++;
      leaf.touched = true;
      leaf.material.color.setHex(0xdca34f);
      leaf.contact = true;
      leaf.pulse = 0.12;
      lastLeaf = leaf.id;
      onRoute = true;
      if (leaf.id === 'roost') roostVisits++;
    }
    if (leaf.id === 'roost' || leaf.latched) return null;
    leaf.dwell = held ? leaf.dwell + dt : 0;
    if (leaf.dwell < CANOPY_FEEL.loadTime) return null;
    leaf.latched = true;
    leaf.pulse = 1;
    launches++;
    flight = { id: leaf.id, y: at.y, apex: at.y, time: 0, apexTime: 0 };
    return CANOPY_FEEL.launchSpeed;
  };
  ctx.onUpdate((dt) => {
    const state = ctx.player?.state() as { grounded: boolean } | undefined;
    const p = ctx.fox.root.position;
    const lens = ctx.player?.cam.camera.position;
    for (const leaf of leaves) {
      // A blade can sit over the lens without crossing the fox sight rays.
      // Tuck only its visual width near the lens; top support never changes.
      const lensNear = lens && Math.hypot(lens.x - leaf.x, lens.z - leaf.z) < 1.75 && Math.abs(lens.y - leaf.top) < 0.65;
      leaf.lensScale = THREE.MathUtils.damp(leaf.lensScale, lensNear ? 0.12 : 1, lensNear ? 18 : 8, dt);
      leaf.root.scale.set(leaf.lensScale, 1, leaf.lensScale);
      const near = Math.abs(p.x - leaf.x) < 1.05 && Math.abs(p.z - leaf.z) < 0.96 && Math.abs(p.y - leaf.top) < 0.22;
      if (!near) { leaf.contact = false; leaf.latched = false; leaf.dwell = 0; }
      const loading = leaf.dwell > 0 && !leaf.latched ? Math.min(1, leaf.dwell / CANOPY_FEEL.loadTime) : 0;
      leaf.pulse = Math.max(0, leaf.pulse - dt * 3.5);
      const target = -CANOPY_FEEL.bow * loading + Math.sin(leaf.pulse * Math.PI * 2) * 0.075 * leaf.pulse;
      leaf.compression = THREE.MathUtils.damp(leaf.compression, target, 24, dt);
      leaf.blade.position.y = leaf.veins.position.y = leaf.compression;
      leaf.blade.rotation.z = leaf.veins.rotation.z = leaf.compression * 0.16;
    }
    if (flight) {
      flight.time += dt;
      if (p.y > flight.apex) { flight.apex = p.y; flight.apexTime = flight.time; }
      if (state?.grounded) {
        lastFlight = { from: flight.id, to: 'ground', apexGain: +(flight.apex - flight.y).toFixed(3), timeToApex: +flight.apexTime.toFixed(3), airTime: +flight.time.toFixed(3) };
        flight = null;
      }
    }
    if (onRoute && state?.grounded && p.y < ctx.groundH(p.x, p.z) + 0.2) { retries++; onRoute = false; }
  });
  if (new URLSearchParams(location.search).has('gui')) void import('lil-gui').then(({ default: GUI }) => {
    const gui = new GUI({ title: 'Canopy feel' });
    gui.add(CANOPY_FEEL, 'launchSpeed', 6, 12, 0.05);
    gui.add(CANOPY_FEEL, 'loadTime', 0, 0.25, 0.01);
    gui.add(CANOPY_FEEL, 'bow', 0.05, 0.3, 0.01);
    gui.close();
  });
  return { contact, feel: CANOPY_FEEL, state: () => ({ launches, contacts, retries, roostVisits, lastLeaf, lastFlight, activeFlight: flight, lensTucked: leaves.filter(l => l.lensScale < 0.95).length, profile: { ...CANOPY_FEEL }, leaves: leaves.map(({ id, x, z, top, touched }) => ({ id, x, z, top, touched })) }) };
}
