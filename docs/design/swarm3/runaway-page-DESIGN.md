# Runaway Page — design (swarm 3, phase 2 "make it fun")

Owner: Flint. Status: greybox.

## Point
A torn Album page has come loose and will not be kept. It is the one thing in the slice that *runs from you*: a clear target that pulls the fox through every other activity at speed, and pays off by giving a whole place back.

Ref: Mario 64 MIPS (a catchable thing that reads your approach), Spyro thief chases (route tour at speed), A Short Hike (gentle, no fail state).

## Feel targets
- **Readable target.** Warm paper card with an inked scene on it, edge glow, a fluttering bend; leaves a short paper-fleck trail. Visible from 25 m against the sepia world.
- **Alive, not scripted.** It perches and *watches* (turns to face the fox, flaps faster as the fox nears). Inside ~4 m it bolts along its flight line; the closer the fox, the faster (rubber band 1.4 → 3.0 m/s, just under the fox's 3.2 m/s run), so running gains slowly and a **dash (8 m/s × 0.24 s) is the catch**. A pounce from a glide counts too.
- **Generous catch.** Dash or airborne contact within 1.3 m of the page (centre to fox chest). Walking into it never catches — it hops a little ahead with a rustle (teaches "it wants a dash").
- **Never a fail state.** If the fox loses it, it waits at the next perch, fluttering, with a soft rustle hum that grows with distance (orientation by ear like the hearth hum).

## Structure
3 catches, one per stage. A catch tears a corner free (paper burst + chord note) and the page flings itself to the next stage start along a long visible arc (ribbon trail lingers 3 s) — the player sees where to go next.

| Stage | Where | Flight line | Teaches |
|---|---|---|---|
| 1 Village | starts on the well roof (−8, 85) | around the well, between cottages, out the gate onto the meadow path | chase + dash catch |
| 2 Canopy (Tallow) | south-central meadow | hops leaf to leaf above the canopy chain; perches high so the fox must use the leaves | movement verbs |
| 3 Ruin (Rook) | west meadow edge | climbs the pop-up ruin flaps to the overlook | spatial route |

Greybox perches for stages 2–3 sit at the allocated footprints; they move onto the real leaves/flaps when those land.

## Payoff
The third catch: the page unfolds above the fox into a large pop-up scene (the meadow in full autumn), then sinks into the ground as a wash — `field.restore` over the whole meadow (permanent colour), hum chord, and the page's scene appears on the well as a pinned Album page (diegetic record). No counter, no UI list.

## Interfaces
- `opening/page.ts` → `buildRunawayPage(ctx, { stages })` → `{ state() }`; state: `{ stage, phase: 'perched'|'fleeing'|'flung'|'kept', catches, s, pos }`.
- Constants: `PAGE` in `layout.ts` (stage flight lines as point lists).
- Dev hooks: `__gameHooks.pageStage(n)` to stage-skip for review.
- Reads `ctx.player.state()` for `dashing`, `grounded`, `pos`.

## Cut criteria
Kill if, after greybox play: catching feels random (page jitters through the fox), it reads as "orb on a rail", or players lose it with no idea where it went.
