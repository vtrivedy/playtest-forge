# The Scribe's Hermitage — the north expansion (Bramble, swarm4)

Third new place (after Millbrook west and Wren's Press Hollow SE). Foreshadows the finale (Wren): this is
where the Scribe made the Album; the Press in the hollow is where it was clamped shut.

## Shape
North of Lanternhollow the bowl's rim opens into a grass **hillside** (ellipse (−7,115) 15×11) so the
Hermitage stands in view above the village. The **hanger lane** (NORTH_LANE) winds up it through tall
moss-crowned trees to a ridge **plateau** ((−6.5,133) r 10.5, +5.3 m). `northE` / `northRim` / `northRise`
in hermitageLayout.ts join groundH the same way as Millbrook (smooth-min rim union, rise added to base).

## Place
- The Scribe's house: tall, narrow, slate roof, round study window over the door, tall chimney.
- The open-air desk under a lean-to: open book, paper stack, inkpot + quill, a stool pushed back.
- A broken flower-press by the door (boards + iron screw): the Press's small cousin.
- The ink pond (black, still, inked reeds) and four standing leaf-stones on the south lip.
- From the lip: the whole village, the Keeping's tree and the far hills.

## The thing to do: let the pressed leaves go
Three drying lines of pegged, pressed autumn leaves. Run or dash under a line → its pegs give, the leaves
lift on the ridge wind and drift south toward the village. All three free → the plateau paints (one
restore r 22) + music cue. At the desk, once: caption *"Here the Scribe kept every autumn"* (Wren's
captions; the Press later answers *"The Scribe pressed the autumn shut"*).
TLA+ `tla/Hermitage.tla`: freed ⊆ Lines monotone, painted ⇔ all freed, caption once; bad variant fails.

## Determinism
All west/north builders draw from their own seed (`rng(4217)`) and the bowl's scatter tests
`bowlPathDist`, so the shared `ctx.rand` sequence is unchanged: `tools/rand-fingerprint.mjs` prints the
same next values as keeping-d2 06920cf.
