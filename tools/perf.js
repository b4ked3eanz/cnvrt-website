/* Frame cost of the glass ring, measured rather than asserted.

     node tools/perf.js [--headless] [runs]

   GLASS.md has said "not measured on real hardware" since the ring landed,
   because everything up to now went through tools/shot.js, which is
   --headless=new with SwiftShader — software rasterisation, where a number
   means nothing. This launches a REAL window on the real GPU and drives it
   over the DevTools protocol.

   THE MEASUREMENT IS A COMPARISON, not an absolute. Three configurations over
   the same scroll, in the same session, back to back:

     live     everything on
     nofilter backdrop-filter:none on the refract layer, nothing else touched
     hidden   all the glass layers display:none

   `live` minus `nofilter` is the filter's own cost and nothing else's;
   `nofilter` minus `hidden` is what the remaining three layers cost to
   composite; `hidden` is the rest of the page, which is the floor. Any
   optimisation has to move the first difference or it is not an optimisation.

   Frames are timed in the page from requestAnimationFrame timestamps while
   the scroll is driven one step per frame, which is the same path a real
   wheel scroll takes through this site (it has no smoother — see the driver).
   Reported as median and 95th percentile, plus how many frames went over
   16.7ms, which is the number that decides whether it is butter smooth.

   ---------------------------------------------------------------------------
   READ THIS BEFORE BELIEVING A NUMBER OUT OF THIS FILE.

   Run on 2026-08-08 against ANGLE / Intel UHD 620 / D3D11, every configuration
   came back at a median of 62.5ms and would not move:

     live 62.5   nofilter 62.5   hidden 62.5   elsewhere 62.6   idle 62.6

   `idle` holds the scroll still and `hidden` removes the ring entirely, so a
   number that is identical across all five is not a number about the page. A
   bisect confirmed it — hiding EVERY canvas (1.9 megapixels of it, including
   the full-viewport hero shader) moved the median by 8ms, and restoring them
   moved it by less than that in the other direction, i.e. inside the noise.

   `--trace` says why. Across a 35-second window the renderer spends 11-13
   SECONDS inside DXGISwapChainImageBacking::Present, and it spends the same
   11-13 seconds there with the glass live, with the filter off, and with the
   ring not in the DOM. That is the swap chain WAITING to be presented, not
   work. A window driven from a script is not necessarily being presented at
   the display's rate, and when it is not, frame INTERVAL measures the
   presentation cadence and nothing else. 62.5ms is 9 intervals of a 144Hz
   panel, which is what that looks like.

   So: this harness can tell you what the renderer SPENDS (use --trace, and
   read the durations, not the gaps). It cannot tell you the frame rate. The
   plan's §5.6 baseline — scroll the section, watch the frames pane, run it
   again with backdrop-filter forced to none — still wants a human with
   DevTools open on a normal foreground window. It is the one item on the
   plan that did not survive automation, and guessing at it is exactly how
   the previous three passes went wrong.
   --------------------------------------------------------------------------- */
const { spawn } = require('child_process');
const path = require('path'), fs = require('fs');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9334;
const argv = process.argv.slice(2);
const HEADLESS = argv.indexOf('--headless') >= 0;
const RUNS = +(argv.filter(a => !a.startsWith('--'))[0] || 3);
const WHO = argv.filter(a => /\.js$/.test(a))[0] || null;
const TRACE = argv.indexOf('--trace') >= 0;
const URL_ = 'http://127.0.0.1:8743/index.html';
const W = 1920, H = 1080;
/* the ring's climb: it enters low and crosses the viewport over this band,
   measured with tools/shot.js — see the scan in the probe */
const Y0 = 8600, Y1 = 11200, STEPS = 180;

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
  /* WITHOUT THESE THE MEASUREMENT DOES NOT HAPPEN AT ALL. Chrome stops
     issuing animation frames to a window it believes is covered, and a window
     spawned from a script generally is — so the probe's rAF loop never
     advanced, every evaluate sat there until its timeout, and the first run of
     this produced a header and three blank rows. Occlusion tracking is a
     battery optimisation and it has no business being on in a benchmark. */
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

/* Runs in the page. Scrolls Y0 -> Y1 one step per animation frame and records
   the gap between frames. The first 12 frames are dropped: the first scroll
   into a section is a one-off (layer creation, first filter evaluation, first
   raster of the copy underneath) and averaging it in hides everything after. */
const PROBE = (mode, y0, y1, steps) => `(async () => {
  const glass = [].slice.call(document.querySelectorAll('.off__glass'));
  const refract = document.querySelector('.off__glass--refract');
  const saved = { bf: refract.style.backdropFilter, disp: glass.map(g => g.style.display) };
  if (${JSON.stringify('nofilter')} === ${JSON.stringify(mode)}) {
    refract.style.backdropFilter = refract.style.webkitBackdropFilter = 'none';
  }
  if (${JSON.stringify('hidden')} === ${JSON.stringify(mode)}) {
    glass.forEach(g => { g.style.display = 'none'; });
  }
  /* rAF WITH A DEADLINE. A window that goes occluded stops issuing animation
     frames entirely, and a probe built on a bare rAF then hangs forever with
     nothing to show for it. Falling back after 250ms turns that into a
     visible outlier in the numbers, which is information. */
  const F = () => new Promise(r => {
    let done = false;
    const to = setTimeout(() => { if (!done) { done = true; r(performance.now()); } }, 250);
    requestAnimationFrame(t => { if (!done) { done = true; clearTimeout(to); r(t); } });
  });
  /* park at the start and let the section settle before timing anything */
  scrollTo(0, ${y0});
  for (let i = 0; i < 30; i++) await F();
  const dt = [];
  const still = ${JSON.stringify('idle')} === ${JSON.stringify(mode)};
  let last = performance.now();
  for (let i = 0; i <= ${steps}; i++) {
    /* idle holds the scroll still and times the same number of frames. It is
       the floor: whatever the page costs when nothing is being asked of it.
       Without it there is no way to tell a slow page from a slow probe. */
    if (!still) scrollTo(0, ${y0} + (${y1} - ${y0}) * i / ${steps});
    const t = await F();
    dt.push(t - last); last = t;
  }
  refract.style.backdropFilter = refract.style.webkitBackdropFilter = saved.bf;
  glass.forEach((g, i) => { g.style.display = saved.disp[i]; });
  const d = dt.slice(12).sort((a, b) => a - b);
  const q = f => d[Math.min(d.length - 1, Math.floor(d.length * f))];
  return { mode: ${JSON.stringify(mode)}, n: d.length,
           med: +q(0.5).toFixed(2), p95: +q(0.95).toFixed(2), max: +d[d.length-1].toFixed(2),
           over17: d.filter(x => x > 16.7).length,
           over33: d.filter(x => x > 33.4).length };
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
    /* A HARD TIMEOUT ON EVERY CALL. Without one, an evaluate whose promise
       never settles — a page that stops issuing animation frames because the
       window went occluded, which is exactly what happened the first time this
       was run — hangs the whole script with no output and no clue why. */
    const send = (method, params, ms) => new Promise(res => {
      const i = ++id;
      const to = setTimeout(() => {
        if (pending.has(i)) { pending.delete(i); res({ timeout: true }); }
      }, ms || 90000);
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
    await sleep(7000);

    /* ---- THE TRACE ------------------------------------------------------
       The rAF-cadence measurement above turned out not to measure what it
       claimed. Every configuration came back at the same 62.5ms, including
       "every canvas on the page hidden" and "nothing scrolling at all" — and a
       number that does not move when you remove 1.9 megapixels of compositing
       is not a number about compositing. A window driven from a script is not
       necessarily being PRESENTED, so its animation frames arrive on a fixed
       slow cadence no matter what the page costs. Frame INTERVAL was the wrong
       observable.

       Work DURATION is the right one, and it is what DevTools Performance
       actually shows. Take a trace over the same scroll, add up how long the
       renderer spends in each kind of work, and compare configurations. That
       survives a throttled presentation because it measures the work, not the
       gaps between frames. */
    if (TRACE) {
      const CATS = ['disabled-by-default-devtools.timeline',
                    'disabled-by-default-devtools.timeline.frame',
                    'blink', 'cc', 'gpu', 'viz', 'benchmark'].join(',');
      const rows = [];
      for (const mode of ['live', 'nofilter', 'hidden']) {
        const events = [];
        ws.addEventListener('message', function grab(ev) {
          const m = JSON.parse(ev.data);
          if (m.method === 'Tracing.dataCollected') events.push.apply(events, m.params.value);
        });
        await send('Tracing.start', { categories: CATS, transferMode: 'ReportEvents',
                                      options: 'sampling-frequency=10000' });
        await evalp(PROBE(mode, Y0, Y1, STEPS));
        const done = new Promise(res => {
          const h = ev => { const m = JSON.parse(ev.data);
            if (m.method === 'Tracing.tracingComplete') { ws.removeEventListener('message', h); res(); } };
          ws.addEventListener('message', h);
        });
        await send('Tracing.end');
        await done;
        const by = {};
        for (const e of events) {
          if (e.ph !== 'X' || !e.dur) continue;
          by[e.name] = (by[e.name] || 0) + e.dur / 1000;
        }
        const top = Object.entries(by).sort((a2, b2) => b2[1] - a2[1]).slice(0, 14);
        rows.push({ mode, total: +Object.values(by).reduce((x, y) => x + y, 0).toFixed(1),
                    top: top.map(([k, v]) => k + ' ' + v.toFixed(1)) });
        console.log('\n== ' + mode + ' ==');
        for (const [k, v] of top) console.log('   ' + v.toFixed(1).padStart(9) + ' ms  ' + k);
      }
      /* the comparison, on the events that are actually about drawing */
      const KEYS = ['RasterTask', 'Draw', 'GPUTask', 'Commit', 'PaintSetup', 'Paint',
                    'CompositeLayers', 'UpdateLayer', 'UpdateLayerTree', 'Layerize'];
      console.log('\nname                     live   nofilter    hidden');
      const get = (r, k) => { const f = r.top.find(x => x.startsWith(k + ' ')); return f ? f.slice(k.length + 1) : '-'; };
      for (const k of KEYS) {
        const line = rows.map(r => String(get(r, k)).padStart(10)).join('');
        if (line.trim().replace(/-/g, '')) console.log(k.padEnd(22) + line);
      }
      ws.close();
      try { chrome.kill(); } catch (e) {}
      return setTimeout(() => process.exit(0), 300);
    }

    /* Optional second job: instead of the three-way comparison, attribute the
       frame. Pass a script path as the second argument. */
    if (WHO) {
      const src = require('fs').readFileSync(WHO, 'utf8');
      const out = await evalp('(async()=>{' + src + '})()');
      console.log(JSON.stringify(out, null, 1));
      ws.close();
      try { chrome.kill(); } catch (e) {}
      return setTimeout(() => process.exit(0), 300);
    }
    const gpu = await evalp(`(()=>{const c=document.createElement('canvas').getContext('webgl2')||document.createElement('canvas').getContext('webgl');
      if(!c)return 'no webgl'; const e=c.getExtension('WEBGL_debug_renderer_info');
      return e ? c.getParameter(e.UNMASKED_RENDERER_WEBGL) : c.getParameter(c.RENDERER);})()`);
    console.log('renderer : ' + gpu);
    console.log('mode     : ' + (HEADLESS ? 'headless (software raster — relative only)' : 'headed, real GPU'));
    console.log('');
    console.log('cfg        med    p95    max   >16.7  >33.4');

    /* A CONTROL BAND, somewhere else on the page. Without it the three
       numbers above have no scale: "62ms with the glass hidden" could mean the
       section is heavy, or the page is, or the machine is. Scrolling a band
       that contains no glass at all, with everything else exactly as it is,
       separates those. */
    const acc = {};
    const BAND = { live: [Y0, Y1], nofilter: [Y0, Y1], hidden: [Y0, Y1],
                   elsewhere: [2000, 4600], idle: [Y0, Y1] };
    for (let r = 0; r < RUNS; r++) {
      for (const mode of ['live', 'nofilter', 'hidden', 'elsewhere', 'idle']) {
        const out = await evalp(PROBE(mode, BAND[mode][0], BAND[mode][1], STEPS));
        if (!out || out.error) { console.log(mode + ' FAILED ' + JSON.stringify(out)); code = 1; continue; }
        (acc[mode] = acc[mode] || []).push(out);
        console.log('  run ' + (r + 1) + ' ' + mode.padEnd(9) +
          ' med ' + out.med + '  p95 ' + out.p95 + '  >16.7 ' + out.over17);
        await sleep(300);
      }
    }
    const med = a => { const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; };
    for (const mode of ['live', 'nofilter', 'hidden', 'elsewhere', 'idle']) {
      const rs = acc[mode] || [];
      if (!rs.length) continue;
      console.log(mode.padEnd(9) +
        String(med(rs.map(x => x.med))).padStart(6) +
        String(med(rs.map(x => x.p95))).padStart(7) +
        String(med(rs.map(x => x.max))).padStart(7) +
        String(med(rs.map(x => x.over17))).padStart(7) +
        String(med(rs.map(x => x.over33))).padStart(7));
    }
    if (acc.live && acc.nofilter) {
      const d = med(acc.live.map(x => x.med)) - med(acc.nofilter.map(x => x.med));
      console.log('\nthe filter costs ' + d.toFixed(2) + ' ms/frame at the median');
    }
    if (acc.nofilter && acc.hidden) {
      const d = med(acc.nofilter.map(x => x.med)) - med(acc.hidden.map(x => x.med));
      console.log('the other layers cost ' + d.toFixed(2) + ' ms/frame at the median');
    }
    ws.close();
  } catch (e) {
    console.log('FAILED: ' + e.message); code = 1;
  } finally {
    try { chrome.kill(); } catch (e) {}
    setTimeout(() => process.exit(code), 300);
  }
})();
