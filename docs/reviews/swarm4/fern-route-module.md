# Region camera probe preparation

The camera regression runner now accepts `--route-module PATH` (exports
`createSliceRoute` and `SLICE_START`) and `--check-from SECONDS`. It forwards
the route's `interact` action as E, alongside jump and dash. Runtime is unchanged.

An 8-second original-route smoke at runtime `cf84c41`, with the working-tree
capture tool update, retained 15 consecutive rendered frames and two stills.
Evidence: `/captures/fern/route-module-smoke/`; retained local copy under
`playtest-output/fox-spirit/fern-route-module/`. `evidence.json` includes
`window.__game`, source SHA, route module, staging disclosure and metric window.

Measured from 1s: minimum lens/chest range 2.483m, maximum pitch 14.64 degrees,
maximum lens speed 7.824m/s, no JS errors. All 15 skinned-body projections pass
the 2% viewport margin. Both stills and the all-frame sheet were inspected:
fox silhouette remains readable with room for ears and tail. No new camera or
locomotion behavior is claimed. This short tool check does not certify Millbrook,
which has not been pushed yet. TypeScript, feel lint and diff whitespace pass.

Example once a Millbrook route exists:

```sh
node tools/camera-drop-probe.mjs OUT .07 60 5198 \
  --route-module tools/MILLBROOK-route.mjs --check-from 1 \
  --dt 0.03333333333333333 --size 640x360 --check-camera \
  --sparse-stills --stills-at 5,30,55 \
  --clip --clip-from 20 --clip-seconds 4 --check-silhouette
```
