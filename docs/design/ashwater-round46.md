# Reach round 46 — continuous spillway fade

Before code: address Opus round45 shader findings, without changing traversal or bank collision. Replace disjoint boolean angular mask with a continuous feathered interval spanning the missing bank arc. Begin/end feathering under neighbouring bank cover; eliminate the 206-degree hole and 303-degree hard seam. Use that same weight for foam suppression. Remove overwritten alpha and unused radius. Correct the stale claim that the HIGH surface is supported across spillways.

The bare HIGH edge over the LOW floor is an unresolved visual risk, not solved by alpha. Require matched low-angle HIGH/LOW GPU PNGs and window.__game; no local render or visual approval. Existing queued captures remain useful comparisons. TypeScript and fox Vite must pass; request immutable pushed candidate.
