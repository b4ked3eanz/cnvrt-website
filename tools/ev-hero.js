/* The spec: content block 1508.1x439, x=206 at 1920 and x=1166 at 3840,
   background plate 2404 -> 4324. Measure all of it. */
await new Promise(r=>setTimeout(r,1800));
const W=innerWidth, H=innerHeight;
const R=document.querySelector('.hero__panel').getBoundingClientRect();
const rel=q=>{const e=document.querySelector(q); if(!e) return null;
  const b=e.getBoundingClientRect();
  return {x:+(b.left-R.left).toFixed(1), y:+(b.top-R.top).toFixed(1),
          w:+b.width.toFixed(1), h:+b.height.toFixed(1)};};
/* the type block = union of the four gridmarks + ticker + headline */
const parts=[".ticker",".headline",".hnav",".sub",'.gridmark--tl','.gridmark--br','.gridmark--tr','.gridmark--bl']
  .map(rel).filter(Boolean);
const L=Math.min(...parts.map(p=>p.x)), T=Math.min(...parts.map(p=>p.y));
const Rt=Math.max(...parts.map(p=>p.x+p.w)), B=Math.max(...parts.map(p=>p.y+p.h));
const media=rel('.hero__media')||rel('.hero__bg');
return JSON.stringify({vp:[W,H],
  block:{x:+L.toFixed(1), y:+T.toFixed(1), w:+(Rt-L).toFixed(1), h:+(B-T).toFixed(1)},
  headline:rel('.headline'), ticker:rel('.ticker'), hnav:rel('.hnav'),
  media:media, ucap:getComputedStyle(document.documentElement).getPropertyValue('--ucap').trim()});
