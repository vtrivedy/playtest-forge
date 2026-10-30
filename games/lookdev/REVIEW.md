# Lookdev review vs autumn keyart (Vivek t24u)

Captured: `playtest-forge-artifacts/lookdev/01-sepia-open.png` … `05-wide-amber.png`, `02b-fox-close.png`, `flythrough-autumn.webm`.
Commit: `feb679c` (+ bloom dial follow-up).

## Matches
- Unrestored = warm faded sepia old-photo; misty amber sky/fog; paper grain.
- Restored = rust/crimson maples, golden grass, leaf piles, copper golden-hour.
- Fox = `spirit_fox.glb` hero-height + ember emissive + wisps (stand-in fallback). Never ColorField-patched.
- Particles = maple leaf cards + embers; wavefront boost.
- ColorField sepia grade; shrine/maple/arch/leaf_pile GLBs preferred.

## Gaps vs keyart (remaining)
1. **Painterly density** — still a bit low-poly flat vs watercolor wash; grain helps.
2. **Fox flame-tail** — solid GLB silhouette; wisps approximate spirit plume.
3. **Distant island chorus** — fewer floating landmasses than keyart void.
4. **Leaf carpet** — leaf_pile.glb scattered; still thinner than keyart maple carpet.

## Perf
SwiftShader stills only; target 60 on real GPU.
