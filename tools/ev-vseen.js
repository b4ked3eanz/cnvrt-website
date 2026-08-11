window.scrollTo(0, Math.round(document.documentElement.scrollHeight * 0.4));
await new Promise(r => setTimeout(r, 1200));
const v = document.getElementById('vnav');
const cs = getComputedStyle(v);
const r = v.getBoundingClientRect();
const bar = v.querySelector('.vnav__bar');
const br = bar.getBoundingClientRect();
const bcs = getComputedStyle(bar);
/* what is actually on top at the mark's centre? */
const el = document.elementFromPoint(br.left + br.width/2, br.top + br.height/2);
window.__clip = { x: Math.round(r.left - 60), y: Math.round(window.scrollY), w: 260, h: 300 };
return JSON.stringify({
  vnavRect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
  vnavZ: cs.zIndex, vnavVis: cs.visibility, vnavOpacity: cs.opacity, vnavDisplay: cs.display,
  barRect: [Math.round(br.left), Math.round(br.top), Math.round(br.width), Math.round(br.height)],
  barBg: bcs.background.slice(0, 40), barOpacity: bcs.opacity,
  topElementAtMark: el ? (el.className || el.tagName) : null,
  hitRect: (b => [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)])(document.getElementById('vnavHit').getBoundingClientRect())
});
