/* the ask card's shapes must scatter and settle like its letters do */
const sec = document.getElementById('faq');
const top = sec.getBoundingClientRect().top + window.scrollY;
const shapes = [...sec.querySelectorAll('.faq__askPlate, .faq__tab, .faq__askBtn > svg, .faq__askBtn .faq__chip')];
const letters = [...sec.querySelector('.faq__askLabel').querySelectorAll('.faq__ch')];

function snap(list) {
  return list.map(e => ({
    o: +(+getComputedStyle(e).opacity).toFixed(2),
    t: (e.style.translate || '-'),
    s: (e.style.scale || '-'),
    f: (e.style.filter || 'none')
  }));
}
const rows = [];
for (let d = 0.55; d >= -0.35; d -= 0.09) {
  window.scrollTo(0, Math.round(top - innerHeight * d));
  await new Promise(r => setTimeout(r, 200));
  const sh = snap(shapes);
  rows.push({
    d: +d.toFixed(2),
    shapesMoving: sh.filter(x => x.t !== '-' && x.t !== '0px 0px').length,
    shapesBlurred: sh.filter(x => x.f !== 'none' && x.f !== '').length,
    shapesSettled: sh.filter(x => x.t === '-' ).length,
    lettersMid: snap(letters).filter(x => x.o > 0.02 && x.o < 0.98).length
  });
}
return JSON.stringify({ shapeCount: shapes.length, letterCount: letters.length, rows,
  finalSample: snap(shapes).map(x => x.t + ' | ' + x.s + ' | ' + x.f) });
