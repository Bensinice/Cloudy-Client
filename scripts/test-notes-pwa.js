// Echter Browser-Test der Cloudy-Notes-Web-App (Chromium/Playwright) gegen einen Testserver mit dem echten Notizen-Kern (server/notes.js).
// Aufruf: NODE_PATH=$(npm root -g) node scripts/test-notes-pwa.js
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const { chromium } = require('playwright'); const N = require('../server/notes');
const SRC = path.join(__dirname, '..', 'server', 'site', 'notes'), ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'notes-pwa-'));
for (const f of fs.readdirSync(SRC)) fs.copyFileSync(path.join(SRC, f), path.join(ROOT, f));
let fails = 0, n = 0; const ok = (c, m) => { n++; console.log(c ? 'OK  ' : 'FAIL', m); if (!c) fails++; };
const routes = {}, app = { post: (p, f) => routes['POST ' + p] = f, get: (p, f) => routes['GET ' + p] = f };
const TOK = { tokA: 'anna', tokB: 'bert' }; let t0 = Date.now();
const auth = f => async (req, res) => { const k = TOK[(req.headers.authorization || '').replace('Bearer ', '')]; if (!k) return res.status(401).json({ error: 'Nicht angemeldet.' }); await f(req, res, { name_key: k }); };
const repo = N.memRepo(), h = N.create({ repo, getSecret: () => 'x'.repeat(40), now: () => Date.now() });
N.mount(app, auth, { list: h.list, save: h.save, del: h.del, history: h.history, restore: h.restore, exportAll: h.exportAll, info: h.info });
const hits = { list: 0, save: 0, info: 0 }; let MIN_API = null, listDelay = 0;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const srv = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x'); let body = ''; req.on('data', d => body += d);
  req.on('end', async () => {
    const send = (s, j, hd) => { res.writeHead(s, Object.assign({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, hd)); res.end(JSON.stringify(j)); };
    const R = { status(s) { this.s = s; return this; }, json(j) { send(this.s || 200, j); }, set() {} };
    if (req.method === 'POST' && u.pathname === '/login') { const b = JSON.parse(body || '{}'); const k = String(b.user).toLowerCase(); if (b.pass === 'pw' && (k === 'anna' || k === 'bert')) return send(200, { token: k === 'anna' ? 'tokA' : 'tokB', user: { name: k } }); return send(401, { error: 'Benutzername oder Passwort stimmt nicht.' }); }
    const rk = req.method + ' ' + u.pathname;
    if (routes[rk]) { if (rk === 'POST /notes/list') { hits.list++; if (listDelay) await new Promise(r => setTimeout(r, listDelay)); } if (rk === 'POST /notes/save') hits.save++; if (rk === 'GET /notes/info') { hits.info++; if (MIN_API) return send(200, { ok: true, server: '9', api: MIN_API, minClientApi: MIN_API }); } return routes[rk]({ headers: req.headers, body: body ? JSON.parse(body) : {} }, R); }
    let p = u.pathname.replace(/^\/notes\/?/, '') || 'index.html'; const f = path.join(ROOT, p);
    if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); return res.end('nf'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); res.end(fs.readFileSync(f));
  });
});
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function login(pg, user) { await pg.goto(BASE + '/notes/'); await pg.fill('#lu', user); await pg.fill('#lp', 'pw'); await pg.click('#lb'); await pg.waitForSelector('#ls', { timeout: 10000 }).catch(async e => { console.log('LOGIN-HANG', user, JSON.stringify((await pg.textContent('body')).slice(0, 200)), await pg.evaluate(() => localStorage.getItem('cn.auth'))); throw e; }); }
let BASE;
(async () => {
  await new Promise(r => srv.listen(0, '127.0.0.1', r)); BASE = 'http://127.0.0.1:' + srv.address().port;
  const br = await chromium.launch(); const errs = [];
  const ctxA = await br.newContext({ viewport: { width: 390, height: 800 } }), ctxB = await br.newContext({ viewport: { width: 390, height: 800 } });
  const A = await ctxA.newPage(), B = await ctxB.newPage(); for (const p of [A, B]) p.on('pageerror', e => errs.push(String(e)));
  // Versions-Konsistenz
  const v = f => (fs.readFileSync(path.join(SRC, f), 'utf8').match(/(?:VERSION|APP_VERSION) = '([\d.]+)'/) || [])[1], ix = fs.readFileSync(path.join(SRC, 'index.html'), 'utf8');
  ok(v('sw.js') && v('sw.js') === v('app.js') && ix.includes('app.js?v=' + v('app.js')) && ix.includes('app.css?v=' + v('app.js')), 'Version in sw.js, app.js und index.html gleich (' + v('app.js') + ')');
  const man = JSON.parse(fs.readFileSync(path.join(SRC, 'manifest.webmanifest'), 'utf8')); ok(man.display === 'standalone' && man.start_url === '/notes/' && man.icons.every(i => fs.existsSync(path.join(SRC, i.src))), 'Manifest gueltig, Icons vorhanden');
  // Anmeldung
  await A.goto(BASE + '/notes/'); await A.fill('#lu', 'anna'); await A.fill('#lp', 'falsch'); await A.click('#lb'); await A.waitForFunction(() => /stimmt nicht/.test(document.querySelector('#le').textContent));
  ok(true, 'falsches Passwort -> Fehlermeldung');
  await A.fill('#lp', 'pw'); await A.click('#lb'); await A.waitForSelector('#ls'); ok(true, 'Anmeldung mit Cloudy-Konto');
  // Notiz anlegen -> Autosave -> Server
  await A.click('#nw'); await A.fill('#tt', 'Einkauf'); await A.fill('#bd', 'Milch, Brot'); await sleep(1500);
  let sv = await h.list('anna', {}); ok(sv.json.notes.length === 1 && sv.json.notes[0].title === 'Einkauf' && sv.json.notes[0].body === 'Milch, Brot', 'Autosave: Notiz liegt unter dem Konto auf dem Server');
  // Zweites Geraet
  await login(B, 'anna'); await B.waitForSelector('.item'); ok(/Einkauf/.test(await B.textContent('#ls')), 'zweites Geraet sieht die Notiz');
  await login(B, 'anna').catch(() => {}); // erneut laden ist ok
  // Kein Neuzeichnen ohne Aenderung (Marker im DOM bleibt, Tippen wird nicht gestoert)
  await B.waitForSelector('.item'); await B.evaluate(() => { document.querySelector('#ls .item').setAttribute('data-mark', '1'); });
  const l0 = hits.list; await B.evaluate(async () => { for (let i = 0; i < 3; i++) await window.cloudyNotesApp.sync(false); }); ok(hits.list - l0 === 3 && await B.evaluate(() => !!document.querySelector('#ls .item[data-mark]')), 'Sync ohne Aenderung: Liste wird nicht neu gezeichnet');
  await B.click('#ls .item'); await B.click('#bd'); await B.keyboard.type('XY'); const tmark = await B.evaluate(() => { const t = document.querySelector('#bd'); t.setAttribute('data-mark', '1'); return t.value; });
  await A.fill('#bd', 'Milch, Brot, Eier'); await sleep(1200); await B.evaluate(async () => { await window.cloudyNotesApp.sync(false); }); 
  ok(await B.evaluate(v => document.querySelector('#bd[data-mark]') && document.querySelector('#bd').value === v, tmark), 'Fremde Aenderung ueberschreibt nicht, was ich gerade tippe');
  // Konflikt: B hat XY ungespeichert/gespeichert mit alter Basis -> Konfliktkopie
  await sleep(1500); const all = (await h.list('anna', {})).json.notes.filter(x => !x.deleted); ok(all.length === 2 && all.some(x => /Konflikt-Kopie/.test(x.title)) , 'gleichzeitige Aenderung: Konflikt-Kopie statt Datenverlust (' + all.map(x => x.title).join(' | ') + ')');
  // Anderes Konto
  const C = await (await br.newContext()).newPage(); C.on('pageerror', e => errs.push('C:' + e)); await login(C, 'bert').catch(async e => { console.log('C-Seite:', (await C.textContent('body')).slice(0, 200), errs); throw e; }); await C.waitForFunction(() => /Noch keine Notizen/.test(document.querySelector('#ls').textContent), null, { timeout: 8000 }).catch(() => {}); ok(/Noch keine Notizen/.test(await C.textContent('#ls')) && !/Einkauf/.test(await C.textContent('#ls')), 'anderes Konto sieht keine fremden Notizen ' + (await C.textContent('#ls')).slice(0, 80));
  // Offline-Aenderung und spaeteres Senden
  await A.waitForTimeout(500); await ctxA.setOffline(true); await A.evaluate(() => window.cloudyNotesApp.sync(false)); await A.waitForFunction(() => /Offline/.test(document.querySelector('#stat').textContent));
  await A.fill('#bd', 'Offline geschrieben'); await sleep(1200); ok(!(await h.list('anna', {})).json.notes.some(x => x.body === 'Offline geschrieben'), 'offline: noch nicht auf dem Server');
  await ctxA.setOffline(false); await A.evaluate(() => window.cloudyNotesApp.sync(false)); await sleep(1500); ok((await h.list('anna', {})).json.notes.some(x => x.body === 'Offline geschrieben'), 'wieder online: Offline-Aenderung wird gesendet');
  // Service Worker, Offline-Start
  await A.reload(); await A.waitForSelector('.item'); await A.waitForFunction(() => navigator.serviceWorker.controller || navigator.serviceWorker.getRegistration().then(r => r && r.active), null, { timeout: 8000 }).catch(() => {});
  await sleep(800); const keys = await A.evaluate(async () => (await caches.keys())); ok(keys.length === 1 && keys[0] === 'cloudy-notes-' + v('app.js'), 'Service-Worker-Cache angelegt: ' + keys);
  await ctxA.setOffline(true); await A.reload(); await A.waitForSelector('.item', { timeout: 8000 }); ok(/Offline|Einkauf/.test(await A.textContent('#ls')), 'Offline-Start: App und Notizen aus dem Cache');
  await ctxA.setOffline(false);
  // Update: neue Version ausliefern (Dateien + Cache), Daten bleiben, kein Reload-Loop
  const nav = []; A.on('framenavigated', f => { if (f === A.mainFrame()) nav.push(f.url()); });
  for (const f of ['sw.js', 'app.js']) fs.writeFileSync(path.join(ROOT, f), fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/'1\.0\.0'/, "'1.0.1'"));
  fs.writeFileSync(path.join(ROOT, 'index.html'), fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').replace(/v=1\.0\.0/g, 'v=1.0.1'));
  const before = await A.evaluate(() => JSON.stringify(Object.keys(localStorage).filter(k => k.startsWith('cn.cache.anna'))));
  await A.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); await r.update(); });
  await A.waitForFunction(async () => (await caches.keys()).join() === 'cloudy-notes-1.0.1', null, { timeout: 12000 }).catch(() => {});
  await sleep(1500); const k2 = await A.evaluate(async () => (await caches.keys())); ok(k2.join() === 'cloudy-notes-1.0.1', 'Update: neuer Cache, alter Cache geloescht: ' + k2);
  await A.waitForSelector('.item'); ok(await A.evaluate(() => window.cloudyNotesApp.version) === '1.0.1', 'Update uebernommen: App laeuft mit 1.0.1 (neues JS, kein altes aus dem Cache)');
  ok(await A.evaluate(() => JSON.stringify(Object.keys(localStorage).filter(k => k.startsWith('cn.cache.anna')))) === before && /Offline|Einkauf|Milch/.test(await A.textContent('#ls')), 'Daten und Anmeldung bleiben nach dem Update erhalten');
  await sleep(2500); ok(nav.length <= 2, 'kein Update-Loop (Navigationen: ' + nav.length + ')');
  // Alte App / neuer Server
  MIN_API = 2; await A.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await A.evaluate(async () => { await fetch('/notes/info'); }); await A.reload(); await A.waitForFunction(() => /zu alt/.test(document.body.textContent), null, { timeout: 8000 }).then(() => ok(true, 'zu alte App: Hinweis + Update-Versuch'), () => ok(false, 'zu alte App: Hinweis'));
  MIN_API = null;
  // Abmelden entfernt lokale Kopie
  await A.reload(); await A.waitForSelector('#gear'); await A.click('#gear'); await A.click('#lo'); await A.waitForSelector('#lf'); ok(await A.evaluate(() => Object.keys(localStorage).every(k => !k.startsWith('cn.cache.anna') && k !== 'cn.auth')), 'Abmelden entfernt Token und lokale Notizkopie');
  ok(!errs.length, 'keine JS-Fehler ' + (errs.length ? errs.join(';') : ''));
  await br.close(); srv.close(); console.log(fails ? `PWA FEHLER (${fails})` : `PWA OK – ${n} Prüfungen`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error('FAIL', e); process.exit(1); });
