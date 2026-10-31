I've reviewed the captures. **Verdict: visual FAIL.** The animal doesn't read as warm ink in any of the frames, and the working diff fixes only part of what's wrong. I haven't approved anything: none of the diff has been rendered, and release was never captured.

## What the captures show

**1. Silhouette.** It's only coherent in one place: in `shade-patrol-00000.png` the legs and back line read as a standing deer. Everywhere else it falls apart:
- In the contact sheet the shade is a pale, frosted vertical slab beside the pillar. You can't make out a head, neck or legs.
- In `shade-behavior-00300.png` and frames 300 and 390, the body is hidden behind the big column. All you see is antlers plus plume against the sky.
- The strongest read in the whole set is the dark antlers against the bright sky. Dark-on-light is the value scheme that works; the body currently does the opposite.

**2. Body looks like grey glass, not ink.**
- In the patrol frame the body is lighter than the dark ground and masonry behind it, so it reads as a glass ghost.
- Cause in the committed shader: `light = 0.24` (roughly 0.53 grey on screen), and the mix weights (`wrap*.45 + n*.25 + rim*.18`) push most pixels toward that light colour. Low alpha then blends it over a dark floor, which brightens it.
- The pale S-shaped updraft ribbons nearby are the same grey and value as the shade, so they compete with it and blur its identity.

**3. The plume is backwards and detached.**
- The plume is the darkest, densest element, and it rises about one to one and a half body-heights straight up from the antlers.
- It reads as chimney smoke from the brazier, or a separate column, not the animal giving off smoke.
- The hierarchy should be the reverse: densest at the chest and core, lighter and thinner as it leaves the body.

**4. The column hides the encounter.** At the default framing, shade-kiln's patrol puts it behind the tall pillar for most of the behaviour clip, and the foreground pillars cut through it in the patrol frame. The working diff doesn't touch this, even though DESIGN.md lists it as a failure.

**5. Unexplained (flagging only).** From contact frame 18 onward, a bright white ellipse appears on the ground beside the fox. I can't tell from the stills whether it's a dust or hit decal, a fog or SSAO artifact, or something else. Someone should identify it before the next capture.

## Does the working diff fit these failures?

| Change | Fits? | Concerns |
|---|---|---|
| Darker colours (core 0.025, light 0.12) and inner-shell alpha 0.55→0.82 with a density floor of 0.32 | Yes, it targets the pale-glass read directly | At these values the warm hue is lost and it becomes neutral black. With a 0.32 floor and 0.82 alpha, the inner shell may become the black plate the shader comment says to avoid. The floor also removes the internal holes that make it smoke. |
| Wisps sampled by surface area instead of vertex index | Yes, it removes the antler bias behind the plume | It doesn't address the plume being darker than the body. Wisps will now appear on legs and belly, which should help "boils toward feet" but has to be seen. |
| Smaller, lower wisps (size 0.55, rise 0.55, opacity 0.17) | Yes, against the detached plume | The wisps were also what softened the mesh outline. Shrinking them may expose hard shell edges, so the outline still needs soft breakup. |
| Contact teleport yaw `atan2(-dx,-dz)` | The formula is consistent with the dash setup's convention | It doesn't prove the cause. Knockback direction is `fox − source` at the moment of the hit (`contact.ts:20`), but the safety check only tested a zero-width line from where the shade was at setup. A curved approach, the shade's patrol drift, or the fox's body width could each explain the 0.19 m shortfall. |
| DESIGN.md note | Accurate | Records the column occlusion but nothing fixes it. |

## Restrained fixes I'd suggest

1. **Keep the warmth in the ink.**
   - Core around `vec3(0.035, 0.024, 0.016)`, light around `vec3(0.15, 0.10, 0.065)` (sepia rather than grey).
   - Lower the density floor to about 0.2 and inner alpha to about 0.7.
   - Keep the existing rim alpha falloff so edges stay soft.
   - Check it renders darker than the floor behind it without looking flat or filled in.
2. **Make wisps lighter than the body.** Wisp colour slightly above the body's light colour (around `0.16, 0.12, 0.09`) and fading out as they rise, so the densest ink sits at the chest. Don't make them any darker.
3. **Fix occlusion in two places, not one.**
   - In the capture tool, choose the observer camera with a line-of-sight check (raycast from camera to shade chest) rather than just a safe floor.
   - Separately, ask the director whether shade-kiln's patrol waypoints should move out from behind the pillar. That's a level decision, not something to tune.
4. **Diagnose the contact failure before relying on the yaw fix.**
   - Log the knockback direction at the hit and its angle to `contactSetup.direction`.
   - Log each knockback step's actual movement (what `move()` returns) to find which steps lost distance.
   - Widen the safety check to the fox's radius (two offset parallel lines).
   - Keep the 2.9–3.1 m assertion as it is.
5. **Re-capture once** with patrol, behaviour, contact and release. Release still needs its first look.

**Files inspected:** the four PNGs and two JSONs in `.shade-review/`; `git diff` of `shades.ts`, `sprint3/shade/DESIGN.md` and `tools/gpu-capture.mjs`; `shades.ts` lines 120–260 (ink and wisp shaders); `tools/gpu-capture.mjs` lines 300–400 (behaviour and contact harness); `encounters/contact.ts` (all of it); `main.ts` lines 740–760 (`teleport`). I made no edits and ran no browser or render.
