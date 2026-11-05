// Neuigkeiten: Hinweis nach einem Update + Verlauf aller Updates
(function () {
  const $ = s => document.querySelector(s), L = s => (window.t ? window.t(s) : s);
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const part = (title, arr) => arr && arr.length ? `<h4>${title}</h4><ul>${arr.map(x => `<li>${esc(L(x))}</li>`).join('')}</ul>` : '';
  const fmtD = d => { if (!d) return ''; try { return new Date(d).toLocaleDateString(document.documentElement.lang === 'de' ? 'de-DE' : document.documentElement.lang || 'en', { day: 'numeric', month: 'long', year: 'numeric' }); } catch { return d; } };
  const entry = e => `<div class="news-ver"><b style="font-size:16px">${esc(e.v)}</b><span class="muted" style="font-size:12px">${esc(fmtD(e.date))}</span></div>` + part('Neu', e.added) + part('Behoben', e.fixed) + part('Entfernt', e.removed);
  // Zwei Reiter: "Updates" (alle Versionen) und "Neu hinzugefügt" (nur das Neue der letzten Versionen, nach Version sortiert)
  const fresh = list => { const top = list.slice(0, 3).filter(e => e.added && e.added.length); return top.length ? top.map(e => `<div class="news-ver"><b style="font-size:16px">${esc(e.v)}</b><span class="muted" style="font-size:12px">${esc(fmtD(e.date))}</span></div><ul>${e.added.map(x => `<li>${esc(L(x))}</li>`).join('')}</ul>`).join('') : `<p class="muted">${esc(L('Noch nichts Neues.'))}</p>`; };
  function show(list, title) {
    if (document.querySelector('.news-ov')) return;
    const d = document.createElement('div'); d.className = 'news-ov';
    d.innerHTML = `<div class="glass set news-box"><h3>${esc(L(title))}</h3><div class="tools" style="margin:0 0 10px"><button class="btn" data-tab="u">${esc(L('Updates'))}</button><button class="btn ghost" data-tab="n">${esc(L('Neu hinzugefügt'))}</button><button class="btn ghost" data-tab="s">${esc(L('Cloudy-News'))}</button></div><div data-pane="u">${list.map(entry).join('')}</div><div data-pane="n" style="display:none">${fresh(list)}</div><div data-pane="s" style="display:none"><p class="muted">${esc(L('Lade …'))}</p></div><div class="tools" style="margin:16px 0 0"><button class="btn" data-x>${esc(L('Schließen'))}</button></div></div>`;
    document.body.appendChild(d); d.onclick = e => { if (e.target === d) d.remove(); }; d.querySelector('[data-x]').onclick = () => d.remove();
    d.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { d.querySelectorAll('[data-tab]').forEach(x => x.classList.toggle('ghost', x !== b)); d.querySelectorAll('[data-pane]').forEach(p => p.style.display = p.dataset.pane === b.dataset.tab ? '' : 'none'); });
    loadSrv(d.querySelector('[data-pane="s"]'));
    if (window.setLang) window.setLang(document.documentElement.lang || 'de');
  }
  // Nachrichten vom Cloudy-Team. Der Server liefert nur, was dieses Konto sehen darf (alle / Tester / Admin); hier wird nichts gefiltert.
  const AUD = { all: '', tester: 'Tester', admin: 'Admin' };
  async function loadSrv(box) {
    let r = null; try { r = await window.cloudy.newsList(); } catch {}
    if (!r || !r.ok) { box.innerHTML = `<p class="muted">${esc(L(r && r.error ? r.error : 'Keine Verbindung zum Cloudy-Server.'))}</p>`; return; }
    box.innerHTML = r.news.length ? r.news.map(n => `<div class="news-ver"><b style="font-size:16px">${esc(n.title)}</b>${AUD[n.aud] ? `<span class="ctag ${n.aud === 'admin' ? 'owner' : 'tester'}">${esc(L(AUD[n.aud]))}</span>` : ''}<span class="muted" style="font-size:12px">${esc(fmtD(n.ts))}${n.edited ? ' · ' + esc(L('bearbeitet')) : ''}</span></div><p style="white-space:pre-wrap;margin:4px 0 12px">${esc(n.body)}</p>`).join('') : `<p class="muted">${esc(L('Keine Nachrichten.'))}</p>`;
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
