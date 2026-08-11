/* Verify this round of top-nav fixes. */
window.scrollTo(0, Math.round(document.documentElement.scrollHeight * 0.42));
await new Promise(r => setTimeout(r, 1500));

const nav   = document.getElementById('tnav');
const hit   = document.getElementById('tnavHit');
const comet = document.getElementById('tnavComet');
const word  = document.querySelector('.tnav__word');
const wordI = word.querySelector('i');
const drift = [...document.querySelectorAll('.tnav__drift')];
const bars  = document.querySelector('.menu__bars');

const shutBox = hit.getBoundingClientRect();

hit.dispatchEvent(new PointerEvent('pointerenter'));
await new Promise(r => setTimeout(r, 2600));

const openBox = hit.getBoundingClientRect();

/* is the CONTACT button inside the active area? that was the bug */
const cr = document.getElementById('tnavContact').getBoundingClientRect();
const contactInside = cr.left >= openBox.left && cr.right <= openBox.right &&
                      cr.top >= openBox.top && cr.bottom <= openBox.bottom;

/* wordmark: is the glyph run taller than its clip? */
const wr = word.getBoundingClientRect(), ir = wordI.getBoundingClientRect();
const wordCropped = ir.top < wr.top - 0.5 || ir.bottom > wr.bottom + 0.5;

/* drift: sample the same group twice, a beat apart */
const d0 = drift.map(g => getComputedStyle(g).translate);
await new Promise(r => setTimeout(r, 1300));
const d1 = drift.map(g => getComputedStyle(g).translate);

return JSON.stringify({
  boxShut: [Math.round(shutBox.left), Math.round(shutBox.top), Math.round(shutBox.width), Math.round(shutBox.height)],
  boxOpen: [Math.round(openBox.left), Math.round(openBox.top), Math.round(openBox.width), Math.round(openBox.height)],
  contactInside,
  cometOpacityWhenOpen: +(+comet.style.opacity).toFixed(3),
  wordClip: { w: Math.round(wr.width), h: Math.round(wr.height) },
  wordInk:  { h: Math.round(ir.height) },
  wordCropped,
  driftT0: d0, driftT1: d1,
  driftMoving: d0.some((v, i) => v !== d1[i]),
  barsOrigin: getComputedStyle(bars).transformOrigin
});
