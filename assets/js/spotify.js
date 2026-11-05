// Cloudy – Spotify-Seite: Playlists, Songs, Favoriten, Zuletzt, Player-Steuerung und Lyrics im Stil des Spiel-Overlays (Wörter erscheinen einzeln, Schein, Song-Karte).
// Alles läuft über die offizielle Spotify-Web-API (main.js / lib/spotapi.js). Nichts wird vorgetäuscht: Fehler und Premium-Grenzen stehen im Klartext da.
(function () {
  const root = document.getElementById('p-spotify'); if (!root) return;
  const en = () => document.documentElement.lang !== 'de', T = (de, e) => (en() ? e : de);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const C = () => window.cloudy;
  const S = { sp: null, tab: 'pl', pls: null, favs: [], recent: null, open: null, tracks: null, tErr: '', err: '', msg: '', now: null, vol: 50, volSet: 0, loading: false };
  let vis = false, keep = null, poll = null, raf = 0, volT = null, slow = null;
  const LIFE = 1600; // wie im Spiel: Lebensdauer eines Wortes in ms

  // ---------- Lyrics-Takt (gleiche Silben-Rechnung wie Lyrics.java) ----------
  const syl = w => { const s = w.toLowerCase().replace(/[^a-zäöüéèàáíóú']/g, ''); if (!s) return 1; let n = 0, v = false; for (const ch of s) { const iv = 'aeiouyäöüéèàáíóú'.includes(ch); if (iv && !v) n++; v = iv; } if (s.endsWith('e') && n > 1 && !s.endsWith('le')) n--; return Math.max(1, n); };
  const split = s => String(s || '').trim().split(/\s+/).filter(Boolean);
  function starts(lines, idx, ws) {
    const start = lines[idx][0], end = idx + 1 < lines.length ? lines[idx + 1][0] : start + 4500, gap = Math.max(500, end - start);
    const wt = ws.map(w => syl(w) + (/[,.;:!?]$/.test(w) ? 0.35 : 0)), tot = wt.reduce((a, b) => a + b, 0), sing = Math.min(gap * 0.93, Math.max(900, tot * 340));
    let cum = 0; return ws.map((_, i) => { const t = start + Math.floor(sing * cum / tot) - 90; cum += wt[i]; return t; });
  }
  const curIdx = (lines, pos) => { let i = -1; for (let k = 0; k < lines.length; k++) { if (lines[k][0] <= pos) i = k; else break; } return i; };
  window.__spotifyLyricsMath = { starts, curIdx, syl }; // für Tests

  // ---------- Einstellungen (Lyrics, Himmel, HUD …) – werden im Launcher gespeichert ----------
  const SKIES = { sunset: ['Sunset', 'linear-gradient(180deg,#d8762e 0%,#f0a766 45%,#f6c38e 62%,#5f8a45 63%,#3f6a31 100%)', '#fff1e0'], nebula: ['Nebula', 'radial-gradient(90% 70% at 40% 45%,#8a3fd8 0%,#4a1f8f 38%,#1b0f44 70%,#0b0624 100%)', '#d4c4ff'], aurora: ['Aurora', 'linear-gradient(180deg,#06132a 0%,#0b3a46 45%,#1f9a78 70%,#0a1f2a 100%)', '#c8ffe8'], night: ['Night', 'radial-gradient(100% 80% at 50% 100%,#1c2260,#0a0d2a 70%)', '#d6dcff'], dawn: ['Dawn', 'linear-gradient(180deg,#7f8cf0 0%,#f2a6d0 55%,#ffd9b0 100%)', '#fff6fa'], clear: ['Clear', 'linear-gradient(180deg,#4f9bf0 0%,#9ccbff 70%,#d8ecff 100%)', '#ffffff'] };
  const FONTS = [['Poppins', 'Poppins'], ['Montserrat', 'Montserrat'], ['Kanit', 'Kanit'], ['Fredoka', 'Fredoka'], ['Unbounded', 'Unbounded'], ['BebasNeue', 'Bebas Neue'], ['Pacifico', 'Pacifico'], ['Caveat', 'Caveat']];
  const LOOKS = { Lavender: ['Poppins', '#cdbcff'], Dreamy: ['Fredoka', '#ffd6f0'], Flame: ['BebasNeue', '#ff9a3c'], Comic: ['Kanit', '#ffe566'], Script: ['Pacifico', '#ff8ad8'], Neon: ['Unbounded', '#6ff3ff'], Ice: ['Montserrat', '#bfe8ff'], Royal: ['Poppins', '#ffd35c'], Clean: ['Poppins', '#ffffff'] };
  const DOTS = ['#cdbcff', '#ff9ecf', '#6ff3ff', '#8cf5c8', '#ffe566', '#ff6b6b', '#a46bff'];
  const DEF = { on: true, sky: 'nebula', font: 'Poppins', color: 'auto', size: 100, where: 'sky', show: 'word', look: 'Lavender', pill: true, intro: true, reduce: false };
  const CFG = (() => { try { return { ...DEF, ...JSON.parse(localStorage.getItem('cloudyLyr') || '{}') }; } catch { return { ...DEF }; } })();
  const saveCfg = () => { try { localStorage.setItem('cloudyLyr', JSON.stringify(CFG)); } catch {} pushGame(); };
  let pushT = null;
  function pushGame() { // Größe und Schrift auch an die Client-Mod im Spiel geben (gilt ab dem nächsten Spielstart)
    clearTimeout(pushT); pushT = setTimeout(() => { try { C().clientCfg({ lyricsSize: CFG.size, lyricsFont: { Poppins: 1, Montserrat: 3, Kanit: 4, Fredoka: 5, Unbounded: 6, BebasNeue: 7, Pacifico: 8, Caveat: 9 }[CFG.font] || 1 }); } catch {} }, 600);
  }
  const colorOf = () => CFG.color === 'auto' ? SKIES[CFG.sky][2] : CFG.color;

  // ---------- Lyrics-Bühne (Himmel): Zeile als Phrase, schräg im Raum, Wörter blenden nacheinander ein ----------
  const L = { key: '', line: -9, el: null, words: [], rng: 1, stage: null, card: null, introAt: 0, introKey: '' };
  const rnd = () => { L.rng = (L.rng * 16807) % 2147483647; return L.rng / 2147483647; };
  const posNow = () => { const o = S.now; if (!o) return 0; return (o.posMs || 0) + (o.playing ? Math.max(0, Math.min(3000, Date.now() - (o.ts || Date.now()))) : 0); };
  function clearLine(fade) { const e = L.el; if (e) { if (fade) { e.classList.add('out'); setTimeout(() => e.remove(), 700); } else e.remove(); } L.el = null; L.words = []; }
  function newLine(st, ws, idx, sky) {
    clearLine(true); L.rng = (idx * 7919 + 17) % 2147483646 + 1;
    const el = document.createElement('div'), ang = CFG.where === 'sky' ? (rnd() * 2 - 1) * 16 : 0, big = 0.9 + rnd() * 0.35, h = st.clientHeight || 300;
    el.className = 'lline' + (CFG.show === 'line' ? ' whole' : '');
    const cx = CFG.where === 'sky' ? 28 + rnd() * 44 : 50, cy = CFG.where === 'sky' ? 26 + rnd() * 32 : 82;
    el.style.cssText = `left:${cx}%;top:${cy}%;font-family:'${CFG.font}',Poppins,system-ui,sans-serif;font-size:${Math.round(h * 0.085 * big * CFG.size / 100)}px;color:${colorOf()};--ang:${ang.toFixed(1)}deg;transform:translate(-50%,-50%) rotate(${ang.toFixed(1)}deg)`;
    L.words = ws.map((w, i) => { const sp = document.createElement('span'); sp.className = 'lwd'; sp.textContent = w + ' '; sp.style.setProperty('--r', ((rnd() * 2 - 1) * (CFG.where === 'sky' ? 5 : 0)).toFixed(1) + 'deg'); sp.style.setProperty('--y', ((rnd() * 2 - 1) * (CFG.where === 'sky' ? 6 : 0)).toFixed(1) + 'px'); el.appendChild(sp); return sp; });
    st.appendChild(el); L.el = el; L.line = idx;
  }
  function frame() {
    raf = 0; if (!vis) return;
    const st = L.stage; if (!st || !st.isConnected) { raf = requestAnimationFrame(frame); return; }
    const o = S.now; let note = '';
    if (!CFG.on) { clearLine(false); note = T('Lyrics sind aus (Einstellungen → Lyrics).', 'Lyrics are off (Settings → Lyrics).'); }
    else if (!o || !o.title) { clearLine(false); L.key = ''; note = T('Starte in Spotify einen Song, dann erscheinen hier die Lyrics.', 'Play a song in Spotify and the lyrics show up here.'); }
    else {
      const key = o.artist + '|' + o.title; if (key !== L.key) { L.key = key; clearLine(false); L.line = -9; if (CFG.intro) L.introAt = Date.now(); }
      const lines = o.lines || [];
      if (!lines.length) { note = /search|retry|not found yet/i.test(o.status || '') || !o.status ? T('Suche Lyrics …', 'Searching lyrics …') : T('Für diesen Song gibt es keine Lyrics.', 'No lyrics found for this song.'); clearLine(false); }
      else {
        const p = posNow(), idx = curIdx(lines, p);
        if (idx < 0) clearLine(true);
        else {
          const ws = split(lines[idx][1]);
          if (idx !== L.line || !L.el) newLine(st, ws, idx);
          const sts = starts(lines, idx, ws);
          L.words.forEach((sp, i) => { const on = !o.playing || CFG.show === 'line' || sts[i] <= p; if (on !== sp.classList.contains('on')) sp.classList.toggle('on', on); });
        }
      }
    }
    // Song-Titelkarte beim Start eines Songs
    const intro = st.querySelector('.lintro'); const showIntro = CFG.intro && o && o.title && Date.now() - L.introAt < 4200 && Date.now() - L.introAt >= 0;
    if (showIntro) { if (!intro) { const d = document.createElement('div'); d.className = 'lintro'; d.innerHTML = `<small>${esc(T('JETZT LÄUFT', 'NOW PLAYING'))}</small><i></i><b>${esc(o.title)}</b><span>${esc(o.artist)}</span><i></i>`; d.style.fontFamily = `'${CFG.font}',Poppins,sans-serif`; st.appendChild(d); } } else if (intro) intro.remove();
    paintCard(o, note); if (CFG.reduce) { clearTimeout(slow); slow = setTimeout(() => { if (vis && !raf) raf = requestAnimationFrame(frame); }, 140); raf = 0; } else raf = requestAnimationFrame(frame);
  }
  function paintCard(o, note) { // Song-Leiste oben (Pille): Cover, Titel mit Fortschritt, Equalizer
    const c = L.card; if (!c) return;
    const k = o && o.title && CFG.pill ? [o.title, o.art].join('|') : '';
    if (c.dataset.k !== k) { c.dataset.k = k; c.innerHTML = k ? `<div class="lpill"><i style="background-image:url('${esc(o.art || '')}')"></i><b><span>${esc(o.title)}</span><span class="fill">${esc(o.title)}</span></b><em><u></u><u></u><u></u></em></div>` : ''; }
    const pl = c.querySelector('.lpill'); if (pl) { pl.classList.toggle('paused', !(o && o.playing)); const f = c.querySelector('.fill'); if (f && o.dur) f.style.clipPath = `inset(0 ${(100 - Math.max(0, Math.min(100, 100 * posNow() / o.dur))).toFixed(1)}% 0 0)`; }
    const nt = L.stage && L.stage.querySelector('.lnote'); if (nt) nt.textContent = note || '';
  }

  // ---------- Seite ----------
  const fmt = ms => { const s = Math.round((ms || 0) / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const isFav = id => S.favs.includes(id);
  const cover = (u, cls) => `<i class="${cls || 'spc'}" style="${u ? `background-image:url('${esc(u)}')` : ''}"></i>`;
  const LIKED = () => ({ id: 'liked', uri: '', name: T('Lieblingssongs', 'Liked Songs'), cover: '', total: null, owner: '', readable: true });
  const allPls = () => [LIKED(), ...(S.pls || [])];
  const byId = id => allPls().find(p => p.id === id);

  function card(p) {
    const n = p.total == null ? '' : p.total + ' ' + T('Songs', 'songs');
    return `<div class="spcard" data-open="${esc(p.id)}">${p.id === 'liked' ? '<i class="spc liked">♥</i>' : cover(p.cover)}<b>${esc(p.name)}</b><small>${esc(n)}${p.owner && p.id !== 'liked' ? (n ? ' · ' : '') + esc(p.owner) : ''}</small><button class="spstar${isFav(p.id) ? ' on' : ''}" data-fav="${esc(p.id)}" title="${T('Favorit', 'Favorite')}">★</button></div>`;
  }
  function libHtml() {
    const tabs = [['pl', T('Playlists', 'Playlists')], ['fav', T('Favoriten', 'Favorites')], ['recent', T('Zuletzt', 'Recent')]];
    let body = '';
    if (S.open) {
      const p = byId(S.open) || { id: S.open, name: 'Playlist', cover: '', total: null };
      body = `<div class="sphead"><button class="btn ghost" id="spBack">← ${T('Zurück', 'Back')}</button>${p.id === 'liked' ? '<i class="spc liked big">♥</i>' : cover(p.cover, 'spc big')}<div><h3>${esc(p.name)}</h3><small class="muted">${p.total != null ? p.total + ' ' + T('Songs', 'songs') : ''}</small></div><button class="btn" id="spPlayAll">▶ ${T('Abspielen', 'Play')}</button><button class="spstar${isFav(p.id) ? ' on' : ''}" data-fav="${esc(p.id)}">★</button></div>` + tracksHtml();
    } else if (S.tab === 'pl') body = S.pls ? `<div class="spgrid">${allPls().map(card).join('')}</div>` : `<p class="muted">${T('Lädt …', 'Loading …')}</p>`;
    else if (S.tab === 'fav') { const l = S.favs.map(byId).filter(Boolean); body = l.length ? `<div class="spgrid">${l.map(card).join('')}</div>` : `<p class="muted">${T('Noch keine Favoriten. Tippe bei einer Playlist auf den Stern ★.', 'No favorites yet. Tap the star ★ on a playlist.')}</p>`; }
    else { const r = S.recent; if (!r) body = `<p class="muted">${T('Lädt …', 'Loading …')}</p>`; else if (r.error) body = `<p class="sperr">${esc(r.error)}</p>`; else { const l = (r.playlistIds || []).map(byId).filter(Boolean); body = (l.length ? `<h4>${T('Zuletzt gehörte Playlists', 'Recently played playlists')}</h4><div class="spgrid">${l.map(card).join('')}</div>` : '') + `<h4>${T('Zuletzt gehörte Songs', 'Recently played songs')}</h4>` + trackRows(r.tracks || [], 'recent'); } }
    return `<div class="ptabs">${tabs.map(([k, n]) => `<button class="btn${S.tab === k && !S.open ? '' : ' ghost'}" data-sptab="${k}">${n}</button>`).join('')}<button class="btn ghost" id="spReload" title="${T('Neu laden', 'Reload')}">⟳</button></div>${body}`;
  }
  function trackRows(list, ctx) {
    if (!list.length) return `<p class="muted">${T('Keine Songs.', 'No songs.')}</p>`;
    const cur = S.now && S.now.title;
    return `<div class="sptracks">${list.map((t, i) => `<div class="sptr${cur && cur === t.name ? ' on' : ''}" data-play="${ctx}|${i}"><span class="n">${i + 1}</span>${cover(t.art, 'spc sm')}<div><b>${esc(t.name)}</b><small>${esc(t.artist)}</small></div><span class="d">${fmt(t.dur)}</span></div>`).join('')}</div>`;
  }
  function tracksHtml() {
    if (S.tErr) return `<p class="sperr">${esc(S.tErr)}</p>`;
    if (!S.tracks) return `<p class="muted">${T('Lädt …', 'Loading …')}</p>`;
    return trackRows(S.tracks.tracks, 'open') + (S.tracks.truncated ? `<p class="muted">${T('Es werden die ersten Songs gezeigt.', 'Showing the first songs.')}</p>` : '');
  }
  function connectHtml(sp, scopes) {
    const need = !sp.clientId;
    return `<div class="glass set"><h3>${scopes ? T('Neue Berechtigungen nötig', 'New permissions needed') : T('Spotify verbinden', 'Connect Spotify')}</h3>
      <p class="muted">${scopes ? T('Damit Cloudy deine Playlists lesen darf, musst du Spotify einmal neu verbinden.', 'To read your playlists Cloudy needs you to reconnect Spotify once.') : T('Verbinde dein Spotify-Konto (offizielle Spotify-Anmeldung, Cloudy sieht dein Passwort nie). Danach siehst du hier deine Playlists, Lyrics und steuerst die Wiedergabe.', 'Connect your Spotify account (official Spotify login, Cloudy never sees your password). Then you get your playlists, lyrics and playback control here.')}</p>
      ${need ? `<p class="muted">${T('Client ID aus deiner Spotify-App (developer.spotify.com, Redirect-URI:', 'Client ID from your Spotify app (developer.spotify.com, redirect URI:')} <code>${esc(sp.redirect)}</code>)</p><input id="spCidIn" class="field" placeholder="Client ID (32 ${T('Zeichen', 'characters')})" maxlength="32" style="max-width:360px">` : ''}
      <div class="tools" style="margin-top:8px"><button class="btn" id="spConnect">${T('Mit Spotify verbinden', 'Connect Spotify')}</button></div>
      <p class="muted">${T('Hinweise: Abspielen aus Cloudy braucht Spotify Premium. Bei Spotify-Apps im Entwicklermodus dürfen nur bis zu 5 eingetragene Konten (Besitzer mit Premium) die App nutzen, und Spotify liefert die Songs nur bei eigenen oder gemeinsamen Playlists.', 'Notes: playing from Cloudy needs Spotify Premium. Spotify apps in development mode work for up to 5 listed accounts (owner needs Premium), and Spotify only returns songs for your own or collaborative playlists.')}</p>
      <p class="sperr" id="spConnMsg">${esc(S.msg)}</p></div>`;
  }
  function playerHtml() {
    const o = S.now, has = o && o.title;
    return `<div class="glass spplayer">${cover(has ? o.art : '', 'spc lg')}<div class="spnow"><b>${has ? esc(o.title) : T('Nichts spielt gerade', 'Nothing playing')}</b><span class="muted">${has ? esc(o.artist) : T('Starte einen Song in Spotify oder wähle unten eine Playlist.', 'Start a song in Spotify or pick a playlist below.')}</span></div>
      <div class="spctl"><button class="btn ghost" data-k="prev" title="${T('Zurück', 'Previous')}">⏮</button><button class="btn" data-k="playpause" id="spPP">${o && o.playing ? '⏸' : '▶'}</button><button class="btn ghost" data-k="next" title="${T('Weiter', 'Next')}">⏭</button></div>
      <label class="spvol" title="${T('Lautstärke (Spotify-Gerät)', 'Volume (Spotify device)')}">🔊 <input type="range" id="spVol" min="0" max="100" value="${S.vol}"></label></div><p class="sperr" id="spMsg">${esc(S.err)}</p>`;
  }
  // ---------- Einstellungs-Fenster (Seitenleiste wie im Video: Übersicht, Himmel, Lyrics, Stile, HUD, Leistung, Einstellungen, Info) ----------
  const NAV = [['ov', '⌂', 'Übersicht', 'Overview'], ['sky', '☾', 'Himmel', 'Skies'], ['ly', '♫', 'Lyrics', 'Lyrics'], ['st', '✎', 'Stile', 'Styles'], ['hud', '▭', 'HUD', 'HUD'], ['perf', '⚡', 'Leistung', 'Performance'], ['set', '⚙', 'Einstellungen', 'Settings'], ['info', 'ⓘ', 'Information', 'Information']];
  let setTab = 'ly', setOpen = false;
  const sw = (key, on) => `<button class="spsw${on ? ' on' : ''}" data-cfgt="${key}"><i></i></button>`;
  const row = (title, sub, ctl) => `<div class="setrow"><div><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}</div><div class="ctl">${ctl}</div></div>`;
  const seg = (key, opts) => `<div class="seg">${opts.map(([v, n]) => `<button class="${CFG[key] === v ? 'on' : ''}" data-cfgv="${key}|${v}">${n}</button>`).join('')}</div>`;
  function setBody() {
    const o = S.now, has = o && o.title;
    const np = `<div class="setnow"><i style="background-image:url('${esc(has ? o.art : '')}')"></i><div><b>${has ? esc(o.title) : T('Nichts spielt', 'Nothing playing')}</b><span>${has ? esc(o.artist) : ''}</span>${has ? `<em class="badge ${o.lines && o.lines.length ? 'ok' : ''}">${o.lines && o.lines.length ? '• ' + T('Lyrics synchron', 'Lyrics synced') : T('keine Lyrics', 'no lyrics')}</em> <small>${fmt(posNow())} / ${fmt(o.dur)}</small>` : ''}<u><em style="width:${has && o.dur ? Math.min(100, 100 * posNow() / o.dur) : 0}%"></em></u></div></div>`;
    if (setTab === 'ov') return `<h3>${T('Übersicht', 'Overview')}</h3><p class="muted">${T('Spotify-Lyrics und Wiedergabe im Cloudy-Launcher.', 'Spotify lyrics and playback in the Cloudy launcher.')}</p>${np}` + row(T('Konto', 'Account'), T('Verbunden über die offizielle Spotify-Anmeldung', 'Connected via the official Spotify login'), `<span class="badge ok">• ${T('verbunden', 'connected')}</span>`) + row(T('Playlists', 'Playlists'), T('Eigene und gemeinsame Playlists zeigen ihre Songs', 'Your own and collaborative playlists show their songs'), `<b>${S.pls ? S.pls.length : '…'}</b>`);
    if (setTab === 'sky') return `<h3>${T('Himmel', 'Skies')}</h3><p class="muted">${T('Hintergrund der Lyrics-Bühne', 'Background of the lyrics stage')}</p><div class="stiles skyg">${Object.entries(SKIES).map(([k, v]) => `<button class="stile${CFG.sky === k ? ' on' : ''}" data-cfgv="sky|${k}" style="background:${v[1]}"><span>${v[0]}</span></button>`).join('')}</div>`;
    if (setTab === 'ly') return `<h3>Lyrics</h3><p class="muted">${T('Spotify-Lyrics im Himmel.', 'Spotify lyrics in the sky.')}</p>${np}<h4>▸ Lyrics</h4>` + row(T('Lyrics zeigen', 'Show lyrics'), T('Während Spotify spielt', 'While Spotify plays'), sw('on', CFG.on)) + row(T('Wo', 'Where'), T('Im Himmel schwebend oder fest unten wie Untertitel', 'Floating in the sky or fixed at the bottom like subtitles'), seg('where', [['sky', T('Himmel', 'Sky')], ['screen', T('Bildschirm', 'Screen')]])) + row(T('Zeige', 'Show'), T('Wort für Wort oder ganze Zeile', 'Word by word or the whole line'), seg('show', [['word', T('Wort für Wort', 'Word by word')], ['line', T('Zeile', 'Line')]])) +
      `<h4>▸ ${T('Schrift', 'Font')}</h4><div class="stiles fonts">${FONTS.map(([f, n]) => `<button class="stile${CFG.font === f ? ' on' : ''}" data-cfgv="font|${f}" style="font-family:'${f}'">${n}</button>`).join('')}</div>` +
      row(T('Farbe', 'Colour'), T('A = passend zum Himmel', 'A = matches the sky'), `<span class="sdots"><button class="sdot a${CFG.color === 'auto' ? ' on' : ''}" data-cfgv="color|auto">A</button>${DOTS.map(c => `<button class="sdot${CFG.color === c ? ' on' : ''}" data-cfgv="color|${c}" style="background:${c}"></button>`).join('')}</span>`) + row(T('Lyrics-Größe', 'Lyrics size'), CFG.size + ' %', `<input type="range" min="60" max="160" value="${CFG.size}" id="cfgSize">`);
    if (setTab === 'st') return `<h3>${T('Stile', 'Styles')}</h3><p class="muted">${T('Fertige Kombinationen aus Schrift und Farbe', 'Ready-made combinations of font and colour')}</p><div class="stiles looks">${Object.entries(LOOKS).map(([k, v]) => `<button class="stile${CFG.look === k ? ' on' : ''}" data-look="${k}" style="font-family:'${v[0]}';color:${v[1]}">${k}<i style="background:${v[1]}"></i></button>`).join('')}</div>`;
    if (setTab === 'hud') return `<h3>HUD</h3><p class="muted">${T('Zusätze auf der Bühne', 'Extras on the stage')}</p>` + row(T('Song-Leiste', 'Song bar'), T('Pille oben mit Cover, Titel, Fortschritt und Equalizer', 'Pill on top with cover, title, progress and equalizer'), sw('pill', CFG.pill)) + row(T('Titelkarte', 'Title card'), T('Beim Start eines Songs Titel und Künstler zeigen', 'Show title and artist when a song starts'), sw('intro', CFG.intro));
    if (setTab === 'perf') return `<h3>${T('Leistung', 'Performance')}</h3><p class="muted">${T('Weniger Last für schwächere PCs', 'Less load for weaker PCs')}</p>` + row(T('Sparmodus', 'Low-power mode'), T('Animation nur etwa 7× pro Sekunde (Wörter erscheinen trotzdem im Takt)', 'Animate only about 7× per second (words still appear in time)'), sw('reduce', CFG.reduce));
    if (setTab === 'set') return `<h3>${T('Einstellungen', 'Settings')}</h3>` + row(T('Zurücksetzen', 'Reset'), T('Alle Lyrics-Einstellungen auf Standard', 'All lyrics settings back to default'), `<button class="btn ghost" id="cfgReset">${T('Zurücksetzen', 'Reset')}</button>`) + row(T('Im Spiel', 'In game'), T('Lyrics-Größe und Schrift gehen an die Client-Mod (ab dem nächsten Spielstart). Himmel, Stile und Titelkarte gibt es nur im Launcher', 'Size and font go to the client mod (from the next game start). Skies, styles and the title card exist in the launcher only'), `<span class="badge ok">${T('aktiv', 'on')}</span>`);
    return `<h3>${T('Information', 'Information')}</h3><p class="muted">${T('Lyrics kommen aus LRCLIB und weiteren Quellen und sind nicht für jeden Song vorhanden. Abspielen und Lautstärke aus Cloudy brauchen Spotify Premium. Spotify liefert Songs nur für eigene oder gemeinsame Playlists.', 'Lyrics come from LRCLIB and other sources and do not exist for every song. Playing and volume from Cloudy need Spotify Premium. Spotify only returns songs for your own or collaborative playlists.')}</p>`;
  }
  function settingsHtml() {
    if (!setOpen) return `<div class="tools" style="margin:6px 0"><button class="btn ghost" id="setToggle">⚙ ${T('Lyrics-Einstellungen', 'Lyrics settings')}</button></div>`;
    return `<div class="tools" style="margin:6px 0"><button class="btn" id="setToggle">⚙ ${T('Lyrics-Einstellungen', 'Lyrics settings')} ✕</button></div><div class="glass setwin"><aside><div class="sbrand"><b>Cloudy</b><small>${T('Lyrics & Spotify', 'Lyrics & Spotify')}</small></div>${NAV.map(([k, ic, d, e]) => `<button class="${setTab === k ? 'on' : ''}" data-settab="${k}"><span>${ic}</span>${T(d, e)}</button>`).join('')}</aside><section>${setBody()}</section></div>`;
  }
  function bindSet() {
    const tg = root.querySelector('#setToggle'); if (tg) tg.onclick = () => { setOpen = !setOpen; refreshSet(); };
    root.querySelectorAll('[data-settab]').forEach(b => b.onclick = () => { setTab = b.dataset.settab; refreshSet(); });
    root.querySelectorAll('[data-cfgt]').forEach(b => b.onclick = () => { CFG[b.dataset.cfgt] = !CFG[b.dataset.cfgt]; saveCfg(); applyCfg(); });
    root.querySelectorAll('[data-cfgv]').forEach(b => b.onclick = () => { const [k, v] = b.dataset.cfgv.split('|'); CFG[k] = v; if (k === 'font' || k === 'color') CFG.look = ''; saveCfg(); applyCfg(); });
    root.querySelectorAll('[data-look]').forEach(b => b.onclick = () => { const l = LOOKS[b.dataset.look]; CFG.look = b.dataset.look; CFG.font = l[0]; CFG.color = l[1]; saveCfg(); applyCfg(); });
    const sz = root.querySelector('#cfgSize'); if (sz) sz.oninput = () => { CFG.size = +sz.value; saveCfg(); const lab = sz.closest('.setrow').querySelector('small'); if (lab) lab.textContent = CFG.size + ' %'; applyCfg(true); };
    const rs = root.querySelector('#cfgReset'); if (rs) rs.onclick = () => { Object.assign(CFG, DEF); saveCfg(); applyCfg(); };
  }
  function applyCfg(keepSet) { // Änderungen sofort auf der Bühne zeigen
    if (L.stage) { L.stage.style.background = SKIES[CFG.sky][1]; clearLine(false); L.line = -9; L.key = ''; const i = L.stage.querySelector('.lintro'); if (i) i.remove(); L.introAt = 0; }
    L.card && (L.card.dataset.k = '\0'); if (!keepSet) refreshSet();
  }
  function refreshSet() { const h = root.querySelector('#spSet'); if (h) { h.innerHTML = settingsHtml(); bindSet(); } }

  function paint() {
    if (!vis) return;
    const keepStage = L.stage && L.stage.isConnected && root.contains(L.stage);
    if (!S.sp) { root.innerHTML = `<h2 style="margin:0 0 10px">Spotify</h2><p class="muted">${T('Lädt …', 'Loading …')}</p>`; return; }
    if (!S.sp.connected || !S.sp.scopeOk) { root.innerHTML = `<h2 style="margin:0 0 10px">Spotify</h2>` + connectHtml(S.sp, S.sp.connected); bind(); return; }
    if (keepStage) { // Bühne bleibt stehen (sonst flackern die Wörter), nur Player und Bibliothek neu zeichnen
      root.querySelector('#spTop').innerHTML = playerHtml(); root.querySelector('#spLib').innerHTML = libHtml(); root.querySelector('#spSet').innerHTML = settingsHtml();
    } else {
      root.innerHTML = `<div class="sptitle"><h2 style="margin:0">Spotify</h2><button class="btn ghost" id="spOff">${T('Trennen', 'Disconnect')}</button></div><div id="spTop">${playerHtml()}</div>
        <div class="glass lstage" id="lStage" style="background:${SKIES[CFG.sky][1]}"><div class="lnote"></div><div class="lcardw" id="lCard"></div></div><div id="spSet">${settingsHtml()}</div><div id="spLib">${libHtml()}</div>`;
      L.stage = root.querySelector('#lStage'); L.card = root.querySelector('#lCard'); L.words = []; L.line = -9; L.key = '';
    }
    bind();
  }
  function bind() {
    root.querySelectorAll('[data-sptab]').forEach(b => b.onclick = () => { S.tab = b.dataset.sptab; S.open = null; paint(); if (S.tab === 'recent') loadRecent(); });
    root.querySelectorAll('[data-open]').forEach(b => b.onclick = e => { if (e.target.closest('[data-fav]')) return; openPl(b.dataset.open); });
    root.querySelectorAll('[data-fav]').forEach(b => b.onclick = async e => { e.stopPropagation(); S.favs = await C().spFavToggle(b.dataset.fav); paint(); });
    const back = root.querySelector('#spBack'); if (back) back.onclick = () => { S.open = null; S.tracks = null; S.tErr = ''; paint(); };
    const rl = root.querySelector('#spReload'); if (rl) rl.onclick = () => { S.pls = null; S.recent = null; loadAll(true); };
    const pa = root.querySelector('#spPlayAll'); if (pa) pa.onclick = () => playPl();
    root.querySelectorAll('[data-play]').forEach(b => b.onclick = () => { const [ctx, i] = b.dataset.play.split('|'); playTrack(ctx, +i); });
    root.querySelectorAll('[data-k]').forEach(b => b.onclick = async () => { S.err = ''; const ok = await C().mediaKey(b.dataset.k); if (!ok) { try { const st = await C().spotifyTest(); S.err = (st && st.msg) || T('Steuerung nicht möglich.', 'Control not possible.'); } catch { S.err = T('Steuerung nicht möglich.', 'Control not possible.'); } } setErr(); setTimeout(pollNow, 400); });
    const vol = root.querySelector('#spVol'); if (vol) vol.oninput = () => { S.vol = +vol.value; S.volSet = Date.now(); clearTimeout(volT); volT = setTimeout(async () => { const r = await C().spVolume(S.vol); S.err = r && r.ok ? '' : (r && r.error) || ''; setErr(); }, 250); };
    const cn = root.querySelector('#spConnect'); if (cn) cn.onclick = async () => { const id = root.querySelector('#spCidIn'); cn.disabled = true; S.msg = T('Der Browser öffnet sich – bitte bei Spotify bestätigen …', 'Your browser opens – please confirm at Spotify …'); setConn(); const r = await C().spotifyConnect(id ? id.value : ''); S.msg = r && r.ok ? '' : (r && r.error) || T('Fehlgeschlagen.', 'Failed.'); S.sp = await C().spotifyState(); cn.disabled = false; paint(); if (S.sp.connected && S.sp.scopeOk) loadAll(true); };
    bindSet();
    const off = root.querySelector('#spOff'); if (off) off.onclick = async () => { await C().spotifyDisconnect(); S.sp = await C().spotifyState(); S.pls = null; S.now = null; L.stage = null; paint(); };
  }
  const setErr = () => { const e = root.querySelector('#spMsg'); if (e) e.textContent = S.err; };
  const setConn = () => { const e = root.querySelector('#spConnMsg'); if (e) e.textContent = S.msg; };

  async function openPl(id) { S.open = id; S.tracks = null; S.tErr = ''; paint(); const r = await C().spTracks(id); if (S.open !== id) return; if (r && r.ok) S.tracks = r; else S.tErr = (r && r.error) || T('Songs konnten nicht geladen werden.', 'Could not load songs.'); paint(); }
  async function playPl() {
    const p = byId(S.open); S.err = '';
    const r = p && p.id === 'liked' ? await C().spPlay({ uris: ((S.tracks && S.tracks.tracks) || []).map(t => t.uri) }) : await C().spPlay({ context: p && p.uri });
    S.err = r && r.ok ? '' : (r && r.error) || ''; setErr(); setTimeout(pollNow, 900);
  }
  async function playTrack(ctx, i) {
    const list = ctx === 'recent' ? ((S.recent && S.recent.tracks) || []) : ((S.tracks && S.tracks.tracks) || []), t = list[i]; if (!t) return; S.err = '';
    const p = ctx === 'open' ? byId(S.open) : null;
    const r = p && p.id !== 'liked' && p.uri ? await C().spPlay({ context: p.uri, uri: t.uri }) : await C().spPlay({ uris: list.slice(i, i + 100).map(x => x.uri) });
    S.err = r && r.ok ? '' : (r && r.error) || ''; setErr(); setTimeout(pollNow, 900);
  }
  async function loadRecent() { S.recent = null; paint(); S.recent = (await C().spRecent()) || { error: T('Fehlgeschlagen.', 'Failed.') }; if (S.tab === 'recent' && !S.open) paint(); }
  async function loadAll(force) {
    if (S.loading && !force) return; S.loading = true;
    try {
      S.sp = await C().spotifyState(); if (!S.sp.connected || !S.sp.scopeOk) { paint(); return; }
      S.favs = await C().spFavs();
      const r = await C().spPlaylists(); if (r && r.ok) { S.pls = r.playlists; S.err = ''; } else { S.pls = []; S.err = (r && r.error) || ''; }
      paint();
      try { const pl = await C().spPlayer(); if (pl && pl.ok && pl.device && typeof pl.device.volume === 'number' && Date.now() - S.volSet > 5000) { S.vol = pl.device.volume; const v = root.querySelector('#spVol'); if (v) v.value = S.vol; } } catch {}
    } catch (e) { S.err = String((e && e.message) || e); paint(); } finally { S.loading = false; }
  }
  async function pollNow() { try { S.now = await C().lyricsNow(); if (setOpen && (setTab === 'ly' || setTab === 'ov')) { const np = root.querySelector('.setnow'); if (np && S.now && np.dataset.k !== S.now.title + '|' + S.now.art) { np.dataset.k = S.now.title + '|' + S.now.art; refreshSet(); const n2 = root.querySelector('.setnow'); if (n2) n2.dataset.k = np.dataset.k; } } const pp = root.querySelector('#spPP'); if (pp) pp.textContent = S.now && S.now.playing ? '⏸' : '▶'; const t = root.querySelector('#spTop .spnow'); if (t) { const o = S.now; t.innerHTML = o && o.title ? `<b>${esc(o.title)}</b><span class="muted">${esc(o.artist)}</span>` : `<b>${T('Nichts spielt gerade', 'Nothing playing')}</b><span class="muted">${T('Starte einen Song in Spotify oder wähle unten eine Playlist.', 'Start a song in Spotify or pick a playlist below.')}</span>`; const cv = root.querySelector('#spTop .spc.lg'); if (cv) cv.style.backgroundImage = o && o.art ? `url('${o.art}')` : ''; } } catch {} }

  const ps = window.paintSub;
  window.paintSub = p => {
    if (ps) ps(p); const on = p === 'spotify';
    if (on && !vis) { vis = true; paint(); loadAll(); const kick = () => { try { C().lyricsUi(true); } catch {} }; kick(); keep = setInterval(kick, 8000); poll = setInterval(pollNow, 1000); pollNow(); if (!raf) raf = requestAnimationFrame(frame); }
    else if (!on && vis) { vis = false; clearInterval(keep); clearInterval(poll); try { C().lyricsUi(false); } catch {} if (raf) { cancelAnimationFrame(raf); raf = 0; } L.stage = null; }
  };
  const sl = window.setLang; if (sl) window.setLang = l => { sl(l); if (vis) { L.stage = null; paint(); } };
  window.__spotifyState = S; // für Tests
})();
