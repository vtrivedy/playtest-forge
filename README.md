# playtest-forge

UHQ **three.js** forge for a Spyro-inspired (original IP) creature platformer.

Agents (Codex `gpt-6.1-sol`, Claude Code `claude-opus-5-5`) design, build, and **playtest** with real keyboard computer use (Playwright MCP + `tools/playtest.ts`).

## Quick start

```bash
npm install
npx playwright install chromium
npm run dev:island          # reference floating-island prototype
npm run playtest:island     # headless play + screenshots + webm
```

## Character feel

Open the in-game **lil-gui** panel. Tunables live in `games/shared/character-feel.ts`. Iterate jump/glide/dash until it feels powerful — that is the hard part.

## Smoke slots

- `games/creature-island` — reference prototype
- `games/smoke-opus` / `games/smoke-sol` — agent smoke builds

## Unreal

Scoped only (`docs/unreal/SCOPING.md`). Not installed on this box (no GPU / disk).

## License

MIT
