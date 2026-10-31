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
  Watercolour look on painted surfaces: darker/saturated pigment-pooled rim where coverage
  crosses ~0.5, and a warm wet sheen where fresh paint overlaps the live aura/trail.
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

## Out of scope
Locomotion (other stream). Gameplay supply / Shade drain logic.
