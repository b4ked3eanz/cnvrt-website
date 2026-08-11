/* dot matrix tool — does it load, sample, draw, and is the reference letter
   really the font rather than a fallback serif */
await document.fonts.load('700 80px "OffBit Trial"');
load('/_s/_testletter.png');
for (let i = 0; i < 40 && !src; i++) await new Promise(r => setTimeout(r, 100));
if (!src) return { ok: false, why: 'image never loaded' };

document.getElementById('cols').value = 13;
document.getElementById('cols').dispatchEvent(new Event('input'));
document.getElementById('fs').value = 400;
document.getElementById('fs').dispatchEvent(new Event('input'));
await new Promise(r => setTimeout(r, 150));

const o = document.getElementById('out'), c = o.getContext('2d');
const d = c.getImageData(0, 0, o.width, o.height).data;
let ink = 0, bg = 0;
for (let i = 0; i < d.length; i += 4) (d[i] > 120 ? ink++ : bg++);

/* the reference must be the real font: the fallback is proportional, OffBit is
   not — an 'A' at 120px must advance 0.595em = 71.4px */
const rc = document.getElementById('refc').getContext('2d');
rc.font = '700 400px "OffBit Trial", monospace';
const advA = rc.measureText('A').width;

return {
  ok: true,
  source: [iw, ih],
  grid: document.getElementById('grid').textContent,
  outSize: [o.width, o.height],
  inkPixels: ink, bgPixels: bg,
  inkFraction: +(ink / (ink + bg)).toFixed(3),
  refAdvance: +advA.toFixed(2),
  refAdvanceOverEm: +(advA / 400).toFixed(4),
  advanceInDots: +(advA / 400 / 0.054).toFixed(2), fontIsWholeDots: Math.abs((advA / 400 / 0.054) - Math.round(advA / 400 / 0.054)) < 0.08,
  fontCheck: document.fonts.check('700 120px "OffBit Trial"')
};
