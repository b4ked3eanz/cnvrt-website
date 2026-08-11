/* How many frames does the nav module actually demand when nothing is
   happening? Counted by watching the wick's own attribute writes, which
   is one per frame of that module and nothing else's. */
const wick = document.querySelector('.tnav__wick--c');
let writes = 0;
const mo = new MutationObserver(recs => { writes += recs.length; });
mo.observe(wick, { attributes: true, attributeFilter: ['cx'] });

/* park deep in the page with the nav visible and collapsed */
window.scrollTo(0, Math.round(document.documentElement.scrollHeight * 0.5));
await new Promise(r => setTimeout(r, 2500));        // let heat decay out

writes = 0;
const t0 = performance.now();
await new Promise(r => setTimeout(r, 3000));
const idleHz = writes / ((performance.now() - t0) / 1000);

/* now while scrolling */
writes = 0;
const t1 = performance.now();
let y = window.scrollY;
for (let i = 0; i < 30; i++) { y += 90; window.scrollTo(0, y); await new Promise(r => setTimeout(r, 33)); }
const busyHz = writes / ((performance.now() - t1) / 1000);

/* and after it settles again */
await new Promise(r => setTimeout(r, 2500));
writes = 0;
const t2 = performance.now();
await new Promise(r => setTimeout(r, 2000));
const settledHz = writes / ((performance.now() - t2) / 1000);
mo.disconnect();

return JSON.stringify({
  idleHz: +idleHz.toFixed(1),
  busyHz: +busyHz.toFixed(1),
  settledHz: +settledHz.toFixed(1),
  navOpacity: +getComputedStyle(document.getElementById('tnav')).opacity
});
