// Cloudy – Admin: Cloudy+-Codes erstellen, abschalten, loeschen. Pruefung und Einloesung macht der Server.
(function () {
  const $ = s => document.querySelector(s); if (!$('#pcMake')) return;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const DN = { 7: '1 Woche', 30: '1 Monat', 90: '3 Monate', 180: '6 Monate', 365: '12 Monate' };
  let list = [];
  const msg = (t, ok) => { const m = $('#pcMsg'); m.textContent = t || ''; m.style.color = ok ? 'var(--accent)' : ''; };
  const call = async o => { try { return await window.cloudy.admPlusCodes(o); } catch { return { ok: false, error: 'Fehlgeschlagen.' }; } };
  const draw = () => {
    $('#pcList').innerHTML = list.length ? list.map(c => { const exp = c.exp && c.exp < Date.now(), full = c.used >= c.uses, st = c.off ? 'abgeschaltet' : exp ? 'abgelaufen' : full ? 'aufgebraucht' : 'aktiv';
      return `<div class="glass" style="padding:8px 10px;margin:6px 0;${c.off || exp || full ? 'opacity:.7' : ''}"><b><code>${esc(c.code)}</code></b> <span class="muted">· ${DN[c.days] || c.days + ' Tage'} · ${c.used}/${c.uses} eingelöst · ${st}${c.exp ? ' · bis ' + new Date(c.exp).toLocaleDateString('de-DE') : ''}${c.note ? ' · ' + esc(c.note) : ''}</span>
      <div class="tools" style="gap:6px;margin:6px 0 0"><button class="btn ghost" data-pcc="${esc(c.code)}">Kopieren</button><button class="btn ghost" data-pct="${esc(c.code)}">${c.off ? 'Aktivieren' : 'Abschalten'}</button><button class="btn ghost" data-pcd="${esc(c.code)}">Löschen</button></div></div>`; }).join('') : '<span class="muted">Noch keine Codes.</span>';
    document.querySelectorAll('[data-pcc]').forEach(b => b.onclick = async () => { try { await navigator.clipboard.writeText(b.dataset.pcc); msg('Kopiert ✓', true); } catch { msg(b.dataset.pcc); } });
    document.querySelectorAll('[data-pct]').forEach(b => b.onclick = async () => { const r = await call({ a: 'toggle', code: b.dataset.pct }); if (!r.ok) msg(r.error); load(); });
    document.querySelectorAll('[data-pcd]').forEach(b => b.onclick = async () => { if (!confirm('Code ' + b.dataset.pcd + ' löschen?')) return; const r = await call({ a: 'del', code: b.dataset.pcd }); if (!r.ok) msg(r.error); load(); });
  };
  async function load() { const r = await call({ a: 'list' }); if (r.ok) { list = r.codes || []; draw(); } else $('#pcList').innerHTML = `<span class="muted">${esc(r.error)}</span>`; }
  $('#pcMake').onclick = async () => { const r = await call({ a: 'create', days: +$('#pcDays').value, uses: +$('#pcUses').value || 1, expDays: +$('#pcExp').value || 0, note: $('#pcNote').value }); msg(r.ok ? 'Code ' + r.code + ' erstellt ✓' : r.error, r.ok); if (r.ok) { $('#pcNote').value = ''; load(); } };
  const ps = window.paintSub; window.paintSub = p => { if (ps) ps(p); if (p === 'settings' || p === 'admin') load(); };
  setTimeout(load, 2000);
})();
