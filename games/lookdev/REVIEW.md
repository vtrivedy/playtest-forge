# Lookdev review vs autumn keyart (Vivek t24u)

Captured: `playtest-forge-artifacts/lookdev/01-sepia-open.png` … `05-wide-amber.png`, `flythrough-autumn.webm`.

## Matches
- Unrestored = warm faded sepia (not cold B&W); amber mist sky/fog.
- Restored = rust/crimson maple crowns, golden grass, leaf-litter piles.
- Fox = prefers `spirit_fox.glb` at hero height with ember emissive; stand-in fallback. Never ColorField-patched.
- Particles = maple leaf cards + additive embers; wavefront boost wired.
- ColorField sepia grade + paper grain/foxing; painterly restore bleed.
- Shrine / maple / ruin arch / leaf pile GLBs preferred when present.

## Gaps vs keyart (priority)
1. **Painterly density** — keyart watercolor wash + heavy paper tooth; RT still reads a bit low-poly flat. Grain/vignette help; softer mask edge next.
2. **Distant ruins** — extra arch silhouettes added; still lighter than keyart gothic void.
3. **Fox flame-tail** — GLB silhouette is solid spheres; wisps/embers approximate spirit plume until assets ship a flame-tail mesh.
4. **Floating island chorus** — keyart has many far islands; lookdev island + fog carries most of the void.

## Perf note
SwiftShader capture ~1–2 fps on first frame then recovers; judge stills, not FPS. Target 60 on real GPU with current mesh counts.
