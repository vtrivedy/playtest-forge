# agent/sumiro-play — notes (Opus 5.5, Nov 6)

Brief: apply the Sumiro method to PLAY (prototype the verb, shots → playable place, puzzles move the world, story
without dialogue or hint captions, a scripted player proves it). Binding checks: research-brain
`knowledge/sumiro-video2game.md` § Checks for agents. Plan: `games/fox-spirit/DESIGN-sumiro-play.md`.

## Slice 1 — the Unpressed Stair (Press, combine)
- Press combine reworked: relay warmth across the Archive shelf (lit → relay → near brazier), melt the iced membrane,
  crack it with Inkstep into a SHORT draft, then ride it carrying warmth onto the page pillar: its brazier lights,
  heat runs the ink seam, and eight pressed page stacks stand from the foot up into a stair to the Press.
- All five Press `HINT_*` control captions are gone (Vivek banned hint captions); the Press now offers only place
  lines, like Ashwater.
- `tla/Press.tla` re-modelled with the pillar/kindle/stair; `PressNoWarmRide.cfg` is the negative control.
- `tools/press-probe.mjs` plays it with stick/Space/Shift after one staged travel, including a failed try at the
  ledge from the short draft alone.

## For the look stream (do not edit from PLAY)
- The pillar, seam and stair are built from the existing Press paper/ink materials in `press.ts`; a lookdev pass on
  the stacks' "pages swelling apart" and the seam's wet-ink run would help. No scenery files were touched.

## Slice 2 — the Folded Archive, deepened (Press, develop)
- The floor membrane's draft is now short (crest +5.3 abs vs shelf 6.6): it tops out at an alcove cut in the shelf
  face, sealed by a hanging sheet of frozen ink. An air-dash from the crest tears it (Inkstep in the air); the chimney
  behind it rises over the shelf. Floor membranes crack to any dash; the air rule is physical (height).
- Proof: fresh `tools/press-probe.mjs` run — floor draft alone peaks under the shelf; crest Inkstep tears the face;
  chimney peak 8.0; then the whole combine; Maple fill 1; reload restores; 0 errors. TLA 54 states, no error.
- Evidence: `docs/reviews/sumiro-play/{folded-archive,unpressed-stair}/`.

## Slice 3 — Ashwater: water runs downhill (Low Sluice)
- Sluice gully + soak carved in `ashwaterLayout.H`; a streaked water ribbon runs down the gully while either reach
  drains, and the soak rises. The dam stays on the bank; the water leaves by a culvert to a slate headwall at the gully head.
- For the look stream: the soak is a plain water disc with the marsh water material; reeds round it and some foam at
  the gully foot would sell it.

## Slice 4 — place lines (sound-off story, no actions named)
- Press alcove: "Old drafts, kept where the winter could not reach." (first time inside the torn alcove)
- Ashwater soak: "Where the flood was always meant to go." (first time by the soak after the sluice runs)
- Both once per save (`places` bit, restored quietly with the level). DESIGN-worlds.md level text updated.

## Slice 5 — Low Sluice gets a choice: the decoy tarn
- A tarn perched on a mound east of the landing, behind its own reed dam; its runnel falls INTO the channel. Dashing
  it spills the tarn and changes nothing ("The tarn spills into the channel."); the sluice dam (gully away, downhill)
  is the one that drains. ashwater-probe dashes the tarn first and asserts the channel unchanged, then plays on: pass.
- For the look stream: the runnel ribbon is hard to see from the mound lens; foam where it meets the channel would help.

## Baselines (Nov 6, this branch)
- check:stuck 1.33 stuck-s / 90 s (budget 4) PASS on 490996f5 (and at slice 1); check:music clean (no audio edits).
- Reed's fresh-boot acceptances: Ashwater pass (ef7491a1); entry tour + Press route pass (583fd7da + route lib).
