const errs=[]; addEventListener('error',e=>errs.push(String(e.message)));
await new Promise(r=>setTimeout(r,6000));
const cp=q=>{const e=document.querySelector(q); return e?getComputedStyle(e).clipPath.slice(0,90):null;};
const bg=q=>{const e=document.querySelector(q); return e?getComputedStyle(e).backgroundImage.replace(/data:image[^"')]*/,'<svg…>').slice(0,180):null;};
return JSON.stringify({errs,
  barClip:cp('#bar'), segClip:cp('#which'), pillClip:cp('#which button'),
  wrapFilter:getComputedStyle(document.querySelector('.barwrap')).filter.slice(0,120),
  ctlBg:bg('.ctl'), numBg:bg('.num'),
  pillFilter:getComputedStyle(document.querySelector('#which button[aria-pressed=true]')).filter,
  barBox:(b=>({w:+b.width.toFixed(1),h:+b.height.toFixed(1)}))(document.querySelector('#bar').getBoundingClientRect())
},null,1);
