# Independent physical Press relay acceptance

Commit `d18bec0bce27dbf7d8aef3dce240aeef4639ce53` integrates Thistle's `386e6a57` warmth relay puzzle.
Tesla T4/EGL, 640×360. Script: `tools/world-ashwater-acceptance.mjs OUT --press-route`.
Fresh default boot → rendered discovery invitation → physical page home → Ashwater arch → return arch → Press
arch → movement/jump/dash only through the Press → return arch → Ashwater re-entry. No staged placement,
progress setter, forced puzzle completion or saved-unlock fixture.

**Solvability PASS**, zero JavaScript errors. The direct lit-brazier-to-seal attempt reaches the seal with warmth 0
and seal closed; first relay then lights, reaching warmth 1, with the seal still closed. Both relays eventually lit;
seal open, draft A active, ice melted, draft B active, `teach/develop/combine` restored. Inkstep earned and Maple
Seedwell fill 1 in the canonical progress snapshot. All five portal transitions and travel counts pass, including
walking back from the completed ledge. Full hook and `window.__game` states at every retained beat.

Press spawn → completion **91.517 seconds simulated**, including one failed direct attempt. Older pre-relay
`f7d3fd25` route was 50.4 seconds. Neither is blind-player time, but neither supports claiming a 10–15-minute
world or a 30–45-minute game. No continuous video or black-frame stability claim follows from these stills.

## Visual review and remaining gates

Personally inspected [lit relay](reed-press-relays/relay.png) and [Press completion](reed-press-relays/press.png).
Fox silhouette is readable; carried warmth and lit brazier communicate state; snow gives a clear palette shift.
Large slab walls remain repetitive, the relay is an isolated bowl prop, and the Press payoff is a bare frame with a
caption. This snapshot has no staged Scribe encounter. These frames do **not** clear the no-placeholder-art or
real-story bar. Thistle owns that next iteration.

The integrated hints still reveal the solution: warmth to the seal, carry to cold braziers first, jump then air-dash
on the ink. Reported to the builders; **no-solution-caption gate FAIL** despite physical puzzle solvability.
The relay requires a persistent-state change and the direct approach fails, an improvement over the old route;
this authored waypoint test does not establish blind insight, meaningful exploration or sufficient depth.

Full evidence: `/captures/reed/press-route-d18bec0b/`; persistent Modal volume
`keeping-swarm5-captures/reed/press-route-d18bec0bce/`. Source helper `tools/lib/press-input-route.mjs` includes
explicit assertions for direct failure, each relay lighting, and three physical completion facts.

## Validation

TypeScript, production Vite build, `lint:feel` (including wall-clock-timer rule), and whitespace checks pass.
`npm run check:stuck` on an isolated immutable `d18bec0b` worktree passes: seed 1 = 1.95 s stuck, seed 2 = 0.63 s,
seed 3 = 1.40 s, mean **1.33 s / 90 s**, budget 4 s, zero JavaScript errors. Retained reports in
`/captures/reed/stuck-d18bec0b/`. An earlier live-worktree check exited during seed 3 without a report; it is not
counted as a pass. The isolated rerun avoids source reloads during ongoing integration and completes all seeds.
