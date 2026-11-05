const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1080, height: 720 } }); const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await pg.addInitScript(() => {
    const files = { 'app.js': 'const a = 1;\nconsole.log(a);\n', 'site.js': '// site\n' }; const calls = []; window.__calls = calls; const L = {};
    const st = { server: { state: 'running', since: Date.now() - 90000, restarts: 2, error: '' }, tunnel: { state: 'stopped', error: '' }, health: { ok: true }, port: 3364, root: '/Users/x/server-files', version: '1.0.0' };
    const h = {
      state: () => st, logs: () => [{ t: Date.now(), k: 'out', s: 'Server läuft <b>3364</b>' }, { t: Date.now(), k: 'err', s: 'Fehler X' }], files: () => Object.keys(files).map(f => ({ file: f, size: files[f].length })),
      read: f => files[f], write: (f, t, force) => { if (/;;;/.test(t) && !force) { const e = { ok: false, error: 'Syntaxfehler in Zeile 1', syntax: { line: 1 } }; throw e; } files[f] = t; return { ok: true }; },
      versions: () => [{ id: '1.bak', time: Date.now() }], readVersion: () => 'old\n', envGet: () => ({ PORT: '3364', DB_PASS: 'secret123' }), settingsGet: () => ({ autoStart: true, autoRestart: true, launchAtLogin: false, keepAwake: true, serverDir: '', tunnelMode: 'token', tunnelToken: '••••', backupDaily: false, backupKeep: 7 }),
      dbTest: () => ({ ok: false, error: 'MySQL läuft nicht' }), tools: () => ({ cloudflared: false }), defaultDiff: () => [], restart: () => 1, envSet: () => 1, settingsSet: () => 1,
    };
    window.srv = new Proxy({}, { get: (_, n) => n === 'on' ? (c, f) => { L[c] = f; window.__emit = (c2, d) => L[c2] && L[c2](d); } : async (...a) => { calls.push([n, ...a]); try { const r = h[n] ? await h[n](...a) : null; return { ok: true, data: r }; } catch (e) { return e.ok === false ? e : { ok: false, error: String(e) }; } } });
  });
  await pg.goto('file://' + path.resolve(__dirname, '../ui/index.html')); await pg.waitForTimeout(300);
  const t = async s => (await pg.textContent(s)).trim();
  if ((await t('#stTxt')) !== 'Läuft') throw new Error('status'); if (!(await t('#sHealth')).includes('Ja')) throw new Error('health'); if ((await t('#sRes')) !== '2') throw new Error('restarts');
  await pg.screenshot({ path: process.argv[2] + '/home.png' });
  await pg.click('[data-p=logs]'); await pg.waitForTimeout(200); if (!(await pg.innerHTML('#log')).includes('&lt;b&gt;3364')) throw new Error('log must be escaped');
  await pg.check('#logErr'); if ((await pg.$$('#log div')).length !== 1) throw new Error('error filter'); await pg.evaluate(() => window.__emit('log', { who: 'server', t: Date.now(), k: 'err', s: 'neu' })); if ((await pg.$$('#log div')).length !== 2) throw new Error('live log');
  await pg.click('[data-p=db]'); await pg.click('#dbTest'); await pg.waitForTimeout(150); if (!(await t('#dbMsg')).includes('MySQL läuft nicht')) throw new Error('db msg');
  await pg.click('[data-p=tun]'); await pg.waitForTimeout(150); if (await pg.isHidden('#tTokW')) throw new Error('token field'); if (!(await t('#tTool')).includes('nicht gefunden')) throw new Error('tool');
  await pg.click('[data-p=set]'); await pg.waitForTimeout(300); if ((await pg.inputValue('#ta')).indexOf('const a = 1') !== 0) throw new Error('editor load'); if ((await t('#gut')).split('\n').filter(Boolean).length < 2) throw new Error('gutter');
  await pg.click('#ta'); await pg.keyboard.press('Control+End'); await pg.keyboard.press('Tab'); await pg.keyboard.type('x'); if (await pg.isHidden('#edDirty')) throw new Error('dirty'); if (!(await pg.inputValue('#ta')).endsWith('  x')) throw new Error('tab');
  await pg.keyboard.press('Control+s'); await pg.waitForTimeout(200); if (!(await t('#edMsg')).includes('Gespeichert')) throw new Error('save msg'); if (!await pg.isHidden('#edDirty')) throw new Error('clean');
  await pg.fill('#ta', ';;;'); pg.once('dialog', d => d.dismiss()); await pg.click('#edSave'); await pg.waitForTimeout(200); if (!(await t('#edMsg')).includes('Syntaxfehler')) throw new Error('syntax msg');
  await pg.screenshot({ path: process.argv[2] + '/editor.png' });
  await pg.click('#edSaveRs'); pg.once('dialog', d => d.dismiss());
  await pg.click('[data-s=env]'); await pg.waitForTimeout(200); if ((await pg.getAttribute('#envRows .envrow:nth-child(2) .v', 'type')) !== 'password') throw new Error('secret must be password field');
  await pg.click('[data-s=app]'); await pg.waitForTimeout(150); if (!(await pg.isChecked('#oAuto'))) throw new Error('opts');
  if (errs.length) throw new Error('page errors: ' + errs.join(' | '));
  console.log('UI OK'); await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
