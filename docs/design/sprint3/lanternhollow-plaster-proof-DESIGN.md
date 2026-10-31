# Matched plaster proof requested by Opus

Opus requires an old/new plaster pair at the same natural and hero cameras, with only the walls changing. Earlier b458 default1 vs current2.5 lights/hearth cannot isolate paint. No floor code is authorized by this document.

Capture-only comparison: at each existing natural-spawn and hero shot, drain visual time, record camera/bone/state and all other material color/emission snapshots, temporarily multiply only rv-hub-plaster material.color by linearRGB(c0ac86)/linearRGB(d5c7ad), render with zero simulation steps and save old-paint PNG; restore exact entry material.color for new-paint PNG. All current vertex colors are derived from the same base plaster, so the channel ratio reproduces old tint including the existing Archive main-wall.92 multiplier. Small Float32 differences are not a game-state change.

Preserve fixed2.5 lighting, current hearth, fox pose, camera and restoration state. Record actual material UUID/color, ratios, named variant, window.__game and invariant proof for each image. Finally restore exact entry color and zero-step render even on failure. Missing material, changed pose/state/other material colors or failed restoration fails capture. All stills use the existing black-image/context guard. Natural15s chase stays unstaged and unchanged after restoration.

No game code, material default, geometry, shader, mesh count or light change. JS syntax/source review, immutable pushedSHA and personal PNG/game inspection are required. Exact old/new proof resolves an Opus request; it does not establish final quality.
