/* Walk the FAQ past the viewport and watch the header specifically:
   it must have a long, readable reveal again, not a 7% snap. */
const sec = document.getElementById('faq');
const top = sec.getBoundingClientRect().top + window.scrollY;
const head = document.getElementById('faqHead');
const hChars = [...head.querySelectorAll('.faq__ch')];
const qChars = [...sec.querySelectorAll('.faq__row')[0].querySelectorAll('.faq__ch')];

function state(list) {
  let mid = 0, done = 0;
  list.forEach(c => { const o = +c.style.opacity || 0; if (o > 0.02 && o < 0.98) mid++; if (o >= 0.98) done++; });
  return mid + '/' + done + ' of ' + list.length;
}
const rows = [];
for (let d = 1.15; d >= -0.25; d -= 0.08) {
  window.scrollTo(0, Math.round(top - innerHeight * d));
  await new Promise(r => setTimeout(r, 190));
  rows.push({ d: +d.toFixed(2), head: state(hChars), q1: state(qChars) });
}
return JSON.stringify({
  headChars: hChars.length, q1Chars: qChars.length,
  sample: rows,
  headFrames: rows.filter(r => r.head.split(' ')[0].split('/')[0] !== '0').length
});
