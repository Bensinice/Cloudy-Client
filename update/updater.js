// Cloudy-Updater: prüft GitHub-Releases, lädt mit Fortschritt herunter, installiert und startet Cloudy neu.
// Nutzerdaten (Einstellungen, Mods, Profile, Welten) liegen in AppData/Application Support und werden nie angefasst.
const fs = require('fs'), path = require('path');
const { spawn } = require('child_process');

exports.init = function init({ app, ipcMain, shell, send, defaultRepo, userAgent, gameRunning, serverUrl }) {
  const IS_MAC = process.platform === 'darwin', IS_WIN = process.platform === 'win32';
  const PORTABLE = IS_WIN && process.env.PORTABLE_EXECUTABLE_FILE;
  const H = { 'User-Agent': userAgent || 'Cloudy-Updater' };
  let found = null, busy = false;
  // Hat ein stilles Update nicht geklappt (Version unverändert), fragt Cloudy beim nächsten Start nach und startet den Installer sichtbar – dann sieht man, woran es hängt
  const pendFile = path.join(app.getPath('userData'), 'update-pending.json');
  app.whenReady().then(() => { try {
    const p = JSON.parse(fs.readFileSync(pendFile, 'utf8')); fs.rmSync(pendFile, { force: true });
    if (!p || !p.ver || Date.now() - p.t > 12 * 3600e3 || !newer(p.ver, app.getVersion())) return;
    const { dialog } = require('electron');
    const r = dialog.showMessageBoxSync({ type: 'warning', title: 'Cloudy', message: 'Das letzte Update hat nicht geklappt.', detail: 'Cloudy ist noch auf Version ' + app.getVersion() + ' (neu: ' + p.ver + '). Soll der Installer jetzt sichtbar gestartet werden? Dann siehst du, woran es hängt (z. B. Virenscanner oder Cloudy läuft noch).', buttons: ['Installer sichtbar starten', 'Download-Seite öffnen', 'Später'], defaultId: 0 });
    if (r === 0 && p.file && fs.existsSync(p.file)) { spawn(p.file, [], { detached: true, stdio: 'ignore' }).unref(); setTimeout(() => app.quit(), 600); }
    else if (r !== 2) shell.openExternal(p.url || 'https://github.com/Bensinice/cloudy-client/releases/latest');
  } catch {} });

  const nums = v => String(v).replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
  const newer = (a, b) => { const x = nums(a), y = nums(b); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); return false; };

  // Pflicht-Update: Eine neuere Version, die schon seit mehr als 24 Stunden bekannt ist, muss installiert werden (kein Aufschieben, kein Zurückgehen).
  const seenFile = path.join(app.getPath('userData'), 'update-seen.json');
  function seen(ver) {
    let j = {}; try { j = JSON.parse(fs.readFileSync(seenFile, 'utf8')); } catch {}
    if (j.ver !== ver) { j = { ver, t: Date.now() }; try { fs.writeFileSync(seenFile, JSON.stringify(j)); } catch {} }
    return Date.now() - j.t > 24 * 3600 * 1000;
  }
  exports.seen = seen;
  function pick(assets) {
    const a = assets || [];
    if (IS_WIN) return a.find(x => /\.exe$/i.test(x.name) && (PORTABLE ? /portable/i : /setup/i).test(x.name)) || a.find(x => /\.exe$/i.test(x.name) && !/portable/i.test(x.name));
    if (IS_MAC) return a.find(x => /\.dmg$/i.test(x.name) && x.name.toLowerCase().includes(process.arch === 'arm64' ? 'arm64' : 'x64'));
    if (process.platform === 'linux') return a.find(x => /\.AppImage$/i.test(x.name));
    return null;
  }

  // Zuerst beim eigenen Cloudy-Server nachsehen (nur der Client darf den Feed sehen); klappt das nicht, bleibt GitHub als Ausweich-Weg
  async function fromServer() {
    let base = ''; try { base = String((serverUrl && serverUrl()) || '').replace(/\/+$/, ''); } catch {}
    if (!/^https?:\/\//i.test(base)) return null;
    try {
      const res = await fetch(base + '/update/latest.json', { headers: { ...H, 'X-Cloudy-Client': '1' }, signal: AbortSignal.timeout(8000) });
      if (!res.ok) return null;
      const j = await res.json(); if (!/^\d+\.\d+\.\d+$/.test(String(j.version))) return null;
      const assets = (j.files || []).filter(f => f && f.name && f.url).map(f => ({ name: f.name, size: +f.size || 0, browser_download_url: base + f.url, fromServer: true }));
      const exe = pick(assets); if (!exe) return null;
      return { ver: j.version, exe, notes: String(j.notes || ''), url: base + '/#download' };
    } catch { return null; }
  }

  ipcMain.handle('checkUpdate', async (_e, repo) => {
    const sv = await fromServer();
    if (sv) {
      found = { asset: sv.exe, isZip: false, url: sv.url, ver: sv.ver };
      const nw = newer(sv.ver, app.getVersion());
      return { ok: true, current: app.getVersion(), latest: sv.ver, newer: nw, mandatory: nw && seen(sv.ver), url: sv.url, canInstall: app.isPackaged, size: sv.exe.size, notes: sv.notes.slice(0, 600) };
    }
    repo = defaultRepo || repo;
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo || '')) return { ok: false, error: 'Trage deine GitHub-Quelle ein (z. B. name/cloudy) oder setze sie in config/app.json.' };
    try {
      // Alle Releases ansehen (Tag darf beliebig heißen, z. B. „update1“): die Version steht im Tag oder im Dateinamen (cloudy-0.8.13-voll.zip)
      const ver = t => { const m = /(\d+\.\d+\.\d+)/.exec(String(t || '')); return m ? m[1] : null; };
      let list = null, why = '';
      try {
        const res = await fetch(`https://api.github.com/repos/${repo}/releases?per_page=15`, { headers: { ...H, Accept: 'application/vnd.github+json' } });
        if (!res.ok) throw new Error('GitHub antwortet mit ' + res.status + (res.status === 403 ? ' (zu viele Anfragen, später erneut versuchen)' : res.status === 404 ? ' (Repo nicht gefunden oder privat)' : ''));
        list = await res.json();
      } catch (e) { why = String((e && e.message) || e); }
      if (!list) { // Ausweich-Weg ohne API-Limit: die öffentliche Release-Seite von GitHub lesen
        try {
          const atom = await (await fetch(`https://github.com/${repo}/releases.atom`, { headers: H })).text();
          const tags = [...atom.matchAll(/<link[^>]+href="https:\/\/github\.com\/[^"]+\/releases\/tag\/([^"]+)"/g)].map(m => decodeURIComponent(m[1])).slice(0, 8);
          list = [];
          for (const tag of tags) {
            const html = await (await fetch(`https://github.com/${repo}/releases/expanded_assets/${encodeURIComponent(tag)}`, { headers: H })).text();
            const assets = [...html.matchAll(/href="(\/[^"]+\/releases\/download\/[^"]+\/([^"/]+))"/g)].map(m => ({ name: decodeURIComponent(m[2]), browser_download_url: 'https://github.com' + m[1], size: 0 }));
            list.push({ tag_name: tag, draft: false, assets, html_url: `https://github.com/${repo}/releases/tag/${encodeURIComponent(tag)}`, body: '' });
          }
        } catch (e2) { throw new Error(why || String((e2 && e2.message) || e2)); }
      }
      const cands = list.filter(r => !r.draft).map(r => {
        const exe = pick(r.assets), zip = (r.assets || []).find(x => /\.zip$/i.test(x.name) && ver(x.name));
        return { r, exe, zip, v: ver(zip && zip.name) || ver(r.tag_name) };
      }).filter(c => c.v && (c.exe || c.zip)); // GitHub liefert die neueste Veröffentlichung zuerst
      if (!cands.length) throw new Error('Kein Release mit Versionsnummer (z. B. cloudy-0.8.13-voll.zip) gefunden.');
      const c = cands[0], latest = c.v, cur = app.getVersion(), asset = c.exe || c.zip, isZip = !c.exe;
      found = { asset, isZip, url: c.r.html_url, ver: latest };
      const nw = newer(latest, cur);
      return { ok: true, current: cur, latest, newer: nw, mandatory: nw && seen(latest), url: c.r.html_url, canInstall: !!asset && app.isPackaged,
        size: asset ? asset.size : 0, notes: String(c.r.body || '').slice(0, 600) };
    } catch (e) { return { ok: false, none: true, error: 'Update-Suche fehlgeschlagen: ' + String((e && e.message) || e) }; }
  });

  async function download(asset) {
    const dir = path.join(app.getPath('temp'), 'cloudy-update');
    fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
    const dest = path.join(dir, asset.name);
    const res = await fetch(asset.browser_download_url, { headers: asset.fromServer ? { ...H, 'X-Cloudy-Client': '1' } : H });
    if (!res.ok || !res.body) throw new Error('Download fehlgeschlagen (' + res.status + ')');
    const total = +res.headers.get('content-length') || asset.size, ws = fs.createWriteStream(dest);
    let got = 0, last = 0;
    for await (const chunk of res.body) {
      if (!ws.write(chunk)) await new Promise(r => ws.once('drain', r));
      got += chunk.length;
      const now = Date.now();
      if (now - last > 120) { last = now; send('update-progress', { phase: 'download', pct: total ? Math.min(100, got / total * 100) : 0, got, total }); }
    }
    await new Promise((ok, bad) => { ws.on('error', bad); ws.end(ok); });
    if (asset.size && got !== asset.size) throw new Error('Datei unvollständig – bitte erneut versuchen.');
    send('update-progress', { phase: 'download', pct: 100, got, total });
    return dest;
  }

  function install(file) {
    const detached = { detached: true, stdio: 'ignore', windowsHide: true };
    if (IS_WIN && !PORTABLE) {
      // Installer läuft still, behält den Installationsordner und startet Cloudy danach neu
      try { fs.writeFileSync(pendFile, JSON.stringify({ file, ver: found && found.ver, url: found && found.url, t: Date.now() })); } catch {}
      spawn(file, ['/S', '--updated', '--force-run'], detached).unref();
      setTimeout(() => { try { app.quit(); } catch {} }, 800); // Cloudy schliesst sich selbst, damit der Installer keine gesperrten Dateien findet
    } else if (IS_WIN) {
      // Die neue Datei ersetzt die alte selbst (siehe replacePortable in main.js) – ohne Hilfsskript
      spawn(file, ['--cloudy-replace=' + process.env.PORTABLE_EXECUTABLE_FILE], detached).unref();
      setTimeout(() => { try { app.quit(); } catch {} }, 600);
    } else if (IS_MAC) {
      const target = path.resolve(process.execPath, '..', '..', '..');
      if (!target.endsWith('.app')) return shell.openPath(file);
      const sh = path.join(path.dirname(file), 'apply.sh');
      fs.writeFileSync(sh, `#!/bin/sh
DMG="$1"; T="$2"; M=$(mktemp -d /tmp/cloudy-mnt.XXXXXX)
sleep 2
hdiutil attach -nobrowse -quiet -noverify -mountpoint "$M" "$DMG" || { open "$DMG"; exit 1; }
S=$(ls -d "$M"/*.app | head -n 1)
rm -rf "$T.new"
if cp -R "$S" "$T.new" && rm -rf "$T" && mv "$T.new" "$T"; then
  xattr -cr "$T"; codesign --force --deep --sign - "$T" 2>/dev/null
  hdiutil detach -quiet "$M"; open "$T"
else hdiutil detach -quiet "$M"; open "$DMG"; fi
`, { mode: 0o755 });
      spawn('/bin/sh', [sh, file, target], detached).unref();
    } else if (process.platform === 'linux') {
      const old = process.env.APPIMAGE; if (!old) return shell.openPath(path.dirname(file));
      const sh = path.join(path.dirname(file), 'apply.sh');
      fs.writeFileSync(sh, '#!/bin/sh\nsleep 2\nchmod +x "$1"\nif mv -f "$1" "$2"; then nohup "$2" >/dev/null 2>&1 & else nohup "$1" >/dev/null 2>&1 & fi\n', { mode: 0o755 });
      spawn('/bin/sh', [sh, file, old], detached).unref();
    }
    send('update-progress', { phase: 'install', pct: 100 });
    setTimeout(() => app.quit(), 800);
  }

  ipcMain.handle('updateInstall', async (_e, opt) => {
    const force = !!(opt && opt.force);
    if (busy) return { ok: false, error: 'Update läuft bereits.' };
    if (gameRunning && gameRunning()) return { ok: false, error: 'Bitte zuerst Minecraft beenden – dann kann Cloudy aktualisieren.' };
    if (!found || !found.asset || !app.isPackaged) { if (found) shell.openExternal(found.url); return { ok: false, opened: true, error: 'Automatisches Installieren geht hier nicht – die Download-Seite wurde geöffnet.' }; }
    busy = true;
    try {
      const file = await download(found.asset);
      if (found.isZip) { // ZIP-Update: in den Update-Ordner legen und wie ein lokales Update anwenden (Cloudy startet danach neu)
        const dir = path.join(app.getPath('userData'), 'update'); fs.mkdirSync(dir, { recursive: true });
        fs.copyFileSync(file, path.join(dir, 'cloudy-update-' + Date.now() + '.zip'));
        const r = force ? require('./localupdate').applyForce() : require('./localupdate').applyNow(); busy = false;
        return r.ok ? { ok: true } : { ok: false, error: r.msg || 'Update fehlgeschlagen.' };
      }
      install(file); return { ok: true };
    }
    catch (e) { busy = false; return { ok: false, error: String((e && e.message) || e) }; }
  });
};
