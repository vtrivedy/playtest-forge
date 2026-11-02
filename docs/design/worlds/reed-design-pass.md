# Three worlds: puzzle and evidence proposal

Design contribution for the November 2 repointed swarm5 brief. This is a proposal,
not a claim that the listed levels exist. Canonical agreement belongs in
`DESIGN-worlds.md` on keeping-d3. Existing opening and finale remain the baseline.

## Recommended structure

Three hub doors, each visibly framing its season; three authored levels behind
each door, with a return arch and named destination at every checkpoint. Unlock
an ability in level one, challenge it in level two, combine it with jump/glide/dash
in level three. A completed level must change a traversable object, with an
immediately usable shortcut proving that change. Color and a counter alone fail.

Alternative: expand the contiguous existing valley. This preserves continuous
travel but spends scarce build time on connecting terrain and camera boundaries.
Alternative: nine small challenge rooms sharing one palette. Cheap to verify,
but insufficient scenery change and likely repeats the original vignette problem.
The recommended separate world spaces give a visual reset and isolate collisions.

## World and level beats

| World / earned verb | Level one: teach | Level two: develop | Level three: combine |
|---|---|---|---|
| Russetvale / Hearthbound: dash through a lit hearth to ignite a lift | Millbrook leaf dam: dash breaks blockage, water turns wheel and lowers bridge. Existing action is retained. Hearth restoration teaches the new lift access. | Hermitage canopy: jump into hearth lift, hold jump to glide onto two shelves; restore a root stair so missed landings have a permanent return. | Kiln Crown: light low hearth, ride its lift, air-dash through leaf shutter, glide to bell. Ringing bell unfolds the hub causeway and fills Kiln Seedwell. |
| Ashwater / Reedskim: grounded dash across water follows a broad reed lane | Broken Ferry: dash reed latch to raise basin/ferry; first skim crosses a short wide flooded gap, with dry bank recovery. | Two Sluices: choose flow left or right by dashing physical paddles. Left raises stepping rafts to an upper valve; upper valve retains that raft height while right flow opens exit. Show water moving through an exposed channel. | Warden's Rainbell: set retained basin, skim to ferry, jump/glide from raised ferry to bell. Bell opens dry causeway back to hub and fills Reed Seedwell. |
| Scribe's Press / Inkstep: air-dash through an ink ribbon briefly makes its drawn ledge solid | Margin Bridge: dash through first ribbon from safe shelf; drawn broad ledge becomes solid with clear countdown ink fade. Permanent press latch unfolds recovery stairs. | Counterweight Archive: stand on broad page plate to lower weight, dash through ribbon to reach side latch, which retains weight; restore two pages into one bridge. | Wellspring Press: retained page bridge, hearth lift, reed crossing and final inkstep/glide reach the press lever. Physical press opens winter sky; Maple Seedwell fills, then the existing rest ending is entered. |

Ability implementation must remain move + jump + dash, with hold-jump glide.
Prefer explicit contextual targets and generous geometric margins to hidden
input sequences. New verbs must work in authored space, not merely appear in HUD.
If another design wins, retain these teach/develop/combine and recovery contracts.

### Capability correction after Hazel's review

Hearth ignition and updraft/glide already exist in the opening. The Hearthbound
row above is therefore insufficient as an earned ability. Replace that reward
with persistent warmth pickup/place, building on the existing carry behavior:
one coal can retain an activated mechanism while the fox leaves it and traverses
another route. A level must require that separation, rather than deliver a coal
to a nearby socket. Teach placement beside a visible lift; develop it with two
routes where the fox cannot dash while retaining the coal; combine lift placement
with a recoverable glide and permanent bridge latch. Existing pickup controls
must be reconciled with the two-action rule by the canonical design owner before
implementation, not silently add another action key.

Likewise Reedskim must grant actual crossing support or extend reach, and Inkstep
must create collision support or break an otherwise impassable membrane. Each
reward needs a before-unlock failure and after-unlock success using the same
input and target. Merely lighting an ability icon is not acceptance.

### Minimum integration evidence contract

The scene integrator should expose the active world, portal destination and
return position in `window.__game`; Hazel's progress contract supplies level,
ability and well truth. Portal entry must consume ordinary movement, preserve
completed mechanisms, clear transient input, and place the fox on supported
ground with a useful camera. Returning through an arch must put the player
outside its activation volume to prevent immediate reentry. Pause/map cannot
advance puzzles; standing at a finish before satisfying its mechanism cannot
complete the level. These are played negative cases, not reasons to award
completion through a diagnostic hook.

## Layout and pacing

`hub → [teach W→B] → [develop W→lift/bridge] → [combine W→return arch] → hub`

Each level: entry vista (wonder 2), safe demonstration (3), first attempt (5),
recovery/observation (2), combined execution (6), restoration vista (2).
The failed attempt lands on a return bank within ten seconds; it never wipes
completed latches. Critical-path success requires manipulating land, not finding
N pickups. Optional upper loops reveal lore and shortcuts, not gate currency.

The Kiln, Reed and Maple Seedwells are separate permanent physical hub changes.
The page map colors each named level only on puzzle completion and marks the
current destination. Reentry preserves solved geometry; starting fresh clears
all three worlds together. Returning from a world must not reset the opening.

## Honest duration

The 30–45 minute target is a first-player pacing target, not a promised measured
result. Three puzzles per world at 2–3 minutes plus exploration could approach
it, but a deterministic route will be much faster. Do not inflate duration with
forced waits, empty jogging or repeated collectible gates. Report actual novice,
authored-route and simulation times separately. The deadline minimum remains
three reachable distinct worlds with one real puzzle and progress marker each.

## Replay acceptance

1. Start fresh, use real hub doors, complete first puzzle in every world and
   return through visible arches. No query-only world entry or story forcing.
2. Record puzzle before/action/after, matching collision support to visible
   surfaces; demonstrate an earned verb and a failed-attempt recovery.
3. Capture all three world entry frames at the same resolution. Autumn is amber
   canopy, marsh is cool rain/reeds/open water, Press is winter charcoal/white
   paper with tall architecture. Different HUD titles do not count as scenery.
4. Save full `window.__game` with world/level, puzzle phase, ability flags,
   Seedwell states, map cells and errors. At least one independent replay of
   each world and one uninterrupted hub→three worlds→hub path.
5. Check title/rest camera in continuous footage. Existing b13 motion audit
   finds a brief camera excursion at title onset despite passing sampled stills.
6. Retain cue/landing recovery, painted corridors, village stuck budget and GPU
   zero-black-frame gate on the integrated source. A staged world probe cannot
   establish that the real hub is connected or that opening gates survived.

Reed can own independent integrated GPU captures, frame review, black-frame
verification and hub/world route assertions. Level owners should publish a
small deterministic puzzle state contract before scene wiring; Hazel has offered
that ownership. One integrator should own shared runtime world switching.
