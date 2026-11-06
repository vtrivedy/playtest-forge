// Ashwater terrain sanity (lint:feel): the authored heights at each gate are what the levels assume. A swapped
// smoothstep once sank the whole marsh to the bed (-1 m) and every step counted as wading.
import { ash, ASH_ORIGIN, BED, E, H, LEDGE, mistAt, WATER, WEIR, waterAt } from '../../games/fox-spirit/src/opening/ashwaterLayout';

const cases: Array<[string, number, number, (h: number) => boolean, string]> = [
  ['landing', 0, -46, (h) => Math.abs(h) < 0.5, '≈ 0'],
  ['reed island', 0, -16, (h) => Math.abs(h) < 0.5, '≈ 0'],
  ['mill shore', 0, 17.5, (h) => Math.abs(h) < 0.5, '≈ 0'],
  ['west reach bed', -4, -28.5, (h) => Math.abs(h - BED) < 0.1, `≈ ${BED}`],
  ['east reach bed', 4, -28.5, (h) => Math.abs(h - BED) < 0.1, `≈ ${BED}`],
  ['pond bed', 0, 3, (h) => Math.abs(h - BED) < 0.1, `≈ ${BED}`],
  ['pool bed', 0, 26, (h) => Math.abs(h - BED) < 0.1, `≈ ${BED}`],
  ['weir plateau', 0, 40, (h) => Math.abs(h - WEIR.top) < 0.4, `≈ ${WEIR.top}`],
  ['below the weir lip', 20.5, 40, (h) => h < 0.6, '< 0.6'],
  ['Seedwell ledge', (LEDGE.x0 + LEDGE.x1) / 2, (LEDGE.z0 + LEDGE.z1) / 2, (h) => Math.abs(h - LEDGE.top) < 0.3, `≈ ${LEDGE.top}`],
];
const bad: string[] = [];
for (const [name, lx, lz, ok, want] of cases) {
  const p = ash(lx, lz);
  const h = H(p.x, p.z);
  if (!ok(h)) bad.push(`${name} (${lx},${lz}) H=${h.toFixed(2)} want ${want}`);
}
const dry = ash(0, -46);
if (waterAt(dry.x, dry.z) !== null) bad.push('landing reads as water');
// Mist: every reachable ground under the mist sheets (≈ −0.12) must be feathered clear, or a camera that follows the
// fox down reads as a flat grey wash (the sluice gully, Nov 6). Ground under the never-drained pond (its islet's
// shoreline included) lies under water, not under bare mist.
let low = 0;
const veiled: string[] = [];
for (let lx = -66; lx <= 66; lx += 0.5) for (let lz = -62; lz <= 62; lz += 0.5) {
  const x = ASH_ORIGIN.x + lx, z = ASH_ORIGIN.z + lz;
  const P = WATER.pond;
  if (E(x, z) > -1 || H(x, z) > -0.5 || (lx > P.x0 - 0.3 && lx < P.x1 + 0.3 && lz > P.z0 - 0.3 && lz < P.z1 + 0.3)) continue;
  low++;
  if (mistAt(lx, lz) > 0.05 && veiled.length < 6) veiled.push(`(${lx},${lz}) H=${H(x, z).toFixed(2)} mist=${mistAt(lx, lz).toFixed(2)}`);
}
if (veiled.length) bad.push(`low ground under mist (add it to MIST_CLEAR): ${veiled.join(' ')}`);
if (bad.length) {
  console.log('ashwater terrain:\n  ' + bad.join('\n  '));
  process.exit(1);
}
console.log(`ashwater terrain: ${cases.length} gate heights as authored; ${low} low-ground samples clear of mist`);
