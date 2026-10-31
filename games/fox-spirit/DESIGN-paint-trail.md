# DESIGN — Paint trail (Sprint 4, stream paint-trail)

Vivek: "I don't get the feel of a colorless world that gets painted by our character."

## Fantasy
Russetvale is Scribe-pressed sepia. The ember fox is a wet brush: every pawfall blooms
colour into the paper and the path it runs stays painted. Within 5 s of moving the
player sees a ragged watercolor ribbon behind them that does **not** dry back to sepia.
Freeing a Shade / lighting a hearth / a Seedwell throws a big wet splash.
Kiln/Wellspring floods remain the crescendo (whole valley), not the only colour.

## Why it fails today (main 8d5a601)
- Mask RT is cleared and re-stamped every frame; the fox trail lives 3 s → colour vanishes behind.
- Mask is 512² over 280×220 m (0.55 m/texel): too coarse for a crisp watercolour edge.
- Global grade only moves on the Wellspring flood.

## Mechanism — `PaintLayer` (src/render/colorField.ts)
- One **persistent** RGBA8 render target over the union of region bounds
  (x −140..165, z −165..115, ≈0.15 m/texel). Never cleared after init. Visual only:
  `ColorField.sample()` (gameplay supply probes) never reads it → reactors / Shade drain unchanged.
- Paint is laid as **wet blooms**: each bloom lives ~1–1.6 s, its radius grows ease-out from
  ~35 % to full, rendered with MAX blending into the persistent RT each frame while growing.
  Result: colour visibly spreads out of each pawfall, then dries in place forever.
- Bloom shape: stationary world-space fbm (3 octaves) bends the radius → ragged, coherent
  edges between neighbours; small granulation term = paper fibre.
- Sources
  - **Paw blooms**: main.ts watches the four paw bones; touchdown (paw within ~6 cm of ground
    after being lifted) → small bloom (r≈0.75 m) at the paw.
  - **Path ribbon**: every 0.45 m travelled near the ground → bloom r≈1.5 m (scaled by gait speed).
  - **Drips**: every ~5 m a larger bloom (r 2.2–3.2 m) offset to a side → paint bleeds beyond the path.
  - **Splashes**: `paint.splash(p, r)` — centre + 7 petal lobes — on Shade release, hearth/root
    ignition, Seedwell latch.
  - Airborne: strength fades with height above ground (no band under a high glide).
- Shade drains still blot paint (paint is a "temporary" source, multiplied by visual drain visibility).

## Consumers
- World materials (`patchMaterial`): `s = max(s, paint * visibility)` sampled at full res.
  Paint is life returning, not the authored rust made louder (GPU critic FAIL on that):
  ground hue is replaced at its own value by a wet-in-wet living meadow (yellow-green /
  sage / moss; ochre and madder as accents) with pigment-density variation; stone/wood come
  back warm sandstone with moss on top faces and lichen patches. Darker pigment-pooled rim
  where coverage crosses ~0.5; a glowing wet front on blooms while they spread (per-frame
  half-res wet RT); warm sheen where fresh paint overlaps the live aura/trail.
- Sprouts (`src/render/paintSprouts.ts`): grass tufts and autumn flowers spring up (0.45 s
  ease-out-back) in ribbon/drip/idle blooms and splashes, on soil only (no props, no water).
- Foliage materials (`userData.foliage`): vertex perk — painted clumps swell slightly along
  their clump normals and lift; fresh paint adds a short shiver.
- Autumn leaves: sample paint → leaves drifting over painted ground are in colour.
- Global grade: `post.params.restore = max(flood, 0.4 × local painted fraction)` via a CPU
  coverage grid (1 m cells) — the camera grade warms as you paint around you.
- `window.__game.paint`: blooms laid, painted area m², local fraction (capture evidence).

## Tunables (lil-gui "Paint")
ribbon radius/spacing, paw radius, drip chance, bloom life, strength, grade coupling.

## Verify
`tsc`, fox vite build. GPU capture: new `paint` shot — sepia meadow start, 30 s scripted
S-curve walk/trot, before/after stills from a high lens. Judge PNGs personally.

## v8 (driver note 2026-10-31 11:24)
- **Watercolour edge**: each bloom stamps a decided body (d<0.62–0.8) plus a 0.42-density wet fringe
  creeping out in noise fingers to d≈1.1. Consumer: granulated fringe (paper shows through, 55 % pigment),
  body, and a thin *broken* tide mark (pigment ×0.76, a touch more saturated) at coverage ≈0.5–0.7.
  No brown multiply on the sepia side.
- **Restore to own colour** (`uPaintKind`, `paintKindOf`): terrain/ground/grass → meadow; rv-stone/rv-rock →
  cool blue-grey + gold lichen + moss only on noisy top patches; litter → meadow with sparse warm clusters;
  everything else (wood/dock, plaster, roofs, water, canopy) → its authored colour, richer. Never meadow-green.
- **Path, not blob**: ribbon bloom r 2.2 (≈3–4 m wide incl. fringe), drips r 1.5 at 0.9–1.7 m off-path every 6 m.
  Idle pools at pauses. Props (kinds stone/own) soak paint from 2.4 m / 4.6 m tap rings → pillars/houses
  beside the path restore.
- **Bursts**: `splash` = central wash from 6 % → r·0.8 over 1.5 s plus 9 lobes that well up once the wash
  reaches them (delayed blooms). Shade 12 m, hearth 11/13 (dash), root 9/10, Seedwell 15.
- **Pigment variation**: two-scale density, lighter while wet, gold-ochre and madder accents, faint back-run lines.
- **Leaves**: ~82 % of leaf slots shrink away over paint (per-instance hash, no flicker).
- Capture `paint`: straight walk→pause→trot to cold H-a hearth, stand until lit (dash fallback), same lens
  before/after + `paint-burst-hearth`.

## Out of scope
Locomotion (other stream). Gameplay supply / Shade drain logic.

## v9 (Sprint 5 paint2 — watercolor Keeping, 2026-10-31)

Research: `playtest-forge-artifacts/sprint5/research/painting-the-world.md` · brain `knowledge/painting-the-world.md`.

### Fantasy fix
The valley must **start colorless** (pressed gray-sepia paper). The fox is the wet brush that restores **authored life** on ground *and* props. Autumn palette soft realism — never a neon green carpet.

### Mechanism changes (one path; delete replaced look)
1. **Harder unpainted grade** — `inkWash` drops the authored-hue leak (~10% → ~2%); unpainted albedo stays gray-sepia. Aura visual strength for *color* is quieter so the trail/paint does the storytelling (gameplay aura radius unchanged).
2. **Coverage drives ALL patched materials** — `coverage = max(paint, mask, restore, quiet aura)`. `mix(washed, chroma, coverage)` on terrain, stone, wood, plaster, roofs, foliage, litter. Fox/spirit materials stay unpatched.
3. **Restore own colour first** — ground: soft autumn meadow (ochre / sage / moss / burnt sienna, madder accents) at surface value, not lime. Stone/wood/plaster/foliage/roofs: authored hue enriched. Bursts restore props in-radius to own colour; soil gets autumn wash.
4. **Climb** — for props (`uPaintKind` stone/own) and foliage: sample paint at XZ, then `climb = smoothstep(0, climbH, paint * climbTimeFactor - (worldY - groundY))` with wet delay so colour creeps up trunks/faces (~0.8–1.2 s, climbH ~2.5–4 m). Tunables: `uClimbH`, `uClimbRate`.
5. **Watercolor cues (visible at 720p chase)** — stronger granulation, darker broken tide at coverage≈0.5–0.7, wet-edge sat boost from `uWetMap`, paper grain from world-XZ seeded fBm (single seed). lil-gui: palette, hueJitter, granulation, bleed, edgeDarken, climbH/rate, speckDebug.
6. **Speck root cause (v8 honest fail)** — leftover leaf instances + litter accents + sprout z-fight. Fix: ≥95% leaf shrink over paint; `polygonOffset` on paint sprouts; no brown outline. Record in this section after verify.
7. **Bursts** — keep Shade/hearth/Seedwell radii; burst meadow only on soil; props in splash get own-colour climb; lean on existing ember/leaf particles.

### Metrics
`window.__game.paint`: laid, areaM2, localFraction, hueStdDev (overview), propClimbSat by class, paintPassMs. Perf: paint pass ≤ v8 baseline + 1.5 ms on capture box.

### Non-scope
Locomotion / foxLook / fox animation. No Modal/Codex. No dual legacy paint path.

### v9 as built (s5-paint-world)
- `inkWash`: luma-only gray-sepia paper `luma·(1.05,0.99,0.87)`, `uHueLeak` 0.02 (was 0.10), `uInkWash` 1. Live aura / short trail colour scaled by `uAuraColor` 0.45 (gameplay `sample()` untouched).
- **Climb** — `PaintLayer` keeps a 1 m `uClimbMap` (ping-pong, 25 taps dilate the paint over a ~4 m footprint) that eases toward the paint at `tun.climbRate` 0.8/s and idles once settled. A baked 1 m `uGroundMap` (half-float terrain height, `setGround(world.terrainY)`) gives height above ground; props (`uPaintKind` 1/2) get `cfPaint = climb · (1 − smoothstep(front−0.6, front, hA + jag))`, `front = uClimbH(5.5 m)·(×uClimbFoliage 2.4 for bark/canopy)·(1+0.3·up)·smoothstep(climb)`. The front's 0.5 crossing reuses the tide line → a dark broken watermark rides up walls. Replaced the old 12-tap per-fragment prop reach (one tap now).
- **Palette** (`uPal[5]`, unit luma): golden ochre, sage, moss, burnt sienna, madder accent; hue zones from seeded fBm at ~8 m + per-wash id + `uHueJitter`; soil = `mix(own·1.25 sat, luma·pal·1.22, uPalette 0.62)`. Stone/rock → warm sandstone + gold lichen + moss tops (against grey paper the warmth reads as life); wood/plaster/roofs/foliage/water → own colour ×1.25 sat.
- **Watercolour**: `uGranulation` (pigment settles in paper valleys), `uBleed` (fringe width/strength), `uEdgeDarken` tide, wet front sat+ / darker from `uWetMap`, `uPaperGrain` 4-octave fBm on every patched surface. All noise keyed on world XZ + `uPaintSeed` (from `PaintLayer.seed`, mulberry32); no `Math.random` left in paint/sprouts/layPaint.
- lil-gui "Paint trail": climbRate, climbH, climb ×trees, inkWash, hue leak, aura colour, palette weight, hueJitter, granulation, bleed, edgeDarken, paper grain, palette colours, speckDebug.
- `__game.paint`: laid, paintedAreaM2, localFraction, paintPassMs (CPU submit, ≈0 under SwiftShader), seed. GPU-synced pass cost → capture `paint-perf.json`.

### Speck root cause (v9)
v8's "dark red-brown specks" were pigment-coloured debris *on top of* the wash, not z-fighting or shader NaN: they are stable frame to frame and match the litter/leaf palette, not a depth-fight shimmer. Sources: (1) `rv-litter` cards (leafBrown ×0.8, darker than the lifted wash) re-tinted but kept; (2) the 10 % of instanced autumn leaves kept on paint; (3) paint-sprout cards whose dark `#8c876a` base reads as a dot from above. Fix: litter fragments over the wash body are discarded by 1.8 m noise patches (≈5 % kept as warm piles, whole patches so no torn leaves); leaves keep 3 % and shrink from paint 0.08; sprout bases lightened to `#c4bc98` + `polygonOffset(-1,-2)` against soil z-fight. After: overview/top crops show only warm flowers/falling leaves on the trail, no dark dots. Not isolated per source (one combined fix); `speckDebug` paints litter magenta and hides sprouts for a future split.
