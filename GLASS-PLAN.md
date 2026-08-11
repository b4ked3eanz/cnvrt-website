# GLASS RING — the rebuild plan

Written after three passes of building it wrong in instructive ways, then
worked through. `GLASS.md` is the record of what is in the file today and why;
this is what to do next and in what order.

**Status, 2026-08-08.** Everything in §3, §5.2, §5.3, §5.5 and §6 below is
done, and §7's order was followed except where measuring changed it. The four
bugs that were actually in the way are written up in GLASS.md under STATE OF
PLAY — read that first, because three of the four were invisible to every check
in the repo and one of them was being tuned around rather than found. What is
left is §5.6 and the two things that depend on it.

All three research passes are banked in `docs/glass-research/`. Their findings
are folded into §3, §5 and §9.

---

## 0. What "done" means

Five things, and nothing ships as done until all five hold on real hardware.
Where each stands:

1. **You cannot read the copy through it.** ✅ Under the ring wall and the gear
   the headline is bent and then eaten. Absorption is doing this, which is the
   physically right way round — face-on reflectance for real glass is 4% and
   nothing legitimate raises that, so thick glass hides what is behind it by
   EATING the light, not by shining.
2. **It reads as a solid with weight.** ✅ Bright rim where the light catches,
   dark body where it does not, TIR streaks near the edge. The synthetic
   environment is most of this.
3. **Butter smooth.** ❓ **Not established, and not for want of trying.** See
   §5.6 — the automated harness cannot measure frame rate. This is the one
   open item and everything else in §5 was done on the grounds that it is
   strictly less work rather than because it was measured to help.
4. **It costs nothing when it is not on screen.** ✅ IntersectionObserver +
   `document.hidden` take the `backdrop-filter` to `none` and release the
   buffers after 30s. Verified by reading the declaration back.
5. **The controls are few and each one does something you can see.** ✅ 47 → 36,
   with one deliberate deviation recorded in §6.

---

## 1. What is left

**§5.6, by hand.** Open the page in a normal foreground window, DevTools
Performance, scroll the offerings section, and look at:

- **frames** — any bar over 16.7ms and where the time went
- **Rendering → Paint flashing** — the refract layer should repaint, nothing
  else in the section should
- **Layers** — layer count should not grow with scroll
- the same trace with `backdrop-filter: none` forced, as the control

That comparison is the whole measurement: it isolates the filter's cost from
everything else on the page. `tools/perf.js --trace` will give you what the
renderer spends where, which is the useful half of what it can do.

Then, and only then:

- **`MAPRES` 512 → 384** if the trace says the map sampling matters. 44% fewer
  pixels for a low-frequency field over a 700px box; §5.4 says it is very
  likely indistinguishable, and "very likely" is not a measurement.
- **`RPAD`**, currently 60. It sets both the filtered area and the maximum bend
  (see §2). If the filter turns out cheap, raise it and the bevel can throw the
  copy further; if it turns out expensive, drop it and the mark bends less.

---

## 2. The one trade-off worth understanding before touching anything

The displacement field is **singular at the outline**. The lateral walk is
`thickness × tan(θt)`, and θt goes to the critical angle as the surface turns
edge-on — the shader's own `max(-T.z, 0.05)` guard is all that stops it running
away. So a ceiling is not optional, and where that ceiling sits is not a taste
value: it is how far a sample may be fetched from and still land inside the
filter region. Past that the backdrop reads as transparent black and you get
the classic dark smear round the edge of a glass div.

So `RPAD` decides three things at once and they cannot be separated:

    RPAD  ─┬─  the filtered area          (60 → 560², was 130 → 700²)
           ├─  the maximum displacement   (LIMIT = RPAD − 6)
           └─  how hard the bevel bends before it saturates

The saturation itself is soft — linear to a knee then easing onto an asymptote,
C1 continuous — because the hard clamp that was there before produced flat
plateaus with a visible edge across the bevel. Measured: 13.4% of covered
pixels at an endpoint before, 0.43% after.

---

## 3. The architecture, settled

Three sibling layers, all in the panel, all carrying the same transform. They
are siblings and not a wrapper for a reason that has already cost one rebuild:
a wrapper needs a transform, a transform makes a stacking context, and that is
where `mix-blend-mode` stops finding a backdrop.

| layer | what it is | composite |
|---|---|---|
| `--refract` | `backdrop-filter` + the SVG chain. Bends the live DOM, and absorbs it. | normal, masked to alpha |
| `--film`    | the edge/mirror, masked to the fresnel in the mask's luminance | normal |
| `--cv`      | lit glass: environment reflection, rim, TIR, glow | screen |

**There is no absorption layer any more.** It was one, twice, and both shapes
were wrong for the same reason: Beer-Lambert is a multiplication and neither
operator a DOM layer can reach here is one. `multiply` has no backdrop inside
the panel's stacking context and returns its own source; `source-over` paints
`src·a + backdrop·(1−a)`, so the layer's own colour goes in — and it was a mid
grey on a page whose ground is 20, which is why turning absorption up made the
mark lighter. It is `feImage` + `feComposite operator="arithmetic" k1="1"`
inside the filter now, which multiplies the live backdrop the `backdrop-filter`
is already holding.

The chain is **assembled**, not just retuned — three displacement passes when
`chroma` is non-zero and one when it is not, the absorb composite only when
`absorb` is non-zero. Three baked PNGs drive it, all produced in one `encode()`:

- **map** — screen-space refraction offset in R/G around 128
- **mask** — alpha = coverage, luminance = fresnel
- **abs** — per-channel transmittance, white outside the mark (multiply's
  identity, not source-over's)

---

## 4. Rotation

**One axis picker + a start angle, an end angle and an ease**, interpolated by
where the mark sits on screen (bottom edge → top edge). `rotEase` landed in
this pass; both endpoints are fixed by construction so easing cannot move where
the turn starts or finishes.

The cost asymmetry drives the default:

- **Z is free.** Rigid in screen space — one CSS rotate turns the map, the mask
  and the lit bitmap together and nothing is re-encoded.
- **X and Y are not.** They change the silhouette and every normal, so the map,
  the mask and the absorption are all different images at every angle. Handled
  by quantising to 3° and caching, one encode per step, paid once.

---

## 5. What did NOT survive contact with measurement

Worth keeping, because the plan was confidently wrong about it and the reason
generalises.

§5.1 said: *"With rotation at 0, nothing re-renders per frame. So there is
exactly one thing to optimise, and it is the filter chain."* The first half is
still true. The second half was an inference, and §7.3 was right to say measure
before optimising — but the measurement then failed in a way worth recording:

Every configuration `tools/perf.js` timed came back at a median of 62.5ms and
would not move. Not scrolling: 62.5. Ring removed from the DOM: 62.5. Every
canvas on the page hidden, 1.9 megapixels of it: 62.5, ±8ms. A number that does
not move when you remove that much compositing is not a number about
compositing.

`--trace` said why. Across 35 seconds the renderer spends 11–13 seconds inside
`DXGISwapChainImageBacking::Present`, identically in all three configurations.
That is the swap chain waiting to be presented, not work — a window driven from
a script is not necessarily presented at the display's rate, and 62.5ms is nine
intervals of a 144Hz panel.

**The rule that comes out of it:** frame interval is only a measurement if you
know the frames are being presented. Work duration always is. `--trace` reads
durations; use that, or use a human with DevTools.

---

## 6. The control set

**36 sliders in seven groups.** SHAPE · GLASS · EDGE · LIGHT · PLACEMENT ·
MOTION · COMPOSITION. Full accounting of what was cut and why is in GLASS.md
under Panel.

**One deliberate deviation.** §6 originally said to derive `glow threshold`
from the specular level and drop the slider. The honest derivation is "brighter
than the horizon band can make the material", which with the environment as
tuned is 0.95 — high enough that nothing would ever bloom. It is a real
threshold now rather than a contrast trick, it does a visible thing, and
removing a control that works in order to hit a count is the wrong trade. It
kept its slider.

Keep the **copy values** button. It is how tuning gets handed back.

---

## 7. Rules earned the hard way

- **Read the console before tuning anything.** A shader that does not compile
  is a material that draws nothing, and it looks exactly like a slider set too
  low. Two passes were spent on five intensities that were never going to do
  anything.
- **A check that takes a union hides what is missing from one member.** The
  uniform check compared every shader's declarations TOGETHER against the
  uniforms object, so a uniform missing from one shader passed.
- **Work out what the operator does before trying more values of the input.**
  Absorption "washed grey at every value" for two passes; source-over paints
  the layer's own colour, the colour was mid grey, and no value of `absorb`
  could ever have been right.
- **A measurement that feeds back into its own bound cannot fail loudly.** The
  encode ceiling clipped, which pinned the peak at 1.0, which set the ceiling
  back to the same number. Check that a measured maximum is not simply the
  clamp.
- **Frame interval is not frame cost** unless the frames are being presented.
- **`getBoundingClientRect` on a transformed element returns the rotated
  bounding box.** It cost a whole session as a "weird diagonal frame". Filter
  and layout maths want `offsetWidth`.
- **Saved panel values beat new defaults.** Editing `DEFAULTS` changes nothing
  in a browser that has had the panel open. Bump the `localStorage` key — it is
  `cnvrt.offglass.v3` now.
- **`setClearColor(0x808080)` does not give you 128.** Colour management reads
  the hex as sRGB. Build data colours in linear space.
- **Blending needs a backdrop.** Inside the panel's stacking context there is
  none. `screen` gets away with it, `multiply` does not.
- **A `backdrop-filter`'s output is not part of its group's blend backdrop.**
- **Verify by measuring, not by looking.** Every real bug this feature has had
  was found by dumping a PNG, reading a pixel back, or reading the console —
  and every one of them was invisible in the composite.

---

## 8. What the research passes changed, and what is left of them

Full text in `docs/glass-research/`.

- **§9.1 — absorption should be driven by ray length, not fragment thickness.**
  Landed: `pathL / −T.z`. It was the smaller half of the absorption bug; the
  larger half was the operator and the tint-gradient coefficient.
- **§9.2 — dispersion is a ramp and the 2.017× asymmetry is the right shape.**
  Unchanged. drei's runtime default for `chromaticAberration` is 0.05; this
  ships 0.055.
- **§9.3 — jitter is dithering, not accuracy.** NOT DONE and still worth
  having: about one sample step of stochastic jitter converts a few large
  coherent artefacts into per-pixel noise, which reads as frost rather than as
  banding. junni over-dithers by ~3.7 steps, which is why that demo carries
  visible grain. This is the natural home for `frost` if it comes back, and it
  belongs in the SVG chain rather than as a CSS `blur()` on top.
- **§9.4 — the slab formula is right.** Left alone.
- **§9.5 — no mip chain, so stochastic jitter is the legitimate route to
  frost.** Still true; see §9.3.
