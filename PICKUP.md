# PICKUP — shader.html

Handoff note. Read this before touching `shader.html`.

**Status:** working, unfinished, untracked in git. `file://` is fine for the
shader itself, but `hero.mp4` will not decode without a Range-capable server —
see the bottom of this file. Press `` ` `` for the panel.

---

## What it is

One effect: a **bright uneven white shimmering line** dragging a **trail of
beige torn-paper crumbs**. The band is deliberately ASYMMETRIC: below the line
is the WAKE the shimmer has already passed through (long — `partDown`), above it
is the gathering that runs ahead of it (short — `partUp`). Crumbs are stretched
along the direction of travel so the wake reads as something left behind rather
than as dust sitting there, and their brightness is set by how close they are to
the line, so the far wake dims out as if it has lost the light. The crumbs are the ENTIRE blend; there is no
dissolve zone and no haze. It does not slide up the page — it **develops**:
stretches run ahead or fall behind, and every so often a stretch leaps forward
and merges with the one in front. The crumb field itself **stays put in screen
space** while the frontier sweeps through it.

Layout is unchanged from the earlier verified build:

| | |
|---|---|
| `.hero` | fixed 100vh, holds a 114.72vh composition (Figma frame 1239/1080) |
| `.pin` | scroll room, `(env*100 + fade)vh` |
| `.black` | 130vh flat black — the extra 30vh is settled black after the fade |
| `#env` | fixed full-viewport WebGL canvas, alpha-blended on top |

Geometry is from **Figma `490:2199`** (file `B1cmOLvPovPPNLZUWg0I5s`):
frame 1920×1239 · 100vh line at y=1080 → `compH: 114.72` · vignette region
y=1080→1239 · video 2404×1357 at (−242,−59), dead centre, so it reduces to a
pure centred zoom of `mediaZoom: 1.0952`. `hero.mp4` is 3832×2164, AR 1.770795.

---

## Reference clips in the repo

| file | what it is | used for |
|---|---|---|
| `shade ref act.mp4` | 1892×410, 382f — crop of the line, idle | the line profile + the sway |
| `shade ref act moving.mp4` | 1904×616, 285f — the same thing on scroll | how it develops vs translates |
| `shade rref.mp4` | 1896×1030, 226f — Shopify Editions torn-paper edge | the ORIGINAL reference, superseded |
| `Screen Recording 2026-08-05 161716.mp4` | 582×358 | low value, never used |

**These measurements cost several video decodes. Do not redo them.**

### The crumb band, from `shade ref act.mp4`
Measured by LOCAL VARIANCE, not luma. An earlier pass thresholded brightness
above the tear, found nothing, and wrongly concluded there were no particles up
there — the page above is itself beige, so beige crumbs on it register as no
change at all. Variance finds them immediately.

- Paper is **#DAD9CF** — RGB (218, 217, 207). This is the crumb colour.
- Fringe of speckle **above** the rim: ~15–20px.
- The rim itself: ~8–12px, uneven along its length.
- Dense crumbs **below**: ~15px, stragglers to ~60px, then clean.
- Crumb size **1–4px**, angular.
- Idle life is slow: field correlation **0.98 at 0.5s**, **0.78 at 4s**.

The build deliberately runs a wider band than this (`partUp: 90`,
`partDown: 70`) because the user wants the crumbs doing the blending.

### From `shade ref act.mp4` (idle)
- Page above the boundary: luma **215.8**. Peak of the line: **239.0**, at
  **3px above** the boundary, ~8px wide. The line is genuinely *brighter* than
  the surface it sits on.
- Below it: 205 → 110 → 77 → 61 → 49 over 16px, then a grain tail to ~50px.
- Silhouette: ptp **157px**, spatial power at 450–1800px wavelengths.
- Idle sway: dominant period **12.7 SECONDS**, second at 6.4s. The line as a
  body moves **5px** ptp while single columns wobble **9.5px** — it breathes in
  place rather than drifting.

### From `shade ref act moving.mp4` (scroll)
- Per-column gain vs the line's own motion: mean 1.00, **std 0.22, range
  0.65×–1.39×**. 47.5% of columns fall outside 0.8–1.2×.
- Shape changes **0.39px for every 1px travelled**. Nowhere near rigid.
- Lurches are heavy-tailed: median 1.9px, p90 7.3px, p99 35.8px, **p99.9
  89.6px**. Leaps land in **6.2% of frames** and take **~150 of 1904 columns**
  at once — they arrive as patches, never single columns.

### From `shade rref.mp4` (the old torn-paper reference)
Kept only because it explains the earlier build. Its edge is a static texture
that only translates — measured **0.00px** silhouette change across every
static-scroll frame pair; its liveliness is the artwork's starfield behind it.
It also **pins** (tear moves 46×–137× faster than the hero). Both are things
the current build deliberately does *not* do.

---

## Decisions the user made — do not relitigate

1. **Hero: slow parallax, never pins.** `heroPar: 0.30`.
2. **Vignette starts exactly at the 100vh line** (the Figma 159px band).
   `vigDepth: 0` removes it. It is kept only because it is a real node in the
   Figma frame, not because the shader needs it.
3. **Envelope ~120vh, fully reversible.**
4. **Shader fades to flat black** after p=1, over `fadeLen` vh.
5. **Pure function of scroll — no accumulated state.** Scrolling back up
   retraces the identical shape and the same stretches leap at the same
   places. Explicitly chosen over a stateful sim.
6. **Both the uneven creep and the rare merge leaps**, on sliders.
7. **Field-based crumbs** that read as interacting — not a real particle sim.
8. **NO HAZE LAYER.** The user rejected this explicitly ("no haze n shit").
   Since the particle rework there is no dissolve `zone` either. The beige
   crumbs are the only blend there is. Do not add either one back.
9. **Crumbs are authored BEIGE** (#DAD9CF, measured off the reference page) —
   NOT chunks of video showing through. The user rejected video-derived flakes
   explicitly ("make it beige only i dont [want] chunks of video dropping down").
10. **Must look smooth, not pixelated.** This is a stated quality bar.
11. **The layer must never translate.** It envelops from the bottom; the black
    grows and the crumb field stays where it is. Anchoring any texture field to
    `BASE` tows it up the screen as a rigid slab — this was the bug.

---

## How the drop mechanic works

One sawtooth per cell does both jobs:

```
saw = fract(p * jumpRate + phase)      lag = lagMax * (saw - smoothstep(1-snap, 1, saw))
```

The ramp is the uneven creep — neighbours sit at different points in their
cycle. The discharge over the last `snap` of the cycle is the leap forward onto
the cell ahead. `fract()` of p keeps it monotonic and exactly reversible.

`phase` is drawn partly from a noise **smooth in cell index**, so neighbours
wrap together and leap as a patch. Purely random per-cell phases would only
ever move one cell; the reference moves ~8% of the width at once.

Lead and lag both taper through `4p(1-p)`, so at p=0 nothing pokes above the
fold and at p=1 every column is flush. **Verified: the frame closes completely
at p=1 with no sliver.**

---

## Bugs already fixed — do not reintroduce

1. **Vertical cliffs at every cell boundary.** Sampling one cell's lag per
   pixel with `floor()` chopped the line into separate bars. Now it blends the
   two nearest cell *centres*; `cellBlend` controls how much patch structure
   survives.
2. **Permanent speckle deep in the black.** The coverage overshoot was a fixed
   `1.25×`, which saturates at one `grainSoft` and fails at another. Now it is
   `cov*(1.25 + 2*gs) - (0.125 + gs)` so the fill reaches 0 and 1 at both ends
   for every softness the slider allows.
3. **Blobby grains.** The clump field ran at 82px and the base octave at 18px.
   Rebuilt as three explicit octaves — `fbm()` folds five and the top two
   aliased below a pixel into crawling shimmer — each drifting on its own
   vector so fine grains slide past coarse ones.

   *(2 and 3 describe the value-noise grain dissolve, which the particle rework
   deleted. Kept because the reasoning still applies to anyone who reaches for
   thresholded value noise again — its isocontours are round, so it gives you
   soft blobs or square crumbs and never a torn edge. That is why crumbs are a
   summed kernel field with a domain warp instead.)*

4. **The black arriving as grain.** `a = fill` made alpha *be* the noise field,
   so the black was speckled by construction, and `filmGrain`/`dither` wrote
   noise on top of the region where alpha was already 1. Alpha is now a hard
   anti-aliased mask and both grains are gated to the crumb band. Verified:
   deep black reads alpha 255 / rgb 0 with ONE distinct value across 81k px.
5. **The dissolve spilling both ways.** `cov = 0.5 - dl/(2*zone)` centred a
   200px partial band ON the line, so it bled 200px up AND down. Gone.
6. **The whole layer sliding up with scroll.** `gp` and `mp` used `fc.y - BASE`,
   pinning the grain and mote lattices to the moving boundary. The field is now
   screen-space. Measured: over a step where the edge travelled 38px, the field
   cross-correlates best at shift **0** (`partAnchor: 0`) versus **38** at
   `partAnchor: 1`. Leave the slider at 0.
7. **Density gating the crumbs by raising the threshold.** Looks equivalent to
   scaling the field and is not — the field's mean is only ~0.3*pi*rad^2, so a
   7% density difference moved the threshold 44% and collapsed every crumb onto
   one side of the line. Density SCALES the field now.

Three deliberate choices that look like they could be "simplified" but must not
be:

- **Quintic interpolation in `noise()`**, not the usual cubic. Cubic value
  noise is only C1; its second derivative jumps at every lattice line, which
  shows as faint diamond creases across a large gradient. Costs one multiply.
- **The line is drawn ADDITIVELY** — it raises rgb without raising alpha. Under
  premultiplied blending that is a true add over the video, rather than a lerp
  toward white that would flatten it.
- **Alpha is dithered**, not just rgb — but ONLY inside the crumb band.
- **Crumb AA comes from `fwidth()`**, not a fixed smoothstep width. A fixed
  width is correct at exactly one `partSize` and quantises at every other; this
  is what stops it looking like pixels. Needs `OES_standard_derivatives`, with
  an `#ifdef` fallback.
- **The crumb field is a SUM of per-seed kernels, not Voronoi.** Summing is what
  lets crumbs merge when two seeds wander close. Voronoi cannot — every cell
  keeps its wall — and its straight polygon edges read as shattered glass.
  The domain warp before thresholding is what makes the edges tear.

---

## Testing — the gotchas that will waste your time

- **Backticks inside the GLSL kill the file.** `FRAG` is a JS template
  literal, so a stray `` ` `` in a shader comment terminates it. This bit twice.
  After editing the shader, run the syntax check below and grep the literal.
- **`python -m http.server` does not support Range requests**, so Chrome's
  media pipeline will not decode `hero.mp4` through it. There is a node server
  with Range support at
  `<scratchpad>/serve.js` (port 8732, also mounts the scratchpad at `/_tmp/`).
- **The automated Chrome tab runs `hidden`.** Chrome will not decode video in
  it and throttles rAF to ~1Hz. Two consequences:
  - Substitute a still frame:
    `document.querySelector('video')` → replace with an `<img>` pointing at a
    frame extracted from `hero.mp4`.
  - **Never `await` a `requestAnimationFrame`** in injected JS — it hangs the
    CDP call for 45s. Query synchronously.
- `localStorage` key is `cnvrt.line.v1`. Clear it **then reload** — clearing
  after load does nothing, the values are already in memory.
- No ffmpeg on this machine. Use python + `opencv-python-headless` (installed,
  along with numpy / imageio-ffmpeg / pillow). Note `ndarray.ptp()` is gone in
  numpy 2 — use `np.ptp(x)`.

Syntax check:
```
node -e "const s=require('fs').readFileSync('shader.html','utf8');new Function(s.match(/<script>([\s\S]*?)<\/script>/)[1]);console.log('ok')"
```

---

## The particle envelope is its own algorithm

ONE quantity drives everything about a crumb - how many, how densely they
pack, how opaque, how lit: **how close it is to the shimmer line**.

- amount / density -> the threshold, via `prox`
- opacity -> `partOpacProx` scales `opk` by `prox`
- brightness -> `partLit * pow(prox, partLitW)`

`prox` is 1 against the line and 0 at the reach, shaped by the panel curve.
The **reach is a 2D field**, not a fixed distance per side - a fixed
`partUp`/`partDown` lays a ribbon of even thickness above and below, which is
exactly the uniform look. The two sides read DIFFERENT field offsets, so a
stretch trailing far behind does not also reach far ahead: below is the WAKE,
above is the gathering running AHEAD, and which is long varies along the edge.

The field is sampled anisotropically (3x slower in y than x). The reach is a
property of position ALONG the edge, so it must barely change across the band
depth; isotropic sampling draws faint vertical streaks.

**`partOpacVar: 1.0` was silently gutting density.** It makes each crumb's
opacity `1 - nid` with `nid` uniform 0..1, so the mean is 0.5 - every crumb
half transparent. Rounds were spent pushing the count while this halved the
result. Keep it around 0.3.

**The packed core is a LOCAL threshold drop, not a smooth band.** `max(part,
solid)` lays a flat stripe over the top, and a stripe is not particles. The
threshold is instead dropped to a tenth within `partCore` px, so crumbs swell
until they touch and read as almost solid while staying crumbs. Local, so the
tail never sees it.

## The glare, and the duplicate line

**Glare is a real lens glare, not a bloom.** Three components, each anchored at
discrete HOT SPOTS on a jittered grid along x (`glareSpace`), never smeared
along the edge:

- bloom - radial veiling glare of the source
- anamorphic streak - long in x, tight in y (`glareStreakX/Y`). This is the
  part that reads as a lens rather than a blur
- diffraction spikes - four-point star, `glareSpikePow` sets arm tightness
- plus chromatic separation: streak runs warm, spikes run cool (`glareChroma`)

**Two failures on the way there, both the same shape.** The first version was
one wide bloom gated by `tv`. `thickLobes` is 20, which is a 38px wavelength
across the frame, while the bloom was 140px tall - a gate that changes faster
than the bloom is tall stamps its own footprint out as soft RECTANGLES along
the edge. Then gating on `devField`-derived thickness killed it entirely,
because devField folds octaves and clusters near its mean, so it never reached
the 1.0 threshold calibrated against raw `noise()`. **Gate in field units
(0-1), not in derived-thickness units** - otherwise the threshold silently
depends on `thickVar`.

**The duplicate line needs no second pass.** Everything downstream is a pure
function of `dl`, so evaluating the same gaussians at `dl - dupOff` puts an
identical shimmer a few px up the SAME devour boundary - it tracks every
island and lurch exactly, because it is the same field. `dupWarm` pushes it
amber, `dupWidth` fattens it.

It is ADDITIVE, not a true screen. Screen needs the backdrop and the video is
a DOM element under a transparent canvas, not a readable texture. On dark
footage they are near-identical: `screen(a,b) = a + b - ab`, and `ab` vanishes
as the backdrop darkens.

## The shimmer's colour

Measured off `assets/video/hero.mp4`: the TV's core clips to pure white, but
the light it throws - top 5% of pixels over 10 frames - is **#B6A68D**,
normalised **(1.000, 0.912, 0.772)**. That is `tintR/G/B`; `warm` is still the
mix from pure white toward it. The old hardcoded (1.0, 0.955, 0.885) was
noticeably cooler than the actual TV.

## Devouring, not a sweeping line

The boundary is no longer a height field. This was rewritten because three
separate rounds of tuning failed to stop it reading as "a layer moving up",
and the reason was structural, not a setting:

**`dl = fc.y - edge(x)` gives every column exactly one boundary.** A
single-valued frontier can only ever be a line sweeping upward, however hard
`ridge` / `sway` / `lead` / `lag` wobble it. No parameter reaches that.

Now: a **resistance field, static in screen space, thresholded by a front that
rises with scroll**.

```
R  = fc.y - bias + devAmp*(devField(dq) - 0.5)
dl = R - BASE            // >0 not yet eaten, <0 devoured
```

Nothing in the field ever moves - only `BASE` does. Because resistance has
local minima at many heights, the black opens as islands ahead of the front,
sends fingers up between them, and closes holes behind. Verified in a render at
p=0.45: the black comes up as several separate lobes with untouched hero
between them, and at p=0.60 the shimmer traces a complete loop around an
undevoured island.

`bias` is the old silhouette, so ridge/sway/lead/lag/the leap all still work -
they warp the front now instead of BEING it. **At `devAmp: 0` the noise term
vanishes, `R = fc.y - bias`, and this reduces exactly to the old sweeping
line**, so the slider runs continuously from the previous behaviour to full
devouring. Islands detach once `devAmp` passes roughly `2 * devScale *
devAspect`.

### The distance: dFdy ONLY, never the full gradient

This took three passes to get right. `dl` must be `dR / clamp(abs(dFdy(R)), ...)`.

- **Raw `dR`** fails where the field flattens in y. `dR/dy` is
  `1 + devAmp*drn/dy`, and once `devAmp` approaches the vertical wavelength
  that reaches zero, so R stops changing down a whole column and the entire
  vertical run sits inside the band - crumbs pouring downward in a streak.
- **`length(dFdx, dFdy)`** is worse. Where the field is steep in x it shrinks
  `dl` and drags genuinely distant pixels into the band, drawing thin vertical
  spears out of the boundary. `dFdx` must never enter: the band is measured
  vertically, so only `dFdy` is meaningful.

### Islands cost vertical boundary runs

Islands need `devAmp / (devScale * devAspect) > 1`. That same condition makes
the field's slope cancel the `fc.y` term along contours, which produces long
near-vertical boundary segments - the shimmer traces them, and they read as
straight bright verticals. The two are the same phenomenon; there is no
setting with islands and no verticals. Currently at ratio 1.10 (300 / 210 /
1.3), which gives occasional islands with short verticals. Drop `devAmp` below
`devScale*devAspect` to remove both.

### The old trap: do NOT divide by the full gradient

`dl = dR / length(vec2(dFdx(R), dFdy(R)))` is the textbook first-order distance
estimate and it is WRONG here. It is only valid near the zero set; the crumb
band runs 30-60px out, and in narrow strips where the field is steep in x the
division drags genuinely distant pixels into the band. On screen that is a
forest of thin vertical spears shooting out of the boundary.

`R` is already in pixels and dominated by `fc.y`, so `dR` IS the vertical
distance to the front and needs no correction. Where the boundary runs steep
the band just reads a little wider, which looks right anyway.

(`devField` was also swapped in for `fbm` while chasing those spikes, on the
theory that fbm's equal amplitude-to-wavelength ratio per octave made every
octave contribute equally to the gradient. That reasoning is sound and the
lower-persistence field does give broader lobes - but it was NOT the cause of
the spikes. The gradient division was.)

## Density at the line: use partCore, NOT partThr

This one wastes time if it is rediscovered, so it is written down.

Coverage from the crumb field is `P(fld > thr/env)`. Lowering `partThr` to get
more crumbs at the line fills the TAIL in faster than the near side, because
the near side is already saturating. Measured, same scene:

| partThr | at -70px | at -6px | contrast |
|---|---|---|---|
| 1.47 | 3% | 37% | 12x |
| 0.60 | 19% | 58% | 3.1x |
| 0.25 | 44% | 71% | 1.6x |
| 0.15 | 54% | 74% | 1.35x |

So the threshold gives denser-everywhere-and-flatter, and the line asymptotes
around 74-83% however hard it is pushed. The falloff curve cannot help either -
it only reshapes what the field already delivers.

`partCore` / `partCoreAmt` bypass the field with a `max()`. Physically it is
the paper at the tear not having granulated yet: still continuous, breaking
into crumbs only further out. Measured with the core on vs off:

| dy | core on | core off |
|---|---|---|
| -35 | 37% | 37% |
| -8 | 56% | 45% |
| -3 | **80%** | 49% |
| +8 | 66% | 43% |
| +18 | 44% | 44% |

49% -> 80% at the line, and everything past +/-18px is untouched.

Two details that matter:
- The core's width rides the same `partReachVar` unevenness as the reach, so it
  does not read as a clean stroke ruled along the boundary.
- **The core is excluded from `partOverLine`.** Crumbs occlude the shimmer
  line; the core must not, or turning it up buries the shimmer under flat
  paper. The core sits under the tear, not in front of it.

## The falloff curve

`partFall` is gone. The density falloff from the shimmer line out to the reach
is now a **cubic bezier you drag in the panel** ("PARTICLES - falloff curve").
Endpoints are pinned: (0,1) is the line at full density, (1,0) is
`partUp`/`partDown` at nothing. Only the two handles move, exactly like a CSS
cubic-bezier. Handles persist as `curveX1/Y1/X2/Y2` in `P` and in localStorage.

Defaults `(0.300, 1.000) (0.400, 0.000)` were fitted numerically to the old
`partFall: 1.65` shape, rms 0.011 — so the change is invisible until dragged.

**It is a 256x1 LUMINANCE texture, not a per-pixel solve.** Newton-solving a
bezier for y-of-x in the fragment shader costs roughly 50 ops on every one of
several million pixels, to evaluate something that only changes when a handle
moves. The LUT is rebuilt in JS by marching the bezier in `t` and resampling
onto uniform `x`, which sidesteps the x->t inversion entirely. LINEAR filtering
means the 256 samples do not step.

Two ordering traps, both already handled — do not undo them:
- `boot()` runs BEFORE `load()`, so the texture is created with DEFAULTS and
  then localStorage overwrites the handles. `uploadCurve()` is therefore called
  again at the tail, after `load()`.
- The panel is `hidden` at build time so the canvas `clientWidth` is 0. The
  widget redraws when the panel is opened.

Measured, same scene, three handle positions (coverage at dy from the line):

| dy | default | long shallow tail | hard cliff |
|---|---|---|---|
| -100 | 0.1% | 24.9% | 0% |
| -45 | 18.9% | 31.3% | 0% |
| -8 | 36.4% | 36.6% | 17.4% |
| +70 | 3.4% | 30.8% | 0% |

## PREVIEW OVER A DARK BACKGROUND

This one cost five rounds of the user asking for the same thing.

Every preview render was composited over mid-grey. Mid-grey flatters dark
crumbs - they show up fine against it. The hero footage is a dusk hillside,
mostly RGB(30,48,66) and darker. Crumbs at `paperR/G/B (0.6,0.59,0.51)` times
`partBright 0.5` come out **RGB(77,75,65)**, which reads clearly on grey and is
very nearly invisible on the real thing. Coverage measurements said the band
was dense the whole time, and it was - just unreadable.

Two compounding mistakes, both mine: previewing on grey, and dropping
`partBright` from 0.92 to 0.5 to make the proximity gradient read, which took
the far crumbs down with it.

**Paper wants to be BRIGHT.** The reference is #DAD9CF - about three times
brighter than where those values sat. Now `(0.86, 0.84, 0.74)` at
`partBright 0.82`, with `partLit` adding punch near the line on top rather
than being the only thing making crumbs visible.

**Always composite previews over something as dark as the footage.** The
`__shot` helper takes a bg colour; use `[30,48,66]`, not mid-grey.

## Two things that cost a round trip each

**Coverage percentage is not density.** Several rounds were spent measuring
"80% coverage at the line" and concluding the band was dense, while on screen
it read as noise. At `partSize: 2.75` the crumbs were 1-2px, and
`partStretch: 0.25` squashed them to a quarter of that - 80% coverage of 1px
slivers is dither, not paper. Below about `partSize: 4` crumbs stop reading as
paper whatever the numbers say. LOOK at a frame.

**`partStretch` below 1 SHORTENS crumbs.** It divides the vertical lookup, so
values under 1 flatten them. The tip says so now.

## Panel layout

The particle controls live at the BOTTOM of the panel, in seven groups:
amount / size and shape / ABOVE the line / BELOW the line (the wake) /
spread and randomness / drift and anchor / colour, light and opacity.
`the torn edge` sits just above them. Everything above that is the line and
the envelope, which are largely settled.

`partAmount` is the single global lever over how many crumbs there are - it
divides the threshold. Measured covered area: 0.5 gives 0.47x, 2.0 gives 1.44x;
it compresses at the top because coverage saturates. `partDensUp`/`partDensDn`
bias it per side, and `partThr` is the same axis but finer.

`SPEC` drives the panel, so reordering groups there reorders the panel. Every
DEFAULTS key must appear exactly once in SPEC - there is a checker at
`<scratchpad>/verify.py` that asserts params, sliders and uniform wiring all
line up, and prints the panel order.

## The particle controls, and why each exists

Every one of these was added because something read as UNIFORM. That is the
recurring failure mode of this effect: any constant in the band shows up
immediately as a stripe or as pebbledash.

| control | fixes |
|---|---|
| `partSizeVar` | one shared kernel radius makes every crumb the same size |
| `partReachVar` / `partReachSc` | a constant band depth is a stripe of fixed thickness following the line. Measured spread now 4px-31px along the width |
| `partFall` | shapes density across the band — high packs them at the line and dissolves them away from it |
| `partOpac` / `partOpacVar` | crumbs were hard-opaque wherever covered. `partLit` only brightens by proximity; it is not an opacity |
| `partGlow` / `partGlowW` | soft halo per crumb, from the same field just below the threshold, so it follows that crumb's own opacity |
| `partOverLine` | crumbs occlude the shimmer line instead of it painting cleanly over them, which breaks the rim up |
| `partScatter` | one seed per cell is an even lattice however far the seeds wander — the last place uniformity hides. Random per-seed weight opens real voids and clusters |
| `partStretch` | round crumbs read as scattered dust; elongated ones read as a trail |
| `partUp` vs `partDown` | the trail asymmetry. Equal values give a symmetric halo, not a wake |
| `creepTaper` | see below |
| the falloff curve | replaced `partFall`; a single power is only ever one family of shapes |

**The amount sliders map to the THRESHOLD, not the field.** `partDensUp/Dn`
scaling the field looks equivalent and is not: the field's mean is only about
`0.3*pi*partRad^2`, so a small amount drives the effective threshold hyperbolic
and the slider goes dead below roughly 0.3. That is exactly how `partDensUp:
0.14` produced no crumbs above the line at all. Mapped into a bounded threshold
band (`mix(2.60, 0.80, amt)`) the whole travel stays live.

**`creepTaper` is why the envelope stopped reading as a rigid slab.** Lead and
lag must vanish at p=0 and p=1 or a lagging stretch leaves a permanent sliver.
But a plain `4p(1-p)` is only near 1 around p=0.5 and near zero everywhere else,
so it suppressed the differential across most of the scroll. A fractional power
keeps it near 1 through the middle and still lands on exactly 0 at both ends —
`0^k` is 0 for any `k>0`, so closure is preserved for free. It also means
`leadAmp`/`lagMax` now survive close to the ends, so they had to be added to the
travel margins in `draw()` or a sliver reappears near p=1.

The other half was amplitude: `leadAmp` and `lagMax` were ~9% of the total
travel. Differential that small against that much travel simply reads as
translation.

---

## Measured at the current defaults (p=0.5)

| dy from the line | coverage | crumb luma |
|---|---|---|
| −110 (deep wake) | 13.8% | 70 |
| −75 | 53.9% | 100 |
| −45 | 76.3% | 129 |
| −5 (at the line) | 75.3% | 152 |
| +20 (ahead) | 47.8% | 109 |
| +45 | 1.3% | 70 |

Wake runs ~150px, the gathering ahead ~50px — roughly 3:1. Luma falls 152 → 70
with distance, which is `partLit` doing the proximity lighting; `partBright` is
deliberately low (0.55) so proximity is what drives it rather than a flat tone.

**When checking "is the black clean", measure RELATIVE TO THE EDGE.** Sampling
fixed canvas rows was valid when the band was 42px; with a 220px wake and a
silhouette that dips far below mid-frame, low rows sit *inside* the wake and it
reads as a regression that is not there. Verified against the edge: dy −260 to
−230 and −400 to −300 are both alpha 255 / rgb 0, and dy +150 to +250 is alpha 0.

---

## Where it stands / what is next

Design spec: `docs/superpowers/specs/2026-08-06-torn-paper-particles-design.md`.

Verified this session, by reading pixels back rather than by eye:
- GLSL compiles clean; `OES_standard_derivatives` present.
- Deep black: alpha 255, rgb 0, one distinct value across 81,000 px.
- p=1: whole frame alpha 255 / rgb 0 — closed, no sliver.
- p=0: max alpha 0 — nothing showing.
- Field does not translate (0px vs 38px, see above).
- Crumb size 2px median / 5px p90 / 20px max at `partThr 0.48`; defaults were
  then graded UP to 0.70 by eye, which separates them into readable pieces.

**Still never seen against the moving video, and never seen animating.** Every
image so far is a still render over a stand-in photo. That is the next thing.

A Range-capable server is running at `<scratchpad>/serve.js` on **port 8742** —
`python -m http.server` will NOT decode `hero.mp4`. Open
`http://127.0.0.1:8742/shader.html`. It also takes `POST /_save?name=x.png` to
pull renders back out of the page, which is how every image here was made.

Reference stills dissected from the clips are in the scratchpad:
`spray_wide.png`, `spray_macro.png` (the tear at 3x and 9x), `ref_wide.png`.

Known soft spots, all slider-tunable:
- The crumbs immediately at the tear get washed by the line's own `glowBright`
  halo. `partLit` is already down at 0.10; the remaining wash is the line glow.
- The band (`partUp: 90`, `partDown: 70`) is far wider than the reference's
  ~20px/~15px. That was deliberate — the user wants the crumbs doing the
  blending — but it is the first thing to pull in if it reads as too much.
- `paperR/G/B` are the measured #DAD9CF. Nothing has been tuned against the
  real video's colour yet.

Not yet done:
- Nothing lifted into `index.html` — `shader.html` is still a standalone
  harness. `index.html` is untouched.
- `shader.html` and the reference clips are **untracked**. Nothing committed.
- `localStorage` key is now `cnvrt.line.v2` (v1 held the old dissolve params).
