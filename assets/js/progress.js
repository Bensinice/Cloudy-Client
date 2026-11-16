// Phase 4: Login-Streak, Wochenaufgabe, nächstes Cloudy-Event und Tagebuch (Startseite); Erfolge + Abzeichen, Creator-Statistik und Admin-Bereich (Cloudy Pass)
(function () {
  const $ = s => document.querySelector(s), L = t => (window.t ? window.t(t) : t), en = () => (document.documentElement.lang || 'de') !== 'de';
  const esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  if (!window.cloudy || !window.cloudy.p4State) return;
  let st = null, tl = [], busy = false;
  const fmtDT = t => new Date(t).toLocaleString(en() ? 'en-GB' : 'de-DE', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const fmtD = t => new Date(t).toLocaleDateString(en() ? 'en-GB' : 'de-DE', { day: 'numeric', month: 'short' }) + ' · ' + new Date(t).toLocaleTimeString(en() ? 'en-GB' : 'de-DE', { hour: '2-digit', minute: '2-digit' });
  const left = ms => { ms = Math.max(0, ms); const d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24, m = Math.floor(ms / 6e4) % 60; return d ? `${d} ${L('T.')} ${h} ${L('Std.')}` : h ? `${h} ${L('Std.')} ${m} ${L('Min.')}` : `${m} ${L('Min.')}`; };
  const EXN = { 'trail-runes': 'Runenspur', 'trail-soul': 'Seelenflammen', 'trail-cherry': 'Kirschblüten', 'trail-snow': 'Schneeflocken' };
  const itemName = id => { const c = (window.shopCatalog || []).find(x => x.id === id); return c ? L(c.name) : EXN[id] ? L(EXN[id]) : id; };

  // ---------- Startseite ----------
  function homeHost(id, cls) { const pg = $('#p-home'); if (!pg) return null; let c = document.getElementById(id); if (!c) { c = document.createElement('div'); c.id = id; c.className = cls; const sec = pg.querySelector('.sec'); pg.insertBefore(c, sec || null); } return c; }
  function paintHome() {
    const c = homeHost('homeP4', 'p4row'); if (!c) return;
    if (!st) { c.style.display = 'none'; } else {
      c.style.display = ''; const w = st.weekly || {}, ev = st.event || {}, pct = w.goal ? Math.round(w.v / w.goal * 100) : 0;
      c.innerHTML = `<div class="glass p4c"><span class="p4ic">🔥</span><div><b>${st.streak || 0} ${L(st.streak === 1 ? 'Tag' : 'Tage')} Streak</b><small class="muted">${st.bonus ? '+' + st.bonus + ' CC ' + L('Tagesbonus') + ' ✓' : L('Jeden Tag Cloudy öffnen = Bonus-CC (bis 70 CC)')} · ${L('Rekord')} ${st.best || 0}</small></div></div>
        <div class="glass p4c"><span class="p4ic">🏆</span><div style="flex:1;min-width:0"><b>${L('Wochenaufgabe')}: ${esc(en() ? w.en : w.d)}</b><span class="pbar"><i style="width:${pct}%"></i></span><small class="muted">${w.v || 0}/${w.goal || 0} · ${L('Belohnung')}: ${esc(itemName(w.item))} + 100 CC · ${L('noch')} ${left((w.ends || 0) - Date.now())}</small></div>${w.ready ? `<button class="btn" id="p4Wk">${L('Abholen')}</button>` : w.done ? `<span class="tagok">✓</span>` : ''}</div>
        <div class="glass p4c ${ev.on ? 'evon' : ''}"><span class="p4ic">☄</span><div><b>${ev.on ? L('Cloudy-Event läuft gerade!') : L('Nächstes Cloudy-Event')}</b><small class="muted">${esc(ev.name || '')} · ${ev.on ? L('Spiel jetzt mit – Sternschnuppen am Himmel, +150 CC') : fmtDT(ev.start)}</small></div></div>`;
      const b = $('#p4Wk'); if (b) b.onclick = async () => { b.disabled = true; const r = await window.cloudy.p4Weekly(); if (r && r.ok) { await load(true); } else { b.disabled = false; alert(L((r && r.error) || 'Fehler')); } };
    }
    const t = homeHost('homeTL', 'glass set wide tlcard'); if (!t) return;
    if (!tl.length) { t.innerHTML = `<h3>📔 ${L('Tagebuch')}</h3><p class="muted">${L('Hier sammelt Cloudy deine Momente: Spielrunden mit Screenshots, erster Diamant, gekaufte Items, Erfolge …')}</p>`; return; }
    const ic = k => k === 'play' ? '🎮' : k === 'buy' ? '🛍' : k === 'weekly' ? '🏆' : /^ach/.test(k) ? '🏅' : /^streak/.test(k) ? '🔥' : k === 'jr-diamond' ? '💎' : k === 'jr-win' ? '🏆' : '✨';
    t.innerHTML = `<h3>📔 ${L('Tagebuch')}</h3><div class="tl">${tl.slice(0, 14).map(e => `<div class="tle"><span class="tli">${ic(e.k)}</span><div><b>${esc(en() && e.en ? e.en : e.text)}</b><small class="muted">${fmtD(e.t)}</small>${e.shots && e.shots.length ? `<div class="tls">${e.shots.map(s => `<img src="${s.thumb}" data-shot="${esc(e.ver)}|${esc(s.file)}" alt="" title="${L('Öffnen')}">`).join('')}</div>` : ''}</div></div>`).join('')}</div>`;
    t.querySelectorAll('[data-shot]').forEach(im => im.onclick = () => { const [v, f] = im.dataset.shot.split('|'); try { window.cloudy.shotOpen(v, f); } catch {} });
  }

  // ---------- Cloudy Pass: Erfolge ----------
  function passSection() {
    const pg = $('#p-pass'); if (!pg || !st) return; let c = $('#passAch'); if (!c) { c = document.createElement('div'); c.id = 'passAch'; c.className = 'glass set wide achcard'; pg.appendChild(c); }
    const A = st.ach || [], cur = st.badge || '', n = A.filter(a => a.done).length;
    c.innerHTML = `<div class="achh"><h3>🏅 ${L('Erfolge')} <small class="muted">${n}/${A.length}</small></h3><small class="muted">${L('Klick auf einen geschafften Erfolg = dein Abzeichen neben dem Namen (im Spiel und auf deiner Profilkarte).')}</small></div>
      <div class="achg">${A.map(a => `<button class="ach ${a.done ? 'done' : ''} ${cur === a.id || (!cur && a.done && st.badgeSym === a.sym) ? 'pick' : ''}" ${a.done ? `data-badge="${a.id}"` : 'disabled'}><span class="asym">${esc(a.sym)}</span><b>${esc(en() ? a.en : a.name)}</b><small>${esc(en() ? a.den : a.d)}</small>${a.done ? `<small class="ok">✓ ${new Date(a.t).toLocaleDateString()}</small>` : `<span class="pbar"><i style="width:${Math.round(a.v / a.goal * 100)}%"></i></span><small class="muted">${a.v}/${a.goal}</small>`}</button>`).join('')}</div>
      <div class="tools"><button class="btn ghost" data-badge="-">${L('Kein Abzeichen zeigen')}</button></div>
      ${(st.creator || []).length ? `<div class="crst"><b>🎬 ${L('Deine Creator-Codes')}</b>${st.creator.map(x => `<span class="chip">${esc(x.code)} · ${x.count} ${L('Unterstützer')}</span>`).join('')}</div>` : ''}
      <div id="p4Adm"></div>`;
    c.querySelectorAll('[data-badge]').forEach(b => b.onclick = async () => { const r = await window.cloudy.p4Badge(b.dataset.badge); if (r && r.ok) load(true); });
    if (window.__shopAdmin) adminBox();
  }
  async function adminBox() {
    const h = $('#p4Adm'); if (!h) return; const r = await window.cloudy.p4Admin({ what: 'creators' }); if (!r || !r.ok) { h.innerHTML = ''; return; }
    const cat = (window.shopCatalog || []).filter(c => !c.owner), opts = sel => cat.map(c => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${esc(c.name)} (${c.id})</option>`).join('');
    const mon = new Date().toISOString().slice(0, 7), pm = (r.plusMonth || {})[mon] || '';
    h.innerHTML = `<h3 style="margin-top:14px">🛠 Admin</h3>
      <div class="admrow"><b>✨ ${L('Cloudy+-Monatsitem')} (${mon})</b><small class="muted">${L('Wer diesen Monat Cloudy+ hat, bekommt das Item automatisch und behält es. Man kann es nicht kaufen.')}</small><div class="tools"><select class="field" id="pmId"><option value="">— ${L('keins')} —</option>${opts(pm)}</select><button class="btn" id="pmSave">${L('Speichern')}</button></div></div>
      <div class="admrow"><b>🎬 Creator-Codes</b><small class="muted">${L('Wer einen Creator-Code einlöst, bekommt das Item (und Coins); der Creator sieht die Zahl seiner Unterstützer. Jedes Konto kann nur einen Creator unterstützen.')}</small>
        ${(r.list || []).map(x => `<div class="tools"><span class="chip">${esc(x.code)}</span><span>${esc(x.creator)} · ${x.item ? esc(itemName(x.item)) : '–'}${x.coins ? ' + ' + x.coins + ' CC' : ''} · <b>${x.count}</b> ${L('Unterstützer')}</span><button class="btn ghost" data-ccdel="${esc(x.code)}">${L('Löschen')}</button></div>`).join('')}
        <div class="tools"><input class="field" id="ccCode" placeholder="CODE" style="max-width:130px;text-transform:uppercase"><input class="field" id="ccBy" placeholder="${L('Konto des Creators')}" style="max-width:170px"><select class="field" id="ccItem"><option value="">— ${L('kein Item')} —</option>${opts('')}</select><input class="field" id="ccCoins" type="number" min="0" placeholder="CC" style="max-width:90px"><button class="btn" id="ccSave">${L('Code anlegen')}</button></div></div>
      <div class="admrow"><b>☄ ${L('Cloudy-Event')}</b><small class="muted">${L('Ohne Eintrag: jeden ersten Samstag im Monat 20:00–20:30 (deutsche Winterzeit). Hier kannst du ein eigenes Event festlegen (höchstens 6 Stunden).')}</small><div class="tools"><input class="field" type="datetime-local" id="evStart"><input class="field" type="number" id="evMin" min="5" max="360" value="30" style="max-width:90px" title="${L('Minuten')}"><input class="field" id="evName" placeholder="${L('Name')}" value="Sternschnuppen-Nacht" style="max-width:200px"><button class="btn" id="evSave">${L('Festlegen')}</button><button class="btn ghost" id="evClear">${L('Zurück auf monatlich')}</button></div><small class="muted" id="admMsg"></small></div>`;
    const msg = t => { const m = $('#admMsg'); if (m) m.textContent = t || ''; };
    $('#pmSave').onclick = async () => { const x = await window.cloudy.p4Admin({ what: 'plusmonth', body: { id: $('#pmId').value } }); msg(x.ok ? L('Gespeichert.') : x.error); };
    $('#ccSave').onclick = async () => { const x = await window.cloudy.p4Admin({ what: 'creator', body: { code: $('#ccCode').value, creator: $('#ccBy').value, item: $('#ccItem').value, coins: +$('#ccCoins').value || 0 } }); if (x.ok) adminBox(); else msg(x.error); };
    h.querySelectorAll('[data-ccdel]').forEach(b => b.onclick = async () => { if (!confirm(b.dataset.ccdel + ' – ' + L('Löschen') + '?')) return; await window.cloudy.p4Admin({ what: 'creator', body: { code: b.dataset.ccdel, del: true } }); adminBox(); });
    $('#evSave').onclick = async () => { const t0 = Date.parse($('#evStart').value); if (!t0) { msg(L('Bitte Startzeit wählen.')); return; } const x = await window.cloudy.p4Admin({ what: 'event', body: { start: t0, end: t0 + Math.max(5, +$('#evMin').value || 30) * 60e3, name: $('#evName').value } }); msg(x.ok ? L('Event festgelegt.') : x.error); if (x.ok) load(true); };
    $('#evClear').onclick = async () => { const x = await window.cloudy.p4Admin({ what: 'event', body: { clear: true } }); msg(x.ok ? L('Wieder monatlich.') : x.error); if (x.ok) load(true); };
  }

  async function load(force) {
    if (busy) return; busy = true;
    try { st = await window.cloudy.p4State(!!force); } catch { st = null; }
    try { tl = await window.cloudy.timeline() || []; } catch { tl = []; }
    busy = false; paintHome(); if ($('#passAch') || ($('#p-pass') && $('#p-pass').classList.contains('on'))) passSection();
  }
  // Pass-Seite wird von pass.js neu gezeichnet -> Erfolge danach wieder anhängen
  const pp = $('#p-pass'); if (pp) new MutationObserver(() => { if (st && !$('#passAch')) passSection(); }).observe(pp, { childList: true });
  try { window.cloudy.on('timeline', () => { clearTimeout(load.t); load.t = setTimeout(async () => { try { tl = await window.cloudy.timeline() || []; } catch {} paintHome(); }, 800); }); } catch {}
  try { window.cloudy.on('closed', () => setTimeout(() => load(true), 3000)); } catch {}
  const ps = window.paintSub; window.paintSub = p => { if (ps) ps(p); if (p === 'home' || p === 'pass') load(false); };
  setTimeout(() => load(false), 2500); setInterval(() => { if (!document.hidden) load(false); }, 5 * 60e3);
  window.p4Reload = () => load(true);
})();
