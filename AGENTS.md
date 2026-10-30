# playtest-forge — agent rules

## Mission
Ship **beautiful, great-feeling** Spyro-inspired (original IP) three.js creature platformer slices. Human = creative director. You realize vision. Feel > feature count.

## Non-negotiables
1. One clean current state — no legacy dual paths.
2. DESIGN.md before code.
3. **Verify by playing** (`npm run playtest` or Playwright MCP). No “done” without screenshots + `window.__game`.
4. UHQ bar: WebGL2 renderer kit, PBR, stylized lights/HDRI, bloom/SMAA/ACES, soft shadows, juice, third-person camera.
5. **Character feel first:** lil-gui tunables; try variations; record apex/air/dash metrics.
6. Simple controls: move + 2 actions (jump, dash); hold-jump glide combo.
7. Visual-quality review after playtest; fix; retest once.
8. Do not install Unreal until explicitly told.

## Models
- Codex: `gpt-6.1-sol`
- Claude Code: `claude-opus-5-5`

## Sprint process (adapted from Claude Code Game Studios)
- Feel critic: `.claude/agents/game-feel-critic.md` — skating/rigid fox = FAIL
- Level systems: `.claude/agents/level-systems-designer.md` — restore unlocks verbs; no orb-core-loop
- Skills: `.claude/skills/playtest-feel-gate/`, `.claude/skills/scope-check-sprint/`
- Checklists: `docs/process/game-feel-checklist.md`, `docs/process/level-design-template.md`
- Credit: `docs/process/SOURCE-claude-code-game-studios.md` (MIT © Donchitos; adapted, not wholesale)
