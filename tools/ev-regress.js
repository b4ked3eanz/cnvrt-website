/* Full sweep: walk the document, exercise both navs and the menu hover,
   and collect anything that throws. */
const errs = [];
addEventListener('error', e => errs.push(String(e.message)));
addEventListener('unhandledrejection', e => errs.push('rejection: ' + e.reason));

const H = document.documentElement.scrollHeight;
const marks = [];
for (const f of [0, 0.08, 0.14, 0.3, 0.5, 0.7, 0.9, 0.99]) {
  window.scrollTo(0, Math.round((H - innerHeight) * f));
  await new Promise(r => setTimeout(r, 320));
  marks.push({ f, tnav: +getComputedStyle(document.getElementById('tnav')).opacity,
                  plateW: Math.round(document.getElementById('tnavPlate').getBBox().width) });
}

/* top nav: open, then leave mid-way and confirm it reverses */
window.scrollTo(0, Math.round(H * 0.42));
await new Promise(r => setTimeout(r, 900));
const hit = document.getElementById('tnavHit');
hit.dispatchEvent(new PointerEvent('pointerenter'));
await new Promise(r => setTimeout(r, 220));
const midW = Math.round(document.getElementById('tnavPlate').getBBox().width);
dispatchEvent(new PointerEvent('pointermove', {clientX: 40, clientY: 600, bubbles:true}));  // bail out mid-expand
await new Promise(r => setTimeout(r, 1400));
const afterBail = Math.round(document.getElementById('tnavPlate').getBBox().width);

/* menu button hover -> the mark turns to its next symmetry point */
const bars = document.querySelector('.menu__bars');
const restT = getComputedStyle(bars).rotate;
document.getElementById('menuBtn').dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));

/* side nav: open, hover a row, close */
document.getElementById('menuBtn').click();
await new Promise(r => setTimeout(r, 1500));
const snavOpen = document.getElementById('snav').getAttribute('data-open');
const rows = [...document.querySelectorAll('.snav__item')];
rows[3].dispatchEvent(new PointerEvent('pointerenter'));
await new Promise(r => setTimeout(r, 500));
const glowOn = document.getElementById('snavGlow').getAttribute('data-on');
document.getElementById('snavClose').click();
await new Promise(r => setTimeout(r, 1200));
const snavShut = document.getElementById('snav').getAttribute('data-open');

return JSON.stringify({
  errors: errs, marks,
  bailOut: { midW, afterBail, reversed: afterBail < midW },
  menuRotateAtRest: restT,
  snavOpen, glowOn, snavShut
});
