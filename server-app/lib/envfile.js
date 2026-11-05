// cloudy.env lesen und schreiben (gleiches Format wie die alte CLOUDY-SERVER.command: SCHLUESSEL=Wert je Zeile, # = Kommentar).
function parse(text) {
  const out = {};
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim(); if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('='); if (i < 1) continue;
    const k = line.slice(0, i).trim(); if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(k)) continue;
    let v = line.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"') && v.length >= 2) || (v.startsWith("'") && v.endsWith("'") && v.length >= 2)) v = v.slice(1, -1);
    out[k] = v;
  }
  return out;
}
function serialize(obj) {
  return Object.entries(obj).filter(([k, v]) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(k) && v !== undefined && v !== null && String(v) !== '')
    .map(([k, v]) => `${k}=${String(v).replace(/[\r\n]/g, ' ')}`).join('\n') + '\n';
}
// Passwoerter nie im Klartext in Logs/Anzeigen
const SECRET = /(PASS|SECRET|KEY|TOKEN)/i;
const mask = (k, v) => (SECRET.test(k) && v ? '••••••••' : v);
module.exports = { parse, serialize, mask, SECRET };
