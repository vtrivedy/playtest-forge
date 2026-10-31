# playtest-forge

UHQ **three.js** forge for a Spyro-inspired (original IP) creature platformer.

Agents (Codex `gpt-6.1-sol`, Claude Code `claude-opus-5-5`) design, build, and **playtest** with real keyboard computer use (Playwright MCP + `tools/playtest.ts`).

## Quick start

```bash
npm install
npx playwright install chromium
npm run dev                 # games/fox-spirit on http://127.0.0.1:5180
npm run playtest            # headless play + screenshots + webm → playtest-output/fox-spirit/
npm run playtest:feel       # short jump/glide/dash feel probe
```

## Layout

- `games/fox-spirit` — the game (Russetvale). Design: `games/fox-spirit/DESIGN.md`, `docs/design/`.
- `games/shared` — character-feel presets / jump feel and the `window.__game` publisher.
- `src/render`, `src/audio` — render kit (renderer, ColorField paint, post stack, sky, water) and synthesized audio.
- `tools/` — playtest, GPU capture (`tools/CAPTURE.md`), Blender scripts, unit tests (`npx tsx tools/tests/<name>.ts`).

## Character feel

Open the in-game **lil-gui** panel. Fox tunables live in `games/fox-spirit/src/main.ts` (presets in `games/shared/character-feel.ts`). Iterate jump/glide/dash until it feels powerful — that is the hard part.

## Unreal

Scoped only (`docs/unreal/SCOPING.md`). Not installed on this box (no GPU / disk).

## License

MIT
