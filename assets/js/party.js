// Party: bis zu 8 Freunde. Einladen, Party-Chat (auch im Spiel mit /p), der Anführer holt alle auf seinen Server.
(function () {
  const $ = s => document.querySelector(s), L = t => (window.t ? window.t(t) : t);
  const esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const api = (p, body) => window.cloudy.frApi({ method: 'POST', path: '/party/' + p, body: body || {} });
  let st = null, friends = [], lastPlay = 0, lastMsg = 0, msgs = [], busy = false;
  try { lastPlay = +localStorage.getItem('cloudy.partyPlay') || 0; } catch {}

  function host() {
    const pg = $('#p-friends'); if (!pg) return null;
    let c = $('#partyCard'); if (!c) { c = document.createElement('div'); c.id = 'partyCard'; c.className = 'glass partycard'; const tabs = $('#frTabs'); (tabs ? tabs.parentNode : pg).insertBefore(c, tabs ? tabs.nextSibling : pg.firstChild); }
    return c;
  }

  function paint() {
    const c = host(); if (!c) return;
    if (!st) { c.style.display = 'none'; return; } c.style.display = '';
    const pa = st.party, inv = st.invites || [];
    const invRow = inv.map(i => `<div class="pinv">🎉 <b>${esc(i.from)}</b> ${L('lädt dich in seine Party ein')} <button class="btn" data-pa="${esc(i.id)}">${L('Beitreten')}</button><button class="btn ghost" data-pd="${esc(i.id)}">${L('Ablehnen')}</button></div>`).join('');
    const can = friends.filter(f => !pa || !pa.members.some(m => m.name.toLowerCase() === f.name.toLowerCase()) && !(pa.invited || []).some(n => String(n).toLowerCase() === f.name.toLowerCase()));
    const sel = `<select class="field pinsel" id="pInvSel"><option value="">${L('Freund einladen …')}</option>${can.map(f => `<option value="${esc(f.name)}">${esc(f.name)}${f.online ? ' • online' : ''}</option>`).join('')}</select>`;
    if (!pa) { c.innerHTML = `<div class="pthd"><h3>🎉 Party</h3><small class="muted">${L('Lade Freunde ein – der Anführer kann alle mit einem Klick auf seinen Server holen.')}</small></div>${invRow}<div class="prow">${sel}</div>`; }
    else {
      c.innerHTML = `<div class="pthd"><h3>🎉 Party <small class="muted">(${pa.members.length}/8)</small></h3><button class="btn ghost" id="pLeave">${L('Party verlassen')}</button></div>${invRow}
        <div class="pmem">${pa.members.map(m => `<span class="pm ${m.online ? 'on' : ''}">${m.leader ? '👑 ' : ''}${esc(m.name)}${pa.isLeader && !m.leader ? ` <button class="pk" data-pk="${esc(m.name)}" title="${L('Entfernen')}">✕</button>` : ''}</span>`).join('')}${(pa.invited || []).map(n => `<span class="pm inv">✉ ${esc(n)}</span>`).join('')}</div>
        <div class="prow">${sel}${pa.isLeader ? `<button class="btn" id="pPlay" title="${L('Alle Mitglieder bekommen eine Anfrage, deinem Server beizutreten')}">▶ ${L('Alle auf meinen Server holen')}</button>` : ''}</div>
        <div class="pchat" id="pChat">${msgs.slice(-40).map(m => `<div><b>${esc(m.from)}:</b> ${esc(m.text)}</div>`).join('') || `<small class="muted">${L('Party-Chat – im Spiel schreibst du mit /pc Nachricht')}</small>`}</div>
        <div class="prow"><input class="field" id="pMsg" maxlength="300" placeholder="${L('Nachricht an die Party …')}" autocomplete="off"><button class="btn" id="pSend">${L('Senden')}</button></div>`;
      const ch = $('#pChat'); if (ch) ch.scrollTop = ch.scrollHeight;
    }
    if (note) c.insertAdjacentHTML('beforeend', `<small class="pnote">${esc(note)}</small>`);
    c.querySelectorAll('[data-pa]').forEach(b => b.onclick = () => act('accept', { id: b.dataset.pa }));
    c.querySelectorAll('[data-pd]').forEach(b => b.onclick = () => act('decline', { id: b.dataset.pd }));
    c.querySelectorAll('[data-pk]').forEach(b => b.onclick = () => act('kick', { name: b.dataset.pk }));
    const s = $('#pInvSel'); if (s) s.onchange = () => { if (s.value) act('invite', { name: s.value }); };
    const lv = $('#pLeave'); if (lv) lv.onclick = () => { msgs = []; lastMsg = 0; act('leave'); };
    const pp = $('#pPlay'); if (pp) pp.onclick = playAll;
    const send = async () => { const i = $('#pMsg'); const t = i && i.value.trim(); if (!t) return; i.value = ''; await act('msg', { text: t }); };
    const sb = $('#pSend'); if (sb) sb.onclick = send; const mi = $('#pMsg'); if (mi) mi.onkeydown = e => { if (e.key === 'Enter') send(); };
  }

  async function act(p, body) { const r = await api(p, body); if (!r.ok && r.error) toast(r.error); await poll(); }
  let note = '', noteT = 0;
  function toast(t) { note = L(String(t || '')); clearTimeout(noteT); noteT = setTimeout(() => { note = ''; paint(); }, 6000); paint(); }

  async function playAll() {
    let srv = null;
    if (window.__playSrv) srv = { kind: 'addr', v: window.__playSrv.host + (window.__playSrv.port && window.__playSrv.port !== 25565 ? ':' + window.__playSrv.port : ''), label: String(window.__playSrv.name || window.__playSrv.host).slice(0, 30) };
    if (!srv) { toast(L('Starte zuerst selbst einen Server (Server-Liste → Play), dann kannst du alle mitnehmen.')); return; }
    const r = await api('play', { srv, ver: (window.__curVersion || '') }); toast(r.ok ? L('Anfrage an die Party geschickt.') : r.error);
  }

  async function poll() {
    if (busy) return; busy = true;
    try {
      const r = await api('state', { after: lastMsg }); if (!r.ok) { st = null; paint(); return; }
      st = r.data; const pa = st.party;
      if (pa && pa.msgs && pa.msgs.length) { msgs.push(...pa.msgs); lastMsg = pa.msgs[pa.msgs.length - 1].id; if (msgs.length > 120) msgs = msgs.slice(-120); }
      if (!pa) { msgs = []; lastMsg = 0; }
      try { const f = await window.cloudy.frApi({ method: 'GET', path: '/state' }); if (f.ok) friends = (f.data.friends || []).map(x => ({ name: x.name, online: !!x.online })); } catch {}
      // Anführer hat „alle mitnehmen“ geklickt -> nachfragen
      if (pa && pa.play && !pa.isLeader && pa.play.n > lastPlay && Date.now() - pa.play.t < 10 * 60e3) {
        lastPlay = pa.play.n; try { localStorage.setItem('cloudy.partyPlay', String(lastPlay)); } catch {}
        const v = pa.play.srv.v, i = v.lastIndexOf(':'), hostN = i > 0 && pa.play.srv.kind === 'addr' ? v.slice(0, i) : v, port = i > 0 && pa.play.srv.kind === 'addr' ? +v.slice(i + 1) : 25565;
        ask(`${pa.leader} ${L('möchte alle auf')} „${pa.play.srv.label || v}“ ${L('holen. Mitspielen?')}`, async () => {
          if (pa.play.srv.kind === 'code') { const j = await window.cloudy.srvCodeJoin(v); if (j && j.ok && window.play) window.play({ name: pa.play.srv.label || 'Party', host: j.host, port: j.port }); else toast(L('Der Server ist gerade nicht erreichbar.')); }
          else if (window.play) window.play({ name: pa.play.srv.label || 'Party', host: hostN, port });
        });
      }
      paint();
    } catch { } finally { busy = false; }
  }

  function ask(text, yes) {
    let d = $('#partyAsk'); if (d) d.remove(); d = document.createElement('div'); d.id = 'partyAsk'; d.className = 'partyask glass';
    d.innerHTML = `<b>🎉 Party</b><span>${esc(text)}</span><div><button class="btn" id="paY">${L('Mitspielen')}</button><button class="btn ghost" id="paN">${L('Nein')}</button></div>`;
    document.body.appendChild(d); d.querySelector('#paY').onclick = () => { d.remove(); yes(); }; d.querySelector('#paN').onclick = () => d.remove();
    try { if (!document.hasFocus() && window.cloudy.notify) window.cloudy.notify({ title: 'Cloudy Party', body: text, kind: 'party' }); } catch {}
  }

  // Anführer startet selbst ein Spiel auf einem Server -> Party automatisch fragen (nur wenn die Party mehr als eine Person hat)
  try { window.cloudy.on('gameStart', () => setTimeout(() => { if (st && st.party && st.party.isLeader && st.party.members.length > 1 && window.__playSrv) playAll(); }, 2500)); } catch {}
  window.partyPoll = poll;
  setTimeout(poll, 3000); setInterval(() => { if (!document.hidden || (st && st.party)) poll(); }, 6000);
})();
