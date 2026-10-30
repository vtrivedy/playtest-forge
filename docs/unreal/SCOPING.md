# Unreal Engine scoping (report only — do not install yet)

Checked on the shared box **2026-10-30 America/New_York**.

## Box reality

| Resource | Value | UE need | Verdict |
| --- | --- | --- | --- |
| GPU | none (`nvidia-smi` missing, no `/dev/dri`) | NVIDIA/AMD with Vulkan, ≥8GB VRAM | **Fail** |
| Vulkan | not installed | required on Linux | **Fail** |
| Disk free | ~20 GB on 128 GB root | binary ~60 GB; editor/work ~100 GB+ | **Fail** |
| RAM | 15 GB (≈2.6 GB available under load) | 32 GB recommended | **Fail** |
| CPU | 8× Xeon | OK for light work | Marginal |

**Conclusion:** this box cannot run UE 5.8 editor or cook. Do not download the engine here.

## How to get UE 5.8 (needs Vivek)

### Path A — Linux binary (fastest for running)

1. Create / sign in to an **Epic Games** account.
2. Open https://www.unrealengine.com/linux (Epic login wall).
3. Download the Linux zip, extract (~60 GB free disk on a GPU machine).

### Path B — Source (only if you need engine mods)

1. Same Epic account.
2. Link GitHub: Epic account → **Apps & Accounts** → connect GitHub → authorize **EpicGames** → accept the `@EpicGames` org invite within 7 days.
3. Then `github.com/EpicGames/UnrealEngine` becomes visible.

**Checked:** `gh api repos/EpicGames/UnrealEngine` as `vtrivedy` → **404**. GitHub is **not** linked to Epic yet. Do not try to bypass; Vivek must complete the link (or use Path A binary on a capable machine / Modal image he provisions).

### Official MCP (UE 5.8)

- Plugin id: `ModelContextProtocol` (“Unreal MCP”) + **All Toolsets**
- Listens at `http://127.0.0.1:8000/mcp` (editor-local only)
- Console: `ModelContextProtocol.StartServer` / `ModelContextProtocol.GenerateClientConfig Codex|ClaudeCode|All`
- Docs: https://dev.epicgames.com/documentation/unreal-engine/unreal-mcp-in-unreal-editor
- Community alternative: https://github.com/chongdashu/unreal-mcp (MIT)

Playtest hooks later: Python editor scripting, Automation/Gauntlet, Movie Render Queue, Pixel Streaming (`-RenderOffscreen -ForceRes -Unattended`).

## Modal option (when green-lit)

Modal is already authenticated on this box as `vtrivedy`.

Rough GPU-only rates (public Modal card, Oct 2026):

| GPU | ≈ $/hr (GPU only) | Notes |
| --- | --- | --- |
| L4 24GB | ~$0.80 | Good default; NVENC for Pixel Streaming |
| A10 24GB | ~$1.10 | Extra headroom |
| L40S 48GB | ~$1.95 | Heavy scenes / MRQ |

Add CPU + RAM + **Volume** for the engine (~$0.09/GiB-mo; 100 GiB ≈ $9/mo). Cold start will be slow until the engine lives on a Volume.

**Example working pattern:** keep UE on a Modal Volume; run headless editor/game with Vulkan + `-RenderOffscreen`; capture via Movie Render Queue or Pixel Streaming; agents on the box talk to MCP only if we tunnel/port-forward to that GPU machine (official MCP is localhost-bound — will need a small relay or run the agent *on* the Modal box).

**Ballpark cost for iteration:** 2–3 hr/day on L4 ≈ **$50–75/mo** GPU + ~$9 volume, before idle mistakes. Use scale-to-zero aggressively.

## User actions required before any UE install

1. Epic account + download access (Path A) **or** link `vtrivedy` GitHub ↔ Epic (Path B).
2. Decide: GPU workstation vs Modal Volume.
3. Explicit “go install Unreal” from Vivek (disk/network cost is large).
