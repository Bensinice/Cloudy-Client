// Server-Browser (Phase 5): öffentliche Server mit Spielerzahl, Ping, Version und „Freunde dort“ (Server-Reiter → Server-Browser)
(function () {
  const $ = s => document.querySelector(s), L = t => (window.t ? window.t(t) : t);
  const esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const box = $('#pubList'); if (!box || !window.cloudy || !window.cloudy.srvBrowse) return;
  const SRV = [
    ['Hypixel', 'mc.hypixel.net', 'Minispiele, SkyBlock, Bedwars', 'mini'], ['GommeHD', 'gommehd.net', 'Deutsch · Minispiele, Bedwars', 'de'], ['CubeCraft', 'play.cubecraft.net', 'Minispiele, Parkour', 'mini'],
    ['Wynncraft', 'play.wynncraft.com', 'MMORPG', 'rpg'], ['2b2t', '2b2t.org', 'Anarchie', 'surv'], ['Mineplex', 'us.mineplex.com', 'Minispiele', 'mini'], ['ManaCube', 'play.manacube.com', 'Skyblock, Parkour, Survival', 'surv'],
    ['Minemen Club', 'minemen.club', 'PvP-Training', 'pvp'], ['PvP Legacy', 'pvplegacy.net', 'PvP', 'pvp'], ['Complex Gaming', 'hub.mc-complex.com', 'Pixelmon, Survival', 'surv'], ['Griefergames', 'griefergames.net', 'Deutsch · Citybuild', 'de'], ['Rewinside', 'rewinside.tv', 'Deutsch · Minispiele', 'de']];
  const TAGS = [['all', 'Alle'], ['de', 'Deutsch'], ['mini', 'Minispiele'], ['pvp', 'PvP'], ['surv', 'Survival'], ['rpg', 'RPG']];
  let res = {}, friends = [], sort = 'players', tag = 'all', q = '', loading = false;
  const tab = document.querySelector('#srvTabs [data-ss="public"]'); if (tab) tab.textContent = '🌍 ' + L('Server-Browser');
  const hint = box.parentNode.querySelector('p.muted'); if (hint) hint.textContent = L('Live-Spielerzahl, Ping und Version der bekannten Server – und wo deine Freunde gerade spielen. Die meisten großen Server verlangen ein echtes Minecraft-Konto.');

  async function refresh(force) {
    if (loading) return; loading = true; paint();
    try { const r = await window.cloudy.srvBrowse(SRV.map(s => ({ host: s[1] }))); res = {}; for (const x of r || []) res[x.host] = x; } catch {}
    try { const f = await window.cloudy.frApi({ method: 'GET', path: '/state' }); friends = f && f.ok ? (f.data.friends || []).filter(x => x.server && x.server.kind === 'addr').map(x => ({ name: x.name, host: String(x.server.v).split(':')[0].toLowerCase() })) : []; } catch { friends = []; }
    loading = false; paint();
  }
  const there = h => friends.filter(f => f.host === h || f.host.endsWith('.' + h.split('.').slice(-2).join('.'))).map(f => f.name);
  function paint() {
    let L0 = SRV.filter(s => (tag === 'all' || s[3] === tag) && (!q || (s[0] + s[1] + s[2]).toLowerCase().includes(q)));
    const on = s => res[s[1]] && res[s[1]].ok;
    L0 = L0.sort((a, b) => (there(b[1]).length - there(a[1]).length) || (on(b) - on(a)) || (sort === 'ping' ? (on(a) ? res[a[1]].ping : 1e9) - (on(b) ? res[b[1]].ping : 1e9) : (on(b) ? res[b[1]].online : -1) - (on(a) ? res[a[1]].online : -1)));
    box.innerHTML = `<div class="sbbar"><div class="seg">${TAGS.map(([k, l]) => `<button class="${k === tag ? 'on' : ''}" data-sbt="${k}">${L(l)}</button>`).join('')}</div><input class="field" id="sbQ" placeholder="🔎 ${L('Server suchen …')}" value="${esc(q)}"><select class="field" id="sbSort"><option value="players" ${sort === 'players' ? 'selected' : ''}>${L('Meiste Spieler')}</option><option value="ping" ${sort === 'ping' ? 'selected' : ''}>${L('Bester Ping')}</option></select><button class="btn ghost" id="sbRe">${loading ? '…' : '⟳ ' + L('Aktualisieren')}</button></div>` +
      L0.map(s => { const r = res[s[1]], fr = there(s[1]), pc = r && r.ok ? (r.ping < 80 ? 'good' : r.ping < 160 ? 'mid' : 'bad') : '';
        return `<div class="glass sbrow">${r && r.icon ? `<img class="sbic" src="${r.icon}" alt="">` : `<span class="sbic sbph">${esc(s[0][0])}</span>`}<div class="sbinfo"><b>${esc(s[0])} <small class="muted">${esc(s[1])}</small></b><small class="muted">${esc(r && r.ok && r.motd ? r.motd : L(s[2]))}</small>${fr.length ? `<span class="sbfr">👥 ${L('Freunde dort')}: ${fr.map(esc).join(', ')}</span>` : ''}</div>
          <div class="sbstat">${!r ? `<small class="muted">${loading ? L('prüfe …') : ''}</small>` : r.ok ? `<b>${r.online.toLocaleString()}</b><small class="muted">/ ${r.max.toLocaleString()} ${L('Spieler')}</small><span class="sbping ${pc}">${r.ping} ms</span><small class="muted">${esc(r.version)}</small>` : `<small class="sboff">● ${L('nicht erreichbar')}</small>`}</div>
          <div class="sbbtn"><button class="btn" data-pj="${s[1]}">${L('Beitreten')}</button><button class="btn ghost" data-pa="${s[1]}" data-pn="${esc(s[0])}">${L('Zu meinen Servern')}</button></div></div>`; }).join('') + `<small class="muted">${L('Ping = Verbindungsaufbau von deinem PC. Werte werden 1 Minute zwischengespeichert.')}</small>`;
    box.querySelectorAll('[data-sbt]').forEach(b => b.onclick = () => { tag = b.dataset.sbt; paint(); });
    const qi = $('#sbQ'); if (qi) qi.oninput = () => { q = qi.value.toLowerCase().trim(); clearTimeout(qi._t); qi._t = setTimeout(() => { paint(); const n = $('#sbQ'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 200); };
    const so = $('#sbSort'); if (so) so.onchange = () => { sort = so.value; paint(); };
    const re = $('#sbRe'); if (re) re.onclick = () => refresh(true);
    box.querySelectorAll('[data-pj]').forEach(b => b.onclick = () => window.play && window.play({ name: b.dataset.pj, host: b.dataset.pj, port: 25565 }));
    box.querySelectorAll('[data-pa]').forEach(b => b.onclick = () => { try { window.addServer && window.addServer({ name: b.dataset.pn, host: b.dataset.pa, port: 25565 }); } catch {} b.textContent = L('Hinzugefügt ✓'); });
  }
  if (tab) tab.addEventListener('click', () => { if (!Object.keys(res).length) refresh(); });
  paint();
})();
