/* Pricing cards inside the turn-out frame, + the hero's resting chrome.
   shot.js wraps this in (async()=>{...})(). SY eases at 0.14/frame, so a jump
   of 28000px needs ~90 frames to settle — measuring before it has is what made
   the first pass read the end of the pin as e = 0. */
var out = { errs: [] };
var seed = document.getElementById('wkSeed'),
    wrap = document.getElementById('prCards'),
    anch = document.getElementById('pricing'),
    work = document.getElementById('work'),
    root = document.documentElement;
if (!seed || !wrap || !work) { out.errs.push('missing element'); return out; }
if (!seed.contains(wrap)) out.errs.push('#prCards is NOT inside #wkSeed');
out.priceSectionStillThere = !!document.querySelector('section.price');

var frame = () => new Promise(r => requestAnimationFrame(r));
async function settle(max) {
  for (var i = 0; i < (max || 400); i++) {
    await frame();
    if (Math.abs(SY.y - scrollY) < 0.5 && i > 8) return i;
  }
  return -1;
}
function rect(el) {
  var r = el.getBoundingClientRect();
  return [+r.left.toFixed(1), +r.top.toFixed(1), +r.width.toFixed(1), +r.height.toFixed(1)];
}
function chrome() {
  return {
    past: root.classList.contains('past-top'),
    logo: +getComputedStyle(document.querySelector('.logo')).opacity,
    nav:  +getComputedStyle(document.querySelector('.nav')).opacity,
    menu: +getComputedStyle(document.getElementById('menuBtn')).opacity
  };
}
var wkTop = work.getBoundingClientRect().top + scrollY;
var span  = work.offsetHeight - innerHeight;
var pause = ms => new Promise(r => setTimeout(r, ms));

scrollTo(0, 0); await settle();                                   out.chromeTop = chrome();
scrollTo(0, 900); await settle(); await pause(700);               out.chromeScrolled = chrome();
var ftr = document.getElementById('contact');
scrollTo(0, ftr.getBoundingClientRect().top + scrollY + 200);
await settle(); await pause(700);                                 out.chromeFooter = chrome();
scrollTo(0, 0); await settle(); await pause(700);                 out.chromeBack = chrome();

var samples = {};
for (const p of [0.80, 0.88, 0.94, 0.98, 1.0]) {
  scrollTo(0, Math.round(wkTop + span * p));
  await settle();
  var cs = [].slice.call(wrap.querySelectorAll('.price__card'));
  samples['p' + p] = {
    seedVis: seed.style.visibility,
    seedRect: rect(seed),
    cardRects: cs.map(rect),
    clipTop: cs[0].style.clipPath,
    clipBot: cs[1].style.clipPath,
    hot: seed.classList.contains('is-hot'),
    pe: cs.map(c => getComputedStyle(c).pointerEvents),
    live: wrap.querySelectorAll('.price__cv.is-live').length
  };
}
out.samples = samples;
/* the seam: the two facing edges must stay put for the whole growth */
out.anchorDocY = Math.round(anch.getBoundingClientRect().top + scrollY);
out.pinEndY = Math.round(wkTop + span);
out.docH = document.documentElement.scrollHeight;
return out;
