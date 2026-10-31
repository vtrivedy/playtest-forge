# Capture helper packaging

Observed failure: the GPU runner imported projected-visibility-capture.mjs, but
its Modal image omitted that file, preventing browser launch and all Reach evidence.
The immediate helper addition repairs today's image but leaves a manually maintained
list vulnerable to the next capture import.

Package the repository's tools/*-capture.mjs helper family automatically. Preserve
the explicit FOX_CAPTURE_SCRIPT override for the main gpu-capture.mjs runner.
No simulation, controls, pass predicates or image settings change. Validate Python
syntax and verify every relative runner/helper import resolves into the image set.
GPU evidence remains required; packaging checks do not establish visual quality.
