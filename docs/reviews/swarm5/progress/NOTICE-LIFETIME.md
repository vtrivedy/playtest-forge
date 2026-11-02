# Returned-page notice lifetime

`eb8349b1` addresses Cedar's climb review: a returned-page card could remain
visible for more than25 seconds until the player opened the Album. The notice
now expires after seven simulation seconds; Tab still dismisses it immediately
and opens the selected earned memory. Expiry changes no progress or save facts.
The active scene supplies actual dt, required by the PageMap interface; the
allocation-free countdown lives in the existing hot fitting module.

`tools/page-notice-runtime.mjs` exercises the actual native scene from a labeled
rooftop placement. It triggers the real Loft pickup, progress store and Album,
not an injected UI component. This staged start does not prove the climb.
`/captures/hazel/page-notice-seven-seconds/evidence.json` completes both cases
with zero page errors:

- Natural expiry: visible after six seconds, hidden after eight; native Tab
  subsequently reads “The house before the rain”.
- Immediate dismissal: native Tab removes the pending card and opens its page;
  reopening still reads the earned memory.
- Both reloads retain the secret, start without a replayed notice, and grant no
  level completion, ability or Seedwell fill. Complete game states are retained.

Personally inspected [the notice](notice-lifetime/notice.png),
[the expired view](notice-lifetime/expired.png), and the retained memory frame.
The short notice is legible; the view clears while the Tab badge remains.
The first staged frame includes temporary cottage occlusion fading; this is not
a claim of a player-reachable viewpoint or a new roof/camera quality fix.
The earlier persistent-card critique followed by this native timing/dismissal
replay is the fix-and-retest cycle. TypeScript, Vite build, feel/camera/world lint,
progress checks and whitespace checks pass. No movement, camera or audio code
changes accompany this UI follow-up.

Latest integration also contains Maple/Reed's accepted Ashwater mist mask. The
notice/camera implementation files are unchanged by those world-art merges.
The strict all-frame finale camera gate remains a documented baseline failure
in [the terrain-camera review](../terrain-camera/REVIEW.md); this UI update does
not relabel it as passing or close duration/campaign-order gaps.
