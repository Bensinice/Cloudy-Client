// Neuigkeiten: Hinweis nach einem Update + Verlauf aller Updates
(function () {
  const $ = s => document.querySelector(s), L = s => (window.t ? window.t(s) : s);
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const part = (title, arr) => arr && arr.length ? `<h4>${title}</h4><ul>${arr.map(x => `<li>${esc(L(x))}</li>`).join('')}</ul>` : '';
  const fmtD = d => { if (!d) return ''; try { return new Date(d).toLocaleDateString(document.documentElement.lang === 'de' ? 'de-DE' : document.documentElement.lang || 'en', { day: 'numeric', month: 'long', year: 'numeric' }); } catch { return d; } };
  const entry = e => `<div class="news-ver"><b style="font-size:16px">${esc(e.v)}</b><span class="muted" style="font-size:12px">${esc(fmtD(e.date))}</span></div>` + part('Neu', e.added) + part('Behoben', e.fixed) + part('Entfernt', e.removed);
  function show(list, title) {
    if (document.querySelector('.news-ov')) return;
    const d = document.createElement('div'); d.className = 'news-ov';
    d.innerHTML = `<div class="glass set news-box"><h3>${esc(L(title))}</h3>${list.map(entry).join('')}<div class="tools" style="margin:16px 0 0"><button class="btn" data-x>${esc(L('Schließen'))}</button></div></div>`;
    document.body.appendChild(d); d.onclick = e => { if (e.target === d) d.remove(); }; d.querySelector('[data-x]').onclick = () => d.remove();
    if (window.setLang) window.setLang(document.documentElement.lang || 'de');
  }
  const isEn = () => (document.documentElement.lang || 'de') !== 'de';
  let enLog = null;
  // Englisch: nur Einträge mit englischem Text zeigen (ältere Versionen gibt es nur auf Deutsch)
  const all = async () => {
    let l = []; try { l = await window.cloudy.changelog() || []; } catch {}
    if (!isEn()) return l;
    if (!enLog) { try { enLog = await window.cloudy.changelogEn() || {}; } catch { enLog = {}; } }
    return l.filter(e => enLog[e.v]).map(e => ({ v: e.v, date: e.date, added: enLog[e.v], fixed: [], removed: [] }));
  };
  const open = async () => show(await all(), 'Neuigkeiten & alte Updates');
  ['#newsBtn', '#newsBtn2'].forEach(s => { const b = $(s); if (b) b.onclick = open; });
  (async () => {
    try {
      const v = (await window.cloudy.appVersion()).v; if (!v) return;
      let seen = localStorage.getItem('cloudy.seenVer');
      if (!seen && localStorage.length > 2) seen = '0.9.0'; // Update von einer Version ohne Neuigkeiten-Fenster
      if (!seen) { const fresh = !localStorage.getItem('cloudy.onb') && !localStorage.getItem('cloudy.user'); if (fresh && localStorage.length === 0) { localStorage.setItem('cloudy.seenVer', v); return; } seen = '0.0.0'; }
      if (seen === v) return;
      const cmp = (a, b) => { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); } return 0; };
      let e = (await all()).filter(x => /^\d+\.\d+\.\d+$/.test(x.v) && cmp(x.v, seen) > 0 && cmp(x.v, v) <= 0); if (seen === '0.0.0') e = e.slice(0, 1); if (!e.length) return; // alle Versionen seit dem letzten Start
      const wait = setInterval(() => { const blocked = document.getElementById('cdIntro') || document.querySelector('#login:not(.off)') || document.getElementById('onb'); if (!blocked) { clearInterval(wait); show(e, 'Cloudy wurde aktualisiert'); localStorage.setItem('cloudy.seenVer', v); } }, 800);
      setTimeout(() => clearInterval(wait), 120000);
    } catch {}
  })();
})();
