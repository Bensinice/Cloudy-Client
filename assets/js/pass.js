// Cloudy – Cloudy Pass (Seite „Cloudy Pass“) mit Unterreitern „Pass“ und „Quests“. Level, Belohnungen und Cloudy+ kommen vom Server.
(function () {
  const en = () => document.documentElement.lang !== 'de';
  const T = (de, e) => (en() ? e : de);
  const root = document.getElementById('p-pass'); if (!root) return;
  let data = null, err = '', msg = '', loading = false, timer = null;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const nameOf = id => { try { const c = (window.shopCatalog || []).find(x => x.id === id); return c ? c.name : id; } catch { return id; } };
  const left = ms => { const m = Math.max(1, Math.ceil(ms / 60000)), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60); return d ? d + T(' T ', ' d ') + h + T(' Std', ' h') : h + T(' Std', ' h'); };
  // Reiterleiste: wird oben auf der Pass- und der Quest-Seite eingefügt
  window.passTabs = cur => `<div class="ptabs"><button class="btn${cur === 'pass' ? '' : ' ghost'}" data-pt="pass">${T('Pass', 'Pass')}</button><button class="btn${cur === 'quests' ? '' : ' ghost'}" data-pt="quests">${T('Quests', 'Quests')}</button></div>`;
  window.passTabsBind = el => el.querySelectorAll('[data-pt]').forEach(b => b.onclick = () => { if (window.go) window.go(b.dataset.pt); });
  function cell(r, track) {
    const x = r[track], locked = data.level < r.level, prem = track === 'premium', noPlus = prem && !data.plus;
    const what = `<b>+${x.coins} CC</b>${x.item ? `<span class="pitem">🎁 ${esc(nameOf(x.item))}</span>` : ''}`;
    const st = x.claimed ? `<button class="btn ghost" disabled>✓</button>` : locked ? `<span class="muted pl">🔒</span>` : noPlus ? `<span class="muted pl" title="${T('Nur mit Cloudy+', 'Cloudy+ only')}">👑</span>` : `<button class="btn" data-pc="${r.level}|${track}">${T('Abholen', 'Claim')}</button>`;
    return `<div class="pcell${prem ? ' prem' : ''}${x.claimed ? ' got' : ''}${locked || noPlus ? ' lock' : ''}">${what}${st}</div>`;
  }
  function paint() {
    const head = window.passTabs('pass') + `<h2>Cloudy Pass</h2>`;
    if (err) { root.innerHTML = head + `<div class="glass set"><p>${esc(err)}</p><button class="btn ghost" id="pRetry">${T('Erneut versuchen', 'Try again')}</button></div>`; window.passTabsBind(root); const r = root.querySelector('#pRetry'); if (r) r.onclick = () => { err = ''; paint(); refresh(); }; return; }
    if (!data) { root.innerHTML = head + `<p class="muted">${T('Lädt …', 'Loading …')}</p>`; window.passTabsBind(root); return; }
    const pct = data.level >= data.max ? 100 : Math.round(100 * data.intoLevel / data.perLevel);
    const s = data.season;
    root.innerHTML = head +
      `<div class="glass pinfo"><div><span class="qbig">${T('Level', 'Level')} ${data.level}<small class="muted"> / ${data.max}</small></span><small class="muted">${esc(s.name)} · ${s.over ? T('beendet', 'ended') : T('endet in ', 'ends in ') + left(s.endsIn)}</small></div>` +
      `<div class="pbarw"><div class="bar"><i style="width:${pct}%"></i></div><small class="muted">${data.level >= data.max ? T('Maximales Level erreicht', 'Max level reached') : data.intoLevel + ' / ' + data.perLevel + ' XP → ' + T('Level ', 'Level ') + (data.level + 1)}</small></div>` +
      `<div class="pbuy"><div class="pplus ${data.plus ? 'on' : ''}">${data.plus ? '👑 ' + T('Cloudy+ aktiv bis ', 'Cloudy+ active until ') + new Date(data.plusUntil).toLocaleDateString(en() ? undefined : 'de-DE') : '👑 ' + T('Premium-Reihe: nur mit Cloudy+', 'Premium track: Cloudy+ only')}</div><button class="btn${data.plus ? ' ghost' : ''}" id="pBuy">${data.plus ? T('Abo verwalten', 'Manage subscription') : T('Cloudy+ kaufen · 5,99 €/Monat', 'Get Cloudy+ · €5.99/month')}</button></div></div>` +
      `<p class="muted" style="margin:6px 2px">${T('Pass-XP verdienst du mit Quests (Reiter „Quests“). Alle ', 'You earn pass XP with quests (“Quests” tab). Every ')}${data.perLevel}${T(' XP steigst du ein Level auf.', ' XP you level up.')} ${T('Deine XP: ', 'Your XP: ')}<b>${data.xp}</b></p>` +
      `<div class="tools" style="margin:8px 0;gap:8px"><input class="field" id="pCode" placeholder="${T('Cloudy+-Code (CP-…)', 'Cloudy+ code (CP-…)')}" maxlength="20" autocomplete="off" style="max-width:240px"><button class="btn ghost" id="pRedeem">${T('Code einlösen', 'Redeem code')}</button></div>` +
      `<p class="muted" style="min-height:20px;color:var(--accent)" id="pMsg">${esc(msg)}</p>` +
      `<div class="plist"><div class="phead"><span>${T('Level', 'Level')}</span><span>${T('Gratis', 'Free')}</span><span>${T('Premium', 'Premium')}</span></div>${data.rows.map(r => `<div class="prow${r.level === data.level ? ' cur' : ''}"><span class="plv">${r.level}</span>${cell(r, 'free')}${cell(r, 'premium')}</div>`).join('')}</div>`;
    window.passTabsBind(root);
    const bb = root.querySelector('#pBuy'); if (bb) bb.onclick = async () => { bb.disabled = true; let r = null; try { r = await window.cloudy.plusBuy(data.plus); } catch {} bb.disabled = false; msg = r && r.ok ? T('Die Bezahlseite wurde im Browser geöffnet. Nach der Zahlung dauert es einen Moment, bis Cloudy+ aktiv ist.', 'The payment page opened in your browser. It takes a moment after paying until Cloudy+ is active.') : (r && r.error) || T('Fehlgeschlagen.', 'Failed.'); const m = root.querySelector('#pMsg'); if (m) m.textContent = msg; };
    { const rb = root.querySelector('#pRedeem'); if (rb) rb.onclick = async () => { const c = root.querySelector('#pCode').value.trim(); if (!c) return; rb.disabled = true; let r = null; try { r = await window.cloudy.plusRedeem(c); } catch {} rb.disabled = false; if (r && r.ok) { msg = T('Cloudy+ freigeschaltet für ', 'Cloudy+ unlocked for ') + r.days + T(' Tage ✓', ' days ✓'); try { window.dispatchEvent(new Event('cloudy-plus')); } catch {} await refresh(); paint(); } else { msg = (r && r.error) || T('Das hat nicht geklappt.', 'That did not work.'); paint(); } }; }
    root.querySelectorAll('[data-pc]').forEach(b => b.onclick = () => claim(b.dataset.pc, b));
  }
  async function refresh() {
    if (loading) return; loading = true;
    if (!window.shopCatalog) { try { const sh = await window.cloudy.shopState(); if (sh && sh.catalog) window.shopCatalog = sh.catalog; } catch {} }
    try { const r = await window.cloudy.passState(); if (r && r.ok) { data = r; err = ''; } else err = (r && r.error) || T('Der Pass konnte nicht geladen werden.', 'Could not load the pass.'); } catch (e) { err = T('Der Pass konnte nicht geladen werden: ', 'Could not load the pass: ') + String((e && e.message) || e).slice(0, 120); }
    loading = false; if (root.classList.contains('on')) paint();
  }
  async function claim(v, b) {
    const [level, track] = v.split('|'); b.disabled = true;
    try { const r = await window.cloudy.passClaim({ level: +level, track }); msg = r && r.ok ? T('Abgeholt: +', 'Claimed: +') + r.coins + ' CC' + (r.item ? ' + ' + nameOf(r.item) : '') : (r && r.error) || T('Abholen nicht möglich.', 'Could not claim.'); } catch { msg = T('Abholen nicht möglich.', 'Could not claim.'); }
    await refresh(); paint();
  }
  const ps = window.paintSub;
  window.paintSub = p => { if (ps) ps(p); clearInterval(timer); if (p === 'pass') { paint(); refresh(); timer = setInterval(refresh, 60000); } };
  const sl = window.setLang; if (sl) window.setLang = l => { sl(l); if (root.classList.contains('on')) paint(); };
})();
