// Öffentlicher Server-Status mit echten Prüfungen: Konto-Server/Datenbank und (optional) ein Minecraft-Server per Server-List-Ping.
const net = require('net');
const vint = n => { const b = []; do { let x = n & 127; n >>>= 7; if (n) x |= 128; b.push(x); } while (n); return Buffer.from(b); };
const pstr = s => { const b = Buffer.from(s, 'utf8'); return Buffer.concat([vint(b.length), b]); };
const pkt = b => Buffer.concat([vint(b.length), b]);
function readVint(buf, o = 0) { let n = 0, s = 0, i = o; for (;;) { if (i >= buf.length) return null; const x = buf[i++]; n |= (x & 127) << s; if (!(x & 128)) break; s += 7; if (s > 35) return null; } return { n, len: i - o }; }
function mcPing(host, port = 25565, timeout = 4000) { // -> { online, players, max, version, motd, ms } oder { online:false, error }
  return new Promise(res => {
    const t0 = Date.now(); let done = false, buf = Buffer.alloc(0); const fin = r => { if (done) return; done = true; try { s.destroy(); } catch {} res(r); };
    const s = net.createConnection({ host, port }); s.setTimeout(timeout);
    s.on('connect', () => { const hs = Buffer.concat([vint(0), vint(767), pstr(host), Buffer.from([port >> 8, port & 255]), vint(1)]); s.write(Buffer.concat([pkt(hs), pkt(vint(0))])); });
    s.on('data', d => { buf = Buffer.concat([buf, d]); const l = readVint(buf); if (!l || buf.length < l.len + l.n) return;
      let o = l.len; const id = readVint(buf, o); if (!id || id.n !== 0) return fin({ online: false, error: 'Unerwartete Antwort' }); o += id.len;
      const sl = readVint(buf, o); if (!sl || buf.length < o + sl.len + sl.n) return; o += sl.len;
      try { const j = JSON.parse(buf.slice(o, o + sl.n).toString('utf8')); const m = j.description; fin({ online: true, players: (j.players && j.players.online) || 0, max: (j.players && j.players.max) || 0, version: (j.version && j.version.name) || '', motd: typeof m === 'string' ? m : (m && (m.text || (m.extra || []).map(x => x.text).join(''))) || '', ms: Date.now() - t0 }); }
      catch { fin({ online: false, error: 'Antwort nicht lesbar' }); } });
    s.on('timeout', () => fin({ online: false, error: 'Zeitüberschreitung' })); s.on('error', e => fin({ online: false, error: e.code || 'Fehler' }));
  });
}
// Zustand: { maintenance:{on,text}, mc:{host,port} } liegt in einer kleinen Datei; mc-Ergebnisse werden 15 s zwischengespeichert.
module.exports = ({ readCfg, writeCfg, checks, version }) => {
  let cache = null, cacheT = 0, lastMcOk = 0, busy = null;
  const cfg = () => { const c = readCfg() || {}; return { maintenance: { on: !!(c.maintenance && c.maintenance.on), text: String((c.maintenance && c.maintenance.text) || '').slice(0, 200) }, mc: c.mc && c.mc.host ? { host: String(c.mc.host).slice(0, 100), port: +c.mc.port || 25565 } : null }; };
  async function compute() {
    const c = cfg(), now = Date.now(); let db = false; try { db = !!(checks && checks.db && await checks.db()); } catch {}
    let mc = null; if (c.mc) { const r = await mcPing(c.mc.host, c.mc.port); if (r.online) lastMcOk = now; mc = { online: r.online, players: r.players || 0, max: r.max || 0, version: r.version || '', ms: r.ms || 0, lastOkAt: lastMcOk || 0 }; }
    return { api: true, db, status: c.maintenance.on ? 'maintenance' : db ? 'online' : 'degraded', maintenance: c.maintenance, accounts: { online: checks && checks.online ? checks.online() : 0 }, mc, version: version ? version() : '', checkedAt: now };
  }
  return {
    async get() { const now = Date.now(); if (cache && now - cacheT < 15000) return cache; if (!busy) busy = compute().then(r => { cache = r; cacheT = Date.now(); return r; }).finally(() => { busy = null; }); return busy; },
    set(patch) { const c = cfg(), n = { maintenance: c.maintenance, mc: c.mc };
      if (patch.maintenance) n.maintenance = { on: !!patch.maintenance.on, text: String(patch.maintenance.text || '').slice(0, 200) };
      if (patch.mc !== undefined) { const h = String((patch.mc && patch.mc.host) || '').trim(); if (!h) n.mc = null; else if (!/^[A-Za-z0-9._-]{1,100}$/.test(h)) return { ok: false, error: 'Ungültiger Host.' }; else n.mc = { host: h, port: Math.max(1, Math.min(65535, +patch.mc.port || 25565)) }; }
      writeCfg(n); cache = null; return { ok: true }; },
    cfg, mcPing,
  };
};
module.exports.mcPing = mcPing;
