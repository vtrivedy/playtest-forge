# Lanternhollow sun-disc follow-up — investigation only

Keep3ffbcee game stable while its GPU request is pending. Source audit explains a remaining risk in the rejected87daylight: skyScale darkens gradient colors but leaves the sun radiance unchanged. The sky disc always adds sunColor×1.6, independently of sunBloom. main sunSize=.005 is a dot-product threshold; outer radius acos(1-.0125)≈9.1degrees, far wider than a restrained stylized dusk disc. Reducing bloom alone cannot fix that disc.

If the fresh capture still reads afternoon, scope the correction to createHubDusk, preserving exact outside-region restoration. Candidate scalar controls: sunScale .3, sunSize .0003 (outer radius≈2.2degrees). Save/clone original sunColor and original sunSize at creation, apply blend without compounding, restore exactly at k0. sunColor is shared with distant-land uniforms, so usecopy/multiplyScalar on the saved original to keep haze coherent; do not replace the Color object. No exposure/fog-density change.

A lower sun direction would require synchronizing sky and rim and checking shared distant-land behavior. Current sky elevation≈9.7degrees, while shadow key is already a separate fill azimuth. Do not move only the disc as a quick cosmetic fix. A coordinated elevation target near2degrees is a second option if dimming/size still reads daytime.

Before code: inspect fresh image; Opus critique this narrower proposal. Add dusk tests for1000updates and exact sunColor/sunSize restoration; expose tunables inGUI; GPU same shots to assess sky/lantern contrast and far-land horizon. This document is a proposal, not an implemented or approved look.
