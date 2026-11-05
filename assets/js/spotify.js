// Cloudy – Spotify-Seite: Playlists, Songs, Favoriten, Zuletzt, Player-Steuerung und Lyrics im Stil des Spiel-Overlays (Wörter erscheinen einzeln, Schein, Song-Karte).
// Alles läuft über die offizielle Spotify-Web-API (main.js / lib/spotapi.js). Nichts wird vorgetäuscht: Fehler und Premium-Grenzen stehen im Klartext da.
(function () {
  const root = document.getElementById('p-spotify'); if (!root) return;
  const en = () => document.documentElement.lang !== 'de', T = (de, e) => (en() ? e : de);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const C = () => window.cloudy;
  const S = { sp: null, tab: 'pl', pls: null, favs: [], recent: null, open: null, tracks: null, tErr: '', err: '', msg: '', now: null, vol: 50, volSet: 0, loading: false };
  let vis = false, keep = null, poll = null, raf = 0, volT = null;
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

  // ---------- Lyrics-Bühne ----------
  const L = { key: '', lines: [], words: [], line: -9, spawned: 0, rng: 12345, stage: null, card: null };
  const rnd = () => { L.rng = (L.rng * 1103515245 + 12345) & 0x7fffffff; return L.rng / 0x7fffffff; };
  const posNow = () => { const o = S.now; if (!o) return 0; return (o.posMs || 0) + (o.playing ? Math.max(0, Math.min(3000, Date.now() - (o.ts || Date.now()))) : 0); };
  function place(st, w) { // freie Stelle suchen (Prozent der Bühne), nicht über Karte oben rechts
    const hw = (w.t.length * 0.62 + 1.2) * w.sz * 0.62, hh = 3.4 * w.sz; let best = null, bs = -1;
    for (let k = 0; k < 14; k++) {
      const side = ((L.spawned + L.line) % 2 === 0 ? 1 : -1) * (k < 8 ? 1 : (rnd() < 0.5 ? 1 : -1)), x = 50 + side * (14 + rnd() * 30), y = 18 + rnd() * 66;
      if (x > 62 && y < 30) continue; // Platz der Song-Karte
      let min = 99; for (const o of L.words) { const ow = (o.t.length * 0.62 + 1.2) * o.sz * 0.62, oh = 3.4 * o.sz; min = Math.min(min, Math.max(Math.abs(x - o.x) / (hw + ow + 1.5), Math.abs(y - o.y) / (hh + oh + 1))); }
      if (min > bs) { bs = min; best = [x, y]; } if (min >= 1) break;
    }
    return best || [50, 50];
  }
  function spawn(st, text, now) {
    const el = document.createElement('span'); el.className = 'lw'; el.textContent = text; st.appendChild(el);
    const w = { t: text, el, sz: 0.85 + rnd() * 0.8, t0: now, cur: true, k: 1, kt: now }; [w.x, w.y] = place(st, w);
    for (const o of L.words) o.cur = false; L.words.push(w);
  }
  function resetLyr() { for (const w of L.words) w.el.remove(); L.words = []; L.line = -9; L.spawned = 0; }
  function frame() {
    raf = 0; if (!vis) return;
    const st = L.stage; if (!st || !st.isConnected) { raf = requestAnimationFrame(frame); return; }
    const o = S.now, now = Date.now(); let note = '';
    if (!o || !o.title) { resetLyr(); L.key = ''; note = T('Starte in Spotify einen Song, dann erscheinen hier die Lyrics.', 'Play a song in Spotify and the lyrics show up here.'); }
    else {
      const key = o.artist + '|' + o.title; if (key !== L.key) { L.key = key; resetLyr(); }
      const lines = o.lines || [];
      if (!lines.length) { note = /search|retry|not found yet/i.test(o.status || '') || !o.status ? T('Suche Lyrics …', 'Searching lyrics …') : T('Für diesen Song gibt es keine Lyrics.', 'No lyrics found for this song.'); resetLyr(); }
      else {
        const p = posNow(), idx = curIdx(lines, p);
        if (idx !== L.line) { L.line = idx; L.spawned = 0; L.rng = idx * 7919 + 17; for (const w of L.words) w.cur = false; }
        if (idx >= 0) {
          const ws = split(lines[idx][1]);
          if (!o.playing) { // Pause: die Zeile steht ruhig links und rechts am Rand
            resetLyr(); L.line = idx; const holder = st.querySelector('.lpause') || st.appendChild(Object.assign(document.createElement('div'), { className: 'lpause' }));
            const html = ws.map((w, i) => `<span class="lp ${i % 2 ? 'r' : 'l'}" style="top:${14 + (i * 70 / Math.max(1, ws.length))}%">${esc(w.toUpperCase())}</span>`).join(''); if (holder.dataset.k !== key + idx) { holder.dataset.k = key + idx; holder.innerHTML = html; }
          } else {
            const h = st.querySelector('.lpause'); if (h) h.remove();
            const sts = starts(lines, idx, ws);
            for (let i = L.spawned; i < ws.length; i++) { if (sts[i] > p) break; L.spawned = i + 1; if (p - sts[i] > 1800) continue; spawn(st, ws[i].toUpperCase(), now); }
          }
        } else { const h = st.querySelector('.lpause'); if (h) h.remove(); }
      }
    }
    for (let i = L.words.length - 1; i >= 0; i--) { // Zeichnen: Einblenden, Schweben, Ausblenden (Werte wie im Spiel)
      const w = L.words[i], age = now - w.t0; if (age > LIFE + 700) { w.el.remove(); L.words.splice(i, 1); continue; }
      let inn = Math.min(1, age / 200); inn = 1 - (1 - inn) * (1 - inn);
      const fs = LIFE * 0.55, out = age < fs ? 1 : Math.max(0, 1 - (age - fs) / (LIFE * 0.45 + 300));
      w.k += ((w.cur ? 1 : 0) - w.k) * Math.min(1, (now - w.kt) / 140); w.kt = now;
      const a = inn * out * (0.8 + 0.2 * w.k), sc = w.sz * (0.9 + 0.35 * w.k) * (1.3 - 0.3 * inn), h = st.clientHeight || 300;
      const dy = -(age * 0.00005 * h + Math.sin(age / 420 + w.sz * 5) * h * 0.006), dx = Math.cos(age / 560 + w.sz * 3) * h * 0.005;
      const s = w.el.style; s.left = w.x + '%'; s.top = w.y + '%'; s.opacity = a.toFixed(3); s.transform = `translate(-50%,-50%) translate(${dx.toFixed(1)}px,${dy.toFixed(1)}px) scale(${sc.toFixed(3)})`;
      s.filter = inn < 1 ? `blur(${((1 - inn) * 5).toFixed(1)}px)` : 'none';
      s.color = w.k > 0.5 ? 'var(--lyr-cur,#8a5cf5)' : 'var(--lyr-old,#f2b3d6)'; s.textShadow = `0 0 ${w.k > 0.5 ? 12 : 6}px ${w.k > 0.5 ? 'rgba(138,92,245,.65)' : 'rgba(242,179,214,.35)'}`;
    }
    paintCard(o, note); raf = requestAnimationFrame(frame);
  }
  function paintCard(o, note) { // Song-Karte oben rechts: Cover, Titel, Künstler, Fortschritt + aktuelle Zeile (gesungene Wörter hell, Rest grau)
    const c = L.card; if (!c) return;
    const k = o && o.title ? [o.title, o.artist, o.art].join('|') : '';
    if (c.dataset.k !== k) { c.dataset.k = k; c.innerHTML = o && o.title ? `<div class="lcard"><i style="background-image:url('${esc(o.art || '')}')"></i><div><b>${esc(o.title)}</b><span>${esc(o.artist)}</span><u><em></em></u></div></div><div class="lcur"></div>` : ''; }
    const bar = c.querySelector('u em'); if (bar && o && o.dur) bar.style.width = Math.max(0, Math.min(100, 100 * posNow() / o.dur)).toFixed(1) + '%';
    const cur = c.querySelector('.lcur'), nt = L.stage && L.stage.querySelector('.lnote'); if (nt) nt.textContent = note || '';
    if (!cur || !o) return; const lines = o.lines || [], idx = lines.length ? curIdx(lines, posNow()) : -1;
    if (idx < 0) { cur.innerHTML = lines.length ? '' : ''; return; }
    const ws = split(lines[idx][1]), sts = starts(lines, idx, ws), p = posNow(); let sung = 0; for (let i = 0; i < ws.length; i++) if (sts[i] <= p) sung = i + 1; if (!o.playing) sung = ws.length;
    const h = ws.map((w, i) => `<s class="${i < sung ? 'on' : ''}">${esc(w)}</s>`).join(' '); if (cur.dataset.h !== h) { cur.dataset.h = h; cur.innerHTML = h; }
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
  function paint() {
    if (!vis) return;
    const keepStage = L.stage && L.stage.isConnected && root.contains(L.stage);
    if (!S.sp) { root.innerHTML = `<h2 style="margin:0 0 10px">Spotify</h2><p class="muted">${T('Lädt …', 'Loading …')}</p>`; return; }
    if (!S.sp.connected || !S.sp.scopeOk) { root.innerHTML = `<h2 style="margin:0 0 10px">Spotify</h2>` + connectHtml(S.sp, S.sp.connected); bind(); return; }
    if (keepStage) { // Bühne bleibt stehen (sonst flackern die Wörter), nur Player und Bibliothek neu zeichnen
      root.querySelector('#spTop').innerHTML = playerHtml(); root.querySelector('#spLib').innerHTML = libHtml();
    } else {
      root.innerHTML = `<div class="sptitle"><h2 style="margin:0">Spotify</h2><button class="btn ghost" id="spOff">${T('Trennen', 'Disconnect')}</button></div><div id="spTop">${playerHtml()}</div>
        <div class="glass lstage" id="lStage"><div class="lnote"></div><div class="lcardw" id="lCard"></div></div><div id="spLib">${libHtml()}</div>`;
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
  async function pollNow() { try { S.now = await C().lyricsNow(); const pp = root.querySelector('#spPP'); if (pp) pp.textContent = S.now && S.now.playing ? '⏸' : '▶'; const t = root.querySelector('#spTop .spnow'); if (t) { const o = S.now; t.innerHTML = o && o.title ? `<b>${esc(o.title)}</b><span class="muted">${esc(o.artist)}</span>` : `<b>${T('Nichts spielt gerade', 'Nothing playing')}</b><span class="muted">${T('Starte einen Song in Spotify oder wähle unten eine Playlist.', 'Start a song in Spotify or pick a playlist below.')}</span>`; const cv = root.querySelector('#spTop .spc.lg'); if (cv) cv.style.backgroundImage = o && o.art ? `url('${o.art}')` : ''; } } catch {} }

  const ps = window.paintSub;
  window.paintSub = p => {
    if (ps) ps(p); const on = p === 'spotify';
    if (on && !vis) { vis = true; paint(); loadAll(); const kick = () => { try { C().lyricsUi(true); } catch {} }; kick(); keep = setInterval(kick, 8000); poll = setInterval(pollNow, 1000); pollNow(); if (!raf) raf = requestAnimationFrame(frame); }
    else if (!on && vis) { vis = false; clearInterval(keep); clearInterval(poll); try { C().lyricsUi(false); } catch {} if (raf) { cancelAnimationFrame(raf); raf = 0; } L.stage = null; }
  };
  const sl = window.setLang; if (sl) window.setLang = l => { sl(l); if (vis) { L.stage = null; paint(); } };
  window.__spotifyState = S; // für Tests
})();
