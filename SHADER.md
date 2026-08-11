# SHADER.md — dropping the shimmer/devour effect into a real page

Application guide for `shader.html`. That file is a tuning harness: one effect,
one panel, 102 sliders. This is what you actually need to lift into a site.

Read `PICKUP.md` for *why* things are the way they are — every non-obvious
decision is recorded there, along with the traps. This file is only *how*.

---

## What the effect is

A **shimmer line** that eats the hero from the bottom up, wrapped in a band of
**beige torn-paper crumbs**. The crumbs are the entire blend — no haze layer,
no dissolve gradient. Below the line is clean black, above is untouched video.

Two things make it not read as a sliding layer:

- The boundary is a **resistance field thresholded by a rising front**, not a
  height field `y = edge(x)`. A single-valued frontier can only ever look like
  a line sweeping up. This one opens islands ahead of the front and closes
  holes behind it.
- The crumb field is **static in screen space**. The front sweeps *through* it.

---

## Minimum DOM

```html
<section class="hero" id="hero">
  <div class="hero__comp" id="comp">
    <div class="hero__media">
      <video class="hero__bg" src="…/hero.mp4" autoplay muted loop playsinline></video>
    </div>
    <div class="hero__vig" id="vig" aria-hidden="true"></div>
  </div>
</section>

<div class="pin" id="pin"></div>      <!-- scroll room, no content -->
<section class="black">…</section>     <!-- 130vh of flat black -->

<canvas id="env"></canvas>             <!-- fixed, full viewport, on top -->
```

Five IDs are required by the JS: `hero`, `comp`, `vig`, `pin`, `env`. Drop
`vig` only if you also delete `buildVig()` and the `vigTop`/`vigDepth` params.

## Minimum CSS

```css
.hero{ position:fixed; inset:0; overflow:hidden; z-index:0; background:#000 }
.hero[data-off="1"]{ visibility:hidden }   /* JS sets this past p=1 */

.hero__comp{
  position:absolute; top:0; left:0;
  width:100%; height:var(--comp-h);
  transform:translate3d(0, calc(-1 * var(--hero-y)), 0);
  will-change:transform;
  overflow:hidden;
}
.hero__media{
  --mw: max(100vw, calc(var(--comp-h) * var(--ar)));
  --mh: max(var(--comp-h), calc(100vw / var(--ar)));
  position:absolute; left:50%; top:50%;
  width:var(--mw); height:var(--mh);
  transform:translate(-50%,-50%) scale(var(--media-z));
}
.hero__bg{ position:absolute; inset:0; width:100%; height:100%;
           object-fit:cover; object-position:center; pointer-events:none }
.hero__vig{ position:absolute; left:0; right:0; top:var(--vig-top); bottom:0;
            pointer-events:none }

.pin{ position:relative; pointer-events:none;
      height:calc((var(--env) * 100 + var(--fade)) * 1vh) }

.black{ position:relative; z-index:1; height:130vh; background:#000 }

#env{ position:fixed; inset:0; width:100%; height:100%;
      display:block; pointer-events:none; z-index:2 }
```

`--ar` is the video's aspect ratio and must be set once (hero.mp4 is 3832×2164
→ **1.770795**). The rest — `--comp-h`, `--media-z`, `--vig-top`, `--env`,
`--fade`, `--hero-y` — are written by `applyCss()` and `draw()`.

**`.hero__media` covers the COMPOSITION, not the viewport**, then applies the
Figma zoom. That is why it stays correct at aspect ratios other than 1920×1239,
where hard-coded offsets would drift. Don't simplify it to `100vw/100vh`.

---

## Lifting the JS

Take, in order:

1. `DEFAULTS` → rename to whatever, keep every key. The shader reads all of them.
2. `VERT`, `FRAG` — verbatim. **Backticks inside the GLSL terminate the template
   literal.** This has broken the file three times. After any edit:
   ```
   node -e "const s=require('fs').readFileSync('shader.html','utf8');new Function(s.match(/<script>([\s\S]*?)<\/script>/)[1]);console.log('ok')"
   ```
3. `hash11`/`hash21`/`hash22`/`noise`/`fbm`/`devField`/`grainHash` — all used.
4. `curveAt` + `uploadCurve` + the `curveTex` globals — the falloff curve LUT.
5. `applyCss`, `buildVig`, `compile`, `boot`, `resize`, `draw`.
6. The `load()` / `save()` / `buildPanel()` block — **drop for production.**

Drop the panel and you must keep: `applyCss()` at startup, and `uploadCurve()`
**after** the params are set. `boot()` runs before `load()` in the harness, so
the curve texture is built from DEFAULTS and re-uploaded afterwards — if you
inline the params you can upload once, but it must be after `boot()`.

### Things that will bite

- **`OES_standard_derivatives`** is required. `fwidth()` sets the crumb edge
  width, and there is an `#ifdef` fallback, but without the extension the
  anti-aliasing stops being a constant number of pixels.
- **Premultiplied alpha.** `gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)`, and
  the context is created with `{alpha:true, antialias:false, depth:false}`.
  The line is drawn ADDITIVELY — it raises rgb without raising alpha, which is
  a true add over the video rather than a lerp toward white.
- **The shader cannot see the video.** `#env` is a transparent canvas composited
  over a DOM `<video>`; there is no sampler for it. Anything "video-derived"
  can only be a hole punched in the black. This constrains more than it looks.
- **`hero.mp4` needs a Range-capable server.** `python -m http.server` will not
  serve it to Chrome's media pipeline. There is one at
  `<scratchpad>/serve.js` (port 8742) with a `POST /_rawb` endpoint for pulling
  renders back out of the page.
- **localStorage key** is `cnvrt.line.v2`. Clear it *then* reload — clearing
  after load does nothing, the values are already in memory.

---

## The scroll contract

```js
span  = env * viewportHeight          // vh of scroll the envelope takes
raw   = clamp(smoothY / span, 0, 1)
p     = pow(raw, ease)
base  = -below + (canvasHeight + above + below) * p
alpha = 1 - clamp((smoothY - span) / (fadeLen * vh), 0, 1)   // past p=1
```

`smoothY` chases `window.scrollY`, damped **frame-rate independently**:

```js
k = 1 - pow(1 - smoothScroll, dt * 60)
```

A flat per-frame lerp settles twice as fast at 120Hz as at 60Hz and the feel
changes with the monitor. Every scroll read goes through `smoothY` — envelope,
fade, hero parallax, readout — so they cannot drift apart.

`below` / `above` are the margins that must clear **everything** that pokes
past the line, or a sliver of video survives at p=1:

```js
creep = (leadAmp + lagMax) * 0.6 + devAmp * 0.5
below = slackBot + ridgeAmp + tearAmp + partDown + creep
above = slackTop + ridgeAmp + tearAmp + partUp   + creep
```

**If you change `devAmp`, `leadAmp`, `lagMax`, `partUp` or `partDown`, these
margins move with them.** Getting this wrong is invisible until p≈1.

---

## The panel groups, in the order they matter

| group | what it owns |
|---|---|
| `scroll & motion` | `env` (duration), `smoothScroll`, `ease`, `heroPar`, `fadeLen` |
| `devour` | `devAmp` is the character control — 0 reproduces a plain sweeping line, high opens islands |
| `hero & vignette` | Figma geometry: `compH`, `mediaZoom`. Verified, leave alone |
| `silhouette` / `sway` / `develop` | the big shape and its creep |
| `the white line` | `lineW`, `lineBright`, `thickVar`, `warm`, `tintR/G/B` |
| `the torn edge` | `edgeAA`, `tearAmp` — the black itself |
| `PARTICLES — …` (7 groups) | everything about the crumbs |

Only three params reproduce the Figma frame and should not be touched without
re-deriving them: `compH: 111.54`, `mediaZoom: 0.9754`, and `--ar: 1.770795`.

---

## Tuning cheatsheet — the traps, measured

These cost real time to find. Numbers are from actual renders.

**More particles → LOWER `partAmount`, not higher.** It lowers a threshold, it
does not add crumbs. Coverage saturates at 38.8% by `partAmount: 6` (11 is
identical), while distinct crumb *count* falls the whole way up: 8.9 per
scanline at 0.6 down to 4.3 at 11, because they merge into each other.

**`partSize` below ~4 stops reading as paper** and becomes noise, whatever the
coverage says. Fine speckle looks like noise however slowly it moves.

**`partStretch` below 1 SHORTENS crumbs.** It divides the vertical lookup.
`persTrail` then *multiplies* it — 2.1 × 1.2 gives crumbs 3.7× taller than
wide, which is vertical smear. Keep the product under ~2.

**Patchiness comes from four params, all doing it at different scales:**
`partClump` (density blobs — the big one), `partReachVar` (band depth),
`partOpacVar` (per-crumb opacity lottery), `partScatter` (seed voids). Near 1
they all read as dirt.

**Restlessness is usually the SILHOUETTE, not the particles.** `ridgeDrift`
and `swaySpeed` move the boundary and drag the whole band with it. Slowing
`partDrift`/`partWander` three times moved temporal correlation from 0.182 to
0.184; slowing `ridgeDrift` (0.069 → 0.008) and `swaySpeed` (0.124 → 0.08)
took it to 0.688 at 4s. Reference is 0.78 at 4s and 0.98 at 0.5s.

**`grainRate` is temporal noise.** Any nonzero value re-randomises the dither
that many times per second, on every crumb edge. 0 is static and static is what
reads as elegant.

**`partWarpSc` above ~1 shreds each crumb below its own size** → noise. Below 1
the raggedness is crumb-scale → torn paper.

**Density at the line: use `partCore`, not `partThr`.** Lowering the threshold
raises the tail faster than the line and flattens the band (thr 1.47 → 3%/37%
far/near; thr 0.15 → 54%/74%). `partCore` drops the threshold *locally* so the
line can be near-solid while the tail stays sparse.

**Gates on `devField` must be in field units, and the field does NOT span 0–1.**
Measured: **0.173 to 0.451, median 0.333**. Thresholds were set at 0.55 and 1.0
twice; both were above the maximum, so the effect silently never fired.

**Islands cost vertical boundary runs.** Islands need
`devAmp / (devScale * devAspect) > 1`, and that same condition makes the field
cancel `fc.y` along contours, producing long near-vertical boundary segments.
Same phenomenon — no setting has one without the other.

---

## Verifying a change

```
node -e "…new Function(…)"                    # JS only — will NOT catch GLSL
<scratchpad>/verify.py                        # params ↔ sliders ↔ uniforms
```

`verify.py` checks every DEFAULTS key has exactly one slider, every slider has
a param, every uniform declared is set, and **no default sits outside its own
slider range** — `partAmount` once shipped at 5.0 with a max of 4.0, which
silently snapped the moment the slider was touched.

The node check validates JavaScript only. GLSL errors (name collisions,
undeclared uniforms) only surface on `gl.compileShader`, so compile it in a
browser before believing a shader edit.

Always confirm, after any change to margins, `devAmp`, creep or reach:

- **p=1 closes** — whole frame `alpha 255`, `rgb 0`, no sliver
- **p=0 shows nothing** — max alpha 0
- **the black is clean** — measured RELATIVE TO THE EDGE, not at fixed canvas
  rows; with a deep wake, low rows sit *inside* the band and read as a false
  regression

**Preview over something as dark as the footage** (hero is a dusk hillside,
mostly RGB(30,48,66)). Previewing on mid-grey flatters dark crumbs and hides
the single most common failure — paper too dark to see.
