---------------------------- MODULE TeachOrder ----------------------------
EXTENDS Integers, TLC
\* One active-chase frame near H-a. The late page offer must beat the earlier hearth offer.
\* chosen models this frame's drawn instruction. Panel opacity is outside the model and must not defer choosing the current words.
VARIABLES cursor, pending, chosen, published
vars == <<cursor, pending, chosen, published>>
Init == cursor = 0 /\ pending = "none" /\ chosen = "none" /\ published = FALSE
HearthOffer == ~published /\ cursor = 0 /\ cursor' = 1 /\ pending' = "hearth" /\ UNCHANGED <<chosen, published>>
PageOffer == ~published /\ cursor = 1 /\ cursor' = 2 /\ pending' = "page" /\ UNCHANGED <<chosen, published>>
Publish == ~published /\ cursor = 2 /\ chosen' = pending /\ published' = TRUE /\ UNCHANGED <<cursor, pending>>
Next == HearthOffer \/ PageOffer \/ Publish
Spec == Init /\ [][Next]_vars
TypeOK == cursor \in 0..2 /\ pending \in {"none", "hearth", "page"} /\ chosen \in {"none", "hearth", "page"} /\ published \in BOOLEAN
LatestOfferWins == published => (cursor = 2 /\ chosen = "page")
=============================================================================
