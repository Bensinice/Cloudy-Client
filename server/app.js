// Cloudy-Konto-Server mit MySQL (gleiche Schnittstelle wie der Datei-Server: /register /login /me /password /admin/*)
// Cloudy-Server (app.js). Trage unten dein NEUES Datenbank-Passwort ein (das alte wurde im Chat gezeigt, bitte beim Hoster ändern).
// Benötigt: npm install express mysql2 cors
const express = require('express'), mysql = require('mysql2/promise'), cors = require('cors'), crypto = require('crypto');
const PORT = +process.env.PORT || 3364;
const DB_PASS = process.env.DB_PASS || 'HIER_NEUES_DB_PASSWORT';
const ADMIN_PASS = process.env.ADMIN_PASS || 'adminonlyacc';
if (!ADMIN_PASS || ADMIN_PASS.length < 8) { console.error('Setze ADMIN_PASS (mind. 8 Zeichen).'); process.exit(1); }
const db = mysql.createPool({ host: process.env.DB_HOST || '127.0.0.1', user: process.env.DB_USER || 'CloudyClient', password: DB_PASS, database: process.env.DB_NAME || 'CloudyClient', waitForConnections: true, connectionLimit: 10 });
const hash = (pw, salt) => crypto.scryptSync(String(pw), salt, 64).toString('hex');
const mk = (name, pass, x) => { const salt = crypto.randomBytes(16).toString('hex'); return { name, salt, hash: hash(pass, salt), created: Date.now(), coins: 100, inf_coins: 0, admin: 0, must_change: 0, banned: 0, ban_reason: '', ban_until: 0, paused: 0, owned: '[]', equip: '{}', daily: '', ...x }; };
const COLS = ['name', 'salt', 'hash', 'created', 'coins', 'inf_coins', 'admin', 'must_change', 'banned', 'ban_reason', 'ban_until', 'paused', 'owned', 'equip', 'daily'];
const js = v => typeof v === 'string' ? v : JSON.stringify(v);
const parse = (v, d) => { try { const j = JSON.parse(v); return j == null ? d : j; } catch { return d; } };
async function put(u) { const key = u.name.toLowerCase(); await db.query(`REPLACE INTO cloudy_users (name_key,${COLS.join(',')}) VALUES (?${',?'.repeat(COLS.length)})`, [key, ...COLS.map(c => (c === 'owned' || c === 'equip') ? js(u[c] == null ? (c === 'owned' ? [] : {}) : u[c]) : (c === 'daily' ? (u[c] || '') : (c === 'ban_until' || c === 'paused') ? (u[c] || 0) : u[c]))]); }
async function get(key) { const [r] = await db.query('SELECT * FROM cloudy_users WHERE name_key=?', [key]); return r[0] || null; }
let TAGS = {}, ANN = { text: '', t: 0 }, NAMES = {}, PRICES = {}, CODES = {}, GATE = {}, GRANTS = {}, FR = { f: {}, msgs: {}, seq: 1 };
const gcode = v => typeof v === 'string' ? v : (v && v.c) || '';
const saveGate = async () => { await db.query('REPLACE INTO cloudy_kv (k,v) VALUES (?,?)', ['gate', JSON.stringify(GATE)]); await db.query('REPLACE INTO cloudy_kv (k,v) VALUES (?,?)', ['gategrants', JSON.stringify(GRANTS)]); };
let frT = null; const saveFr = async () => { clearTimeout(frT); frT = setTimeout(() => { db.query('REPLACE INTO cloudy_kv (k,v) VALUES (?,?)', ['friends', JSON.stringify(FR)]).catch(() => {}); }, 400); };
const saveCodes = () => db.query('REPLACE INTO cloudy_kv (k,v) VALUES (?,?)', ['codes', JSON.stringify(CODES)]);
const lockMsg = u => { if (!u || isAdm(u)) return ''; if (u.paused) return 'Konto vorübergehend deaktiviert.'; const un = Number(u.ban_until) || 0; if (u.banned && (!un || un > Date.now())) { const r = u.ban_reason ? ': ' + u.ban_reason : ''; if (!un) return 'Konto dauerhaft gesperrt' + r; const m = Math.ceil((un - Date.now()) / 60000); return 'Konto gesperrt für noch ' + (m >= 1440 ? Math.ceil(m / 1440) + ' Tag(e)' : m >= 60 ? Math.ceil(m / 60) + ' Std.' : m + ' Min.') + r; } return ''; };
const isAdm = u => !!u && (!!u.admin || ((TAGS[String(u.name).toLowerCase()] || []).includes('owner'))); // Owner-Tag = Admin-Rechte
let LIM = {}; // Limited-Items: { itemId: { mode, price, stock, sold, code, until, note, claimed[] } }
let HIDE = []; // vom Admin im Shop versteckte Items (nicht mehr kaufbar)
const limView = (key, adm) => Object.values(LIM).map(l => ({ id: l.id, mode: l.mode, price: l.price, stock: l.stock, left: Math.max(0, l.stock - l.sold), until: l.until || 0, note: l.note || '', mine: l.claimed.includes(key), over: !!(l.until && l.until < Date.now()) || l.sold >= l.stock, ...(adm ? { code: ((l.codes || []).find(x => !x.by) || {}).c || l.code || '', codes: (l.codes || []).map(x => ({ c: x.c, used: !!x.by })), sold: l.sold } : {}) }));
const limSet = b => { const id = String(b.id || ''); if (!/^[a-z]+-[a-z0-9-]{1,30}$/.test(id)) return 'Ungueltiges Item.'; if (b.del) { delete LIM[id]; return ''; }
  const mode = b.mode === 'code' ? 'code' : 'coins', old = LIM[id] || { sold: 0, claimed: [] };
  const price = Math.max(0, Math.min(1e6, Math.round(+b.price || 0))), stock = Math.max(1, Math.min(1e5, Math.round(+b.stock || 1))), hrs = Math.max(0, Math.min(8760, +b.hours || 0));
  let codes = []; if (mode === 'code') { const oc = old.codes || (old.code ? [{ c: old.code, by: '' }] : []), want = String(b.code || '').split(/[\s,;]+/).map(x => x.trim().slice(0, 30)).filter(Boolean), seen = new Set(); // jeder Code gilt nur fuer einen Spieler: so viele Codes wie Menge
      for (const c of want.length ? want : oc.map(x => x.c)) { const k = c.toLowerCase(); if (!seen.has(k) && codes.length < stock) { seen.add(k); const o = oc.find(x => x.c.toLowerCase() === k); codes.push({ c, by: b.reset ? '' : (o && o.by) || '' }); } }
      const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; while (codes.length < stock) { let c = ''; for (const x of crypto.randomBytes(8)) c += A[x % A.length]; if (!seen.has(c.toLowerCase())) { seen.add(c.toLowerCase()); codes.push({ c, by: '' }); } } }
  LIM[id] = { id, mode, price, stock, codes, until: hrs ? Date.now() + hrs * 3600e3 : 0, note: String(b.note || '').slice(0, 80), sold: b.reset ? 0 : old.sold, claimed: b.reset ? [] : old.claimed, t: old.t || Date.now() }; return ''; };
const limClaim = (key, b) => { const l = LIM[String(b.id || '')]; if (!l) return { error: 'Dieses Limited-Item gibt es nicht.' }; if (l.claimed.includes(key)) return { ok: true, already: true, price: 0 };
  if (l.until && l.until < Date.now()) return { error: 'Die Aktion ist abgelaufen.' }; if (l.sold >= l.stock) return { error: 'Ausverkauft.' };
  let cd = null; if (l.mode === 'code') { const want = String(b.code || '').trim().toLowerCase(); cd = (l.codes || []).find(x => x.c.toLowerCase() === want); if (!want || !cd) return { error: 'Falscher Code.' }; if (cd.by) return { error: 'Dieser Code wurde schon eingeloest.' }; }
  if (cd) cd.by = key; l.sold++; l.claimed.push(key); return { ok: true, price: l.mode === 'coins' ? l.price : 0 }; };
const TAGS_OK = ['owner', 'tester', 'plus', 'mod'];
const tagsOf = k => { const t = (TAGS[k] || []).filter(x => TAGS_OK.includes(x)); return k === 'admin' ? ['owner', ...t.filter(x => x !== 'owner')] : t; }; // das Admin-Konto ist automatisch Owner (rot)
const pub = u => ({ hidden: HIDE, tags: tagsOf(String(u.name).toLowerCase()), names: NAMES, prices: PRICES, name: u.name, admin: isAdm(u), coins: isAdm(u) || u.inf_coins ? null : u.coins, mustChange: !!u.must_change, state: { coins: u.admin || u.inf_coins ? null : (u.coins == null ? 100 : u.coins), owned: parse(u.owned, []), equip: parse(u.equip, {}), daily: u.daily || '' } });
const okPw = (u, p) => { if (!u) return false; try { return crypto.timingSafeEqual(Buffer.from(u.hash, 'hex'), Buffer.from(hash(p, u.salt), 'hex')); } catch { return false; } };
const fk = (o, s) => { const u = String(s || '').trim().toUpperCase(); if (Object.prototype.hasOwnProperty.call(o, u)) return u; const n = u.replace(/[^A-Z0-9]/g, ''); return n ? (Object.keys(o).find(k => k.replace(/[^A-Z0-9]/g, '') === n) || u) : u; }; // Codes mit oder ohne Bindestriche, Groß-/Kleinschreibung egal
const sessions = new Map(), tries = new Map(), RM = new Map(); // RM: kürzlich entfernte Items je Konto – verhindert, dass ein veralteter Launcher sie sofort wieder hochlädt
const rmBlock = (key, ids) => { const m = RM.get(key); if (!m) return ids; const now = Date.now(); return ids.filter(x => !(m['*'] > now - 120000 || m[x] > now - 120000)); };
const limited = ip => { const t = tries.get(ip) || { n: 0, t: Date.now() }; if (Date.now() - t.t > 60000) { t.n = 0; t.t = Date.now(); } t.n++; tries.set(ip, t); return t.n > 10; };
const newTok = key => { const t = crypto.randomBytes(24).toString('hex'); sessions.set(t, key); return t; };
async function init() {
  await db.query(`CREATE TABLE IF NOT EXISTS cloudy_users (name_key VARCHAR(16) PRIMARY KEY, name VARCHAR(16), salt VARCHAR(64), hash VARCHAR(200), created BIGINT, coins INT NULL, inf_coins TINYINT DEFAULT 0, admin TINYINT DEFAULT 0, must_change TINYINT DEFAULT 0, banned TINYINT DEFAULT 0, ban_reason VARCHAR(80) DEFAULT '')`);
  for (const [c, def] of [['ban_until', 'BIGINT'], ['paused', 'TINYINT']]) { const [r] = await db.query('SHOW COLUMNS FROM cloudy_users LIKE ?', [c]); if (!r.length) await db.query(`ALTER TABLE cloudy_users ADD COLUMN ${c} ${def} NULL`); }
  await db.query('CREATE TABLE IF NOT EXISTS cloudy_kv (k VARCHAR(40) PRIMARY KEY, v MEDIUMTEXT)');
  try { await db.query('ALTER TABLE cloudy_kv MODIFY v MEDIUMTEXT'); } catch {}
  { const [r] = await db.query("SELECT v FROM cloudy_kv WHERE k='names'"); NAMES = r.length ? parse(r[0].v, {}) : {}; }
  { const [r] = await db.query("SELECT v FROM cloudy_kv WHERE k='prices'"); PRICES = r.length ? parse(r[0].v, {}) : {}; }
  { const [r] = await db.query("SELECT v FROM cloudy_kv WHERE k='tags'"); TAGS = r.length ? parse(r[0].v, {}) : {}; }
  { const [r] = await db.query("SELECT v FROM cloudy_kv WHERE k='cos'"); COS = r.length ? parse(r[0].v, {}) : {}; }
  { const [r] = await db.query("SELECT v FROM cloudy_kv WHERE k='hide'"); HIDE = r.length ? parse(r[0].v, []) : []; if (!Array.isArray(HIDE)) HIDE = []; }
  { const [r] = await db.query("SELECT v FROM cloudy_kv WHERE k='lim'"); LIM = r.length ? parse(r[0].v, {}) : {}; if (!LIM || typeof LIM !== 'object') LIM = {}; }
  { const [r] = await db.query("SELECT v FROM cloudy_kv WHERE k='announce'"); ANN = r.length ? parse(r[0].v, ANN) : ANN; }
  { const [r] = await db.query("SELECT v FROM cloudy_kv WHERE k='gate'"); GATE = r.length ? parse(r[0].v, {}) : {}; }
  { const [r] = await db.query("SELECT v FROM cloudy_kv WHERE k='friends'"); FR = r.length ? parse(r[0].v, FR) : FR; if (!FR.f) FR = { f: {}, msgs: {}, seq: 1 }; }
  { const [r] = await db.query("SELECT v FROM cloudy_kv WHERE k='gategrants'"); GRANTS = r.length ? parse(r[0].v, {}) : {}; }
  { const [r] = await db.query("SELECT v FROM cloudy_kv WHERE k='codes'"); CODES = r.length ? parse(r[0].v, {}) : {}; }
  for (const [c, def] of [['owned', 'TEXT'], ['equip', 'TEXT'], ['daily', 'VARCHAR(20)']]) { const [r] = await db.query('SHOW COLUMNS FROM cloudy_users LIKE ?', [c]); if (!r.length) await db.query(`ALTER TABLE cloudy_users ADD COLUMN ${c} ${def} NULL`); }
  const a = await get('admin'); if (!a || !okPw(a, ADMIN_PASS)) await put(mk('admin', ADMIN_PASS, { admin: 1, coins: null }));
  await db.query("INSERT IGNORE INTO cloudy_kv (k,v) VALUES ('noInf1','0')"); { const [f] = await db.query("SELECT v FROM cloudy_kv WHERE k='noInf1'"); if (f[0] && f[0].v === '0') { await db.query("UPDATE cloudy_users SET inf_coins=0, coins=100 WHERE name_key='tester' AND inf_coins=1"); await db.query("UPDATE cloudy_kv SET v='1' WHERE k='noInf1'"); } }
  if (!(await get('tester'))) await put(mk('Tester', '12345', { must_change: 1, coins: 100 }));
}
const app = express(); app.set('trust proxy', true); // hinter nginx/Cloudflare: echte Besucher-IP für die Versuchsbegrenzung
app.use(cors()); app.use(express.json({ limit: '100kb' }));
const wrap = f => (req, res) => f(req, res).catch(e => { console.error(e.message); res.status(500).json({ error: 'Serverfehler.' }); });
app.get('/', (_q, r) => r.send('Cloudy-Server läuft.'));
app.get('/health', (_q, r) => r.json({ ok: true }));
app.post('/register', wrap(async (req, res) => {
  if (limited(req.ip)) return res.status(429).json({ error: 'Zu viele Versuche, warte kurz.' });
  const user = String(req.body.user || '').trim(), pass = String(req.body.pass || ''), key = user.toLowerCase();
  if (!/^[A-Za-z0-9_]{3,16}$/.test(user)) return res.status(400).json({ error: 'Benutzername: 3–16 Zeichen, nur Buchstaben, Zahlen und _.' });
  if (pass.length < 6) return res.status(400).json({ error: 'Das Passwort braucht mindestens 6 Zeichen.' });
  if (await get(key)) return res.status(409).json({ error: 'Diesen Benutzernamen gibt es schon.' });
  const u = mk(user, pass); await put(u); await bindGrant(req.body.grant, user); res.json({ token: newTok(key), user: pub(u) });
}));
app.post('/gate', wrap(async (req, res) => { // Zugangscode des Launchers prüfen (vor der Anmeldung)
  if (limited(req.ip)) return res.status(429).json({ error: 'Zu viele Versuche, warte kurz.' });
  const code = fk(GATE, req.body.code), c = GATE[code], legacy = Object.keys(GATE).length === 0;
  if (c && (!c.exp || c.exp > Date.now()) && (!c.uses || (c.used || 0) < c.uses)) { c.used = (c.used || 0) + 1; const grant = crypto.randomBytes(12).toString('hex'); GRANTS[grant] = code; await saveGate(); return res.json({ ok: true, grant }); }
  res.json({ ok: false, legacy, error: c ? (c.exp && c.exp <= Date.now() ? 'Dieser Zugangscode ist abgelaufen.' : 'Dieser Zugangscode ist aufgebraucht.') : '' });
}));
async function bindGrant(g, name) { g = String(g || ''); const v = GRANTS[g]; if (v) { GRANTS[g] = { c: gcode(v), u: String(name).toLowerCase() }; await saveGate(); } } // Zugang einem Konto zuordnen
app.post('/gatecheck', wrap(async (req, res) => res.json({ ok: !!GRANTS[String(req.body.grant || '')] }))); // Zugang noch gültig?
app.post('/login', wrap(async (req, res) => {
  if (limited(req.ip)) return res.status(429).json({ error: 'Zu viele Versuche, warte kurz.' });
  const key = String(req.body.user || '').trim().toLowerCase(), u = await get(key);
  if (!okPw(u, req.body.pass)) return res.status(401).json({ error: 'Benutzername oder Passwort stimmt nicht.' });
  { const lm = lockMsg(u); if (lm) return res.status(403).json({ error: lm }); }
  await bindGrant(req.body.grant, u.name); res.json({ token: newTok(key), user: pub(u) });
}));
const auth = wrap2 => wrap(async (req, res) => {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || ''), key = m && sessions.get(m[1]), me = key && await get(key);
  if (!me) return res.status(401).json({ error: 'Nicht angemeldet.' });
  { const lm = lockMsg(me); if (lm) return res.status(403).json({ error: lm }); }
  await wrap2(req, res, me);
});
// ---- Freunde & Chat direkt über den Konto-Server (kein extra Freundesserver nötig) ----
const SEEN = new Map(); // Konto -> letzter Kontakt (für „online“)
const frPair = (a, b) => [a, b].sort().join('|');
async function frHandle(FR, p, me, myName, b, q, nameOf, save) {
  const key = n => String(n || '').trim().toLowerCase(), now = Date.now(); SEEN.set(me, now);
  const u = FR.f[me] = FR.f[me] || { friends: [], in: [], out: [], read: {} }, uf = k => FR.f[k] = FR.f[k] || { friends: [], in: [], out: [], read: {} };
  const online = k => now - (SEEN.get(k) || 0) < 45000;
  const unread = k => (FR.msgs[frPair(me, k)] || []).filter(m => m.fk !== me && m.id > (u.read[k] || 0)).length;
  if (p === 'state') {
    const out = { ok: true, me: myName, tags: tagsOf(me), friends: [], incoming: [], outgoing: [] };
    for (const k of u.friends) { const n = await nameOf(k); if (n) out.friends.push({ name: n, tags: tagsOf(k), online: online(k), unread: unread(k), av: (FR.av && FR.av[k]) || '' }); }
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
app.all('/me', auth(async (_q, res, me) => { SEEN.set(String(me.name).toLowerCase(), Date.now()); res.json({ user: pub(me) }); }));
app.post(/^\/fr\/(.+)$/, auth(async (req, res, me) => { const r = await frHandle(FR, req.params[0], String(me.name).toLowerCase(), me.name, req.body || {}, null, async k => { const u = await get(k); return u ? u.name : ''; }, saveFr); res.status(r[0]).json(r[1]); }));
app.post('/password', auth(async (req, res, me) => {
  const p = String(req.body.pass || ''); if (p.length < 6 || p === '12345') return res.status(400).json({ error: 'Mindestens 6 Zeichen, nicht 12345.' });
  await put({ ...me, ...mk(me.name, p, { admin: me.admin, inf_coins: me.inf_coins, coins: me.coins, created: me.created }) }); res.json({ ok: true });
}));
app.post('/redeem', auth(async (req, res, me) => { // Code einlösen
  if (limited(req.ip)) return res.status(429).json({ error: 'Zu viele Versuche, warte kurz.' });
  if (me.admin) return res.status(400).json({ error: 'Admins brauchen keine Codes.' });
  const code = fk(CODES, req.body.code), c = CODES[code];
  if (!c) return res.status(404).json({ error: 'Diesen Code gibt es nicht.' });
  c.used = c.used || [];
  if (c.used.includes(me.name.toLowerCase())) return res.status(409).json({ error: 'Diesen Code hast du schon eingelöst.' });
  if (c.exp && c.exp < Date.now()) return res.status(410).json({ error: 'Dieser Code ist abgelaufen.' });
  if (c.uses > 0 && c.used.length >= c.uses) return res.status(410).json({ error: 'Dieser Code ist aufgebraucht.' });
  const u = { ...me }; let coins = 0, owned = parse(me.owned, []);
  if (c.coins > 0 && !me.inf_coins) { u.coins = Math.min(1e9, (me.coins == null ? 100 : me.coins) + c.coins); coins = c.coins; }
  const newItems = (c.items || []).filter(i => !owned.includes(i)); u.owned = [...owned, ...newItems];
  c.used.push(me.name.toLowerCase()); await put(u); await saveCodes(); res.json({ ok: true, coins, items: newItems, skipped: (c.items || []).length - newItems.length });
}));
app.post('/gift', auth(async (req, res, me) => { // Item verschenken
  if (me.admin) return res.status(400).json({ error: 'Admins besitzen schon alles.' });
  const to = await get(String(req.body.to || '').trim().toLowerCase()), id = String(req.body.id || '');
  if (!to || to.admin) return res.status(404).json({ error: 'Dieses Konto gibt es nicht.' });
  if (to.name_key === me.name_key || to.name.toLowerCase() === me.name.toLowerCase()) return res.status(400).json({ error: 'Du kannst dir nichts selbst schenken.' });
  let mo = parse(me.owned, []), to_o = parse(to.owned, []), eq = parse(me.equip, {});
  if (!mo.includes(id)) return res.status(400).json({ error: 'Das besitzt du nicht.' });
  if (to_o.includes(id)) return res.status(409).json({ error: to.name + ' besitzt das schon.' });
  mo = mo.filter(x => x !== id); for (const k of Object.keys(eq)) if (eq[k] === id) delete eq[k];
  await put({ ...me, owned: mo, equip: eq }); await put({ ...to, owned: [...to_o, id] }); res.json({ ok: true, to: to.name });
}));
let COS = {}; // Minecraft-Name -> { u: Konto, equip } (Cosmetics, die andere Cloudy-Spieler sehen)
app.post('/cos/reg', auth(async (req, res, me) => {
  const b = req.body || {}, mc = String(b.mc || '').toLowerCase(); if (!/^\w{3,16}$/.test(mc)) return res.status(400).json({ error: 'Ungueltiger Spielername.' });
  const own = isAdm(me) ? null : parse(me.owned, []), eq = {};
  for (const c of ['cape', 'hat', 'wings']) { const v = b.equip && b.equip[c]; if (typeof v === 'string' && /^[a-z0-9-]{3,30}$/.test(v) && v.startsWith(c + '-') && (!own || own.includes(v))) eq[c] = v; }
  for (const k of Object.keys(COS)) if (COS[k].u === me.name_key && k !== mc) delete COS[k];
  COS[mc] = { u: me.name_key, equip: eq, t: Date.now() }; await db.query('REPLACE INTO cloudy_kv (k,v) VALUES (?,?)', ['cos', JSON.stringify(COS)]); res.json({ ok: true });
}));
app.post('/cos/get', auth(async (req, res) => {
  const out = {}; for (const n of (Array.isArray((req.body || {}).names) ? req.body.names : []).slice(0, 80)) { const k = String(n).toLowerCase(), e = COS[k]; if (e && Object.keys(e.equip).length) out[k] = e.equip; }
  res.json({ ok: true, players: out });
}));
app.post('/state', auth(async (req, res, me) => { // Shop-Stand des Kontos speichern (Coins, gekaufte Items, Auswahl)
  if (me.admin) return res.json({ ok: true });
  const b = req.body || {}, u = { ...me };
  if (!me.inf_coins && Number.isFinite(+b.coins)) u.coins = Math.max(0, Math.min(1e9, Math.round(+b.coins)));
  if (Array.isArray(b.owned)) u.owned = [...new Set([...parse(me.owned, []), ...rmBlock(me.name_key, b.owned.filter(x => typeof x === 'string' && (!HIDE.includes(x) || parse(me.owned, []).includes(x)) && (!LIM[x] || LIM[x].claimed.includes(me.name_key) || parse(me.owned, []).includes(x))))])].slice(0, 500); // nur hinzufügen: Entfernen/Verschenken passiert nur auf dem Server
  if (b.equip && typeof b.equip === 'object') u.equip = Object.fromEntries(Object.entries(b.equip).filter(([k, v]) => typeof v === 'string').slice(0, 20));
  if (typeof b.daily === 'string') u.daily = b.daily.slice(0, 20);
  await put(u); res.json({ ok: true });
}));
const admin = f => auth(async (req, res, me) => { if (!isAdm(me)) return res.status(403).json({ error: 'Nur für Admins.' }); await f(req, res, me); });
const saveLim = () => db.query('REPLACE INTO cloudy_kv (k,v) VALUES (?,?)', ['lim', JSON.stringify(LIM)]);
app.post('/limited', auth(async (req, res, me) => res.json({ ok: true, items: limView(me.name_key, isAdm(me)) })));
app.post('/limited/claim', auth(async (req, res, me) => { const r = limClaim(me.name_key, req.body || {}); if (r.ok && !r.already) await saveLim(); res.status(r.error ? 400 : 200).json(r); }));
app.post('/admin/limited', admin(async (req, res, me) => { const e = limSet(req.body || {}); if (e) return res.status(400).json({ error: e }); await saveLim(); res.json({ ok: true, items: limView(me.name_key, true) }); }));
app.post('/admin/hide', admin(async (req, res) => { const id = String(req.body.id || ''); if (!/^[a-z]+-[a-z0-9-]{1,30}$/.test(id)) return res.status(400).json({ error: 'Ungueltiges Item.' }); HIDE = HIDE.filter(x => x !== id); if (req.body.on) HIDE.push(id); await db.query('REPLACE INTO cloudy_kv (k,v) VALUES (?,?)', ['hide', JSON.stringify(HIDE)]); res.json({ ok: true, hidden: HIDE }); }));
app.post('/admin/tag', admin(async (req, res) => { const k = String(req.body.name || '').trim().toLowerCase(), tg = String(req.body.tag || ''); const t = await get(k); if (!t || t.admin) return res.status(404).json({ error: 'Konto nicht gefunden.' }); if (!TAGS_OK.includes(tg)) return res.status(400).json({ error: 'Unbekannter Tag.' }); const a = (TAGS[k] || []).filter(x => x !== tg); if (req.body.on) a.push(tg); if (a.length) TAGS[k] = a; else delete TAGS[k]; await db.query('REPLACE INTO cloudy_kv (k,v) VALUES (?,?)', ['tags', JSON.stringify(TAGS)]); res.json({ ok: true, tags: a }); }));
app.all('/admin/users', admin(async (_q, res) => { const [r] = await db.query('SELECT * FROM cloudy_users WHERE admin=0 ORDER BY created'); res.json({ users: r.map(u => ({ name: u.name, tags: TAGS[String(u.name).toLowerCase()] || [], coins: u.inf_coins ? '∞' : (u.coins == null ? 100 : u.coins), owned: parse(u.owned, []).length, inf: !!u.inf_coins, banned: !!u.banned && (!Number(u.ban_until) || Number(u.ban_until) > Date.now()), until: Number(u.ban_until) || 0, paused: !!u.paused, items: parse(u.owned, []), reason: u.ban_reason || '', created: Number(u.created), gate: (Object.values(GRANTS).find(v => v && v.u === u.name.toLowerCase()) || {}).c || '' })) }); }));
const target = f => admin(async (req, res) => { const t = await get(String(req.body.name || '').toLowerCase()); if (!t || t.admin) return res.status(404).json({ error: 'Konto nicht gefunden.' }); await f(req, res, t); });
app.all('/announce', auth(async (_q, res) => res.json(ANN)));
app.post('/admin/announce', admin(async (req, res) => { ANN = { text: String(req.body.text || '').trim().slice(0, 300), t: req.body.text ? Date.now() : 0 }; await db.query('REPLACE INTO cloudy_kv (k,v) VALUES (?,?)', ['announce', JSON.stringify(ANN)]); res.json({ ok: true, ...ANN }); }));
app.all('/admin/stats', admin(async (_q, res) => { const [[a]] = await db.query('SELECT COUNT(*) n, SUM(banned=1) b, SUM(paused=1) p, SUM(CASE WHEN inf_coins=0 AND coins IS NOT NULL THEN coins ELSE 0 END) c, SUM(created > ?) n7 FROM cloudy_users WHERE admin=0', [Date.now() - 7 * 864e5]); const now = Date.now(); res.json({ users: +a.n || 0, online: [...SEEN.values()].filter(t => now - t < 120000).length, banned: +a.b || 0, paused: +a.p || 0, coins: +a.c || 0, items: 0, codes: Object.keys(CODES).length, gate: Object.keys(GATE).length, new7: +a.n7 || 0, announce: ANN }); }));
app.all('/admin/codes', admin(async (_q, res) => res.json({ codes: Object.entries(CODES).map(([code, c]) => ({ code, coins: c.coins || 0, items: c.items || [], uses: c.uses || 0, used: (c.used || []).length, exp: c.exp || 0 })) })));
app.post('/admin/codecreate', admin(async (req, res) => {
  let code = String(req.body.code || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 24); if (!code) code = (()=>{const A='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let s='';for(const b of crypto.randomBytes(12))s+=A[b%A.length];return s.replace(/(.{4})(?=.)/g,'$1-')})();
  if (CODES[code]) return res.status(409).json({ error: 'Diesen Code gibt es schon.' });
  const coins = Math.max(0, Math.min(1e6, Math.round(+req.body.coins || 0))), items = (Array.isArray(req.body.items) ? req.body.items : []).filter(x => typeof x === 'string').slice(0, 30);
  if (!coins && !items.length) return res.status(400).json({ error: 'Der Code braucht Coins oder Items.' });
  const exp = Math.round(+req.body.exp || 0); if (exp && exp < Date.now()) return res.status(400).json({ error: 'Das Ablaufdatum liegt in der Vergangenheit.' });
  CODES[code] = { coins, items, uses: Math.max(0, Math.min(1e6, Math.round(+req.body.uses || 0))), used: [], exp: exp ? Math.min(exp, Date.now() + 3650 * 864e5) : 0 }; await saveCodes(); res.json({ ok: true, code });
}));
app.all('/admin/gatecodes', admin(async (_q, res) => res.json({ codes: Object.entries(GATE).map(([code, c]) => ({ code, uses: c.uses || 0, used: c.used || 0, exp: c.exp || 0, active: Object.values(GRANTS).filter(x => gcode(x) === code).length })) })));
app.post('/admin/gatecreate', admin(async (req, res) => {
  let code = String(req.body.code || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 24); if (!code) code = (()=>{const A='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let s='';for(const b of crypto.randomBytes(12))s+=A[b%A.length];return s.replace(/(.{4})(?=.)/g,'$1-')})();
  if (GATE[code]) return res.status(409).json({ error: 'Diesen Zugangscode gibt es schon.' });
  const days = Math.max(0, Math.min(3650, Math.round(+req.body.days || 0)));
  GATE[code] = { uses: Math.max(0, Math.min(1e6, Math.round(+req.body.uses || 0))), used: 0, exp: days ? Date.now() + days * 864e5 : 0 }; await saveGate(); res.json({ ok: true, code });
}));
app.post('/admin/gaterevokeuser', admin(async (req, res) => { const k = String(req.body.name || '').trim().toLowerCase(); let n = 0; for (const g in GRANTS) if (GRANTS[g] && GRANTS[g].u === k) { delete GRANTS[g]; n++; } await saveGate(); res.json({ ok: true, revoked: n }); }));
app.post('/admin/gatedelete', admin(async (req, res) => { const gc = fk(GATE, req.body.code); delete GATE[gc]; let n = 0; if (req.body.revoke) for (const g in GRANTS) if (gcode(GRANTS[g]) === gc) { delete GRANTS[g]; n++; } await saveGate(); res.json({ ok: true, revoked: n }); }));
app.post('/admin/codedelete', admin(async (req, res) => { delete CODES[fk(CODES, req.body.code)]; await saveCodes(); res.json({ ok: true }); }));
app.post('/admin/additem', target(async (req, res, t) => { const id = String(req.body.id || ''); if (!id) return res.status(400).json({ error: 'id fehlt' }); const o = parse(t.owned, []); if (!o.includes(id)) o.push(id); await put({ ...t, owned: o }); res.json({ ok: true }); }));
app.post('/admin/inf', target(async (req, res, t) => { await put({ ...t, inf_coins: req.body.on ? 1 : 0, coins: req.body.on ? null : 100 }); res.json({ ok: true }); }));
app.post('/admin/pause', target(async (req, res, t) => { await put({ ...t, paused: req.body.paused ? 1 : 0 }); res.json({ ok: true }); }));
app.post('/admin/removeitem', target(async (req, res, t) => { let o = parse(t.owned, []), e = parse(t.equip, {}); { const m = RM.get(t.name_key) || {}; m[req.body.all ? '*' : String(req.body.id || '')] = Date.now(); RM.set(t.name_key, m); } if (req.body.all) { o = []; e = {}; } else { const id = String(req.body.id || ''); o = o.filter(x => x !== id); for (const k of Object.keys(e)) if (e[k] === id) delete e[k]; } await put({ ...t, owned: o, equip: e }); res.json({ ok: true }); }));
app.post('/admin/shopprice', admin(async (req, res) => { const id = String(req.body.id || '').slice(0, 40); if (!id) return res.status(400).json({ error: 'id fehlt' }); if (req.body.price === null || req.body.price === '' || req.body.price === undefined) delete PRICES[id]; else PRICES[id] = Math.max(0, Math.min(1e6, Math.round(+req.body.price || 0))); await db.query('REPLACE INTO cloudy_kv (k,v) VALUES (?,?)', ['prices', JSON.stringify(PRICES)]); res.json({ ok: true, prices: PRICES }); }));
app.post('/admin/shopname', admin(async (req, res) => { const id = String(req.body.id || '').slice(0, 40), v = String(req.body.name || '').trim().slice(0, 40); if (!id) return res.status(400).json({ error: 'id fehlt' }); if (v) NAMES[id] = v; else delete NAMES[id]; await db.query('REPLACE INTO cloudy_kv (k,v) VALUES (?,?)', ['names', JSON.stringify(NAMES)]); res.json({ ok: true }); }));
app.post('/admin/ban', target(async (req, res, t) => { await put({ ...t, ban_until: req.body.banned && +req.body.until > Date.now() ? Math.round(+req.body.until) : 0, banned: req.body.banned ? 1 : 0, ban_reason: String(req.body.reason || '').slice(0, 80) }); res.json({ ok: true }); }));
app.post('/admin/coins', target(async (req, res, t) => { await put({ ...t, coins: Math.max(0, Math.min(1e9, Math.round(+req.body.amount || 0))) }); res.json({ ok: true }); }));
app.post('/admin/grant', target(async (req, res, t) => { if (!t.inf_coins) await put({ ...t, coins: Math.max(0, Math.min(1e9, (t.coins == null ? 100 : t.coins) + (parseInt(req.body.amount, 10) || 0))) }); res.json({ ok: true }); }));
app.post('/admin/reset', target(async (_q, res, t) => { await put({ ...t, ...mk(t.name, '12345', { must_change: 1, inf_coins: t.inf_coins, coins: t.coins }) }); res.json({ ok: true }); }));
app.post('/admin/delete', target(async (_q, res, t) => { await db.query('DELETE FROM cloudy_users WHERE name_key=?', [t.name.toLowerCase()]); res.json({ ok: true }); }));
init().then(() => app.listen(PORT, () => console.log('Cloudy-Server läuft auf Port ' + PORT))).catch(e => { console.error('Start fehlgeschlagen:', e.message); process.exit(1); });
