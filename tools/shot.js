/* Drive Chrome over the DevTools protocol directly — no extension involved.
   Node 22+ ships a global WebSocket, so this needs no dependencies.

     node shot.js <url> <out.png> [evalFile.js] [waitMs] [w] [h]

   evalFile.js runs in the page after load and before the screenshot; whatever
   it returns (JSON-serialisable) is printed. */
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9333;
const [, , URL_, OUT, EVALFILE, WAIT, W, H, CLIP] = process.argv;
const width = +(W || 1920), height = +(H || 1200), wait = +(WAIT || 4000);
/* CLIP is "x,y,w,h[,scale]" — a magnified crop, for looking at one element
   instead of squinting at a 1920 shot */
const clip = CLIP ? (function () {
  const a = CLIP.split(',').map(Number);
  return { x: a[0], y: a[1], width: a[2], height: a[3], scale: a[4] || 1 };
})() : null;

const profile = path.join(__dirname, 'cprofile');
const chrome = spawn(CHROME, [
  '--headless=new',
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
  '--disable-background-timer-throttling',
  '--disable-features=CalculateNativeWinOcclusion',
  '--remote-debugging-port=' + PORT,
  '--user-data-dir=' + profile,
  '--window-size=' + width + ',' + height,
  '--force-device-scale-factor=1',
  '--hide-scrollbars',
  
  '--no-first-run', '--no-default-browser-check',
  '--disable-extensions',
  /* headless has no real GPU here; SwiftShader still gives a conformant
     WebGL2 context, which is all the encoder pass needs */
  '--enable-unsafe-swiftshader',
  '--allow-file-access-from-files',
  'about:blank'
], { stdio: 'ignore' });

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function targets() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch('http://127.0.0.1:' + PORT + '/json/list');
      const j = await r.json();
      const page = j.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) return page;
    } catch (e) {}
    await sleep(250);
  }
  throw new Error('chrome never came up on ' + PORT);
}

(async () => {
  let code = 0;
  try {
    const page = await targets();
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

    let id = 0;
    const pending = new Map();
    const events = [];
    ws.onmessage = ev => {
      const m = JSON.parse(ev.data);
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
      else if (m.method) events.push(m);
    };
    const send = (method, params) => new Promise(res => {
      const i = ++id;
      pending.set(i, res);
      ws.send(JSON.stringify({ id: i, method, params: params || {} }));
    });

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Log.enable');
    await send('Emulation.setDeviceMetricsOverride',
      { width, height, deviceScaleFactor: 1, mobile: false });

    await send('Page.navigate', { url: URL_ });
    /* fixed settle rather than a load event: three.js comes off a CDN and the
       first render is a frame or two after that */
    await sleep(wait);

    let out = null;
    if (EVALFILE && fs.existsSync(EVALFILE)) {
      const src = fs.readFileSync(EVALFILE, 'utf8');
      const r = await send('Runtime.evaluate', {
        expression: '(async()=>{' + src + '})()',
        awaitPromise: true, returnByValue: true
      });
      out = r.result && r.result.result ? r.result.result.value : null;
      if (r.result && r.result.exceptionDetails) {
        console.log('EVAL THREW: ' + JSON.stringify(r.result.exceptionDetails.exception));
      }
      await sleep(900);
    }

    const shotArgs = { format: 'png', captureBeyondViewport: false };
    if (clip) shotArgs.clip = clip;
    /* CLIP=auto,<scale>: the eval left a rect on window.__clip. It has to be
       DOCUMENT space, not viewport space — captureScreenshot's clip ignores
       the scroll position, so a viewport rect on a page scrolled to 11000px
       crops the masthead. */
    if (CLIP && CLIP.indexOf('auto') === 0) {
      const r = await send('Runtime.evaluate',
        { expression: 'JSON.stringify(window.__clip||null)', returnByValue: true });
      const v = r.result && r.result.result && r.result.result.value;
      const box = v ? JSON.parse(v) : null;
      if (box) {
        shotArgs.clip = { x: box.x, y: box.y, width: box.w, height: box.h,
                          scale: +(CLIP.split(',')[1] || 1) };
      } else { delete shotArgs.clip; console.log('no window.__clip — full shot'); }
    }
    const shot = await send('Page.captureScreenshot', shotArgs);
    if (shot.result && shot.result.data) {
      fs.writeFileSync(OUT, Buffer.from(shot.result.data, 'base64'));
      console.log('shot -> ' + OUT);
    } else {
      console.log('NO SCREENSHOT: ' + JSON.stringify(shot).slice(0, 400));
      code = 1;
    }

    const con = events.filter(e => e.method === 'Runtime.consoleAPICalled')
      .map(e => e.params.type + ': ' + e.params.args.map(a =>
        a.value !== undefined ? String(a.value) :
        (a.description || a.className || a.type)).join(' '));
    if (con.length) console.log('CONSOLE:\n  ' + con.slice(0, 25).join('\n  '));

    const errs = events
      .filter(e => e.method === 'Log.entryAdded' && e.params.entry.level === 'error')
      .map(e => e.params.entry.text)
      .concat(events
        .filter(e => e.method === 'Runtime.exceptionThrown')
        .map(e => JSON.stringify(e.params.exceptionDetails.exception || e.params.exceptionDetails.text)));
    if (errs.length) console.log('PAGE ERRORS:\n  ' + errs.slice(0, 12).join('\n  '));
    if (out !== null) console.log('EVAL: ' + JSON.stringify(out, null, 1));

    ws.close();
  } catch (e) {
    console.log('FAILED: ' + e.message);
    code = 1;
  } finally {
    try { chrome.kill(); } catch (e) {}
    setTimeout(() => process.exit(code), 200);
  }
})();
