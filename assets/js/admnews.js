// Cloudy – Admin: News schreiben, bearbeiten, loeschen. Zielgruppen (alle / Tester / Admin) setzt und prueft der Server.
(function () {
  const $ = s => document.querySelector(s); if (!$('#nwSave')) return;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const AUD = { all: 'Alle', tester: 'Tester', admin: 'Admin' };
  let list = [], editId = '';
  const msg = (t, ok) => { const m = $('#nwMsg'); m.textContent = t || ''; m.style.color = ok ? 'var(--accent)' : ''; };
  const call = async o => { try { return await window.cloudy.admNews(o); } catch { return { ok: false, error: 'Fehlgeschlagen.' }; } };
  const clear = () => { editId = ''; $('#nwTitle').value = ''; $('#nwBody').value = ''; $('#nwAud').value = 'all'; $('#nwSave').textContent = 'Veröffentlichen'; };
  const draw = () => {
    $('#nwList').innerHTML = list.length ? list.map(n => `<div class="glass" style="padding:8px 10px;margin:6px 0"><b>${esc(n.title)}</b> <span class="ctag ${n.aud === 'admin' ? 'owner' : n.aud === 'tester' ? 'tester' : 'plus'}">${AUD[n.aud] || n.aud}</span> <span class="muted" style="font-size:12px">${new Date(n.ts).toLocaleString()} · ${esc(n.by || '')}</span>
      <div class="muted" style="white-space:pre-wrap;margin:4px 0">${esc(n.body.slice(0, 200))}${n.body.length > 200 ? ' …' : ''}</div>
      <div class="tools" style="gap:6px;margin:0"><button class="btn ghost" data-nwe="${n.id}">Bearbeiten</button><button class="btn ghost" data-nwd="${n.id}">Löschen</button></div></div>`).join('') : '<span class="muted">Noch keine News.</span>';
    document.querySelectorAll('[data-nwe]').forEach(b => b.onclick = () => { const n = list.find(x => x.id === b.dataset.nwe); if (!n) return; editId = n.id; $('#nwTitle').value = n.title; $('#nwBody').value = n.body; $('#nwAud').value = n.aud; $('#nwSave').textContent = 'Änderung speichern'; $('#nwTitle').focus(); });
    document.querySelectorAll('[data-nwd]').forEach(b => b.onclick = async () => { const n = list.find(x => x.id === b.dataset.nwd); if (!n || !confirm('News „' + n.title + '“ löschen?')) return; const r = await call({ a: 'del', id: n.id }); msg(r.ok ? 'Gelöscht ✓' : r.error, r.ok); if (r.ok) { if (editId === n.id) clear(); load(); } });
  };
  async function load() { const r = await call({ a: 'list' }); if (r.ok) { list = r.news || []; draw(); } else $('#nwList').innerHTML = `<span class="muted">${esc(r.error)}</span>`; }
  $('#nwSave').onclick = async () => {
    const o = { a: 'save', id: editId || undefined, title: $('#nwTitle').value, body: $('#nwBody').value, aud: $('#nwAud').value };
    if (!o.title.trim() || !o.body.trim()) return msg('Titel und Text eintragen.');
    const r = await call(o); msg(r.ok ? 'Gespeichert ✓' : r.error, r.ok); if (r.ok) { clear(); load(); }
  };
  $('#nwNew').onclick = () => { clear(); msg(''); };
  const ps = window.paintSub; window.paintSub = p => { if (ps) ps(p); if (p === 'settings' || p === 'admin') load(); };
  setTimeout(load, 1800);
})();
