/* Trace the LEFT EDGE of one dot and compare it against the two candidates.
   At a quarter of the side above centre, a circle has already pulled in by
   0.067*S; a rounded square with rad=0.35S has pulled in by 0.015*S. That is a
   7px vs 1.6px difference at this size — not a judgement call. */
await document.fonts.load('700 2000px "OffBit Trial"');
await document.fonts.ready;
const c = document.getElementById('c'), x = c.getContext('2d');
window.__draw(2000, 'i');
const W = c.width, H0 = c.height, img = x.getImageData(0, 0, W, H0).data;
const cov = (X, Y) => (X < 0 || Y < 0 || X >= W || Y >= H0) ? 0 : (img[(Y * W + X) * 4] - 20) / 235;

/* tittle bbox */
let bx = 1e9, by = 1e9, bX = -1, bY = -1;
for (let Y = 0; Y < H0; Y++) for (let X = 0; X < W; X++) {
  if (cov(X, Y) < 0.5) continue;
  if (Y > 400) continue;                     // tittle only, not the stem
  if (X < bx) bx = X; if (X > bX) bX = X; if (Y < by) by = Y; if (Y > bY) bY = Y;
}
const S = (bX - bx + 1) / 2;                 // one dot's side
const cy = by + S / 2;                       // centre of the TOP-LEFT dot

/* left edge x(y), as a subpixel crossing of coverage 0.5 */
const edge = [];
for (let k = -0.45; k <= 0.451; k += 0.05) {
  const Y = Math.round(cy + k * S);
  let X = bx - 4;
  while (X < bx + S && cov(X, Y) < 0.5) X++;
  /* refine: linear interpolation across the last step */
  const a = cov(X - 1, Y), b = cov(X, Y);
  const sub = b > a ? X - 1 + (0.5 - a) / (b - a) : X;
  edge.push([+k.toFixed(2), +((sub - bx) / S).toFixed(4)]);
}

/* predictions */
const circle = k => 0.5 - Math.sqrt(Math.max(0, 0.25 - k * k));
const rsq = (k, r) => {
  const flat = 0.5 - r;
  const d = Math.abs(k) - flat;
  return d <= 0 ? 0 : r - Math.sqrt(Math.max(0, r * r - d * d));
};
/* least-squares fit for r */
let bestR = null, bestE = 1e9;
for (let r = 0.20; r <= 0.5001; r += 0.002) {
  let e = 0;
  for (const [k, v] of edge) { const d = rsq(k, r) - v; e += d * d; }
  if (e < bestE) { bestE = e; bestR = r; }
}
let circErr = 0;
for (const [k, v] of edge) { const d = circle(k) - v; circErr += d * d; }

return {
  dotSideS: +S.toFixed(1),
  'edge x(y)/S, y in units of S from dot centre': edge,
  circlePredicts: edge.map(([k]) => +circle(k).toFixed(4)),
  bestFitRoundedSquare_rad_over_side: +bestR.toFixed(3),
  rmsRoundedSquare: +Math.sqrt(bestE / edge.length).toFixed(5),
  rmsCircle: +Math.sqrt(circErr / edge.length).toFixed(5),
  cornerRadiusPx: +(bestR * S).toFixed(1)
};
