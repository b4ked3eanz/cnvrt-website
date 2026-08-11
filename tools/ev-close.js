/* Does the side nav actually ANIMATE out, or does it just vanish? */
window.scrollTo(0, Math.round(innerHeight * 3.4));
await new Promise(r => setTimeout(r, 1200));

const snav  = document.getElementById('snav');
const panel = document.getElementById('snavPanel');
const glow  = document.getElementById('snavGlow');
const list  = document.getElementById('snavList');

document.getElementById('menuBtn').click();
await new Promise(r => setTimeout(r, 1800));
const openX = Math.round(panel.getBoundingClientRect().left);

/* glow must paint UNDER the list, not over it */
const rows = [...snav.querySelectorAll('.snav__item')];
rows[1].dispatchEvent(new PointerEvent('pointerenter'));
await new Promise(r => setTimeout(r, 600));
const zGlow = getComputedStyle(glow).zIndex, zList = getComputedStyle(list).zIndex;
const blurs = [...glow.querySelectorAll('.snav__glowSvg')].map(s => getComputedStyle(s).filter);

/* now close, and sample the panel as it leaves */
document.getElementById('snavClose').click();
const tl = [];
for (let i = 0; i < 8; i++) {
  await new Promise(r => setTimeout(r, 90));
  const cs = getComputedStyle(snav);
  tl.push({ ms: (i + 1) * 90,
            x: Math.round(panel.getBoundingClientRect().left),
            vis: cs.visibility });
}
await new Promise(r => setTimeout(r, 900));
const done = { x: Math.round(panel.getBoundingClientRect().left),
               vis: getComputedStyle(snav).visibility };

return JSON.stringify({
  openX, zGlow, zList, blurs,
  contactBlurs: [getComputedStyle(document.querySelector('.tnav__cShape--g1')).filter,
                 getComputedStyle(document.querySelector('.tnav__cShape--g2')).filter],
  closeTimeline: tl, done,
  animatedOut: tl.some(r => r.x > openX + 20 && r.x < openX + 560 && r.vis === 'visible')
});
