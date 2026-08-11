# NAV + FAQ — handoff

Everything added in this pass. Read this before touching any of it; the full
per-component spec lives in `README.md` (search `### Top nav`, `### Side nav`,
`### FAQ`, `### Vertical menu`).

All of it is in `index.html`. No build step. Four independent modules, each a
plain IIFE at the bottom of the file, each hanging off `SY.sub`.

---

## What exists now

| thing | id | Figma | opens |
|---|---|---|---|
| top nav | `#tnav` | 564:6865 | hover, centre of the top edge |
| side nav | `#snav` | 564:6720 | click the top-left triangle (`#menuBtn`) |
| vertical menu | `#vnav` | 570:8331 | hover, top-right corner |
| FAQ | `#faq` | 564:7294 | between PRICING and the FOOTER |

New assets: `assets/svg/nav-gear.svg`, `nav-hud-l/r.svg`, `nav-close.svg`,
`ico-linkedin.svg`, `ico-x.svg`, `vert-standardcraft.svg`, `vert-rfl.svg`,
`faq-ask-plate.svg`, `faq-tab-a/b.svg`.

New test scripts in `tools/` — all driven through `tools/shot.js`:
`ev-nav-open/shut`, `ev-choreo`, `ev-nav-wick`, `ev-handover`, `ev-navperf`,
`ev-snav`, `ev-close`, `ev-vnav`, `ev-vbox`, `ev-vseen`, `ev-faq`, `ev-faqrev`,
`ev-askrev`, `ev-askbar`, `ev-footer`, `ev-fixes`, `ev-regress`.

```
node tools/shot.js http://127.0.0.1:8743/index.html out.png tools/ev-regress.js 5000 1920 1000
```

---

## The five rules this pass established

**1. Figma blur radii are HALVED for CSS.** Every single time. The hero's own
CONTACT does Figma 30 → `blur(15)` and 10 → `blur(5)` for an identical node.
Passing the raw number is what made the nav buttons' glow twice the size it
should be. Same for `LAYER_BLUR` on the vertical menu's mark (4/30 → 2/15).

**2. `cornerSmoothing: 1.0` is not a rounded corner.** Figma emits TWO cubics
per corner with a long tangent arm and a tight shoulder; a circular arc through
the same tangent points bulges ~2px further out, which is plainly visible at
these radii. The calibrated rule, verified against three separate nodes:

```
tangent arm = (1 + cornerSmoothing) * cornerRadius * tan(turn / 2)
```

Both the side-nav panel and the work-row union carry Figma's own control points
as offsets from their ideal vertex and stretch only the STRAIGHT runs. Max
deviation 0.0005px on the union at 202x68, 0.0001px on the panel at 584x1215.

**3. Hover is GEOMETRIC on every one of these, never enter/leave.** The links,
icons and buttons are SIBLINGS of the hit box, not children, so the instant the
pointer crosses onto one the box fires `pointerleave` and the thing shuts under
the cursor. Test the pointer against the state's own rect instead. Figma gives
the areas outright:

| | area |
|---|---|
| top nav collapsed (`570:8333`) | 70x44 at (925,14) |
| top nav expanded (`570:8334`) | 755x108 at (583,2) |
| vertical collapsed (`569:7926`) | 32x32 at (1868,20) |
| vertical expanded (`570:8303`) | 161x237 at (1759,0) |

A geometric test only runs on `pointermove`, so both also close on `document`'s
`pointerleave` and on `blur`, or they sit open once the cursor leaves the page.

**4. `visibility` is not animatable.** `.snav` had `visibility:hidden` on its
closed state, which flipped on the same frame the class changed — so every exit
transition underneath played correctly to an already-invisible element and the
close looked instant. Hold it: `transition: visibility 0s linear .62s`.

**5. `var` inside `frame()` shadows the module scope.** Bit twice this pass:
`var seg = tail / NSEG` shadowed the `seg()` phase helper, and `var B = ...`
shadowed the plate's `B` vertex array. Both hoist to the top of the function as
`undefined`. Locals in these render loops are named `segLen`, `HB` etc for that
reason — keep it that way.

---

## Easing

| token | value | for |
|---|---|---|
| `--nav-ease` | `cubic-bezier(0,.99,.01,.99)` | **the top nav's morph, and nothing else** |
| `--expo` | `cubic-bezier(.16,1,.3,1)` | everything that slides a real surface |
| `--ease` | `cubic-bezier(.22,.61,.36,1)` | opacity, colour, small stuff |

`--nav-ease` is near-vertical off the origin: ~99% of the travel happens in the
first few percent of the duration, then it settles. That is right for the bar and
wrong for anything large — on the side panel it turned a 440ms slide into a jump,
and on the scroll-driven footer exit it made the bar vanish within a few pixels
of the trigger. Both use `--expo` / a smoothstep instead.

---

## Top nav — the choreography

Not a transition. A linear clock `p`, with every phase cut out of it:

| p | what moves |
|---|---|
| 0.00 → 1.00 | the plate expands |
| 0.04 → 0.50 | the logo TRAVELS from the badge's centre to the bar's left |
| 0.28 → 0.80 | HUD brackets and tick groups grow out of their own centre line |
| 0.44 → 0.74 | the wordmark unfurls from behind the logo |
| 0.50 + 0.04·i | links, icons, DECK, CONTACT land left to right |

**Every phase must finish by p = 1** — the clock stops there, and a schedule that
overruns freezes those items part-drawn. That is what the first attempt did to
the last three items. Opening 660ms, closing 430ms.

There is ONE logo, not two. Figma draws a white glyph at the badge and a cream one
at the bar as unrelated nodes; the mark never disappearing is the brief.

Other things it owns: the scroll comet (twelve tapered strokes, BUTT caps — round
caps double-draw at every join and read as banding), a wick that flickers with
scroll speed and settles to an 11Hz idle tick, the four tick groups drifting
horizontally on four periods, and the whole bar riding up and out at the footer.

---

## Still open

- **None of this has been watched live at 60fps.** Same standing caveat as the
  rest of the project — the automation tab is `document.hidden`, which freezes
  rAF; everything here was verified through `tools/shot.js`, which disables
  background throttling. It wants eyes.
- **FAQ copy** — six of the seven answers are written by me. Only
  "Do we own the work?" carries Figma's real text.
- **Side nav work list** carries the design's six names; Figma's board pads to
  nine by repeating THESYS four times, which is filler. Swapping in the WORK
  section's own five is a one-line markup edit.
- **`.menu` was lifted to `z-index: 7`.** `.chrome` deliberately carries none, so
  its children painted *below* `.off` (z1), `.sec2` (z2) and `.work` (z2) — all
  of which fill the viewport with opaque `#141414`. The triangle was invisible
  and unclickable over most of the page, and it is the side nav's only trigger.
  This is a change to previously shipped behaviour; flagged, not hidden.
- **The FAQ heading's ink** sits ~5.3px right of the 960 centreline in Figma. It
  is centred properly here rather than reproducing that.
- **The vertical menu's hover box was reported as not reflecting** and I could
  not reproduce it. Measured at 1440 / 1680 / 2560 it converts to exactly
  `1868..1900, 20..52` collapsed and `1759..1920, 0..237` open, opens, stays open
  across the panel, and closes on exit; `elementFromPoint` on the mark returns
  `vnav__hit`. If it is still wrong, that is the first thing to re-check.
