/* Extras: Zitate, Spotify-Player, Sound-Leiste im Dock, Spielzeit, Tastenkürzel */
(function () {
  const $ = s => document.querySelector(s), en = () => { try { return (localStorage.getItem('cloudy.lang') || document.documentElement.lang) !== 'de'; } catch { return false; } };
  const S = { get: (k, d) => { try { const v = localStorage.getItem('cloudy.x.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } }, set: (k, v) => { try { localStorage.setItem('cloudy.x.' + k, JSON.stringify(v)); } catch {} } };

  // ---- Zitate: neu bei jedem Start und jeden Tag ----
  const Q = [
    ['Jedes große Bauwerk beginnt mit einem einzelnen Block.', 'Every great build starts with a single block.'],
    ['Wer nachts nicht abbaut, schläft schlecht.', 'Who doesn’t mine at night, sleeps badly.'],
    ['Eine Fackel mehr, ein Creeper weniger.', 'One more torch, one less creeper.'],
    ['Der beste Plan hat immer einen Eimer Wasser dabei.', 'The best plan always carries a bucket of water.'],
    ['Diamanten liegen tiefer, als man denkt.', 'Diamonds are deeper than you think.'],
    ['Erst die Truhe sortieren, dann die Welt retten.', 'Sort the chest first, then save the world.'],
    ['Heute ist ein guter Tag für ein neues Projekt.', 'Today is a good day for a new project.'],
    ['Kleine Schritte, große Burgen.', 'Small steps, big castles.'],
    ['Auch der längste Tunnel hat ein Ende.', 'Even the longest tunnel has an end.'],
    ['Ein Bett in der Nähe macht jeden Ausflug mutiger.', 'A bed nearby makes every trip braver.'],
    ['Teile deine Welt, sie wird dadurch größer.', 'Share your world, it grows.'],
    ['Wer nicht speichert, baut zweimal.', 'Who doesn’t back up, builds twice.'],
    ['Die besten Geschichten passieren im Survival.', 'The best stories happen in survival.'],
    ['Mut ist, mit einer Holzaxt in die Höhle zu gehen.', 'Courage is entering the cave with a wooden axe.'],
    ['Heute wird gebaut, morgen wird gezeigt.', 'Build today, show off tomorrow.'],
    ['Ein Shader macht jeden Sonnenuntergang besser.', 'A shader makes every sunset better.'],
    ['Ruhe bewahren. Und Essen mitnehmen.', 'Stay calm. And bring food.'],
    ['Eine gute Farm arbeitet, während du schläfst.', 'A good farm works while you sleep.'],
    ['Neugier ist der beste Kompass.', 'Curiosity is the best compass.'],
    ['Lieber eine Stufe zu viel als ein Sturz zu wenig.', 'Better one step too many than one fall too few.'],
    ['Zusammen baut es sich schneller.', 'Building is faster together.'],
    ['Eine Wolke ist nur ein Block, der träumt.', 'A cloud is just a block that dreams.'],
    ['Heute: ein Dorf finden und nicht ausrauben.', 'Today: find a village and don’t raid it.'],
    ['Jeder Chunk erzählt etwas.', 'Every chunk tells a story.'],
    ['Gute Mods sind wie gute Freunde: leise und hilfreich.', 'Good mods are like good friends: quiet and helpful.']
  ];
  const day = () => new Date().toISOString().slice(0, 10);
  function pick(force) {
    let i = S.get('qi', -1);
    if (force || S.get('qd', '') !== day() || S.get('qs') !== window.__cloudySess) { let n; do { n = Math.floor(Math.random() * Q.length); } while (n === i && Q.length > 1); i = n; S.set('qi', i); S.set('qd', day()); S.set('qs', window.__cloudySess); }
    return i;
  }
  window.__cloudySess = window.__cloudySess || String(Date.now());
  let qi = -1;
  let PS = { ms: 0, last: 0, running: false, at: Date.now() };
  async function refreshPS() { try { let r = await window.cloudy.playStats(); if (!r.ms && S.get('playMs', 0) > 0) r = await window.cloudy.playSeed({ ms: S.get('playMs', 0), last: S.get('last', 0) }); PS = { ...r, at: Date.now() }; paintQ(); } catch {} }
  function stat() {
    const ms = PS.ms + (PS.running ? Date.now() - PS.at : 0), h = Math.floor(ms / 3600000), m = Math.floor(ms % 3600000 / 60000), last = PS.last || S.get('last', 0);
    const t = en() ? `${h} h ${m} min played` : `${h} Std ${m} Min gespielt`;
    let l = '';
    if (last) { const d = Math.floor((Date.now() - last) / 86400000); l = en() ? (d <= 0 ? 'last played today' : d === 1 ? 'last played yesterday' : `last played ${d} days ago`) : (d <= 0 ? 'zuletzt heute' : d === 1 ? 'zuletzt gestern' : `zuletzt vor ${d} Tagen`); }
    return ms > 0 ? t + (l ? ' · ' + l : '') : (en() ? 'No playtime yet' : 'Noch keine Spielzeit');
  }
  function paintQ() {
    const hero = $('.hero'); if (!hero) return;
    let box = $('#heroExtra');
    if (!box) {
      box = document.createElement('div'); box.id = 'heroExtra'; box.className = 'hx';
      box.innerHTML = '<p class="quote" id="heroQuote"></p><div class="hxr"><span class="hstat" id="heroStat"></span><button class="hxb" id="qNext" type="button"></button><button class="hxb" id="qFolder" type="button"></button></div>';
      const sub = $('#heroSub'); sub.parentNode.insertBefore(box, sub.nextSibling);
      $('#qNext').onclick = () => { qi = pick(true); paintQ(); };
      $('#qFolder').onclick = () => { try { window.cloudy.openFolder(); } catch {} };
    }
    if (qi < 0) qi = pick(false);
    $('#heroQuote').textContent = '“' + Q[qi][en() ? 1 : 0] + '”';
    $('#heroStat').textContent = stat();
    $('#qNext').textContent = en() ? '↻ New quote' : '↻ Neues Zitat';
    $('#qFolder').textContent = en() ? 'Open game folder' : 'Spielordner öffnen';
  }

  // ---- Spielzeit: kommt live aus dem Hauptprozess (playStats) ----
  setInterval(refreshPS, 20000); window.cloudy.on('gameStart', () => setTimeout(refreshPS, 1500)); window.cloudy.on('closed', () => setTimeout(refreshPS, 500));

  // ---- Sound-Leiste: Login-Bildschirm und Dock ----
  function placeBar() {
    const bar = $('#lgBar'), login = $('#login'), dock = $('.dock'); if (!bar || !login || !dock) return;
    const loggedIn = login.classList.contains('off');
    if (loggedIn && bar.parentNode !== dock) { dock.insertBefore(bar, $('#cancel')); bar.classList.add('indock'); }
    else if (!loggedIn && bar.parentNode !== login) { login.insertBefore(bar, login.firstChild); bar.classList.remove('indock'); }
  }

  // ---- Spotify: Mini-Player mit gespeicherten Playlists ----
  const SPOT = /open\.spotify\.com\/(?:intl-[a-z]+\/)?(playlist|album|track|artist|episode|show)\/([A-Za-z0-9]+)|spotify:(playlist|album|track|artist|episode|show):([A-Za-z0-9]+)/;
  const parse = v => { const m = SPOT.exec(String(v || '')); return m ? { type: m[1] || m[3], id: m[2] || m[4] } : null; };
  // YouTube / YouTube Music / SoundCloud
  const webParse = v => {
    v = String(v || '').trim(); let m;
    if ((m = /(?:youtube\.com\/watch\?(?:[^#]*&)?v=|youtu\.be\/)([\w-]{11})/.exec(v))) return { kind: 'yt', url: 'https://www.youtube.com/watch?v=' + m[1], src: 'https://www.youtube.com/embed/' + m[1] + '?enablejsapi=1&playsinline=1&rel=0', h: 220 };
    if ((m = /(?:youtube\.com\/playlist\?(?:[^#]*&)?list=)([\w-]+)/.exec(v))) return { kind: 'yt', url: 'https://www.youtube.com/playlist?list=' + m[1], src: 'https://www.youtube.com/embed/videoseries?list=' + m[1] + '&enablejsapi=1&playsinline=1', h: 220 };
    if ((m = /^https?:\/\/(?:www\.|m\.)?soundcloud\.com\/([\w-]+(?:\/[\w-]+(?:\/[\w-]+)?)?)\/?(?:[?#].*)?$/.exec(v)) && !/^(discover|stream|you|upload|pages|jobs|terms-of-use)(\/|$)/.test(m[1])) { const u = 'https://soundcloud.com/' + m[1]; return { kind: 'sc', url: u, src: 'https://w.soundcloud.com/player/?url=' + encodeURIComponent(u) + '&auto_play=false&show_comments=false&visual=false', h: 166 }; }
    return null;
  };
  // Meldet Titel und Position des laufenden Web-Players an Cloudy (für Lyrics)
  const webTrack = { w: null, title: '', artist: '', playing: false, pos: 0, t: 0, timer: 0 };
  const webReport = () => { try { if (webTrack.w && webTrack.title) window.cloudy.webReport({ title: webTrack.title, artist: webTrack.artist, playing: webTrack.playing, posMs: webTrack.pos * 1000 + (webTrack.playing ? Date.now() - webTrack.t : 0) }); else window.cloudy.webReport(null); } catch {} };
  window.addEventListener('message', ev => {
    const w = webTrack.w; if (!w) return; let d = ev.data;
    try {
      if (typeof d === 'string') d = JSON.parse(d); if (!d || typeof d !== 'object') return;
      if (/youtube\.com$/.test(new URL(ev.origin).hostname) && w.kind === 'yt') {
        const i = d.info || {};
        if (d.event === 'infoDelivery' || d.event === 'initialDelivery') {
          if (i.videoData && i.videoData.title) { webTrack.title = i.videoData.title; webTrack.artist = i.videoData.author || ''; }
          if (typeof i.currentTime === 'number') { webTrack.pos = i.currentTime; webTrack.t = Date.now(); }
          if (typeof i.playerState === 'number') webTrack.playing = i.playerState === 1;
          webReport();
        }
      } else if (/soundcloud\.com$/.test(new URL(ev.origin).hostname) && w.kind === 'sc') {
        if (d.method === 'ready') { const f = $('#spFrame iframe'); if (f && f.contentWindow) for (const k of ['play', 'pause', 'finish', 'playProgress']) f.contentWindow.postMessage(JSON.stringify({ method: 'addEventListener', value: k }), '*'); }
        else if (d.method === 'play') { webTrack.playing = true; webTrack.t = Date.now(); const f = $('#spFrame iframe'); if (f && f.contentWindow) f.contentWindow.postMessage(JSON.stringify({ method: 'getCurrentSound' }), '*'); }
        else if (d.method === 'pause' || d.method === 'finish') { webTrack.playing = false; }
        else if (d.method === 'playProgress' && d.value) { webTrack.pos = (d.value.currentPosition || 0) / 1000; webTrack.t = Date.now(); webTrack.playing = true; }
        else if (d.method === 'getCurrentSound' && d.value) { webTrack.title = d.value.title || webTrack.title; webTrack.artist = (d.value.user && d.value.user.username) || webTrack.artist; }
        webReport();
      }
    } catch {}
  });
  const webAttach = w => {
    clearInterval(webTrack.timer); webTrack.w = w; webTrack.title = webTrack.artist = ''; webTrack.playing = false; webTrack.pos = 0; webTrack.t = Date.now();
    if (!w) { webReport(); return; }
    try { window.cloudy.webTitle(w.url).then(r => { if (r && r.title && !webTrack.title) { webTrack.title = r.title; webTrack.artist = r.author || ''; } }).catch(() => {}); } catch {}
    webTrack.timer = setInterval(() => { // YouTube liefert erst Daten, wenn man „zuhört“
      const f = $('#spFrame iframe'); if (!f || !f.contentWindow) return;
      if (w.kind === 'yt') f.contentWindow.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), '*');
      webReport();
    }, 1000);
  };
  const urlOf = r => 'https://open.spotify.com/' + r.type + '/' + r.id;
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const DEFAULTS = [{ name: 'Today’s Top Hits (Beispiel)', url: 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M' }];
  const lst = () => { const l = S.get('spl', null); return Array.isArray(l) ? l : DEFAULTS; };
  function buildSpotify() {
    const bar = $('#lgBar'); if (!bar || $('#lgSp')) return;
    const b = document.createElement('button'); b.id = 'lgSp'; b.type = 'button'; b.title = 'Spotify'; b.setAttribute('aria-label', 'Spotify');
    b.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9.5"/><path d="M7 9.5c3.5-1 7-.7 10 1M7.5 12.8c3-.8 6-.5 8.5 1M8 16c2.4-.6 4.6-.4 6.6.7"/></svg>';
    bar.insertBefore(b, $('#lgMore'));
    const p = document.createElement('div'); p.id = 'spPanel'; p.className = 'sppanel'; p.hidden = true;
    p.innerHTML = '<div class="spnow" id="spNow"><div class="spart" id="spArt"></div><div class="spmeta"><b id="spT">–</b><small id="spA"></small></div></div><div class="spctl"><button type="button" data-mk="voldown" aria-label="Volume down"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M4 9v6h4l5 4V5L8 9zM16 9.5a4 4 0 0 1 0 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button><button type="button" data-mk="prev" aria-label="Previous"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h2v14H6zM20 5v14L9.5 12z"/></svg></button><button type="button" id="spPP" class="pp" data-mk="playpause" aria-label="Play/Pause"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l13-7.5z"/></svg></button><button type="button" data-mk="next" aria-label="Next"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M16 5h2v14h-2zM4 5v14l10.5-7z"/></svg></button><button type="button" data-mk="volup" aria-label="Volume up"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 4V5L7 9zM15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button></div><div class="spopt"><button type="button" id="spOptBg"></button><button type="button" id="spOptMu"></button></div><div class="splist" id="spList"></div><div class="spin"><input id="spIn" class="field" autocomplete="off" spellcheck="false"><button class="btn" id="spGo" type="button"></button></div><div id="spFrame"></div><div class="spft"><small class="muted" id="spNote"></small><button class="btn" id="spApp" type="button"></button></div>';
    document.body.appendChild(p);
    let cur = S.get('spc', '');
    const txt = () => { if (window.__spLab) window.__spLab(); $('#spIn').placeholder = en() ? 'Paste a link to save a playlist' : 'Link einfügen und Playlist speichern'; $('#spGo').textContent = en() ? 'Save' : 'Speichern'; $('#spApp').textContent = en() ? '▶ Play in Spotify app' : '▶ In Spotify-App abspielen'; $('#spNote').textContent = en() ? 'Full songs play in the Spotify app (the small player here is only a 30 s preview). Cloudy shows and controls them.' : 'Ganze Songs laufen in der Spotify-App (der kleine Player hier ist nur eine 30-s-Vorschau). Cloudy zeigt und steuert sie.'; };
    const paintList = () => {
      const l = lst(), box = $('#spList');
      box.innerHTML = l.length ? l.map((x, i) => `<div class="spi${x.url === cur ? ' on' : ''}" data-i="${i}"><button type="button" class="spn" data-l="${i}">${esc(x.name)}</button><button type="button" class="spd" data-d="${i}" aria-label="Remove" title="${en() ? 'Remove' : 'Entfernen'}">✕</button></div>`).join('') : `<small class="muted">${en() ? 'No saved playlists yet. Paste a link below.' : 'Noch keine Playlists gespeichert. Füge unten einen Link ein.'}</small>`;
      box.querySelectorAll('[data-l]').forEach(x => x.onclick = () => load(lst()[+x.dataset.l].url));
      box.querySelectorAll('[data-d]').forEach(x => x.onclick = () => { const a = lst().slice(); a.splice(+x.dataset.d, 1); S.set('spl', a); paintList(); });
    };
    const load = (link, quiet) => {
      const wp = webParse(link);
      if (wp) {
        cur = wp.url; S.set('spc', cur);
        $('#spFrame').innerHTML = `<iframe title="${wp.kind === 'yt' ? 'YouTube' : 'SoundCloud'}" src="${wp.src}" width="100%" height="${wp.h}" frameborder="0" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" style="border-radius:14px;border:0"></iframe>`;
        webAttach(wp); paintList(); if (!quiet) { const m = $('#lgMute'); if (m && !m.classList.contains('off')) m.click(); }
        return;
      }
      webAttach(null);
      const r = parse(link); if (!r) { $('#spNote').textContent = en() ? 'That is not a Spotify, YouTube or SoundCloud link.' : 'Das ist kein Spotify-, YouTube- oder SoundCloud-Link.'; return; }
      cur = urlOf(r); S.set('spc', cur);
      const h = /^(track|episode)$/.test(r.type) ? 152 : 352;
      $('#spFrame').innerHTML = `<iframe title="Spotify" src="https://open.spotify.com/embed/${r.type}/${r.id}?utm_source=generator&theme=0" width="100%" height="${h}" frameborder="0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" style="border-radius:14px;border:0"></iframe>`;
      paintList();
      if (!quiet) { const m = $('#lgMute'); if (m && !m.classList.contains('off')) m.click(); }
    };
    const save = async () => {
      const v = $('#spIn').value, wp = webParse(v);
      if (wp) {
        const a = lst().slice(); $('#spIn').value = '';
        if (!a.some(x => x.url === wp.url)) { let name = null; try { const t = await window.cloudy.webTitle(wp.url); if (t && t.title) name = t.title; } catch {} a.unshift({ name: (wp.kind === 'yt' ? '▶ ' : '☁ ') + (name || (wp.kind === 'yt' ? 'YouTube' : 'SoundCloud')), url: wp.url }); S.set('spl', a); }
        load(wp.url); return;
      }
      const r = parse(v); if (!r) { $('#spNote').textContent = en() ? 'That is not a Spotify, YouTube or SoundCloud link.' : 'Das ist kein Spotify-, YouTube- oder SoundCloud-Link.'; return; }
      const u = urlOf(r), a = lst().slice(); $('#spIn').value = '';
      if (!a.some(x => x.url === u)) {
        let name = null; try { name = await window.cloudy.spotifyTitle(u); if (typeof name !== 'string') name = null; } catch {}
        a.unshift({ name: name || (r.type[0].toUpperCase() + r.type.slice(1) + ' ' + r.id.slice(0, 6)), url: u }); S.set('spl', a);
      }
      load(u);
    };
    const open = () => { const wb = webParse(cur); if (wb) { try { window.cloudy.openExternal(wb.url); } catch {} return; } const r = parse(cur || $('#spIn').value); try { if (r) window.cloudy.openExternal('spotify:' + r.type + ':' + r.id); else window.cloudy.openExternal('https://open.spotify.com/'); } catch {} };
    b.onclick = e => { e.stopPropagation(); p.hidden = !p.hidden; if (!p.hidden) { txt(); paintList(); } };
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !p.hidden) p.hidden = true; });
    $('#spGo').onclick = save; $('#spApp').onclick = open;
    $('#spIn').onkeydown = e => { if (e.key === 'Enter') save(); };
  }


  // ---- Spotify-App: läuft der volle Song, zeigt Cloudy ihn an und der Hintergrund reagiert ----
  let np = { playing: false }, npT = 0, artK = '', artU = null;
  function bgLayer() {
    let m = $('#mBg'); if (m) return m;
    const sky = $('.sky'); if (!sky) return null;
    m = document.createElement('div'); m.id = 'mBg'; m.innerHTML = '<i></i><i></i><i></i><i></i><i></i><div id="mEq">' + '<b></b>'.repeat(32) + '</div>'; sky.appendChild(m); return m;
  }
  // Farbe des Songs: Durchschnitt der kräftigen Cover-Farben, sonst ein Ton aus dem Titel – wird mit dem Theme gemischt
  let colK = '';
  function songColor() {
    const k = np.art ? np.art.slice(-40) : 'h' + seed; if (k === colK) return; colK = k;
    const root = document.documentElement, fb = () => root.style.setProperty('--sc', `hsl(${seed} 80% 58%)`);
    if (!np.art) return fb();
    const im = new Image(); im.onload = () => { try { const c = document.createElement('canvas'); c.width = c.height = 16; const g = c.getContext('2d'); g.drawImage(im, 0, 0, 16, 16); const d = g.getImageData(0, 0, 16, 16).data; let r = 0, gg = 0, b = 0, w = 0; for (let i = 0; i < d.length; i += 4) { const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]), sat = mx ? (mx - mn) / mx : 0, wt = .1 + sat * sat * 4 + (mx > 60 ? 0 : -.1); if (wt <= 0) continue; r += d[i] * wt; gg += d[i + 1] * wt; b += d[i + 2] * wt; w += wt; } if (w) root.style.setProperty('--sc', `rgb(${Math.round(r / w)},${Math.round(gg / w)},${Math.round(b / w)})`); else fb(); } catch { fb(); } };
    im.onerror = fb; im.src = np.art;
  }
  // Beat-Simulation: Cloudy hört den Ton der Spotify-App nicht, deshalb läuft ein Rhythmus mit Tempo aus dem Songtitel
  let fr = 0, seed = 0, raf = 0, eqs = null, energy = .6, bt0 = 0;
  function startBeat() {
    if (raf) return; eqs = [...document.querySelectorAll('#mEq b')]; bt0 = performance.now();
    const root = document.documentElement;
    const frame = now => {
      if (!np.playing || document.hidden) { raf = 0; root.style.removeProperty('--beat'); root.style.removeProperty('--energy'); return; }
      const t = (now - bt0) / 1000, bpm = 84 + seed % 60, ph = t * bpm / 60, f = ph % 1;
      const kick = Math.pow(1 - f, 3), snare = Math.pow(1 - ((ph + .5) % 1), 6) * .5;
      energy += (0.45 + 0.4 * Math.sin(t / 7 + seed) + 0.15 * Math.sin(t / 2.3) - energy) * 0.02;
      const beat = Math.min(1, (kick * .8 + snare) * (.55 + energy * .6));
      root.style.setProperty('--beat', beat.toFixed(3)); root.style.setProperty('--energy', Math.max(0, Math.min(1, energy)).toFixed(3));
      if ((fr = (fr + 1) & 1) === 0) for (let i = 0; i < eqs.length; i++) { const w = .35 + .65 * Math.abs(Math.sin(t * (1.3 + (i % 7) * .37) + i * 1.9 + seed)); eqs[i].style.transform = 'scaleY(' + (.08 + w * (.25 + beat * .75) * (.5 + energy * .5)).toFixed(3) + ')'; }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && np.playing) startBeat(); });
  const hue = str => { let h = 0; for (const c of String(str)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h % 360; };
  function paintNow() {
    const m = bgLayer(); if (m) { document.documentElement.classList.toggle('music', !!np.playing && S.get('reactOn', true)); if (np.playing) { seed = hue(np.title + np.artist); songColor(); startBeat(); } }
    const t = $('#spT'); if (!t) return;
    $('#spT').textContent = np.playing ? np.title : (np.running ? (en() ? 'Paused' : 'Pausiert') : (en() ? 'Spotify app not running' : 'Spotify-App nicht gestartet'));
    $('#spA').textContent = np.playing ? np.artist : '';
    const art = $('#spArt'); art.style.backgroundImage = np.art ? `url("${np.art}")` : ''; art.classList.toggle('on', !!np.playing);
    $('#spNow').classList.toggle('isplay', !!np.playing); $('#spPP').innerHTML = np.playing ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>' : '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l13-7.5z"/></svg>';
    autoMute();
  }
  // Spotify läuft -> Launcher-Musik aus; Spotify pausiert -> Launcher-Musik wieder an
  let wasPlaying = false, weMuted = false;
  function autoMute() {
    const m = $('#lgMute'); if (!m) return;
    if (!S.get('muteOn', true)) { wasPlaying = !!np.playing; return; }
    if (np.playing && !wasPlaying) { if (!m.classList.contains('off')) { m.click(); weMuted = true; } }
    else if (!np.playing && wasPlaying && weMuted) { if (m.classList.contains('off')) m.click(); weMuted = false; }
    wasPlaying = !!np.playing;
  }
  let polling = false;
  async function pollNow() {
    if (polling) return; polling = true;
    try { await pollNow2(); } finally { polling = false; }
  }
  async function pollNow2() {
    try { const r = await window.cloudy.mediaNow(); np = r || { playing: false }; } catch { np = { playing: false }; }
    if (np.playing && !np.art) { const k = np.artist + '|' + np.title; if (artK !== k) { artK = k; artU = null; window.cloudy.mediaArt({ artist: np.artist, title: np.title }).then(u => { if (artK === k && typeof u === 'string') { artU = u; np.art = u; paintNow(); } }).catch(() => {}); } else if (artU) np.art = artU; }
    paintNow();
  }
  function startPoll() { // schnell (1 s), solange das Panel offen ist oder etwas läuft; sonst selten – jede Abfrage startet einen Prozess
    if (npT) return; npT = 1;
    const loop = async () => { if (!document.hidden) await pollNow(); const open = $('#spPanel') && !$('#spPanel').hidden; setTimeout(loop, open || np.playing ? 1000 : 5000); };
    loop();
  }
  function wireNow() {
    const lab = () => { $('#spOptBg').textContent = (S.get('reactOn', true) ? '● ' : '○ ') + (en() ? 'Reactive background' : 'Hintergrund reagiert'); $('#spOptMu').textContent = (S.get('muteOn', true) ? '● ' : '○ ') + (en() ? 'Mute launcher music' : 'Launcher-Musik aus'); $('#spOptBg').title = en() ? 'Background moves with the song' : 'Hintergrund bewegt sich zum Song'; $('#spOptMu').title = en() ? 'Mute launcher music while Spotify plays' : 'Launcher-Musik stummschalten, solange Spotify spielt'; };
    $('#spOptBg').onclick = () => { S.set('reactOn', !S.get('reactOn', true)); lab(); paintNow(); };
    $('#spOptMu').onclick = () => { S.set('muteOn', !S.get('muteOn', true)); lab(); };
    lab(); window.__spLab = lab;
    document.querySelectorAll('#spNow [data-mk]').forEach(b => b.onclick = async () => { const k = b.dataset.mk; if (k === 'playpause' && np.title) { np.playing = !np.playing; paintNow(); } try {
        const p = window.cloudy.mediaKey(k); setTimeout(pollNow, 250); setTimeout(pollNow, 700); const ok = await p;
        const note = $('#spNote');
        if (ok === false && note && k !== 'volup' && k !== 'voldown') { // Steuerung hat nicht geklappt: sagen, woran es liegt
          try { const sp = await window.cloudy.spotifyState(); if (sp && !sp.connected && sp.builtin) { note.textContent = en() ? 'Opening Spotify sign-in in your browser … confirm, then press the button again.' : 'Spotify-Anmeldung öffnet sich im Browser … bestätigen, dann den Knopf nochmal drücken.'; window.cloudy.spotifyConnect('').then(r => { note.textContent = r && r.ok ? (en() ? '✓ Spotify connected.' : '✓ Spotify verbunden.') : ((r && r.error) || ''); }); return; } if (sp && sp.last && sp.last.ok === false && sp.last.msg) { note.textContent = sp.last.msg; return; } } catch {}
          if (k === 'playpause' && np.title) { np.playing = !np.playing; paintNow(); }
          note.textContent = en() ? 'Control failed. Connect Spotify in Settings → Spotify (Premium needed). On Mac also allow Cloudy to control Spotify (System Settings → Privacy → Automation).' : 'Steuern hat nicht geklappt. Verbinde Spotify unter Einstellungen → Spotify (Premium nötig). Auf dem Mac erlaube Cloudy zusätzlich die Steuerung von Spotify (Systemeinstellungen → Datenschutz → Automation).';
        } else if (note && ok) note.textContent = '';
      } catch {} setTimeout(pollNow, 200); setTimeout(pollNow, 900); });
  }


  // ---- Eigene In-Game-Widgets (Text mit Platzhaltern, werden oben im Spiel angezeigt) ----
  const CW_KEY = 'cw', CW_HELP = '{fps} {ping} {x} {y} {z} {time} {player}';
  const cws = () => { const l = S.get(CW_KEY, null); return Array.isArray(l) ? l : [{ text: 'FPS {fps}', x: 2, on: true }, { text: '{x} {y} {z}', x: 14, on: true }]; };
  const pushCfg = () => { try { window.cloudy.clientCfg({ widgets: cws(), top: S.get('cwTop', true) }); } catch {} };
  function buildWidgets() {
    const page = $('#p-settings'); if (!page || $('#cwCard')) return;
    const card = document.createElement('div'); card.id = 'cwCard'; card.className = 'glass set';
    card.innerHTML = '<h3></h3><p class="muted" style="font-size:12px" id="cwHelp"></p><div id="cwList"></div><div class="spin"><input id="cwIn" class="field" maxlength="80" autocomplete="off" spellcheck="false"><button class="btn" id="cwAdd" type="button"></button></div><label class="cb" style="gap:8px;margin-top:8px"><input type="checkbox" id="cwTop"> <span id="cwTopL"></span></label>';
    (page.querySelector('.sgrid') || page).appendChild(card);
    const tx = () => { card.querySelector('h3').textContent = en() ? 'In-game widgets' : 'Widgets im Spiel'; $('#cwHelp').textContent = (en() ? 'Your own text widgets, shown at the top of the screen in Minecraft. Placeholders: ' : 'Eigene Text-Widgets, oben im Minecraft-Bild. Platzhalter: ') + CW_HELP; $('#cwIn').placeholder = en() ? 'e.g. Hi {player} – {fps} FPS' : 'z. B. Hi {player} – {fps} FPS'; $('#cwAdd').textContent = en() ? 'Add' : 'Hinzufügen'; $('#cwTopL').textContent = en() ? 'Show widgets at the top (scales with window size)' : 'Widgets oben anzeigen (passen sich der Fenstergröße an)'; };
    const paint = () => {
      tx(); $('#cwTop').checked = S.get('cwTop', true);
      $('#cwList').innerHTML = cws().map((w, i) => `<div class="spi"><label class="cb" style="gap:8px;flex:1;min-width:0"><input type="checkbox" data-t="${i}" ${w.on !== false ? 'checked' : ''}><span class="spn" style="cursor:default">${esc(w.text)}</span></label><button type="button" class="spd" data-d="${i}" aria-label="Remove">✕</button></div>`).join('');
      $('#cwList').querySelectorAll('[data-t]').forEach(b => b.onchange = () => { const a = cws().slice(); a[+b.dataset.t].on = b.checked; S.set(CW_KEY, a); pushCfg(); });
      $('#cwList').querySelectorAll('[data-d]').forEach(b => b.onclick = () => { const a = cws().slice(); a.splice(+b.dataset.d, 1); S.set(CW_KEY, a); pushCfg(); paint(); });
    };
    const add = () => { const v = $('#cwIn').value.trim(); if (!v) return; const a = cws().slice(); if (a.length >= 12) return; a.push({ text: v, x: 0, on: true }); S.set(CW_KEY, a); $('#cwIn').value = ''; pushCfg(); paint(); };
    $('#cwAdd').onclick = add; $('#cwIn').onkeydown = e => { if (e.key === 'Enter') add(); };
    $('#cwTop').onchange = e => { S.set('cwTop', e.target.checked); pushCfg(); };
    paint(); pushCfg(); card._paint = paint;
  }


  // ---- Leistung: Auto-Erkennung (zu wenige FPS -> weniger Weichzeichner), per Einstellung erzwingbar ----
  function perfApply(mode) { document.documentElement.classList.toggle('perf', mode === 'on'); }
  function perfMeasure() {
    const m = S.get('perf', 'auto'); if (m !== 'auto') return perfApply(m);
    let n = 0, t0 = 0, bad = 0; const f = t => { if (document.hidden) return; if (!t0) t0 = t; n++; if (t - t0 < 1500) return requestAnimationFrame(f); const ft = (t - t0) / n; if (ft > 28) { perfApply('on'); } else if (ft < 19) perfApply('off'); };
    requestAnimationFrame(f);
  }
  // ---- Spotify verbinden (für Lyrics im Spiel): Anmeldung mit eigener Spotify-App, damit Cloudy Titel und Position genau lesen kann ----
  async function buildSpLogin() {
    const page = $('#p-settings'); if (!page || $('#spLoginCard')) return;
    const card = document.createElement('div'); card.id = 'spLoginCard'; card.className = 'glass set';
    card.className = 'glass set wide';
    card.innerHTML = `<h3>Spotify verbinden <span class="spbadge" id="spBadge"></span></h3><p class="muted spintro">Cloudy liest deinen Song direkt von Spotify – für genaue Lyrics im Spiel, auch bei Skip und Pause.</p>
      <details class="spsteps" id="spSteps"><summary>Einmalig einrichten (4 Schritte)</summary><ol>
        <li>Auf <a href="#" id="spDev" style="font-weight:700;color:var(--accent)">developer.spotify.com/dashboard</a> eine App erstellen.</li>
        <li>Als Redirect-URI eintragen und mit „Add“ speichern: <span class="spcopy"><code id="spRedir"></code><button class="btn ghost" id="spCopy" type="button">Kopieren</button></span></li>
        <li>Bei <b>User Management</b> deinen Namen und die E-Mail deines Spotify-Kontos hinzufügen.</li>
        <li><b>Client ID</b> unten einfügen und anmelden.</li></ol>
        <p class="muted" style="font-size:12px;margin:6px 0 0">Für <b>/pause /resume /skip /prev</b> im Spiel einmal neu anmelden (Premium nötig, sonst nutzt Cloudy die Medientasten).</p></details>
      <div class="spin"><input id="spCid" class="field" placeholder="Client ID (32 Zeichen)" autocomplete="off" spellcheck="false"><div class="spbtns"><button class="btn" id="spConn">Mit Spotify anmelden</button><button class="btn ghost" id="lyTest" type="button">Lyrics testen</button><button class="btn ghost" id="spTest" style="display:none">Testen</button><button class="btn ghost" id="spOff" style="display:none">Trennen</button></div></div><p class="muted" id="spMsg" style="min-height:18px;margin:0"></p>`;
    (page.querySelector('.sgrid') || page).appendChild(card);
    const paint = async () => { const s = await window.cloudy.spotifyState(); if (s.builtin) { $('#spCid').style.display = 'none'; $('#spSteps').style.display = 'none'; } $('#spRedir').textContent = s.redirect; if (!$('#spCid').value) $('#spCid').value = s.clientId; $('#spConn').textContent = s.connected ? 'Erneut anmelden' : 'Mit Spotify anmelden'; $('#spOff').style.display = s.connected ? '' : 'none'; $('#spBadge').textContent = s.connected ? '✓ Verbunden' : 'Nicht verbunden'; $('#spBadge').classList.toggle('on', !!s.connected); if (s.connected) $('#spSteps').open = false; else if (!$('#spSteps')._t) { $('#spSteps').open = true; $('#spSteps')._t = 1; } $('#spTest').style.display = s.connected ? '' : 'none'; $('#spMsg').textContent = s.connected ? '✓ Verbunden. ' + ((s.last && s.last.msg) || 'Mit „Testen“ prüfst du, ob Spotify deinen Song liefert.') : 'Nicht verbunden (Cloudy nutzt dann das Spotify-Fenster, das ist ungenauer).'; };
    $('#spConn').onclick = async () => { $('#spMsg').textContent = 'Der Browser öffnet sich – bitte bei Spotify bestätigen …'; const r = await window.cloudy.spotifyConnect($('#spCid').value); if (!r.ok) $('#spMsg').textContent = r.error; else await paint(); };
    $('#spDev').onclick = e => { e.preventDefault(); window.cloudy.openExternal('https://developer.spotify.com/dashboard'); };
    $('#spCopy').onclick = async () => { try { await navigator.clipboard.writeText($('#spRedir').textContent); $('#spCopy').textContent = 'Kopiert ✓'; setTimeout(() => { $('#spCopy').textContent = 'Kopieren'; }, 1600); } catch {} };
    $('#lyTest').onclick = async () => { $('#spMsg').textContent = 'Teste Lyrics-Verbindung …'; try { const r = await window.cloudy.lyricsTest(); $('#spMsg').textContent = r.song + ' · ' + r.lines + ' Zeilen · Versuche: ' + r.tries + ' → ' + r.res.join(' | '); } catch (e) { $('#spMsg').textContent = String(e.message || e); } };
    $('#spTest').onclick = async () => { $('#spMsg').textContent = 'Teste …'; const r = await window.cloudy.spotifyTest(); $('#spMsg').textContent = (r.ok ? '✓ ' : '✗ ') + r.msg; };
    $('#spOff').onclick = async () => { await window.cloudy.spotifyDisconnect(); paint(); };
    paint();
  }

  function buildPerf() {
    const page = $('#p-settings'); if (!page || $('#perfCard')) return;
    const card = document.createElement('div'); card.id = 'perfCard'; card.className = 'glass set';
    card.innerHTML = '<h3></h3><p class="muted" style="font-size:12px" id="pfHelp"></p><select id="pfSel" class="field" style="width:auto"><option value="auto"></option><option value="on"></option><option value="off"></option></select>';
    (page.querySelector('.sgrid') || page).appendChild(card);
    const tx = () => { card.querySelector('h3').textContent = en() ? 'Performance' : 'Leistung'; $('#pfHelp').textContent = en() ? 'Reduces blur and animations when the launcher lags. Auto switches it on by itself.' : 'Verringert Weichzeichner und Animationen, wenn der Launcher ruckelt. „Automatisch“ schaltet es selbst ein.'; const o = $('#pfSel').options; o[0].textContent = en() ? 'Automatic' : 'Automatisch'; o[1].textContent = en() ? 'Performance mode on' : 'Leistungsmodus an'; o[2].textContent = en() ? 'Full effects' : 'Alle Effekte'; };
    tx(); $('#pfSel').value = S.get('perf', 'auto'); card._tx = tx;
    $('#pfSel').onchange = e => { S.set('perf', e.target.value); perfMeasure(); };
  }

  // ---- Debug-Menü (nur Admin, geprüft im Hauptprozess) ----
  let dbgT = 0;
  async function paintDebug() {
    const box = $('#dbgBody'); if (!box) return;
    let d = null; try { d = await window.cloudy.debugInfo(); } catch {}
    if (!d) return;
    const row = (k, v) => `<div class="dr"><span>${esc(k)}</span><code>${esc(v)}</code></div>`;
    box.innerHTML = row('Cloudy', d.app) + row('Electron / Chrome / Node', d.electron + ' / ' + d.chrome + ' / ' + d.node) + row('System', d.platform) + row('User', d.user || '–') + row('Java', d.java) +
      row('Instanzen', d.instances.join(', ') || '–') + row('Cache-Einträge', d.fast) + row('RAM (RSS / Heap)', d.rssMB + ' / ' + d.heapMB + ' MB') + row('Laufzeit', d.uptimeMin + ' min') + row('Minecraft / Server', (d.mc ? 'läuft' : '–') + ' / ' + (d.server ? 'läuft' : '–')) + row('Datenordner', d.userData) + row('Bibliotheken', d.libs) + row('Versionen', d.versionsDir) + row('Instanzen (Größe)', d.instSize) + row('Freier Speicher', d.freeGB + ' GB') + row('Client-Bau-Sperre', d.buildCooldown) + row('Umbenannte Shop-Items', d.names) +
      `<pre class="dlog">${esc(d.tail || (en() ? 'No Minecraft log yet.' : 'Noch kein Minecraft-Log.'))}</pre>`;
  }
  async function tryDebug() {
    const page = $('#p-settings'); if (!page) return;
    let d = null; try { d = await window.cloudy.debugInfo(); } catch {}
    let card = $('#dbgCard');
    if (!d) { if (card) card.remove(); clearInterval(dbgT); dbgT = 0; return; }
    if (!card) {
      card = document.createElement('div'); card.id = 'dbgCard'; card.className = 'glass set';
      card.innerHTML = '<h3>Debug <small class="muted">Admin</small></h3><div class="tools" style="margin:0 0 8px"><button class="btn" data-da="devtools">DevTools</button><button class="btn ghost" data-da="reload">UI neu laden</button><button class="btn ghost" data-da="openData">Datenordner</button><button class="btn ghost" data-da="openRoot">Spielordner</button><button class="btn ghost" data-da="clearCache">Cache leeren</button><button class="btn ghost" data-da="openInstances">Instanzen</button><button class="btn ghost" data-da="repairLibs">Bibliotheken prüfen</button><button class="btn ghost" data-da="resetBuild">Client-Bau freigeben</button><button class="btn ghost" data-da="killMc">Minecraft beenden</button><button class="btn ghost" data-da="killServer">Server beenden</button><button class="btn ghost" data-da="resetNames">Shop-Namen zurücksetzen</button><button class="btn ghost" data-da="clearLog">Log leeren</button><button class="btn ghost" data-da="copy">Bericht kopieren</button></div><div id="dbgBody"></div>';
      const g = page.querySelector('.sgrid') || page; g.appendChild(card);
      card.querySelectorAll('[data-da]').forEach(b => { const lab = b.textContent; b.onclick = async () => { try {
        if (b.dataset.da === 'copy') { const t = [...card.querySelectorAll('.dr')].map(r => r.children[0].textContent + ': ' + r.children[1].textContent).join('\n') + '\n\n' + (card.querySelector('.dlog') || {}).textContent; try { await navigator.clipboard.writeText(t); } catch {} b.textContent = '✓ kopiert'; }
        else { const r = await window.cloudy.debugAction(b.dataset.da); b.textContent = typeof r === 'string' ? '✓ ' + r : r ? '✓' : '✗'; if (b.dataset.da === 'clearLog' || b.dataset.da === 'repairLibs') paintDebug(); }
      } catch { b.textContent = '✗'; } setTimeout(() => { b.textContent = lab; }, 2200); }; });
    }
    paintDebug(); if (!dbgT) dbgT = setInterval(() => { if ($('#p-settings').classList.contains('on') || $('#p-settings').offsetParent) paintDebug(); }, 4000);
  }

  // ---- Tastenkürzel ----
  document.addEventListener('keydown', e => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey || $('#login') && !$('#login').classList.contains('off')) return;
    if (e.key === 'Enter') { const p = $('#play'); if (p && !p.disabled) { e.preventDefault(); p.click(); } return; }
    if (/^[1-9]$/.test(e.key)) { const navs = document.querySelectorAll('.nav[data-p]'), n = +e.key === 1 ? null : navs[+e.key - 2]; if (+e.key === 1) { if (window.go) { e.preventDefault(); window.go('home'); } } else if (n) { e.preventDefault(); n.click(); } }
  });

  function init() {
    placeBar(); buildSpotify(); buildPerf(); buildSpLogin(); refreshPS(); try { window.cloudy.clientCfg({ widgets: [] }); } catch {} perfMeasure(); wireNow(); startPoll(); paintQ(); tryDebug();
    document.querySelectorAll('.nav[data-p]').forEach(n => n.addEventListener('click', () => { setTimeout(tryDebug, 300); if (S.get('perf', 'auto') === 'auto') setTimeout(perfMeasure, 600); }));
    document.addEventListener('keydown', e => { if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'd') { e.preventDefault(); tryDebug().then(() => { const n = document.querySelector('.nav[data-p="settings"]'); if (n && $('#dbgCard')) n.click(); }); } });
    const pl = $('#play'); if (pl) pl.title = 'Ctrl+Enter';
    const login = $('#login'); if (login) new MutationObserver(placeBar).observe(login, { attributes: true, attributeFilter: ['class'] });
    document.addEventListener('click', e => { const p = $('#spPanel'); if (p && !p.hidden && !e.target.closest('#spPanel') && !e.target.closest('#lgBar')) p.hidden = true; });
    const sl = window.setLang; if (sl) window.setLang = function () { const r = sl.apply(this, arguments); try { paintQ(); const c = $('#cwCard'); if (c && c._paint) c._paint(); } catch {} return r; };
    document.addEventListener('visibilitychange', () => { if (!document.hidden && S.get('qd', '') !== day()) { qi = -1; paintQ(); } });
    setInterval(() => { if (S.get('qd', '') !== day()) { qi = -1; paintQ(); } }, 600000);
    if (window.onLoggedIn) { const o = window.onLoggedIn; window.onLoggedIn = function () { try { paintQ(); tryDebug(); } catch {} return o.apply(this, arguments); }; }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  // ---- Eigenes Icon: ersetzt das Wolken-Symbol oben links (Einstellungen → Darstellung) ----
  function brandIcon() {
    const br = $('.brand'); if (!br) return; const img = S.get('brandIcon', ''), svg = br.querySelector('svg'), cur = br.querySelector('img.bico');
    if (img) { if (svg) svg.style.display = 'none'; if (cur) cur.src = img; else { const i = document.createElement('img'); i.className = 'bico'; i.src = img; i.alt = ''; i.style.cssText = 'width:30px;height:30px;border-radius:8px;object-fit:cover;vertical-align:middle;margin-right:8px'; br.insertBefore(i, br.firstChild); } }
    else { if (svg) svg.style.display = ''; if (cur) cur.remove(); }
  }
  function brandUi() {
    const h = [...document.querySelectorAll('#p-settings h3')].find(x => /Darstellung|Appearance/.test(x.textContent)); if (!h || $('#biSet')) return;
    const row = document.createElement('div'); row.className = 'tools'; row.style.margin = '10px 0 0';
    row.innerHTML = `<button class="btn ghost" id="biSet">🖼 ${en() ? 'Custom icon' : 'Eigenes Icon'}</button><button class="btn ghost" id="biReset">${en() ? 'Reset icon' : 'Icon zurücksetzen'}</button>`;
    h.parentElement.appendChild(row);
    $('#biSet').onclick = () => { const f = document.createElement('input'); f.type = 'file'; f.accept = 'image/*'; f.onchange = () => { const file = f.files && f.files[0]; if (!file) return; const u = URL.createObjectURL(file), im = new Image(); im.onload = () => { const c = document.createElement('canvas'); c.width = c.height = 96; const g = c.getContext('2d'), r = Math.min(im.width, im.height); g.drawImage(im, (im.width - r) / 2, (im.height - r) / 2, r, r, 0, 0, 96, 96); URL.revokeObjectURL(u); S.set('brandIcon', c.toDataURL('image/png')); brandIcon(); }; im.src = u; }; f.click(); };
    $('#biReset').onclick = () => { S.set('brandIcon', ''); brandIcon(); };
  }
  brandIcon(); brandUi(); setTimeout(brandUi, 1500);

  // ---- Programm-Symbol in der Theme-Farbe (Taskleiste / Dock) ----
  let iconKey = '';
  function themedIcon() {
    try {
      if (!window.cloudy.setAppIcon) return;
      const cs = getComputedStyle(document.documentElement), c1 = (cs.getPropertyValue('--accent') || '').trim() || '#5aa2f5', c2 = (cs.getPropertyValue('--accent2') || '').trim() || c1;
      if (c1 + c2 === iconKey) return; iconKey = c1 + c2;
      const cv = document.createElement('canvas'); cv.width = cv.height = 256; const g = cv.getContext('2d');
      const r = 56, x = 8, y = 8, w = 240; g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + w, r); g.arcTo(x + w, y + w, x, y + w, r); g.arcTo(x, y + w, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
      const gr = g.createLinearGradient(0, 0, 256, 256); gr.addColorStop(0, c1); gr.addColorStop(1, c2); g.fillStyle = gr; g.fill();
      g.save(); g.translate(48, 56); g.scale(5, 5); g.fillStyle = '#fff'; g.fill(new Path2D('M9 24a6 6 0 0 1-.6-12A8 8 0 0 1 24 10a7 7 0 0 1-1 14z')); g.restore();
      window.cloudy.setAppIcon(cv.toDataURL('image/png'));
    } catch {}
  }
  setTimeout(themedIcon, 1500); setInterval(themedIcon, 4000);

  // ---- Cloudy deinstallieren (Einstellungen → Spielordner-Reihe) ----
  function uninstallUi() {
    const rj = $('#resetJava'); if (!rj || $('#uninst')) return;
    const b = document.createElement('button'); b.className = 'btn ghost'; b.id = 'uninst'; b.textContent = en() ? 'Uninstall Cloudy' : 'Cloudy deinstallieren'; rj.after(b);
    b.onclick = async () => {
      const info = await window.cloudy.uninstallInfo().catch(() => null);
      if (!info || !info.packaged) { alert(en() ? 'Not possible in development mode.' : 'Im Entwicklungsmodus nicht möglich.'); return; }
      if (!confirm(en() ? 'Really uninstall Cloudy? The program will be removed.' : 'Cloudy wirklich deinstallieren? Das Programm wird entfernt.')) return;
      const rd = confirm(en() ? 'Also delete all your data (accounts, skins, settings, game files)?\nOK = delete everything, Cancel = keep the data.' : 'Auch alle deine Daten löschen (Konten, Skins, Einstellungen, Spieldateien)?\nOK = alles löschen, Abbrechen = Daten behalten.');
      const r = await window.cloudy.uninstall({ removeData: rd }).catch(() => ({ ok: false, error: '?' }));
      if (!r.ok) alert(r.error || (en() ? 'Failed.' : 'Das hat nicht geklappt.'));
    };
  }
  uninstallUi(); setTimeout(uninstallUi, 1500);
})();
