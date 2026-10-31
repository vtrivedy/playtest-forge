# Remote capture helper packaging repair

Returned d46255c GPU25af5ac3d638 fails beforeboot:ERR_MODULE_NOT_FOUND /opt/browser/water-wade-capture.mjs. Main imported the water helper statically from gpu-capture.mjs, but Modal image mounts only the other sibling helper modules. This affects everyshot,includinghub,regardlessofwhichstageisrequested.

Add the existing helper to the Modal image using the same source/destination convention as existing capture modules. No browser/render/gamechange. Verify Python syntax without importing Modal and statically check every relative capture import has a matching packageddestination+existingrepositorysource. Retain immutablecaptureSHA+toolidentitychecks; do not bypass a failedcapture as success. Driver should use the requestedSHA's Modal entrypoint as well asJS tool.
