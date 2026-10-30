# Triage adoptions (sprint 2)

Driver: pass these to the streams that own the touched systems.

## 2026-10-30 — pixelfx method → `vfx-lookdev-loop`

- **Source:** https://github.com/patch-gg/pixelfx (MIT) via https://x.com/rehan_shei/status/2116062680121540611
- **Verdict (Opus + Sol):** adopt the **self-verifying VFX loop** (+ seeded RNG, body/glow split, mechanical checks). **Do not** add pixelfx as a runtime dependency or copy pixel-art look.
- **Skill:** `.claude/skills/vfx-lookdev-loop/` — DESIGN / FX / shade streams must use it for ember, updraft, restore front, Shade dissolve, dash trails.
- **Capture:** `tools/fx-capture.ts --effect <id>` (lifecycle contact sheets). GPU: design `updraft` shot; extend Modal allowlist later.
- **Prove-on:** hearth updraft column readability. Before: `playtest-forge-artifacts/sprint2/design/cap1/` (column invisible). After boost: `playtest-forge-artifacts/sprint2/triage/pixelfx/proof/`. Shader boost applied on **s2-design** `games/fox-spirit/src/chem/updraft.ts` (denser column, stronger glow) — land with design chem.
- **Credit:** `docs/process/SOURCE-pixelfx.md`
