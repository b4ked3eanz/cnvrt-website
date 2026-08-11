/* dashboard input — wheel must PAN, ctrl+wheel must ZOOM, dblclick must reset */
if (document.getElementById('main').style.display === 'none') return { ok: false, why: 'no trace' };

const st = document.getElementById('gStage');
const r = st.getBoundingClientRect();
const at = { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
const snap = () => ({ y0: Math.round(view.y0), y1: Math.round(view.y1), span: Math.round(view.y1 - view.y0) });
const wheel = (o) => st.dispatchEvent(new WheelEvent('wheel',
  Object.assign({ bubbles: true, cancelable: true, deltaMode: 0 }, at, o)));

const start = snap();

/* 1. ctrl+wheel up = zoom in, holding the point under the cursor */
wheel({ deltaY: -100, ctrlKey: true });
const zoomed = snap();

/* 2. plain wheel = pan only, span must not change. Small delta on purpose:
   one wheel pixel is one drawing pixel, so at a wide span 240 of them is
   ~6,000 document px and would hit the bottom clamp, which is not reversible
   and is not what this assertion is about. */
const beforePan = snap();
wheel({ deltaY: 40 });
const panned = snap();
wheel({ deltaY: -40 });
const back = snap();

/* 3. pan must clamp at the top rather than run off */
for (let i = 0; i < 40; i++) wheel({ deltaY: -400 });
const atTop = snap();

/* 4. double-click resets to the whole document */
st.dispatchEvent(new MouseEvent('dblclick', Object.assign({ bubbles: true }, at)));
const reset = snap();

return {
  ok: true, docH: Math.round(docH),
  start, zoomed, panned, back, atTop, reset,
  zoomShrank: zoomed.span < start.span,
  panKeptSpan: panned.span === beforePan.span,
  panMoved: panned.y0 > beforePan.y0,
  panReversible: Math.abs(back.y0 - beforePan.y0) <= 1,
  clampedAtTop: atTop.y0 === 0 && atTop.span === zoomed.span,
  resetIsFullPage: reset.y0 === 0 && reset.y1 === Math.round(docH)
};
