# Carry verification — Tallow, 2026-11-01

Source: 8ca889aa2433ba2b8c3163bc651a2e2096187a44 on sw3-tallow.
Typecheck and Vite build pass. This is mechanical acceptance and an initial art
review, not an unfamiliar-player feel gate or a complete Keeping route clear.

Evidence: `/captures/tallow/carry-wired-03b/` contains five chase stills, one
explicitly staged front inspection lens, a WebM and `evidence.json` with opening
`__gameHooks` state. The probe uses real keyboard input and manual simulation
steps, with staged starts/reset positions disclosed in its report. Its WebM is
a stepped inspection recording; use the integrated chase route for animation
and uninterrupted action feel judgments.

Nine checks pass: holding E picks once; jump preserves Carry; airborne dash
both drops and dashes; coal remains at grounded height; pickup recovers it;
grounded E places; heat stays at one; position stays fixed; and carrying/empty
acceleration matches (2.099m/s after20 frames). Independent Rook reproduced the
same nine checks on pre-readability integration a1469fc (chat :69).

Visual review: centered muzzle coal was hidden behind the fox's head. Moving it
to the mouth corner exposes a warm charcoal silhouette beside the cheek while
preserving the ears, face, tail and authored gait. A lower final offset avoids a
coal beside the eye. The front inspection lens encounters existing shelf rocks,
so close contact still needs review in the authored route's clear space.

## Feel critique — 8ca889a
Verdict: NEEDS REVISION

Concrete remaining review gaps:
1. No full-speed continuous chase video of the new carried pose through turns.
2. Existing boulders constrain the source inspection lens; review final cradle.
3. E is a provisional third-action exception, explicitly documented in design;
   the two-action convention needs a final team/driver decision.

What works: pickup/place respond on the first frame, held input cannot repeat;
dash-drop never consumes or cools coal; movement parameters are unchanged.

| Item | Pass? |
|------|-------|
| Safe drop / recovery / persistent placed warmth | yes |
| No movement speed penalty | yes, numerical comparison |
| Coal readable from chase view | improved; route review pending |
| Feet plant / gait cycles | inherited; continuous route review pending |
| Body + tail follow-through on turns | inherited; route review pending |
| Jump / dash weight | action state verified; continuous review pending |
| Retained capture + __game state | yes, staged probe |
| Unfamiliar-player discovery and emotional read | not assessed |

Next: authored route capture, teammate before/after verdict, then honest human
feel-gate status. No extra content until Carry is acceptable.
