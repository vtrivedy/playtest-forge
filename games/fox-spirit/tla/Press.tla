---------------------------- MODULE Press ----------------------------
(* The Scribe's Press (opening/press.hot.ts): three gates the fox opens with what it has.
   zone: where the fox stands — margin (spawn side of the ink ridge), floor (between ridge and shelf),
         shelf (on the Archive shelf), ledge (Wellspring ledge).
   warm: carried warmth from a brazier (fades: Cool may happen at any time).
   Safety: progress is monotone and only follows its physical cause; the seal never re-freezes.
   Liveness: under fairness of the fox's own actions, the combine level is eventually restored (no softlock),
   whatever order warmth is fetched or lost in. *)
EXTENDS Naturals
VARIABLES zone, warm, seal, draft1, ice2, draft2, done
vars == <<zone, warm, seal, draft1, ice2, draft2, done>>

Init == zone = "margin" /\ warm = FALSE /\ seal = "frozen" /\ draft1 = FALSE
        /\ ice2 = TRUE /\ draft2 = FALSE /\ done = 0

\* braziers: one on the margin, one on the shelf
Warm(at) == zone = at /\ warm' = TRUE /\ UNCHANGED <<zone, seal, draft1, ice2, draft2, done>>
Cool   == warm /\ warm' = FALSE /\ UNCHANGED <<zone, seal, draft1, ice2, draft2, done>>
\* teach: touching the seal while warm thaws it (and spends the warmth); crossing completes level 1
Thaw   == zone = "margin" /\ warm /\ seal = "frozen" /\ seal' = "open" /\ warm' = FALSE
          /\ UNCHANGED <<zone, draft1, ice2, draft2, done>>
Cross  == zone = "margin" /\ seal = "open" /\ zone' = "floor" /\ done' = (IF done < 1 THEN 1 ELSE done)
          /\ UNCHANGED <<warm, seal, draft1, ice2, draft2>>
Back   == zone = "floor" /\ zone' = "margin" /\ UNCHANGED <<warm, seal, draft1, ice2, draft2, done>>
\* develop: an air-dash over the membrane (needs Inkstep = level 1 done) cracks a draft that never closes
Crack1 == zone = "floor" /\ done >= 1 /\ ~draft1 /\ draft1' = TRUE /\ UNCHANGED <<zone, warm, seal, ice2, draft2, done>>
Ride1  == zone = "floor" /\ draft1 /\ zone' = "shelf" /\ done' = (IF done < 2 THEN 2 ELSE done)
          /\ UNCHANGED <<warm, seal, draft1, ice2, draft2>>
Drop   == zone = "shelf" /\ zone' = "floor" /\ UNCHANGED <<warm, seal, draft1, ice2, draft2, done>>
\* combine: warmth melts the iced membrane, then an air-dash cracks it
Melt2  == zone = "shelf" /\ warm /\ ice2 /\ ice2' = FALSE /\ warm' = FALSE /\ UNCHANGED <<zone, seal, draft1, draft2, done>>
Crack2 == zone = "shelf" /\ ~ice2 /\ ~draft2 /\ draft2' = TRUE /\ UNCHANGED <<zone, warm, seal, draft1, ice2, done>>
Ride2  == zone = "shelf" /\ draft2 /\ zone' = "ledge" /\ done' = 3 /\ UNCHANGED <<warm, seal, draft1, ice2, draft2>>

Next == Warm("margin") \/ Warm("shelf") \/ Cool \/ Thaw \/ Cross \/ Back \/ Crack1 \/ Ride1 \/ Drop \/ Melt2 \/ Crack2 \/ Ride2
\* the player keeps trying the forward actions; Cool and the backward moves stay unfair (any order of losses)
Spec == Init /\ [][Next]_vars /\ SF_vars(Warm("margin")) /\ SF_vars(Warm("shelf")) /\ SF_vars(Thaw) /\ SF_vars(Cross) /\ SF_vars(Crack1)
        /\ SF_vars(Ride1) /\ SF_vars(Melt2) /\ SF_vars(Crack2) /\ SF_vars(Ride2)

TypeOK == zone \in {"margin", "floor", "shelf", "ledge"} /\ warm \in BOOLEAN /\ seal \in {"frozen", "open"}
          /\ draft1 \in BOOLEAN /\ ice2 \in BOOLEAN /\ draft2 \in BOOLEAN /\ done \in 0..3
\* progress only follows its physical cause
Caused == /\ (done >= 1 => seal = "open")
          /\ (done >= 2 => draft1)
          /\ (done >= 3 => draft2 /\ ~ice2)
          /\ (zone \in {"floor", "shelf", "ledge"} => seal = "open")
          /\ (draft2 => ~ice2)
Monotone == [][done' >= done /\ (seal = "open" => seal' = "open")]_vars
Finishes == <>(done = 3)
=============================================================================
