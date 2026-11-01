# Unpressed creatures (find)

Phase-2 "make it fun" sprint, feature C (Moss). Three animals the Scribe pressed flat into the Album hide in the scenery as faint warm ink drawings. Dash through one and it pops off the page into a living, coloured creature with an authored little performance, then stays in the world, alive. No counter, no quota, no reward currency: the find is the payoff.

## Why it is fun

- **Spotting:** the drawings are on surfaces you already pass (a lane wall, the shelf cliff, a stone on the far crag). They read as decoration until you notice one breathing — a slow warm pulse in the wash, a little ember glint at the eye.
- **Verb you have:** dash is the key. No new button; the dash you already love gets a second meaning (dash *through* paper).
- **Surprise payoff:** the drawing peels, the creature inflates from flat to round with a squash/stretch pop, shakes off the page, and does something characterful. It is the only full-colour thing in a sepia place besides the fox.
- **Leaves a mark:** each one stays where it settled and keeps idling (preens, sniffs, grazes), so the world is a little more alive every time you come back.

## The three

| | where | drawing | after the pop |
|---|---|---|---|
| Hedgehog | village, the dry-stone wall along the hub lane | curled ball on the wall face | uncurls, sniffs, trundles a short arc, settles by the lane and snuffles |
| Heron | meadow, the H-a shelf's west cliff face | standing heron, neck in an S | opens wings, flaps up and lands on the shelf rim; preens, shifts weight |
| Deer | Keeping place, a page-stone on the far crag | young stag in profile | steps out of the stone, turns to the Crown, walks to the edge and lowers its head |

## Rules

- **Trigger:** fox dashing within the trigger radius of the drawing (horizontal). Aura alone never triggers it (no accidental finds while walking past).
- **One-shot, permanent:** unpressed stays unpressed for the session.
- **No colliders on creatures;** they never block the route. Perches/paths are authored, not AI.
- **Colour:** creatures use plain toon materials (not the paint-field patch) so they are coloured even in unpainted sepia — that contrast is the reveal. No `field.restore` calls (the shared 4-slot restore budget belongs to the Keeping and the ruin).
- **Drawing = the model:** each creature is authored once as a side-profile spec (ellipsoids, tubes, cones in an x-forward / y-up plane); the same spec draws the canvas ink drawing and builds the 3D model, so the pop reads as the drawing gaining depth.

## Hooks

`state().opening.unpressed` = `{ found: string[], creatures: { id, phase: 'pressed'|'popping'|'performing'|'alive', t } [] }`; dev `__gameHooks.unpress(id)`.
