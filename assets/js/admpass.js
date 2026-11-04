// Cloudy – Admin: Stars (Pass-XP) und Cloudy+ vergeben (Karte „Pass & Stars“ im Admin-Bereich). Geprüft wird alles im Hauptprozess und auf dem Server.
(function () {
  const $ = s => document.querySelector(s);
  const msg = (t, ok) => { const m = $('#paMsg'); if (m) { m.textContent = t || ''; m.style.color = ok ? 'var(--accent)' : ''; } };
  const give = $('#paGive'), plus = $('#paPlus'); if (!give || !plus) return;
  give.onclick = async () => {
    const name = $('#paName').value.trim(), n = parseInt($('#paStars').value, 10) || 0, xp = parseInt($('#paXp').value, 10) || 0; if (!name || (!n && !xp)) return msg('Kontoname und Stars oder Pass-XP eintragen.');
    give.disabled = true; let r = null; try { r = await window.cloudy.admStars({ name, amount: n, xp }); } catch {} give.disabled = false;
    msg(r && r.ok ? name + ': jetzt ★ ' + r.balance + ', Pass-XP ' + r.xp : (r && r.error) || 'Fehlgeschlagen.', !!(r && r.ok));
  };
  plus.onclick = async () => {
    const name = $('#paName').value.trim(), d = parseInt($('#paDays').value, 10); if (!name || !(d >= 0)) return msg('Kontoname und Tage (0 = beenden) eintragen.');
    plus.disabled = true; let r = null; try { r = await window.cloudy.admPlus({ name, days: d }); } catch {} plus.disabled = false;
    msg(r && r.ok ? (r.plus ? name + ': Cloudy+ aktiv bis ' + new Date(r.plus).toLocaleDateString('de-DE') : name + ': Cloudy+ beendet') : (r && r.error) || 'Fehlgeschlagen.', !!(r && r.ok));
  };
})();
