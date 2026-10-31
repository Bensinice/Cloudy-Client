const { app, BrowserWindow, ipcMain, shell, safeStorage, dialog, nativeImage, net } = require('electron');
const os = require('os');
const crypto = require('crypto');

const path = require('path');
const fs = require('fs');
const { execFileSync, spawnSync, spawn } = require('child_process');
const { openZip } = require('./lib/zipread');
const { Client, Authenticator } = require('minecraft-launcher-core');
const { readJarInfo, prettyName } = require('./lib/modinfo');
const optsSync = require('./lib/options');
const { findSystemJava } = require('./lib/java');
const { readPackInfo } = require('./lib/packs');

// Konfiguration: config/app.json → "updateRepo": "deinname/cloudy" (dann sucht der Update-Knopf automatisch dort)
const APP_CFG = (() => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'config', 'app.json'), 'utf8')); } catch { return {}; } })();
const DEFAULT_REPO = 'Bensinice/Cloudy-Client'; // immer dieselbe Quelle (config/app.json wird bei Updates behalten und kann veraltet sein)

let win;
const root = path.join(app.getPath('userData'), 'minecraft');
const HDR = { headers: { 'User-Agent': 'Cloudy-Launcher/0.9.10 (github.com/cloudy-launcher; contact via launcher)' } };
const send = (ch, d) => win && !win.isDestroyed() && win.webContents.send(ch, d);
// Netzwerk: zuerst Chromium (nutzt Windows-Proxy, DNS und Zertifikate des Systems – klappt auch bei Freunden mit Schul-/Firmen-/Antivirus-Netz), sonst Node. Mit Zeitlimit und einem zweiten Versuch.
async function mfetch(u, o) {
  let last;
  for (let i = 0; i < 2; i++) {
    for (const f of [net && app.isReady() ? (x, y) => net.fetch(x, y) : null, (x, y) => fetch(x, y)]) {
      if (!f) continue;
      const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 20000);
      try { return await f(u, { ...(o || {}), signal: ctl.signal }); } catch (e) { last = e; } finally { clearTimeout(t); }
    }
    await new Promise(r => setTimeout(r, 600));
  }
  try { return await dohFetch(u, o); } catch (e) { last = last || e; }
  throw last;
}
// Dritter Weg, wenn DNS/Provider eine Seite sperrt: Adresse per DNS-ueber-HTTPS (Cloudflare/Google, direkt per IP) holen und mit richtigem Hostnamen verbinden
const dohCache = new Map();
async function dohIp(host) {
  const c = dohCache.get(host); if (c && Date.now() - c.t < 3600e3) return c.ip;
  const https = require('https');
  const q = base => new Promise((res, rej) => { const rq = https.get(base + '?name=' + encodeURIComponent(host) + '&type=A', { headers: { accept: 'application/dns-json' }, timeout: 6000 }, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => { try { const a = (JSON.parse(b).Answer || []).find(x => x.type === 1); a ? res(a.data) : rej(new Error('no A')); } catch (e) { rej(e); } }); }); rq.on('error', rej); rq.on('timeout', () => rq.destroy(new Error('doh timeout'))); });
  let ip; for (const b of ['https://1.1.1.1/dns-query', 'https://8.8.8.8/resolve', 'https://9.9.9.9:5053/dns-query']) { try { ip = await q(b); if (ip) break; } catch {} }
  if (!ip) throw new Error('DNS-over-HTTPS nicht erreichbar');
  dohCache.set(host, { ip, t: Date.now() }); return ip;
}
async function dohFetch(u, o) {
  const https = require('https'), url = new URL(u), ip = await dohIp(url.hostname), body = o && o.body ? o.body : null;
  return new Promise((res, rej) => {
    const rq = https.request({ host: ip, servername: url.hostname, port: url.port || 443, path: url.pathname + url.search, method: (o && o.method) || 'GET', headers: { ...((o && o.headers) || {}), Host: url.hostname }, timeout: 20000 }, r => {
      const ch = []; r.on('data', d => ch.push(d)); r.on('end', () => { const h = new Headers(); for (const [k, v] of Object.entries(r.headers)) if (typeof v === 'string') h.set(k, v); const st = r.statusCode || 0; res(new Response([204, 304].includes(st) ? null : Buffer.concat(ch), { status: st, headers: h })); });
    });
    rq.on('error', rej); rq.on('timeout', () => rq.destroy(new Error('timeout'))); if (body) rq.write(body); rq.end();
  });
}
const getJSON = async u => { const r = await mfetch(u, HDR); if (!r.ok) throw new Error(r.status + ' ' + u); return r.json(); };
async function download(url, dest) {
  const r = await mfetch(url, HDR);
  if (!r.ok) throw new Error('Download fehlgeschlagen: ' + url);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
}

const IS_MAC = process.platform === 'darwin', IS_WIN = process.platform === 'win32';

const uiPrefFile = path.join(app.getPath('userData'), 'ui-pref.json');
const uiPref = () => { try { return JSON.parse(fs.readFileSync(uiPrefFile, 'utf8')) || {}; } catch { return {}; } };
function createWindow() {
  const TR = uiPref().transparent === true && !IS_MAC; // Glas-Theme: durchsichtiges Fenster (geht nur beim Erstellen des Fensters)
  const platformOpts = TR ? { frame: false, transparent: true, hasShadow: false, autoHideMenuBar: true } : IS_MAC
    ? { titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 20, y: 20 }, vibrancy: 'under-window', visualEffectState: 'active' }
    : IS_WIN
      // Windows: eigene Titelleiste, die System-Knöpfe (–, □, ×) bleiben oben rechts
      ? { titleBarStyle: 'hidden', autoHideMenuBar: true } // eigene, theme-passende Fensterknöpfe im Fenster (siehe .wc)
      : { autoHideMenuBar: true };
  win = new BrowserWindow({
    width: 1040, height: 700, minWidth: 880, minHeight: 600,
    ...platformOpts,
    backgroundColor: TR ? '#00000000' : '#cfe8ff',
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true }
  });
  if (!IS_MAC) win.removeMenu();
  win.webContents.on('before-input-event', (e, i) => { // Notfall-Kürzel, auch wenn die Oberfläche hängt: F5 / Strg+R = neu laden, Strg+Umschalt+U = Update erzwingen
    if (i.type !== 'keyDown') return; const k = String(i.key).toLowerCase(), c = i.control || i.meta;
    if (k === 'f5' || (c && !i.shift && k === 'r')) { e.preventDefault(); reloadUi(); }
    else if (c && i.shift && k === 'u') { e.preventDefault(); forceUpdate(); }
  });
  // Nur beim Laden der Hauptseite prüfen, nicht bei eingebetteten Frames (z. B. dem Spotify-Player). Sonst gilt die Oberfläche fälschlich als hängend und „Neu laden“ stürzt sie ab.
  win.webContents.on('did-start-navigation', (e, url, inPlace, isMain) => {
    const main = e && typeof e === 'object' && 'isMainFrame' in e ? e.isMainFrame : isMain, same = e && typeof e === 'object' && 'isSameDocument' in e ? e.isSameDocument : inPlace;
    if (main && !same) armWatchdog();
  });
  armWatchdog();
  win.loadFile('index.html');
}
let uiReady = false, wdTimer = null;
function reloadUi() {
  if (!win || win.isDestroyed()) return;
  if (!uiReady) { try { win.webContents.forcefullyCrashRenderer(); } catch {} }
  win.webContents.reloadIgnoringCache();
}
function forceUpdate() {
  const r = localUpdate.force();
  if (!r.ok && win && !win.isDestroyed()) dialog.showMessageBox(win, { type: 'info', message: r.msg || 'Kein Update im Update-Ordner gefunden.', detail: 'Lege die Update-ZIP in den Update-Ordner und versuche es erneut.' });
  return r;
}
function armWatchdog() { // meldet sich die Oberfläche nicht innerhalb von 12 s, bietet Cloudy Neu laden / Update erzwingen an
  uiReady = false; clearTimeout(wdTimer);
  wdTimer = setTimeout(async () => {
    if (uiReady || !win || win.isDestroyed()) return;
    const r = await dialog.showMessageBox(win, { type: 'warning', buttons: ['Neu laden', 'Update erzwingen', 'Weiter warten'], defaultId: 0, cancelId: 2, message: 'Cloudy reagiert nicht.', detail: 'Die Oberfläche wurde nicht geladen. Du kannst sie neu laden oder das Update aus dem Update-Ordner erzwingen.' });
    if (r.response === 0) reloadUi(); else if (r.response === 1) forceUpdate(); else armWatchdog();
  }, 12000);
}
ipcMain.handle('rendererReady', () => { uiReady = true; clearTimeout(wdTimer); });
ipcMain.handle('appReload', () => reloadUi());
ipcMain.handle('forceUpdate', () => forceUpdate());

// Konfiguration für den Minecraft-Client (Theme, Widgets) – wird beim Start als -Dcloudy.cfg übergeben
const cfgFile = path.join(app.getPath('userData'), 'cloudy-client.json');
function cfgPatch(p) { let c = {}; try { c = JSON.parse(fs.readFileSync(cfgFile, 'utf8')); } catch {} Object.assign(c, p); try { fs.writeFileSync(cfgFile, JSON.stringify(c)); } catch {} return c; }
let themeRelaunch = false;
ipcMain.handle('themeColor', (_e, { bg, fg, sky, accent, dark, id }) => {
  if (win && !win.isDestroyed()) { try { win.setBackgroundColor(id === 'glass' && !IS_MAC ? '#00000000' : bg); } catch {} }
  if (!IS_MAC && id && !themeRelaunch) { // Glas-Theme braucht ein anderes Fenster -> Cloudy startet einmal neu
    const want = id === 'glass', p = uiPref();
    if ((p.transparent === true) !== want && !mcProc) { themeRelaunch = true; try { fs.writeFileSync(uiPrefFile, JSON.stringify({ ...p, transparent: want })); } catch {} setTimeout(() => { app.relaunch(); app.exit(0); }, 500); }
  }
  if (Array.isArray(sky) && sky.length === 2 && sky.every(c => /^#[0-9a-f]{6}$/i.test(c))) cfgPatch({ theme: { id: String(id || ''), sky, accent: /^#[0-9a-f]{6}$/i.test(accent) ? accent : '#4aa3ff', dark: !!dark } });
});
const GATE_HASH = 'd9594a94758b1376db560e385a3acdebfa7639454c2f2a121d5a2628a142cc11';
ipcMain.handle('gate', async (_e, code) => { // Zugangscode: neue Codes kommen vom Konto-Server; der alte feste Code gilt nur noch, solange der Server noch keinen Zugangscode hat
  if (typeof code === 'string') {
    const legacyOk = require('crypto').createHash('sha256').update('cloudy-gate:' + code.trim().toLowerCase()).digest('hex') === GATE_HASH, ok = g => { cfgPatch({ gateOk: true, gateTok: typeof g === 'string' ? g : '' }); return { ok: true }; };
    if (!srvCfg()) return legacyOk ? ok() : { ok: false };
    const r = await srvCall('/gate', { code: code.trim() }).catch(() => null);
    if (!r) return { ok: false, error: 'The account server is not reachable – cannot check the code. Check your internet connection.' };
    if (r.ok) return ok(r.grant);
    if (r.legacy && legacyOk) return ok();
    return { ok: false, error: /abgelaufen/.test(r.error || '') ? 'This access code has expired.' : /aufgebraucht/.test(r.error || '') ? 'This access code has been used up.' : '' };
  }
  return { ok: cfgPatch({}).gateOk === true };
});
const gateNeedsSrv = { ok: false, error: 'Zugangscodes brauchen den Konto-Server.' };
ipcMain.handle('gateList', async () => (srvCfg() && adminOnly()) ? ((await srvCall('/admin/gatecodes', {}, srvTok).catch(() => ({}))).codes || []) : []);
ipcMain.handle('gateCreate', async (_e, o) => { if (!adminOnly()) return { ok: false, error: 'Nur für Admins.' }; if (!srvCfg()) return gateNeedsSrv; const r = await srvCall('/admin/gatecreate', o || {}, srvTok).catch(() => null); return r ? { ok: !!r.ok, code: r.code, error: r.error } : { ...SRV_DOWN, ok: false }; });
ipcMain.handle('admStats', async () => (srvCfg() && adminOnly()) ? await srvCall('/admin/stats', {}, srvTok).catch(() => null) : null);
ipcMain.handle('admAnnounce', async (_e, text) => (srvCfg() && adminOnly()) ? !!(await srvCall('/admin/announce', { text: String(text || '') }, srvTok).catch(() => ({}))).ok : false);
ipcMain.handle('announceGet', async () => srvCfg() && srvTok ? await srvCall('/announce', {}, srvTok).catch(() => null) : null);
ipcMain.handle('gateRevokeUser', async (_e, name) => (srvCfg() && adminOnly()) ? ((await srvCall('/admin/gaterevokeuser', { name }, srvTok).catch(() => ({}))).revoked || 0) : -1);
ipcMain.handle('gateDelete', async (_e, code, revoke) => (srvCfg() && adminOnly()) ? !!(await srvCall('/admin/gatedelete', { code, revoke: !!revoke }, srvTok).catch(() => ({}))).ok : false);
// Entzogener Zugang: Der Launcher fragt beim Start und danach alle 5 Minuten, ob sein Zugang noch gilt (nur bei erreichbarem Server; alte Installationen ohne Zugangs-Kennung bleiben freigeschaltet)
async function gateCheck() { try { const c = cfgPatch({}); if (!srvCfg() || c.gateOk !== true || !c.gateTok) return; const r = await srvCall('/gatecheck', { grant: c.gateTok }).catch(() => null); if (r && r.ok === false) { cfgPatch({ gateOk: false, gateTok: '' }); send('gateRevoked'); } } catch {} }
setTimeout(gateCheck, 6000); setInterval(gateCheck, 300000);
ipcMain.handle('toolTex', (_e, v) => { if (typeof v === 'boolean') cfgPatch({ toolTex: v }); return cfgPatch({}).toolTex !== false; });
ipcMain.handle('texCfg', (_e, v) => { const ok = ['toolTex', 'texTotem', 'texInv', 'texTheme']; if (v && typeof v === 'object') { const p = {}; for (const k of ok) if (typeof v[k] === 'boolean') p[k] = v[k]; if (typeof v.texColor === 'string' && /^#[0-9a-f]{6}$/i.test(v.texColor)) p.texColor = v.texColor; cfgPatch(p); } const c = cfgPatch({}); return { toolTex: c.toolTex !== false, texTotem: c.texTotem !== false, texInv: c.texInv !== false, texTheme: c.texTheme !== false, texColor: c.texColor || '#4aa3ff' }; });
ipcMain.handle('clientCfg', (_e, p) => { if (!p || typeof p !== 'object') return false; const o = {}; if (Array.isArray(p.widgets)) o.widgets = p.widgets.slice(0, 12).map(w => ({ text: String(w.text || '').slice(0, 80), x: Math.max(0, Math.min(100, +w.x || 0)), on: w.on !== false })); if (typeof p.top === 'boolean') o.top = p.top; cfgPatch(o); return true; });
const artCache = new Map();
ipcMain.handle('mediaArt', async (_e, { artist, title }) => { // Cover über die öffentliche iTunes-Suche (die Spotify-App gibt unter Windows kein Bild heraus)
  const k = (artist + '|' + title).slice(0, 160); if (artCache.has(k)) return artCache.get(k);
  let out = null;
  try {
    const d = await getJSON('https://itunes.apple.com/search?media=music&entity=song&limit=1&term=' + encodeURIComponent(String(artist).slice(0, 60) + ' ' + String(title).slice(0, 80)));
    const u = d && d.results && d.results[0] && d.results[0].artworkUrl100;
    if (u && /^https:\/\//.test(u)) { const r = await fetch(u.replace('100x100', '200x200')); if (r.ok) out = 'data:image/jpeg;base64,' + Buffer.from(await r.arrayBuffer()).toString('base64'); }
  } catch {}
  if (artCache.size > 60) artCache.clear(); artCache.set(k, out); return out;
});
ipcMain.handle('winCtl', (_e, a) => { if (!win || win.isDestroyed()) return; if (a === 'min') win.minimize(); else if (a === 'max') { win.isMaximized() ? win.unmaximize() : win.maximize(); } else if (a === 'close') win.close(); });

ipcMain.handle('versions', async (_e, snapshots) => {
  const data = await getJSON('https://launchermeta.mojang.com/mc/game/version_manifest_v2.json');
  return data.versions.filter(v => v.type === 'release' || (snapshots && v.type === 'snapshot'))
    .map(v => ({ id: v.id, type: v.type, date: v.releaseTime }));
});

// ---- Java: passende Version automatisch laden (behebt meist Fehlercode 255) ----
// Schneller Start: Ergebnisse von Netzwerkabfragen merken (Java-Version, Fabric-Profil, Mod-Prüfung), damit nicht bei jedem Start alles neu gefragt wird
const fastFile = path.join(app.getPath('userData'), 'fastcache.json');
let fastData = null;
const fastLoad = () => { if (!fastData) { try { fastData = JSON.parse(fs.readFileSync(fastFile, 'utf8')); } catch { fastData = {}; } } return fastData; };
const fastGet = (k, maxAge) => { const e = fastLoad()[k]; return e && Date.now() - e.t <= maxAge ? e.v : null; };
const fastSet = (k, v) => { fastLoad()[k] = { t: Date.now(), v }; try { fs.writeFileSync(fastFile, JSON.stringify(fastData)); } catch {} };
let javaMajorNow = 0;
async function ensureJava(mc) {
  const plat = IS_MAC ? 'mac' : IS_WIN ? 'windows' : process.platform === 'linux' ? 'linux' : null;
  if (!plat) return 'java';
  let major = fastGet('jv:' + mc, Infinity); // die Java-Version einer Minecraft-Version ändert sich nie
  if (!major) {
    const manifest = await getJSON('https://launchermeta.mojang.com/mc/game/version_manifest_v2.json');
    const entry = manifest.versions.find(v => v.id === mc);
    major = entry ? ((await getJSON(entry.url)).javaVersion || {}).majorVersion || 8 : 21;
    if (entry) fastSet('jv:' + mc, major);
  }
  javaMajorNow = major;
  const dir = path.join(app.getPath('userData'), 'runtimes', 'java' + major);
  // javaw.exe startet ohne zusätzliches Konsolenfenster
  const bin = IS_MAC ? path.join(dir, 'Contents', 'Home', 'bin', 'java')
    : IS_WIN ? path.join(dir, 'bin', 'javaw.exe')
    : path.join(dir, 'bin', 'java');
  if (!fs.existsSync(bin)) {
    const sys = findSystemJava(major); // vorhandenes Java mit passender Version nutzen
    if (sys) return sys;
    send('status', `Lade Java ${major} …`);
    const arch = process.arch === 'arm64' ? 'aarch64' : 'x64';
    const archive = path.join(app.getPath('temp'), IS_WIN ? 'cloudy-java.zip' : 'cloudy-java.tgz');
    await download(`https://api.adoptium.net/v3/binary/latest/${major}/ga/${plat}/${arch}/jre/hotspot/normal/eclipse`, archive);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    if (IS_WIN) extractZipWin(archive, dir);
    else execFileSync('tar', ['xzf', archive, '-C', dir, '--strip-components=1']);
    fs.rmSync(archive, { force: true });
    if (!fs.existsSync(bin)) throw new Error('Java konnte nicht entpackt werden. Versuche „Java neu laden“ in den Einstellungen.');
  }
  return bin;
}

// Windows: tar.exe (ab Windows 10) kann ZIPs; sonst PowerShell. Der oberste Ordner im Archiv wird entfernt.
function extractZipWin(zip, dir) {
  try { execFileSync('tar', ['-xf', zip, '-C', dir, '--strip-components=1'], { windowsHide: true }); return; } catch {}
  const tmp = dir + '_tmp';
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  try { execFileSync('tar', ['-xf', zip, '-C', tmp], { windowsHide: true }); } catch { fs.rmSync(tmp, { recursive: true, force: true }); fs.mkdirSync(tmp, { recursive: true }); execFileSync('powershell', ['-NoProfile', '-Command', `Expand-Archive -LiteralPath '${zip.replace(/'/g, "''")}' -DestinationPath '${tmp.replace(/'/g, "''")}' -Force`], { windowsHide: true }); }
  const inner = fs.readdirSync(tmp);
  const top = inner.length === 1 ? path.join(tmp, inner[0]) : tmp;
  for (const f of fs.readdirSync(top)) fs.renameSync(path.join(top, f), path.join(dir, f));
  fs.rmSync(tmp, { recursive: true, force: true });
}

// ---- Fabric ----
async function ensureFabric(mc) {
  mc = bv(mc);
  const have = id => id && fs.existsSync(path.join(root, 'versions', id, id + '.json'));
  const fresh = fastGet('fb:' + mc, 3 * 864e5); // 3 Tage lang nicht neu abfragen
  if (have(fresh)) return fresh;
  try {
    const loaders = await getJSON(`https://meta.fabricmc.net/v2/versions/loader/${mc}`);
    const l = loaders.find(x => x.loader.stable) || loaders[0];
    if (!l) throw new Error('Kein Fabric für ' + mc);
    const prof = await getJSON(`https://meta.fabricmc.net/v2/versions/loader/${mc}/${l.loader.version}/profile/json`);
    const dir = path.join(root, 'versions', prof.id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, prof.id + '.json'), JSON.stringify(prof));
    fastSet('fb:' + mc, prof.id);
    return prof.id;
  } catch (e) {
    const old = fastGet('fb:' + mc, Infinity); // offline: das zuletzt eingerichtete Profil nutzen
    if (have(old)) return old;
    throw e;
  }
}

// ---- Modrinth ----
const bv = v => String(v || '').split('~')[0]; // Instanz-Schlüssel „1.21.4~abc“ -> Minecraft-Version „1.21.4“ (mehrere Kopien derselben Version)
const gameDir = v => path.join(root, 'instances', v);
const sharedDir = path.join(app.getPath('userData'), 'shared');
const modsDir = v => path.join(gameDir(v), 'mods');
const PERF = ['fabric-api', 'sodium', 'lithium', 'ferrite-core', 'entityculling', 'modernfix', 'immediatelyfast', 'dynamic-fps'];
const PERF_VK = ['fabric-api', 'lithium', 'ferrite-core', 'entityculling', 'modernfix', 'vulkanmod']; // Vulkan-Modus: VulkanMod ersetzt Sodium & ImmediatelyFast
const GC_FLAGS = ['-XX:+UseG1GC', '-XX:+ParallelRefProcEnabled', '-XX:MaxGCPauseMillis=40', '-XX:+UnlockExperimentalVMOptions', '-XX:G1NewSizePercent=30', '-XX:G1MaxNewSizePercent=40']; // weniger Ruckler durch Speicherbereinigung

async function installMod(project, mc, seen = new Set()) {
  if (seen.has(project)) return true;
  const top = seen.size === 0, fkey = 'md:' + mc + ':' + project;
  if (top) { const c = fastGet(fkey, 12 * 3600e3); if (c && fs.existsSync(path.join(modsDir(mc), c))) return true; } // vor kurzem geprüft und vorhanden: kein Modrinth-Aufruf
  seen.add(project);
  const q = `game_versions=${encodeURIComponent(JSON.stringify([bv(mc)]))}&loaders=${encodeURIComponent('["fabric"]')}`;
  const vers = await getJSON(`https://api.modrinth.com/v2/project/${project}/version?${q}`);
  const v = vers.find(x => x.version_type === 'release') || vers[0];
  if (!v) return false;
  const f = v.files.find(x => x.primary) || v.files[0];
  const dest = path.join(modsDir(mc), f.filename);
  if (!fs.existsSync(dest)) await download(f.url, dest);
  for (const d of v.dependencies || [])
    if (d.dependency_type === 'required' && d.project_id) await installMod(d.project_id, mc, seen).catch(() => {});
  if (top) fastSet(fkey, f.filename);
  return true;
}

const catFacet = c => (/^[\w-]{2,30}$/.test(String(c || '')) ? [[`categories:${c}`]] : []);
ipcMain.handle('modsSearch', async (_e, { q, version, cat, offset }) => {
  const facets = encodeURIComponent(JSON.stringify([['project_type:mod'], ['categories:fabric'], [`versions:${bv(version)}`], ...catFacet(cat)]));
  const d = await getJSON(`https://api.modrinth.com/v2/search?query=${encodeURIComponent(q || '')}&facets=${facets}&limit=${Math.max(1, Math.min(40, (+limit || 20) | 0))}&offset=${Math.max(0, Math.min(2000, (+offset || 0) | 0))}${['relevance', 'downloads', 'follows', 'newest', 'updated'].includes(index) ? '&index=' + index : ''}`);
  return d.hits.map(h => ({ id: h.project_id, title: h.title, desc: h.description, icon: h.icon_url, downloads: h.downloads, follows: h.follows, author: h.author, slug: h.slug, gallery: h.featured_gallery || (h.gallery && h.gallery[0]) || '', cats: h.display_categories || h.categories || [] }));
});
ipcMain.handle('modsInstall', async (_e, id, version) => { try { await ensureFabric(version).catch(() => {}); return await installMod(id, version); } catch { return false; } });
ipcMain.handle('modsDisableMatch', (_e, v, word) => { // schaltet Mods ab, deren Dateiname das Wort enthält
  let n = 0; const d = modsDir(v), w = String(word || '').toLowerCase();
  if (!w) return 0;
  try { for (const f of fs.readdirSync(d)) if (f.endsWith('.jar') && f.toLowerCase().includes(w)) { fs.renameSync(path.join(d, f), path.join(d, f + '.disabled')); n++; } } catch {}
  return n;
});
// ---- Eigener Hintergrund ----
const bgFile = path.join(app.getPath('userData'), 'background.dat');
ipcMain.handle('bgGet', () => { try { return fs.readFileSync(bgFile, 'utf8'); } catch { return null; } });
ipcMain.handle('bgClear', () => fs.rmSync(bgFile, { force: true }));
ipcMain.handle('bgPick', async () => {
  const r = await dialog.showOpenDialog(win, { title: 'Hintergrundbild wählen', filters: [{ name: 'Bilder', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }], properties: ['openFile'] });
  if (r.canceled || !r.filePaths[0]) return { ok: false, cancel: true };
  try {
    const b = fs.readFileSync(r.filePaths[0]);
    if (b.length > 12 * 1024 * 1024) return { ok: false, error: 'Bild ist größer als 12 MB.' };
    const ext = path.extname(r.filePaths[0]).slice(1).toLowerCase().replace('jpg', 'jpeg');
    const data = `data:image/${ext};base64,${b.toString('base64')}`;
    fs.writeFileSync(bgFile, data);
    return { ok: true, data };
  } catch { return { ok: false, error: 'Bild konnte nicht gelesen werden.' }; }
});
// ---- Screenshot-Manager ----
const shotDir = v => path.join(gameDir(v), 'screenshots');
ipcMain.handle('shotList', (_e, v) => {
  let files = [];
  try { files = fs.readdirSync(shotDir(v)).filter(n => /\.(png|jpe?g)$/i.test(n)).map(n => ({ file: n, mtime: fs.statSync(path.join(shotDir(v), n)).mtimeMs })).sort((a, b) => b.mtime - a.mtime).slice(0, 60); } catch {}
  return files.map(x => { let thumb = null; try { thumb = nativeImage.createFromPath(path.join(shotDir(v), x.file)).resize({ width: 360 }).toDataURL(); } catch {} return { ...x, thumb }; });
});
ipcMain.handle('shotOpen', (_e, v, f) => shell.openPath(path.join(shotDir(v), path.basename(f))));
ipcMain.handle('shotDelete', (_e, v, f) => shell.trashItem(path.join(shotDir(v), path.basename(f)))); // in den Papierkorb
ipcMain.handle('shotFolder', (_e, v) => { fs.mkdirSync(shotDir(v), { recursive: true }); return shell.openPath(shotDir(v)); });

// ---- Konfiguration exportieren / importieren ----
ipcMain.handle('cfgExport', async (_e, json) => {
  const r = await dialog.showSaveDialog(win, { title: 'Cloudy-Einstellungen exportieren', defaultPath: 'cloudy-config.json', filters: [{ name: 'JSON', extensions: ['json'] }] });
  if (r.canceled || !r.filePath) return { ok: false, cancel: true };
  try { fs.writeFileSync(r.filePath, String(json)); return { ok: true }; } catch { return { ok: false, error: 'Datei konnte nicht gespeichert werden.' }; }
});
ipcMain.handle('cfgImport', async () => {
  const r = await dialog.showOpenDialog(win, { title: 'Cloudy-Einstellungen importieren', filters: [{ name: 'JSON', extensions: ['json'] }], properties: ['openFile'] });
  if (r.canceled || !r.filePaths[0]) return { ok: false, cancel: true };
  try { const d = JSON.parse(fs.readFileSync(r.filePaths[0], 'utf8')); if (d.cloudy !== 1 || typeof d.ls !== 'object') throw 0; return { ok: true, data: d }; }
  catch { return { ok: false, error: 'Das ist keine gültige Cloudy-Konfiguration.' }; }
});

// ---- Leistungsanzeige (CPU, RAM, GPU, Minecraft) ----
let cpuPrev = os.cpus(), gpuCache = { t: 0, v: null }, mcProc = null;
function gpuStats() {
  if (Date.now() - gpuCache.t < 3000) return gpuCache.v;
  let v = null;
  try {
    const r = spawnSync('nvidia-smi', ['--query-gpu=name,utilization.gpu,memory.used,memory.total', '--format=csv,noheader,nounits'], { encoding: 'utf8', timeout: 1500, windowsHide: true });
    if (r.status === 0) { const [name, util, mu, mt] = r.stdout.trim().split('\n')[0].split(',').map(s => s.trim()); v = { name, util: +util, memUsed: +mu, memTotal: +mt }; }
  } catch {}
  gpuCache = { t: Date.now(), v }; return v;
}
function mcMemory() {
  if (!mcProc || !mcProc.pid) return null;
  try {
    if (IS_WIN) { const o = spawnSync('tasklist', ['/FI', `PID eq ${mcProc.pid}`, '/FO', 'CSV', '/NH'], { encoding: 'utf8', timeout: 1500, windowsHide: true }).stdout; const m = /"([\d.,\s]+)\s*K"\s*$/m.exec(o.trim()); return m ? parseInt(m[1].replace(/\D/g, ''), 10) * 1024 : null; }
    const o = spawnSync('ps', ['-o', 'rss=', '-p', String(mcProc.pid)], { encoding: 'utf8', timeout: 1500 }).stdout.trim();
    return o ? parseInt(o, 10) * 1024 : null;
  } catch { return null; }
}
ipcMain.handle('sysStats', () => {
  const cur = os.cpus(); let idle = 0, total = 0;
  cur.forEach((c, i) => { const p = cpuPrev[i] || c; for (const k in c.times) total += c.times[k] - p.times[k]; idle += c.times.idle - p.times.idle; });
  cpuPrev = cur;
  return { cpu: total ? Math.round((1 - idle / total) * 100) : 0, ramUsed: os.totalmem() - os.freemem(), ramTotal: os.totalmem(), gpu: gpuStats(), mc: mcMemory() };
});

// ---- Performance-Presets: passen Minecraft-Videoeinstellungen an (nur vorhandene Schlüssel, bei neuer Instanz alle) ----
const PRESETS = {
  lowend: { renderDistance: 6, simulationDistance: 5, particles: 2, entityDistanceScaling: '0.5', biomeBlendRadius: 0, maxFps: 60, graphicsMode: 0, fancyGraphics: 'false' },
  performance: { renderDistance: 10, simulationDistance: 8, particles: 1, entityDistanceScaling: '0.75', biomeBlendRadius: 1, graphicsMode: 0, fancyGraphics: 'false' },
  quality: { renderDistance: 16, simulationDistance: 12, particles: 0, entityDistanceScaling: '1.0', biomeBlendRadius: 5, graphicsMode: 1, fancyGraphics: 'true' }
};
function applyPreset(dir, name) {
  const p = PRESETS[name]; if (!p) return;
  const f = path.join(dir, 'options.txt'); let lines = null;
  try { lines = fs.readFileSync(f, 'utf8').split(/\r?\n/).filter(Boolean); } catch {}
  if (!lines) lines = Object.entries(p).map(([k, v]) => `${k}:${v}`);
  else lines = lines.map(l => { const k = l.slice(0, l.indexOf(':')); return k in p ? `${k}:${p[k]}` : l; });
  fs.writeFileSync(f, lines.join('\n') + '\n');
}
ipcMain.handle('fabricStatus', (_e, v) => { try { return fs.readdirSync(path.join(root, 'versions')).some(d => d.startsWith('fabric-loader-') && d.endsWith('-' + bv(v))); } catch { return false; } });
ipcMain.handle('fabricInstall', async (_e, v) => { try { await ensureFabric(v); fs.mkdirSync(modsDir(v), { recursive: true }); await installMod('fabric-api', v).catch(() => {}); return true; } catch { return false; } });
// ---- Mod-Infos (lesbarer Name, Icon, Version) ----
const modCacheFile = path.join(app.getPath('userData'), 'modcache.json');
let modCache = null;
const loadCache = () => modCache || (modCache = (() => { try { return JSON.parse(fs.readFileSync(modCacheFile, 'utf8')); } catch { return {}; } })());
const saveCache = () => { try { fs.writeFileSync(modCacheFile, JSON.stringify(modCache)); } catch {} };
const modKey = (v, f) => { const s = fs.statSync(path.join(modsDir(v), f)); return `${f}|${s.size}|${Math.round(s.mtimeMs)}`; };
function listMods(v) {
  let files; try { files = fs.readdirSync(modsDir(v)).filter(f => /\.jar(\.disabled)?$/.test(f)); } catch { return []; }
  const c = loadCache(); let dirty = false;
  const out = files.map(f => {
    const k = modKey(v, f);
    if (!c[k]) { c[k] = { local: readJarInfo(path.join(modsDir(v), f)) }; dirty = true; }
    const { local = {}, mr } = c[k];
    return {
      file: f, enabled: f.endsWith('.jar'),
      name: (mr && mr.title) || local.name || prettyName(f),
      version: local.version || '', icon: (mr && mr.icon) || local.icon || null,
      desc: (mr && mr.desc) || local.desc || '', cats: (mr && mr.cats) || [],
      project: mr ? mr.id : null
    };
  });
  if (dirty) saveCache();
  return out.sort((a, b) => a.name.localeCompare(b.name));
}
ipcMain.handle('modsList', (_e, v) => listMods(v));
// holt Titel und Bild von Modrinth (erkennt Mods am Datei-Hash, auch wenn sie mods123.jar heißen)
ipcMain.handle('modsEnrich', async (_e, v) => {
  try {
    const c = loadCache(), dir = modsDir(v), todo = {};
    for (const f of fs.readdirSync(dir).filter(f => /\.jar(\.disabled)?$/.test(f))) {
      const k = modKey(v, f);
      if (c[k] && c[k].mr !== undefined && (!c[k].mr || c[k].mr.cats)) continue;
      todo[crypto.createHash('sha1').update(fs.readFileSync(path.join(dir, f))).digest('hex')] = k;
    }
    const hashes = Object.keys(todo);
    if (!hashes.length) return listMods(v);
    const r = await mfetch('https://api.modrinth.com/v2/version_files', {
      method: 'POST', headers: { ...HDR.headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ hashes, algorithm: 'sha1' })
    });
    if (!r.ok) return listMods(v);
    const found = await r.json();
    const ids = [...new Set(Object.values(found).map(x => x.project_id))];
    const projects = {};
    if (ids.length) for (const p of await getJSON(`https://api.modrinth.com/v2/projects?ids=${encodeURIComponent(JSON.stringify(ids))}`))
      projects[p.id] = { id: p.id, title: p.title, icon: p.icon_url, slug: p.slug, desc: p.description, cats: p.categories || [] };
    for (const [h, k] of Object.entries(todo)) c[k].mr = found[h] && projects[found[h].project_id] || null;
    saveCache();
  } catch {}
  return listMods(v);
});
ipcMain.handle('modInfo', async (_e, id) => {
  if (!/^[\w-]{1,32}$/.test(id)) return null;
  const [p, team] = await Promise.all([getJSON(`https://api.modrinth.com/v2/project/${id}`), getJSON(`https://api.modrinth.com/v2/project/${id}/members`).catch(() => [])]);
  return {
    id: p.id, slug: p.slug, title: p.title, desc: p.description, body: p.body || '', icon: p.icon_url,
    downloads: p.downloads, followers: p.followers, updated: p.updated, license: p.license && p.license.name,
    categories: p.display_categories || p.categories || [], loaders: p.loaders || [], versions: (p.game_versions || []).slice(-10),
    client: p.client_side, server: p.server_side, source: p.source_url, issues: p.issues_url,
    team: team.map(m => m.user && m.user.username).filter(Boolean),
    gallery: (p.gallery || []).sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0)).slice(0, 6).map(g => ({ url: g.url, title: g.title }))
  };
});
ipcMain.handle('modsToggle', (_e, v, f) => {
  const d = modsDir(v), b = path.basename(f), to = b.endsWith('.disabled') ? b.slice(0, -9) : b + '.disabled';
  fs.renameSync(path.join(d, b), path.join(d, to));
});
ipcMain.handle('openInstance', (_e, v) => { fs.mkdirSync(gameDir(v), { recursive: true }); return shell.openPath(gameDir(v)); });
const pinFile = path.join(app.getPath('userData'), 'lib-pins.json');
const pins = () => { try { const j = JSON.parse(fs.readFileSync(pinFile, 'utf8')); return Array.isArray(j) ? j.filter(x => typeof x === 'string') : []; } catch { return []; } };
ipcMain.handle('libPin', (_e, id) => { id = String(id || '').trim(); if (!id || id.length > 60 || /[\\/]/.test(id)) return false; const p = pins(); if (!p.includes(id)) { p.push(id); try { fs.writeFileSync(pinFile, JSON.stringify(p.slice(-50))); } catch {} } return true; });
ipcMain.handle('libList', () => {
  const vd = path.join(root, 'versions');
  const dirs = fs.existsSync(vd) ? fs.readdirSync(vd) : [];
  const pend = pins().filter(id => !dirs.includes(id) || !fs.existsSync(path.join(vd, id, id + '.jar'))).map(id => ({ id, mods: 0, played: Date.now(), fabric: false, pending: true }));
  return dirs.filter(d => fs.existsSync(path.join(vd, d, d + '.jar'))).map(id => {
    let mods = 0, played = 0;
    try { mods = fs.readdirSync(modsDir(id)).filter(f => f.endsWith('.jar')).length; } catch {}
    try { played = fs.statSync(gameDir(id)).mtimeMs; } catch {}
    return { id, mods, played, fabric: dirs.some(d => d.startsWith('fabric-loader-') && d.endsWith('-' + id)) };
  }).concat((() => { // eigene Kopien („1.21.4~abc“) – eigener Spielordner, gleiche Programmdateien
    try { return fs.readdirSync(path.join(root, 'instances')).filter(k => k.includes('~') && fs.existsSync(path.join(vd, bv(k), bv(k) + '.jar'))).map(k => {
      let mods = 0, played = 0; try { mods = fs.readdirSync(modsDir(k)).filter(f => f.endsWith('.jar')).length; } catch {} try { played = fs.statSync(gameDir(k)).mtimeMs; } catch {}
      return { id: k, base: bv(k), inst: true, mods, played, fabric: dirs.some(d => d.startsWith('fabric-loader-') && d.endsWith('-' + bv(k))) };
    }); } catch { return []; }
  })()).concat(pend).sort((a, b) => b.played - a.played);
});
ipcMain.handle('instCreate', (_e, { from, worlds }) => {
  const base = bv(from).replace(/[^\w.-]/g, ''); if (!base) return { ok: false };
  const key = base + '~' + Date.now().toString(36).slice(-5), dst = gameDir(key); fs.mkdirSync(dst, { recursive: true });
  try { const src = gameDir(from); if (fs.existsSync(src)) fs.cpSync(src, dst, { recursive: true, filter: s => { const r = path.relative(src, s).split(path.sep)[0]; return !['logs', 'crash-reports', 'screenshots'].includes(r) && (worlds || r !== 'saves'); } }); } catch (e) { return { ok: false, error: e.message }; }
  return { ok: true, key };
});
ipcMain.handle('instDelete', (_e, key) => { if (!String(key).includes('~')) return false; try { fs.rmSync(gameDir(path.basename(String(key))), { recursive: true, force: true }); return true; } catch { return false; } });
// löscht nur die Programmdateien der Version (Welten und Mods bleiben erhalten)
ipcMain.handle('libDelete', (_e, id) => {
  const vd = path.join(root, 'versions');
  try { fs.writeFileSync(pinFile, JSON.stringify(pins().filter(x => x !== id))); } catch {}
  if (!fs.existsSync(vd)) return;
  fs.rmSync(path.join(vd, path.basename(id)), { recursive: true, force: true });
  for (const d of fs.readdirSync(vd)) if (d.startsWith('fabric-loader-') && d.endsWith('-' + id)) fs.rmSync(path.join(vd, d), { recursive: true, force: true });
});
ipcMain.handle('modsRemove', (_e, v, f) => fs.rmSync(path.join(modsDir(v), path.basename(f)), { force: true }));
ipcMain.handle('openFolder', () => { fs.mkdirSync(root, { recursive: true }); return shell.openPath(root); });

ipcMain.handle('modsUpdate', async (_e, mc) => {
  const dir = modsDir(mc);
  if (!fs.existsSync(dir)) return 0;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.jar'));
  const hashes = Object.fromEntries(files.map(f => [crypto.createHash('sha1').update(fs.readFileSync(path.join(dir, f))).digest('hex'), f]));
  const r = await mfetch('https://api.modrinth.com/v2/version_files/update', {
    method: 'POST', headers: { ...HDR.headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ hashes: Object.keys(hashes), algorithm: 'sha1', loaders: ['fabric'], game_versions: [bv(mc)] })
  });
  if (!r.ok) return 0;
  let n = 0;
  for (const [h, v] of Object.entries(await r.json())) {
    const f = v.files.find(x => x.primary) || v.files[0];
    if (f.hashes.sha1 === h) continue;
    await download(f.url, path.join(dir, f.filename));
    if (f.filename !== hashes[h]) fs.rmSync(path.join(dir, hashes[h]), { force: true });
    n++;
  }
  return n;
});

// ---- Ressourcenpakete & Shader ----
const PACKS = { resourcepack: 'resourcepacks', shader: 'shaderpacks' };
const packOk = t => Object.prototype.hasOwnProperty.call(PACKS, t);
const packDir = (v, t) => path.join(gameDir(v), PACKS[t]);
const packKey = (t, p) => `${t}|${p.file}|${p.size}|${Math.round(p.mtime)}`;
function packFiles(v, t) { // aktive Pakete liegen im Ordner, ausgeschaltete in .disabled/
  const out = [];
  for (const [dir, enabled] of [[packDir(v, t), true], [path.join(packDir(v, t), '.disabled'), false]]) {
    let names = []; try { names = fs.readdirSync(dir); } catch {}
    for (const f of names) {
      if (f.startsWith('.')) continue;
      const p = path.join(dir, f); let s; try { s = fs.statSync(p); } catch { continue; }
      if (s.isDirectory() || /\.zip$/i.test(f)) out.push({ file: f, path: p, enabled, dir: s.isDirectory(), size: s.size, mtime: s.mtimeMs });
    }
  }
  return out;
}
function listPacks(v, t) {
  if (!packOk(t)) return [];
  const c = loadCache(); let dirty = false;
  const out = packFiles(v, t).map(p => {
    const k = packKey(t, p);
    if (!c[k]) { c[k] = { local: t === 'resourcepack' ? readPackInfo(p.path) : {} }; dirty = true; }
    const { local = {}, mr } = c[k];
    return { file: p.file, enabled: p.enabled, folder: p.dir, name: (mr && mr.title) || p.file.replace(/\.zip$/i, ''),
      desc: (mr && mr.desc) || local.desc || '', icon: (mr && mr.icon) || local.icon || null, project: mr ? mr.id : null, cats: (mr && mr.cats) || [] };
  });
  if (dirty) saveCache();
  return out.sort((a, b) => a.name.localeCompare(b.name));
}
ipcMain.handle('packList', (_e, v, t) => listPacks(v, t));
ipcMain.handle('packEnrich', async (_e, v, t) => {
  if (!packOk(t)) return [];
  try {
    const c = loadCache(), todo = {};
    for (const p of packFiles(v, t)) {
      if (p.dir || p.size > 3e8) continue;
      const k = packKey(t, p); c[k] = c[k] || {};
      if (c[k].mr !== undefined) continue;
      todo[crypto.createHash('sha1').update(fs.readFileSync(p.path)).digest('hex')] = k;
    }
    const hashes = Object.keys(todo);
    if (hashes.length) {
      const r = await mfetch('https://api.modrinth.com/v2/version_files', { method: 'POST', headers: { ...HDR.headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ hashes, algorithm: 'sha1' }) });
      if (r.ok) {
        const found = await r.json(), ids = [...new Set(Object.values(found).map(x => x.project_id))], projects = {};
        if (ids.length) for (const p of await getJSON(`https://api.modrinth.com/v2/projects?ids=${encodeURIComponent(JSON.stringify(ids))}`))
          projects[p.id] = { id: p.id, title: p.title, icon: p.icon_url, slug: p.slug, desc: p.description, cats: p.categories || [] };
        for (const [h, k] of Object.entries(todo)) c[k].mr = found[h] && projects[found[h].project_id] || null;
        saveCache();
      }
    }
  } catch {}
  return listPacks(v, t);
});
ipcMain.handle('packToggle', (_e, v, t, f) => {
  if (!packOk(t)) return;
  const b = path.basename(f), on = path.join(packDir(v, t), b), off = path.join(packDir(v, t), '.disabled', b);
  if (fs.existsSync(on)) { fs.mkdirSync(path.dirname(off), { recursive: true }); fs.renameSync(on, off); }
  else if (fs.existsSync(off)) fs.renameSync(off, on);
});
ipcMain.handle('packRemove', (_e, v, t, f) => {
  if (!packOk(t)) return;
  const b = path.basename(f);
  for (const d of [packDir(v, t), path.join(packDir(v, t), '.disabled')]) fs.rmSync(path.join(d, b), { recursive: true, force: true });
});
ipcMain.handle('packFolder', (_e, v, t) => { if (!packOk(t)) return; fs.mkdirSync(packDir(v, t), { recursive: true }); return shell.openPath(packDir(v, t)); });
ipcMain.handle('packSearch', async (_e, { q, version, type, cat, offset, index, limit }) => {
  if (!packOk(type)) return [];
  const facets = encodeURIComponent(JSON.stringify([[`project_type:${type}`], [`versions:${bv(version)}`], ...catFacet(cat)]));
  const d = await getJSON(`https://api.modrinth.com/v2/search?query=${encodeURIComponent(q || '')}&facets=${facets}&limit=20&offset=${Math.max(0, Math.min(2000, (+offset || 0) | 0))}`);
  return d.hits.map(h => ({ id: h.project_id, title: h.title, desc: h.description, icon: h.icon_url, downloads: h.downloads, author: h.author, slug: h.slug, cats: h.display_categories || h.categories || [] }));
});
ipcMain.handle('packInstall', async (_e, id, v, t) => {
  if (!packOk(t) || !/^[\w-]{1,32}$/.test(id)) return false;
  try {
    const vers = await getJSON(`https://api.modrinth.com/v2/project/${id}/version?game_versions=${encodeURIComponent(JSON.stringify([bv(v)]))}`);
    const ver = vers.find(x => x.version_type === 'release') || vers[0];
    if (!ver) return false;
    const f = ver.files.find(x => x.primary) || ver.files[0];
    await download(f.url, path.join(packDir(v, t), path.basename(f.filename)));
    if (t === 'shader') { await ensureFabric(v).catch(() => {}); await installMod('iris', v).catch(() => {}); } // Shader brauchen Fabric + Iris
    return true;
  } catch { return false; }
});

// ---- Cloudy-Updates (GitHub Releases, siehe update/updater.js) ----
ipcMain.handle('accRefresh', async () => { await srvPull(); return !!currentUser; });
ipcMain.handle('changelog', () => { try { const j = JSON.parse(fs.readFileSync(path.join(__dirname, 'assets', 'changelog.json'), 'utf8')); return Array.isArray(j) ? j : []; } catch { return []; } });
ipcMain.handle('appVersion', () => ({ v: app.getVersion(), suffix: (() => { try { return require('./package.json').versionSuffix || ''; } catch { return ''; } })(), repo: DEFAULT_REPO, platform: process.platform, packaged: app.isPackaged }));
ipcMain.handle('openExternal', (_e, u) => /^spotify:(playlist|album|track|artist|show|episode):[A-Za-z0-9]+$/.test(u) ? shell.openExternal(u) : /^https:\/\/(github\.com|developer\.spotify\.com|open\.spotify\.com|modrinth\.com|www\.minecraft\.net|namemc\.com|www\.minecraftskins\.com|www\.planetminecraft\.com)\//.test(u) ? shell.openExternal(u) : null);
ipcMain.handle('spotifyTitle', async (_e, u) => { // Name einer Playlist/eines Albums für die Schnellauswahl
  try { if (!/^https:\/\/open\.spotify\.com\/(playlist|album|track|artist|show|episode)\/[A-Za-z0-9]+$/.test(String(u))) return null; const d = await getJSON('https://open.spotify.com/oembed?url=' + encodeURIComponent(u)); return d && d.title ? String(d.title).slice(0, 60) : null; } catch { return null; }
});
ipcMain.handle('resetJava', () => fs.rmSync(path.join(app.getPath('userData'), 'runtimes'), { recursive: true, force: true }));
const autoFile = path.join(app.getPath('userData'), 'autoupdate.json');
const autoUpdOn = () => { try { return JSON.parse(fs.readFileSync(autoFile, 'utf8')).on === true; } catch { return false; } }; // Auto-Accept: nur wenn ausdrücklich eingeschaltet
ipcMain.handle('autoUpdGet', () => autoUpdOn());
ipcMain.handle('autoUpdSet', (_e, on) => { fs.writeFileSync(autoFile, JSON.stringify({ on: !!on })); return !!on; });
const localUpdate = require('./update/localupdate').init({ app, ipcMain, shell, auto: autoUpdOn });
// Neue Update-ZIP im Update-Ordner: mit Auto-Accept sofort installieren, sonst fragt die Oberfläche nach 10 s (nicht während Minecraft läuft)
const announced = new Set();
setInterval(() => { try {
  if (!app.isPackaged || mcProc) return;
  const name = localUpdate.pending(); if (!name) return;
  if (autoUpdOn()) { localUpdate.applyOnStart(); return; }
  if (uiReady && !announced.has(name)) { announced.add(name); send('updateFound', { name }); }
} catch {} }, 4000);
require('./update/updater').init({ app, ipcMain, shell, send, gameRunning: () => !!mcProc, defaultRepo: DEFAULT_REPO, userAgent: HDR.headers['User-Agent'] });

// ---- Microsoft-Konto ----
const accFile = path.join(app.getPath('userData'), 'account.json');
const readAcc = () => { try { return JSON.parse(fs.readFileSync(accFile, 'utf8')); } catch { return null; } };
const enc = t => safeStorage.isEncryptionAvailable() ? 'e:' + safeStorage.encryptString(t).toString('base64') : 'p:' + t;
const dec = t => t.startsWith('e:') ? safeStorage.decryptString(Buffer.from(t.slice(2), 'base64')) : t.slice(2);
const saveAcc = (name, uuid, refresh) => fs.writeFileSync(accFile, JSON.stringify({ name, uuid, refresh: enc(refresh) }));
let msmc; try { msmc = require('msmc'); } catch {}
ipcMain.handle('accountGet', () => { const a = readAcc(); return a ? { ms: true, name: a.name } : { ms: false }; });
ipcMain.handle('accountLogout', () => fs.rmSync(accFile, { force: true }));
ipcMain.handle('msLogin', async () => {
  if (!msmc) { try { msmc = require('msmc'); } catch {} }
  if (!msmc) return { ok: false, error: 'Paket fehlt: führe im Cloudy-Ordner „npm install msmc“ aus.' };
  try {
    const x = await new msmc.Auth('select_account').launch('electron', { width: 520, height: 700, show: true, title: 'Microsoft-Anmeldung' });
    const mc = await x.getMinecraft();
    saveAcc(mc.profile.name, mc.profile.id, x.save());
    return { ok: true };
  } catch (e) { const m = String((e && (e.message || e.name)) || e); return { ok: false, error: /closed/i.test(m) ? 'Das Anmeldefenster wurde geschlossen.' : 'Microsoft-Anmeldung fehlgeschlagen: ' + m }; }
});
let msCache = null;
async function msAuth() {
  const a = readAcc();
  if (msCache && msCache.id === a.refresh && Date.now() - msCache.t < 20 * 60e3) return msCache.obj; // zweiter Start kurz danach: ohne neue Anmeldung
  const x = await new msmc.Auth('select_account').refresh(dec(a.refresh));
  const mc = await x.getMinecraft();
  saveAcc(mc.profile.name, mc.profile.id, x.save());
  const obj = mc.mclc(); msCache = { id: (readAcc() || {}).refresh, t: Date.now(), obj };
  return obj;
}

// ---- Cloudy Client (Umhang, HUD, Code-Client) ----
const mcOk = v => { const m = /^(\d+)\.(\d+)(?:\.(\d+))?$/.exec(String(v)); if (!m) return false; const a = +m[1], b = +m[2], c = +(m[3] || 0); return a > 1 || (a === 1 && (b > 21 || (b === 21 && c >= 4))); };  // Client-Mod: jede Release ab 1.21.4
const CLIENT_MC = ['1.21.4'];
const CODE_HASH = '7d0e0559ecaefa91981c9e43fa6516c896de60a21130a167dd51dac9a4a62107';  // SHA-256 des Freischalt-Codes
const clientFile = path.join(app.getPath('userData'), 'client.json');
const capeFile = path.join(app.getPath('userData'), 'cape.png');
const userClientDir = path.join(app.getPath('userData'), 'client');
const jarMarks = new Map(); // Pfad+Änderungszeit -> hat das Jar den aktuellen Stand?
const jarFresh = f => { try { const k = f + ':' + fs.statSync(f).mtimeMs; if (jarMarks.has(k)) return jarMarks.get(k); const z = openZip(f); let ok = false; try { ok = z.has('app/cloudy/client/CosmeticsScreen.class') && z.has('cloudy-cos/build-' + CLIENT_BUILD + '.txt'); } finally { z.close(); } jarMarks.set(k, ok); return ok; } catch { return false; } };
const clientJar = mc => { // das Jar mit dem aktuellen Stand gewinnt (z. B. das mitgelieferte aus dem Release), sonst das erste vorhandene – so wird nicht unnötig minutenlang neu gebaut
  const c = (mc ? [path.join(userClientDir, `cloudy-client-${mc}.jar`), ...(mc === '1.21.4' ? [path.join(userClientDir, 'cloudy-client.jar'), path.join(__dirname, 'client', 'cloudy-client.jar')] : [])] : [path.join(userClientDir, 'cloudy-client.jar'), path.join(__dirname, 'client', 'cloudy-client.jar')]).filter(f => fs.existsSync(f));
  return c.find(jarFresh) || c[0];
};
const isAdminNow = () => { try { const u = currentUser && readAuth().users[currentUser.toLowerCase()]; return !!(u && u.admin); } catch { return false; } };
const CLIENT_BUILD = '0.9.27'; // Stand der Client-Mod (nicht die Launcher-Version) – passend zu client-src/.../cloudy-cos/build-<Stand>.txt
const clientHasCosmetics = mc => { const j = clientJar(mc); if (!j) return false; try { const z = openZip(j); try { return z.has('app/cloudy/client/CosmeticsScreen.class') && z.has('cloudy-cos/build-' + CLIENT_BUILD + '.txt'); } finally { z.close(); } } catch { return false; } };

// Eigener Classpath fuer neue Minecraft-Versionen (26.x): die Bibliotheksliste von minecraft-launcher-core bleibt dort leer (Fehler: KnotClient nicht gefunden)
async function buildClasspath(custom, mc) {
  const osn = IS_MAC ? 'osx' : IS_WIN ? 'windows' : 'linux', arch = process.arch === 'arm64' ? 'arm64' : process.arch === 'ia32' ? 'x86' : 'x86_64';
  const allowed = l => { if (!l.rules) return true; let ok = false; for (const r of l.rules) { const m = !r.os || ((!r.os.name || r.os.name === osn) && (!r.os.arch || r.os.arch === arch || (r.os.arch === 'x86' && arch === 'x86'))); if (m) ok = r.action === 'allow'; } return ok; };
  const vdir = path.join(root, 'versions', mc), vfile = path.join(vdir, mc + '.json');
  if (!fs.existsSync(vfile)) {
    const man = await getJSON('https://launchermeta.mojang.com/mc/game/version_manifest_v2.json'), ent = man.versions.find(v => v.id === mc);
    if (!ent) throw new Error('Version ' + mc + ' nicht gefunden.');
    fs.mkdirSync(vdir, { recursive: true }); fs.writeFileSync(vfile, JSON.stringify(await getJSON(ent.url)));
  }
  const cj = JSON.parse(fs.readFileSync(path.join(root, 'versions', custom, custom + '.json'), 'utf8')), vj = JSON.parse(fs.readFileSync(vfile, 'utf8'));
  const seen = new Set(), out = [], jobs = [];
  for (const lib of [...(cj.libraries || []), ...(vj.libraries || [])]) {
    if (!lib || !lib.name || !allowed(lib)) continue;
    const [g, a, v, cls] = lib.name.split(':'), key = g + ':' + a + (cls ? ':' + cls : '');
    if (seen.has(key)) continue; seen.add(key);
    const art = lib.downloads && lib.downloads.artifact, rel = art && art.path ? art.path : `${g.replace(/\./g, '/')}/${a}/${v}/${a}-${v}${cls ? '-' + cls : ''}.jar`;
    const file = path.join(root, 'libraries', ...rel.split('/')), url = art && art.url ? art.url : lib.url ? lib.url.replace(/\/?$/, '/') + rel : null;
    if (!fs.existsSync(file) || fs.statSync(file).size === 0) { if (!url) continue; jobs.push(download(url, file).catch(() => {})); }
    out.push(file);
  }
  await Promise.all(jobs);
  return out.filter(f => fs.existsSync(f));
}
let clientBuilding = false; const clientBuildSubs = new Set(); const onClientBuild = fn => { clientBuildSubs.add(fn); return () => clientBuildSubs.delete(fn); };
// Baut die Client-Mod selbst: lädt JDK 21 und Gradle in den Cloudy-Ordner, baut aus client-src und legt die Jar ab
async function buildClient(mc) {
  mc = bv(mc || '1.21.4'); if (!mcOk(mc)) return { ok: false, error: 'Die Client-Mod gibt es ab Minecraft 1.21.4.' };
  if (clientBuilding) return { ok: false, error: 'Der Bau läuft schon.' };
  const src = path.join(__dirname, 'client-src');
  if (!fs.existsSync(path.join(src, 'build.gradle'))) return { ok: false, error: 'Die Quellen (client-src) fehlen. Installiere die komplette Cloudy-Version neu.' };
  let degraded = false; clientBuilding = true; const st = t => { send('clientBuild', { status: t }); clientBuildSubs.forEach(f => { try { f(t); } catch {} }); }, tail = [];
  try {
    const tools = path.join(app.getPath('userData'), 'tools'); fs.mkdirSync(tools, { recursive: true });
    const plat = IS_MAC ? 'mac' : IS_WIN ? 'windows' : 'linux', arch = process.arch === 'arm64' ? 'aarch64' : 'x64';
    const jdk = path.join(tools, 'jdk21'), jhome = IS_MAC ? path.join(jdk, 'Contents', 'Home') : jdk, javac = path.join(jhome, 'bin', IS_WIN ? 'javac.exe' : 'javac');
    if (!fs.existsSync(javac)) {
      st('Lade Java-JDK 21 …'); const arc = path.join(app.getPath('temp'), IS_WIN ? 'cloudy-jdk.zip' : 'cloudy-jdk.tgz');
      await download(`https://api.adoptium.net/v3/binary/latest/21/ga/${plat}/${arch}/jdk/hotspot/normal/eclipse`, arc);
      fs.rmSync(jdk, { recursive: true, force: true }); fs.mkdirSync(jdk, { recursive: true });
      if (IS_WIN) extractZipWin(arc, jdk); else execFileSync('tar', ['xzf', arc, '-C', jdk, '--strip-components=1']);
      fs.rmSync(arc, { force: true }); if (!fs.existsSync(javac)) throw new Error('JDK konnte nicht entpackt werden.');
    }
    const GV = mc === '1.21.4' ? '8.12.1' : '8.14.3', gdir = path.join(tools, 'gradle-' + GV), gbin = path.join(gdir, 'bin', IS_WIN ? 'gradle.bat' : 'gradle');
    if (!fs.existsSync(gbin)) {
      st('Lade Gradle …'); const arc = path.join(app.getPath('temp'), 'cloudy-gradle.zip');
      await download(`https://services.gradle.org/distributions/gradle-${GV}-bin.zip`, arc);
      fs.rmSync(gdir, { recursive: true, force: true }); fs.mkdirSync(gdir, { recursive: true });
      if (IS_WIN) extractZipWin(arc, gdir); else execFileSync('tar', ['-xf', arc, '-C', gdir, '--strip-components=1']);
      fs.rmSync(arc, { force: true }); if (!fs.existsSync(gbin)) throw new Error('Gradle konnte nicht entpackt werden.');
      if (!IS_WIN) fs.chmodSync(gbin, 0o755);
    }
    const work = path.join(tools, 'client-build'); fs.rmSync(work, { recursive: true, force: true }); fs.cpSync(src, work, { recursive: true });
    st(`Suche Versionen für Minecraft ${mc} …`);
    const yarn = (await getJSON(`https://meta.fabricmc.net/v2/versions/yarn/${mc}`))[0]; if (!yarn) throw new Error(`Für Minecraft ${mc} gibt es noch keine Fabric-Mappings.`);
    const loader = ((await getJSON('https://meta.fabricmc.net/v2/versions/loader')).find(l => l.stable) || {}).version || '0.16.9';
    const fapi = (await getJSON(`https://api.modrinth.com/v2/project/fabric-api/version?game_versions=${encodeURIComponent(JSON.stringify([mc]))}&loaders=${encodeURIComponent('["fabric"]')}`))[0]; if (!fapi) throw new Error(`Für Minecraft ${mc} gibt es noch keine Fabric API.`);
    fs.writeFileSync(path.join(work, 'gradle.properties'), `org.gradle.jvmargs=-Xmx2G\nminecraft_version=${mc}\nyarn_mappings=${yarn.version}\nloader_version=${loader}\nfabric_version=${fapi.version_number}\nmod_version=1.3.0\n`);
    const bgp = path.join(work, 'build.gradle'); fs.writeFileSync(bgp, fs.readFileSync(bgp, 'utf8').replace("version '1.9-SNAPSHOT'", `version '${mc === '1.21.4' ? '1.9' : '1.11'}-SNAPSHOT'`));
    const fmp = path.join(work, 'src', 'main', 'resources', 'fabric.mod.json'); fs.writeFileSync(fmp, fs.readFileSync(fmp, 'utf8').replace('"~1.21.4"', '">=1.21.4"').replace('"version": "1.2.0"', '"version": "1.3.0"'));
    st('Baue Client-Mod … (beim ersten Mal 5–10 Minuten, bitte warten)');
    const runGradle = () => new Promise((res, rej) => {
      const p = spawn(IS_WIN ? `"${gbin}"` : gbin, ['build', '--no-daemon', '--console=plain'], { cwd: work, shell: IS_WIN, windowsHide: true, env: { ...process.env, JAVA_HOME: jhome, GRADLE_USER_HOME: path.join(tools, 'gradle-home') } });
      const on = d => String(d).split('\n').map(l => l.trim()).filter(Boolean).forEach(l => { tail.push(l); if (tail.length > 30) tail.shift(); send('clientBuild', { line: l.slice(0, 160) }); });
      p.stdout.on('data', on); p.stderr.on('data', on); p.on('error', rej); p.on('close', c => c === 0 ? res() : rej(new Error('Der Gradle-Bau ist fehlgeschlagen (Code ' + c + ').')));
    });
    try { await runGradle(); }
    catch (e1) { // Sicherheitsnetz: scheitern nur die optionalen Teile (Stores, Kamera/Nebel/Zoom/Hotbar-Mixins) an einer anderen Minecraft-Version, wird ohne sie gebaut
      const jd = path.join(work, 'src', 'main', 'java', 'app', 'cloudy', 'client'), rs = path.join(work, 'src', 'main', 'resources');
      const fm = path.join(rs, 'fabric.mod.json');
      fs.rmSync(path.join(jd, 'mixin', 'ItemPhysicsMixin.java'), { force: true }); fs.rmSync(path.join(rs, 'cloudy-phys.mixins.json'), { force: true });
      fs.writeFileSync(fm, fs.readFileSync(fm, 'utf8').replace(', "cloudy-phys.mixins.json"', ''));
      if (!fs.existsSync(path.join(jd, 'opt'))) throw e1;
      st('Item-Physik passt nicht zu dieser Version – baue ohne sie …'); tail.push('--- Neuer Versuch ohne Item-Physik ---');
      try { await runGradle(); degraded = true; } catch (e2) { tail.push('--- Weiterhin Fehler: ohne alle optionalen Teile ---'); }
      if (degraded) { /* Stufe 1 hat gereicht */ } else {
      st('Optionale Teile passen nicht zu dieser Version – baue ohne sie …'); tail.push('--- Neuer Versuch ohne optionale Teile ---');
      fs.rmSync(path.join(jd, 'opt'), { recursive: true, force: true });
      for (const f of ['mixin/CameraMixin.java', 'mixin/FogMixin.java', 'mixin/FovMixin.java', 'mixin/HotbarMixin.java', 'mixin/OptionAccessor.java', 'Hotbar.java']) fs.rmSync(path.join(jd, f), { force: true });
      fs.rmSync(path.join(rs, 'cloudy-cam.mixins.json'), { force: true });
      fs.writeFileSync(fm, fs.readFileSync(fm, 'utf8').replace(', "cloudy-cam.mixins.json"', ''));
      await runGradle(); degraded = true;
      }
    }
    const libs = path.join(work, 'build', 'libs'), jar = fs.readdirSync(libs).find(f => /^cloudy-client-.*\.jar$/.test(f) && !/-(sources|dev)\.jar$/.test(f));
    if (!jar) throw new Error('Keine Jar-Datei gefunden.');
    fs.mkdirSync(userClientDir, { recursive: true }); fs.copyFileSync(path.join(libs, jar), path.join(userClientDir, `cloudy-client-${mc}.jar`)); if (mc === '1.21.4') { fs.copyFileSync(path.join(libs, jar), path.join(userClientDir, 'cloudy-client.jar')); try { fs.copyFileSync(path.join(libs, jar), path.join(__dirname, 'client', 'cloudy-client.jar')); } catch {} }
    fs.rmSync(work, { recursive: true, force: true });
    return { ok: true, degraded };
  } catch (e) { return { ok: false, error: String(e.message || e), log: tail.slice(-18).join('\n') }; }
  finally { clientBuilding = false; }
}
ipcMain.handle('clientBuild', (_e, mc) => buildClient(mc));
const unlocked = () => { try { return JSON.parse(fs.readFileSync(clientFile, 'utf8')).unlocked === true; } catch { return false; } };
const hasCape = () => fs.existsSync(capeFile);
const capeData = () => hasCape() ? 'data:image/png;base64,' + fs.readFileSync(capeFile).toString('base64') : null;
function saveCape(buf) {
  if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47) throw new Error('Das ist keine PNG-Datei.');
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
  if (buf.length > 2 * 1024 * 1024) throw new Error('Datei zu groß (max. 2 MB).');
  if (w < 64 || w % 64 || h * 2 !== w) throw new Error(`Umhang muss 64×32 sein (oder 128×64 …). Deine Datei: ${w}×${h}.`);
  fs.writeFileSync(capeFile, buf);
}
ipcMain.handle('clientStatus', (_e, mc) => ({ unlocked: unlocked(), jar: !!clientJar(mc ? bv(mc) : undefined), cosmetics: clientHasCosmetics(mc ? bv(mc) : undefined), building: clientBuilding, src: fs.existsSync(path.join(__dirname, 'client-src', 'build.gradle')), supported: !mc || mcOk(bv(mc)) ? [bv(mc || '1.21.4')] : CLIENT_MC, cape: hasCape() }));
ipcMain.handle('clientUnlock', (_e, code) => {
  const a = crypto.createHash('sha256').update(String(code || '').trim()).digest(), b = Buffer.from(CODE_HASH, 'hex');
  if (!crypto.timingSafeEqual(a, b)) return { ok: false };
  fs.writeFileSync(clientFile, JSON.stringify({ unlocked: true }));
  return { ok: true };
});
ipcMain.handle('capeGet', () => capeData());
ipcMain.handle('capeSave', (_e, dataUrl) => {
  try { saveCape(Buffer.from(String(dataUrl).replace(/^data:image\/png;base64,/, ''), 'base64')); return { ok: true }; }
  catch (e) { return { ok: false, error: e.message }; }
});
ipcMain.handle('capePick', async () => {
  const r = await dialog.showOpenDialog(win, { title: 'Umhang auswählen', filters: [{ name: 'PNG', extensions: ['png'] }], properties: ['openFile'] });
  if (r.canceled || !r.filePaths[0]) return { ok: false, cancel: true };
  try { saveCape(fs.readFileSync(r.filePaths[0])); return { ok: true, data: capeData() }; }
  catch (e) { return { ok: false, error: e.message }; }
});
ipcMain.handle('capeClear', () => fs.rmSync(capeFile, { force: true }));

// ---- Hintergrundmusik: eigene Dateien ----
const musicDir = path.join(app.getPath('userData'), 'music');
ipcMain.handle('musicList', () => { try { return fs.readdirSync(musicDir).filter(f => /\.(mp3|ogg|wav|flac|m4a|opus|aac)$/i.test(f)).sort().map(f => ({ file: f, name: f.replace(/\.[^.]+$/, ''), url: require('url').pathToFileURL(path.join(musicDir, f)).href })); } catch { return []; } });
ipcMain.handle('musicAdd', async () => {
  const r = await dialog.showOpenDialog(win, { title: 'Musik auswählen', filters: [{ name: 'Audio', extensions: ['mp3', 'ogg', 'wav', 'flac', 'm4a', 'opus', 'aac'] }], properties: ['openFile', 'multiSelections'] });
  if (r.canceled) return { added: 0 };
  fs.mkdirSync(musicDir, { recursive: true }); let n = 0;
  for (const f of r.filePaths) try { let d = path.join(musicDir, path.basename(f)); for (let i = 1; fs.existsSync(d); i++) d = path.join(musicDir, path.basename(f).replace(/(\.[^.]+)$/, ` (${i})$1`)); fs.copyFileSync(f, d); n++; } catch {}
  return { added: n };
});
ipcMain.handle('musicRemove', (_e, f) => { try { fs.rmSync(path.join(musicDir, path.basename(String(f))), { force: true }); } catch {} });

// ---- Cloudy Creamkeys: Tastatur- & Mausklänge (Launcher + Minecraft) ----
const sndRoot = path.join(app.getPath('userData'), 'sounds'), sndPacks = path.join(sndRoot, 'packs'), sndSet = path.join(sndRoot, 'settings.json'), sndActive = path.join(sndRoot, 'active.json');
const SND_DEF = { enabled: true, ingame: true, launcher: true, kbOn: true, msOn: true, kb: 'nkcream', ms: 'wooden', kbVol: 0.8, msVol: 0.8 };
const sndRead = () => { try { return { ...SND_DEF, ...JSON.parse(fs.readFileSync(sndSet, 'utf8')) }; } catch { return { ...SND_DEF }; } };
function sndPrepare() { // mitgelieferte Packs aus der App in den Benutzerordner kopieren (Java kann nicht in app.asar lesen)
  try {
    const src = path.join(__dirname, 'assets', 'sounds'), mark = path.join(sndPacks, '.v'), v = app.getVersion();
    if (fs.existsSync(mark) && fs.readFileSync(mark, 'utf8') === v && fs.existsSync(path.join(sndPacks, 'wooden', 'pack.json'))) return;
    fs.mkdirSync(sndPacks, { recursive: true });
    for (const d of fs.readdirSync(src)) { const t = path.join(sndPacks, d); fs.mkdirSync(t, { recursive: true }); for (const f of fs.readdirSync(path.join(src, d))) fs.writeFileSync(path.join(t, f), fs.readFileSync(path.join(src, d, f))); }
    fs.writeFileSync(mark, v);
  } catch (e) { console.log('sndPrepare', e.message); }
}
const customDir = k => path.join(sndRoot, 'custom-' + k);
const customFile = k => { try { const f = fs.readdirSync(customDir(k)).find(n => /\.(wav|mp3|ogg|m4a|flac|opus|aac)$/i.test(n)); return f ? path.join(customDir(k), f) : null; } catch { return null; } };
function sndPack(id, kind) { // -> {id,name,dir,files,default}
  if (id === 'custom') { const f = customFile(kind); return f ? { id, name: 'Eigener Sound', dir: path.dirname(f), files: {}, default: path.basename(f), wav: /\.wav$/i.test(f) } : null; }
  try { const dir = path.join(sndPacks, String(id).replace(/[^\w-]/g, '')), j = JSON.parse(fs.readFileSync(path.join(dir, 'pack.json'), 'utf8')); return { ...j, dir, wav: true }; } catch { return null; }
}
function sndWriteActive() {
  const s = sndRead(); sndPrepare();
  const mk = (id, kind) => { const p = sndPack(id, kind); return p && p.wav ? { dir: p.dir, files: p.files || {}, default: p.default } : null; };
  fs.mkdirSync(sndRoot, { recursive: true });
  fs.writeFileSync(sndActive, JSON.stringify({ enabled: !!(s.enabled && s.ingame), kbVol: s.kbVol, msVol: s.msVol, kb: s.kbOn && s.kb && s.kb !== 'off' ? mk(s.kb, 'keyboard') : null, ms: s.msOn && s.ms && s.ms !== 'off' ? mk(s.ms, 'mouse') : null }));
  return s;
}
ipcMain.handle('soundsGet', () => {
  sndPrepare(); const s = sndRead(), packs = [], U = p => require('url').pathToFileURL(p).href + '/';
  try { for (const d of fs.readdirSync(sndPacks)) { const p = sndPack(d); if (p) packs.push({ id: p.id || d, name: p.name, kind: p.kind, author: p.author || '', base: U(p.dir), files: p.files, default: p.default }); } } catch {}
  const cust = {};
  for (const k of ['keyboard', 'mouse']) { const f = customFile(k); cust[k] = f ? { name: path.basename(f), base: U(path.dirname(f)), default: path.basename(f), wav: /\.wav$/i.test(f) } : null; }
  return { settings: s, packs, custom: cust };
});
ipcMain.handle('soundsSet', (_e, patch) => { const s = { ...sndRead() }; for (const k of Object.keys(SND_DEF)) if (patch && k in patch) s[k] = typeof SND_DEF[k] === 'number' ? Math.max(0, Math.min(1, +patch[k] || 0)) : typeof SND_DEF[k] === 'boolean' ? !!patch[k] : String(patch[k]).slice(0, 40); fs.mkdirSync(sndRoot, { recursive: true }); fs.writeFileSync(sndSet, JSON.stringify(s)); return s; });
ipcMain.handle('soundsCustom', async (_e, kind) => {
  kind = kind === 'mouse' ? 'mouse' : 'keyboard';
  const r = await dialog.showOpenDialog(win, { title: kind === 'mouse' ? 'Mausklick-Sound auswählen' : 'Tastatur-Sound auswählen', filters: [{ name: 'Audio', extensions: ['wav', 'mp3', 'ogg', 'm4a', 'flac', 'opus', 'aac'] }], properties: ['openFile'] });
  if (r.canceled || !r.filePaths[0]) return { ok: false };
  try { if (fs.statSync(r.filePaths[0]).size > 3 * 1024 * 1024) return { ok: false, error: 'Datei zu groß (max. 3 MB, am besten ein kurzer Klick-Sound).' }; fs.rmSync(customDir(kind), { recursive: true, force: true }); fs.mkdirSync(customDir(kind), { recursive: true }); const n = 'sound' + path.extname(r.filePaths[0]).toLowerCase(); fs.copyFileSync(r.filePaths[0], path.join(customDir(kind), n)); return { ok: true, wav: /\.wav$/i.test(n) }; } catch (e) { return { ok: false, error: e.message }; }
});
ipcMain.handle('soundsClearCustom', (_e, kind) => { try { fs.rmSync(customDir(kind === 'mouse' ? 'mouse' : 'keyboard'), { recursive: true, force: true }); } catch {} return { ok: true }; });

// ---- Cloudy-Konto (lokal, nur auf diesem Computer) ----
const authFile = path.join(app.getPath('userData'), 'cloudy-accounts.json'), sessFile = path.join(app.getPath('userData'), 'cloudy-session.json');
const pwHash = (pw, salt) => crypto.scryptSync(String(pw), salt, 64);
const sha = t => crypto.createHash('sha256').update(t).digest();
const wait = ms => new Promise(r => setTimeout(r, ms));
const saveAuth = a => fs.writeFileSync(authFile, JSON.stringify(a));
const mkUser = (name, pass, extra) => { const salt = crypto.randomBytes(16).toString('hex'); return Object.assign({ name, salt, hash: pwHash(pass, salt).toString('hex'), created: Date.now(), token: null }, extra); };
// Admin-Passwort: adminonlyacc. Tester-Konto: Tester / 12345 (Passwort muss beim ersten Login geändert werden).
const readAuth = () => {
  let a; try { a = JSON.parse(fs.readFileSync(authFile, 'utf8')); } catch {}
  if (!a || !a.users) a = { users: {} };
  if (!a.users.admin) { a.users.admin = mkUser('admin', 'adminonlyacc', { admin: true }); saveAuth(a); }
  else if (!a.users.admin.admin) { a.users.admin.admin = true; saveAuth(a); }
  if (!(a.mig >= 1)) { // einmalig (0.8.6): Admin-Passwort = adminonlyacc; Tester-Konto Tester / 12345 (Passwortwechsel Pflicht, nur unendlich Coins)
    Object.assign(a.users.admin, mkUser('admin', 'adminonlyacc'), { admin: true, mustChange: false });
    if (!a.users.tester) a.users.tester = mkUser('Tester', '12345', { mustChange: true, coins: 100 });
    a.mig = 1; saveAuth(a);
  }
  if (a.mig < 2) { const t = a.users.tester; if (t && t.infCoins) { t.infCoins = false; if (!Number.isFinite(t.coins)) t.coins = 100; } a.mig = 2; saveAuth(a); } // 0.9.11: Tester hat keine unendlichen Coins mehr
  return a;
};
let currentUser = null, pendingKey = null, pendingRemember = true;
const curRec = () => { const a = readAuth(); return currentUser ? a.users[currentUser.toLowerCase()] : null; };
function openSession(key, remember) {
  const a = readAuth(), u = a.users[key];
  currentUser = u.name; pendingKey = null;
  if (!remember) { fs.rmSync(sessFile, { force: true }); u.token = null; saveAuth(a); return; }
  const token = crypto.randomBytes(32).toString('hex');
  u.token = sha(token).toString('hex'); saveAuth(a);
  fs.writeFileSync(sessFile, JSON.stringify({ key, token }));
}
const info = u => ({ user: u.name, admin: !!u.admin });

// ---- Konto-Server (optional): Konten liegen zentral auf deinem Server (cloudy-server), der Admin sieht alle Tester ----
const accSrvFile = path.join(app.getPath('userData'), 'cloudy-server.json');
const srvCfg = () => { let u = ''; try { u = String(JSON.parse(fs.readFileSync(accSrvFile, 'utf8')).url || ''); } catch {} if (!u) u = String(APP_CFG.accountServer || 'https://account1234444.framebound.win'); return /^https?:\/\//i.test(u) ? { url: u.replace(/\/+$/, '') } : null; }; // 1. in den Einstellungen gesetzt, 2. config/app.json -> accountServer
let srvTok = null, srvPendTok = null;
async function srvCall(p, body, tok) {
  const c = srvCfg(); if (!c) throw new Error('kein Server');
  const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 10000);
  try {
    const r = await fetch(c.url + p, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) }, body: JSON.stringify(body || {}), signal: ctl.signal });
    const j = await r.json().catch(() => ({})); return { status: r.status, ...j };
  } finally { clearTimeout(to); }
}
const SRV_DOWN = { ok: false, error: 'Der Konto-Server ist nicht erreichbar. Prüfe deine Internetverbindung oder die Server-Adresse in den Einstellungen.' };
function srvMirror(pu) { // lokale Kopie (für Shop, Cosmetics, Spielzeit) – Anmeldung und Rechte kommen vom Server
  const a = readAuth(), key = pu.name.toLowerCase();
  const u = a.users[key] || (a.users[key] = mkUser(pu.name, crypto.randomBytes(12).toString('hex'), { coins: 100 }));
  if (pu.names && typeof pu.names === 'object') { try { fs.writeFileSync(namesFile, JSON.stringify(pu.names)); } catch {} }
  u.name = pu.name; u.admin = !!pu.admin; u.infCoins = !pu.admin && pu.coins === null; u.mustChange = false; u.banned = false;
  if (pu.state && !pu.admin) { const s = pu.state; if (!u.infCoins && Number.isFinite(+s.coins)) u.coins = +s.coins; u.owned = Array.isArray(s.owned) ? s.owned : []; u.equip = s.equip && typeof s.equip === 'object' ? s.equip : {}; u.daily = s.daily || ''; }
  saveAuth(a); return key;
}
function srvOpen(key, tok, remember) {
  currentUser = readAuth().users[key].name; pendingKey = null; srvTok = tok;
  if (remember) fs.writeFileSync(sessFile, JSON.stringify({ key, srv: tok })); else fs.rmSync(sessFile, { force: true });
}
async function srvPull() { // Stand vom Server holen (Admin kann Coins vergeben haben, Käufe von anderen PCs)
  if (!srvCfg() || !srvTok) return;
  try { const r = await srvCall('/me', {}, srvTok); if (r.user) srvMirror(r.user); else if (r.status === 403 && r.error) { currentUser = null; srvTok = null; fs.rmSync(sessFile, { force: true }); send('acctLocked', r.error); } } catch {}
}
function srvPush(u) { // Shop-Stand zum Server schicken (im Hintergrund)
  if (!srvCfg() || !srvTok || !u || u.admin) return;
  srvCall('/state', { coins: u.infCoins ? undefined : u.coins, owned: u.owned || [], equip: u.equip || {}, daily: u.daily || '' }, srvTok).catch(() => {});
}
async function srvAuth(path_, { user, pass, remember }) {
  let r; try { r = await srvCall(path_, { user: String(user || '').trim(), pass: String(pass || ''), grant: cfgPatch({}).gateTok || '' }); } catch { return SRV_DOWN; }
  if (!r.token) return { ok: false, error: r.error || 'Anmeldung fehlgeschlagen.' };
  if (r.user.mustChange) { currentUser = null; pendingKey = r.user.name.toLowerCase(); srvPendTok = r.token; pendingRemember = !!remember; return { ok: true, user: r.user.name, mustChange: true }; }
  const key = srvMirror(r.user); srvOpen(key, r.token, !!remember);
  return { ok: true, user: r.user.name, admin: !!r.user.admin, first: path_ === '/register' };
}
async function accSrvState() {
  try {
    const s = JSON.parse(fs.readFileSync(sessFile, 'utf8')); if (!s.srv) return { fresh: false, user: null };
    const r = await srvCall('/me', {}, s.srv); if (!r.user) return { fresh: false, user: null };
    const key = srvMirror(r.user); currentUser = r.user.name; srvTok = s.srv; return { fresh: false, user: r.user.name, admin: !!r.user.admin };
  } catch { currentUser = null; return { fresh: false, user: null }; }
}
ipcMain.handle('srvGet', () => { const c = srvCfg(); return c ? c.url : ''; });
ipcMain.handle('srvSet', async (_e, url) => {
  if (!adminOnly()) return { ok: false, error: 'Nur der Admin kann den Konto-Server ändern.' };
  url = String(url || '').trim().replace(/\/+$/, '');
  if (!url) { fs.rmSync(accSrvFile, { force: true }); currentUser = null; srvTok = null; fs.rmSync(sessFile, { force: true }); return { ok: true, off: true }; }
  if (!/^https?:\/\//i.test(url)) return { ok: false, error: 'Die Adresse muss mit http:// oder https:// beginnen.' };
  try { const r = await fetch(url + '/health'); const j = await r.json(); if (!j.ok) throw 0; } catch { return { ok: false, error: 'Dort antwortet kein Cloudy-Server.' }; }
  fs.writeFileSync(accSrvFile, JSON.stringify({ url })); currentUser = null; srvTok = null; fs.rmSync(sessFile, { force: true }); return { ok: true };
});
ipcMain.handle('authState', () => {
  if (srvCfg()) return accSrvState();
  const a = readAuth(), fresh = !!(a.users.tester && a.users.tester.mustChange);
  try {
    const s = JSON.parse(fs.readFileSync(sessFile, 'utf8')), u = a.users[s.key];
    if (u && lockMsgL(u)) { currentUser = null; return { fresh, user: null, banned: true }; }
    if (u && !u.mustChange && u.token && crypto.timingSafeEqual(Buffer.from(u.token, 'hex'), sha(s.token))) { currentUser = u.name; return { fresh, ...info(u) }; }
  } catch {}
  currentUser = null; return { fresh, user: null };
});
ipcMain.handle('authRegister', async (_e, { user, pass, remember }) => {
  if (srvCfg()) return srvAuth('/register', { user, pass, remember });
  user = String(user || '').trim(); pass = String(pass || '');
  if (!/^[A-Za-z0-9_]{3,16}$/.test(user)) return { ok: false, error: 'Benutzername: 3–16 Zeichen, nur Buchstaben, Zahlen und _.' };
  if (pass.length < 6) return { ok: false, error: 'Das Passwort braucht mindestens 6 Zeichen.' };
  const a = readAuth(), key = user.toLowerCase();
  if (a.users[key]) return { ok: false, error: 'Diesen Benutzernamen gibt es schon.' };
  a.users[key] = mkUser(user, pass, { coins: 100 }); saveAuth(a);
  openSession(key, !!remember);
  return { ok: true, user, first: true };
});
ipcMain.handle('authLogin', async (_e, { user, pass, remember }) => {
  if (srvCfg()) return srvAuth('/login', { user, pass, remember });
  const a = readAuth(), key = String(user || '').trim().toLowerCase(), u = a.users[key];
  const ok = u && crypto.timingSafeEqual(Buffer.from(u.hash, 'hex'), pwHash(pass, u.salt));
  if (!ok) { await wait(600); return { ok: false, error: 'Benutzername oder Passwort stimmt nicht.' }; }
  if (lockMsgL(u)) { await wait(300); return { ok: false, error: lockMsgL(u) }; }
  if (u.mustChange) { currentUser = null; pendingKey = key; pendingRemember = !!remember; return { ok: true, user: u.name, mustChange: true }; }
  openSession(key, !!remember);
  return { ok: true, ...info(u) };
});
// Pflicht-Passwortwechsel nach der Anmeldung mit einem vorläufigen Passwort
ipcMain.handle('authChangePass', async (_e, { pass }) => {
  pass = String(pass || '');
  if (srvCfg()) {
    if (!pendingKey || !srvPendTok) return { ok: false, error: 'Bitte zuerst anmelden.' };
    if (pass.length < 6 || pass === '12345') return { ok: false, error: 'Wähle ein neues Passwort, das nicht 12345 ist.' };
    let r; try { r = await srvCall('/password', { pass }, srvPendTok); } catch { return SRV_DOWN; }
    if (!r.ok) return { ok: false, error: r.error || 'Passwort konnte nicht geändert werden.' };
    const m = await srvCall('/me', {}, srvPendTok); if (!m.user) return { ok: false, error: 'Anmeldung fehlgeschlagen.' };
    const key = srvMirror(m.user); srvOpen(key, srvPendTok, pendingRemember); srvPendTok = null; return { ok: true, user: m.user.name, admin: !!m.user.admin };
  }
  if (!pendingKey) return { ok: false, error: 'Bitte zuerst anmelden.' };
  if (pass.length < 6 || pass === '12345') return { ok: false, error: 'Wähle ein neues Passwort, das nicht 12345 ist.' };
  const a = readAuth(), u = a.users[pendingKey]; if (!u) return { ok: false, error: 'Konto nicht gefunden.' };
  Object.assign(u, mkUser(u.name, pass), { admin: u.admin, created: u.created, mustChange: false });
  saveAuth(a); openSession(pendingKey, pendingRemember);
  return { ok: true, ...info(u) };
});
ipcMain.handle('authLogout', () => { srvTok = null; currentUser = null; pendingKey = null; fs.rmSync(sessFile, { force: true }); });
ipcMain.handle('authReset', () => {
  if (srvCfg()) return; // „Passwort vergessen?“: setzt NUR das Tester-Konto auf Tester / 12345 zurück (muss danach neu gesetzt werden); Admin bleibt unberührt
  currentUser = null; pendingKey = null; fs.rmSync(sessFile, { force: true });
  const a = readAuth(), old = a.users.tester || {};
  a.users.tester = Object.assign(mkUser('Tester', '12345', { mustChange: true }), { coins: old.coins == null ? 100 : old.coins, owned: old.owned || [], equip: old.equip || {} }); saveAuth(a);
});
ipcMain.handle('authChangeOwn', async (_e, { old, pass }) => {
  if (srvCfg()) {
    if (!currentUser) return { ok: false, error: 'Bitte zuerst anmelden.' };
    pass = String(pass || ''); if (pass.length < 6 || pass === '12345') return { ok: false, error: 'Wähle ein neues Passwort (mindestens 6 Zeichen, nicht 12345).' };
    let c; try { c = await srvCall('/login', { user: currentUser, pass: old }); } catch { return SRV_DOWN; }
    if (!c.token) return { ok: false, error: c.status === 401 ? 'Das alte Passwort stimmt nicht.' : (c.error || 'Fehler.') };
    const r = await srvCall('/password', { pass }, srvTok || c.token); return r.ok ? { ok: true } : { ok: false, error: r.error || 'Fehler.' };
  }
  const a = readAuth(), u = currentUser && a.users[currentUser.toLowerCase()]; if (!u) return { ok: false, error: 'Bitte zuerst anmelden.' };
  if (!crypto.timingSafeEqual(Buffer.from(u.hash, 'hex'), pwHash(old, u.salt))) { await wait(600); return { ok: false, error: 'Das alte Passwort stimmt nicht.' }; }
  pass = String(pass || ''); if (pass.length < 6 || pass === '12345') return { ok: false, error: 'Wähle ein neues Passwort (mindestens 6 Zeichen, nicht 12345).' };
  Object.assign(u, mkUser(u.name, pass), { token: u.token }); saveAuth(a); return { ok: true };
});
ipcMain.handle('authDelete', async (_e, { pass }) => {
  if (srvCfg()) return { ok: false, error: 'Im Server-Modus löscht nur der Admin Konten.' };
  const a = readAuth(), u = currentUser && a.users[currentUser.toLowerCase()];
  if (!u) return { ok: false, error: 'Bitte zuerst anmelden.' };
  if (u.admin) return { ok: false, error: 'Das Admin-Konto kann nicht gelöscht werden.' };
  if (!crypto.timingSafeEqual(Buffer.from(u.hash, 'hex'), pwHash(pass, u.salt))) { await wait(600); return { ok: false, error: 'Das Passwort stimmt nicht.' }; }
  delete a.users[currentUser.toLowerCase()]; saveAuth(a);
  currentUser = null; pendingKey = null; fs.rmSync(sessFile, { force: true });
  return { ok: true };
});
// Admin: Konten ansehen, Passwort zurücksetzen (→ 12345, muss neu gesetzt werden), löschen
const lockMsgL = u => { if (!u || u.admin) return ''; if (u.paused) return 'Konto vorübergehend deaktiviert.'; if (u.banned && (!u.banUntil || u.banUntil > Date.now())) { const r = u.banReason ? ': ' + u.banReason : ''; if (!u.banUntil) return 'Konto dauerhaft gesperrt' + r; const m = Math.ceil((u.banUntil - Date.now()) / 60000); return 'Konto gesperrt für noch ' + (m >= 1440 ? Math.ceil(m / 1440) + ' Tag(e)' : m >= 60 ? Math.ceil(m / 60) + ' Std.' : m + ' Min.') + r; } return ''; };
const adminOnly = () => { const u = curRec(); return u && u.admin; };
ipcMain.handle('authList', async () => srvCfg() ? (adminOnly() ? (await srvCall('/admin/users', {}, srvTok).catch(() => ({}))).users?.map(u => u.name) || [] : []) : adminOnly() ? Object.values(readAuth().users).filter(u => !u.admin).map(u => u.name) : []);
ipcMain.handle('authListFull', async () => srvCfg() ? (adminOnly() ? ((await srvCall('/admin/users', {}, srvTok).catch(() => ({}))).users || []).map(u => ({ name: u.name, inf: !!u.inf, banned: !!u.banned, until: u.until || 0, paused: !!u.paused, items: u.items || [], reason: u.reason || '', coins: u.coins, owned: u.owned || 0, gate: u.gate || '' })) : []) : adminOnly() ? Object.values(readAuth().users).filter(u => !u.admin).map(u => ({ name: u.name, inf: !!u.infCoins, banned: !!u.banned && (!u.banUntil || u.banUntil > Date.now()), until: u.banUntil || 0, paused: !!u.paused, items: u.owned || [], reason: u.banReason || '', coins: u.infCoins ? '∞' : (u.coins == null ? 100 : u.coins), owned: (u.owned || []).length })) : []);
ipcMain.handle('authAdminBan', async (_e, { name, banned, reason, until }) => {
  until = +until > Date.now() ? Math.round(+until) : 0;
  if (srvCfg()) return adminOnly() && !!(await srvCall('/admin/ban', { name, banned, reason, until }, srvTok).catch(() => ({}))).ok;
  if (!adminOnly()) return false; const a = readAuth(), u = a.users[String(name).toLowerCase()]; if (!u || u.admin) return false;
  u.banned = !!banned; u.banUntil = banned ? until : 0; u.banReason = banned ? String(reason || '').slice(0, 80) : ''; if (banned) u.token = null; saveAuth(a); return true;
});
ipcMain.handle('authAdminInf', async (_e, { name, on }) => {
  if (srvCfg()) return adminOnly() && !!(await srvCall('/admin/inf', { name, on }, srvTok).catch(() => ({}))).ok;
  if (!adminOnly()) return false; const a = readAuth(), u = a.users[String(name).toLowerCase()]; if (!u || u.admin) return false;
  u.infCoins = !!on; if (!on && !Number.isFinite(u.coins)) u.coins = 100; saveAuth(a); return true;
});
// ---- Codes (Admin erstellt, Spieler lösen in den Einstellungen ein) und Items vergeben ----
const codeNorm = c => String(c || '').trim().toUpperCase();
const codeKey = (o, s) => { const u = codeNorm(s); if (Object.prototype.hasOwnProperty.call(o, u)) return u; const n = u.replace(/[^A-Z0-9]/g, ''); return n ? (Object.keys(o).find(k => k.replace(/[^A-Z0-9]/g, '') === n) || u) : u; }; // Bindestriche egal
ipcMain.handle('codeRedeem', async (_e, code) => {
  const a0 = readAuth(), me0 = currentUser && a0.users[currentUser.toLowerCase()];
  if (!me0) return { ok: false, error: 'Bitte zuerst bei Cloudy anmelden.' };
  code = codeNorm(code); if (!code) return { ok: false, error: 'Bitte einen Code eingeben.' };
  if (srvCfg()) {
    const r = await srvCall('/redeem', { code }, srvTok).catch(() => null); if (!r) return { ...SRV_DOWN, ok: false };
    if (!r.ok) return { ok: false, error: r.error || 'Code ungültig.' };
    await srvPull(); return { ok: true, coins: r.coins || 0, items: r.items || [], skipped: r.skipped || 0, state: shopWrite(() => ({}), true).state };
  }
  const a = readAuth(), me = a.users[currentUser.toLowerCase()], c = (a.codes || {})[codeKey(a.codes || {}, code)];
  if (me.admin) return { ok: false, error: 'Admins brauchen keine Codes.' };
  if (!c) { await wait(400); return { ok: false, error: 'Diesen Code gibt es nicht.' }; }
  c.used = c.used || [];
  if (c.used.includes(me.name.toLowerCase())) return { ok: false, error: 'Diesen Code hast du schon eingelöst.' };
  if (c.exp && c.exp < Date.now()) return { ok: false, error: 'Dieser Code ist abgelaufen.' };
  if (c.uses > 0 && c.used.length >= c.uses) return { ok: false, error: 'Dieser Code ist aufgebraucht.' };
  let coins = 0; if (c.coins > 0 && !me.infCoins) { me.coins = Math.min(1e9, (me.coins == null ? 100 : me.coins) + c.coins); coins = c.coins; }
  me.owned = me.owned || []; const items = (c.items || []).filter(i => !me.owned.includes(i)); me.owned.push(...items);
  c.used.push(me.name.toLowerCase()); saveAuth(a);
  return { ok: true, coins, items, skipped: (c.items || []).length - items.length, state: shopWrite(() => ({}), true).state };
});
ipcMain.handle('codeList', async () => {
  if (!adminOnly()) return [];
  if (srvCfg()) return ((await srvCall('/admin/codes', {}, srvTok).catch(() => ({}))).codes) || [];
  return Object.entries(readAuth().codes || {}).map(([code, c]) => ({ code, coins: c.coins || 0, items: c.items || [], uses: c.uses || 0, used: (c.used || []).length, exp: c.exp || 0 }));
});
ipcMain.handle('codeCreate', async (_e, o) => {
  if (!adminOnly()) return { ok: false, error: 'Nur für Admins.' };
  o = o || {};
  if (srvCfg()) { const r = await srvCall('/admin/codecreate', o, srvTok).catch(() => null); return r ? { ok: !!r.ok, code: r.code, error: r.error } : { ...SRV_DOWN, ok: false }; }
  let code = codeNorm(o.code).replace(/[^A-Z0-9-]/g, '').slice(0, 24); if (!code) code = (()=>{const A='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let s='';for(const b of crypto.randomBytes(12))s+=A[b%A.length];return s.replace(/(.{4})(?=.)/g,'$1-')})();
  const a = readAuth(); a.codes = a.codes || {}; if (a.codes[code]) return { ok: false, error: 'Diesen Code gibt es schon.' };
  const coins = Math.max(0, Math.min(1e6, Math.round(+o.coins || 0))), items = (Array.isArray(o.items) ? o.items : []).filter(x => typeof x === 'string').slice(0, 30);
  if (!coins && !items.length) return { ok: false, error: 'Der Code braucht Coins oder Items.' };
  const exp = Math.round(+o.exp || 0); if (exp && exp < Date.now()) return { ok: false, error: 'Das Ablaufdatum liegt in der Vergangenheit.' };
  a.codes[code] = { coins, items, uses: Math.max(0, Math.min(1e6, Math.round(+o.uses || 0))), used: [], exp: exp ? Math.min(exp, Date.now() + 3650 * 864e5) : 0 }; saveAuth(a); return { ok: true, code };
});
ipcMain.handle('codeDelete', async (_e, code) => {
  if (!adminOnly()) return false; code = codeNorm(code);
  if (srvCfg()) return !!(await srvCall('/admin/codedelete', { code }, srvTok).catch(() => ({}))).ok;
  const a = readAuth(); if (a.codes) delete a.codes[code]; saveAuth(a); return true;
});
ipcMain.handle('authAdminAddItem', async (_e, { name, id }) => {
  if (!CATALOG.some(c => c.id === id)) return false;
  if (srvCfg()) return adminOnly() && !!(await srvCall('/admin/additem', { name, id }, srvTok).catch(() => ({}))).ok;
  if (!adminOnly()) return false; const a = readAuth(), u = a.users[String(name).toLowerCase()]; if (!u || u.admin) return false;
  u.owned = u.owned || []; if (!u.owned.includes(id)) u.owned.push(id); saveAuth(a); return true;
});
ipcMain.handle('authAdminPause', async (_e, { name, paused }) => {
  if (srvCfg()) return adminOnly() && !!(await srvCall('/admin/pause', { name, paused }, srvTok).catch(() => ({}))).ok;
  if (!adminOnly()) return false; const a = readAuth(), u = a.users[String(name).toLowerCase()]; if (!u || u.admin) return false;
  u.paused = !!paused; if (paused) u.token = null; saveAuth(a); return true;
});
ipcMain.handle('authAdminRemoveItem', async (_e, { name, id, all }) => {
  if (srvCfg()) return adminOnly() && !!(await srvCall('/admin/removeitem', { name, id, all }, srvTok).catch(() => ({}))).ok;
  if (!adminOnly()) return false; const a = readAuth(), u = a.users[String(name).toLowerCase()]; if (!u || u.admin) return false;
  if (all) { u.owned = []; u.equip = {}; } else { u.owned = (u.owned || []).filter(x => x !== id); for (const k of Object.keys(u.equip || {})) if (u.equip[k] === id) delete u.equip[k]; }
  saveAuth(a); return true;
});
ipcMain.handle('authAdminCoins', async (_e, { name, amount }) => {
  if (srvCfg()) return adminOnly() && !!(await srvCall('/admin/coins', { name, amount }, srvTok).catch(() => ({}))).ok;
  if (!adminOnly()) return false; const a = readAuth(), u = a.users[String(name).toLowerCase()]; if (!u || u.admin) return false;
  u.coins = Math.max(0, Math.min(1e9, Math.round(+amount || 0))); saveAuth(a); return true;
});
ipcMain.handle('authAdminReset', async (_e, name) => {
  if (srvCfg()) return adminOnly() && !!(await srvCall('/admin/reset', { name }, srvTok).catch(() => ({}))).ok;
  if (!adminOnly()) return false; const a = readAuth(), k = String(name).toLowerCase(), u = a.users[k]; if (!u || u.admin) return false;
  Object.assign(u, mkUser(u.name, '12345'), { mustChange: true }); saveAuth(a); return true;
});
ipcMain.handle('authAdminDelete', async (_e, name) => {
  if (srvCfg()) return adminOnly() && !!(await srvCall('/admin/delete', { name }, srvTok).catch(() => ({}))).ok;
  if (!adminOnly()) return false; const a = readAuth(), k = String(name).toLowerCase(); if (!a.users[k] || a.users[k].admin) return false;
  delete a.users[k]; saveAuth(a); return true;
});

// ---- Cloudy Coins & Cosmetics-Shop (lokal) ----
const CATALOG = [
  { id: 'cape-cloud', cat: 'cape', name: 'Wolkenumhang', price: 500 }, { id: 'cape-aurora', cat: 'cape', name: 'Nordlicht-Umhang', price: 500 },
  { id: 'wings-angel', cat: 'wings', name: 'Engelsflügel', price: 800 }, { id: 'wings-neon', cat: 'wings', name: 'Neon-Schwingen', price: 800 },
  { id: 'shield-cloud', cat: 'shield', name: 'Wolkenschild', price: 200 }, { id: 'shield-sun', cat: 'shield', name: 'Sonnenschild', price: 200 },
  { id: 'hat-top', cat: 'hat', name: 'Zylinder', price: 250 }, { id: 'hat-wizard', cat: 'hat', name: 'Zauberhut', price: 250 },
  { id: 'cape-sunset', cat: 'cape', name: 'Sonnenuntergang-Umhang', price: 600 }, { id: 'cape-galaxy', cat: 'cape', name: 'Galaxie-Umhang', price: 700 }, { id: 'cape-fire', cat: 'cape', name: 'Feuer-Umhang', price: 700 },
  { id: 'wings-fire', cat: 'wings', name: 'Feuerflügel', price: 900 }, { id: 'wings-bat', cat: 'wings', name: 'Fledermausflügel', price: 900 },
  { id: 'shield-dragon', cat: 'shield', name: 'Drachenschild', price: 300 }, { id: 'shield-forest', cat: 'shield', name: 'Waldschild', price: 250 },
  { id: 'hat-gold', cat: 'hat', name: 'Goldzylinder', price: 400 }, { id: 'hat-santa', cat: 'hat', name: 'Weihnachtsmütze', price: 300 }, { id: 'hat-witch', cat: 'hat', name: 'Hexenhut', price: 300 },
  { id: 'cape-ocean', cat: 'cape', name: 'Ozean-Umhang', price: 700 }, { id: 'cape-sakura', cat: 'cape', name: 'Kirschblüten-Umhang', price: 700 },
  { id: 'wings-crystal', cat: 'wings', name: 'Kristallflügel', price: 1000 }, { id: 'wings-shadow', cat: 'wings', name: 'Schattenschwingen', price: 1000 },
  { id: 'shield-ice', cat: 'shield', name: 'Eisschild', price: 300 }, { id: 'hat-party', cat: 'hat', name: 'Partyhut', price: 250 }, { id: 'hat-frost', cat: 'hat', name: 'Frostmütze', price: 350 },
  { id: 'cape-nebula', cat: 'cape', name: 'Nebel-Umhang', price: 700 }, { id: 'cape-emerald', cat: 'cape', name: 'Smaragd-Umhang', price: 700 }, { id: 'cape-royal', cat: 'cape', name: 'Königs-Umhang', price: 900 },
  { id: 'hat-crown', cat: 'hat', name: 'Krone', price: 700 }, { id: 'hat-halo', cat: 'hat', name: 'Heiligenschein', price: 600 },
  { id: 'cape-zz4', cat: 'cape', name: 'ZZ4-Umhang (3D)', price: 1500 }, { id: 'wings-zz4', cat: 'wings', name: 'ZZ4-Flügel (3D)', price: 1800 }, { id: 'shield-zz4', cat: 'shield', name: 'ZZ4-Schild (3D)', price: 1200 },
  { id: 'cape-zz4m', cat: 'cape', name: 'ZZ4 15 Mio.-Umhang (3D)', price: 1500 }, { id: 'wings-zz4m', cat: 'wings', name: 'ZZ4 15 Mio.-Flügel (3D)', price: 1800 }, { id: 'shield-zz4m', cat: 'shield', name: 'ZZ4 15 Mio.-Schild (3D)', price: 1200 },
  { id: 'cape-zz3', cat: 'cape', name: 'ZZ3-Umhang (3D)', price: 1500 }, { id: 'wings-zz3', cat: 'wings', name: 'ZZ3-Flügel (3D)', price: 1800 }, { id: 'shield-zz3', cat: 'shield', name: 'ZZ3-Schild (3D)', price: 1200 },
  { id: 'cape-zz3s', cat: 'cape', name: 'ZZ3 1-Mio.-Special-Umhang (3D)', price: 1500 }, { id: 'wings-zz3s', cat: 'wings', name: 'ZZ3 1-Mio.-Special-Flügel (3D)', price: 1800 }, { id: 'shield-zz3s', cat: 'shield', name: 'ZZ3 1-Mio.-Special-Schild (3D)', price: 1200 },
  { id: 'cape-zz5', cat: 'cape', name: 'ZZ5 2 Mio.-Umhang (3D)', price: 1500 }, { id: 'wings-zz5', cat: 'wings', name: 'ZZ5 2 Mio.-Flügel (3D)', price: 1800 }, { id: 'shield-zz5', cat: 'shield', name: 'ZZ5 2 Mio.-Schild (3D)', price: 1200 },
  { id: 'cape-yy', cat: 'cape', name: 'Yin-Yang-Umhang (3D)', price: 1500 }, { id: 'shield-yy', cat: 'shield', name: 'Yin-Yang-Schild (3D)', price: 1200 },
  { id: 'cape-zk5', cat: 'cape', name: '500K-Umhang (3D)', price: 1500 }, { id: 'wings-zk5', cat: 'wings', name: '500K-Flügel (3D)', price: 1800 },
  { id: 'totem-zz', cat: 'totem', name: 'ZickZack-Totem (3D)', price: 800 }, { id: 'hotbar-zz', cat: 'hotbar', name: 'ZickZack-Hotbar (animiert)', price: 800 },
  { id: 'sky-sunset', cat: 'sky', name: 'Sonnenuntergang-Himmel', price: 400 }, { id: 'sky-aurora', cat: 'sky', name: 'Polarlicht-Himmel', price: 500 }, { id: 'sky-galaxy', cat: 'sky', name: 'Galaxie-Himmel (Sonne & Mond)', price: 900 }
];
const PACK_FILES = { 'totem-zz': 'cloudy-totem-zz.zip', 'hotbar-zz': 'cloudy-hotbar-zz.zip', 'sky-galaxy': 'cloudy-sky-galaxy.zip',
  ...Object.fromEntries(['zz4', 'zz4m', 'zz3', 'zz3s', 'zz5', 'yy'].map(k => ['shield-' + k, `cloudy-shield-${k}.zip`])) };
const SKIES = { 'sky-sunset': ['#ff8a5c', '#ffd9a0', true], 'sky-aurora': ['#0b1f3a', '#2fe6a8', true], 'sky-galaxy': ['#12062e', '#5b3df5', true] };

// ---- Eigene Shop-Items (nur Admin): Umhang aus eigener PNG (64×32-Umhangtextur) oder eigener Himmel aus zwei Farben ----
const ciFile = path.join(app.getPath('userData'), 'custom-items.json'), ciDir = path.join(app.getPath('userData'), 'custom-items');
const loadCI = () => { try { const j = JSON.parse(fs.readFileSync(ciFile, 'utf8')); return Array.isArray(j) ? j : []; } catch { return []; } };
function applyCI() {
  for (let i = CATALOG.length - 1; i >= 0; i--) if (CATALOG[i].custom) CATALOG.splice(i, 1);
  for (const it of loadCI()) {
    const c = { id: it.id, cat: it.cat, name: it.name, price: it.price | 0, custom: true };
    if (it.cat === 'cape') c.file = require('url').pathToFileURL(path.join(ciDir, it.file)).href;
    if (it.cat === 'sky') { c.sky = it.sky; SKIES[it.id] = [it.sky[0], it.sky[1], true]; }
    CATALOG.push(c);
  }
}
applyCI();
ipcMain.handle('itemAdd', async (_e, { name, cat, price, sky }) => {
  if (!adminOnly()) return { ok: false, error: 'Nur Admins.' };
  name = String(name || '').trim().slice(0, 40); price = Math.max(0, Math.min(100000, Math.round(+price || 0)));
  if (!name) return { ok: false, error: 'Bitte einen Namen eingeben.' };
  const id = cat + '-c' + Date.now().toString(36), it = { id, cat, name, price };
  if (cat === 'cape') {
    const r = await dialog.showOpenDialog(win, { title: 'Umhang-Textur (PNG, 64×32) wählen', filters: [{ name: 'PNG', extensions: ['png'] }], properties: ['openFile'] });
    if (r.canceled || !r.filePaths[0]) return { ok: false, error: '' };
    try {
      const b = fs.readFileSync(r.filePaths[0]); if (b.length > 2 * 1048576 || b.readUInt32BE(0) !== 0x89504e47) return { ok: false, error: 'Bitte eine PNG-Datei (max. 2 MB) wählen.' };
      fs.mkdirSync(ciDir, { recursive: true }); it.file = id + '.png'; fs.writeFileSync(path.join(ciDir, it.file), b);
    } catch { return { ok: false, error: 'Datei konnte nicht gelesen werden.' }; }
  } else if (cat === 'sky') {
    if (!Array.isArray(sky) || sky.length < 2 || !sky.every(c => /^#[0-9a-f]{6}$/i.test(c))) return { ok: false, error: 'Bitte zwei Farben wählen.' };
    it.sky = [sky[0], sky[1]];
  } else return { ok: false, error: 'Diese Kategorie geht nicht.' };
  const l = loadCI(); l.push(it); try { fs.writeFileSync(ciFile, JSON.stringify(l, null, 1)); } catch { return { ok: false, error: 'Speichern fehlgeschlagen.' }; }
  applyCI(); return shopWrite(() => ({}));
});
ipcMain.handle('itemDelete', (_e, id) => {
  if (!adminOnly()) return { ok: false };
  const l = loadCI(), it = l.find(x => x.id === id); if (!it) return { ok: false };
  try { fs.writeFileSync(ciFile, JSON.stringify(l.filter(x => x.id !== id), null, 1)); if (it.file) fs.rmSync(path.join(ciDir, it.file), { force: true }); } catch {}
  applyCI(); delete SKIES[id]; return shopWrite(() => ({}));
});

// ---- Himmels-Paket im Farbton deines Themes: Sonne, Mondphasen und Wolken werden beim Start passend zum Theme erzeugt ----
const crcT = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32b = b => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = crcT[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
function pngRGBA(w, h, px) {
  const raw = Buffer.alloc((w * 4 + 1) * h); for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; Buffer.from(px.buffer, px.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1); }
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]), c = Buffer.alloc(4); c.writeUInt32BE(crc32b(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', require('zlib').deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
function zipStore(files) {
  const parts = [], cd = []; let off = 0;
  for (const f of files) {
    const n = Buffer.from(f.name), c = crc32b(f.data), h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x21, 12); h.writeUInt32LE(c, 14); h.writeUInt32LE(f.data.length, 18); h.writeUInt32LE(f.data.length, 22); h.writeUInt16LE(n.length, 26);
    parts.push(h, n, f.data);
    const d = Buffer.alloc(46); d.writeUInt32LE(0x02014b50, 0); d.writeUInt16LE(20, 4); d.writeUInt16LE(20, 6); d.writeUInt16LE(0x21, 14); d.writeUInt32LE(c, 16); d.writeUInt32LE(f.data.length, 20); d.writeUInt32LE(f.data.length, 24); d.writeUInt16LE(n.length, 28); d.writeUInt32LE(off, 42);
    cd.push(d, n); off += 30 + n.length + f.data.length;
  }
  const cdb = Buffer.concat(cd), e = Buffer.alloc(22); e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(files.length, 8); e.writeUInt16LE(files.length, 10); e.writeUInt32LE(cdb.length, 12); e.writeUInt32LE(off, 16);
  return Buffer.concat([...parts, cdb, e]);
}
function themedSkyZip(accentHex, skyHex) {
  const hx = h => { const n = parseInt(String(h || '#4aa3ff').replace('#', ''), 16) || 0x4aa3ff; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const mixc = (a, b, t) => [0, 1, 2].map(i => a[i] * (1 - t) + b[i] * t), A = hx(accentHex), K = hx(skyHex), W = [255, 255, 255];
  const c1 = mixc(A, W, .6), c2 = A, c3 = mixc(A, K, .5), clamp = v => Math.max(0, Math.min(1, v));
  // Sonne 256x256
  const S = 256, sun = new Uint8Array(S * S * 4);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = (x - 127.5) / 128, dy = (y - 127.5) / 128, r = Math.hypot(dx, dy), th = Math.atan2(dy, dx);
    const a = clamp(Math.pow(clamp(1 - r / .3), .6) + Math.exp(-((r / .55) ** 2)) * .77 + Math.pow(clamp(1 - r), 2) * Math.pow(.5 + .5 * Math.cos(th * 12 + 1), 6) * .7 + Math.exp(-(((r - .42) / .02) ** 2)) * .5) * clamp(1 - (r - .85) / .15);
    const t = clamp(r / .9), col = t < .25 ? mixc(W, c1, t / .25) : t < .55 ? mixc(c1, c2, (t - .25) / .3) : mixc(c2, c3, (t - .55) / .45), o = (y * S + x) * 4;
    sun[o] = col[0]; sun[o + 1] = col[1]; sun[o + 2] = col[2]; sun[o + 3] = Math.round(a * 255);
  }
  // Mondphasen 4x2 Zellen à 128
  const M = 128, mw = M * 4, moon = new Uint8Array(mw * M * 2 * 4), lit0 = mixc(W, A, .16), dark0 = mixc(K, [0, 0, 20], .5), glowC = mixc(A, W, .35);
  const craters = [[-.3, -.2, .16], [.35, .1, .12], [-.1, .4, .1], [.2, -.45, .09], [-.5, .25, .08], [.05, 0, .13]];
  for (let p = 0; p < 8; p++) {
    const phi = p * Math.PI / 4, sg = p < 4 ? -1 : 1, L = [sg * Math.sin(phi), 0, Math.cos(phi)], pf = 1 - Math.abs(p - 4) / 4;
    for (let y = 0; y < M; y++) for (let x = 0; x < M; x++) {
      const dx = (x - 63.5) / (M * .28), dy = (y - 63.5) / (M * .28), r2 = dx * dx + dy * dy, inside = r2 <= 1, z = Math.sqrt(clamp(1 - r2));
      const lit = clamp(dx * L[0] + dy * L[1] + z * L[2]); let n = 0; for (const [ox, oy, rr] of craters) n += Math.exp(-(((dx - ox) ** 2 + (dy - oy) ** 2) / (rr * rr))) * .18;
      const shade = clamp(.07 + .93 * lit - n * lit), edge = Math.pow(clamp(1 - Math.hypot((x - 63.5) / 64, (y - 63.5) / 64)), 1.6);
      const o = (((p >> 2) * M + y) * mw + (p & 3) * M + x) * 4;
      if (inside) { const c = mixc(dark0, lit0, shade); moon[o] = c[0]; moon[o + 1] = c[1]; moon[o + 2] = c[2]; moon[o + 3] = 255; }
      else { const g = Math.exp(-clamp((Math.sqrt(r2) - 1) / 9, 0, 1) * 9 / .6) * .6 * edge * (.15 + .85 * pf); moon[o] = glowC[0]; moon[o + 1] = glowC[1]; moon[o + 2] = glowC[2]; moon[o + 3] = Math.round(clamp(g) * 255); }
    }
  }
  // Wolken 256x256 (weiche Flecken im Theme-Farbton)
  const C = 256, cl = new Uint8Array(C * C * 4), hsh = (x, y) => { let h = (x * 374761393 + y * 668265263) ^ 0x5bd1e995; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
  const vn = (x, y, f) => { const gx = Math.floor(x / f), gy = Math.floor(y / f), fx = (x / f) - gx, fy = (y / f) - gy, g = (i, j) => hsh(((gx + i) % (C / f)), ((gy + j) % (C / f))), sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy); return (g(0, 0) * (1 - sx) + g(1, 0) * sx) * (1 - sy) + (g(0, 1) * (1 - sx) + g(1, 1) * sx) * sy; };
  const cc = mixc(W, A, .5);
  for (let y = 0; y < C; y++) for (let x = 0; x < C; x++) { const v = vn(x, y, 32) * .5 + vn(x, y, 16) * .3 + vn(x, y, 8) * .2, o = (y * C + x) * 4; if (v > .5) { cl[o] = cc[0]; cl[o + 1] = cc[1]; cl[o + 2] = cc[2]; cl[o + 3] = 255; } }
  const meta = JSON.stringify({ pack: { pack_format: 46, supported_formats: { min_inclusive: 34, max_inclusive: 99 }, min_format: 34, max_format: 99, description: 'Cloudy Theme Sky' } });
  return zipStore([{ name: 'pack.mcmeta', data: Buffer.from(meta) }, { name: 'assets/minecraft/textures/environment/sun.png', data: pngRGBA(S, S, sun) },
    { name: 'assets/minecraft/textures/environment/moon_phases.png', data: pngRGBA(mw, M * 2, moon) }, { name: 'assets/minecraft/textures/environment/clouds.png', data: pngRGBA(C, C, cl) }]);
}

// ---- Cloudy-Spiel-Texturen: aus dem echten Minecraft-Jar umgefaerbt (Spitzhacken, Totem, Inventare) - Form und Schattierung bleiben vanilla, nur die Farbe aendert sich ----
function zipEntries(buf) {
  let e = buf.length - 22; while (e >= 0 && buf.readUInt32LE(e) !== 0x06054b50) e--;
  if (e < 0) throw new Error('kein Zip');
  const n = buf.readUInt16LE(e + 10); let p = buf.readUInt32LE(e + 16); const m = new Map();
  for (let i = 0; i < n; i++) { if (buf.readUInt32LE(p) !== 0x02014b50) break; const nl = buf.readUInt16LE(p + 28), el = buf.readUInt16LE(p + 30), cl = buf.readUInt16LE(p + 32); m.set(buf.toString('utf8', p + 46, p + 46 + nl), { method: buf.readUInt16LE(p + 10), csize: buf.readUInt32LE(p + 20), lh: buf.readUInt32LE(p + 42) }); p += 46 + nl + el + cl; }
  return m;
}
function zipRead(buf, ent) {
  const nl = buf.readUInt16LE(ent.lh + 26), el = buf.readUInt16LE(ent.lh + 28), st = ent.lh + 30 + nl + el, d = buf.subarray(st, st + ent.csize);
  return ent.method === 0 ? Buffer.from(d) : require('zlib').inflateRawSync(d);
}
function pngDecode(buf) { // -> {w,h,px:Uint8Array RGBA}; 8-Bit und Palette/Grau mit kleiner Tiefe, ohne Interlace
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('kein PNG');
  let p = 8, w = 0, h = 0, bd = 8, ct = 6, il = 0, plte = null, trns = null; const idat = [];
  while (p < buf.length) { const l = buf.readUInt32BE(p), t = buf.toString('latin1', p + 4, p + 8), d = buf.subarray(p + 8, p + 8 + l); if (t === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); bd = d[8]; ct = d[9]; il = d[12]; } else if (t === 'PLTE') plte = d; else if (t === 'tRNS') trns = d; else if (t === 'IDAT') idat.push(d); else if (t === 'IEND') break; p += 12 + l; }
  if (il) throw new Error('interlaced');
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ct]; if (!ch) throw new Error('ct');
  const bpp = Math.max(1, (ch * bd) >> 3), stride = (w * ch * bd + 7) >> 3, raw = require('zlib').inflateSync(Buffer.concat(idat)), out = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], so = y * (stride + 1) + 1, o = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[o + x - bpp] : 0, b = y ? out[o - stride + x] : 0, c = x >= bpp && y ? out[o - stride + x - bpp] : 0; let v = raw[so + x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1; else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      out[o + x] = v & 255;
    }
  }
  const px = new Uint8Array(w * h * 4), samp = (y, x, c) => { if (bd === 8) return out[y * stride + x * ch + c]; if (bd === 16) return out[y * stride + (x * ch + c) * 2]; const bit = (x * ch + c) * bd, byte = out[y * stride + (bit >> 3)]; return (byte >> (8 - bd - (bit & 7))) & ((1 << bd) - 1); };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = (y * w + x) * 4; let r, g, b, a = 255;
    if (ct === 6) { r = samp(y, x, 0); g = samp(y, x, 1); b = samp(y, x, 2); a = samp(y, x, 3); }
    else if (ct === 2) { r = samp(y, x, 0); g = samp(y, x, 1); b = samp(y, x, 2); }
    else if (ct === 4) { r = g = b = samp(y, x, 0); a = samp(y, x, 1); }
    else if (ct === 0) { const v = samp(y, x, 0); r = g = b = bd < 8 ? v * (255 / ((1 << bd) - 1)) : v; }
    else { const i = samp(y, x, 0); r = plte[i * 3]; g = plte[i * 3 + 1]; b = plte[i * 3 + 2]; a = trns && i < trns.length ? trns[i] : 255; }
    px[o] = r; px[o + 1] = g; px[o + 2] = b; px[o + 3] = a;
  }
  return { w, h, px };
}
function jarPath() {
  try {
    const vd = path.join(root, 'versions'); const ids = fs.readdirSync(vd).filter(d => /^\d+\.\d+(\.\d+)?$/.test(d) && fs.existsSync(path.join(vd, d, d + '.jar')));
    if (!ids.length) return null;
    ids.sort((a, b) => (a === '1.21.4' ? -1 : b === '1.21.4' ? 1 : b.localeCompare(a, undefined, { numeric: true })));
    return path.join(vd, ids[0], ids[0] + '.jar');
  } catch { return null; }
}
const rgb2hsv = (r, g, b) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0; if (d) { if (mx === r) h = ((g - b) / d + 6) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; } return [h * 60, mx ? d / mx : 0, mx / 255]; };
// Farbe auf Helligkeit abbilden: dunkel -> sehr dunkle Variante, Mitte -> Farbe, hell -> Weiss-Mix
function tintLum(C, lum) { const k = Math.max(0, Math.min(1, lum)); const dk = C.map(v => v * .18), mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t); return k < .5 ? mix(dk, C, k * 2) : mix(C, [255, 255, 255], (k - .5) * 1.7); }
function recolorPick(img, tier, tool) { // nur Kopf/Klinge; Stiel und Griff bleiben vanilla
  const { w, h, px } = img; const C = img.C;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = (y * w + x) * 4; if (px[o + 3] < 8) continue;
    const [hu, sa, va] = rgb2hsv(px[o], px[o + 1], px[o + 2]);
    const sx = x * 16 / w, sy = y * 16 / h;
    const stick = tier === 'wooden' ? (tool === 'sword' ? (sx <= 6 && sy >= 9) : (sx + sy >= 12 && sx + sy <= 18 && sx <= 10 && sy >= 5)) : (hu >= 12 && hu <= 48 && sa >= .25 && va <= .62);
    if (stick) continue;
    const lum = (px[o] * .3 + px[o + 1] * .59 + px[o + 2] * .11) / 255, c = tintLum(C, lum);
    for (let i = 0; i < 3; i++) px[o + i] = Math.round(c[i]);
  }
}
function recolorGray(img, strength) { // Grautoene (Inventarflaechen, Slots) einfaerben; farbige Pixel (Pfeile, Herzen, Balken) bleiben
  const { px } = img; const C = img.C;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 8) continue;
    const [, sa] = rgb2hsv(px[i], px[i + 1], px[i + 2]); if (sa > .16) continue;
    const lum = (px[i] * .3 + px[i + 1] * .59 + px[i + 2] * .11) / 255;
    if (lum < .12) continue; // schwarze Kanten bleiben
    const c = tintLum(C, lum * .96);
    for (let k = 0; k < 3; k++) px[i + k] = Math.round(px[i + k] * (1 - strength) + c[k] * strength);
  }
}
function themedGameZip(accentHex, opt) {
  const hex = String((opt.useTheme === false && opt.color) ? opt.color : accentHex || '#4aa3ff').replace('#', ''), n = parseInt(hex, 16) || 0x4aa3ff, C = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const jp = jarPath(); if (!jp) return null;
  const jar = fs.readFileSync(jp), ents = zipEntries(jar), files = [{ name: 'pack.mcmeta', data: Buffer.from(JSON.stringify({ pack: { pack_format: 46, supported_formats: { min_inclusive: 34, max_inclusive: 99 }, min_format: 34, max_format: 99, description: 'Cloudy Theme Textures' } })) }];
  const add = (name, fn) => { const ent = ents.get(name); if (!ent) return; try { const img = pngDecode(zipRead(jar, ent)); img.C = C; fn(img); files.push({ name, data: pngRGBA(img.w, img.h, img.px) }); } catch {} };
  if (opt.pick !== false) for (const t of ['wooden', 'stone', 'iron', 'golden', 'diamond', 'netherite']) for (const tl of ['pickaxe', 'sword', 'axe', 'shovel', 'hoe']) add(`assets/minecraft/textures/item/${t}_${tl}.png`, img => recolorPick(img, t, tl));
  if (opt.totem !== false) add('assets/minecraft/textures/item/totem_of_undying.png', img => {
    for (let i = 0; i < img.px.length; i += 4) { if (img.px[i + 3] < 8) continue; const lum = (img.px[i] * .3 + img.px[i + 1] * .59 + img.px[i + 2] * .11) / 255, c = tintLum(C, .12 + lum * .95); for (let k = 0; k < 3; k++) img.px[i + k] = Math.round(c[k]); }
  });
  if (opt.inv !== false) for (const name of ents.keys()) if (/^assets\/minecraft\/textures\/gui\/container\/[^/]+\.png$/.test(name) || /^assets\/minecraft\/textures\/gui\/container\/creative_inventory\/[^/]+\.png$/.test(name) || /^assets\/minecraft\/textures\/gui\/sprites\/container\/slot[^/]*\.png$/.test(name)) add(name, img => recolorGray(img, .85));
  return files.length > 1 ? zipStore(files) : null;
}
function syncShopPacks(dir, equip) { // gewählte Totem-/Hotbar-Resourcepacks installieren und in options.txt aktivieren; Himmel in die Client-Config
  try {
    const rp = path.join(dir, 'resourcepacks'); fs.mkdirSync(rp, { recursive: true });
    const want = ['totem', 'hotbar', 'sky', 'shield'].map(c => PACK_FILES[equip[c]]).filter(Boolean);
    for (const f of fs.readdirSync(rp)) if (/^cloudy-(totem|hotbar|sky|shield)-.*\.zip$/.test(f) && !want.includes(f)) try { fs.unlinkSync(path.join(rp, f)); } catch {}
    for (const f of want) { if (f === 'cloudy-sky-galaxy.zip') continue; const src = path.join(__dirname, 'assets', 'packs', f), dst = path.join(rp, f); if (fs.existsSync(src) && (!fs.existsSync(dst) || fs.statSync(dst).size !== fs.statSync(src).size)) fs.copyFileSync(src, dst); }
    if (want.includes('cloudy-sky-galaxy.zip')) { try { const th = (cfgPatch({}).theme) || {}; fs.writeFileSync(path.join(rp, 'cloudy-sky-galaxy.zip'), themedSkyZip(th.accent, (th.sky || [])[0])); } catch {} }
    const tc = cfgPatch({}); let toolsOn = false; try { const z = (tc.toolTex !== false || tc.texTotem !== false || tc.texInv !== false) ? themedGameZip(((tc.theme) || {}).accent, { pick: tc.toolTex !== false, totem: tc.texTotem !== false, inv: tc.texInv !== false, useTheme: tc.texTheme !== false, color: tc.texColor }) : null; if (z) { fs.writeFileSync(path.join(rp, 'cloudy-tools-theme.zip'), z); toolsOn = true; } else fs.rmSync(path.join(rp, 'cloudy-tools-theme.zip'), { force: true }); } catch {}
    const of = path.join(dir, 'options.txt'); let lines = []; try { lines = fs.readFileSync(of, 'utf8').split(/\r?\n/).filter(Boolean); } catch {}
    let list = ['vanilla']; const i = lines.findIndex(l => l.startsWith('resourcePacks:'));
    if (i >= 0) try { list = JSON.parse(lines[i].slice(14)); } catch {}
    list = list.filter(x => !/^file\/cloudy-(totem|hotbar|sky|shield)-/.test(x) && x !== 'file/cloudy-tools-theme.zip'); for (const f of want) list.push('file/' + f);
    if (toolsOn) list.splice(Math.min(1, list.length), 0, 'file/cloudy-tools-theme.zip'); // ganz unten: deine eigenen Pakete liegen darueber und haben Vorrang
    const l = 'resourcePacks:' + JSON.stringify(list); if (i >= 0) lines[i] = l; else lines.push(l);
    fs.writeFileSync(of, lines.join('\n') + '\n');
  } catch {}
  try { const k = SKIES[equip.sky]; cfgPatch({ skyShop: k ? { sky: [k[0], k[1]], dark: !!k[2] } : null }); } catch {}
}
const cosFile = path.join(app.getPath('userData'), 'cosmetics.json');
const todayStr = () => { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
const namesFile = path.join(app.getPath('userData'), 'shop-names.json'); // vom Admin geänderte Item-Namen – bleiben bei Updates erhalten
const shopNames = () => { try { const j = JSON.parse(fs.readFileSync(namesFile, 'utf8')); return j && typeof j === 'object' ? j : {}; } catch { return {}; } };
function shopOf(u) {
  if (u.coins == null) u.coins = 100; if (!u.owned) u.owned = []; if (!u.equip) u.equip = {};
  for (const k of Object.keys(u.equip)) if (!CATALOG.some(c => c.id === u.equip[k])) delete u.equip[k]; // entfernte Items (alte Z4-/Galaxie-Sachen) nicht mehr ausrüsten
  const nm = shopNames();
  return { catalog: CATALOG.map(c => nm[c.id] ? { ...c, name: nm[c.id] } : c), admin: !!u.admin, coins: u.admin || u.infCoins ? null : u.coins, owned: u.admin ? CATALOG.map(c => c.id) : u.owned, equip: u.equip, dailyReady: !u.admin && !u.infCoins && u.daily !== todayStr() };
}
function syncCosFromGame() { // im Spiel geänderte Auswahl (Cosmetics-Menü) in dein Konto übernehmen
  try {
    const g = JSON.parse(fs.readFileSync(cosFile, 'utf8')), a = readAuth(), u = currentUser && a.users[currentUser.toLowerCase()]; if (!u || g.user !== u.name) return;
    const ok = id => CATALOG.some(c => c.id === id) && (u.admin || (u.owned || []).includes(id)), eq = {};
    for (const [cat, id] of Object.entries(g.equip || {})) if (ok(id) && CATALOG.find(c => c.id === id).cat === cat) eq[cat] = id;
    u.equip = eq; saveAuth(a); srvPush(u);
  } catch {}
}
function equipNow() { try { shopWrite(() => ({}), true); return JSON.parse(fs.readFileSync(cosFile, 'utf8')).equip || {}; } catch { return {}; } }
function shopWrite(fn, quiet) { // Änderung am Konto des angemeldeten Nutzers speichern und neuen Stand zurückgeben
  const a = readAuth(), u = currentUser && a.users[currentUser.toLowerCase()]; if (!u) return { ok: false, error: 'Bitte zuerst bei Cloudy anmelden.' };
  shopOf(u); const r = fn(u) || {}; saveAuth(a); if (!quiet) srvPush(u);
  try { fs.writeFileSync(cosFile, JSON.stringify({ user: u.name, equip: u.equip || {}, owned: u.admin ? CATALOG.map(c => c.id) : (u.owned || []) })); } catch {}
  return { ...r, ok: r.ok !== false, state: shopOf(u) };
}
ipcMain.handle('shopRename', async (_e, { id, name }) => {
  const a = readAuth(), cu = currentUser && a.users[currentUser.toLowerCase()];
  if (!cu || !cu.admin) return { ok: false, error: 'Nur Admins können Namen ändern.' };
  if (!CATALOG.some(c => c.id === id)) return { ok: false, error: 'Unbekanntes Item.' };
  const v = String(name || '').trim().slice(0, 40);
  if (srvCfg()) { const r = await srvCall('/admin/shopname', { id, name: v }, srvTok).catch(() => ({})); if (!r.ok) return { ok: false, error: 'Der Server hat den Namen nicht gespeichert.' }; }
  return shopWrite(u => {
    const nm = shopNames(); if (v) nm[id] = v; else delete nm[id];
    try { fs.writeFileSync(namesFile, JSON.stringify(nm, null, 1)); } catch { return { ok: false, error: 'Name konnte nicht gespeichert werden.' }; }
  });
});
ipcMain.handle('shopState', async () => { await srvPull(); const r = shopWrite(() => ({}), true); return r.ok ? r.state : null; });
{ const _ih = ipcMain.handle.bind(ipcMain); ipcMain.handle = (n, f) => _ih(n, ['shopBuy', 'shopEquip', 'shopDaily', 'shopGift'].includes(n) ? async (...a) => { await srvPull(); return f(...a); } : f); } // vor jeder Shop-Aktion den neuesten Stand vom Server holen (Geschenke, Admin-Änderungen)
ipcMain.handle('shopBuy', (_e, id) => shopWrite(u => {
  const it = CATALOG.find(c => c.id === id); if (!it) return { ok: false, error: 'Unbekanntes Item.' };
  if (u.admin) return {}; if (u.owned.includes(id)) return { ok: false, error: 'Das besitzt du schon.' };
  if (u.infCoins) { u.owned.push(id); return {}; } // Tester: unendlich Coins, nichts wird abgezogen
  if (u.coins < it.price) return { ok: false, error: `Dir fehlen ${it.price - u.coins} CC.` };
  u.coins -= it.price; u.owned.push(id);
}));
ipcMain.handle('shopEquip', (_e, { cat, id }) => shopWrite(u => {
  if (id) { const it = CATALOG.find(c => c.id === id && c.cat === cat); if (!it || !(u.admin || u.owned.includes(id))) return { ok: false, error: 'Item nicht verfügbar.' }; u.equip[cat] = id; } else delete u.equip[cat];
  try { const k = SKIES[u.equip.sky]; cfgPatch({ skyShop: k ? { sky: [k[0], k[1]], dark: !!k[2] } : null }); } catch {}
}));
ipcMain.handle('shopDaily', () => shopWrite(u => { if (u.admin || u.infCoins || u.daily === todayStr()) return { ok: false, error: 'Heute schon abgeholt.' }; u.daily = todayStr(); u.coins += 50; }));
ipcMain.handle('shopGift', async (_e, { to, id }) => {
  to = String(to || '').trim(); id = String(id || '');
  const a0 = readAuth(), me0 = currentUser && a0.users[currentUser.toLowerCase()];
  if (!me0) return { ok: false, error: 'Bitte zuerst bei Cloudy anmelden.' };
  if (srvCfg()) {
    const r = await srvCall('/gift', { to, id }, srvTok).catch(() => null); if (!r) return { ...SRV_DOWN, ok: false };
    if (!r.ok) return { ok: false, error: r.error || 'Geschenk fehlgeschlagen.' };
    await srvPull(); return { ok: true, to: r.to, state: shopWrite(() => ({}), true).state };
  }
  const a = readAuth(), me = a.users[currentUser.toLowerCase()], rc = a.users[to.toLowerCase()];
  if (me.admin) return { ok: false, error: 'Admins besitzen schon alles.' };
  if (!rc || rc.admin) return { ok: false, error: 'Dieses Konto gibt es nicht.' };
  if (rc === me) return { ok: false, error: 'Du kannst dir nichts selbst schenken.' };
  if (!(me.owned || []).includes(id)) return { ok: false, error: 'Das besitzt du nicht.' };
  rc.owned = rc.owned || []; if (rc.owned.includes(id)) return { ok: false, error: rc.name + ' besitzt das schon.' };
  me.owned = me.owned.filter(x => x !== id); for (const k of Object.keys(me.equip || {})) if (me.equip[k] === id) delete me.equip[k];
  rc.owned.push(id); saveAuth(a); return { ok: true, to: rc.name, state: shopWrite(() => ({}), true).state };
});
ipcMain.handle('authAdminGrant', async (_e, { name, amount }) => {
  if (srvCfg()) return adminOnly() && !!(await srvCall('/admin/grant', { name, amount }, srvTok).catch(() => ({}))).ok;
  if (!adminOnly()) return false; const a = readAuth(), u = a.users[String(name).toLowerCase()]; if (!u || u.admin) return false;
  u.coins = Math.max(0, (u.coins == null ? 100 : u.coins) + (parseInt(amount, 10) || 0)); saveAuth(a); return true;
});
// Spielzeit (zählt live mit, auch wenn Cloudy zwischendurch geschlossen wird) und 5 CC pro Minute direkt während des Spielens
const playFile = path.join(app.getPath('userData'), 'playtime.json');
let play = (() => { try { const j = JSON.parse(fs.readFileSync(playFile, 'utf8')); return { ms: +j.ms || 0, last: +j.last || 0 }; } catch { return { ms: 0, last: 0 }; } })();
const playSave = () => { try { fs.writeFileSync(playFile, JSON.stringify(play)); } catch {} };
let playSess = null; // { who, t, coinMs, earned }
ipcMain.handle('playStats', () => ({ ms: play.ms, last: play.last, running: !!mcProc }));
ipcMain.handle('playSeed', (_e, { ms, last }) => { if (!play.ms && +ms > 0) { play.ms = Math.min(+ms, 1e10); play.last = +last || 0; playSave(); } return { ms: play.ms, last: play.last, running: !!mcProc }; });
function playTick(final) {
  if (!playSess) return; const now = Date.now(), d = now - playSess.t; playSess.t = now;
  play.ms += d; play.last = now; playSave(); playSess.coinMs += d;
  const min = Math.floor(playSess.coinMs / 60000);
  if (min >= 1 && playSess.who && playSess.earned < 600) { playSess.coinMs -= min * 60000; const gain = Math.min(min * 5, 600 - playSess.earned); playSess.earned += gain; earnPlay(playSess.who, gain); }
  if (final) playSess = null;
}
setInterval(() => { if (mcProc) { if (!playSess) playSess = { who: currentUser, t: Date.now(), coinMs: 0, earned: 0 }; if (!playSess.who) playSess.who = currentUser; playTick(false); } }, 15000);
function earnPlay(who, gain) { // gain = fertige CC (max. 600 pro Sitzung)
  try {
    if (!who || gain < 1) return;
    const a = readAuth(), u = a.users[who.toLowerCase()]; if (!u || u.admin || u.infCoins) return;
    u.coins = (u.coins == null ? 100 : u.coins) + gain; saveAuth(a); srvPush(u);
    if (currentUser && currentUser.toLowerCase() === who.toLowerCase()) send('coins', { gain, state: shopOf(u) });
  } catch {}
}


// ---- Skins (Bibliothek, Spielername/Link/Datei, Upload zu Minecraft) ----
const skinDir = path.join(app.getPath('userData'), 'skins'), skinIdx = path.join(skinDir, 'index.json');
const readSkins = () => { try { return JSON.parse(fs.readFileSync(skinIdx, 'utf8')); } catch { return []; } };
const writeSkins = l => { fs.mkdirSync(skinDir, { recursive: true }); fs.writeFileSync(skinIdx, JSON.stringify(l)); };
const skinPng = id => path.join(skinDir, String(id).replace(/[^a-f0-9]/g, '') + '.png');
function addSkin(buf, name, model) {
  const ok = buf.length > 24 && buf.length < 300000 && buf.readUInt32BE(0) === 0x89504e47, w = ok && buf.readUInt32BE(16), h = ok && buf.readUInt32BE(20);
  if (!ok || w !== 64 || (h !== 64 && h !== 32)) throw new Error('Das ist kein gültiger Minecraft-Skin (PNG, 64×64 oder 64×32).');
  const id = crypto.randomBytes(6).toString('hex'); fs.mkdirSync(skinDir, { recursive: true }); fs.writeFileSync(skinPng(id), buf);
  const l = readSkins(); l.unshift({ id, name: String(name || 'Skin').slice(0, 32), model: model === 'slim' ? 'slim' : 'classic' }); writeSkins(l); return id;
}
const getBuf = async u => { const r = await fetch(u, HDR); if (!r.ok) throw new Error('Download fehlgeschlagen (' + r.status + ').'); return Buffer.from(await r.arrayBuffer()); };
ipcMain.handle('skinList', () => readSkins().filter(s => fs.existsSync(skinPng(s.id))).map(s => ({ ...s, data: 'data:image/png;base64,' + fs.readFileSync(skinPng(s.id)).toString('base64') })));
async function fetchSkinByName(name) { // Spielername → Skin-PNG über die Mojang-Server
  const n = String(name || '').trim(); if (!/^[A-Za-z0-9_]{1,16}$/.test(n)) throw new Error('Ungültiger Spielername.');
  const r = await fetch('https://api.mojang.com/users/profiles/minecraft/' + n, HDR);
  if (r.status === 404 || r.status === 204) throw new Error('Spieler nicht gefunden.'); if (!r.ok) throw new Error('Mojang antwortet nicht (' + r.status + ').');
  const p = await r.json(), pr = await (await fetch('https://sessionserver.mojang.com/session/minecraft/profile/' + p.id, HDR)).json();
  const tp = (pr.properties || []).find(x => x.name === 'textures'), sk = tp && JSON.parse(Buffer.from(tp.value, 'base64').toString()).textures.SKIN;
  if (!sk) throw new Error('Dieser Spieler hat keinen eigenen Skin.');
  return { name: p.name, model: sk.metadata && sk.metadata.model === 'slim' ? 'slim' : 'classic', buf: await getBuf(sk.url.replace(/^http:/, 'https:')) };
}
const DISCOVER = ['jeb_', 'Dinnerbone', 'Notch', 'Grumm', 'Dream', 'Technoblade', 'Philza', 'TommyInnit', 'Skeppy', 'GeorgeNotFound', 'Sapnap', 'Wilbur_Soot', 'Ranboo', 'Quackity', 'Fundy', 'Eret'];
ipcMain.handle('skinDiscover', async () => { // beliebte Skins, beim ersten Öffnen geladen und gespeichert
  const f = path.join(skinDir, 'discover.json'); let c = {}; try { c = JSON.parse(fs.readFileSync(f, 'utf8')); } catch {}
  const todo = DISCOVER.filter(n => !c[n]); let dirty = false;
  for (let i = 0; i < todo.length; i += 4) await Promise.all(todo.slice(i, i + 4).map(async n => { try { const s = await fetchSkinByName(n); c[n] = { name: s.name, model: s.model, data: 'data:image/png;base64,' + s.buf.toString('base64') }; dirty = true; } catch {} }));
  if (dirty) { fs.mkdirSync(skinDir, { recursive: true }); fs.writeFileSync(f, JSON.stringify(c)); }
  return DISCOVER.filter(n => c[n]).map(n => c[n]);
});
ipcMain.handle('skinAddName', async (_e, name) => {
  try { const s = await fetchSkinByName(name); addSkin(s.buf, s.name, s.model); return { ok: true }; } catch (e) { return { ok: false, error: String(e.message || e) }; }
});
ipcMain.handle('skinAddNameOld', async (_e, name) => {
  try {
    const n = String(name || '').trim(); if (!/^[A-Za-z0-9_]{1,16}$/.test(n)) return { ok: false, error: 'Ungültiger Spielername.' };
    const r = await fetch('https://api.mojang.com/users/profiles/minecraft/' + n, HDR);
    if (r.status === 404 || r.status === 204) return { ok: false, error: 'Spieler nicht gefunden.' }; if (!r.ok) throw new Error('Mojang antwortet nicht (' + r.status + ').');
    const p = await r.json(), pr = await (await fetch('https://sessionserver.mojang.com/session/minecraft/profile/' + p.id, HDR)).json();
    const tp = (pr.properties || []).find(x => x.name === 'textures'), sk = tp && JSON.parse(Buffer.from(tp.value, 'base64').toString()).textures.SKIN;
    if (!sk) return { ok: false, error: 'Dieser Spieler hat keinen eigenen Skin.' };
    addSkin(await getBuf(sk.url.replace(/^http:/, 'https:')), p.name, sk.metadata && sk.metadata.model); return { ok: true };
  } catch (e) { return { ok: false, error: String(e.message || e) }; }
});
ipcMain.handle('skinAddUrl', async (_e, url) => {
  try {
    if (!/^https?:\/\//i.test(url)) return { ok: false, error: 'Bitte einen Link mit https:// eingeben.' };
    addSkin(await getBuf(url), decodeURIComponent((new URL(url).pathname.split('/').pop() || 'Skin').replace(/\.png$/i, '')), 'classic'); return { ok: true };
  } catch (e) { return { ok: false, error: /gültiger/.test(e.message) ? 'Der Link ist kein direkter Skin (PNG 64×64). Lade das Bild auf der Website herunter und nutze „PNG laden“.' : String(e.message || e) }; }
});
ipcMain.handle('skinPick', async () => {
  const r = await dialog.showOpenDialog(win, { title: 'Skin auswählen', filters: [{ name: 'PNG', extensions: ['png'] }], properties: ['openFile', 'multiSelections'] });
  if (r.canceled) return { ok: false, cancel: true };
  try { r.filePaths.forEach(f => addSkin(fs.readFileSync(f), path.basename(f).replace(/\.png$/i, ''), 'classic')); return { ok: true }; } catch (e) { return { ok: false, error: e.message }; }
});
ipcMain.handle('skinRemove', (_e, id) => { writeSkins(readSkins().filter(s => s.id !== id)); fs.rmSync(skinPng(id), { force: true }); });
ipcMain.handle('skinModel', (_e, { id, model }) => { writeSkins(readSkins().map(s => s.id === id ? { ...s, model: model === 'slim' ? 'slim' : 'classic' } : s)); });
ipcMain.handle('skinApply', async (_e, id) => {
  const s = readSkins().find(x => x.id === id); if (!s) return { ok: false, error: 'Skin nicht gefunden.' };
  if (!readAcc()) return { ok: false, error: 'Zum Hochladen brauchst du ein Microsoft-Konto (Einstellungen → Konto). Mit einem Offline-Konto kann Minecraft keine eigenen Skins zeigen.' };
  if (!msmc) return { ok: false, error: 'Paket fehlt: führe im Cloudy-Ordner „npm install msmc“ aus.' };
  try {
    const mc = await msAuth(), fd = new FormData();
    fd.append('variant', s.model === 'slim' ? 'slim' : 'classic'); fd.append('file', new Blob([fs.readFileSync(skinPng(s.id))], { type: 'image/png' }), 'skin.png');
    const r = await fetch('https://api.minecraftservices.com/minecraft/profile/skins', { method: 'POST', headers: { Authorization: 'Bearer ' + mc.access_token, 'User-Agent': HDR.headers['User-Agent'] }, body: fd });
    if (!r.ok) return { ok: false, error: 'Minecraft hat den Skin abgelehnt (' + r.status + ').' };
    return { ok: true };
  } catch (e) { return { ok: false, error: 'Upload fehlgeschlagen: ' + String(e.message || e) }; }
});

// ---- Eigener Minecraft-Server auf diesem PC ----
const srvRoot = path.join(app.getPath('userData'), 'servers');
let srvProc = null, srvInfo = null, srvStopTimer = null;
const lanIps = () => { const o = []; for (const l of Object.values(os.networkInterfaces())) for (const a of l || []) if (a.family === 'IPv4' && !a.internal) o.push(a.address); return o; };
const srvState = () => ({ running: !!srvProc, ready: !!(srvInfo && srvInfo.ready), type: srvInfo && srvInfo.type, version: srvInfo && srvInfo.version, port: srvInfo && srvInfo.port, ips: lanIps() });
const NET = require('./lib/net');
const srvDir = (v, type) => path.join(srvRoot, String(v).replace(/[^\w.-]/g, '') + (type === 'paper' ? '-paper' : ''));
let presTimer = null;
async function presence(on) { // Freunde im Freundesserver sehen deinen Server und können mit einem Klick beitreten
  const c = frConn(); if (!c) return; try { const pub = await NET.publicIp(); await frFetch(c.url, 'POST', '/presence', on && srvInfo ? { port: srvInfo.port, version: srvInfo.version, hosts: [...(pub ? [pub] : []), ...lanIps()] } : { port: 0 }, c.token); } catch {} }
ipcMain.handle('serverStatus', () => srvState());
ipcMain.handle('serverFolder', (_e, v, type) => { const d = srvDir(v, type); fs.mkdirSync(d, { recursive: true }); return shell.openPath(d); });
ipcMain.handle('serverStart', async (_e, { version, ram = 2, port = 25565, online = false, eula, motd, type = 'vanilla' }) => {
  type = type === 'paper' ? 'paper' : 'vanilla';
  if (srvProc) return { ok: false, error: 'Der Server läuft schon.' };
  if (!eula) return { ok: false, error: 'Bitte akzeptiere die Minecraft-EULA.' };
  version = String(version || '').replace(/[^\w.-]/g, ''); port = parseInt(port, 10) || 25565;
  if (!version) return { ok: false, error: 'Wähle eine Version.' };
  if (port < 1024 || port > 65535) return { ok: false, error: 'Der Port muss zwischen 1024 und 65535 liegen.' };
  try {
    const dir = srvDir(version, type); fs.mkdirSync(dir, { recursive: true });
    const jar = path.join(dir, 'server.jar');
    if (!fs.existsSync(jar) && type === 'paper') {
      send('serverState', { status: 'Lade Paper-Server (für Plugins) …' });
      const bs = (await getJSON(`https://api.papermc.io/v2/projects/paper/versions/${version}/builds`)).builds; if (!bs || !bs.length) throw new Error('Für diese Version gibt es keinen Paper-Server (Plugins).');
      const b = bs[bs.length - 1]; await download(`https://api.papermc.io/v2/projects/paper/versions/${version}/builds/${b.build}/downloads/${b.downloads.application.name}`, jar);
      fs.mkdirSync(path.join(dir, 'plugins'), { recursive: true });
    } else if (!fs.existsSync(jar)) {
      send('serverState', { status: 'Lade Server-Datei …' });
      const entry = (await getJSON('https://launchermeta.mojang.com/mc/game/version_manifest_v2.json')).versions.find(v => v.id === version);
      if (!entry) throw new Error('Version nicht gefunden.');
      const meta = await getJSON(entry.url); if (!meta.downloads || !meta.downloads.server) throw new Error('Für diese Version gibt es keinen Server.');
      await download(meta.downloads.server.url, jar);
    }
    fs.writeFileSync(path.join(dir, 'eula.txt'), 'eula=true\n');
    const pf = path.join(dir, 'server.properties'), props = {};
    try { fs.readFileSync(pf, 'utf8').split('\n').forEach(l => { const m = /^([^#=]+)=(.*)$/.exec(l.trim()); if (m) props[m[1]] = m[2]; }); } catch {}
    Object.assign(props, { 'server-port': String(port), 'online-mode': String(!!online), motd: String(motd || 'Cloudy Server').replace(/[\r\n]/g, ' ').slice(0, 60) });
    fs.writeFileSync(pf, Object.entries(props).map(([k, v]) => k + '=' + v).join('\n') + '\n');
    send('serverState', { status: 'Prüfe Java …' });
    let java = await ensureJava(version); if (IS_WIN) java = java.replace(/javaw\.exe$/i, 'java.exe');
    const proc = spawn(java, [`-Xmx${Math.max(1, Math.min(16, +ram || 2))}G`, '-Xms512M', '-jar', 'server.jar', 'nogui'], { cwd: dir, windowsHide: true });
    srvProc = proc; srvInfo = { version, port, type, ready: false };
    const on = d => String(d).split('\n').map(l => l.trimEnd()).filter(Boolean).forEach(l => { send('serverLog', l); if (/Done \(/.test(l) && srvInfo && !srvInfo.ready) { srvInfo.ready = true; send('serverState', srvState()); presence(true); clearInterval(presTimer); presTimer = setInterval(() => presence(true), 10000); } });
    NET.upnpMap(port).then(r => send('serverLog', r.ok ? '[Cloudy] Port automatisch im Router freigegeben (UPnP).' : `[Cloudy] Keine automatische Port-Freigabe (${r.why}). Nur im selben Netzwerk erreichbar, sonst Port ${port} im Router freigeben.`));
    proc.stdout.on('data', on); proc.stderr.on('data', on);
    proc.on('error', e => send('serverLog', 'Fehler: ' + e.message));
    proc.on('close', code => { if (srvProc === proc) { srvProc = null; srvInfo = null; clearTimeout(srvStopTimer); clearInterval(presTimer); presence(false); } send('serverLog', `Server beendet (Code ${code}).`); send('serverState', srvState()); });
    send('serverState', srvState());
    return { ok: true };
  } catch (e) { send('serverState', srvState()); return { ok: false, error: String(e.message || e) }; }
});
ipcMain.handle('serverStop', () => {
  if (!srvProc) return false; const p = srvProc;
  try { p.stdin.write('stop\n'); } catch {} srvStopTimer = setTimeout(() => { try { p.kill(); } catch {} }, 20000); return true;
});
ipcMain.handle('serverCmd', (_e, c) => { if (srvProc && /^[^\r\n]{1,200}$/.test(String(c))) { try { srvProc.stdin.write(c + '\n'); return true; } catch {} } return false; });

// ---- Plugins für den eigenen Server (Paper) ----
ipcMain.handle('pluginSearch', async (_e, { q, version, offset }) => {
  try {
    const facets = encodeURIComponent(JSON.stringify([['project_type:mod'], ['categories:paper'], [`versions:${version || '1.21.4'}`]]));
    const d = await getJSON(`https://api.modrinth.com/v2/search?query=${encodeURIComponent(q || '')}&facets=${facets}&limit=20&offset=${Math.max(0, Math.min(2000, (+offset || 0) | 0))}`);
    return d.hits.map(h => ({ id: h.project_id, title: h.title, desc: h.description, icon: h.icon_url, downloads: h.downloads, author: h.author }));
  } catch { return []; }
});
ipcMain.handle('pluginInstall', async (_e, { id, version }) => {
  try {
    const dir = path.join(srvDir(version, 'paper'), 'plugins'); fs.mkdirSync(dir, { recursive: true });
    const vers = await getJSON(`https://api.modrinth.com/v2/project/${encodeURIComponent(id)}/version?game_versions=${encodeURIComponent(JSON.stringify([version]))}&loaders=${encodeURIComponent('["paper","spigot","bukkit","purpur"]')}`);
    const v = vers.find(x => x.version_type === 'release') || vers[0]; if (!v) return { ok: false, error: 'Für diese Version gibt es kein passendes Plugin.' };
    const f = v.files.find(x => x.primary) || v.files[0]; await download(f.url, path.join(dir, path.basename(f.filename)));
    try { const pr = await getJSON(`https://api.modrinth.com/v2/project/${encodeURIComponent(id)}`), mf = path.join(dir, '.cloudy-icons.json'); let m = {}; try { m = JSON.parse(fs.readFileSync(mf, 'utf8')); } catch {} m[path.basename(f.filename)] = { icon: pr.icon_url || null, title: pr.title }; fs.writeFileSync(mf, JSON.stringify(m)); } catch {}
    for (const d of v.dependencies || []) if (d.dependency_type === 'required' && d.project_id) {
      try { const dv = (await getJSON(`https://api.modrinth.com/v2/project/${d.project_id}/version?game_versions=${encodeURIComponent(JSON.stringify([version]))}&loaders=${encodeURIComponent('["paper","spigot","bukkit"]')}`))[0]; if (dv) { const df = dv.files.find(x => x.primary) || dv.files[0]; await download(df.url, path.join(dir, path.basename(df.filename))); } } catch {}
    }
    return { ok: true };
  } catch (e) { return { ok: false, error: 'Download fehlgeschlagen.' }; }
});
ipcMain.handle('pluginIcons', (_e, version) => { try { return JSON.parse(fs.readFileSync(path.join(srvDir(version, 'paper'), 'plugins', '.cloudy-icons.json'), 'utf8')); } catch { return {}; } });
ipcMain.handle('pluginList', (_e, version) => { try { return fs.readdirSync(path.join(srvDir(version, 'paper'), 'plugins')).filter(f => /\.jar$/i.test(f)); } catch { return []; } });
ipcMain.handle('pluginRemove', (_e, { version, file }) => { try { fs.rmSync(path.join(srvDir(version, 'paper'), 'plugins', path.basename(String(file))), { force: true }); } catch {} return true; });

// ---- Freunde: Freundesserver hosten (lib/relay.js) und mit einem Server verbinden ----
const RELAY_PORT = 7777;
let relaySrv = null;
const frFile = path.join(app.getPath('userData'), 'friends-conn.json');
const frConn = () => { try { return JSON.parse(fs.readFileSync(frFile, 'utf8')); } catch { return null; } };
const relayState = async () => { const pub = await NET.publicIp(), lan = lanIps(); return { running: !!relaySrv, port: RELAY_PORT, ips: lan, code: relaySrv ? NET.encodeCode(pub, lan[0], RELAY_PORT) : '', pub }; };
ipcMain.handle('frHostStatus', () => relayState());
ipcMain.handle('frHost', (_e, on) => new Promise(res => {
  if (!on) { if (relaySrv) relaySrv.close(); relaySrv = null; return relayState().then(s => res({ ok: true, ...s })); }
  if (relaySrv) return relayState().then(s => res({ ok: true, ...s }));
  const s = require('./lib/relay').create({ file: path.join(app.getPath('userData'), 'relay-data.json') });
  s.on('error', e => res({ ok: false, error: e.code === 'EADDRINUSE' ? `Port ${RELAY_PORT} ist schon belegt.` : e.message }));
  s.listen(RELAY_PORT, '0.0.0.0', () => { relaySrv = s; NET.upnpMap(RELAY_PORT).catch(() => {}); relayState().then(st => res({ ok: true, ...st })); });
}));
const frUrl = u => { u = String(u || '').trim().replace(/\/+$/, ''); if (!u) return ''; if (!/^https?:\/\//i.test(u)) u = 'http://' + u; if (!/:\d+$/.test(u)) u += ':' + RELAY_PORT; return u; };
async function frFetch(base, method, p, body, token) {
  const r = await fetch(base + p, { method, headers: { 'Content-Type': 'application/json', 'x-token': token || '' }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(6000) });
  return { status: r.status, data: await r.json().catch(() => ({})) };
}
const frAcc = () => !!(srvCfg() && srvTok && currentUser); // Freunde & Chat laufen über den Konto-Server (kein Freundesserver nötig)
ipcMain.handle('frConn', () => { if (frAcc()) return { connected: true, account: true, url: 'Cloudy', name: currentUser }; const c = frConn(); return c ? { connected: true, url: c.url, name: c.name } : { connected: false, me: currentUser }; });
async function frResolve(url) { // Adresse ODER Freundescode -> Basis-URL
  const code = NET.decodeCode(String(url || '').trim()); if (!code || !/^\s*cld/i.test(String(url))) return frUrl(url);
  for (const h of [...code.hosts].reverse()) { try { const r = await frFetch(`http://${h}:${code.port}`, 'GET', '/ping'); if (r.data && r.data.cloudy) return `http://${h}:${code.port}`; } catch {} }
  return '';
}
ipcMain.handle('frJoin', async (_e, { hosts = [], port }) => { for (const h of [...hosts].reverse()) if (/^[\d.]+$/.test(h) && await NET.tcpCheck(h, port)) return { ok: true, host: h, port }; return { ok: false, error: 'Der Server ist von hier nicht erreichbar (der Gastgeber braucht eine Port-Freigabe).' }; });
ipcMain.handle('frConnect', async (_e, { url, name, pass, mode }) => {
  const base = await frResolve(url); if (!base) return { ok: false, error: String(url || '').trim() ? 'Der Freundesserver ist nicht erreichbar. Prüfe Code und Port.' : 'Trage den Freundescode oder die Adresse ein.' };
  try {
    const r = await frFetch(base, 'POST', mode === 'register' ? '/register' : '/login', { name, pass });
    if (r.status !== 200) return { ok: false, error: r.data.error || 'Anmeldung fehlgeschlagen.' };
    fs.writeFileSync(frFile, JSON.stringify({ url: base, token: r.data.token, name: r.data.name })); return { ok: true };
  } catch { return { ok: false, error: 'Der Freundesserver ist nicht erreichbar. Prüfe Adresse und Port.' }; }
});
ipcMain.handle('frDisconnect', () => { fs.rmSync(frFile, { force: true }); });
ipcMain.handle('frApi', async (_e, { method = 'GET', path: p, body }) => {
  if (frAcc()) {
    try {
      const u = new URL(p, 'http://x'), b = { ...(body || {}) }; u.searchParams.forEach((v, k) => { b[k] = v; });
      const r = await srvCall('/fr' + u.pathname, b, srvTok);
      if (r.status === 401 || r.status === 403) return { ok: false, error: r.error || 'Bitte neu anmelden.' };
      if (r.status === 404 && !r.error) return { ok: false, error: 'Der Konto-Server kennt Freunde noch nicht – bitte die neue app.js einspielen.' };
      const { status, ...data } = r; return { ok: status === 200, data, error: r.error };
    } catch { return { ok: false, offline: true, error: 'Konto-Server nicht erreichbar.' }; }
  }
  const c = frConn(); if (!c) return { ok: false, auth: true };
  try {
    const r = await frFetch(c.url, method, p, body, c.token);
    if (r.status === 401) { fs.rmSync(frFile, { force: true }); return { ok: false, auth: true }; }
    return { ok: r.status === 200, data: r.data, error: r.data.error };
  } catch { return { ok: false, offline: true, error: 'Freundesserver nicht erreichbar.' }; }
});
app.on('before-quit', () => { try { if (srvProc) srvProc.kill(); } catch {} try { if (relaySrv) relaySrv.close(); } catch {} });

// Java 19+ : Klassen-Archiv (CDS) beim ersten Beenden anlegen, danach startet Minecraft deutlich schneller
// Abgebrochene Downloads erkennen: eine .jar ohne ZIP-Ende ("zip END header not found") wird gelöscht und beim Start neu geladen
function purgeBrokenJars(dir, depth = 0) {
  let n = 0; if (depth > 12) return n;
  let es = []; try { es = fs.readdirSync(dir, { withFileTypes: true }); } catch { return n; }
  for (const e of es) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) { n += purgeBrokenJars(f, depth + 1); continue; }
    if (!/\.jar$/i.test(e.name)) continue;
    try {
      const sz = fs.statSync(f).size; let ok = sz >= 22;
      if (ok) { const len = Math.min(sz, 65557), b = Buffer.alloc(len), fd = fs.openSync(f, 'r'); try { fs.readSync(fd, b, 0, len, sz - len); } finally { fs.closeSync(fd); } ok = b.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06])) >= 0; }
      if (!ok) { fs.rmSync(f, { force: true }); n++; }
    } catch {}
  }
  return n;
}
const FAST_FLAGS = ['-XX:-UsePerfData', '-XX:+DisableAttachMechanism', '-Dlog4j2.disable.jmx=true', '-Djava.net.preferIPv4Stack=true']; // kleinere Startarbeit der JVM
function cdsFlags(version, safe) {
  try {
    if (safe) return [];
    if (javaMajorNow < 19) return FAST_FLAGS;
    const d = path.join(app.getPath('userData'), 'cds'); fs.mkdirSync(d, { recursive: true });
    return [...FAST_FLAGS, '-Xlog:cds=off', '-Xlog:cds+dynamic=off', '-XX:+AutoCreateSharedArchive', '-XX:SharedArchiveFile=' + path.join(d, `mc-${String(version).replace(/[^\w.~-]/g, '_')}-j${javaMajorNow}.jsa`)];
  } catch { return []; }
}

// ---- Spotify-App: Titel lesen und steuern (der volle Song läuft in der Spotify-App, Cloudy zeigt und steuert ihn) ----
const { execFile } = require('child_process');
const mediaNowLocal = () => new Promise(res => {
  const none = { running: false, playing: false };
  try {
    if (IS_WIN) {
      execFile('tasklist', ['/v', '/fi', 'imagename eq Spotify.exe', '/fo', 'csv', '/nh'], { windowsHide: true, timeout: 4000 }, (e, out) => {
        if (e) return res(none);
        const rows = String(out).split(/\r?\n/).filter(l => l.startsWith('"')); if (!rows.length) return res(none);
        let title = '';
        for (const l of rows) { const c = l.slice(1, -1).split('","'), t = c[c.length - 1]; if (t && / - /.test(t) && !/^Spotify/i.test(t)) title = t; }
        if (!title) return res({ running: true, playing: false });
        const i = title.indexOf(' - '); res({ running: true, playing: true, artist: title.slice(0, i), title: title.slice(i + 3) });
      });
    } else if (IS_MAC) {
      const sc = 'if application "Spotify" is running then\ntell application "Spotify"\nif player state is playing then\nset art to ""\ntry\nset art to artwork url of current track\nend try\nreturn (name of current track) & "|" & (artist of current track) & "|" & art & "|" & (player position as text)\nend if\nreturn "paused"\nend tell\nend if\nreturn "off"';
      execFile('osascript', ['-e', sc], { timeout: 4000 }, (e, out) => {
        if (e) return res(none); const t = String(out).trim();
        if (t === 'off') return res(none); if (t === 'paused') return res({ running: true, playing: false });
        const [title, artist, art, pos] = t.split('|'), pm = Math.round(parseFloat(String(pos || '').replace(',', '.')) * 1000); res({ running: true, playing: true, title, artist, art: /^https:/.test(art || '') ? art : null, posMs: Number.isFinite(pm) ? pm : undefined });
      });
    } else res(none);
  } catch { res(none); }
});

// ---- Spotify-Anmeldung (PKCE, kein Geheimnis nötig): liest den laufenden Song samt genauer Position direkt von Spotify – für Lyrics ----
const spFile = path.join(app.getPath('userData'), 'spotify.json'), SP_REDIRECT = 'http://127.0.0.1:8898/callback';
const spLoad = () => { try { return JSON.parse(fs.readFileSync(spFile, 'utf8')); } catch { return {}; } };
const spSave = o => { try { fs.writeFileSync(spFile, JSON.stringify(o)); } catch {} };
let spCache = { t: 0, v: null }, spSrv = null, spLast = { ok: null, msg: '' };
async function spToken() {
  const j = spLoad(); if (!j.refresh || !j.clientId) return null;
  if (j.access && Date.now() < (j.exp || 0) - 30000) return j.access;
  const r = await fetch('https://accounts.spotify.com/api/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: j.refresh, client_id: j.clientId }) });
  if (!r.ok) { if (r.status === 400 || r.status === 401) spSave({ clientId: j.clientId }); return null; }
  const d = await r.json(); spSave({ ...j, access: d.access_token, exp: Date.now() + d.expires_in * 1000, refresh: d.refresh_token || j.refresh }); return d.access_token;
}
async function spotifyNow() {
  if (Date.now() - spCache.t < 1200) return spCache.v;
  let tok; try { tok = await spToken(); } catch (e) { spLast = { ok: false, msg: 'Token-Fehler: ' + (e && e.message || e) }; return null; }
  if (!tok) return null;
  const t0 = Date.now(); let r;
  try { r = await fetch('https://api.spotify.com/v1/me/player/currently-playing?additional_types=track,episode', { headers: { Authorization: 'Bearer ' + tok } }); }
  catch (e) { spLast = { ok: false, msg: 'Keine Verbindung zu Spotify.' }; return null; }
  let v;
  if (r.status === 204) { v = { running: true, playing: false }; spLast = { ok: true, msg: 'Verbunden, aber gerade läuft nichts (Spotify öffnen und einen Song starten).' }; }
  else if (r.status === 401) { const j = spLoad(); spSave({ ...j, access: '', exp: 0 }); spLast = { ok: false, msg: 'Anmeldung abgelaufen – bitte erneut anmelden.' }; v = null; }
  else if (r.status === 403) { spLast = { ok: false, msg: 'Spotify lehnt ab (403): Im Spotify-Dashboard bei deiner App unter „User Management“ deinen Namen und die E-Mail deines Spotify-Kontos eintragen, danach „Erneut anmelden“.' }; v = null; }
  else if (r.status === 429) { spLast = { ok: false, msg: 'Spotify bremst gerade (zu viele Anfragen) – das legt sich nach kurzer Zeit.' }; spCache = { t: Date.now() + 8000, v: spCache.v }; return spCache.v; }
  else if (!r.ok) { spLast = { ok: false, msg: 'Spotify-Fehler ' + r.status }; v = null; }
  else {
    let d = {}; try { d = await r.json(); } catch {}
    const it = d.item;
    if (it && it.name) { v = { running: true, playing: !!d.is_playing, title: it.name, artist: (it.artists || []).map(a => a.name).join(', ') || (it.show && it.show.name) || '', art: it.album && it.album.images && it.album.images[0] ? it.album.images[0].url : null, posMs: Math.round((d.progress_ms || 0) + (d.is_playing ? (Date.now() - t0) / 2 : 0)), at: Date.now(), durMs: it.duration_ms }; spLast = { ok: true, msg: 'Läuft: ' + v.artist + ' – ' + v.title + (d.is_playing ? '' : ' (pausiert)') }; }
    else { v = { running: true, playing: false }; spLast = { ok: true, msg: 'Verbunden, aber kein Song erkannt (Werbung oder lokale Datei?).' }; }
  }
  spCache = { t: Date.now(), v }; return v;
}
const mediaNowP = async () => { try { const v = await spotifyNow(); if (v) return v; } catch {} return mediaNowLocal(); };
ipcMain.handle('spotifyState', () => { const j = spLoad(); return { connected: !!j.refresh, clientId: j.clientId || '', redirect: SP_REDIRECT, last: spLast }; });
ipcMain.handle('spotifyTest', async () => { spCache = { t: 0, v: null }; try { await spotifyNow(); } catch (e) { spLast = { ok: false, msg: String(e && e.message || e) }; } return spLast; });
ipcMain.handle('spotifyDisconnect', () => { const j = spLoad(); spSave({ clientId: j.clientId || '' }); spCache = { t: 0, v: null }; return true; });
ipcMain.handle('spotifyConnect', async (_e, clientId) => {
  clientId = String(clientId || '').trim(); if (!/^[a-f0-9]{32}$/i.test(clientId)) return { ok: false, error: 'Bitte die Client ID (32 Zeichen) aus deiner Spotify-App eintragen.' };
  try { if (spSrv) { spSrv.close(); spSrv = null; } } catch {}
  const verifier = crypto.randomBytes(48).toString('base64url'), challenge = crypto.createHash('sha256').update(verifier).digest('base64url'), state = crypto.randomBytes(8).toString('hex');
  return new Promise(resolve => {
    let done = false; const finish = r => { if (done) return; done = true; try { srv.close(); } catch {} spSrv = null; resolve(r); };
    const srv = require('http').createServer(async (req, res) => {
      const u = new URL(req.url, 'http://127.0.0.1:8898'); if (u.pathname !== '/callback') { res.writeHead(404); return res.end(); }
      const code = u.searchParams.get('code'), ok = code && u.searchParams.get('state') === state;
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(`<body style="font-family:system-ui;background:#0b1226;color:#fff;display:grid;place-items:center;height:100vh;margin:0"><div style="text-align:center"><h2>${ok ? 'Cloudy ist mit Spotify verbunden ✓' : 'Anmeldung abgebrochen'}</h2><p>Du kannst dieses Fenster schließen.</p></div></body>`);
      if (!ok) return finish({ ok: false, error: u.searchParams.get('error') === 'access_denied' ? 'Du hast die Anmeldung bei Spotify abgelehnt.' : 'Anmeldung abgebrochen oder ungültig (' + (u.searchParams.get('error') || 'kein Code') + ').' });
      try {
        const r = await fetch('https://accounts.spotify.com/api/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: SP_REDIRECT, client_id: clientId, code_verifier: verifier }) });
        const d = await r.json(); if (!r.ok) throw new Error(d.error_description || d.error || r.status);
        spSave({ clientId, refresh: d.refresh_token, access: d.access_token, exp: Date.now() + d.expires_in * 1000 }); spCache = { t: 0, v: null }; finish({ ok: true });
      } catch (e) { finish({ ok: false, error: 'Spotify hat die Anmeldung abgelehnt: ' + String((e && e.message) || e) }); }
    });
    spSrv = srv; srv.on('error', () => finish({ ok: false, error: 'Port 8898 ist belegt – bitte Cloudy neu starten und erneut versuchen.' }));
    srv.listen(8898, '127.0.0.1', () => {
      shell.openExternal('https://accounts.spotify.com/authorize?' + new URLSearchParams({ client_id: clientId, response_type: 'code', redirect_uri: SP_REDIRECT, code_challenge_method: 'S256', code_challenge: challenge, state, scope: 'user-read-currently-playing user-read-playback-state user-modify-playback-state' }));
      setTimeout(() => finish({ ok: false, error: 'Zeit abgelaufen – bitte erneut versuchen.' }), 180000);
    });
  });
});
ipcMain.handle('mediaNow', mediaNowP);

// ---- Lyrics: aktueller Spotify-Song -> Textzeilen mit Zeitstempeln (LRCLIB) -> Datei, die die Client-Mod im Spiel anzeigt ----
const lyricsFile = path.join(app.getPath('userData'), 'cloudy-lyrics.json');
let lyr = { key: '', lines: [], start: 0, pausedAt: 0, miss: 0 }, lyBusy = false;
const lyCache = new Map();
const lrcParse = txt => {
  const out = [];
  for (const l of String(txt || '').split(/\r?\n/)) {
    const m = l.match(/^((?:\[\d+:\d+(?:[.:]\d+)?\])+)\s*(.*)$/); if (!m) continue;
    for (const q of m[1].matchAll(/\[(\d+):(\d+)(?:[.:](\d+))?\]/g)) out.push([(+q[1] * 60 + +q[2]) * 1000 + (q[3] ? Math.round(+('0.' + q[3]) * 1000) : 0), m[2].replace(/[\u2018\u2019\u02bc`\u00b4]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/[\u00a0\u2000-\u200a\u202f\u3000]/g, ' ').replace(/[\u200b-\u200d\ufeff]/g, '').replace(/\s+/g, ' ').trim()]);
  }
  return out.sort((a, b) => a[0] - b[0]);
};
const LYH = { headers: { 'User-Agent': 'Cloudy-Launcher/1.0 (https://github.com)', 'Accept': 'application/json' } };
let mrCache = { t: 0, ok: true };
async function modrinthUp() { // kurzer Vorab-Test: ist Modrinth erreichbar? (sonst warten Mod-Installationen minutenlang)
  if (Date.now() - mrCache.t < 60000) return mrCache.ok;
  let ok = false;
  for (const f of [net && app.isReady() ? (x, y) => net.fetch(x, y) : null, (x, y) => fetch(x, y)]) { if (!f || ok) continue; const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 6000); try { const r = await f('https://api.modrinth.com/v2/', { ...HDR, signal: ctl.signal }); ok = r.status < 500; } catch {} finally { clearTimeout(t); } }
  if (!ok) { try { const r = await dohFetch('https://api.modrinth.com/v2/', HDR); ok = r.status < 500; } catch {} }
  mrCache = { t: Date.now(), ok }; return ok;
}
async function lyJSON(u, extra) { // erst Chromium (Systemproxy), dann Node – egal was bei einem PC klemmt
  let last; for (const f of [net && app.isReady() ? (x, y) => net.fetch(x, y) : null, (x, y) => fetch(x, y)]) { if (!f) continue; const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 12000); try { const r = await f(u, { headers: { ...LYH.headers, ...(extra || {}) }, signal: ctl.signal }); if (r.status === 404) return null; if (r.ok) return await r.json(); last = new Error('HTTP ' + r.status); } catch (e) { last = e; } finally { clearTimeout(t); } }
  lyErr = String((last && (last.cause && last.cause.code || last.message)) || 'network').slice(0, 40); throw last || new Error('lyrics');
}
const lyClean = (artist, title) => {
  const clean = t => String(t).replace(/\s*[-–]\s*(remaster(ed)?|live|radio edit|single version|mono|stereo|from .*|\d{4}.*)$/i, '').replace(/\s*[(\[](feat\.?|ft\.?|with|remaster|live|from).*?[)\]]/ig, '').trim();
  return { title: clean(title) || String(title), artist: String(artist).split(/[,&]/)[0].trim() || String(artist) };
};
function lySources(artist0, title0) { // alle Quellen nacheinander: jede liefert [[ms, text], …] oder null
  const { artist, title } = lyClean(artist0, title0), e = encodeURIComponent;
  const pick = d => {
    if (!d) return null;
    if (d.syncedLyrics) return lrcParse(d.syncedLyrics);
    if (d.plainLyrics) { const ls = d.plainLyrics.split(/\r?\n/).filter(x => x.trim()), dur = (d.duration || ls.length * 4) * 1000; return ls.map((x, i) => [Math.round(i * dur / ls.length), x.trim()]); }
    return null;
  };
  const best = l => { l = l || []; for (const d of l.slice(0, 5)) { const r = pick(d); if (r && r.length && d.syncedLyrics) return r; } for (const d of l.slice(0, 5)) { const r = pick(d); if (r && r.length) return r; } return null; };
  const NH = { Referer: 'https://music.163.com/', Cookie: 'appver=2.0.2' };
  return [
    ['lrclib (genau)', async () => pick(await lyJSON(`https://lrclib.net/api/get?artist_name=${e(artist)}&track_name=${e(title)}`))],
    ['lrclib (Suche)', async () => best((await lyJSON(`https://lrclib.net/api/search?q=${e(artist + ' ' + title)}`)) || (await lyJSON(`https://lrclib.net/api/search?track_name=${e(title)}&artist_name=${e(artist)}`)))],
    ['NetEase', async () => {
      const sr = await lyJSON(`https://music.163.com/api/search/get?s=${e(artist + ' ' + title)}&type=1&limit=5`, NH), songs = sr && sr.result && sr.result.songs || [];
      const nz = x => String(x || '').toLowerCase().replace(/\(.*?\)|\[.*?\]|- .*$/g, '').replace(/[^a-z0-9\u00c0-\uffff]/g, ''), cjk = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/, latin = !cjk.test(title + artist), nt = nz(title), na = nz(artist.split(/[,&]/)[0]), allA = String(artist0).split(/[,&]|\bfeat\.?\b/i).map(nz).filter(Boolean);
      for (const sg of songs.filter(sg => { const n = nz(sg.name), ar = (sg.artists || []).map(a => nz(a.name)).join('|'); const dok = !lyr.dur || !sg.duration || Math.abs(sg.duration - lyr.dur) < 8000; return dok && nt && n && (n === nt || n.includes(nt) || nt.includes(n)) && (!na || allA.some(q => ar.includes(q) || q.includes(ar.split('|')[0] || '\0'))); }).slice(0, 3)) { const ly = await lyJSON(`https://music.163.com/api/song/lyric?id=${sg.id}&lv=1&kv=1&tv=-1`, NH), r = ly && ly.lrc && ly.lrc.lyric ? lrcParse(ly.lrc.lyric) : null; const rr = r && latin ? r.filter(x => !cjk.test(x[1])) : r; if (rr && rr.length > 3 && (!latin || rr.length >= r.length * 0.8)) return rr; }
      return null;
    }],
    ['Kugou', async () => {
      const KH = { Referer: 'https://www.kugou.com/' }, sr = await lyJSON(`https://mobileservice.kugou.com/api/v3/search/song?format=json&keyword=${e(artist + ' ' + title)}&page=1&pagesize=6`, KH), list = sr && sr.data && sr.data.info || [];
      const nz = x => String(x || '').toLowerCase().replace(/\(.*?\)|\[.*?\]|- .*$/g, '').replace(/[^a-z0-9\u00c0-\uffff]/g, ''), nt = nz(title);
      for (const it of list.filter(it => { const n = nz(it.songname || it.filename); return nt && (n.includes(nt) || nt.includes(n.split('-').pop() || '\0')) && (!lyr.dur || !it.duration || Math.abs(it.duration * 1000 - lyr.dur) < 8000); }).slice(0, 3)) {
        const ls = await lyJSON(`https://lyrics.kugou.com/search?ver=1&man=yes&client=pc&keyword=${e(artist + ' - ' + title)}&duration=${(it.duration || 0) * 1000}&hash=${it.hash}`, KH), c0 = ls && ls.candidates && ls.candidates[0]; if (!c0) continue;
        const dl = await lyJSON(`https://lyrics.kugou.com/download?ver=1&client=pc&id=${c0.id}&accesskey=${c0.accesskey}&fmt=lrc&charset=utf8`, KH); if (!dl || !dl.content) continue;
        const r = lrcParse(Buffer.from(dl.content, 'base64').toString('utf8').replace(/^\ufeff/, '')); if (r.length > 3) return r;
      }
      return null;
    }],
    ['lyrics.ovh', async () => { const o = await lyJSON(`https://api.lyrics.ovh/v1/${e(artist)}/${e(title)}`); const ls = o && o.lyrics ? String(o.lyrics).split(/\r?\n/).map(x => x.trim()).filter(Boolean) : []; if (ls.length <= 3) return null; const dur = lyr.dur || ls.length * 4000, a0 = Math.min(14000, dur * 0.06), a1 = dur - Math.min(10000, dur * 0.04), W = ls.map(x => Math.max(6, x.length)), tot = W.reduce((p, q) => p + q, 0); let c = 0; lyOvh = true; return ls.map((x, i) => { const t = Math.round(a0 + (a1 - a0) * c / tot); c += W[i]; return [t, x]; }); }]
  ];
}
ipcMain.handle('lyricsTest', async () => { // testet alle Quellen mit dem Song, der gerade läuft (sonst mit einem Beispiel) und zeigt je Quelle Zeilen und Zeit
  let m = null; try { m = await mediaNowP(); } catch {}
  const have = !!(m && m.title), artist = have ? m.artist : 'Coldplay', title = have ? m.title : 'Yellow', out = [];
  for (const [nm, fn] of lySources(artist, title)) { const t = Date.now(); lyErr = ''; try { const r = await fn(); out.push(`${nm}: ${r && r.length ? r.length + ' Zeilen ✓' : '0 Zeilen'} (${Date.now() - t} ms)`); } catch (e) { out.push(`${nm}: Fehler ${lyErr || (e && (e.cause && e.cause.code || e.message)) || e}`); } }
  const det = have ? `${artist} – ${title}` + (m.playing ? '' : ' (pausiert)') : (m && m.running ? 'Spotify läuft, aber nichts spielt' : 'kein Song erkannt (läuft Spotify als App und spielt etwas?) – Test mit Coldplay – Yellow');
  return { song: det, lines: lyr.lines ? lyr.lines.length : 0, tries: lyr.tries || 0, res: out };
});
async function lyricsFetch(artist, title) {
  for (const [, fn] of lySources(artist, title)) { try { const r = await fn(); if (r && r.length) return r; } catch {} }
  return [];
}
let lyOvh = false, lyErr = '';
const { censor: censorTxt } = require('./lib/censor');
const censorFile = path.join(app.getPath('userData'), 'censor.json');
let censorOn = (() => { try { return JSON.parse(fs.readFileSync(censorFile, 'utf8')).on !== false; } catch { return true; } })();
ipcMain.handle('censorSet', (_e, on) => { censorOn = !!on; try { fs.writeFileSync(censorFile, JSON.stringify({ on: censorOn })); } catch {} lyricsLast = null; return censorOn; });
ipcMain.handle('censorGet', () => censorOn);
ipcMain.on('censorText', (e, t) => { e.returnValue = censorOn ? censorTxt(t) : String(t == null ? '' : t); });
let lyricsLast = null;
function lyricsWrite(o) { try { if (censorOn && o.lines && o.lines.length) o = { ...o, lines: o.lines.map(l => [l[0], censorTxt(l[1])]) }; fs.writeFileSync(lyricsFile, JSON.stringify({ ts: Date.now(), ...o })); } catch {} }
const lyricsCoverFile = path.join(app.getPath('userData'), 'cloudy-cover.png');
async function lyricsCover(url, key) { // Albumcover als kleines PNG fuer die Karte im Spiel
  try {
    const r = await fetch(url); if (!r.ok) return;
    const img = nativeImage.createFromBuffer(Buffer.from(await r.arrayBuffer())); if (img.isEmpty()) return;
    fs.writeFileSync(lyricsCoverFile, img.resize({ width: 64, height: 64, quality: 'good' }).toPNG());
    if (lyr.key === key) lyr.cover = String(Date.now());
  } catch {}
}
async function lyricsTick() {
  const m = await mediaNowP(), now = Date.now();
  if (!m.running) { if (++lyr.miss >= 4) lyricsWrite({ title: '', artist: '', lines: [], playing: false, posMs: 0 }); return; }
  lyr.miss = 0; lyr.dur = m.durMs || lyr.dur || 0;
  if (m.title) {
    const key = m.artist + '|' + m.title;
    if (key !== lyr.key) { lyr = { key, lines: lyCache.get(key) || [], start: now - 1500, pausedAt: 0, miss: 0, cover: '', tries: 0, next: 0, busy: false }; if (m.art) lyricsCover(m.art, key); }
    if (!lyr.lines.length && !lyr.busy && lyr.tries < 8 && now >= lyr.next) { // nichts gefunden oder Netzwerk-Fehler: später erneut versuchen (nicht nur einmal pro Lied)
      const k = key; lyr.busy = true; lyr.tries++; lyr.next = now + 8000 * lyr.tries;
      lyricsFetch(m.artist, m.title).then(l => { lyr.err = lyErr; lyErr = ''; if (l.length) { lyCache.set(k, l); if (lyCache.size > 40) lyCache.delete(lyCache.keys().next().value); } if (lyr.key === k) { lyr.lines = l; lyr.busy = false; } }).catch(() => { if (lyr.key === k) lyr.busy = false; });
    }
  }
  if (!m.playing) { if (!lyr.pausedAt) lyr.pausedAt = now; } else if (lyr.pausedAt) { lyr.start += now - lyr.pausedAt; lyr.pausedAt = 0; }
  const pos = m.posMs != null ? m.posMs : Math.max(0, (lyr.pausedAt || now) - lyr.start);
  const sep = lyr.key.indexOf('|'), artist = lyr.key.slice(0, sep < 0 ? 0 : sep), title = lyr.key.slice(sep + 1);
  lyricsWrite({ ts: m.at || now, title: title || '', artist: artist || '', lines: lyr.lines, status: lyr.lines.length ? '' : (lyr.busy || lyr.tries === 0 ? 'searching lyrics ...' : lyr.tries >= 8 ? 'no lyrics found' : 'not found yet, retrying ...') + (lyr.err ? ' (' + lyr.err + ')' : ''), playing: !!m.playing, posMs: pos, exact: m.posMs != null, dur: m.durMs || 0, cover: lyr.cover || '' });
}
setInterval(() => { if (!mcProc || lyBusy) return; lyBusy = true; lyricsTick().catch(() => {}).finally(() => { lyBusy = false; }); }, 1500);
const mediaKeyRun = k => new Promise(res => {
  const code = { playpause: 0xB3, next: 0xB0, prev: 0xB1, volup: 0xAF, voldown: 0xAE }[k]; if (!code) return res(false);
  try {
    if (IS_WIN) res(false); // bewusst keine Tastendruck-Simulation per PowerShell (loest Virenscanner aus); Steuerung laeuft ueber die Spotify-Anmeldung
    else if (IS_MAC) execFile('osascript', ['-e', `tell application "Spotify" to ${k === 'playpause' ? 'playpause' : k === 'next' ? 'next track' : k === 'prev' ? 'previous track' : k === 'volup' ? 'set sound volume to (sound volume + 10)' : 'set sound volume to (sound volume - 10)'}`], { timeout: 4000 }, err => res(!err));
    else res(false);
  } catch { res(false); }
});
ipcMain.handle('mediaKey', async (_e, k) => { // erst Spotify direkt (Premium + Anmeldung, sofort und zuverlässig), sonst Medientasten
  try {
    const a = { playpause: null, next: ['POST', 'next'], prev: ['POST', 'previous'] }[k];
    if (a !== undefined) {
      const tok = await spToken();
      if (tok) {
        const pl = !!(spCache.v && spCache.v.playing), x = a || ['PUT', pl ? 'pause' : 'play'];
        const r = await fetch('https://api.spotify.com/v1/me/player/' + x[1], { method: x[0], headers: { Authorization: 'Bearer ' + tok, 'Content-Length': '0' } });
        if (r.ok) { spCache = { t: 0, v: null }; return true; }
      }
    }
  } catch {}
  return mediaKeyRun(k);
});

// ---- Chat-Befehle im Spiel (/pause /resume /skip /prev): der Client schreibt sie in eine Datei, hier werden sie ausgeführt ----
const cmdFile = path.join(app.getPath('userData'), 'cloudy-cmd.txt'); let cmdSeen = 0;
async function spotifyControl(cmd) {
  const map = { pause: ['PUT', 'pause'], resume: ['PUT', 'play'], skip: ['POST', 'next'], prev: ['POST', 'previous'] }, a = map[cmd]; if (!a) return;
  try { // 1. Spotify-Anmeldung (braucht Spotify Premium und die Berechtigung "Wiedergabe steuern": einmal neu anmelden)
    const tok = await spToken();
    if (tok) { const r = await fetch('https://api.spotify.com/v1/me/player/' + a[1], { method: a[0], headers: { Authorization: 'Bearer ' + tok, 'Content-Length': '0' } }); if (r.ok) { spCache = { t: 0, v: null }; return; } }
  } catch {}
  // 2. Medientasten (funktionieren mit der Spotify-App ohne Anmeldung)
  const playing = !!lyr.key && !lyr.pausedAt;
  if (cmd === 'skip') await mediaKeyRun('next'); else if (cmd === 'prev') await mediaKeyRun('prev');
  else if (cmd === 'pause' && playing) await mediaKeyRun('playpause'); else if (cmd === 'resume' && !playing) await mediaKeyRun('playpause');
}
setInterval(() => {
  if (!mcProc) return;
  try { const st = fs.statSync(cmdFile); if (st.mtimeMs <= cmdSeen) return; cmdSeen = st.mtimeMs; const [cmd, ts] = fs.readFileSync(cmdFile, 'utf8').trim().split('|'); if (Date.now() - (+ts || 0) > 8000) return; spotifyControl(cmd).catch(() => {}); } catch {}
}, 350);

// ---- Debug-Menü (nur Admin; die Prüfung läuft hier im Hauptprozess) ----
let dbgStat = { t: 0 };
function dirStat(d, depth = 0) { let n = 0, b = 0; if (depth > 12) return { n, b }; try { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) { const r = dirStat(f, depth + 1); n += r.n; b += r.b; } else { n++; try { b += fs.statSync(f).size; } catch {} } } } catch {} return { n, b }; }
ipcMain.handle('debugInfo', () => {
  if (!adminOnly()) return null;
  let inst = []; try { inst = fs.readdirSync(path.join(root, 'instances')); } catch {}
  const mem = process.memoryUsage();
  return { app: app.getVersion(), electron: process.versions.electron, chrome: process.versions.chrome, node: process.versions.node, platform: process.platform + ' ' + process.arch,
    userData: app.getPath('userData'), root, user: currentUser, java: javaMajorNow || '–', instances: inst, fast: Object.keys(fastLoad()).length,
    libs: (() => { if (Date.now() - dbgStat.t > 30000) dbgStat = { t: Date.now(), lib: dirStat(path.join(root, 'libraries')), ver: dirStat(path.join(root, 'versions')), inst: dirStat(path.join(root, 'instances')) }; return `${dbgStat.lib.n} Dateien, ${(dbgStat.lib.b / 1048576).toFixed(0)} MB`; })(), versionsDir: `${dbgStat.ver.n} Dateien, ${(dbgStat.ver.b / 1048576).toFixed(0)} MB`, instSize: `${dbgStat.inst.n} Dateien, ${(dbgStat.inst.b / 1048576).toFixed(0)} MB`, names: Object.keys(shopNames()).length, buildCooldown: global.cloudyBuildFail && Date.now() - global.cloudyBuildFail < 600000 ? Math.ceil((600000 - (Date.now() - global.cloudyBuildFail)) / 60000) + ' min' : '–', freeGB: (() => { try { const x = fs.statfsSync(root); return (x.bavail * x.bsize / 1073741824).toFixed(1); } catch { return '–'; } })(), rssMB: Math.round(mem.rss / 1048576), heapMB: Math.round(mem.heapUsed / 1048576), uptimeMin: Math.round(process.uptime() / 60), mc: !!mcProc, server: !!srvProc, tail: lastTail.slice(-40).join('\n') };
});
ipcMain.handle('debugAction', async (_e, name) => {
  if (!adminOnly()) return false;
  if (name === 'openData') { shell.openPath(app.getPath('userData')); return true; }
  if (name === 'openRoot') { shell.openPath(root); return true; }
  if (name === 'devtools') { if (win && !win.isDestroyed()) win.webContents.openDevTools({ mode: 'detach' }); return true; }
  if (name === 'reload') { reloadUi(); return true; }
  if (name === 'openInstances') { shell.openPath(path.join(root, 'instances')); return true; }
  if (name === 'killMc') { try { if (mcProc) { mcProc.kill(); return 'beendet'; } } catch {} return 'läuft nicht'; }
  if (name === 'killServer') { try { if (srvProc) { srvProc.kill(); return 'beendet'; } } catch {} return 'läuft nicht'; }
  if (name === 'repairLibs') { const n = purgeBrokenJars(path.join(root, 'libraries')) + purgeBrokenJars(path.join(root, 'versions')); dbgStat.t = 0; return n ? n + ' defekte gelöscht' : 'alles ok'; }
  if (name === 'resetBuild') { global.cloudyBuildFail = 0; return 'Sperre aufgehoben'; }
  if (name === 'resetNames') { try { fs.rmSync(namesFile, { force: true }); } catch {} return 'zurückgesetzt'; }
  if (name === 'clearLog') { lastTail = []; return 'geleert'; }
  if (name === 'openUpdate') { shell.openPath(path.dirname(app.getAppPath())); return true; }
  if (name === 'clearCache') { fastData = {}; try { fs.rmSync(fastFile, { force: true }); fs.rmSync(path.join(app.getPath('userData'), 'cds'), { recursive: true, force: true }); } catch {} return true; }
  return false;
});

ipcMain.handle('bannerPick', async () => { // Animiertes Banner: GIF, WebP, MP4 oder WebM (wird in den Datenordner kopiert)
  const r = await dialog.showOpenDialog(win, { title: 'Animiertes Banner wählen', filters: [{ name: 'GIF / Video', extensions: ['gif', 'webp', 'apng', 'mp4', 'webm'] }], properties: ['openFile'] });
  if (r.canceled || !r.filePaths[0]) return { ok: false, cancel: true };
  const src = r.filePaths[0], ext = path.extname(src).toLowerCase().slice(1);
  try {
    if (fs.statSync(src).size > 60 * 1048576) return { ok: false, error: 'Datei ist größer als 60 MB.' };
    const dir = path.join(app.getPath('userData'), 'banner'); fs.mkdirSync(dir, { recursive: true });
    for (const f of fs.readdirSync(dir)) try { fs.rmSync(path.join(dir, f)); } catch {}
    const dst = path.join(dir, 'banner-' + Date.now() + '.' + ext); fs.copyFileSync(src, dst);
    return { ok: true, url: require('url').pathToFileURL(dst).href, kind: /^(mp4|webm)$/.test(ext) ? 'video' : 'image' };
  } catch { return { ok: false, error: 'Datei konnte nicht gespeichert werden.' }; }
});

// ---- Start ----
let launchCancelled = false, lastTail = [];
ipcMain.handle('launchCancel', () => { launchCancelled = true; try { if (mcProc) mcProc.kill(); } catch {} return true; });
const modernQP = v => { const m = /^1\.(\d+)/.exec(String(v)); return (m && +m[1] >= 20) || /^\d{2}\./.test(String(v)) || /^2\d/.test(String(v)); };
ipcMain.handle('launch', async (_e, { username, version, type, ram, server, fabric, perf, jvm, ww, wh, minimize, clientMods = [], cheats, syncOpts, preset, safe = 0, hud, gfx }) => {
  if (cfgPatch({}).gateOk !== true) throw new Error('Access code required.');
  if (!currentUser) return { ok: false, error: 'Bitte zuerst bei Cloudy anmelden.' };
  if (safe >= 1) { fabric = false; perf = false; clientMods = []; cheats = false; } // Sicherer Start: reines Vanilla, ohne Mods und ohne Client
  if (safe >= 2) { syncOpts = false; preset = ''; ram = Math.min(+ram || 4, 4); jvm = (jvm || '').split(/\s+/).filter(a => a && !/ZGC|Shenandoah|Parallel/.test(a)).concat('-XX:+UseG1GC').join(' '); }
  const cosEq = safe ? {} : equipNow(); // gekaufte Cosmetics, die im Spiel gezeigt werden sollen
  if (cosEq.cape && !clientMods.includes('cape')) clientMods = [...clientMods, 'cape'];
  const snd = safe ? { enabled: false } : sndWriteActive(); const sndOn = !!(snd.enabled && snd.ingame); // Creamkeys
  launchCancelled = false;
  const t0 = Date.now();
  const launcher = new Client();
  const tail = [];
  const log = m => { String(m).split('\n').forEach(l => l.trim() && tail.push(l)); if (tail.length > 80) tail.splice(0, tail.length - 80); };
  launcher.on('progress', p => send('progress', { task: p.task, total: p.total, type: p.type }));
  launcher.on('debug', log);
  launcher.on('data', log);
  launcher.on('close', code => {
    try { if (syncOpts !== false) optsSync.snapshot(gameDir(version), sharedDir); } catch {}
    if (win && !win.isDestroyed()) win.restore();
    let head = '';
    if (code) try {
      const d = path.join(gameDir(version), 'crash-reports'), f = fs.readdirSync(d).sort().pop();
      if (f) head = fs.readFileSync(path.join(d, f), 'utf8').split('\n').slice(0, 30).join('\n') + '\n\n--- Launcher-Log ---\n';
    } catch {}
    let hs = null; // Absturzbericht der Java-Laufzeit (hs_err_pid*.log): Problemstelle auslesen
    if (code) try {
      for (const dir of [gameDir(version), root]) {
        const f = fs.readdirSync(dir).filter(n => /^hs_err_pid.*\.log$/.test(n)).map(n => ({ n, m: fs.statSync(path.join(dir, n)).mtimeMs })).filter(x => x.m >= t0 - 5000).sort((a, b) => b.m - a.m)[0];
        if (!f) continue;
        const lines = fs.readFileSync(path.join(dir, f.n), 'utf8').split('\n'), i = lines.findIndex(l => /Problematic frame/.test(l));
        hs = { file: f.n, frame: i >= 0 ? lines.slice(i + 1, i + 2).join('').replace(/^#\s*/, '').trim() : '' };
        head = `--- ${f.n} ---\n` + lines.slice(0, 22).join('\n') + '\n\n' + head; break;
      }
    } catch {}
    if (!safe) syncCosFromGame();
    lastTail = tail.slice(-60);
    send('closed', { code, hs, safe, log: head + tail.slice(-30).join('\n') });
  });
  try {
    // Anmeldung läuft gleichzeitig mit Java- und Fabric-Prüfung (spart Wartezeit)
    let authP;
    if (readAcc()) {
      send('status', 'Melde bei Microsoft an …');
      authP = msAuth().catch(() => { throw new Error('Microsoft-Anmeldung abgelaufen. Melde dich in den Einstellungen neu an.'); });
    } else authP = Promise.resolve(Authenticator.getAuth(username || 'Cloudy'));
    authP.catch(() => {});
    send('status', 'Prüfe Java …');
    const javaPath = await ensureJava(bv(version));
    let custom;
    if (fabric) {
      try {
        send('status', 'Richte Fabric ein …');
        custom = await ensureFabric(version);
        fs.mkdirSync(modsDir(version), { recursive: true });
        const perfOk = /^1\.(1[7-9]|2[01])(\.|$)/.test(bv(version)); // Sodium & Co. nur für getestete Versionen (1.17–1.21); neue Versionen (z. B. 26.x) stürzen damit auf manchen PCs nativ ab
        if (!perfOk) { // schon installierte Leistungs-Mods für diese Version abschalten (Absturz 0xC0000005 vermeiden)
          try { for (const f of fs.readdirSync(modsDir(version))) if (f.endsWith('.jar') && /^(sodium|lithium|ferritecore|ferrite-core|entityculling|modernfix|iris|trender)/i.test(f)) fs.renameSync(path.join(modsDir(version), f), path.join(modsDir(version), f + '.disabled')); } catch {}
          if (perf) send('status', 'Neue Version: Leistungs-Mods werden zur Sicherheit übersprungen …');
        }
        const mrOk = (perf || clientMods.length > 0) ? await modrinthUp() : true;
        if (!mrOk) send('status', 'Modrinth ist nicht erreichbar – Mod-Downloads werden übersprungen, Minecraft startet trotzdem.');
        if (perf && mrOk) {
          const vk = gfx === 'vulkan' && perfOk;
          if (vk) { try { for (const f of fs.readdirSync(modsDir(version))) if (f.endsWith('.jar') && /^(sodium|immediatelyfast|iris)/i.test(f)) fs.renameSync(path.join(modsDir(version), f), path.join(modsDir(version), f + '.disabled')); } catch {} send('status', 'Vulkan-Modus (VulkanMod, experimentell) …'); }
          else { try { for (const f of fs.readdirSync(modsDir(version))) if (f.endsWith('.jar.disabled') && /^(sodium|immediatelyfast)/i.test(f)) fs.renameSync(path.join(modsDir(version), f), path.join(modsDir(version), f.slice(0, -9))); } catch {} try { for (const f of fs.readdirSync(modsDir(version))) if (f.endsWith('.jar') && /^vulkanmod/i.test(f)) fs.renameSync(path.join(modsDir(version), f), path.join(modsDir(version), f + '.disabled')); } catch {} }
          for (const m of (perfOk ? (vk ? PERF_VK : PERF) : ['fabric-api'])) { send('status', `Installiere ${m} …`); await installMod(m, version).catch(() => {}); }
        }
        const hudOn = !safe && hud && Object.values(hud).some(Boolean);
        const explicit = clientMods.length > 0 || (cheats && unlocked()) || Object.keys(cosEq).length > 0 || hudOn || sndOn;
        let clientStale = false; // Client-Mod automatisch bauen/aktualisieren wie die Leistungs-Mods (Jar fehlt oder ist veraltet)
        if (mcOk(bv(version)) && (explicit || perf) && !clientHasCosmetics(bv(version)) && isAdminNow() && mrOk && Date.now() - (global.cloudyBuildFail || 0) > 600000 && fs.existsSync(path.join(__dirname, 'client-src', 'build.gradle'))) {
          send('status', 'Cloudy Client wird aktualisiert … (beim ersten Mal einige Minuten)');
          const off = onClientBuild(t => send('status', t)); const r = await buildClient(bv(version)); off();
          if (!r.ok) { global.cloudyBuildFail = Date.now(); clientStale = !!clientJar(bv(version)); send('status', 'Cloudy Client konnte nicht gebaut werden' + (clientStale ? ' – die alte Version wird übersprungen.' : '.')); }
        }
        const wantClient = explicit || (perf && !!clientJar(bv(version)) && mcOk(bv(version))); // Cloudy Client (F7) gehört zu den Auto-Mods
        const dst = path.join(modsDir(version), 'cloudy-client.jar'), src = clientJar(bv(version));
        if (wantClient && !clientStale && mcOk(bv(version)) && src) {
          send('status', 'Installiere Cloudy Client …');
          if (mrOk) await installMod('fabric-api', version).catch(() => {});
          try { const a = fs.statSync(src), b = fs.existsSync(dst) && fs.statSync(dst); if (!b || b.size !== a.size) fs.copyFileSync(src, dst); } catch { fs.copyFileSync(src, dst); } // nur kopieren, wenn geändert: sonst wird das Start-Cache-Archiv (CDS) jedes Mal ungültig und der Start dauert
        } else {
          fs.rmSync(dst, { force: true });
          if (explicit) send('status', !src ? 'Cloudy Client fehlt (client/cloudy-client.jar) – starte ohne.' : `Cloudy Client gibt es ab 1.21.4 (in den Shop-Einstellungen für ${bv(version)} bauen) – starte ohne.`);
        }
      } catch (e) { custom = undefined; send('status', 'Kein Fabric für diese Version – starte Vanilla.'); }
    }
    fs.mkdirSync(gameDir(version), { recursive: true });
    if (safe >= 2) for (const f of ['options.txt', 'optionsshaders.txt']) try { const p = path.join(gameDir(version), f); if (fs.existsSync(p)) fs.renameSync(p, p + '.cloudy-backup'); } catch {} // Einstellungen zurücksetzen (Sicherung bleibt)
    if (syncOpts !== false) try { optsSync.apply(gameDir(version), sharedDir); } catch {}
    try { applyPreset(gameDir(version), preset); } catch {}
    try { syncShopPacks(gameDir(version), equipNow()); } catch {}
    if (minimize && win) win.minimize();
    if (launchCancelled) throw new Error('Start abgebrochen.');
    try { const n = purgeBrokenJars(path.join(root, 'libraries')) + purgeBrokenJars(path.join(root, 'versions')); if (n) send('status', `${n} beschädigte Bibliothek(en) werden neu geladen …`); } catch {}
    const auth = await authP;
    let newClasses = null; // 26.x: eigenen Classpath verwenden
    if (custom && !/^1\./.test(bv(version))) { try { send('status', 'Bibliotheken werden geprüft …'); const cp = await buildClasspath(custom, bv(version)); if (cp.some(f => /fabric-loader/.test(f))) newClasses = cp; } catch (e) { send('status', 'Eigener Classpath nicht möglich: ' + e.message); } }
    const proc = await launcher.launch({
      authorization: auth,
      root, javaPath,
      version: { number: bv(version), type, ...(custom ? { custom } : {}) },
      overrides: { gameDirectory: gameDir(version), ...(newClasses ? { classes: newClasses } : {}) },
      memory: { max: `${ram}G`, min: '1G' },
      customArgs: [...(IS_MAC ? ['-XstartOnFirstThread'] : []), ...cdsFlags(version, safe), ...(/UseZGC|UseG1GC|UseShenandoah|UseParallelGC|UseSerialGC|UseConcMarkSweep/.test(jvm || '') || safe ? [] : GC_FLAGS), ...(jvm ? jvm.split(/\s+/).filter(Boolean) : []),
        `-Dcloudy.mods=${clientMods.join(',')}`, ...(hasCape() ? [`-Dcloudy.cape=${capeFile}`] : []), ...(!safe && fs.existsSync(cosFile) ? [`-Dcloudy.cosmetics=${cosFile}`] : []), `-Dcloudy.cfg=${cfgFile}`, `-Dcloudy.lyrics=${lyricsFile}`, `-Dcloudy.cmd=${cmdFile}`, `-Dcloudy.ver=${CLIENT_BUILD}`, ...(hud && !safe ? [`-Dcloudy.hud=${Object.entries(hud).filter(([, v]) => v).map(([k]) => k).join(',')}`] : []), ...(sndOn ? [`-Dcloudy.sounds=${sndActive}`] : []), ...(cheats && unlocked() ? ['-Dcloudy.cheats=1'] : [])],
      ...(ww && wh ? { window: { width: +ww, height: +wh } } : {}),
      ...(server && !modernQP(bv(version)) ? { server: { host: server.host, port: String(server.port || 25565) } } : {}),
      ...(server && modernQP(bv(version)) ? { customLaunchArgs: ['--quickPlayMultiplayer', `${server.host === 'localhost' ? '127.0.0.1' : server.host}:${server.port || 25565}`] } : {})
    });
    if (!proc) throw new Error('Start fehlgeschlagen.');
    if (launchCancelled) { try { proc.kill(); } catch {} throw new Error('Start abgebrochen.'); }
    mcProc = proc; playSess = { who: currentUser, t: Date.now(), coinMs: 0, earned: 0 }; try { send('gameStart', {}); } catch {} proc.on('close', () => { playTick(true); if (mcProc === proc) mcProc = null; });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

app.whenReady().then(() => { if (!localUpdate.applyOnStart()) createWindow(); });
app.on('window-all-closed', () => app.quit());
app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
