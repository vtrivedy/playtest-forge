# Ashwater drained-bed mist follow-up

Candidate runtime: `3b559ea68037620e6120c272cceb473e86d58f90`.

## Root cause established

The old roof-trigger view was veiled by the two horizontal mist sheets, not the
roof's occlusion registration. The sheets sit at y=-0.12 and +0.12; the drained
channel bed and fox feet sit at y=-1. A chase lens at y=0.35 therefore looks
through both sheets toward the fox.

On unchanged `e1a2df01` runtime, a staged Ashwater spawn followed by ordinary
stick/dash inputs reaches the west roof. Compare [baseline](roof-baseline-staged.png)
and [mist disabled only](roof-isolation-staged.png): identical camera/fox pose,
with saturated fur and muddy bed restored when the two sheet material opacities
are zeroed and the frame rendered again. This is a staged-start diagnostic, not
fresh hub-entry proof. [Full isolation state and sheet positions](isolation-state.json).

## Change

`AshwaterMistMaterial` feathers alpha to zero over canonical drainable WATER
rectangles, with a 1.25m bank transition. The mask uses world coordinates, so
rotating mist textures do not move the clear areas. The pond and land retain
mist. A distinct material type on the mist-sheet collection prevents replacing
it with an unmasked basic material without a TypeScript error. No controller,
collision, audio or progression changes.

TypeScript, production Vite build, feel/camera/world lint and whitespace checks
pass. The build retains its existing chunk-size warning.

## Exact-source physical replay

Fresh Chromium/Tesla T4/EGL, 640×360, pinned `3b559ea6`: opening invitation →
page returned home → physical hub arch → all three Ashwater puzzles → both side
memories → Reedskim → filled Reed Seedwell → native Album. PASS, zero page or
console errors. The ordinary route includes the sinking-mat failure/reset,
cistern flood, punt and shelf; no placement or progress setters.
[Selected complete hook and window.__game snapshots](state-evidence.json).
Complete evidence: `keeping-swarm5-captures/reed/world-entry-3b559ea680/`.

Personally inspected [matched roof frame](roof-3b559ea6.png): saturated fox and
muddy bed restored; the broad grey veil is gone. The roof itself remains cropped
on the right, so the side-place composition remains open. [Arrival](arrival-3b559ea6.png)
retains rain, low mist and the cool marsh palette. [Shelf](shelf-3b559ea6.png)
keeps the fox clear; [Seedwell](seedwell-3b559ea6.png) retains the clear muzzle and
distinct caption/toast. Its pale close-up column still needs art direction.

The six-second, offline 12fps [walking clip](marsh-walk-3b559ea6.mp4) has
[zero black frames among 72 decoded frames](walk-blackcheck.json). Personally
inspected [all 72 frames](walk-all-72.jpg): the fox remains readable through the
turn; reeds briefly cross it. This bounded clip does not prove whole-route
camera safety or real-time performance. Pools remain geometric and terrain
sparse. No overall visual-quality, unfamiliar-player insight or requested
30–45-minute duration approval.
