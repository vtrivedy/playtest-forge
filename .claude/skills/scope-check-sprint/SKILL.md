---
name: scope-check-sprint
description: "Read-only scope creep check vs sprint brief. Flags orb-collect revival and feature bloat."
argument-hint: "[sprint2|feature-name]"
---

<!-- Adapted from Donchitos/Claude-Code-Game-Studios (MIT) scope-check skill.
     Paths remapped to playtest-forge sprint2 briefs + design docs. -->

# Scope Check (sprint)

Read-only. Writes no files. Compares **planned** sprint scope to **what landed**.

## Phase 1 — Baseline

Read, in order as available:

- `/workspace/siyu/playtest-forge-artifacts/sprint2/briefs/` (COMMON + named briefs)
- `docs/design/game-design.md` pillars + kill tests
- `docs/process/SOURCE-claude-code-game-studios.md` (what process we adopted)
- Sprint-2 user constraints: loco feel, Zelda-bar fox, BotW systemic levels;
  **orbs as core loop = out**

If no baseline brief exists, stop with `NOT ASSESSED`.

## Phase 2 — Current state

- `git log --oneline -30` on the branch/worktree under review
- Scan for new collectible/orb/ember-gated critical-path code
- List WIP branches that claim "done" without feel-gate evidence

## Phase 3 — Report

```markdown
## Scope Check: [name]
### Original scope
- 

### Current scope
- 

### Additions (not in plan)
| Item | Source | Justified? | Effort | Keep/Cut |
|------|--------|------------|--------|----------|

### Removals / regressions
| Item | Impact |

### Hard-ban violations
- Orb/ember collect as critical-path gameplay? Yes/No
- Restore without new verb? Yes/No
- Feel change without retained capture? Yes/No

### Bloat score
Net new items vs plan: [N] — Cut recommendation: [list ≤5]
```

## Verdict

`ON TRACK` | `CREEP` | `BAN_VIOLATION` | `NOT ASSESSED`
