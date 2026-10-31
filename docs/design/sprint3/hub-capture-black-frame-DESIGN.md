# Hub capture black-frame evidence guard

Own PNG inspection found b458abc hub-well.png is entirely black despite a green machine report; immediate zero-step well comparison frames render normally. No visible-game assertion currently checks captured pixels. Do not label that original package fully accepted.

For hub stills only, inspect a downsample of the actual screenshot bytes with a fresh two-dimensional canvas in the remote browser (never request another context from Three's canvas). If all sampled RGB channels are <=3, preserve the original as a named black-attempt PNG, record metrics/time, render once at zero simulation steps, wait for compositor paint, and retry once. Preserve retry metadata and assert unchanged simulation time. A still that remains black fails the machine report. No pose/camera/teleport/reset changes to obtain a successful image.

Audit the three hub videos on the GPU container with its already-required ffmpeg blackdetect, flag any >=.02s all-black segment. Preserve detection logs/intervals in video report; do not auto-retry whole videos or silently ignore black footage. Local ffmpeg is absent; no install/local browser/render is requested. CPU source/syntax checks and remote replay are required. This is capture integrity, not art approval.

Sol fallback source/design review before implementation; Opus local quota06:40. Keep current paint/light/game unchanged while fixing this harness issue.

Sol design fixes: preserve native rAF before disabling the game loop, use two native paint callbacks with timeout and host elapsed time; retain camera/fox/bone/state digests around retry. Explicit video thresholds d=.02,pix_th=.02,pic_th=.999, detector errors fail, terminal intervals are retained. Route hub video PNG keyframes through the same still guard. No normal rAF wait or simulation step is used.

Source review fixes: sticky context-loss flag plus pre/post still health checks; ffmpeg timeout60s with status/error/signal saved. A complementary blackframe filter (99percent belowY20) logs exact zero-based frame indices; group runs through lastFrame+1 at encoded fps, so EOF display duration is counted. CPU fixtures cover terminal two-frame60fps, single-frame30/60fps and gaps. FFmpeg primary-source options/log format verified at https://github.com/FFmpeg/FFmpeg/blob/master/libavfilter/vf_blackframe.c . Helper is packaged and covered by static-import guard. No browser or video execution occurred locally.

02:07 driver integration: main now canonically mounts tools/*.mjs and supplies capture-module-packaging.py. Keep that single mount/checker path, remove this branch older literal-only checker, and let the glob package hub-black-frames.mjs. Preserve duplicate-destination assertion and recursive dependency checks. Latest driver explicitly requests build-clean main landing; that does not constitute visual acceptance or Opus approval.
