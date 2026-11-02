# Integration merge check

Merged keeping-d2 `9b977fb` into Sorrel at `f5c5d01`. Both conflicted files,
`opening/popUpRuin.ts` and `tools/camera-drop-probe.mjs`, exactly match the
integrated versions: the registered FoldPivot factory already attaches every
fold and registers its cutout, preserving the return-fan visibility fix without
duplicate root/occluder entries. Shared fox-size and coverage guards retained.
No camera solver or movement changes. TypeScript and lint:feel pass.

14-second ledge replay on the merged runtime (evidence SHA `012b95b`; only
review prose changed after f5c5d01) passes7/7 actual-state and coverage checks,
complete route,45/45 strict body-margin frames, no JS errors. Minimum projected
fox50.18px at270h, minimum chest range1.930m, maximum grounded follow2.714m.
Reviewed all45frames and exact4.53/4.60s PNGs: full body stays in view through
the fall and jump retries, near ruin faces cut away.

Evidence `/captures/sorrel/integrated-f5c5d01-ledge/` includes window.__game,
420trace samples,4timed PNGs,45raw motion frames and3s15fps clip. Offline30Hz
480×270; disclosed real-dash setup placements, then ordinary controller inputs.
This short regional regression does not repeat Fern's natural Keeping route,
full successful/missed fan routes, audio or real-time-performance review.

Hermitage moved-pole candidate700ec62 remains a visual failure at32s; see
`sorrel-hermitage-bd48cbd.md`. Do not infer its acceptance from this merge check.
