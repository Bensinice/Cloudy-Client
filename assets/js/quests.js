// Cloudy – Quests & Cloudy Stars (Seite „Quests“). Fortschritt, Ziele und Belohnungen kommen vom Konto-Server; hier wird nur angezeigt und abgeholt.
(function () {
  const en = () => document.documentElement.lang !== 'de';
  const T = (de, e) => (en() ? e : de);
  const FEAT = ['shop', 'friends', 'mods', 'settings', 'skins'];
  const PAGE = { shop: ['Shop', 'Shop'], friends: ['Freunde', 'Friends'], mods: ['Mods', 'Mods'], settings: ['Einstellungen', 'Settings'], skins: ['Skins', 'Skins'] };
  const pg = id => (PAGE[id] || [id, id])[en() ? 1 : 0];
  const Q = {
    d_open: q => [T('Cloudy öffnen', 'Open Cloudy'), T('Öffne heute den Launcher.', 'Open the launcher today.')],
    d_launch: q => [T('Minecraft starten', 'Start Minecraft'), T('Starte das Spiel über Cloudy.', 'Start the game from Cloudy.')],
    d_play: q => [T('30 Minuten spielen', 'Play for 30 minutes'), T('Die Zeit zählt, solange Minecraft läuft.', 'Time counts while Minecraft is running.')],
    d_feat: q => [T('Entdecken: ', 'Explore: ') + pg(q.feat), T('Öffne in Cloudy die Seite „', 'Open the “') + pg(q.feat) + T('“.', '” page in Cloudy.')],
    w_launch: q => [T('An 5 Tagen spielen', 'Play on 5 days'), T('Starte Minecraft an 5 verschiedenen Tagen dieser Woche.', 'Start Minecraft on 5 different days this week.')],
    w_play: q => [T('5 Stunden spielen', 'Play for 5 hours'), T('Gesamte Spielzeit in dieser Woche.', 'Your total play time this week.')],
    w_daily: q => [T('10 Tages-Quests abschließen', 'Complete 10 daily quests'), T('Hole 10 Tages-Quests in dieser Woche ab.', 'Claim 10 daily quests this week.')]
  };
  const root = document.getElementById('p-quests'); if (!root) return;
  let data = null, err = '', msg = '', loading = false, timer = null;
  const esc2 = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const left = ms => { const m = Math.max(1, Math.ceil(ms / 60000)), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mi = m % 60; return d ? d + T(' T ', ' d ') + h + T(' Std', ' h') : h ? h + T(' Std ', ' h ') + mi + ' min' : mi + ' min'; };
  const prog = q => q.unit === 'min' ? Math.floor(q.p) + ' / ' + q.target + ' min' : q.p + ' / ' + q.target;
  function row(q) {
    const [title, desc] = Q[q.id] ? Q[q.id](q) : [q.id, ''], pct = Math.round(100 * q.p / q.target);
    const btn = q.claimed ? `<button class="btn ghost" disabled>${T('Abgeholt ✓', 'Claimed ✓')}</button>` : q.done ? `<button class="btn" data-qc="${q.id}">${T('Abholen', 'Claim')}</button>` : `<button class="btn ghost" disabled>${T('Offen', 'In progress')}</button>`;
    return `<div class="glass qrow${q.claimed ? ' qdone' : ''}"><div class="qmain"><b>${esc2(title)}</b><span class="muted">${esc2(desc)}</span><div class="bar"><i style="width:${pct}%"></i></div><small class="muted">${prog(q)}</small></div><div class="qrew"><span class="qchip">+${q.coins} CC</span><span class="qchip qs">★ ${q.stars}</span></div><div class="qbtn">${btn}</div></div>`;
  }
  function paint() {
    const head = `<h2>Quests</h2><p class="muted">${T('Erledige Aufgaben und hole dir Belohnungen. <b>Cloudy Coins (CC)</b> gibst du im Shop aus. <b>Cloudy Stars (★)</b> bringen dich später im Cloudy Pass weiter und lassen sich nicht im Shop ausgeben.', 'Complete tasks and claim rewards. You spend <b>Cloudy Coins (CC)</b> in the shop. <b>Cloudy Stars (★)</b> will move you up in the Cloudy Pass and cannot be spent in the shop.')}</p>`;
    if (err) { root.innerHTML = head + `<div class="glass set"><p>${esc2(err)}</p><button class="btn ghost" id="qRetry">${T('Erneut versuchen', 'Try again')}</button></div>`; const r = root.querySelector('#qRetry'); if (r) r.onclick = refresh; return; }
    if (!data) { root.innerHTML = head + `<p class="muted">${T('Lädt …', 'Loading …')}</p>`; return; }
    const hist = (data.hist || []).map(h => { const [t] = Q[h.id] ? Q[h.id]({ feat: '' }) : [h.id]; return `<div class="qh"><span>${esc2(t.replace(/: $/, ''))}</span><span class="muted">${new Date(h.t).toLocaleDateString(en() ? 'en-GB' : 'de-DE')} · +${h.coins} CC · ★ ${h.stars}</span></div>`; }).join('');
    root.innerHTML = head +
      `<div class="glass qstars"><div><span class="qbig">★ ${data.stars.bal}</span><small class="muted">${T('Cloudy Stars', 'Cloudy Stars')}</small></div><div class="qsub"><span>${T('Verdient', 'Earned')}: <b>${data.stars.earned}</b></span><span>${T('Ausgegeben (Pass)', 'Spent (Pass)')}: <b>${data.stars.spent}</b></span></div></div>` +
      `<div class="qsec"><h3>${T('Tägliche Quests', 'Daily quests')}</h3><small class="muted">${T('Neu in ', 'Resets in ')}${left(data.resets.daily)}</small></div>${data.daily.map(row).join('')}` +
      `<div class="qsec"><h3>${T('Wöchentliche Quests', 'Weekly quests')}</h3><small class="muted">${T('Neu in ', 'Resets in ')}${left(data.resets.weekly)}</small></div>${data.weekly.map(row).join('')}` +
      `<p class="muted" style="min-height:20px;color:var(--accent)" id="qMsg">${esc2(msg)}</p>` +
      `<div class="qsec"><h3>${T('Verlauf', 'History')}</h3></div><div class="glass qhist">${hist || `<span class="muted">${T('Noch nichts abgeholt.', 'Nothing claimed yet.')}</span>`}</div>`;
    root.querySelectorAll('[data-qc]').forEach(b => b.onclick = () => claim(b.dataset.qc, b));
  }
  async function refresh() {
    if (loading) return; loading = true;
    try { const r = await window.cloudy.questState(); if (r && r.ok) { data = r; err = ''; } else err = (r && r.error) || T('Quests konnten nicht geladen werden.', 'Could not load quests.'); } catch { err = T('Quests konnten nicht geladen werden.', 'Could not load quests.'); }
    loading = false; if (root.classList.contains('on')) paint();
  }
  async function claim(id, b) {
    b.disabled = true;
    try { const r = await window.cloudy.questClaim(id); msg = r && r.ok ? T('Abgeholt: +', 'Claimed: +') + r.coins + ' CC, ★ ' + r.stars : (r && r.error) || T('Abholen nicht möglich.', 'Could not claim.'); } catch { msg = T('Abholen nicht möglich.', 'Could not claim.'); }
    await refresh(); paint();
  }
  // Seitenaufrufe zählen für „Entdecken“-Quests; die Quest-Seite lädt sich beim Öffnen und danach jede Minute neu
  const ps = window.paintSub;
  window.paintSub = p => {
    if (ps) ps(p);
    clearInterval(timer);
    if (p === 'quests') { paint(); refresh(); timer = setInterval(refresh, 60000); }
    else if (FEAT.includes(p)) { try { window.cloudy.questEvent({ type: 'use', what: p }); } catch {} }
  };
  const sl = window.setLang; if (sl) window.setLang = l => { sl(l); if (root.classList.contains('on')) paint(); };
})();
