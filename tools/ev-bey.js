await new Promise(r=>setTimeout(r,3500));
const errs=[]; addEventListener('error',e=>errs.push(String(e.message)));
const mons=[...document.querySelectorAll('.mon')].map(m=>{
  const s=m.querySelector('.mon__scr'), f=m.querySelector('iframe');
  return {cap:m.querySelector('.mon__cap b').textContent, box:s.style.width+'x'+s.style.height,
          css:f.style.width+'x'+f.style.height, tf:f.style.transform, target:f.dataset.t==='1'};});
const stats={}; document.querySelectorAll('.stat').forEach(s=>{
  const b=s.querySelector('b'), i=s.querySelector('i'); if(b&&i) stats[b.textContent]=i.textContent;});
let inner=null;
try{ const d=document.querySelector('iframe[data-t="1"]').contentDocument;
  const col=d.querySelector('.ftr__col');
  inner={cw:d.documentElement.clientWidth,
    ucap:d.defaultView.getComputedStyle(d.documentElement).getPropertyValue('--ucap').trim(),
    col: col?Math.round(col.getBoundingClientRect().width):null};
}catch(e){ inner='ERR '+e.message; }
return JSON.stringify({errs,sum:document.getElementById('sum').textContent,
  route:document.getElementById('route').textContent,mons,stats,inner},null,1);
