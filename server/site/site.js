// Webseite: Downloads aus /api/releases, Scroll-Effekte
(function () {
  const $ = id => document.getElementById(id), esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  $('y').textContent = new Date().getFullYear();
  // Kontakt für den Zugangscode: hier eintragen (z. B. Discord-Name oder E-Mail), erscheint im Schritt „Zugangscode holen“
  const CONTACT = ''; if (CONTACT) $('contact').textContent = '(' + CONTACT + ')';
  const NAMES = { win: 'Windows', 'win-portable': 'Windows portable', 'mac-arm': 'Mac (Apple Silicon)', 'mac-intel': 'Mac (Intel)', linux: 'Linux', ios: 'iOS (Test)', other: 'Datei' };
  const ua = navigator.userAgent, me = /iPhone|iPad/.test(ua) ? 'ios' : /Mac/.test(ua) ? 'mac-arm' : /Linux/.test(ua) && !/Android/.test(ua) ? 'linux' : /Win/.test(ua) ? 'win' : '';
  const mb = n => (n / 1048576 >= 1 ? (n / 1048576).toFixed(0) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');
  fetch('/api/releases').then(r => r.json()).then(({ releases }) => {
    if (!releases.length) { $('dl').innerHTML = '<div class="ver"><p>Bald verfügbar. Es wurde noch keine Version hochgeladen.</p></div>'; return; }
    $('dl').innerHTML = releases.map((r, i) => `<div class="ver${i ? '' : ' new'}"><h3>Cloudy ${esc(r.version)} ${i ? '' : '<em>Neueste</em>'} <time>${new Date(r.date).toLocaleDateString('de-DE')}</time></h3>${r.notes ? `<p>${esc(r.notes)}</p>` : ''}<div class="fl">${r.files.map(f => `<a href="${esc(f.url)}" download>⬇ ${esc(NAMES[f.platform] || f.name)} <small>${mb(f.size)}</small></a>`).join('')}</div></div>`).join('');
    const mine = releases[0].files.find(f => f.platform === me) || releases[0].files.find(f => f.platform === 'win');
    if (mine) { const b = $('heroDl'); b.href = mine.url; b.textContent = 'Für ' + (NAMES[mine.platform] || 'dein System') + ' laden'; }
  }).catch(() => { $('dl').innerHTML = '<div class="ver"><p>Downloads konnten nicht geladen werden.</p></div>'; });
  const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .12 }) : null;
  document.querySelectorAll('.rv').forEach(el => io ? io.observe(el) : el.classList.add('in'));
})();
