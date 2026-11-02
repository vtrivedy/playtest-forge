/**
 * Bellows → kiln → warm air → Weir Stones (DESIGN-millbrook.md, tla/Millrace.tla `Kiln`): while the wheel
 * turns the bellows pump; the pumped air feeds the kiln's reactor (the shipped updraft hearth, no second
 * reactor) until it takes and stays lit; its column is what carries the fox up to glide onto the Weir.
 * The first time the fox stands on the Weir the north edge paints. No per-frame allocation.
 */
import * as THREE from 'three';
import { toon } from '../lookdevKit';
import type { Hearth } from '../chem/updraft';
import type { OpeningCtx } from './scene';
import { MILLBROOK } from './millbrookLayout';

export const MILL_WEIR = {
  /** bellows strokes per wheel radian */
  strokes: 2.2,
  /** reactor supply while the bellows work */
  supply: 1,
  /** permanent wash when the fox first stands on the Weir */
  paintR: 15,
  paintSecs: 2.6,
  /** fall flecks and their speed along the fall (1/s of its length) */
  flecks: 26,
  fallRate: 0.9,
};

export function createMillWeir(
  ctx: OpeningCtx,
  parts: { lid: THREE.Object3D; belly: THREE.Object3D; lip: THREE.Vector3; foot: THREE.Vector3 },
  kiln: Hearth,
  wheel: { turning: () => boolean; spin: () => number },
) {
  const F = MILL_WEIR;
  const R = MILLBROOK.weir;
  let pump = 0;
  let lit = false;
  let reached = false;
  let rodeAt = -1;
  let supplyNow = 0;
  const supply = () => supplyNow;
  const paintAt = new THREE.Vector3(R.x, 0, R.z);
  const PAINT_OPTS = { edgeMax: 2.2 };

  const TEACH = 'The bellows woke the kiln · Space jump and hold to ride its warm air';
  // a soft breath per bellows stroke (rate-limited) and a cue when the kiln takes
  const breath = { at: new THREE.Vector3(), gain: 0.06, rate: 0.5 };
  parts.lid.updateWorldMatrix(true, false);
  parts.lid.getWorldPosition(breath.at);
  let lastStroke = 0;
  let breathT = -1;

  // fall flecks: pale streaks sliding down the fall's curve
  const geo = new THREE.PlaneGeometry(0.07, 0.38);
  const flecks = new THREE.InstancedMesh(geo, toon(0xdde4da), F.flecks);
  flecks.frustumCulled = false;
  ctx.scene.add(flecks);
  const fu = new Float32Array(F.flecks);
  const fo = new Float32Array(F.flecks);
  for (let i = 0; i < F.flecks; i++) {
    fu[i] = ctx.rand();
    fo[i] = (ctx.rand() - 0.5) * 0.7;
  }
  const ax = -(parts.foot.z - parts.lip.z);
  const az = parts.foot.x - parts.lip.x;
  const al = Math.hypot(ax, az) || 1;
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const v = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const faceYaw = Math.atan2(parts.foot.x - parts.lip.x, parts.foot.z - parts.lip.z);

  function update(dt: number, t: number): void {
    const turning = wheel.turning();
    pump += wheel.spin() * F.strokes * dt;
    const k = 0.5 + 0.5 * Math.sin(pump);
    const stroke = Math.floor(pump / (Math.PI * 2));
    if (stroke !== lastStroke && t - breathT > 0.6) {
      breathT = t;
      ctx.audio.play('steam-1', breath);
    }
    lastStroke = stroke;
    parts.lid.rotation.x = -k * 0.32;
    parts.belly.scale.y = 0.25 + k * 0.9;
    supplyNow = turning ? F.supply : 0;
    kiln.update(dt, t, supply, false);
    if (!lit && kiln.reactor.heat >= 1 - 1e-6) {
      lit = true;
      kiln.reactor.restored = true;
      kiln.flare = 1.2;
      ctx.audio.cue('kiln');
    }
    const f = ctx.fox.root.position;
    const nearKiln = lit && rodeAt < 0 && Math.hypot(f.x - kiln.base.x, f.z - kiln.base.z) < 5;
    if (lit && rodeAt < 0 && f.y > kiln.base.y + 3) rodeAt = t;
    if (nearKiln) ctx.teach.offer(TEACH);
    if (!reached && Math.abs(f.y - R.top) < 0.3 && Math.hypot(f.x - R.x, f.z - R.z) < R.half * 1.3) {
      reached = true;
      ctx.field.restore(paintAt, F.paintR, F.paintSecs, PAINT_OPTS);
    }
    for (let i = 0; i < F.flecks; i++) {
      fu[i] = (fu[i]! + F.fallRate * dt * (0.8 + 0.4 * fo[i]! * fo[i]!)) % 1;
      const u = fu[i]!;
      const x = THREE.MathUtils.lerp(parts.lip.x, parts.foot.x, u * u) + (fo[i]! * ax) / al;
      const z = THREE.MathUtils.lerp(parts.lip.z, parts.foot.z, u * u) + (fo[i]! * az) / al;
      const y = THREE.MathUtils.lerp(parts.lip.y + 0.07, parts.foot.y, Math.sqrt(u));
      v.set(x, y, z);
      e.set(0, faceYaw, 0);
      q.setFromEuler(e);
      scl.set(1, 0.6 + u * 1.6, 1);
      flecks.setMatrixAt(i, m4.compose(v, q, scl));
    }
    flecks.instanceMatrix.needsUpdate = true;
  }
  ctx.onUpdate(update);
  return {
    state() {
      return { lit, heat: Math.round(kiln.reactor.heat * 100) / 100, rode: rodeAt >= 0, reached };
    },
  };
}
