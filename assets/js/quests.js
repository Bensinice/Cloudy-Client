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
    d_logs: () => [T('Baue 10 Holzblöcke ab', 'Break 10 logs'), T('Baumstämme jeder Holzart zählen.', 'Logs of any wood type count.')],
    d_stone: () => [T('Baue 64 Stein ab', 'Mine 64 stone'), T('Stein, Granit, Diorit, Andesit, Tuff und Tiefenschiefer zählen.', 'Stone, granite, diorite, andesite, tuff and deepslate count.')],
    d_zombie: () => [T('Besiege 5 Zombies', 'Defeat 5 zombies'), T('Zombies, Wüstenzombies und Ertrunkene zählen.', 'Zombies, husks and drowned count.')],
    d_walk: () => [T('Laufe 1.000 Blöcke', 'Walk 1,000 blocks'), T('Gehen, Rennen und Schleichen zählen.', 'Walking, sprinting and sneaking count.')],
    d_craft: () => [T('Stelle 10 Items her', 'Craft 10 items'), T('Alles, was du herstellst, zählt.', 'Everything you craft counts.')],
    d_skel: () => [T('Besiege 3 Skelette', 'Defeat 3 skeletons'), T('Skelette und Vagabunden zählen.', 'Skeletons and strays count.')],
    w_launch: q => [T('An 5 Tagen spielen', 'Play on 5 days'), T('Starte Minecraft an 5 verschiedenen Tagen dieser Woche.', 'Start Minecraft on 5 different days this week.')],
    w_play: q => [T('5 Stunden spielen', 'Play for 5 hours'), T('Gesamte Spielzeit in dieser Woche.', 'Your total play time this week.')],
    w_daily: q => [T('10 Tages-Quests abschließen', 'Complete 10 daily quests'), T('Hole 10 Tages-Quests in dieser Woche ab.', 'Claim 10 daily quests this week.')],
    w_stone: () => [T('Baue 256 Stein ab', 'Mine 256 stone'), T('Diese Woche.', 'This week.')],
    w_iron: () => [T('Sammle 20 Eisen', 'Collect 20 iron'), T('Baue 20 Eisenerz ab (auch Tiefenschiefer-Eisenerz).', 'Mine 20 iron ore (deepslate iron ore too).')],
    w_craft: () => [T('Stelle 100 Items her', 'Craft 100 items'), T('Diese Woche.', 'This week.')],
    w_srv: () => [T('Spiele 120 Minuten auf einem Server', 'Play 120 minutes on a server'), T('Die Zeit zählt nur, solange du mit einem Server verbunden bist.', 'Time counts only while you are connected to a server.')],
    s_diamond: () => [T('Baue 5 Diamanterze ab', 'Mine 5 diamond ore'), T('Einmalige Spezial-Quest.', 'One-time special quest.')],
    s_fish: () => [T('Fange 5 Fische', 'Catch 5 fish'), T('Einmalige Spezial-Quest.', 'One-time special quest.')],
    s_skel: () => [T('Besiege 3 Skelette', 'Defeat 3 skeletons'), T('Einmalige Spezial-Quest.', 'One-time special quest.')],
    n_launch: () => [T('Erster Start', 'First launch'), T('Starte Minecraft über Cloudy.', 'Start Minecraft with Cloudy.')],
    n_logs: () => [T('Baue 10 Holzblöcke ab', 'Break 10 logs'), T('Dein erster Schritt im Spiel.', 'Your first step in the game.')],
    n_craft: () => [T('Stelle 10 Items her', 'Craft 10 items'), T('Werkbank, Fackeln, Werkzeuge: alles zählt.', 'Crafting table, torches, tools: all count.')],
    n_stone: () => [T('Baue 64 Stein ab', 'Mine 64 stone'), T('Zeit für die erste Höhle.', 'Time for your first cave.')],
    e_s1_play: () => [T('Season-1-Start: 60 Minuten spielen', 'Season 1 start: play 60 minutes'), T('Event-Quest, nur bis zum Ende des Events.', 'Event quest, only until the event ends.')],
    e_winter_craft: () => [T('Winter-Event: 150 Items herstellen', 'Winter event: craft 150 items'), T('Event-Quest, nur bis zum Ende des Events.', 'Event quest, only until the event ends.')]
  };
  const CAT = { newbie: ['Anfänger-Quests', 'Beginner quests'], daily: ['Tägliche Quests', 'Daily quests'], weekly: ['Wöchentliche Quests', 'Weekly quests'], special: ['Spezial-Quests', 'Special quests'], event: ['Event-Quests', 'Event quests'] };
  const root = document.getElementById('p-quests'); if (!root) return;
  let data = null, err = '', msg = '', loading = false, timer = null;
  const esc2 = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const left = ms => { const m = Math.max(1, Math.ceil(ms / 60000)), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mi = m % 60; return d ? d + T(' T ', ' d ') + h + T(' Std', ' h') : h ? h + T(' Std ', ' h ') + mi + ' min' : mi + ' min'; };
  const prog = q => q.unit === 'min' ? Math.floor(q.p) + ' / ' + q.target + ' min' : q.p + ' / ' + q.target;
  const ST = { active: ['Aktiv', 'Active'], done: ['Abgeschlossen', 'Completed'], claimed: ['Belohnung erhalten', 'Reward received'] };
  function row(q) {
    const [title, desc] = Q[q.id] ? Q[q.id](q) : [q.id, ''], pct = Math.min(100, Math.round(100 * q.p / q.target));
    const btn = q.claimed ? `<button class="btn ghost" disabled>${T('Abgeholt ✓', 'Claimed ✓')}</button>` : q.done ? `<button class="btn" data-qc="${q.id}">${T('Abholen', 'Claim')}</button>` : `<button class="btn ghost" disabled>${T('Offen', 'In progress')}</button>`;
    const st = ST[q.status] || ST.active, ends = q.endsIn != null ? ` · ${T('Event endet in ', 'Event ends in ')}${left(q.endsIn)}` : '';
    return `<div class="glass qrow${q.claimed ? ' qdone' : ''}"><div class="qmain"><b>${esc2(title)}</b><span class="muted">${esc2(desc)}</span><div class="bar"><i style="width:${pct}%"></i></div><small class="muted">${prog(q)} · <span class="qst ${q.status}">${st[en() ? 1 : 0]}</span>${ends}</small></div><div class="qrew"><span class="qchip">${q.coins} CC</span><span class="qchip qs">★ ${q.stars}</span><span class="qchip qx">${q.xp} XP</span></div><div class="qbtn">${btn}</div></div>`;
  }
  function paint() {
    const head = (window.passTabs ? window.passTabs('quests') : '') + `<h2>Quests</h2><p class="muted">${T('Erledige Aufgaben, auch direkt in Minecraft, und hole dir Belohnungen: <b>Cloudy Coins (CC)</b> für den Shop, <b>Cloudy Stars (★)</b> und <b>Pass-XP</b> für den Cloudy Pass. Minecraft-Aufgaben zählen automatisch, solange du mit Cloudy spielst. Resets um 00:00 Uhr UTC.', 'Complete tasks, also right inside Minecraft, and claim rewards: <b>Cloudy Coins (CC)</b> for the shop, <b>Cloudy Stars (★)</b> and <b>pass XP</b> for the Cloudy Pass. Minecraft tasks count automatically while you play with Cloudy. Resets at 00:00 UTC.')}</p>`;
    if (err) { root.innerHTML = head + `<div class="glass set"><p>${esc2(err)}</p><button class="btn ghost" id="qRetry">${T('Erneut versuchen', 'Try again')}</button></div>`; if (window.passTabsBind) window.passTabsBind(root); const r = root.querySelector('#qRetry'); if (r) r.onclick = refresh; return; }
    if (!data) { root.innerHTML = head + `<p class="muted">${T('Lädt …', 'Loading …')}</p>`; return; }
    const hist = (data.hist || []).map(h => { const [t] = Q[h.id] ? Q[h.id]({ feat: '' }) : [h.id]; return `<div class="qh"><span>${esc2(t.replace(/: $/, ''))}</span><span class="muted">${new Date(h.t).toLocaleDateString(en() ? 'en-GB' : 'de-DE')} · +${h.coins} CC · ★ ${h.stars}</span></div>`; }).join('');
    root.innerHTML = head +
      `<div class="glass qstars"><div><span class="qbig">★ ${data.stars.bal}</span><small class="muted">${T('Cloudy Stars', 'Cloudy Stars')}</small></div><div class="qsub"><span>${T('Pass-XP', 'Pass XP')}: <b>${data.xp || 0}</b></span><span>${T('Verdient', 'Earned')}: <b>${data.stars.earned}</b></span><span>${T('Ausgegeben (Pass)', 'Spent (Pass)')}: <b>${data.stars.spent}</b></span></div></div>` +
      ['newbie', 'daily', 'weekly', 'special', 'event'].map(c => { const arr = (data.cats && data.cats[c]) || []; if (!arr.length) return ''; const rs = c === 'daily' ? T('Neu in ', 'Resets in ') + left(data.resets.daily) : c === 'weekly' ? T('Neu in ', 'Resets in ') + left(data.resets.weekly) : c === 'event' ? '' : T('Einmalig', 'One-time'); return `<div class="qsec"><h3>${CAT[c][en() ? 1 : 0]}</h3><small class="muted">${rs}</small></div>${arr.map(row).join('')}`; }).join('') +
      `<p class="muted" style="min-height:20px;color:var(--accent)" id="qMsg">${esc2(msg)}</p>` +
      `<div class="qsec"><h3>${T('Verlauf', 'History')}</h3></div><div class="glass qhist">${hist || `<span class="muted">${T('Noch nichts abgeholt.', 'Nothing claimed yet.')}</span>`}</div>`;
    root.querySelectorAll('[data-qc]').forEach(b => b.onclick = () => claim(b.dataset.qc, b)); if (window.passTabsBind) window.passTabsBind(root);
  }
  async function refresh() {
    if (loading) return; loading = true;
    try { const r = await window.cloudy.questState(); if (r && r.ok) { data = r; err = ''; } else err = (r && r.error) || T('Quests konnten nicht geladen werden.', 'Could not load quests.'); } catch (e) { err = T('Quests konnten nicht geladen werden: ', 'Could not load quests: ') + String((e && e.message) || e).slice(0, 120); }
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
