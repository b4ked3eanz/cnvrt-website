/* Open the side nav, make a work row hot, verify the glow escapes the
   scroll clip and the progressive-blur band exists. */
window.scrollTo(0, Math.round(innerHeight * 3.4));
await new Promise(r => setTimeout(r, 1200));

document.getElementById('menuBtn').click();
await new Promise(r => setTimeout(r, 2200));

const snav  = document.getElementById('snav');
const panel = document.getElementById('snavPanel');
const items = [...snav.querySelectorAll('.snav__item')];
const list  = document.getElementById('snavList');
const glow  = document.getElementById('snavGlow');

items[1].dispatchEvent(new PointerEvent('pointerenter', { bubbles: false }));
await new Promise(r => setTimeout(r, 900));

const rect = panel.getBoundingClientRect();
window.__clip = { x: 0, y: window.scrollY, w: Math.ceil(rect.right + 40), h: Math.ceil(innerHeight) };

const lr = list.getBoundingClientRect();
const gr = glow.getBoundingClientRect();
const fade = snav.querySelector('.snav__fade');

return JSON.stringify({
  panel: { w: Math.round(rect.width), h: Math.round(rect.height) },
  rows: items.map(it => {
    const vb = it.querySelector('.snav__pillSvg').getAttribute('viewBox').split(' ');
    return it.querySelector('.snav__label').textContent + ' ' + (+vb[2]).toFixed(1) + 'x' + (+vb[3]).toFixed(1);
  }),
  /* the point: the glow must be OUTSIDE the list's own clip */
  glowOn: glow.getAttribute('data-on'),
  glowIsChildOfList: list.contains(glow),
  glowBox: { x: Math.round(gr.left), y: Math.round(gr.top), w: Math.round(gr.width), h: Math.round(gr.height) },
  glowBlurs: [...glow.querySelectorAll('.snav__glowSvg')].map(s => getComputedStyle(s).filter),
  listClips: getComputedStyle(list).overflowY,
  fadeLayers: fade ? fade.childElementCount : 0,
  fadeBlurs: fade ? [...fade.children].map(i => getComputedStyle(i).backdropFilter) : [],
  idxRight: getComputedStyle(items[1].querySelector('.snav__idx')).right
});
