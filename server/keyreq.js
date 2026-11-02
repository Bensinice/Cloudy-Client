// Request Key: Wer noch keinen Zugangscode hat, schickt eine Anfrage. Der Owner gibt sie im Admin-Bereich frei oder lehnt sie ab.
// Bei Freigabe entsteht ein einmaliger Zugangscode (7 Tage gültig), den der Anfragende automatisch abruft. Reines Modul (ohne Express/MySQL) – testbar.
const crypto = require('crypto');
module.exports = ({ get, save, makeGate, now = () => Date.now() }) => {
  const sha = s => crypto.createHash('sha256').update(String(s)).digest('hex'), ipT = new Map();
  const pub = r => ({ id: r.id, name: r.name, note: r.note, status: r.status, t: r.t, decidedAt: r.decidedAt || 0, adminNote: r.adminNote || '', code: r.status === 'approved' ? r.code : '' });
  return {
    async create({ name, note, ip }) {
      const R = get(); name = String(name || '').trim(); note = String(note || '').trim().slice(0, 200);
      if (!/^[A-Za-z0-9_]{3,16}$/.test(name)) return { ok: false, error: 'Der Name braucht 3 bis 16 Zeichen (Buchstaben, Zahlen, _).' };
      const t = now(), h = (ipT.get(ip) || []).filter(x => t - x < 3600e3); if (h.length >= 3) return { ok: false, error: 'Zu viele Anfragen. Bitte versuche es in einer Stunde erneut.' };
      const open = Object.values(R).filter(r => r.status === 'pending');
      if (open.length >= 300) return { ok: false, error: 'Im Moment werden keine neuen Anfragen angenommen.' };
      if (open.some(r => r.name.toLowerCase() === name.toLowerCase())) return { ok: false, error: 'Für diesen Namen gibt es schon eine offene Anfrage.' };
      h.push(t); ipT.set(ip, h);
      const id = crypto.randomBytes(6).toString('hex'), secret = crypto.randomBytes(16).toString('hex');
      R[id] = { id, name, note, status: 'pending', t, secretHash: sha(secret) }; await save(); return { ok: true, id, secret };
    },
    status(id, secret) { // der Anfragende fragt seinen Stand ab (nur mit dem geheimen Schlüssel aus create)
      const r = get()[String(id || '')]; if (!r || sha(secret) !== r.secretHash) return { ok: false, error: 'Anfrage nicht gefunden.' };
      return { ok: true, ...pub(r) };
    },
    list() { return Object.values(get()).sort((a, b) => b.t - a.t).map(pub); },
    async decide(id, action, adminNote) {
      const r = get()[String(id || '')]; if (!r) return { ok: false, error: 'Anfrage nicht gefunden.' };
      if (r.status !== 'pending') return { ok: false, error: 'Diese Anfrage wurde schon bearbeitet.' };
      if (action === 'approve') { r.code = await makeGate({ uses: 1, days: 7 }); r.status = 'approved'; }
      else if (action === 'reject') r.status = 'rejected'; else return { ok: false, error: 'Unbekannte Aktion.' };
      r.adminNote = String(adminNote || '').slice(0, 120); r.decidedAt = now(); await save(); return { ok: true, ...pub(r) };
    },
    async purge(maxAgeDays = 30) { const R = get(), t = now(); let n = 0; for (const id in R) if (R[id].status !== 'pending' && t - (R[id].decidedAt || R[id].t) > maxAgeDays * 864e5) { delete R[id]; n++; } if (n) await save(); return n; },
  };
};
