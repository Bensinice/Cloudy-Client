// Cloudy-Freundesserver: kleiner HTTP-Server ohne Abhängigkeiten (Konten, Freundschaften, Chat). Einer hostet ihn, alle anderen verbinden sich.
const http = require('http'), fs = require('fs'), crypto = require('crypto');

exports.create = function create({ file }) {
  let db = {}; try { db = JSON.parse(fs.readFileSync(file, 'utf8')); } catch {}
  db.users = db.users || {}; db.msgs = db.msgs || {}; db.seq = db.seq || 1;
  let t = null; const save = () => { clearTimeout(t); t = setTimeout(() => { try { fs.writeFileSync(file, JSON.stringify(db)); } catch {} }, 300); };
  const sess = new Map(), key = n => String(n || '').toLowerCase(), pair = (a, b) => [key(a), key(b)].sort().join('|');
  const hash = (p, s) => crypto.scryptSync(String(p), s, 32).toString('hex');
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const NAME = /^[A-Za-z0-9_]{3,16}$/;

  async function handle(req, url, body) {
    const q = url.searchParams, p = url.pathname;
    if (p === '/ping') return { ok: true, cloudy: 'relay' };
    if (p === '/register' || p === '/login') {
      const name = String(body.name || '').trim(), k = key(name);
      if (p === '/register') {
        if (!NAME.test(name)) return [400, { error: 'Name: 3–16 Zeichen, nur Buchstaben, Zahlen und _.' }];
        if (String(body.pass || '').length < 6) return [400, { error: 'Das Passwort braucht mindestens 6 Zeichen.' }];
        if (db.users[k]) return [409, { error: 'Diesen Namen gibt es schon.' }];
        const salt = crypto.randomBytes(16).toString('hex');
        db.users[k] = { name, salt, hash: hash(body.pass, salt), friends: [], in: [], out: [], read: {}, seen: Date.now() }; save();
      } else {
        const u = db.users[k];
        if (!u || hash(body.pass, u.salt) !== u.hash) { await wait(600); return [401, { error: 'Name oder Passwort stimmt nicht.' }]; }
      }
      const token = crypto.randomBytes(24).toString('hex'); sess.set(token, k);
      return { ok: true, token, name: db.users[k].name };
    }
    const me = sess.get(req.headers['x-token']), u = me && db.users[me];
    if (!u) return [401, { error: 'Bitte neu anmelden.' }];
    u.seen = Date.now();
    const other = () => db.users[key(body.name)];
    const unread = f => (db.msgs[pair(u.name, f.name)] || []).filter(m => key(m.from) !== me && m.id > (u.read[key(f.name)] || 0)).length;
    if (p === '/state') {
      const f = x => db.users[key(x)];
      return { ok: true, me: u.name,
        friends: u.friends.map(f).filter(Boolean).map(x => ({ name: x.name, online: Date.now() - x.seen < 20000, unread: unread(x) })),
        incoming: u.in.map(f).filter(Boolean).map(x => x.name), outgoing: u.out.map(f).filter(Boolean).map(x => x.name) };
    }
    if (p === '/friend/add') {
      const o = other(); if (!o) return [404, { error: 'Spieler nicht gefunden.' }]; if (o === u) return [400, { error: 'Das bist du selbst.' }];
      if (u.friends.includes(key(o.name))) return { ok: true };
      if (u.in.includes(key(o.name))) { body.path = 'accept'; u.in = u.in.filter(x => x !== key(o.name)); o.out = o.out.filter(x => x !== me); u.friends.push(key(o.name)); o.friends.push(me); }
      else { if (!u.out.includes(key(o.name))) u.out.push(key(o.name)); if (!o.in.includes(me)) o.in.push(me); }
      save(); return { ok: true };
    }
    if (p === '/friend/accept') {
      const o = other(); if (!o || !u.in.includes(key(o.name))) return [404, { error: 'Keine Anfrage gefunden.' }];
      u.in = u.in.filter(x => x !== key(o.name)); o.out = o.out.filter(x => x !== me); u.friends.push(key(o.name)); o.friends.push(me); save(); return { ok: true };
    }
    if (p === '/friend/decline' || p === '/friend/remove') {
      const o = other(); if (!o) return { ok: true }; const k = key(o.name);
      for (const [a, b, ka, kb] of [[u, o, k, me], [o, u, me, k]]) { a.friends = a.friends.filter(x => x !== ka); a.in = a.in.filter(x => x !== ka); a.out = a.out.filter(x => x !== ka); }
      save(); return { ok: true };
    }
    if (p === '/msg') {
      const o = db.users[key(body.to)], text = String(body.text || '').trim().slice(0, 500);
      if (!o || !u.friends.includes(key(o.name))) return [403, { error: 'Ihr seid keine Freunde.' }]; if (!text) return [400, { error: 'Leere Nachricht.' }];
      const k = pair(u.name, o.name), l = db.msgs[k] = db.msgs[k] || []; const m = { id: db.seq++, from: u.name, text, t: Date.now() };
      l.push(m); if (l.length > 300) l.splice(0, l.length - 300); save(); return { ok: true, id: m.id };
    }
    if (p === '/msgs') {
      const o = db.users[key(q.get('with'))]; if (!o || !u.friends.includes(key(o.name))) return [403, { error: 'Ihr seid keine Freunde.' }];
      const after = +q.get('after') || 0, l = (db.msgs[pair(u.name, o.name)] || []).filter(m => m.id > after).slice(-100);
      const last = (db.msgs[pair(u.name, o.name)] || []).slice(-1)[0]; if (last) { u.read[key(o.name)] = last.id; save(); }
      return { ok: true, msgs: l };
    }
    return [404, { error: 'Unbekannt.' }];
  }

  const server = http.createServer((req, res) => {
    let data = ''; req.on('data', c => { data += c; if (data.length > 10000) req.destroy(); });
    req.on('end', async () => {
      let out;
      try { out = await handle(req, new URL(req.url, 'http://x'), data ? JSON.parse(data) : {}); } catch { out = [400, { error: 'Ungültige Anfrage.' }]; }
      const [code, obj] = Array.isArray(out) ? out : [200, out];
      res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj));
    });
  });
  return server;
};
