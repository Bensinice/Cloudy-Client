// Quests & Cloudy Stars. Reines Modul (ohne Express/MySQL), damit es sich testen lässt.
// Alles Wichtige entscheidet der Server: Aufgaben, Ziele, Belohnungen, Zeitpunkte und Fortschritt. Der Launcher meldet nur Ereignisse.
// Zurückgesetzt wird um Mitternacht (Europe/Berlin): täglich und wöchentlich (Montag 00:00).
const TZ = 'Europe/Berlin';
const FEATURES = ['shop', 'friends', 'mods', 'settings', 'skins']; // Seiten, die als „Entdecken“-Aufgabe vorkommen können
const DAILY = [
  { id: 'd_open', target: 1, coins: 5, stars: 1 },
  { id: 'd_launch', target: 1, coins: 10, stars: 1 },
  { id: 'd_play', target: 30, coins: 25, stars: 2, unit: 'min' },
  { id: 'd_feat', target: 1, coins: 10, stars: 1 }
];
const WEEKLY = [
  { id: 'w_launch', target: 5, coins: 40, stars: 4 },
  { id: 'w_play', target: 300, coins: 100, stars: 6, unit: 'min' },
  { id: 'w_daily', target: 10, coins: 60, stars: 5 }
];
const MIN_GAP = 20000, MAX_CREDIT = 90000; // Spielzeit: höchstens eine Meldung je 20 s, je Meldung höchstens 90 s (nie schneller als die echte Zeit)
const EVENT_GAP = 20000;

module.exports = ({ now = () => Date.now() } = {}) => {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
  const dayOf = t => fmt.format(new Date(t));
  const weekOf = t => { // ISO-Woche des Berliner Datums
    const [y, m, d] = dayOf(t).split('-').map(Number), dt = new Date(Date.UTC(y, m - 1, d)), wd = (dt.getUTCDay() + 6) % 7;
    dt.setUTCDate(dt.getUTCDate() - wd + 3); const y1 = dt.getUTCFullYear(), j = new Date(Date.UTC(y1, 0, 4));
    const wk = 1 + Math.round(((dt - j) / 864e5 - 3 + ((j.getUTCDay() + 6) % 7)) / 7); return y1 + '-W' + String(wk).padStart(2, '0');
  };
  const nextChange = (t, f) => { const k = f(t); let lo = t, hi = t + 8 * 864e5; while (hi - lo > 1000) { const mid = Math.floor((lo + hi) / 2); if (f(mid) === k) lo = mid; else hi = mid; } return hi; };
  const featOf = day => { let h = 0; for (const c of day) h = (h * 31 + c.charCodeAt(0)) >>> 0; return FEATURES[h % FEATURES.length]; };

  const fresh = () => ({ day: '', week: '', d: {}, w: {}, days: [], dc: 0, pm: 0, wm: 0, feat: '', stars: { bal: 0, earned: 0, spent: 0 }, hist: [], beat: 0, ev: {} });
  function ensure(Q, key) {
    const S = Q[key] || (Q[key] = fresh()), t = now(), day = dayOf(t), week = weekOf(t);
    if (S.week !== week) { S.week = week; S.w = {}; S.days = []; S.dc = 0; S.wm = 0; }
    if (S.day !== day) { S.day = day; S.d = {}; S.pm = 0; S.feat = featOf(day); }
    return S;
  }
  const slot = (map, id) => map[id] || (map[id] = { p: 0, c: false });
  const defOf = id => DAILY.find(q => q.id === id) || WEEKLY.find(q => q.id === id);
  const bump = (map, def, n) => { const s = slot(map, def.id); if (!s.c) s.p = Math.min(def.target, Math.max(s.p, n)); };

  function syncMinutes(S) { bump(S.d, DAILY[2], Math.floor(S.pm / 60000)); bump(S.w, WEEKLY[1], Math.floor(S.wm / 60000)); }

  function view(Q, key) {
    const S = ensure(Q, key), t = now();
    bump(S.d, DAILY[0], 1); // „Cloudy öffnen“ zählt, sobald der Launcher den Stand abruft
    const row = (def, map) => { const s = slot(map, def.id); return { id: def.id, target: def.target, unit: def.unit || '', p: s.p, done: s.p >= def.target, claimed: s.c, coins: def.coins, stars: def.stars, feat: def.id === 'd_feat' ? S.feat : undefined }; };
    return { day: S.day, week: S.week, daily: DAILY.map(q => row(q, S.d)), weekly: WEEKLY.map(q => row(q, S.w)), stars: { ...S.stars }, resets: { daily: nextChange(t, dayOf) - t, weekly: nextChange(t, weekOf) - t }, hist: S.hist.slice(-20).reverse() };
  }

  function event(Q, key, type, what) {
    const S = ensure(Q, key), t = now(); type = String(type || ''); what = String(what || '');
    if (type !== 'launch' && !(type === 'use' && FEATURES.includes(what))) return { ok: false, code: 'bad_event' };
    const k = type + ':' + what; if (t - (S.ev[k] || 0) < EVENT_GAP) return { ok: true, ignored: true }; S.ev[k] = t;
    if (type === 'launch') { bump(S.d, DAILY[1], slot(S.d, 'd_launch').p + 1); if (!S.days.includes(S.day)) S.days.push(S.day); bump(S.w, WEEKLY[0], S.days.length); }
    else if (what === S.feat) bump(S.d, DAILY[3], 1);
    return { ok: true };
  }

  function beat(Q, key) { // Spielzeit-Meldung: nie mehr als die echt vergangene Zeit
    const S = ensure(Q, key), t = now(), dt = t - (S.beat || 0);
    if (S.beat && dt < MIN_GAP) return { ok: true, ignored: true };
    S.beat = t;
    if (dt > 0 && dt <= 150000 && dt >= MIN_GAP) { const add = Math.min(dt, MAX_CREDIT); S.pm += add; S.wm += add; syncMinutes(S); }
    return { ok: true };
  }

  function claim(Q, key, id) {
    const S = ensure(Q, key), def = defOf(String(id || '')); if (!def) return { ok: false, code: 'unknown' };
    const isDaily = !!DAILY.find(q => q.id === def.id), map = isDaily ? S.d : S.w, s = slot(map, def.id);
    if (isDaily) bump(S.d, DAILY[0], 1);
    if (s.c) return { ok: false, code: 'claimed' };
    if (s.p < def.target) return { ok: false, code: 'not_done' };
    s.c = true; S.stars.bal += def.stars; S.stars.earned += def.stars;
    if (isDaily) { S.dc++; bump(S.w, WEEKLY[2], S.dc); }
    S.hist.push({ id: def.id, t: now(), coins: def.coins, stars: def.stars }); if (S.hist.length > 60) S.hist.splice(0, S.hist.length - 60);
    return { ok: true, id: def.id, coins: def.coins, stars: def.stars, balance: S.stars.bal };
  }

  function spend(Q, key, n) { // für den Cloudy Pass: Sterne ausgeben (nur der Server entscheidet)
    const S = ensure(Q, key); n = Math.floor(+n); if (!(n > 0) || S.stars.bal < n) return { ok: false, code: 'no_stars' };
    S.stars.bal -= n; S.stars.spent += n; return { ok: true, balance: S.stars.bal };
  }

  function grant(Q, key, n) { // Admin: Sterne geben (negativ = abziehen). Sterne zählen auch für den Pass-Fortschritt.
    const S = ensure(Q, key); n = Math.trunc(+n); if (!Number.isFinite(n) || n === 0 || Math.abs(n) > 5000) return { ok: false, code: 'bad_amount' };
    S.stars.bal = Math.max(0, S.stars.bal + n); S.stars.earned = Math.max(0, S.stars.earned + n); return { ok: true, balance: S.stars.bal, earned: S.stars.earned };
  }

  return { view, event, beat, claim, spend, grant, dayOf, weekOf, DAILY, WEEKLY, FEATURES };
};
