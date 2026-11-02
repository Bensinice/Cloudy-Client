// Cloudy-Webseite + Download-/Update-Server. Wird von app.js UND server.js mit einer Zeile eingebunden:  require('./site')(app, express);
// Dateien liegen in ./releases/<version>/<datei> (oder RELEASE_DIR). Hochladen: https://deine-domain/upload  (nur mit UPLOAD_KEY).
const fs = require('fs'), path = require('path'), crypto = require('crypto');
module.exports = (app, express) => {
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
  const same = (a, b) => { const x = crypto.createHash('sha256').update(String(a)).digest(), y = crypto.createHash('sha256').update(String(b)).digest(); return crypto.timingSafeEqual(x, y); };
  let bad = 0, badT = 0; // einfache Bremse gegen Raten des Upload-Schlüssels
  const keyOk = req => { if (KEY.length < 12) return 'off'; if (Date.now() - badT > 600e3) bad = 0; if (bad >= 8) return 'wait'; if (same(req.headers['x-upload-key'] || '', KEY)) return 'ok'; bad++; badT = Date.now(); return 'no'; };
  const deny = (res, k) => res.status(k === 'off' ? 503 : k === 'wait' ? 429 : 401).json({ error: k === 'off' ? 'Upload ist aus: setze auf dem Server die Variable UPLOAD_KEY (mind. 12 Zeichen).' : k === 'wait' ? 'Zu viele Fehlversuche, bitte in 10 Minuten erneut.' : 'Upload-Schlüssel stimmt nicht.' });

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
  app.put('/upload/:v/:f', (req, res) => {
    const k = keyOk(req); if (k !== 'ok') return deny(res, k);
    const { v, f } = req.params; if (!OK_VER.test(v) || !OK_FILE.test(f)) return res.status(400).json({ error: 'Version (z. B. 0.9.72) oder Dateiname/-endung nicht erlaubt.' });
    const d = path.join(ROOT, v); fs.mkdirSync(d, { recursive: true });
    const tmp = path.join(d, '.' + crypto.randomBytes(6).toString('hex') + '.part'), ws = fs.createWriteStream(tmp); let n = 0, dead = false;
    const fail = (code, msg) => { if (dead) return; dead = true; try { ws.destroy(); } catch {} fs.rm(tmp, { force: true }, () => {}); if (!res.headersSent) res.status(code).json({ error: msg }); };
    req.on('data', c => { n += c.length; if (n > MAX) { fail(413, 'Datei zu groß (max. 700 MB).'); req.destroy(); } });
    req.on('error', () => fail(400, 'Upload abgebrochen.')); req.on('aborted', () => fail(400, 'Upload abgebrochen.')); ws.on('error', () => fail(500, 'Speichern fehlgeschlagen.'));
    ws.on('finish', () => { if (dead) return; fs.rename(tmp, path.join(d, f), e => e ? fail(500, 'Speichern fehlgeschlagen.') : res.json({ ok: true, size: n })); });
    req.pipe(ws);
  });
  app.delete('/upload/:v', (req, res) => { const k = keyOk(req); if (k !== 'ok') return deny(res, k); if (!OK_VER.test(req.params.v)) return res.status(400).json({ error: 'Version ungültig.' }); fs.rm(path.join(ROOT, req.params.v), { recursive: true, force: true }, () => res.json({ ok: true })); });
  app.get('/upload', (_q, res) => res.sendFile(path.join(__dirname, 'site', 'upload.html')));
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
