/* What is actually clipping the FAQ reveal?
   Scrolls the reveal line into the section, then for every element the driver
   animates walks its ancestors looking for anything that establishes a clip
   (overflow != visible, clip-path, contain:paint) and reports whether the
   element's painted box escapes that ancestor's box. */
const sleep = ms => new Promise(r => setTimeout(r, ms));
const sec = document.getElementById('faq');
const secTop = sec.getBoundingClientRect().top + scrollY;

scrollTo(0, secTop - innerHeight * 0.30);
dispatchEvent(new Event('resize'));
await sleep(700);

const out = { scrollY: Math.round(scrollY), secTop: Math.round(secTop), clippers: [], escapes: [] };
const els = [...sec.querySelectorAll('.faq__ch, .faq__askPlate, .faq__tab, .faq__askBtn > svg, .faq__askBtn .faq__chip')];
out.count = els.length;

function desc(e) {
  const c = (typeof e.className === 'string' && e.className.trim()) ? '.' + e.className.trim().split(/\s+/).join('.') : '';
  return e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + c;
}
const seen = new Set();
let worst = null;

for (const el of els) {
  const r = el.getBoundingClientRect();
  if (!r.width && !r.height) continue;
  let p = el.parentElement;
  while (p && p !== document.documentElement) {
    const cs = getComputedStyle(p);
    const clips = cs.overflowX !== 'visible' || cs.overflowY !== 'visible' ||
                  cs.clipPath !== 'none' || /paint|strict|content/.test(cs.contain);
    if (clips) {
      const key = desc(p);
      if (!seen.has(key)) {
        seen.add(key);
        out.clippers.push({ el: key, overflow: cs.overflow, clipPath: cs.clipPath === 'none' ? '' : cs.clipPath.slice(0, 40), contain: cs.contain });
      }
      const ar = p.getBoundingClientRect();
      const over = { top: +(ar.top - r.top).toFixed(1), bottom: +(r.bottom - ar.bottom).toFixed(1),
                     left: +(ar.left - r.left).toFixed(1), right: +(r.right - ar.right).toFixed(1) };
      const max = Math.max(over.top, over.bottom, over.left, over.right);
      if (max > 0.5) {
        const rec = { ch: (el.textContent || desc(el)).slice(0, 12), by: key, over, max, op: el.style.opacity || getComputedStyle(el).opacity };
        out.escapes.push(rec);
        if (!worst || max > worst.max) worst = rec;
      }
    }
    p = p.parentElement;
  }
}
out.escapeCount = out.escapes.length;
out.escapes = out.escapes.sort((a, b) => b.max - a.max).slice(0, 10);
out.worst = worst;
return out;
