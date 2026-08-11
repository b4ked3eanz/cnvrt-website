/* What the work->pricing turn-out actually SPENDS, measured on the real GPU.

     node tools/perf-turn.js            all configurations
     node tools/perf-turn.js live nolens

   This is perf.js's harness pointed at a different band and a different set of
   configurations. Everything perf.js's header says about the measurement still
   applies and is worth re-reading before you believe a number out of here:

     A WINDOW DRIVEN FROM A SCRIPT IS PRESENTATION-THROTTLED. Frame INTERVAL
     measures the presentation cadence and nothing about the page - on this
     machine every configuration comes back at 62.5ms, including "nothing on
     screen at all". So this file reports WORK DURATION out of a trace, which
     is what the DevTools Performance panel actually shows, and never a frame
     rate. Read the durations. Ignore the gaps.

   THE BAND is the turn-out, computed in the page rather than hardcoded: the
   work section's pin runs wkTop -> wkTop + (wkH - innerHeight), and the turn is
   the last EXITV/TOT of it. EXITV is 480 of 1485vh, so the band is the last
   32.3% of the pin. A margin of one segment is taken on the front so the first
   frames are not the one-off cost of entering the section.

   THE CONFIGURATIONS. Each removes exactly one surface and touches nothing
   else, so a difference is attributable:

     live      everything on
     nolens    the viewport SVG filter detached from .work__lens
     nowave    the two pricing wave-grid canvases display:none
     noseed    the whole white frame (and so the cards) hidden
     bare      all three off - the turn with only the piece and the copy
     idle      parked at the end of the band, nothing scrolling: the floor

   live - nolens is the filter graph's own cost.
   live - nowave is what two WebGL contexts inside that filter cost.
   nolens - bare isolates the canvases with no filter over them, which is the
   comparison that says whether the two are multiplying or merely adding. */
const { spawn } = require('child_process');
const path = require('path');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9335;
const argv = process.argv.slice(2);
const HEADLESS = argv.indexOf('--headless') >= 0;
const URL_ = 'http://127.0.0.1:8743/index.html';
const W = 1920, H = 1080, STEPS = 150;
const ALL = ['live', 'nolens', 'nowave', 'noseed', 'bare', 'idle'];
const MODES = argv.filter(a => ALL.indexOf(a) >= 0);
const RUN = MODES.length ? MODES : ALL;

const profile = path.join(__dirname, 'pprofile');
const flags = [
  '--remote-debugging-port=' + PORT,
  '--user-data-dir=' + profile,
  '--window-size=' + W + ',' + H,
  '--window-position=0,0',
  '--force-device-scale-factor=1',
  '--hide-scrollbars',
  '--no-first-run', '--no-default-browser-check', '--disable-extensions',
  '--allow-file-access-from-files',
  /* Chrome stops issuing animation frames to a window it believes is covered,
     and a window spawned from a script generally is. Without these the probe's
     rAF loop never advances and every evaluate sits there until its timeout.
     Occlusion tracking is a battery optimisation with no business being on in
     a benchmark. */
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
  '--disable-background-timer-throttling',
  '--disable-features=CalculateNativeWinOcclusion',
  'about:blank'
];
if (HEADLESS) flags.unshift('--headless=new', '--enable-unsafe-swiftshader');
const chrome = spawn(CHROME, flags, { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function page() {
  for (let i = 0; i < 80; i++) {
    try {
      const j = await (await fetch('http://127.0.0.1:' + PORT + '/json/list')).json();
      const p = j.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
      if (p) return p;
    } catch (e) {}
    await sleep(250);
  }
  throw new Error('chrome never came up on ' + PORT);
}

const PROBE = mode => `(async () => {
  const M = ${JSON.stringify(mode)};
  const work = document.getElementById('work');
  const lens = document.getElementById('wkLens');
  const seed = document.getElementById('wkSeed');
  const cvs  = [].slice.call(document.querySelectorAll('.price__cv'));
  const wkTop = work.getBoundingClientRect().top + scrollY;
  const span  = work.offsetHeight - innerHeight;
  /* the turn is the last 480 of 1485vh; take a little more so the band starts
     before the frame is born rather than on top of it */
  const y0 = Math.round(wkTop + span * 0.63);
  const y1 = Math.round(wkTop + span);

  const saved = { filter: lens.style.filter, seedVis: seed.style.visibility,
                  cv: cvs.map(c => c.style.display) };
  /* .work__lens carries the filter in CSS; an inline 'none' detaches the whole
     graph without touching anything else in the subtree */
  if (M === 'nolens' || M === 'bare') lens.style.filter = 'none';
  if (M === 'nowave' || M === 'bare') cvs.forEach(c => { c.style.display = 'none'; });
  if (M === 'noseed' || M === 'bare') {
    /* setExit writes visibility every frame, so hiding it has to survive that:
       opacity is not overwritten and takes the paint out just as effectively */
    seed.style.opacity = '0';
  }

  /* rAF with a deadline. A window that goes occluded stops issuing frames and
     a probe built on a bare rAF then hangs forever with nothing to show. */
  const F = () => new Promise(r => {
    let done = false;
    const to = setTimeout(() => { if (!done) { done = true; r(performance.now()); } }, 250);
    requestAnimationFrame(t => { if (!done) { done = true; clearTimeout(to); r(t); } });
  });

  scrollTo(0, M === 'idle' ? y1 : y0);
  for (let i = 0; i < 40; i++) await F();      // let the section settle first
  for (let i = 0; i <= ${STEPS}; i++) {
    if (M !== 'idle') scrollTo(0, y0 + (y1 - y0) * i / ${STEPS});
    await F();
  }

  lens.style.filter = saved.filter;
  seed.style.opacity = '';
  seed.style.visibility = saved.seedVis;
  cvs.forEach((c, i) => { c.style.display = saved.cv[i]; });
  return { mode: M, y0, y1 };
})()`;

(async () => {
  let code = 0;
  try {
    const p = await page();
    const ws = new WebSocket(p.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    let id = 0; const pending = new Map();
    ws.onmessage = ev => {
      const m = JSON.parse(ev.data);
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    };
    const send = (method, params, ms) => new Promise(res => {
      const i = ++id;
      const to = setTimeout(() => {
        if (pending.has(i)) { pending.delete(i); res({ timeout: true }); }
      }, ms || 120000);
      pending.set(i, m => { clearTimeout(to); res(m); });
      ws.send(JSON.stringify({ id: i, method, params: params || {} }));
    });
    const evalp = expr => send('Runtime.evaluate',
      { expression: expr, awaitPromise: true, returnByValue: true })
      .then(r => r.timeout ? { error: 'timed out' }
        : (r.result && r.result.exceptionDetails)
        ? { error: JSON.stringify(r.result.exceptionDetails.exception || r.result.exceptionDetails.text) }
        : (r.result && r.result.result ? r.result.result.value : null));

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Page.navigate', { url: URL_ });
    await sleep(9000);

    const CATS = ['disabled-by-default-devtools.timeline',
                  'disabled-by-default-devtools.timeline.frame',
                  'blink', 'cc', 'gpu', 'viz', 'benchmark'].join(',');
    /* SUMMING EVERY EVENT IS THE SAME TRAP perf.js FELL INTO, one level down.
       A first run of this reported `idle` as MORE expensive than `live` -
       211857ms against 315094ms of "total" - because the biggest events in the
       trace are not work at all. DXGISwapChainImageBacking::Present, SwapBuffers
       and Graphics.Pipeline are the swap chain WAITING, and a page that is doing
       nothing waits longer, so they run backwards against the thing being
       measured. RunTask and Scheduler::RunTask are outer wrappers and would
       double-count everything inside them on top of that.

       So the metric is a WHITELIST of real work, and nothing else is counted. */
    const KEYS = ['RasterTask', 'Paint', 'PaintImage', 'Layerize', 'UpdateLayer',
                  'UpdateLayerTree', 'DrawFrame', 'CompositeLayers',
                  'FunctionCall', 'EvaluateScript', 'Layout', 'UpdateLayoutTree',
                  'GPUTask', 'ImageDecodeTask', 'Decode Image', 'Commit',
                  'SkCanvas::drawImageRect'];
    const rows = [];
    for (const mode of RUN) {
      const events = [];
      const grab = ev => {
        const m = JSON.parse(ev.data);
        if (m.method === 'Tracing.dataCollected') events.push.apply(events, m.params.value);
      };
      ws.addEventListener('message', grab);
      await send('Tracing.start', { categories: CATS, transferMode: 'ReportEvents' });
      const r = await evalp(PROBE(mode));
      const done = new Promise(res => {
        const h = ev => {
          const m = JSON.parse(ev.data);
          if (m.method === 'Tracing.tracingComplete') { ws.removeEventListener('message', h); res(); }
        };
        ws.addEventListener('message', h);
      });
      await send('Tracing.end');
      await done;
      ws.removeEventListener('message', grab);

      const by = {};
      for (const e of events) {
        if (e.ph !== 'X' || !e.dur) continue;
        by[e.name] = (by[e.name] || 0) + e.dur / 1000;
      }
      const named = {};
      let work = 0;
      for (const k of KEYS) if (by[k]) { named[k] = +by[k].toFixed(1); work += by[k]; }
      rows.push({ mode, band: r && r.y0 ? r.y0 + '..' + r.y1 : '?',
                  work: +work.toFixed(1), named });
      console.log(mode.padEnd(7) + ' work ' + work.toFixed(0).padStart(6) + 'ms  ' +
        Object.entries(named).sort((a, b) => b[1] - a[1]).slice(0, 6)
          .map(([k, v]) => k + ' ' + v.toFixed(0)).join('  '));
    }

    console.log('\n--- full ---');
    console.log(JSON.stringify(rows, null, 1));
    const get = m => (rows.find(r => r.mode === m) || {}).work;
    const cat = (m, k) => { const r = rows.find(x => x.mode === m); return r && r.named[k] || 0; };
    const d = (a, b, label) => {
      if (get(a) == null || get(b) == null) return;
      const parts = KEYS.filter(k => Math.abs(cat(a, k) - cat(b, k)) > 30)
        .map(k => k + ' ' + (cat(a, k) - cat(b, k)).toFixed(0));
      console.log((a + ' - ' + b).padEnd(16) + (get(a) - get(b)).toFixed(0).padStart(7) +
                  'ms  ' + label + (parts.length ? '\n' + ' '.repeat(24) + parts.join('  ') : ''));
    };
    console.log('\n--- what each surface costs over the band ---');
    d('live', 'nolens', 'the SVG filter graph');
    d('live', 'nowave', 'two WebGL contexts inside it');
    d('live', 'noseed', 'the white frame and its contents');
    d('nolens', 'bare', 'the canvases with NO filter over them');
    d('live', 'bare', 'everything this pass touches');
    d('bare', 'idle', 'the rest of the turn');
    ws.close();
  } catch (e) {
    console.log('FAILED: ' + e.message);
    code = 1;
  } finally {
    try { chrome.kill(); } catch (e) {}
    setTimeout(() => process.exit(code), 300);
  }
})();
