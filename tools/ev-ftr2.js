const errs=[]; addEventListener('error',e=>errs.push(String(e.message)));
addEventListener('unhandledrejection',e=>errs.push('rej: '+e.reason));
const sec=document.getElementById('contact'); sec.scrollIntoView();
await new Promise(r=>setTimeout(r,900));
const cs=el=>getComputedStyle(el);
const mr=sec.querySelector('.ftr__meta--r'), ml=sec.querySelector('.ftr__meta--l');
return JSON.stringify({errs,
  agentBars:document.querySelectorAll('.agent').length,
  agentImgs:[...document.images].filter(i=>/agentbar/.test(i.src)).length,
  heroLiveClass:document.body.className,
  metaR:{opacity:+cs(mr).opacity, spanOpacity:+cs(mr.querySelector('span')).opacity, text:mr.textContent},
  metaL:{opacity:+cs(ml).opacity, text:ml.textContent},
  strapSpan:+cs(sec.querySelector('.ftr__strap span')).opacity,
  brokenImgs:[...document.images].filter(i=>i.complete&&i.naturalWidth===0).map(i=>i.getAttribute('src'))
},null,1);
