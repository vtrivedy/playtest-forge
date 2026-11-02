---------------------------- MODULE Hearthsong ----------------------------
\* Conductor of the synthesized score (src/opening/music/hearthsong.worklet.ts, `Conductor`).
\* Granularity: one Bar step = one bar line. Cues arrive between bar lines (Cue).
\* The song never resets: `bar` walks the tune (0..TuneBars-1) then a breath (BreathBars), forever.
\* A swell (the lead singing the tune from wherever it is) may only start on a bar line inside the tune,
\* never overlaps another, needs GapBars since the last start, and always ends and rests.
EXTENDS Naturals

CONSTANTS TuneBars, BreathBars, SingBars, FadeBars, GapBars

VARIABLES bar, section, swell, left, since, startedOk

vars == <<bar, section, swell, left, since, startedOk>>
Swells == {"idle", "armed", "singing", "fading"}

Init ==
  /\ bar = 0 /\ section = "tune"
  /\ swell = "idle" /\ left = 0
  /\ since = GapBars        \* the first moment may sing at once
  /\ startedOk = TRUE

\* a moment happens (hearth lit, page caught, ...): accepted only when the music has rested long enough
Cue ==
  /\ swell = "idle" /\ since >= GapBars
  /\ swell' = "armed"
  /\ UNCHANGED <<bar, section, left, since, startedOk>>

\* a cue that arrives too soon is dropped (no backlog): modelled as a stutter, nothing changes

NextPos ==
  IF section = "tune"
  THEN IF bar + 1 < TuneBars THEN <<bar + 1, "tune">> ELSE <<0, "breath">>
  ELSE IF bar + 1 < BreathBars THEN <<bar + 1, "breath">> ELSE <<0, "tune">>

Tick == IF since < GapBars THEN since + 1 ELSE since

Bar ==
  LET p == NextPos IN
  /\ bar' = p[1] /\ section' = p[2]
  /\ CASE swell = "armed" /\ p[2] = "tune" ->
            /\ swell' = "singing" /\ left' = SingBars
            /\ startedOk' = (since >= GapBars)
            /\ since' = 0
       [] swell = "singing" /\ (left <= 1 \/ p[2] = "breath") ->
            /\ swell' = "fading" /\ left' = FadeBars /\ UNCHANGED startedOk /\ since' = Tick
       [] swell = "singing" ->
            /\ swell' = "singing" /\ left' = left - 1 /\ UNCHANGED startedOk /\ since' = Tick
       [] swell = "fading" /\ left <= 1 ->
            /\ swell' = "idle" /\ left' = 0 /\ UNCHANGED startedOk /\ since' = Tick
       [] swell = "fading" ->
            /\ swell' = "fading" /\ left' = left - 1 /\ UNCHANGED startedOk /\ since' = Tick
       [] OTHER -> UNCHANGED <<swell, left, startedOk>> /\ since' = Tick

Next == Cue \/ Bar

Spec == Init /\ [][Next]_vars /\ WF_vars(Bar)

TypeOK ==
  /\ section \in {"tune", "breath"}
  /\ bar \in 0..(TuneBars - 1)
  /\ (section = "breath" => bar < BreathBars)
  /\ swell \in Swells
  /\ left \in 0..SingBars + FadeBars
  /\ since \in 0..GapBars

Safe ==
  /\ TypeOK
  \* the lead only sings inside the tune (there is nothing to sing in a breath)
  /\ (swell = "singing" => section = "tune")
  \* every swell that ever started respected the gap
  /\ startedOk
  \* a swell (sing + fade) is over before the next may be accepted
  /\ (swell \in {"singing", "fading"} => since < GapBars)

\* liveness: an accepted cue eventually sings, and every swell eventually rests
ArmedSings == (swell = "armed") ~> (swell = "singing")
SwellRests == (swell # "idle") ~> (swell = "idle")
\* the song keeps going: the breath always comes back to the tune
SongContinues == []<>(section = "tune" /\ bar = 0)
=============================================================================
