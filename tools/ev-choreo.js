/* Sample the top nav's expansion choreography frame by frame, so the
   ORDER of events is checkable rather than eyeballed. */
window.scrollTo(0, Math.round(document.documentElement.scrollHeight * 0.42));
await new Promise(r => setTimeout(r, 1500));

const plate = document.getElementById('tnavPlate');
const logo  = document.getElementById('tnavLogo');
const word  = document.querySelector('.tnav__word');
const items = [...document.querySelectorAll('.tnav__c')];
const grows = [...document.querySelectorAll('.tnav__grow')];
const hit   = document.getElementById('tnavHit');

const hitAt = () => {
  const r = hit.getBoundingClientRect();
  return Math.round(r.width) + 'x' + Math.round(r.height);
};
const shot = () => ({
  plateW: Math.round(plate.getBBox().width),
  logoX: Math.round(logo.getBoundingClientRect().left),
  wordW: Math.round(word.getBoundingClientRect().width),
  items: items.map(e => +(+e.style.opacity || 0).toFixed(2)),
  growY: grows.map(g => +( /scaleY\(([\d.]+)\)/.exec(g.style.transform || '') || [0, 0] )[1]),
  hit: hitAt()
});

const before = shot();
hit.dispatchEvent(new PointerEvent('pointerenter', { bubbles: false }));

const tl = [];
for (let i = 0; i < 12; i++) {
  await new Promise(r => setTimeout(r, 60));
  tl.push({ ms: (i + 1) * 60, ...shot() });
}
await new Promise(r => setTimeout(r, 2200));
const settled = shot();

/* now leave, and confirm it reverses and the box returns to the badge */
dispatchEvent(new PointerEvent('pointermove', {clientX: 40, clientY: 700, bubbles: true}));
await new Promise(r => setTimeout(r, 1600));
const closed = shot();

window.__clip = { x: 535, y: window.scrollY + 8, w: 860, h: 112 };
return JSON.stringify({ before, tl, settled, closed });
