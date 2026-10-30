# Lookdev showcase — Color Fox island

**Purpose:** Prove the rendering/lookdev engine. Not a playable game — a scripted camera flythrough + lil-gui.

## Shot list

1. Cold open: monochrome floating island, painted sky, water, trees, rocks, dormant shrine.
2. Fox path paints temporary color aura + trail.
3. Shrine wakes → painterly color flood across the island.
4. Hold on restored saturated island; fox wisps bloom.

## Modules used

`src/render/*` — ColorField, post stack, sky, atmosphere, water, foliage, wisps, forge renderer.

## Success

Screenshots + flythrough video under `/workspace/siyu/playtest-forge-artifacts/lookdev/`. Visually matches `docs/design/art-direction.md`. API documented in `src/render/index.ts`.
