// Lokales Update: Eine Cloudy-Update-ZIP in den Update-Ordner legen – Cloudy installiert sie beim nächsten Start
// (oder per Knopf in den Einstellungen) und startet neu. Einstellungen, Mods und Profile liegen außerhalb und bleiben erhalten.
const fs = require('fs'), path = require('path');
const { execFileSync } = require('child_process');

exports.init = function init({ app, ipcMain, shell, auto }) {
  const appDir = path.resolve(__dirname, '..');
  const dirs = () => [path.join(app.getPath('userData'), 'update'), path.join(appDir, 'update')]; // beide Ordner werden geprüft
  for (const d of dirs()) try { fs.mkdirSync(d, { recursive: true }); } catch {}

  const nums = v => String(v).split('.').map(n => parseInt(n, 10) || 0);
  const newer = (a, b) => { const x = nums(a), y = nums(b); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); return false; };

  function findZip(force) {
    let best = null;
    for (const d of dirs()) {
      let names = []; try { names = fs.readdirSync(d); } catch {}
      for (const f of names) if (force ? /\.zip(\.(angewendet|uebersprungen|fehlgeschlagen))?$/i.test(f) : /\.zip$/i.test(f)) { const p = path.join(d, f), m = fs.statSync(p).mtimeMs; if (!best || m > best.m) best = { p, m }; }
    }
    return best && best.p;
  }

  function apply(force, anyVer) {
    if (!app.isPackaged) return { ok: false, msg: 'Lokale Updates gehen nur in der installierten App.' };
    const zip = findZip(force);
    if (!zip) return { ok: false, none: true, msg: 'Keine Update-Datei im Update-Ordner gefunden.' };
    const tmp = path.join(app.getPath('temp'), 'cloudy-patch'), mark = s => { try { if (/\.zip$/i.test(zip)) fs.renameSync(zip, zip + '.' + s); } catch {} };
    try {
      fs.rmSync(tmp, { recursive: true, force: true }); fs.mkdirSync(tmp, { recursive: true });
      execFileSync('tar', ['-xf', zip, '-C', tmp], { windowsHide: true });
      let root = tmp;
      if (!fs.existsSync(path.join(root, 'main.js'))) {
        const hit = fs.readdirSync(tmp).find(n => fs.existsSync(path.join(tmp, n, 'main.js')));
        if (hit) root = path.join(tmp, hit);
      }
      const pj = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
      if (!fs.existsSync(path.join(root, 'main.js')) || pj.name !== 'cloudy') throw new Error('Das ist keine Cloudy-Update-Datei.');
      const ep = n => { try { return +n.versionEpoch || 0; } catch { return 0; } }, myEp = ep(require('../package.json')); // Versions-Neustart (1.9.0 -> 0.2.1): höhere Epoche gilt immer als neuer
      const pe = ep(pj), isNewer = pe > myEp || (pe === myEp && newer(pj.version, app.getVersion())); // Downgrades sind nie erlaubt (auch nicht erzwungen)
      if (!isNewer && !anyVer) { mark('uebersprungen'); return { ok: false, msg: `Update ${pj.version} ist nicht neuer als die installierte Version ${app.getVersion()} – zurück auf ältere Versionen geht nicht.` }; }
      fs.cpSync(root, appDir, { recursive: true, force: true, filter: src => { // vorhandene Konfiguration (z. B. Update-Quelle) nicht überschreiben
        const rel = path.relative(root, src);
        return !(rel.startsWith('config' + path.sep) && fs.existsSync(path.join(appDir, rel)));
      } });
      mark('angewendet'); fs.rmSync(tmp, { recursive: true, force: true });
      return { ok: true, version: pj.version };
    } catch (e) { mark('fehlgeschlagen'); return { ok: false, msg: 'Update fehlgeschlagen: ' + String((e && e.message) || e) }; }
  }


  // ---- weitere Wege: Datei auswählen und Update von einer eigenen Adresse (beliebiger HTTPS-Server, JSON-Manifest oder direkte ZIP) ----
  const { dialog } = require('electron');
  const toRelaunch = r => { if (r.ok) setTimeout(() => { app.relaunch(); app.exit(0); }, 700); return r; };
  exports.applyNow = () => toRelaunch(apply(false));
  exports.applyForce = () => toRelaunch(apply(false, true)); // erzwungen: auch gleiche oder ältere Version
  ipcMain.handle('updatePickFile', async () => {
    const r = await dialog.showOpenDialog({ title: 'Cloudy-Update wählen', filters: [{ name: 'Cloudy-Update', extensions: ['zip'] }], properties: ['openFile'] });
    if (r.canceled || !r.filePaths[0]) return { ok: false, none: true, msg: '' };
    try { fs.copyFileSync(r.filePaths[0], path.join(dirs()[0], 'cloudy-update-' + Date.now() + '.zip')); } catch { return { ok: false, msg: 'Datei konnte nicht kopiert werden.' }; }
    return toRelaunch(apply(false));
  });
  ipcMain.handle('updateCheckUrl', async (_e, url) => { // prüft ein Manifest auf einer eigenen Adresse (auch Pflicht-Update nach 24 h)
    try {
      url = String(url || '').trim(); if (!/^https:\/\/[^\s]+\.json(\?.*)?$/i.test(url)) return { ok: false };
      const m = await (await fetch(url, { headers: { 'User-Agent': 'Cloudy-Updater' } })).json(), ver = String(m.version || ''), nw = !!ver && newer(ver, app.getVersion());
      return { ok: true, latest: ver, newer: nw, mandatory: nw && require('./updater').seen ? require('./updater').seen('url:' + ver) : false };
    } catch { return { ok: false }; }
  });
  ipcMain.handle('updateFromUrl', async (_e, url) => {
    url = String(url || '').trim();
    if (!/^https:\/\/[^\s]+$/i.test(url)) return { ok: false, msg: 'Bitte eine https://-Adresse eintragen.' };
    try {
      let zipUrl = url, ver = '';
      if (!/\.zip(\?.*)?$/i.test(url)) { // JSON-Manifest: { "version": "0.3.32", "url": "https://…/cloudy-update-0.3.32.zip" }
        const m = await (await fetch(url, { headers: { 'User-Agent': 'Cloudy-Updater' } })).json();
        zipUrl = new URL(m.url || m.zip || m.download || '', url).href; ver = String(m.version || '');
        if (ver && !newer(ver, app.getVersion())) return { ok: false, msg: `Cloudy ${app.getVersion()} ist aktuell (Server: ${ver}).` };
      }
      if (!/^https:/i.test(zipUrl)) return { ok: false, msg: 'Die Update-Datei muss über https geladen werden.' };
      const res = await fetch(zipUrl, { headers: { 'User-Agent': 'Cloudy-Updater' } });
      if (!res.ok) return { ok: false, msg: 'Download fehlgeschlagen (' + res.status + ').' };
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 1000 || buf.readUInt32LE(0) !== 0x04034b50) return { ok: false, msg: 'Das ist keine gültige Update-Datei (ZIP).' };
      fs.writeFileSync(path.join(dirs()[0], 'cloudy-update-' + Date.now() + '.zip'), buf);
    } catch (e) { return { ok: false, msg: 'Adresse nicht erreichbar.' }; }
    return toRelaunch(apply(false));
  });
  ipcMain.handle('localUpdateFolder', () => shell.openPath(dirs()[0]));
  ipcMain.handle('localUpdateRun', (_e, o) => { const r = apply(!!(o && o.force)); if (r.ok) setTimeout(() => { app.relaunch(); app.exit(0); }, 700); return r; });
  return { pending() { const z = findZip(false); return z ? path.basename(z) : null; }, force() { const r = apply(true); if (r.ok) setTimeout(() => { app.relaunch(); app.exit(0); }, 400); return r; }, applyOnStart() { if (auto && !auto()) return false; const r = apply(); if (r.ok) { app.relaunch(); app.exit(0); return true; } return false; } };
};
