// Cloudy – Wartungshinweis. main.js prueft den Haupt-Server (mehrere Pruefungen, Wartezeit) und meldet hier nur das Ergebnis.
(function () {
  const bar = document.createElement('div'); bar.id = 'maintBar'; bar.setAttribute('role', 'status'); bar.hidden = true;
  const t = () => document.documentElement.lang || 'de';
  const EN = 'Cloudy is currently in maintenance mode because the main server cannot be reached. Please try again later.';
  const apply = s => {
    if (!s || !s.on) { bar.hidden = true; document.documentElement.classList.remove('maint'); return; }
    const txt = s.auto && t() !== 'de' ? EN : s.text; bar.textContent = '🛠 ' + txt; bar.hidden = false; document.documentElement.classList.add('maint');
  };
  document.body.appendChild(bar);
  try { window.cloudy.on('maint', apply); } catch {}
  try { window.cloudy.maintGet().then(apply).catch(() => {}); } catch {}
})();
