const sec=document.getElementById('contact'); sec.scrollIntoView();
await new Promise(r=>setTimeout(r,1200));
sec.querySelector('.ftr__zone').dispatchEvent(new PointerEvent('pointerenter'));
await new Promise(r=>setTimeout(r,2600));
return JSON.stringify({open:sec.classList.contains('is-open')});
