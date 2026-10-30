# Detached CPU agent streams

From repo root with configured Modal + GitHub CLIs:

```sh
modal run tools/modal/agent_stream.py --stream remote-route --model sol --branch s2-remote-route --brief /path/to/brief.md
modal run tools/modal/agent_stream.py --stream remote-art --model opus --branch s2-remote-art --brief 'Read AGENTS.md; ...'
modal run tools/modal/agent_stream.py --list
modal volume get fox-agent-streams remote-route/agent.log ./remote-route.log --force
modal volume get fox-agent-streams remote-route/status.json ./remote-route-status.json --force
modal run tools/modal/agent_stream.py --stop remote-route
```

Launch returns once the worker is spawned in a **separate detached app**. Closing the launcher terminal does not stop it. Each stream reserves its unique name in `fox-agent-stream-registry`; names are not reused so logs cannot be mixed. Registry records app/call IDs, branch, last push SHA, heartbeat and terminal state; branch reservations are released at worker teardown. Default duration is 9000 seconds (2.5h), adjustable with `--duration 60..9000`; stop all sprint workers at wrap-up.

Stop is cooperative: supervisor checks every 30 seconds, terminates the entire agent process group, attempts a final committed-work push, commits the log/status volume, removes temporary auth. Allow 30 seconds plus bounded final backup time; setup commands can delay a stop up to four minutes each. If a worker is unresponsive, use its recorded ID: `modal app stop ap-...`. Forced app termination cannot guarantee final cleanup or push; regular five-minute backups and volume commits limit loss. Never stop an unrelated capture/Harbor app. `--list` is a registry snapshot, not a live Modal health probe; compare `modal app list` if a heartbeat is stale after forced termination.

Images use Node22, git/ripgrep and pinned CLI versions matching this box: Codex0.165.0, ClaudeCode2.1.312. Workers get 2CPU/4GiB, no GPU/browser. Both CLIs run as user `agent`, never root. Clone main then resume the requested existing branch or create a new s2-* branch. Every five minutes push **existing commits only**, without force; dirty files are the agent's responsibility. The supervisor never merges main or commits unchecked edits.

Credentials follow the existing Harbor approach: read local `~/.codex/auth.json`, allowlisted OAuth/API token entries in `~/.config/secrets/claude.env`, and `gh auth token`; pass them using an ephemeral runtime Modal Secret. No auth is baked into images, arguments, git URLs or volume files. Codex auth is mode0600 outside the checkout. Known secret literals are redacted from child output. Only run trusted briefs/repository commands: an agent with shell access can access its runtime credentials, and redaction cannot sanitize arbitrary transformations of secrets. Do not copy auth/config/env dumps into artifacts. The launcher does not copy Modal account credentials into workers.

## GPU capture relay

Workers write `/<volume>/STREAM/capture-request.json` (`/streams` in the worker), for example:

```json
{"ref":"40-character pushed SHA","shots":"stills","stage":"before","reason":"Opening masonry baseline"}
```

The driver fetches the request, runs the existing GPU pipeline locally (only remote browser execution), then uploads PNGs/reports and text feedback:

```sh
modal volume get fox-agent-streams remote-route/capture-request.json ./capture-request.json --force
modal run tools/modal/gpu_capture.py --ref SHA --shots stills --out /absolute/local/capture
modal volume put fox-agent-streams /absolute/local/capture /remote-route/review-before
modal volume put fox-agent-streams /absolute/local/feedback.md /remote-route/feedback.md
```

Use matching immutable before/after refs and staged viewpoints; route checks can be requested separately. Agents poll feedback; no screenshot or playability success claims until they personally inspect PNGs and `window.__game` evidence. Visual improvements require critique, a concrete fix and one GPU retest before landing. Persistent artifacts live at `STREAM/artifacts/`; fetch these for the sprint archive. Volume commits can lag up to30s while running. Captures land on `russetvale-gpu-captures`, separate from the agent logs.

Prefer a dedicated fine-grained GitHub token limited to this repository's Contents read/write: export it as `FOX_GH_TOKEN` for the launcher. Otherwise it uses the existing box credential as requested. The agent subprocess receives an explicit environment allowlist; Modal runtime identity is excluded. Dependency installation receives no token environment. A copied Codex OAuth login may refresh in the remote container; concurrent refresh behavior depends on the login provider, so re-authenticate locally if that provider revokes older refresh tokens.

Stop control and launch IDs use separate registry keys so heartbeat writes cannot erase them. Branches are reserved too. Backup pushes pin the SHA before pushing. A rejected rewritten branch is backed up under `s2-NAME-rescue-TIMESTAMP`; complete network failure retains `STREAM/unpushed.bundle` on the volume. Final push is attempted on failure as well as success. Checkout is left in ephemeral container storage until teardown; credentials are removed separately. A signal handler attempts cleanup on SIGTERM, but hard kill/preemption still cannot guarantee it. The supervisor also kills processes belonging to the dedicated agent user, including detached descendants, when the CLI exits or is stopped.
