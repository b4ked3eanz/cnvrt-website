/* Footer rebuild (Figma 527:4652) — layout, the 1400 cap, the screen-relative
   instrument, and the evacuation.

   At 1920x1080 every DOM number below must equal its Figma coordinate, because
   --ucap is exactly 1px there. Above 1920 the column must STOP and the reticle
   must not. */
const errs = [];
addEventListener('error', e => errs.push(String(e.message)));
addEventListener('unhandledrejection', e => errs.push('rejection: ' + e.reason));

const sec = document.getElementById('contact');
sec.scrollIntoView();
await new Promise(r => setTimeout(r, 700));

const R = sec.getBoundingClientRect();
const rel = el => {
  if (!el) return null;
  const b = el.getBoundingClientRect();
  return { x: +(b.left - R.left).toFixed(1), y: +(b.top - R.top).toFixed(1),
           w: +b.width.toFixed(1), h: +b.height.toFixed(1) };
};
const q = s => sec.querySelector(s);

const layout = {
  section : { w: +R.width.toFixed(1), h: +R.height.toFixed(1) },
  ucap    : getComputedStyle(document.documentElement).getPropertyValue('--ucap').trim(),
  u_in_ftr: getComputedStyle(sec).getPropertyValue('--u').trim(),
  col     : rel(q('.ftr__col')),
  strap   : rel(q('.ftr__strap')),
  find    : rel(q('.ftr__grp--find')),
  findRows: [...sec.querySelectorAll('.ftr__grp--find > *')].map(rel),
  jump    : rel(q('.ftr__grp--jump')),
  jumpRows: [...sec.querySelectorAll('.ftr__grp--jump > *')].map(rel),
  mark    : rel(q('.ftr__mark')),
  metaL   : rel(q('.ftr__meta--l')),
  metaR   : rel(q('.ftr__meta--r')),
  zone    : rel(q('.ftr__zone')),
  cta     : rel(q('#ftrCta')),
};

/* font actually resolved — a missing face silently falls back to monospace and
   every width above would still look plausible */
const cs = getComputedStyle(q('.ftr__strap'));
const fonts = {
  family: cs.fontFamily, size: cs.fontSize, weight: cs.fontWeight,
  ls: cs.letterSpacing,
  neueBitLoaded: document.fonts.check("700 20px 'PP NeueBit'"),
};
const markImg = q('.ftr__mark');
const markOk = { complete: markImg.complete, natural: markImg.naturalWidth + 'x' + markImg.naturalHeight };

/* the evacuation: entering the zone must take EVERY piece of type to 0 */
const before = ['.ftr__strap', '.ftr__grp--find', '.ftr__grp--jump', '.ftr__mark', '.ftr__meta--l', '.ftr__meta--r']
  .map(s => +getComputedStyle(q(s)).opacity);
q('.ftr__zone').dispatchEvent(new PointerEvent('pointerenter'));
await new Promise(r => setTimeout(r, 700));
const isOpen = sec.classList.contains('is-open') && document.body.classList.contains('hud-open');
const after = ['.ftr__strap', '.ftr__grp--find', '.ftr__grp--jump', '.ftr__mark', '.ftr__meta--l', '.ftr__meta--r']
  .map(s => +getComputedStyle(q(s)).opacity);
q('.ftr__zone').dispatchEvent(new PointerEvent('pointerleave'));
await new Promise(r => setTimeout(r, 900));
const back = ['.ftr__strap', '.ftr__grp--find', '.ftr__grp--jump', '.ftr__mark', '.ftr__meta--l', '.ftr__meta--r']
  .map(s => +getComputedStyle(q(s)).opacity);

return JSON.stringify({ errors: errs, layout, fonts, markOk,
  evac: { before, isOpen, after, back } }, null, 1);
