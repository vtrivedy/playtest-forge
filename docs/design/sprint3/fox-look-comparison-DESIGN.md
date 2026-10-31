# Fox material comparisons on the GPU relay

The c2adbd0 capture shows a dark jaw/neck seam and large coat patches. Source topology is connected across head and neck; UV edge sampling found no dark bleed. We need to distinguish real surface shading from the two fringe layers before sculpting the face.

Extend existing `fox` captures with four labelled restored-stage comparisons: face with fringe off, face with socket recovery off, three-quarter with body heat off, and three-quarter with broad fur relief off. Preserve the same staged camera, use adjacent idle frames to synchronize uniforms, record the original and overridden values, and restore each setting in `finally`. Keep the normal game settings for chase/run and the ordinary stills. These are diagnostic comparisons, not gameplay proof or an exact same-frame A/B.

Use only existing numeric `window.__gameHooks.foxLook` controls. No new gameplay toggle, capture shot family, renderer, local browser or external asset. Run Node syntax and capture packaging checks. Personally inspect the extra GPU PNGs and state values before drawing conclusions.
