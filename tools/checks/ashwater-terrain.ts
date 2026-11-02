// Ashwater terrain sanity (lint:feel): the authored heights at each gate are what the levels assume. A swapped
// smoothstep once sank the whole marsh to the bed (-1 m) and every step counted as wading.
import { ash, BED, H, LEDGE, WEIR, waterAt } from '../../games/fox-spirit/src/opening/ashwaterLayout';

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
if (bad.length) {
  console.log('ashwater terrain:\n  ' + bad.join('\n  '));
  process.exit(1);
}
console.log(`ashwater terrain: ${cases.length} gate heights as authored`);
