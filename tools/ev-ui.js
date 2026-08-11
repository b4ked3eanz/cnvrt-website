const errs=[]; addEventListener('error',e=>errs.push(String(e.message)));
await new Promise(r=>setTimeout(r,6000));
const bar=document.querySelector('.bar').getBoundingClientRect();
const g=q=>{const e=document.querySelector(q); if(!e) return null; const b=e.getBoundingClientRect();
  return {x:+(b.left-bar.left).toFixed(1), w:+b.width.toFixed(1), h:+b.height.toFixed(1)};};
const cs=getComputedStyle(document.querySelector('.lbl'));
return JSON.stringify({errs,
  bar:{w:+bar.width.toFixed(1), h:+bar.height.toFixed(1)},
  font:{fam:cs.fontFamily, size:cs.fontSize, weight:cs.fontWeight, ls:cs.letterSpacing},
  fontLoaded:document.fonts.check("500 16px 'MD Thermochrome'"),
  preset:g('#preset'), pw:g('#pw'), os:g('#os'), seg:g('.seg'), sec:g('#sec'),
  scr:g('#scr'), cap:document.getElementById('cap').textContent,
  frameSrc:(document.querySelector('#scr iframe')||{}).getAttribute?document.querySelector('#scr iframe').getAttribute('style'):null
},null,1);
