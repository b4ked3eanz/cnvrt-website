/* Open the vertical menu, hover the RFL row, clip to the top right. */
window.scrollTo(0, Math.round(document.documentElement.scrollHeight * 0.42));
await new Promise(r => setTimeout(r, 1500));

const v = document.getElementById('vnav');
const U = document.documentElement.clientWidth / 1920;
const W = document.documentElement.clientWidth;

function move(x, y) {
  dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y, bubbles: true }));
}

/* park on the collapsed mark */
move(W - 30 * U, 34 * U);
await new Promise(r => setTimeout(r, 900));
const openedState = v.getAttribute('data-open');
const barsDefault = [...v.querySelectorAll('.vnav__bar')].map(b => b.className.replace('vnav__bar ', ''));
const ptrDefault = getComputedStyle(document.getElementById('vnavPtr')).transform;

/* now hover the RFL row (row 3) */
const r3 = v.querySelector('.vnav__row--3');
const rb = r3.getBoundingClientRect();
move(rb.left + rb.width / 2, rb.top + rb.height / 2);
r3.dispatchEvent(new PointerEvent('pointerenter', { bubbles: false }));
await new Promise(r => setTimeout(r, 900));

const barsHover = [...v.querySelectorAll('.vnav__bar')].map(b => b.className.replace('vnav__bar ', ''));
const ptrHover = getComputedStyle(document.getElementById('vnavPtr')).transform;

window.__clip = { x: Math.round(W - 200 * U), y: window.scrollY, w: Math.round(200 * U), h: Math.round(250 * U) };

return JSON.stringify({
  openedState,
  open: v.getAttribute('data-open'),
  barsDefault, barsHover, curAttr: v.getAttribute('data-cur'), hotAttr: v.getAttribute('data-hot'), stacks: v.querySelectorAll('.vnav__bars').length, glowBlur: [...v.querySelectorAll('.vnav__bars--g1,.vnav__bars--g2')].map(g=>getComputedStyle(g).filter+' / '+getComputedStyle(g).mixBlendMode+' / op'+getComputedStyle(g).opacity),
  ptrDefault, ptrHover,
  ptrMoved: ptrDefault !== ptrHover,
  rowBoxes: [...v.querySelectorAll('.vnav__row')].map(r => {
    const b = r.getBoundingClientRect();
    return Math.round(b.left) + ',' + Math.round(b.top) + ' ' + Math.round(b.width) + 'x' + Math.round(b.height);
  })
});
