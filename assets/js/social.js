// Cloudy – Server hosten, Freunde (Chat), Passwort ändern, Minecraft-HUD-Einstellungen
(function () {
  const L = s => (window.t ? window.t(s) : s), tr = () => { if (window.setLang) window.setLang(document.documentElement.lang || 'de'); };

  // ---------- Eigener Server ----------
  let host = { running: false }, codePort = null;
  function hostVersions() {
    const rel = (typeof all !== 'undefined' && Array.isArray(all) ? all : []).filter(v => v.type === 'release').map(v => v.id);
    const cur = $('#hv').value || version || rel[0]; $('#hv').innerHTML = [...new Set([version, ...rel].filter(Boolean))].map(i => `<option ${i === cur ? 'selected' : ''}>${esc(i)}</option>`).join('');
  }
  function paintHost() {
    $('#hStart').disabled = host.running || !!host.busy; $('#hStop').disabled = !host.running; $('#hJoin').disabled = !(host.running && host.ready);
    const ips = (host.ips || []).map(i => i + ':' + (host.port || $('#hp').value)).join('  ·  ');
    { const row = $('#hCodeRow'); if (row) { const on = host.running && host.ready; row.style.display = on ? '' : 'none'; if (on && host.port !== codePort) { codePort = host.port; window.cloudy.srvShareCode({ port: host.port || 25565 }).then(r => { if (r && r.ok) $('#hCode').textContent = r.code; }); } } }
    $('#hInfo').textContent = host.running ? (host.ready ? `${L('Bereit')} (${host.version}${host.type === 'paper' ? ' Paper' : ''}) – ${L('Freunde sehen den Server im Freunde-Tab und treten mit einem Klick bei.')}` : L('Server startet … (beim ersten Mal kann das 1–2 Minuten dauern, danach wird „Selbst beitreten“ frei)')) : (host.status || L('Server ist aus.'));
  }
  const cens = t => { try { return window.cloudy.censorText(t); } catch { return t; } };
  const log = l => { const p = $('#hLog'); p.textContent += l + '\n'; if (p.textContent.length > 20000) p.textContent = p.textContent.slice(-15000); p.scrollTop = p.scrollHeight; };
  async function refreshHost() { host = { ...(await window.cloudy.serverStatus()) }; paintHost(); }
  window.cloudy.on('serverLog', log);
  window.cloudy.on('serverState', s => { host = { ...host, ...s, busy: false }; if (s.status) host.status = s.status; paintHost(); });
  $('#hStart').onclick = async () => {
    host.busy = true; host.status = L('Starte …'); paintHost(); $('#hLog').textContent = '';
    const r = await window.cloudy.serverStart({ version: $('#hv').value, ram: $('#hr').value, port: $('#hp').value, online: $('#hOnline').checked, eula: $('#hEula').checked, motd: $('#hMotd').value, type: $('#hType').value });
    host.busy = false; if (!r.ok) { host.status = L(r.error); log(L(r.error)); } await refreshHost();
  };
  { const cb = $('#hCodeCopy'); if (cb) cb.onclick = () => { try { navigator.clipboard.writeText($('#hCode').textContent); cb.textContent = L('Kopiert ✓'); setTimeout(() => cb.textContent = L('Code kopieren'), 1500); } catch {} }; }
  $('#hStop').onclick = () => { window.cloudy.serverStop(); log(L('Server wird gestoppt …')); };
  $('#hFolder').onclick = () => window.cloudy.serverFolder($('#hv').value, $('#hType').value);
  $('#hJoin').onclick = () => { version = $('#hv').value; st.set('version', version); paintVersion(); play({ name: 'Mein Server', host: 'localhost', port: host.port || 25565 }); };
  $('#hSend').onclick = () => { const v = $('#hCmd').value.trim(); if (v) { window.cloudy.serverCmd(v); log('> ' + v); $('#hCmd').value = ''; } };
  $('#hCmd').onkeydown = e => { if (e.key === 'Enter') $('#hSend').click(); };
  $('#frCodeCopy').onclick = () => { try { navigator.clipboard.writeText(fr.code); $('#frMsg').textContent = L('Code kopiert ✓'); } catch {} };
  $('#hEulaLink').onclick = e => { e.preventDefault(); window.cloudy.openExternal('https://www.minecraft.net/en-us/eula'); };

  // ---------- Freunde ----------
  let fr = { conn: false, state: null, chat: null, last: 0, msgs: [], timer: null };
  const FS = { host: false };
  async function frCheck() {
    const c = await window.cloudy.frConn(); fr.conn = c.connected;
    const tab = fr.tab || 'chat';
    $$('#frTabs [data-ft]').forEach(b => b.classList.toggle('on', b.dataset.ft === tab));
    $('#frConnect').style.display = tab === 'conn' ? '' : 'none'; $('#frMain').style.display = tab === 'chat' ? '' : 'none'; $('#frOffline').style.display = tab === 'chat' && !c.connected ? '' : 'none';
    $('#frMain').style.display = tab === 'chat' && c.connected ? '' : 'none';
    if (!$('#frName').value) $('#frName').value = c.me || ''; const h = await window.cloudy.frHostStatus(); FS.host = h.running; paintFrHost(h);
    if (c.connected) { $('#frMe').textContent = c.account ? c.name + ' · ' + L('Cloudy-Konto') : c.name + ' @ ' + c.url; { const t = fr.state && fr.state.tags; if (t && t.length && window.cloudyTags) $('#frMe').insertAdjacentHTML('beforeend', ' ' + window.cloudyTags(t)); } $('#frOut').style.display = c.account ? 'none' : ''; poll(); }
    tr();
  }
  function paintFrHost(h) {
    $('#frHostBtn').textContent = h.running ? L('Freundesserver stoppen') : L('Freundesserver hier starten');
    $('#frHostInfo').textContent = h.running ? `${L('Läuft.')} ${L('Dein Freundescode:')} ${h.code}` : L('Aus.'); $('#frCodeCopy').style.display = h.running ? '' : 'none'; fr.code = h.code || '';
    if (h.running && !$('#frUrl').value) $('#frUrl').value = 'localhost:' + h.port;
  }
  $$('#frTabs [data-ft]').forEach(b => b.onclick = () => { fr.tab = b.dataset.ft; frCheck(); });
  $('#frGoConn').onclick = () => { fr.tab = 'conn'; frCheck(); };
  $('#frHostBtn').onclick = async () => { const h = await window.cloudy.frHost(!FS.host); if (!h.ok) { $('#frMsg').textContent = L(h.error); return; } FS.host = h.running; paintFrHost(h); };
  const connect = mode => async () => {
    $('#frMsg').textContent = '';
    const r = await window.cloudy.frConnect({ url: $('#frUrl').value, name: $('#frName').value.trim(), pass: $('#frPass').value, mode });
    if (!r.ok) { $('#frMsg').textContent = L(r.error); return; } $('#frPass').value = ''; fr.tab = 'chat'; frCheck();
  };
  $('#frLogin').onclick = connect('login'); $('#frReg').onclick = connect('register');
  $('#frOut').onclick = async () => { await window.cloudy.frDisconnect(); fr.chat = null; clearTimeout(fr.timer); frCheck(); };
  async function api(method, path, body) { const r = await window.cloudy.frApi({ method, path, body }); if (r.auth) { frCheck(); } return r; }
  // Kleine Nachrichten-Bubble unten rechts, wenn ein Freund schreibt (nicht, solange du genau mit ihm im Chat bist)
  let seenUn = null, bubT = null;
  async function bubbleCheck(d) {
    const cur = {}; for (const f of d.friends || []) cur[f.name] = f.unread || 0;
    const prev = seenUn; seenUn = cur; if (!prev) return;
    const onChat = $('#p-friends').classList.contains('on');
    for (const f of d.friends || []) {
      if ((f.unread || 0) <= (prev[f.name] || 0) || (onChat && fr.chat === f.name)) continue;
      let txt = ''; try { const r = await api('GET', `/msgs?with=${encodeURIComponent(f.name)}&after=0`); const l = r.ok && r.data.msgs && r.data.msgs[r.data.msgs.length - 1]; if (l && l.from !== d.me) txt = String(l.text || '').slice(0, 80); } catch {}
      showBubble(f.name, txt); break;
    }
  }
  function showBubble(name, txt) {
    let b = document.getElementById('frBubble');
    if (!b) { b = document.createElement('div'); b.id = 'frBubble'; b.style.cssText = 'position:fixed;right:22px;bottom:22px;z-index:9999;width:340px;max-width:calc(100vw - 44px);padding:16px 20px 17px;border-radius:26px;background:linear-gradient(145deg,color-mix(in srgb,var(--accent) 34%,transparent),color-mix(in srgb,var(--accent2) 16%,transparent) 55%,rgba(255,255,255,.07));backdrop-filter:blur(26px) saturate(1.7);-webkit-backdrop-filter:blur(26px) saturate(1.7);border:1px solid rgba(255,255,255,.34);box-shadow:0 16px 48px rgba(0,0,0,.38),inset 0 1.5px 0 rgba(255,255,255,.5),inset 0 -10px 24px rgba(255,255,255,.05);color:#fff;font-size:16px;line-height:1.35;cursor:pointer;transition:opacity .35s cubic-bezier(.2,.9,.3,1.2),transform .35s cubic-bezier(.2,.9,.3,1.2);opacity:0;transform:translateY(18px) scale(.94);text-shadow:0 1px 8px rgba(0,0,0,.35)'; document.body.appendChild(b); }
    b.innerHTML = `<b style="display:block;font-size:17px;margin-bottom:3px">💬 ${esc(name)}</b><span style="opacity:.95;word-break:break-word">${esc(cens(txt) || L('hat dir geschrieben'))}</span>`;
    b.onclick = () => { b.style.opacity = 0; b.style.transform = 'translateY(18px) scale(.94)'; b.style.pointerEvents = 'none'; try { go('friends'); fr.chat = name; fr.last = 0; fr.msgs = []; paintChat(); loadMsgs(); paintFriends(); } catch {} };
    b.style.pointerEvents = ''; requestAnimationFrame(() => { b.style.opacity = 1; b.style.transform = 'none'; });
    clearTimeout(bubT); bubT = setTimeout(() => { b.style.opacity = 0; b.style.transform = 'translateY(18px) scale(.94)'; b.style.pointerEvents = 'none'; }, 6000);
  }
  async function poll() {
    clearTimeout(fr.timer); if (!fr.conn) return;
    const r = await api('GET', '/state');
    if (r.ok) { try { bubbleCheck(r.data); } catch {} fr.state = r.data; paintFriends(); const n = r.data.friends.reduce((a, f) => a + f.unread, 0) + r.data.incoming.length; const b = $('#frBadge'); b.textContent = n ? n : ''; b.style.display = n ? '' : 'none'; $('#frOff').textContent = ''; }
    else if (r.offline) $('#frOff').textContent = L(r.error);
    if (fr.chat) await loadMsgs();
    fr.timer = setTimeout(poll, $('#p-friends').classList.contains('on') ? 3000 : 6000);
  }
  function paintFriends() {
    const s = fr.state; if (!s) return;
    $('#frReq').innerHTML = s.incoming.map(n => `<div class="frrow"><b>${esc(n)}</b><span class="muted" style="flex:1">${L('möchte dein Freund sein')}</span><button class="btn" data-ac="${esc(n)}">✓</button><button class="btn ghost" data-dc="${esc(n)}">✕</button></div>`).join('');
    $('#frList').innerHTML = s.friends.length ? s.friends.map(f => `<div class="frrow clk ${fr.chat === f.name ? 'sel' : ''}" data-f="${esc(f.name)}"><i class="dot ${f.online ? 'on' : ''}"></i><b style="flex:1">${esc(f.name)}${(window.cloudyTags || (() => ''))(f.tags)}${f.server ? `<br><small class="muted">${L('Server online')} · ${esc(f.server.version || '')}</small>` : ''}</b>${f.server ? `<button class="btn" data-j="${esc(f.name)}">${L('Beitreten')}</button>` : ''}${f.unread ? `<span class="badge">${f.unread}</span>` : ''}</div>`).join('') : `<p class="muted">${L('Noch keine Freunde. Füge oben jemanden hinzu.')}</p>`;
    $$('#frReq [data-ac]').forEach(b => b.onclick = async () => { await api('POST', '/friend/accept', { name: b.dataset.ac }); poll(); });
    $$('#frReq [data-dc]').forEach(b => b.onclick = async () => { await api('POST', '/friend/decline', { name: b.dataset.dc }); poll(); });
    $$('#frList [data-j]').forEach(b => b.onclick = async e => { e.stopPropagation(); const f = s.friends.find(x => x.name === b.dataset.j); if (!f || !f.server) return; b.disabled = true; $('#frOff').textContent = L('Verbinde …'); const r = await window.cloudy.frJoin({ hosts: f.server.hosts, port: f.server.port }); b.disabled = false; $('#frOff').textContent = ''; if (!r.ok) { $('#frOff').textContent = L(r.error); return; } if (f.server.version) { version = f.server.version; st.set('version', version); paintVersion(); } play({ name: f.name, host: r.host, port: r.port }); });
    $$('#frList [data-f]').forEach(b => b.onclick = () => { fr.chat = b.dataset.f; fr.last = 0; fr.msgs = []; paintChat(); loadMsgs(); paintFriends(); });
    tr();
  }
  async function loadMsgs() {
    if (!fr.chat) return; const who = fr.chat, r = await api('GET', `/msgs?with=${encodeURIComponent(who)}&after=${fr.last}`);
    if (!r.ok || who !== fr.chat) return;
    if (r.data.msgs.length) { fr.msgs.push(...r.data.msgs); fr.last = fr.msgs[fr.msgs.length - 1].id; paintChat(true); }
  }
  function paintChat(scroll) {
    { const ff = fr.state && fr.state.friends.find(x => x.name === fr.chat); $('#frChatHead').innerHTML = fr.chat ? esc(fr.chat) + (window.cloudyTags ? window.cloudyTags(ff && ff.tags) : '') : esc(L('Wähle einen Freund')); }
    $('#frChatBox').style.display = fr.chat ? '' : 'none';
    const me = fr.state ? fr.state.me : '', box = $('#frMsgs');
    const avs = {}; ((fr.state && fr.state.friends) || []).forEach(f => { if (f.av) avs[f.name] = f.av; });
    const head = n => { const src = n === me ? (window.cloudyHeadMine && window.cloudyHeadMine()) : avs[n]; return `<span class="mav" data-i="${esc((n || '?')[0].toUpperCase())}">${src ? `<img src="${src}" alt="">` : ''}</span>`; };
    const isCode = t => /^[A-Za-z0-9]{4}(-[A-Za-z0-9]{4}){2}$/.test(String(t).trim());
    // Server in einer Nachricht erkennen: Server-Code (CLD-XXXX-XXXX-XXXX-XXXX) oder Adresse (play.beispiel.de, 1.2.3.4:25565) -> Knopf „Verbinden“
    const TLD = /\.(net|com|de|org|gg|io|eu|me|xyz|fun|cc|tv|pro|online|host|club|world|games|lol|co|uk|us|at|ch|nl|fr|pl|ru|cz|app)$/i;
    const srvOf = t => {
      const s = String(t || '').trim(), cm = /\bCLD(-[A-Za-z0-9]{4}){4}\b/i.exec(s); if (cm) return { code: cm[0].toUpperCase() };
      const words = s.split(/\s+/);
      for (const w0 of words) {
        const w = w0.replace(/[.,!?;:)\]]+$/, ''); if (/^https?:/i.test(w) || w.length > 80) continue;
        const m = /^((?:\d{1,3}(?:\.\d{1,3}){3})|(?:[a-z0-9-]+\.)+[a-z]{2,24})(?::(\d{2,5}))?$/i.exec(w); if (!m) continue;
        if (m[2] || /^\d/.test(m[1]) || words.length === 1 || TLD.test(m[1])) return { host: m[1], port: m[2] ? +m[2] : 25565 };
      }
      return null;
    };
    box.innerHTML = fr.msgs.map(m => `<div class="mrow ${m.from === me ? 'me' : ''}">${head(m.from)}<div class="msg ${m.from === me ? 'me' : ''}"><span>${esc(cens(m.text))}</span>${isCode(m.text) && m.from !== me ? `<button class="btn rdm" data-rc="${esc(m.text.trim())}">${L('Einlösen')}</button><em class="rdr"></em>` : (() => { const sv = !isCode(m.text) && srvOf(m.text); return sv ? `<button class="btn rdm" data-sv="${esc(sv.code || (sv.host + ':' + sv.port))}">${L('Verbinden')}</button><em class="rdr">${esc(sv.code ? L('Server-Code') : sv.host + (sv.port !== 25565 ? ':' + sv.port : ''))}</em>` : ''; })()}<small>${new Date(m.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small></div></div>`).join('');
    box.querySelectorAll('[data-sv]').forEach(b => b.onclick = async () => {
      const out = b.parentNode.querySelector('.rdr'), v = b.dataset.sv; b.disabled = true;
      try {
        if (/^CLD-/i.test(v)) { out.textContent = L('Verbinde …'); const r = await window.cloudy.srvCodeJoin(v); if (!r.ok) { out.textContent = L(r.error); b.disabled = false; return; } out.textContent = ''; b.disabled = false; play({ name: 'Freundes-Server', host: r.host, port: r.port }); }
        else { const i = v.lastIndexOf(':'); b.disabled = false; play({ name: v.slice(0, i), host: v.slice(0, i), port: +v.slice(i + 1) }); }
      } catch { out.textContent = L('Das hat nicht geklappt.'); b.disabled = false; }
    });
    box.querySelectorAll('[data-rc]').forEach(b => b.onclick = async () => {
      b.disabled = true; const out = b.parentNode.querySelector('.rdr'); out.textContent = '…';
      const r = await window.cloudy.codeRedeem(b.dataset.rc).catch(() => ({ ok: false, error: 'Der Konto-Server ist nicht erreichbar.' }));
      if (!r.ok) { out.textContent = L(r.error || 'Code ungültig.'); b.disabled = false; return; }
      if (r.state) window.shopCatalog = r.state.catalog; const cat = window.shopCatalog || [];
      out.textContent = '🎉 ' + L('Eingelöst'); b.remove();
      try { window.rewardAnim({ coins: r.coins || 0, items: (r.items || []).map(id => ({ id, name: (cat.find(c => c.id === id) || {}).name || id })) }); } catch {}
      try { if (window.pollShop) window.pollShop(); } catch {}
    });
    if (scroll !== false) box.scrollTop = box.scrollHeight;
  }
  async function send() {
    const v = $('#frText').value.trim(); if (!v || !fr.chat) return; $('#frText').value = '';
    const r = await api('POST', '/msg', { to: fr.chat, text: v }); if (!r.ok) $('#frOff').textContent = L(r.error || ''); else loadMsgs();
  }
  $('#frSend').onclick = send; $('#frText').onkeydown = e => { if (e.key === 'Enter') send(); };
  $('#frAdd').onclick = async () => { const n = $('#frAddName').value.trim(); if (!n) return; const r = await api('POST', '/friend/add', { name: n }); $('#frAddMsg').textContent = r.ok ? L('Anfrage gesendet ✓') : L(r.error || ''); if (r.ok) { $('#frAddName').value = ''; poll(); } };
  $('#frAddName').onkeydown = e => { if (e.key === 'Enter') $('#frAdd').click(); };

  // ---------- Passwort ändern ----------
  $('#pwBtn').onclick = () => { const r = $('#pwRow'); r.style.display = r.style.display === 'none' ? 'flex' : 'none'; $('#pwMsg').textContent = ''; };
  $('#pwGo').onclick = async () => {
    const r = await window.cloudy.authChangeOwn({ old: $('#pwOld').value, pass: $('#pwNew').value });
    $('#pwMsg').textContent = r.ok ? L('Passwort geändert ✓') : L(r.error);
    if (r.ok) { $('#pwOld').value = $('#pwNew').value = ''; setTimeout(() => $('#pwRow').style.display = 'none', 1500); }
  };

  // ---------- Minecraft-HUD ----------
  const hud = () => st.get('hud', { fps: true, ping: true, armor: true, coords: false });
  [['hFps', 'fps'], ['hPing', 'ping'], ['hArmor', 'armor'], ['hCoords', 'coords']].forEach(([id, k]) => { $('#' + id).checked = !!hud()[k]; $('#' + id).onchange = e => st.set('hud', { ...hud(), [k]: e.target.checked }); });

  // ---------- Seiten-Hooks ----------
  // ---------- Server-Tab: Reiter, öffentliche Server, Plugins ----------
  const PUB = [['Hypixel', 'mc.hypixel.net', 'Minispiele, SkyBlock, Bedwars'], ['GommeHD', 'gommehd.net', 'Deutsch · Minispiele, Bedwars, Survival'], ['CubeCraft', 'play.cubecraft.net', 'Minispiele und Parkour'], ['Wynncraft', 'play.wynncraft.com', 'Riesiges Mod-RPG (Fabric nötig)'], ['2b2t', '2b2t.org', 'Anarchie-Server (alt & berühmt)']];
  function ssTab(k) { $$('#srvTabs [data-ss]').forEach(b => b.classList.toggle('on', b.dataset.ss === k)); $$('#p-servers .srvsec').forEach(s => s.style.display = s.dataset.ss === k ? '' : 'none'); if (k === 'plugins') plInit(); if (k === 'own') hostVersions(); }
  $$('#srvTabs [data-ss]').forEach(b => b.onclick = () => ssTab(b.dataset.ss));
  $('#pubList').innerHTML = PUB.map(([n, h, d]) => `<div class="glass set" style="display:flex;gap:12px;align-items:center;margin-bottom:10px"><div style="flex:1"><b>${n}</b><div class="muted">${h} · <span>${d}</span></div></div><button class="btn" data-pj="${h}">Beitreten</button><button class="btn ghost" data-pa="${h}" data-pn="${n}">Zu meinen Servern</button></div>`).join('');
  $$('#pubList [data-pj]').forEach(b => b.onclick = () => play({ name: b.dataset.pj, host: b.dataset.pj, port: 25565 }));
  $$('#pubList [data-pa]').forEach(b => b.onclick = () => { if (!servers.some(s => s.host === b.dataset.pa)) { servers.push({ name: b.dataset.pn, host: b.dataset.pa, port: 25565 }); st.set('servers', servers); if (typeof renderServers === 'function') renderServers(); } b.textContent = L('Hinzugefügt ✓'); });
  let plReady = false;
  function plInit() {
    if (!plReady) { plReady = true; $('#pv').innerHTML = $('#hv').innerHTML || `<option>${esc(version || '')}</option>`; $('#pv').value = $('#hv').value || version; $('#pv').onchange = () => { plInst(); plSearch(); }; }
    if (!$('#pv').options.length) { hostVersions(); $('#pv').innerHTML = $('#hv').innerHTML; } if (!$('#pv').options.length) $('#pv').innerHTML = '<option>1.21.4</option>'; plInst(); plSearch(); // Beliebte Plugins sofort anzeigen (wie bei den Ressourcen)
  }
  const thumb = (ic, name) => ic ? `<img class="mi" src="${esc(ic)}" alt="" loading="lazy">` : `<span class="ph">${esc((String(name || '?')[0] || '?').toUpperCase())}</span>`;
  async function plInst() { const list = await window.cloudy.pluginList($('#pv').value), ics = await window.cloudy.pluginIcons($('#pv').value) || {}; $('#plInst').innerHTML = list.length ? list.map(f => `<div class="frrow">${thumb(ics[f] && ics[f].icon, (ics[f] && ics[f].title) || f)}<b style="flex:1">${esc((ics[f] && ics[f].title) || f)}</b><button class="btn ghost" data-rm="${esc(f)}">Entfernen</button></div>`).join('') : `<p class="muted">${L('Noch keine Plugins installiert.')}</p>`; $$('#plInst [data-rm]').forEach(b => b.onclick = async () => { await window.cloudy.pluginRemove({ version: $('#pv').value, file: b.dataset.rm }); plInst(); }); tr(); }
  let plPage = 0;
  async function plSearch(pg) {
    plPage = typeof pg === 'number' ? pg : 0; $('#plMsg').textContent = L('Suche …'); const r = await window.cloudy.pluginSearch({ q: $('#plQ').value, version: $('#pv').value, offset: plPage * 20 }); $('#plMsg').textContent = r.length ? '' : L('Nichts gefunden für diese Version.');
    $('#plRes').innerHTML = r.map(p => `<div class="frrow clk" data-po="${esc(p.id)}" style="cursor:pointer">${thumb(p.icon, p.title)}<b style="flex:1">${esc(p.title)}<br><small class="muted">${esc(p.desc || '')}</small></b><button class="btn" data-pi="${esc(p.id)}">Installieren</button></div>`).join('');
    $$('#plRes [data-po]').forEach(el => el.onclick = e => { if (!e.target.closest('button') && window.openMod) window.openMod(el.dataset.po, { type: 'plugin', plugin: true, ver: $('#pv').value }); });
    if (window.pager) window.pager($('#plRes'), plPage, r.length >= 20, plSearch);
    $$('#plRes [data-pi]').forEach(b => b.onclick = async e => { e.stopPropagation(); b.disabled = true; b.textContent = '…'; const x = await window.cloudy.pluginInstall({ id: b.dataset.pi, version: $('#pv').value }); b.textContent = x.ok ? L('Installiert ✓') : L('Fehler'); if (!x.ok) $('#plMsg').textContent = L(x.error); else { $('#plMsg').textContent = L('Starte den Server neu (Art: Paper), damit das Plugin aktiv wird.'); plInst(); } });
    tr();
  }
  $('#plGo').onclick = () => plSearch(0); $('#plQ').onkeydown = e => { if (e.key === 'Enter') plSearch(0); };
  const ps = window.paintSub;
  window.paintSub = p => { if (ps) ps(p); if (p === 'servers') { hostVersions(); refreshHost(); } if (p === 'friends') frCheck(); };
  window.cloudy.frConn().then(c => { if (c.connected) { fr.conn = true; poll(); } });
})();
