# Sumiro look — authored ink places (sumiro-look, Nov 6)

Method (research-brain `sumiro-video2game.md`, binding checks): the bible stills in `refs/bible/` are the spec;
every look change is judged side-by-side against them from fixed camera spots (`tools/sumiro-look-stills.mjs`),
not by vibe. Shots below are written first, then built. No wuxia hats/swords/torii, no shrine language, no
control captions. The verb (Inkstep through a membrane) already plays (press.ts, Thistle); this pass makes the
place around it read as the bible.

## Look rules (all three worlds)
- **Ink is a material**: granulated wash (pigment settles in a world-space fbm), tide-line darkening where a wash
  blotch dries, vertical faces drip (streaks run down, darkest at the top lip), shadows go violet-grey not black.
  One patch, `inkWash.ts`, chained after the paper patch so paint/snow/contour still work.
- **Shapes cut for the wash**: tall tapering irregular masses, sagging nets, stacked slabs with uneven edges —
  never a primitive box or cone as the read.
- **Reserved accent**: ember orange is the only warm hue in the Press (fox, braziers, the pressed leaf). Ashwater's
  accent is the same ember, small (mooring lantern). No red sky streak (that's Sumiro's, not ours).
- **Paper sky**: each foreign world gets a painted backdrop ring (canvas wash: cloud blooms, distant layered
  silhouettes, paper tooth) that rides with the camera, so the horizon is a painting, not a gradient.

## The Scribe's Press — shots (bible-press.jpg)
1. **Arrival** (spawn, looking south): snowfield speckled with ink blots, the ridge ahead; behind it a forest of
   dripping ink spires with a torn net sagging between the two tallest, more spires fading into the paper sky.
2. **The Net** (west rim, low): two spires 20 m tall, mottled violet-black wash dripping into white snow skirts;
   a black web of ink strung between them, droplets flung off its strands.
3. **Page stacks** (by the ridge): bundles of pressed pages stacked like quarry stone, uneven, snow on the tops,
   leaning slabs among them.
4. **The White Margin gate**: the ink ridge reads as a wall of dried ink with runs down its face, not a black box.
5. **The Archive shelf** from the floor: the house-high sheaf of pages, granulated paper, ink tide-lines.
6. **The Press**: on the ledge, framed against the spire forest; the brazier the only warm light.
7. **Far horizon**: spire silhouettes in three washes of grey, lighter with distance, under bloomed grey-ochre
   cloud wash.

## Ashwater Reach — shots (bible-ashwater.jpg)
1. **Low Sluice** arrival: grey water channels between grassy hummocks, a timber sluice frame on the bank.
2. **Rain horizon**: misty hill silhouettes and tree clumps in wet grey wash, low cloud ceiling.
3. **Hummock banks**: mossy stones and grass tussocks along the channels instead of flat green.
4. **Reed raft / mooring**: bound poles and a leaning mast where the punt lies.

## Built (sumiro-look, Nov 6 03:30–07:27 ET)
| shot | status |
|---|---|
| Press 1 arrival | snowfield with granulated wash and blue-black ink pools; ridge and spire forest beyond |
| Press 2 the net | 15 rim formations (2–4 tiered dripping spires each), ink webs between the tallest, flung droplets |
| Press 3 page stacks | six clusters of pressed-page stacks (leaves drawn by the wash), climbable box colliders, 5 m off puzzle pieces |
| Press 4 gate | ridge in flat ink + wash; still a box with ribs (open) |
| Press 5 shelf | Archive shelf laid in page leaves by `washCourses(-h)` |
| Press 6 the Press | unchanged geometry (Thistle's); framed by the spire forest |
| Press 7 horizon | painted sphere: paper sky, three washes of spire silhouettes, drawn ground falling away past the rim |
| Ash 1 Low Sluice | tussocks thick on the banks, bank stones, the bible's sluice frame and plank gate |
| Ash 2 rain horizon | overcast painted sphere with low hills and tree clumps; drawn ground falls away past the rim |
| Ash 3 banks | tussocks + mossy stones keep off every collider and all water |
| Ash 4 raft | punt hull is lashed poles on the same footprint |
Cut: modelled willow clumps in the rain fog (read as lollipops). Open: Press ridge and Press frame still box-built;
Ashwater cistern walls are boxes laid in courses by the material; Russetvale not touched this pass.
