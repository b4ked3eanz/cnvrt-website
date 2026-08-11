/* Expand the top nav somewhere the backdrop is flat, and clip to it. */
window.scrollTo(0, Math.round(document.documentElement.scrollHeight * 0.42));
await new Promise(r => setTimeout(r, 1600));

const hit = document.getElementById('tnavHit');
const p   = document.getElementById('tnavPlate');
const before = Math.round(p.getBBox().width);

hit.dispatchEvent(new PointerEvent('pointerenter', { bubbles: false }));
await new Promise(r => setTimeout(r, 2600));

const b = p.getBBox();
window.__clip = { x: 535, y: window.scrollY + 8, w: 860, h: 112 };

return JSON.stringify({
  before,
  after: { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) },
  logoX: Math.round(document.getElementById('tnavLogo').getBoundingClientRect().left),
  wordW: Math.round(document.querySelector('.tnav__word').getBoundingClientRect().width),
  grows: [...document.querySelectorAll('.tnav__grow')].map(g => g.style.transform),
  items: [...document.querySelectorAll('.tnav__c')].map(e => e.style.opacity).join(',')
});
