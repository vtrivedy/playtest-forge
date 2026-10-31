Visual verdict on capture 0888936: **still fails visual acceptance.** The gameplay proof holds. This capture is from before 90e1a4c, so nothing below says anything about that fix.

## Gameplay proof (from the JSONs)
- **Kiln free** (`shade-acceptance.json`): contact gives hits 1. Then the Kiln is freed (frees 1, `mode:released`, presence 0, 20 leaves at releaseAge 1.85). Smoke particles reach 0 by releaseAge 14.85, and the Kiln does not respawn.
- **High-hill free, same session** (`shade-clear-acceptance.json`): the Kiln is still released at 16.1 s. hill-high goes chase → released (frees 2, 20 leaves at 1.82), with smoke at 0 by 14.8 s. Its label says "no forced free". The other 4 shades stay on patrol.
- **Live W+Shift take** (`shade-live-acceptance.json`): hits 0, frees 1, Kiln released at 1.867 s. But the fox ends at y=15 on `kiln-shelf`, about 5 m below the Kiln deck (y=20). HE ignited (`lastRide` entryVy −14.6), and SW1 seal is 0.6. So the dash carried the fox off the Kiln deck, which explains the camera ending up against the wall.
- **Wash** (`shade-release-wash.json`): life 4.13, strength 1.2, radius 3, centred on the Kiln (−110.88, 20.1, −19.80).

## Visual read
- **Release readability**
  - Kiln: **fail.** In free frame 0 the body is a faint pale shape that the masonry pillar mostly hides. From frame 5 on, the hearth fire, plume and embers take over the same space, so the release has no readable moment of its own.
  - High hill: **clearer, but not passing.** In `00000.png` the antlered silhouette reads well against the cliff. But the body is pale grey glass that matches the stone. The fox is in the top-left of frame by `00036`, so the camera never frames the release.
- **Warm local restoration: partial.**
  - Kiln: the wash shows as a flat bright white/cream oval on the deck (free frames 5–119). It reads as a decal, not as warmth spreading out.
  - High hill: amber glows in the stair-tread seams (frames 36–48). That's local and warm, but thin, and it could read as lava cracks.
- **Smoke → leaves: weak.** On the high hill the order is right (body → brown puff → red leaves, frames 24–119), but a brown haze lingers over the cliff at 75–119. At the Kiln, the release leaves mix with the hearth plume and embers. In the play sheet, dense leaf scatter on the ground and in the sky (frames 6–24) competes with them. The JSON shows only 20 release leaves, so most of what's on screen is other leaf FX.
- **Sticker: still fails.** A flat translucent rectangular card is visible beside or behind the hearth (free frames 0–24, play frames 0–12). The Kiln wash oval also reads as a sticker.
- **Camera: fail.** Play frames 45–119 swing into the rock wall. The wall fills the left third to half of the frame, and the fox is seen from behind, pressed into hearth HE.

I agree with all four of your observations: the Kiln occlusion, the clearer but pale high-hill release, the competing leaves, and the camera in the wall.

**Bottom line:** the release mechanics are proven twice in one session, plus once with live input. Visual acceptance is not met in this capture. Whether 90e1a4c fixes the pale body or the card needs a fresh capture.

## Files read
- `.shade-review-088/shade-free-contact-sheet.png`
- `.shade-review-088/shade-clear-free-contact-sheet.png`
- `.shade-review-088/shade-clear-free-00000.png`
- `.shade-review-088/shade-clear-free-00036.png`
- `.shade-review-088/shade-play-contact-sheet.png`
- `.shade-review-088/shade-acceptance.json`
- `.shade-review-088/shade-clear-acceptance.json`
- `.shade-review-088/shade-live-acceptance.json`
- `.shade-review-088/shade-release-wash.json`

I didn't use a browser, render anything or edit any files.
