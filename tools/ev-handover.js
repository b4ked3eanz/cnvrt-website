/* Sample the fake-nav -> real-nav handover across the shimmer's coverage. */
const hnav = document.querySelector('.hnav');
const tnav = document.getElementById('tnav');
const hero = document.querySelector('.hero');
const sec2 = document.querySelector('.sec2') || document.querySelector('.off');
const sec2Top = sec2.getBoundingClientRect().top + window.scrollY;

function cov(y) {
  const gap = 290 * (hero.clientWidth / 1920);
  const c = 1 - ((sec2Top - y) - gap) / innerHeight;
  return Math.min(1, Math.max(0, c));
}
/* solve scrollY for a target coverage */
const yFor = c => Math.round(sec2Top - 290 * (hero.clientWidth / 1920) - (1 - c) * innerHeight);

const rows = [];
for (const c of [0, 0.2, 0.4, 0.55, 0.7, 0.8, 0.88, 0.95, 1.0]) {
  window.scrollTo(0, Math.max(0, yFor(c)));
  await new Promise(r => setTimeout(r, 420));
  rows.push({
    cov: +cov(window.scrollY).toFixed(3),
    y: window.scrollY,
    hnav: +(hnav ? getComputedStyle(hnav).opacity : -1),
    tnav: +getComputedStyle(tnav).opacity,
    on: tnav.getAttribute('data-on')
  });
}
/* and far down the page the bar must still be there */
window.scrollTo(0, Math.round(document.documentElement.scrollHeight * 0.6));
await new Promise(r => setTimeout(r, 500));
const deep = { y: window.scrollY, tnav: +getComputedStyle(tnav).opacity };

/* is the side-nav trigger actually reachable there? */
const mb = document.getElementById('menuBtn');
const r = mb.getBoundingClientRect();
const topEl = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
const reachable = topEl === mb || mb.contains(topEl);

return JSON.stringify({ rows, deep, menuReachableDeepInPage: reachable, hitTopEl: topEl ? topEl.className || topEl.tagName : null });
