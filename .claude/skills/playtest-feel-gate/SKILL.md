---
name: playtest-feel-gate
description: "Close a locomotion/feel change only after real play + retained capture. Skating fox = FAIL."
argument-hint: "[seconds] [output-subdir]"
---

<!-- Adapted from Donchitos/Claude-Code-Game-Studios (MIT) playtest-report +
     run-and-observe. Bound to playtest-forge Playwright harness. -->

# Playtest Feel Gate

**A typecheck is not a run. A story nobody looked at does not close.**

## When to run

After any change to fox controller, rig, animation mix, camera follow, dash,
jump, glide, or land juice.

## Procedure

1. **Build/play** via harness (SwiftShader on the box is OK for gait readability;
   Modal GPU preferred for final feel claims):

   ```bash
   npm run playtest -- --game fox-spirit --seconds ${ARGUMENTS:-25}
   ```

2. **Retain evidence** under `playtest-output/fox-spirit/<subdir>/` or
   `playtest-forge-artifacts/sprint2/<subdir>/`:
   - webm or mp4 of the run
   - ≥2 stills (mid-run + turn or land)
   - commit SHA in a `NOTES.md`

3. **Look** at the video/stills (Read tool for PNGs). Fill
   `docs/process/game-feel-checklist.md` acceptance boxes.

4. **Spawn or role-play** `.claude/agents/game-feel-critic.md` and emit its
   verdict block.

5. **Gate:**
   - `FAIL` or missing capture → do not merge as "feel done"; patch or revert.
   - `NEEDS REVISION` → allowed to land on a WIP branch with the critique linked.
   - `APPROVED` → may call the feel milestone done.

## Minimal report template

```markdown
# Playtest feel — [date] [SHA]
Seconds: 
Capture: 
Verdict: 

## First 10s
Understood controls? Goal? Emotional read?

## Failures
1. 

## Top 3 priorities
1. 
```

## Anti-patterns

- Closing because `tsc` / Vite build passed
- Judging gait from a single T-pose still
- Approving "better than yesterday" without checklist
