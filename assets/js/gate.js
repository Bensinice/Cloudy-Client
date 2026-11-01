// Zugangscode: beim ersten Start muss ein Code eingegeben werden (wird im Hauptprozess geprueft und danach gespeichert)
(function () {
  const api = window.cloudy; if (!api || !api.gate) return;
  window.cloudyGatePending = true;
  const ov = document.createElement('div'); ov.id = 'cdGate';
  const open = () => { window.cloudyGatePending = false; try { window.dispatchEvent(new Event('cloudy-gate-ok')); } catch {} };
  ov.innerHTML = '<div class="gcard"><svg viewBox="0 0 64 44" width="64" height="44"><defs><linearGradient id="gg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d8ecff"/><stop offset="1" stop-color="#4aa3ff"/></linearGradient></defs><path fill="url(#gg)" d="M16 40a12 12 0 0 1-1-24 16 16 0 0 1 30-3 14 14 0 0 1 4 27z"/></svg><h2>Cloudy</h2><p>Early access. Enter your access code to continue.</p><input id="gateIn" type="password" placeholder="Access code" autocomplete="off" spellcheck="false"><button id="gateGo">Continue</button><div id="gateMsg"></div><small>Currently in beta.</small><a id="gateAdm" href="#" style="font-size:12px;color:#7b88a3;text-decoration:none;margin-top:2px">Admin?</a><a id="gateUpd" href="#" style="font-size:12px;color:#7b88a3;text-decoration:none;margin-top:2px;margin-left:14px">Update</a></div>';
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
  ov.querySelector('#gateGo').onclick = submit;
  ov.querySelector('#gateIn').onkeydown = e => { if (e.key === 'Enter') submit(); };
  try { api.on && api.on('gateRevoked', () => location.reload()); } catch {}
  show(); // sofort verdecken, bis die Pruefung zurueck ist
  api.gate().then(r => { if (r && r.ok) { ov.remove(); open(); } }).catch(() => {});
})();
