const sec=document.getElementById('contact'); sec.scrollIntoView();
await new Promise(r=>setTimeout(r,2200));
const R=sec.getBoundingClientRect();
return JSON.stringify({vp:[innerWidth,innerHeight],
  col:(()=>{const b=sec.querySelector('.ftr__col').getBoundingClientRect();return [+(b.left-R.left).toFixed(1),+b.width.toFixed(1)];})(),
  zone:(()=>{const b=sec.querySelector('.ftr__zone').getBoundingClientRect();return [+(b.left-R.left).toFixed(1),+(b.top-R.top).toFixed(1),+b.width.toFixed(1),+b.height.toFixed(1)];})(),
  cta:(()=>{const b=document.getElementById('ftrCta').getBoundingClientRect();return [+(b.left-R.left+b.width/2).toFixed(1),+(b.top-R.top+b.height/2).toFixed(1),+b.width.toFixed(1)];})(),
  mark:(()=>{const b=sec.querySelector('.ftr__mark').getBoundingClientRect();return [+(b.left-R.left).toFixed(1),+b.width.toFixed(1)];})()});
