const errs=[]; addEventListener('error',e=>errs.push(String(e.message)));
await new Promise(r=>setTimeout(r,3000));
const g=()=>{
  const scr=document.querySelector('.scr'), fr=document.querySelector('iframe');
  const st={}; document.querySelectorAll('.stat').forEach(s=>{
    const b=s.querySelector('b'),i=s.querySelector('i'); if(b&&i) st[b.textContent.trim()]=i.textContent.trim();});
  let inner=null;
  try{ const d=fr.contentDocument, c=d.querySelector('.ftr__col');
    inner={cw:d.documentElement.clientWidth, col:c?Math.round(c.getBoundingClientRect().width):null};
  }catch(e){ inner='ERR'; }
  return {sum:document.getElementById('sum').textContent, fit:document.getElementById('fit').textContent,
    cap:document.querySelector('.cap').textContent, box:scr.style.width+'x'+scr.style.height,
    css:fr.style.width+'x'+fr.style.height, stats:st, inner};
};
const sim=g();
// flip to YOURS
document.querySelector('[data-w="mine"]').click();
await new Promise(r=>setTimeout(r,2600));
const mine=g();
// overflow check: does the wrap fit the stage?
const stage=document.querySelector('.stage'), wrap=document.getElementById('wrap');
const fits={stage:[stage.clientWidth,stage.clientHeight],
            wrap:[Math.round(wrap.getBoundingClientRect().width),Math.round(wrap.getBoundingClientRect().height)]};
return JSON.stringify({errs,sim,mine,fits,hasZoom:!!document.getElementById('zoom')},null,1);
