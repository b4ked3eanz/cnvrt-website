"""Bake the settled work piece — panel, both glow plates, the orange screen, the
mark, the LED grid and the piece-glow vectors — flat onto the section's own
#141414, at the size and offsets the live DOM uses.

Everything here mirrors one CSS rule each; the constants are Figma's, in the
TV's own 1044 x 733.7762 design space. Blend maths, over an OPAQUE canvas:

    normal        C = s*a + d*(1-a)
    screen (o)    C = d + a*o * s * (1-d)        <- mix-blend-mode:screen
    plus-lighter  C = d + a*o * s                <- LINEAR_DODGE, clamped
"""
import sys, os
import numpy as np, cv2
from PIL import Image

TMP  = sys.argv[1]
OUT  = sys.argv[2]
# 1.0, not 1.5. The still is only ever seen magnified — the swap to the live
# piece happens at scale 1.0000 — so a bake wider than the box at 1x buys nothing
# and costs decoded bitmap. Four 3273x2564 images was ~134MB of texture being
# rastered at up to 6.85x, which Chrome thrashes: the piece visibly refreshes as
# tiles are dropped and redrawn.
K    = float(sys.argv[3]) if len(sys.argv) > 3 else 1.0      # px per design px

# ---- geometry, TV-local design px -------------------------------------------
TVW, TVH   = 1044.0, 733.7762
SX, SY     = 26.3286, 32.0527                    # screen box origin
SW, SH     = 991.3417, 518.5657                  # screen box size
SR         = 2.2895                              # screen radius
SIG_FAR    = 148.8158
SIG_NEAR   = 11.4474
# 2.5 sigma, not 4. At 2.5 the far glow is at 0.006 of peak — invisible over the
# ground — and the box is 41% smaller in area. That matters more than it sounds:
# this element is masked, so Chrome renders the whole thing into a surface before
# compositing, at whatever scale the piece is currently drawn. At 6.85x, 4 sigma
# was a 12,800 x 10,000 surface.
PAD        = 2.5 * SIG_FAR
BX0, BY0   = SX - PAD, SY - PAD                  # still box origin in TV coords
BW, BH     = SW + 2*PAD, SH + 2*PAD

GROUND     = (0x14, 0x14, 0x14)
GLOW_COL   = (0xFF, 0x4E, 0x0C)                  # --slide of the logo card, what show() writes
SCR_TOP    = (0xFF, 0x54, 0x09)
SCR_BOT    = (0xFF, 0x39, 0x07)

MARK_W, MARK_H = 118.0, 92.0
MARK_CX, MARK_CY = SX + 494.6714, SY + 258.6445  # mark centre, TV coords
PIECE_X, PIECE_Y = SX + 808.7566, SY + 526.5781  # Frame 2085667672 origin
PIECE_W, PIECE_H = 29.7632, 28.6184

W, H = int(round(BW*K)), int(round(BH*K))
print(f"still box {BW:.3f} x {BH:.3f} design px  ->  {W} x {H} at {K}x")

def d2p(x, y):                                    # TV design -> still pixel
    return (x - BX0) * K, (y - BY0) * K

def load(path, w_design, h_design):
    im = Image.open(path).convert('RGBA')
    tw, th = int(round(w_design*K)), int(round(h_design*K))
    im = im.resize((tw, th), Image.LANCZOS)
    a  = np.asarray(im, np.float32) / 255.0
    return a[..., :3], a[..., 3]

def paste(dst, src_rgb, src_a, x, y, mode='normal', op=1.0):
    """composite src (already in still-pixel scale) at (x,y) in still pixels"""
    h, w = src_a.shape
    x0, y0 = int(round(x)), int(round(y))
    sx0, sy0 = max(0, -x0), max(0, -y0)
    dx0, dy0 = max(0, x0), max(0, y0)
    ww = min(w - sx0, dst.shape[1] - dx0)
    hh = min(h - sy0, dst.shape[0] - dy0)
    if ww <= 0 or hh <= 0: return
    s = src_rgb[sy0:sy0+hh, sx0:sx0+ww]
    a = (src_a[sy0:sy0+hh, sx0:sx0+ww] * op)[..., None]
    d = dst[dy0:dy0+hh, dx0:dx0+ww]
    if   mode == 'normal': d[:] = s*a + d*(1-a)
    elif mode == 'screen': d[:] = d + a*s*(1-d)
    elif mode == 'plus':   d[:] = np.clip(d + a*s, 0, 1)
    else: raise ValueError(mode)

def blurred_rect(sigma):
    """alpha of the screen box blurred by sigma, in still-pixel space"""
    a = np.zeros((H, W), np.float32)
    px0, py0 = d2p(SX, SY); px1, py1 = d2p(SX+SW, SY+SH)
    a[int(round(py0)):int(round(py1)), int(round(px0)):int(round(px1))] = 1.0
    return cv2.GaussianBlur(a, (0, 0), sigmaX=sigma*K, sigmaY=sigma*K,
                            borderType=cv2.BORDER_CONSTANT)

def rounded_rect_alpha(w, h, r):
    """anti-aliased rounded-rect alpha, supersampled 4x"""
    S = 4
    m = np.zeros((h*S, w*S), np.uint8)
    cv2.rectangle(m, (0, 0), (w*S-1, h*S-1), 255, -1)
    rr = int(round(r*S))
    if rr > 0:
        cv2.rectangle(m, (0, 0), (rr, rr), 0, -1)
        cv2.circle(m, (rr, rr), rr, 255, -1)
        cv2.rectangle(m, (w*S-rr-1, 0), (w*S-1, rr), 0, -1)
        cv2.circle(m, (w*S-rr-1, rr), rr, 255, -1)
        cv2.rectangle(m, (0, h*S-rr-1), (rr, h*S-1), 0, -1)
        cv2.circle(m, (rr, h*S-rr-1), rr, 255, -1)
        cv2.rectangle(m, (w*S-rr-1, h*S-rr-1), (w*S-1, h*S-1), 0, -1)
        cv2.circle(m, (w*S-rr-1, h*S-rr-1), rr, 255, -1)
    return cv2.resize(m.astype(np.float32)/255.0, (w, h), interpolation=cv2.INTER_AREA)

# ---- 0. the section ground ---------------------------------------------------
canvas = np.ones((H, W, 3), np.float32) * (np.array(GROUND, np.float32)/255.0)
# ---- 1. .work__tvimg ---------------------------------------------------------
rgb, a = load('assets/img/work-panel.png', TVW, TVH)
px, py = d2p(0, 0)
paste(canvas, rgb, a, px, py, 'normal')

# ---- 2/3. the two glow plates ------------------------------------------------
gcol = np.array(GLOW_COL, np.float32)/255.0
for sigma, op in ((SIG_FAR, 0.4), (SIG_NEAR, 1.0)):
    al = blurred_rect(sigma)
    canvas += (al*op)[..., None] * gcol * (1.0 - canvas)     # screen, full frame

# ---- 4. .work__screen: the orange gradient, then the mark --------------------
sw, sh = int(round(SW*K)), int(round(SH*K))
ramp = np.linspace(0, 1, sh, dtype=np.float32)[:, None, None]
top  = np.array(SCR_TOP, np.float32)/255.0
bot  = np.array(SCR_BOT, np.float32)/255.0
scr  = top*(1-ramp) + bot*ramp
scr  = np.broadcast_to(scr, (sh, sw, 3)).copy()
sa   = rounded_rect_alpha(sw, sh, SR*K)
px, py = d2p(SX, SY)
paste(canvas, scr, sa, px, py, 'normal')

mrgb, ma = load(os.path.join(TMP, 'mark4.png'), MARK_W, MARK_H)
px, py = d2p(MARK_CX - MARK_W/2, MARK_CY - MARK_H/2)
paste(canvas, mrgb, ma, px, py, 'normal')

# ---- 5. .work__grid — LINEAR_DODGE @ .7 --------------------------------------
grgb, ga = load('assets/img/work-grid.png', SW, SH)
px, py = d2p(SX, SY)
paste(canvas, grgb, ga, px, py, 'plus', 0.7)

# ---- 6. .work__piece x2 — SCREEN, blur baked into the export -----------------
# Figma pads a blurred node's export by the bleed; recentre on the node's box.
pim = Image.open(os.path.join(TMP, 'piece4.png'))
bleed_x = (pim.size[0]/4.0 - PIECE_W) / 2.0
bleed_y = (pim.size[1]/4.0 - PIECE_H) / 2.0
prgb, pa = load(os.path.join(TMP, 'piece4.png'), pim.size[0]/4.0, pim.size[1]/4.0)
px, py = d2p(PIECE_X - bleed_x, PIECE_Y - bleed_y)
paste(canvas, prgb, pa, px, py, 'screen')
paste(canvas, prgb, pa, px, py, 'screen')

# ---- out ---------------------------------------------------------------------
out = np.clip(canvas*255.0 + 0.5, 0, 255).astype(np.uint8)
base, ext = os.path.splitext(OUT)

# Split into R and G+B. Drawn back over each other with plus-lighter at zero
# offset they sum to exactly the original, because the channels are disjoint —
# so the chromatic split costs two image draws and one additive blend, and NOT
# a single filter. Offsetting them in opposite directions is the aberration.
r  = out.copy(); r[..., 1] = 0; r[..., 2] = 0
gb = out.copy(); gb[..., 0] = 0
Image.fromarray(r,  'RGB').save(base + '-r'  + ext, 'WEBP', quality=88, method=6)
Image.fromarray(gb, 'RGB').save(base + '-c'  + ext, 'WEBP', quality=88, method=6)

# The defocus, cross-dissolved rather than filtered: a pre-blurred copy at
# reduced resolution, faded in over the sharp pair. sigma is in DESIGN px, so
# on screen it scales with the piece — 3 design px is ~18px at the 6.07x start
# and resolves as the piece approaches, which is what a defocus does anyway.
SOFT_SIGMA, SOFT_K = 5.2, 0.5       # design px
soft = cv2.GaussianBlur(out.astype(np.float32), (0, 0),
                        sigmaX=SOFT_SIGMA*K, sigmaY=SOFT_SIGMA*K,
                        borderType=cv2.BORDER_REPLICATE)
sw2, sh2 = int(round(W*SOFT_K)), int(round(H*SOFT_K))
soft = cv2.resize(soft, (sw2, sh2), interpolation=cv2.INTER_AREA)
Image.fromarray(np.clip(soft+0.5,0,255).astype(np.uint8), 'RGB').save(
    base + '-soft' + ext, 'WEBP', quality=88, method=6)

for suf in ('-r', '-c', '-soft'):
    print(f"  {os.path.basename(base+suf+ext):26s} {os.path.getsize(base+suf+ext):>8d} bytes")

print("\nCSS box, as % of the .work__tv wrapper:")
print(f"  left  {BX0/TVW*100:.5f}%")
print(f"  top   {BY0/TVH*100:.5f}%")
print(f"  width {BW/TVW*100:.5f}%")
print(f"  height{BH/TVH*100:.5f}%")
