// Cloudy 2.0 – Oberfläche: Logo-Refresh, Icon-Tooltips, Owner-Rechte, Token-Anzeige, Konto-Bereich (Microsoft / Cloudy getrennt),
// Abmelde-Warnung, Microsoft-Anmeldung, Autostart-Schalter und Admin-Benutzersuche.
// Alle Texte sind deutsche Schlüssel; die Übersetzung kommt aus i18n-v2.js (window.t).
(function () {
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const C = () => window.cloudy, L = s => (window.t ? window.t(s) : s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const locale = () => (document.documentElement.lang === 'de' ? 'de-DE' : 'en-GB');
  const num = n => Number(n || 0).toLocaleString(locale());
  let isOwner = false;

  // ---------- Modal (Warnungen, Meldungen) – ein Dialog gleichzeitig ----------
  window.v2Modal = function (o) {
    const old = $('.v2-modal'); if (old) old.remove();
    const d = document.createElement('div'); d.className = 'v2-modal'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true');
    d.innerHTML = `<div class="v2-box ${o.danger ? 'danger' : ''}"><div class="v2-ic">${o.icon || ''}</div><h3>${esc(L(o.title))}</h3><div class="v2-body">${o.html || '<p>' + esc(L(o.text || '')) + '</p>'}</div><p class="v2-err" id="v2Err" role="alert"></p><div class="v2-btns">${(o.buttons || []).map((b, i) => `<button type="button" class="btn ${b.cls || ''}" data-i="${i}">${esc(L(b.label))}</button>`).join('')}</div></div>`;
    document.body.appendChild(d);
    let busy = false;
    const api = { el: d, err: t => { const e = d.querySelector('#v2Err'); if (e) e.textContent = t ? L(t) : ''; }, busy: v => { busy = v; d.querySelectorAll('button').forEach(b => b.disabled = v); }, close: () => { document.removeEventListener('keydown', key); d.remove(); } };
    const key = e => { if (e.key === 'Escape' && !busy) api.close(); };
    document.addEventListener('keydown', key);
    d.onclick = e => { if (e.target === d && !busy) api.close(); };
    d.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { const f = (o.buttons[+b.dataset.i] || {}).run; if (f) f(api); else api.close(); });
    const first = d.querySelector('[data-i]'); if (first) first.focus();
    return api;
  };

  // ---------- Icon-Buttons oben links: Beschreibung beim Hover aus dem (übersetzten) Label ----------
  function tip(btn) {
    const sp = btn.querySelector('.sr'); if (!sp) return;
    const set = () => { const t = sp.textContent.trim(); btn.title = t; btn.setAttribute('aria-label', t); };
    set(); new MutationObserver(set).observe(sp, { childList: true, characterData: true, subtree: true });
  }
  ['#musicBtn', '#themeBtn'].forEach(s => { const b = $(s); if (b) tip(b); });

  // ---------- Refresh über das Logo ----------
  let rbusy = false;
  function closeOverlays() { $$('.adm-ov,.news-ov,.v2-modal,#vpop').forEach(e => { if (e.id === 'vpop') e.style.display = 'none'; else e.remove(); }); const m = $('#lgMenu'); if (m) m.classList.remove('on'); }
  window.cloudyRefresh = async function () {
    if (rbusy) return; rbusy = true;
    const b = $('#brandBtn'); if (b) { b.classList.add('spinning'); b.setAttribute('aria-busy', 'true'); }
    try {
      // Nur Daten neu laden – kein Neustart: laufende Downloads/Spiele/Hintergrundprozesse bleiben unberührt
      await Promise.allSettled([C().accRefresh(), window.refreshAccount && window.refreshAccount(), window.pollShop && window.pollShop()]);
      const s = await C().authState().catch(() => null);
      if (s) {
        if (!s.user && !s.offline && !window.__offline) { $('#login').classList.remove('off'); if (window.lgSet) window.lgSet('in', ''); if (s.msMismatch) setMsMsg('Das angemeldete Microsoft-Konto gehört zu einem anderen Cloudy-Konto. Bitte neu anmelden.'); }
        else window.onOwner(!!s.owner);
      }
      await Promise.allSettled([tokens.refresh(), paintAccountCard(), loadBoot()]);
      try { const a = $('#admRef'); if (a && a.offsetParent) a.click(); } catch {}
      window.dispatchEvent(new CustomEvent('cloudy-refresh'));
      closeOverlays();
      if (window.go) window.go('home'); // definierter Zustand: Startseite
    } catch (e) { console.warn('Refresh', e); }
    finally { setTimeout(() => { if (b) { b.classList.remove('spinning'); b.removeAttribute('aria-busy'); } rbusy = false; }, 600); }
  };
  { const b = $('#brandBtn'); if (b) b.onclick = () => window.cloudyRefresh(); }

  // ---------- Owner-Rechte (Notes, Token-Anzeige) ----------
  window.onOwner = function (on) {
    on = !!on; const changed = on !== isOwner; isOwner = on;
    const nav = $('#notesNav'); if (nav) nav.hidden = !on;
    const tc = $('#tokCard'); if (tc) tc.hidden = !on;
    if (on) tokens.start(); else { tokens.stop(); const np = $('#p-notes'); if (np && np.classList.contains('on') && window.go) window.go('home'); }
    if (changed) window.dispatchEvent(new CustomEvent('cloudy-owner', { detail: on }));
  };
  window.isCloudyOwner = () => isOwner;

  // ---------- Wochen-Tokens (echte Werte vom Server: Verbrauch laut KI-Anbieter, Limit trägt der Owner ein) ----------
  const tokens = (function () {
    let st = { s: 'idle', d: null, e: '' }, timer = 0, editing = false;
    const card = () => $('#tokCard');
    function fmtReset(ms) { const d = new Date(ms); return d.toLocaleDateString(locale(), { weekday: 'short', day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' }); }
    function paint() {
      const c = card(); if (!c || c.hidden) return;
      const ic = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
      let h = `<div class="tokh">${ic}<b>${esc(L('Wochen-Tokens'))}</b><button type="button" class="tokr" id="tokRef" title="${esc(L('Aktualisieren'))}" aria-label="${esc(L('Aktualisieren'))}"><svg viewBox="0 0 24 24"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/></svg></button></div>`;
      if (st.s === 'load' && !st.d) h += `<div class="tokskel"></div><small class="muted">${esc(L('Lädt …'))}</small>`;
      else if (st.s === 'err' && !st.d) h += `<small class="tokerr">${esc(L(st.e))}</small>`;
      else if (st.d) {
        const d = st.d, has = d.limit != null;
        h += has ? `<div class="tokbig"><b>${num(d.remaining)}</b><span>${esc(L('übrig'))}</span></div><div class="bar"><i style="width:${Math.min(100, Math.round(100 * d.used / d.limit))}%"></i></div><small class="muted">${num(d.used)} ${esc(L('verbraucht'))} · ${esc(L('Limit'))} ${num(d.limit)}</small>`
          : `<div class="tokbig"><b>${num(d.used)}</b><span>${esc(L('verbraucht'))}</span></div><small class="muted">${esc(L('Noch kein Wochenlimit eingetragen – „übrig“ lässt sich erst mit Limit berechnen.'))}</small>`;
        h += `<small class="muted">${esc(L('Zurücksetzung'))}: ${esc(fmtReset(d.resetAt))}</small>`;
        if (st.s === 'err') h += `<small class="tokerr">${esc(L(st.e))}</small>`;
        h += editing ? `<div class="toked"><input class="field" id="tokLim" type="number" min="0" step="1000" placeholder="${esc(L('Tokens pro Woche'))}" value="${d.limit || ''}"><button class="btn" type="button" id="tokSave">${esc(L('Speichern'))}</button></div>` : `<button class="chip" type="button" id="tokEdit">${esc(L(has ? 'Limit ändern' : 'Limit festlegen'))}</button>`;
      }
      c.innerHTML = h;
      const r = $('#tokRef'); if (r) r.onclick = () => refresh();
      const e = $('#tokEdit'); if (e) e.onclick = () => { editing = true; paint(); };
      const sv = $('#tokSave'); if (sv) sv.onclick = async () => { const v = Math.round(+$('#tokLim').value); if (!Number.isFinite(v) || v < 0) return; sv.disabled = true; editing = false; await refresh(v); };
    }
    async function refresh(limit) {
      if (!isOwner) return; st.s = 'load'; paint();
      try {
        const r = await C().notesCall(limit === undefined ? { a: 'usage' } : { a: 'usage', limit });
        if (r && r.ok) st = { s: 'ok', d: r, e: '' }; else st = { s: 'err', d: st.d, e: (r && r.error) || 'Tokens konnten nicht geladen werden.' };
      } catch { st = { s: 'err', d: st.d, e: 'Tokens konnten nicht geladen werden.' }; }
      paint();
    }
    return {
      refresh, start() { if (!timer) { refresh(); timer = setInterval(() => { if (!document.hidden) refresh(); }, 60000); } }, stop() { clearInterval(timer); timer = 0; st = { s: 'idle', d: null, e: '' }; editing = false; const c = card(); if (c) c.innerHTML = ''; },
      repaint: paint
    };
  })();
  window.cloudyTokens = tokens;
  window.addEventListener('cloudy-tokens', () => tokens.refresh());

  // ---------- Konto-Bereich: Microsoft und Cloudy getrennt ----------
  const badge = (el, ok, yes, no) => { if (!el) return; el.className = 'acstate ' + (ok ? 'ok' : 'off'); el.textContent = L(ok ? yes : no); };
  async function paintAccountCard() {
    if (!$('#acMs')) return;
    let i; try { i = await C().accountInfo(); } catch { i = { ms: null, cloudy: null }; }
    badge($('#acMsState'), !!i.ms, 'Angemeldet', 'Nicht angemeldet');
    const cl = i.cloudy; badge($('#acClState'), !!cl && !cl.unreachable, 'Angemeldet', cl && cl.unreachable ? 'Server nicht erreichbar' : 'Nicht angemeldet');
    const o = $('#acClOut'), sub = $('#acClSub');
    if (!o) return;
    if (!cl) { o.textContent = L(window.__offline ? 'Offline-Modus: kein Cloudy-Konto angemeldet.' : 'Kein Cloudy-Konto angemeldet.'); }
    else if (cl.msLinked) o.textContent = L('Angemeldet als') + ' ' + cl.name + ' · ' + L('verknüpft mit Microsoft-Konto') + ' ' + (cl.msName || '') + ' (' + String(cl.msId || '').slice(0, 8) + '…)' + (i.ms && String(i.ms.uuid).replace(/-/g, '').toLowerCase() !== cl.msId ? ' · ⚠ ' + L('auf diesem PC ist ein anderes Microsoft-Konto angemeldet') : '');
    else o.textContent = L('Angemeldet als') + ' ' + cl.name + ' · ⚠ ' + L('noch nicht mit einem Microsoft-Konto verknüpft');
    if (sub) sub.textContent = cl && cl.owner ? L('Owner-Konto') : cl && cl.admin ? L('Admin-Konto') : L('Konto im Cloudy-Client');
    const ob = $('#authOut'); if (ob) ob.disabled = !cl && !window.__offline;
  }
  window.paintAccountCard = paintAccountCard;
  const ps0 = window.paintSub; window.paintSub = p => { if (ps0) ps0(p); if (p === 'settings') { paintAccountCard(); loadBoot(); } };

  // ---------- Von Cloudy abmelden (mit Warnung) ----------
  let outBusy = false;
  async function doLogout(api) {
    if (outBusy) return; outBusy = true; if (api) api.busy(true);
    try {
      const r = await C().authLogout();
      if (r && r.ok === false) { if (api) { api.busy(false); api.err(r.error || 'Abmelden fehlgeschlagen.'); } return; }
      if (window.setOffline) window.setOffline(false);
      window.onOwner(false);
      if (api) api.close();
      $('#login').classList.remove('off'); if (window.lgSet) window.lgSet('in', ''); if (window.__paintAdmin) window.__paintAdmin(false);
      setMsMsg(''); paintAccountCard();
    } catch (e) { if (api) { api.busy(false); api.err('Abmelden fehlgeschlagen: ' + String((e && e.message) || e).slice(0, 100)); } }
    finally { outBusy = false; }
  }
  { const b = $('#authOut'); if (b) b.onclick = ev => {
    if (!ev || !ev.isTrusted) return doLogout(null); // programmatisch (z. B. nach Konto-Löschung, Offline-Leiste): ohne Nachfrage
    if (window.__offline) return doLogout(null);
    window.v2Modal({ danger: true, title: 'Von Cloudy abmelden?', icon: '<svg viewBox="0 0 24 24"><path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/></svg>',
      html: `<p>${esc(L('Du wirst nur aus dem Cloudy-Konto auf diesem PC abgemeldet. Die Cloudy-Sitzung und die lokalen Anmeldedaten werden entfernt.'))}</p><ul><li>${esc(L('Dein Microsoft-Konto bleibt angemeldet.'))}</li><li>${esc(L('Dein Cloudy-Konto, Coins, Items und Fortschritt bleiben auf dem Server erhalten.'))}</li><li>${esc(L('Zum Weiterspielen mit Cloudy-Funktionen meldest du dich wieder über Microsoft an.'))}</li></ul>`,
      buttons: [{ label: 'Abbrechen', cls: 'ghost' }, { label: 'Abmelden', cls: 'danger', run: api => doLogout(api) }] });
  }; }
  window.cloudyLogout = () => doLogout(null);

  // ---------- Microsoft-Anmeldung (einzige Anmeldung) ----------
  function setMsMsg(t, ok) { const m = $('#lgMsMsg'); if (m) { m.textContent = t ? L(t) : ''; m.style.color = ok ? 'var(--accent)' : ''; } }
  let msBusy = false, lastName = '';
  async function afterLogin(r) {
    if (!r || !r.ok) {
      if (r && r.code === 'no_link') { lastName = (r.msName || '').replace(/[^\w]/g, '').slice(0, 16); const ni = $('#lgNewName'); if (ni && !ni.value) ni.value = lastName; $('#lgCreate').hidden = false; const lb = $('#lgLinkBox'); if (lb) lb.open = true; }
      setMsMsg((r && r.error) || 'Anmeldung fehlgeschlagen.'); return;
    }
    $('#lgCreate').hidden = true; setMsMsg('');
    if (window.lgDone) window.lgDone(r.user, !!r.first, r.admin, r.owner);
    window.dispatchEvent(new CustomEvent('cloudy-refresh')); paintAccountCard();
  }
  async function msRun(fn) {
    if (msBusy) return; msBusy = true; $$('#lgMsPanel button').forEach(b => b.disabled = true); setMsMsg('Microsoft-Fenster geöffnet …', true);
    try { await afterLogin(await fn()); } catch (e) { setMsMsg('Anmeldung fehlgeschlagen: ' + String((e && e.message) || e).slice(0, 100)); }
    finally { msBusy = false; $$('#lgMsPanel button').forEach(b => b.disabled = false); }
  }
  const rem = () => !($('#lgMsRem') && !$('#lgMsRem').checked);
  { const b = $('#lgMsBtn'); if (b) b.onclick = () => msRun(() => C().cloudyMsLogin({ remember: rem() })); }
  { const b = $('#lgCreateBtn'); if (b) b.onclick = () => { const n = $('#lgNewName').value.trim(); if (!/^[A-Za-z0-9_]{3,16}$/.test(n)) return setMsMsg('Benutzername: 3–16 Zeichen, nur Buchstaben, Zahlen und _.'); msRun(() => C().cloudyMsLogin({ remember: rem(), create: { user: n } })); }; }
  { const b = $('#lgLinkBtn'); if (b) b.onclick = () => { const u = $('#lgOldUser').value.trim(), p = $('#lgOldPass').value; if (!u || !p) return setMsMsg('Bitte Benutzername und Passwort deines bisherigen Kontos eingeben.'); msRun(async () => { const r = await C().cloudyMsLink({ remember: rem(), user: u, pass: p }); $('#lgOldPass').value = ''; return r; }); }; }
  C().on('acctLocked', m => { setMsMsg(m || 'Konto gesperrt.'); window.onOwner(false); });

  // ---------- Autostart ----------
  async function loadBoot() {
    const cb = $('#bootOn'); if (!cb) return;
    try {
      const r = await C().autostartGet(); cb.disabled = !r.supported; cb.checked = !!r.enabled;
      const m = $('#bootMsg'); if (m) m.textContent = r.supported ? '' : L(r.packaged ? 'Autostart gibt es nur unter Windows und macOS.' : 'Im Entwicklungsmodus nicht verfügbar – nur in der installierten App.');
    } catch { cb.disabled = true; }
  }
  { const cb = $('#bootOn'); if (cb) cb.onchange = async () => {
    const want = cb.checked, m = $('#bootMsg'); cb.disabled = true;
    try {
      const r = await C().autostartSet(want);
      if (!r || !r.ok) { cb.checked = !want; if (m) m.textContent = L((r && r.error) || 'Autostart konnte nicht geändert werden.'); }
      else if (m) m.textContent = L(want ? 'Cloudy startet jetzt mit dem Computer.' : 'Cloudy startet nicht mehr automatisch.');
    } catch { cb.checked = !want; if (m) m.textContent = L('Autostart konnte nicht geändert werden.'); }
    cb.disabled = false;
  }; }
  loadBoot();

  // ---------- Admin: Benutzersuche ----------
  (function () {
    const q = $('#admQ'); if (!q) return;
    const res = $('#admQRes'), state = $('#admQState'); let seq = 0, timer = 0, offset = 0, rows = [];
    const ago = ms => new Date(ms).toLocaleDateString(locale());
    function paint(more, total) {
      res.hidden = false;
      if (!rows.length) { res.innerHTML = `<p class="muted">${esc(L('Keine Benutzer gefunden.'))}</p>`; return; }
      res.innerHTML = rows.map(u => `<div class="arow clk srow" data-sopen="${esc(u.name)}"><span class="arn"><b>${esc(u.name)}</b> ${u.banned ? '<span class="pill">' + esc(L('gesperrt')) + '</span>' : ''}${u.paused ? '<span class="pill">' + esc(L('pausiert')) + '</span>' : ''}${(u.tags || []).map(t => '<span class="pill">' + esc(t) + '</span>').join('')}<small class="muted"> · ${esc(L('Microsoft'))}: ${u.msLinked ? esc(u.msName || '') + ' (' + esc(String(u.msId).slice(0, 8)) + '…)' : esc(L('nicht verknüpft'))} · ${esc(L('seit'))} ${esc(ago(u.created))}</small></span><span class="aro">›</span></div>`).join('') + (more ? `<button class="btn ghost" type="button" id="admQMore">${esc(L('Mehr laden'))} (${rows.length}/${total})</button>` : `<small class="muted">${rows.length} ${esc(L('Treffer'))}</small>`);
      res.querySelectorAll('[data-sopen]').forEach(r => r.onclick = () => { const t = $$('#admList [data-open]').find(x => x.dataset.open.toLowerCase() === r.dataset.sopen.toLowerCase()); if (t) t.click(); else state.textContent = L('Liste aktualisieren (Aktualisieren-Knopf), dann erneut öffnen.'); });
      const mb = $('#admQMore'); if (mb) mb.onclick = () => run(true);
    }
    async function run(append) {
      const term = q.value.trim(), my = ++seq;
      if (!term) { res.hidden = true; state.textContent = ''; rows = []; return; }
      if (!append) { offset = 0; rows = []; }
      state.textContent = L('Suche …');
      let r; try { r = await C().authSearch({ q: term, offset, limit: 25 }); } catch { r = { ok: false, error: 'Suche fehlgeschlagen.' }; }
      if (my !== seq) return; // veraltete Antwort
      if (!r || !r.ok) { state.textContent = L((r && r.error) || 'Suche fehlgeschlagen.'); return; }
      state.textContent = ''; rows = rows.concat(r.users || []); offset = rows.length; paint(!!r.more, r.total);
    }
    q.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => run(false), 250); });
    q.addEventListener('keydown', e => { if (e.key === 'Escape') { q.value = ''; run(false); } });
  })();

  // Erststart: Owner-Status steht schon über lgDone (features.js) – nichts weiter nötig
})();
