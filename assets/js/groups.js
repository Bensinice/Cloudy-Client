// Gruppen im Reiter „Freunde“: Gruppenchat, Clan-Tag (zweites Tag neben dem Rang) und Sprachanruf (WebRTC, direkt zwischen den Spielern)
(() => {
  const $ = s => document.querySelector(s), esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const L = s => (window.t ? window.t(s) : s), cens = t => { try { return window.cloudy.censorText(t); } catch { return t; } };
  const list = $('#frList'); if (!list || !window.cloudy || !window.cloudy.frApi) return;
  const api = (path, body) => window.cloudy.frApi({ method: 'POST', path, body: body || {} });
  const box = document.createElement('div'); box.id = 'grpBox';
  box.innerHTML = `<div class="tools" style="margin:14px 0 4px"><b style="flex:1">${L('Gruppen')}</b><button class="btn ghost" id="grpNew">＋ ${L('Neue Gruppe')}</button></div>
    <div id="grpForm" style="display:none" class="grpform"><input id="gfName" class="field" maxlength="24" placeholder="${L('Gruppenname')}" autocomplete="off"><input id="gfTag" class="field" maxlength="4" placeholder="${L('Clan-Tag (bis 4 Zeichen, optional)')}" autocomplete="off"><div id="gfFr" class="muted"></div><div class="tools" style="margin:6px 0 0"><button class="btn" id="gfOk">${L('Erstellen')}</button><button class="btn ghost" id="gfNo">${L('Abbrechen')}</button></div><small class="muted" id="gfMsg"></small></div>
    <div id="grpList"></div>`;
  list.after(box);
  let D = { friends: [], groups: [], me: '' }, cur = null, lastId = 0, msgs = [], tools = false, timer = null, call = null, early = new Map(), note = '';
  const grp = () => D.groups.find(g => g.id === cur);
  const tagHtml = t => t ? `<span class="ctag clan">${esc(t)}</span>` : '';

  // ---------- Liste ----------
  function paintList() {
    $('#grpList').innerHTML = D.groups.length ? D.groups.map(g => `<div class="frrow clk ${cur === g.id ? 'sel' : ''}" data-g="${esc(g.id)}"><b style="flex:1">${esc(g.name)} ${tagHtml(g.tag)}<br><small class="fron">${g.members.length} ${L('Mitglieder')}${g.call && g.call.length ? ' · 📞 ' + L('Anruf läuft') + ' (' + g.call.length + ')' : ''}</small></b>${g.unread && cur !== g.id ? `<span class="badge">${g.unread}</span>` : ''}</div>`).join('') : `<p class="muted" style="font-size:12.5px">${L('Noch keine Gruppen. Mit „Neue Gruppe“ holst du Freunde zusammen: Chat, Anruf und ein Clan-Tag neben deinem Namen.')}</p>`;
    $('#grpList').querySelectorAll('[data-g]').forEach(b => b.onclick = () => open(b.dataset.g));
  }
  window.grpUpdate = d => { D = { friends: d.friends || [], groups: d.groups || [], me: d.me || '' }; if (cur && !grp()) { cur = null; window.__frSetChat && window.__frSetChat(null); } paintList(); if (cur && !tools) paintHead(); };
  list.addEventListener('click', () => { if (cur) { cur = null; clearInterval(timer); paintList(); } }, true);

  // ---------- Neue Gruppe ----------
  $('#grpNew').onclick = () => { const f = $('#grpForm'); f.style.display = f.style.display === 'none' ? '' : 'none'; $('#gfFr').innerHTML = D.friends.length ? D.friends.map(x => `<label style="display:flex;gap:6px;align-items:center;font-size:13px"><input type="checkbox" data-gf="${esc(x.name)}"> ${esc(x.name)}</label>`).join('') : L('Du brauchst erst Freunde.'); };
  $('#gfNo').onclick = () => { $('#grpForm').style.display = 'none'; };
  $('#gfOk').onclick = async () => {
    const members = [...document.querySelectorAll('[data-gf]:checked')].map(c => c.dataset.gf);
    const r = await api('/group/create', { name: $('#gfName').value, tag: $('#gfTag').value, members });
    if (!r.ok) { $('#gfMsg').textContent = L(r.error || 'Das hat nicht geklappt.'); return; }
    $('#gfMsg').textContent = ''; $('#gfName').value = $('#gfTag').value = ''; $('#grpForm').style.display = 'none';
    await refresh(); open(r.data.id);
  };
  async function refresh() { const r = await api('/state'); if (r.ok) { D = { friends: r.data.friends || [], groups: r.data.groups || [], me: r.data.me || '' }; paintList(); } }

  // ---------- Chat ----------
  function open(id) {
    cur = id; lastId = 0; msgs = []; tools = false; note = ''; if (window.__frSetChat) window.__frSetChat(null);
    $('#frChatBox').style.display = ''; $('#frMsgs').innerHTML = ''; paintHead(); paintList(); load(); clearInterval(timer); timer = setInterval(load, 3000);
  }
  function paintHead() {
    const g = grp(); if (!g) return;
    const mine = call && call.gid === g.id, running = g.call && g.call.length;
    $('#frChatHead').innerHTML = `<span>${esc(g.name)} ${tagHtml(g.tag)}</span> ` +
      (mine ? '' : `<button class="btn frplay" id="gCall" style="width:auto;border-radius:999px;padding:0 14px;margin-left:8px">📞 ${running ? L('Anruf beitreten') + ' (' + g.call.length + ')' : L('Anruf starten')}</button>`) +
      ` <button class="btn ghost" id="gTools" style="margin-left:6px">⚙ ${L('Verwalten')}</button>` +
      (mine ? `<div id="gCallBar" class="grpcall"><b>📞 ${L('Im Anruf')}</b> <span id="gCallWho"></span><button class="btn ghost" id="gMute">${call.muted ? '🔇 ' + L('Stumm') : '🎙 ' + L('Mikro an')}</button><button class="btn" id="gHang">${L('Auflegen')}</button></div>` : '') +
      (note ? `<div class="muted" style="font-size:12.5px;margin-top:4px">${esc(note)}</div>` : '') +
      (tools ? toolsHtml(g) : '');
    const c = $('#gCall'); if (c) c.onclick = () => startCall(g.id);
    $('#gTools').onclick = () => { tools = !tools; paintHead(); };
    if (mine) { $('#gHang').onclick = () => endCall(); $('#gMute').onclick = () => { call.muted = !call.muted; call.stream.getAudioTracks().forEach(t => { t.enabled = !call.muted; }); paintHead(); }; paintWho(); }
    if (tools) wireTools(g);
  }
  function paintWho() { const w = $('#gCallWho'); if (w && call) w.textContent = [D.me, ...(call.peers || [])].join(', '); }
  function toolsHtml(g) {
    const addable = D.friends.filter(f => !g.members.includes(f.name));
    return `<div class="grptools">
      ${g.tag ? `<button class="btn ghost" id="gClan">${g.clan ? '🏷 ' + L('Mein Clan-Tag ausblenden') : '🏷 ' + L('Als mein Clan-Tag zeigen') + ' [' + esc(g.tag) + ']'}</button>` : `<small class="muted">${L('Diese Gruppe hat noch kein Clan-Tag.')}</small>`}
      <div class="tools" style="margin:6px 0 0"><select id="gAddSel" class="field"><option value="">${L('Freund hinzufügen …')}</option>${addable.map(f => `<option>${esc(f.name)}</option>`).join('')}</select><button class="btn" id="gAdd">＋</button></div>
      <div class="muted" style="font-size:12.5px;margin-top:6px">${L('Mitglieder')}: ${g.members.map(esc).join(', ')}</div>
      ${g.mine ? `<div class="tools" style="margin:6px 0 0"><input id="gEName" class="field" maxlength="24" value="${esc(g.name)}"><input id="gETag" class="field" maxlength="4" value="${esc(g.tag)}" style="max-width:90px" placeholder="TAG"><button class="btn" id="gEdit">${L('Speichern')}</button></div>` : ''}
      <div class="tools" style="margin:6px 0 0"><button class="btn ghost" id="gLeave">${L('Gruppe verlassen')}</button>${g.mine ? `<button class="btn ghost" id="gDel">${L('Gruppe auflösen')}</button>` : ''}</div></div>`;
  }
  function wireTools(g) {
    const act = async (path, body, after) => { const r = await api(path, { id: g.id, ...body }); if (!r.ok) { note = r.error || ''; paintHead(); return; } await refresh(); if (after) after(); else paintHead(); };
    const c = $('#gClan'); if (c) c.onclick = () => act('/group/clan', { on: !g.clan });
    $('#gAdd').onclick = () => { const n = $('#gAddSel').value; if (n) act('/group/add', { name: n }); };
    const e = $('#gEdit'); if (e) e.onclick = () => act('/group/edit', { name: $('#gEName').value, tag: $('#gETag').value });
    const two = (id, fn) => { const b = $(id); if (!b) return; let armed = false; b.onclick = () => { if (!armed) { armed = true; b.textContent = L('Sicher?'); setTimeout(() => { armed = false; if (b.isConnected) b.textContent = id === '#gLeave' ? L('Gruppe verlassen') : L('Gruppe auflösen'); }, 4000); } else fn(); };
    };
    two('#gLeave', () => { if (call && call.gid === g.id) endCall(); act('/group/leave', {}, () => { cur = null; clearInterval(timer); window.__frSetChat && window.__frSetChat(null); paintList(); }); });
    two('#gDel', () => { if (call && call.gid === g.id) endCall(); act('/group/delete', {}, () => { cur = null; clearInterval(timer); window.__frSetChat && window.__frSetChat(null); paintList(); }); });
  }
  async function load() {
    const id = cur; if (!id) return; const r = await api('/group/msgs', { id, after: lastId }); if (!r.ok || id !== cur) return;
    if (r.data.msgs.length) { msgs.push(...r.data.msgs); lastId = msgs[msgs.length - 1].id; paintMsgs(); }
  }
  function paintMsgs() {
    const b = $('#frMsgs'), me = D.me;
    b.innerHTML = msgs.map(m => `<div class="mrow ${m.from === me ? 'me' : ''}"><span class="mav" data-i="${esc((m.from || '?')[0].toUpperCase())}"></span><div class="msg ${m.from === me ? 'me' : ''}"><small style="display:block;opacity:.75;font-weight:700">${esc(m.from)}</small><span>${esc(cens(m.text))}</span></div></div>`).join('');
    b.scrollTop = b.scrollHeight;
  }
  async function send() { const v = $('#frText').value.trim(); if (!v || !cur) return; $('#frText').value = ''; const r = await api('/group/msg', { id: cur, text: v }); if (r.ok) load(); }
  $('#frSend').addEventListener('click', e => { if (cur) { e.stopImmediatePropagation(); send(); } }, true);
  $('#frText').addEventListener('keydown', e => { if (cur && e.key === 'Enter') { e.stopImmediatePropagation(); e.preventDefault(); send(); } }, true);

  // ---------- Sprachanruf (WebRTC) ----------
  const ICE = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] };
  const sig = (to, data) => api('/call/signal', { id: call && call.gid, to, data });
  async function startCall(gid) {
    if (call) return; note = '';
    let stream;
    try {
      if (window.cloudy.micAccess && !(await window.cloudy.micAccess())) { note = L('Kein Zugriff aufs Mikrofon – erlaube es in den Systemeinstellungen.'); paintHead(); return; }
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch { note = L('Kein Mikrofon gefunden oder der Zugriff wurde verweigert.'); paintHead(); return; }
    const r = await api('/call/join', { id: gid });
    if (!r.ok) { stream.getTracks().forEach(t => t.stop()); note = r.error || L('Das hat nicht geklappt.'); paintHead(); return; }
    call = { gid, stream, pcs: new Map(), peers: r.data.peers || [], muted: false, busy: false, timer: setInterval(pollCall, 1000) };
    for (const n of call.peers) mkPeer(n, true);
    paintHead(); paintList();
  }
  function mkPeer(name, init) {
    const pc = new RTCPeerConnection(ICE), ent = { pc, audio: new Audio(), queue: [], remote: false };
    call.stream.getTracks().forEach(t => pc.addTrack(t, call.stream));
    pc.ontrack = e => { ent.audio.srcObject = e.streams[0]; ent.audio.play().catch(() => {}); };
    pc.onicecandidate = e => { if (e.candidate) sig(name, { type: 'cand', c: e.candidate.toJSON() }); };
    call.pcs.set(name, ent);
    if (init) pc.createOffer().then(o => pc.setLocalDescription(o)).then(() => sig(name, { type: 'offer', sdp: pc.localDescription.sdp })).catch(() => {});
    return ent;
  }
  const flush = ent => { while (ent.queue.length) ent.pc.addIceCandidate(ent.queue.shift()).catch(() => {}); };
  async function onSignal(from, d) {
    if (!call || !d) return; let ent = call.pcs.get(from);
    if (d.type === 'offer') {
      if (ent) { try { ent.pc.close(); } catch {} call.pcs.delete(from); }
      ent = mkPeer(from, false); await ent.pc.setRemoteDescription({ type: 'offer', sdp: d.sdp }); ent.remote = true; (early.get(from) || []).forEach(c => ent.queue.push(c)); early.delete(from); flush(ent);
      const a = await ent.pc.createAnswer(); await ent.pc.setLocalDescription(a); sig(from, { type: 'answer', sdp: a.sdp });
    } else if (d.type === 'answer') { if (ent && !ent.remote) { await ent.pc.setRemoteDescription({ type: 'answer', sdp: d.sdp }); ent.remote = true; flush(ent); } }
    else if (d.type === 'cand') { if (ent && ent.remote) ent.pc.addIceCandidate(d.c).catch(() => {}); else if (ent) ent.queue.push(d.c); else { const a = early.get(from) || []; a.push(d.c); early.set(from, a); } }
  }
  async function pollCall() {
    if (!call || call.busy) return; call.busy = true; const c = call;
    try {
      const r = await api('/call/poll', { id: c.gid }); if (call !== c) return;
      if (r.ok) {
        if (r.data.left) { endCall(true); return; }
        for (const s of r.data.signals || []) { try { await onSignal(s.from, s.data); } catch {} }
        const names = new Set(r.data.peers || []);
        for (const [n, e] of c.pcs) if (!names.has(n)) { try { e.pc.close(); } catch {} e.audio.srcObject = null; c.pcs.delete(n); }
        c.peers = r.data.peers || []; paintWho();
      }
    } finally { if (call) call.busy = false; }
  }
  function endCall(quiet) {
    if (!call) return; const c = call; call = null; clearInterval(c.timer); early.clear();
    for (const [, e] of c.pcs) { try { e.pc.close(); } catch {} e.audio.srcObject = null; }
    c.stream.getTracks().forEach(t => t.stop()); if (!quiet) api('/call/leave', { id: c.gid }); else api('/call/leave', { id: c.gid });
    if (cur) paintHead(); paintList();
  }
  window.addEventListener('beforeunload', () => { if (call) api('/call/leave', { id: call.gid }); });
})();
