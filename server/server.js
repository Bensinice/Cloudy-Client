// Cloudy-Konto-Server: speichert Konten zentral, damit der Admin alle Tester sehen kann. Keine Abhaengigkeiten (nur Node 18+).
const http = require('http'), fs = require('fs'), crypto = require('crypto'), path = require('path');
const PORT = +process.env.PORT || 8080;
const ADMIN_PASS = process.env.ADMIN_PASS; // Pflicht: Passwort des Admin-Kontos
if (!ADMIN_PASS || ADMIN_PASS.length < 8) { console.error('Setze ADMIN_PASS (mindestens 8 Zeichen), z. B.  ADMIN_PASS=meinGeheimesPasswort node server.js'); process.exit(1); }
const FILE = process.env.DATA_FILE || path.join(__dirname, 'accounts.json');
const hash = (pw, salt) => crypto.scryptSync(String(pw), salt, 64).toString('hex');
const mk = (name, pass, extra) => { const salt = crypto.randomBytes(16).toString('hex'); return { name, salt, hash: hash(pass, salt), created: Date.now(), coins: 100, owned: [], equip: {}, daily: '', ...extra }; };
let db = { users: {} }; try { db = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch {}
const save = () => fs.writeFileSync(FILE, JSON.stringify(db));
if (!db.users.admin) db.users.admin = mk('admin', ADMIN_PASS, { admin: true, coins: null });
else { const a = db.users.admin, h = hash(ADMIN_PASS, a.salt); if (h !== a.hash) Object.assign(a, mk('admin', ADMIN_PASS, { admin: true, coins: null })); }
if (!db.users.tester) db.users.tester = mk('Tester', '12345', { mustChange: true, coins: 100 });
if (!db.flags) db.flags = {};
if (!db.flags.noInf1) { db.flags.noInf1 = 1; const t = db.users.tester; if (t && t.infCoins) { t.infCoins = false; t.coins = 100; } }
save();
const sessions = new Map(); // token -> key
const tries = new Map();    // ip -> {n,t}
const ok = (u, p) => !!u && crypto.timingSafeEqual(Buffer.from(u.hash, 'hex'), Buffer.from(hash(p, u.salt), 'hex'));
const lockMsg = u => { if (!u || u.admin) return ''; if (u.paused) return 'Konto vorübergehend deaktiviert.'; if (u.banned && (!u.banUntil || u.banUntil > Date.now())) { const r = u.banReason ? ': ' + u.banReason : ''; if (!u.banUntil) return 'Konto dauerhaft gesperrt' + r; const m = Math.ceil((u.banUntil - Date.now()) / 60000); return 'Konto gesperrt für noch ' + (m >= 1440 ? Math.ceil(m / 1440) + ' Tag(e)' : m >= 60 ? Math.ceil(m / 60) + ' Std.' : m + ' Min.') + r; } if (u.banned && u.banUntil) { u.banned = false; u.banUntil = 0; save(); } return ''; };
if (!db.names) db.names = {};
if (!db.codes) db.codes = {};
if (!db.gate) db.gate = {};
if (!db.grants) db.grants = {};
if (!db.fr) db.fr = { f: {}, msgs: {}, seq: 1 };
const pub = u => ({ names: db.names, name: u.name, admin: !!u.admin, coins: u.admin || u.infCoins ? null : u.coins, mustChange: !!u.mustChange, state: { coins: u.admin || u.infCoins ? null : (u.coins == null ? 100 : u.coins), owned: u.owned || [], equip: u.equip || {}, daily: u.daily || '' } });
function body(req) { return new Promise(r => { let s = ''; req.on('data', d => { s += d; if (s.length > 1e5) req.destroy(); }); req.on('end', () => { try { r(JSON.parse(s || '{}')); } catch { r({}); } }); }); }
const send = (res, c, o) => { res.writeHead(c, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' }); res.end(JSON.stringify(o)); };
function limited(ip) { const t = tries.get(ip) || { n: 0, t: Date.now() }; if (Date.now() - t.t > 60000) { t.n = 0; t.t = Date.now(); } t.n++; tries.set(ip, t); return t.n > 10; }
const who = req => { const m = /^Bearer (.+)$/.exec(req.headers.authorization || ''); const k = m && sessions.get(m[1]); return k ? db.users[k] : null; };
const fk = (o, s) => { const u = String(s || '').trim().toUpperCase(); if (Object.prototype.hasOwnProperty.call(o, u)) return u; const n = u.replace(/[^A-Z0-9]/g, ''); return n ? (Object.keys(o).find(k => k.replace(/[^A-Z0-9]/g, '') === n) || u) : u; }; // Codes mit oder ohne Bindestriche, Groß-/Kleinschreibung egal
// ---- Freunde & Chat direkt über den Konto-Server (kein extra Freundesserver nötig) ----
const SEEN = new Map(); // Konto -> letzter Kontakt (für „online“)
const frPair = (a, b) => [a, b].sort().join('|');
async function frHandle(FR, p, me, myName, b, q, nameOf, save) {
  const key = n => String(n || '').trim().toLowerCase(), now = Date.now(); SEEN.set(me, now);
  const u = FR.f[me] = FR.f[me] || { friends: [], in: [], out: [], read: {} }, uf = k => FR.f[k] = FR.f[k] || { friends: [], in: [], out: [], read: {} };
  const online = k => now - (SEEN.get(k) || 0) < 45000;
  const unread = k => (FR.msgs[frPair(me, k)] || []).filter(m => m.fk !== me && m.id > (u.read[k] || 0)).length;
  if (p === 'state') {
    const out = { ok: true, me: myName, friends: [], incoming: [], outgoing: [] };
    for (const k of u.friends) { const n = await nameOf(k); if (n) out.friends.push({ name: n, online: online(k), unread: unread(k), av: (FR.av && FR.av[k]) || '' }); }
    for (const k of u.in) { const n = await nameOf(k); if (n) out.incoming.push(n); }
    for (const k of u.out) { const n = await nameOf(k); if (n) out.outgoing.push(n); }
    return [200, out];
  }
  if (p === 'avatar') { const img = String(b.img || ''); if (!/^data:image\/png;base64,[A-Za-z0-9+\/=]{20,6000}$/.test(img)) return [400, { error: 'Ungültiges Bild.' }]; FR.av = FR.av || {}; FR.av[me] = img; await save(); return [200, { ok: true }]; }
  if (p === 'friend/add' || p === 'friend/accept') {
    const ok = key(b.name), on = ok && await nameOf(ok); if (!on) return [404, { error: 'Spieler nicht gefunden.' }]; if (ok === me) return [400, { error: 'Das bist du selbst.' }];
    const o = uf(ok);
    if (u.friends.includes(ok)) return [200, { ok: true }];
    if (u.in.includes(ok)) { u.in = u.in.filter(x => x !== ok); o.out = o.out.filter(x => x !== me); u.friends.push(ok); o.friends.push(me); }
    else if (p === 'friend/accept') return [404, { error: 'Keine Anfrage gefunden.' }];
    else { if (!u.out.includes(ok)) u.out.push(ok); if (!o.in.includes(me)) o.in.push(me); }
    await save(); return [200, { ok: true }];
  }
  if (p === 'friend/decline' || p === 'friend/remove') {
    const ok = key(b.name), o = uf(ok);
    for (const [a, c, ka, kc] of [[u, o, ok, me], [o, u, me, ok]]) { a.friends = a.friends.filter(x => x !== ka); a.in = a.in.filter(x => x !== ka); a.out = a.out.filter(x => x !== ka); }
    await save(); return [200, { ok: true }];
  }
  if (p === 'msg') {
    const ok = key(b.to), text = String(b.text || '').trim().slice(0, 500);
    if (!u.friends.includes(ok)) return [403, { error: 'Ihr seid keine Freunde.' }]; if (!text) return [400, { error: 'Leere Nachricht.' }];
    const k = frPair(me, ok), l = FR.msgs[k] = FR.msgs[k] || [], m = { id: FR.seq++, from: myName, fk: me, text, t: now };
    l.push(m); if (l.length > 300) l.splice(0, l.length - 300); await save(); return [200, { ok: true, id: m.id }];
  }
  if (p === 'msgs') {
    const ok = key(b.with); if (!u.friends.includes(ok)) return [403, { error: 'Ihr seid keine Freunde.' }];
    const all = FR.msgs[frPair(me, ok)] || [], after = +b.after || 0, l = all.filter(m => m.id > after).slice(-100).map(({ id, from, text, t }) => ({ id, from, text, t })), last = all[all.length - 1];
    if (last && (u.read[ok] || 0) !== last.id) { u.read[ok] = last.id; await save(); }
    return [200, { ok: true, msgs: l }];
  }
  return [404, { error: 'Unbekannt.' }];
}
const RM = new Map(); // kürzlich entfernte Items je Konto (2 Minuten): ein veralteter Launcher darf sie nicht sofort wieder hochladen
const rmBlock = (key, ids) => { const m = RM.get(key); if (!m) return ids; const now = Date.now(); return ids.filter(x => !(m['*'] > now - 120000 || m[x] > now - 120000)); };
const gcode = v => typeof v === 'string' ? v : (v && v.c) || '';
function bindGrant(g, name) { g = String(g || ''); const v = db.grants[g]; if (v) { db.grants[g] = { c: gcode(v), u: String(name).toLowerCase() }; save(); } } // Zugang einem Konto zuordnen
function session(key) { const t = crypto.randomBytes(24).toString('hex'); sessions.set(t, key); return t; }

http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  const ip = String(req.headers['cf-connecting-ip'] || String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress), url = req.url.split('?')[0], b = req.method === 'POST' ? await body(req) : {};
  try {
    if (url === '/health') return send(res, 200, { ok: true });
    if (url === '/register' && req.method === 'POST') {
      if (limited(ip)) return send(res, 429, { error: 'Zu viele Versuche, warte kurz.' });
      const user = String(b.user || '').trim(), pass = String(b.pass || ''), key = user.toLowerCase();
      if (!/^[A-Za-z0-9_]{3,16}$/.test(user)) return send(res, 400, { error: 'Benutzername: 3–16 Zeichen, nur Buchstaben, Zahlen und _.' });
      if (pass.length < 6) return send(res, 400, { error: 'Das Passwort braucht mindestens 6 Zeichen.' });
      if (db.users[key]) return send(res, 409, { error: 'Diesen Benutzernamen gibt es schon.' });
      db.users[key] = mk(user, pass); save(); bindGrant(b.grant, user); return send(res, 200, { token: session(key), user: pub(db.users[key]) });
    }
    if (url === '/login' && req.method === 'POST') {
      if (limited(ip)) return send(res, 429, { error: 'Zu viele Versuche, warte kurz.' });
      const key = String(b.user || '').trim().toLowerCase(), u = db.users[key];
      if (!ok(u, b.pass)) return send(res, 401, { error: 'Benutzername oder Passwort stimmt nicht.' });
      { const lm = lockMsg(u); if (lm) return send(res, 403, { error: lm }); }
      bindGrant(b.grant, u.name); return send(res, 200, { token: session(key), user: pub(u) });
    }
    if (url === '/gate' && req.method === 'POST') { // Zugangscode des Launchers prüfen (vor der Anmeldung)
      if (limited(ip)) return send(res, 429, { error: 'Zu viele Versuche, warte kurz.' });
      const code = fk(db.gate, b.code), c = db.gate[code], legacy = Object.keys(db.gate).length === 0;
      if (c && (!c.exp || c.exp > Date.now()) && (!c.uses || (c.used || 0) < c.uses)) { c.used = (c.used || 0) + 1; const grant = crypto.randomBytes(12).toString('hex'); db.grants[grant] = code; save(); return send(res, 200, { ok: true, grant }); }
      return send(res, 200, { ok: false, legacy, error: c ? (c.exp && c.exp <= Date.now() ? 'Dieser Zugangscode ist abgelaufen.' : 'Dieser Zugangscode ist aufgebraucht.') : '' });
    }
    if (url === '/gatecheck' && req.method === 'POST') return send(res, 200, { ok: !!db.grants[String(b.grant || '')] }); // Zugang noch gültig? (wird nach dem Entziehen false)
    const me = who(req); if (!me) return send(res, 401, { error: 'Nicht angemeldet.' });
    { const lm = lockMsg(me); if (lm) return send(res, 403, { error: lm }); }
    if (url === '/me') { SEEN.set(me.name.toLowerCase(), Date.now()); return send(res, 200, { user: pub(me) }); }
    if (url.startsWith('/fr/')) { const r = await frHandle(db.fr, url.slice(4), me.name.toLowerCase(), me.name, b, null, async k => (db.users[k] || {}).name || '', async () => save()); return send(res, r[0], r[1]); }
    if (url === '/password' && req.method === 'POST') {
      const p = String(b.pass || ''); if (p.length < 6 || p === '12345') return send(res, 400, { error: 'Mindestens 6 Zeichen, nicht 12345.' });
      Object.assign(me, mk(me.name, p, { admin: me.admin, infCoins: me.infCoins, coins: me.coins, mustChange: false, created: me.created })); save(); return send(res, 200, { ok: true });
    }
    if (url === '/state' && req.method === 'POST') { // Shop-Stand des Kontos speichern (Coins, gekaufte Items, Auswahl)
      if (me.admin) return send(res, 200, { ok: true });
      if (!me.infCoins && Number.isFinite(+b.coins)) me.coins = Math.max(0, Math.min(1e9, Math.round(+b.coins)));
      if (Array.isArray(b.owned)) me.owned = [...new Set([...(me.owned || []), ...rmBlock(me.name.toLowerCase(), b.owned.filter(x => typeof x === 'string'))])].slice(0, 500); // nur hinzufügen: Entfernen/Verschenken passiert nur auf dem Server
      if (b.equip && typeof b.equip === 'object') me.equip = Object.fromEntries(Object.entries(b.equip).filter(([k, v]) => typeof v === 'string').slice(0, 20));
      if (typeof b.daily === 'string') me.daily = b.daily.slice(0, 20);
      save(); return send(res, 200, { ok: true });
    }
    if (url === '/gift' && req.method === 'POST') { // Item verschenken
      if (me.admin) return send(res, 400, { error: 'Admins besitzen schon alles.' });
      const to = db.users[String(b.to || '').trim().toLowerCase()], id = String(b.id || '');
      if (!to || to.admin) return send(res, 404, { error: 'Dieses Konto gibt es nicht.' });
      if (to === me) return send(res, 400, { error: 'Du kannst dir nichts selbst schenken.' });
      if (!(me.owned || []).includes(id)) return send(res, 400, { error: 'Das besitzt du nicht.' });
      if ((to.owned || []).includes(id)) return send(res, 409, { error: to.name + ' besitzt das schon.' });
      me.owned = me.owned.filter(x => x !== id); for (const k of Object.keys(me.equip || {})) if (me.equip[k] === id) delete me.equip[k];
      to.owned = [...(to.owned || []), id]; save(); return send(res, 200, { ok: true, to: to.name });
    }
    if (url === '/redeem' && req.method === 'POST') { // Code einlösen
      if (limited(ip)) return send(res, 429, { error: 'Zu viele Versuche, warte kurz.' });
      if (me.admin) return send(res, 400, { error: 'Admins brauchen keine Codes.' });
      const code = fk(db.codes, b.code), c = db.codes[code];
      if (!c) return send(res, 404, { error: 'Diesen Code gibt es nicht.' });
      c.used = c.used || [];
      if (c.used.includes(me.name.toLowerCase())) return send(res, 409, { error: 'Diesen Code hast du schon eingelöst.' });
      if (c.exp && c.exp < Date.now()) return send(res, 410, { error: 'Dieser Code ist abgelaufen.' });
      if (c.uses > 0 && c.used.length >= c.uses) return send(res, 410, { error: 'Dieser Code ist aufgebraucht.' });
      let coins = 0; if (c.coins > 0 && !me.infCoins) { me.coins = Math.min(1e9, (me.coins == null ? 100 : me.coins) + c.coins); coins = c.coins; }
      const newItems = (c.items || []).filter(i => !(me.owned || []).includes(i)); me.owned = [...(me.owned || []), ...newItems];
      c.used.push(me.name.toLowerCase()); save(); return send(res, 200, { ok: true, coins, items: newItems, skipped: (c.items || []).length - newItems.length });
    }
    if (url === '/announce') return send(res, 200, db.announce || { text: '', t: 0 });
    if (!me.admin) return send(res, 403, { error: 'Nur für Admins.' });
    if (url === '/admin/announce') { db.announce = { text: String(b.text || '').trim().slice(0, 300), t: b.text ? Date.now() : 0 }; save(); return send(res, 200, { ok: true, ...db.announce }); }
    if (url === '/admin/stats') { const us = Object.values(db.users).filter(u => !u.admin), now = Date.now(); return send(res, 200, { users: us.length, online: us.filter(u => now - (SEEN.get(u.name.toLowerCase()) || 0) < 120000).length, banned: us.filter(u => u.banned && (!u.banUntil || u.banUntil > now)).length, paused: us.filter(u => u.paused).length, coins: us.reduce((a, u) => a + (u.infCoins || u.coins == null ? 0 : u.coins), 0), items: us.reduce((a, u) => a + (u.owned || []).length, 0), codes: Object.keys(db.codes).length, gate: Object.keys(db.gate).length, new7: us.filter(u => now - (u.created || 0) < 7 * 864e5).length, announce: db.announce || { text: '', t: 0 } }); }
    if (url === '/admin/users') return send(res, 200, { users: Object.values(db.users).filter(u => !u.admin).map(u => ({ name: u.name, coins: u.infCoins ? '∞' : (u.coins == null ? 100 : u.coins), owned: (u.owned || []).length, inf: !!u.infCoins, banned: !!u.banned && (!u.banUntil || u.banUntil > Date.now()), until: u.banUntil || 0, paused: !!u.paused, items: u.owned || [], reason: u.banReason || '', created: u.created, gate: (Object.values(db.grants).find(v => v && v.u === u.name.toLowerCase()) || {}).c || '' })) });
    if (url === '/admin/shopname') { const id = String(b.id || '').slice(0, 40), v = String(b.name || '').trim().slice(0, 40); if (!id) return send(res, 400, { error: 'id fehlt' }); if (v) db.names[id] = v; else delete db.names[id]; save(); return send(res, 200, { ok: true }); }
    if (url === '/admin/codes') return send(res, 200, { codes: Object.entries(db.codes).map(([code, c]) => ({ code, coins: c.coins || 0, items: c.items || [], uses: c.uses || 0, used: (c.used || []).length, exp: c.exp || 0 })) });
    if (url === '/admin/codecreate') {
      let code = String(b.code || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 24); if (!code) code = (()=>{const A='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let s='';for(const b of crypto.randomBytes(12))s+=A[b%A.length];return s.replace(/(.{4})(?=.)/g,'$1-')})();
      if (db.codes[code]) return send(res, 409, { error: 'Diesen Code gibt es schon.' });
      const coins = Math.max(0, Math.min(1e6, Math.round(+b.coins || 0))), items = (Array.isArray(b.items) ? b.items : []).filter(x => typeof x === 'string').slice(0, 30);
      if (!coins && !items.length) return send(res, 400, { error: 'Der Code braucht Coins oder Items.' });
      const exp = Math.round(+b.exp || 0); if (exp && exp < Date.now()) return send(res, 400, { error: 'Das Ablaufdatum liegt in der Vergangenheit.' });
      db.codes[code] = { coins, items, uses: Math.max(0, Math.min(1e6, Math.round(+b.uses || 0))), used: [], exp: exp ? Math.min(exp, Date.now() + 3650 * 864e5) : 0 }; save(); return send(res, 200, { ok: true, code });
    }
    if (url === '/admin/gatecodes') return send(res, 200, { codes: Object.entries(db.gate).map(([code, c]) => ({ code, uses: c.uses || 0, used: c.used || 0, exp: c.exp || 0, active: Object.values(db.grants).filter(x => gcode(x) === code).length })) });
    if (url === '/admin/gatecreate') {
      let code = String(b.code || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 24); if (!code) code = (()=>{const A='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let s='';for(const b of crypto.randomBytes(12))s+=A[b%A.length];return s.replace(/(.{4})(?=.)/g,'$1-')})();
      if (db.gate[code]) return send(res, 409, { error: 'Diesen Zugangscode gibt es schon.' });
      const days = Math.max(0, Math.min(3650, Math.round(+b.days || 0)));
      db.gate[code] = { uses: Math.max(0, Math.min(1e6, Math.round(+b.uses || 0))), used: 0, exp: days ? Date.now() + days * 864e5 : 0 }; save(); return send(res, 200, { ok: true, code });
    }
    if (url === '/admin/gaterevokeuser') { const k = String(b.name || '').trim().toLowerCase(); let n = 0; for (const g in db.grants) if (db.grants[g] && db.grants[g].u === k) { delete db.grants[g]; n++; } save(); return send(res, 200, { ok: true, revoked: n }); }
    if (url === '/admin/gatedelete') { const gc = fk(db.gate, b.code); delete db.gate[gc]; let n = 0; if (b.revoke) for (const g in db.grants) if (gcode(db.grants[g]) === gc) { delete db.grants[g]; n++; } save(); return send(res, 200, { ok: true, revoked: n }); }
    if (url === '/admin/codedelete') { delete db.codes[fk(db.codes, b.code)]; save(); return send(res, 200, { ok: true }); }
    const t = db.users[String(b.name || '').toLowerCase()];
    if (!t || t.admin) return send(res, 404, { error: 'Konto nicht gefunden.' });
    if (url === '/admin/additem') { const id = String(b.id || ''); if (!id) return send(res, 400, { error: 'id fehlt' }); if (!(t.owned || []).includes(id)) t.owned = [...(t.owned || []), id]; save(); return send(res, 200, { ok: true }); }
    if (url === '/admin/inf') { if (b.on) { t.infCoins = true; t.coins = null; } else { t.infCoins = false; t.coins = 100; } save(); return send(res, 200, { ok: true }); }
    if (url === '/admin/pause') { t.paused = !!b.paused; save(); return send(res, 200, { ok: true }); }
    if (url === '/admin/removeitem') { { const k = t.name.toLowerCase(), m = RM.get(k) || {}; m[b.all ? '*' : String(b.id || '')] = Date.now(); RM.set(k, m); } if (b.all) { t.owned = []; t.equip = {}; } else { const id = String(b.id || ''); t.owned = (t.owned || []).filter(x => x !== id); for (const k of Object.keys(t.equip || {})) if (t.equip[k] === id) delete t.equip[k]; } save(); return send(res, 200, { ok: true }); }
    if (url === '/admin/ban') { t.banUntil = b.banned && +b.until > Date.now() ? Math.round(+b.until) : 0; t.banned = !!b.banned; t.banReason = String(b.reason || '').slice(0, 80); save(); return send(res, 200, { ok: true }); }
    if (url === '/admin/coins') { t.coins = Math.max(0, Math.min(1e9, Math.round(+b.amount || 0))); save(); return send(res, 200, { ok: true }); }
    if (url === '/admin/grant') { if (!t.infCoins) t.coins = Math.max(0, Math.min(1e9, (t.coins == null ? 100 : t.coins) + (parseInt(b.amount, 10) || 0))); save(); return send(res, 200, { ok: true }); }
    if (url === '/admin/reset') { Object.assign(t, mk(t.name, '12345', { mustChange: true, infCoins: t.infCoins, coins: t.coins })); save(); return send(res, 200, { ok: true }); }
    if (url === '/admin/delete') { delete db.users[t.name.toLowerCase()]; save(); return send(res, 200, { ok: true }); }
    send(res, 404, { error: 'Unbekannt.' });
  } catch (e) { send(res, 500, { error: 'Serverfehler.' }); }
}).listen(PORT, () => console.log('Cloudy-Server läuft auf Port ' + PORT));
