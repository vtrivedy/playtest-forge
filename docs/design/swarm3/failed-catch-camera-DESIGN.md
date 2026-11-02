# Failed-catch camera recovery

Kit's real-time T4 slice run on 5247b90 fails the overlook catch and falls beside its west edge. The final 25 seconds lose the readable chase composition: the lens climbs overhead and intersects the fox. Passing fixed-60Hz successful routes do not cover this failure.

Keep the existing traversal camera and two-action controls. Preserve a readable third-person body distance after terrain/scenery collision, lens-volume correction and floor clearance. The fox may miss a catch; the camera must still show the animal and a way to retry. Do not tune the analytic spring without evidence of a spring defect.

Reproduce with the shared live runner and a staged west-overlook boundary probe (entry staging only, real movement afterward). Record camera position, collision/floor internals, fox position and window.__game; compare 60/30/20Hz. Review screenshots at the reported 65–88s window, fix the causal constraint, then replay the failing case and a successful route. Full-slice progression remains a separate acceptance check.

## Reproduced cause and gate

Rook's fixed 30Hz replay of the same genuine slice inputs reproduces 85–87° late pitch and a 0.388m minimum lens-to-chest range. The second unfolded leaf is a solid collider. The lens rests at its top + sphere clearance; all lower candidate poses cut into the platform, so fallback holds the old lens as the fox moves underneath. Try lateral escape at the previous clear height, preserving the existing spring and collider model.

`node tools/camera-drop-probe.mjs OUT .07 90 PORT --dt 0.03333333333333333 --stills-at 65,72,80,89 --size 640x360 --check-camera` records the regression. The late window (60s onward) must keep lens-to-chest distance ≥1.1m and absolute pitch <70°. Review the stills in addition to these limits. Run the existing successful 60Hz route too; the missed catch itself is not fixed by camera work.

The height-only candidate e75737a improves named stills but fails between them (82.8° transient / 1.045m minimum). Rejected as sufficient. Candidate clearance must also preserve a horizontal body envelope after interpolation, reject a held lens inside that envelope, and search the far side of the fox when the near side is trapped. Limit the geometric boom elevation to 55° while solving the existing lens volume; keep the original camera spring and world collision checks.

The body-envelope candidate ccfcc63 passes the numeric late gate (1.223m / 50.16°) but its 65s escape hides the fox behind the overlook. Reject that visual result. Score otherwise legal escape candidates by the existing three-ray scenery sightline as well as continuity; prefer the side of the platform that still shows the hero.

Keep continuity cost and the swept movement limit whenever the old lens is geometrically free, even if the moving fox has entered its body envelope. Only fallback reuse requires body clearance. Otherwise dropping all continuity at that moment can jump the camera across the fox (ccfcc63 trace: 4.36m step); body projection should instead nudge the existing lens out while preserving the escape path.
