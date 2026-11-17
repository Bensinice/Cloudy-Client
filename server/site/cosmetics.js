// Cosmetics-Seite: holt /api/cosmetics (Katalog aus dem Repo + Preise/Angebote/Limited vom Server). Nur textContent/escape – kein fremdes HTML.
(function () {
  const $ = s => document.querySelector(s), esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  document.getElementById('y').textContent = new Date().getFullYear();
  const CATS = [['all', 'Alle'], ['cape', 'Umhänge'], ['wings', 'Flügel'], ['hat', 'Hüte'], ['shield', 'Schilde'], ['pet', 'Pets'], ['emote', 'Emotes'], ['fx', 'Effekte'], ['plus', 'Cloudy+']];
  const CATN = { cape: 'Umhang', wings: 'Flügel', hat: 'Hut', shield: 'Schild', pet: 'Pet', emote: 'Emote', trail: 'Partikel-Spur', winfx: 'Sieg-Effekt', foot: 'Fußspuren' };
  const ICON = { cape: '🧣', wings: '🪽', hat: '🎩', shield: '🛡', pet: '🐾', emote: '💃', trail: '✨', winfx: '🎆', foot: '👣' };
  const FX = ['trail', 'winfx', 'foot'];
  let items = [], ends = 0, cat = 'all', q = '', sort = 'pop';
  try { const h = (location.hash || '').slice(1); if (CATS.some(c => c[0] === h)) cat = h; } catch {}
  const inCat = (i, c) => c === 'all' ? true : c === 'plus' ? i.plus || i.month : c === 'fx' ? FX.includes(i.cat) && !i.plus : i.cat === c && !i.plus;
  const cc = n => n.toLocaleString('de-DE') + ' CC';
  function tags(i) {
    const t = [];
    if (i.deal) t.push(['t-deal', '−' + i.deal + ' %']);
    if (i.month) t.push(['t-month', '★ Monatsitem']);
    else if (i.plus) t.push(['t-plus', '✦ Cloudy+']);
    if (i.lim) t.push(['t-lim', i.lim.code ? 'Limited · nur mit Code' : 'Limited · noch ' + i.lim.left]);
    if (i.excl === 'weekly') t.push(['t-wk', i.weekly ? '🏆 Diese Woche' : '🏆 Wochenaufgabe']);
    if (!i.plus && !i.excl && !i.price && !i.lim) t.push(['t-free', 'Gratis']);
    return t;
  }
  const priceTxt = i => i.plus || i.month ? 'Mit Cloudy+ inklusive' : i.excl === 'weekly' ? 'Belohnung der Wochenaufgabe' : i.lim && i.lim.code ? 'Nur mit Code' : !i.price ? 'Gratis' : cc(i.price);
  const priceHtml = i => (i.was ? `<s>${cc(i.was)}</s>` : '') + esc(priceTxt(i));
  const card = i => `<button class="ci cat-${esc(i.cat)}" data-id="${esc(i.id)}"><div class="ti">${i.img ? `<img src="${esc(i.img)}" alt="${esc(i.name)}" loading="lazy">` : `<span class="ph">${ICON[i.cat] || '☁'}</span>`}</div>${tags(i).length ? `<div class="tg">${tags(i).map(([c, x]) => `<span class="${c}">${esc(x)}</span>`).join('')}</div>` : ''}<b>${esc(i.name)}</b><small>${esc(CATN[i.cat] || i.cat)}</small><span class="pr">${priceHtml(i)}</span></button>`;

  function paint() {
    $('#cats').innerHTML = CATS.map(([k, l]) => { const n = items.filter(i => inCat(i, k)).length; return n || k === 'all' ? `<button class="${k === cat ? 'on' : ''}" data-c="${k}">${l}<small>${n}</small></button>` : ''; }).join('');
    let L = items.filter(i => inCat(i, cat) && (!q || (i.name + ' ' + (CATN[i.cat] || '')).toLowerCase().includes(q)));
    const rank = i => (i.deal ? 0 : 1) * 10 + (i.lim ? 0 : 1) * 5 + (i.plus || i.excl ? 2 : 0);
    if (sort === 'lo') L.sort((a, b) => (a.plus || a.excl ? 1e9 : a.price) - (b.plus || b.excl ? 1e9 : b.price));
    else if (sort === 'hi') L.sort((a, b) => (b.plus || b.excl ? -1 : b.price) - (a.plus || a.excl ? -1 : a.price));
    else if (sort === 'az') L.sort((a, b) => a.name.localeCompare(b.name, 'de'));
    else L.sort((a, b) => rank(a) - rank(b) || b.price - a.price);
    $('#count').textContent = L.length + (L.length === 1 ? ' Cosmetic' : ' Cosmetics');
    $('#grid').innerHTML = L.length ? L.map(card).join('') : '<p class="empty">Nichts gefunden.</p>';
    const D = items.filter(i => i.deal); $('#deals').hidden = !D.length; $('#dealGrid').innerHTML = D.map(card).join('');
    document.querySelectorAll('#cats [data-c]').forEach(b => b.onclick = () => { cat = b.dataset.c; try { history.replaceState(null, '', cat === 'all' ? location.pathname : '#' + cat); } catch {} paint(); });
    document.querySelectorAll('.ci[data-id]').forEach(b => b.onclick = () => open(b.dataset.id));
  }
  function open(id) {
    const i = items.find(x => x.id === id); if (!i) return; const m = $('#modal');
    $('#mimg').className = 'mimg cat-' + i.cat; $('#mimg').innerHTML = i.img ? `<img src="${esc(i.img)}" alt="">` : `<span style="font-size:90px">${ICON[i.cat] || '☁'}</span>`;
    $('#mcat').textContent = CATN[i.cat] || i.cat; $('#mname').textContent = i.name;
    $('#mtags').innerHTML = tags(i).map(([c, x]) => `<span class="${c}">${esc(x)}</span>`).join('');
    $('#mprice').innerHTML = priceHtml(i);
    $('#mnote').textContent = i.plus || i.month ? 'Gehört automatisch allen mit Cloudy+.' : i.excl === 'weekly' ? 'Gibt es nur für das Schaffen der Wochenaufgabe auf der Startseite des Launchers.' : i.lim && i.lim.code ? 'Limited – nur mit einem Code einlösbar.' : i.cat === 'emote' ? 'Im Spiel mit Taste B abspielen. Kaufen im Launcher unter Shop → Emotes.' : 'Kaufen, anprobieren und anlegen im Launcher unter Shop. Alle Cloudy-Spieler sehen es.';
    m.hidden = false; document.body.style.overflow = 'hidden';
  }
  const close = () => { $('#modal').hidden = true; document.body.style.overflow = ''; };
  $('#mx').onclick = close; $('#modal').onclick = e => { if (e.target.id === 'modal') close(); }; document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  const qi = $('#q'); qi.oninput = () => { q = qi.value.trim().toLowerCase(); paint(); };
  $('#sort').onchange = e => { sort = e.target.value; paint(); };
  function tick() { const e = $('#cd'); if (!e || !ends) return; const ms = Math.max(0, ends - Date.now()), h = Math.floor(ms / 36e5), m = Math.floor(ms / 6e4) % 60, s = Math.floor(ms / 1e3) % 60; e.textContent = `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`; if (ms <= 0) { ends = 0; setTimeout(load, 5000); } }
  async function load() {
    try { const r = await fetch('/api/cosmetics', { cache: 'no-store' }); const j = await r.json(); items = Array.isArray(j.items) ? j.items : []; ends = +j.ends || 0; }
    catch { items = []; }
    if (!items.length) { $('#grid').innerHTML = '<p class="empty">Die Cosmetics konnten gerade nicht geladen werden. Versuch es gleich noch einmal.</p>'; $('#cats').innerHTML = ''; return; }
    paint(); tick();
  }
  setInterval(() => { if (!document.hidden) tick(); }, 1000);
  load();
})();
