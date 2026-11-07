// Cloudy 2.0 – YouTube Music als zweite Musikplattform (neben Spotify).
// Ehrlich zur Technik: YouTube Music hat KEINE offizielle API zum Steuern/Auslesen für Apps. Cloudy nutzt deshalb den offiziellen YouTube-Einbettungsplayer
// (IFrame Player API, per postMessage). Damit gehen: Link/Playlist abspielen, Titel, Kanal/Interpret, Cover (Vorschaubild), Play/Pause, Vorheriger/Nächster
// (nur bei Playlists), Wiedergabestatus und Position. Nicht möglich: eigene YouTube-Music-Mediathek, Likes, Suche im Konto, Songs, die YouTube nicht einbetten lässt.
(function () {
  const stage = document.querySelector('.stage'), spRoot = document.getElementById('p-spotify'); if (!stage || !spRoot) return;
  const C = () => window.cloudy, L = s => (window.t ? window.t(s) : s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const get = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
  const set = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  let plat = get('cloudy.musicPlat', 'spotify'); if (plat !== 'ytm') plat = 'spotify';

  // Seite für YouTube Music + Plattform-Umschalter (oben rechts im Musik-Bereich)
  const page = document.createElement('div'); page.className = 'page'; page.id = 'p-ytm'; stage.appendChild(page);
  const bar = document.createElement('div'); bar.id = 'musPlat'; bar.hidden = true; bar.setAttribute('role', 'tablist');
  bar.innerHTML = `<button type="button" role="tab" data-plat="spotify">Spotify</button><button type="button" role="tab" data-plat="ytm">YouTube Music</button>`;
  stage.appendChild(bar);
  const paintBar = () => bar.querySelectorAll('[data-plat]').forEach(b => { const on = b.dataset.plat === plat; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });

  // ---- Link erkennen ----
  function parse(v) {
    v = String(v || '').trim(); let m;
    if ((m = /^https:\/\/(?:www\.|music\.|m\.)?youtube\.com\/watch\?(?:[^#]*&)?v=([\w-]{11})(?:[^#]*[?&]list=([\w-]+))?/.exec(v))) return m[2] ? { kind: 'list', id: m[2], vid: m[1] } : { kind: 'video', id: m[1] };
    if ((m = /^https:\/\/youtu\.be\/([\w-]{11})/.exec(v))) return { kind: 'video', id: m[1] };
    if ((m = /^https:\/\/(?:www\.|music\.|m\.)?youtube\.com\/(?:playlist|browse)\?(?:[^#]*&)?list=([\w-]+)/.exec(v))) return { kind: 'list', id: m[1] };
    return null;
  }
  const embed = r => 'https://www.youtube.com/embed/' + (r.kind === 'list' ? 'videoseries?list=' + r.id : r.id) + (r.kind === 'list' ? '&' : '?') + 'enablejsapi=1&playsinline=1&rel=0';
  const canon = r => r.kind === 'list' ? 'https://music.youtube.com/playlist?list=' + r.id : 'https://music.youtube.com/watch?v=' + r.id;
  const list = () => { const a = get('cloudy.ytmList', []); return Array.isArray(a) ? a.filter(x => x && typeof x.url === 'string').slice(0, 50) : []; };

  const P = { cur: get('cloudy.ytmCur', ''), title: '', author: '', vid: '', playing: false, pos: 0, dur: 0, t: 0, isList: false, msg: '', timer: 0, raf: 0 };
  const frame = () => page.querySelector('iframe');
  const cmd = (func, args) => { const f = frame(); if (f && f.contentWindow) f.contentWindow.postMessage(JSON.stringify({ event: 'command', func, args: args || [] }), '*'); };

  function report() { try { if (P.title) C().webReport({ title: P.title, artist: P.author, playing: P.playing, posMs: P.pos * 1000 + (P.playing ? Date.now() - P.t : 0) }); else C().webReport(null); } catch {} }
  window.addEventListener('message', ev => {
    if (!frame() || ev.source !== frame().contentWindow) return;
    let d = ev.data; try { if (typeof d === 'string') d = JSON.parse(d); } catch { return; }
    if (!d || (d.event !== 'infoDelivery' && d.event !== 'initialDelivery')) return;
    const i = d.info || {};
    if (i.videoData) { if (i.videoData.title) P.title = i.videoData.title; if (i.videoData.author) P.author = String(i.videoData.author).replace(/\s*-\s*Topic$/i, ''); if (i.videoData.video_id) P.vid = i.videoData.video_id; }
    if (typeof i.currentTime === 'number') { P.pos = i.currentTime; P.t = Date.now(); }
    if (typeof i.duration === 'number' && i.duration > 0) P.dur = i.duration;
    if (typeof i.playerState === 'number') P.playing = i.playerState === 1;
    if (Array.isArray(i.playlist)) P.isList = i.playlist.length > 1;
    paintNow(); report();
  });

  function paintNow() {
    const n = page.querySelector('#ytmNow'); if (!n) return;
    const cover = P.vid ? `https://i.ytimg.com/vi/${encodeURIComponent(P.vid)}/hqdefault.jpg` : '';
    n.innerHTML = `<i class="ytm-cover" style="${cover ? `background-image:url('${cover}')` : ''}"></i><div class="ytm-meta"><b>${esc(P.title || L('Nichts ausgewählt'))}</b><span class="muted">${esc(P.author || L('Füge unten einen YouTube-Music-Link ein.'))}</span>
      <div class="bar"><i style="width:${P.dur ? Math.min(100, Math.round(100 * (P.pos + (P.playing ? (Date.now() - P.t) / 1000 : 0)) / P.dur)) : 0}%"></i></div>
      <div class="ytm-ctl"><button type="button" data-yc="previousVideo" ${P.isList ? '' : 'disabled'} aria-label="${esc(L('Vorheriger Titel'))}" title="${esc(L('Vorheriger Titel'))}"><svg viewBox="0 0 24 24"><path d="M6 5v14M20 5v14L9 12z"/></svg></button>
      <button type="button" class="pp" data-yc="${P.playing ? 'pauseVideo' : 'playVideo'}" ${P.cur ? '' : 'disabled'} aria-label="${esc(L(P.playing ? 'Pause' : 'Abspielen'))}" title="${esc(L(P.playing ? 'Pause' : 'Abspielen'))}"><svg viewBox="0 0 24 24">${P.playing ? '<path d="M8 5v14M16 5v14"/>' : '<path d="M7 4.5v15l13-7.5z"/>'}</svg></button>
      <button type="button" data-yc="nextVideo" ${P.isList ? '' : 'disabled'} aria-label="${esc(L('Nächster Titel'))}" title="${esc(L('Nächster Titel'))}"><svg viewBox="0 0 24 24"><path d="M18 5v14M4 5v14l11-7z"/></svg></button></div></div>`;
    n.querySelectorAll('[data-yc]').forEach(b => b.onclick = () => { cmd(b.dataset.yc); setTimeout(() => { cmd('getPlayerState'); }, 300); });
  }

  function paintList() {
    const box = page.querySelector('#ytmList'); if (!box) return; const l = list();
    box.innerHTML = l.length ? l.map((x, i) => `<div class="spi${x.url === P.cur ? ' on' : ''}"><button type="button" class="spn" data-yl="${i}">${esc(x.name)}</button><button type="button" class="spd" data-yd="${i}" aria-label="${esc(L('Entfernen'))}" title="${esc(L('Entfernen'))}">✕</button></div>`).join('') : `<small class="muted">${esc(L('Noch keine gespeicherten Titel oder Playlists.'))}</small>`;
    box.querySelectorAll('[data-yl]').forEach(b => b.onclick = () => load(list()[+b.dataset.yl].url));
    box.querySelectorAll('[data-yd]').forEach(b => b.onclick = () => { const a = list(); a.splice(+b.dataset.yd, 1); set('cloudy.ytmList', a); paintList(); });
  }
  function load(url) {
    const r = parse(url); const note = page.querySelector('#ytmMsg');
    if (!r) { if (note) note.textContent = L('Das ist kein YouTube- oder YouTube-Music-Link.'); return false; }
    P.cur = canon(r); set('cloudy.ytmCur', P.cur); P.title = P.author = P.vid = ''; P.playing = false; P.pos = P.dur = 0; P.isList = r.kind === 'list'; if (r.kind === 'video') P.vid = r.id;
    const h = page.querySelector('#ytmFrame'); if (h) h.innerHTML = `<iframe title="YouTube Music" src="${embed(r)}" width="100%" height="200" frameborder="0" allow="autoplay; encrypted-media; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
    if (note) note.textContent = ''; paintNow(); paintList(); tick();
    try { const m = document.getElementById('lgMute'); if (m && !m.classList.contains('off')) m.click(); } catch {} // Cloudy-Hintergrundmusik stummschalten
    return true;
  }
  function tick() {
    clearInterval(P.timer);
    P.timer = setInterval(() => { const f = frame(); if (f && f.contentWindow) f.contentWindow.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), '*'); paintNow(); }, 1000);
  }
  async function save() {
    const inp = page.querySelector('#ytmIn'), r = parse(inp.value); if (!r) { page.querySelector('#ytmMsg').textContent = L('Das ist kein YouTube- oder YouTube-Music-Link.'); return; }
    const url = canon(r), a = list(); inp.value = '';
    if (!a.some(x => x.url === url)) { let name = null; try { const t = await C().webTitle('https://www.youtube.com/' + (r.kind === 'list' ? 'playlist?list=' : 'watch?v=') + r.id); if (t && t.title) name = t.title; } catch {} a.unshift({ name: (r.kind === 'list' ? '☰ ' : '♪ ') + (name || (r.kind === 'list' ? 'Playlist' : 'Song')), url }); set('cloudy.ytmList', a.slice(0, 50)); }
    load(url);
  }
  function shell() {
    page.innerHTML = `<div class="sptitle"><h2 style="margin:0">YouTube Music</h2></div>
      <div class="glass ytm-now" id="ytmNow"></div>
      <div class="glass set"><div class="spin"><input id="ytmIn" class="field" autocomplete="off" spellcheck="false" placeholder="${esc(L('YouTube-Music-Link einfügen (Song oder Playlist)'))}"><button class="btn" id="ytmGo" type="button">${esc(L('Abspielen & speichern'))}</button></div>
        <p class="muted" id="ytmMsg" style="min-height:18px;color:var(--accent)"></p><div id="ytmList"></div></div>
      <div id="ytmFrame" class="glass ytm-frame"></div>
      <p class="muted ytm-note">${esc(L('Hinweis: YouTube Music bietet keine offizielle Schnittstelle zum Steuern von außen. Cloudy nutzt den offiziellen YouTube-Player; manche Titel (z. B. nur in YouTube Music verfügbare) lassen sich nicht einbetten.'))}</p>`;
    page.querySelector('#ytmGo').onclick = save; page.querySelector('#ytmIn').onkeydown = e => { if (e.key === 'Enter') save(); };
    paintNow(); paintList();
    if (P.cur && !frame()) load(P.cur);
  }
  let built = false;
  function show() { if (!built) { shell(); built = true; } else { paintNow(); paintList(); } }

  function setPlat(p) { plat = p; set('cloudy.musicPlat', p); paintBar(); if (window.go) window.go('spotify'); }
  bar.querySelectorAll('[data-plat]').forEach(b => b.onclick = () => { if (b.dataset.plat !== plat) setPlat(b.dataset.plat); });
  paintBar();

  const ps = window.paintSub;
  window.paintSub = p => {
    if (p === 'spotify' && plat === 'ytm') {
      if (ps) ps('ytm'); // Spotify-Seite abschalten (Abfragen stoppen)
      bar.hidden = false; show();
      setTimeout(() => { spRoot.classList.remove('on'); page.classList.add('on'); }, 0); // go() schaltet die Seiten erst nach paintSub um
    } else {
      if (ps) ps(p);
      bar.hidden = p !== 'spotify';
      if (p !== 'spotify') page.classList.remove('on');
    }
  };
  // Die Seite zeigt beim Wechsel zu YouTube Music direkt den Spotify-Schalter oben rechts
  window.addEventListener('cloudy-refresh', () => { if (page.classList.contains('on')) { paintNow(); paintList(); } });
})();
