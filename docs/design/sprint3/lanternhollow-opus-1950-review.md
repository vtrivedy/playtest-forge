I've opened all 11 requested PNGs and read the source. This is a partial review of an incomplete, cancelled archive: it is not a hub pass and not art approval. The floor that landed in main as bd97310 is not in these images, so nothing here approves it.

## Visual

**Plaster pairs:** The spawn and hero pairs are hard to tell apart at full size. New is slightly creamier, and the wall/timber separation is a small improvement. Keep the new colour; it's a marginal, safe change, not a fix. The pairs only changed the plaster (camera/pose digests matched and the colour reset was exact).

**Hearth:** Mostly settled. It reads as domestic and left of the well, with no fox overlap in spawn, hero or the hearth lane. One small issue in spawn: the cauldron's top touches the cottage window sill. A ~0.5 m nudge away from the wall would fix it. No new props needed.

**Floor: still needed.** Every shot has a broad, flat, dark ground across the lower 40–50% of the frame. It's close in value to the roofs and the well stone, so nothing stands out against it. In the orbit shots the plateau reads as one monochrome slab. A bounded floor is justified, but only judge it on a capture that actually contains it.

**Concrete visible failures:**
1. **`hub-hearth-lane.png`:** a dark cottage roof fills about 40% of the lower-left foreground. The camera is behind or inside the eave. This is a camera fix, not an art fix.
2. **Contact sheet, frames 120–420:** the fox's head and ears sit against the well post and lantern, and the fox's body overlaps the well rim. The idle pose ends right on the post. Fix the arrival stop point or the camera yaw.
3. **`hub-orbit-00270/00300`:** the fox is a tiny orange dither smudge by the well and doesn't read. The top ~45% of the frame is empty fog. **New:** frame 300 has a bright white hook/"?"-shaped object at the bottom left (~20,520). It looks unlit or emissive and should be identified (smoke ribbon? debug line?).
4. Smaller issues: in hero, dark geometry fragments cut into the left edge (~y 250 and 400). The well shot is good.

There's no need for extra props, more density or a restoration bypass.

## Source verdict: control flow OK; one predicate fix before commit; not verified on GPU

Correct as written:
- It decodes the actual JPEG bytes with the `image/jpeg` MIME type.
- The first black bytes are saved to `-frame-NNNNN-attempt-1-black.jpg`, and `save()` runs before the retry.
- The retry does zero simulation steps, then waits two native animation frames with a 5 s timeout, then retries exactly once.
- The context-loss check is sticky and runs before and after.
- A retry that is still black, or whose digest drifted, throws. It never substitutes another frame or encodes a black one.
- Non-hub captures return early, and the ffmpeg post-audit is unchanged.
- The zero-step-render-plus-digest approach already held on the GPU in the plaster pairs.

**Bug: the guard and the audit disagree on what "black" means** (`gpu-capture.mjs:156-158`). The guard calls a frame black only if *every* pixel of a 128×72 average has max channel ≤3. The audit calls it black when ≥99% of pixels are below Y 20 (limited range, roughly full-range luma ≤4.7), and the downsample averaging also hides small bright patches. So a frame that is near-black, or black with a small lit area, passes the guard, gets encoded, and only fails the audit at the end, with no first-attempt bytes saved. Suggested fix: use a shared, pure predicate for both PNG and JPEG and add synthetic RGBA fixtures:
```js
let maxChannel=0,dark=0;
for(let i=0;i<data.length;i+=4){const r=data[i],g=data[i+1],b=data[i+2];
  maxChannel=Math.max(maxChannel,r,g,b);
  if(16+219*(.299*r+.587*g+.114*b)/255<20.5) dark++;}
const darkRatio=dark/(data.length/4);
return {width,height,maxChannel,darkRatio,black:maxChannel<=3||darkRatio>=.99};
```
Sample at 480×270 or larger rather than 128×72.

**Gaps that aren't bugs, but should be stated:**
- **The native-frame wait has never run on the GPU.** No PNG black attempt happened, so `settleHubCompositor` never executed. Native animation frames in headless Chromium with automatic frames suppressed could hit the 5 s timeout.
- **The digest doesn't cover shader time or particle uniforms.** If the hub video doesn't use the fixed clock, a retry could differ in fire/leaf phase without the digest noticing. Record `fixedClock` in the attempt.
- **A throw leaves a partial `<name>.mp4`** under the normal filename (`gpu-capture.mjs:369-371`). Rename or delete it on failure so it can't be mistaken for a complete video.
- **The CPU fixtures stub out the pixel check and the digest** (`hub-video-retry.mjs:31-32`). They prove the control flow only, not the predicate or the digest. The stall fixture also doesn't check that the first-attempt write and save happened.

**Next step:** after the predicate fix, request a capture of latest main (floor + guard) on an immutable SHA with the same full hub shot list. Require a complete final report, clean black audits on all videos, and any `hub-video-attempts.json` with the saved originals. The 1950 baseline stays as failure evidence (natural chase: 0 black frames; fixed arrival: 5; orbit: 4).
