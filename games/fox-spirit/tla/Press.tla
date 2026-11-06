---------------------------- MODULE Press ----------------------------
(* The Scribe's Press (opening/press.hot.ts): three gates the fox opens with what it has.
   zone: where the fox stands — margin (spawn side of the ink ridge), floor (between ridge and shelf),
         shelf (on the Archive shelf), pillar (top of the page pillar by the iced membrane), ledge (Wellspring ledge).
   Combine (DESIGN-sumiro-play.md): warmth melts the ice, an air-dash cracks a SHORT draft that reaches the pillar
   but not the ledge; warmth carried up the draft kindles the pillar's brazier (high); its heat runs the seam and the
   pressed stair stands (stair); the stair is the only way onto the ledge.
   WarmRides: whether carried warmth survives the draft ride (the game: TRUE). PressNoWarmRide.cfg sets it FALSE
   and Finishes must fail — the combine needs the insight that warmth and Inkstep work together.
   warm: carried warmth from a brazier (fades: Cool may happen at any time).
   Safety: progress is monotone and only follows its physical cause; the seal never re-freezes.
   Liveness: under fairness of the fox's own actions, the combine level is eventually restored (no softlock),
   whatever order warmth is fetched or lost in. *)
EXTENDS Naturals
CONSTANT WarmRides
VARIABLES zone, warm, seal, draft1, ice2, draft2, high, stair, done
vars == <<zone, warm, seal, draft1, ice2, draft2, high, stair, done>>
world == <<seal, draft1, ice2, draft2, high, stair>>

Init == zone = "margin" /\ warm = FALSE /\ seal = "frozen" /\ draft1 = FALSE
        /\ ice2 = TRUE /\ draft2 = FALSE /\ high = FALSE /\ stair = FALSE /\ done = 0

\* lit braziers: one on the margin, the shelf chain, and the pillar's once kindled (lit braziers never go out)
Warm(at) == zone = at /\ (at = "pillar" => high) /\ warm' = TRUE /\ UNCHANGED <<zone, world, done>>
Cool   == warm /\ warm' = FALSE /\ UNCHANGED <<zone, world, done>>
\* teach: touching the seal while warm thaws it (and spends the warmth); crossing completes level 1
Thaw   == zone = "margin" /\ warm /\ seal = "frozen" /\ seal' = "open" /\ warm' = FALSE
          /\ UNCHANGED <<zone, draft1, ice2, draft2, high, stair, done>>
Cross  == zone = "margin" /\ seal = "open" /\ zone' = "floor" /\ done' = (IF done < 1 THEN 1 ELSE done)
          /\ UNCHANGED <<warm, world>>
Back   == zone = "floor" /\ zone' = "margin" /\ UNCHANGED <<warm, world, done>>
\* develop: an air-dash over the membrane (needs Inkstep = level 1 done) cracks a draft that never closes
Crack1 == zone = "floor" /\ done >= 1 /\ ~draft1 /\ draft1' = TRUE /\ UNCHANGED <<zone, warm, seal, ice2, draft2, high, stair, done>>
Ride1  == zone = "floor" /\ draft1 /\ zone' = "shelf" /\ done' = (IF done < 2 THEN 2 ELSE done)
          /\ UNCHANGED <<warm, world>>
Drop   == zone = "shelf" /\ zone' = "floor" /\ UNCHANGED <<warm, world, done>>
\* combine: warmth melts the iced membrane, then an air-dash cracks its short draft
Melt2  == zone = "shelf" /\ warm /\ ice2 /\ ice2' = FALSE /\ warm' = FALSE /\ UNCHANGED <<zone, seal, draft1, draft2, high, stair, done>>
Crack2 == zone = "shelf" /\ ~ice2 /\ ~draft2 /\ draft2' = TRUE /\ UNCHANGED <<zone, warm, seal, draft1, ice2, high, stair, done>>
\* the short draft reaches the pillar's top (never the ledge); warmth rides along if WarmRides
RideUp == zone = "shelf" /\ draft2 /\ zone' = "pillar" /\ warm' = (warm /\ WarmRides) /\ UNCHANGED <<world, done>>
DropP  == zone = "pillar" /\ zone' = "shelf" /\ UNCHANGED <<warm, world, done>>
\* the pillar's brazier only takes a flame from its own height; once lit, the seam runs and the stair stands
Kindle == zone = "pillar" /\ warm /\ ~high /\ high' = TRUE /\ UNCHANGED <<zone, warm, seal, draft1, ice2, draft2, stair, done>>
Stand  == high /\ ~stair /\ stair' = TRUE /\ UNCHANGED <<zone, warm, seal, draft1, ice2, draft2, high, done>>
Climb  == zone = "shelf" /\ stair /\ zone' = "ledge" /\ done' = 3 /\ UNCHANGED <<warm, world>>

Next == Warm("margin") \/ Warm("shelf") \/ Warm("pillar") \/ Cool \/ Thaw \/ Cross \/ Back \/ Crack1 \/ Ride1 \/ Drop
        \/ Melt2 \/ Crack2 \/ RideUp \/ DropP \/ Kindle \/ Stand \/ Climb
\* the player keeps trying the forward actions (RideUp right after warming: the goal-directed ride); Cool and the
\* backward moves stay unfair (any order of losses). DropP is fair once there is nothing to light up there.
Spec == Init /\ [][Next]_vars /\ SF_vars(Warm("margin")) /\ SF_vars(Warm("shelf")) /\ SF_vars(Thaw) /\ SF_vars(Cross)
        /\ SF_vars(Crack1) /\ SF_vars(Ride1) /\ SF_vars(Melt2) /\ SF_vars(Crack2) /\ SF_vars(RideUp /\ warm)
        /\ SF_vars(Kindle) /\ WF_vars(Stand) /\ SF_vars(DropP /\ (high \/ ~warm)) /\ SF_vars(Climb)

TypeOK == zone \in {"margin", "floor", "shelf", "pillar", "ledge"} /\ warm \in BOOLEAN /\ seal \in {"frozen", "open"}
          /\ draft1 \in BOOLEAN /\ ice2 \in BOOLEAN /\ draft2 \in BOOLEAN /\ high \in BOOLEAN /\ stair \in BOOLEAN
          /\ done \in 0..3
\* progress only follows its physical cause
Caused == /\ (done >= 1 => seal = "open")
          /\ (done >= 2 => draft1)
          /\ (done >= 3 => stair)
          /\ (stair => high)
          /\ (high => draft2 /\ ~ice2)
          /\ (zone = "pillar" => draft2)
          /\ (zone \in {"floor", "shelf", "pillar", "ledge"} => seal = "open")
          /\ (draft2 => ~ice2)
Monotone == [][done' >= done /\ (seal = "open" => seal' = "open") /\ (high => high') /\ (stair => stair')]_vars
Finishes == <>(done = 3)
=============================================================================
