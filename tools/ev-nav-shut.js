/* Leave the top nav COLLAPSED and clip tight on the badge. */
window.scrollTo(0, Math.round(innerHeight * 2.80));
await new Promise(r => setTimeout(r, 1800));

const nav = document.getElementById('tnav');
const p   = document.getElementById('tnavPlate');
const b   = p.getBBox();
window.__clip = { x: 905, y: window.scrollY + 8, w: 110, h: 56 };

return JSON.stringify({
  bbox: { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) },
  len: p.getTotalLength().toFixed(1),
  navOp: nav.style.opacity,
  gear: document.getElementById('tnavGear').style.opacity,
  comet: document.getElementById('tnavComet').style.opacity,
  wickC: [...document.querySelectorAll('.tnav__wick')].map(c => c.getAttribute('cx') + ',' + c.getAttribute('cy')).join(' | '),
  dash0: document.querySelector('.tnav__trail').getAttribute('stroke-dasharray'),
  off0: document.querySelector('.tnav__trail').getAttribute('stroke-dashoffset'),
  u: getComputedStyle(document.documentElement).getPropertyValue('--u')
});
