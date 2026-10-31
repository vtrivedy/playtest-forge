I reviewed the code only. Nothing was run or rendered, and no files were edited. Line references are to the current `s3-shade` HEAD (abec01f).

## Release lifecycle

1. **The leaf simulation never stops (`shades.ts:344-370`).** DESIGN r2 says "Retire completed leaf simulation after its ten-second one-shot". But the freed branch runs the full 20-leaf loop every frame for as long as the game runs. Each leaf allocates several new objects per frame (`clone()`, `new Vector3`, `Quaternion`, `Euler`). The loop also re-flags the instance matrix and colour buffers for upload every frame. The only thing that turns off after 10 s is `leaves.visible`, so the `leaves: 0` value in telemetry looks retired when it isn't. Fix: once `age >= 10`, skip the loop and stop setting the needsUpdate flags. The rest of the freed branch (presence decay, visibility) can stay.
2. **`smokeParticles` doesn't measure particles (`:477`).** It reports 144 whenever `group.visible` is true. So the "motes outlive body" check (`shade-simulation.ts:47`) and the capture evidence only prove the group is still visible, not that any motes can still be seen. Both cut off at the 2.4 s limit, which is consistent today, but the report would hide any future change to the shader's fade.
3. Minor: the release frame skips the `group.position` update (`:438`), so the dissolve is anchored one frame stale. Not visible at the current shade speed.

## Pursuit

4. **Chasing causes repeated hits.** Chase heads straight for the fox with no stopping distance (`:383-395`), at 1.56 m/s. It ends only when the fox is more than 7 m away, changes level, or the shade passes the 4 m leash. After a hit, the knockback leaves the fox about 4.1 m away, but the shade is still in chase. It closes about 1.5 m during the 1 s invulnerability and can then sit on the fox, sending a hit event every frame. A fox standing still is hit again every few seconds until it runs out of wisps and respawns. DESIGN describes pursuit as drawing the drain zone toward warmth, so it shouldn't be able to deal damage this way. Fix: stop short of the fox (around `hitRadius + margin`), or switch chase to return after a hit.
5. **Chase/return can loop forever.** Return can't go back to chase, but arriving resets `nearTime=0` (`:382`). A fox waiting near the leash edge then triggers chase → leash → return → patrol → chase again roughly every 1.2 s plus travel time. There's no cooldown.
6. **Patrol recovery leaves the shade off its route.** When patrol is blocked, or return stalls for 1.5 s and becomes patrol, the curve phase keeps moving while the shade stays put. Afterwards the shade follows that point at the same speed, so it only catches up by cutting corners. That shortcut can run into the same obstacles, and patrol mode has no stall handling, so it just stops. The regression test only checks that the shade moved more than 1 m (`shade-simulation.ts:66`), not that it got back onto the route.
7. **The shade can be stuck at spawn.** It starts at the curve's authored height (`:320`). If the terrain is 1 m or more away from that height, neither the step check (`<.6`) nor the bob re-snap (`<1`) ever succeeds, and the shade never moves. The CPU test only covers a 0.5 m difference.
8. The 7 m chase exit (`:380`) is hard-coded rather than tied to the `chaseDistance`/`noticeDistance` tunables.

## CPU simulation gaps (`tools/shade-simulation.ts`)

- None of these cases are tested:
  - chase → hit (non-dash contact events)
  - chase blocked → return
  - return stall → patrol
  - dash during chase or return
  - `activateAfterLatch`
  - leaf retirement
- The test reads the GLB through a path relative to the working directory (`readFile('assets/...')`), so it only works when run from the repo root. I didn't find a script for it in either `package.json`.

## Capture (`gpu-capture.mjs` shade section)

- **The 10 s behaviour clip proves nothing about pursuit (`:287-308`).** It only asserts `hits===0`, and saves just the final state. DESIGN asks to "Save actor mode transitions"; there's no check that `chase`, then `return`, then `patrol` actually happened. Per-frame `state` is traced, but nothing checks it.
- **`shade-chase` shot (`:310-312`):** it's taken 30 frames after the fox was left at the 8 m observer spot, so the shade is probably returning, not chasing. The name is misleading evidence.
- **Patrol observer placement (`:243`):** it keeps 2.1 m clearance from the curve's control points only, not from the curve itself. Hard-coded coordinates (`-112, -24`) also tie it to the current position of `shadeSpots[0]`. If either goes wrong, the `hits!==0` check fails loudly; it won't give a false pass.
- **High-hill lanes (`:378`, `:400`):** they accept a fox up to 2.4 m lower than the shade. Contact needs `dy > -0.5` (`shades.ts:424`), so a valid lane can still produce no hit and a confusing failure. The `if(edge && !edge.freed)` straight after the throw is redundant.
- **Missing release assertion:** the release colour stroke isn't checked. The integration in `main.ts:1364` is correct, but nothing confirms it.
- **Fine as is:** the contact and free asserts. Contact relies on 1 s invulnerability against a 61-frame window, which is tight but correct.

**Priority:** fix 1 (leaf retirement, an explicit r2 requirement) and 4 (pursuit damage) first, then add mode-transition assertions to the behaviour clip.
