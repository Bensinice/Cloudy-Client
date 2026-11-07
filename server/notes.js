// Cloudy Notes (Server): Notizen je Konto, Prompt-Erstellung ueber die OpenAI-API, verschluesselter API-Key, Entwicklungsstatus, Tour-Stand.
// Daten liegen in der vorhandenen MySQL-Datenbank (Tabellen cloudy_notes, cloudy_notes_hist, cloudy_notes_user). Kein zusaetzlicher Server.
// Umgebungsvariablen (alle optional): NOTES_SECRET (Schluessel fuer die API-Key-Verschluesselung; sonst wird er vom Anmelde-Geheimnis abgeleitet),
// NOTES_OPENAI_MODEL (Standardmodell, sonst gpt-4.1), NOTES_OPENAI_BASE (nur fuer Tests/Proxy, Standard https://api.openai.com/v1).
const crypto = require('crypto');
// Versionen: SERVER = Stand dieses Moduls, API = Schnittstelle (steigt nur bei inkompatiblen Aenderungen), MIN_CLIENT_API = aelteste API, die der Server noch bedient.
const VERSION = { server: '1.0.0', api: 1, minClientApi: 1 };
const LIM = { title: 120, body: 60000, prompt: 120000, notes: 500, hist: 15, histEvery: 10 * 60 * 1000, perMin: 6, perDay: 80 };
// Anbieter (alle sprechen das OpenAI-Chat-Format). Gemini und Groq haben laut Anbieter eine kostenlose Stufe (mit Limits); ChatGPT Free selbst hat keine API.
const PROVIDERS = {
  openai: { id: 'openai', name: 'OpenAI (ChatGPT)', base: 'https://api.openai.com/v1', def: 'gpt-4.1', keyRe: /^sk-[A-Za-z0-9_\-]{20,}$/, keyHint: 'sk-…', keyUrl: 'https://platform.openai.com/api-keys', free: false },
  gemini: { id: 'gemini', name: 'Google Gemini', base: 'https://generativelanguage.googleapis.com/v1beta/openai', def: 'gemini-flash-latest', keyRe: /^(?!sk-)[A-Za-z0-9_\-.]{20,300}$/, keyHint: 'API Key (z. B. AIza… oder AQ.…)', keyUrl: 'https://aistudio.google.com/apikey', free: true },
  groq: { id: 'groq', name: 'Groq (Llama)', base: 'https://api.groq.com/openai/v1', def: 'llama-3.3-70b-versatile', keyRe: /^(?!sk-)[A-Za-z0-9_\-.]{20,300}$/, keyHint: 'API Key (z. B. gsk_…)', keyUrl: 'https://console.groq.com/keys', free: true },
};
// Passendes Standardmodell aus der Modellliste des Anbieters waehlen (wenn das voreingestellte nicht mehr existiert)
const pickModel = (P, ids, skip) => {
  ids = (ids || []).filter(id => !(skip || []).includes(id));
  const v = id => (id.match(/(\d+(?:\.\d+)?)/) || [0, 0])[1] * 1; const bad = /(audio|realtime|tts|transcribe|image|embedding|moderation|search|instruct|whisper|guard|vision|preview|exp|thinking|learnlm|gemma|robotics|live|computer)/i;
  const ok = ids.filter(id => !bad.test(id));
  const rank = P.id === 'gemini' ? [/^gemini-flash-latest$/, /^gemini-[\d.]+-flash$/, /flash(?!-lite)/, /flash/, /^gemini-/] : P.id === 'groq' ? [/llama-3\.3.*70b/, /llama.*70b/, /llama/, /./] : [/^gpt-4\.1$/, /^gpt-4o$/, /^gpt-/];
  for (const re of rank) { const m = ok.filter(id => re.test(id)).sort((a, b) => v(b) - v(a) || a.length - b.length); if (m.length) return m[0]; }
  return '';
};
const provOf = u => PROVIDERS[u && u.provider] || PROVIDERS.openai;
const STATES = ['idle', 'starting', 'planning', 'exploring', 'awaiting', 'running', 'testing', 'done', 'error', 'cancelled'];
const CLOUDY_CONTEXT = `Das Projekt "Cloudy" (GitHub-Repo, Branch main) besteht aus:
- Electron-Launcher (Windows/macOS/Linux): main.js (Hauptprozess, IPC), preload.js (window.cloudy.*), index.html, assets/js/*.js (je Seite eine Datei, Seiten #p-<name>), assets/css/app.css + themes/, Zweisprachigkeit ueber window.t / T(de,en) und assets/js/i18n-add.js (EN-Texte), lib/*.js.
- Fabric-Client-Mod fuer Minecraft 1.21.4 in client-src/ (Java, wird nur per GitHub-Action kompiliert).
- Konto-Server in server/ (Express + MySQL, app.js, Tabelle cloudy_users, JSON-Blobs in cloudy_kv, Hilfsmodule wie pass.js, quests.js, notes.js; Routen mit auth()/admin()-Wrappern).
- Website in server/site/, iOS-Huelle in ios/.
Regeln: bestehende Funktionen nicht beschaedigen; keine Geheimnisse (Schluessel, Passwoerter, Tokens) in Dateien oder Logs; keine Platzhalter oder Fake-Funktionen; Aenderungen klein und nachvollziehbar halten; nach jeder Aenderung mit "node --check" bzw. vorhandenen Tests pruefen; Versionsnummer (package.json, CLIENT_BUILD in main.js, assets/changelog.json und changelog-en.json, client-src/.../cloudy-cos/build-<version>.txt) nur dann erhoehen, wenn die Aufgabe ein Release verlangt. Nicht committen oder pushen: das macht der Besitzer selbst.`;
const SYSTEM_PROMPT = `Du bist ein erfahrener Software-Architekt und Prompt-Engineer. Du bekommst die rohen Notizen eines Entwicklers fuer sein Projekt "Cloudy". Wandle sie in EINEN professionellen, ausfuehrlichen Auftrags-Prompt fuer den KI-Programmierassistenten Claude (Claude Code) um, der direkt im Projektordner arbeitet.

Der Prompt muss:
- ALLE Anforderungen aus den Notizen vollstaendig uebernehmen (nichts weglassen, nichts erfinden, was dem widerspricht); unklare Stellen sinnvoll interpretieren und die Annahme ausdruecklich nennen;
- technische Details ergaenzen (betroffene Bereiche, Datenfluss, Randfaelle, moegliche Bugs, Fehlerbehandlung, Sicherheit);
- Claude anweisen, ZUERST das bestehende Projekt und die Architektur zu untersuchen, bestehende Muster und Komponenten wiederzuverwenden und bestehende Funktionen nicht unnoetig zu veraendern;
- konkrete Implementierungsschritte und Abnahmekriterien nennen;
- Tests und Pruefungen verlangen (Syntaxpruefung, vorhandene Tests, neue Tests fuer neue Logik) und am Ende eine ehrliche Zusammenfassung (geaenderte Dateien, was getestet wurde, was nicht);
- in der Sprache der Notizen geschrieben sein (meist Deutsch), klar gegliedert mit Ueberschriften und Listen.
Gib NUR den fertigen Prompt aus, ohne Vorwort und ohne Erklaerung davor oder danach.

Projektkontext, den Claude schon kennt (nicht wiederholen, nur beruecksichtigen):
` + CLOUDY_CONTEXT;

const key32 = (secret) => crypto.scryptSync(String(process.env.NOTES_SECRET || secret || ''), 'cloudy-notes-v1', 32);
function encrypt(plain, secret) { const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', key32(secret), iv), ct = Buffer.concat([c.update(String(plain), 'utf8'), c.final()]); return ['v1', iv.toString('base64'), c.getAuthTag().toString('base64'), ct.toString('base64')].join(':'); }
function decrypt(blob, secret) { const [v, iv, tag, ct] = String(blob || '').split(':'); if (v !== 'v1' || !ct) throw new Error('bad'); const d = crypto.createDecipheriv('aes-256-gcm', key32(secret), Buffer.from(iv, 'base64')); d.setAuthTag(Buffer.from(tag, 'base64')); return Buffer.concat([d.update(Buffer.from(ct, 'base64')), d.final()]).toString('utf8'); }
const validKey = k => typeof k === 'string' && /^[A-Za-z0-9_\-.]{20,300}$/.test(k.trim());
const last4 = k => '…' + String(k).slice(-4);
const clip = (s, n) => String(s == null ? '' : s).slice(0, n);
const newId = () => crypto.randomBytes(9).toString('hex');

// ---- Datenzugriff: MySQL (produktiv) oder Speicher (Tests) ----
function sqlRepo(db) {
  const pn = r => r && ({ ...r, deleted: !!r.deleted, created: +r.created, updated: +r.updated, prompt_at: +r.prompt_at || 0, build: r.build ? (() => { try { return JSON.parse(r.build); } catch { return null; } })() : null });
  return {
    async init() {
      await db.query('CREATE TABLE IF NOT EXISTS cloudy_notes (id VARCHAR(24) PRIMARY KEY, user_key VARCHAR(40) NOT NULL, title VARCHAR(200), body MEDIUMTEXT, prompt MEDIUMTEXT NULL, prompt_at BIGINT DEFAULT 0, prompt_model VARCHAR(60) DEFAULT \'\', build TEXT NULL, created BIGINT, updated BIGINT, deleted TINYINT DEFAULT 0, INDEX (user_key, updated))');
      await db.query('CREATE TABLE IF NOT EXISTS cloudy_notes_hist (hid BIGINT AUTO_INCREMENT PRIMARY KEY, note_id VARCHAR(24), user_key VARCHAR(16), title VARCHAR(200), body MEDIUMTEXT, t BIGINT, INDEX (note_id))');
      await db.query('CREATE TABLE IF NOT EXISTS cloudy_notes_user (user_key VARCHAR(16) PRIMARY KEY, openai_enc TEXT NULL, last4 VARCHAR(8) DEFAULT \'\', model VARCHAR(60) DEFAULT \'\', tested BIGINT DEFAULT 0, tour TEXT NULL)');
      for (const t of ['cloudy_notes', 'cloudy_notes_hist', 'cloudy_notes_user']) await db.query('ALTER TABLE ' + t + ' MODIFY user_key VARCHAR(40) NOT NULL').catch(() => {}); // Kontoschluessel koennen laenger als 16 Zeichen sein
      await db.query("ALTER TABLE cloudy_notes_user ADD COLUMN provider VARCHAR(20) DEFAULT 'openai'").catch(() => {}); // aeltere Tabellen nachruesten
    },
    async list(u, since) { const [r] = await db.query('SELECT * FROM cloudy_notes WHERE user_key=? AND updated>? ORDER BY updated DESC', [u, since || 0]); return r.map(pn); },
    async get(u, id) { const [r] = await db.query('SELECT * FROM cloudy_notes WHERE user_key=? AND id=?', [u, id]); return pn(r[0]) || null; },
    async count(u) { const [r] = await db.query('SELECT COUNT(*) n FROM cloudy_notes WHERE user_key=? AND deleted=0', [u]); return +r[0].n; },
    async exists(id) { const [r] = await db.query('SELECT 1 FROM cloudy_notes WHERE id=?', [id]); return r.length > 0; },
    async put(n) { await db.query('REPLACE INTO cloudy_notes (id,user_key,title,body,prompt,prompt_at,prompt_model,build,created,updated,deleted) VALUES (?,?,?,?,?,?,?,?,?,?,?)', [n.id, n.user_key, n.title, n.body, n.prompt, n.prompt_at || 0, n.prompt_model || '', n.build ? JSON.stringify(n.build) : null, n.created, n.updated, n.deleted ? 1 : 0]); },
    async histAdd(h) { await db.query('INSERT INTO cloudy_notes_hist (note_id,user_key,title,body,t) VALUES (?,?,?,?,?)', [h.note_id, h.user_key, h.title, h.body, h.t]); const [r] = await db.query('SELECT hid FROM cloudy_notes_hist WHERE note_id=? ORDER BY hid DESC LIMIT 100 OFFSET ?', [h.note_id, LIM.hist]); if (r.length) await db.query('DELETE FROM cloudy_notes_hist WHERE hid IN (?)', [r.map(x => x.hid)]); },
    async hist(u, id) { const [r] = await db.query('SELECT hid,title,body,t FROM cloudy_notes_hist WHERE user_key=? AND note_id=? ORDER BY hid DESC', [u, id]); return r.map(x => ({ hid: +x.hid, title: x.title, body: x.body, t: +x.t })); },
    async move(from, to) { // Notizen eines Schluessels auf ein Konto uebertragen (nur wenn Ziel die ID nicht schon hat)
      const [r] = await db.query('UPDATE cloudy_notes SET user_key=? WHERE user_key=?', [to, from]); await db.query('UPDATE cloudy_notes_hist SET user_key=? WHERE user_key=?', [to, from]); return r.affectedRows || 0;
    },
    async user(u) { const [r] = await db.query('SELECT * FROM cloudy_notes_user WHERE user_key=?', [u]); return r[0] || { user_key: u, openai_enc: null, last4: '', model: '', tested: 0, tour: null }; },
    async putUser(x) { await db.query('REPLACE INTO cloudy_notes_user (user_key,openai_enc,last4,model,tested,tour,provider) VALUES (?,?,?,?,?,?,?)', [x.user_key, x.openai_enc, x.last4 || '', x.model || '', x.tested || 0, x.tour || null, x.provider || 'openai']); },
  };
}
function memRepo() {
  const N = new Map(), H = [], U = new Map(); let hid = 1;
  return {
    async init() {}, async list(u, s) { return [...N.values()].filter(n => n.user_key === u && n.updated > (s || 0)).sort((a, b) => b.updated - a.updated).map(n => ({ ...n })); },
    async get(u, id) { const n = N.get(id); return n && n.user_key === u ? { ...n } : null; }, async count(u) { return [...N.values()].filter(n => n.user_key === u && !n.deleted).length; }, async exists(id) { return N.has(id); }, async put(n) { N.set(n.id, { ...n }); },
    async histAdd(h) { H.push({ hid: hid++, ...h }); const mine = H.filter(x => x.note_id === h.note_id).sort((a, b) => b.hid - a.hid); for (const x of mine.slice(LIM.hist)) H.splice(H.indexOf(x), 1); },
    async hist(u, id) { return H.filter(x => x.user_key === u && x.note_id === id).sort((a, b) => b.hid - a.hid).map(x => ({ ...x })); },
    async move(from, to) { let c = 0; for (const n of N.values()) if (n.user_key === from) { n.user_key = to; c++; } for (const x of H) if (x.user_key === from) x.user_key = to; return c; },
    async user(u) { return { ...(U.get(u) || { user_key: u, openai_enc: null, last4: '', model: '', tested: 0, tour: null }) }; }, async putUser(x) { U.set(x.user_key, { ...x }); },
  };
}

function create({ repo, getSecret, fetchImpl, now = Date.now }) {
  const doFetch = (...a) => (fetchImpl || fetch)(...a);
  const base = p => (process.env.NOTES_OPENAI_BASE || p.base).replace(/\/+$/, '');
  const defModel = p => (p.id === 'openai' && process.env.NOTES_OPENAI_MODEL) || p.def;
  const buckets = new Map();
  const rate = (u, name, max, win) => { const k = u + '|' + name, t = now(), a = (buckets.get(k) || []).filter(x => t - x < win); if (a.length >= max) { buckets.set(k, a); return false; } a.push(t); buckets.set(k, a); return true; };
  const err = (status, error, extra) => ({ status, json: { ok: false, error, ...extra } }), ok = (json) => ({ status: 200, json: { ok: true, ...json } });
  const pub = n => ({ id: n.id, title: n.title, body: n.body, prompt: n.prompt || '', promptAt: n.prompt_at || 0, promptModel: n.prompt_model || '', build: n.build || null, created: n.created, updated: n.updated, deleted: !!n.deleted });
  const openaiErr = (status, j, pn) => {
    pn = pn || 'OpenAI'; if (Array.isArray(j)) j = j[0] || {}; // Gemini liefert Fehler teils als Liste
    const code = j && j.error && (j.error.code || j.error.type) || '';
    if (status === 401) return 'Der API Key von ' + pn + ' ist ungültig oder wurde widerrufen. Erstelle einen neuen Key.';
    if (status === 403) return 'Dein ' + pn + '-Konto hat keinen Zugriff auf dieses Modell oder diese Region.';
    if (status === 404) return 'Dieses Modell gibt es bei ' + pn + ' nicht oder dein Konto darf es nicht benutzen. Wähle ein anderes Modell (AI Connections).' + (j && j.error && j.error.message ? ' Antwort von ' + pn + ': ' + clip(String(j.error.message).replace(/(key|sk-)[=A-Za-z0-9_\-*.]{8,}/gi, '…'), 200) : '');
    if (status === 429) return /quota|billing/i.test(code) ? 'Dein Guthaben bei ' + pn + ' ist aufgebraucht.' : pn + '-Limit erreicht (bei kostenlosen Stufen sind die Limits klein). Warte einen Moment und versuche es erneut.';
    if (status === 400) return pn + ' hat die Anfrage abgelehnt' + (j && j.error && j.error.message ? ': ' + clip(String(j.error.message).replace(/sk-[A-Za-z0-9_\-*]+/g, '…'), 200) : '.');
    return status >= 500 ? pn + ' hat gerade Probleme (Fehler ' + status + '). Versuche es gleich noch einmal.' : pn + '-Fehler ' + status + '.';
  };
  // Google Gemini direkt (nicht ueber die OpenAI-kompatible Schicht): Rueckfall, wenn diese 404 liefert
  async function geminiNative(key, model, system, user) {
    let r; try { r = await doFetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent', { method: 'POST', headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' }, body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: user }] }] }), signal: AbortSignal.timeout(90000) }); } catch (e) { return { net: true, error: 'Google Gemini ist nicht erreichbar (Internet prüfen).' }; }
    const j = await r.json().catch(() => ({})); if (!r.ok) return { status: r.status, error: openaiErr(r.status, j, 'Google Gemini') };
    const c = j.candidates && j.candidates[0], text = c && c.content && (c.content.parts || []).map(x => x.text || '').join('').trim();
    return text ? { j: { choices: [{ message: { content: text }, finish_reason: c.finishReason === 'MAX_TOKENS' ? 'length' : 'stop' }] } } : { status: 502, error: 'Google Gemini hat keinen Text geliefert' + (c && c.finishReason ? ' (' + c.finishReason + ')' : '') + '.' };
  }
  async function userKey(me) { const u = await repo.user(me); if (!u.openai_enc) return { u, key: '' }; try { return { u, key: decrypt(u.openai_enc, getSecret()) }; } catch { return { u, key: '', broken: true }; } }
  async function oa(key, path, opt, p) {
    p = p || PROVIDERS.openai; let r; try { r = await doFetch(base(p) + path, { ...opt, headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(opt && opt.ms || 90000) }); } catch (e) { return { net: true, error: e && e.name === 'TimeoutError' ? p.name + ' hat zu lange nicht geantwortet.' : p.name + ' ist nicht erreichbar (Internet prüfen).' }; }
    const j = await r.json().catch(() => ({})); return r.ok ? { j } : { status: r.status, error: openaiErr(r.status, j, p.name) };
  }

  return {
    async list(me, b) { const l = await repo.list(me, +b.since || 0); return ok({ notes: l.map(pub), now: now() }); },
    async save(me, b) {
      if (!rate(me, 'save', 240, 60000)) return err(429, 'Zu viele Speichervorgänge, warte kurz.');
      if (typeof b.body === 'string' && b.body.length > LIM.body) return err(400, `Die Notiz ist zu lang (höchstens ${LIM.body} Zeichen). Sie wurde nicht gespeichert, damit nichts abgeschnitten wird.`);
      const t = now(), title = clip(b.title, LIM.title).trim() || 'Neue Notiz', body = clip(b.body, LIM.body);
      let n = b.id ? await repo.get(me, String(b.id)) : null;
      if (b.id && !n && !/^[a-f0-9]{18}$/.test(String(b.id))) return err(400, 'Ungültige Notiz.');
      if (!n) { if (await repo.count(me) >= LIM.notes) return err(400, `Du kannst höchstens ${LIM.notes} Notizen haben.`); const want = b.id && /^[a-f0-9]{18}$/.test(b.id) && !(await repo.exists(b.id)); n = { id: want ? b.id : newId(), user_key: me, title, body, prompt: null, prompt_at: 0, prompt_model: '', build: null, created: t, updated: t, deleted: false }; await repo.put(n); return ok({ note: pub(n) }); }
      if (b.base != null && n.updated > +b.base && (n.body !== body || n.title !== title) && !b.force) return { status: 409, json: { ok: false, conflict: true, error: 'Diese Notiz wurde auf einem anderen Gerät geändert.', note: pub(n) } };
      const changed = n.body !== body || n.title !== title, last = changed ? (await repo.hist(me, n.id))[0] : null;
      if (changed && n.body && (!last || t - last.t > LIM.histEvery)) await repo.histAdd({ note_id: n.id, user_key: me, title: n.title, body: n.body, t });
      n.title = title; n.body = body; n.updated = Math.max(t, n.updated + 1); n.deleted = false; await repo.put(n); return ok({ note: pub(n) });
    },
    async del(me, b) { const n = await repo.get(me, String(b.id || '')); if (!n) return err(404, 'Notiz nicht gefunden.'); n.deleted = !b.undo; n.updated = Math.max(now(), n.updated + 1); await repo.put(n); return ok({ note: pub(n) }); },
    async history(me, b) { const n = await repo.get(me, String(b.id || '')); if (!n) return err(404, 'Notiz nicht gefunden.'); return ok({ history: await repo.hist(me, n.id) }); },
    async restore(me, b) { const n = await repo.get(me, String(b.id || '')); if (!n) return err(404, 'Notiz nicht gefunden.'); const h = (await repo.hist(me, n.id)).find(x => x.hid === +b.hid); if (!h) return err(404, 'Version nicht gefunden.'); await repo.histAdd({ note_id: n.id, user_key: me, title: n.title, body: n.body, t: now() }); n.title = h.title; n.body = h.body; n.updated = Math.max(now(), n.updated + 1); await repo.put(n); return ok({ note: pub(n) }); },
    async exportAll(me) { return ok({ notes: (await repo.list(me, 0)).map(pub), exported: now() }); },
    // ---- Prompt ----
    async prompt(me, b) {
      if (!rate(me, 'pmin', LIM.perMin, 60000) || !rate(me, 'pday', LIM.perDay, 86400000)) return err(429, 'Zu viele Prompt-Anfragen. Warte kurz.');
      const n = await repo.get(me, String(b.id || '')); if (!n || n.deleted) return err(404, 'Notiz nicht gefunden.');
      if (!n.body.trim()) return err(400, 'Die Notiz ist leer – schreibe erst deine Idee auf.');
      const { u, key, broken } = await userKey(me); if (!key) return err(400, broken ? 'Der gespeicherte API-Key lässt sich nicht mehr lesen. Bitte neu eingeben.' : 'Noch keine KI für Prompts verbunden. Trage unter „AI Connections“ einen API Key ein (Google Gemini und Groq sind kostenlos) – oder nutze „Manuell mit ChatGPT“.', { setup: 'openai' });
      const P = provOf(u), model = clip(b.model || u.model || defModel(P), 60);
      const user = (b.extra ? 'Zusätzliche Hinweise des Entwicklers: ' + clip(b.extra, 2000) + '\n\n' : '') + 'NOTIZ "' + n.title + '":\n' + n.body;
      const r = await oa(key, '/chat/completions', { method: 'POST', body: JSON.stringify({ model, messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: user }] }) }, P);
      let r2 = r, avail = [], tried = [model];
      if (r2.error && r2.status === 404 && P.id === 'gemini') { const nr = await geminiNative(key, model.replace(/^models\//, ''), SYSTEM_PROMPT, user); if (!nr.error) r2 = nr; else if (nr.status && ![404, 502].includes(nr.status)) r2 = nr; }
      if (r2.error && r2.status === 404) { // Modell gibt es nicht: Liste holen; ohne eigene Modellwahl ein vorhandenes nehmen und wiederholen
        const ml = await oa(key, '/models', { method: 'GET', ms: 20000 }, P); avail = ml.j ? (ml.j.data || []).map(x => String(x.id).replace(/^models\//, '')) : [];
        const skip = [model]; // das gewaehlte Modell steht in der Liste, antwortet aber mit 404 (z. B. fuer neue Konten gesperrt): bis zu 3 andere der Reihe nach probieren
        const listed = avail.includes(model); // nur wenn das Modell in der Liste steht (also existiert, aber nicht nutzbar ist); ein ungueltiges, selbst getipptes Modell wird nie heimlich ersetzt
        for (let i = 0; i < 3 && !b.model && (!u.model || listed) && r2.error && r2.status === 404; i++) {
          const pick = pickModel(P, avail, skip); if (!pick) break; skip.push(pick); tried.push(pick);
          const rr = await oa(key, '/chat/completions', { method: 'POST', body: JSON.stringify({ model: pick, messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: user }] }) }, P);
          if (!rr.error) { r2 = rr; u.model = pick; await repo.putUser(u); } else r2 = rr;
        }
      }
      if (r2.error) { const r = r2; if (r.status === 401) { u.tested = 0; await repo.putUser(u); } const hint = r.status === 404 ? ' (Versucht: ' + tried.join(', ') + (avail.length ? '. Bei deinem Konto verfügbar: ' + avail.filter(x => !/(embedding|aqa|imagen|veo|tts|audio)/i.test(x)).slice(0, 12).join(', ') : '. Die Modellliste konnte nicht geladen werden – Key und Internet prüfen') + '.)' : ''; return err(r.net ? 502 : r.status === 429 ? 429 : 502, r.error + hint, { retry: true, models: avail.slice(0, 40) }); }
      const ch = r2.j.choices && r2.j.choices[0], text = ch && ch.message && String(ch.message.content || '').trim();
      if (!text) return err(502, P.name + ' hat keinen Prompt geliefert. Versuche es erneut.', { retry: true });
      n.prompt = clip(text, LIM.prompt); n.prompt_at = now(); n.prompt_model = u.model || model; n.build = null; await repo.put(n); // Notiz-Text bleibt unveraendert
      return ok({ note: pub(n), truncated: ch.finish_reason === 'length' });
    },
    async promptSave(me, b) { const n = await repo.get(me, String(b.id || '')); if (!n) return err(404, 'Notiz nicht gefunden.'); n.prompt = clip(b.prompt, LIM.prompt); n.prompt_at = now(); n.updated = Math.max(now(), n.updated + 1); await repo.put(n); return ok({ note: pub(n) }); },
    async buildStatus(me, b) {
      const n = await repo.get(me, String(b.id || '')); if (!n) return err(404, 'Notiz nicht gefunden.'); const s = b.build || {};
      n.build = { state: STATES.includes(s.state) ? s.state : 'idle', phase: clip(s.phase, 60), progress: Math.max(0, Math.min(100, +s.progress || 0)), task: clip(s.task, 200), files: (Array.isArray(s.files) ? s.files : []).slice(0, 100).map(x => clip(x, 200)), error: clip(s.error, 1000), summary: clip(s.summary, 6000), log: (Array.isArray(s.log) ? s.log : []).slice(-40).map(x => clip(x, 200)), t: now() };
      await repo.put(n); return ok({ build: n.build });
    },
    async moveAll(from, to) { return repo.move ? repo.move(from, to) : 0; }, // Server-App: bisherige Notizen auf ein Konto uebertragen
    async info() { return ok({ ...VERSION, now: now() }); }, // fuer Versions-/Kompatibilitaetspruefung der Apps
    // ---- Manuell (ohne API): fertige Anfrage zum Einfuegen in ChatGPT (auch die kostenlose Version) ----
    async manual(me, b) {
      const n = await repo.get(me, String(b.id || '')); if (!n || n.deleted) return err(404, 'Notiz nicht gefunden.'); if (!n.body.trim()) return err(400, 'Die Notiz ist leer – schreibe erst deine Idee auf.');
      return ok({ text: SYSTEM_PROMPT + '\n\n---\nNOTIZ "' + n.title + '":\n' + n.body });
    },
    // ---- Einstellungen / Verbindung ----
    async settings(me, b) {
      const u = await repo.user(me); b = b || {};
      if (typeof b.provider === 'string' && PROVIDERS[b.provider] && b.provider !== provOf(u).id) { u.provider = b.provider; u.openai_enc = null; u.last4 = ''; u.tested = 0; u.model = ''; } // anderer Anbieter = anderer Key
      if (b.clearKey) { u.openai_enc = null; u.last4 = ''; u.tested = 0; }
      if (typeof b.openaiKey === 'string' && b.openaiKey.trim()) { const k = b.openaiKey.trim(); if (!provOf(u).keyRe.test(k)) return err(400, 'Das sieht nicht wie ein ' + provOf(u).name + '-Key aus (zu kurz oder enthält ungültige Zeichen). Kopiere den kompletten Key, ohne Leerzeichen.'); if (!rate(me, 'key', 20, 3600000)) return err(429, 'Zu viele Änderungen, warte etwas.'); u.openai_enc = encrypt(k, getSecret()); u.last4 = last4(k); u.tested = 0; }
      if (typeof b.model === 'string') u.model = /^[A-Za-z0-9._:\-]{0,60}$/.test(b.model.trim()) ? b.model.trim() : u.model;
      if (b.tour && typeof b.tour === 'object') u.tour = JSON.stringify({ done: !!b.tour.done, step: Math.max(0, Math.min(7, +b.tour.step || 0)), skipped: !!b.tour.skipped, t: now() });
      await repo.putUser(u);
      let tour = null; try { tour = u.tour ? JSON.parse(u.tour) : null; } catch {}
      const P = provOf(u); return ok({ openai: { set: !!u.openai_enc, last4: u.last4 || '', model: u.model || '', default: defModel(P), tested: +u.tested || 0, provider: P.id, name: P.name, keyUrl: P.keyUrl, keyHint: P.keyHint }, providers: Object.values(PROVIDERS).map(x => ({ id: x.id, name: x.name, free: x.free, keyUrl: x.keyUrl, keyHint: x.keyHint, def: x.def })), tour });
    },
    async test(me) {
      if (!rate(me, 'test', 12, 600000)) return err(429, 'Zu viele Tests, warte kurz.');
      const { u, key, broken } = await userKey(me); if (!key) return err(400, broken ? 'Der gespeicherte Key lässt sich nicht lesen – bitte neu eingeben.' : 'Noch kein API Key gespeichert.');
      const P = provOf(u); const r = await oa(key, '/models', { method: 'GET', ms: 20000 }, P); if (r.error) return err(r.net ? 502 : 400, r.error);
      u.tested = now(); await repo.putUser(u); const ids = (r.j.data || []).map(x => String(x.id).replace(/^models\//, '')).filter(id => (P.id !== 'openai' || /^(gpt|o\d|chatgpt)/.test(id)) && !/(audio|realtime|tts|transcribe|image|embedding|moderation|search|instruct|whisper|guard|vision)/.test(id)).sort().slice(0, 80);
      return ok({ models: ids, tested: u.tested });
    },
  };
}
// Verbindung zu den Express-Routen (alle POST wie im restlichen Cloudy-Server)
function mount(app, auth, h) {
  const run = f => auth(async (req, res, me) => { const r = await f(me.name_key, req.body || {}); res.status(r.status).json(r.json); });
  const R = { list: 'list', save: 'save', delete: 'del', history: 'history', restore: 'restore', export: 'exportAll', prompt: 'prompt', 'prompt-save': 'promptSave', 'build-status': 'buildStatus', settings: 'settings', 'openai/test': 'test', manual: 'manual', info: 'info' };
  for (const [p, k] of Object.entries(R)) if (typeof h[k] === 'function') app.post('/notes/' + p, run(h[k])); // nur was uebergeben wurde
  app.get('/notes/info', (_q, res) => { res.set('Cache-Control', 'no-store'); res.json({ ok: true, ...VERSION }); }); // ohne Anmeldung (Service-Worker/App-Start)
}
module.exports = { VERSION, PROVIDERS, create, sqlRepo, memRepo, mount, encrypt, decrypt, SYSTEM_PROMPT, LIM };
