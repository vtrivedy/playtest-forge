---------------------------- MODULE Discovery ----------------------------
EXTENDS Integers, TLC
VARIABLES catches, leg
vars == <<catches, leg>>
Bands == <<{"page"}, {"gate", "entry", "middle", "high", "roost"},
           {"grove", "fold1", "jump1", "fold2", "jump2", "jump3", "catch"}, {"done"}>>
First == <<"page", "gate", "grove", "done">>
Successor == [l \in {"gate", "entry", "middle", "high", "grove", "fold1", "jump1", "fold2", "jump2", "jump3"} |->
 CASE l = "gate" -> "entry"
 [] l = "entry" -> "middle"
 [] l = "middle" -> "high"
 [] l = "high" -> "roost"
 [] l = "grove" -> "fold1"
 [] l = "fold1" -> "jump1"
 [] l = "jump1" -> "fold2"
 [] l = "fold2" -> "jump2"
 [] l = "jump2" -> "jump3"
 [] OTHER -> "catch"]
Init == catches = 0 /\ leg = "page"
\* Only the world's successful-catch action advances catches, never guidance.
WorldCatch == catches < 3 /\ catches' = catches + 1 /\ leg' = First[catches' + 1]
\* Arrival requires actual trigger/contact/landing in TypeScript, not proximity in flight.
Arrive == leg \in DOMAIN Successor /\ leg' = Successor[leg] /\ UNCHANGED catches
Retry == catches \in {1, 2} /\ leg' = (IF catches = 1 THEN "entry" ELSE "jump1") /\ UNCHANGED catches
Next == WorldCatch \/ Arrive \/ Retry
Spec == Init /\ [][Next]_vars
TypeOK == catches \in 0..3 /\ leg \in UNION {Bands[i] : i \in 1..4}
MatchesWorld == leg \in Bands[catches + 1]
DoneOnlyKept == (leg = "done") <=> (catches = 3)
KeptStable == [] (catches = 3 => [] (leg = "done" /\ catches = 3))
=============================================================================
