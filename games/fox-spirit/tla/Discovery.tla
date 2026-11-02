---------------------------- MODULE Discovery ----------------------------
EXTENDS Integers, TLC
VARIABLES catches, leg, onOverlook, finishedSafely
vars == <<catches, leg, onOverlook, finishedSafely>>
Routes == {"grove", "fold1", "jump1", "fold2", "jump2", "jump3", "catch"}
Bands == <<{"page"}, {"gate", "entry", "middle", "high", "roost"},
           Routes, (Routes \ {"grove", "catch"}) \cup {"land", "done"}>>
First == <<"page", "gate", "grove", "land">>
Successor == [l \in {"gate", "entry", "middle", "high", "grove", "fold1", "jump1", "fold2", "jump2"} |->
 CASE l = "gate" -> "entry"
 [] l = "entry" -> "middle"
 [] l = "middle" -> "high"
 [] l = "high" -> "roost"
 [] l = "grove" -> "fold1"
 [] l = "fold1" -> "jump1"
 [] l = "jump1" -> "fold2"
 [] l = "fold2" -> "jump2"
 [] OTHER -> "jump3"]
Init == catches = 0 /\ leg = "page" /\ onOverlook = FALSE /\ finishedSafely = FALSE
\* Catching the world page is independent of landing. Guide remains available in the air.
WorldCatch == catches < 3 /\ catches' = catches + 1 /\ leg' = First[catches' + 1]
              /\ UNCHANGED <<onOverlook, finishedSafely>>
Arrive == leg \in DOMAIN Successor /\ leg' = Successor[leg] /\ UNCHANGED <<catches, onOverlook, finishedSafely>>
ArriveBeforeCatch == catches = 2 /\ leg = "jump3" /\ onOverlook /\ leg' = "catch" /\ UNCHANGED <<catches, onOverlook, finishedSafely>>
\* Actual same-frame ground contact supplies the completion proof; proximity/kept alone cannot.
Finish == catches = 3 /\ leg # "done" /\ onOverlook /\ leg' = "done" /\ finishedSafely' = onOverlook /\ UNCHANGED <<catches, onOverlook>>
Retry == catches \in {1, 2, 3} /\ leg # "done" /\ ~onOverlook
         /\ leg' = (IF catches = 1 THEN "entry" ELSE "jump1") /\ UNCHANGED <<catches, onOverlook, finishedSafely>>
Move == onOverlook' = ~onOverlook /\ UNCHANGED <<catches, leg, finishedSafely>>
Next == WorldCatch \/ Arrive \/ ArriveBeforeCatch \/ Finish \/ Retry \/ Move
Spec == Init /\ [][Next]_vars
TypeOK == catches \in 0..3 /\ leg \in UNION {Bands[i] : i \in 1..4} /\ onOverlook \in BOOLEAN /\ finishedSafely \in BOOLEAN
MatchesWorld == leg \in Bands[catches + 1]
DoneOnlyKept == leg = "done" => catches = 3
DoneAfterLanding == leg = "done" => finishedSafely
DoneStable == [] (leg = "done" => [] (leg = "done"))
=============================================================================
