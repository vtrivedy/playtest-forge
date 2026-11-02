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
