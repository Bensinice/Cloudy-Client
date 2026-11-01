// Fernsteuerung fuers Handy: Der Launcher stellt seine eigene Oberflaeche im Heimnetz bereit; ein Browser (z. B. Safari auf dem iPhone) ruft dieselben
// Funktionen auf wie das Launcher-Fenster. Die Arbeit (Mods, Updates, Shop, Spiel starten ...) macht der PC. Standardmaessig AUS, nur mit PIN, nur aus privaten Netzen.
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.bin': 'application/octet-stream', '.glb': 'model/gltf-binary' };
// Funktionen, die nur am PC selbst Sinn haben oder gefaehrlich waeren (Dateidialoge, Ordner oeffnen, Deinstallieren, Einstellungen dieser Fernsteuerung)
const DENY = new Set(['uninstall', 'uninstallInfo', 'forceUpdate', 'updatePickFile', 'localUpdateRun', 'localUpdateFolder', 'resetJava', 'setAppIcon', 'winCtl', 'debugAction', 'cfgImport', 'cfgExport',
  'bgPick', 'bannerPick', 'capePick', 'skinPick', 'mpImportFile', 'openFolder', 'openInstance', 'shotOpen', 'shotFolder', 'serverFolder', 'packFolder', 'openExternal', 'appReload', 'musicAdd', 'soundsCustom', 'remoteGet', 'remoteSet', 'streamSetup']);

const priv = a => {
  a = String(a || '').replace(/^::ffff:/, '');
  if (a === '::1' || a === '127.0.0.1') return true;
  if (a.includes(':')) return /^f[cd]/i.test(a) || /^fe80/i.test(a);
  const p = a.split('.').map(Number); if (p.length !== 4 || p.some(n => !(n >= 0 && n <= 255))) return false;
  return p[0] === 10 || p[0] === 127 || (p[0] === 192 && p[1] === 168) || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) || (p[0] === 169 && p[1] === 254) || (p[0] === 100 && p[1] >= 64 && p[1] <= 127); // 100.64/10 = z. B. Tailscale
};
const sha = s => crypto.createHash('sha256').update(String(s)).digest('hex');
const eq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const cookieOf = (req, n) => { const m = new RegExp('(?:^|;\\s*)' + n + '=([A-Za-z0-9]+)').exec(req.headers.cookie || ''); return m ? m[1] : ''; };

const PAIR_HTML = `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Cloudy – Verbinden</title>
<style>:root{color-scheme:light dark}body{margin:0;min-height:100vh;display:grid;place-items:center;font:16px -apple-system,system-ui,sans-serif;background:linear-gradient(180deg,#b4d9ff,#e2f1ff);color:#14213d}
@media(prefers-color-scheme:dark){body{background:linear-gradient(180deg,#14172b,#0c0e1a);color:#eef}}
.c{width:min(92vw,360px);padding:28px 24px;border-radius:26px;background:rgba(255,255,255,.7);backdrop-filter:blur(18px);box-shadow:0 20px 50px rgba(30,80,160,.25);text-align:center}
@media(prefers-color-scheme:dark){.c{background:rgba(30,34,60,.75)}}
h1{margin:6px 0 4px;font-size:26px}p{margin:6px 0 16px;opacity:.75;font-size:14px}
input{width:100%;box-sizing:border-box;height:52px;border-radius:16px;border:1.5px solid #6db3ff;padding:0 14px;font-size:24px;letter-spacing:.35em;text-align:center;background:transparent;color:inherit}
button{margin-top:14px;width:100%;height:50px;border:0;border-radius:16px;font-size:17px;font-weight:700;color:#fff;background:linear-gradient(#6db3ff,#3f8ff0)}
#m{min-height:20px;margin-top:10px;font-size:14px;color:#d33}</style></head><body><form class="c" id="f"><div style="font-size:42px">☁️</div><h1>Cloudy</h1><p>Gib die 6-stellige PIN ein, die in den Cloudy-Einstellungen am PC steht.</p>
<input id="p" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="••••••" autofocus><button>Verbinden</button><div id="m"></div></form>
<script>f.onsubmit=async e=>{e.preventDefault();m.textContent='';try{const r=await fetch('/api/pair',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({pin:p.value})}),j=await r.json();if(j.ok)location.replace('/');else m.textContent=j.error||'Falsche PIN.'}catch{m.textContent='PC nicht erreichbar.'}}</script></body></html>`;

// Browser-Seite: so tun, als waere es das Electron-Fenster (preload.js wird 1:1 mitgeliefert, es merkt den Unterschied nicht)
const SHIM = `(function(){
  window.__remote = true;
  var L = {};
  function call(c, a) { return fetch('/api/ipc', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ c: c, a: a }) }).then(function (r) {
    if (r.status === 401) { location.replace('/pair'); return new Promise(function () {}); }
    return r.json(); }).then(function (j) { if (j && j.err) throw new Error(j.err); return j ? j.r : null; }); }
  window.require = function () { return {
    contextBridge: { exposeInMainWorld: function (k, v) { window[k] = v; } },
    ipcRenderer: {
      invoke: function (c) { return call(c, Array.prototype.slice.call(arguments, 1)); },
      on: function (ch, f) { (L[ch] = L[ch] || []).push(f); },
      sendSync: function (c, t) { return t; }
    } }; };
  function es() { try { var s = new EventSource('/api/events'); s.onmessage = function (m) { try { var d = JSON.parse(m.data); (L[d.ch] || []).forEach(function (f) { try { f({}, d.d); } catch (e) {} }); } catch (e) {} };
    s.onerror = function () { s.close(); setTimeout(es, 3000); }; } catch (e) {} }
  es();
})();`;
const SHIM_AFTER = `(function(){ try { window.cloudy.openExternal = function (u) { try { window.open(u, '_blank', 'noopener'); } catch (e) {} return Promise.resolve(true); };
  ['winCtl'].forEach(function (k) { window.cloudy[k] = function () { return Promise.resolve(null); }; }); } catch (e) {} })();`;

function create({ root, handlers, stateFile }) {
  let srv = null, port = 0, pinHash = '', pin = '';
  const tokens = new Set(), clients = new Set(), fails = new Map();
  let loaded = {};
  try { loaded = JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch {}
  const save = () => { try { fs.writeFileSync(stateFile, JSON.stringify({ on: !!srv || !!loaded.on, pin, tokens: [...tokens] })); } catch {} };
  const cfg = () => ({ on: !!loaded.on, pin: String(loaded.pin || ''), port: +loaded.port || 3377 });
  const newPin = () => String(crypto.randomInt(0, 1e6)).padStart(6, '0');
  for (const t of loaded.tokens || []) tokens.add(t);
  pin = String(loaded.pin || '') || newPin();

  const json = (res, code, o, h) => { const b = Buffer.from(JSON.stringify(o)); res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': b.length, 'Cache-Control': 'no-store', ...(h || {}) }); res.end(b); };
  const authed = req => { const t = cookieOf(req, 'cloudy_remote'); return !!t && tokens.has(sha(t)); };
  const body = (req, max = 8e6) => new Promise((ok, no) => { let n = 0; const ch = []; req.on('data', d => { n += d.length; if (n > max) { no(new Error('zu gross')); req.destroy(); } else ch.push(d); }); req.on('end', () => ok(Buffer.concat(ch).toString('utf8'))); req.on('error', no); });

  async function handle(req, res) {
    const ip = String(req.socket.remoteAddress || '');
    if (!priv(ip)) { res.writeHead(403); return res.end('Nur im Heimnetz.'); }
    const u = new URL(req.url, 'http://x'), p = decodeURIComponent(u.pathname);
    if (p === '/pair' && req.method === 'GET') { res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-store' }); return res.end(PAIR_HTML); }
    if (p === '/api/pair' && req.method === 'POST') {
      const f = fails.get(ip) || { n: 0, t: Date.now() }; if (Date.now() - f.t > 60000) { f.n = 0; f.t = Date.now(); }
      if (f.n >= 5) return json(res, 429, { ok: false, error: 'Zu viele Versuche, warte eine Minute.' });
      let b = {}; try { b = JSON.parse(await body(req, 2000)); } catch {}
      if (!pin || !eq(String(b.pin || '').trim(), pin)) { f.n++; fails.set(ip, f); const all = [...fails.values()].reduce((s, x) => s + x.n, 0); if (all >= 30) { pin = newPin(); loaded.pin = pin; save(); fails.clear(); } return json(res, 401, { ok: false, error: 'Falsche PIN.' }); }
      fails.delete(ip); const tok = crypto.randomBytes(24).toString('hex'); tokens.add(sha(tok)); save();
      return json(res, 200, { ok: true }, { 'Set-Cookie': `cloudy_remote=${tok}; Path=/; Max-Age=${60 * 86400}; HttpOnly; SameSite=Strict` });
    }
    if (!authed(req)) { if (req.method === 'GET' && (p === '/' || p === '/index.html')) { res.writeHead(302, { Location: '/pair' }); return res.end(); } return json(res, 401, { err: 'nicht verbunden' }); }

    if (p === '/api/ipc' && req.method === 'POST') {
      let b; try { b = JSON.parse(await body(req)); } catch { return json(res, 400, { err: 'ungueltig' }); }
      const c = String(b.c || ''), a = Array.isArray(b.a) ? b.a : [];
      if (DENY.has(c)) return json(res, 200, { r: null });
      const h = handlers.get(c); if (!h) return json(res, 200, { r: null });
      try { const r = await h({ sender: { send() {} } }, ...a); return json(res, 200, { r: r === undefined ? null : r }); } catch (e) { return json(res, 200, { err: String(e && e.message || e).slice(0, 300) }); }
    }
    if (p === '/api/events' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' }); res.write(': ok\n\n'); clients.add(res);
      const k = setInterval(() => { try { res.write(': \n\n'); } catch {} }, 20000); req.on('close', () => { clearInterval(k); clients.delete(res); }); return;
    }
    if (p === '/remote/shim.js') {
      let pre = ''; try { pre = fs.readFileSync(path.join(root, 'preload.js'), 'utf8'); } catch {}
      res.writeHead(200, { 'Content-Type': MIME['.js'], 'Cache-Control': 'no-store' }); return res.end(SHIM + '\n(function(require){\n' + pre + '\n})(window.require);\n' + SHIM_AFTER);
    }
    if (p === '/remote/mobile.css') { let css = ''; try { css = fs.readFileSync(path.join(root, 'assets', 'css', 'mobile.css'), 'utf8'); } catch {} res.writeHead(200, { 'Content-Type': MIME['.css'], 'Cache-Control': 'no-store' }); return res.end(css); }
    if (req.method !== 'GET') { res.writeHead(405); return res.end(); }
    if (p === '/' || p === '/index.html') {
      let h = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
      h = h.replace('<head>', '<head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><meta name="theme-color" content="#b4d9ff"><script src="/remote/shim.js"></script>')
        .replace('</head>', '<link rel="stylesheet" href="/remote/mobile.css"></head>');
      res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-store' }); return res.end(h);
    }
    const rel = p.replace(/^\/+/, '');
    if (!/^(assets|themes)\//.test(rel) || rel.includes('..')) { res.writeHead(404); return res.end(); }
    const f = path.join(root, rel); if (!f.startsWith(path.join(root) + path.sep)) { res.writeHead(404); return res.end(); }
    fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); res.end(d); });
  }

  const api = {
    start(want) {
      return new Promise(resolve => {
        if (srv) return resolve({ ok: true, port });
        let tries = 0; const tryPort = pt => {
          const s = http.createServer((q, r) => { handle(q, r).catch(() => { try { r.writeHead(500); r.end(); } catch {} }); });
          s.once('error', e => { if (e.code === 'EADDRINUSE' && tries++ < 5) tryPort(pt + 1); else resolve({ ok: false, error: e.code === 'EADDRINUSE' ? 'Kein freier Port.' : e.message }); });
          s.listen(pt, '0.0.0.0', () => { srv = s; port = pt; loaded.on = true; loaded.port = pt; loaded.pin = pin; save(); resolve({ ok: true, port: pt }); });
        }; tryPort(+want || cfg().port);
      });
    },
    stop() { try { for (const c of clients) c.end(); clients.clear(); if (srv) srv.close(); } catch {} srv = null; loaded.on = false; save(); },
    broadcast(ch, d) { if (!clients.size) return; let s; try { s = 'data: ' + JSON.stringify({ ch, d }) + '\n\n'; } catch { return; } for (const c of clients) { try { c.write(s); } catch {} } },
    newPin() { pin = newPin(); loaded.pin = pin; tokens.clear(); save(); return pin; },
    revokeAll() { tokens.clear(); save(); },
    state() { return { on: !!srv, port, pin, devices: tokens.size }; },
    wasOn: () => !!loaded.on, lastPort: () => cfg().port
  };
  return api;
}
module.exports = { create, priv };
