// Quests & Cloudy Stars. Reines Modul (ohne Express/MySQL), damit es sich testen lässt.
// Der Server entscheidet alles: Aufgaben, Ziele, Belohnungen, Zeitpunkte und Fortschritt. Der Launcher meldet nur Ereignisse und Zählerstände.
// Zurückgesetzt wird immer in UTC (nicht nach der PC-Uhr): täglich um 00:00 UTC, wöchentlich Montag 00:00 UTC.
const FEATURES = ['shop', 'friends', 'mods', 'settings', 'skins']; // Seiten, die als „Entdecken“-Aufgabe vorkommen können
// cat: daily | weekly | special (einmalig) | event (nur im Zeitfenster) | newbie (einmalig, für Anfänger)
const D = (id, metric, target, coins, stars, xp, o = {}) => ({ id, metric, target, coins, stars, xp, ...o });
const DEFS = [
  D('d_open', 'open', 1, 5, 1, 10, { cat: 'daily' }), D('d_launch', 'launch', 1, 10, 1, 15, { cat: 'daily' }),
  D('d_play', 'play', 30, 25, 2, 30, { cat: 'daily', unit: 'min' }), D('d_feat', 'feat', 1, 10, 1, 10, { cat: 'daily' }),
  // täglich wechselnde Minecraft-Aufgaben (3 von 6 pro Tag)
  D('d_logs', 'logs', 10, 15, 1, 20, { cat: 'daily', pool: 1 }), D('d_stone', 'stone', 64, 20, 1, 25, { cat: 'daily', pool: 1 }),
  D('d_zombie', 'zombie', 5, 20, 1, 25, { cat: 'daily', pool: 1 }), D('d_walk', 'walk', 1000, 15, 1, 20, { cat: 'daily', pool: 1 }),
  D('d_craft', 'craft', 10, 15, 1, 20, { cat: 'daily', pool: 1 }), D('d_skel', 'skeleton', 3, 20, 1, 25, { cat: 'daily', pool: 1 }),
  D('w_launch', 'launch_days', 5, 40, 4, 80, { cat: 'weekly' }), D('w_play', 'play', 300, 100, 6, 120, { cat: 'weekly', unit: 'min' }),
  D('w_daily', 'daily_claims', 10, 60, 5, 100, { cat: 'weekly' }), D('w_stone', 'stone', 256, 50, 4, 80, { cat: 'weekly' }),
  D('w_iron', 'iron', 20, 60, 5, 100, { cat: 'weekly' }), D('w_craft', 'craft', 100, 50, 4, 80, { cat: 'weekly' }),
  D('w_srv', 'srv', 120, 80, 5, 100, { cat: 'weekly', unit: 'min' }),
  D('s_diamond', 'diamond', 5, 150, 10, 200, { cat: 'special' }), D('s_fish', 'fish', 5, 80, 6, 120, { cat: 'special' }), D('s_skel', 'skeleton', 3, 60, 5, 100, { cat: 'special' }),
  D('n_launch', 'launch', 1, 20, 2, 30, { cat: 'newbie' }), D('n_logs', 'logs', 10, 20, 2, 30, { cat: 'newbie' }),
  D('n_craft', 'craft', 10, 20, 2, 30, { cat: 'newbie' }), D('n_stone', 'stone', 64, 30, 3, 40, { cat: 'newbie' }),
  D('e_s1_play', 'play', 60, 100, 6, 150, { cat: 'event', unit: 'min', from: '2026-11-01', to: '2027-01-31', ev: 'Season 1' }),
  D('e_winter_craft', 'craft', 150, 100, 8, 150, { cat: 'event', from: '2026-12-01', to: '2027-01-06', ev: 'Winter' })
];
const CATS = ['newbie', 'daily', 'weekly', 'special', 'event'];
// Minecraft-Zähler: höchstens so viele pro Sekunde seit der letzten Meldung (Schutz gegen gefälschte Werte) und höchstens so viele pro Tag
const RATE = { logs: 3, stone: 8, iron: 2, diamond: 2, zombie: 2, skeleton: 2, walk: 40, craft: 300, fish: 1 };
const DAILY_CAP = { logs: 3000, stone: 12000, iron: 800, diamond: 400, zombie: 600, skeleton: 600, walk: 60000, craft: 20000, fish: 400 };
const MIN_GAP = 20000, MAX_CREDIT = 90000; // Spielzeit: höchstens eine Meldung je 20 s, je Meldung höchstens 90 s (nie schneller als die echte Zeit)
const EVENT_GAP = 20000, MC_GAP = 5000, MC_MAXSEC = 300;

module.exports = ({ now = () => Date.now() } = {}) => {
  const dayOf = t => new Date(t).toISOString().slice(0, 10); // UTC
  const weekOf = t => { // ISO-Woche (UTC)
    const dt = new Date(Date.UTC(+dayOf(t).slice(0, 4), +dayOf(t).slice(5, 7) - 1, +dayOf(t).slice(8, 10))), wd = (dt.getUTCDay() + 6) % 7;
    dt.setUTCDate(dt.getUTCDate() - wd + 3); const y1 = dt.getUTCFullYear(), j = new Date(Date.UTC(y1, 0, 4));
    const wk = 1 + Math.round(((dt - j) / 864e5 - 3 + ((j.getUTCDay() + 6) % 7)) / 7); return y1 + '-W' + String(wk).padStart(2, '0');
  };
  const nextDay = t => Date.UTC(+dayOf(t).slice(0, 4), +dayOf(t).slice(5, 7) - 1, +dayOf(t).slice(8, 10)) + 864e5;
  const nextWeek = t => { let x = nextDay(t); while (weekOf(x) === weekOf(t)) x += 864e5; return x; };
  const hash = s => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
  const featOf = day => FEATURES[hash(day) % FEATURES.length];
  const pool = DEFS.filter(d => d.pool);
  const dailyPick = day => { const ids = pool.map(d => d.id), out = []; let h = hash('pick' + day); while (out.length < 3) { out.push(ids.splice(h % ids.length, 1)[0]); h = (h >>> 3) + 7919 * out.length; } return out; };

  const fresh = () => ({ day: '', week: '', q: {}, days: [], dc: 0, feat: '', pick: [], stars: { bal: 0, earned: 0, spent: 0 }, xp: 0, hist: [], beat: 0, ev: {}, mcAt: 0, mcDay: {} });
  const keyOf = (def, day, week) => def.cat === 'daily' ? day : def.cat === 'weekly' ? week : def.cat === 'event' ? def.id + ':' + def.from : '';
  const activeDefs = (S, day) => DEFS.filter(d => d.cat !== 'event' ? (!d.pool || S.pick.includes(d.id)) : (day >= d.from && day <= d.to));
  function ensure(Q, key) {
    const S = Q[key] || (Q[key] = fresh()), t = now(), day = dayOf(t), week = weekOf(t);
    if (S.q === undefined) { Object.assign(S, { q: {}, pick: [], xp: Math.round((S.stars && S.stars.earned || 0) * 12), mcAt: 0, mcDay: {} }); S.days = S.days || []; } // Stand aus der ersten Version übernehmen
    if (S.week !== week) { S.week = week; S.days = []; S.dc = 0; }
    if (S.day !== day) { S.day = day; S.feat = featOf(day); S.pick = dailyPick(day); S.mcDay = {}; }
    for (const d of DEFS) { const s = S.q[d.id], k = keyOf(d, day, week); if (s && s.k !== k) delete S.q[d.id]; if (!S.q[d.id] && (d.cat !== 'daily' || !d.pool || S.pick.includes(d.id))) S.q[d.id] = { p: 0, c: false, k }; }
    return S;
  }
  const defOf = id => DEFS.find(d => d.id === id);
  // Fortschritt für alle offenen Aufgaben einer Art erhöhen (n kann Bruchteil sein, z. B. Minuten)
  function add(S, metric, n) { const day = S.day; for (const d of activeDefs(S, day)) if (d.metric === metric) { const s = S.q[d.id]; if (s && !s.c) s.p = Math.min(d.target, s.p + n); } }
  const setTo = (S, metric, n) => { for (const d of activeDefs(S, S.day)) if (d.metric === metric) { const s = S.q[d.id]; if (s && !s.c) s.p = Math.min(d.target, Math.max(s.p, n)); } };

  function view(Q, key) {
    const S = ensure(Q, key), t = now(); setTo(S, 'open', 1); // „Cloudy öffnen“ zählt, sobald der Launcher den Stand abruft
    const row = d => { const s = S.q[d.id]; return { id: d.id, cat: d.cat, target: d.target, unit: d.unit || '', p: Math.floor(s.p * 100) / 100, done: s.p >= d.target, claimed: s.c, status: s.c ? 'claimed' : s.p >= d.target ? 'done' : 'active', coins: d.coins, stars: d.stars, xp: d.xp, feat: d.id === 'd_feat' ? S.feat : undefined, ev: d.ev, endsIn: d.cat === 'event' ? Math.max(0, Date.parse(d.to + 'T23:59:59Z') - t) : undefined }; };
    const cats = {}; for (const c of CATS) cats[c] = activeDefs(S, S.day).filter(d => d.cat === c).map(row);
    if (cats.newbie.length && cats.newbie.every(r => r.claimed)) cats.newbie = []; // fertig: Anfänger-Quests ausblenden
    return { now: t, tz: 'UTC', day: S.day, week: S.week, cats, daily: cats.daily, weekly: cats.weekly, stars: { ...S.stars }, xp: S.xp, resets: { daily: nextDay(t) - t, weekly: nextWeek(t) - t }, hist: S.hist.slice(-20).reverse() };
  }

  function event(Q, key, type, what) {
    const S = ensure(Q, key), t = now(); type = String(type || ''); what = String(what || '');
    if (type !== 'launch' && !(type === 'use' && FEATURES.includes(what))) return { ok: false, code: 'bad_event' };
    const k = type + ':' + what; if (t - (S.ev[k] || 0) < EVENT_GAP) return { ok: true, ignored: true }; S.ev[k] = t;
    if (type === 'launch') { add(S, 'launch', 1); if (!S.days.includes(S.day)) S.days.push(S.day); setTo(S, 'launch_days', S.days.length); }
    else if (what === S.feat) add(S, 'feat', 1);
    return { ok: true };
  }

  function beat(Q, key, srv) { // Spielzeit-Meldung: nie mehr als die echt vergangene Zeit (srv = auf einem Server)
    const S = ensure(Q, key), t = now(), dt = t - (S.beat || 0);
    if (S.beat && dt < MIN_GAP) return { ok: true, ignored: true };
    S.beat = t;
    if (dt > 0 && dt <= 150000 && dt >= MIN_GAP) { const m = Math.min(dt, MAX_CREDIT) / 60000; add(S, 'play', m); if (srv) add(S, 'srv', m); }
    return { ok: true };
  }

  // Zählerstände aus Minecraft (vom Fabric-Client gemessen, vom Launcher weitergeleitet). Der Server begrenzt sie nach Zeit und Tag.
  function mc(Q, key, delta) {
    const S = ensure(Q, key), t = now(); if (!delta || typeof delta !== 'object') return { ok: false, code: 'bad_delta' };
    if (S.mcAt && t - S.mcAt < MC_GAP) return { ok: true, ignored: true };
    const sec = Math.min(MC_MAXSEC, Math.max(5, S.mcAt ? (t - S.mcAt) / 1000 : 30)); S.mcAt = t; const got = {};
    for (const m of Object.keys(RATE)) {
      let n = Math.floor(+delta[m]); if (!(n > 0)) continue;
      n = Math.min(n, Math.floor(RATE[m] * sec), Math.max(0, DAILY_CAP[m] - (S.mcDay[m] || 0))); if (n <= 0) continue;
      S.mcDay[m] = (S.mcDay[m] || 0) + n; got[m] = n; add(S, m, m === 'walk' ? n : n);
    }
    return { ok: true, got };
  }

  function claim(Q, key, id) {
    const S = ensure(Q, key), def = defOf(String(id || '')); if (!def || !S.q[def.id] || !activeDefs(S, S.day).includes(def)) return { ok: false, code: 'unknown' };
    const s = S.q[def.id]; if (def.metric === 'open') setTo(S, 'open', 1);
    if (s.c) return { ok: false, code: 'claimed' };
    if (s.p < def.target) return { ok: false, code: 'not_done' };
    s.c = true; S.stars.bal += def.stars; S.stars.earned += def.stars; S.xp += def.xp;
    if (def.cat === 'daily') { S.dc++; setTo(S, 'daily_claims', S.dc); }
    S.hist.push({ id: def.id, t: now(), coins: def.coins, stars: def.stars, xp: def.xp }); if (S.hist.length > 60) S.hist.splice(0, S.hist.length - 60);
    return { ok: true, id: def.id, coins: def.coins, stars: def.stars, xp: def.xp, balance: S.stars.bal };
  }

  function spend(Q, key, n) { // Sterne ausgeben (nur der Server entscheidet)
    const S = ensure(Q, key); n = Math.floor(+n); if (!(n > 0) || S.stars.bal < n) return { ok: false, code: 'no_stars' };
    S.stars.bal -= n; S.stars.spent += n; return { ok: true, balance: S.stars.bal };
  }
  function grant(Q, key, n, xp) { // Admin: Sterne und/oder Pass-XP geben (negativ = abziehen)
    const S = ensure(Q, key); n = Math.trunc(+n) || 0; xp = Math.trunc(+xp) || 0;
    if ((!n && !xp) || Math.abs(n) > 5000 || Math.abs(xp) > 50000) return { ok: false, code: 'bad_amount' };
    S.stars.bal = Math.max(0, S.stars.bal + n); S.stars.earned = Math.max(0, S.stars.earned + n); S.xp = Math.max(0, S.xp + xp);
    return { ok: true, balance: S.stars.bal, earned: S.stars.earned, xp: S.xp };
  }

  function reset(Q, key, withClaimed) { // Admin: Fortschritt zuruecksetzen. Bereits abgeholte Quests bleiben abgeholt (keine doppelte Auszahlung), ausser withClaimed ist gesetzt.
    const S = ensure(Q, key); let n = 0;
    for (const id of Object.keys(S.q)) { const s = S.q[id]; if (s.c && !withClaimed) continue; if (s.p || s.c) n++; s.p = 0; s.c = false; }
    S.mcAt = 0; S.mcDay = {}; S.ev = {}; S.beat = 0; return { ok: true, reset: n };
  }

  return { view, event, beat, mc, claim, spend, grant, reset, dayOf, weekOf, DEFS, CATS, RATE, FEATURES };
};
