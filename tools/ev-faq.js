/* Scroll the FAQ into view, open a row, clip to the section. */
const sec = document.getElementById('faq');
const top = sec.getBoundingClientRect().top + window.scrollY;

/* mid-reveal first, so the scattered letters are visible */
window.scrollTo(0, Math.round(top - innerHeight * 0.62));
await new Promise(r => setTimeout(r, 700));
const chars = [...sec.querySelectorAll('.faq__ch')];
const mid = chars.slice(0, 6).map(c => ({
  o: +(+c.style.opacity || 0).toFixed(2),
  t: (c.style.transform || 'none').slice(0, 46),
  f: c.style.filter || 'none'
}));

/* now settled */
window.scrollTo(0, Math.round(top - innerHeight * 0.05));
await new Promise(r => setTimeout(r, 900));
const settled = chars.slice(0, 4).map(c => +(+c.style.opacity || 0).toFixed(2));

/* open the first row */
const rows = [...sec.querySelectorAll('.faq__row')];
rows[0].querySelector('.faq__q').click();
await new Promise(r => setTimeout(r, 900));

const r0 = rows[0].getBoundingClientRect();
const sr = sec.getBoundingClientRect();
window.__clip = { x: 400, y: Math.round(window.scrollY + sr.top), w: 1130, h: Math.min(1000, Math.round(sr.height)) };

return JSON.stringify({
  sectionH: Math.round(sr.height),
  charCount: chars.length,
  midReveal: mid,
  settledOpacity: settled,
  dataIn: sec.getAttribute('data-in'),
  row0Open: rows[0].getAttribute('data-open'),
  row0H: Math.round(r0.height),
  row5Open: rows[5].getAttribute('data-open'),
  askBox: (b => Math.round(b.left) + ',' + Math.round(b.top) + ' ' + Math.round(b.width) + 'x' + Math.round(b.height))(sec.querySelector('.faq__ask').getBoundingClientRect())
});
