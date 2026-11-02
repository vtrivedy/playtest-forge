# Homecoming baseline — 68a252f

Independent review of the existing native T4/EGL full-route recording confirms
Kit's homecoming presentation failure. The prior integrated audit checked the
ending frames; its pass does not cover this earlier arrival.

From `boundary-baseline-68a252f0cd-182025-e11193/native.webm`, extract seconds
70–100 at one frame every three seconds. At approximately 73 and 76 seconds,
“Follow the warm light home” and “One page still holds the autumn.” appear
together. Near 76 seconds the well roof occupies the foreground and hides the
hero. Adjacent samples recover the hero, so the sampled sheet establishes an
arrival obstruction rather than continuous loss throughout the homecoming.

Evidence: `/captures/reed/homecoming-68a252f/sheet.jpg`; original native video,
one-second state samples and final `window.__game` are retained in the named
boundary capture. Times here are decoded recording times, not simulation times.

Retest plan: replay the same authored full journey on an immutable production
build containing Thistle's camera and Cedar's caption changes. Review arrival
in continuous footage plus native stills; retain state and errors. Recheck the
snow/title composition and journey completion to catch effects on later shots.
No controller, camera or caption code changed for this baseline review.
