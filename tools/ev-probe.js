/* perf-probe — does it arm, attribute, bucket and persist */
if (!window.__probe || !window.__probe.armed) return { ok: false, why: 'not armed', p: !!window.__probe };

/* a fast sweep so the eval does not sit here for a minute */
window.scrollTo(0, 0);
await new Promise(r => setTimeout(r, 300));
window.__probe.sweep(100);   /* one band per frame */

const max = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) - innerHeight;
for (let i = 0; i < 260 && window.scrollY < max - 1; i++) await new Promise(r => setTimeout(r, 250));
window.__probe.save();

const t = window.__probe.trace();
/* shot.js hard-kills Chrome, so localStorage never reaches disk - hand the
   trace to the server instead so tools/ev-dash.js has something to load */
try {
  await fetch('/_save?name=trace.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(t)))) });
} catch (e) {}
const idx = Object.keys(t.bands);
const recorded = idx.filter(k => t.bands[k].n > 0);

/* the worst band, and what it blames */
let worst = null;
for (const k of recorded) {
  const b = t.bands[k], fps = b.n / (b.t / 1000);
  if (!worst || fps < worst.fps) worst = { k, fps, b };
}
const hit = worst ? Object.entries(worst.b.src)
  .map(([k, ms]) => [t.names[k] || k, +(ms / worst.b.n).toFixed(2)])
  .sort((a, b) => b[1] - a[1]).slice(0, 8) : null;

return {
  ok: true,
  docH: t.docH, vh: t.vh, bandPx: t.band,
  bands: idx.length, recorded: recorded.length,
  secs: t.secs,
  nNames: Object.keys(t.names).length,
  namesSample: Object.values(t.names).slice(0, 14),
  worstBand: worst ? { y: +worst.k * t.band, fps: Math.round(worst.fps), worstMs: Math.round(worst.b.worst), lt: worst.b.lt } : null,
  worstHitters: hit,
  traceKB: Math.round((localStorage.getItem('cnvrt.perf.trace') || '').length / 1024),
  scrolledTo: window.scrollY, max
};
