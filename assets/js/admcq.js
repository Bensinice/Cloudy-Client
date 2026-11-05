// Cloudy – Admin: eigene Quests erstellen, bearbeiten, aktivieren, löschen und Fortschritt aller Spieler ansehen.
// Alles wird auf dem Server gespeichert und geprüft; hier ist nur die Bedienung.
(function () {
  const $ = s => document.querySelector(s); if (!$('#cqSave')) return;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const M = { logs: 'Holzblöcke abbauen', stone: 'Stein abbauen', iron: 'Eisenerz abbauen', diamond: 'Diamanterz abbauen', zombie: 'Zombies besiegen', skeleton: 'Skelette besiegen', walk: 'Blöcke laufen', craft: 'Items herstellen', fish: 'Fische fangen', play: 'Minuten spielen', srv: 'Minuten auf einem Server', launch: 'Minecraft starten' };
  const D = { easy: 'Leicht', medium: 'Mittel', hard: 'Schwer', extreme: 'Extrem' };
  $('#cqMetric').innerHTML = Object.entries(M).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
  let list = [], editId = '';
  const msg = (t, ok) => { const m = $('#cqMsg'); m.textContent = t || ''; m.style.color = ok ? 'var(--accent)' : ''; };
  const call = async o => { try { return await window.cloudy.admCq(o); } catch { return { ok: false, error: 'Fehlgeschlagen.' }; } };
  const clear = () => { editId = ''; for (const i of ['Title', 'Desc', 'Target', 'Coins', 'Stars', 'Xp', 'From', 'To', 'Lim', 'Users']) $('#cq' + i).value = ''; $('#cqDiff').value = 'easy'; $('#cqMetric').value = 'logs'; $('#cqSave').textContent = 'Quest speichern'; };
  const draw = () => {
    $('#cqList').innerHTML = list.length ? list.map(q => `<div class="glass" style="padding:8px 10px;margin:6px 0"><b>${esc(q.title)}</b> <span class="muted">· ${esc(M[q.metric] || q.metric)}: ${q.target} · ${D[q.diff] || ''} · ${q.coins} CC, ★ ${q.stars}, ${q.xp} XP · ${q.users && q.users.length ? esc(q.users.join(', ')) : 'alle'}${q.from || q.to ? ' · ' + esc(q.from || '…') + ' bis ' + esc(q.to || '…') : ''}${q.limitH ? ' · ' + q.limitH + ' Std.' : ''}${q.on === false ? ' · <b>aus</b>' : ''}</span>
      <div class="tools" style="gap:6px;margin-top:6px"><button class="btn ghost" data-cqe="${q.id}">Bearbeiten</button><button class="btn ghost" data-cqt="${q.id}">${q.on === false ? 'Aktivieren' : 'Deaktivieren'}</button><button class="btn ghost" data-cqp="${q.id}">Fortschritt</button><button class="btn ghost" data-cqd="${q.id}">Löschen</button></div><div id="cqP_${q.id}"></div></div>`).join('') : '<span class="muted">Noch keine eigenen Quests.</span>';
    document.querySelectorAll('[data-cqe]').forEach(b => b.onclick = () => { const q = list.find(x => x.id === b.dataset.cqe); if (!q) return; editId = q.id; $('#cqTitle').value = q.title; $('#cqDesc').value = q.desc || ''; $('#cqMetric').value = q.metric; $('#cqTarget').value = q.target; $('#cqCoins').value = q.coins; $('#cqStars').value = q.stars; $('#cqXp').value = q.xp; $('#cqDiff').value = q.diff; $('#cqFrom').value = q.from || ''; $('#cqTo').value = q.to || ''; $('#cqLim').value = q.limitH || ''; $('#cqUsers').value = (q.users || []).join(', '); $('#cqSave').textContent = 'Änderungen speichern'; msg('Du bearbeitest: ' + q.title, true); });
    document.querySelectorAll('[data-cqt]').forEach(b => b.onclick = async () => { const q = list.find(x => x.id === b.dataset.cqt); if (!q) return; const r = await call({ a: 'save', quest: { ...q, on: q.on === false } }); msg(r.ok ? 'Gespeichert ✓' : r.error, r.ok); load(); });
    document.querySelectorAll('[data-cqd]').forEach(b => b.onclick = async () => { const q = list.find(x => x.id === b.dataset.cqd); if (!q || !confirm('Quest „' + q.title + '“ löschen? Fortschritt der Spieler geht verloren.')) return; const r = await call({ a: 'del', id: q.id }); msg(r.ok ? 'Gelöscht ✓' : r.error, r.ok); load(); });
    document.querySelectorAll('[data-cqp]').forEach(b => b.onclick = async () => { const box = $('#cqP_' + b.dataset.cqp), r = await call({ a: 'prog', id: b.dataset.cqp }); box.innerHTML = r.ok ? `<p class="muted" style="margin:6px 0">${r.rows.length} Spieler · ${r.done} fertig · ${r.claimed} abgeholt</p>` + r.rows.slice(0, 100).map(x => `<div class="muted">${esc(x.name)}: ${x.p} / ${r.target}${x.claimed ? ' · abgeholt ✓' : x.done ? ' · fertig' : ''}</div>`).join('') : `<span class="muted">${esc(r.error)}</span>`; });
  };
  async function load() { const r = await call({ a: 'list' }); if (r.ok) { list = r.quests || []; draw(); } else if ($('#cqList')) $('#cqList').innerHTML = `<span class="muted">${esc(r.error)}</span>`; }
  $('#cqSave').onclick = async () => {
    const q = { id: editId || undefined, title: $('#cqTitle').value, desc: $('#cqDesc').value, metric: $('#cqMetric').value, target: +$('#cqTarget').value, coins: +$('#cqCoins').value || 0, stars: +$('#cqStars').value || 0, xp: +$('#cqXp').value || 0, diff: $('#cqDiff').value, from: $('#cqFrom').value, to: $('#cqTo').value, limitH: +$('#cqLim').value || 0, users: $('#cqUsers').value.split(',').map(x => x.trim()).filter(Boolean) };
    if (!q.title.trim() || !(q.target >= 1)) return msg('Titel und Ziel (mindestens 1) eintragen.');
    if (editId) { const old = list.find(x => x.id === editId); if (old) q.on = old.on; }
    const r = await call({ a: 'save', quest: q }); msg(r.ok ? 'Quest gespeichert ✓' : r.error, r.ok); if (r.ok) { clear(); load(); }
  };
  $('#cqNew').onclick = () => { clear(); msg(''); };
  const ps = window.paintSub; window.paintSub = p => { if (ps) ps(p); if (p === 'settings' || p === 'admin') load(); };
  setTimeout(load, 1500);
})();
