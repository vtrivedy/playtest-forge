------------------------ MODULE CameraEnvelope ------------------------
EXTENDS Naturals
VARIABLES mode, stage, checked, published
vars == <<mode, stage, checked, published>>
Init == /\ mode = "follow" /\ stage = "raw" /\ checked = FALSE /\ published = FALSE
Choose == /\ stage = "raw" /\ mode' \in {"follow", "shot"}
          /\ stage' = "floor" /\ UNCHANGED <<checked, published>>
Floor == /\ stage = "floor" /\ stage' = "envelope" /\ checked' = FALSE
         /\ UNCHANGED <<mode, published>>
Envelope == /\ stage = "envelope" /\ stage' = "ready" /\ checked' = (mode = "follow")
            /\ UNCHANGED <<mode, published>>
Publish == /\ stage = "ready" /\ (mode = "follow" => checked)
           /\ published' = TRUE /\ stage' = "published" /\ UNCHANGED <<mode, checked>>
Done == /\ stage = "published" /\ UNCHANGED vars
Next == Choose \/ Floor \/ Envelope \/ Publish \/ Done
Spec == Init /\ [][Next]_vars /\ WF_vars(Choose) /\ WF_vars(Floor)
        /\ WF_vars(Envelope) /\ WF_vars(Publish)
TypeOK == /\ mode \in {"follow", "shot"}
          /\ stage \in {"raw", "floor", "envelope", "ready", "published"}
          /\ checked \in BOOLEAN /\ published \in BOOLEAN
FollowChecked == (published /\ mode = "follow") => checked
EventuallyPublished == <>published
=============================================================================
