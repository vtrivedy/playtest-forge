No new correctness bugs in `shades.ts`. The rest does what `sprint3/shade/DESIGN.md` asks. The regression check has three gaps, though, so a few plausible regressions would still pass it. This was a code-only review: I didn't run the simulation or the game, and the visual gate is still open.

**Runtime (`games/fox-spirit/src/encounters/shades.ts`)**
- **Retrigger:** both ways back to patrol set the 3 s rest: reaching the route (line 386) and the blocked-return timeout (line 410). While the rest is running, `nearTime` stays at 0, so a fox waiting at the leash only re-triggers after 3 s plus the 1.2 s notice delay, not every 1.2 s.
- **Patrol:** keeps moving during the rest. The rest only blocks building up attention, not the mode or the route.
- **Contact/dash:** the hit and dash-release checks don't depend on mode or rest. A dash still frees a resting Shade, and touching it still hits.
- **Leftover state:** there's no reset or respawn path that would leave a stale `attractionRest`. The ten-second observer test and the slope test aren't affected, because the fox is far away after the return.
- **Minor feel note (not a bug):** the notice lean and eye tracking still run during the rest. The Shade will visibly "see" the fox without coming after it. That may read well; check it in the visual gate.

**Test gaps (`tools/shade-simulation.ts`)**
1. **The rest after a successful return is never tested.** Only the blocked-return path is checked (lines 111–123). If you deleted `s.attractionRest=tun.chaseRest` from line 386, every check would still pass: the first scenario and the observer cycle both keep the fox far away after the return. Fix: after `step(8, far)` at line 42, assert `attractionRest ≈ sys.tun.chaseRest`, then hold the fox about 2.8 m away and assert it stays on patrol.
2. **The 3-second length isn't checked.** `restSeconds` is read back from the actor, and the loop is sized to whatever value it finds. Any `chaseRest` from about 0.5 s to 6 s passes. Fix: compare against `sys.tun.chaseRest` minus the time elapsed since recovery, or record the frame where it switched to patrol.
3. **Clearing the near-timer during the rest isn't tested.** After the rest the test only asserts "chase within 120 frames". Suppose a future change blocks only the patrol→chase switch during the rest and lets `nearTime` keep counting. The Shade would then chase on the very frame the rest ends, and the test would still pass. Fix: also assert it is still on patrol for about `chaseDelay - 2/60` s after the rest ends, then chase.

The DESIGN.md line "CPU proof must observe return, then a full delay free of re-attraction" is currently true only for the blocked return. Gaps 1 and 3 together would make it hold for both paths.
