/* Park the turn-out mid-elongation and prove the growing edge is rounded.
   Sweeps scroll until the top card's inset is near 50%, reports the computed
   clip-path at several depths, and leaves window.__clip on that card's
   top-left corner in DOCUMENT space for a magnified crop. */
const sleep = ms => new Promise(r => setTimeout(r, ms));
const cards = [...document.querySelectorAll('.work__seed .price__card')];
if (!cards.length) return { error: 'no cards' };

const pct = () => {
  const cp = getComputedStyle(cards[0]).clipPath;
  const m = cp.match(/inset\(([\d.]+)%/);
  return { cp, v: m ? +m[1] : (cp === 'none' ? 0 : null) };
};

async function go(y) { scrollTo(0, y); dispatchEvent(new Event('resize')); await sleep(260); }

const max = document.body.scrollHeight - innerHeight;
// coarse sweep for the band where the cards are part-open
let lo = null, samples = [];
for (let y = 0; y <= max; y += Math.round(max / 260)) {
  await go(y);
  const p = pct();
  if (p.v !== null && p.v > 2 && p.v < 98) { lo = y; break; }
}
if (lo === null) return { error: 'never found a part-open frame', max };

// walk forward to ~50%
let best = lo, bestd = 1e9;
for (let y = lo; y < lo + innerHeight * 1.2; y += 12) {
  await go(y);
  const p = pct();
  if (p.v === null) continue;
  const d = Math.abs(p.v - 50);
  if (d < bestd) { bestd = d; best = y; }
  if (p.v < 2) break;
}

const out = { max, found: lo, parked: best, depths: [] };
for (const f of [0.85, 0.5, 0.15, 0.0]) {
  // f = target remaining inset fraction; just report what we see across a walk
}
// report clip strings at three points
for (const y of [lo + 40, best, best + 160]) {
  await go(y);
  out.depths.push({ y, top: getComputedStyle(cards[0]).clipPath.slice(0, 120), bottom: getComputedStyle(cards[1]).clipPath.slice(0, 120) });
}

await go(best);
const r = cards[0].getBoundingClientRect();
out.cardRect = { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
// crop the top-left corner of the top card, in document space
const pad = 30;
window.__clip = { x: Math.max(0, r.left + scrollX - pad), y: Math.max(0, r.top + scrollY - pad), w: 220, h: 140 };
out.clip = window.__clip;
out.finalTop = getComputedStyle(cards[0]).clipPath.slice(0, 120);
return out;
