const sec = document.getElementById('faq');
const top = sec.getBoundingClientRect().top + window.scrollY;
window.scrollTo(0, Math.round(top - innerHeight * 0.02));
await new Promise(r => setTimeout(r, 1400));
const ask = sec.querySelector('.faq__ask');
const b = ask.getBoundingClientRect();
window.__clip = { x: Math.round(b.left - 70), y: Math.round(window.scrollY + b.top - 14), w: 420, h: 72 };
const btn = sec.querySelector('.faq__askBtn');
return JSON.stringify({
  ask: Math.round(b.width) + 'x' + Math.round(b.height),
  btn: (r => Math.round(r.width) + 'x' + Math.round(r.height))(btn.getBoundingClientRect()),
  label: sec.querySelector('.faq__lbl').textContent,
  glow: [...btn.querySelectorAll('svg')].map(s => getComputedStyle(s).filter + '/' + getComputedStyle(s).mixBlendMode)
});
