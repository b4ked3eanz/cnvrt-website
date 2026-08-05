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
| Hero | — | 423:1499 |
| Offerings | `#offerings` | — |
| Work | `#work` | — |
| Pricing | `#pricing` | 434:3855 |
| Footer | `#contact` | 455:4255 (rest), 455:4426 (hover) |

### Pricing — iridescent wave grid

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

Vanishing point is the **stage centre**, not the canvas centre (`uCentre`). The
canvas is 100vh and the stage is `1080·--u`; on a non-16:9 window those are tens
of pixels apart and the stars converge *next to* the CTA instead of through it.

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

1. **Rest** — title, three bracket links, metadata, small centre HUD (455:4267).
2. **Zone hover** (455:4656, a 670×393 hit area — the red 10% rect in Figma is
   *not* artwork). Title lifts, links and metadata sink, all blurring, staggered.
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

## Assets

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

The `ffsbruh` skill (`figma_probe.py`) dumps ground-truth node properties —
corner smoothing, background blur, stacked shadows, blend modes. Codegen and
screenshots both lie about those. Use it before building any Figma node.

---

## Testing

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

---

## Deploy

GitHub Pages from `main` / root. `git push` is the deploy.

`.gitignore` excludes `hero-video/`, `hero-options/`, `hud.png`, `Frame*.png` —
~400MB of working material the site doesn't reference. What ships is 36MB,
mostly `assets/video/hero.mp4` (23MB) and `assets/img/work-grid.png` (4.8MB).

---

## Known constraints / next

- **three.js comes from `esm.sh`** — the one remote dependency, used by the
  pricing cards and the starfield (same CDN import RFL uses). Offline, the cards
  fall back to flat SVG and the footer stays black. The footer *lens* is raw
  WebGL specifically so the HUD never depends on a CDN. Vendoring three is a
  known open option.
- **No mobile / responsive pass.** Everything is a 1920-wide design scaled by
  `--u`; below ~1000px it will be unusable.
- `assets/img/pricing-bg.jpg` and `assets/svg/card-*-mask.svg` are still on disk
  but no longer referenced from markup (the masks are inlined as data URIs; the
  pricing photo plate was removed on request).
- The lens tuning panel was removed once values were settled. If you need to
  re-tune, the fastest route is to re-add sliders bound to the `st` object —
  every mapping already reads from it.
