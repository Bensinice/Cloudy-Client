// Cloudy – Aufräumen 0.9.122: Uhr + Begrüßung auf der Startseite, Musik/Hell-Dunkel oben am Logo, Code einlösen im Shop,
// Einstellungen nach Bereichen (mit Suche), alte Seiten (Quests, Spotify) leiten auf ihren neuen Platz um.
(function () {
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const en = () => (document.documentElement.lang || 'de') !== 'de', T = (de, e) => (en() ? e : de);

  // ---- Knöpfe am Logo: Klick soll nicht das Logo-„Neu laden“ auslösen ----
  const bb = $('.brand .bbtns'); if (bb) bb.addEventListener('click', e => e.stopPropagation());

  // ---- alte Ziele umleiten ----
  const go0 = window.go;
  if (typeof go0 === 'function') {
    window.go = function (p) {
      if (p === 'quests') { go0.call(this, 'shop'); setTimeout(() => window.shopGoTab && window.shopGoTab('quests'), 60); return; }
      if (p === 'spotify') { go0.call(this, 'settings'); setTimeout(() => setCat('sound'), 60); return; }
      return go0.apply(this, arguments);
    };
    try { go = window.go; } catch {} // eslint-disable-line no-global-assign
  }

  // ---- Startseite: Uhr, Datum, Begrüßung nach Tageszeit ----
  function clock() {
    const hi = $('#hi'); if (!hi) return;
    let c = $('#hClock'); if (!c) { c = document.createElement('div'); c.id = 'hClock'; c.className = 'hclock'; c.innerHTML = '<b></b><span></span>'; hi.parentNode.insertBefore(c, hi); }
    const d = new Date(), loc = en() ? 'en-GB' : 'de-DE';
    c.firstChild.textContent = d.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' });
    c.lastChild.textContent = d.toLocaleDateString(loc, { weekday: 'long', day: 'numeric', month: 'long' });
    const g = window.cloudyGreet ? window.cloudyGreet() : ''; if (g && clock.g !== g) { clock.g = g; try { window.paintHome && window.paintHome(); } catch {} }
  }
  clock(); setInterval(() => { if (!document.hidden) clock(); }, 5000);

  // ---- Shop: Code einlösen (vorher in den Einstellungen) ----
  const cb = $('#shopCodeBtn'), rc = $('#redeemCard');
  if (cb && rc) cb.onclick = () => { const on = rc.style.display === 'none'; rc.style.display = on ? '' : 'none'; cb.classList.toggle('tagon', on); if (on) setTimeout(() => { const i = $('#rdCode'); if (i) i.focus(); }, 30); };

  // ---- Einstellungen: Bereiche + Suche ----
  const CATS = [['all', '✦ Alles', '✦ All'], ['acc', '👤 Konto', '👤 Account'], ['game', '🎮 Spiel', '🎮 Game'], ['look', '🎨 Aussehen', '🎨 Look'], ['sound', '🔊 Sound & Musik', '🔊 Sound & music'], ['conn', '🔗 Verbindungen', '🔗 Connections'], ['upd', '⬆ Updates & Wartung', '⬆ Updates & tools']];
  const RULES = [['acc', /^(Konto|Account)\b/i], ['upd', /Update|Wartung|Maintenance/i], ['sound', /Creamkeys|Musik|Music|Spotify|Sound|Klang/i], ['look', /Darstellung|Appearance|Theme|Design|Intro|Sprache|Language/i], ['conn', /Discord|Streaming|Handy|Phone|Remote|Server-Status|Server status|Konto-Server/i], ['game', /Spiel|Game|HUD|Minecraft|Mods|Java|Leistung|Performance/i]];
  let scat = 'all'; try { scat = localStorage.getItem('cloudy.setCat') || 'all'; } catch {}
  const catOf = card => { if (card.dataset.sc) return card.dataset.sc; const h = card.querySelector('h3'), t = h ? h.textContent.trim() : ''; const r = RULES.find(([, re]) => re.test(t)); return (card.dataset.sc = r ? r[0] : 'game'); };
  function filterSettings() {
    const pg = $('#p-settings'); if (!pg) return; const q = (($('#setQ') || {}).value || '').trim().toLowerCase();
    $$('#p-settings .sgrid > *').forEach(c => { if (c.hasAttribute('data-adm')) return; const hit = (scat === 'all' || catOf(c) === scat) && (!q || c.textContent.toLowerCase().includes(q)); c.classList.toggle('schide', !hit); });
    $$('#setCats [data-sc2]').forEach(b => b.classList.toggle('on', b.dataset.sc2 === scat));
  }
  function setCat(k) { scat = k; try { localStorage.setItem('cloudy.setCat', k); } catch {} const g = $('#setTabs [data-st="gen"]'); if (g && $('#p-settings') && $('#p-settings').dataset.tab === 'adm') g.click(); filterSettings(); }
  function buildSettingsNav() {
    const tabs = $('#setTabs'); if (!tabs || $('#setCats')) return;
    const g = tabs.querySelector('[data-st="gen"]'); if (g) g.style.display = 'none';
    const row = document.createElement('div'); row.id = 'setCats'; row.className = 'setcats';
    row.innerHTML = CATS.map(([k, de]) => `<button class="chip" data-sc2="${k}">${de}</button>`).join('') + `<input class="field" id="setQ" placeholder="🔎 Einstellung suchen …" autocomplete="off" spellcheck="false">`;
    tabs.insertBefore(row, tabs.firstChild);
    row.querySelectorAll('[data-sc2]').forEach(b => b.onclick = () => setCat(b.dataset.sc2));
    const q = row.querySelector('#setQ'); q.oninput = () => { if (q.value && scat !== 'all') { scat = 'all'; } const gg = $('#setTabs [data-st="gen"]'); if (q.value && gg && $('#p-settings').dataset.tab === 'adm') gg.click(); filterSettings(); };
    const adm = $('#admTab'); if (adm) { adm.textContent = '🛠 Admin'; adm.addEventListener('click', () => $$('#setCats [data-sc2]').forEach(b => b.classList.remove('on'))); }
    if (g) g.addEventListener('click', filterSettings);
    filterSettings(); try { window.setLang && window.setLang(document.documentElement.lang || 'de'); } catch {}
    const grid = $('#p-settings .sgrid'); if (grid) new MutationObserver(() => filterSettings()).observe(grid, { childList: true });
  }
  buildSettingsNav();
  const ps = window.paintSub; window.paintSub = p => { if (ps) ps(p); if (p === 'settings') { buildSettingsNav(); filterSettings(); } if (p === 'home') clock(); };
  window.settingsCat = setCat;
})();

// ---- Leistungsprofil der Mod (Einstellungen -> Spiel) ----
(function () {
  const INFO = { 0: 'Akku: volumetrische Wolken, Skybox und Menü-Effekte aus, einfache Lyrics, höchstens 60 FPS, Sichtweite höchstens 8 – ideal für Mac/Laptop unterwegs.', 1: 'Ausgewogen: Wolken und Effekte an, auf dem Mac automatisch sparsamer.', 2: 'Max FPS: alle Zusatzeffekte aus, keine FPS-Grenze – für PvP und schwache PCs.' };
  const card = document.getElementById('perfCard'); if (!card || !window.cloudy || !window.cloudy.perfProfile) return;
  const paint = v => { card.querySelectorAll('[data-perf]').forEach(b => b.classList.toggle('on', +b.dataset.perf === v)); const i = card.querySelector('#perfInfo'); if (i) i.textContent = (window.t ? window.t(INFO[v]) : INFO[v]); };
  window.cloudy.perfProfile().then(paint).catch(() => {});
  card.querySelectorAll('[data-perf]').forEach(b => b.onclick = async () => paint(await window.cloudy.perfProfile(+b.dataset.perf)));
})();

// ---- Social im Spiel: Brücke + Song-Bubble ----
(function () {
  const b = document.getElementById('socBridge'), s = document.getElementById('socSong'); if (!b || !s || !window.cloudy || !window.cloudy.socCfg) return;
  const paint = c => { if (!c) return; b.checked = !!c.bridge; s.checked = !!c.song; };
  window.cloudy.socCfg().then(paint).catch(() => {});
  b.onchange = async () => paint(await window.cloudy.socCfg({ bridge: b.checked })); s.onchange = async () => paint(await window.cloudy.socCfg({ song: s.checked }));
})();

// ---- YouTube Music als Lyrics-Quelle (Einstellungen -> Sound & Musik) ----
(function () {
  if (!window.cloudy || !window.cloudy.ytmCfg) return;
  const grid = document.querySelector('#p-settings .sgrid'); if (!grid || document.getElementById('ytmCard')) return;
  const mac = document.documentElement.classList.contains('os-darwin');
  const c = document.createElement('div'); c.id = 'ytmCard'; c.className = 'glass set';
  c.innerHTML = `<h3>YouTube Music (Lyrics)</h3><p class="muted">${mac ? 'Läuft YouTube Music in Chrome oder Safari, zeigt Cloudy die Lyrics dazu im Spiel. Auf dem Mac kennt Cloudy nur den Titel – die Zeilen laufen ab Liedbeginn mit und können etwas versetzt sein. Beim ersten Mal fragt macOS, ob Cloudy Chrome/Safari steuern darf.' : 'Läuft YouTube Music im Browser oder als App, zeigt Cloudy die Lyrics dazu im Spiel – mit genauer Position, wie bei Spotify. Spotify hat Vorrang, wenn beides spielt.'}</p><label class="cb"><input type="checkbox" id="ytmOn"> YouTube Music für Lyrics verwenden</label>`;
  grid.appendChild(c);
  const cb = c.querySelector('#ytmOn'); window.cloudy.ytmCfg().then(v => cb.checked = !!v).catch(() => {}); cb.onchange = async () => { cb.checked = !!(await window.cloudy.ytmCfg(cb.checked)); };
})();

// ---- Shop: Vorschau nur "klebend", wenn sie neben der Liste steht. Untereinander (schmales Fenster) lag sie sonst beim Scrollen unter den Karten ----
(function () {
  const top = document.querySelector('#p-shop .shtop'); if (!top || !window.ResizeObserver) return;
  const chk = () => { const a = top.children[0], b = top.children[1]; if (!a || !b) return; top.classList.toggle('stack', b.offsetTop > a.offsetTop + 20); };
  new ResizeObserver(chk).observe(top); setTimeout(chk, 500);
})();
