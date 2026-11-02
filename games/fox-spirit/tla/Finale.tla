------------------------------- MODULE Finale -------------------------------
(***************************************************************************
 The Keeping's finale at the Scribe's Press (src/opening/finale.ts,
 DESIGN-finale.md).

 The one persistent ember (carry.ts) is somewhere: carried by the fox, set
 down elsewhere, or set down in the Press cradle. The Press is sealed until
 the first Keeping has settled (the Hearthtree bridge exists). Warmth in the
 cradle starts one latched, automatic sequence:
   sealed -> warming -> unbinding -> open -> released -> snow
 Once released, each pressed kit pops out of the Album, trots to the cradle
 and curls up. The end card shows exactly once, in snow, with every kit
 curled and the fox resting by the cradle (or after a grace timeout, so it is
 never missed). After the card the player keeps free play.

 Abstractions: continuous space, timers and the fox's walk are collapsed to
 discrete steps; "Rest" is the fox standing still near the cradle; "Timeout"
 is the grace timer expiring.
 ***************************************************************************)
EXTENDS Naturals, FiniteSets

CONSTANTS Kits

Phases == <<"sealed", "warming", "unbinding", "open", "released", "snow">>
Rank(p) == CHOOSE i \in 1..6 : Phases[i] = p
EmberAt == {"carried", "ground", "cradle"}
KitPhases == {"pressed", "trotting", "curled"}

VARIABLES phase, ember, settled, kit, resting, card

vars == <<phase, ember, settled, kit, resting, card>>

TypeOK ==
  /\ phase \in {Phases[i] : i \in 1..6}
  /\ ember \in EmberAt
  /\ settled \in BOOLEAN
  /\ kit \in [Kits -> KitPhases]
  /\ resting \in BOOLEAN
  /\ card \in {"hidden", "showing", "done"}

Init ==
  /\ phase = "sealed"
  /\ ember = "ground"
  /\ settled = FALSE
  /\ kit = [k \in Kits |-> "pressed"]
  /\ resting = FALSE
  /\ card = "hidden"

\* ---- player and world actions ----------------------------------------
KeepingSettles == ~settled /\ settled' = TRUE /\ UNCHANGED <<phase, ember, kit, resting, card>>
PickUp   == ember \in {"ground", "cradle"} /\ ember' = "carried" /\ UNCHANGED <<phase, settled, kit, resting, card>>
SetDown  == ember = "carried" /\ ember' = "ground" /\ UNCHANGED <<phase, settled, kit, resting, card>>
SetInCradle == ember = "carried" /\ ember' = "cradle" /\ UNCHANGED <<phase, settled, kit, resting, card>>
Rest     == ~resting /\ resting' = TRUE /\ UNCHANGED <<phase, ember, settled, kit, card>>
Wander   == resting /\ resting' = FALSE /\ UNCHANGED <<phase, ember, settled, kit, card>>

\* ---- the latched sequence ----------------------------------------------
\* warmth in the cradle starts it, but only once the Keeping has settled
Kindle ==
  /\ phase = "sealed" /\ ember = "cradle" /\ settled
  /\ phase' = "warming"
  /\ UNCHANGED <<ember, settled, kit, resting, card>>
\* every later phase is automatic: it never waits on (or rewinds for) the ember
Advance ==
  /\ phase \notin {"sealed", "snow"}
  /\ phase' = Phases[Rank(phase) + 1]
  /\ UNCHANGED <<ember, settled, kit, resting, card>>
Pop(k) ==
  /\ Rank(phase) >= Rank("released") /\ kit[k] = "pressed"
  /\ kit' = [kit EXCEPT ![k] = "trotting"]
  /\ UNCHANGED <<phase, ember, settled, resting, card>>
Curl(k) ==
  /\ kit[k] = "trotting"
  /\ kit' = [kit EXCEPT ![k] = "curled"]
  /\ UNCHANGED <<phase, ember, settled, resting, card>>
AllCurled == \A k \in Kits : kit[k] = "curled"
ShowCard(byTimeout) ==
  /\ card = "hidden" /\ phase = "snow" /\ AllCurled
  /\ (resting \/ byTimeout)
  /\ card' = "showing"
  /\ UNCHANGED <<phase, ember, settled, kit, resting>>
HideCard ==
  /\ card = "showing" /\ card' = "done"
  /\ UNCHANGED <<phase, ember, settled, kit, resting>>

Player == KeepingSettles \/ PickUp \/ SetDown \/ SetInCradle \/ Rest \/ Wander
Auto == Kindle \/ Advance \/ (\E k \in Kits : Pop(k) \/ Curl(k)) \/ ShowCard(TRUE) \/ HideCard

Next == Player \/ Auto \/ ShowCard(FALSE)

Spec == Init /\ [][Next]_vars
  /\ WF_vars(Kindle) /\ WF_vars(Advance)
  /\ \A k \in Kits : WF_vars(Pop(k)) /\ WF_vars(Curl(k))
  /\ WF_vars(ShowCard(TRUE)) /\ WF_vars(HideCard)

\* ---- properties -------------------------------------------------------
Safe ==
  /\ TypeOK
  /\ (phase # "sealed" => settled)
  /\ (\E k \in Kits : kit[k] # "pressed") => Rank(phase) >= Rank("released")
  /\ (card # "hidden" => phase = "snow" /\ AllCurled)

\* the sequence never rewinds, and the card never re-shows
Monotone == [][ Rank(phase') >= Rank(phase)
             /\ (card = "done" => card' = "done")
             /\ (card = "showing" => card' # "hidden") ]_vars

\* warmth set down in the cradle after the Keeping always ends in the card
EndsOnce == (phase = "warming") ~> (card = "done")
\* once kindled, it stays kindled even if the ember is carried off again
Latched == [](phase # "sealed" => [](phase # "sealed"))
==============================================================================
