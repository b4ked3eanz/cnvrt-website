/* The bar should ride up and out once the footer owns the viewport. */
const nav = document.getElementById('tnav');
const ftr = document.querySelector('.ftr');
const ftrTop = ftr.getBoundingClientRect().top + window.scrollY;
const H = document.documentElement.scrollHeight;

const rows = [];
for (const d of [-1.2, -0.8, -0.4, -0.1, 0.1, 0.25, 0.45, 0.7, 1.0]) {
  /* place the viewport CENTRE d viewports past the footer's top */
  window.scrollTo(0, Math.round(ftrTop + d * innerHeight - innerHeight / 2));
  await new Promise(r => setTimeout(r, 380));
  const cs = getComputedStyle(nav);
  const m = /matrix\([^)]*?,\s*(-?[\d.]+)\)$/.exec(cs.transform);
  rows.push({
    vpCentreVsFooter: d,
    y: window.scrollY,
    opacity: +(+cs.opacity).toFixed(3),
    liftPx: m ? Math.round(+m[1]) : 0
  });
}
window.scrollTo(0, Math.round(H * 0.99));
await new Promise(r => setTimeout(r, 500));
const atEnd = { opacity: +(+getComputedStyle(nav).opacity).toFixed(3),
                transform: getComputedStyle(nav).transform };
return JSON.stringify({ ftrTop, rows, atEnd });
