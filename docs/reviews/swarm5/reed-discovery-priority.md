# Independent discovery recovery review

Hazel's `c0eb9d414d511f3f502bf1c099841a2534eb10da` passes an independent
production replay on Tesla T4/EGL: 70 seconds, fixed 60 Hz simulation, 640×360,
15 fps offline screenshots, silent. All 13 discovery checks pass, with zero
JavaScript errors and 1,050 retained frames. The input policy follows projected
fragment geometry and displayed words; this is not blind wandering or pixel
vision, and uses no teleports or forced story progression.

The third catch occurs at 43.7167 seconds while airborne. After four recorded
ruin misses, actual grounded discovery completion occurs at 55.95 seconds.
There are zero sampled homeward hints while discovery is active; 58 samples
contain the homeward hint after completion. The final `window.__game` and full
transition trace are saved in `evidence.json`.

Source review: the new readonly `canTeachOnward` callback reads
`discovery.finished` and gates only the onward teaching offer. It preserves
controller physics and the current support-contact completion guard. The
earlier controller restoration experiment showed that a different trajectory
could avoid the failure; it did not establish that controller rollback was
needed. This replay demonstrates recovery with the current controller once the
competing homeward instruction is gated.

Visual review: inspected the full-route two-second contact sheet, the retry
sequence at one-second intervals, and every captured frame from 43–57 seconds.
The jump and landing instructions remain visible through misses and retries;
the homeward instruction appears after the final landing. The fox is whole on
the overlook and the target remains distinguishable. The platform fade keeps
the fox visible below the treads during recovery. This is a narrow approval for
instruction priority and successful recovery, not a claim of effortless traversal,
perfect motion, completed blind discovery, or a homecoming camera review.

Evidence volume: `keeping-swarm5-captures/reed/discovery-priority-c0eb9d41/`.
It contains `run/discovery.mp4`, `run/end.png`, `run/evidence.json`, all source
frames, `source.json` and the exact capture tool. Local review copies and the
continuity/retry/motion sheets are under
`/captures/reed/discovery-priority-c0eb9d41/`. The only diagnostic tool patch
replaces SwiftShader browser launch flags with the existing EGL Chromium
configuration; original tool hash and exact replacement are retained.

The review branch merges this candidate with the separately verified canopy
stem fade at `314a0492`. TypeScript and `lint:feel` (including camera envelope
and world bounds) pass on that merge. Discovery TLC remains 112 generated/38
distinct states, and TeachOrder 4/4, both without errors.

Combined-source retest completed on immutable `314a0492`: another 70-second
production T4/EGL capture, 1,050 frames at 15 fps, all 13 checks true and zero
JavaScript errors. Grounded completion again occurs at 55.95 seconds; all 303
rounded position samples match the priority-only replay. Inspected every
captured frame of the 13–16 second canopy descent: the stem fades through the
lens crossing and the fox stays visible. The final screenshot shows a whole,
grounded fox on the overlook with the homeward instruction. Evidence volume:
`keeping-swarm5-captures/reed/discovery-integrated-314a0492/`; local movie,
state, final screenshot and descent sheet:
`/captures/reed/discovery-integrated-314a0492/`. This closes the combined
stem-visibility/retry regression on this source, with blind wandering and well
arrival composition still separate open work.
