// Cloudy 2.0 – Notes (nur Owner). Nutzt das bestehende Notes-System des Cloudy-Servers (/notes/list, /notes/save, /notes/delete).
// Der Launcher blendet den Tab nur für den Owner ein; entscheidend ist die Prüfung des Servers (403 owner_only) und im Hauptprozess (notesCall).
(function () {
  const root = document.getElementById('p-notes'); if (!root) return;
  const C = () => window.cloudy, L = s => (window.t ? window.t(s) : s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const S = { notes: [], cur: null, loading: false, err: '', status: '', dirty: false, saving: false, conflict: null };
  let timer = 0, vis = false;
  const locale = () => (document.documentElement.lang === 'de' ? 'de-DE' : 'en-GB');
  const byId = id => S.notes.find(n => n.id === id);
  const sorted = () => S.notes.filter(n => !n.deleted).sort((a, b) => b.updated - a.updated);

  function denied(r) { return r && r.code === 'owner_only'; }
  function shell() {
    root.innerHTML = `<div class="notes-head"><h2>Notes</h2><span class="pill">${esc(L('Nur Owner'))}</span></div><p class="muted" id="nErr" role="alert"></p>
      <div class="notes-grid"><aside class="glass notes-list"><button class="btn" type="button" id="nNew">+ ${esc(L('Neue Notiz'))}</button><div id="nList"></div></aside>
      <section class="glass notes-ed"><input class="field" id="nTitle" maxlength="200" placeholder="${esc(L('Titel'))}" autocomplete="off"><textarea class="field" id="nBody" placeholder="${esc(L('Schreibe deine Idee auf …'))}" spellcheck="true"></textarea>
        <div class="notes-bar"><span class="muted" id="nStat"></span><span class="grow"></span><button class="btn ghost" type="button" id="nDel">${esc(L('Löschen'))}</button><button class="btn" type="button" id="nSave">${esc(L('Speichern'))}</button></div></section></div>`;
    root.querySelector('#nNew').onclick = newNote; root.querySelector('#nSave').onclick = () => save(true); root.querySelector('#nDel').onclick = del;
    root.querySelector('#nTitle').oninput = root.querySelector('#nBody').oninput = onEdit;
  }
  function paintList() {
    const l = root.querySelector('#nList'); if (!l) return;
    const a = sorted();
    l.innerHTML = a.length ? a.map(n => `<button type="button" class="nitem${n.id === S.cur ? ' on' : ''}" data-id="${n.id}"><b>${esc(n.title || L('Neue Notiz'))}</b><small class="muted">${esc(new Date(n.updated).toLocaleString(locale(), { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }))}</small></button>`).join('') : `<p class="muted">${esc(S.loading ? L('Lädt …') : L('Noch keine Notizen.'))}</p>`;
    l.querySelectorAll('[data-id]').forEach(b => b.onclick = () => open(b.dataset.id));
  }
  function paintEd() {
    const n = byId(S.cur), t = root.querySelector('#nTitle'), b = root.querySelector('#nBody'); if (!t) return;
    t.disabled = b.disabled = !n; root.querySelector('#nDel').disabled = !n; root.querySelector('#nSave').disabled = !n;
    t.value = n ? n.title : ''; b.value = n ? n.body : '';
    stat();
  }
  function stat() { const s = root.querySelector('#nStat'); if (s) s.textContent = S.conflict ? '' : L(S.status); const e = root.querySelector('#nErr'); if (e) e.textContent = S.err ? L(S.err) : ''; }
  async function load() {
    S.loading = true; S.err = ''; paintList();
    const r = await C().notesCall({ a: 'list' }).catch(() => null);
    S.loading = false;
    if (denied(r)) { S.notes = []; if (window.onOwner) window.onOwner(false); return; }
    if (!r || !r.ok) { S.err = (r && r.error) || 'Notizen konnten nicht geladen werden.'; paintList(); stat(); return; }
    S.notes = r.notes || []; if (!byId(S.cur) || byId(S.cur).deleted) S.cur = (sorted()[0] || {}).id || null;
    paintList(); paintEd();
  }
  function open(id) { flush(); S.cur = id; S.dirty = false; S.status = ''; S.conflict = null; paintList(); paintEd(); }
  function onEdit() { const n = byId(S.cur); if (!n) return; S.dirty = true; S.status = 'Ungespeicherte Änderungen …'; stat(); clearTimeout(timer); timer = setTimeout(() => save(false), 1500); }
  function flush() { if (S.dirty) { clearTimeout(timer); save(false); } }
  async function save(manual, force) {
    const n = byId(S.cur); if (!n || S.saving) return; clearTimeout(timer);
    const title = root.querySelector('#nTitle').value, body = root.querySelector('#nBody').value; S.saving = true; S.status = 'Speichert …'; stat();
    const r = await C().notesCall({ a: 'save', id: n.id, title, body, base: n.updated, force: !!force }).catch(() => null);
    S.saving = false;
    if (denied(r)) { if (window.onOwner) window.onOwner(false); return; }
    if (r && r.conflict) { S.conflict = r.note; S.status = ''; conflictUi(); return; }
    if (!r || !r.ok) { S.status = ''; S.err = (r && r.error) || 'Speichern fehlgeschlagen.'; stat(); return; }
    S.err = ''; Object.assign(n, r.note); S.dirty = false; S.conflict = null; S.status = 'Gespeichert'; paintList(); stat();
  }
  function conflictUi() {
    window.v2Modal({ title: 'Notiz wurde woanders geändert', text: 'Diese Notiz wurde auf einem anderen Gerät geändert. Was möchtest du behalten?',
      buttons: [{ label: 'Server-Version laden', cls: 'ghost', run: api => { const n = byId(S.cur); Object.assign(n, S.conflict); S.conflict = null; S.dirty = false; api.close(); paintList(); paintEd(); } },
        { label: 'Meine Version behalten', run: api => { const n = byId(S.cur); n.updated = S.conflict.updated; api.close(); save(true, true); } }] });
  }
  async function newNote() {
    flush(); const id = [...crypto.getRandomValues(new Uint8Array(9))].map(x => x.toString(16).padStart(2, '0')).join('');
    const r = await C().notesCall({ a: 'save', id, title: L('Neue Notiz'), body: '' }).catch(() => null);
    if (denied(r)) { if (window.onOwner) window.onOwner(false); return; }
    if (!r || !r.ok) { S.err = (r && r.error) || 'Speichern fehlgeschlagen.'; stat(); return; }
    S.notes.push(r.note); S.cur = r.note.id; S.err = ''; paintList(); paintEd(); const t = root.querySelector('#nTitle'); if (t) { t.focus(); t.select(); }
  }
  function del() {
    const n = byId(S.cur); if (!n) return;
    window.v2Modal({ danger: true, title: 'Notiz löschen?', text: 'Die Notiz wird gelöscht. Frühere Versionen bleiben in der Versionshistorie des Servers.',
      buttons: [{ label: 'Abbrechen', cls: 'ghost' }, { label: 'Löschen', cls: 'danger', run: async api => {
        api.busy(true); const r = await C().notesCall({ a: 'del', id: n.id }).catch(() => null);
        if (!r || !r.ok) { api.busy(false); api.err((r && r.error) || 'Löschen fehlgeschlagen.'); return; }
        n.deleted = true; S.cur = (sorted()[0] || {}).id || null; S.dirty = false; api.close(); paintList(); paintEd(); } }] });
  }
  const ps = window.paintSub;
  window.paintSub = p => {
    if (ps) ps(p);
    if (p === 'notes') {
      if (!window.isCloudyOwner || !window.isCloudyOwner()) { if (window.go) setTimeout(() => window.go('home'), 0); return; }
      vis = true; shell(); load();
    } else if (vis) { vis = false; flush(); }
  };
  window.addEventListener('cloudy-owner', e => { if (!e.detail) { S.notes = []; S.cur = null; S.dirty = false; root.innerHTML = ''; } });
  window.addEventListener('cloudy-refresh', () => { if (vis && !S.dirty) load(); });
  const sl = window.setLang; if (sl) window.setLang = l => { sl(l); if (vis && !S.dirty) { shell(); paintList(); paintEd(); } };
})();
