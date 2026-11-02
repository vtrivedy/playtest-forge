# Ruin chase framing diagnosis

Kit1278 reports that the final approximately forty seconds of recent landing clips show a dark, cramped ruin and a steep downward camera. Rook owns ruin-space diagnosis; Tallow owns camera diagnosis. Preserve the existing dash-fold / north jump / east overlook route and movement tuning. No new room, verb, reward system, or alternate runtime path.

The ruin is open-air geometry: two illustrated paper leaves, a low overlook, and a broken arch. Inspect an exact 5e07e9e full-slice replay before changing its dimensions. Retain per-frame camera position, boom/floor correction, fox position, jump metrics, page state, and chase stills from entry through the final hold. Distinguish an actual enclosing surface from a lens trapped below/behind a walkable surface or a yaw left pointing into the approach after the north/east turns.

A spatial edit is justified only by a named mesh visibly blocking the chase view. Prefer local clearance and individually scoped cutout registration over shrinking all scenery or moving the puzzle. Camera corrections belong to Tallow and must retain the earlier canopy-drop framing improvement. The final resting view must show readable fox, warm paper illustration and surrounding meadow/sky rather than a close view of undersides or blank ground.

Validation: compare matched entry, first landing, north landing, overlook and final-hold views; replay the complete input route, with explicit window.__game state and errors. Then review the worst remaining visual issue and retest once. Existing physical miss/retry probe provides the route safety check if ruin geometry/colliders change. Record actual apex/time/air and dash counts; do not infer a whole locomotion signoff from stills.

## Exact baseline and first spatial variation

The 65s 5e07e9e replay completes three catches/zero skips with errors[]. Final optical pitch is 14.64 degrees down, floorLift0, boomT1, scenery limit1; this route does not reproduce a straight-down collision view. Final chase still56 instead shows the maple at(-19.2,70.6) blocking the center of the restored meadow beyond the overlook. The earlier entry clearance moved it into this reward sightline. Compare moving the same tree north to(-19.2,64.8): retain species, scale, palette and collider, preserve the entry clearance, and clear the overlook-to-meadow view. Leave arch and route surfaces unchanged for this isolated variation. If the frame remains cramped, judge the actual after still before altering the arch.

## Capture route completion

Moss's independent110s baseline confirms3651 frames (~61s) in the final infinite ruin hold. Replace that idle capture tail with real-input use of the existing return fold, walk down its steps, follow the meadow back through the gate, and visit the already-built homecoming at the well. Keep a short readable colour settle before leaving. Activate the return with an eastward dash within its spindle radius while remaining on the overlook, then wait for its actual open state. This extends only tools/opening-hero-route.mjs; no game state forcing, camera override, extra controls, or gameplay change. The comparison tree replay already in progress retains the original route source, so its before/after remains matched. Play the extended route separately and verify returns1, safe grounded descent, Page KEPT, homecoming page pinned and no errors (other creature rescues are outside this route). End captures after a short final homecoming read rather than filling remaining duration with a ruin close-up.

The route exposes a `complete` signal after four seconds at homecoming. The standard smoke/video harness stops on that signal, retaining the final still/state and reporting actual duration/frame count. Requested seconds remain an upper budget for incomplete routes. This prevents simply moving the old minute-long idle tail to the well. Existing routes without that signal retain their authored duration.

## First return replay and arch variation

The first eastward return dash opened the latch but carried the fox off the east edge; trying to walk back onto the steps from below stalled. Retain that failed trace as NOT YET. Use the overlook's diagonal runway for the dash and confirm the fox stays on its1.02m top until the steps open; do not tune dash physics to fit the capture.

The tree-only still is MARGINALLY better independently (Tallow1328): near-lens arch piers remain the strongest enclosure. Compare moving the same decorative piers/arch/feet from the near west edge x=O.x−1.4 to the far east edge x=O.x+1.3. It should read as one broken arch beyond the fox, rather than two screen-edge walls. Preserve every arch dimension, paper, terrain and physical collider. This also clears the west-side diagonal approach visually. Play/compare before retaining this variation.

Use a staged overlook-entry diagnostic to iterate the return quickly: the same input route can begin at a named beat, with only its initial position staged on the existing solid overlook. The full route remains the acceptance replay. This diagnostic never forces folded/open state, restore, velocity or camera and records the actual latch/ground/position trace. It prevents paying for the unchanged opening on each failed input variation.

For bounded continuous exit evidence, let the existing camera probe select clip beat, duration and viewport. Keep its default canopy-drop capture unchanged; the ruin review requests six seconds starting at the return dash at640×360/30fps. Replay the entire route with real inputs before that window and retain all per-frame state. This is one shared probe with configurable capture settings, not a second gameplay implementation.

## Full-route result on b6b5c82

Clean exact-SHA standard smoke completes4651frames/77.517s and stops after the4s homecoming read. Nine acceptance checks pass:3 catches/0 skips, all folds open, return1, return dash grounded on overlook, well reached, page pinned, budget under90s and final grounded. No PAGEERROR/CONSERR log hits. Compared with the failed east-dash replay, late lens-to-chest maximum falls69.106→27.596° and blocked frames2937/3000→33/1351 (gate compression). floorLift remains0. Camera code and movement tuning are unchanged. Retained ground jump apex0.792m/tApex0.317s/air0.667s; fourth dash1.998m.

Tallow independently rates the safe return/steps CLEARLY BETTER and arch framing MARGINALLY; final well framing is comfortable but pinnedpage offleft. The continuous6s/180-frame exit replay is retained, decodes completely, and independently passed Tallow’s all-frame review as CLEARLY BETTER for the bounded return correction. No whole-slice camera/locomotion/creature-rescue approval follows from these scoped results.
