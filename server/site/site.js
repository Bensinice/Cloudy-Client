// Webseite: Texte (Standard + Änderungen aus dem Admin-Bereich), Downloads aus /api/releases, Scroll-Effekte
(function () {
  const $ = id => document.getElementById(id), esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  $('y').textContent = new Date().getFullYear();
  // Sicherer Mini-Formatierer: erlaubt nur <b>, <code>, <i> und <br> (sowie Zeilenumbrüche); alles andere bleibt sichtbarer Text. Es wird nie innerHTML benutzt.
  const rich = (el, txt) => {
    el.textContent = ''; const st = [el];
    String(txt == null ? '' : txt).split(/(<\/?(?:b|code|i|br)\s*\/?>|\n)/i).forEach(part => {
      if (!part) return;
      const top = st[st.length - 1], m = /^<(\/?)(b|code|i|br)\s*\/?>$/i.exec(part);
      if (part === '\n' || (m && m[2].toLowerCase() === 'br')) { top.appendChild(document.createElement('br')); return; }
      if (!m) { top.appendChild(document.createTextNode(part)); return; }
      const tag = m[2].toLowerCase();
      if (m[1]) { for (let i = st.length - 1; i > 0; i--) if (st[i].nodeName.toLowerCase() === tag) { st.length = i; break; } return; }
      const n = document.createElement(tag); top.appendChild(n); st.push(n);
    });
  };
  const setLines = rich;
  const mkIo = () => 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); } }), { threshold: .12 }) : null;
  const io = mkIo(); const watch = el => io ? io.observe(el) : el.classList.add('in');
  function render(o) { // alle Texte setzen; o = Standard + Änderungen. Es wird nur textContent benutzt (kein HTML aus fremder Hand).
    [['title', 'title'], ['lead', 'lead'], ['eyebrow', 'eyebrow'], ['featTitle', 'featTitle'], ['featLead', 'featLead'], ['betaTitle', 'betaTitle'], ['betaLead', 'betaLead'], ['footer', 'footTxt']].forEach(([k, id]) => { if (o[k] != null && $(id)) setLines($(id), o[k]); });
    const g = $('featGrid'); g.textContent = '';
    (o.features || []).forEach((f, i) => { const c = document.createElement('div'); c.className = 'card rv' + (i === 0 ? ' big' : ''); const ic = document.createElement('span'); ic.className = 'ic'; ic.textContent = f.ic || ''; const h = document.createElement('h3'); h.textContent = f.t; const p = document.createElement('p'); rich(p, f.p); c.append(ic, h, p); g.appendChild(c); watch(c); });
    const l = $('stepList'); l.textContent = '';
    (o.steps || []).forEach(s => { const li = document.createElement('li'); li.className = 'rv'; const b = document.createElement('b'); b.textContent = s.t; const sp = document.createElement('span'); rich(sp, s.p); li.append(b, sp); l.appendChild(li); watch(li); });
    const c = $('contactLine'); if (o.contact) { c.textContent = 'Kontakt für den Zugangscode: ' + o.contact; c.style.display = ''; } else c.style.display = 'none';
    const bn = $('banner'); if (o.announce) { bn.textContent = o.announce; bn.hidden = false; } else bn.hidden = true;
  }
  render(window.SITE_DEF);
  fetch('/api/site', { cache: 'no-cache' }).then(r => r.json()).then(j => { render({ ...window.SITE_DEF, ...j }); }).catch(() => {});
  try { const t = sessionStorage.getItem('cloudyTok'); if (t) fetch('/api/me', { headers: { Authorization: 'Bearer ' + t } }).then(r => r.json()).then(j => { if (j.admin) $('admLink').hidden = false; }).catch(() => {}); } catch {}
  // ---- Server-Status (echte Prüfung auf dem Server; nicht erreichbar = offline) ----
  const dot = c => `<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${c};margin-right:10px;box-shadow:0 0 12px ${c}"></span>`;
  const rowS = (name, c, txt, sub) => `<div class="ver"><h3 style="font-size:19px">${dot(c)}${esc(name)} <time style="margin-left:auto">${esc(txt)}</time></h3>${sub ? `<p>${esc(sub)}</p>` : ''}</div>`;
  const ago = t => { if (!t) return 'noch nie'; const s = Math.round((Date.now() - t) / 1000); return s < 60 ? 'vor ' + s + ' s' : s < 3600 ? 'vor ' + Math.round(s / 60) + ' min' : 'vor ' + Math.round(s / 3600) + ' h'; };
  async function status() {
    let j = null; try { const r = await fetch('/api/status', { cache: 'no-store' }); if (r.ok) j = await r.json(); } catch {}
    const G = '#30d158', Y = '#ffd60a', R = '#ff453a';
    if (!j) { $('stBox').innerHTML = rowS('Cloudy-Konto-Server', R, 'Offline', 'Der Server antwortet gerade nicht.'); $('stDot').style.background = R; $('stTime').textContent = 'Zuletzt geprüft ' + new Date().toLocaleTimeString('de-DE'); return; }
    let h = '';
    if (j.maintenance && j.maintenance.on) h += rowS('Wartung', Y, 'Aktiv', j.maintenance.text || 'Wir arbeiten gerade an Cloudy.');
    h += rowS('Cloudy-Konto-Server', j.db ? G : Y, j.db ? 'Online' : 'Eingeschränkt', j.accounts ? j.accounts.online + ' Spieler online' : '');
    if (j.mc) h += rowS('Cloudy-Minecraft-Server', j.mc.online ? G : R, j.mc.online ? 'Online' : 'Offline', j.mc.online ? j.mc.players + ' / ' + j.mc.max + ' Spieler · ' + j.mc.ms + ' ms' + (j.mc.version ? ' · ' + j.mc.version : '') : 'Zuletzt online ' + ago(j.mc.lastOkAt));
    if (j.version) h += rowS('Neueste Version', G, j.version, '');
    $('stBox').innerHTML = h; $('stDot').style.background = j.status === 'online' ? G : Y; $('stTime').textContent = 'Zuletzt erfolgreich geprüft ' + new Date(j.checkedAt).toLocaleTimeString('de-DE');
  }
  status(); setInterval(status, 30000);
  const NAMES = { win: 'Windows', 'win-portable': 'Windows portable', 'mac-arm': 'Mac (Apple Silicon)', 'mac-intel': 'Mac (Intel)', linux: 'Linux', ios: 'iOS (Test)', other: 'Datei' };
  const ua = navigator.userAgent, me = /iPhone|iPad/.test(ua) ? 'ios' : /Mac/.test(ua) ? 'mac-arm' : /Linux/.test(ua) && !/Android/.test(ua) ? 'linux' : /Win/.test(ua) ? 'win' : '';
  const mb = n => (n / 1048576 >= 1 ? (n / 1048576).toFixed(0) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');
  fetch('/api/releases').then(r => r.json()).then(({ releases }) => {
    if (!releases.length) { $('dl').innerHTML = '<div class="ver"><p>Bald verfügbar. Es wurde noch keine Version hochgeladen.</p></div>'; return; }
    $('dl').innerHTML = releases.map((r, i) => `<div class="ver${i ? '' : ' new'}"><h3>Cloudy ${esc(r.version)} ${i ? '' : '<em>Neueste</em>'} <time>${new Date(r.date).toLocaleDateString('de-DE')}</time></h3>${r.notes ? `<p>${esc(r.notes)}</p>` : ''}<div class="fl">${r.files.map(f => `<a href="${esc(f.url)}" download>⬇ ${esc(NAMES[f.platform] || f.name)} <small>${mb(f.size)}</small></a>`).join('')}</div></div>`).join('');
    const mine = releases[0].files.find(f => f.platform === me) || releases[0].files.find(f => f.platform === 'win');
    if (mine) { const b = $('heroDl'); b.href = mine.url; b.textContent = 'Für ' + (NAMES[mine.platform] || 'dein System') + ' laden'; }
  }).catch(() => { $('dl').innerHTML = '<div class="ver"><p>Downloads konnten nicht geladen werden.</p></div>'; });
  fetch('/api/news').then(r => r.json()).then(({ news }) => { // Neuigkeiten (nur Text, nichts wird als HTML eingesetzt)
    const box = $('newsBox'); if (!box) return; box.textContent = '';
    if (!news || !news.length) { const d = document.createElement('div'); d.className = 'ver'; d.innerHTML = '<p>Noch keine Neuigkeiten.</p>'; box.appendChild(d); return; }
    news.slice(0, 8).forEach((e, i) => {
      const d = document.createElement('div'); d.className = 'ver' + (i ? '' : ' new'); const h = document.createElement('h3'); h.textContent = 'Cloudy ' + e.v + ' '; const tm = document.createElement('time'); tm.textContent = e.date ? new Date(e.date).toLocaleDateString('de-DE') : ''; h.appendChild(tm); d.appendChild(h);
      [['Neu', e.added], ['Behoben', e.fixed], ['Entfernt', e.removed]].forEach(([t, a]) => { if (!a || !a.length) return; const b = document.createElement('b'); b.textContent = t; d.appendChild(b); const ul = document.createElement('ul'); a.forEach(x => { const li = document.createElement('li'); li.textContent = x; ul.appendChild(li); }); d.appendChild(ul); });
      box.appendChild(d);
    });
  }).catch(() => { const b = $('newsBox'); if (b) b.textContent = 'Neuigkeiten konnten nicht geladen werden.'; });
  document.querySelectorAll('.rv').forEach(watch);
  window.addEventListener('scroll', () => {}, { passive: true });
})();
