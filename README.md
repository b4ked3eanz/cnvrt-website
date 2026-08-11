# CNVRT Labs — site (run 3)

Live: **https://b4ked3eanz.github.io/cnvrt-website/**
Figma: `B1cmOLvPovPPNLZUWg0I5s` (file key — the API token lives in `$FIGMA_API_KEY`)

One hand-authored `index.html` plus `assets/`. No build step, no package.json, no
framework. Open the file and it runs.

---

## The one rule that explains most of the code

**The page must work opened directly from disk (`file://`).** That single
constraint is behind nearly every odd decision in here, because on a `file://`
page Chrome treats every local file as *cross-origin*:

| What you'd normally write | What happens on `file://` | What we do instead |
|---|---|---|
| `mask-image:url(x.svg)` | Blocked by CORS. A mask that fails to load resolves to **transparent black**, so the element vanishes — **silently**, no console error | inline the SVG as a `data:` URI |
| `texImage2D(…, imgFromDisk)` | **`SecurityError`**. WebGL hard-errors on a canvas a cross-origin image has touched (canvas2d only taints quietly) | load the asset from a `data:` URI |
| `fetch()` / `XHR` a local file | Blocked | classic `<script src>` — no CORS on those |
| `<img src>`, `<video src>` | Fine | — |

`data:` is the one local scheme that counts as same-origin. That is why
`assets/js/hud-frames.js` exists and why the card masks are inlined in the CSS
rather than living in `assets/svg/`.

**If something renders on a dev server but not from disk, this is why.** To
reproduce: run headless Chrome *without* `--allow-file-access-from-files` (that
flag hides the entire class of bug).

Fonts are already inlined as data URIs in `assets/fonts/fonts.css` for the same
reason.

---

## Layout system

`--u` is one Figma design pixel: `calc(100vw / 1920)`, refined by JS to
`clientWidth` so a scrollbar can't desync it. Everything is absolutely
positioned at its literal Figma coordinate times `--u`.

Conversions applied throughout (verified against Figma's own SVG export, which
writes `stdDeviation = radius / 2`):

```
LAYER_BLUR      radius R  ->  filter: blur(R/2)
BACKGROUND_BLUR radius R  ->  backdrop-filter: blur(R/2)
DROP_SHADOW     radius R  ->  text-shadow blur R      (1:1)
cornerSmoothing ~1.0      ->  squircle path, NOT border-radius
```

**Watch out:** sections are `height:100vh` but the stage inside is `1080 * --u`
tall. On anything shorter than 16:9 the bottom of the design overflows the clip.
Anything that must stay visible (footer metadata, and previously the tuning
panel) has to escape the stage and bottom-anchor to the *section*. This has
bitten twice.

---

## Sections

| Section | id | Figma node |
|---|---|---|
| Hero | `#hero` | 501:2838 (state 1), 501:2748 (state 2) |
| Section 2 | `#sec2` | 518:4588 (built frame 518:4553) |
| Offerings | `#offerings` | 511:3905 |
| Work | `#work` | 529:4787 (layout), 529:4786 (entrance) |
| Pricing | `#pricing` | 434:3855 |
| Footer | `#contact` | 527:4652 (rest), 455:4426 (hover) |

### Hero — two Figma states, scrubbed by scroll

`501:2838` *hero frame state 1* settles into `501:2748` *hero frame state 2*.
Both are 1920x1239 with the 100vh line at y=1080. The section is
`--hero-travel + 100` vh tall and `.hero__panel` pins inside it, so the settle
advances at **63%** of normal speed, so it spends 100/0.63 = **159vh** of scroll.

**Only three layers move.** Every other element is at identical coordinates in
the two frames and is simply left alone — no per-element animation, no state
list. That is the single most useful fact about this section.

| layer | state 1 | state 2 |
|---|---|---|
| `Frame 1820556622 1` (video) | `(-471,-22.4111)` 2732.2603x1541.5658, rot +5.29 | `(-242,-59)` 2404x1357, rot 0 |
| `roundframe` (511:4200/4198) | `(180.2408,2298.8606)` 2755 sq, rot -111.1961 CSS | `(604.5605,154.5605)` 723.4374 sq, rot 0 |
| `plus frame` (511:4201/4199) | `(-714.9678,455.2674)` 2371 sq, rot -42.9411 CSS | `(577,132)` 767 sq, rot 0 |

Both ornaments were re-authored as single **VECTOR** nodes, so these are their
own transforms now — there is no wrapper frame left to reason through.

**The plus frame is inlined rather than an `<img>`, and that is not a style
choice.** Figma holds its stroke at 1px in *both* frames — it does not scale the
stroke with the node, which is 767 in one and 2371 in the other. `transform:
scale()` scales the rasterised result and would carry the stroke with it, so
state 1 would render a 1px hairline 3.09px thick. The width is divided back out
by exactly the scale being applied, as a **presentation attribute** rather than
CSS: a unitless `stroke-width` in CSS serialises back as px and it is then
genuinely ambiguous whether the engine took user units or CSS px. Measured 1.0
design px at both ends.

**Figma stores rotation mod 360**, so whole turns the designer wanted are
dropped from the file — 870deg and 150deg are the same node, and nothing in the
API can tell them apart. The ornaments are meant to *spin* in rather than merely
arrive rotated, so `SPIN_TURNS` (2) adds the turns back. A whole multiple of 360
leaves both endpoint poses bit-identical to the frames, so it changes the
journey and not the destination.

**Every one of those figures came from `relativeTransform`, not from the
bounding box, and that distinction is the whole trap.** Two of the three layers
are rotated, and a rotated layer's `absoluteBoundingBox` is not its size:
the roundframe reports **4273 square while the layer is 3108**, and the video
reports 2862.7497x1786.9041 for a layer that is 2732.2603x1541.5658. Building
from the bbox gets the scale *and* the origin wrong at the same time, and the
two errors partly cancel, so it looks nearly right and drifts. `get_metadata`
also reports the *unrotated* y (-22.4111) while the REST bbox reports the
*rendered* y (-274.315); the disagreement between those two numbers is the
tell that a layer is rotated at all.

Note `size` and `relativeTransform` are absent from the default REST payload —
`/v1/files/:key/nodes` only returns them with **`&geometry=paths`**.

The video is the odd one out. Its two poses reduce to a delta about the
**shared centre** — state 2's centre is `(960,619.5)`, the exact middle of the
frame — so it scales about `50% 50%`, while the two ornaments turn about their
own top-left, where Figma's origin sits. Each origin implies a different
translation, so they cannot be unified onto one convention.

State 2 is the **identity**. It lives in the CSS, the scroll loop only ever
writes the delta, and the settled hero is therefore correct even if the JS
never runs.

```js
var S1 = {
  hx:  0.375,     hy: -0.362,    hr: -5.28994, hsx: 1.1365475, hsy: 1.1359365,
  rx:  0.2211,    ry:    0.2203, rr: -111.1961, rs: 3.808208,
  px:  0.0001,    py:    0.0010, pr:  -42.9411, ps: 3.091265
};
var SPIN_TURNS = 2;        // whole turns Figma could not store
```

**All three turn about their CENTRE**, so every translation here is
centre-to-centre and every one of them is tiny:

| | state 1 centre | state 2 centre |
|---|---|---|
| media | (960.375, 619.138) | (960, 619.5) |
| roundframe | (966.5003, 516.5002) | (966.2792, 516.2799) |
| plus frame | (960.5000, 515.5006) | (960.4999, 515.4995) |

An earlier pass anchored the two ornaments at `transform-origin: 0 0`, on the
reasoning that Figma's `relativeTransform` puts a layer's origin at its
top-left. **That reaches the right endpoints and is wrong in between** —
rotating about a corner swings the piece through an arc, and a 2755px layer
swung through 111 degrees travels a long way across the frame on its way to a
pose it was always going to land in. It reads as being flung rather than
turning. Solving both poses as a centre delta shows they were placed concentric
all along: the move is a pure enlarge-and-rotate in place, which is what Figma
itself would tween.

The media scale is deliberately **non-uniform**: the designer's two boxes are
1.7724 and 1.7716 wide-to-tall, so one figure would leave a 0.05% seam against
a video that matches neither.

Easing is Figma's `cubic-bezier(.35,.54,.29,.98)`, solved by the same bisection
the work section uses. Both handles sit high and the second x (0.29) is *left*
of the first (0.35) — legal, and it is what pins the curve near 1 across the
back half. Measured: 58% of the move is done by 30% of the scroll, and the rest
crawls in.

#### The lens — on the ornaments, not the video

The footer HUD's treatment rides the two pieces that fly in from off-frame: the
roundframe and the plus frame. **Not the video.**

That distinction is what makes it tractable. The ornaments are `<img>` line art,
so this is a real `filter` chain rather than the `backdrop-filter` contortion a
`<video>` would force — and it is the only reason a genuine per-pixel **warp**
is affordable at all. (Sampling a `<video>` into a WebGL texture throws
`SecurityError` on `file://`, so the footer's actual shader can never be reused
here.)

`#hudLens` is warp -> blur -> channel split, in that order. Displacing *after*
the blur smears an already-soft edge into mush; splitting *before* it just blurs
the fringe away again.

Every stage is an exact **no-op at rest** — `scale=0`, `stdDeviation=0`, `dx=0`,
and screening R+G+B back together on channel-isolated layers is an exact
recombination, not an approximation. That is what lets one filter run from full
strength to nothing without a seam.

**Cost is bounded by layout size, not by what you see.** CSS `filter` is applied
in the element's own coordinate system and the `transform` maps the result
afterwards, so the chain runs over 724x724 and 767x767 even at state 1 where the
roundframe covers 4342px. The flip side is a feature: blur and split are
magnified by that same scale, so the piece further out is the more distorted one
for free.

```js
var HUD_BLUR = 2.2, HUD_CA = 1.6, HUD_WARP = 12;   // each ornament's LOCAL px
```

**These are sized against the artwork's features, not the element**, and that is
the one trap here. The roundframe's dots are ~6 local px across.
`feDisplacementMap` displaces by +/- `scale`/2, so a first pass at `HUD_WARP: 34`
moved every dot by up to three of its own widths and **dissolved the ring into
speckle** instead of bending it. The footer HUD survives those figures because
it is dense continuous line art; sparse dots do not. The plus marks are ~16
local px and take the same numbers far more gently — one filter cannot be ideal
for both, and the dots break first.

`feTurbulence` is the only expensive primitive in the chain. **If the settle ever
feels heavy, zero `HUD_WARP` first** — blur and split are cheap. The filter is
also detached outright (`filter:none`) once `k <= 0.004`, because turbulence
would otherwise keep running per frame, on two elements, for the whole rest of
the page.

#### What changed from the old hero

- Headline is **two single-line frames**, not one wrapped block, and is now
  80/64 at `ls 0` where it used to be 96/76.8 at `ls -1%`.
- Logo `(14,14)` -> `(260,14)`; the CTA cluster `(1692,18)` -> `(1456,18)`.
  Both are `position:fixed` shared chrome, so this moved for every section.
- New: menu button `(20,20)`, four grid ticks at `(206|1705, 125|438)`, and the
  `>WORK / >OFFERINGS / >PRICING` list at `(1200,125)`.
- Gone: the testimonial card, the `CNVRTLABS` wordmark, and the agent bar
  (held back by `body.hero-live` for the hero's scroll only, then restored).
- The roundframe's opacity travels 0.7 -> 0.4 with everything else.
- `.hero__comp` is 1239 design px tall — the design runs 159px past the fold —
  floored at 100vh so a viewport taller than 16:9 cannot leave it short.

The menu button is an **empty** `<button>` with its three lit layers as
siblings, not children. `position:fixed` establishes a stacking context, so a
blended child inside it would composite against that context's transparent
backdrop instead of the video — the same trap the file header records for
`.logo`.

`>WORK` etc. are PP NeueBit Bold 18 in Figma. That face is not one of the four
supplied, and the CONTACT button already set the substitution: MD Thermochrome,
sized down because NeueBit is far more condensed (20 -> 16 there, so 18 -> 14
here). 14 is also the largest size at which `>OFFERINGS` still fits the 86-wide
column — it measures 79.24.

### Hero phase 2 — the shimmer devours it

Once the state settle lands, the shimmer comes up off the bottom of the hero and
eats it while offerings rises over the top. Lifted from the `shader.html`
harness — read **SHADER.md** for the application guide and **PICKUP.md** for why
each of the 102 constants is what it is. The panel, the localStorage layer and
the scrub/freeze affordances are dropped; the GLSL, the falloff-curve LUT and
the draw loop are verbatim.

**The one structural change is where the envelope starts.** In the harness it
ran from the top of the document. Here the hero spends `--hero-travel` vh
settling from state 1 into state 2 first, so everything the loop reads is
re-based through `HERO_T()`:

```js
var envY = Math.max(0, smoothY - HERO_T());
var raw  = Math.min(1, Math.max(0, envY/span));
```

`HERO_T()` reads the same `--hero-travel` off the `.hero` rule that the state
loop divides by, so the two phases cannot drift apart.

#### How 10% is achieved

Not by pinning. The sticky panel has already released by phase 2 and would
scroll away at 100%; pushing it back **down** by `(1 - heroPar)` of the distance
leaves it creeping up at `heroPar` instead, without taking it out of flow:

```js
var creepY = Math.max(0, window.scrollY - HERO_T());
hero.style.setProperty('--hero-creep', (creepY*(1 - P.heroPar)).toFixed(2) + 'px');
```

**RAW `scrollY`, never a smoothed copy** — this is the one that bites. The term
has to cancel the panel's own layout motion exactly, and layout follows the real
scroll position with no lag. Driving it from the damped `smoothY` made the hero
drift back *down* every time the wheel stopped: the damped value was still
catching up, so the compensation kept growing after the motion it was
compensating for had already finished. It read as a bounce. **It is a geometric
correction, not an eased one.** The veil is free to ride the eased progress,
because nothing is registered against it.

Measured: after 491px of scroll the panel top sits at -49.10px, exactly 10%, and
identical across two frames with no scrolling in between.

#### The front IS section 2's top edge

The devour boundary is not swept on a timeline of its own. It is read straight
off the next section's live rect every frame:

```js
var offTop = offEl.getBoundingClientRect().top;
var raw    = Math.min(1, Math.max(0, 1 - offTop/vh));
var base   = (vh - offTop)*s;      // gl_FragCoord has y=0 at the BOTTOM
```

So the shader's black and section 2's own background are **the same edge** —
seamless by construction rather than by tuning two durations against each other.
What the shader contributes is the ragged part: the front wanders either side of
that line, so black fingers eat up into the hero while the section's flat
background continues underneath. The transition therefore takes exactly as long
as section 2 takes to arrive, and needs no `env` at all.

This is also why **the harness's `smoothScroll` damping is bypassed** for the
front. Any lag between the front and the rect it is welded to shows up directly
as a gap or an overlap along that edge — the one artefact this arrangement
exists to avoid. The rect is read raw, on the frame it is rendered.

The harness's `above`/`below` margins do not apply either. They existed so a
front sweeping on its own timeline would clear the canvas at both ends; closure
here comes from section 2 physically covering the viewport.

**Every shader parameter is the harness's own.** `env` and `fadeLen` were
briefly shortened and are not any more — retuning an effect that was measured
against reference footage was the wrong instinct. `heroPar` is the single
deviation (0.30 -> **0.10**), and only because the creep was specified directly.

#### Darkening

`--hero-dark` ramps to `HERO_DARK` (0.62) across the envelope, painted as a flat
black veil on `.hero__panel::after`. Deliberately **not** `filter:brightness()`:
the shimmer line is drawn on the canvas *above* the hero, and a brightness
filter on the panel would leave it untouched while crushing everything else —
or, applied higher up, would crush the line too. The veil sits under the canvas,
so the black climbs over an already-dimming hero and the line still burns.

This is the part the shader has **not** reached yet losing its light. The shader
only paints where it has already devoured.

#### Layering — `#env` and the two stacking indices

`#env` is `position:fixed` and sits between the hero and section 2 **in DOM
order**. For everything with `z-index:auto` that ordering is the whole
mechanism: positioned elements paint in source order, so the canvas lands above
the hero and below what follows. **Never give `#env` a stacking index** — it
would lift over everything after it.

There are exactly two `z-index` declarations in the file, and both exist because
`#env` is opaque black over the stretch after the hero:

| | | why |
|---|---|---|
| `.off` | `z-index:1` | Without it, offerings paints **under** `#env` and is invisible. This was mistaken for a long "gap" between section 2 and offerings for a while — the composition was there the whole time, behind the canvas. Proved by hiding `#env`: the block *and* the nav both reappeared. |
| `.sec2` | `z-index:2` | One above `.off`, so `.off`'s opaque background cannot cut into section 2's exit, and so section 2's panel can act as the curtain that hides offerings while it pins. |

If you add a section after offerings that also needs to clear the canvas, it
needs an index too — `.ftr` is still `auto` and would show the same symptom if
the envelope is ever opaque over it.

### Section 2 -> Offerings — one slowed pass, then a curtain

These two are designed together and break together. Read this before touching
either driver.

#### The shared idea: speed, integrated

Both sections define a **speed curve** `v(u)` — a multiple of the scroll — and
offset their content by the **integral** of it. Position is the integral of
speed, so each layer's velocity *is* `v`, exactly, and `v` is continuous by
construction. Lerping a transform toward a target instead is what produces the
classic scroll-jacking lurch, because the implied speed jumps whenever the
target does.

`position:sticky` does the **cancelling**, never the holding. The compositor
kills the scroll in the same frame it happens; script writes only the creep on
top. Cancelling the whole scroll from script means a main-thread transform
racing a compositor scroll, and every late frame shows the full scroll through.

**This is why neither section may have a ramp while unpinned.** Offerings had a
"pre-roll" that decelerated it during its approach, before sticky engaged. The
error there is `(1 - v) x per-frame scroll delta` — about 82% of it, ~49px of
wobble on a fast scroll. That was the jitter. Once pinned the same error is
`v x delta`, ~18%, which is the accepted design. No pre-roll length fixes it;
there simply cannot be one.

#### Section 2

| | |
|---|---|
| ramp-in | `0.06vh` — reaches the floor almost immediately |
| floor | `V_SLOW 0.065` |
| hold | `3.94vh` |
| **ramp-out** | **`0`** — it never speeds back up |

`RO` is deliberately zero. It used to return to 1.0 and that read as the section
speeding up once it was done. Removing it means the exit must fit inside the
hold, so the hold was lengthened 2.90 -> 3.94 and `RE` moved to the matching
fraction (`0.70`) — that keeps the letter reveal at the **same absolute `u`** it
always had, so its pacing is untouched. Do not "fix" this by moving `RE` as a
fraction alone; that compresses the reveal.

The section is `100vh + U_END`; `U_END = RI + HOLD` now that `RO` is gone.

#### Section 2's exit

Content lives in **two stages** inside the panel, because the exit is staggered:

1. `.sec2__stage--aux` — the corner marks and the `./NN` counters
2. `.sec2__stage--text` — the lines

After the last letter lands there is `XDELAY 0.08vh` of stillness, then each
group eases up to `XSCALE 1.28`, blurs to `XBLUR 26` design px and fades out
over `XLEN 0.50vh` — the text lagging the counters by `XSTAG 0.20vh`. Blur is
quantised to 8 steps; these are viewport-sized composited layers and changing a
filter on one re-rasters the whole thing.

Three rules that were each learned the hard way:

- **The drift goes on the STAGES, not the panel.** The panel is the curtain, and
  a curtain that moves is not a curtain: carrying `-D` slid it up ~270px, its
  bottom edge lifted off the viewport bottom, and offerings was visible shooting
  up through the strip underneath at full speed before being clipped again.
- **The black lives on `.sec2__panel` alone.** `.sec2` itself has **no**
  background. With a second opaque box on the section at `z-index:2`, hiding the
  panel revealed nothing — the section's own background went on covering
  offerings and the screen stayed black. One black, on the thing that fades.
- **Past the exit the section is inert.** It stops writing its transform,
  `visibility:hidden`s both stages and the panel, and early-returns. A finished
  section still driving transforms every frame is a second moving layer for the
  next one to fight with. Measured: 0 transform writes while parked.

`DROP 90` is a constant design-px offset on the stage transform — the whole
composition sits that much below its Figma y. Reveal and exit only ever cared
about distances, so it costs them nothing.

#### The hand-over

Offerings is pulled **up** into section 2 by `gapUp 1.655` (a negative
`margin-top`) so that it is **already pinned and already at floor speed** before
anything of it can be seen. Section 2's panel — motionless, opaque, `z-index:2`
— hides it for the whole approach, then dissolves over the last `CURTAIN 0.20vh`
of the exit and hides.

Offerings has **no entry transition**. It does not fade or blur in; the black
lifts and it is simply there, rising. It first becomes visible at `y ~= 969` of
983 — the very bottom edge — already moving at exactly its floor speed.

`gapUp` is a constant tuned against section 2's exit timing. **It is not
auto-linked across the two drivers** — retune `XDELAY`/`XSTAG`/`XLEN` and you
must nudge `eat sec2 tail` on the backtick panel to match.

#### Offerings

Tuned values currently shipped, all off the backtick panel: `openAt 0.04`,
`closeAt 0.87`, `rStart 0` — the rows open earlier in their band, hold longer
before collapsing, and the relay no longer waits after the list arrives. Section
resolves to **744vh** with those.


Two speeds off one curve. The panel carries the headline and chip; the list
rides inside it and gets the *difference* of the two integrals.

| lever | value | what it is |
|---|---|---|
| `vPanel` | `0.184` | left bit speed |
| `vList` | `0.205` | right bit speed |
| `startLow` | `900` | design px the LEFT bit starts below its Figma y |
| `listLow` | `620` | the same for the RIGHT bit, independently |
| `gapUp` | `1.655` | vh pulled up into section 2 |
| `ri` | `0` | **must stay 0** — see the pre-roll note above |
| `hold` / `ro` | `0.85` / `0.75` | **minima only**, see below |
| `startPad` / `endTop` | `40` / `90` | where the relay may start and must end |
| `openAt` / `closeAt` | `0.14` / `0.78` | when a row expands and collapses inside its band |

**Overtake** — how far the list gains on the headline across the section — is
the speed differential *times* the section length, so it grows on its own
whenever the section gets longer. At `0.184/0.205` over 7.7vh it is ~126px.

**`hold` and `ro` are minima, not lengths.** Each build solves for two
invariants and grows the section until both hold:

1. the relay finishes **inside** the slow stretch, or the last row expands while
   the list is accelerating;
2. the composition clears before the hand-over to WORK.

`RS` and `RE` are both **solved from the list's real position**, not chosen —
`RS` from when the list is actually on screen (this was a bug: with `listLow` at
620 the first row expanded at `y 1097`, entirely below the fold), `RE` from when
it reaches `endTop`. Both track `listLow` and `vList` automatically.

**The relay** runs one row at a time — each opens, then closes, then the next —
and the section leaves with all three collapsed. `.is-on` and its 0.62s expo
transitions are untouched by the driver; it only decides which row wears the
class.

**Both drivers read raw `window.scrollY`, not the eased `SY.y`**, because
`position:sticky` is resolved by the compositor against native scroll. Mixing
the two clocks makes their relative offset wobble by the smoothing lag every
frame, which is visible the moment both are on screen.

#### Backtick panel

Backtick opens sliders for every offerings lever above, persisted to
`localStorage` under `cnvrt.off.v1`, with the live section length read out at
the bottom. Section 2's constants are **not** on it — they are `var`s at the top
of its driver.

#### Every knob in this section, in one place

| what | where | value |
|---|---|---|
| start pose | `P0` | Figma **531:4875** — 6.85005×, −52.3279°, (1919.529, 5776.186) |
| end pose | `P1` | Figma **529:4845** — 1×, 0°, (960, 454.191) |
| easing | `FLY` | `cubic-bezier(0.31, 0.66, 0.02, 0.99)` |
| entrance length | `ENTER` | **240vh** |
| logo card hold | `LOGOV` | 90vh |
| per project card | `BAND` | 135vh |
| how early it starts | `.work { margin-top }` | **−128vh** — the only lever on the handover |
| chromatic split | lens panel, `LD.ca` | 52 screen px at full |
| defocus mix | lens panel, `LD.blur` | 1.00 |
| falloff | lens panel, `LD.x1..y2` | (0.756, 1.000) (0.703, 0.474) |
| defocus sigma | `tools/bake-work-still.py`, `SOFT_SIGMA` | 5.2 design px — **needs a re-bake** |
| bake scale / padding | same file, `K` / `PAD` | 1.0× / 2.5σ |

Backtick opens both panels: WORK LENS top-left, OFFERINGS top-right.


### Work — the piece flies in, then five cards wipe

Restructured from `529:4787` *work showcase latest*, with the entrance taken
from `529:4786` *work animation*.

Two boxes and nothing else:

| box | Figma | what it is |
|---|---|---|
| `.work__frame` | `529:4789` *screen* | **1920×765, full width**, flush to the top of the viewport. Holds only the TV. |
| `.work__meta` | `529:4805` | the **1400 row** — four columns, `225 / 460 / 460 / 225`, gap 10, tops aligned |

Everything the old layout had in a left rail and a right rail now lives in that
1400 row. The bottom-left terminal block (`cnvrtlabs/projects:`, the four-item
list, EXPLORE ALL) is gone with it — it has no node in the new frame and its old
y range is where the copy row now sits.

**Every column is fixed in WIDTH and free in HEIGHT** (`align-items:flex-start`),
which is the "frames can extend downward" requirement literally: a longer
headline pushes its own column down and leaves the other three where they are.

#### The TV is a fraction of the frame, not of the page

`.work__tv` is `54.375%` (1044/1920) of `.work__frame`, `aspect-ratio:1044/733.7762`,
anchored **by its centre** at `50% / 59.37136%`. Every part inside it — screen,
glow plates, LED grid, piece glow — is a percentage of the TV in turn.

That is what makes the entrance one `transform` on one element. Nothing below
re-lays out, and the blurs scale with the piece exactly the way Figma scales a
blur with its node.

The centre, not the top-left, because **the centre is the only anchor the four
entrance poses share**. Three of the four are rotated, and rotating about a
corner swings the piece through an arc on its way to a pose it was always going
to land in — the same trap the hero ornaments hit.

The whole TV is the *old* one, uniformly scaled: `1044/912 = 1.14474` maps every
old offset onto its new one exactly (23→26.329, 866→991.342, 453→518.566), so
`work-panel.png` and `work-grid.png` are unchanged.

#### The entrance

**Two poses, start and end.**

| node | scale | rotation | centre | |
|---|---|---|---|---|
| **531:4875** | **6.8501** | **−52.328°** | **(1919.5, 5776.2)** | **start** |
| 529:4845 | 1.0000 | 0° | (960.0, 454.2) | **end** |
| 529:4770 | 6.0735 | −19.058° | (1667.2, 4916.4) | superseded start |
| 511:3672 | 4.2075 | −16.340° | (1308.9, 2197.2) | dropped middle |
| 511:3709 | 1.7733 | −7.754° | (1005.0, 996.5) | dropped middle |

The start is a *later* frame than the original: the piece comes in at 6.85× and
52° rather than 6.07× and 19°, from further right and further down. That is not
cosmetic. Rotated 52°, the piece's own glow spans an axis-aligned box tall enough
to reach **past the top of the viewport at e = 0**, where the old pose left it
70-odd design px short of the fold. The section used to open on a black frame and
stay black for a stretch; the glow is now on screen from the very first frame of
the entrance and the bezel itself clears the fold 14% in.

**Every figure is off `relativeTransform`, not the bounding box.** A rotated
group's `absoluteBoundingBox` is not its size — the start frame reports 8349×8732
for a layer that is 7151×5026. Building from the bbox gets the scale *and* the
origin wrong at once and the two errors partly cancel, so it looks nearly right
and drifts. `size` and `relativeTransform` only appear in the REST payload with
**`&geometry=paths`**.

**Why the middles went.** The four original poses are nowhere near one straight
path: measured against each channel's own range, pose 2 is **37% through the
scale, 14% through the rotation, 51% through x and 61% through y**. A Catmull-Rom
forced through all four accelerates and decelerates three separate times on the
way down, and that read as the piece hunting for a frame.

**One parameter for every channel.** There was a front-loaded curve on the travel
for a while — `e(2−e)`, to get the piece over the fold sooner — and it caused
exactly the fault it looked like it was fixing. With the centre nearly home while
the piece is still 2× wide, the top edge crosses the top of the viewport and then
comes back **down** as the piece shrinks. On screen that is the piece overshooting
out of the top and being pulled back.

On a single parameter every edge is monotone. With 52° of rotation in play the
edges that matter are those of the *rotated* bounding box, so this is checked
numerically rather than algebraically — 4000 samples through the real bezier:

```
top     1410 →   87   falling        left  −2255 →  438   rising
bottom 10142 →  821   falling        right  6094 → 1482   falling
```

**No channel reverses direction anywhere in the travel.** It rises and settles;
it cannot overshoot.

Timing is the reference curve, **`cubic-bezier(0.31, 0.66, 0.02, 0.99)`** — `FLY`
in the module. It replaced `0.23, 0.59, 0.29, 0.98`; both are strong ease-outs,
this one holds a little more of the travel through the first third and has a
flatter tail.

#### The flight is an image, and that is the whole performance answer

**Nothing in `.work__tv` is drawn while the piece is travelling.** It is
`visibility:hidden`; what you see is `work-still-*.webp`, the settled piece —
panel, both glow plates, the orange screen, the mark, the LED grid and the
piece-glow vectors — baked flat onto the section's own `#141414`.

**Its box is the plate padded by 2.5σ of the far glow**, not 4σ. At 2.5 the glow
is at 0.006 of peak — invisible over the ground — and the box is **41% smaller in
area**. That matters more than it sounds: the element is masked, so Chrome
renders the whole thing into a surface before compositing, at whatever scale the
piece is currently drawn. At 6.85× four sigma was a 12,800 × 10,000 surface.

**And the bakes are 1× design px, not 1.5×.** The still is only ever seen
magnified — the swap to the live piece happens at scale 1.0000 — so a bake wider
than the box at 1× buys nothing and costs decoded bitmap.

Together those two took the flight from **134MB of decoded texture to 21MB**:

| | dimensions | decoded |
|---|---|---|
| `-r` / `-c` | 1735×1263 | 8.4MB each |
| `-soft` | 868×632 | 2.1MB |
| mask | 868×632 | 2.1MB |

Four 3273×2564 bitmaps rastered at up to 6.85× is what Chrome was thrashing —
the piece visibly *refreshed* as tiles were dropped and redrawn. The defocus
plate also takes `visibility:hidden` rather than just `opacity:0` whenever its
amount is zero, which is most of the entrance now the ramp is front-loaded: an
opacity-0 layer is still a layer the compositor carries, and that one is a
full-size image sitting over two others.

**It is an opaque plate, and the alpha machinery that used to be here is gone.**

For several rounds the flight carried a real alpha channel, with a mask on
`.work__still`, `.work` and `.work__panel` going transparent while offerings
left, and a `.work__ground` plate to close the seam that transparency opened.
All of it existed so the section could pin *before* offerings had finished
leaving. It cost a masked render surface at every scale — and it was where the
faint orange outline round the whole piece came from.

**None of it was necessary.** The gap it was solving was not the handover at
all; it was **dead scroll**, and dead scroll is a margin, not a compositing
problem. Measured against `.work`'s own top there were ~1050px of it: offerings
gone, `.work` not yet on screen, the piece frozen at 6.85×. `margin-top` on
`.work` deletes exactly that, touches nothing inside offerings — its scroll
mapping, speeds and integration are untouched, the box after it just starts
sooner — and costs nothing per frame.

**`-128vh`, and the number is measured.** Two earlier guesses were both wrong in
instructive ways:

- The first reasoned from design-px offsets inside the panel and produced "about
  7vh of slack". It ignored how far the panel itself had already slid.
- The second closed all 1050px by measuring against `.off__list`, and clipped the
  headline. **The list is not the last thing out.** It *overtakes* the panel —
  that overtake is the whole point of `vList > vPanel` — so it leaves first, and
  `.off__line--4` is what is still on screen after it has gone.

Sampled against the line, `d` relative to `.work`'s top:

```
d        -300  -200     0   +88
line4Bot  257   206    72    ~0     <- the line finally clears
workTop   300   200     0
          clear  6px  72px          <- clipped, at -140vh
```

So the pin has to land at `d = +88`. `-128vh` puts it at about `+118`. Verified
across the whole approach at 100px steps: **clear at every sample, worst case the
headline sits 14px above the panel edge**, and it finishes leaving in the same
frame the entrance starts.

Per frame the flight is now **two image draws and one additive blend** (three
while the defocus is non-zero). No mask, no alpha, no transparency toggle, no
ground plate, no blend on the section.


**The three bakes are `decode()`d at load.** They are 3273×2564 each — about 33MB
of bitmap apiece — and a plain `<img>` defers that until the first frame it has
to paint, which is the first frame of the entrance. That is the hitch on the
first scroll through. `decode()` moves it to load time, where nothing is
animating.

**The cost of that opacity is that the flight cannot escape a clip.** `.work` is
`z-index:2` above `.off`'s `1`, so stacking is not the issue — what cuts the
piece during the run-in is `.work__panel`'s own `overflow:hidden`. Over that
stretch the panel's box top sits partway down the screen (214px showing at e=0,
growing to the full viewport as it pins) and the glow is guillotined along that
line. Removing the clip is not available while the still is opaque: it would
blank offerings' headline the instant the trigger fires. So the line is
**feathered** instead — one gradient mask on the panel, live only while it has
not pinned. A gradient mask works where an image one does not: CSS masks read
the **alpha** channel by default, and `linear-gradient(transparent, #000)` has
one.

**A re-bake to drop the clip properly was tried and reverted.** The idea was
sound — composite a coverage map alongside, solve the colour backwards from the
ground composite so the settled frame stays exact (`C = (R − g(1−A))/A`,
measured at 1.38/255), and mask the group with the coverage. The map shipped as
a **greyscale WebP**, which has no alpha channel at all, so the mask resolved to
opaque and did nothing — and what rendered was the raw unpremultiplied colour: a
saturated orange field clipped at 1.0 with a hard edge where the clip stopped.
If that route is taken again the coverage has to live in an **alpha** channel or
the rule needs `mask-mode: luminance`, and it has to be looked at in a browser
before it goes near main. It was shipped on a numerical round-trip check alone,
which proved the maths and said nothing about whether the mask was applied.


Two rounds of trying to make the live subtree cheap did not get there. Measured:
the per-frame *main thread* cost — writing the transform, flushing style and
layout — is **0.03 ms** at 1× and at 6× alike, so it was never script. It was
raster, and the trouble is structural: **a CSS filter is rasterised at the device
resolution the element is currently drawn at**, so at 6× a 149px blur is a ~900px
blur over a ~6000×4400 surface, on every scroll frame. Baking the glow into a
mask fixed that one; the masks, the `screen` blends, the `plus-lighter` grid, a
15,000px-wide glow plate and 26 wipe strips were all still being composited at 6×
behind it. The image collapses all of it into three draws.

**There is not one filter left in the flight path.**

| | how |
|---|---|
| chromatic split | two pre-split bakes — one holding only R, one only G+B — pushed apart and added back with `plus-lighter`. The channels are disjoint, so at offset 0 they sum to *exactly* the original image, and at offset n it is a true aberration. No `feColorMatrix`, no `drop-shadow`. |
| defocus | a third pre-blurred bake at half resolution, cross-dissolved over the pair on `--wk-soft`. Its σ is baked in **design** px, so on screen it scales with the piece — ~18px at the 6.07× start, resolving as it approaches, which is what a defocus does. |
| everything else | one `<img>` draw each |

`plus-lighter` rather than `screen` for the recombine: with disjoint channels the
sum is exact rather than approximate, and it is the one blend the compositor can
do without reading a backdrop.

`tools/bake-work-still.py` regenerates all three. It mirrors one CSS rule per
layer, in the TV's own 1044×733.7762 design space, with the same blend algebra
over an opaque canvas:

```
normal        C = s·a + d·(1−a)
screen (o)    C = d + a·o · s · (1−d)
plus-lighter  C = d + a·o · s              (clamped)
```

**The swap is a hard cut, in one frame, and it has to be.** It was a fade twice,
and both were wrong:

- **Cross-dissolving both opacities dips.** At the halfway point the composite is
  0.75 of the picture plus 0.25 of the background — a visible darkening right as
  the piece settles.
- **Fading only the still out over a live piece already at full opacity fixes
  the dip and introduces a pulse.** The still is masked, so wherever its alpha is
  below 1 — the whole glow — the result is `a·A·C + (1−a·A)·LIVE`. Its colour was
  solved to composite against the **ground**, not against an already rendered
  copy of itself: `A·C + (1−A)·g = R`, so substituting `LIVE` for `g` adds
  `(1−A)(R−g)` — about **18/255** through the glow. The glow adds to itself for
  the length of the fade.

There is no fade that avoids both, because the still's alpha is a real coverage
map and the thing behind it is the same piece. So they are never drawn together:
one frame the still, the next the live piece. They agree to ~2/255 and the piece
is perfectly still at that moment, so the cut has nothing to show.

**And the cut is tied to the TRAVEL, not to the lens.** It was `a === 0`, which
was fine while the ramp was slow — at `EFX_POW 1.6` the lens reaches zero at
scale 1.124, so the still was being replaced while the piece was still visibly
moving. The condition is `(1 − e) < 2e-4`, a threshold rather than `e >= 1`
because `FLY` is solved by bisection and returns 0.9999998. Verified: the swap
lands at scale **1.0000**.

Diffed still-against-live at the settled pose, whole frame mean **2.0/255**. The
residue is high-frequency and survives a 3px blur at mean 1.95 — it is the LED
dot grid aliasing differently through Lanczos-at-1.5× than through Chrome's own
downscale, not a misalignment. The one real misalignment that pass found is fixed
in the *live* build: `.work__mark` was grid-centred, which sits 1.0 × 0.64 design
px off its Figma node — invisible alone, but a 1px shift of a hard black shape on
bright orange was the largest single error in the swap. It is pinned now.

#### The lens

A prism split and a defocus while the piece is still travelling, resolving to
nothing as it lands: **a 5.2 design-px defocus and a 20px chromatic offset** at
the start, scaled by `(1−e)^1.6`.

`EFX_POW` shapes the ramp-out and **higher is faster**. It went 0.7 → 0.55 to
hold the effect longer, then to **1.6** once the entrance grew to 301vh and
started earlier — at 0.55 the aberration was still readable most of the way down.
Against the real curve, as a fraction of the entrance's *scroll* rather than of
`e`:

```
x   0.05  0.10  0.20  0.40  0.60
a   0.84  0.69  0.46  0.17  0.05
```

Strong at the top, gone well before it settles.

#### The lens panel

Backtick opens it, same key as OFFERINGS; it sits **top-left** so the two do not
collide. `cnvrt.wklens.v1` in localStorage.

| control | what it is |
|---|---|
| chromatic split | screen px at full effect. Divided by the current scale before it reaches CSS, so it stays constant on screen whether the piece is 6.85× or 1× — aberration belongs to the glass, not to how big the subject is. |
| defocus mix | 0..1, how far the pre-blurred plate is cross-dissolved in. |
| falloff curve | a dragged cubic bezier, endpoints pinned at **(0,1)** start and **(1,0)** settled. |

**The defocus sigma is not on the panel, and that is deliberate.** It is baked
into `work-still-soft.webp` at 5.2 design px, so it scales with the piece. To
change it, edit `SOFT_SIGMA` in `tools/bake-work-still.py` and re-run. There is
no runtime blur to turn up because a real `filter()` on this subtree was the
single largest thing making the entrance stutter.

**The curve replaced `(1−e)^EFX_POW`.** A single power is only ever one family of
shapes, and the shape that got picked is not in that family.

Shipped defaults, tuned on the panel: **split 52px**, **defocus mix 1.00**,
handles **(0.756, 1.000) (0.703, 0.474)**. That is a **hold-then-drop** — handle
1 at `y = 1.000` keeps both effects at full through most of the flight and handle
2 pulls them off sharply near the end, so the lens reads as a property of the
piece being far away rather than as a fade:

```
e      0.00   0.25   0.50   0.75   0.90   1.00
amount 1.000  0.976  0.868  0.530  0.185  0.000
```

**Note `x2 < x1` — the handles cross.** That is legal here and worth not
"fixing": `dx/dt` stays positive across the whole curve (minimum 0.574 at
t≈0.8), so `x` is still monotonic and the LUT resample holds. If a future set of
handles ever makes it non-monotonic the resampler will read back garbage, so
check that before trusting a curve that folds.

For the record, the first defaults were **(0.250, 0.600) (0.650, 0.050)**, fitted
numerically to the old `^1.6` at rms 0.0012 — that is what "reset" restores if
the panel is ever re-pointed at it.

It is evaluated through a **257-entry LUT**, rebuilt only when a handle moves. A
bezier is parametric in `t` and this needs y-of-`x`; resampling once sidesteps
the inversion entirely rather than solving it per frame.
The defocus is **baked into `work-still-soft.webp`** as `SOFT_SIGMA` in
`tools/bake-work-still.py`, so changing it means re-running the bake — there is
no runtime blur to turn up.

**The split offset is authored in SCREEN pixels and divided by the current scale
before it reaches CSS**, so it stays 20px on screen whether the piece is 6× or
1×. That is what a real lens does — aberration belongs to the glass, not to how
big the subject is. The defocus is the opposite: baked in **design** px, so it
scales with the piece, with `--wk-soft` only cross-dissolving it in.

Two earlier versions of this are worth not repeating. It was `filter: blur()`
plus two `drop-shadow()` on `.work__tvimg`, `.work__screen` and `.work__grid` —
three filter chains on a subtree drawn at 6×, which is the raster trap all over
again. Then it was `feColorMatrix` on two copies of the still, which is cheap per
pixel but still allocates surfaces. Pre-splitting the bake removes both.

`drop-shadow` is also simply wrong on the still: that image is opaque, so its
alpha is a rectangle and the "fringe" would be a rectangle too.

The amount snaps to zero below 0.004 rather than testing `e >= 1`, because `FLY`
is solved by bisection and returns 0.9999998, never exactly 1 — without the snap
the effect would sit at a fraction of a pixel forever and `.is-settled` would
never fire, which is precisely the swap it exists to trigger.

#### The top bar goes quiet

Figma's work frames carry no chrome at all, and the one item that reads as "top
left" is the **menu button** — the only thing actually in the corner. The logo
sits at x=260 (it was moved off the corner to make room for the button), the
ticker at 822 and the nav cluster at 1456, so those three fade out and the button
stays.

Driven by `html.wk-solo`, set from the work module, because the chrome is a
sibling of every section rather than a child of any of them. The test is "is the
viewport's own centre inside the section", which is unambiguous at both ends and
needs no extra state. `pointer-events:none` goes with it — a faded-out CONTACT
button is still clickable.

#### The timeline

```
[ entrance 240 ][ logo 90 ][ 001 ][ 002 ][ 003 ][ 004 ][ 005 ][ turn out 480 ] = 1485vh
```

Segment lengths are a plain array of vh and the section height is their sum, so
retuning one phase is a one-number edit.

**The entrance runs only while the panel is PINNED**, and that is the whole
smoothness story. Earliness is bought by pinning earlier — `margin-top` on
`.work`, currently `calc(214 * var(--u) - 250vh)` — never by starting the
timeline before the pin.

**Three things were making it jitter, and the first is structural.**

**1. A drift-cancelling term, which cannot be made smooth.** Before the panel
pins it is sticky but not stuck, so it rides up with the document and takes the
piece with it. `setPose` was subtracting `wkTop − scrollY` to hold the piece
still. The `SY` note at the top of `index.html` says why that fails, in as many
words: the panel is moved by the **compositor**, instantly, and the transform is
written by **script**, a frame late, so the pair resolves at

```
visual = −y(N−1) − deltaScrollY(N)
```

— the raw per-frame scroll delta, the very thing the smoothing exists to remove,
added back in and changing every frame. The note records that being built twice
and bouncing both times. This was the third. There is no tuning that fixes it;
the animation has to run where the panel does not move at all.

**2. A `mix-blend-mode` on `.work`** — proposed so the arriving panel would
lighten over offerings' headline instead of covering it. Never shipped: a blend
makes the whole section a blended group, which takes it off the pure
composited-transform path and re-rasters the subtree every frame. The panel just
covers offerings as it arrives now, which is what a section handover looks like.
If the headline must survive it, the cheap way is an alpha channel on the flight,
not a blend on the section.

**3. Two CSS custom properties written on `.work` every frame** to drive the
lens. A custom property set on the section invalidates style for its entire
subtree — the copy row, six slides, 26 wipe strips — to move three images.
Measured, style + layout per frame:

| | ms/frame |
|---|---|
| three direct element writes | **0.052** |
| one custom property on the section | **0.63** |

Twelve times, before any raster. `setPose` writes `softEl.style.opacity` and the
two channel transforms straight onto the three elements that need them.

What is left per frame during the entrance is one `transform` on
`.work__pose` — which carries `will-change:transform` — plus three style writes
on three images, on a panel the compositor is holding still.

Measured across the pin at 1902×983, every 200px:

```
line1    +299  +262  +226  +189  +152  +115   +78   +31   -46  -165
panelTop 1001   801   601   401   201     1     0     0     0     0
scale    6.85  6.85  6.85  6.85  6.85  6.85  5.79  4.32  2.82  2.07
```

The pose does not move until `panelTop` reaches 0, and `.work.is-pre` keeps the
flight undrawn until then, so there is never a frame where two things are moving
the piece at once. The entrance begins with `line1` at **+115** — about 115px
before `CNVRTLABS` reaches the top of the screen.


`z-index:2` on `.work` is required with the pull-up, matching `.sec2`. The
overlap puts this section's box inside `.off`'s, and `.off` carries `z-index:1`
and an opaque background — without the lift the work panel would be painted over
for the whole overlap. It also lifts the section above `#env`, which the notes
below had wanted for a while.



**The orange logo screen is card 0, not a special case.** It is an ordinary
`.work__slide` whose `--shot` is the gradient and whose `--slide` is that
gradient's mean, so the "only after the first scroll does the actual work start"
handover runs through the same strip wipe as every other handover, and
`show()`'s colour plumbing needs no branch. The copy row is one class,
`.work.is-live`, set by `show(c > 0)` — there is no second timeline for the text.

The rule (`529:4860`) fades in on `.is-landed` at 72% of the entrance, because
only the *last* of the four frames carries it. It is also the one thing in this
section that has to escape the 1080 stage: a 1902×983 window has room for
1061·`--u` of it, so a plain `top:1009` puts the rule 8px below the fold on an
ordinary laptop and it would never once be seen. `clamp()` sits it 71 above the
viewport bottom, never below the Figma y and never within 30 of the copy row.

Under `prefers-reduced-motion` the entrance **segment is dropped**, not played
instantly — otherwise its 130vh becomes dead scroll.

#### The glow is pre-baked, and that is the whole performance story

Both glow plates were `filter: blur()`. **A CSS blur is rasterised at the device
resolution the element is currently drawn at**, so while the piece flies in at 6×
the far plate is a ~900px-radius Gaussian over a roughly 6000×4400 surface,
recomputed on every scroll frame. Nothing else in the section is within an order
of magnitude of it. Measured: the whole per-frame *main thread* cost — writing
the transform and flushing style and layout — is **0.03 ms** at 1× and 6× alike.
The lag was never main-thread. It was raster, and it was that one filter.

What the plate actually *is*, though, is a flat colour times a blurred rectangle:
`show()` overwrites `background` with the card's own mean colour, so the authored
gradient never survives to paint. A blurred rectangle is a fixed shape. So it is
baked once, offline, as an **alpha mask over a solid fill**:

- identical output *by construction* — colour C at alpha `blur(rect)` is exactly
  what blurring a solid C rect produces
- one texture read per pixel instead of a Gaussian, at every scale
- the colour still follows the artwork, because the fill is still `--glowc`

The mask box is the plate padded by 4σ on every side, which is where the blur's
spill went before. Note the far mask peaks at **alpha 233, not 255**: the plate
is only 519 tall against a 149 σ, so a real blur never reaches full opacity in
the middle either — that it comes out that way is a good check on the model.

Resolution was chosen by measuring the mask against a full-resolution blur:

| plate | σ | ÷4 | ÷2 | ÷1 | shipped |
|---|---|---|---|---|---|
| far | 148.8158 | max 2.1/255 | — | — | **÷4**, ×0.4 opacity → under one output level everywhere |
| near | 11.4474 | max 22.9/255 | max 1.1/255 | exact | **÷1** — ÷3 drifted the halo edge 10/255, a visible ring |

Verified end to end by A/B screenshot against the real blurs: outside the TV,
mean difference **0.34/255**, max 10 — and both frames are JPEG, so most of that
is compression noise.

**They are `data:` URIs, not files, and that is not optional** — on a `file://`
page a `mask-image` that fails CORS resolves to transparent black and the element
vanishes with no console error. Same reason as `.work__piece`.

`screen`, not `plus-lighter`: the bezel has bright metal highlights, and
`screen(.9,.5)=.95` where plus clips to 1 and blows them out. The grid can use
`plus-lighter` because LINEAR_DODGE *is* additive; these cannot.

The radii themselves were wrong first time round. Figma's `LAYER_BLUR` on
`529:4851/4852` is **297.6316** and **22.8947** → CSS **148.8158** and
**11.4474**. Deriving them by ratio from the first entrance frame gave 133.3 and
10.3, which is 10% short. Cross-check: they are the old 912-space build's 260/20
times the 1.14474 the whole piece grew by, so the two routes agree.

The piece-glow vectors were wrong too, and had been for a while: the old build
drew a 26×25 node in a 34×33 box, and with `center/contain` that does not pad the
mask, it **scales** it — so the glow shipped 31% oversized and 2px off centre. It
is now the node's own 29.7632×28.6184 at (835.0852, 558.6308) of the TV. A CSS
blur expands its own paint region; it never needed the room.

#### The strip wipe, card to card

Each card holds for `HOLD` (0.45) of its own segment and the rest of the scroll
drives the handover into the next.

**The scroll position *is* the timeline.** Nothing here runs on a clock. Scroll
half way through a handover and the front sits half way up; scroll back and it
retreats. That is also why there is no direction flag, no commit timer and no
`transitionend` bookkeeping — an earlier time-driven version needed all three.

The incoming shot arrives in horizontal strips that **open from zero height**;
they never simply appear. Strips are `<i>` children of `#wkWipe`, built once at
load, and only their `clip-path` is touched.

```js
var NW = 26, HOLD = 0.45, EXPO_K = 4, GROW = 0.18, OVER = 0.5;
var HMIN = 0.45, HMAX = 2.2;        // strip height, as a multiple of the mean
var SCREEN_H = 518.5657;            // design px — feeds background-position
```

`GROW` is how much of the gesture one strip takes to open, so `GROW / (1/NW)` is
how many are part-open at once. `EXPO_K` is the easing steepness.

**Five invariants, each of which was arrived at by breaking it first.** Any one
of them reintroduces a specific visible fault:

| Invariant | What breaks without it |
|---|---|
| Strips open **upward from their bottom edge** (`inset(x% 0 0 0)`) | opening from the centre leaves an unfilled sliver *under* every partial strip, cutting it loose from the solid front — reads as broken floating lines |
| Start order monotonic (threshold = how much of the screen sits below the strip) | strips leapfrog their neighbours |
| **Finish** order monotonic too (walk up, stretch any window closing too early) | grow windows are far wider than the gap between neighbouring thresholds, so a short strip finishes before the taller one below it — measured, 13 of 31 adjacent pairs inverted |
| The final fit scales thresholds **and** grow windows by the same factor | scaling thresholds alone squeezes the gaps while leaving windows full width, silently undoing the row above — 11 inversions |
| Top threshold leaves `GROW` of headroom (handled by the fit) | the highest strips are still part-open at commit and snap the rest of the way |

**Tall strips and a gap-free edge are directly opposed** — a tall part-open strip
*is* the gap, because the unfilled remainder of the strip below shows through and
that remainder scales with height. `OVER` breaks the coupling: each element is
extended below its own slot by `OVER` of its height, with `background-position`
still keyed to the slot so the extra area shows the picture continuing rather than
repeating. Since fills run bottom-up and lower strips are always further along,
that extension lands exactly in the gap and covers it. **Do not push `OVER` to
1** — at full coverage the filled regions merge into one mass and the tear
disappears along with the gaps.

`clip-path` rather than `scaleY` or an animated `height`: the element's geometry
never changes, so the picture is uncovered without being squashed and without any
`background-position` compensation.

**`boot()` is gone.** It was 26 shutter elements that assembled the screen in
scattered bands the first time the panel appeared. It read as a second,
near-identical copy of the card-to-card wipe, and it cost 26 nodes each carrying
two transitions on the one frame the section is busiest. The card-to-card wipe
is the one that stays.

Each slide carries two custom properties: `--shot` is the picture, `--slide` is
that picture's own mean colour. `show()` still reads `backgroundColor` to drive
the glow plates and `--piece`, so the bezel spill tracks the artwork.

**Still open:** the copy (`002`, headline, tags, date) commits in one step when
the wipe crosses half way, because `scramble` is 4000ms of `textContent` rewrites
and cannot be scrubbed. Tracking scroll would need a different text treatment.

#### The scroller

Figma **538:6046** *scroller* — which is the same node as `529:4860`, already in
the page as `.work__rule`. There was no asset to build; the work was making it
move, and fixing four things the original build had wrong.

##### It is a real auto-layout, and it is full width

The node is pinned left 12 / right 32 of the 1940 artboard, but its inside is an
auto-layout built to absorb whatever width it is handed, so it is authored here at
**100%** and the flex does the rest. That is why it is a flex row now and not
three absolutely-placed bars: only the middle line is a fixed **1394.853**, the two
short ones are `flex:1 0 0` and share what is left. At the old 1896 they came out
at 240 each — the numbers that used to be hard-coded; at full width they resolve
to **252**, which is the point.

Four things measured off the 1:1 render rather than taken from codegen:

| | was | is |
|---|---|---|
| y in the viewport | 1009 | **999** — the artboard carries the usual 10px inset and this node is a sibling of the inset frame, not a child |
| the tick | drawn 21.1 wide at `opacity:.8` | **20** wide at opacity 1 — 21.147 is its flex *box*, the artwork is 20, and `work-tick.svg` already carries `opacity="0.8"` on its path, so the rule was shipping it at 0.64 |
| the tick's advance | none | `margin-right:-14.853` — Figma's box is 21.147 with `mr:-16`, so the lines start at **5.147** |
| the stroke | 5.5..6.5 | **4.5..5.5** — the lines are zero-height boxes centred in the 11px band with the stroke on a `-1` inset, so its *bottom* edge sits on the centre line. `margin-bottom:1u` puts it there, because flex centres the margin box and not the element |

Its middle run is also **dashed**, and had been solid here until it was measured:
173 dashes off the 1:1 render, pitch **8.015** design px, dash **4.657**.

On every card handover it comes up from below the frame and drives three things
off its own y — the copy line by line, then the picture, then nothing as it leaves.
One position, three consumers, so they cannot drift apart.

```
     below the fold ── not on screen at all during the hold
   copy row  939..765 ── each line flips as it is crossed   (first ~30%)
 picture bottom 637.9 ── strip wipe starts
    picture top 119.4 ── strip wipe lands                   (next ~47%)
              -11 ───── out of the frame                   (last ~12%)
```

**One of them, and it never waits anywhere you can see it.** At `w = 0` it sits a
clear frame-height below the fold, so during a card's hold there is no scroller on
screen: the gap between two of them **is** the gap between two picture transforms.
It was built with two — a parked one lifting off and a fresh one rising to replace
it — and that was wrong on both counts: it waited at the bottom, and it put two on
screen at once through the whole handover.

Its position is a `transform` offset from the CSS rest point, so the `clamp()` in
the rule's own `top` stays the single definition of where it sits.

##### A line is not something the text has

It is something the browser invents when it runs out of width, and it invents a
different one for every card:

```
card 005                        card 001
GENERATIVE VIDEO TOOLING        PRODUCT LAUNCH FOR THE
AIMED AT PEOPLE WHO             LEADING AI NATIVE SOFTWARE
ACTUALLY SHIP.                  FOR ACCOUNTANTS.
```

Three lines each here, broken at completely different words; another card folds
into two or four. So "the line the scroller just crossed" has no partner on the
other side unless the breaks are worked out for **both** strings first and frozen.

`lineFold()` asks the browser where it *would* break a given string in a given box
— lay it in, read one rect per line off a `Range`, binary-search the character
offset where each rect starts. Nine elements, once per pair, never per frame. Both
folds are then rendered as one **block** per line, `max(oldN, newN)` of them; line
*k* scrambles from old[k] to new[k], and a line with no partner scrambles to or
from nothing.

Blocks and not inline spans, for two reasons: the browser must not be free to
re-fold the sentence while the randomiser is rewriting its letters sixty times a
second, and a line needs a box of its own for the scroller to have something to
cross. `<i>` rather than `<span>` so the existing `#wkTags span` query keeps
meaning what it meant.

Firing is symmetric — crossed on the way up scrambles to the new text, retreated
past on the way back down scrambles to the old, with 4 design px of slack at the
boundary. That is what `show()` used to do at the crossover, one line at a time.

##### The wipe is now the scroller's position

`paintWipe()` takes the **front** rather than the raw progress; the `expoInOut`
that used to be inside it has gone. That easing was right while the wipe owned its
own timeline, but the front is now the scroller's own position through the
picture's box, and easing it again would slide the strips off the thing they are
supposed to be travelling with. The per-strip thresholds are in front-space either
way, so the 26 uneven strips are untouched.

`show()` no longer writes the copy at all — it owns the room light, the live flag
and the buttons. It still seeds a card's text when one is arrived at with no
handover to cross it: first paint, a resize, a prev/next jump.

##### Two collisions worth recording, and a third thing that only showed on screen

**The transform.** The exit already writes `transform` on these rules to carry them
off with the copy row, and the scroller needs `transform` for its own travel. The
exit's travel moved to the standalone **`translate`** property, which the browser
applies *before* `transform`, so the two compose instead of the last writer
winning. Same reason the CONTACT button rides `translate`.

**The variable name, which was worse.** The scroller's element handle was called
`scrEl` — and so was the exit's picture-clip handle, a few hundred lines up in the
same IIFE. `var` in one function scope is **one binding**, so the later declaration
won and every clip the exit wrote to shut the picture went onto the scroller
instead. Nothing threw. The picture simply stopped closing, and the only symptom
was the screen staying open through a turn that used to narrow it. The scroller's
handle is `scrollEl` now. In a module this long, a generic name is a hazard.

**The copy twitching, which was a gate.** `show()` is called every frame of a
handover with whichever card the front has passed, so the frame the front crosses
the middle it lands there with `c+1` for the first time. An ungated `setLines()`
at that moment tore out the frozen line blocks, replaced them with flat text and
cleared `linePairKey` — so the next frame rebuilt every line at state 0 and
re-fired all twelve scrambles at once. It read as the whole block flicking back
and re-glitching mid-sweep. Seeding is gated now, and a rebuild is *silent*:
`linePair()` takes the scroller's current y and initialises each line's state from
where the front already is, writing the text straight in instead of scrambling to
it. A re-fold mid-sweep no longer restarts anything.

**And the one that was pure carelessness.** Rewriting the scroller's CSS as the
auto-layout, the regex that replaced the `.work__rule` block swallowed the
`.work__ln` rules sitting just above it. Without `display:block` those line
elements are `<i>` — **inline** — and they are appended with no whitespace between
them, so the browser ran them back into one string with the boundary space missing
at every fold (`ANALYTICSWITHOUT`) and re-wrapped the result. The rules live next
to `.work__meta` now, where a scroller rewrite cannot reach them, and the fold
keeps each line's trailing space so a word boundary cannot be lost even if that
declaration ever goes missing again.

#### What the reference actually does

Dissected from a screen capture frame by frame (`dissect.py`, space-time
diagrams, per-strip matching). Two conclusions worth not re-deriving:

- **The pieces do not move.** Searching ±36px vertically per strip, gated to
  strips with real structure and scored on whether a shift explains the pixels
  better than no shift: two of the three transitions had **zero** strips clear
  the bar. Horizontal was 0–2px. It is a mask, not moving pieces.
- Apparent "spacing changes" are **partial strips**, not a duty cycle. Run
  lengths came out `N1 N2 N3 N4` against a steady `O4` — incoming bands part-way
  to the full 4px quantum.

Caveat: the capture is 582×358 h.264 of a ~160px element, so the 4px quantum sits
at the resolution floor. Treat it as 2–4px.

#### The turn out to pricing

Figma **533:5596** *actual keyframes* (and **533:5408** *reference for you to
understand*, four poses of the same move). The whole section turns 180° and the
screen it was showing becomes the frame the next section is built through.

| | rotation | zoom | `new frame` |
|---|---|---|---|
| `pricing start` | 0° | 1.000 | absent |
| keyframe 2 | 90° | 1.398148 | a 2 × 725 px hairline |
| keyframe 3 | 180° | 1.398148 | 1733 × 977, upright |

Both later poses solve to **1.398148** to seven figures — 1510/1080 and
2712.4063/1940 agree — so the zoom is reached at 90° and then flat. Nothing in
the metadata is a rotation angle or a scale; every number above was solved out of
the axis-aligned bounding boxes, since a rotated Figma group reports a box that
is not its size.

##### The pivot is the SCREEN's centre, not the TV's

This is the one thing worth not re-deriving. `.work__pose` turns about its own
centre at **454.191**; the screen inside it sits at **378.638615** — 75.552
design px higher, 39.70% down the TV rather than 50%. The exit pivots on the
screen.

It is not a taste call, it is forced by the keyframe. At 90° the hairline lands
9px off the frame's centre line. Pivot on the TV instead and the 75.552 offset
rotates with everything else, throwing the screen `75.552 × 1.398 = 105px`
sideways — so the hairline the screen shuts into would not be where the white
frame is born, and the two would visibly fail to meet. The same number falls out
of the CSS on its own: `87.3029` (TV top in the frame) `+ 32.05266` (screen top
in the TV) `+ 259.283055` (half its height) `= 378.638615`.

The origin is written in design px, **not percentages**, because `.work__panel`
is `100vh` while `.work__frame` is `765 * --u`. The familiar `50% / 59.37136%`
only means anything inside the frame.

##### One wrapper, and why it could not be an existing element

`.work__exit` is new and had to be. `#wkPose` is taken — `setPose` rewrites its
transform string wholesale every frame, and it holds only the TV, while the copy
row and the rule are its siblings. `.work__frame` has the same problem.
`.work__panel` holds all three but is the sticky box, and it carries the
`overflow:hidden` that has to stay square to the viewport; turning it would turn
the clip and leave the viewport corners empty.

So the wrapper goes inside the panel, and the panel's clip stays a straight edge
while the contents turn behind it. Nothing between `.work__panel` and `#wkPose`
transformed before, so the new matrix composes cleanly with the entrance's.

##### One curve, one sweep, all of it scrolled

`cubic-bezier(0.79, 0.01, 0.25, 1)` runs **once** across the whole 180° and every
other channel is read off that single eased value. Nothing is a CSS transition,
nothing fires, there is no state to be in: scrub backwards and it retraces.

It was built as two beats first — the curve run once per 90° — and that was wrong
twice over. Two beats give two separate snaps with a dead hold between them, which
reads as two *triggered* animations rather than one scrubbed move. And the curve it
ran, `cubic-bezier(0.97, 0, 0.02, 0.99)`, is very nearly a step: **peak slope
39.7×**, 10% of its travel spread over the first 38% of its span and another 10%
over the last 38%. Almost all of the motion happened in a quarter of the scroll
however it was cut up.

The shipped curve is a real ease-in-out: **peak slope 4.3×**, the middle 80% of
the travel spread over 36% of the span, the tails 33% and 31%. It is scrubbable
the whole way rather than in one place.

The keyframes still land where Figma puts them, because the sub-channels split on
the eased value rather than on scroll:

```
a = EXIT_E(e)          the curve, once, 0..1
rotation = 180 * a     so 90° falls at a = 0.5
z = min(2a, 1)         the zoom and the shutting picture, done at 90°
g = max(2a - 1, 0)     the white frame and the copy row, from 90° on
```

90° lands at `x = 0.514` — 247vh into the 480vh segment, near enough the middle
that the segment needs no re-balancing.

##### The hairline, and the frame born in it

`.work__pic` — a new wrapper around the slides and the 26 wipe strips — and
`.work__grid` both take a horizontal `inset()` clip that shuts them to zero width
by 90°.

**It has to be `.work__pic` and not `.work__screen`.** The screen owns the black
background and the 2.2895 corner, so clipping *it* takes those away with the
picture and the closing screen uncovers `work-panel.png` underneath — a light
grey LED sheet, still lit by the glow plates. The screen reads as opening onto
the chassis instead of switching off. Clipping the picture alone closes it onto
the screen's own black, which is what Figma 533:5479 shows at 90°.

The grid needs its own copy of the clip: it is a **sibling** sharing the screen's
exact box, not a child, so left alone it stands there as a lit LED sheet over a
shut screen. The card wipe's own clip-paths live on 26 descendants of
`.work__pic` and nest under this one.

`.work__seed` is Figma's `new frame` — white, radius 20, and the mask the pricing
section will eventually be built through. It is born as **the screen's own box
collapsed about its vertical centre line**: 518.5661 tall, 1.43 wide (2.0 screen
px at 1.398×). That is why the hand-off has nothing to line up — it is the same
rectangle. It lights the instant the shutting screen is narrower than the
hairline, the same instant the room light goes, so no frame has neither of them
on it.

It rides the wrapper rather than counter-rotating, because **a rectangle at 180°
is the same rectangle**.

It grows on `clip-path` insets in **percent of its own box**, not `scaleX`. A
scaleX would squash the corner into an ellipse for the entire growth.

**The corner arrives late and it is measured, not read off codegen.** It is a
hard-edged sliver for most of the growth and only rounds as it reaches its edges
— rounding from birth turns a 2px hairline into a lozenge, and the whole point of
the hairline is that it is the screen's own straight edge.

Figma reports the node at radius 20, but a node's radius is in its *own* space and
this one lives inside the 1.398148 zoom, so taking it at face value renders a 28px
corner. Fitting a circle to the top-left arc of the 1:1 Figma render gives
**21.4px on screen** (rms 0.82px over 14 rows). So `rad` is authored **in screen
px** and divided by the zoom at the point of use, and 20 is never the right number
to type. It ships at **12.8**, a tightening from that 21.4 chosen off the panel.

A bounding-box check cannot catch any of this: 1732.7 × 977.3 is the same whether
the corner is 20px or 28px.

Its box is its 180° pose solved backwards: the Figma render puts it at 1733 × 977
with its top-left at (94, 32) of a 1920 × 1080 viewport, and undoing
translate → rotate(180) → scale(1.398148) about the pivot gives
`340.078, 43.210, 1239.228 × 698.760` in the wrapper's own space. Measured back
in a browser: **1732.7 × 977.3 at (94, 32)**.

##### The glass

Three effects, one radial map, all zero at the centre and strongest at the edges,
all driven by scroll:

| | |
|---|---|
| **FOV warp** | one `feDisplacementMap`. The map is generated on a canvas at init — R is the x shift, G the y, both radial and growing with `r²` — and stretched over the filter region, so the falloff is *elliptical*: full strength at the middle of every edge, which is what a viewport lens wants. A circular falloff on a 16:9 frame barely touches the left and right edges. |
| **Aberration** | the same map read **three times at three scales**, one per channel, recombined by addition. Three reads is what makes it radial — a flat `feOffset` gives a directional fringe and a lens does not have one. |
| **Edge blur** | one blur, composited back through a second generated map whose *alpha* is the radial ramp, so the centre keeps the sharp copy and only the rim takes the soft one. |

`color-interpolation-filters="sRGB"` is load-bearing; the default is linearRGB and
it silently shifts every colour in the section.

**A lens belongs to the viewport, not to the thing being filmed**, so it cannot
live on `.work__exit` — that element turns, and the warp would turn with it, the
"edges" sweeping round the screen. `.work__lens` sits between the panel and the
turn and never moves, so the filter's coordinate space *is* the viewport.

**It is 125% of the viewport, centred.** A barrel samples from further *out* than
it draws, so at `inset:0` the outermost ~60px has no source and comes back
transparent. That does not vanish into the identical `#141414` behind it the way
it looks like it should: the three channels are displaced by different amounts, so
the three rims land at three different radii and the join reads as a hard
rectangle with a red/cyan edge drawn round the whole viewport. 12.5% of slack a
side is ~240px at 1920, well past the 62px the map can ask for, and the panel's
`overflow:hidden` throws the surplus away after the filter has run. The child puts
itself back with `left:10%; width:80%` — 10% of 125% is 12.5%, 80% of 125% is
100% — so `.work__exit` lands on exactly the box it had before.

**Strength is `z × (1 - g)`**: a bump peaking at 90°, where the piece is at full
zoom and everything that is going to swing out has got there, and back to nothing
by the time the white frame lands, so the frame lands crisp. Both terms are
already the scrolled value, so there is no second timeline to drift against.

`LENS 0` turns the whole thing off and the filter is never attached. That is the
knob to reach for first if the turn drops frames: a filter on a viewport-sized
layer is a re-raster every frame and it is by far the most expensive thing in this
section. It is affordable at all only because the picture has shut by then — past
90° the entire piece is one bitmap, with the glow plates, the LED grid and both
blurred piece-vectors already out of the render tree. The filter is *attached and
detached* rather than left on at strength zero, because a zero-strength filter
still forces the subtree onto a filtered surface every frame.

##### The picture in the frame

`assets/img/work-seed.webp`, 2688×1520, generated from the reference at Figma
**542:6071** — a painterly airbrush landscape, lone windswept pine on granite,
still pool, magenta heather, low moon, pink-to-lilac dusk.

The source is a tall portrait crop, so reaching 16:9 means *extending* it, not
cropping it: the generation continues the terrain sideways with more of the same
granite, heather and low pines and carries the sky gradient across, with the pine
and the pool left where they are.

**It is ROTATED 180°, which is not optional.** The frame rides the turn and lands
at 180°, and "a rectangle at 180° is the same rectangle" — the reason the frame
itself needs no counter-rotation — stops being true the moment there is a picture
in it. The first build shipped it upside down. Half a turn on the image cancels
the parent's. The consequence is that the picture counter-turns while the frame
grows and is level only at the end; if that ever reads wrong the fix is a gimbal,
`rotate(-180 * a)` per frame, so it stays level in screen space while the frame
turns around it.

**No crossfade.** The frame opens *on* the image rather than resolving into it,
so at the hairline what you get is a two-pixel strip of the picture. The white
underneath stays only as a fallback: if the plate fails to load you get the frame
the transition was built around instead of a hole.

##### Two lessons from grading it, neither of which shipped

The first pass asked the generator to re-grade the reference toward the hero. It
came back with the right *hues* and the wrong *tone* — black point 12 instead of 0,
white 151 instead of 255, median 42 against the hero's 74. It had read "dark and
moody" literally and thrown away the range.

Rather than re-roll, the fix was a fitted **3-channel curve**: five band anchors,
source band → hero band, with the endpoints pinned to the source's own percentiles
so the blacks and highlights open back up. That landed every band within 2–10 of
the hero and cost nothing. Worth keeping in mind as a technique — a generator will
give you hue relationships far more reliably than it will give you a tone curve,
and the tone is the part you can solve exactly.

**Matching mean saturation is meaningless across different content.** Pushing the
image to the hero's 46% wrecked it — mids went violet, highlights hot pink. That
number is measured over a mostly-neutral video; a colourful landscape has nowhere
to put it. Per-band colour is the target that means something.

None of it is in the shipped plate: the brief changed to "just the reference, made
16:9", so the second generation keeps the reference's own palette and nothing is
applied on top. Both lessons are recorded because the next asset will hit them.

##### What leaves, and when

- **The room light goes with the screen.** Both glow plates and both
  `.work__piece` spans fade on the screen's remaining width and then go
  `visibility:hidden`. Physically it is right — less screen, less light — and it
  is also the only thing that stops the exit paying for two masked plates at
  2.85× the TV's area plus two blur surfaces, at 1.4×, on the live subtree. The
  entrance dodged all of that with a flat still; the exit cannot, because the
  still bakes `#141414` into its own edges and the settled logo card.
- **The copy row leaves by travelling, not by fading where it stands.** The
  translate goes on `.work__meta`, which is *inside* `.work__exit`, so it is a
  move in the turn's own space and the rotation carries it — the row slides out
  along whatever screen edge the turn happens to be pointing it at, instead of
  breaking out of the motion to go somewhere of its own. Opacity rides the same
  travel, powered (`txFadeP`) so it stays readable while it is still on screen and
  gives out near the end. `.work__rule` goes with it on the same vector.
  `txOut0`/`txOut1` are on the **whole eased sweep**, not on the growth: the
  growth is zero for the entire first 90°, so anything keyed to it could never
  send the row away before halfway — which is exactly when it wants to be going.
  It takes `visibility:hidden` on the way out, because `pointer-events:none` stops
  the mouse and not the tab order, and the row holds a real link and the two card
  buttons.
- **The row has its own glass**, on top of the viewport lens: a *directional*
  split and a defocus that travel with it. A lens has both — the radial fringe
  from the glass, and a directional one from the subject moving across it. It uses
  `feBlend mode="screen"` rather than the viewport lens's arithmetic composite:
  that one is only exact because `.work__lens` is opaque, and the copy row is text
  on nothing, so its alpha has to compose properly instead of being summed to 3
  and clamped.
- **The piece holds** until the white frame has grown over it. It has to go
  eventually: at 180° the TV still reaches ~110px past the top of the frame and
  would otherwise stand there upside down around a white card.

##### The panel

Backtick, same affordance as offerings and the entrance lens, but a full-height
side panel on the right — and it opens **only while the work section owns the
viewport** (`html.wk-solo`), because two other panels already answer to that key
and this one would sit on top of them.

Everything that is taste rather than geometry is on it, in four groups: the
viewport glass, the copy row's own glass, the copy row leaving, and the frame and
the piece. Persisted under `cnvrt.wkexit.v1`, with the shipped numbers as the
defaults — so the page is identical until something is dragged, and `reset` puts
it back.

What is deliberately **not** on it is anything the Figma keyframes decide: the
pivot, the zoom, and the seed's rect. Moving those stops the turn landing on the
design.

Two details that make it usable:

- Every write clears `lastExit` before repainting, so a drag is felt on the frame
  you are looking at rather than on the next scroll. `r0` is the exception — it is
  baked into the ramp map, so it re-bakes first.
- **The jump row.** The buttons land on the frames worth looking at — including
  90°, which is the one that matters and is otherwise fiddly to hit — and the
  readout above them gives `e`, degrees, zoom and growth live.

##### The seam is the screen's colour, not a brand orange

`show()` already publishes the live card's pre-measured mean to the glow plates
and `--piece`; the exit stashes the same value and the seam is that, lifted 35%
toward white, whitening over the first 40% of the growth. Card 005 is a
grey-blue, so a hardcoded orange there would read as a different light source.

`setExit` therefore runs **last** in `measure()`, after the card branch. Called
before it, it would read the previous card's colour on the frame a card changes,
and on the first frame after a reload that landed inside the exit it would read
the module's fallback instead of 005. Nothing depends on the order of the style
*writes* — they all resolve together at the end of the frame.

##### The unpin is free

`p` reaches 1 exactly when the section's bottom meets the viewport bottom, which
is exactly when `position:sticky` releases. Appending the segment is all it takes
for the turn to finish at the moment the panel lets go; pricing then follows
flush, with no handover logic between them.

`NC` is counted **before** `EXITV` is pushed onto `SEG`. It drives the card walk,
the wipe and the prev/next buttons, all of which read `SEG.length`; leave the
exit inside that count and the turn-out looks like a seventh card.

**The resize handler now remeasures twice, a frame apart.** Section 2 writes its
own height in resolved *pixels* on every resize, and `.sec2` sits above `.work`,
so that write moves this section — but its listener is registered later in the
document than work's, so the `wkTop` read inside work's own handler is against the
layout as it was before sec2 rewrote itself. The cache then stays wrong until a
reload. `.off` records the same hazard against the same cause at its own
`remeasure()`. It never showed on the entrance, because a wrong `wkTop` there only
shifts when the flight starts; on the turn-out it decides where the panel is when
sticky releases, so a stale read unpins the section **mid-turn** and pricing
arrives under a piece lying on its side. The second pass runs after every other
module's resize handler has written its heights.

##### Known

- The white frame's box is in design px scaled by **width**, but it is centred on
  `50vh`. Below about 1010px of viewport height it starts to overflow the top —
  cropped, not broken, and the same assumption the rest of the site makes.
- `cornerSmoothing` on `533:5504` is **unverified**. The pricing cards in this
  file are squircles at smoothing 1.0 and are drawn as generated paths for that
  reason; this node was read through codegen, which reports the radius and drops
  the smoothing, and the REST probe needs a token this machine does not have. The
  circle fit to the render came back at rms 0.82px, which is what a plain radius
  looks like, so it ships as one. Check it if the frame is ever used smaller.
- **NEXT RUN: an asset for the offerings section**, then a restart. Nothing in the
  work section is waiting on anything — it is finished and verified as far as a
  hidden automation tab can verify it.
- **Higgsfield credits are effectively out**: 0.26 left. The two work-seed
  generations were 0.75 each at `gpt_image_2` 2k/low. For scale, the Aug 4–5 image
  runs were **12 credits apiece** at a higher tier, and the Aug 4 video work was
  930 in one afternoon — so the cheap tier is genuinely cheap and worth reaching
  for first. 4k/low on `gpt_image_2` is 1 credit; `nano_banana_pro` at 4k is 4.
- **The lens is the frame-rate risk.** It is the only runtime filter in the
  section and it runs on a viewport-sized layer. `LENS = 0` removes it entirely.
  It has been scrubbed 120+ steps without a fault, but it has never been watched
  live at 60fps — and cranking it to warp 500 / blur 10 to prove it was working
  crashed the renderer, so there is a ceiling somewhere above the shipped values.
- The pricing cards are no longer parked. They live **inside** `.work__seed`
  and the frame's own growing `clip-path` is their mask — see *The pricing cards
  open inside it* below. The `display:none`, its `TEMP` pair in the wave-grid
  module, and the whole standalone `.price` section are gone.

##### The pricing cards open inside it

The frame is not a hand-off to a pricing section any more. It **is** the pricing
section: the cards are its children, so the clip-path that grows the frame is
also their mask, and there is no second mask to keep in step with the first.
`.price` — a 100vh box holding nothing once the cards left it — was deleted, and
the page is 100vh shorter for it.

**Two nested boxes, and both are forced.**

`.work__seed__cards` is `inset:0` of the frame and turns 180°. A rectangle at
180° about its own centre is the same rectangle, so it still covers the frame
exactly — what the turn buys is a *flipped coordinate system*, cancelling the
wrapper's own. A child at `(cx, cy)` from this box's top-left therefore lands at
`(cx, cy)` from the frame's top-left **on screen and the right way up**, and
nothing inside has to know the section is upside down. Same trick as
`.work__seed__img`, one level up so it serves both.

`.price__cards` then scales by `1/1.398148` about its own top-left, so everything
inside is authored in the same 1920-design px the cards were drawn in — 1096×405,
the 24px squircles, the run-2 wave zone — rather than in the frame's local space,
which is in the exit zoom's units.

**Where the offsets come from.** The frame lands at 1733×977 with its top-left at
(94, 32) of a 1920×1080 viewport; Figma 434:3933 puts the cards at (370, 126) at
1096×814. The inset is therefore (276, 94) *screen* px, and this box is measured
in the frame's *local* space, which is 1.398148× smaller:

| | screen | ÷ 1.398148 |
|---|---|---|
| left inset | 370 − 94 = 276 | **197.404** |
| top inset | 126 − 32 = 94 | **67.232** |
| card width | 1096 | 783.892 |

Checked from the other side: the right margin falls out as
`1239.228 − 197.404 − 783.892 = 257.932` local = 360.6 screen, and the render
gives `1827 − 1466 = 361`. Measured back in a browser at the end of the pin:
frame **1732.6 × 977 at (94.2, 31.7)**, cards **1096 × 405 at (370.1, 125.6)**
and **(370.1, 534.6)** — Figma's numbers to within 0.4px.

None of it depends on the viewport. The frame's own position does — the exit
slides its pivot onto 50vh — but the cards ride the frame, so the only space
these numbers have to be right in is the one that never moves.

##### One seam, not two centres

The pair opens from **the centre of the two of them together**. The top card
grows from its own bottom edge upward, the bottom card from its own top edge
downward, so what you watch is a single line splitting apart rather than two
cards each unrolling on the spot. The seam is 4 design px deep: the cards are 405
tall at y 0 and y 409 in their wrapper, so the pair's centre line at 407 falls in
the gap between them and each opens away from its own side of it.

It **crosses** the frame's own motion on purpose — the frame is born a vertical
hairline and opens sideways, the cards are born on a horizontal one and open
vertically. Two axes, one move.

Insets in percent of each card's own box, never a `scaleY`, for exactly the
reason the frame gives: these are `cornerSmoothing: 1.0` squircles drawn as
generated paths, and a `scaleY` flattens all four corners into ellipses for the
whole of the growth, arriving true only on the last frame.

The frame **leads**. The cards wait through the first `XP.cardIn` (0.18, on the
panel) of the growth and then both land together at `g = 1`:

```
ct = clamp((g - cardIn) / (1 - cardIn))
cg = ct²(3 - 2ct)                  smoothstepped, so no kink at cardIn
top card    inset((1-cg)·100% 0 0 0)
bottom card inset(0 0 (1-cg)·100% 0)
```

Both cards reach ~99% by `p = 0.94` of the pin and spend the last stretch
settling. That is not a fault in the mapping — it is `EXIT_E`'s documented
character (39% of each beat creeping through the last tenth), and the **frame
does the same thing**: it reaches its full box early too, and the tail of the
turn is pure rotation settling. The cards now match it.

##### The ripple wakes last

The wave grid's pointer trail is the section's only interaction, and it has no
business firing at a card that is still a sliver inside a rotating frame. The
gate is **`pointer-events`, not a flag inside the module**, so the events
genuinely never reach it — no trail arrives part-built and no listener work
happens on a surface nobody can see. `.work__seed` sets `pointer-events:none`
for the whole subtree; `.work__seed.is-hot .price__card` is the one thing that
takes it back, and `setExit` puts `.is-hot` on at `cg > 0.999`.

The tolerance is there because `cg` is a smoothstep of an eased value and reaches
a true 1 only at the exact end of the sweep; 0.999 is inside half a pixel of the
cards' final height.

##### When the wave grid renders

An IntersectionObserver is no use here. The cards sit in a sticky panel that owns
the viewport for the whole 1485vh of the work section, so an observer on anything
around them reports *in view* for all of it — nine draw calls per card plus a
four-level bloom chain, against a hidden element, for 1485vh of scroll. On the
Intel UHD 620 this is built for, that is not affordable.

The gate is the frame's own **inline** visibility instead. `setExit` writes it to
`visible` the instant the shutting screen is narrower than the hairline, which is
exactly when the cards are born. Reading `seed.style.visibility` is a plain
string lookup — no computed style, no forced layout — so it is free per frame,
unlike the `getComputedStyle` this used to do once at init. The first rendered
frame lands while the cards are still a hairline, so the `.is-live` fade-in
(450ms) is spent by the time there is anything to see.

##### `#pricing` still resolves

Three links name it — the hero side list, the top nav and the footer column. A
zero-size `.wk-anchor` inside `.work` carries the id, and `remeasure()` writes
its `top`. It cannot be a CSS constant: the timeline maps scroll to progress as
`p = (SY.y − wkTop) / (wkH − innerHeight)`, so the document offset that lands on
`e = 1` is `wkH − innerHeight`, which depends on the viewport height and not just
on the section's own vh. Measured: anchor at 28237, pin end at 28237.

### Pricing — iridescent wave grid

> **It has no section of its own.** The cards live inside the work section's
> turn-out frame; see *The pricing cards open inside it* above for the geometry,
> the seam, the ripple gate and where `#pricing` points now. What follows is the
> wave grid itself, which is unchanged.

Straight port of **RFL run-2** (`D:\ultron jits\rfl\run-2.html`, section
`SC.05b`), itself franky-adl/3d-wave-grid. Both shader bodies and every tuned
constant are verbatim; only run-2's second mode (light card / orange crest) was
dropped since both cnvrt cards are black.

The algorithm *is* the effect — don't "simplify" it:
- pointer trail uploaded as a `DataTexture`, sampled in the **vertex** shader
- per cube: gaussian window on an **expanding wavefront** × `cos(freq·relDist)`
- `fade = exp(-age/fadeTime)`, never a hard cutoff, so the tail can't pop
- `waveHeight /= max(totalWeight, 1.0)` — overlapping waves **average**, not
  stack. This is what makes it read cohesive instead of chaotic.

**Scale trick:** run-2 authors in a 1600px stage, cnvrt is 1920. Rather than
rescale a dozen eye-tuned constants, the zone is stated *in run-2 units* — the
1096×405 card is 913.33×337.5 of them — so `PITCH`, `SPEED`, `FREQ`, `WIDTH`
etc. stay untouched and the cells land on the same fraction of the viewport.

The canvas is **opaque** and paints the card surface (scene background = the
card's own gradient, read from `data-top`/`data-bot`). It has to be: the
additive bloom needs something to add onto, and `mix-blend-mode:screen` over a
near-black card turns the base tone into grey wash. Consequence: it covers the
card SVG's 1px inside stroke, which is re-laid on top as `card-*-edge.svg`.

### Footer — starfield + two-state HUD

Rebuilt against **527:4652 "footer new"**. Two coordinate systems now live in
this section, and the split is the whole point of the rebuild:

| | measured in | why |
|---|---|---|
| starfield + HUD reticle | **fractions of the viewport** | a bigger monitor should get a bigger instrument |
| all type, and the CTA | **`--ucap`**, i.e. `min(1px, 100vw/1920)` | a bigger monitor should not get 40px body text |

`--ucap` is declared at `:root` next to `--u` and refined in the same JS sync.
`.ftr` re-declares **`--u: var(--ucap)`** for its whole subtree, so every
existing `calc(N * var(--u))` inside the footer caps itself without being
rewritten. Below 1920 the two units are identical and nothing changes.

**The 1400 column.** 1400 is the design's own content width — the CNVRTLABS
wordmark is 1391.1 wide centred on 960, and FIND US ON sits on its left edge at
x=260. `.ftr__col` is that box, centred, and everything inside is positioned at
`(designX - 260)`.

**Vertical anchoring follows the same split.** The strapline is a *percentage*
of the section because it belongs to the reticle and has to track it at any
aspect. The link columns, the wordmark and the metadata are anchored to the
**bottom** in capped units. Percentage placement plus a capped height overflows
a short viewport — that is the trap in "Watch out" under Layout system, and it
had already caught this file twice.

Measured: at 1920×1080 every box equals its Figma coordinate exactly and the
CTA centre lands on (960.5, 540). At 3440×1440 the column stays 1400 wide, the
zone holds 32.5% / 31.2% / 34.9% / 36.4%, and the CTA centre is the viewport
centre.

**What the HUD plates did NOT need.** The new Figma group `hud piece 1`
(527:4665) has all 19 of its `<line>` elements at byte-identical coordinates to
the shipped `CNVRT_HUD_REST` plate — the only thing added to that group was the
wordmark and the BASED IN BLR text, which are DOM here. The plates in
`assets/js/hud-frames.js` are untouched. (The exported paths *look* different
only because Figma re-rounds them: `779.43` against `779.426`.)

**Content** — all of it PP NeueBit Bold 20/14.28, ls 1.2:

| | Figma | note |
|---|---|---|
| `DONT JUST SHIP, SURGE.` | 564:7312 @ (870,240) | ONE Figma text node; the first 16 characters carry a 60% fill override, which is the `<span>` |
| FIND US ON / LINKEDIN / X | 564:7309 @ (260,727) | heading at 50% |
| JUMP TO / PRICING / WORK / OFFERINGS | 564:7307 @ (1435,713) | 34 to the first row, then a flat 28 step |
| CNVRTLABS wordmark | 564:7310 @ (263.2,870.6) | `assets/svg/ftr-wordmark.svg`, carries its own #FFF1E9 fill and 0.7 group opacity — do not re-apply either |
| CNVRTLABS 2026 / BASED IN BLR | 535:5617 / 535:5618 | pinned to the VIEWPORT edges at 24, not to the column |

The old giant `DON'T JUST SHIP / SURGE` title, the three `.ftr__links` bracket
buttons and `.ftr__stage` are gone.

**Two gotchas the stretch introduced.**

1. **The plate pad had to split into `pdx` / `pdy`.** The transparent margin
   baked around each plate is a fixed number of *texels*; once the frame scales
   independently in x and y that is a different number of screen pixels per
   axis. One pad for both (correct while the scaling was uniform) skews the
   whole texture lookup on any window that isn't 16:9.
2. **The starfield's streak dimming divides `len` back out by `uScl`.** The
   exposure trade is about how far a streak is stretched *relative to the
   frame*, not how many pixels long it is. Left raw, the same warp reads dimmer
   on a big monitor purely because the pixels got bigger.

`uScl` is `max(W/1920, H/1080)` — **max, not min**: the field has to reach the
corners of whatever shape the window is, and the smaller ratio would leave an
ultrawide's left and right edges starless.

**The CTA is centred on the FRAME, not on its parent.** Figma puts the button
centre at (960.5, 540) while the zone's own centre is (959, 533.5), so
centring it in the zone sits it 6.5 high. `left:50.2239%; top:51.6539%` is that
frame centre re-expressed in the zone's box. The half-size correction is a
negative margin, never a transform — a transform on `.btn-contact` makes it a
stacking context and walls the screen-blended glow layers off from the backdrop.

---

**Starfield.** One instanced draw call, nothing uploaded per frame. Depth is
*derived*, not stored: `zc = uDepth - mod(aPos.z + uDist, uDepth)`, so one
scalar uniform advances every star and recycles it at the far plane for free.

Dot and streak are the **same primitive** — that is what makes the warp
seamless. Each star is one quad carrying a capsule SDF: head = star now, tail =
same star projected `uStreak` further away. At rest `uStreak` is 0, head and
tail coincide, the capsule collapses to a circle. No mode switch, no crossfade.

Two things that took a second pass: streaks need a **screen-space cap** (length
grows as 1/z², so the nearest stars otherwise draw 2000px bars), and they must
get **dimmer** as they stretch — boosting brightness with speed produces a
white-out.

Vanishing point is the **canvas centre**, which is the viewport centre, which is
where the CTA and the reticle now both sit — so `uCentre` stays (0,0). It used
to be parked on the stage centre, and that was the right answer only while the
reticle was drawn in 1920-design space and the two centres could sit tens of
pixels apart on a non-16:9 window. Now that the instrument is sized off this
same canvas there is nothing to correct for, and an offset would pull the
convergence *off* the button.

The field is also **screen-relative**, via `uScl` (see the split at the top of
this section). Without it the projection is a fixed number of *pixels* wide, so
a 4K panel does not get a bigger starfield — it gets the same one converging
into a tighter knot in the middle with dead space around it.

**Lens.** Both HUDs project through a concave barrel, by inverse mapping — for
each output pixel, which part of the flat frame lands here:

```
r' = r · edge / (1 + k1·r² + k2·r⁴)
```

- **Dividing** (not multiplying) makes it concave — bending *away* into the
  screen. Multiplying gives the convex, bulging-toward-you version.
- `edge` anchors the frame's **corner** radius. Concave pushes content outward,
  so anchoring the edge midpoints instead would fling the corners off screen.
- `uR2Max` clamps r² at the polynomial's turnover (`1 - k1u - 3k2u² = 0`).
  Past that peak the mapping folds and the corners mirror themselves.

Edge optics all ride one weight, `ew = pow(r/rCorner, uFall)`. `uFall` is the
**Threshold**: it's an *exponent*, so `pow(x,0) = 1` means threshold 0 applies
the effects flat everywhere. A smoothstep can't express that — `smoothstep(0,1,r)`
still leaves dead centre at zero, which is a gradient, not "evenly".

- **blur** = mip LOD bias (free — the texture is already mipmapped)
- **chromatic** = R/G/B at three radii. Source is white line art, so per-channel
  *coverage* is the whole signal; the fringe colours itself
- **split** = two ghosts at half weight each, so Split 0 is a true single image
- **glow** = one tap at a coarse mip, added back

**Two draw passes, not a two-texture shader.** The states differ in size,
position and aspect; blending in one shader means a second set of every uniform
and 12 fetches on a frame that mostly shows one HUD. A pass whose fade hits zero
is skipped, so rest and full-HUD are a single draw and only the transition pays
for both. The whole lens only redraws when something changes.

**Frozen lens values** (dialled on a tuning panel that has since been removed —
keys are still named after those controls):

```js
var st={a:60, b:0, th:13, bl:65, ca:56, sp:36, gw:95, op:65};
//      FOV  Corner Thresh Blur  Chrom Split Glow  Opacity
```

**States.**

1. **Rest** — strapline, the two link columns, the wordmark, the two metadata
   lines, and the small centre reticle (527:4665 — identical art to 455:4267).
2. **Zone hover** (527:4653, a 670×393 hit area — the red 10% rect in Figma is
   *not* artwork). The strapline lifts; the columns, the wordmark and the
   metadata sink, all blurring, staggered left to right with the mark last.
   The shared chrome (logo / nav / agent bar) clears with them. The full HUD
   (455:4528) **wipes on from the vanishing point** with a flaring front —
   `uReveal` sweeping outward, which reads as an instrument booting rather than
   an image appearing.
3. **CTA hover** — starfield to warp, lens over-driven.

**The CTA is nested *inside* the hit zone.** As a sibling it fires
`pointerleave` the moment the cursor crosses onto the button, collapsing the HUD
right as you go to click it.

The chrome lives in `.chrome`, a **sibling** of the footer, so no selector
reaches it from `.ftr.is-open`. The state is mirrored onto `<body>` as
`.hud-open`.

**Yaw.** The HUD leans toward the cursor. The larger half of this moves the
**optical axis** (`uCentre`), not the artwork: every edge effect is weighted by
distance from it, so the side you're looking at flattens and sharpens while the
far side bows and smears — what a curved panel turning to face you actually
does. A plain translate reads as a sticker on a spring. Small parallax on top
sells the tilt. Target is chased with a critically damped follow (τ=170ms) so it
leads and settles like a gimbal instead of twitching.

Current magnitudes in `draw()` — bumped twice on request (0.035 → 0.042 →
0.0491):

```js
cx += yx*fw*0.0491;  cy += yy*fw*0.0491;   // optical axis
fx += yx*fw*0.0112;  fy += yy*fw*0.0112;   // parallax
```

---

### The hero's resting chrome

The mark and the `DECK`/`CONTACT` pair are in the design at the top of the hero
and in **no section after it**. They were `position:fixed` and shared by the
whole page, which put them over the footer — where the design has nothing at all
— and the only thing that ever took them away there was the HUD opening.

They now leave on the first real scroll and come back only at the top.
`html.past-top` is written by a small module under `SY`, and the CSS reuses
`body.hud-open`'s exit *exactly* — rise 26·`--u`, `blur(3·--u)`, fade, on
hud-open's shorter durations — so the two states cannot drift into two different
gestures and a scroll that happens to open the HUD does not fight itself.

**Raw `scrollY`, not `SY.y`.** This is not authored motion tracking a scrubbed
timeline; it is the answer to *has the reader moved at all*, and the eased value
answers that late by design. The subscriber is only how it gets a frame to ask
on — `SY` calls it every frame while easing and once immediately, which also
covers a reload that restores a scrolled position.

**Hysteresis, not a single threshold:** out above 24px, back only under 4. One
threshold sitting on the boundary flickers the 260ms fade on every trackpad
twitch.

Two things are deliberately *not* in it:

- **The menu triangle.** It is the side nav's only trigger, so hiding it strands
  that navigation — the same reason the work section's own `wk-solo` strips back
  *to* the menu button rather than past it.
- **The ticker.** It keeps whatever it did before; only the logo and the button
  pair are affected.

Measured at 1920×1080: at the top `past-top` absent and logo/nav/menu all at
opacity 1; at 900px scrolled and again in the footer, logo 0 / nav 0 / **menu
1**; back at the top, all 1 again.

### Top nav — one plate, two states (Figma 564:6865)

Figma draws the collapsed badge (`564:7286`) and the expanded bar (`559:6187`)
as two frames that **share no child node at all** — a full swap. They are built
here as one morphing plate instead, because cross-fading a 61px badge into a
767px bar reads as two objects and the brief is one object opening.

|  | collapsed | expanded |
|---|---|---|
| box | 48x34 at (936,20), painted surface 61x34 at (929.5,20) | 767x52 at (577,42) |
| shape | parallelogram, 48 top edge, **13 skew**, r3 + cornerSmoothing 1.0 | rectangle, **no radius at all** |
| fill | `#FFF1E9` @ .07 | same, plus `linear-gradient(90deg, rgba(255,90,39,0) 56.598%, …3) 100%)` |
| extras | white glyph, orange trace, glowing head | logo, 3 links, 2 icons, DECK, CONTACT, 2 HUD brackets, 4 tick groups |

The morph lerps **four corners x seven control points**. Both plates are
4-vertex polygons, so the skew unwinds as the plate widens and the rounding
sharpens to the bar's square corners in one continuous move. Measured at the
ends: `x577 y42 767x52`, exactly Figma.

**The corners are not arcs.** `cornerSmoothing: 1.0` makes Figma emit two cubics
per corner with a long tangent arm and a tight shoulder. A circular arc through
the same tangent points sits ~2.3px further out — plainly visible at r6 — so the
real control points are carried verbatim. The general rule, calibrated against
three separate nodes in this file, is

```
tangent arm = (1 + cornerSmoothing) * cornerRadius * tan(turn/2)
```

which is how the badge's measured 8.72px arm falls out of a stated radius of 3.

**Reveal.** The bar is introduced as the shimmer finishes covering the hero, and
`.hnav` (the fake `>WORK >OFFERINGS >PRICING` list, which had no JS of its own
and simply rode the hero panel) is handed off at the same time. Measured:

| coverage | `.hnav` | `.tnav` |
|---|---|---|
| 0.40 | 1.000 | 0 |
| 0.55 | 0.615 | 0 |
| 0.70 | 0.017 | 0 |
| 0.88 | 0 | 0.148 |
| 1.00 | 0 | 1.000 |

The coverage number is **recomputed** from `SY.y` and `.sec2`'s docTop rather
than read out of the shader. Two reasons: the shader module returns early on a
machine with no WebGL, which would leave the nav permanently hidden; and
`P.smoothScroll` is forced to 1, so `smoothY === SY.y` exactly and an
independent computation is bit-identical on every frame.

**Hover is a CHOREOGRAPHY, not a transition.** A spring was tried first and
thrown out: a spring has no schedule, so "the logo lands, *then* the wordmark
leaves it" is not expressible on one, and everything moving at once is what made
the first version read as broken. What runs instead is a linear clock `p`, with
every phase cut out of it and shaped by `cubic-bezier(.35,.01,.01,.99)` — the
curve off the Figma interaction panel, a hard S that barely moves for the first
beat, crosses most of the distance in the middle third, then eases out long.

| p | what moves |
|---|---|
| 0.00 → 1.00 | the plate expands |
| 0.04 → 0.50 | the logo **travels** from the badge's centre to the bar's left |
| 0.28 → 0.80 | the HUD brackets and tick groups **grow out of their own centre line**, `scaleY` from 0, staggered per corner |
| 0.44 → 0.74 | the wordmark **unfurls from behind the logo** — only once the logo has parked |
| 0.50 + 0.04·i | links, icons, DECK, CONTACT land left to right |

Measured, 60ms apart: plate 58 → 79 → 327 → 487 → 640 → 727 → 767 while the logo
walks 951 → 835 → 688 → 620 → 609, the HUD starts growing at ~360ms, and the
wordmark only starts once the logo is at 609. Every phase **must** end by p=1 —
the clock stops there, and a schedule that overruns freezes those items
part-drawn, which is exactly what the first attempt did to the last three.

There is **one logo**, not two. Figma draws a white glyph at the badge's centre
and a cream one at the bar's left as unrelated nodes; the mark never disappearing
is the brief, so it is a single element that travels and tweens its colour.

Reversing is just flipping the direction `p` travels, so leaving mid-open retreats
from exactly where it got to (measured: 147px wide at bail-out, back to 58).
Closing runs at 430ms against 660ms opening — on the way out nobody is reading it
and a slow close reads as lag. Material ships the same asymmetry (enter 500 /
return 400).

**The hit box is not the live plate.** It is the badge while shut and the *whole
expanded bar* from the instant the nav is asked to open. Tracking the animating
plate is what made it feel broken: the box shrank out from under a stationary
cursor, fired `pointerleave`, and collapsed while the pointer was plainly still
on it.

Once open, the four tick groups **glide horizontally** on four different periods
(9 / 10.2 / 11.5 / 12.8s) so the corners never march in step. Transform only.

The **menu button** turns to its next symmetry point on hover: the three-triangle
mark has 3-fold rotational symmetry, so `rotate(120deg)` lands the arrangement
back on itself while every triangle visibly travels, and `scale(1.14)` is the
triangles spacing apart from their shared centre. All three lit layers get it so
the glows travel with the mark.

**The comet** is the page's scroll progress, running clockwise from 12 o'clock on
the plate's own outline — so it follows the plate through the morph for free.
Twelve co-located strokes of the same path each draw one short dash behind the
head, stepping down in width and opacity; that is what lets the tail taper
*around corners*, which a stroke gradient cannot do (SVG gradients live in user
space and do not follow a path). Caps are **butt**: with round caps each segment
overlaps its neighbour by half a stroke width and twelve double-drawn joins read
as banding.

**The wick** flickers while the page moves and settles when it stops. `heat` is
scroll speed with a ~0.55s decay; it drives flicker amplitude, the head's size,
how far the flame leans back along the direction of travel, and the trail length.
Measured head-radius spread: **6.6 while scrolling, 0.64 at rest** — a 10x
difference. At rest the module drops to an ~11Hz timer rather than holding a
60Hz rAF open for a 0.6Hz breathe; measured idle demand is **11.3Hz**.

### Side nav — Figma 564:6720

Opened by the top-left triangle (`#menuBtn`), which until now had **no handler at
all**; the id was a hook waiting to be used.

Figma puts the panel at 584x1215 inside the 1920x1239 hero frame, but only 1080
of those design px are the viewport — the frame carries the vignette region below
the fold — so a literal 1215 runs off a real screen. The frame is SPACE_BETWEEN
auto-layout, so the faithful translation is a flex column pinned 12 design px
inside the viewport on every side with the work list taking the slack.

**Both shapes here are generated, not exported**, because both change size:

- the panel — three r10 corners, a chamfered bottom-right, two r16 vertices,
  all smoothing 1.0 — because its height is the viewport's;
- the work row's union — r4, chamfered top-right — because **every row is a
  different size**. The plate is the label's own box plus Figma's 14/10 padding,
  so a stretched SVG would distort every corner.

Each carries Figma's control points as offsets from its ideal vertex and stretches
only the straight runs. Verified against the exported geometry: **0.0005px** max
deviation on the union at 202x68, **0.0001px** on the panel at 584x1215. Built
live, against real font metrics, the six rows land within **0.9px** of Figma:

| row | built | Figma |
|---|---|---|
| NURIX | 201.1 x 68 | 202 x 68 |
| ABACOR | 282.5 x 84 | 283 x 84 |
| BLAND AI | 305.5 x 71.2 | 306 x 71 |
| VARTHA | 268.4 x 71.2 | 269 x 71 |
| KODEUS | 251.5 x 71.2 | 252 x 71 |
| THESYS | 258.2 x 84 | 259 x 84 |

Two things that had to be corrected to get there. CSS puts a letter-space *after*
the last glyph and Figma does not, which both widened every row by one tracking
step and left the plate's right padding 1.92px fatter than its left
(`margin-right:-.03em`). And `offsetWidth` is integer and rounds **up**, which
put every plate exactly 1px wide — the fractional `getBoundingClientRect` is the
real box.

Row heights are the **ink**, not the line box. Figma reports per-item
lineHeightPx of 48 / 71 / 84, but the rendered ink is 44.801 tall in every single
one — the frames were pulled down onto the glyphs. Reproducing the line-height
figures gave six rows of inconsistent padding; one `--lh` of 44.8 makes every
plate 64.8 tall and hugs the type, which is how it is drawn.

**Deliberate substitutions**, both recorded rather than silent:

- The list bottom is a **real progressive blur**, not the mask fade that shipped
  first. Three stacked `backdrop-filter` bands at 3 / 6 / 12px. The radii double
  because a backdrop-filter's backdrop includes everything painted before it, so
  stacked siblings **compound in quadrature** — the effective radius is
  `sqrt(3^2+6^2+12^2) = 13.75px`, which is Figma's 14. Every band is full height
  of the ramp and their masks overlap by half a stride (0->44%, 22->78%,
  56->100%); butted ramps leave a first-derivative break that reads as a Mach
  band straight across the list. Only shown when the list can actually overflow.
- The row plate's `BACKGROUND_BLUR 34` is dropped: behind it is the panel's own
  smooth gradient, so a 34px blur of it is visually a no-op, and it would be the
  most expensive thing on a hover state on the UHD 620 this is tuned for.

The rail marker (`564:6616`) is **not** a pill — it is a right-pointing tag,
27x14, r3 smoothing 1.0 — and it rides to the vertical centre of whichever row is
hot. Hot state is a JS class rather than `:hover` alone so the marker and the
plate are driven from one source and cannot disagree on focus, on touch, or when
the list scrolls under a stationary cursor.

The hover is **entirely additive**: measured against Figma's own default state,
the label does not move, resize, recolour or change opacity. Only the plate, its
two SCREEN glows and the index label appear.

**The two glows are hoisted out of the row.** Inside the list they were clipped
by the very `overflow-y:auto` that has to stay — it is what keeps the list off
the meta blocks below — so a hovered row lost its bloom against all four edges.
One shared pair now lives on the list's wrapper and tracks whichever row is hot,
which both unclips it and costs two blurs for the whole list instead of two per
row. It re-parks on scroll, because the row moves under a stationary cursor.

Rows arrive one after another on open and **leave in reverse** on close, so the
list rolls up from the bottom rather than blinking off. Translate and opacity
only: `layout()` measures each row to build its plate and
`getBoundingClientRect` reports the *transformed* box, so a scale in the
entrance would silently resize every union.

### `.menu` had to be lifted out from under the sections

`.chrome` carries no z-index by design, so all of its children paint in step 6 of
the painting order — **below** `.off` (z1), `.sec2` (z2) and `.work` (z2), each of
which fills the viewport with opaque `#141414`. The triangle was therefore
invisible and unclickable over most of the page, and it is the side nav's only
trigger. `.menu, .menu__bars { z-index: 7 }` fixes it; the nav takes 6 and the
side nav 8, all far below the 99999 the dev panels use.

This does not break the blends. The recorded trap is an *ancestor* forming a
stacking context, which is why the button is empty and the lit layers are its
siblings; an element carrying its own z-index still composites against its
parent stacking context's backdrop.

### FAQ — Figma 564:7294

Sits between PRICING and the FOOTER. 1920x1080 on `#141414`, one 930-wide column
centred on 960. `567:7469` is 930x776 with 152 above and below, which is what
centres it in the frame.

| part | Figma | notes |
|---|---|---|
| head `ASKED BEFORE-` | 439x51 at (746,152) | OffBit Trial **DotBold** 64/51.2, ls −0.64, cream @ .8, node at 50% |
| rows | 930x73, pitch 73, from y 267 | seven of them |
| question | 24/19.2, ls 0.96, cream @ .6 | PP NeueBit Bold |
| answer | 32/35.2, ls 1.28, full cream | PP NeueBit Bold |
| chevron | 24x24 at row-right − 24 | pixel-art, 5 blocks |
| ask card | 316x39 at (802,889) | 28 below the rows |

**The divider is the row's own bottom stroke** — `individualStrokeWeights
{top:0,right:0,bottom:1,left:0}`, INSIDE, `#FFF1E9` at 12% — and Figma sets
`strokesIncludedInLayout: true` on it, which is exactly why a row measures 73 and
not 72. `box-sizing: border-box` keeps that true here. The last row (`567:7378`)
is 72 with `strokes: []` and gets no divider.

Row 6 (`567:7459`) is drawn OPEN in the file, at 930x157. That is the accordion's
expanded state, not a different kind of row, so it is built as the one state any
row can take. Opening uses `grid-template-rows: 0fr -> 1fr`, which is the only way
to animate to an AUTO height without measuring it in JS. Two things are
load-bearing there: the inner element needs `min-height: 0` or the track refuses
to shrink below its content and nothing moves, and the closed value must be
written `0fr` — a bare `0` will not interpolate. One row open at a time, or the
ask card gets pushed off the fold.

#### The ask card — 567:7390

A 326x43 union (`567:7391`) carrying **two stacked fills**: white 4%→9%, and an
orange→cream ramp at 30% over it. Two squircle tabs (`567:7435/7436`, r2 with
cornerSmoothing 1.0, white at 4%) sit off its left edge at −33 and −53.

The button inside is **not** the hero's CONTACT, and getting that wrong is easy:

| | the hero's | this one |
|---|---|---|
| union | 111x32 | **111x23** |
| label | CONTACT | **REACH OUT** |
| colours | cream `#FFF1E9` | **white** `#FFFFFF` |
| chip | cream @ 20% | white @ **30%** |

Three stacked unions as everywhere else — SCREEN at `LAYER_BLUR 30`, SCREEN at
`LAYER_BLUR 10`, then the face with `BACKGROUND_BLUR 34` — halved to 15 and 5 for
CSS, which is the file's standing rule for every Figma blur.

#### The reveal

Every text bit in the section is split per character: the head, all seven
questions, `Still have questions?` and `REACH OUT`. 178 spans. Answers are
deliberately NOT split — they are long, they only exist while a row is open, and
100+ extra spans inside a grid track that is itself being animated is the one
place this would actually cost something.

**The trigger is each character's own POSITION, not its index**, and that
correction matters. A single index sweep across the whole section worked while
the split was only the heading; the moment it covered 178 characters the heading
became the first 7% of that sweep and snapped through in a few pixels of scroll.
It read as though the effect had been taken off it. Now a line crosses the
section as it scrolls and each character lights as the line reaches it, with a
small per-character lead along its own row for the left-to-right feel. Every
element reveals at the same readable speed however many there are, and each goes
as it comes up. Measured: the head starts at 0.59 viewports, has 9 of 12 in
flight at 0.51, and is complete by 0.43 — before question one begins.

Each character starts enlarged (`scale 1.6`), blurred (9 design px) and displaced
in one of three directions — up-left, up-right, down-right — chosen per character
and **hashed off the index rather than `Math.random`**, so scrubbing back and
forth does not re-scatter a line the reader is already looking at.

**The ask card's SHAPES ride the same reveal**: the union plate, both tabs, all
three button unions and the index chip go into the same list and take the same
maths, so the card assembles as one event instead of type landing on furniture
that was already there. They carry a 2.6x throw multiplier, because a glyph-sized
26px scatter is invisible on a 316-wide plate.

Two implementation notes worth keeping:

- The reveal writes the **individual** `translate` and `scale` properties, not
  `transform`. Individual transform properties compose ahead of `transform`,
  which leaves `transform` free for the tabs' own hover slide. Both writing to
  `transform` made them fight.
- The blur is **quantised to 6 steps**, exactly as section 2 quantises it. A
  filter change re-rasters the glyph, so letting it vary continuously would
  re-raster every character every frame; scale and opacity carry the motion and
  those are compositor-only.

### Vertical menu — Figma 570:8331

Sticky top-right for the whole page, mirroring the top-left menu button:
both sit 20 design px inside their corner, both are a small orange mark that
opens on hover. It switches between the group's verticals.

| state | box |
|---|---|
| collapsed `569:7926` | **32x32** at (1868,20) |
| expanded `569:8084` | **121x197** at (1779,20) |

Both right edges are at 1900 = 1920 - 20, so it opens leftward and downward off
a fixed corner.

**The three bars are the same three bars.** Collapsed they are a 13/20/13 stack
of 3px round-capped hairlines; expanded they are the row markers at the right of
each vertical. Figma draws them as unrelated nodes in unrelated frames — built as
one set that travels, the mark unpacks into the menu instead of swapping for it,
which is the rule the top nav's logo already follows. They also slide 6px right
on the way out, because Figma insets the collapsed mark inside its own 32 box.

Rows are STANDARDCRAFT (with a `COMING SOON` chip, `#FF5A27` at 8%, r2), MAIN,
and REQ FOR LAUNCH. Both wordmarks are triple-stacked exactly as Figma has them —
crisp, then a blurred SCREEN copy, then a wider one — with the Figma radii halved
for CSS as everywhere else. RFL's stack is `LINEAR_DODGE`, i.e. `plus-lighter`,
and carries a `#FF5A27` 0.4 -> 1.0 gradient.

**The pointer and the bar say different things.** `570:8163` (7x9, r1 smoothing
1.0, `#FF7134`, two 0-offset shadows) parks on the vertical this site *is* and
travels to whichever row is under the cursor. The bars distinguish the two
states: the current vertical keeps a solid 20-wide marker, and the hovered one
goes to **dots** — Figma gives it `strokeDashes [2,5]` at weight 3 with a ROUND
cap, and a round cap adds half a stroke width at each end, so a "2" dash paints
5 long and the "5" gap closes to 2. That is a **7px period**, which is the three
dabs Figma renders across 20px; a literal 2/5 read gives eight of them.

Row hit boxes are made **contiguous** (66 / 62 / 56 against Figma's tops of
0 / 72 / 136, content offset back inside) so there is no dead gap between
verticals — every child is absolutely placed, so the rows had no height at all
and nothing to hover.

### The footer takes the bar with it

Once the viewport's own centre reaches `.ftr`, the whole nav LEAVES upward
rather than fading where it stands — the page has run out, and a bar hanging
over the end card reads as leftover chrome. The travel runs through the nav's
own curve, so it holds, then goes almost all at once, then settles off-screen.
Measured, by viewport centre relative to the footer's top:

| centre vs footer | opacity | lift |
|---|---|---|
| −0.4 vh | 1.000 | 0 |
| −0.1 vh | 1.000 | 0 |
| +0.10 vh | 0.636 | −48px |
| +0.25 vh | 0.089 | −120px |
| +0.45 vh | 0.000 | −132px |

The hover test is gated on it too: the active areas are fixed design coords, so
once the bar has been carried off the top they no longer describe where it is,
and without the gate it would pop back in under a passing cursor.

### Hover is geometric on both navs, and why

`.tnav__hit` and `.vnav__hit` carry the cursor and nothing else. The open/close
decision is a rect test against the state's own box, because enter/leave on the
hit element **cannot** work here: the links, icons and both buttons are its
SIBLINGS, not its children, so the moment the pointer crossed onto CONTACT the
box fired `pointerleave` and the bar shut under the cursor. That was the
"collapses before I can reach the buttons on the right" bug.

The areas are Figma's own (`570:8333`), verbatim:

| state | active area |
|---|---|
| top nav collapsed | 70x44 at (925,14) |
| top nav expanded | 723x52 at (599,30) |

A geometric test only runs on `pointermove`, and moving off the window delivers
no final move inside it — so both navs also close on `document`'s `pointerleave`
and on `blur`, or they would sit open after the cursor left the page.

### Three fixes worth recording

- **The comet is gone in the expanded state.** Figma's bar carries no trace at
  all, and a progress line crawling around an open menu reads as a loading
  state, so it fades out by the time the plate is a third open.
- **The wordmark was being beheaded.** `lineHeightPx 12` on a 15px face is
  smaller than the face's own content area, so the glyphs legally overflow their
  line box by ~3px each way — and the element clips, because the clip is the
  reveal. The box is opened up and the run pushed back down by the same amount.
- **The menu mark turns about its centroid, not its box centre.** The three
  triangles sit at (8.81,3.26), (2.90,13.26) and (14.76,13.26); their common
  centre is (8.81,9.93), 2.4px *below* the middle of the 17.52x15.02 box.
  Turning about the box centre leaves the arrangement off its own axis and the
  mark visibly wobbles — the "anchored to the corner" look. About the real
  centroid the three swap places exactly: measured, 119.6 and 121.4 degrees
  apart at radii 6.67-6.82.

### Four corrections worth keeping

**The side nav had no exit at all, and it was not the transitions.**
`.snav` carried `visibility:hidden`, and visibility is not an animatable
value — it flips on the frame the class changes. Every exit transition
underneath it was playing correctly to an already-invisible element. Holding
`transition:visibility 0s linear .62s` on the closed state is the fix, and it is
the same trick `.agent` uses a few hundred lines up. Verified: the panel now
travels 12 → −512 → −559 → −604 while `visibility` stays `visible` throughout.

**Every Figma blur is halved on the way into CSS**, and the nav's buttons were
not. The hero's own CONTACT does Figma 30 → `blur(15)` and 10 → `blur(5)` for
the identical node; the nav copy was passing the raw 30 and 10, so its glow was
twice the size it should be. Same correction on the side nav's row bloom.

**The row glow goes UNDER the type.** Figma's paint order puts the two SCREEN
copies above the label, but a screen blend of blurred orange over cream glyphs
lightens them toward white — it clouded the word. Below the list the bloom still
spills outside the row (the whole point of hoisting it out of the scroll clip)
and the label stays crisp.

**`--nav-ease` is scoped to the top nav.** `cubic-bezier(0,.99,.01,.99)` is
near-vertical off the origin: ~99% of the travel happens in the first few
percent of the duration, then it settles. That is right for the bar's morph and
wrong for anything that slides a large surface — on the side panel it turned a
440ms slide into a jump. Everything else uses `--expo`.

**MAIN is inert in the vertical menu.** It is the vertical this site already
*is*, so the pointer is parked on it permanently; there is nowhere for it to
travel and lighting it on hover would claim it is a destination. Pointing at it
clears the hot row and returns the menu to rest.

## Assets

`assets/img/work/01–05.jpg` are the five work screens, **derived** from
`hero-options/` stills (03, 17, 28, 31, 32 — picked for maximum value separation,
which is what makes a strip wipe legible). 1732×906, i.e. 2× the screen's
866×453. ~800KB for all five.

Do **not** point the slides at `hero-options/` directly: that folder is
gitignored and each PNG is 5–6MB, so the deploy would 404. Regenerate by
cropping to 1.912 aspect, resizing to 1732×906 and saving JPEG q82. The
`--slide` colour on each slide is that image's own mean, so it has to be
recomputed if the pictures change.

`assets/js/hud-frames.js` is **generated** and is the *only* copy of both HUD
frames — there are deliberately no `.svg` twins to drift out of sync.

To regenerate after a Figma change:

1. Export the node as SVG via the Figma images API
2. Round coordinates to 2dp (Figma writes ~6; this alone cut 219KB → 194KB)
3. Percent-encode
4. Replace the string

The generator used this run is in the session scratchpad as `gen_huds.py`. The
design-space boxes are **hard-coded in the lens** and must stay in step:

```
CNVRT_HUD_REST  455:4267   1839×976 @ (46, 68)
CNVRT_HUD_FULL  455:4528   1849×954 @ (35.5, 63)
```

Those boxes are now divided by 1920/1080 and multiplied by the canvas rather
than by `--u` — see the footer section. The numbers themselves are unchanged.

`assets/svg/ftr-wordmark.svg` is the dotted CNVRTLABS mark, exported straight
from **564:7310** (1392×186). It carries its own `#FFF1E9` fill *and* its own
`<g opacity="0.7">`, so the CSS applies neither — re-applying either is the
obvious way to get this wrong. It is one `<img>`, not inlined, because it is
114KB of circles and nothing needs to restyle it.

Worth knowing before re-exporting the rest plate: **527:4665 is not new art.**
All 19 of its `<line>` elements match `CNVRT_HUD_REST` to the coordinate. Figma
just re-groups the wordmark and BASED IN BLR inside it, and re-rounds every path
(`779.43` → `779.426`) so a naive text diff claims everything changed.

The `ffsbruh` skill (`figma_probe.py`) dumps ground-truth node properties —
corner smoothing, background blur, stacked shadows, blend modes. Codegen and
screenshots both lie about those. Use it before building any Figma node.

---

## Testing

### The live frame meter — `assets/js/fps-meter.js`

Top-left overlay, on by default. **Shift+F** toggles, **Shift+R** resets. fps
against the *inferred panel rate* rather than against 60, median/p95/worst frame
time, a 180-frame sparkline, long tasks in the last 2s, and the scroll position
and section name so a hitch has an address. It is one `<script src>` at the
bottom of `index.html` and one deleted line for a shipping build.

It is only true in a real window you are scrolling by hand — a hidden automation
tab does not fire rAF and a scripted window is presentation-throttled. See
`PERF.md` → `## How to measure` → `### The live meter` for what each field is
for and which finding it was built to make visible. `tools/ev-fps.js` checks it.

### The optimising dashboard — `tools/dash.html`

Where the page drops, and what is doing it. `assets/js/perf-probe.js` (first
script in `<head>`, inert without `?probe=1`) buckets the document into 100px
scroll bands and charges every rAF driver, every `SY` subscriber and four
synchronous stalls their own **self** time, identified by call site —
`SY:paint index.html:10272`. The dashboard draws the site map, the fps profile
and the per-band hitter list against one shared vertical axis.

```
arm + open site   →   scroll it (or Shift+S to sweep)   →   dash.html, reload
```

Full write-up, including why `unattributed` is usually the interesting line, is
in `PERF.md` → `## How to measure` → `### The dashboard`.

### Dot matrix — `tools/dotmatrix.html`

Drop an image in, get it back on OffBit Dot's grid, on `#141414`. For turning a
decorative letter PNG into something that can sit next to OffBit type as a drop
cap. Drag/click/paste, then export at 1× or 4×.

**The grid was measured off the font, not eyeballed off a screenshot** — the
face was rendered at 700/1400/2000px and the pixels were read back
(`tools/_offbit-measure.html` is the rig, `tools/ev-offbit-shape.js` the fit):

| | |
|---|---|
| pitch | **0.054 × font-size** — 18.5 dots per em |
| dot side | **exactly the pitch**. They tile edge to edge, which is why strokes merge into one mass instead of reading as beads |
| corner radius | **0.466 × side** — a **rounded square, not a circle** |
| advance | whole dots per glyph (`B` 11, `A` 13); cap height **13 dots** = 0.702em |
| colour | `#FFF1E9` on `#141414` |

The shape is the part that matters and the part that is easy to get wrong. A
circle of diameter = pitch touches its neighbour at a single point, so a stroke
scallops and falls apart; the real dot has about 7% of each side flat, so
neighbours meet along an edge and leave a small four-pointed notch at every
crossing. That notch is the entire texture of the typeface. Fitting the real
glyph's edge profile: rounded square RMS 0.008, circle RMS 0.018 — 2.2× better.

Set **match font-size** to whatever the OffBit text beside it is set at and the
two grids land on the same lattice; the panel renders a real OffBit glyph beside
the output so you can check that they do.

### THE BEYONDER — `tools/beyonder.html`

> **This tool has its own handoff: `BEYONDER.md`.** Read that before touching it
> or the two routes it added to `tools/serve.js` — it carries the resolution-vs-
> OS-scaling distinction, the squircle reconstruction, the proxy/local-file
> routing, and the traps (a 404 used to kill the whole server).

`node tools/serve.js`, then **http://127.0.0.1:8743/_s/beyonder.html**. See a
page as a monitor you don't own would render it. An `<iframe>` is sized to the
target's CSS viewport and scaled to fit; `100vw`, media queries and
`documentElement.clientWidth` all report the simulated screen, and the caption
reads `--u` back out of the frame to prove it.

Loads anything: same-origin paths and localhost ports direct, remote sites
through `/_proxy` (which drops `X-Frame-Options`/CSP), local files through
`/_local`.

---

Verified by driving **headless Chrome over raw CDP** from Node — no puppeteer,
no npm install (Node 21+ has a global `WebSocket`). The Claude-in-Chrome
extension was unreliable in this environment; CDP was not.

Scripts live in the session scratchpad (`states.mjs`, `shoot2.mjs`, `diag.mjs`).
The pattern: launch with `--remote-debugging-port`, navigate, `scrollIntoView`,
drive real `Input.dispatchMouseEvent` (so hit-testing is genuine), screenshot,
read the console.

**Always test `file://` without `--allow-file-access-from-files`.** That flag
masks the entire cross-origin class of bug described at the top.

Useful trick: pixel-diff two screenshots to prove a subtle effect is real —
that's how the yaw was quantified (6.89% → 7.51% → 8.07% of frame changed
between cursor-left and cursor-right).

For anything scroll-driven, **don't race screenshots — read the state in-page.**
`Page.captureScreenshot` takes 50–100ms, so it samples a 200ms effect two or
three times at best. Instead park at a series of scroll positions and have a
page-side async function report the real numbers, e.g. each work strip's fill
parsed straight out of its computed `clip-path` inset. That is what caught the
ordering inversions and the strips that never finished opening; none of it was
visible in a screenshot. `Page.startScreencast` is the middle ground when a
picture is genuinely needed — it streams frames far faster than captureScreenshot.

Also worth knowing: this section runs five 4000ms `scramble` animations that
rewrite `textContent` every frame, so the main thread stalls 70ms+ at a time
while the work section is on screen. Anything measured there needs to tolerate
dropped frames, and anything on a fixed timeout will fire early.

---

## Deploy

GitHub Pages from `main` / root. `git push` is the deploy.

`.gitignore` excludes `hero-video/`, `hero-options/`, `hud.png`, `Frame*.png` —
~400MB of working material the site doesn't reference. What ships is 37MB,
mostly `assets/video/hero.mp4` (23MB), `assets/img/work-panel.png` (5.5MB) and
`assets/img/work-grid.png` (4.8MB).

`Screen Recording *.mp4` in the repo root is the reference capture the work wipe
was dissected from. Untracked and not gitignored — delete it or add it to
`.gitignore` before committing.

---

## Known constraints / next

> **The optimisation plan is `PERF.md`.** It carries the measured cost of every
> render subsystem, the four changes worth doing first, and — just as important
> — the 46 findings that were raised and then REFUTED, so they do not get
> proposed again. Read its `## How to measure` before running any harness: this
> project has been wrong about performance three times and always the same way.

> **The nav and FAQ work has its own handoff: `NAV.md`.** Read that before
> touching the top nav, side nav, vertical menu or FAQ — it carries the five
> rules that pass established (Figma blur halving, the cornerSmoothing tangent
> formula, geometric hover, the visibility trap, and the var-shadowing trap)
> and what is still open on them.


### NEXT RUN

**An asset for the offerings section, then a restart.** Nothing in the work
section is blocked or half-finished — the turn out to pricing, the scroller and
the picture in the frame are all built and verified as far as a hidden automation
tab can verify them.

Two things that are decisions, not bugs, and are still open:

- **The white frame crops on a real viewport.** It is exact at 1920×1080, but a
  maximised Chrome gives a shorter viewport and it loses 8–36px off the top. One
  line to centre it symmetrically instead — it was left alone rather than move a
  Figma-pinned position unasked.
- **None of it has been watched live at 60fps.** Three runtime filters and a
  per-frame line-crossing check went in this session, and the automation tab is
  `document.hidden`, which freezes rAF *and* CSS transitions. It needs eyes.

**Higgsfield credits are effectively out** — 0.26 left. See the turn-out section
for what the tiers cost and which lessons are worth reusing on the next asset.


- **three.js comes from `esm.sh`** — the one remote dependency, used by the
  pricing cards and the starfield (same CDN import RFL uses). Offline, the cards
  fall back to flat SVG and the footer stays black. The footer *lens* is raw
  WebGL specifically so the HUD never depends on a CDN. Vendoring three is a
  known open option.
- **No mobile / responsive pass.** Everything is a 1920-wide design scaled by
  `--u`; below ~1000px it will be unusable.
- `assets/img/pricing-bg.jpg`, `assets/svg/card-*-mask.svg` and
  `assets/svg/piece-glow.svg` are still on disk but no longer referenced from
  markup (the masks are inlined as data URIs; the pricing photo plate was removed
  on request; the piece glow is painted as an inline mask over a solid fill).
- **The agent bar is cut for v1.** `ASK ABOUT ANYTHING.` — the fixed pill in the
  bottom-right of every section (Figma 423:1573) — is gone: markup, its CSS
  block, the `#clip-agentbar-union` clip path, its slot in the `body.hud-open`
  chrome evacuation, and the now-dead `hero-live` body class that existed only
  to hold it back during the hero's own run. `assets/svg/agentbar-icon.svg` and
  `agentbar-union.svg` are still on disk and unreferenced, so putting it back is
  a markup + CSS job, not an asset hunt.
- **The work section is 1485vh on its own** (240 entrance + 90 logo card +
  `BAND` × 5 + 480 turn-out). Lengthening `BAND` to slow the wipe makes the whole
  page longer — there is no separate lever. `LEAD` is the exception: it borrows
  30vh from the offerings handover rather than adding any. `EXITV` is the newest
  and largest single segment; it is twice `ENTER` on purpose, because the exit
  curve spends 39% of each of its two beats creeping through the last tenth of
  its travel.
- **The pricing state has no dwell.** It is arrived at on the last frame of the
  work section's pin, and there is no hold after it — the panel unpins on the
  same scroll and the FAQ starts arriving. That was an explicit call (the empty
  100vh `.price` box was deleted outright rather than kept as scroll room). It
  does mean the hover ripple, which wakes at `cg > 0.999`, has nowhere to be
  used except as the panel scrolls away. One `HOLD` pushed onto `SEG` after
  `EXITV` is the entire fix if it is ever wanted.
- **The work piece renders at 6× during the entrance**, but as three flat images
  with no filter, mask or backdrop-reading blend anywhere in the path — see the
  Work section. The live subtree is `visibility:hidden` until it lands. The
  baked glow masks are still in the file and still correct; they only matter
  from the landing onward now.
- **`work-still-c.webp` is 162KB** and the three bakes are 209KB together. They
  are the flight, so they are on the critical path for it — if that ever needs
  cutting, `-c` carries green and blue and is where the bytes are.
- Still only ever checked frame by frame in an automated tab (rAF does not fire
  in a hidden one), never watched live at 60fps.
- **Section 2 + offerings are ~12.7vh together** (5.0 + 7.7). That is the
  arithmetic of the speeds, not slack: crossing one viewport at `vPanel 0.184`
  costs 5.4vh on its own, and offerings now rises from below the fold. Lowering
  `vList` toward `vPanel` to reduce overtake makes it *longer*, because the list
  needs more scroll to finish its relay. The lever that shortens it is
  `listLow` / `startLow` — start less far down — not the speeds.
- **`.ftr` is still `z-index:auto`**, so it sits under `#env` the way offerings
  did before it got `z-index:1`. Not currently a problem because the envelope is
  transparent by then; it would present as the section rendering black. Unswept.
  `.work` was in this list and is now `z-index:2` — it had to be, to survive its
  600px overlap with `.off`. `.price` was in it too and no longer exists.
- The offerings entry is deliberately bare — no fade, no blur, no scale. It was
  given a resolve-in at one point and that was explicitly rejected.
- Work item CTAs are still dead anchors (`#project`, `#all`, `#deck`, `#`). Only
  `#contact` resolves.
- The lens tuning panel was removed once values were settled. If you need to
  re-tune, the fastest route is to re-add sliders bound to the `st` object —
  every mapping already reads from it.
