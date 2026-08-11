# Torn-paper particles — shader.html dissolve rework

**Date:** 2026-08-06 · **File:** `shader.html` (standalone harness, untracked)

Replaces the grain dissolve with beige torn-paper crumbs. Read `PICKUP.md` first;
this supersedes its "the dissolve" and "motes" sections and nothing else.

## The complaint

1. The black is grainy — permanent speckle in what should be flat black.
2. The dissolve spills both above and below the line.
3. It reads as pixels, not torn paper.
4. There are no beige particles at all.
5. The whole layer appears to slide up the screen with scroll.

## Why, in the current code

| symptom | cause |
|---|---|
| black is grainy | `a = fill` — alpha **is** the grain field, so black arrives as noise. `filmGrain: 0.030` and `dither: 0.010` then write noise into the region where `a` is already 1. |
| spills both ways | `cov = clamp(0.5 - dl/(2.0*zone))` centres the partial-coverage band **on** the line. At `zone: 200` that is 200px above *and* below, by construction. |
| pixel look | thresholded value noise has round isocontours. Low `grainSoft` gives square crumbs, high gives soft blobs. Neither is a torn edge. |
| no beige | flakes are *holes* in the black showing video through. Nothing paints a colour. |
| layer slides up | `gp = vec2(x, fc.y - BASE)` and `mp = vec2(x, fc.y - BASE)/ms` pin both texture fields to the moving boundary, towing them up as a rigid slab. |

## Reference measurements

From `shade ref act.mp4`. Earlier passes measured luma above the tear and found
nothing — that was blind: the page above is itself beige, so beige particles on
it register as no change. Local **variance** finds them at once.

- Paper colour **#DAD9CF** — RGB (218, 217, 207).
- Fringe above the rim: **~15-20px** of fine speckle.
- Rim: **~8-12px**, uneven along its length.
- Dense crumbs below: **~15px**, sparse stragglers to ~60px, then clean.
- Crumb size **1-4px**, angular.
- Idle life is slow: field correlation 0.98 at 0.5s, 0.78 at 4s.

The ref is tighter than this build will default to. The user wants the particles
to *be* the blend, so reach defaults wider and pulls in on sliders.

## Target

The shimmer line wrapped in a band of beige torn-paper crumbs on both sides,
thinning upward into the video and downward into clean black. **The crumbs are
the entire blend.** No dissolve zone, no haze, no motes.

## Design

### Black mask
Hard anti-aliased torn edge: `maskA = clamp(0.5 - dl/edgeAA)`, ~1.6px. Fine
raggedness (`tearAmp`, `tearScale`) added to the silhouette so the boundary under
the crumbs is not a smooth curve. Solid immediately below — no ramp.

### Particles
A **sum** of per-seed kernels over the 3×3 neighbourhood, not a nearest-seed
distance. Summing is what makes crumbs **combine**: two seeds wandering close
overlap, the sum clears threshold in the gap, and they read as one torn piece
until they part. Voronoi cannot do this — every cell keeps its wall regardless.

The lookup is then **domain-warped** by fine noise before thresholding. This is
what makes edges tear. Unwarped kernels are radial, so every crumb is a rounded
blob; Voronoi instead gives dead-straight polygon walls that read as shattered
glass. Paper tears fibrous.

Density peaks at the line, falls to zero over `partUp` / `partDown`. Density
lowers the **threshold** rather than gating the crumb, so crumbs shrink away at
the fringes instead of popping — keeping it a smooth reversible function of
scroll.

### Frame — the fix for the sliding layer
The field lives in **screen space** (`fc.y`), never `fc.y - BASE`. The frontier
sweeps *through* a stationary field. Seeds wander on their own slow ellipses in
place. `partAnchor` (0 = stationary, default) blends to boundary-anchored so the
difference is audible rather than asserted.

### Anti-aliasing
`fwidth(fld)` sets the smoothstep width, so the edge is exactly `partAA` pixels
wide at any particle size or warp setting. This is what stops the pixel look.
Requires `OES_standard_derivatives`; `#ifdef` fallback to a fixed width.

### Colour and composite
Flat paper #DAD9CF, additively lit near the line so crumbs brighten to near-white
at the rim and stay beige further out. Premultiplied:

```
a   = maskA + part*(1.0 - maskA)
rgb = paperCol * part  +  tint*(core + glow)
```

- below, no crumb → `rgb 0, a 1` → pure black
- below, crumb → beige on black
- above, no crumb → `a 0` → video untouched
- above, crumb → beige over video

The line stays additive (raises rgb, not alpha) — a true add over the video.

### Grain gating
`filmGrain` and `dither` multiply by `1 - smoothstep(0, max(reach), abs(dl))`, so
the solid black is mathematically untouched. This cannot be had by lowering the
sliders; it needs the gate.

## Removed
`zone`, `grainScale`, `grainSoft`, `grainDrift`, `grainClump`, `tailPow`,
`grainGlow`, `grainGlowW`, and the whole mote block (`moteDens`, `moteSize`,
`moteBright`, `moteReach`, `moteDrift`).

## Kept from PICKUP — do not relitigate
Quintic `noise()` interpolation (C2; cubic creases on large gradients). The line
drawn additively. Alpha dithered, not just rgb. Pure function of scroll, no
accumulated state. No haze layer. Hero parallax never pins. The `4p(1-p)` taper
that closes the frame at p=1.

## Verification
1. `node -e "…new Function(…)"` syntax check — backticks in GLSL kill the file.
2. p=1 closes with no sliver.
3. At `p≈0.5`, alpha is exactly 1 more than `partDown` px below the edge.
4. Scrolling with `partAnchor: 0` moves the frontier, not the field.
5. Reverse scroll retraces identically.
