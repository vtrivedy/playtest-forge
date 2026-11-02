// Every arrival the fox can be dropped at (the wake spot, each hub return, each island spawn) leaves the chase lens
// clear: the boom (2.45 m behind, +1.5 m up) must not sit inside a Seedwell or an arch (posts ±1.25 m, lintel
// ~3.1 m), and the line fox→lens must not pass through one. Bug class: the return lens under the Press arch lintel
// and the wake lens inside a Seedwell (Reed / Hazel world-tour stills).
import assert from 'node:assert/strict';
import { SPAWN, WELL } from '../games/fox-spirit/src/opening/layout';
import { HUB_ARCHES, hubArrival, outward, pressE, ashwaterE, RETURN_ARCH_BACK, SEEDWELLS, WORLDS } from '../games/fox-spirit/src/opening/worlds';

type P = { x: number; z: number; yaw: number; name: string };
const arrivals: P[] = [
  { ...SPAWN, name: 'wake spot' },
  ...HUB_ARCHES.map((a) => ({ ...hubArrival(a.to, WELL), name: `home from ${a.to}` })),
  ...(['ashwater', 'press'] as const).map((id) => ({ ...WORLDS[id].spawn, name: `${id} spawn` })),
];
// arches: hub ones (normal radial from the well) + island return arches (3 m outward of the spawn)
const arches = [
  ...HUB_ARCHES.map((a) => { const l = Math.hypot(a.x - WELL.x, a.z - WELL.z); return { x: a.x, z: a.z, nx: (a.x - WELL.x) / l, nz: (a.z - WELL.z) / l }; }),
  ...(['ashwater', 'press'] as const).map((id) => { const w = WORLDS[id]; const o = outward(id === 'ashwater' ? ashwaterE : pressE, w.spawn); return { x: w.spawn.x + o.x * RETURN_ARCH_BACK, z: w.spawn.z + o.z * RETURN_ARCH_BACK, nx: o.x, nz: o.z }; }),
];
const bad: string[] = [];
for (const a of arrivals) {
  const fx = Math.sin(a.yaw), fz = Math.cos(a.yaw);
  for (let t = 0.6; t <= 2.45; t += 0.15) {
    const x = a.x - fx * t, z = a.z - fz * t;
    for (const s of SEEDWELLS) if (Math.hypot(x - s.x, z - s.z) < 1.3) bad.push(`${a.name}: lens line inside the ${s.world} Seedwell at ${t.toFixed(2)} m`);
    for (const r of arches) {
      const along = (x - r.x) * r.nx + (z - r.z) * r.nz;
      const across = Math.abs((x - r.x) * r.nz - (z - r.z) * r.nx);
      // inside the arch's slab (posts + lintel span) — a lens here looks at timber
      if (Math.abs(along) < 0.6 && across < 1.6) bad.push(`${a.name}: lens line through an arch at (${r.x.toFixed(1)}, ${r.z.toFixed(1)}) at ${t.toFixed(2)} m`);
    }
  }
}
assert.equal(bad.length, 0, [...new Set(bad)].join('\n'));
console.log(`world arrivals: ${arrivals.length} arrival lenses clear of ${SEEDWELLS.length} Seedwells and ${arches.length} arches`);
