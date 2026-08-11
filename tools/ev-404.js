/* Which resource is 404ing. PerformanceResourceTiming gives responseStatus in
   recent Chrome; where it doesn't, a zero transfer size on a same-origin entry
   that never decoded is the tell. */
const sec = document.getElementById('contact');
if (sec) sec.scrollIntoView();
await new Promise(r => setTimeout(r, 1200));

const bad = performance.getEntriesByType('resource')
  .filter(e => e.responseStatus ? e.responseStatus >= 400
                                : (e.transferSize === 0 && e.decodedBodySize === 0 && e.duration > 0))
  .map(e => ({ name: e.name.replace(location.origin, ''), status: e.responseStatus, type: e.initiatorType }));

const brokenImgs = [...document.images]
  .filter(i => i.complete && i.naturalWidth === 0 && i.src)
  .map(i => i.getAttribute('src'));

return JSON.stringify({ bad, brokenImgs }, null, 1);
