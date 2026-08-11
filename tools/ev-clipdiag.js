await new Promise(r=>setTimeout(r,4000));
const bar=document.getElementById('bar');
const before=getComputedStyle(bar).clipPath;
// brute test: a clip that removes the left half. If the bar still spans full
// width after this, clip-path is not taking effect on this element at all.
bar.style.clipPath='path("M400 0 L1600 0 L1600 44 L400 44 Z")';
await new Promise(r=>setTimeout(r,300));
const after=getComputedStyle(bar).clipPath;
const r=bar.getBoundingClientRect();
return JSON.stringify({
  supported: CSS.supports('clip-path','path("M0 0 L10 0 L10 10 Z")'),
  before:before.slice(0,60), after:after.slice(0,60),
  rect:{x:+r.left.toFixed(1),w:+r.width.toFixed(1),h:+r.height.toFixed(1)},
  parentFilter:getComputedStyle(bar.parentElement).filter.slice(0,40),
  overflowX:getComputedStyle(bar).overflowX
});
