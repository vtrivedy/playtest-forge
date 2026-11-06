# Sumiro method applied to PLAY — the Press's Wellspring stair (Opus, agent/sumiro-play, Nov 6)

Binding: Riyu's research-brain `knowledge/sumiro-video2game.md` § Checks for agents. For PLAY that means: prototype
the verb before the place (3), every addition starts as shots/beats (4), story reads with sound off and no dialogue
box (5), a scripted player records the run (6), one puzzle verb rearranges the space and progress is readable
without a caption (9), no on-screen control captions as the teacher (10). Look reference: `refs/bible/bible-press.jpg`
(ink spires and membranes, pressed page stacks, the wooden press, a brazier). No bells, no wuxia props.

## What was thin
The Press measured ~1.5 min. Its combine level repeated the first two (warm ice, then crack a membrane, then ride
the draft onto the ledge): two earlier rules in sequence, not an insight that they interact. Nothing in the world
moved except things disappearing. And the Press still offered control captions (`HINT_*`: "carry the brazier’s
warmth to it", "jump, then Shift-dash", "Hold Space…") — Vivek banned hint captions.

## The beat: the Unpressed Stair (Wellspring Press, combine)
Concept, as shots:
1. *Arrival on the Archive shelf.* South, the Press sits on its ledge, too high to climb. Between you and it, a stair
   of page stacks lies pressed flat under glazed ink — you can walk over it; it is plainly a stair that cannot stand.
2. *The iced membrane* by the shelf's lip, and beside it a **pillar** of pages with a **cold brazier on top**, out of
   reach. An ink seam runs from the pillar's foot across the shelf to the stair's first stack.
3. *Relay.* The shelf's lit brazier is far; warmth fades (6 s). Relay through the cold braziers (as taught on the
   margin). Warmth melts the ice; Inkstep (air-dash) cracks the membrane; it breathes a short draft.
4. *The insight (warmth + Inkstep together).* Warm up at the near brazier, jump into the draft **still carrying the
   warmth**, glide onto the pillar, and the high brazier takes the flame.
5. *The world moves.* Heat runs down the seam (the ink wets, then pales along its length); the stacks unpress one by
   one from the foot up — pages swelling apart — and stand as a stair to the ledge. Climb it to the Press. The Scribe
   lifts the lever (existing).

Rules that make it a puzzle, not a walk:
- The new draft is short (3.9 m column; measured crest +4.07 m): it reaches the pillar top (+3.0 m) but no glide reaches the ledge (+4.6 m).
- The high brazier only kindles from its own height (feet within 1 m of its base): no lighting it from below.
- Warmth is spent on what it melts and fades; every brazier relights it; lit braziers never go out. Nothing is lost
  for good (TLA: `Finishes` under fairness, any order of losses).
- The stair, once risen, stays (monotone).

Words: none that teach. Place lines only (captions band, see § Lines). Album pages unchanged (≤12-word revelations
already authored).

## Lines (sound off, no dialogue box, no actions named)
- Seam thaws: "The pressed stair remembers its height."
- Stair stands: none (the camera already sees it).
Removed: all five `HINT_*` control captions in the Press; the ability notice no longer names a key or action.

## Proof
`tools/press-probe.mjs` drives stick/Space/Shift through the whole Press after one staged travel; it is updated to
the new combine (relay → melt → crack → re-warm → ride draft with warmth → kindle the pillar → climb the stair).
`tla/Press.tla` gains the pillar, the kindle and the stair; TLC checks TypeOK, Caused, Monotone, Finishes.

## §2 The Folded Archive, deepened (develop) — "in the air, the Ink Step carries you on"
What was thin: one floor membrane; crack it, ride a 7.5 m draft straight onto the shelf. The Inkstep was a ground
trick. Sumiro's Ink Step is a verb of the air; the bible still hangs ink membranes up between the spires.

Shots:
1. *Under the shelf face.* The Archive shelf is a wall of pages. In its face, an alcove, its mouth sealed by a
   hanging sheet of frozen ink — above any jump.
2. *The floor membrane* in front of it. A dash across it (Inkstep earned) cracks a draft — but a short one: it
   crests just over the alcove's sill and well under the shelf top. Riding it alone gets you nowhere.
3. *The insight.* At the crest, dash: the Inkstep carries you on through the hanging sheet; it shrinks up into the
   lintel and the alcove opens.
4. *The chimney.* Inside the alcove a second draft breathes up through the shelf; ride it out onto the top.

Rules: the face membrane is a wall (collider top = shelf top) until it tears (top drops to the sill); it tears only
to an air-dash at its height (feet within [sill − 0.7, shelf top]). Floor membranes now crack to any dash (the
air-only rule lives where height makes it physical). Draft A's height is derived: crest ≈ sill + 0.95, shelf − 1.25.
Restore: a saved develop tears the face and lowers its wall at boot.

## §3 Ashwater: where the water goes (Low Sluice)
What was wrong: bursting the sluice dam dropped the channel from −0.15 to −1.25 while the dam stood on a bank at
+0.3 — the water had nowhere downhill to go, and nothing showed it leaving. "Which dam drains which pool" cannot be an
insight if the water's road is invisible.

Shots:
1. *The sluice.* From the landing, the reed dam chokes the sluice on the channel's south bank; behind it a slate
   headwall with a dark culvert mouth heads a gully that falls away south-west to a hollow (the soak) in the
   marsh's low corner. The dam stays on the bank (in a ditch the chase lens ended up inside the reed pile).
2. *The burst.* Dash through the dam: water surges out of the culvert mouth down the gully (streaks running downhill) and
   the soak fills; the channel sinks to its bed.
3. *The culvert.* Later, dashing the sill's culvert lets the east reach into the west bed — and the gully runs again,
   the soak rising a second time. Both reaches visibly leave by the same road.

Rules: the gully and soak are terrain (beds −1.3 → −2.0 → −2.3, under the channel bed −1.0; banks ≤ 0.87 slope, a
fox that wanders in walks out). Flow is a function of each burst's clock (surge, then a trickle, then still), so a
saved marsh comes back still and full-soaked with no event.

## §5 Low Sluice gets a choice: the tarn (Ashwater teach)
What was thin: one dam on the landing, so "which dam drains which pool" had one answer and no question.

Shots:
1. *From the landing* two reed dams, both reachable with the dash the fox already has. West: the sluice dam over the
   culvert, its gully falling away to the soak (§3). East: a small tarn perched on a mound, brimming behind its own
   reed dam, a runnel cut down its face to the channel.
2. *The wrong one first (likely).* Dash the tarn's dam: the tarn empties down its runnel *into* the channel — the
   water runs downhill, toward you. The channel stays deep (wading still puts you back).
3. *The read.* Water goes down. The sluice dam's gully goes down and away; that one drains the channel.

Rules: the tarn's burst never changes the channel's level and never blocks anything (no softlock, no reset needed);
it only shows the rule. Its line names what happened: "The tarn spills into the channel." It is not persisted (a
teach-by-contrast beat, not progress): a reload shows it brimming again.
