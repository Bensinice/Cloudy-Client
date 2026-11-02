// Webseite: Texte (Standard + Änderungen aus dem Admin-Bereich), Downloads aus /api/releases, Scroll-Effekte
(function () {
  const $ = id => document.getElementById(id), esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  $('y').textContent = new Date().getFullYear();
  const setLines = (el, txt) => { el.textContent = ''; String(txt).split('\n').forEach((l, i) => { if (i) el.appendChild(document.createElement('br')); el.appendChild(document.createTextNode(l)); }); };
  const mkIo = () => 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); } }), { threshold: .12 }) : null;
  const io = mkIo(); const watch = el => io ? io.observe(el) : el.classList.add('in');
  function render(o) { // alle Texte setzen; o = Standard + Änderungen. Es wird nur textContent benutzt (kein HTML aus fremder Hand).
    [['title', 'title'], ['lead', 'lead'], ['eyebrow', 'eyebrow'], ['featTitle', 'featTitle'], ['featLead', 'featLead'], ['betaTitle', 'betaTitle'], ['betaLead', 'betaLead'], ['footer', 'footTxt']].forEach(([k, id]) => { if (o[k] != null && $(id)) setLines($(id), o[k]); });
    const g = $('featGrid'); g.textContent = '';
    (o.features || []).forEach((f, i) => { const c = document.createElement('div'); c.className = 'card rv' + (i === 0 ? ' big' : ''); const ic = document.createElement('span'); ic.className = 'ic'; ic.textContent = f.ic || ''; const h = document.createElement('h3'); h.textContent = f.t; const p = document.createElement('p'); p.textContent = f.p; c.append(ic, h, p); g.appendChild(c); watch(c); });
    const l = $('stepList'); l.textContent = '';
    (o.steps || []).forEach(s => { const li = document.createElement('li'); li.className = 'rv'; const b = document.createElement('b'); b.textContent = s.t; li.append(b, document.createTextNode(s.p)); l.appendChild(li); watch(li); });
    const c = $('contactLine'); if (o.contact) { c.textContent = 'Kontakt für den Zugangscode: ' + o.contact; c.style.display = ''; } else c.style.display = 'none';
    const bn = $('banner'); if (o.announce) { bn.textContent = o.announce; bn.hidden = false; } else bn.hidden = true;
  }
  render(window.SITE_DEF);
  fetch('/api/site', { cache: 'no-cache' }).then(r => r.json()).then(j => { render({ ...window.SITE_DEF, ...j }); }).catch(() => {});
  try { const t = sessionStorage.getItem('cloudyTok'); if (t) fetch('/api/me', { headers: { Authorization: 'Bearer ' + t } }).then(r => r.json()).then(j => { if (j.admin) $('admLink').hidden = false; }).catch(() => {}); } catch {}
  const NAMES = { win: 'Windows', 'win-portable': 'Windows portable', 'mac-arm': 'Mac (Apple Silicon)', 'mac-intel': 'Mac (Intel)', linux: 'Linux', ios: 'iOS (Test)', other: 'Datei' };
  const ua = navigator.userAgent, me = /iPhone|iPad/.test(ua) ? 'ios' : /Mac/.test(ua) ? 'mac-arm' : /Linux/.test(ua) && !/Android/.test(ua) ? 'linux' : /Win/.test(ua) ? 'win' : '';
  const mb = n => (n / 1048576 >= 1 ? (n / 1048576).toFixed(0) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');
  fetch('/api/releases').then(r => r.json()).then(({ releases }) => {
    if (!releases.length) { $('dl').innerHTML = '<div class="ver"><p>Bald verfügbar. Es wurde noch keine Version hochgeladen.</p></div>'; return; }
    $('dl').innerHTML = releases.map((r, i) => `<div class="ver${i ? '' : ' new'}"><h3>Cloudy ${esc(r.version)} ${i ? '' : '<em>Neueste</em>'} <time>${new Date(r.date).toLocaleDateString('de-DE')}</time></h3>${r.notes ? `<p>${esc(r.notes)}</p>` : ''}<div class="fl">${r.files.map(f => `<a href="${esc(f.url)}" download>⬇ ${esc(NAMES[f.platform] || f.name)} <small>${mb(f.size)}</small></a>`).join('')}</div></div>`).join('');
    const mine = releases[0].files.find(f => f.platform === me) || releases[0].files.find(f => f.platform === 'win');
    if (mine) { const b = $('heroDl'); b.href = mine.url; b.textContent = 'Für ' + (NAMES[mine.platform] || 'dein System') + ' laden'; }
  }).catch(() => { $('dl').innerHTML = '<div class="ver"><p>Downloads konnten nicht geladen werden.</p></div>'; });
  document.querySelectorAll('.rv').forEach(watch);
  window.addEventListener('scroll', () => {}, { passive: true });
})();
