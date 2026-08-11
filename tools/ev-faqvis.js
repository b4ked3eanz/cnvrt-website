/* After the reveal line has passed them, every FAQ character and shape must be
   fully visible. Reports the settled population at three scroll depths. */
const sleep = ms => new Promise(r => setTimeout(r, ms));
const sec = document.getElementById('faq');
const secTop = sec.getBoundingClientRect().top + scrollY;
const head = document.getElementById('faqHead');

async function at(off, label) {
  scrollTo(0, secTop + off);
  dispatchEvent(new Event('resize'));
  await sleep(800);
  const all = [...sec.querySelectorAll('.faq__ch')];
  let vis = 0, mid = 0, gone = 0;
  for (const c of all) {
    const o = +getComputedStyle(c).opacity;
    if (o >= 0.98) vis++; else if (o > 0.02) mid++; else gone++;
  }
  const hc = [...head.querySelectorAll('.faq__ch')];
  const hvis = hc.filter(c => +getComputedStyle(c).opacity >= 0.98).length;
  const plate = sec.querySelector('.faq__askPlate');
  return { label, off, glyphs: all.length, settled: vis, inFlight: mid, hidden: gone,
           head: hvis + '/' + hc.length, plateOpacity: +getComputedStyle(plate).opacity };
}

const out = [];
out.push(await at(-innerHeight * 0.30, 'entering'));
out.push(await at(innerHeight * 0.20, 'mid'));
out.push(await at(sec.getBoundingClientRect().height - innerHeight * 0.4, 'passed'));
// leave the page parked at the fully-revealed position for the screenshot
scrollTo(0, secTop + 120);
dispatchEvent(new Event('resize'));
await sleep(900);
return out;
