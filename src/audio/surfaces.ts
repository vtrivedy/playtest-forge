export type Surface = 'leaf' | 'stone' | 'wood';
/** Collider names are authored by Russetvale; terrain and canopy crowns retain leaf litter. */
export function surfaceOf(tag = ''): Surface {
  if (/^(boardwalk|dock|hut|root-bridge|branch|trunk|stump|lone-trunk|sw3-trunk|bridge-head)/.test(tag)) return 'wood';
  if (/^(terrace|stair|mill|sw1-spire|ghost|arena|pillar|row|shrine-plinth)/.test(tag)) return 'stone';
  return 'leaf';
}
