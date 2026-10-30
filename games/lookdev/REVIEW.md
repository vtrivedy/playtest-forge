# Lookdev review vs autumn keyart (Vivek t24u)

Captured: `playtest-forge-artifacts/lookdev/01-sepia-open.png` … `05-wide-amber.png`, `flythrough-autumn.webm`.
Commit: `384a2d9` (+ follow-ups).

## Matches
- Unrestored = warm faded sepia (not cold B&W); amber mist sky/fog.
- Restored = rust/crimson maple crowns, golden grass, leaf-litter splotches.
- Fox stand-in = burnt orange + cream chest + umber paws + ember tail/ear tips.
- Particles = maple leaf cards + additive embers; wavefront boost wired.
- ColorField sepia grade + paper grain/foxing; painterly restore bleed.

## Gaps vs keyart (priority)
1. **Painterly density** — keyart has watercolor wash + heavy paper tooth; our RT still reads low-poly flat. Need stronger grain overlay in post and softer mask edge.
2. **Hero maple mass** — keyart’s right-side flaming maple is huge; our hero is one icosa-blob tree. Scale up / multi-crown.
3. **Shrine architecture** — keyart has stairs + domed shrine; we have a pillar+orb. Replace when `assets/env/procedural/shrine.glb` lands.
4. **Fox silhouette** — stand-in is chubby spheres; swap to `assets/hero/spirit_fox.glb` when ready (do not ColorField-patch).
5. **Distant ruins** — keyart gothic arches/spires in sepia void; our sats are dodecahedrons. Add ruin silhouettes.
6. **Ground leaf carpet** — vertex litter helps; still want denser fallen-leaf decals near shrine.

## Perf note
SwiftShader capture ~1–2 fps on first frame then recovers; judge stills, not FPS. Target 60 on real GPU with current mesh counts.
