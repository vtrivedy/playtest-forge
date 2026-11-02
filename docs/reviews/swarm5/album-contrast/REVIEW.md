# Album ink readability

The 640×360 Stacks memory capture had faint serif strokes and navigation labels. The Album now uses semibold serif ink, darker secondary labels, and 26px navigation controls (formerly 22px). Story body sizes remain unchanged. Visual spread review caught three-line Press memories extending beyond the original cards; card height is now 144px (formerly 130px) and prose line spacing is 1.25 (formerly 1.4). Design recorded before implementation in DESIGN.md here.

First physical replay: `node tools/press-stacks-probe.mjs /captures/reed/album-contrast-first`. PASS: all nine climb targets reached using movement/jump after a staged start; native Tab opens the earned memory; reload retains it; revisiting stays quiet. No Seedwell fill or ability awarded. Zero runtime errors. `window.__game` final jump: apex .750m, air .700s, time to apex .300s; zero dashes. This is staged-start traversal evidence, not unaided discovery.

Inspected the first earned-memory screenshot against the previous integrated capture: prose and footer are visibly stronger and remain inside the parchment/card. Character and world remain visible around the Album. No controller tuning.

TypeScript, production Vite build, and diff whitespace checks pass. The production build retains its bundle-size advisory.

Second Stacks replay `/captures/reed/album-contrast-retest` also PASS, zero errors; reloaded-memory screenshot inspected at 640×360. The first full component spread fixture `/captures/reed/album-contrast-spreads` passes native keyboard open/close and earned/missing-story guards, zero errors. It exposed the card overflow fixed above. Final spread fixture `/captures/reed/album-contrast-final` also passes every earned/missing-story guard and native keyboard open/close assertion with zero errors. Inspected final Press and Ashwater spreads: all prose fits inside its cards, including three-line Press memories. Final TypeScript, production build and whitespace checks pass.

Retained evidence: [reloaded memory at 640×360](reloaded-memory.png), [Press spread](story-press-960.png), [Ashwater spread](story-ashwater-960.png), [physical replay and window.__game states](climb-evidence.json). Component fixture states remain under the capture path; component fixture completion is not physical puzzle acceptance.
