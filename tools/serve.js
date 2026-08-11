/* Range-capable static server for the cnvrt site.
   Serves the project root at /, and this scratchpad at /_s/.
   POST /_save?name=x.png  writes a base64 body into the scratchpad.
   node serve.js   ->  http://127.0.0.1:8743/

   Two extra routes exist for THE BEYONDER (tools/beyonder.html), which needs to
   put arbitrary pages inside an iframe:

     /_local/<absolute path>   any file on this machine. A page on http:// may
                               not frame a file:// URL — browsers forbid it
                               outright — so local files are re-served over
                               http instead. The path is in the PATH, not a
                               query string, so a relative asset inside the page
                               resolves to /_local/<same dir>/asset and works
                               with no rewriting.

     /_proxy?url=<encoded>     any remote page. Most real sites send
                               X-Frame-Options: DENY or a frame-ancestors CSP,
                               which is precisely a "you may not iframe me"
                               instruction; this fetches the document server-
                               side, drops those headers, and injects a <base>
                               so every subresource still loads from the real
                               origin. Only the top-level document is proxied.

   Both are deliberately unrestricted — that is the feature. The listener binds
   127.0.0.1, so nothing off this machine can reach them. Do not rebind it to
   0.0.0.0 without thinking about what an open proxy on your LAN means. */
const http = require('http'), fs = require('fs'), path = require('path'), url = require('url');

const ROOT    = 'D:\\ultron jits\\cnvrt website run 3';
const SCRATCH = __dirname;   // tools/, for scratch pages and /_save output
const PORT    = 8743;

const MIME = {
  '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.mjs':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8',
  '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png',
  '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp',
  '.gif':'image/gif', '.mp4':'video/mp4', '.webm':'video/webm',
  '.woff':'font/woff', '.woff2':'font/woff2', '.ttf':'font/ttf', '.otf':'font/otf',
  '.md':'text/plain; charset=utf-8', '.txt':'text/plain; charset=utf-8'
};

const server = http.createServer((req, res) => {
  const u = url.parse(req.url, true);

  if (req.method === 'POST' && u.pathname === '/_save') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      const name = (u.query.name || 'out.png').replace(/[^\w.\-]/g, '_');
      const b64 = body.replace(/^data:[^,]+,/, '');
      fs.writeFileSync(path.join(SCRATCH, name), Buffer.from(b64, 'base64'));
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('saved ' + name);
    });
    return;
  }

  /* ---- /_proxy?url= : frame anything on the web -------------------------- */
  if (u.pathname === '/_proxy') {
    const target = u.query.url;
    if (!target) { res.writeHead(400); return res.end('need ?url='); }
    proxy(target, res);
    return;
  }

  let p = decodeURIComponent(u.pathname);

  /* ---- /_local/<abs path> : frame anything on this disk ------------------ */
  if (p.startsWith('/_local/')) {
    let abs = p.slice('/_local/'.length);
    // "/D:/x/y.html" (a leading slash survives some URL joins) -> "D:/x/y.html"
    if (/^\/[A-Za-z]:/.test(abs)) abs = abs.slice(1);
    return sendFile(abs, req, res);
  }

  let base = ROOT;
  if (p.startsWith('/_s/')) { base = SCRATCH; p = p.slice(3); }
  if (p === '/' || p === '') p = '/index.html';

  const file = path.join(base, p.replace(/^\/+/, ''));
  if (!file.startsWith(base)) { res.writeHead(403); return res.end('no'); }
  return sendFile(file, req, res);
});

function sendFile(file, req, res) {
  fs.stat(file, (err, st) => {
    // `file`, not the request path — the path is not in scope here, and a
    // ReferenceError inside an fs callback is an unhandled throw that takes the
    // whole server down. Every /favicon.ico did exactly that.
    if (err || !st.isFile()) { res.writeHead(404); return res.end('404 ' + file); }
    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    const range = req.headers.range;

    if (range) {
      const m = /bytes=(\d*)-(\d*)/.exec(range);
      let start = m[1] ? parseInt(m[1], 10) : 0;
      let end   = m[2] ? parseInt(m[2], 10) : st.size - 1;
      if (isNaN(start) || start < 0) start = 0;
      if (isNaN(end) || end >= st.size) end = st.size - 1;
      if (start > end) { res.writeHead(416, { 'Content-Range': 'bytes */' + st.size }); return res.end(); }
      res.writeHead(206, {
        'Content-Type': type, 'Accept-Ranges': 'bytes',
        'Content-Range': 'bytes ' + start + '-' + end + '/' + st.size,
        'Content-Length': end - start + 1, 'Cache-Control': 'no-store'
      });
      fs.createReadStream(file, { start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Type': type, 'Accept-Ranges': 'bytes',
        'Content-Length': st.size, 'Cache-Control': 'no-store'
      });
      fs.createReadStream(file).pipe(res);
    }
  });
}

/* Fetch a remote document and make it framable.

   Only the top-level HTML is rewritten. Everything it references keeps loading
   from the real origin, because the injected <base> points there — which is
   both less work and more faithful than trying to rewrite every URL in the
   document. Non-HTML responses stream straight through. */
async function proxy(target, res) {
  let r;
  try {
    r = await fetch(target, {
      redirect: 'follow',
      headers: {
        // some origins serve a bot page, or nothing at all, without these
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' +
                      ' (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
  } catch (e) {
    res.writeHead(502, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(errPage('Could not reach it', target, e.message));
  }

  const type = r.headers.get('content-type') || 'application/octet-stream';

  if (!/text\/html|application\/xhtml/i.test(type)) {
    const buf = Buffer.from(await r.arrayBuffer());
    res.writeHead(r.status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    return res.end(buf);
  }

  let html = await r.text();
  const finalUrl = r.url || target;

  /* A <base> already in the document would resolve against MY url, so it has
     to be re-anchored to the real one and then replaced rather than left. */
  let baseHref = finalUrl;
  const existing = /<base\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>/i.exec(html);
  if (existing) {
    try { baseHref = new URL(existing[1], finalUrl).href; } catch (e) {}
  }
  html = html.replace(/<base\b[^>]*>/gi, '');

  // a CSP delivered as a meta tag survives header stripping, so drop those too
  html = html.replace(
    /<meta[^>]+http-equiv\s*=\s*["']?content-security-policy["']?[^>]*>/gi, '');
  html = html.replace(
    /<meta[^>]+http-equiv\s*=\s*["']?x-frame-options["']?[^>]*>/gi, '');

  const tag = '<base href="' + baseHref.replace(/"/g, '&quot;') + '">';
  html = /<head[^>]*>/i.test(html)
    ? html.replace(/<head[^>]*>/i, m => m + tag)
    : tag + html;

  if (r.status >= 400) html = errPage('The site returned ' + r.status, target, '') + html;

  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    // deliberately absent: x-frame-options, content-security-policy
  });
  res.end(html);
}

function errPage(title, target, detail) {
  return '<div style="font:13px ui-monospace,monospace;background:#2a1410;color:#ffb08c;' +
    'padding:14px 16px;border-bottom:1px solid #5a2a1e"><b>' + title + '</b><br>' +
    String(target).replace(/</g, '&lt;') +
    (detail ? '<br><span style="color:#c98">' + String(detail).replace(/</g, '&lt;') +
    '</span>' : '') + '</div>';
}

server.listen(PORT, '127.0.0.1', () => console.log(
  'serving ' + ROOT + ' on http://127.0.0.1:' + PORT + '/\n' +
  '  scratchpad  /_s/\n' +
  '  local files /_local/<abs path>\n' +
  '  web proxy   /_proxy?url=<encoded>\n' +
  '  beyonder    http://127.0.0.1:' + PORT + '/_s/beyonder.html'));
