# Lanternhollow village perimeter — implementation design

Driver00:10 asks6+cottages,path stones and market props around the well. Opus reviewed87d0732 PNGs and numeric silhouettes before code: the first southern-row proposal was rejected for cliff overhang and hidden roofs. This replaces that proposal.

Keep Bramble(-18,92) and East(12,95). Move the taller Archive from(-26,88) to(-28.5,84.4),5.6×4.6,eave2.8/rise2.1. Add a low cottage(-18,84.6),4.2×3.8,eave2.3/rise1.2; an arrival-edge cottage(-9,99.6),4.4×3.6,eave2.3/rise1.25; and an outer cottage(-37,86),5×4,eave2.5/rise1.45. The sixth helps the well/context roofline; it is mostly hidden from the low arrival lens. Acceptance depends on visible grouping rather than count.

Keep index0 for Bramble smoke/porch. Reuse existing original kit, varying roof/body dimensions. Each new solid uses matching collision, all roofs use the shared12-strip mesh/collider profile. No changes to well, pond, arch, checkpoint, H-a, spawn or controller.

Replace Archive's old lane with(-29.2,87.5)→(-24,88.3)→(-18.7,87.2)→(-14,87.8)→(-12.5,89.5); retain Bramble's doorstep lane. Arrival-edge doorstep(-9.7,102.3)→(-5.7,102.3)→(-5,100.5)→(0,94). Outer cottage doorstep(-37.7,88.7)→(-34,90)→(-32,88.5)→(-29.2,87.5). CPU sweep must verify these proposed connections against every solid prop.

Two low market stores at(-23.6,85.2),(-22.4,85.1): timber crate and small open barrel, with matching box/cylinder collision, outside trails and pond. A short run of original shallow irregular stepping stones follows the existing well lane; vertices sample ground so stones do not float. Tops project only2.5cm, below step tolerance; no separate blocking geometry or route lip.

CPU checks: roof corners>=2m inside actual jagged island; arrival-edge doorstep>=4.5m inside; every new house/woodpile corner outside pond ellipse1.5; full meadow route and all village paths clear. tsc+fox build. GPU naturalchase/closehero,arrival/idle,exits and orbit must confirm grouping, roof separation, sightline and lighting. No visual approval of unrendered geometry.

CPU sweep correction: Archive doorstep moved30cm outward toz87.5 so the0.4m fox clearance does not touch the wall collider.
The connector bends through(-14,87.8) to clear Bramble’s solid winter store; direct diagonal grazed its0.4m inflated footprint.

Fixed dressing review: remove the prior maple at(-19,82); its trunk sits24cm from the new pond-side roof and its canopy obscures the intended roof gap. The existing(-34,76) maple remains as the neighborhood tree. No replacement trunk is put into a route.
