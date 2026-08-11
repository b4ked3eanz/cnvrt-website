# GLASS RING — offerings

Handoff note for the glass ring in OFFERINGS. Everything lives in
`index.html`; there is no separate file and no build step.

**Status:** working and in the page. Open it and press **backtick** for the
panel. Backtick used to open three other panels at once; those are settled, so
they all moved to **shift-backtick** and plain backtick is now this one alone.

---

## What it is

Figma `532:5062`, the layer called **glah** — 440x440 at (740,371), dead centre
of the 1920 frame and 51 design px below its middle. Two `fill-rule="evenodd"`
paths: an outer ring with a 41.9043 wall, and a twelve-sided gear with a
two-lobed hole.

It is a real 3D solid: the paths are extruded, bevelled and smooth-shaded, and
it **refracts the live headline behind it**. Not a picture of the headline —
the actual `<h2>`, still selectable, bending as it passes under the glass.

It enters from well below the fold, climbs on **its own absolute speed**, and
turns about **260 degrees on Z** on the way up. It is a separate piece in front
of the composition, not part of it: its speed is its own number, not a multiple
of the panel's, so retuning one cannot move the other.

Measured on the page, from the slope of each layer's screen position against
scroll while the panel is pinned — which IS the speed, because sticky cancels
the page scroll and leaves only what the driver writes:

| layer | speed |
|---|---|
| `.off__panel` (left bit) | **0.184** |
| `.off__list` (right bit)  | **0.205** |
| the ring                  | **0.321** |

The first two are the values that were there before the ring existed and are
untouched by it.

---

## Why it is built the way it is

The obvious build is `MeshPhysicalMaterial` with `transmission`, and it cannot
work. Transmission refracts what is IN THE SCENE. What has to bend is DOM.

The only thing in a browser that bends live DOM is `feDisplacementMap`, and the
only thing that points it at the page rather than at an element's own pixels is
`backdrop-filter`. So the pipeline splits:

```
three.js  ->  displacement map PNG  ->  SVG filter  ->  backdrop-filter  ->  DOM
```

three.js never draws the refraction. It draws a **map** of it. One offscreen
pass whose fragment colour is the screen-space offset a refracted ray walks
while crossing the glass:

```glsl
vec3 T = refract(I, N, 1.0 / ior);
off    = (T.xy / -T.z) * thickness;     // exact slab result, not an approximation
```

encoded into R and G around 0.5. That PNG becomes an `feImage`; three
`feDisplacementMap` primitives read it at three scales, which is the chromatic
split; `backdrop-filter` hands the chain the live page. The **bevel** does all
the lensing, because `refract()` is being evaluated against the real bevel
normals — the flat face barely bends anything, which is correct.

A second three.js pass is the part you see AS glass — fresnel, the specular the
bevel catches, the rim, the bloom — composited SCREEN so it can only add light.

### The spin is free, and only because it is Z

A Z turn is a **rigid rotation in screen space**. It does not change the
silhouette and it does not change the displacement field — it only turns them.
So the driver writes it as a CSS `rotate()` on the same transform that carries
the translation, and one transform turns the map, the mask and the lit bitmap
together, in register, for nothing. **The map is never regenerated as it
spins.**

Any other axis would be a different object every frame. An earlier build did
spin on Y and had to re-encode two `toDataURL`s per step, throttled to 20Hz;
that code is deleted, not kept as an option.

The map is generated **once per parameter change**. There is no readback in the
scroll path. What moves every frame is a transform on three divs; the browser
re-evaluates the backdrop filter, which is real cost but bounded by the 700x700
box.

The one part of the spin that is not free is `spinLight`. The lit canvas is
rendered un-rotated and then turned by CSS, so a highlight drawn at angle A
lands on screen at `A − spin` and rides round with the mark like a printed
sticker. Rendering the light at `A + spin` puts it back where it was and the
highlight holds still while the mark turns under it — which is the thing that
sells the spin as a solid. It costs one lit re-render per frame the angle
changes, which is why the bloom is built at half resolution. Set it to 0 if it
ever drags.

---

## Three siblings, not a wrapper

This is the one piece of structure that is invisible in the markup and will be
"tidied" back into a bug by anyone who does not know:

```html
<div    class="off__glass off__glass--refract"></div>
<div    class="off__glass off__glass--film"></div>
<canvas class="off__glass off__glass--cv"></canvas>
```

They were children of one `.off__glass` wrapper first. A wrapper needs a
transform (the driver writes one every frame); a transform makes a stacking
context; a stacking context is where `mix-blend-mode` stops looking for a
backdrop. So the lit canvas screened against its two siblings and nothing else
— and **a `backdrop-filter`'s output is not part of its group's blend
backdrop**, so as far as the canvas was concerned there was nothing under it at
all. Screen against nothing is opaque. The ring came out as a solid dark
plastic disc that ate the headline.

Proved, not guessed: giving the refract layer a flat red background made the
canvas screen against it perfectly. Blending worked. The backdrop-filter result
just was not in the group.

As siblings of `.off__stage` all three blend against the stage's own contents,
which is where the headline lives. Each carries its own copy of the same
transform. Three writes a frame instead of one, and worth it.

---

## Five things that fail silently

1. **The "no displacement" grey must be built in LINEAR space.**
   `renderer.setClearColor(0x808080)` does NOT give you 128. three's colour
   management reads a bare hex as sRGB and converts it into the linear working
   space, so 0.502 becomes 0.216 and the clear lands on **55** — a hard
   negative displacement across the whole box, which tears the entire headline
   sideways. `new THREE.Color().setRGB(0.5,0.5,0.5, THREE.LinearSRGBColorSpace)`
   makes the conversion an identity. There is a probe for this: read the map's
   corner pixel back, it must be exactly `[128,128,128,255]`.

2. **`feImage` needs an explicit subregion.** Left to default it is the filter
   region, and Chrome has drawn the raster at its own intrinsic size in that
   corner rather than stretching — a 512px map on a 700px box slides the lens a
   hundred px off the ring. `x/y/width/height` are written in CSS px on every
   map regeneration.

3. **`color-interpolation-filters="sRGB"`**, not the linearRGB default. These
   are encoded numbers, not colour. A linear conversion on the way in bends the
   displacement itself: the lens pulls hard on one side and barely at all on
   the other.

4. **`thick` is a view-space length and must be scaled with the mesh.** It is
   `P.thick * P.scale`. Without that, growing the ring leaves the slab the ray
   crosses at its old depth and the refraction quietly weakens as the object
   gets bigger — which reads as "the glass looks thinner at larger sizes" and
   sends you tuning the wrong slider.

5. **`primitiveUnits` must stay `userSpaceOnUse`** and `scale` must be raw CSS
   px. Never `objectBoundingBox`: Blink multiplies `scale` by the reference-box
   *width* and uses that one scalar for both axes, WebKit resolves it per-axis,
   Gecko uses `sqrt((w²+h²)/2)`. Three engines, three numbers, and the spec
   gives no formula for scalar lengths at all.

---

## The failure that looks like occlusion but is not

If the ring reads as solid dark plastic and the copy stops dead at its edge,
the copy has almost certainly been refracted OUT of the band rather than
covered up. The giveaway is that it reappears, torn and fringed, in an arc just
**outside** the silhouette. `thick`, `gain` and `range` all multiply into the
same thing; the first pass shipped all three high and the displacement scale
came out at 200 CSS px on a 440 px object.

---

## Panel

**Backtick.** **36 sliders in seven groups** — SHAPE, GLASS, EDGE, LIGHT,
PLACEMENT, MOTION and COMPOSITION — persisted to `localStorage` under
`cnvrt.offglass.v3`, with a **copy values** button that puts the whole
parameter set on the clipboard as JSON.

It was 47. What went, and why each was safe:

- `bevelT` / `bevelS` / `bevelO` / `bevelN` / `curveN` → **one `bevel`**. They
  were never five independent choices; they are one profile, and every
  combination worth having lies on a single curve through them — a bigger
  round-over needs more segments to stay smooth and needs the outline pushed
  out to make room. `bevel: 0.78` reproduces the five hand-set numbers that
  shipped before, to within a segment.
- `specP` / `fresP` / `rimP` → **constants**. Reflectance is derived from `ior`
  now, so all three were shaping knobs on a curve that is already physically
  anchored, and two of them have a right answer (5, the Schlick exponent) that
  nothing ever wanted to move off.
- `sat` / `bright` / `blur` → **gone**, and the plan asked for exactly this
  check before cutting them. All three existed to fight the 13x darkening the
  sRGB bug caused. `bright` shipped at 1.41, which LIFTS the page seen through
  the glass — i.e. makes the copy behind the mark MORE readable, the opposite
  of the first item on the done list. With the transfer fixed and absorption
  reaching the page, all three tuned back to exactly 1.0 / 1.0 / 0, which is
  "do nothing". Each was also a filter FUNCTION in the `backdrop-filter`
  string, evaluated over the box every frame; the declaration is now just the
  `url()`.
- `gain` → folded into `thick`. This file has said "thick x gain x range all
  multiply into the same thing" since the first pass; they were two sliders for
  one quantity and moving either had exactly the same effect.
- `tintA` / `filmO` → one **edge opacity**. Always moved together — the film is
  the body of the edge and the tint floor is the haze that ties it to the rest
  of the mark, and a film at 0.7 over a floor at 0.02 reads as an edge with
  nothing behind it.

What arrived: **`tir`** (total internal reflection) and **`rotEase`** (the turn
does not have to be linear against screen position; both endpoints are fixed by
construction so easing cannot move where it starts or finishes).

**Kept against the plan: `glow threshold`.** §6 says derive it from the
specular level and drop the slider. The honest derivation is "brighter than the
horizon band can make the material", which with the environment as tuned is
0.95 — high enough that nothing would ever bloom. It is a real threshold now
rather than a contrast trick and it does a visible thing, so removing it to hit
a count would be the wrong trade.

Everything the ring has is on this one panel, motion included. `vGlass`,
`glassLow`, `rotAxis`, `rotStart`, `rotEnd` and `rotEase` are **owned here and
read by the offerings driver** through `window.OFFGLASS`; changing one calls
`OFFGLASS_REBUILD` and the driver re-solves. They are not duplicated on the
offerings panel — one number, one home. The driver keeps a matching set of
fallbacks only because it parses before this module does; keep the two in step.

`warp` is the radial bulge laid over the physical refraction. `refract()` alone
only bends where the surface turns, so the flat face passes copy through almost
straight; warp is what makes the mark read as a lens with a body rather than as
a bevelled window. Cubic in radius, so the middle stays honest and it builds
toward the rim. Negative pincushions instead.

`lightA` is a **screen** angle — X/Y, with elevation on Z coming out of the
screen. The first build had it sweeping X/Z, which is an azimuth about the
vertical and is not what a slider called "light angle" should do.

## Checks

```
python tools/verify-glass.py
```

Every parameter has exactly one slider, every slider has a parameter, no
default sits outside its own slider's range, every uniform the GLSL reads
exists in the uniforms object, **every shader declares every identifier it
reads**, and both pads in the CSS equal both pads in the JS. None of that is
caught by a syntax check and all of it fails silently at runtime.

The shader-declaration check is the one that earns its keep. `LIT_F` read
`uIor` without declaring it, the fragment shader failed to compile, three.js
dropped the material, and the lit canvas drew nothing — while the old check
passed, because it compared the UNION of every shader's declarations against
the uniforms object and `uIor` was in both. It cost two passes of tuning five
intensities that were never going to do anything.

And for anything that has to be *looked* at:

```
node tools/serve.js                       # Range-capable, :8743
node tools/shot.js <url> <out.png> [eval.js] [ms] [w] [h] [clip]
node tools/sweep.js <outDir> <variants.json> [scrollY] [scale]
node tools/perf.js [--headless] [runs] [--trace] [probe.js]
```

`shot.js` drives Chrome over the DevTools protocol directly — `--headless=new`,
runs a script in the page, captures. No extension, no dependencies (Node 22+
has a global `WebSocket`). It exists because the Chrome extension went
unresponsive for most of the build and every claim in this file needed proving.
`clip` may be `auto,<scale>` to crop to whatever rect the eval script left on
`window.__clip`.

`tune.html` + `sweep.js` are how a number gets LOOKED at without editing
`index.html`. `tune.html` is a bounce page served from the same origin: it
writes the panel's `localStorage` key and hands over to the site, so the ring
comes up with those values already in `P`. `p` REPLACES the stored set rather
than merging, which is what makes a sweep honest — every variant is DEFAULTS
plus exactly the numbers it names, and variant 3 cannot be quietly carrying
variant 2's.

```
node tools/sweep.js out variants.json
# variants.json: [{ "name": "abs06", "p": { "absorb": 0.6 } }, ...]
```

`perf.js` is the frame-cost harness. **Read its header before believing a
number out of it** — the frame-interval measurement does not work in an
automated window (see STATE OF PLAY). `--trace` does work: it takes a real
trace and adds up what the renderer spends where.

---

## Not done

- **The §5.6 baseline, by hand.** `perf.js` cannot do it — an automated window
  is presentation-throttled, so frame interval measures the cadence and not the
  page. Scroll the section with DevTools' frames pane open, then again with
  `backdrop-filter` forced to `none`, and compare. That difference is the
  filter's cost and nothing else's.
- **`MAPRES` is still 512.** §5.4 of the plan says 384 is very likely
  indistinguishable and is 44% fewer pixels to sample. That is a measurement,
  and the measurement is what is blocked.
- **Chrome only, by design.** Safari and Firefox drop the `url()` inside
  `backdrop-filter`, so they lose the refraction AND the absorption, which now
  lives in the same chain. The lit pass and the film still land, so it degrades
  to a lit ring over unbent copy rather than to nothing. A degrade, not a break
  — but it is a bigger degrade than it was before absorption moved into the
  filter, and that is the price of the operator being right.
- **Defaults are starting points.** They have been looked at now, in headless
  Chrome, on a 1920 shot of the real page with the real headline behind them —
  which is a great deal better than the last pass and still not a display. The
  panel and the copy button are for the rest.
- **The absorption gradient is an edge effect, not a ramp.** See the last item
  of STATE OF PLAY: this geometry is nearly a flat plate, so the path length
  absorption is driven by is close to constant across most of the mark by
  construction.

---

## The X tilt, and why the map is baked

The ring tilts on X as it climbs, from `rotXBot` when its centre is at the
**bottom edge of the viewport** to `rotXTop` when it reaches the **top**. It is
anchored to screen position, not to scroll, so the tilt at any point of the
climb survives retuning the speed or the entry drop.

The driver derives that position without ever reading layout: the panel's box
top is 0 once sticky engages and `-u` before it, the ring's box sits `GCENTRE`
design px below that, and its own transform is `tgAbs`. No
`getBoundingClientRect` in the scroll path, which is the rule this driver has
always kept.

A Z spin is free. **An X tilt is not** — it changes the silhouette and every
normal with it, so the displacement map and the mask are a different image at
every angle. So the tilt is **quantised to 3 degrees and the encodes are
cached**: the first pass through the section pays for each step once, every
pass after is free, and the cache is capped and dropped whenever anything the
map depends on moves.

The **lit canvas is not quantised** — it re-renders at the exact angle every
frame, because that costs a draw call and no readback. So the object you look
at turns smoothly; only the film and the refraction cut into it lag by at most
a degree and a half.

---

## Two bugs that produced the "weird frame with diagonal edges"

1. **`getBoundingClientRect()` on a spinning element.** It returns the
   axis-aligned box of the *transformed* element — a 700px square reports 819
   at 100 degrees and 990 at 45. The filter's user space is the element's
   BORDER box, which never rotates, so the map was being stretched by up to
   41% and its own grey "no displacement" border landed inside the element.
   The edge of that border cut across the refraction as a hard, rotating,
   diagonal line. **Use `offsetWidth`/`offsetHeight`** — layout size, blind to
   transforms. Same fix for the canvas.

2. **The encode was clamping.** `range` was a slider, and it is the wrong kind
   of number to expose: it is the ceiling the encode saturates at. At
   `thick 137 x gain 1.55` plus `warp 42` the shader asks for ~230px of
   displacement and `range` was 40, so most of the mark encoded as pure 0 or
   255 — large flat plateaus with hard edges, which read as faceting.

   It is **measured** now. Encode once against a bound the shader cannot
   exceed (`thick*tan(asin(1/ior))*gain + |warp|`), read the actual peak back
   through a 128px scratch canvas, re-encode with the ceiling pulled down to
   fit. Two draws instead of one, only when the map changes, and the 8 bits
   per channel then span exactly the range in use.

---

## `round` is implemented

It needed no new geometry generator. three's bevel profile is already a
quarter-ellipse — `z = bevelThickness*cos(t)` against `inset = bevelSize*sin(t)`
— and it is applied to both ends. So a bevel whose thickness is half the total
depth IS a full half-round on each face, and the flat middle between them
vanishes. `round` lerps the two bevel numbers toward `depth/2` and climbs the
segment counts with them.

`bevelSize` has a hard ceiling that is geometry, not taste: pull the outline in
by more than half the narrowest solid wall and the two sides of that wall cross.
On this asset that wall is the gear at **15.86 design px**, and a negative
`bevelOffset` eats into it first. Clamped, so `round: 1` cannot tear the mark
inside out.

---

## Real thickness (the physics pass)

Thickness was a constant. It isn't any more, and this is the single biggest
reason CG glass reads as a printed sticker rather than a solid: if every part
of an object bends light by the same amount, nothing about it says there is
material there.

Before the front face is drawn, the **back faces** are rendered into a texture
holding their distance from the camera. The front pass looks up the same pixel
and subtracts. The difference is the true path length through the solid at that
exact point — long through the middle of a gear tooth, near zero at its corner.
This is what `MeshPhysicalMaterial` means by `thickness`.

Stored **relative to the camera-to-object distance**, not absolute. Absolute
distances here are ~1600 units and the object is ~40 deep; a half-float would
spend all its precision on the 1600 and have none left for the 40. Subtracting
the constant first puts the numbers in a ±100 band where half-float resolves
about 0.05.

Two things now use it:

- **Refraction** walks the refracted ray across the real path length, so thick
  parts bend hard and thin parts barely at all.
- **Beer-Lambert absorption**, `exp(-density * pathLength)` — light crossing a
  solid is absorbed exponentially with the distance it travels. This is why
  real thick glass is deeply coloured through its edges and nearly clear across
  its face, and it is what stops copy being legible through the thick parts.

`thick` changed meaning with this: it was a slab depth in design px, it is a
**multiplier** on the measured path now. 1.0 is honest, above is licence.

## No Z rotation, anywhere

`spinZ`, `spinLight` and `rotZ` are all deleted, along with the `rotate()` the
driver used to write into the transform. X is the only axis this moves on.

**Why setting the default to 0 did not remove it:** the panel writes every
change to `localStorage`, and the loader lets a saved value beat a new default.
So editing `DEFAULTS` changes nothing in a browser that has ever had the panel
open — a spin that had been dialled in and saved kept being restored long after
the default went to zero. The storage key is bumped to `cnvrt.offglass.v2`,
which is the only thing that actually makes a default change reach the page.
Remember this the next time a default "doesn't take".

---

## STATE OF PLAY — read this first

The look is **in**. The mark reads as a solid piece of glass with weight: a
bright rim where the light catches it, a dark body where it does not, and copy
that bends and then gets eaten as it passes underneath. It is no longer a grey
plate and no longer a printed sticker.

Four things were wrong and all four are fixed. Each is worth reading, because
three of the four were invisible to every check in the repo and one of them was
being tuned around for two whole passes.

### 1. The lit pass never compiled

`LIT_F` read `uIor` and never declared it. The fragment shader failed to
compile, three.js dropped the material with a console warning, and **the lit
canvas drew nothing at all**. That is the whole of "the highlights have gone
missing" — it was not the intensity rescale, and no value of `specI`, `fresI`
or `rimI` could ever have brought them back.

Found by reading the console, which is the first thing this file should have
said to do. `verify-glass.py` now checks every shader's own declarations
against what it reads; the old uniform check compared the UNION of all shaders
against the uniforms object, so a uniform present in the object and declared in
one shader passed while being missing from another.

### 2. The fresnel was a gamma on a reflectance

Both the lit pass and the mask did

    F    = f0 + (1-f0)*pow(1-ndv, 5.0)     // correct Schlick
    fres = pow(F, 1.0/fresP) * fresI       // and then this

and that second line is not a falloff control. It takes the face-on value —
`f0`, which for ior 1.5 is 0.04, i.e. "a window facing you barely reflects" —
and lifts it to 0.36 in the lit pass and 0.22 in the mask. So the flattest,
most transparent part of the mark was given a third of full reflectance,
uniformly. That is the entire "flat grey plate" look, in one line, twice.

The exponent belongs INSIDE, on `(1-ndv)`. Face-on is then always `f0` whatever
the slider says, grazing is always 1, and the slider does what its label
claims: how far in from the outline the mirror reaches.

### 3. Absorption was painting a mid-grey plate

`absorb` shipped at 0 for two passes because "at every value it washes flat
grey over the mark and buries the refraction". That was not absorption failing.
It was the operator.

Beer-Lambert is a MULTIPLICATION. The layer was composited **source-over**,
which paints `src*a + backdrop*(1-a)` — so the layer's own colour goes in, and
its colour was `pow(tint*0.30, 1/2.2)`, a mid grey around **140** on a page
whose ground is 20. Turning absorption up made the mark LIGHTER. It could not
have done anything else. Diagnosed by working out what the operator does, not
by trying more values.

Two things fixed it:

- **The layer is gone.** Transmittance is an `feImage` inside the SVG filter
  now, applied with `feComposite operator="arithmetic" k1="1"` — a true
  per-channel multiply against the live backdrop the `backdrop-filter` is
  already holding. That is the operator this always wanted, and it removes a
  DOM layer and a transform write per frame as well.
- **The coefficient is one colour.** It was `(1 - mix(uTintA, uTintB, vG))`,
  driven by the FIGMA GRADIENT — near-white cream at the top of the mark, mid
  grey at the bottom. As an absorption coefficient that is 0.02 at the top and
  0.5 at the bottom: a 25x swing in how much light the material eats, down the
  page, driven by a surface gradient that is a lighting cue and not a material
  property at all. So the absorbed fraction varied hugely with screen position
  and almost not at all with thickness — the plan's "near-uniform across the
  silhouette" symptom, from the opposite direction to the one suspected. A
  solid is made of one substance. It is `-log(bodyColour)` normalised now, so
  `absorb` sets the depth, the body colour sets the colour, and the only thing
  varying across the mark is the path length.

### 4. The displacement map was clipping over 13% of the mark

`range` stopped being a slider two passes ago and became a MEASURED ceiling:
encode once against a bound the shader cannot exceed, read the peak back,
re-encode with the ceiling pulled down to fit. Good scheme. The bound was
wrong.

It computed `thick * scale * tan(crit) * gain`, which was right when `thick`
was a slab depth in design px. `thick` became a MULTIPLIER on a per-pixel
measured path when the back-face pass landed, and the bound never got the
measured path put back into it — so it was short by the solid's whole axial
depth, about 50x. The first draw clipped, which pinned `measurePeak()` at 1.0,
which set the ceiling back to the same too-small number. **A ratchet that could
only ever confirm itself.**

Measured on the shipped build: 13.4% of the covered pixels sat at exactly 0 or
255, in arcs running round the bevel — the one region the encoder's own comment
says does all the lensing — with unbroken 100px runs of pure 255. That is
precisely the faceting the two-draw scheme exists to prevent.

Making the bound honest does not fix it, and this is the interesting part: the
field is genuinely SINGULAR at the outline, because the exit angle goes to the
critical angle as the surface turns edge-on and the shader's own
`max(-T.z, 0.05)` guard is all that stops it running away. An honest bound on
that is enormous and would spend all 8 bits on values a handful of pixels
reach. So the limit is now **soft** — linear to a knee, then easing onto an
asymptote, C1 continuous, no edge anywhere — and the ceiling is derived from
the refract layer's padding, because the real constraint is how far a sample
may be fetched from and still land inside the filter region.

After: **0.43% and 0.54%** at an endpoint, and a smooth histogram rather than a
spike. Measured the same way, on the same scroll position.

### 5. The lit canvas was stamping the un-refracted headline back on top

Reported from the page as *"I can see the refracted version and the normal
version behind it"*, and that is exactly what was happening.

The canvas was `mix-blend-mode: screen` and **opaque over the whole
silhouette**. Screen is `1-(1-Cs)(1-Cb)`, so wherever the glass is DARK — which
is most of its body, correctly — it returns `Cb`, the backdrop. And the
backdrop a blend mode sees here is **not** the refracted page: a
backdrop-filter's output is not part of its group's blend backdrop, which this
file has known and written down since the first rebuild. So the blend read the
raw headline, returned the raw headline, and alpha 1 composited it straight
over the refraction. Both images at once, the bent one underneath and the
straight one printed on top at full strength.

It only became visible in this pass because of bug 1: while the lit shader was
failing to compile the canvas drew nothing at all, so there was no opaque layer
to stamp anything back.

Choosing a different blend mode does not fix it — they all need a backdrop and
they all get the wrong one. The fix is to have no backdrop where there is
nothing to add: **the lit pass carries its own alpha now**, the maximum of its
own channels, so a fragment that adds no light composites as nothing and the
refracted pixel underneath survives untouched. `mix-blend-mode` is gone and the
composite is plain premultiplied source-over, `col + (1-a)·dst`, which needs no
group semantics at all. Where the glass IS bright it paints over the
refraction, which is what a real highlight does anyway.

Measured before and after, over the whole lit canvas: pixels that are dark
(luminance < 40) AND opaque (alpha > 200) went from **the entire silhouette to
zero**.

### 6. `thick: 0` silently turned absorption off

`pathL` was `pathA * uThick / tz` in both the transmittance pass and the lit
pass. `thick` is the REFRACTION STRENGTH multiplier — how far the encoder is
told to walk the bent ray — and how much light a solid eats has nothing to do
with how much the bend has been exaggerated for effect. Multiplied together,
`thick: 0` (a mark that bends only by `warp`) turned absorption off completely
no matter what `absorb` said, with no way to tell from the panel.

Absorption is driven by the real geometric ray length through the solid now,
`pathA / tz`, and nothing else.

### 7. `round` never rounded anything, because the flat band stayed

Reported from the page as a hard corner and a visible cylindrical band round
the edge of the mark, wanting "the whole thing rounded and smoothed".

three's bevel profile really is a quarter-ellipse and the note in this file was
right that a full half-round is reachable without a new geometry generator. It
missed the half that matters: **ExtrudeGeometry puts the bevel OUTSIDE
[0, depth]**, so the total thickness is `depth + 2*bevelThickness`. The old
`round` lerped `bevelThickness` toward `depth/2` and left `depth` alone — so at
round 1 the mark came out twice as thick as asked for and STILL had a
cylindrical band of exactly `depth` running round its edge, with a hard corner
at each end of it. That band and those corners are the thing on screen.

The total thickness is held at `P.depth` now and split: each bevel takes
`tFrac` of it and the straight extrusion gets `depth - 2*bevelThickness`. At
tFrac 0.5 there is nothing left, the two quarter-ellipses meet, and the
cross-section is a full half-round with no corner anywhere.

    bevel   how big the round-over is       tFrac 0.02 .. 0.35
    round   closes it up into a tube        tFrac -> 0.50

**And the two paths are extruded separately now.** `bevelSize` has a hard
geometric ceiling — pull an outline in by more than half the narrowest solid
wall and that wall turns itself inside out — and ExtrudeGeometry takes ONE
bevelSize for every shape handed to it. So a single call had to use the ceiling
of the worst shape, and the gear's 15.86px wall was capping the ring's 41.9px
wall at a quarter of what it could take. The ring is the part that reads as a
tube. Extruded apart and merged, each gets the largest round-over its own wall
allows: the ring gets a true circular section, the gear an ellipse. Both smooth,
neither with a corner.

Costs one extra ExtrudeGeometry call on a geometry that is only rebuilt when a
shape parameter moves.

### 8. The environment leaked back in through two other terms

Turning the room off is `fresI: 0`, and it did not turn the room off, because
`envCol` was being read in two more places:

- **The key light lived INSIDE `envCol`.** A specular highlight physically IS
  the reflection of the light source, which is tidy and useless as a control
  surface: `envCol` is multiplied by `fresI`, so killing the room killed the
  glint with it and there was no way to ask for clear glass with a highlight.
  Split into `envCol()` and `sunAmt()`, both still fresnel-gated.
- **TIR sampled `envCol` along the bounce.** So the sky-and-ground gradient
  came back through the TIR term at any `tir` above zero even with the
  environment fully off. TIR is light that could not get OUT of the solid; its
  colour is the solid's, and the `tint` it is multiplied by already supplies
  that. It is a flat white source now.

### 9. The plate works, and it is the wrong tool for this mark

A `#141414` plate cut to the silhouette and painted under the refraction does
exactly what it promises: nothing behind the mark can be seen through it, and
the only thing the filter can find is what the displacement drags in from
outside the outline. Proved by A/B — with the plate off the headline is plainly
readable across the mark, with it on it is gone.

It is kept as a control at 0. The reason it is not the answer here is what it
does to the INTERIOR: the ring's wall is 46 design px across so the
displacement reaches outside it easily, but the gear is a solid blob 200px
across and 35px of displacement gets nowhere near its edge. So the gear filled
with flat plate colour and the refraction "got cut off inside the asset". The
plate hides the background everywhere and delivers refraction only near an
edge, which is the opposite trade to the one this mark wants.

The thing that actually removes the un-refracted copy is DISPLACING FAR ENOUGH
THAT NOTHING STAYS PUT, and that is `thick`. Measured across the covered
pixels:

| | mean move | moves < 8px |
|---|---|---|
| `thick: 0` | 20.8 px | **28.5%** |
| `thick: 8`, one box | 35.4 px | **0.9%** |

### 10. The tighter filtered box was reverted, and why

`RPAD` was 60: a 700x700 filtered box cut to 560x560, 36% fewer pixels through
the chain every frame. A real saving, except it could never be shown to be one
— the frame-cost harness measures a presentation cadence rather than work (see
GLASS-PLAN §5) — and it is not free, because the displacement ceiling is
DERIVED from that pad. A sample fetched from outside the filter region comes
back transparent, so at RPAD 60 the mark could bend by at most 54 design px.
The moment `thick` came up, the refraction hit that ceiling and stopped dead at
the box edge: a hard straight line across the mark with the refraction cut off
behind it.

An optimisation that cannot be measured is not worth a visible defect. Both
pads are 130, the ceiling is 124, and there is one box again.

### Landed in this pass, believed correct

- **A synthetic environment.** Fresnel says how much of what is IN FRONT of the
  glass you see reflected back, and what is in front of this glass is a #141414
  void — so a correct reflection term reflected nothing and only brightened.
  Three constants and a dot product: cool sky above, near-black ground below, a
  bright softbox band where they meet, and the key light IN the environment as
  a disc, so the specular highlight is the reflection of the light source
  rather than a Blinn lobe bolted on beside it. This is most of the difference
  between glass and dark plastic.
- **Total internal reflection.** The back-face pass wrote its distance into R
  and threw G and B away; the back-face NORMAL goes there now, which buys the
  second interface — the surface the refracted ray leaves through — and past
  the critical angle it cannot leave. Hard bright streaks near the edge, which
  nothing else in a shading model produces. Two channels of a target that was
  already being rendered.
- **Beer-Lambert over the true ray length.** `pathL / -T.z`, not the axial
  thickness. A ray crossing at 60 degrees travels twice as far through the
  solid as one crossing square and the axial measurement cannot tell them
  apart. This is what drei drives its own attenuation off.
- **A real bloom knee.** `bloomT` was `contrast(1 + t*2) brightness(1 - t*0.5)`,
  which pushes bright brighter and dim dimmer but never takes anything to zero
  — so the whole mark bloomed and the "threshold" only changed by how much.
  It is `max(0, in - T)/(1 - T)` now, exactly, via an SVG
  `feComponentTransfer type="linear"` referenced from `ctx.filter` (verified
  on this machine with a probe that pushed 0/64/128/255 through it and read
  0/0/0/255 back). **Alpha goes through the same knee**, which is the other
  half of it: the glow is composited with `lighter`, which adds alpha as well
  as light, so a knee that zeroed only the colour would still stamp a
  full-coverage rectangle of alpha over the ring's hole and turn the copy
  behind it milky.

### Asleep when unseen

An `IntersectionObserver` on `.off` with a viewport of slack either side, plus
`document.hidden`. Off screen the refract layer's `backdrop-filter` goes to
`none` — opacity 0, `visibility:hidden` and a transform off screen all leave it
DECLARED, and a declared backdrop-filter is evaluated. Verified: `none` when
scrolled away in either direction, restored when back.

Thirty seconds asleep and it gives the memory back too — the half-float
back-face target, the cached encodes, the bloom scratch, and the renderer's
drawing buffer, which at 700x700 at dpr 2 is the biggest single allocation
here. **The WebGL context is kept.** The plan asks for `renderer.dispose()`;
that drops the context and costs a full rebuild of geometry and materials on
every scroll past, on a page that already holds several contexts. Giving the
buffers back gets the memory without the churn.

### The filter chain is assembled, not just retuned

The chromatic split was five primitives whether or not `chroma` was non-zero.
The chain is now built from whichever features are actually switched on and
rebuilt when either crosses zero:

| chroma | absorb | primitives |
|---|---|---|
| > 0 | > 0 | 11 |
| > 0 | 0   | 10 |
| 0   | > 0 | 4 |
| 0   | 0   | 3 |

Verified by reading the live filter's children back out of the DOM.

### The filtered box is smaller than the others

`--gpad` was 130 design px a side, so 44% of the area a backdrop-filter had to
evaluate was padding. That padding buys two things and only one of them is on
this layer: the BLOOM needs somewhere to spill and the bloom lives on the
canvas; the DISPLACEMENT needs its samples inside the filter region, and that
only needs as much room as the displacement actually reaches.

So there are two pads now. `--gpadc` (130) is the canvas/encode box; `--gpad`
on the refract layer is 60, which takes the filtered area from 700x700 to
560x560 — **36% fewer pixels through the whole chain**. The mask raster is made
at the canvas box and POSITIONED onto the smaller one at its true size; the map
gets the same treatment through its `feImage` subregion, which is allowed to
start outside the element because `primitiveUnits` is the border box.

`RPAD` and the soft limit are one decision: raise it and the mark can bend
harder, lower it and the filtered area shrinks. `verify-glass.py` checks both
pads against their CSS.

### Performance — MEASURED, and the measurement did not work

`tools/perf.js` launches a real window on the real GPU and drives it over CDP:
three configurations (live / backdrop-filter none / glass not in the DOM) over
the same scroll, plus a control band elsewhere on the page and an idle floor.

On ANGLE / Intel UHD 620 / D3D11 every configuration came back at a median of
**62.5ms and would not move** — including `idle`, which does not scroll at all,
and `hidden`, which removes the ring entirely. A bisect that hid EVERY canvas
on the page (1.9 megapixels, the full-viewport hero shader included) moved the
median by 8ms, and restoring them moved it back by less than that.

`--trace` says why. Across a 35-second window the renderer spends **11 to 13
seconds inside `DXGISwapChainImageBacking::Present`**, and the same 11 to 13
seconds with the glass live, with the filter off, and with the ring not in the
DOM. That is the swap chain WAITING to be presented, not work. A window driven
from a script is not necessarily being presented at the display's rate, and
when it is not, frame INTERVAL measures the presentation cadence and nothing
else. 62.5ms is nine intervals of a 144Hz panel, which is what that looks like.

So the number to take from this is: **`tools/perf.js --trace` can tell you what
the renderer SPENDS. It cannot tell you the frame rate.** The plan's §5.6
baseline — scroll the section with the frames pane open, then again with
`backdrop-filter` forced to `none` — still wants a human at a normal foreground
window. It is the one item on the plan that did not survive automation, and
every optimisation in this pass was therefore made on the grounds that it is
strictly less work, not on the grounds that it was measured to help.

### Still open

- The §5.6 baseline, by hand, in DevTools.
- `MAPRES` is still 512. §5.4 says 384 is very likely indistinguishable and is
  44% fewer pixels to sample; that is a measurement, and the measurement is the
  thing that is blocked.
- Absorption varies with path length now, but this GEOMETRY is nearly a flat
  plate — the ring wall is 41.9 design px across and the round-over can only
  reach about 4 of that before the gear's 15.86px wall self-intersects. So the
  thickness that absorption is driven by is close to constant across most of
  the mark by construction, and the "thin edges nearly clear, thick middles
  deep" gradient the plan asks for is a narrow edge effect rather than a broad
  ramp. That is honest for this shape; getting more would need per-shape bevel
  sizes, which `ExtrudeGeometry` does not take.
