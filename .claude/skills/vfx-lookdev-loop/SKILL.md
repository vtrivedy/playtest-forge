---
name: vfx-lookdev-loop
description: "Draft → contact-sheet → look → fix-worst → re-capture for three.js soft-realism VFX (embers, updraft, restore front, Shade dissolve, dash trails). Skating or invisible affordances = FAIL."
argument-hint: "[effect-id] [rounds]"
---

<!-- Adapted from the *method* in patch-gg/pixelfx (MIT) and Hugo Duprez's
     draft/look/refine loop — NOT the pixel-art library. See
     docs/process/SOURCE-pixelfx.md. Bound to playtest-forge Playwright /
     Modal capture. Style lock: soft gentle animated realism. -->

# VFX Lookdev Loop

**A typecheck is not a look. An effect nobody stared at does not close.**

Pixel-art rules (hard ramps, Bayer dither, 1× mush) do **not** apply. Soft volumes,
warm ember cores, readable silhouettes at gameplay distance do.

## When to run

After any change to: ember wisps / trail, hearth updraft column, color-restore
front, Shade → leaves dissolve, dash stroke trail, leaf vortex, or other juice
the player aims with.

## One-line brief first

Write what it is, how it moves, palette, timing. Example: "Hearth updraft: burnt-
orange ember column Ø4.4×9 m; cold ash → ignite 0.25 s → hold 3 s → gutter 0.8 s;
reads at 20 m so a gliding fox aims into it."

## Procedure (≥3 rounds, hard cap 5)

1. **Draft** in our three.js path (`games/fox-spirit/src/chem/`, `src/render/`,
   `games/fox-spirit/src/fx.ts`). Upgrade in place — no parallel FX stack.
2. **Seed everything.** No `Math.random` in lookdev paths; use a fixed seed so
   two sheets of the same effect are comparable.
3. **Capture a contact sheet** with fixed sim steps (not wall-clock waits):

   ```bash
   npx tsx tools/fx-capture.ts --effect <id> --out playtest-forge-artifacts/sprint2/fx/<id>/r<N>
   # or, once Modal FX shot exists:
   python3 tools/review-capture.py <ref> --shots fx
   ```

   Prefer `?q=high` or Modal GPU for bloom/glow claims. SwiftShader is smoke-only.
4. **Look** at every frame (Read the PNGs). Pair with a short motion clip when
   the effect is about motion (updraft, trail, dissolve).
5. **Fix the single worst defect**, then re-capture. Do not thrash five knobs.

### Soft-realism "you see → fix" table

| you see | fix |
|---|---|
| mush / no silhouette at 15–20 m | one focal volume, clearer edge (rim or denser core), bigger shapes |
| floaty, no punch | fast in / slow out; shorter attack; small flare on ignite |
| stiff / mechanical | vary size, speed, life, delay per particle; add secondary (leaves, smoke) |
| washed / white bloom | lower bloom contribution; white only in hottest core; keep burnt-orange body |
| pops off | fade / shrink / gutter before t = duration |
| invisible affordance (updraft) | fail — player must see where to glide before entering |
| pretty on black, dies in foliage | re-judge in-world at gameplay camera + distance |

## Mechanical checks (adapt pixelfx check.mjs)

Write `check.json` beside the sheet when practical:

- one-shots end empty (particle opacity / count → 0)
- loops: last→first frame delta ≤ ~2× a normal step
- no unseeded `Math.random` in the effect file
- frame cost under budget (note ms if available)

Beauty still needs human/agent eyes. Checks catch seams and nondeterminism.

## Capture wiring

- Local: `tools/fx-capture.ts --effect <id>` stages via
  `window.__gameHooks.stageFx(id, opts)` (or chem hooks for updraft),
  `setManual(true)` + `advance(frames, 1/60)`, fixed camera, labelled lifecycle
  frames → `contact.png` + optional short webm.
- GPU: extend Modal shot allowlist when ready; until then use design's
  `updraft` shot in `tools/gpu-capture.mjs` and
  `python3 tools/review-capture.py --sheet-only <dir>`.
- Always save `window.__game` / chem state JSON with the sheet.

## Pass bars (examples)

- **Hearth updraft:** cold ash readable at 15 m; lit column readable at 20 m in
  motion; fox readable through it; ≥7 m glide ride still passes
  (`docs/design/world-1.md` §1.3 / §5).
- **Shade dissolve:** ink → autumn leaves in ≤0.8 s; no pop-cut.
- **Restore front:** warm edge reads against sepia; no recession (monotone radius).

## Anti-patterns

- Judging only stills for motion effects
- Judging glow at `q=low` (no bloom)
- Wall-clock `waitForTimeout` as “effect time” on SwiftShader
- Importing pixelfx pixel aesthetic rules
- Gold-plating past 5 rounds (run `scope-check-sprint`)
- Building a second particle stack beside the current one
