I found no correctness bug in the `main.ts` change. The real problems are in how `gpu-capture.mjs` reports failures and in how strongly some labels and DESIGN wording claim success. I only read code; I didn't run or render anything.

**`main.ts` — the change is correct but narrow**
- `dashContactActive = wasDashing` is read after the dash-start block sets `dashT`, so the first dash tick still counts as dashing. On the tick the timer runs out, the Shade check now treats that last move as a dash: it frees the Shade and gets the +0.5 reach (`shades.ts:457`). That matches what DESIGN says.
- It only covers that one tick. After the dash ends, the fox keeps the dash's speed until normal control slows it (`main.ts:1339`). Running into a Shade during that slowdown still counts as a hit, which is the intended rule. Be aware of this if frees still read 0.
- Side effect: on the timer-expiry tick the release fires while the animation has already switched off `dash` (`main.ts:1466`). It's one frame and harmless.
- Nothing shows this was the actual cause of frees 0. The DESIGN paragraph says so correctly; don't let the commit message or summary say "fixes dash-through release".

**Harness state**
- `dash.remaining` is raw `dashT`, which keeps going negative forever (the -0.2 cooldown, then further). Either rename it, or clamp it and add a separate cooldown field.
- `collisionActive` shows the last simulated tick, not the current frame. That's fine, but say so if anyone compares it against frames.

**`gpu-capture.mjs` — real problems**
1. **The contact failure can disappear.** It's thrown only at the end of the shade block. Any earlier throw (`:391`, `:411`, `:431`, `:450`, `:452`) replaces it, so the run's final error names the later symptom. The contact failure then only exists in `shade-contact-acceptance.json`. Fix: put the contact message on every later error, or wrap the release section in `try/finally` and throw the combined failures.
2. **Files labelled "acceptance" get saved while the contact gate is failing.** `shade-acceptance.json` (`:409`) and the new `shade-two-frees-acceptance.json` are both written without a `passed` flag or the `contactFailure` text. A reader will take them as passes. Add `contactGate: !contactFailure` to both, or rename them `*-diagnostic` when it fails.
3. **The two-free proof is still blocked by a strict check.** The edge-contact check at `:431` (`hits+1`, knockback ≥2.9) still throws immediately and runs before the second dash. If that contact misbehaves, you get no two-free report or PNG. That contradicts the "release footage isn't hidden behind contact" intent.
4. **The new two-free check is redundant.** `:391` already requires `frees===1` and `:450` requires `+1`, so `frees<2 || releasedIds<2` can never trigger. It's harmless, but it proves nothing new.
5. **The label overclaims slightly.** "No forced actor release" is true as far as I can see, but the fox is teleported to its starting spot before both dashes. The label should say that, so nobody reads it as an uninterrupted play-through.

**DESIGN.md last paragraph**
- The wording is accurate, and it rightly doesn't claim a root cause.
- Typo: `existing8560779` is missing a space.
- "Cannot turn the final dash segment into a damaging contact" is true, but only for that one tick (see the first section). It would help to say that hits during the post-dash slowdown are still intended.
- It describes the contact deferral as "preserving its final FAIL status". Because of problem 1, that's only true when nothing later throws.

**Not verified:** the driver's new capture trace hasn't been shared, and the old GPU 8560779 run stopped before the release. So nothing has yet shown a dash-through release or two Shades freed in one session. The new code only makes a run able to record that.
