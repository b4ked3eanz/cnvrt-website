/* Every element's box as a FRACTION of the viewport. If the fraction is the
   same at two resolutions, the design is proportional there and nothing can
   look different. If it moves, that is a real, visible change. */
const sel = [
  ['hero',    '.hero__h1, .hero h1, .hero__title'],
  ['hero cta','#hero .btn-contact, .hero .btn-contact'],
  ['nav',     '.nav'],
  ['logo',    '.logo'],
  ['ftr col', '.ftr__col'],
  ['ftr mark','.ftr__mark'],
  ['ftr jump','.ftr__grp--jump'],
  ['ftr zone','.ftr__zone'],
  ['ftr cta', '#ftrCta'],
  ['ftr meta','.ftr__meta--l'],
];
document.getElementById('contact').scrollIntoView();
await new Promise(r=>setTimeout(r,1200));
const W=innerWidth, H=innerHeight, out={};
for (const [name,q] of sel){
  const el=document.querySelector(q); if(!el){ out[name]=null; continue; }
  const b=el.getBoundingClientRect();
  out[name]={ w:+(b.width/W*100).toFixed(2), h:+(b.height/H*100).toFixed(2),
              x:+(b.left/W*100).toFixed(2) };
}
return JSON.stringify({vp:[W,H], frac:out});
