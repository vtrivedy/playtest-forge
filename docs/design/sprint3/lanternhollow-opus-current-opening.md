**Verdict:** for the opening only, this is enough evidence. The relocation and the lighter paint both hold up in the opening, and the floor problem is confirmed. I'd authorize **one** bounded CPU floor prototype now, as a separate commit on the 32d5aaaa source. It must not land or be approved until its capture has been compared against the reviewed 1950 hero/well/material-pair baseline. The hero, well, orbit, material-pair, final hub quality, full route and movement verdicts all stay open.

## Observed (main32 frame 0 PNG vs b458 `hub-spawn-chase`, plus the 180-frame sheets)

The two frames don't have the same pose or timing. main32 frame 0 is `anim:"run"` at t=0.53 during the route. The state shows dusk key 1.05, hemi 0.38, `practicalStrength` 2.5. So these are adjacent captures, not an isolated A/B test of the material.

- **Hearth: fixed for the opening.**
  - It now sits at the far left (about x 90–240, y 390–470 px), under the left cottage's lit window and against its base. It reads as part of the house.
  - It doesn't overlap the fox's silhouette, legs or tail.
  - At native 1280×720 I can't see checkerboard dither on the pot.
  - In the sheets it stays at the left edge through roughly frames 0–35 and then leaves the frame. It never crosses the fox.
  - Limit: the sheet thumbnails are too small to rule out dither, and the detail crops show only the fox. Orbit and close-up dither are still open.
- **Plaster: correct direction for the opening.**
  - Walls read warm cream instead of b458's cool grey.
  - Timber framing and lit windows contrast more strongly, and the cottages now separate from the ground by value.
  - Nothing looks chalky or blown out. The upper left wall comes close to the sky value but stays separate.
  - Because timing differs, I'm treating this as consistent with d5c7ad doing its job, not as proof that only the walls changed.
- **b458's "eyes" object at about (625,400):** I can't see it in main32 frame 0. I'm not calling it fixed, because the pose and timing differ.
- **Lower frame: still dark and undifferentiated.**
  - The bottom roughly 40% is one flat brown-grey value.
  - The fox's legs and belly on the shadow side are close to the floor value. It separates only by hue.
  - Moving the hearth uncovered *more* dead floor: the bottom-right third is now empty ground.
  - The sheets back this up from other angles. In frames ~48–100 the camera swings around the well and the fox runs toward the camera across the plaza, and the same flat floor fills half of every frame.
  - The ground at the well base is only slightly lighter. I can't see a distinct 2.5 lantern pool on the floor here.
- **Hub coverage:** the hub appears only in roughly frames 0–110. After that the route heads for the arches, the AMBERWOOD sign and the kiln shrine. The fox/well-post tangency at idle can't be judged from this.
- **The route fails** with `insufficient-idle` at index 38/87. That fail stands, and none of this counts as art approval.

## Why authorize instead of waiting

My earlier condition was that the floor shouldn't be stacked on an unseen hearth or unseen paint. Both have now been seen in the view the floor is meant to fix. The hearth sat on the very ground in question, and that ground is now clear.

The pending dedicated shots test things the prototype doesn't depend on. They do become its *before* baseline, so:

- The prototype's capture must reproduce the 1950 shot list: spawn, hero, arrival, well and material pairs.
- Judging and merging wait until 1950 is back and reviewed.
- If 1950 shows a hearth, paint or well problem, fix that first and rebase the floor onto the fix.

## Shaping suggestions for the prototype

These are predictions from looking at the frame. Nothing here has been verified in a render.

1. **Cover the ground the camera actually sees.** The dead area runs from the fox's feet (about y 600 px) up to the well base (about y 400). That ground lies between spawn (-6,92) and the well, and slightly toward the camera side (z ≈ 92–94). A plateau centred too far north at (-8,88) would leave the fox's feet in the falloff. Suggested probe: weight ≥ 0.5 around (-4.5, 93.5).
2. **Let the bottom ~10–15% of the frame stay darker.** Start the falloff around the camera ground point (-3.3, 94.7). A darker foreground frames the shot and puts the fox on the lighter ground, which is the separation we want. Requiring no hard or faceted edge doesn't mean requiring no boundary. A readable soft edge is what makes it look like a square.
3. **Bound it to the east as well as the west.** Fade softly toward x ≈ -1 to 0 so the right half of the spawn frame shows a gentle edge instead of a full lift. Keep the shorter west reach and the gated lane arm to the junction at (-12.5, 89.5), as already specified.
4. **Keep 18% as the only lift value in this prototype.** I still expect it to under-read under sepia. If it does, raising it is the next one-variable capture, not something to adjust inside this one.
5. **Keep the hubWear fade inside the plateau.** I couldn't see wear lines at this camera, but the dark ring around the well is still the predicted failure in the hero and well shots.
6. **Keep the existing invariants:** exact zeros, a bit-identical diff of untouched vertex colours, and exact collider, height and route arrays.

New props, extra density, roughness changes, shader paths and leafiness changes all stay out.

## Status

| Item | Verdict |
|---|---|
| Hearth relocation, opening frame | Accepted for the opening (orbit/close-up dither pending) |
| Lighter paint, opening frame | Correct direction for the opening (material pairs pending) |
| Floor need | Confirmed, from multiple angles |
| One bounded CPU floor prototype | Authorized to implement and capture. No landing or approval until compared with the reviewed 1950 baseline |
| Hero / well / orbit / material pairs | Unseen, not judged |
| Final hub quality, full route, movement | Not passed, no claim |

I didn't read any source. The claims about the hearth at (-12,93), d5c7ad, strength 2.5 and the empty git diff come from you. The only state I checked myself is the first trace entry in the JSON.
