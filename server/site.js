// Cloudy-Webseite + Download-/Update-Server. Wird von app.js UND server.js mit einer Zeile eingebunden:  require('./site')(app, express);
// Dateien liegen in ./releases/<version>/<datei> (oder RELEASE_DIR). Hochladen: https://deine-domain/upload  (nur mit UPLOAD_KEY).
const fs = require('fs'), path = require('path'), crypto = require('crypto');
module.exports = (app, express, isAdmin) => { // isAdmin(req) -> Promise<boolean>: Konto mit Admin-Recht oder Owner-Tag (kommt von app.js)
  const ROOT = process.env.RELEASE_DIR || path.join(__dirname, 'releases'), KEY = String(process.env.UPLOAD_KEY || '');
  const OK_VER = /^\d{1,3}\.\d{1,3}\.\d{1,3}$/, OK_FILE = /^[\w][\w.-]{0,79}\.(exe|dmg|AppImage|ipa|tipa|zip|txt|jar)$/i, MAX = 700 * 1024 * 1024;
  fs.mkdirSync(ROOT, { recursive: true });
  const vnum = v => v.split('.').map(Number), cmp = (a, b) => { const x = vnum(a), y = vnum(b); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return y[i] - x[i]; return 0; };
  const platform = n => /portable/i.test(n) ? 'win-portable' : /\.exe$/i.test(n) ? 'win' : /arm64.*\.dmg$/i.test(n) ? 'mac-arm' : /\.dmg$/i.test(n) ? 'mac-intel' : /\.AppImage$/i.test(n) ? 'linux' : /\.(ipa|tipa)$/i.test(n) ? 'ios' : 'other';
  const list = () => { // alle Versionen mit ihren Dateien (neueste zuerst)
    let out = [];
    try { for (const v of fs.readdirSync(ROOT).filter(v => OK_VER.test(v))) {
      const d = path.join(ROOT, v), files = fs.readdirSync(d).filter(f => OK_FILE.test(f)).map(f => ({ f, s: fs.statSync(path.join(d, f)) })).filter(x => x.s.isFile());
      if (!files.length) continue;
      let notes = ''; try { notes = fs.readFileSync(path.join(d, 'notes.txt'), 'utf8').slice(0, 2000); } catch {}
      out.push({ version: v, date: Math.max(...files.map(x => +x.s.mtime)), notes, files: files.filter(x => x.f !== 'notes.txt').map(x => ({ name: x.f, size: x.s.size, platform: platform(x.f) })) });
    } } catch {}
    return out.filter(r => r.files.length).sort((a, b) => cmp(a.version, b.version));
  };
  const building = new Set();
  const same = (a, b) => { const x = crypto.createHash('sha256').update(String(a)).digest(), y = crypto.createHash('sha256').update(String(b)).digest(); return crypto.timingSafeEqual(x, y); };
  let bad = 0, badT = 0; // einfache Bremse gegen Raten des Upload-Schlüssels
  const keyOk = req => { if (KEY.length < 12) return 'off'; if (Date.now() - badT > 600e3) bad = 0; if (bad >= 8) return 'wait'; if (same(req.headers['x-upload-key'] || '', KEY)) return 'ok'; bad++; badT = Date.now(); return 'no'; };
  const allow = async req => { // Hochladen/Löschen: entweder Upload-Schlüssel (für die GitHub-Action) oder Anmeldung als Admin/Owner
    if (req.headers['x-upload-key']) return keyOk(req);
    try { return isAdmin && await isAdmin(req) ? 'ok' : 'no'; } catch { return 'no'; }
  };
  const deny = (res, k) => res.status(k === 'off' ? 503 : k === 'wait' ? 429 : 401).json({ error: k === 'off' ? 'Nicht erlaubt: bitte als Admin/Owner anmelden (oder UPLOAD_KEY mit mind. 12 Zeichen setzen).' : k === 'wait' ? 'Zu viele Fehlversuche, bitte in 10 Minuten erneut.' : 'Nicht angemeldet oder Schlüssel falsch.' });

  try { for (const v of fs.readdirSync(ROOT)) { const d = path.join(ROOT, v); if (!fs.statSync(d).isDirectory()) continue; for (const f of fs.readdirSync(d)) if (/^\.(parts-|.*\.(part|join)$)/.test(f)) { const p = path.join(d, f); if (Date.now() - fs.statSync(p).mtimeMs > 24 * 3600e3) fs.rmSync(p, { recursive: true, force: true }); } } } catch {}
  // ---- öffentlich: Webseite, Liste, Downloads ----
  app.get('/api/releases', (_q, res) => res.json({ releases: list().map(r => ({ ...r, files: r.files.map(f => ({ ...f, url: `/download/${r.version}/${encodeURIComponent(f.name)}` })) })) }));
  const send = (res, v, f, name) => { const p = path.join(ROOT, v, f); if (!OK_VER.test(v) || !OK_FILE.test(f) || !fs.existsSync(p)) return res.status(404).send('Nicht gefunden.'); res.download(p, name || f); };
  app.get('/download/latest/:plat', (req, res) => { const r = list()[0], f = r && r.files.find(x => x.platform === req.params.plat); if (!f) return res.status(404).send('Noch keine Datei hochgeladen.'); res.redirect(`/download/${r.version}/${encodeURIComponent(f.name)}`); });
  app.get('/download/:v/:f', (req, res) => send(res, req.params.v, req.params.f));
  // ---- nur der Client: Update-Feed und Update-Dateien (Header X-Cloudy-Client; ein Browser ohne den Header bekommt 404) ----
  const isClient = req => req.headers['x-cloudy-client'] === '1';
  app.get('/update/latest.json', (req, res) => { if (!isClient(req)) return res.status(404).send('Cannot GET /update/latest.json'); const r = list()[0]; if (!r) return res.status(404).json({ error: 'Noch kein Release.' }); res.json({ version: r.version, notes: r.notes, files: r.files.map(f => ({ ...f, url: `/update/file/${r.version}/${encodeURIComponent(f.name)}` })) }); });
  app.get('/update/file/:v/:f', (req, res) => { if (!isClient(req)) return res.status(404).send('Nicht gefunden.'); send(res, req.params.v, req.params.f); });
  // ---- Hochladen: PUT /upload/<version>/<datei> mit Header X-Upload-Key (die Seite /upload macht das für dich) ----
  // Hochladen in Stücken (?id=<zufall>&off=<Byte-Start>&last=1): so passt jede Datei auch durch Proxys mit Größenlimit (z. B. 100 MB). Ohne ?id= wird die ganze Datei auf einmal gesendet (GitHub-Action).
  app.put('/upload/:v/:f', async (req, res) => {
    const k = await allow(req); if (k !== 'ok') return deny(res, k);
    const { v, f } = req.params; if (!OK_VER.test(v) || !OK_FILE.test(f)) return res.status(400).json({ error: 'Version (z. B. 0.9.72) oder Dateiname/-endung nicht erlaubt.' });
    const q = new URL(req.url, 'http://x').searchParams, chunked = q.has('id'), id = chunked ? q.get('id') : crypto.randomBytes(6).toString('hex');
    if (!/^[a-f0-9]{8,32}$/.test(id)) return res.status(400).json({ error: 'Ungültige Upload-ID.' });
    const d = path.join(ROOT, v); fs.mkdirSync(d, { recursive: true });
    const tmp = path.join(d, '.up-' + id + '.part'), off = chunked ? Math.max(0, +q.get('off') || 0) : 0, last = !chunked || q.get('last') === '1';
    let have = 0; try { have = fs.statSync(tmp).size; } catch {}
    if (chunked && off !== have) return res.status(409).json({ error: 'Stück passt nicht (Server hat ' + have + ' Byte, erwartet ' + off + ').', have });
    const ws = fs.createWriteStream(tmp, { flags: off ? 'a' : 'w' }); let n = 0, dead = false;
    const fail = (code, msg) => { if (dead) return; dead = true; try { ws.destroy(); } catch {} fs.truncate(tmp, have, () => { if (!have) fs.rm(tmp, { force: true }, () => {}); }); if (!res.headersSent) res.status(code).json({ error: msg }); };
    req.on('data', c => { n += c.length; if (have + n > MAX) { fail(413, 'Datei zu groß (max. 700 MB).'); req.destroy(); } });
    req.on('error', () => fail(400, 'Upload abgebrochen.')); req.on('aborted', () => fail(400, 'Upload abgebrochen.')); ws.on('error', () => fail(500, 'Speichern fehlgeschlagen.'));
    ws.on('finish', () => { if (dead) return;
      if (!last) return res.json({ ok: true, size: have + n });
      fs.rename(tmp, path.join(d, f), e => e ? fail(500, 'Speichern fehlgeschlagen.') : res.json({ ok: true, size: have + n })); });
    req.pipe(ws);
  });
  setInterval(() => { try { for (const v of fs.readdirSync(ROOT)) { const d = path.join(ROOT, v); if (!OK_VER.test(v)) continue; for (const f of fs.readdirSync(d)) if (/^\.up-.*\.part$/.test(f) && Date.now() - fs.statSync(path.join(d, f)).mtimeMs > 864e5) fs.rmSync(path.join(d, f), { force: true }); } } catch {} }, 36e5).unref(); // abgebrochene Uploads nach 24 h aufräumen
  app.delete('/upload/:v/:f', async (req, res) => { const k = await allow(req); if (k !== 'ok') return deny(res, k); if (!OK_VER.test(req.params.v) || !OK_FILE.test(req.params.f)) return res.status(400).json({ error: 'Ungültig.' }); fs.rm(path.join(ROOT, req.params.v, req.params.f), { force: true }, () => res.json({ ok: true })); });
  app.delete('/upload/:v', async (req, res) => { const k = await allow(req); if (k !== 'ok') return deny(res, k); if (!OK_VER.test(req.params.v)) return res.status(400).json({ error: 'Version ungültig.' }); fs.rm(path.join(ROOT, req.params.v), { recursive: true, force: true }, () => res.json({ ok: true })); });
  app.delete('/upload/:v/:f', async (req, res) => { const k = await allow(req); if (k !== 'ok') return deny(res, k); const { v, f } = req.params; if (!OK_VER.test(v) || !OK_FILE.test(f)) return res.status(400).json({ error: 'Name ungültig.' }); fs.rm(path.join(ROOT, v, f), { force: true }, () => res.json({ ok: true })); });
  app.get('/api/admin/overview', async (req, res) => { let ok = false; try { ok = !!(isAdmin && await isAdmin(req)); } catch {} if (!ok) return res.status(403).json({ error: 'Nur für Admins/Owner.' });
    const rel = list(), total = rel.reduce((a, r) => a + r.files.reduce((b, f) => b + f.size, 0), 0), need = ['win', 'win-portable', 'mac-arm', 'mac-intel', 'linux'];
    let free = null; try { const st = fs.statfsSync(ROOT); free = st.bavail * st.bsize; } catch {}
    res.json({ dir: ROOT, total, free, uploadKeySet: KEY.length >= 12, autoRestart: process.env.AUTO_RESTART !== '0', respawn: process.env.RESPAWN === '1', node: process.version, uptime: Math.round(process.uptime()),
      latest: rel[0] ? rel[0].version : null, missing: rel[0] ? need.filter(p => !rel[0].files.some(f => f.platform === p)) : need, releases: rel.map(r => ({ ...r, files: r.files.map(f => ({ ...f, url: `/download/${r.version}/${encodeURIComponent(f.name)}` })) })) }); });
  app.get('/upload', (_q, res) => res.redirect('/admin'));
  app.get('/admin', (_q, res) => res.sendFile(path.join(__dirname, 'site', 'admin.html')));
  // ---- Texte der Webseite: öffentlich lesbar, nur Admin/Owner darf sie ändern (gespeichert in site-data.json) ----
  const DATA = process.env.SITE_DATA || path.join(__dirname, 'site-data.json'), str = (v, n) => typeof v === 'string' ? v.slice(0, n) : '';
  const readSite = () => { try { return JSON.parse(fs.readFileSync(DATA, 'utf8')); } catch { return {}; } };
  const clean = b => { const o = {};
    for (const [k, n] of [['eyebrow', 60], ['title', 120], ['lead', 400], ['featTitle', 120], ['featLead', 300], ['betaTitle', 100], ['betaLead', 400], ['contact', 120], ['announce', 200], ['footer', 300]]) if (typeof b[k] === 'string' && (b[k].trim() || k === 'contact' || k === 'announce')) o[k] = str(b[k], n); // leer = Standardtext
    if (Array.isArray(b.features)) o.features = b.features.slice(0, 24).map(f => ({ ic: str(f && f.ic, 8), t: str(f && f.t, 80), p: str(f && f.p, 500) })).filter(f => f.t);
    if (Array.isArray(b.steps)) o.steps = b.steps.slice(0, 10).map(f => ({ t: str(f && f.t, 80), p: str(f && f.p, 500) })).filter(f => f.t);
    return o; };
  app.get('/api/site', (_q, res) => { res.set && res.set('Cache-Control', 'no-cache'); res.json(readSite()); });
  app.put('/api/site', async (req, res) => { let ok = false; try { ok = !!(isAdmin && await isAdmin(req)); } catch {} if (!ok) return res.status(403).json({ error: 'Nur für Admins/Owner.' });
    try { fs.writeFileSync(DATA, JSON.stringify(clean(req.body || {}))); res.json({ ok: true }); } catch { res.status(500).json({ error: 'Speichern fehlgeschlagen.' }); } });
  app.get('/api/me', async (req, res) => { let ok = false; try { ok = !!(isAdmin && await isAdmin(req)); } catch {} res.json({ admin: ok }); });
  app.use(express.static(path.join(__dirname, 'site'), { extensions: ['html'], maxAge: 0, etag: true })); // immer prüfen, ob es etwas Neues gibt (kein altes Bild/CSS aus dem Cache)

  // ---- Auto-Neustart: wird app.js oder site.js ersetzt, beendet sich der Server kurz danach selbst und startet neu. ----
  // Neue Release-Dateien (Upload) brauchen keinen Neustart. Ausschalten: Variable AUTO_RESTART=0.
  // Der Neustart braucht, dass dein Hoster den Server wieder startet (pm2, Docker, Panel „Auto-Restart“). Ohne so etwas: RESPAWN=1 setzen, dann startet er sich selbst neu.
  if (process.env.AUTO_RESTART !== '0') {
    const watch = ['app.js', 'site.js'], sig = f => { try { return crypto.createHash('sha1').update(fs.readFileSync(path.join(__dirname, f))).digest('hex'); } catch { return ''; } };
    const base = Object.fromEntries(watch.map(f => [f, sig(f)])); let t = null;
    try { fs.watch(__dirname, (_e, name) => {
      if (!watch.includes(name)) return; clearTimeout(t);
      t = setTimeout(() => { // erst 4 s nach der letzten Änderung (Upload kann dauern) und nur, wenn sich der Inhalt wirklich geändert hat
        if (!watch.some(f => sig(f) && sig(f) !== base[f])) return;
        console.log('Neue Server-Dateien erkannt – starte neu …');
        if (process.env.RESPAWN === '1') { try { require('child_process').spawn('/bin/sh', ['-c', 'sleep 3; exec "$0" "$@"', process.argv[0], ...process.argv.slice(1)], { detached: true, stdio: 'ignore', env: process.env }).unref(); } catch {} }
        setTimeout(() => process.exit(0), 300);
      }, 4000);
    }); } catch (e) { console.log('Auto-Neustart nicht möglich: ' + e.message); }
  }
};
