// Cloudy Pass: 30 Level, Gratis- und Premium-Reihe. Reines Modul (ohne Express/MySQL), damit es sich testen lässt.
// Der Fortschritt kommt aus den Cloudy Stars, die man mit Quests verdient (Quest-Modul). Der Server entscheidet alles:
// Level, Belohnungen und wer die Premium-Reihe abholen darf (nur mit aktivem Cloudy+).
const SEASON = { id: 's1', name: 'Season 1', start: '2026-11-01', end: '2027-01-31' }; // Ende: 31.01. 23:59 Berlin
const LEVELS = 30, PER_LEVEL = 8; // Stufe L braucht insgesamt L * 8 Sterne (Stufe 30 = 240 Sterne)
const FREE_ITEMS = { 5: 'shield-forest', 12: 'hat-top', 20: 'cape-sunset', 27: 'hat-party' }; // 4 Items in der Gratis-Reihe
const PREM_ITEMS = { 1: 'hat-wizard', 6: 'cape-galaxy', 10: 'wings-fire', 14: 'hat-halo', 18: 'cape-nebula', 22: 'wings-crystal', 26: 'hat-crown', 30: 'wings-shadow' }; // 8 Items in der Premium-Reihe
const reward = (L, track) => {
  const item = (track === 'free' ? FREE_ITEMS : PREM_ITEMS)[L] || null;
  const coins = track === 'free' ? 20 + 5 * L + (L === LEVELS ? 300 : 0) : 40 + 10 * L + (L === LEVELS ? 600 : 0);
  return { coins, item };
};
const TRACKS = ['free', 'premium'];
const endMs = () => Date.parse(SEASON.end + 'T23:59:59+01:00');

module.exports = ({ now = () => Date.now() } = {}) => {
  const levelOf = earned => Math.min(LEVELS, Math.floor(Math.max(0, earned) / PER_LEVEL));
  // PD = Pass-Stand je Konto (eigene Tabelle), QD = Quest-Stand (nur lesen: verdiente Sterne). Neue Season = Pass von vorn, Cloudy+ bleibt.
  function P(PD, key, earned) {
    const o = PD[key];
    if (!o || o.season !== SEASON.id) PD[key] = { season: SEASON.id, base: o ? (earned || 0) : 0, free: [], prem: [], plus: (o && o.plus) || 0 };
    return PD[key];
  }
  const earnedOf = (QD, key) => ((QD[key] && QD[key].stars && QD[key].stars.earned) || 0);
  const plusOn = p => (p.plus || 0) > now();
  function view(PD, QD, key) {
    const earned = earnedOf(QD, key), p = P(PD, key, earned), lv = levelOf(earned - p.base);
    const rows = []; for (let L = 1; L <= LEVELS; L++) rows.push({ level: L, need: L * PER_LEVEL, free: { ...reward(L, 'free'), claimed: p.free.includes(L) }, premium: { ...reward(L, 'premium'), claimed: p.prem.includes(L) } });
    const into = Math.max(0, earned - p.base) - lv * PER_LEVEL;
    return { season: { ...SEASON, endsIn: Math.max(0, endMs() - now()), over: now() > endMs() }, level: lv, max: LEVELS, stars: earned - p.base, intoLevel: lv >= LEVELS ? 0 : into, perLevel: PER_LEVEL, plus: plusOn(p), plusUntil: p.plus || 0, rows };
  }
  // Prüft einen Abhol-Wunsch. Gibt { ok, coins, item } zurück; das Gutschreiben (Coins, Item) macht der Aufrufer.
  function claim(PD, QD, key, level, track) {
    level = Math.floor(+level); track = String(track || '');
    if (!(level >= 1 && level <= LEVELS) || !TRACKS.includes(track)) return { ok: false, code: 'unknown' };
    if (now() > endMs()) return { ok: false, code: 'season_over' };
    const p = P(PD, key, earnedOf(QD, key));
    if (levelOf(earnedOf(QD, key) - p.base) < level) return { ok: false, code: 'locked' };
    const list = track === 'free' ? p.free : p.prem;
    if (list.includes(level)) return { ok: false, code: 'claimed' };
    if (track === 'premium' && !plusOn(p)) return { ok: false, code: 'need_plus' };
    const r = reward(level, track); list.push(level);
    return { ok: true, level, track, coins: r.coins, item: r.item };
  }
  function grantPlus(PD, key, days) { // Cloudy+ setzen (Admin oder später die Zahlung): days = 0 beendet es
    const p = P(PD, key); days = Math.max(0, Math.min(3650, Math.floor(+days) || 0));
    p.plus = days ? Math.max(now(), p.plus || 0) + days * 864e5 : 0; return { ok: true, plus: p.plus };
  }
  function plusUntil(PD, key, ms) { // Cloudy+ bis zu einem Zeitpunkt (nur verlängern, nie kürzen) – für bezahlte Zeiträume von Stripe
    const p = P(PD, key); ms = Math.floor(+ms); if (!Number.isFinite(ms) || ms <= 0 || ms > now() + 400 * 864e5) return { ok: false }; if (ms > (p.plus || 0)) p.plus = ms; return { ok: true, plus: p.plus };
  }
  return { view, claim, grantPlus, plusUntil, levelOf, reward, SEASON, LEVELS, PER_LEVEL };
};
