// Cloudy Server – Hauptprozess. Startet den Cloudy-Server als Kindprozess (mit der in Electron eingebauten Node-Laufzeit, kein Node noetig).
const { app, BrowserWindow, ipcMain, dialog, shell, powerSaveBlocker, Tray, Menu, nativeImage } = require('electron');
const path = require('path'), fs = require('fs'), os = require('os'), { execFile } = require('child_process');
const env = require('./lib/envfile'), files = require('./lib/files'), { Manager, ping } = require('./lib/manager');

let win = null, tray = null, quitting = false, blocker = null;
const U = () => app.getPath('userData');
const SETF = () => path.join(U(), 'settings.json');
const DEF = { serverDir: '', autoStart: true, autoRestart: true, launchAtLogin: false, keepAwake: true, tunnelMode: 'off', tunnelToken: '', backupDaily: false, backupKeep: 7, lang: 'de' };
let S = { ...DEF };
const loadS = () => { try { S = { ...DEF, ...JSON.parse(fs.readFileSync(SETF(), 'utf8')) }; } catch { S = { ...DEF }; } };
const saveS = () => { fs.mkdirSync(U(), { recursive: true }); fs.writeFileSync(SETF(), JSON.stringify(S, null, 1)); };
const root = () => S.serverDir || path.join(U(), 'server-files');
const defDir = () => app.isPackaged ? path.join(process.resourcesPath, 'server-default') : path.join(__dirname, '..', 'server');
const envPath = () => path.join(root(), 'cloudy.env');
const port = () => +(env.parse(readSafe(envPath())).PORT || 3364);
function readSafe(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }

const rnd = n => require('crypto').randomBytes(n).toString('base64').replace(/[^A-Za-z0-9]/g, '').slice(0, n);
function ensureEnv() {
  if (fs.existsSync(envPath())) return;
  fs.mkdirSync(root(), { recursive: true });
  fs.writeFileSync(envPath(), '# Cloudy Server – Einstellungen (wird von der App verwaltet)\n' + env.serialize({
    DB_HOST: '127.0.0.1', DB_USER: 'CloudyClient', DB_NAME: 'CloudyClient', DB_PASS: rnd(20), ADMIN_PASS: rnd(14), PORT: 3364, PUBLIC_URL: 'https://cloudyclient.com', UPLOAD_KEY: rnd(24) }));
}
function prepare() { const r = files.syncDefaults(root(), defDir()); ensureEnv(); return r; }

// ---- Server-Prozess ----
const nodeDeps = () => app.isPackaged ? path.join(app.getAppPath(), 'node_modules') : path.join(__dirname, 'node_modules');
const server = new Manager('server', () => {
  const entry = path.join(root(), 'app.js'); if (!fs.existsSync(entry)) throw new Error('app.js fehlt im Server-Ordner: ' + root());
  const e = { ...process.env, ...env.parse(readSafe(envPath())), ELECTRON_RUN_AS_NODE: '1', NODE_PATH: nodeDeps(), RESPAWN: '0' };
  return { cmd: process.execPath, args: ['app.js'], cwd: root(), env: e };
}, { autoRestart: true, backoffMs: 2500 });

function findBin(name) {
  const dirs = (process.env.PATH || '').split(path.delimiter).concat(['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/opt/homebrew/opt/mysql/bin', '/usr/local/opt/mysql/bin', 'C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin', 'C:\\Program Files (x86)\\cloudflared']);
  for (const d of dirs) for (const n of [name, name + '.exe']) { const p = path.join(d, n); try { if (fs.statSync(p).isFile()) return p; } catch {} }
  return '';
}
const tunnel = new Manager('tunnel', () => {
  const bin = findBin('cloudflared'); if (!bin) throw new Error('cloudflared ist nicht installiert (Mac: „brew install cloudflared“).');
  if (S.tunnelMode === 'token') { if (!S.tunnelToken) throw new Error('Kein Tunnel-Token eingetragen.'); return { cmd: bin, args: ['tunnel', '--no-autoupdate', 'run', '--token', S.tunnelToken], cwd: root(), env: process.env }; }
  if (S.tunnelMode === 'config') return { cmd: bin, args: ['tunnel', '--no-autoupdate', 'run'], cwd: root(), env: process.env };
  throw new Error('Tunnel ist aus.');
}, { autoRestart: true, backoffMs: 5000 });
// Token nie in Logs zeigen
const redact = s => S.tunnelToken ? String(s).split(S.tunnelToken).join('••••') : s;

const send = (ch, d) => { try { win && !win.isDestroyed() && win.webContents.send(ch, d); } catch {} };
for (const m of [server, tunnel]) { m.on('log', l => { l.s = redact(l.s); send('log', { who: m.name, ...l }); fileLog(m.name, l); }); m.on('state', i => { send('state', snap()); refreshTray(); }); }
let logStream = null, logDay = '';
function fileLog(who, l) {
  try {
    const day = new Date().toISOString().slice(0, 10); if (day !== logDay) { logDay = day; logStream && logStream.end(); const d = path.join(U(), 'logs'); fs.mkdirSync(d, { recursive: true }); logStream = fs.createWriteStream(path.join(d, `${day}.log`), { flags: 'a' });
      for (const f of fs.readdirSync(d).sort().slice(0, -14)) try { fs.unlinkSync(path.join(d, f)); } catch {} }
    logStream.write(`${new Date(l.t).toISOString()} [${who}] ${l.k === 'err' ? 'ERR ' : ''}${l.s}\n`);
  } catch {}
}
let health = { ok: false, at: 0 };
const snap = () => ({ server: server.info(), tunnel: tunnel.info(), health, port: port(), root: root(), version: app.getVersion() });
setInterval(async () => { if (server.state === 'running') { const ok = await ping(port()); if (ok !== health.ok) { health = { ok, at: Date.now() }; send('state', snap()); } else health.at = Date.now(); } else if (health.ok) { health = { ok: false, at: Date.now() }; send('state', snap()); } }, 4000);

// ---- Datenbank ----
async function dbConn(extra) {
  const mysql = require('mysql2/promise'); const e = env.parse(readSafe(envPath()));
  return mysql.createConnection({ host: e.DB_HOST || '127.0.0.1', port: +(e.DB_PORT || 3306), user: e.DB_USER, password: e.DB_PASS, database: e.DB_NAME, connectTimeout: 5000, ...extra });
}
const dbErr = e => e.code === 'ECONNREFUSED' ? 'MySQL läuft nicht (Verbindung abgelehnt). Starte MySQL oder installiere es.' : e.code === 'ER_ACCESS_DENIED_ERROR' ? 'Benutzer/Passwort falsch – lege die Datenbank unten neu an.' : e.code === 'ER_BAD_DB_ERROR' ? 'Die Datenbank existiert noch nicht – unten anlegen.' : (e.message || String(e));
const ident = s => '`' + String(s).replace(/[^A-Za-z0-9_]/g, '') + '`';

// ---- Backup ----
function copyDir(a, b) { fs.mkdirSync(b, { recursive: true }); for (const e of fs.readdirSync(a, { withFileTypes: true })) { if (['node_modules', '.history', 'backups', '.git'].includes(e.name)) continue; const s = path.join(a, e.name), d = path.join(b, e.name); if (e.isDirectory()) copyDir(s, d); else if (e.isFile()) fs.copyFileSync(s, d); } }
async function backup() {
  const base = path.join(S.serverDir ? root() : U(), 'backups'); const dir = path.join(base, new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19));
  fs.mkdirSync(dir, { recursive: true }); copyDir(root(), path.join(dir, 'server-files')); const res = { dir, files: true, db: false, note: '' };
  const dump = findBin('mysqldump'); const e = env.parse(readSafe(envPath()));
  if (dump) {
    await new Promise(r => execFile(dump, ['-h', e.DB_HOST || '127.0.0.1', '-u', e.DB_USER, '--single-transaction', '--routines', '-r', path.join(dir, 'database.sql'), e.DB_NAME], { env: { ...process.env, MYSQL_PWD: e.DB_PASS || '' }, timeout: 120000 }, (err, so, se) => { if (err) res.note = 'Datenbank-Sicherung fehlgeschlagen: ' + String(se || err.message).split('\n')[0]; else res.db = true; r(); }));
  } else res.note = 'mysqldump nicht gefunden – nur Dateien gesichert.';
  const all = fs.readdirSync(base).sort(); for (const d of all.slice(0, Math.max(0, all.length - (S.backupKeep || 7)))) try { fs.rmSync(path.join(base, d), { recursive: true, force: true }); } catch {}
  return res;
}
let lastBackup = 0; setInterval(async () => { if (S.backupDaily && Date.now() - lastBackup > 24 * 3600e3) { lastBackup = Date.now(); try { const r = await backup(); server.log('Auto-Backup: ' + r.dir + (r.note ? ' – ' + r.note : ''), 'sys'); } catch (e) { server.log('Auto-Backup fehlgeschlagen: ' + e.message, 'err'); } } }, 600e3);

// ---- IPC ----
const H = (n, f) => ipcMain.handle(n, async (_e, ...a) => { try { return { ok: true, data: await f(...a) }; } catch (e) { return { ok: false, error: e.message || String(e), syntax: e.syntax }; } });
H('state', () => snap());
H('logs', who => (who === 'tunnel' ? tunnel : server).logs.slice(-800).map(l => ({ ...l, s: redact(l.s) })));
H('start', () => { prepare(); server.opt.autoRestart = S.autoRestart; server.start(); });
H('stop', () => server.stop());
H('restart', async () => { prepare(); server.opt.autoRestart = S.autoRestart; await server.restart(); });
H('files', () => files.list(root()));
H('read', f => files.read(root(), f));
H('write', (f, t, force) => files.write(root(), f, t, force));
H('check', (f, t) => files.check(f, t));
H('versions', f => files.versions(root(), f));
H('readVersion', (f, id) => files.readVersion(root(), f, id));
H('resetFile', f => { files.resetToDefault(root(), defDir(), f); return files.read(root(), f); });
H('defaultDiff', () => files.syncDefaults(root(), defDir()).pending);
H('envGet', () => { const o = env.parse(readSafe(envPath())); return o; });
H('envSet', o => { const clean = {}; for (const [k, v] of Object.entries(o || {})) if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(k)) clean[k] = String(v); fs.mkdirSync(root(), { recursive: true }); if (fs.existsSync(envPath())) fs.copyFileSync(envPath(), envPath() + '.bak'); fs.writeFileSync(envPath(), env.serialize(clean)); });
H('settingsGet', () => ({ ...S, tunnelToken: S.tunnelToken ? '••••' : '' }));
H('settingsSet', p => {
  const allowed = Object.keys(DEF); for (const k of allowed) if (k in p && !(k === 'tunnelToken' && p[k] === '••••')) S[k] = p[k];
  S.backupKeep = Math.min(30, Math.max(1, +S.backupKeep || 7)); saveS(); applySystem(); return true;
});
H('chooseFolder', async () => { const r = await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'], title: 'Server-Ordner wählen' }); return r.canceled ? '' : r.filePaths[0]; });
H('openFolder', () => shell.openPath(root()));
H('openLogs', () => shell.openPath(path.join(U(), 'logs')));
H('openUrl', u => { if (/^https?:\/\//.test(u)) shell.openExternal(u); });
H('dbTest', async () => { try { const c = await dbConn(); const [r] = await c.query('SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema = DATABASE()'); await c.end(); return { ok: true, tables: r[0].n }; } catch (e) { return { ok: false, error: dbErr(e) }; } });
H('dbCreate', async (rootUser, rootPass) => {
  const e = env.parse(readSafe(envPath())); const mysql = require('mysql2/promise');
  if (!/^[A-Za-z0-9_]{1,32}$/.test(e.DB_USER || '') || !/^[A-Za-z0-9_]{1,64}$/.test(e.DB_NAME || '')) throw new Error('DB_USER/DB_NAME dürfen nur Buchstaben, Zahlen und _ enthalten.');
  let c; try { c = await mysql.createConnection({ host: e.DB_HOST || '127.0.0.1', port: +(e.DB_PORT || 3306), user: rootUser || 'root', password: rootPass || '', connectTimeout: 5000 }); } catch (x) { throw new Error(dbErr(x)); }
  try {
    await c.query(`CREATE DATABASE IF NOT EXISTS ${ident(e.DB_NAME)} CHARACTER SET utf8mb4`);
    await c.query(`CREATE USER IF NOT EXISTS ?@'localhost' IDENTIFIED BY ?`, [e.DB_USER, e.DB_PASS]); await c.query(`ALTER USER ?@'localhost' IDENTIFIED BY ?`, [e.DB_USER, e.DB_PASS]);
    await c.query(`CREATE USER IF NOT EXISTS ?@'127.0.0.1' IDENTIFIED BY ?`, [e.DB_USER, e.DB_PASS]).catch(() => {});
    await c.query(`GRANT ALL PRIVILEGES ON ${ident(e.DB_NAME)}.* TO ?@'localhost'`, [e.DB_USER]); await c.query(`GRANT ALL PRIVILEGES ON ${ident(e.DB_NAME)}.* TO ?@'127.0.0.1'`, [e.DB_USER]).catch(() => {});
    await c.query('FLUSH PRIVILEGES');
  } finally { await c.end(); } // Root-Zugang wird nirgends gespeichert
  return true;
});
H('mysqlStart', () => new Promise((res, rej) => { const b = findBin('brew'); if (!b) return rej(new Error('Homebrew nicht gefunden. Starte MySQL selbst.')); execFile(b, ['services', 'start', 'mysql'], { timeout: 60000 }, (e, so, se) => e ? rej(new Error(String(se || e.message).split('\n')[0])) : res(String(so).trim())); }));
H('tools', () => ({ cloudflared: !!findBin('cloudflared'), mysqldump: !!findBin('mysqldump'), mysql: !!(findBin('mysqld') || findBin('mysql')), brew: !!findBin('brew') }));
H('tunnelStart', () => { tunnel.start(); }); H('tunnelStop', () => tunnel.stop());
H('backup', () => backup()); H('backupOpen', () => shell.openPath(path.join(S.serverDir ? root() : U(), 'backups')));
H('exportReport', () => { // Fehlerbericht ohne Geheimnisse
  const e = env.parse(readSafe(envPath())); const safe = Object.fromEntries(Object.entries(e).map(([k, v]) => [k, env.mask(k, v)]));
  const txt = ['Cloudy Server – Fehlerbericht', new Date().toISOString(), `App ${app.getVersion()} · ${process.platform} ${os.release()} · Electron ${process.versions.electron}`, '', 'Status: ' + JSON.stringify(snap()), 'Einstellungen: ' + JSON.stringify(safe), '', '--- Server-Log (letzte 300) ---', ...server.logs.slice(-300).map(l => `${new Date(l.t).toISOString()} ${l.k} ${redact(l.s)}`)].join('\n');
  const f = path.join(app.getPath('desktop'), 'Cloudy-Server-Bericht.txt'); fs.writeFileSync(f, txt); shell.showItemInFolder(f); return f;
});

function applySystem() {
  try { app.setLoginItemSettings({ openAtLogin: !!S.launchAtLogin, openAsHidden: true }); } catch {}
  if (S.keepAwake && !blocker) blocker = powerSaveBlocker.start('prevent-app-suspension'); else if (!S.keepAwake && blocker != null) { powerSaveBlocker.stop(blocker); blocker = null; }
  server.opt.autoRestart = S.autoRestart;
}
function refreshTray() { if (!tray) return; const st = server.state; tray.setToolTip('Cloudy Server – ' + ({ running: 'läuft', starting: 'startet', restarting: 'startet neu', stopped: 'gestoppt', error: 'Fehler' }[st] || st)); }
function mkTray() {
  try {
    const img = nativeImage.createFromPath(path.join(__dirname, 'assets', 'icon.png')).resize({ width: 18, height: 18 }); tray = new Tray(img);
    tray.setContextMenu(Menu.buildFromTemplate([{ label: 'Fenster öffnen', click: showWin }, { label: 'Server neu starten', click: () => server.restart() }, { type: 'separator' }, { label: 'Beenden', click: () => { quitting = true; app.quit(); } }])); tray.on('click', showWin); refreshTray();
  } catch {}
}
function showWin() { if (!win || win.isDestroyed()) mk(); else { win.show(); win.focus(); } }
function mk() {
  win = new BrowserWindow({ width: 1080, height: 720, minWidth: 820, minHeight: 560, backgroundColor: '#0b0c10', title: 'Cloudy Server', titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default', webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  win.setMenuBarVisibility(false); win.loadFile(path.join(__dirname, 'ui', 'index.html'));
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:\/\//.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', e => e.preventDefault());
  win.on('close', e => { if (!quitting && tray) { e.preventDefault(); win.hide(); } });
}
if (!app.requestSingleInstanceLock()) app.quit(); else {
  app.on('second-instance', showWin);
  app.whenReady().then(() => {
    loadS(); applySystem(); try { prepare(); } catch (e) { server.log('Vorbereitung fehlgeschlagen: ' + e.message, 'err'); }
    mk(); mkTray();
    if (S.autoStart) server.start(); if (S.tunnelMode !== 'off') tunnel.start();
    if (S.launchAtLogin && process.argv.includes('--hidden')) win.hide();
  });
  app.on('activate', showWin);
  app.on('before-quit', async e => { if (quitting === 'done') return; e.preventDefault(); quitting = true; await Promise.all([server.stop(), tunnel.stop()]); quitting = 'done'; app.quit(); });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin' && !tray) app.quit(); });
}
