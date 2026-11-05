(() => {
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const api = window.srv;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let toastT; const toast = m => { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 3200); };
const call = async (n, ...a) => { const r = await api[n](...a); if (!r.ok) { const e = new Error(r.error || 'Fehler'); e.syntax = r.syntax; throw e; } return r.data; };
const msg = (el, t, c) => { el.textContent = t || ''; el.className = 'msg ' + (c || ''); };

// ---- Navigation ----
function go(p) { $$('.nav').forEach(b => b.classList.toggle('on', b.dataset.p === p)); $$('.page').forEach(x => x.classList.toggle('on', x.id === 'p-' + p));
  if (p === 'logs') loadLogs(); if (p === 'set') loadFiles(); if (p === 'db') {} if (p === 'tun') loadTun(); if (p === 'bak') loadBak(); }
$$('.nav').forEach(b => b.onclick = () => go(b.dataset.p));
$$('[data-s]').forEach(b => b.onclick = () => { $$('[data-s]').forEach(x => x.classList.toggle('on', x === b)); for (const k of ['code', 'env', 'app']) $('#s-' + k).hidden = k !== b.dataset.s; if (b.dataset.s === 'env') loadEnv(); if (b.dataset.s === 'app') loadApp(); });

// ---- Status ----
const STT = { running: 'Läuft', starting: 'Startet …', restarting: 'Startet neu …', stopped: 'Gestoppt', error: 'Fehler' };
let ST = null;
const dur = ms => { const s = Math.floor(ms / 1000); if (s < 60) return s + ' s'; const m = Math.floor(s / 60); if (m < 60) return m + ' min'; const h = Math.floor(m / 60); return h < 48 ? h + ' h ' + (m % 60) + ' min' : Math.floor(h / 24) + ' Tage'; };
function paint(s) {
  ST = s; const sv = s.server;
  $('#dot').className = 'dot ' + sv.state; $('#stTxt').textContent = STT[sv.state] || sv.state;
  $('#stSub').textContent = sv.state === 'running' ? (s.health.ok ? 'Server antwortet auf Port ' + s.port : 'Prozess läuft, antwortet aber noch nicht …') : sv.state === 'stopped' ? 'Der Server ist aus.' : '';
  $('#bStart').disabled = ['running', 'starting', 'restarting'].includes(sv.state); $('#bStop').disabled = sv.state === 'stopped';
  $('#sHealth').textContent = sv.state !== 'running' ? '–' : s.health.ok ? 'Ja ✓' : 'Nein'; $('#sPort').textContent = s.port;
  $('#sUp').textContent = sv.state === 'running' ? dur(Date.now() - sv.since) : '–'; $('#sRes').textContent = sv.restarts;
  $('#stErr').textContent = sv.error || ''; $('#stErr').className = 'note err';
  $('#ver').textContent = 'v' + s.version; $('#foot').textContent = s.root;
  const t = s.tunnel; $('#tDot').className = 'dot ' + t.state; $('#tTxt').textContent = STT[t.state] || t.state; $('#tErr').textContent = t.error || ''; $('#tErr').className = 'note err';
}
api.on('state', paint);
setInterval(() => ST && paint(ST), 15000);
$('#bStart').onclick = () => call('start').catch(e => toast(e.message)); $('#bStop').onclick = () => call('stop'); $('#bRestart').onclick = () => call('restart');
$('#qLocal').onclick = () => ST && api.openUrl('http://127.0.0.1:' + ST.port + '/'); $('#qFolder').onclick = () => api.openFolder();
$('#qEdit').onclick = () => { go('set'); openFile('app.js'); }; $('#qRep').onclick = () => call('exportReport').then(() => toast('Bericht liegt auf dem Schreibtisch (ohne Passwörter).')).catch(e => toast(e.message));

// ---- Logs ----
let LOG = [];
const lineHtml = l => `<div class="${l.k}"><span class="t">${new Date(l.t).toLocaleTimeString()}</span> ${esc(l.s)}</div>`;
async function loadLogs() { LOG = await call('logs', $('#logWho').value); drawLogs(); }
function drawLogs() { const only = $('#logErr').checked, el = $('#log'); el.innerHTML = LOG.filter(l => !only || l.k === 'err').slice(-800).map(lineHtml).join(''); el.scrollTop = el.scrollHeight; }
api.on('log', l => { if (l.who !== $('#logWho').value) return; LOG.push(l); if (LOG.length > 1500) LOG.shift(); if (!$('#p-logs').classList.contains('on')) return; if ($('#logErr').checked && l.k !== 'err') return; const el = $('#log'), stick = el.scrollTop + el.clientHeight > el.scrollHeight - 40; el.insertAdjacentHTML('beforeend', lineHtml(l)); if (stick) el.scrollTop = el.scrollHeight; });
$('#logWho').onchange = loadLogs; $('#logErr').onchange = drawLogs; $('#logClr').onclick = () => { LOG = []; drawLogs(); }; $('#logOpen').onclick = () => api.openLogs();

// ---- Datenbank ----
$('#dbTest').onclick = async () => { msg($('#dbMsg'), 'Teste …'); const r = await call('dbTest'); r.ok ? msg($('#dbMsg'), `Verbunden ✓ (${r.tables} Tabellen)`, 'okc') : msg($('#dbMsg'), r.error, 'err'); };
$('#dbStart').onclick = async () => { try { msg($('#dbMsg'), 'Starte MySQL …'); await call('mysqlStart'); msg($('#dbMsg'), 'Gestartet – jetzt „Verbindung testen“.', 'okc'); } catch (e) { msg($('#dbMsg'), e.message, 'err'); } };
$('#dbCreate').onclick = async () => { try { msg($('#dbMsg2'), 'Lege an …'); await call('dbCreate', $('#rootUser').value, $('#rootPass').value); $('#rootPass').value = ''; msg($('#dbMsg2'), 'Fertig ✓ Datenbank und Benutzer sind bereit.', 'okc'); } catch (e) { msg($('#dbMsg2'), e.message, 'err'); } };

// ---- Tunnel ----
async function loadTun() { const s = await call('settingsGet'), t = await call('tools'); $('#tMode').value = s.tunnelMode; $('#tTok').value = s.tunnelToken; $('#tTokW').hidden = s.tunnelMode !== 'token'; $('#tTool').textContent = t.cloudflared ? 'cloudflared gefunden ✓' : 'cloudflared nicht gefunden (Mac: brew install cloudflared)'; $('#tTool').className = 'note ' + (t.cloudflared ? 'okc' : 'warn'); }
$('#tMode').onchange = () => $('#tTokW').hidden = $('#tMode').value !== 'token';
$('#tSave').onclick = async () => { await call('settingsSet', { tunnelMode: $('#tMode').value, tunnelToken: $('#tTok').value }); toast('Gespeichert.'); };
$('#tStart').onclick = () => call('tunnelStart').catch(e => toast(e.message)); $('#tStop').onclick = () => call('tunnelStop');

// ---- Backup ----
async function loadBak() { const s = await call('settingsGet'); $('#bkDaily').checked = !!s.backupDaily; $('#bkKeep').value = s.backupKeep; }
$('#bkNow').onclick = async () => { try { msg($('#bkMsg'), 'Sichere …'); const r = await call('backup'); msg($('#bkMsg'), `Fertig ✓ ${r.dir}${r.db ? ' (mit Datenbank)' : ''}${r.note ? ' – ' + r.note : ''}`, r.note ? 'warn' : 'okc'); } catch (e) { msg($('#bkMsg'), e.message, 'err'); } };
$('#bkOpen').onclick = () => api.backupOpen();
$('#bkDaily').onchange = $('#bkKeep').onchange = () => call('settingsSet', { backupDaily: $('#bkDaily').checked, backupKeep: +$('#bkKeep').value });

// ---- Code-Editor ----
let cur = '', orig = '', files = [];
const ta = $('#ta');
const dirty = () => ta.value !== orig;
function gutter() { const n = ta.value.split('\n').length; let g = ''; for (let i = 1; i <= n; i++) g += i + '\n'; $('#gut').textContent = g; $('#gut').scrollTop = ta.scrollTop; }
ta.addEventListener('input', () => { gutter(); $('#edDirty').hidden = !dirty(); });
ta.addEventListener('scroll', () => $('#gut').scrollTop = ta.scrollTop);
ta.addEventListener('keydown', e => {
  if (e.key === 'Tab') { e.preventDefault(); const s = ta.selectionStart, en = ta.selectionEnd; ta.setRangeText('  ', s, en, 'end'); ta.dispatchEvent(new Event('input')); }
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); e.stopPropagation(); save(false); }
});
document.addEventListener('keydown', e => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's' && $('#p-set').classList.contains('on')) { e.preventDefault(); save(false); } });
async function loadFiles() { files = await call('files'); $('#fl').innerHTML = files.map(f => `<div data-f="${esc(f.file)}" class="${f.file === cur ? 'on' : ''}"><span>${esc(f.file)}</span><small>${Math.ceil(f.size / 1024)} KB</small></div>`).join(''); $$('#fl div').forEach(d => d.onclick = () => openFile(d.dataset.f)); if (!cur && files.length) openFile(files.find(f => f.file === 'app.js') ? 'app.js' : files[0].file); }
async function openFile(f) {
  if (dirty() && !confirm('Ungespeicherte Änderungen verwerfen?')) return;
  try { const t = await call('read', f); cur = f; orig = t; ta.value = t; ta.scrollTop = 0; $('#edName').textContent = f; $('#edDirty').hidden = true; msg($('#edMsg'), ''); gutter(); $$('#fl div').forEach(d => d.classList.toggle('on', d.dataset.f === f)); loadVers(); } catch (e) { msg($('#edMsg'), e.message, 'err'); }
}
async function loadVers() { const v = await call('versions', cur).catch(() => []); $('#edVer').innerHTML = '<option value="">Versionen…</option>' + v.map(x => `<option value="${x.id}">${new Date(x.time).toLocaleString()}</option>`).join(''); }
$('#edVer').onchange = async () => { const id = $('#edVer').value; if (!id) return; if (dirty() && !confirm('Aktuelle Änderungen durch diese Version ersetzen?')) { $('#edVer').value = ''; return; } try { ta.value = await call('readVersion', cur, id); gutter(); $('#edDirty').hidden = !dirty(); msg($('#edMsg'), 'Alte Version geladen – mit „Speichern“ übernehmen.', 'warn'); } catch (e) { msg($('#edMsg'), e.message, 'err'); } $('#edVer').value = ''; };
$('#edReset').onclick = async () => { if (!cur || !confirm(`„${cur}“ auf die mitgelieferte Originalfassung zurücksetzen? Deine Fassung bleibt unter „Versionen“ erhalten.`)) return; try { const t = await call('resetFile', cur); orig = t; ta.value = t; gutter(); $('#edDirty').hidden = true; msg($('#edMsg'), 'Original wiederhergestellt. Zum Anwenden Server neu starten.', 'okc'); loadVers(); } catch (e) { msg($('#edMsg'), e.message, 'err'); } };
async function save(restart) {
  if (!cur) return;
  try {
    await call('write', cur, ta.value, false);
  } catch (e) {
    if (e.syntax && confirm(e.message + '\n\nTrotzdem speichern? (Der Server startet dann vermutlich nicht.)')) { try { await call('write', cur, ta.value, true); } catch (x) { return msg($('#edMsg'), x.message, 'err'); } } else return msg($('#edMsg'), e.message, 'err');
  }
  orig = ta.value; $('#edDirty').hidden = true; msg($('#edMsg'), 'Gespeichert ✓' + (restart ? ' – starte neu …' : ' (gilt nach Neustart des Servers)'), 'okc'); loadVers();
  if (restart) call('restart').then(() => msg($('#edMsg'), 'Gespeichert ✓ Server neu gestartet.', 'okc')).catch(e => msg($('#edMsg'), e.message, 'err'));
}
$('#edSave').onclick = () => save(false); $('#edSaveRs').onclick = () => save(true);

// ---- Konfiguration (cloudy.env) ----
const SECRETS = /(PASS|SECRET|KEY|TOKEN)/i;
function envRow(k = '', v = '') { const d = document.createElement('div'); d.className = 'envrow'; d.innerHTML = `<input type="text" class="k" value="${esc(k)}" placeholder="NAME"><input type="${SECRETS.test(k) ? 'password' : 'text'}" class="v" value="${esc(v)}" placeholder="Wert"><button class="btn dng" title="Entfernen">✕</button>`;
  d.querySelector('button').onclick = () => d.remove(); d.querySelector('.k').oninput = e => d.querySelector('.v').type = SECRETS.test(e.target.value) ? 'password' : 'text'; return d; }
async function loadEnv() { const o = await call('envGet'); const box = $('#envRows'); box.innerHTML = ''; Object.entries(o).forEach(([k, v]) => box.appendChild(envRow(k, v))); msg($('#envMsg'), ''); }
$('#envAdd').onclick = () => $('#envRows').appendChild(envRow());
async function envSave(rs) { const o = {}; $$('#envRows .envrow').forEach(r => { const k = r.querySelector('.k').value.trim(); if (k) o[k] = r.querySelector('.v').value; }); const bad = Object.keys(o).find(k => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(k)); if (bad) return msg($('#envMsg'), `„${bad}“ ist kein gültiger Name (nur Buchstaben, Zahlen, _).`, 'err'); try { await call('envSet', o); msg($('#envMsg'), 'Gespeichert ✓', 'okc'); if (rs) await call('restart'); } catch (e) { msg($('#envMsg'), e.message, 'err'); } }
$('#envSave').onclick = () => envSave(false); $('#envSaveRs').onclick = () => envSave(true);

// ---- App-Optionen ----
async function loadApp() { const s = await call('settingsGet'); $('#oAuto').checked = s.autoStart; $('#oRes').checked = s.autoRestart; $('#oLogin').checked = s.launchAtLogin; $('#oAwake').checked = s.keepAwake; $('#oDir').value = s.serverDir || '(Standard)'; $('#oDir').dataset.v = s.serverDir || ''; }
$('#oPick').onclick = async () => { const d = await call('chooseFolder'); if (d) { $('#oDir').value = d; $('#oDir').dataset.v = d; } };
$('#oDef').onclick = () => { $('#oDir').value = '(Standard)'; $('#oDir').dataset.v = ''; };
$('#oSave').onclick = async () => { const before = (await call('settingsGet')).serverDir || ''; const dir = $('#oDir').dataset.v || ''; await call('settingsSet', { autoStart: $('#oAuto').checked, autoRestart: $('#oRes').checked, launchAtLogin: $('#oLogin').checked, keepAwake: $('#oAwake').checked, serverDir: dir });
  msg($('#oMsg'), 'Gespeichert ✓' + (dir !== before ? ' – Server-Ordner geändert, Server neu starten.' : ''), 'okc'); if (dir !== before) { cur = ''; orig = ''; ta.value = ''; } };

call('state').then(paint); call('defaultDiff').then(p => { if (p && p.length) toast('Neue Server-Version in der App: ' + p.length + ' Datei(en) – du hast sie geändert, deine Fassung bleibt. Im Editor: „Original“.'); }).catch(() => {});
})();
