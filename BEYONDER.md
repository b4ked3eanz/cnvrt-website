# BEYONDER — handoff

Read this before touching `tools/beyonder.html` or the two routes it added to
`tools/serve.js`.

**Status:** working, unfinished. Untracked, like the rest of this run.

```
node tools/serve.js
http://127.0.0.1:8743/_s/beyonder.html
```

---

## What it is

See a page as a monitor you don't own would render it, from the laptop.

An `<iframe>` is sized to the target's **CSS viewport** and CSS-scaled to fit
the pane. Everything inside is genuinely laid out at that size — `100vw`,
`100vh`, media queries and `documentElement.clientWidth`, which is the number
`index.html`'s `--u` sync reads. Nothing is faked or re-drawn, and the caption
reads `--u` back *out* of the frame rather than trusting the arithmetic.

The one thing it cannot do is simulate `devicePixelRatio` — that belongs to the
real monitor and can't be overridden from script. It changes canvas sharpness
and not one layout number.

---

## The distinction the whole tool exists to enforce

**A "4K monitor" is not a 3840 viewport.** A 3840×2160 panel at Windows 150%
hands the page **2560×1440** — the same number a cheap 1440p monitor gives it.
The only difference is that every pixel is physically bigger.

That is why *Custom Resolution* and *OS Scaling* are two separate controls, and
why the presets now default to **100%**. They shipped at 150% for one round and
the tool was accused of not working: picking "4K" gave 2560, the shrink looked
half as strong as expected, and the label said 3840. Don't collapse them again.

---

## Why most of this site does not move, and why that is correct

The site is `--u = 100vw / 1920`. Every box is a fixed *fraction* of the
viewport, so at a **fixed aspect ratio** a bigger screen is the identical
picture, larger. Measured:

| | 1920×1080 | 2560×1440 | 3840×2160 |
|---|---|---|---|
| hero headline | 36.46% | 36.46% | 36.46% |
| top nav | 10.73% | 10.73% | 10.73% |
| HUD zone | 34.90% | 34.90% | 34.90% |

Not "looks similar" — the same number to two decimals. **No preview can show a
difference that does not exist.** An earlier build had a fit-to-pane view; it
was dropped precisely because fitting a proportional design to a box reproduces
your own screen by construction. Two rounds were spent arguing with that fact.

What *does* move is anything **capped or absolute**:

| | 1920 | 2560 | 3840 |
|---|---|---|---|
| footer 1400 column | 72.9% | 54.7% | 36.5% |
| hero type block (since the 584:9611 pass) | absolute 1508.1px, re-centred | | |

Two ways to make change visible: pick an **ultrawide** (different aspect, so
`100vh` things move too — the hero headline goes 11.94% → 16.05% of height), or
jump to **contact** and flip the toggle.

### "What actually moves"

Because you cannot eyeball whether a proportional layout changed, the tool
loads the page a **second time offscreen** (`#ghost`) at the other viewport,
measures every tracked element's width as a percentage of its own viewport, and
diffs. Equal percentage = provably identical rendering. The caption reports
`N of M elements differ`. The ghost loads only after the visible frame, so they
don't fight for bandwidth and a WebGL context.

---

## It will load anything — the two server routes

Added to `tools/serve.js`. Both are deliberately unrestricted; the listener
binds `127.0.0.1`. **Do not rebind it to `0.0.0.0`** without thinking about what
an open proxy on your LAN means.

| you type | route | why it needs one |
|---|---|---|
| `/index.html` | direct | — |
| `localhost:3000` | direct | dev servers don't set `X-Frame-Options`, and proxying would break live-reload and websockets |
| `stripe.com` | `/_proxy?url=` | real sites answer with `X-Frame-Options: deny` or a `frame-ancestors` CSP — literally "you may not iframe me". The server fetches the document, drops those headers and injects a `<base>` so subresources still load from the real origin. Verified against github.com, which sends `deny`. |
| `D:\work\page.html` | `/_local/<abs path>` | a page on `http://` may not frame a `file://` URL **at all**. The path sits in the URL *path*, not a query string, so relative assets inside resolve on their own with no rewriting. |

Only the top-level document is proxied; everything it references keeps loading
from the real origin. Proxied pages carry no cookies, so anything behind a login
looks logged-out — run those from their own localhost instead.

---

## The UI — Figma 585:9612 / 587:9647

One floating toolbar, 1541×44, and nothing else:
`Select Preset · Custom Resolution · OS Scaling · Resized/Your Screen · Section`.

Spacing is perfectly regular once measured: **16px** padding, **80px** between
groups, **12px** label→control. All type is **MD Thermochrome Medium 16/19.2,
ls 0.96** — the project's own face, pulled from `/assets/fonts/fonts.css`.

### What the `ffsbruh` pass caught, after it "looked right"

1. **The chevron is not a triangle.** Figma's path is
   `M6 6H4V4H6V6ZM4 4H2V2H4V4Z…` — a **stepped pixel-art glyph of five 2×2
   blocks**. It was hand-drawn as a smooth triangle first. At 10×6 the render
   gives no hint whatsoever.
2. **cornerSmoothing was wrong in both directions.** Only five elements are
   squircles; every dropdown and input is `smoothing 0.0`, where plain
   `border-radius` is *correct*.

   | | radius | smoothing |
   |---|---|---|
   | bar | 10 | **1.0** |
   | toggle shell | 6 | **1.0** |
   | pills | 4 | **1.0** |
   | dropdowns, inputs | 6 | 0.0 |

3. **Every 1px stroke is a gradient, and the inputs' runs backwards.**
   Dropdowns: white `.12` → `#999 .04`. Numeric inputs: `#999 .04` → white
   `.08` — dark-to-light, the opposite. Not a typo; check before "fixing" it.

### The squircle

**Figma's SVG exporter collapses `cornerSmoothing` to a bare `rx`**, so the
corner geometry cannot be read back out of an export — it has to be
reconstructed. `SQ` in `beyonder.html` is Figma's own seven control points for a
90° corner at r=10 smoothing 1.0, lifted from this project's side-nav plate
(`PANEL_OFF` in `index.html`) and normalised to r=1. A squircle corner is
self-similar, so the same table scales to any radius.

The corner leaves the edge at **2r**, not r, with a **0.293r** shoulder. That
long tangent is exactly what `border-radius` cannot express.

**`clip-path` clips `box-shadow` away.** Both shadow stacks therefore had to
become `filter: drop-shadow(...)`, which follows the clipped silhouette — the
bar's four-shadow stack on `.barwrap`, and the active pill's orange glow on the
button. (Figma lists five; the fifth is 0-alpha.)

---

## Traps this cost real time on — do not re-learn

- **A 404 took the whole server down.** Extracting `sendFile()` out of the
  request handler left the request path out of scope in the 404 branch, and a
  `ReferenceError` inside an `fs` callback is an unhandled throw. The site
  requests `/favicon.ico` on every load, so the server died on essentially
  every page view. It presented as "the tool keeps going blank".
- **Background tasks get killed at the turn boundary.** Running the server via
  the agent's background shell means it dies as soon as the turn ends. Launch it
  detached (`Start-Process node tools\serve.js -WindowStyle Hidden`) or from
  your own terminal.
- **The caption must have a fixed height.** `draw()` measures the stage to fit
  the frame and runs *before* the caption has text, so a caption that sizes to
  its content is zero-tall at that moment and the screen overlaps the line it
  just pushed down.
- **Side-by-side layout: SUM across the width, MAX down the height.** Taking
  `max` for both overflowed the pane the moment there was more than one monitor.
- **3840×2160 is too heavy for `tools/shot.js` on the hero.** The video plus the
  shader at that size makes headless Chrome return nothing. The footer is fine
  at 3840; for the hero, measure at 2560 or 3440 and extrapolate — the centring
  is linear, so `(vw − 1920)/2 + 206` predicts the 3840 case exactly.

---

## Still open

- **The site's chrome is still relative.** The logo, `DECK`/`CONTACT` and the
  hamburger scale with `--u`, which is why they look oversized in a 4K preview.
  Figma 584:9611 puts `DECK`/`CONTACT` *inside* the centred content block and
  pins only the orange triangle to the corner at a fixed 20px. It is
  `position:fixed` and shared by every section, so capping it is a change to
  shipped behaviour across the whole site — not taken unasked.
- **Five sections still scale relatively** — sec2, offerings, work, pricing,
  FAQ. The mechanism is proven (`.hero__type`, see the README's hero section);
  it is one wrapper each.
- **The corner was never proved pixel-perfect.** Profiling the built corner
  against Figma's render was inconclusive: at the near-tangent top row it is
  dominated by rasteriser antialiasing, and a luma threshold cannot cleanly
  separate a squircle from an arc there. What *is* established is that
  `clip-path` genuinely applies (proved with a brute-force half-clip that moved
  the edge to exactly the requested pixel) and that the path carries Figma's own
  numbers. A proper check wants a 2× device-scale render diffed against the 2×
  Figma export.
- **The dropdowns are native `<select>`.** The design shows a custom panel
  (224×125, r8 squircle, `BACKGROUND_BLUR 14` → `backdrop-filter: blur(7px)`)
  which is not built. Closed state matches; the open list is OS-native.
- **No keyboard handling** beyond what native controls give.

---

## Test scripts

All driven through `tools/shot.js`:

```
node tools/shot.js http://127.0.0.1:8743/_s/beyonder.html out.png tools/ev-ui.js 12000 1920 1080
```

| script | what it asserts |
|---|---|
| `ev-ui.js` | toolbar geometry against the Figma numbers, and that the real font loaded |
| `ev-fid.js` | squircle clip-paths, the drop-shadow stacks, the chevron path, the gradient strokes |
| `ev-clipdiag.js` | whether `clip-path` applies at all — brute-force half-clip |
| `ev-frac.js` | every tracked element as a % of viewport; the file that settled the "it looks the same" argument |
| `ev-hero.js` | the hero type block is 1508.1 wide and re-centres, and the background grows |
