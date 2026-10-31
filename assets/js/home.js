// Cloudy – Startseite anpassen: Banner-Text (z. B. „Hallo Ben“), Farbe/Bild, Höhe, Buttons und Bereiche ein-/ausblenden
(function () {
  const L = s => (window.t ? window.t(s) : s);
  const DEF = { title: 'Hallo, {name}!', sub: '', eyebrow: 'Minecraft Launcher', tint: 'default', color: '#4aa3ff', img: '', size: 'normal', cloud: true, b: { ver: true, mods: true, upd: true }, s: { qa: true, sys: true, srv: true } };
  const TINTS = { default: null, sunset: ['#ffb36b', '#ff4f8b'], forest: ['#5be4a0', '#1b8f6a'], night: ['#6f7dff', '#2a2f6f'], mono: ['#9fb2c8', '#53647a'] };
  const TG = { versions: ['Versionen', 'Version wählen', '🧊'], lib: ['Bibliothek', 'Versionen & Mods verwalten', '📚'], servers: ['Server', 'Beitreten & hosten', '🖥️'], friends: ['Freunde', 'Chat & hinzufügen', '👥'], mods: ['Mods', 'Fabric & Modrinth', '📦'], packs: ['Ressourcen', 'Packs & Shader', '🎨'], skins: ['Skins', 'Skin wählen', '🧍'], shop: ['Shop', 'Cosmetics kaufen', '🛒'], settings: ['Einstellungen', 'Konto, Themes, Sound', '⚙️'], shots: ['Screenshots', 'Deine Bilder', '📷'] };
  const DEF_TILES = [{ t: 'lib' }, { t: 'mods' }, { t: 'packs' }, { t: 'settings', n: 'Themes', d: '8 Farbwelten', e: '🎨' }];
  const h3s = () => [...document.querySelectorAll('#p-settings h3')].filter(h => h.firstChild && h.firstChild.textContent.trim());
  const secs = () => h3s().map((h, i) => [String(i), h.firstChild.textContent.trim()]);
  const tinfo = t => { const k = t.t || 'settings', base = TG[k.split('#')[0]] || TG.settings, sec = k.includes('#') ? k.split('#')[1] : '', sn = /^\d+$/.test(sec) ? ((h3s()[+sec] || {}).firstChild || {}).textContent : sec; return { n: t.n || (sn && sn.trim()) || base[0], d: t.d || (sec ? 'Einstellungen' : base[1]), e: t.e || base[2] }; };
  function goTile(t) { const k = String(t.t || 'settings'); go(k.split('#')[0]); const s = k.split('#')[1]; if (s) setTimeout(() => { const hs = h3s(), h = /^\d+$/.test(s) ? hs[+s] : hs.find(x => x.firstChild.textContent.trim() === s); if (h) { h.scrollIntoView({ block: 'start', behavior: 'smooth' }); const c = h.closest('.set'); if (c) { c.style.outline = '3px solid var(--accent)'; setTimeout(() => c.style.outline = '', 1600); } } }, 120); }
  const get = () => { const h = st.get('home', {}); return { ...DEF, ...h, b: { ...DEF.b, ...(h.b || {}) }, s: { ...DEF.s, ...(h.s || {}) } }; };
  const mix = (hex, k) => { const n = parseInt(hex.slice(1), 16), f = c => Math.max(0, Math.min(255, Math.round(c + (255 - c) * k))); return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(f).map(x => x.toString(16).padStart(2, '0')).join(''); };
  const fill = (s, h) => String(s || '').replace(/\{name\}/gi, (window.dispName ? dispName() : '') || L('Spieler')).replace(/\{version\}/gi, (typeof version !== 'undefined' && version) || '');

  window.paintHome = function () {
    const h = get(), hero = $('.hero'); if (!hero) return;
    $('#hi').textContent = fill(h.title, h) || ' ';
    const sub = fill(h.sub, h); if (sub) $('#heroSub').textContent = sub;
    const ey = hero.querySelector('.eyebrow'); if (ey) ey.textContent = h.eyebrow || '';
    if (ey) ey.style.display = h.eyebrow ? '' : 'none';
    const pair = h.tint === 'custom' ? [mix(h.color, .25), h.color] : TINTS[h.tint];
    hero.style.background = h.img ? `linear-gradient(180deg,rgba(0,0,0,.05),rgba(0,0,0,.45)),url(${h.img}) center/cover` : pair ? `radial-gradient(90% 120% at 100% 0%,${mix(pair[0], .3)},transparent 60%),linear-gradient(125deg,${pair[0]},${pair[1]})` : '';
    hero.style.boxShadow = pair && !h.img ? `0 34px 70px -28px ${pair[1]},inset 0 1.5px 1px rgba(255,255,255,.65),inset 0 -3px 8px rgba(0,0,0,.12)` : '';
    hero.querySelectorAll('.hvid,.hvs').forEach(e => e.remove());
    if (h.anim && h.anim.url) {
      const m = document.createElement(h.anim.kind === 'video' ? 'video' : 'img'); m.className = 'hvid'; m.src = h.anim.url; m.setAttribute('aria-hidden', 'true'); m.onerror = () => { m.remove(); };
      if (h.anim.kind === 'video') { m.muted = true; m.loop = true; m.autoplay = true; m.playsInline = true; m.play && m.play().catch(() => {}); }
      const sh = document.createElement('i'); sh.className = 'hvs'; hero.prepend(sh); hero.prepend(m);
      hero.style.background = 'transparent'; hero.querySelectorAll('.orb').forEach(o => o.style.display = 'none');
    }
    hero.style.minHeight = h.size === 'compact' ? '200px' : h.size === 'big' ? '400px' : '';
    const cl = hero.querySelector('.cloud'); if (cl) cl.style.display = h.cloud ? '' : 'none';
    hero.querySelectorAll('.orb').forEach(o => o.style.display = h.img ? 'none' : '');
    const chips = hero.querySelectorAll('.act .chip'); [h.b.ver, h.b.mods, h.b.upd].forEach((on, i) => { if (chips[i]) chips[i].style.display = on ? '' : 'none'; });
    const hide = (el, on) => { if (el) el.style.display = on ? '' : 'none'; };
    const qa = $('.qa'), tl = h.tiles || DEF_TILES; if (qa) { qa.innerHTML = tl.map((t, i) => { const x = tinfo(t); return `<button class="glass tile" data-ti="${i}"><span class="ic" style="font-size:22px">${esc(x.e)}</span><b>${esc(L(x.n))}</b><span class="muted">${esc(L(x.d))}</span></button>`; }).join(''); qa.querySelectorAll('[data-ti]').forEach(b => b.onclick = () => goTile(tl[+b.dataset.ti])); }
    hide($('.qa'), h.s.qa); hide($('#sysCard'), h.s.sys); hide($('#sysCard') && $('#sysCard').previousElementSibling, h.s.sys); hide($('#homeSrv'), h.s.srv); hide($('#homeSrv') && $('#homeSrv').previousElementSibling, h.s.srv);
  };

  let dlg = null;
  function open() {
    if (dlg) dlg.remove(); const h = get();
    dlg = document.createElement('div'); dlg.style.cssText = 'position:fixed;inset:0;z-index:70;display:grid;place-items:center;background:rgba(10,25,50,.38);backdrop-filter:blur(6px)';
    const cb = (id, label, on) => `<label style="display:flex;gap:8px;align-items:center;font-weight:600"><input type="checkbox" id="${id}" ${on ? 'checked' : ''}> ${label}</label>`;
    dlg.innerHTML = `<div class="glass set" style="width:min(560px,94%);max-height:88vh;overflow:auto;display:grid;gap:10px"><h3>Startseite anpassen</h3>
      <label class="muted">Banner-Titel <small>({name} = dein Name, {version} = Version)</small><input id="hdT" class="field" value="${esc(h.title)}" maxlength="60"></label>
      <label class="muted">Untertitel (leer = Standard)<input id="hdS" class="field" value="${esc(h.sub)}" maxlength="90"></label>
      <label class="muted">Kleines Label über dem Titel<input id="hdE" class="field" value="${esc(h.eyebrow)}" maxlength="30"></label>
      <div class="muted">Banner-Farbe</div><div class="tools" id="hdTint" style="margin:0">${['default', 'sunset', 'forest', 'night', 'mono', 'custom'].map(k => `<button class="chip ${h.tint === k ? 'on' : ''}" data-k="${k}">${{ default: 'Standard', sunset: 'Sonnenuntergang', forest: 'Wald', night: 'Nacht', mono: 'Grau', custom: 'Eigene' }[k]}</button>`).join('')}<input type="color" id="hdC" value="${h.color}" style="width:44px;height:36px;border:0;background:none"></div>
      <div class="tools" style="margin:0"><button class="btn ghost" id="hdImg">Eigenes Banner-Bild …</button><button class="btn ghost" id="hdImgX" style="${h.img ? '' : 'display:none'}">Bild entfernen</button><button class="btn ghost" id="hdAnim">Animiertes Banner (GIF/Video) …</button><button class="btn ghost" id="hdAnimX" style="${h.anim && h.anim.url ? '' : 'display:none'}">Animation entfernen</button><input type="file" id="hdF" accept="image/*" style="display:none">
        <select id="hdZ" class="field" style="width:auto"><option value="compact">Banner: kompakt</option><option value="normal">Banner: normal</option><option value="big">Banner: groß</option></select></div>
      ${cb('hdCl', 'Wolke im Banner zeigen', h.cloud)}
      <div class="muted">Knöpfe im Banner</div><div class="tools" style="margin:0">${cb('hdB1', '„Version wählen“', h.b.ver)}${cb('hdB2', '„Mods entdecken“', h.b.mods)}${cb('hdB3', '„Nach Updates suchen“', h.b.upd)}</div>
      <div class="muted">Bereiche auf der Startseite</div><div class="tools" style="margin:0">${cb('hdS1', 'Schnellzugriff', h.s.qa)}${cb('hdS2', 'System', h.s.sys)}${cb('hdS3', 'Deine Server', h.s.srv)}</div>
      <div class="muted">Schnellzugriff-Kacheln (ein Klick öffnet direkt den Bereich)</div><div id="hdTiles" style="display:grid;gap:6px"></div><div class="tools" style="margin:0"><button class="btn ghost" id="hdTileAdd">+ Kachel hinzufügen</button></div>
      <div class="tools" style="margin:6px 0 0"><button class="btn" id="hdOk">Fertig</button><button class="btn ghost" id="hdReset">Zurücksetzen</button></div></div>`;
    document.body.appendChild(dlg); $('#hdZ').value = h.size;
    const save = p => { const c = get(); st.set('home', { ...c, ...p, b: { ...c.b, ...(p.b || {}) }, s: { ...c.s, ...(p.s || {}) } }); window.paintHome(); };
    $('#hdT').oninput = e => save({ title: e.target.value }); $('#hdS').oninput = e => { save({ sub: e.target.value }); if (!e.target.value && window.paintVersion) paintVersion(); }; $('#hdE').oninput = e => save({ eyebrow: e.target.value });
    $$('#hdTint [data-k]').forEach(b => b.onclick = () => { $$('#hdTint [data-k]').forEach(x => x.classList.toggle('on', x === b)); save({ tint: b.dataset.k, img: b.dataset.k === 'default' ? '' : get().img }); });
    $('#hdC').oninput = e => { $$('#hdTint [data-k]').forEach(x => x.classList.toggle('on', x.dataset.k === 'custom')); save({ tint: 'custom', color: e.target.value, img: '' }); };
    $('#hdZ').onchange = e => save({ size: e.target.value }); $('#hdCl').onchange = e => save({ cloud: e.target.checked });
    $('#hdB1').onchange = e => save({ b: { ver: e.target.checked } }); $('#hdB2').onchange = e => save({ b: { mods: e.target.checked } }); $('#hdB3').onchange = e => save({ b: { upd: e.target.checked } });
    $('#hdS1').onchange = e => save({ s: { qa: e.target.checked } }); $('#hdS2').onchange = e => save({ s: { sys: e.target.checked } }); $('#hdS3').onchange = e => save({ s: { srv: e.target.checked } });
    $('#hdAnim').onclick = async () => { const r = await window.cloudy.bannerPick(); if (r && r.ok) { save({ anim: { url: r.url, kind: r.kind } }); $('#hdAnimX').style.display = ''; } else if (r && r.error) alert(L(r.error)); };
    $('#hdAnimX').onclick = () => { save({ anim: null }); $('#hdAnimX').style.display = 'none'; };
    $('#hdImg').onclick = () => $('#hdF').click(); $('#hdImgX').onclick = () => { save({ img: '' }); $('#hdImgX').style.display = 'none'; };
    $('#hdF').onchange = e => { const f = e.target.files[0]; if (!f) return; const im = new Image(), u = URL.createObjectURL(f); im.onload = () => { const k = Math.min(1, 1400 / im.width), c = document.createElement('canvas'); c.width = im.width * k; c.height = im.height * k; c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(u); try { save({ img: c.toDataURL('image/jpeg', 0.82) }); $('#hdImgX').style.display = ''; } catch { alert(L('Das Bild ist zu groß.')); } }; im.src = u; };
    $('#hdReset').onclick = () => { st.set('home', {}); window.paintHome(); if (window.paintVersion) paintVersion(); open(); };
    const close = () => { dlg.remove(); dlg = null; if (window.setLang) window.setLang(document.documentElement.lang || 'de'); };
    const paintTiles = () => {
      const tl = (get().tiles || DEF_TILES).map(x => ({ ...x })), opts = [...Object.entries(TG).map(([k, v]) => [k, v[0]]), ...secs().map(([i, n]) => ['settings#' + i, 'Einstellungen › ' + n])];
      $('#hdTiles').innerHTML = tl.map((t, i) => `<div class="tools" style="margin:0;flex-wrap:nowrap"><input class="field" data-e="${i}" value="${esc(t.e || tinfo(t).e)}" maxlength="3" style="width:52px;text-align:center" title="Symbol"><select class="field" data-t="${i}" style="min-width:0;flex:1">${opts.map(([k, n]) => `<option value="${esc(k)}" ${k === (t.t || 'settings') ? 'selected' : ''}>${esc(L(n))}</option>`).join('')}</select><input class="field" data-n="${i}" value="${esc(t.n || '')}" placeholder="${esc(L(tinfo({ t: t.t }).n))}" maxlength="20" style="min-width:0;flex:1"><button class="chip" data-u="${i}">↑</button><button class="chip" data-d="${i}">↓</button><button class="chip" data-x="${i}">✕</button></div>`).join('');
      const upd = fn => { const a = get().tiles ? get().tiles.map(x => ({ ...x })) : DEF_TILES.map(x => ({ ...x })); fn(a); save({ tiles: a }); paintTiles(); };
      $$('#hdTiles [data-t]').forEach(s => s.onchange = () => upd(a => { a[+s.dataset.t].t = s.value; delete a[+s.dataset.t].d; delete a[+s.dataset.t].e; }));
      $$('#hdTiles [data-e]').forEach(s => s.onchange = () => upd(a => { a[+s.dataset.e].e = s.value; }));
      $$('#hdTiles [data-n]').forEach(s => s.onchange = () => upd(a => { a[+s.dataset.n].n = s.value; if (a[+s.dataset.n].d !== undefined && !s.value) delete a[+s.dataset.n].d; }));
      $$('#hdTiles [data-u]').forEach(s => s.onclick = () => upd(a => { const i = +s.dataset.u; if (i > 0) [a[i - 1], a[i]] = [a[i], a[i - 1]]; }));
      $$('#hdTiles [data-d]').forEach(s => s.onclick = () => upd(a => { const i = +s.dataset.d; if (i < a.length - 1) [a[i + 1], a[i]] = [a[i], a[i + 1]]; }));
      $$('#hdTiles [data-x]').forEach(s => s.onclick = () => upd(a => { a.splice(+s.dataset.x, 1); }));
      if (window.setLang) window.setLang(document.documentElement.lang || 'de');
    };
    paintTiles(); $('#hdTileAdd').onclick = () => { const a = get().tiles ? get().tiles.map(x => ({ ...x })) : DEF_TILES.map(x => ({ ...x })); a.push({ t: 'servers' }); save({ tiles: a }); paintTiles(); };
    $('#hdOk').onclick = close; dlg.onclick = e => { if (e.target === dlg) close(); };
    if (window.setLang) window.setLang(document.documentElement.lang || 'de');
  }
  const b = document.createElement('button'); b.className = 'chip'; b.id = 'homeEdit'; b.textContent = '✎ Anpassen'; b.style.cssText = 'position:absolute;top:18px;right:18px;z-index:3;height:36px;padding:0 14px;font-size:13px';
  $('.hero').appendChild(b); b.onclick = open;
  window.paintHome();
})();
