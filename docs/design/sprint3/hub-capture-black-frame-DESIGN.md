# Hub capture black-frame evidence guard

Own PNG inspection found b458abc hub-well.png is entirely black despite a green machine report; immediate zero-step well comparison frames render normally. No visible-game assertion currently checks captured pixels. Do not label that original package fully accepted.

For hub stills only, inspect a downsample of the actual screenshot bytes with a fresh two-dimensional canvas in the remote browser (never request another context from Three's canvas). If all sampled RGB channels are <=3, preserve the original as a named black-attempt PNG, record metrics/time, render once at zero simulation steps, wait for compositor paint, and retry once. Preserve retry metadata and assert unchanged simulation time. A still that remains black fails the machine report. No pose/camera/teleport/reset changes to obtain a successful image.

Audit the three hub videos on the GPU container with its already-required ffmpeg blackdetect, flag any >=.02s all-black segment. Preserve detection logs/intervals in video report; do not auto-retry whole videos or silently ignore black footage. Local ffmpeg is absent; no install/local browser/render is requested. CPU source/syntax checks and remote replay are required. This is capture integrity, not art approval.

Sol fallback source/design review before implementation; Opus local quota06:40. Keep current paint/light/game unchanged while fixing this harness issue.
