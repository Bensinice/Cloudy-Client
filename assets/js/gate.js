// Zugangscode: beim ersten Start muss ein Code eingegeben werden (wird im Hauptprozess geprueft und danach gespeichert)
(function () {
  const api = window.cloudy; if (!api || !api.gate) return;
  window.cloudyGatePending = true;
  const ov = document.createElement('div'); ov.id = 'cdGate';
  const open = () => { window.cloudyGatePending = false; try { window.dispatchEvent(new Event('cloudy-gate-ok')); } catch {} };
  ov.innerHTML = '<div class="gcard"><svg viewBox="0 0 64 44" width="64" height="44"><defs><linearGradient id="gg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d8ecff"/><stop offset="1" stop-color="#4aa3ff"/></linearGradient></defs><path fill="url(#gg)" d="M16 40a12 12 0 0 1-1-24 16 16 0 0 1 30-3 14 14 0 0 1 4 27z"/></svg><h2>Cloudy</h2><p>Early access. Enter your access code to continue.</p><input id="gateIn" type="password" placeholder="Access code" autocomplete="off" spellcheck="false"><button id="gateGo">Continue</button><div id="gateMsg"></div><small>Currently in beta.</small><a id="gateAdm" href="#" style="font-size:12px;color:#7b88a3;text-decoration:none;margin-top:2px">Admin?</a><a id="gateUpd" href="#" style="font-size:12px;color:#7b88a3;text-decoration:none;margin-top:2px;margin-left:14px">Update</a><a id="gateReq" href="#" style="font-size:12px;color:#4aa3ff;text-decoration:none;margin-top:2px;margin-left:14px;font-weight:600">Request key</a></div>';
  const st = document.createElement('style');
  st.textContent = '#cdGate{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;background:linear-gradient(160deg,#a9d4ff,#eaf6ff);font-family:inherit}#cdGate .gcard{width:min(380px,calc(100vw - 32px));padding:34px 30px;border-radius:28px;background:rgba(255,255,255,.62);backdrop-filter:blur(22px);box-shadow:0 20px 60px rgba(40,90,170,.25),inset 0 0 0 1px rgba(255,255,255,.8);text-align:center;color:#1b2236;display:grid;gap:12px;justify-items:center}#cdGate h2{margin:0;font-size:30px;letter-spacing:.5px}#cdGate p{margin:0;color:#4b5b78;font-size:14px}#cdGate input{width:100%;box-sizing:border-box;padding:13px 16px;border-radius:14px;border:1px solid rgba(74,163,255,.45);background:rgba(255,255,255,.85);font-size:15px;text-align:center;outline:none}#cdGate input:focus{border-color:#4aa3ff;box-shadow:0 0 0 4px rgba(74,163,255,.2)}#cdGate button{width:100%;padding:13px;border:0;border-radius:14px;background:linear-gradient(180deg,#6eb6ff,#3d8ef0);color:#fff;font-weight:700;font-size:15px;cursor:pointer}#cdGate #gateMsg{min-height:18px;color:#d23b5a;font-size:13px}#cdGate small{color:#7b88a3}#cdGate.shake .gcard{animation:gsh .35s}@keyframes gsh{25%{transform:translateX(-8px)}75%{transform:translateX(8px)}}';
  document.head.appendChild(st);
  function show() { document.body.appendChild(ov); setTimeout(() => { const i = ov.querySelector('#gateIn'); i && i.focus(); }, 50); }
  async function submit() {
    const i = ov.querySelector('#gateIn'), m = ov.querySelector('#gateMsg');
    let r = { ok: false }; try { r = await api.gate(i.value); } catch {}
    if (r && r.ok) { ov.remove(); open(); }
    else { m.textContent = (r && r.error) || 'That code is not valid.'; ov.classList.remove('shake'); void ov.offsetWidth; ov.classList.add('shake'); i.select(); }
  }
  // Admin?: nur mit einem Admin-Konto anmelden (umgeht den Zugangscode)
  let admMode = false; const card = ov.querySelector('.gcard'), keep = card.innerHTML;
  function admForm() {
    admMode = true;
    card.innerHTML = keep.replace(/<input[\s\S]*<\/small>/, '<input id="gateUser" type="text" placeholder="Admin account" autocomplete="username" spellcheck="false"><input id="gatePass" type="password" placeholder="Password" autocomplete="current-password"><button id="gateGo">Sign in as admin</button><div id="gateMsg"></div><small>Admin accounts only.</small>').replace(/Early access\.[^<]*/, 'Admin sign-in.');
    card.querySelector('#gateAdm').textContent = '← Back'; card.querySelector('#gateAdm').onclick = ev => { ev.preventDefault(); location.reload(); };
    card.querySelector('#gateGo').onclick = admSubmit;
    card.querySelector('#gatePass').onkeydown = e => { if (e.key === 'Enter') admSubmit(); };
    card.querySelector('#gateUser').focus();
  }
  async function admSubmit() {
    const u = card.querySelector('#gateUser'), p = card.querySelector('#gatePass'), m = card.querySelector('#gateMsg');
    let r = { ok: false }; try { r = await api.gateAdmin({ user: u.value, pass: p.value }); } catch {}
    if (r && r.ok) { ov.remove(); location.reload(); }
    else { m.textContent = (r && r.error) || 'Sign-in failed.'; ov.classList.remove('shake'); void ov.offsetWidth; ov.classList.add('shake'); p.select(); }
  }
  ov.querySelector('#gateAdm').onclick = ev => { ev.preventDefault(); if (!admMode) admForm(); };
  // Update: direkt die neueste Version holen und installieren (auch ohne Zugangscode, falls diese Version nicht mehr geht)
  let updBusy = false;
  ov.querySelector('#gateUpd').onclick = async ev => {
    ev.preventDefault(); if (updBusy) return;
    const a = ev.currentTarget, m = ov.querySelector('#gateMsg'), say = t => { if (m) m.textContent = t; };
    updBusy = true; a.textContent = 'Checking …'; say('');
    try {
      const i = await api.appVersion(), c = await api.checkUpdate((i && i.repo) || '');
      if (!c || !c.ok) say((c && c.error) || 'Could not check for updates.');
      else if (!c.newer) say('Cloudy ' + c.current + ' is up to date.');
      else {
        a.textContent = 'Updating to ' + c.latest + ' …'; say('Downloading Cloudy ' + c.latest + ' – the app restarts when it is done.');
        const r = await api.updateInstall(); if (!r || !r.ok) say((r && r.error) || 'Update failed.'); else return;
      }
    } catch (e) { say('Update failed: ' + (e && e.message || e)); }
    updBusy = false; a.textContent = 'Update';
  };
  // Request key: Zugang anfragen. Der Owner gibt die Anfrage frei; der Code erscheint dann hier automatisch.
  let pollT = null; const esc = x => String(x).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function reqView(html) { card.innerHTML = keep.replace(/<input[\s\S]*<\/small>/, html).replace(/Early access\.[^<]*/, 'Request access.'); const back = card.querySelector('#gateAdm'); back.textContent = '← Back'; back.onclick = ev => { ev.preventDefault(); clearInterval(pollT); location.reload(); }; const u = card.querySelector('#gateUpd'), q = card.querySelector('#gateReq'); if (u) u.remove(); if (q) q.remove(); }
  async function reqState(first) {
    let s = {}; try { s = await api.keyReqStatus(); } catch {}
    if (s && s.none) { clearInterval(pollT); return reqForm(); }
    if (s && s.error && !s.status) return reqView(`<p>Request for <b>${esc(s.name || '')}</b></p><div id="gateMsg">${esc(s.error)}</div><small>Trying again …</small>`);
    if (s.status === 'approved') { clearInterval(pollT); return reqView(`<p>Approved! 🎉</p><input id="gateIn" type="text" readonly value="${esc(s.code)}"><button id="gateUse">Use this code</button><div id="gateMsg">${s.adminNote ? esc(s.adminNote) : ''}</div><small>Your access code is valid for 7 days.</small>`), card.querySelector('#gateUse').onclick = async () => { const m = card.querySelector('#gateMsg'); let r = { ok: false }; try { r = await api.gate(s.code); } catch {} if (r && r.ok) { try { api.keyReqClear(); } catch {} ov.remove(); open(); } else m.textContent = (r && r.error) || 'The code was not accepted.'; }; }
    if (s.status === 'rejected') { clearInterval(pollT); return reqView(`<p>Request for <b>${esc(s.name)}</b></p><div id="gateMsg" style="color:#c0392b">Rejected${s.adminNote ? ': ' + esc(s.adminNote) : '.'}</div><button id="gateAgain">Send a new request</button><small>You can ask again.</small>`), card.querySelector('#gateAgain').onclick = async () => { try { await api.keyReqClear(); } catch {} reqForm(); }; }
    reqView(`<p>Request for <b>${esc(s.name)}</b></p><div id="gateMsg">⏳ Pending – the owner has been notified.</div><small>You can close this window; the status is saved.</small>`);
    clearInterval(pollT); pollT = setInterval(() => reqState(), 20000);
  }
  function reqForm() {
    reqView('<input id="reqName" type="text" placeholder="Your name (3–16 letters, numbers, _)" maxlength="16" autocomplete="off" spellcheck="false"><input id="reqNote" type="text" placeholder="Message to the owner (optional)" maxlength="200" autocomplete="off"><button id="reqSend">Send request</button><div id="gateMsg"></div><small>The owner will approve or reject your request.</small>');
    const go = async () => { const m = card.querySelector('#gateMsg'); m.textContent = ''; let r = { ok: false }; try { r = await api.keyReq({ name: card.querySelector('#reqName').value, note: card.querySelector('#reqNote').value }); } catch {} if (r && r.ok) reqState(); else m.textContent = (r && r.error) || 'Could not send the request.'; };
    card.querySelector('#reqSend').onclick = go; card.querySelector('#reqNote').onkeydown = e => { if (e.key === 'Enter') go(); }; card.querySelector('#reqName').focus();
  }
  ov.querySelector('#gateReq').onclick = ev => { ev.preventDefault(); if (admMode) return; reqState(true); };
  api.keyReqStatus && api.keyReqStatus().then(s => { if (s && !s.none) { const q = ov.querySelector('#gateReq'); if (q) q.textContent = 'Request key (' + (s.status === 'approved' ? 'approved ✓' : s.status === 'rejected' ? 'rejected' : 'pending') + ')'; } }).catch(() => {});
  ov.querySelector('#gateGo').onclick = submit;
  ov.querySelector('#gateIn').onkeydown = e => { if (e.key === 'Enter') submit(); };
  try { api.on && api.on('gateRevoked', () => location.reload()); } catch {}
  show(); // sofort verdecken, bis die Pruefung zurueck ist
  api.gate().then(r => { if (r && r.ok) { ov.remove(); open(); } }).catch(() => {});
})();
