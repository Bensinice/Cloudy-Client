// Cloudy Notes (iPhone/Web-App). Gleiche Konto-Anmeldung und gleiche Notizen wie Launcher/Server-App – kein eigenes Notizsystem.
(function () {
  'use strict';
  const APP_VERSION = '1.0.0', APP_API = 1; // App-Stand und die Server-API, die sie spricht (siehe /notes/info)
  const $app = document.getElementById('app');
  const lg = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch { return d; } };
  let quotaWarned = false;
  const ls = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { if (!quotaWarned) { quotaWarned = true; setTimeout(() => toast('Speicher im Browser voll – Offline-Kopie nicht aktuell.'), 0); } return false; } };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const hex = n => { const a = new Uint8Array(n / 2); crypto.getRandomValues(a); return [...a].map(x => x.toString(16).padStart(2, '0')).join(''); };
  const S = { auth: lg('cn.auth', null), notes: [], sel: '', q: '', sync: 'idle', last: 0, fails: 0, loaded: false, prefs: Object.assign({ theme: 'auto', accent: 'yellow' }, lg('cn.prefs', {})), open: false, upd: null, old: false };
  const timers = {}; let pollT = null, seq = 0, syncing = false;
  const key = () => 'cn.cache.' + (S.auth ? S.auth.user : '');
  const cur = () => S.notes.find(n => n.id === S.sel);
  const day = t => { const d = new Date(t), n = new Date(); return d.toDateString() === n.toDateString() ? d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }); };

  // ---------- Erscheinungsbild ----------
  function applyPrefs() { const r = document.documentElement; if (S.prefs.theme === 'auto') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', S.prefs.theme); r.setAttribute('data-accent', S.prefs.accent); const dark = S.prefs.theme === 'dark' || (S.prefs.theme === 'auto' && matchMedia('(prefers-color-scheme:dark)').matches); const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = dark ? '#000000' : '#f2f2f7'; }
  function toast(m) { const d = document.createElement('div'); d.className = 'banner glass'; d.textContent = m; document.body.appendChild(d); setTimeout(() => d.remove(), 3500); }

  // ---------- Server ----------
  async function api(path, body, opt) {
    const ac = new AbortController(), to = setTimeout(() => ac.abort(), 20000);
    try {
      const r = await fetch(path, { method: body === undefined ? 'GET' : 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, S.auth && !(opt && opt.anon) ? { Authorization: 'Bearer ' + S.auth.token } : {}), body: body === undefined ? undefined : JSON.stringify(body), signal: ac.signal, cache: 'no-store', keepalive: !!(opt && opt.keepalive) });
      let j = {}; try { j = await r.json(); } catch {}
      if (r.status === 401 && S.auth && !(opt && opt.anon)) { logout(true); return { ok: false, auth: true, error: j.error || 'Bitte neu anmelden.' }; }
      if (r.status === 409) return Object.assign({ ok: false, conflict: true }, j);
      if (!r.ok) return Object.assign({ ok: false, status: r.status, error: j.error || 'Fehler ' + r.status }, j.ok === undefined ? {} : {});
      return Object.assign({ ok: true }, j);
    } catch { return { ok: false, offline: true, error: 'Keine Verbindung.' }; } finally { clearTimeout(to); }
  }

  // ---------- Daten & Sync ----------
  function load() { S.notes = lg(key(), []).filter(n => !n.deleted); S.last = lg(key() + '.last', 0) || 0; S.sel = ''; }
  const persist = () => { ls(key(), S.notes.map(n => ({ id: n.id, title: n.title, body: n.body, created: n.created, updated: n.updated, _known: n._known, _dirty: n._dirty }))); ls(key() + '.last', S.last); };
  const sorted = () => { const q = S.q.trim().toLowerCase(); let l = S.notes.slice(); if (q) l = l.filter(n => (n.title + '\n' + n.body).toLowerCase().includes(q)); return l.sort((a, b) => b.updated - a.updated); };
  function merge(list) {
    let ch = false;
    for (const s of list) {
      const i = S.notes.findIndex(n => n.id === s.id), l = S.notes[i];
      if (s.deleted) { if (i >= 0) { S.notes.splice(i, 1); ch = true; if (S.sel === s.id) { S.sel = ''; S.open = false; } } continue; }
      s._known = true;
      if (!l) { S.notes.push({ id: s.id, title: s.title, body: s.body, created: s.created, updated: s.updated, _known: true }); ch = true; continue; }
      if (l._dirty) { if (s.updated > l.updated && (s.body !== l.body || s.title !== l.title)) conflict(l, s); continue; }
      if (s.updated > l.updated) { l.title = s.title; l.body = s.body; l.updated = s.updated; l._known = true; ch = true; }
    }
    return ch;
  }
  function conflict(local, server) { // zwei Geraete haben dieselbe Notiz geaendert: eigene Fassung als Kopie behalten, Server-Fassung uebernehmen
    const t = Date.now(), copy = { id: hex(18), title: local.title + ' (Konflikt-Kopie)', body: local.body, created: t, updated: t, _dirty: true, _known: false };
    local.title = server.title; local.body = server.body; local.updated = server.updated; local._dirty = false; local._known = true; S.notes.push(copy); persist();
    toast('Die Notiz wurde auf einem anderen Gerät geändert – deine Fassung liegt als Kopie vor.'); queue(copy.id); if (S.sel === local.id) fillEditor(true);
  }
  function queue(id, ms) { clearTimeout(timers[id]); const n = S.notes.find(x => x.id === id); if (n) { n._dirty = true; persist(); } setStat(); timers[id] = setTimeout(() => save(id), ms == null ? 800 : ms); }
  async function save(id, keepalive) {
    const n = S.notes.find(x => x.id === id); if (!n || !n._dirty) return true; clearTimeout(timers[id]);
    const snap = n.title + '\u0000' + n.body; S.sync = 'save'; setStat();
    const r = await api('/notes/save', { id, title: n.title, body: n.body, base: n._known ? n.updated : undefined }, { keepalive });
    if (r.ok && r.note) { n._known = true; n.updated = r.note.updated; if (n.title + '\u0000' + n.body === snap) n._dirty = false; else queue(id); S.sync = 'ok'; S.err = ''; persist(); setStat(); renderList(); return true; }
    if (r.conflict && r.note) { conflict(n, r.note); renderList(); return false; }
    S.sync = r.offline ? 'off' : 'err'; S.err = r.error || ''; setStat(); return false;
  }
  const flushAll = async () => { for (const n of S.notes.filter(x => x._dirty)) await save(n.id); };
  async function sync(full) {
    if (syncing || !S.auth) return; syncing = true; const mine = ++seq, before = listSig(); S.sync = 'run'; setStat();
    const r = await api('/notes/list', { since: full ? 0 : S.last });
    syncing = false; if (mine !== seq || !S.auth) return; // veraltete Antwort verwerfen
    if (r.ok) { S.fails = 0; S.last = Math.max(0, r.now - 5000); const ch = merge(r.notes || []); S.sync = 'ok'; S.err = ''; S.loaded = true; persist(); await flushAll(); if (ch || before !== listSig()) { renderList(); if (S.sel && !cur()) closeEditor(); else if (!typing()) fillEditor(false); } }
    else { S.fails++; S.sync = r.offline ? 'off' : 'err'; S.err = r.error || ''; }
    setStat();
  }
  const listSig = () => S.notes.map(n => n.id + ':' + n.updated + ':' + n.title).join('|') + '#' + S.sel + '#' + S.loaded;
  function schedule() { clearTimeout(pollT); pollT = setTimeout(async () => { if (S.auth && !document.hidden) await sync(false); schedule(); }, Math.min(20000 * Math.pow(2, Math.min(S.fails, 4)), 300000)); }
  const typing = () => { const a = document.activeElement; return !!(a && /^(INPUT|TEXTAREA)$/.test(a.tagName) && $app.contains(a) && a.id !== 'q'); };

  // ---------- Anzeige ----------
  function showLogin(msg) {
    $app.innerHTML = `<div class="login"><img src="icon-192.png" alt=""><h1>Cloudy Notes</h1><p>Melde dich mit deinem Cloudy-Konto an – du siehst dieselben Notizen wie in der Server-App.</p>
      <form id="lf"><input class="inp" id="lu" placeholder="Benutzername" autocomplete="username" autocapitalize="none" autocorrect="off" required><input class="inp" id="lp" type="password" placeholder="Passwort" autocomplete="current-password" required>
      <div class="err" id="le">${esc(msg || '')}</div><button class="btn pri" id="lb">Anmelden</button></form></div>`;
    $app.querySelector('#lf').onsubmit = async e => {
      e.preventDefault(); const b = $app.querySelector('#lb'); b.disabled = true; b.textContent = 'Anmelden …';
      const r = await api('/login', { user: $app.querySelector('#lu').value, pass: $app.querySelector('#lp').value }, { anon: true });
      if (r.ok && r.token) { S.auth = { token: r.token, user: String((r.user && r.user.name) || $app.querySelector('#lu').value).trim().toLowerCase() }; ls('cn.auth', S.auth); start(); }
      else { b.disabled = false; b.textContent = 'Anmelden'; $app.querySelector('#le').textContent = r.offline ? 'Keine Verbindung zum Server.' : (r.error || 'Anmeldung fehlgeschlagen.'); }
    };
  }
  function logout(expired) { // Notizen bleiben nur auf dem Geraet, wenn man sich nur abmeldet? Nein: Offline-Kopie wird mit der Abmeldung entfernt (Datenschutz auf geteilten Geraeten).
    const u = S.auth && S.auth.user; try { localStorage.removeItem('cn.auth'); if (u) { localStorage.removeItem('cn.cache.' + u); localStorage.removeItem('cn.cache.' + u + '.last'); } } catch {}
    S.auth = null; S.notes = []; S.sel = ''; clearTimeout(pollT); showLogin(expired ? 'Bitte melde dich neu an.' : ''); }
  function start() {
    if (!S.auth) return showLogin(); load(); applyPrefs();
    $app.innerHTML = `<div class="shell" id="sh"><section class="pane list"><div class="bar glass" id="lbar"><div class="row"><button class="ibtn" id="gear" aria-label="Einstellungen"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg></button><span class="sp"></span><span class="stat" id="stat"></span></div>
      <h1 class="big">Notizen</h1><input class="search" id="q" type="search" placeholder="Suchen" autocomplete="off"></div><div class="scroll" id="ls"></div>
      <button class="fab" id="nw" aria-label="Neue Notiz"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></button></section>
      <section class="pane edit" id="ed"></section></div>`;
    const q = $app.querySelector('#q'); q.value = S.q; q.oninput = () => { S.q = q.value; renderList(); };
    $app.querySelector('#nw').onclick = newNote; $app.querySelector('#gear').onclick = settings;
    $app.querySelector('#ls').addEventListener('scroll', e => $app.querySelector('#lbar').classList.toggle('sc', e.target.scrollTop > 30), { passive: true });
    renderList(); renderEditor(); setStat(); sync(true); schedule(); checkInfo();
  }
  function setStat() {
    const el = document.getElementById('stat'); if (!el) return; const dirty = S.notes.some(n => n._dirty);
    const m = S.sync === 'off' ? ['off', dirty ? 'Offline – wird später gesendet' : 'Offline'] : S.sync === 'err' ? ['bad', 'Fehler beim Sync'] : (S.sync === 'save' || dirty) ? ['sv', 'Speichert …'] : S.sync === 'run' ? ['sv', 'Aktualisiert …'] : S.loaded ? ['ok', 'Gespeichert'] : ['', ''];
    const t = '<i></i>' + esc(m[1]), c = 'stat ' + m[0]; if (el.className !== c) el.className = c; if (el.innerHTML !== t) el.innerHTML = t; el.title = S.err || '';
  }
  let lastList = '';
  function renderList() {
    const box = document.getElementById('ls'); if (!box) return; const l = sorted();
    const html = l.length ? `<div class="grp">${l.map(n => `<button class="item${n.id === S.sel ? ' sel' : ''}" data-id="${n.id}"><b>${esc(n.title || 'Neue Notiz')}</b><small><span class="d">${day(n.updated)}</span>${esc((n.body || 'Kein weiterer Text').replace(/\s+/g, ' ').slice(0, 80))}</small></button>`).join('')}</div>` : `<div class="empty">${S.q ? 'Keine Treffer.' : S.loaded ? 'Noch keine Notizen.<br>Tippe auf + für die erste.' : 'Lade Notizen …'}</div>`;
    if (html === lastList) return; lastList = html; const st = box.scrollTop; box.innerHTML = html; box.scrollTop = st;
    box.querySelectorAll('.item').forEach(b => b.onclick = () => pick(b.dataset.id));
  }
  function pick(id) { S.sel = id; S.open = true; lastList = ''; renderList(); renderEditor(); document.getElementById('sh').classList.add('open'); }
  function closeEditor() { S.open = false; const sh = document.getElementById('sh'); if (sh) sh.classList.remove('open'); if (S.sel && !cur()) S.sel = ''; renderEditor(); }
  function renderEditor() {
    const ed = document.getElementById('ed'); if (!ed) return; const n = cur();
    if (!n) { ed.innerHTML = `<div class="empty" style="margin:auto">Wähle eine Notiz oder lege eine neue an.</div>`; return; }
    ed.innerHTML = `<div class="bar glass"><div class="row"><button class="ibtn back" id="bk"><svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg> Notizen</button><span class="sp"></span><button class="ibtn" id="mn" aria-label="Mehr"><svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/></svg></button></div></div>
      <div class="ed"><div class="meta" id="mt"></div><input class="t" id="tt" maxlength="120" placeholder="Titel" autocomplete="off"><textarea class="b" id="bd" placeholder="Schreibe hier …"></textarea></div>`;
    const t = ed.querySelector('#tt'), b = ed.querySelector('#bd'); fillEditor(true);
    const onIn = () => { const c = cur(); if (!c) return; c.title = t.value; c.body = b.value; c.updated = Math.max(c.updated, Date.now()); queue(c.id); renderList(); };
    t.oninput = onIn; b.oninput = onIn; ed.querySelector('#bk').onclick = closeEditor; ed.querySelector('#mn').onclick = noteMenu;
    if (!n.body && !n.title) setTimeout(() => t.focus(), 380);
  }
  function fillEditor(force) { // Felder nur setzen, wenn sich der Inhalt wirklich unterscheidet und gerade nicht getippt wird
    const n = cur(), t = document.getElementById('tt'), b = document.getElementById('bd'); if (!n || !t || !b) return;
    if ((force || !typing()) && !(n._dirty && !force)) { if (t.value !== n.title) t.value = n.title; if (b.value !== n.body) b.value = n.body; }
    const m = document.getElementById('mt'); if (m) m.textContent = 'Geändert ' + new Date(n.updated).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
  }
  function newNote() { const t = Date.now(), n = { id: hex(18), title: '', body: '', created: t, updated: t, _dirty: true, _known: false }; S.notes.push(n); S.q = ''; const q = document.getElementById('q'); if (q) q.value = ''; persist(); pick(n.id); }

  // ---------- Blaetter ----------
  function sheet(html, onMount) {
    const bg = document.createElement('div'); bg.className = 'sheet-bg'; const sh = document.createElement('div'); sh.className = 'sheet glass'; sh.innerHTML = html;
    const close = () => { bg.remove(); sh.remove(); }; bg.onclick = close; document.body.append(bg, sh); onMount(sh, close);
  }
  function settings() {
    sheet(`<h3>Cloudy Notes</h3><div class="grp"><label>Darstellung<select id="th"><option value="auto">Automatisch</option><option value="light">Hell</option><option value="dark">Dunkel</option></select></label><label>Akzent<select id="ac"><option value="yellow">Gelb</option><option value="blue">Cloudy-Blau</option></select></label></div>
      <div class="grp"><label><span>Konto</span><span class="meta">${esc(S.auth.user)}</span></label><label><span>App-Version</span><span class="meta">${APP_VERSION} · API ${APP_API}</span></label></div>
      <div class="grp"><button class="item" id="chk"><b>Nach Updates suchen</b></button><button class="item" id="ex"><b>Alle Notizen exportieren</b></button><button class="item" id="lo"><b style="color:var(--danger)">Abmelden</b></button></div>`, (sh, close) => {
      sh.querySelector('#th').value = S.prefs.theme; sh.querySelector('#ac').value = S.prefs.accent;
      sh.querySelector('#th').onchange = e => { S.prefs.theme = e.target.value; ls('cn.prefs', S.prefs); applyPrefs(); }; sh.querySelector('#ac').onchange = e => { S.prefs.accent = e.target.value; ls('cn.prefs', S.prefs); applyPrefs(); };
      sh.querySelector('#chk').onclick = async () => { close(); toast('Suche …'); await checkInfo(); const r = await updateSW(); toast(r ? 'Update wird geladen …' : 'Du hast die neueste Version.'); };
      sh.querySelector('#ex').onclick = async () => { const r = await api('/notes/export', {}); if (!r.ok) return toast(r.error || 'Export fehlgeschlagen.'); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(r, null, 1)], { type: 'application/json' })); a.download = 'cloudy-notes.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); close(); };
      sh.querySelector('#lo').onclick = async () => { close(); if (S.notes.some(n => n._dirty)) { await flushAll(); if (S.notes.some(n => n._dirty)) return toast('Ungesendete Änderungen – bitte erst online gehen.'); } logout(false); };
    });
  }
  function noteMenu() {
    const n = cur(); if (!n) return;
    sheet(`<h3>${esc(n.title || 'Notiz')}</h3><div class="grp"><button class="item" id="hs"><b>Frühere Versionen</b></button><button class="item" id="dl"><b style="color:var(--danger)">Notiz löschen</b></button></div><div id="hb"></div>`, (sh, close) => {
      sh.querySelector('#dl').onclick = async () => { close(); const id = n.id; clearTimeout(timers[id]); const r = n._known ? await api('/notes/delete', { id }) : { ok: true }; if (!r.ok) return toast(r.error || 'Löschen fehlgeschlagen.'); S.notes = S.notes.filter(x => x.id !== id); persist(); closeEditor(); renderList(); };
      sh.querySelector('#hs').onclick = async () => { const hb = sh.querySelector('#hb'); const r = await api('/notes/history', { id: n.id }); const h = r.ok ? (r.history || r.versions || []) : []; hb.innerHTML = h.length ? `<div class="lab">Versionen</div><div class="grp">${h.map(v => `<button class="item" data-h="${v.hid}"><b>${esc(v.title || '')}</b><small>${day(v.t)} · ${esc((v.body || '').replace(/\s+/g, ' ').slice(0, 60))}</small></button>`).join('')}</div>` : '<div class="empty">Keine früheren Versionen.</div>';
        hb.querySelectorAll('[data-h]').forEach(b => b.onclick = async () => { const rr = await api('/notes/restore', { id: n.id, hid: +b.dataset.h }); if (rr.ok && rr.note) { n.title = rr.note.title; n.body = rr.note.body; n.updated = rr.note.updated; n._dirty = false; persist(); fillEditor(true); renderList(); close(); toast('Version wiederhergestellt.'); } else toast(rr.error || 'Fehlgeschlagen.'); }); };
    });
  }

  // ---------- Versionen & Updates (App-Dateien ueber Service Worker, Daten bleiben unberuehrt) ----------
  let swReg = null;
  async function checkInfo() { // Server-Version/API-Kompatibilitaet; aeltere Apps werden weiter bedient, solange minClientApi <= APP_API
    const r = await api('/notes/info', undefined, { anon: true }); if (!r.ok) return;
    S.old = r.minClientApi > APP_API; if (S.old) { banner('Diese App ist zu alt für den Server. Sie wird aktualisiert …', true); updateSW(); }
    else if (r.api > APP_API) { S.srvNewer = true; } // Server neuer, aber abwaertskompatibel: weiter nutzbar
  }
  function banner(t, noBtn, btn, fn) { document.querySelectorAll('.banner.up').forEach(b => b.remove()); const d = document.createElement('div'); d.className = 'banner up glass'; d.innerHTML = `<span>${esc(t)}</span>${noBtn ? '' : `<button class="btn pri">${esc(btn)}</button>`}`; if (!noBtn) d.querySelector('button').onclick = fn; document.body.appendChild(d); }
  async function updateSW() { if (!swReg) return false; try { await swReg.update(); } catch {} return !!(swReg.installing || swReg.waiting); }
  function applyUpdate() { // Daten sind in localStorage – der Neustart der Seite verliert nichts. Ungespeichertes wird vorher gesendet.
    const w = swReg && swReg.waiting; if (!w) return; flushAll().finally(() => w.postMessage({ type: 'SKIP_WAITING' }));
  }
  function initSW() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('sw.js', { scope: './', updateViaCache: 'none' }).then(reg => {
      swReg = reg;
      const onWait = () => { if (!reg.waiting || !navigator.serviceWorker.controller) return; if (!S.notes.some(n => n._dirty) && !typing()) applyUpdate(); else banner('Update verfügbar.', false, 'Jetzt aktualisieren', applyUpdate); };
      reg.addEventListener('updatefound', () => { const w = reg.installing; if (w) w.addEventListener('statechange', () => { if (w.state === 'installed') onWait(); }); }); onWait();
      setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000);
    }).catch(() => {});
    let reloaded = false; const had = !!navigator.serviceWorker.controller; navigator.serviceWorker.addEventListener('controllerchange', () => { // genau ein Neuladen, nie in Schleife; beim allerersten Installieren nicht (keine Vorgaenger-Version)
      if (reloaded || !had) return; const t = +sessionStorage.getItem('cn.rl') || 0; if (Date.now() - t < 20000) return; reloaded = true; try { sessionStorage.setItem('cn.rl', Date.now()); } catch {} location.reload(); });
  }

  // ---------- Start ----------
  applyPrefs(); matchMedia('(prefers-color-scheme:dark)').addEventListener && matchMedia('(prefers-color-scheme:dark)').addEventListener('change', applyPrefs);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && S.auth) { sync(false); checkInfo(); if (swReg) swReg.update().catch(() => {}); } else if (document.hidden) for (const n of S.notes.filter(x => x._dirty)) save(n.id, true); });
  addEventListener('online', () => sync(false)); addEventListener('offline', () => { S.sync = 'off'; setStat(); });
  addEventListener('pagehide', () => { for (const n of S.notes.filter(x => x._dirty)) save(n.id, true); });
  window.cloudyNotesApp = { version: APP_VERSION, api: APP_API, state: S, sync };
  initSW(); start();
})();
