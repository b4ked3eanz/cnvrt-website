/* the two review findings, verified as fixed */
const sec=document.getElementById('contact'); sec.scrollIntoView();
await new Promise(r=>setTimeout(r,900));
const R=sec.getBoundingClientRect();
const lnk=sec.querySelector('.ftr__grp--find .ftr__lnk');
const b=lnk.getBoundingClientRect();
const cx=Math.round(b.left+b.width/2), cy=Math.round(b.top+b.height/2);
const closed={pe:getComputedStyle(lnk).pointerEvents, hit:(document.elementFromPoint(cx,cy)||{}).className};
sec.querySelector('.ftr__zone').dispatchEvent(new PointerEvent('pointerenter'));
await new Promise(r=>setTimeout(r,800));
const open={pe:getComputedStyle(lnk).pointerEvents, op:+getComputedStyle(lnk).opacity,
            hit:(document.elementFromPoint(cx,cy)||{}).className};
sec.querySelector('.ftr__zone').dispatchEvent(new PointerEvent('pointerleave'));
await new Promise(r=>setTimeout(r,900));
const back={pe:getComputedStyle(lnk).pointerEvents, hit:(document.elementFromPoint(cx,cy)||{}).className};
return JSON.stringify({linkAt:[cx,cy],closed,open,back},null,1);
