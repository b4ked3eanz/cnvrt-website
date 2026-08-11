/* Shoot the glass ring under N parameter sets, one Chrome launch each.

     node tools/sweep.js <outDir> <variants.json>

   variants.json is [{ "name": "a", "p": { "absorb": 0.6 } }, ...]. Each entry
   goes through tools/tune.html, which writes the panel's localStorage key and
   bounces to the site — so nothing in index.html has to be edited to look at a
   number. The output is <outDir>/<name>.png, cropped to the ring.

   Serially, not in parallel: they share one Chrome profile directory and one
   debugging port, and a GPU-bound page measured against three others is not
   measured at all. */
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path');

const [, , OUTDIR, VARFILE, YARG, SCALEARG] = process.argv;
const Y = YARG || '10300';
const SCALE = SCALEARG || '1.4';
const variants = JSON.parse(fs.readFileSync(VARFILE, 'utf8'));
fs.mkdirSync(OUTDIR, { recursive: true });

const EVAL = path.join(__dirname, 'sweep-eval.js');
fs.writeFileSync(EVAL, [
  "const F = n => new Promise(r => { let i = 0; const t = () => { if (++i >= n) return r(); requestAnimationFrame(t); }; requestAnimationFrame(t); });",
  "scrollTo(0, +(localStorage.getItem('__shotY') || " + Y + "));",
  "dispatchEvent(new Event('resize'));",
  "await F(8);",
  "const r = document.querySelector('.off__glass--refract').getBoundingClientRect();",
  "window.__clip = { x: Math.round(r.left), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height) };",
  "return { clip: window.__clip, saved: JSON.parse(localStorage.getItem('cnvrt.offglass.v4')||'{}') };"
].join('\n'));

function run(v) {
  return new Promise(res => {
    const url = 'http://127.0.0.1:8743/_s/tune.html?y=' + Y +
                '&p=' + encodeURIComponent(JSON.stringify(v.p || {}));
    const out = path.join(OUTDIR, v.name + '.png');
    const p = spawn(process.execPath,
      [path.join(__dirname, 'shot.js'), url, out, EVAL, '6500', '1920', '1080', 'auto,' + SCALE],
      { stdio: ['ignore', 'pipe', 'pipe'] });
    let log = '';
    p.stdout.on('data', d => log += d);
    p.stderr.on('data', d => log += d);
    p.on('exit', () => {
      const bad = /ERROR|THREW|Shader Error/.test(log);
      console.log(v.name + (bad ? '  <-- ' + log.split('\n').filter(l => /ERROR|THREW/.test(l)).slice(0, 2).join(' | ') : '  ok'));
      res();
    });
  });
}

(async () => {
  /* reset once, so a leftover key from a previous sweep cannot leak into the
     first variant and quietly make it a different picture than it claims */
  await new Promise(res => spawn(process.execPath,
    [path.join(__dirname, 'shot.js'), 'http://127.0.0.1:8743/_s/tune.html?reset=1',
     path.join(OUTDIR, '_reset.png'), '', '3000', '400', '300'],
    { stdio: 'ignore' }).on('exit', res));
  try { fs.unlinkSync(path.join(OUTDIR, '_reset.png')); } catch (e) {}
  for (const v of variants) await run(v);
  console.log('done -> ' + OUTDIR);
})();
