const errs=[]; addEventListener('error',e=>errs.push(String(e.message)));
await new Promise(r=>setTimeout(r,7000));
const grab=()=>({
  sum:document.getElementById('sum').textContent,
  head:document.querySelector('.mv__hd')?document.querySelector('.mv__hd').textContent:null,
  moves:[...document.querySelectorAll('.mv')].map(m=>m.querySelector('b').textContent+' '+m.querySelector('i').textContent),
  ghost:document.getElementById('ghost').style.width+'x'+document.getElementById('ghost').style.height,
});
const sim=grab();
document.querySelector('[data-w="mine"]').click();
await new Promise(r=>setTimeout(r,7000));
const mine=grab();
return JSON.stringify({errs,sim,mine},null,1);
