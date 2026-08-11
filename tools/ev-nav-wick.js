/* Two behaviours that a still frame cannot show:
     A. the comet walks the badge outline as page progress advances
     B. the wick flickers while scrolling and settles when it stops      */
const glow = document.querySelector('.tnav__wick--o');
const core = document.querySelector('.tnav__wick--c');
const maxY = document.documentElement.scrollHeight - innerHeight;

const sample = () => ({
  x: +core.getAttribute('cx'), y: +core.getAttribute('cy'),
  r: +glow.getAttribute('r'), o: +glow.getAttribute('opacity')
});

/* ---- A. head position vs page progress ---- */
const walk = [];
for (const frac of [0.10, 0.30, 0.50, 0.70, 0.90]) {
  window.scrollTo(0, Math.round(maxY * frac));
  await new Promise(r => setTimeout(r, 700));
  const s = sample();
  walk.push({ frac, x: Math.round(s.x * 10) / 10, y: Math.round(s.y * 10) / 10 });
}

/* ---- B. flicker while moving ---- */
window.scrollTo(0, Math.round(innerHeight * 2.9));
await new Promise(r => setTimeout(r, 1400));
const moving = [];
let y = Math.round(innerHeight * 2.9);
for (let i = 0; i < 14; i++) {
  y += 120;
  window.scrollTo(0, y);
  await new Promise(r => setTimeout(r, 60));
  moving.push(Math.round(sample().r * 100) / 100);
}

/* ---- B. settled ---- */
await new Promise(r => setTimeout(r, 1800));
const still = [];
for (let i = 0; i < 14; i++) {
  await new Promise(r => setTimeout(r, 60));
  still.push(Math.round(sample().r * 100) / 100);
}

const spread = a => Math.round((Math.max(...a) - Math.min(...a)) * 100) / 100;
return JSON.stringify({
  walk,
  movingSpread: spread(moving), moving,
  stillSpread: spread(still),  still
});
