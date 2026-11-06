// Launcher mit echtem index.html (Chromium, window.cloudy nachgebaut): Shop zeigt die 3D-Modell-Items, die Vorschau rendert sie per WebGL, keine JS-Fehler.
// Aufruf: NODE_PATH=$(npm root -g) node scripts/test-glb-shop.js
const http = require('http'), fs = require('fs'), path = require('path'); const { chromium } = require('playwright');
const root = path.join(__dirname, '..'); let n = 0, bad = 0; const ok = (c, m) => { n++; console.log(c ? 'OK  ' : 'FAIL', m); if (!c) bad++; };
const main = fs.readFileSync(path.join(root, 'main.js'), 'utf8'); const cat = [...main.matchAll(/\{ id: '((?:hat|cape|wings)-g3[a-z]+)', cat: '([a-z]+)', name: '([^']+)', price: (\d+) \}/g)].map(m => ({ id: m[1], cat: m[2], name: m[3], price: +m[4] }));
ok(cat.length === 7, '7 neue Items im Katalog (main.js)');
const MIME = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.glb': 'model/gltf-binary', '.json': 'application/json', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };
const s = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0]) === '/' ? 'index.html' : decodeURIComponent(q.url.split('?')[0])); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); r.end(fs.readFileSync(f)); });
s.listen(0, async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }); const ctx = await b.newContext({ viewport: { width: 1200, height: 800 } }); const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e).slice(0, 200))); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text()) || /glb|GLB|THREE/.test(m.text())) console.log('console:', m.text().slice(0, 300)); });
  const state = { limited: [], catalog: cat, admin: false, bundles: [], coins: 99999, owned: cat.map(c => c.id), equip: { hat: 'hat-g3wizard', cape: 'cape-g3nebula', wings: 'wings-g3seraph' }, dailyReady: false };
  await p.addInitScript(([st, glbs]) => {
    const tgt = { gate: async () => ({ ok: true }), shopState: async () => st, skinList: async () => [], glbRead: async name => { const r = await fetch('/assets/cosmetics3d/' + name); return new Uint8Array(await r.arrayBuffer()); } };
    window.cloudy = new Proxy(tgt, { get: (t, k) => k in t ? t[k] : (k === 'then' ? undefined : async () => (k.startsWith('on') ? undefined : null)) });
  }, [state, null]);
  await p.goto('http://127.0.0.1:' + s.address().port + '/');
  await p.waitForTimeout(1500);
  await p.evaluate(() => { try { window.go('shop'); } catch (e) { console.log('go', e.message); } }); await p.waitForTimeout(2500); await p.evaluate(() => window.paintAll && window.paintAll()); await p.waitForTimeout(2500);
  const info = await p.evaluate(() => ({ glb: !!window.Glb3d, three: !!window.THREE, cards: document.querySelectorAll('#p-shop .i3 img[src*="cosmetics3d/icons"]').length, canvas: !!document.querySelector('#shop3d canvas'), host: !!document.querySelector('#shop3d') }));
  ok(info.three && info.glb, 'three.js und glb3d.js im Launcher geladen');
  ok(info.cards >= 2, `Shop-Karten (Umhang-Reihe) mit 3D-Vorschaubild: ${info.cards}`);
  const okIcons = await p.evaluate(async ids => { let k = 0; for (const id of ids) { const r = await fetch('/assets/cosmetics3d/icons/' + id + '.png'); if (r.ok && (await r.blob()).size > 2000) k++; } return k; }, cat.map(c => c.id)); ok(okIcons === 7, 'alle 7 Vorschaubilder erreichbar');
  ok(info.canvas, '3D-Vorschau (WebGL-Canvas) im Shop sichtbar, wenn ein 3D-Modell angelegt ist');
  const lit = await p.evaluate(async () => { const c = document.querySelector('#shop3d canvas'); if (!c) return 0; await new Promise(r => setTimeout(r, 600)); const hh = document.querySelector('#shop3d'); if (hh._apply) hh._apply(); const t = document.createElement('canvas'); t.width = c.width; t.height = c.height; const g = t.getContext('2d'); g.drawImage(c, 0, 0); const d = g.getImageData(0, 0, t.width, t.height).data; let k = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 20) k++; return k; });
  ok(lit > 8000, `Vorschau zeichnet Figur mit Hut/Umhang/Fluegel (${lit} Pixel)`);
  const mine = errs.filter(e => /glb|Glb|three|THREE|shop|3d|rig|item3d|paint3d/i.test(e)); ok(!mine.length, 'keine JS-Fehler in Shop/3D-Code ' + mine.join(' | ')); await p.evaluate(() => { const l = document.getElementById('login'); if (l) l.style.display = 'none'; document.querySelectorAll('#p-shop .tools .chip').forEach(() => {}); }); await p.waitForTimeout(500); await p.screenshot({ path: '/tmp/shop-glb.png' }); await b.close(); s.close(); console.log(bad ? 'GLB-SHOP FEHLER' : `GLB-SHOP OK – ${n} Prüfungen`); process.exit(bad ? 1 : 0);
});
