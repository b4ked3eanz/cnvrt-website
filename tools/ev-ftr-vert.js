const sec=document.getElementById('contact'); sec.scrollIntoView();
await new Promise(r=>setTimeout(r,1800));
const R=sec.getBoundingClientRect();
const g=s=>{const b=sec.querySelector(s).getBoundingClientRect();
  return {top:+(b.top-R.top).toFixed(1), bot:+(b.bottom-R.top).toFixed(1), gapFromBottom:+(R.height-(b.bottom-R.top)).toFixed(1)};};
return JSON.stringify({vp:[innerWidth,innerHeight], secH:+R.height.toFixed(1),
  secTopInVp:+R.top.toFixed(1), scrollY:Math.round(scrollY),
  docH:document.documentElement.scrollHeight,
  mark:g('.ftr__mark'), metaL:g('.ftr__meta--l'), jump:g('.ftr__grp--jump'), find:g('.ftr__grp--find'), strap:g('.ftr__strap')});
