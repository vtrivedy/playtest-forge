# Opening paint and camera visibility

The fox carries a continuous, temporary watercolor wake while walking or running. Existing ColorField aura/trail samples drive both hearth supply and the visible toon paint mask; a lit hearth uses the existing permanent restore circles. No jump is required to wake the ground. Ground projection fades above the surface so gliding does not paint a distant strip below the fox. The fox remains saturated.

The mask uses opening world bounds, a soft ragged edge, muted cel pigment and a pooled watercolor rim. Kit materials share uniforms, so cottages, leaves and meadow wake together without duplicate material systems. Paint telemetry reports trail count, local supply, distance traveled and restored region count through the opening state.

Camera visibility is local to the actual object between the chase lens and the fox. A blocker becomes translucent and loses its ink hull only while intersecting a small bundle of sight rays; unrelated houses stay opaque. Fade restores promptly after the fox clears a wall. The occlusion module supports shared materials by cloning only obstructing meshes and retaining shader callbacks.

Controls and movement remain WASD + jump + dash, hold-jump glide. Verify continuous trail in a no-jump run, compare cold/lit hearth color, inspect chase views beside house and pier, then retest the worst visual issue. Capture screenshots and window.__game on the integrated opening before landing.

Capture correction: the well edge can hide the front half of the fox while three rays around its centre remain clear. Sample the projected body width at low-body and ear heights, including the swept tail width. Preserve local object ownership and full recovery; do not fade all scenery from a camera-wide flag.

Trail review correction: threshold the soft gameplay mask into a cel interior with a narrow wet front. Use world-space multiscale fibre noise at the front and a restrained pooled rim; preserve the authored ground palette rather than tinting the whole wake amber. Compare identical smoke-route frames before/after and replay once after visual review.
