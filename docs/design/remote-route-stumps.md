# Opening route: carved remnant stumps

Scope: the two stacked square pillar stumps beside H0 on Windmill Rise, terrace-frame (23,-1) and (25.5,-1), tops 7.5 and 9 m. Current main already restyles arches, checkpoint columns and windmills; preserve those changes.

Replace only the stumps' repeated procedural block courses with the existing CC0 Quaternius column (`assets/library/models/ruins/quaternius_column.glb`), already loaded by russetRubble. A dedicated presentation helper fits the carved source into the current 1.9 × 1.9 m footprint and exact 6 m base / authored top. Quiet warm stone vertex tint and existing stone material maintain the sepia/restored treatment. The source's broad capital keeps landing edges legible. No added glow or scanned texture noise.

Unchanged: both box colliders, route coordinates, landing heights, hearths, lighting, camera, fox, physics and mechanics. Preserve deterministic random consumption from the removed stacks so unrelated downstream scenery remains unchanged.

Validation: TypeScript and fox Vite build. Driver GPU baseline and matched after stills + staged route 0..16, immutable pushed commits. Personally inspect PNGs and window.__game evidence; obtain saved Opus critique, address concrete issues, request one retest. No landing until reviewed improvement; integrate main and repeat build checks before any authorized fast-forward push.

## Revision after Opus code review

The first fit leaves the source's round shaft visibly inside the unchanged square collider and compresses capital/base proportions differently. Restyle the library geometry into a square remnant: expand its cross-sections toward the existing square envelope while retaining shallow source moulding relief. Remap the base to 0.28 m and capital to 0.42 m on both stumps, with only the middle section taking the remaining height. Keep top-face inset below 1 cm. Pass the existing footprint width explicitly, add quiet per-stump value variation, and preserve flat landing heights. This is a derived presentation of the same CC0 source, not a collider change. GPU comparison/retest remains required.
