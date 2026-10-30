# Ember updraft — remote heatlift

An ember updraft is rising warm air, carrying drifting russet leaves and orange embers through a feathered, irregular Ø4.4 × 9 m volume; cold ash → 0.25 s ignition → 3 s hold → 0.8 s gutter. It must read at 20 m without hiding the gliding fox.

## Scope and ownership
Upgrade `src/chem/updraft.ts` in place. No level layout edits, route changes, external assets, or additional runtime stack. Preserve jump / held-jump glide / dash and lift mechanics initially; inspect capture ride metrics before considering changes. Pond / kiln route stalls belong to the route owner unless evidence isolates an updraft defect.

## Visual design
Remove the continuous cylindrical haze surface. Use seeded, camera-facing warm wisps with analytically feathered borders, vertical drift and uneven lifetimes. Distinct body and glow contributions keep leaves rust-colored while sparse ember cores supply restrained brightness. Avoid squared particle borders, glossy rims, symmetric helix cages and white bloom. Keep the existing seeded particle path and ignition/gutter state machine.

## Review and verification
Run TypeScript and the fox Vite build. Request GPU-only baseline and at least three lookdev rounds through the capture relay at immutable pushed SHAs. Include fixed-step lifecycle contact sheets, gameplay-distance view and glide motion with `window.__game` / chem ride JSON. Inspect PNGs personally, fix the worst observed issue and retest; obtain one-shot Opus critique of the after sheet. No claim of visual completion without that evidence.

## Known inputs
`briefs/_style-update-1105.md` is missing in this checkout; use director's explicit soft gentle animated realism, original burnt-orange fox, warm autumn sepia and painterly restraint. Triage read from `sprint2/briefs/_triage-adopted.md`. Captures must use the relay; no local browser/render.
