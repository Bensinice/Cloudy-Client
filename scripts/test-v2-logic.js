// Tests für die neue Cloudy-2.0-Logik (ohne Netzwerk/Datenbank): Microsoft-Identität, Verknüpfungsregeln, Admin-Suche (LIKE-Maskierung), Notes-Token-Verbrauch.
// Start: node scripts/test-v2-logic.js
const assert = require('assert');
const M = require('../server/msauth'), N = require('../server/notes');
let n = 0; const t = async (name, f) => { try { await f(); n++; console.log('ok   ' + name); } catch (e) { console.log('FAIL ' + name + ' – ' + e.message); process.exitCode = 1; } };
const resp = (status, body) => ({ status, ok: status >= 200 && status < 300, json: async () => body });
const TOK = 'x'.repeat(40);

(async () => {
  await t('UUID wird normalisiert', () => { assert.strictEqual(M.normUuid('069A79F4-44E9-4726-A5BE-FCA90E38AAF5'), '069a79f444e94726a5befca90e38aaf5'); assert.strictEqual(M.normUuid('zz'), ''); });
  await t('gültiges Token -> UUID aus dem Profil (nicht der Name)', async () => { const r = await M.verifyMcToken(TOK, async () => resp(200, { id: '069a79f444e94726a5befca90e38aaf5', name: 'Steve' })); assert.ok(r.ok); assert.strictEqual(r.id, '069a79f444e94726a5befca90e38aaf5'); });
  await t('abgelehntes Token (401) -> Fehler, kein Login', async () => { const r = await M.verifyMcToken(TOK, async () => resp(401, {})); assert.ok(!r.ok && r.code === 'ms_denied'); });
  await t('kein Minecraft-Profil (404)', async () => { const r = await M.verifyMcToken(TOK, async () => resp(404, {})); assert.strictEqual(r.code, 'no_minecraft'); });
  await t('Netzwerkfehler', async () => { const r = await M.verifyMcToken(TOK, async () => { throw new Error('x'); }); assert.strictEqual(r.code, 'ms_down'); });
  await t('Profil ohne gültige ID wird abgelehnt', async () => { const r = await M.verifyMcToken(TOK, async () => resp(200, { id: 'nope', name: 'A' })); assert.ok(!r.ok); });
  await t('zu kurzes/ungültiges Token wird gar nicht erst gesendet', async () => { let called = false; const r = await M.verifyMcToken('abc', async () => { called = true; return resp(200, {}); }); assert.ok(!r.ok && !called); });
  await t('Login: ohne Verknüpfung -> no_link (keine Zuordnung per Name)', () => { assert.strictEqual(M.loginDecision(null).code, 'no_link'); assert.strictEqual(M.loginDecision({ name_key: 'a' }).action, 'login'); });
  await t('Verknüpfen: falsches Passwort -> abgelehnt', () => assert.strictEqual(M.linkDecision(null, null, 'a'.repeat(32)).status, 401));
  await t('Verknüpfen: MS-ID gehört schon einem anderen Konto -> 409', () => assert.strictEqual(M.linkDecision({ name_key: 'x' }, { name_key: 'y' }, 'id').code, 'ms_taken'));
  await t('Verknüpfen: Konto hat schon andere MS-ID -> 409 (nichts überschrieben)', () => assert.strictEqual(M.linkDecision({ name_key: 'x', ms_id: 'old' }, null, 'new').code, 'acc_linked'));
  await t('Verknüpfen: sauberer Fall und Wiederholung', () => { assert.strictEqual(M.linkDecision({ name_key: 'x', ms_id: '' }, null, 'id').action, 'link'); assert.strictEqual(M.linkDecision({ name_key: 'x', ms_id: 'id' }, { name_key: 'x' }, 'id').action, 'already'); });
  await t('Benutzername-Regel', () => { assert.ok(M.validName('Ben_29')); assert.ok(!M.validName('a')); assert.ok(!M.validName("x'; DROP")); });
  await t('Suche: Platzhalter vom Nutzer werden maskiert, Groß/Klein egal', () => { assert.strictEqual(M.likePattern('  BeN%_\\ '), '%ben\\%\\_\\\\%'); assert.strictEqual(M.likePattern("a' OR 1=1 --"), "%a' or 1=1 --%"); /* wird nur als Parameter gebunden */ });

  // Notes: Token-Verbrauch pro Woche aus Anbieter-Antworten, Limit nur vom Owner gesetzt
  const repo = N.memRepo(); let now = Date.UTC(2026, 10, 7, 12); // Samstag
  const fetchImpl = async (url) => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: 'Prompt' }, finish_reason: 'stop' }], usage: { total_tokens: 1234 } }) });
  const notes = N.create({ repo, getSecret: () => 'secret', fetchImpl, now: () => now });
  await t('Wochenstart ist Montag 00:00 UTC', () => { assert.strictEqual(new Date(N.weekStart(now)).toISOString(), '2026-11-02T00:00:00.000Z'); });
  await t('Usage ohne Daten: 0 verbraucht, kein erfundenes Limit', async () => { const r = (await notes.usage('o', {})).json; assert.strictEqual(r.used, 0); assert.strictEqual(r.limit, null); assert.strictEqual(r.remaining, null); });
  await t('Prompt zählt echte Tokens, Limit -> übrig', async () => {
    await notes.settings('o', { provider: 'gemini', openaiKey: 'A'.repeat(30) });
    const s = (await notes.save('o', { title: 't', body: 'idee' })).json; assert.ok(s.ok);
    const p = (await notes.prompt('o', { id: s.note.id })).json; assert.ok(p.ok, JSON.stringify(p));
    await notes.usage('o', { limit: 10000 });
    const r = (await notes.usage('o', {})).json; assert.strictEqual(r.used, 1234); assert.strictEqual(r.remaining, 8766); assert.strictEqual(r.resetAt, N.weekStart(now) + 7 * 864e5);
  });
  await t('neue Woche -> Verbrauch beginnt bei 0', async () => { now += 7 * 864e5; const r = (await notes.usage('o', {})).json; assert.strictEqual(r.used, 0); });
  await t('ungültiges Limit wird abgelehnt', async () => { const r = await notes.usage('o', { limit: -5 }); assert.strictEqual(r.status, 400); });
  console.log(n + ' Tests ok');
})();
