// Cloudy – Spotify-Web-API (offiziell): Playlists, Songlisten, Lieblingssongs, zuletzt gehört, Wiedergabe, Lautstärke.
// Ohne Electron, damit man es testen kann: tok(force) liefert das Access-Token (oder null), fetchImpl ersetzt fetch.
// Stand der Spotify-Regeln (Februar 2026, Development Mode): Songs einer Playlist liefert Spotify nur für EIGENE oder GEMEINSAME Playlists
// (Feld heißt jetzt "items"/Endpunkt /items, alte Namen "tracks" werden mitgelesen). Wiedergabe steuern braucht Spotify Premium.
const BASE = 'https://api.spotify.com/v1';

module.exports = ({ tok, fetchImpl = (...a) => fetch(...a) }) => {
  let me = null;

  const why = (s, reason, what) => {
    reason = String(reason || '');
    if (s === 401) return 'Die Spotify-Anmeldung ist abgelaufen. Bitte unter Einstellungen → Spotify neu verbinden.';
    if (s === 403 && /PREMIUM/i.test(reason)) return 'Dafür braucht Spotify ein Premium-Konto. Ohne Premium kannst du Playlists ansehen, aber nicht von Cloudy aus abspielen.';
    if (s === 403 && /VOLUME/i.test(reason)) return 'Dieses Gerät erlaubt keine Lautstärke-Steuerung (z. B. manche Handys). Stelle sie am Gerät ein.';
    if (s === 403 && what === 'items') return 'Spotify gibt die Songs dieser Playlist nicht frei. Das geht nur bei eigenen oder gemeinsamen Playlists. Du kannst sie trotzdem abspielen.';
    if (s === 403) return 'Spotify lehnt das ab (403). Trage dein Spotify-Konto im Spotify-Dashboard unter „User Management“ ein und verbinde Spotify danach neu (neue Berechtigungen).';
    if (s === 404 && what === 'play') return 'Kein aktives Spotify-Gerät gefunden. Öffne die Spotify-App (am PC oder Handy), spiele kurz einen Song und versuche es nochmal.';
    if (s === 404) return 'Spotify kennt das nicht (mehr).';
    if (s === 429) return 'Spotify bremst gerade (zu viele Anfragen). Warte kurz und versuche es nochmal.';
    if (s === 0) return 'Keine Verbindung zu Spotify.';
    return 'Spotify-Fehler ' + s + (reason ? ' (' + reason + ')' : '') + '.';
  };

  async function req(method, path, { query, body, what } = {}, retry = true) {
    let t = await tok(); if (!t) return { ok: false, status: 401, error: why(401) };
    const url = BASE + path + (query ? '?' + new URLSearchParams(query) : '');
    let r;
    try { r = await fetchImpl(url, { method, headers: { Authorization: 'Bearer ' + t, ...(body !== undefined ? { 'Content-Type': 'application/json' } : (method === 'GET' ? {} : { 'Content-Length': '0' })) }, body: body !== undefined ? JSON.stringify(body) : undefined }); }
    catch { return { ok: false, status: 0, error: why(0) }; }
    if (r.status === 401 && retry) { t = await tok(true); if (t) return req(method, path, { query, body, what }, false); }
    if (r.status === 204 || (r.ok && method !== 'GET')) return { ok: true, status: r.status, data: null };
    let data = null; try { data = await r.json(); } catch {}
    if (r.ok) return { ok: true, status: r.status, data };
    const reason = data && data.error && (data.error.reason || data.error.message) || '';
    return { ok: false, status: r.status, reason, error: why(r.status, reason, what) };
  }

  async function meId() {
    if (me) return me;
    const r = await req('GET', '/me'); if (!r.ok) return r;
    me = r.data && r.data.id || ''; return me;
  }

  const imgOf = (imgs, small) => { imgs = Array.isArray(imgs) ? imgs : []; const i = small ? imgs[imgs.length - 1] : imgs[0]; return i && i.url || ''; };
  const names = a => (Array.isArray(a) ? a : []).map(x => x && x.name).filter(Boolean).join(', ');
  const mapTrack = tr => (!tr || tr.type !== 'track' || tr.is_local || !tr.uri) ? null
    : { uri: tr.uri, id: tr.id || '', name: String(tr.name || ''), artist: names(tr.artists), album: tr.album && tr.album.name || '', art: imgOf(tr.album && tr.album.images, true), dur: tr.duration_ms || 0 };

  async function playlists() {
    const id = await meId(); if (id && id.ok === false) return id;
    const out = []; let off = 0, total = Infinity;
    for (let page = 0; page < 10 && off < total; page++) {
      const r = await req('GET', '/me/playlists', { query: { limit: '50', offset: String(off) } }); if (!r.ok) return r;
      const d = r.data || {}; total = d.total || 0;
      for (const p of d.items || []) {
        if (!p || !p.id) continue;
        const cnt = p.items && p.items.total != null ? p.items.total : p.tracks && p.tracks.total != null ? p.tracks.total : null;
        out.push({ id: p.id, uri: p.uri || 'spotify:playlist:' + p.id, name: String(p.name || 'Playlist'), cover: imgOf(p.images), total: cnt, owner: p.owner && (p.owner.display_name || p.owner.id) || '', readable: !!(p.collaborative || (p.owner && p.owner.id === id)) });
      }
      off += 50; if (!(d.items || []).length) break;
    }
    return { ok: true, playlists: out };
  }

  // Songs einer Playlist; id "liked" = Lieblingssongs. Höchstens 500 Songs je Liste.
  async function tracks(plId) {
    const out = []; let off = 0, total = Infinity, kind = plId === 'liked' ? 'liked' : 'items';
    for (let page = 0; page < (kind === 'liked' ? 10 : 5) && off < total; page++) {
      const step = kind === 'liked' ? 50 : 100, q = { limit: String(step), offset: String(off) };
      let r = kind === 'liked' ? await req('GET', '/me/tracks', { query: q }) : await req('GET', '/playlists/' + encodeURIComponent(plId) + '/' + kind, { query: q, what: 'items' });
      if (!r.ok && kind === 'items' && (r.status === 400 || r.status === 404) && page === 0) { kind = 'tracks'; r = await req('GET', '/playlists/' + encodeURIComponent(plId) + '/tracks', { query: q, what: 'items' }); } // ältere API
      if (!r.ok) return r;
      const d = r.data || {}; total = d.total || 0;
      for (const x of d.items || []) { const t = mapTrack(x && (x.item || x.track)); if (t) out.push(t); }
      off += step; if (!(d.items || []).length) break;
    }
    return { ok: true, tracks: out, total: isFinite(total) ? total : out.length, truncated: isFinite(total) && total > off };
  }

  // Zuletzt gehörte Songs und die Playlists, aus denen sie kamen (Spotify hat keine eigene Liste „zuletzt gehörte Playlists“)
  async function recent() {
    const r = await req('GET', '/me/player/recently-played', { query: { limit: '50' } }); if (!r.ok) return r;
    const seen = new Set(), tr = [], pls = [];
    for (const it of (r.data && r.data.items) || []) {
      const t = mapTrack(it.track); if (t && !seen.has(t.uri)) { seen.add(t.uri); tr.push(t); }
      const c = it.context; if (c && c.type === 'playlist' && c.uri) { const id = c.uri.split(':').pop(); if (!pls.includes(id)) pls.push(id); }
    }
    return { ok: true, tracks: tr, playlistIds: pls };
  }

  // Abspielen: { context: 'spotify:playlist:…', uri } oder { uris: [...] }
  async function play(o) {
    o = o || {}; let body = {};
    if (o.context) { if (!/^spotify:(playlist|album|artist):[A-Za-z0-9]+$/.test(o.context)) return { ok: false, error: 'Ungültige Playlist.' }; body.context_uri = o.context; if (o.uri && /^spotify:track:[A-Za-z0-9]+$/.test(o.uri)) body.offset = { uri: o.uri }; }
    else if (Array.isArray(o.uris)) { const u = o.uris.filter(x => /^spotify:track:[A-Za-z0-9]+$/.test(x)).slice(0, 100); if (!u.length) return { ok: false, error: 'Kein Song ausgewählt.' }; body.uris = u; }
    else return { ok: false, error: 'Nichts zum Abspielen ausgewählt.' };
    let r = await req('PUT', '/me/player/play', { body, what: 'play' });
    if (!r.ok && r.status === 404) { // kein aktives Gerät: erstes (am liebsten aktives) Gerät nehmen
      const dv = await req('GET', '/me/player/devices');
      const d = dv.ok && dv.data && (dv.data.devices || []).find(x => x.is_active && !x.is_restricted) || dv.ok && dv.data && (dv.data.devices || []).find(x => !x.is_restricted);
      if (d) r = await req('PUT', '/me/player/play', { query: { device_id: d.id }, body, what: 'play' });
    }
    return r.ok ? { ok: true } : { ok: false, error: r.error };
  }

  async function volume(pct) {
    pct = Math.max(0, Math.min(100, Math.round(+pct)));
    if (!Number.isFinite(pct)) return { ok: false, error: 'Ungültige Lautstärke.' };
    const r = await req('PUT', '/me/player/volume', { query: { volume_percent: String(pct) }, what: 'play' });
    return r.ok ? { ok: true, volume: pct } : { ok: false, error: r.error };
  }

  async function player() { // Gerät, Lautstärke, Zufall – 204 = nichts aktiv
    const r = await req('GET', '/me/player'); if (!r.ok) return r;
    const d = r.data; if (!d) return { ok: true, active: false };
    return { ok: true, active: true, playing: !!d.is_playing, device: d.device ? { name: d.device.name || '', volume: d.device.volume_percent, canVolume: d.device.supports_volume !== false } : null };
  }

  return { playlists, tracks, recent, play, volume, player, why };
};
