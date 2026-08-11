/* does the banner-walker produce plain English for the lines it charged */
if (!window.__probe || !window.__probe.armed) return { ok: false };
window.scrollTo(0, 0);
await new Promise(r => setTimeout(r, 400));
window.__probe.sweep(300);
const max = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) - innerHeight;
for (let i = 0; i < 120 && window.scrollY < max - 1; i++) await new Promise(r => setTimeout(r, 250));
const t = window.__probe.trace();
const pairs = Object.keys(t.names).map(k => [t.names[k], t.labels[k] || '(no banner found)']);
return { ok: true, n: pairs.length, labelled: pairs.filter(p => p[1] !== '(no banner found)').length, sample: pairs.slice(0, 22) };
