/* dashboard — does it find the trace, compute, draw, and answer a hover */
const main = document.getElementById('main');
if (main.style.display === 'none') return { ok: false, why: 'no trace found in this origin' };

/* hover a third of the way down the profile */
const st = document.getElementById('gStage');
const r = st.getBoundingClientRect();
const at = { x: r.left + r.width * 0.5, y: r.top + r.height * 0.34 };
st.dispatchEvent(new MouseEvent('mousemove', { clientX: at.x, clientY: at.y, bubbles: true }));
await new Promise(r2 => setTimeout(r2, 200));

const side = document.getElementById('side');
const rowsTxt = [...side.querySelectorAll('table tr')].slice(0, 6).map(tr =>
  [...tr.children].map(td => td.textContent.trim().replace(/\s+/g, ' ')).join('  |  '));

/* is the graph canvas actually painted? count non-transparent pixels */
const g = document.getElementById('g');
const cx = g.getContext('2d');
const d = cx.getImageData(0, 0, g.width, g.height).data;
let lit = 0;
for (let i = 3; i < d.length; i += 4 * 97) if (d[i] > 8) lit++;

return {
  ok: true,
  meta: document.getElementById('meta').textContent,
  head: document.getElementById('head2') ? document.getElementById('head2').textContent.replace(/\s+/g, ' ') : null,
  nums: [...document.querySelectorAll('#nums div')].map(x => x.textContent.replace(/\s+/g, ' ')),
  hitters: rowsTxt,
  drops: [...document.querySelectorAll('.drop')].slice(0, 5).map(x => x.textContent.replace(/\s+/g, ' ')),
  litSamples: lit,
  canvas: g.width + 'x' + g.height
};
