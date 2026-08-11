/* live frame meter — does it build, does it read, does it stay out of the way */
const box = document.getElementById('fpsBox');
if (!box) return { ok: false, why: 'no #fpsBox' };

/* let the readout tick a few times */
await new Promise(r => setTimeout(r, 1400));

const rect = box.getBoundingClientRect();
const cs = getComputedStyle(box);

/* is anything under it clickable through it? */
const under = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);

/* the keyboard path, both ways */
const fire = (code, shift) => document.dispatchEvent(
  new KeyboardEvent('keydown', { code, shiftKey: !!shift, bubbles: true }));
fire('KeyF', true);
const hiddenNow = box.style.display === 'none';
fire('KeyF', true);
const backNow = box.style.display !== 'none';

/* scroll it into the work section and see whether the address follows */
window.scrollTo(0, innerHeight * 12);
await new Promise(r => setTimeout(r, 700));
const yLine = box.querySelector('#fpsY').textContent;
window.scrollTo(0, 0);

return {
  ok: true,
  text: box.innerText.split('\n'),
  rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
  pointerEvents: cs.pointerEvents,
  zIndex: cs.zIndex,
  clickThrough: under ? under.id || under.className || under.tagName : null,
  toggleOff: hiddenNow,
  toggleOn: backNow,
  yLine: yLine,
  api: typeof window.FPS === 'object' && typeof window.FPS.toggle === 'function',
  canvas: (() => { const c = box.querySelector('canvas'); return c ? c.width + 'x' + c.height : null; })(),
  stored: localStorage.getItem('cnvrt.fps')
};
