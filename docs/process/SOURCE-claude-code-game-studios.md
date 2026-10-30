# Source credit — Claude Code Game Studios

Adapted (not copied wholesale) from [Donchitos/Claude-Code-Game-Studios](https://github.com/Donchitos/Claude-Code-Game-Studios) (MIT License, Copyright 2026 Donchitos). Upstream: ~30k★, Unity/Godot/Unreal-oriented Claude Code studio template (49 agents, 74 skills, hooks, 62 templates). Local clone: `/workspace/siyu/ref/Claude-Code-Game-Studios`.

## What we took (adapted for three.js / fox sprint)

| Upstream | Our file | Why |
|----------|----------|-----|
| GDD "Game Feel" section + guide | `docs/process/game-feel-checklist.md` | Vivek's #1 complaint: rigid locomotion. Forces feel targets before code. |
| `level-design-document.md` + `level-designer` agent | `docs/process/level-design-template.md`, `.claude/agents/level-systems-designer.md` | BotW-style systemic levels (restoration → new verb), not combat encounter tables. |
| `playtest-report` + `run-and-observe` | `.claude/skills/playtest-feel-gate/SKILL.md` | No story closes without retained video/screenshots; skating fox = FAIL. |
| `scope-check` | `.claude/skills/scope-check-sprint/SKILL.md` | Kill orb-collect creep and feature bloat mid-sprint. |
| `game-designer` question-first + verdict vocab from `design-review` | `.claude/agents/game-feel-critic.md` | Brutal critic with APPROVED / NEEDS REVISION / FAIL, concrete failure lists. |

## What we deliberately did **not** take

- Full 49-agent hierarchy, director gates, `project.yaml` rigor modes, entity registry, 15 hooks — too much process for an 8-hour parallel Opus/Sol sprint; upstream's own measurement showed `standard` rigor wrote 30 docs before code and ranked *last* in blind playtest.
- Engine specialists (Unity/Godot/Unreal) — we are three.js + Rapier; Unreal is later.
- Live-ops, economy, localization, certification, Steam/console checklists.
- "May I write?" collaborative pause on every file — sprint streams are already orchestrated with named destination paths; asking every turn would stall parallel agents.

## License note

MIT allows adaptation with copyright notice retained. Keep this file and the MIT notice in adapted agent/skill headers.
