await new Promise(r=>setTimeout(r,2500));
const errs=[]; addEventListener('error',e=>errs.push(String(e.message)));
const frames=[...document.querySelectorAll('iframe')].map(f=>({
  key:f.dataset.key, w:f.style.width, h:f.style.height, tf:f.style.transform, src:f.getAttribute('src')}));
const stats={}; document.querySelectorAll('.stat').forEach(s=>{
  stats[s.querySelector('b').textContent.trim()]=s.querySelector('span').textContent.trim();});
let inner=null;
try{ const d=document.querySelector('iframe[data-key="t"]').contentDocument;
  inner={cw:d.documentElement.clientWidth, ch:d.documentElement.clientHeight,
    u:d.defaultView.getComputedStyle(d.documentElement).getPropertyValue('--u').trim(),
    ucap:d.defaultView.getComputedStyle(d.documentElement).getPropertyValue('--ucap').trim(),
    hasFtr:!!d.getElementById('contact'),
    colW:(()=>{const e=d.querySelector('.ftr__col');return e?Math.round(e.getBoundingClientRect().width):null;})(),
    agent:d.querySelectorAll('.agent').length};
}catch(e){ inner='BLOCKED: '+e.message; }
return JSON.stringify({errs,summary:document.getElementById('sum').textContent,
  scale:document.getElementById('scaleTxt').textContent,frames,stats,inner},null,1);
