# Shade visual review: capture 23046ef (`.shade-review-230`)

**Verdict: not approved.** The body is better against dark stone but still reads as paper or glass against the bright sky. Clutter and occlusion are still the main failures. Two things can't be judged from this capture: the Kiln's local colour return and the close 3/4 framing.

## Gameplay proof (JSON only, not judged visually)
- **Two frees pass.** `shade-two-frees-acceptance.json` has `passed:true` with `releasedIds` `shade-kiln` and `shade-hill-high`. The first free gives hits 1, frees 1, with the Kiln released at age 1.85 and 20 leaves. The second gives hits 2, frees 2, with hill-high released at age 1.817 and 20 leaves. By then the Kiln is at age 18.05 with 0 smoke particles and has not respawned. The other 5 Shades stay on patrol.
- **Fox lands below the deck again.** `lastRide` lands it on `kiln-shelf` at y=15, the same symptom as the 0888936 take. Here entryVy is −0.45 rather than −14.6.
- **Behavior take:** patrol, then chase at frame 165, return at 315 and back to patrol at 360. Hits 0, frees 0.
- **Occlusion isolation:** only 1 uniform was touched, and its saved value was 1.46e-5, so occlusion was effectively already off. `shade-wash-normal.png` and `shade-wash-occlusion-disabled-diagnostic.png` are byte-identical (same sha256), which is what that predicts. **Inconclusive.** It says nothing about what caused the earlier white oval.

## Compared with the 0888936 critique

| Area | 0888936 | 23046ef |
|---|---|---|
| **Silhouette** | High hill read well; Kiln hidden behind a pillar | **Better** in patrol60: the stag's legs, torso and stance read on the deck. The Kiln Shade is **still behind the pillar** in free frame 0, and pillars hide the body in behavior frames 89–390 |
| **Material** | Pale grey glass matching the stone | **Mixed.** Against stone (patrol60, clear-free 0) it is now brown and smoky, with a soft volume edge instead of a hard glass rim. But the stone wall, plinth and stair edges still show through the torso, so it reads as see-through rather than solid smoke. Against the cream sky (behavior frame 0, Kiln sheet, wash frame, right-hand stag) it is **still a pale cream/grey ghost, as before.** The darker core doesn't hold against a bright background |
| **Depth** | n/a | Poor. The deck plinth draws over and through the Shade's body in patrol60, so you can't tell what is in front of what |
| **Release (high hill)** | Body → brown puff → red leaves; haze lingers 75–119 | Same order. The haze at frame 119 is lighter, but still large at 75. There is still no release moment of its own (no warm flash): the body just turns into a smoke cloud at frames 5–12 |
| **Local warmth** | Thin amber glow in the stair seams | **Unchanged.** The same thin amber seams at 36–48; the cliff stays sepia |
| **Kiln wash** | Flat white oval decal | No oval visible in these frames. But the deck was already orange from the earlier permanent restore, so **local colour return can't be judged** |
| **Leaf clutter** | Competes with the release | **Still fails.** The Kiln sheet and wash frame are full of large foreground leaves across the sky; the 20 release leaves are lost in them |

## New visual failures, worst first
1. **Large black creature shape with a red eye** on the cliff face in the foreground (patrol60, behavior frame 0). It is the most readable "monster" on screen and looks nothing like the stag. The images don't show what it is: a decal, a shadow or another actor. Identify it before anything else.
2. **Opaque white S-shaped ribbon plume** above the Shade area (patrol60; behavior frames 0–480). There are also flat white arcs at the left and right frame edges (patrol60, behavior frame 0). They read as stickers or paper strips and draw the eye more than the Shade does. I can't tell from the images what they come from.
3. **Square patch of bright dots under the fox** (patrol60, beside the left pillar). It looks like a dither or stipple pattern.
4. **The body vanishes against bright sky.** It needs luminance contrast that depends on what is behind it, not just a darker core.
5. **Pillar occlusion.** The Kiln free frame 0 and the behavior chase frames still hide the body behind masonry.
6. **Framing for the driver's requirement.** In patrol60 the fox is about 8% of frame height, which fails the >15% rule. Clear-free 0 happens to come close (fox about 20%, Shade about 35%), but the fox faces away and it isn't a 3/4 view of the pair. The working camera patch isn't rendered, so neither shot counts.

## What this capture can't tell us
- Kiln local colour return: the earlier take had already restored it permanently. Because the working harness starts a fresh sepia session before the releases, the next capture can show it.
- The cause of the earlier white oval: the occlusion diagnostic didn't change anything.

## Files read
- `.shade-review-230/shade-patrol-00060.png`
- `.shade-review-230/shade-clear-free-00000.png`
- `.shade-review-230/shade-clear-free-contact-sheet.png`
- `.shade-review-230/shade-free-contact-sheet.png`
- `.shade-review-230/shade-behavior-contact-sheet.png`
- `.shade-review-230/shade-wash-normal.png`
- `.shade-review-230/shade-wash-occlusion-disabled-diagnostic.png`
- `.shade-review-230/shade-two-frees-acceptance.json`
- `.shade-review-230/shade-behavior-state.json`
- `.shade-review-230/shade-occlusion-isolation.json`
- `sprint3/shade/opus-release-0888936-visual.md` (prior critique)

I also ran a directory listing and sha256 on the PNGs. I didn't edit anything, use a browser or render.
