# Descending chase framing and foreground grove clearance

The full-slice roost walk-off stacks focus damping and the vertical rig spring. At touchdown the fox is 3.4 m below the lens on a 2.5 m boom, producing a steep empty-ground view. Preserve smooth horizontal chase and rising jump composition; use a separately tunable faster vertical response while descending. Compare fall lag 0.04 and 0.07 s with the shipped 0.14 s response, retaining the gentler acceptable result. Target descent view under 35 degrees down, readable fox, unchanged canopy/page route and movement metrics.

The grove foreground obstruction is owned by Flint: moved maple (-22,74) to (-19.2,70.6), candidate920b2be. Camera work stays limited to descending vertical response.

The shared camera defaults fallLag to its existing lag; only the opening player opts into 0.07 s. The faster 0.04 s variation brings no needed framing benefit, so keep the gentler 0.07 s response. Expose fallLag alongside lag in lil-gui.

Verification: exact baseline/full-slice input replay, explicit __game snapshot, chase PNGs at drop touchdown and fold approach; review and retest after the worst issue is fixed. No new movement verbs or scene content.

## Millbrook camera follow-up

Re-use the existing camera probe with a route module exporting `createSliceRoute`
and `SLICE_START`. This keeps one capture/check implementation while allowing
Millbrook's lane, mill, bridge and kiln-to-Weir glide to have their own input route.
One disclosed start placement is allowed; traversal then uses controller input.
The evidence records the module and the metric start time. Measure from the start
of the region route, excluding only its explicit initial camera-settle interval.
Keep continuous motion, two stills and `window.__game`; inspect body silhouette,
foreground obstruction and sudden boom shifts before changing camera tuning.

## Clearance and recovery

Opening compression uses a 1.9 m body clearance floor with the 2.45 m normal boom.
A matched ruin-landing trial at 1.8 m left the tail inside the screen but short of
its 2% padding in two frames; 1.9 m retains close framing and gives the tail room.
Keep this in the existing lil-gui tuning surface and the single follow rig.

A feasible final lens must be checked before bounding its next recovery step.
Share terrain lifting and swept collider/floor checks between release and escape
candidates, and search locally around the previous lens before holding. A natural
hearth → steam → root → bridge approach is mandatory: a cold released-tree start
omits the history that stranded the old lens far from the fox.

Acceptance combines minimum chest clearance, bounded pitch/speed, grounded follow
range ≤ 5 m after 1 s grounded, and projected hero height ≥ viewport height/15
(24 px at 360 px high; fail if small for more than 1 s outside authored shots).
The shared fox-size helper uses the game's rendered-lens hook. Continuous body
samples must retain the 2% viewport margin; review every frame because projection
does not prove visibility. The miss route must reach the intended jump, leave the
leaf airborne and fall below it. A camera-only pass on a stalled route is
insufficient.

Use both the full chase route and the regional drop test. The latter stages real
dashes to open both folds, then records a real walk-off and jump retries; disclose
its placements and require trace-based state checks. Keep successful catch/home,
missed jump, natural Keeping, Millbrook drop, finale hand-back and Hermitage desk
coverage when changing the compression floor. The finite ridge/post fixtures and
ordering model complement played evidence; they do not prove arbitrary recovery.
