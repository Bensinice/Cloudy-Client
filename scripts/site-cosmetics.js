// Erzeugt die Daten für die Cosmetics-Seite der Website (cloudyclient.com/cosmetics):
//   assets/site-cosmetics.json  – alle Items aus dem Shop-Katalog (main.js) mit Kategorie, Preis, Kennzeichen
//   assets/site-cos/<id>.png    – Vorschaubild je Item (so wie im Launcher-Shop)
// Die Website holt beides direkt aus dem öffentlichen GitHub-Repo – nach neuen Items einfach erneut ausführen und pushen.
// Aufruf: NODE_PATH=$(npm root -g) node scripts/site-cosmetics.js
const http = require('http'), fs = require('fs'), path = require('path'); const { chromium } = require('playwright');
const root = path.join(__dirname, '..'), out = path.join(root, 'assets', 'site-cos'); fs.mkdirSync(out, { recursive: true });
const main = fs.readFileSync(path.join(root, 'main.js'), 'utf8'), a = main.indexOf('const CATALOG = ['), b = main.indexOf('];', a);
const CAT = eval(main.slice(a + 'const CATALOG = '.length, b + 1)).filter(c => !c.gone && !c.owner);
const MIME = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.glb': 'model/gltf-binary', '.json': 'application/json', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };
const s = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]), f = path.join(root, u === '/' ? 'index.html' : u); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
s.listen(0, async () => {
  const br = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await (await br.newContext({ viewport: { width: 1400, height: 1000 } })).newPage();
  const state = { limited: [], catalog: CAT.map(c => ({ ...c })), admin: false, bundles: [], coins: 0, owned: [], equip: {}, dailyReady: false, dye: {}, pets: {} };
  await p.addInitScript(([st]) => { const t = { gate: async () => ({ ok: true }), shopState: async () => st, skinList: async () => [], glbRead: async n => new Uint8Array(await (await fetch('/assets/cosmetics3d/' + n)).arrayBuffer()) }; window.cloudy = new Proxy(t, { get: (o, k) => k in o ? o[k] : (k === 'then' ? undefined : async () => (String(k).startsWith('on') ? undefined : null)) }); }, [state]);
  await p.goto('http://127.0.0.1:' + s.address().port + '/'); await p.waitForTimeout(1500);
  await p.evaluate(() => { document.getElementById('login')?.classList.add('off'); window.go('shop'); }); await p.waitForTimeout(1500);
  const done = new Set(), meta = [];
  await p.addStyleTag({ content: 'html,body{background:transparent!important}body>*:not(#cosShot){visibility:hidden!important}body::before,body::after{display:none!important}#cosShot{position:fixed;left:0;top:0;width:260px;height:260px;z-index:99999;visibility:visible!important;background:transparent}#cosShot .shi{background:transparent!important;border:0!important;box-shadow:none!important;padding:0!important;backdrop-filter:none!important}#cosShot .i3h{height:260px!important;width:260px!important}' });
  await p.evaluate(() => { const d = document.createElement('div'); d.id = 'cosShot'; d.innerHTML = '<div class="shi"><div class="i3h"></div></div>'; document.body.appendChild(d); });
  for (const c of CAT) {
    const ok = await p.evaluate(id => { const h = document.querySelector('#cosShot .i3h'); h.innerHTML = ''; try { const w = window.__item3d(id); h.appendChild(w); w.style.transform = 'scale(1.7)'; return true; } catch (e) { return false; } }, c.id);
    if (!ok) { console.log('kein Bild:', c.id); continue; }
    await p.waitForTimeout(/-g\d|pet-|emote-|trail|winfx|foot/.test(c.id) ? 700 : 350);
    await p.screenshot({ path: path.join(out, c.id + '.png'), clip: { x: 0, y: 0, width: 260, height: 260 }, omitBackground: true }); done.add(c.id); process.stdout.write('.');
  }
  console.log('');
  for (const c of CAT) meta.push({ id: c.id, cat: c.cat, name: c.name, price: c.price || 0, ...(c.plus ? { plus: 1 } : {}), ...(c.excl ? { excl: c.excl } : {}), img: done.has(c.id) ? 'assets/site-cos/' + c.id + '.png' : '' });
  fs.writeFileSync(path.join(root, 'assets', 'site-cosmetics.json'), JSON.stringify({ made: new Date().toISOString().slice(0, 10), items: meta }));
  console.log('Items:', meta.length, 'Bilder:', done.size, 'ohne Bild:', meta.filter(m => !m.img).map(m => m.id).join(', '));
  await br.close(); s.close();
});
