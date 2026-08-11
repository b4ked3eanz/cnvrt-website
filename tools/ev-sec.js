const id = (new URLSearchParams(location.search)).get('sec') || 'hero';
const el = document.getElementById(id);
if (el) el.scrollIntoView();
await new Promise(r=>setTimeout(r,2500));
return JSON.stringify({sec:id, vp:[innerWidth,innerHeight]});
