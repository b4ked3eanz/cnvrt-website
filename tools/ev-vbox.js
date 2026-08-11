/* Reproduce the real-browser condition: a visible scrollbar, so
   innerWidth != clientWidth, and prove the hover box lands on the mark. */
const root = document.documentElement;
const sbw = window.innerWidth - root.clientWidth;
const U = root.clientWidth / 1920;
const v = document.getElementById('vnav');
const hit = document.getElementById('vnavHit');

window.scrollTo(0, Math.round(root.scrollHeight * 0.4));
await new Promise(r => setTimeout(r, 900));

const shut = hit.getBoundingClientRect();
/* the OLD maths: design-x from clientX/U, assuming the viewport is 1920 wide */
const oldBoxRight = 1900 * U, oldBoxLeft = 1868 * U;
/* aim at the visual centre of the collapsed mark */
const aimX = shut.left + shut.width / 2, aimY = shut.top + shut.height / 2;
const oldWouldHit = aimX >= oldBoxLeft && aimX <= oldBoxRight;

dispatchEvent(new PointerEvent('pointermove', { clientX: aimX, clientY: aimY, bubbles: true }));
await new Promise(r => setTimeout(r, 700));
const openedByAim = v.getAttribute('data-open');
const openBox = hit.getBoundingClientRect();

/* now move to the far side of the open panel — it must STAY open */
dispatchEvent(new PointerEvent('pointermove', { clientX: openBox.left + 6, clientY: openBox.bottom - 6, bubbles: true }));
await new Promise(r => setTimeout(r, 400));
const stillOpen = v.getAttribute('data-open');

/* and away — it must close */
dispatchEvent(new PointerEvent('pointermove', { clientX: 60, clientY: 600, bubbles: true }));
await new Promise(r => setTimeout(r, 900));
const closed = v.getAttribute('data-open');

return JSON.stringify({
  scrollbarPx: sbw, innerWidth: window.innerWidth, clientWidth: root.clientWidth,
  collapsedBox: [Math.round(shut.left), Math.round(shut.top), Math.round(shut.width), Math.round(shut.height)],
  aim: [Math.round(aimX), Math.round(aimY)],
  oldMathsWouldHaveHit: oldWouldHit,
  openedByAim, stillOpenAtFarCorner: stillOpen, closedAfterLeaving: closed,
  openBox: [Math.round(openBox.left), Math.round(openBox.top), Math.round(openBox.width), Math.round(openBox.height)]
});
