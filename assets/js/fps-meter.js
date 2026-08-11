/* =========================================================================
   LIVE FRAME METER — dev overlay, top-left
   =========================================================================
   Shift+F toggles it, Shift+R resets the worst-frame record. The choice is
   remembered in localStorage; `?fps=0` / `?fps=1` in the URL overrides it for
   one load. Delete the one <script src> line in index.html to remove it.

   WHAT IT MEASURES, AND WHERE THE NUMBER IS REAL

   The interval between the frames the compositor actually presented, read off
   the rAF timestamp. That is the honest answer to "is this smooth" in a REAL
   window that a person is scrolling by hand, and that is the ONLY place the
   number means anything:

     - a hidden tab does not fire rAF at all, so the automation tab (tools/
       shot.js) reads a frozen meter;
     - a window driven from a script is presentation-throttled, so the interval
       there measures the harness's cadence and nothing about the page. On this
       machine every configuration, including "nothing on screen at all", came
       back at 62.5 ms. See PERF.md `## How to measure`.

   So: read this with your own eyes on your own screen. Do not quote it out of
   a harness, and do not let a harness quote it back at you.

   THE OBSERVER EFFECT, stated up front. This loop asks for a frame every frame
   for as long as it is visible, so a settled page no longer goes fully idle —
   SY's loop stops the moment it catches up to scrollY, and this one does not.
   The per-frame cost is one subtraction and one array store; the readout is
   rebuilt 5x/sec, not 60, and the whole loop is torn down when you hide it. If
   you want a true idle measurement, hide it first.

   WHAT EACH FIELD IS FOR

     fps        frames counted over the window, not 1/mean. Throughput.
     Hz         the panel, inferred from the fastest frames actually seen.
                Everything is coloured against THIS, not against 60 — on a
                144Hz screen a steady 60 is a real drop, and on a 60Hz one it
                is perfect. Snapped to a standard rate when it is within 6%.
     ms         median frame interval, then p95, then the worst in the window.
                Median stays readable while p95 and max carry the hitches.
     bars       every frame in the window, oldest left, square-root scaled:
                the faint line is one clean frame, half height is 4x that, full
                height is 16x. A hitch is a spike, a bad stretch is a raised
                floor — they look different on purpose.
     LT         long tasks (>50ms of blocking main thread) in the last 2s, and
                the worst of them. This is the field that catches the offerings
                ring: 168 synchronous toDataURL calls, 360-615 ms each.
     y          scroll position in px, in viewport heights, and the section it
                lands in — so a hitch has an address you can scroll back to.
     max        worst single frame since load with the y it happened at.
     drop       cumulative frames that took longer than 1.5x the panel.
     heap       Chrome only. Watch it climb across a full scroll for a leak.
   ====================================================================== */
(function () {
  if (!window.requestAnimationFrame) return;

  var KEY  = 'cnvrt.fps';
  var N    = 180;             // ring length; also the sparkline width in px
  var TICK = 200;             // ms between readout rebuilds
  var LTW  = 2000;            // long-task window, ms

  /* ---- visibility, decided once ----
     URL wins for this load, then the remembered choice, then on by default. */
  var q = (location.search.match(/[?&]fps=([01])/) || [])[1];
  var on;
  if (q != null) on = q === '1';
  else { try { on = localStorage.getItem(KEY) !== '0'; } catch (e) { on = true; } }

  /* ---- the ring ----
     Every frame writes one interval. Nothing is allocated per frame. */
  var dts   = new Float64Array(N);
  var head  = 0, filled = 0;
  var sortBuf = new Float64Array(N);

  var last = 0, drops = 0, worst = 0, worstY = 0, running = false, raf = 0;
  var nextTick = 0;

  /* ---- the panel interval ----
     Inferred rather than assumed, because nothing exposes the refresh rate.
     p20 of the window is the fastest the machine is actually presenting at; a
     hard min() would latch onto one short interval and never let go, and p20
     of 180 frames cannot be moved by a single outlier.

     It only ever ratchets DOWN, to the best rate seen since load. That is the
     whole point: if it were allowed to drift up during a bad stretch, the bad
     stretch would recolour itself green. A display that genuinely changed —
     dragged to a 60Hz external — needs a Shift+R.

     Read the ms next to the Hz. If it says 90Hz on a 144Hz panel, the page has
     been unable to hit 144 since load, and that is itself the finding. */
  var ideal = 1e9;
  var RATES = [240, 165, 144, 120, 90, 75, 72, 60, 50, 30];
  function snap(hz) {
    for (var i = 0; i < RATES.length; i++) {
      if (Math.abs(hz - RATES[i]) / RATES[i] < 0.06) return RATES[i];
    }
    return Math.round(hz);
  }

  /* ---- long tasks ----
     PerformanceObserver reports anything that blocked the main thread for more
     than 50ms. Chrome only; the field just stays at 0 elsewhere. */
  var lts = [];
  try {
    new PerformanceObserver(function (list) {
      var e = list.getEntries();
      for (var i = 0; i < e.length; i++) lts.push([e[i].startTime, e[i].duration]);
    }).observe({ entryTypes: ['longtask'] });
  } catch (e) {}

  /* ---- section addresses ----
     Measured on load and on resize only. Nothing here touches layout inside
     the frame loop — a meter that forces a reflow per frame is measuring
     itself. */
  var IDS = ['hero', 'sec2', 'offerings', 'work', 'faq', 'contact'];
  var secs = [];
  function measureSecs() {
    secs.length = 0;
    for (var i = 0; i < IDS.length; i++) {
      var el = document.getElementById(IDS[i]);
      if (!el) continue;
      var r = el.getBoundingClientRect();
      secs.push([IDS[i], r.top + window.scrollY, r.height]);
    }
  }
  function secAt(y) {
    var mid = y + innerHeight * 0.5, name = '-';
    for (var i = 0; i < secs.length; i++) {
      if (mid >= secs[i][1] && mid < secs[i][1] + secs[i][2]) return secs[i][0];
      if (mid >= secs[i][1]) name = secs[i][0];
    }
    return name;
  }

  /* ---- DOM. Built here so the whole feature is one file and one script tag,
     with nothing to unpick out of the page's own markup or stylesheet. ---- */
  var box, elFps, elHz, elMs, elLt, elY, elFoot, cv, cx, dpr = 1;
  var cache = ['', '', '', '', '', ''];

  function build() {
    var css = document.createElement('style');
    css.id = 'fpsCss';
    css.textContent =
      '#fpsBox{position:fixed;left:10px;top:10px;z-index:2147483647;' +
      'pointer-events:none;user-select:none;contain:layout style;' +
      'padding:6px 8px 7px;border-radius:5px;width:196px;' +
      'background:rgba(6,5,4,.78);border:1px solid rgba(250,229,216,.14);' +
      'box-shadow:0 2px 14px rgba(0,0,0,.45);' +
      'font:11px/1.35 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;' +
      'font-variant-numeric:tabular-nums;color:rgba(250,229,216,.52);' +
      '-webkit-font-smoothing:antialiased;transition:border-color .12s linear}' +
      '#fpsBox.is-stall{border-color:#FF4208}' +
      '#fpsBox b{font-weight:400;font-size:19px;line-height:1;' +
      'letter-spacing:-.02em;color:#FAE5D8}' +
      '#fpsBox .r{display:flex;justify-content:space-between;align-items:baseline}' +
      '#fpsBox canvas{display:block;width:' + N + 'px;height:26px;margin:5px 0 4px;' +
      'background:rgba(250,229,216,.045);border-radius:2px}' +
      '#fpsBox .d{opacity:.62}' +
      '@media print{#fpsBox{display:none}}';
    document.head.appendChild(css);

    box = document.createElement('div');
    box.id = 'fpsBox';
    box.innerHTML =
      '<div class="r"><span><b id="fpsN">--</b> fps</span><span id="fpsHz"></span></div>' +
      '<div id="fpsMs"></div>' +
      '<canvas id="fpsCv"></canvas>' +
      '<div id="fpsLt"></div>' +
      '<div id="fpsY"></div>' +
      '<div id="fpsFoot" class="d"></div>';
    document.body.appendChild(box);

    elFps = box.querySelector('#fpsN');
    elHz  = box.querySelector('#fpsHz');
    elMs  = box.querySelector('#fpsMs');
    elLt  = box.querySelector('#fpsLt');
    elY   = box.querySelector('#fpsY');
    elFoot= box.querySelector('#fpsFoot');
    cv    = box.querySelector('#fpsCv');
    sizeCanvas();
  }

  function sizeCanvas() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    cv.width  = Math.round(N * dpr);
    cv.height = Math.round(26 * dpr);
    cx = cv.getContext('2d');
    cx.scale(dpr, dpr);
  }

  /* good / warn / bad, against the panel rather than against 60 */
  function tone(dt) {
    if (dt <= ideal * 1.5) return '#8CE0A8';
    if (dt <= ideal * 3)   return '#FFC24A';
    return '#FF4208';
  }

  function set(el, i, s) { if (cache[i] !== s) { cache[i] = s; el.textContent = s; } }

  /* Square root, not linear. Full height is SIXTEEN panel intervals, which
     puts one clean frame at exactly a quarter — the faint line — and still
     leaves a 4x hitch somewhere to go (half height) instead of clipping it
     against a 100ms stall. Linear on a 144Hz panel saturates at 36fps and
     every bad frame then looks the same as every other bad frame. */
  function paintSpark() {
    var h = 26, top = ideal * 16;
    cx.clearRect(0, 0, N, h);
    cx.fillStyle = 'rgba(250,229,216,.16)';
    cx.fillRect(0, h - h * 0.25, N, 1);
    var n = filled;
    for (var i = 0; i < n; i++) {
      var dt = dts[(head - n + i + N * 2) % N];
      var bh = Math.max(1, Math.min(Math.sqrt(dt / top), 1) * h);
      cx.fillStyle = tone(dt);
      cx.fillRect(N - n + i, h - bh, 1, bh);
    }
  }

  function readout(now) {
    var n = filled;
    if (!n) return;

    /* One pass to copy and total, then an in-place numeric sort of the typed
       view — no per-tick garbage beyond the subarray handle. */
    var span = 0;
    for (var i = 0; i < n; i++) { var v = dts[(head - n + i + N * 2) % N]; sortBuf[i] = v; span += v; }
    var s = sortBuf.subarray(0, n).sort();
    var p50 = s[(n * 0.5) | 0], p95 = s[Math.min(n - 1, (n * 0.95) | 0)], mx = s[n - 1];

    var p20 = s[(n * 0.2) | 0];
    if (p20 > 1 && p20 < ideal) ideal = p20;

    /* fps as throughput: frames in the window over the time they took */
    var fps = span > 0 ? Math.round(n / (span / 1000)) : 0;

    var hz = snap(1000 / ideal);
    elFps.style.color = fps >= hz * 0.9 ? '#FAE5D8' : (fps >= hz * 0.5 ? '#FFC24A' : '#FF4208');
    set(elFps, 0, String(fps));
    set(elHz,  1, hz + 'Hz  ' + ideal.toFixed(1) + 'ms');
    set(elMs,  2, p50.toFixed(1) + 'ms   p95 ' + p95.toFixed(1) + '   hi ' + mx.toFixed(0));

    /* long tasks still inside the window */
    var keep = 0, ltMax = 0;
    for (var k = 0; k < lts.length; k++) {
      if (now - lts[k][0] <= LTW) { lts[keep++] = lts[k]; if (lts[k][1] > ltMax) ltMax = lts[k][1]; }
    }
    lts.length = keep;
    elLt.style.color = keep ? '#FF4208' : '';
    set(elLt, 3, keep ? ('LT ' + keep + ' x ' + ltMax.toFixed(0) + 'ms  (2s)') : 'LT 0');

    var y = window.scrollY;
    set(elY, 4, 'y ' + Math.round(y) + '  ' + Math.round(y / innerHeight * 100) + 'vh  ' + secAt(y));

    var foot = 'max ' + worst.toFixed(0) + 'ms @' + Math.round(worstY) + '  drop ' + drops;
    if (performance.memory) foot += '  ' + (performance.memory.usedJSHeapSize / 1048576).toFixed(0) + 'MB';
    set(elFoot, 5, foot);

    paintSpark();
    /* the red edge is for a stall you would FEEL, not for a dropped frame:
       eight panel intervals, and never under 100ms whatever the panel is */
    box.classList.toggle('is-stall', mx > Math.max(100, ideal * 8));
  }

  function frame(now) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    if (last) {
      var dt = now - last;
      /* A tab that was backgrounded returns one enormous interval that is not
         a hitch, it is the time you spent elsewhere. Drop anything over a
         second rather than let it own the max for the rest of the session. */
      if (dt < 1000) {
        var y = window.scrollY;
        dts[head] = dt; head = (head + 1) % N;
        if (filled < N) filled++;
        if (dt > ideal * 1.5) drops++;
        if (dt > worst) { worst = dt; worstY = y; }
      }
    }
    last = now;
    if (now >= nextTick) { nextTick = now + TICK; readout(now); }
  }

  function start() {
    if (running) return;
    running = true; last = 0; nextTick = 0;
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function show(v) {
    on = !!v;
    try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) {}
    if (on) { if (!box) build(); box.style.display = ''; measureSecs(); start(); }
    else if (box) { box.style.display = 'none'; stop(); }
  }

  /* Shift+R. Clears the panel inference too, so this is also how you tell it
     you moved the window to a different screen. */
  function reset() {
    head = 0; filled = 0; drops = 0; worst = 0; worstY = 0; ideal = 1e9;
    lts.length = 0;
    for (var i = 0; i < 6; i++) cache[i] = '';
  }

  addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey || !e.shiftKey) return;
    var t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (e.code === 'KeyF') { e.preventDefault(); show(!on); }
    else if (e.code === 'KeyR' && on) { e.preventDefault(); reset(); }
  }, true);

  addEventListener('resize', function () {
    if (!on) return;
    measureSecs();
    if (cv) sizeCanvas();
  }, { passive: true });
  addEventListener('load', function () { if (on) measureSecs(); });

  /* Coming back to the tab, the first interval spans the whole time away. */
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && running) last = 0;
  });

  window.FPS = { show: show, toggle: function () { show(!on); }, reset: reset,
                 get worst() { return { ms: worst, y: worstY }; } };

  if (on) { build(); measureSecs(); start(); }
})();
