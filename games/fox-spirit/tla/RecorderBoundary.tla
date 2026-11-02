-------------------------- MODULE RecorderBoundary --------------------------
EXTENDS Naturals
CONSTANT Broken
VARIABLES phase, fresh, copyBright, publishedBright
vars == <<phase, fresh, copyBright, publishedBright>>
Init == /\ phase = "idle"
        /\ fresh = FALSE
        /\ copyBright = FALSE
        /\ publishedBright = TRUE
Render == /\ phase = "idle"
          /\ phase' = "rendered"
          /\ fresh' = TRUE
          /\ UNCHANGED <<copyBright, publishedBright>>
Copy == /\ phase = "rendered"
        /\ phase' = "copied"
        /\ copyBright' = fresh
        /\ UNCHANGED <<fresh, publishedBright>>
Discard == /\ (phase = "copied" \/ (Broken /\ phase = "rendered"))
           /\ fresh' = FALSE
           /\ UNCHANGED <<phase, copyBright, publishedBright>>
Publish == /\ phase = "copied"
           /\ phase' = "idle"
           /\ publishedBright' = copyBright
           /\ UNCHANGED <<fresh, copyBright>>
Stop == /\ phase # "stopped"
        /\ phase' = "stopped"
        /\ UNCHANGED <<fresh, copyBright, publishedBright>>
Next == Render \/ Copy \/ Discard \/ Publish \/ Stop \/ (phase = "stopped" /\ UNCHANGED vars)
Spec == Init /\ [][Next]_vars
TypeOK == /\ phase \in {"idle", "rendered", "copied", "stopped"}
          /\ fresh \in BOOLEAN /\ copyBright \in BOOLEAN /\ publishedBright \in BOOLEAN
NoBlackPublication == publishedBright
StoppedStable == [](phase = "stopped" => [] (phase = "stopped"))
=============================================================================
