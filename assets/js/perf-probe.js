/* =========================================================================
   PERF PROBE — per-scroll-band attribution, for tools/dash.html
   =========================================================================
   INERT unless armed. `?probe=1` in the URL arms it for one load and remembers
   it; `?probe=0` disarms. Disarmed it is one flag check and a return, which is
   why it can sit in <head> of the shipping page.

   It must be the FIRST script in the document. It works by wrapping
   requestAnimationFrame before anything has registered a callback with it, and
   by putting an accessor on window.SY so it can wrap `sub` at the moment the
   scroll engine assigns itself. Move it below either of those and it goes deaf.

   WHAT IT PRODUCES

   The page is cut into 100px scroll BANDS. For every frame the page renders
   while it is moving, the band under the reader at that moment accumulates:

     n / t        frames, and the milliseconds they took  ->  fps for the band
     worst        the single worst frame interval in it
     lt / ltms    long tasks, count and total
     src[key]     SELF time, in ms, charged to each thing that ran

   That last one is the point of the whole file, and it is why this exists
   rather than a DevTools trace: it answers "what is expensive HERE", at a
   scroll position you can go back to, in the page's own vocabulary.

   HOW THE ATTRIBUTION WORKS, AND WHAT IT CANNOT SEE

   Every rAF callback is wrapped and timed, and identified ONCE — the first
   time that function object is registered — by parsing the call site out of a
   stack. So a driver shows up as `draw  index.html:6672` whether or not
   anybody gave the function a name. Every SY subscriber is wrapped the same
   way, so the fifteen drivers hanging off the one scroll loop are fifteen
   separate lines rather than one.

   Time is SELF time. A callback that runs for 40ms and spends 32 of them
   inside a wrapped toDataURL is charged 8, and toDataURL is charged 32 — so
   the encode shows up as the encode instead of hiding inside whoever asked
   for it. Nesting is tracked with a stack, not guessed.

   Four synchronous stalls that are not rAF callbacks are wrapped by name,
   because they are where this kind of page actually dies: `toDataURL`,
   `toBlob`, `getImageData`, `readPixels`.

   It CANNOT see: style, layout, paint, compositing, GPU time, decode. All of
   that lands in `unattributed` in the dashboard — frame time minus the sum of
   what was charged — and on this page unattributed is frequently the largest
   line and is itself the finding. A fragment shader that costs 9ms a frame is
   9ms of unattributed; the JS that dispatched it costs 40 microseconds.

   THE HONEST CAVEAT, same as everywhere else in this project: read this in a
   real window that you are scrolling with your own hand. A hidden tab does not
   fire rAF; a scripted one is presentation-throttled. See PERF.md.
   ====================================================================== */
(function () {
  var KEY = 'cnvrt.probe', TRACE = 'cnvrt.perf.trace';
  var armed;
  try {
    var q = (location.search.match(/[?&]probe=([01])/) || [])[1];
    if (q != null) { armed = q === '1'; localStorage.setItem(KEY, q); }
    else armed = localStorage.getItem(KEY) === '1';
  } catch (e) { armed = false; }
  if (!armed) { window.__probe = { armed: false }; return; }

  var BAND = 100;      // px of scroll per bucket
  var GRACE = 250;     // ms after the last movement that still counts as scrolling
  var SAVE = 2000;     // ms between localStorage writes

  var bands = {};      // index -> record
  var names = {};      // key -> label
  var seen = 0;        // key counter
  var idOf = new WeakMap();

  var curBand = 0, moving = -1e9, lastY = -1, dirty = false, lastSave = 0;
  var stack = [];      // nested self-time accounting

  function band() {
    var b = bands[curBand];
    if (!b) b = bands[curBand] = { n: 0, t: 0, worst: 0, lt: 0, ltms: 0, src: {}, cnt: {} };
    return b;
  }
  function live() { return performance.now() - moving < GRACE; }

  /* ---- identity ----
     One stack parse per function object, ever. The wrapper is cached on the
     same WeakMap so re-registering the same callback 60 times a second costs a
     map lookup and nothing else. */
  function keyFor(fn, hint) {
    var k = idOf.get(fn);
    if (k) return k;
    k = 'k' + (++seen);
    var site = '';
    try {
      var st = (new Error()).stack || '';
      var m = st.split('\n');
      for (var i = 2; i < m.length && i < 7; i++) {
        /* The whole page is INLINE script, so a stack frame reads
           `http://host/index.html?probe=1:6672:5` — the query string sits
           between the extension and the line number and a naive
           `\.html:(\d+)` never matches. That is the difference between a
           dashboard that says `SY:anon` fifteen times and one that names
           every driver by its line. */
        var h = m[i].match(/([\w.-]+\.(?:html|js))(?:\?[^\s:)]*)?(?:#[^\s:)]*)?:(\d+):\d+/);
        if (h && h[1].indexOf('perf-probe') < 0) { site = h[1] + ':' + h[2]; break; }
      }
    } catch (e) {}
    names[k] = (hint ? hint + ':' : '') + (fn.name || 'anon') + (site ? '  ' + site : '');
    idOf.set(fn, k);
    return k;
  }

  function charge(k, ms) {
    if (!live()) return;
    var b = band();
    b.src[k] = (b.src[k] || 0) + ms;
    b.cnt[k] = (b.cnt[k] || 0) + 1;
    dirty = true;
  }

  /* Self time: the parent is told the FULL elapsed so it can subtract, and the
     child is charged elapsed-minus-its-own-children. */
  function run(k, fn, self, args) {
    var t0 = performance.now();
    stack.push(0);
    try {
      return fn.apply(self, args);
    } finally {
      var el = performance.now() - t0;
      var kids = stack.pop();
      if (stack.length) stack[stack.length - 1] += el;
      charge(k, el - kids);
    }
  }

  /* ---- rAF ---- */
  var RAF = window.requestAnimationFrame.bind(window);
  var wrapped = new WeakMap();
  window.requestAnimationFrame = function (cb) {
    if (typeof cb !== 'function') return RAF(cb);
    var w = wrapped.get(cb);
    if (!w) {
      var k = keyFor(cb);
      w = function (ts) { return run(k, cb, window, [ts]); };
      wrapped.set(cb, w);
    }
    return RAF(w);
  };

  /* ---- SY ----
     The engine assigns `window.SY = (function(){...})()` further down the file.
     Catching the assignment is the only way to get between the drivers and the
     one loop they all hang off. */
  var _SY;
  try {
    Object.defineProperty(window, 'SY', {
      configurable: true,
      get: function () { return _SY; },
      set: function (v) {
        _SY = v;
        if (v && typeof v.sub === 'function') {
          var sub = v.sub;
          v.sub = function (f) {
            var k = keyFor(f, 'SY');
            return sub.call(v, function (y) { return run(k, f, v, [y]); });
          };
        }
      }
    });
  } catch (e) {}

  /* ---- the four synchronous stalls ---- */
  function hook(obj, name, label) {
    if (!obj || !obj[name] || obj[name].__probed) return;
    var orig = obj[name];
    var k = 'x' + name;
    names[k] = label;
    var f = function () { return run(k, orig, this, arguments); };
    f.__probed = 1;
    try { obj[name] = f; } catch (e) {}
  }
  hook(window.HTMLCanvasElement && HTMLCanvasElement.prototype, 'toDataURL', 'toDataURL  (PNG encode, sync)');
  hook(window.HTMLCanvasElement && HTMLCanvasElement.prototype, 'toBlob', 'toBlob');
  hook(window.CanvasRenderingContext2D && CanvasRenderingContext2D.prototype, 'getImageData', 'getImageData  (readback)');
  hook(window.WebGLRenderingContext && WebGLRenderingContext.prototype, 'readPixels', 'readPixels  (GPU stall)');
  hook(window.WebGL2RenderingContext && WebGL2RenderingContext.prototype, 'readPixels', 'readPixels2  (GPU stall)');

  /* ---- long tasks ---- */
  try {
    new PerformanceObserver(function (list) {
      if (!live()) return;
      var e = list.getEntries(), b = band();
      for (var i = 0; i < e.length; i++) { b.lt++; b.ltms += e[i].duration; }
      dirty = true;
    }).observe({ entryTypes: ['longtask'] });
  } catch (e) {}

  /* ---- the frame clock ----
     Deliberately NOT wrapped — it is the measuring stick, and charging it to
     itself would be circular. It runs raw rAF. */
  var last = 0;
  function tick(now) {
    RAF(tick);
    var y = window.scrollY;
    if (y !== lastY) { lastY = y; moving = now; }
    curBand = (y / BAND) | 0;

    if (last) {
      var dt = now - last;
      if (dt < 1000 && live()) {
        var b = band();
        b.n++; b.t += dt;
        if (dt > b.worst) b.worst = dt;
        dirty = true;
      }
    }
    last = now;

    if (dirty && now - lastSave > SAVE) { lastSave = now; save(); }
  }
  RAF(tick);

  /* ---- geometry, measured on load and after fonts settle ---- */
  var IDS = ['hero', 'sec2', 'offerings', 'work', 'faq', 'contact'];
  var secs = [];
  function measure() {
    secs = [];
    for (var i = 0; i < IDS.length; i++) {
      var el = document.getElementById(IDS[i]);
      if (!el) continue;
      var r = el.getBoundingClientRect();
      secs.push([IDS[i], Math.round(r.top + window.scrollY), Math.round(r.height)]);
    }
    dirty = true;
  }
  addEventListener('load', function () { measure(); setTimeout(measure, 1200); });
  addEventListener('resize', measure, { passive: true });

  /* Two decimals everywhere. Full float precision triples the JSON for digits
     that are noise — 304 bands x ~20 keys has to fit in a 5MB localStorage. */
  function r2(x) { return Math.round(x * 100) / 100; }
  function compact() {
    var out = {};
    for (var i in bands) {
      var b = bands[i], o = { n: b.n, t: r2(b.t), worst: r2(b.worst), lt: b.lt, ltms: r2(b.ltms), src: {}, cnt: b.cnt };
      for (var k in b.src) if (b.src[k] >= 0.01) o.src[k] = r2(b.src[k]);
      out[i] = o;
    }
    return out;
  }

  function trace() {
    return {
      v: 1, band: BAND, at: new Date().toISOString(),
      docH: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
      vh: innerHeight, vw: innerWidth, dpr: devicePixelRatio,
      ua: navigator.userAgent, url: location.pathname + location.search,
      secs: secs, names: names, bands: compact()
    };
  }
  function save() {
    dirty = false;
    try { localStorage.setItem(TRACE, JSON.stringify(trace())); } catch (e) {}
  }
  addEventListener('pagehide', save);
  document.addEventListener('visibilitychange', function () { if (document.hidden) save(); });

  /* ---- Shift+S: sweep itself ----
     Steps the page down at a fixed px-per-frame from wherever it is to the
     bottom, so one keypress fills the whole map instead of 30,000px of
     trackpad. It runs in THIS window — the visible, focused, full-size one —
     which is the only place the numbers mean anything; a dashboard driving a
     background popup would be measuring Chrome's occlusion throttle.

     26px/frame is a fast but plausible flick: at 144Hz that is the whole
     30,400px page in about eight seconds, and every band gets frames. Slower
     is more samples per band, not more accuracy per frame. */
  var sweeping = 0;
  function sweep(px) {
    if (sweeping) return;
    sweeping = 1;
    var step = px || 26;
    (function go() {
      var max = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) - innerHeight;
      var y = window.scrollY;
      if (y >= max - 1) { sweeping = 0; save(); console.log('[probe] sweep done — reload tools/dash.html'); return; }
      window.scrollTo(0, Math.min(max, y + step));
      RAF(go);
    })();
  }
  addEventListener('keydown', function (e) {
    if (!e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) return;
    var t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (e.code === 'KeyS') { e.preventDefault(); window.scrollTo(0, 0); setTimeout(sweep, 400); }
  }, true);

  window.__probe = {
    armed: true,
    trace: trace,
    save: save,
    sweep: sweep,
    reset: function () { bands = {}; names = {}; seen = 0; idOf = new WeakMap(); save(); },
    disarm: function () { try { localStorage.setItem(KEY, '0'); } catch (e) {} location.reload(); }
  };
})();
