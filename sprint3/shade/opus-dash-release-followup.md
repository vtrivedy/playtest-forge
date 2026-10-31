I found no blockers. The failure path, the dash fields and the uniform save/restore are all sound, but the occlusion diagnostic can still produce a "conclusive-looking" result that isn't. I only read the code; I didn't edit, run or render anything.

**Failure reporting and acceptance JSONs (`tools/gpu-capture.mjs`)**
- **Contact failures are kept.** Both the first contact (`:371`) and the edge contact (`:468`) are added to `report.failures` as soon as they happen, and neither throws.
  - If something later throws, the catch at `:1509` adds that error to the same list, so the contact failure is never replaced.
  - `report.json` is saved in `finally`, and the process exits non-zero either way: the re-thrown error does it, or `:1516` does when nothing threw.
  - This fixes problems 1 and 3 from the previous review.
- **The combined acceptance files are honest.** `shade-acceptance`, `shade-two-frees-acceptance` and `shade-clear-acceptance` all carry `passed`, `releasePassed` and `contactFailures`.
  - `releasePassed:true` is hard-coded, but that's valid: the save is only reached after every release check has passed.
  - `shade-acceptance` uses only the first contact result (the edge contact hasn't happened yet). That's correct.
- **The two-frees label is now accurate**: it says the fox was teleported twice ("Two staged fox teleports").
- **Two leftovers, both harmless:**
  - The `frees<2` check at `:491` still can never trigger, because `:396` and `:489` already guarantee two frees.
  - The `if(edge && !edge.freed)` at `:447` is dead after the throw at `:446`.

**Dash fields (`main.ts:895`)**
- `remaining` is now clamped at zero.
- `readyIn` (`dashT+.2`, clamped) matches the `dashT <= -0.2` check at `:1260`. It measures the cooldown only: a dash can still be refused for being in the air with the air dash used, or with no stick input. That's fine for telling a refused input apart from a release failure.
- `collisionActiveLastStep` is set from `wasDashing` (`:1280`), which is accurate.
- No problems here.

**Occlusion diagnostic (`:407–436`)**
- **The restore is safe.**
  - The zeroing happens only inside `try`, and `finally` puts back the saved numbers. Plain numbers survive the round-trip into the page exactly, so the restore is exact.
  - The diagnostic frame only calls `composer.render()`. Its passes don't depend on frame time, and the manual-mode `tick` doesn't step the game, so the simulation doesn't move.
  - The `shade-wash-normal` shot and the zeroed shot show the same state and camera, and the restore happens before `advance(180)`.
  - The normal per-frame update (`occlusion.ts:198`) eases from the restored value, so later frames are unaffected.
- **Things that affect how to read the result:**
  1. **`touched` will be at most 1.** `occlusion.ts:26` creates one `uOccStrength` object that every patched material shares, and the capture code removes duplicates. So `touched:1` is the success case; it doesn't mean only one material was affected.
  2. **"Touched" alone doesn't make the result conclusive.** The shader skips the cutout entirely when the value is ≤ 0.001 (`occlusion.ts:50`). If the saved value is already about 0, zeroing it changes nothing, so the two images will match and that says nothing about the oval. Treat `saved[0].value ≤ 0.001` as inconclusive too, the same as a zero count. A one-line `inconclusive` field would make this explicit.
  3. **A failed restore can't be seen in the output.** The JSON is written before the `finally`, and nothing reads the value back afterwards. If the restore call itself throws, its error hides any earlier error. A cheap fix: after restoring, read back the game's occlusion strength and require it to equal the saved value. This only matters for provenance; it doesn't block anything.

**Provenance and DESIGN**
- The DESIGN additions match the code: explicit contact fields, a same-frame diagnostic, and the restore happening before the game moves on.
- The two-frees result from GPU 0888936 predates this diagnostic and says nothing about it. The diagnostic hasn't run yet, so nothing so far shows whether the bright stippled oval is the occlusion cutout or the colour wash. When it does run, first check that the saved value is above 0.001.
