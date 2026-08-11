# PERF — the optimisation plan

Written 2026-08-11. Read `## How to measure` before you believe any number in
here, including mine.

This is the output of a sweep over every render subsystem in `index.html`:
eight analyses, sixty-odd adversarial verifications, and a critic pass over the
result. **71 findings were raised and 46 were refuted** — by verifiers that went
and read the code rather than taking the claim. The refutations are kept in
`## Refuted` on purpose: several of them are things any reasonable person would
propose again next month.

Two numbers to hold on to.

| | |
|---|---|
| **The page is 39.7 MB.** `hero.mp4` is 24.1 MB of that, and four PNG/WebP bakes are another 13.3 MB. | 94% of the bytes are five files. |
| **The hero's full-screen shader runs for 94% of the scroll.** It is visible for about 1,400 px of 30,400. | One condition fixes it. |

---

## The short version

If you only do four things, do these, in this order. Everything else on this
page is a few hundred microseconds; these are the two orders of magnitude.

| # | change | where | why it is first |
|---|---|---|---|
| **1** | Gate the hero on occlusion — `var off = (offTop <= 0)` | `index.html:6592` | One condition kills a 2.07 Mpx fragment pass for 27,100 px of scroll, drops the 24 MB video's 8.29 Mpx-per-frame decode, and removes three blurred blended overlays from the composite. Proven no-look-change by pixel diff. |
| **2** | Slow the offerings ring's encode rate — `POSEQ`, `MAPRES`, or get the PNG encoder off the main thread | `index.html:10329–12470` | The only place on the page where a **360–615 ms synchronous task** lands on the scroll path. 168 `toDataURL` calls over 1,660 px. The page runs at 11–25 fps through it regardless of GPU. |
| **3** | Clear the filter on `exitGroup`'s `t >= 1` branch | `index.html:10200–10221` | Two lines. Removes a 2.0 Mpx σ=26 Gaussian that is sitting at `opacity: 0` for 216 px of scroll. |
| **4** | Pre-bake the two work-section lens maps | `index.html:9088–9127` | Parser-blocking. Measured **574 ms → 99 ms** on the target machine. Startup only, but it is the whole first impression. |

Item 1 and item 2 are not close to anything else. Item 2 was **not found by the
sweep at all** — none of the eight areas covered the offerings glass ring, which
is 2,100 lines and the page's third three.js context. The critic caught it.

---

## How to measure

This project has been wrong about performance three times, always the same way,
and the reason is in `tools/perf.js`'s header. It is worth restating.

**A window driven from a script is presentation-throttled.** Frame *interval*
then measures the presentation cadence and nothing about the page. On this
machine every configuration — including "every canvas hidden" and "nothing
scrolling at all" — came back at 62.5 ms, which is nine intervals of a 144 Hz
panel. Do not report FPS from a harness.

**Read work duration out of a trace instead.** That is what the DevTools
Performance panel actually shows and it survives a throttled presentation.

**And do not sum the whole trace.** The first run of `tools/perf-turn.js` had
`idle` looking *more expensive* than `live` — 211,857 ms against 315,094 ms —
because the largest events in a trace are not work at all.
`DXGISwapChainImageBacking::Present`, `SwapBuffers` and `Graphics.Pipeline` are
the swap chain **waiting**, and a page doing nothing waits longer, so they run
backwards against the thing being measured. `RunTask` and `Scheduler::RunTask`
are outer wrappers that double-count everything inside them. The metric has to
be a whitelist of real work.

**`tools/shot.js` cannot answer a GPU question.** It runs
`--headless=new --enable-unsafe-swiftshader` (`tools/shot.js:26,39`) — software
rasterisation. It is the right tool for geometry, state and correctness, and the
wrong tool for cost. Use `tools/perf.js` / `tools/perf-turn.js`, which launch a
real window on the real GPU.

### The live meter — the one place a frame rate is real

Added 2026-08-11. `assets/js/fps-meter.js`, one `<script src>` at the bottom of
`index.html`, top-left of the page, **Shift+F** to toggle and **Shift+R** to
reset. It is on by default; the choice is remembered, `?fps=0` starts it hidden,
and one deleted line removes it from a shipping build.

Everything above says do not report a frame rate out of a harness. This is the
answer to the obvious next question — *then how do I ever see one* — and the
answer is that you open the page yourself and scroll it with your own hand. The
meter reads rAF intervals in that window, which is the only context where the
interval is the page's and not the driver's. It reads frozen in `tools/shot.js`
(hidden tab, no rAF) and it reads the harness's cadence under `tools/perf.js`.
**Do not quote it out of either.**

Four fields earn their place against the findings on this page:

| field | what it catches |
|---|---|
| `Hz` + ms | the panel, inferred from the fastest frames seen since load, and everything else is coloured against **that**. On the 144Hz target machine a rock-steady 60 is a real halving; on a 60Hz screen it is perfect. It only ever ratchets down, so a bad stretch cannot recolour itself green. |
| `LT n x Nms` | long tasks in the last 2s. This is item **2** made visible — the offerings ring's 360–615 ms synchronous `toDataURL` calls land here and nowhere else. |
| `y … vh … section` | the address of the hitch you just felt, so you can scroll back to it. |
| bars | 180 frames, square-root scaled. A spike is one hitch; a raised floor is a section that is uniformly expensive. Item **1**'s hero gate should flatten the floor for 27,100 px of scroll. |

It costs one rAF callback of arithmetic per frame and rebuilds its readout 5×/s.
The honest caveat is that it keeps rAF running continuously, and `SY`'s loop
stops the moment it catches up to `scrollY` — so a settled page no longer idles
all the way down while the meter is up. Hide it before measuring idle.
`tools/ev-fps.js` is its regression check.

### The dashboard — where it drops, and what is doing it

`tools/dash.html`, fed by `assets/js/perf-probe.js`. The meter above tells you
*that* the page dropped; this tells you **where on the page** and **which
function**.

```
1  open the site with ?probe=1          (the dashboard's "arm + open site" does it)
2  scroll the whole page by hand — or press Shift+S and it sweeps itself
3  open tools/dash.html and hit reload
```

The probe cuts the document into 100px scroll bands and, for every frame
rendered **while the page is moving**, charges that band the frame's cost. So
parking on a section does not dilute it with cheap idle frames — every number
is the cost of scrolling *through* there.

Attribution is by wrapping, not by sampling. Every rAF callback and every `SY`
subscriber is timed and identified once, by parsing its call site out of a
stack, so the fifteen drivers hanging off the one scroll loop appear as fifteen
lines — `SY:paint  index.html:10272` — instead of one. Time is **self** time:
nesting is tracked with a stack, so a driver that spends 32 of its 40ms inside
`toDataURL` is charged 8 and the encode is charged 32. Four synchronous stalls
are wrapped by name because they are how a page like this actually dies:
`toDataURL`, `toBlob`, `getImageData`, `readPixels`.

Two things about it that are load-bearing:

- **`unattributed` is not slop.** It is frame time minus everything charged —
  style, layout, paint, composite, GPU, decode — none of which any JS wrapper
  can see. On this page it is frequently the largest line, and when it is, the
  answer is a surface, not a function. A fragment shader costing 9ms a frame is
  9ms of unattributed; the JS that dispatched it costs 40 microseconds.
- **The probe must be the first script in the document.** It works by wrapping
  `requestAnimationFrame` before anything registers with it and by putting an
  accessor on `window.SY` to catch the assignment. Move it below either and it
  goes deaf. It is inert without `?probe=1`.

The layout is one shared vertical axis — the page's own scroll position. The
map on the left is every section to scale, tinted by its worst quartile; the
profile is fps running to the right, so a drop reads as a canyon, with
worst-frame and long-task lanes in the gutter; hovering any row lists that
band's hitters, worst first, in self-ms per frame. Wheel to zoom, click a
section on the map to fit it, click the profile to pin a row. **worst 12 on the
page** is the to-do list, one entry per 2vh so a single canyon cannot fill it.

The first full run of it agreed with item 2 and then sharpened it: at
`y=10,700` in the offerings ring the frame cost 229ms, of which `getImageData`
was 95ms, `toDataURL` 47ms and `anon index.html:12240` 33ms. That run was
SwiftShader, where readback is disproportionately expensive, so **the split
between those three is not yet a real-GPU number** — but the shape of it is,
and `getImageData` was not on anyone's list before.

`tools/ev-probe.js` and `tools/ev-dash.js` are the regression checks.

### The harnesses

```
node tools/perf.js --trace          the offerings glass ring's band
node tools/perf-turn.js             the work -> pricing turn-out
node tools/perf-turn.js live nolens just the two configurations you need
```

`perf-turn.js` is new in this pass. It scrolls the turn-out one step per frame
in five configurations that each remove exactly one surface, so a difference is
attributable:

| mode | what is off |
|---|---|
| `live` | nothing |
| `nolens` | the viewport SVG filter detached from `.work__lens` |
| `nowave` | the two pricing wave-grid canvases |
| `noseed` | the whole white frame, and so the cards |
| `bare` | all three |
| `idle` | parked at the end, nothing scrolling — the floor |

---

## What the turn-out actually costs

Measured on the real GPU (Intel UHD 620, ANGLE/D3D11), 1920-wide window, over
the last 37% of the work section's pin. **GPU work over the band, in ms:**

| mode | GPUTask | what that isolates |
|---|---|---|
| `idle` | 922 | the floor |
| `bare` | 4,179 | the turn itself — piece, rotation, copy row |
| `nowave` | 4,352 | …plus the frame and the filter, no canvases |
| `nolens` | 6,484 | …the canvases, with **no** filter over them |
| `live` | 7,749 | everything |

Read the differences, not the levels:

- **The filter costs almost nothing on its own.** `nowave − bare` = **173 ms**.
  A viewport-sized `feDisplacementMap` chain over a subtree with no live canvas
  in it is nearly free.
- **The two WebGL contexts are the real cost.** `nolens − bare` = **2,305 ms**.
- **And the filter roughly halves their throughput.** The same two canvases cost
  `live − nowave` = **3,397 ms** *under* the filter against 2,305 ms without —
  about **47% more expensive** for being inside a filtered subtree.

The one thing that reproduced cleanly across two runs is the decode:
`ImageDecodeTask` was **+1,684 ms** (run 1) and **+1,576 ms** (run 2) with the
filter attached versus without. A filtered subtree cannot reuse the decode
cached at the composited scale and re-rasters its sources.

**Honesty about variance.** Absolute totals moved a lot run to run (`live` 13,151
then 17,425 ms of whitelisted work) — thermal and driver noise on an integrated
part. The *ratios* and the decode delta held. Treat this harness as a comparison
and never as an absolute, and always run the configurations back to back in one
session, which is what it does.

### The one measurement still outstanding

Whether Chrome GPU-accelerates the `#wkLensFx` graph at all or falls back to a
CPU Skia path. Five findings hang on the answer. The test is one command:

```
node tools/perf-turn.js live nolens
```

If the delta lands in `RasterTask`, it is CPU and the whole turn-out block of
this plan is worth doing. If it lands in `GPUTask`/`DrawFrame`, it is GPU and
most of it is not. On the run above the delta was split — GPUTask +1,265,
RasterTask **−852** — which says the filter is largely GPU-resident and that
detaching it *increases* raster elsewhere by changing layerisation. That is a
weak "leave it alone", and it wants one more run to be sure.

---

## 1. The hero occlusion gate

**This is the single biggest change available and it is one line.**

`alpha` (`index.html:6588-6590`) is computed as
`1 − (−frontY)/(P.fadeLen * vh)`, which treats `fadeLen` as a count of
**viewports**. Every other consumer of that number treats it as **vh** —
`SHADER.md:74` writes `calc((var(--env) * 100 + var(--fade)) * 1vh)`, and
`applyCss()` passes `--fade` through raw. The fade span is therefore
`34 × 1080 = 36,720 px` on a 31,500 px page.

Consequences, all measured headless at 1920×1200:

- `alpha` at the bottom of the document is **0.272**. It never reaches 0.
- So `off` is never true, `data-off="1"` is never set, and the
  `if (p > 0 && alpha > 0)` gate at `:6657` never closes.
- Patching `drawArrays` and parking at scrollY 20,000 — deep inside the work
  section — counts **9 draws on `#env` in 800 ms**.
- Draw window: **30,903 px of 33,062**. Genuinely-visible window (`offTop > 0`):
  **1,489 px**. A ratio of **20.8×**.

The pass being wasted is 2.07 Mpx with **no `discard` anywhere in the 511-line
`main()`**, roughly 3,000–5,000 scalar ALU ops per fragment. Every fragment runs
the whole thing.

### Do NOT fix it by dividing by 100

The obvious fix — `P.fadeLen = 0.34` — is a **look change**, and the sweep's own
top-ranked finding got this wrong by rating it `risk: none`. `alpha` is uploaded
as `u_prog.y` and multiplies the shader's entire output. Pixel-diffing `#env`
shown against hidden across exactly that band:

```
y = 3050   bbox (0,0,1920,233)     49,683 sampled px over threshold   max delta 246
y = 3150   bbox (0,0,1920,133)     28,774 sampled px over threshold   max delta  75
y = 3300   bbox (205,15,978,549)         1 sampled px over threshold   max delta  10
```

At y ≈ 3,050–3,150 the shader is painting the top 133–233 rows at near-full
strength. That is the opaque `#141414` front the note at `index.html:1560-1567`
describes and the reason `.off` needed `z-index:1`. Fading it to zero there
tears a hole through to the hero.

### Fix it by occlusion instead

`.sec2__panel` is `position:sticky; top:0; height:100vh; background:#141414`
(`:904-916`) and `.off` below it is `z-index:1; background:#141414`
(`:1013-1020`). The moment `offTop <= 0` the viewport is opaque above `#env` and
nothing the canvas draws can be seen. The pixel diff at y = 3,300 proves it:
one sampled pixel over threshold.

```js
var off = (offTop <= 0);          // index.html:6592, was (raw >= 1 && alpha <= 0)
```

Three implementation notes, all of which the naive version gets wrong:

- **It cannot go at the top of `draw()`.** `offTop` is not computed until
  `:6557` and `smoothY` not until `:6533`. The gate must sit *after* `:6593` so
  `heroOff`/`data-off` still flips — otherwise the hero never un-hides on the way
  back up — and so `--hero-creep`/`--hero-dark` at `:6617-6618` are still
  written, or the fixed panel freezes mid-viewport.
- **`visibility:hidden`, never `display:none`.** `display:none` can drop the
  drawing buffer, and it invalidates layout on a 31,500 px document twice per
  crossing. `visibility:hidden` produces no draw quad, costs no layout and
  preserves `cv.clientWidth`.
- **Skip the `clear` too.** `gl.clearColor`+`gl.clear` currently run
  unconditionally above the draw gate, and a cleared WebGL canvas is a dirty
  canvas — Chrome commits a fresh 1920×1080 RGBA texture per frame. With no draw
  the texture is never re-dirtied, so skipping the clear is safe.

### One condition, four wins

Because `.hero[data-off="1"]{visibility:hidden}` (`:175`) finally fires, this
also removes:

- the fixed full-viewport `.hero__panel` quad,
- the three blurred, blended `tv__*` overlays (`tv__glow` screen, `tv__panel-a`
  blur 2.48 + plus-lighter, `tv__panel-b` blur 8.69 + plus-lighter),
- and the `8.29 Mpx × 24 fps` H.264 decode of a 3832×2164 video that keeps
  running for the whole page.

**A refutation in the sweep claimed the hero panel is off-viewport from
scrollY ≈ 5,803 and killed that finding. It is wrong.** It computed from
`P.heroPar = 0.3`; the shipped value is `0.10` at `index.html:5690`, and the
comment at `:5681` says so. Measured `--hero-creep`:

```
y = 13000   panelBottom    0    videoBottom  219
y = 15200   panelBottom -212    videoBottom    7
y = 16000   panelBottom -300    videoBottom  -81
```

The panel is in the viewport to **y ≈ 13,000** and the video element to
**y ≈ 15,270** — 9,400 px further than the refutation claimed. A pixel A/B shows
`#env` contributes nothing from y ≈ 3,300 onward. So a fixed video quad and
three blurred blended overlays composite for **~12,000 px — 40% of the page —
while provably invisible.**

---

## 2. The offerings glass ring

**Nobody was asked to look at this and it is the biggest main-thread number on
the page.** `index.html:10329–12470`, ~2,100 lines, the page's third three.js
context.

The cost model is stated in the file itself at `:10690-10698`:

> THIS IS THE EXPENSIVE AXIS… X and Y change the silhouette and every normal, so
> each step is a fresh encode: six renders, a readback and three `toDataURL`
> calls at 512 px.

The Z axis is the free one. **The shipped default is `rotAxis: 1`** (`:10435`)
— the expensive axis — with `rotStart: 0` / `rotEnd: −365`, and `POSEQ = 4`
(`:10699`) means a fresh encode every 4° of a 365° turn.

Measured, real window, fresh profile:

| | |
|---|---|
| the turn runs | scrollY ≈ **9,490 → 11,150** |
| one pose step every | **~18 px of scroll** |
| `toDataURL` of the 512² canvas | **7–45 ms each**, pure Skia/libpng CPU |
| PNG encodes per readback | **3** — matching the comment exactly |
| the module's rAF task | **360–615 ms**, repeatedly, across y = 9,600 → 11,000 |
| first pass down through the ring | **168 `toDataURL` calls** |
| second pass | **0** — the cache works |
| after one `resize` event | **159 again** — `:12227` calls `dropPoseCache()` |

That is roughly **2 ms of blocking CPU per pixel scrolled**. At 1,000 px/s that
is 2,000 ms of work per second of scrolling; the `queued` latch at `:12205` just
degrades it into one 40–90 ms task per frame. **The page runs at 11–25 fps
through the ring's crossing regardless of GPU.**

And it recurs. `release()` also calls `dropPoseCache()` (`:12261`) and fires
`RELEASE_AFTER = 30000` ms after the section leaves (`:12255`, `:12272`). The
work section is fifteen viewports of scrubbed content — anyone who reads it for
30 s and scrolls back up pays the full storm again. So does any window resize,
any devtools open, any scrollbar appearance.

**The Y turn is the artwork and this plan does not propose changing it.** The
honest options that were never put on the table:

- Raise `POSEQ` from 4 to 8 or 12. The mask lags the lit canvas by at most
  `POSEQ/2`, and the lit canvas already re-renders at the exact angle —
  `:10684-10689` says so.
- Drop `MAPRES` from 512 (`:10329`) to 256, for a map the same comment calls
  *low-frequency*.
- Replace `toDataURL` + `feImage href` with `createImageBitmap`/blob URLs, to get
  the PNG encoder off the main thread entirely. This is the one that keeps the
  look exactly and removes the blocking.
- Pre-bake the 92 steps at build time.
- **At minimum, stop `release()` dropping the cache.** The memory it reclaims is
  not worth re-paying 168 encodes.

---

## 3. Two free wins in section 2 and the parser

### `exitGroup` leaves a viewport-sized Gaussian on an invisible element

`index.html:10200-10221` only clears the filter on the `t <= 0` branch (`:10204`).
At `t >= 1`, opacity is exactly `1 − t·t = 0` but the filter stays. Measured at
y = 7,050: `sec2__stage--aux` is `opacity: 0`, `visibility: visible`,
`filter: blur(26px)` — **2,010k px**. `parked` (`:10143`) only fires when the
*later* group finishes, so stage A sits as a fully transparent 2.0 Mpx σ=26 blur
surface for the whole `XSTAG * vh = 216 px` stagger.

```js
if (t >= 1) { setFilter(el, 'none'); el.style.visibility = 'hidden'; }
```

Two lines, zero look change. It is exactly the principle the module already
states at `:10058-10061` — *NOTHING INVISIBLE CARRIES A FILTER* — applied to the
characters but never to the stages themselves.

### `lensMaps()` blocks the parser to generate two constants

`lensMaps()` (`:9088-9111`) builds two 256×256 canvases pixel by pixel and calls
`toDataURL()` on each. `lensBake()` (`:9114`) calls it unconditionally at `:9127`,
inside the inline script block `7412-9749` — **which blocks the HTML parser**.
The maps are a pure function of constants.

Measured on the target machine, four alternating runs: median time in block 7412
**574.5 ms → 99.0 ms**.

Run it once, paste the two data URIs in as constants — or straight into the two
`<feImage href>` attributes in the markup, exactly as `.work__glow--far/--near`
already carry baked PNG masks at `:1874-1880` — and make `lensBake()` a no-op
unless the tuning panel is open.

---

## 4. Load and bytes

The page is **39.7 MB**. Five files are 94% of it.

| file | on disk | pixels | decoded RGBA | referenced |
|---|---|---|---|---|
| `assets/video/hero.mp4` | **24.1 MB** | 3832×2164, 361 f, 15.04 s | — | yes |
| `assets/img/work-panel.png` | 5.39 MB | 2736×1923 (5.3 MP) | 20.1 MB | yes |
| `assets/img/work-grid.png` | 4.59 MB | 2598×1359 (3.5 MP) | 13.5 MB | yes |
| `assets/img/blue-chip.png` | 1.55 MB | 1224×1224 (1.5 MP) | 5.7 MB | yes |
| `assets/img/work-seed.webp` | 1.13 MB | 2688×1520 (4.1 MP) | 15.6 MB | yes |
| `assets/img/work-still-c.webp` | 0.07 MB | 1735×1263 (2.2 MP) | 8.4 MB | yes |
| `assets/fonts/fonts.css` | 178 KB | 5 base64 faces | — | render-blocking |
| `assets/img/pricing-bg.jpg` | 322 KB | — | — | **no** |
| `assets/img/avatar.png` | 6 KB | — | — | **no** |

That is **~65 MB of decoded bitmap** for the work section alone, on a part with
shared system memory.

**`hero.mp4` is the one to do.** It is declared `autoplay muted loop
preload="auto"` (`:3940-3941`), so the full 24 MB is fetched on every load,
ungated. The element is never displayed above ~2,870 CSS px. Re-encoding at
2880×1627 at the same CRF — still a >1.05× margin over the 2,732 device-px worst
case — takes it to **~13.5 MB** by pixel count, and drops the per-frame decode
from 8.29 Mpx to 4.69 Mpx, which matters twice: once at load and once every
frame it is on screen. Give it a poster.

**Add the four big bakes to the existing `decode()` warm-up** at
`:8226-8230`. None of `work-panel`, `work-grid`, `work-seed` or `blue-chip` is in
it. This is the cheap half and it is uncontroversial.

**Do not bother re-exporting the PNGs as a performance fix.** The refutation is
right that it buys nothing per frame — the decode happens once. It is a bytes
argument, not a frames argument, and the video dwarfs it.

Also worth doing, all small:

- `fonts.css` is 182,309 B and `:25` is an uncompressed `data:font/otf` +
  `format('opentype')`. Convert the Semibold to WOFF2 and subset. It is the only
  external stylesheet and it is an unconditional render-blocking `<link>` at
  `index.html:7`.
- `preconnect` + `modulepreload` for esm.sh, and import the already-resolved
  module URLs. (Note: there are **no 302s** — a claim to that effect was refuted
  live; `esm.sh/three@0.185.1` returns 200 with an immutable cache header.)
- Delete `pricing-bg.jpg` and `avatar.png` from the repo, or at least stop
  shipping them.

---

## 5. The cross-section coupling nobody could see

`.work{margin-top:-128vh}` at `index.html:1570` makes `.off`'s box extend
**1,382 px past the point where `.work` begins** (measured: off 6,896–14,661,
work starts 13,279). The glass ring's sleep gate is an IntersectionObserver on
`.off` with `rootMargin:'100% 0px 100% 0px'` (`:12289`).

So `backdrop-filter:url(#offGlassFx)` stays declared until scrollY ≈ **15,700** —
measured `url("#offGlassFx")` at 13,300 / 14,000 / 14,700 / 15,200, and `none`
only at 15,690 — i.e. through **the entire 240vh work entrance flight**.

Be honest about the size: the ring's own box is 2,000–4,500 px above the viewport
there, so cc culls the quad and the real cost is small. But the gate is 2,400 px
late *by construction*, and it is late for a reason nobody reading either module
alone would find: **a `margin-top` in the work section's CSS decides when the
offerings section's WebGL module goes to sleep.** Observe `.off__glass` itself
rather than `.off`, or add `-100%` to the bottom `rootMargin`.

---

## 6. The rest, by area

Everything below survived verification. None of it is close to items 1–4 — most
are a few hundred microseconds — but they are all real and most are trivial.

### Hero shader (`#env`)

| change | effort | note |
|---|---|---|
| Early-out the crumb machinery for pixels outside the band | small | `if (abs(dl) > cut) { gl_FragColor = …; return; }` right after `:5928`. Bit-identical output. The verifier **upgraded** this to *large* — the boundary is a single connected curve so branch coherence is good. |
| Hoist the 26 column-constant `noise()` calls into a 1-row LUT | medium | `ridge`, `sway`, `lead`, cell jitter, both `lagAt()`, `tear`, the line-thickness tv noise — all pure functions of `gl_FragCoord.x`. 1,920 fragments instead of 2.07 M, a 1,080× reduction on that portion, ~40% of the shader's ALU. |
| Compute only the reach field that is used | trivial | `rnA`/`rnW` are two independent `devField()` calls, ~470 ops each, and only one is ever read. Use an explicit `if` so the compiler cannot flatten both sides. |
| Delete the dead second crumb layer | trivial | `partAmount2` is 0 and the 9-tap loop still runs. |
| Move the 26 `uniform4f` uploads behind the draw gate; hoist the 18 constant ones | trivial | ~50 µs/frame of pure CPU, 24 of 26 GL calls removed. |

### The turn-out filter stack

| change | effort | note |
|---|---|---|
| Threshold the attach in **pixels**, not normalised amount | trivial | `setLens` attaches at `amt > 0.002`, where the corner displacement is 0.176 px and the blur sigma is 0.01 px. Use `(XP.warp + XP.ca) * amt * 0.5 >= 1` — one device pixel. Free, −10% of the on-window. |
| Get the pricing canvases out of the filter's source | small | Confirmed by measurement above: the same two canvases cost 47% more inside the filtered subtree. |
| `#wkTextFx`'s region is 150% for an effect that needs 2% | small | `.work__meta` is 1400 design px; the effect needs `txSplit 11 + 3σ×4.75 = 25.25 px`. Everything else is empty surface. |
| Replace the two-node `feMerge` with `feComposite operator="over"` | trivial | Exactly equivalent, one full-region pass fewer of sixteen. |
| Bake the four CSS blur+screen decorations inside the filters | medium | The file already states this principle at `:4327` — *THERE IS NOT ONE FILTER LEFT IN THE FLIGHT* — and does it three times elsewhere. Well-trodden. Do it after items 1 and 2. |

### Work section

| change | effort | note |
|---|---|---|
| Cache `scramble()`'s glyph-width table | small | It appends a probe `<span>` to a 31,501 px document and forces style+layout **36 times per line**. Measured ~53 ms (byChar) to ~80 ms (with pool) of forced layout inside a **40 px scroll window**. Hoist into a module-level `Map` keyed on the font signature — 4 distinct fonts, so 4 builds for the page's life instead of 12 per handover. |
| Precompute `linePair()`'s folds | small | ~11 ms of forced layout landing on the busiest frame of every handover. |
| Clip both glow plates out of the screen rect | small | `.work__screen` is opaque black over them; the glow drawn there is painted and immediately thrown away. Even-odd `clip-path`, far hole 27.28–72.72% × 34.83–65.17%, near hole 4.228–95.77% × 7.505–92.50%. |
| Re-bake the far glow mask at 2.5σ | medium | 45% of that plate is at alpha ≤ 2/255. |
| Composite the scroller | trivial | It moves a live `blur(5u)` under a screen blend every frame of every handover. |

### Pricing wave grid

| change | effort | note |
|---|---|---|
| Stop the grid once the work section is behind you | trivial | Already half-done — the gate added this pass is the frame's inline visibility. Confirm it releases on the way past. |
| Do not render while the lens filter is attached | trivial | Directly supported by the 47% number above. |
| Compile programs and allocate render targets before the first turn-out frame | small | three.js compiles lazily on first render and allocates the RT on first `setRenderTarget` — both land on the frame the seed first becomes visible, which is also the frame the full-strength lens is on. `renderer.compile()` in a `requestIdleCallback`. |
| Strip depth buffers, depth tests and duplicate clears from the bloom chain | trivial | 8 of 9 targets per card never need depth; `autoClear` already does what the 9 explicit `clear()` calls do. |
| Only re-upload the trail `DataTexture` when it changed | trivial | Currently a full `texImage2D` re-spec per card per frame even when the buffer is byte-identical. |
| Halve the blur taps with linear-sampled Gaussian offsets | small | |
| Collapse the two renderers onto one context | large | Listed for completeness. Two contexts on a UHD 620 is the structural issue, but this is a real rewrite. |

### Footer

| change | effort | note |
|---|---|---|
| Upload the two HUD plates as single-channel textures | small | Only `.a` is ever read. |
| Defer the two plate rasterisations and mipmap builds off the load path | trivial | |
| Drop the starfield's unused depth buffer and its per-frame clear | trivial | |
| Give the lens canvas the same pixel budget `#env` already has | trivial | |

The confirmed footer wave-grid leak — 12 draws + 10 FBO binds per frame per card
at y = 30,421 — is real and free to fix, and belongs **low**: it is confined to
the last 3.6% of scroll where no scrubbed animation is running.

### Nav, FAQ and the scroll engine

| change | effort | note |
|---|---|---|
| Early-return from the top nav's `frame()` while the bar is invisible | trivial | |
| Gate the nav's rAF loop on the nav being visible | trivial | |
| Hoist the comet's two `getPointAtLength` reads above the frame's writes | small | Read-write-read thrash. Hoisting is the fix; the LUT version is a bigger change with a smaller margin than claimed. |
| Stop rewriting the comet's `stroke-width`/`stroke-opacity`/`dasharray` every frame | trivial | 12 paths × 4 attributes. |
| Pause the four tick-drift CSS animations while the bar is hidden | trivial | `.tnav[data-on="0"] .tnav__drift{animation-play-state:paused}` — a visual no-op, that subtree is `visibility:hidden` in exactly that state. |
| Bound the FAQ reveal loop to the band it can affect | trivial | It walks all 185 elements on every frame of the entire page. |
| Cache `root.clientWidth`/`innerHeight` in the FAQ subscriber | trivial | It is the **last** subscriber, so it resolves every write the other six made. |
| Park the sec2 driver *before* its section as well as after | small | It has a `parked` state for after the exit and none for before, so it runs through the whole hero. |
| Have SY publish the raw `scrollY` it already read | small | `SY.frame` reads it at `:4084` and throws it away; three subscribers then re-read it. |
| Move the footer HUD's `getBoundingClientRect` behind its own dirty gate | small | |
| rAF-coalesce the side nav's resize layout | trivial | The side nav is otherwise the cleanest module here — it has no SY subscription, no rAF loop and no canvas. Keep it that way. |

---

## Refuted

**46 of 71 findings did not survive.** These are kept because they are all
plausible and several will be proposed again. Do not resurrect one without new
evidence.

The full set is in the workflow journal. The ones most likely to come back:

- **`fadeLen /= 100`.** Tears the hero→offerings handover. Take the occlusion
  gate instead. See §1.
- **`display:none` on `#env`.** Can drop the drawing buffer, and invalidates
  layout on a 31,500 px document twice per crossing. Use `visibility:hidden`.
  *(Two survivors contradicted each other on this; `visibility` is right.)*
- **`will-change: transform` on in-flight `.faq__ch`.** The proposal writes and
  clears `willChange` per element per frame. With ~6 characters entering and
  leaving per frame that is ~12 compositor layer create/destroy events per frame,
  each a `PaintArtifactCompositor` effect-tree update. **If you promote, promote
  all `.faq__ch` statically or none — never per-frame.**
- **`mix-blend-mode` on `.work`.** Not proposed, flagged so nobody rediscovers
  it: `index.html:1614-1620` records it as tried and rejected — it makes the
  whole section a blended group, which takes it off the pure-composited-transform
  path. It is the obvious "make the headline survive the arrival" fix and it is
  already paid for.
- **Re-encoding the big PNGs for frame-rate reasons.** Buys nothing per frame.
  It is a bytes argument. Take the `decode()` warm-up instead.
- **"Turn on compression."** `tools/serve.js` genuinely does not compress — but
  it is the local dev server and the production host already does.
- **esm.sh 302 redirects.** There are none; checked live, HTTP 200 with
  `immutable`.
- **Repeating an identical inline-style write costs meaningful work.** Measured
  false. Several "add a change guard" findings died on this.
- **Layout itself is the problem.** It is not — total layout duration is small.
  The forced-layout *bursts* in `scramble()` and `linePair()` are real; the
  general "too many reads" framing is not.

---

## Traps carried forward

- **Never report FPS from a harness.** See `## How to measure`.
- **Never sum a whole trace.** Present/swap events run backwards against the
  thing being measured.
- **`tools/shot.js` is SwiftShader.** Correct for geometry, useless for cost.
- **`tools/shot.js` and `tools/cprofile` are hardcoded**, so concurrent sessions
  collide on port 9333 and the profile directory. `perf.js` uses 9334,
  `perf-turn.js` uses 9335. Copy the file and change both if you need a fourth.
- Run configurations **back to back in one session**. Absolute numbers move
  30%+ between sessions on this part; ratios hold.
