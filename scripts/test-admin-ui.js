// Admin-Konten: schlanke Namensliste, Klick oeffnet ein Popup mit den Aktionen (echtes index.html in Chromium, window.cloudy nachgebaut)
// Aufruf: NODE_PATH=$(npm root -g) node scripts/test-admin-ui.js
const http = require('http'), fs = require('fs'), path = require('path'); const { chromium } = require('playwright');
const root = path.join(__dirname, '..'); let bad = 0; const ok = (c, m) => { console.log(c ? 'OK  ' : 'FAIL', m); if (!c) bad++; };
const MIME = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.json': 'application/json', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary' };
const s = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]), f = path.join(root, u === '/' ? 'index.html' : u); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
s.listen(0, async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1100, height: 800 } })).newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await p.addInitScript(() => {
    window.__calls = []; const users = [{ name: 'Benn', coins: 0, owned: 4, inf: true, banned: 0, paused: 0, items: ['hat-a'], tags: ['owner'] }, { name: 'Kumpel', coins: 120, owned: 2, inf: false, banned: 1, until: 0, reason: 'Spam', paused: 0, items: [], tags: [] }];
    const tgt = { gate: async () => ({ ok: true }), authListFull: async () => users, admTag: async a => { window.__calls.push(['tag', a]); return true; }, authAdminPause: async a => { window.__calls.push(['pause', a]); return true; }, shopState: async () => ({ limited: [], catalog: [], admin: true, bundles: [], coins: 0, owned: [], equip: {} }), skinList: async () => [] };
    window.cloudy = new Proxy(tgt, { get: (t, k) => k in t ? t[k] : (k === 'then' ? undefined : async () => (k.startsWith('on') ? undefined : null)) });
  });
  await p.goto('http://127.0.0.1:' + s.address().port + '/'); await p.waitForTimeout(1200);
  await p.evaluate(() => { document.querySelector('#login')?.classList.add('off'); window.go && window.go('settings'); return window.__paintAdmin(true); }); await p.waitForTimeout(500);
  const rows = await p.evaluate(() => [...document.querySelectorAll('#admList .arow')].map(r => ({ txt: r.textContent.replace(/\s+/g, ' ').trim(), btns: r.querySelectorAll('button').length })));
  ok(rows.length === 2 && rows[0].txt.startsWith('Benn') && rows.every(r => r.btns === 0), 'Liste zeigt nur Namen (+ kurze Info), keine Knoepfe: ' + JSON.stringify(rows.map(r => r.txt)));
  await p.evaluate(() => document.querySelector('#admList [data-open="Benn"]').click()); await p.waitForTimeout(200);
  const m = await p.evaluate(() => { const d = document.getElementById('admModal'); return d ? { heads: [...d.querySelectorAll('h4')].map(h => h.textContent), name: d.querySelector('h3').textContent, btns: d.querySelectorAll('.adm-btns button').length, owner: !!d.querySelector('[data-tg^="Benn|owner|0"]') } : null; });
  ok(m && m.name === 'Benn' && m.heads.length === 5 && m.btns >= 12, 'Klick oeffnet Popup mit 5 Bereichen und allen Aktionen: ' + JSON.stringify(m));
  ok(m && m.owner, 'Owner-Tag steht als aktiv (zum Entfernen) im Popup');
  await p.evaluate(() => document.querySelector('#admModal [data-tg^="Benn|plus"]').click()); await p.waitForTimeout(400);
  const calls = await p.evaluate(() => window.__calls); ok(calls.some(c => c[0] === 'tag' && c[1].name === 'Benn' && c[1].tag === 'plus' && c[1].on === true), 'Tag-Knopf im Popup ruft admTag mit den richtigen Werten auf');
  ok(await p.evaluate(() => !!document.getElementById('admModal')), 'Popup bleibt nach einer Aktion offen und zeigt den neuen Stand');
  await p.evaluate(() => document.querySelector('#admModal [data-close]').click()); ok(await p.evaluate(() => !document.getElementById('admModal')), 'Schliessen-Knopf schliesst das Popup');
  await p.evaluate(() => document.querySelector('#admList [data-open="Kumpel"]').click()); await p.waitForTimeout(150);
  ok(await p.evaluate(() => /Spam|GESPERRT|BANNED|PERMANENT/i.test(document.getElementById('admModal').textContent)), 'Gesperrtes Konto zeigt Status und Grund im Popup');
  await p.mouse.click(5, 5); await p.waitForTimeout(150); ok(await p.evaluate(() => !document.getElementById('admModal')), 'Klick neben das Popup schliesst es');
  const mine = errs.filter(e => /adm|Admin|showUser|bindTools|toolHtml|rowHead/i.test(e)); ok(!mine.length, 'keine JS-Fehler im Admin-Code ' + mine.join(' | ')); await b.close(); s.close(); console.log(bad ? 'ADMIN-UI FEHLER ' + bad : 'ADMIN-UI OK'); process.exit(bad ? 1 : 0);
});
