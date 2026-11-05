// Dateiverwaltung fuer den Server-Ordner: sichere Pfade, Syntaxpruefung, Sicherungskopien, Abgleich mit der mitgelieferten Version.
const fs = require('fs'), path = require('path'), crypto = require('crypto'), vm = require('vm');
const EDIT_EXT = new Set(['.js', '.json', '.html', '.css', '.md', '.txt', '.env']);
const MAX = 2 * 1024 * 1024, KEEP = 12;
const sha = b => crypto.createHash('sha1').update(b).digest('hex');
const SKIP = new Set(['node_modules', '.git', 'backups', '.history']);

// Loest einen relativen Pfad INNERHALB des Server-Ordners auf. Alles ausserhalb (.., absolute Pfade, Symlinks) wird abgelehnt.
function safe(root, rel) {
  if (typeof rel !== 'string' || !rel || rel.includes('\0') || path.isAbsolute(rel)) throw new Error('Ungültiger Dateiname.');
  const full = path.resolve(root, rel), base = path.resolve(root);
  if (full !== base && !full.startsWith(base + path.sep)) throw new Error('Datei liegt außerhalb des Server-Ordners.');
  const parts = path.relative(base, full).split(path.sep); if (parts.some(p => SKIP.has(p))) throw new Error('Dieser Ordner ist gesperrt.');
  if (!EDIT_EXT.has(path.extname(full).toLowerCase()) && path.basename(full) !== 'cloudy.env') throw new Error('Dieser Dateityp kann hier nicht bearbeitet werden.');
  try { const real = fs.realpathSync(fs.existsSync(full) ? full : path.dirname(full)); const rb = fs.realpathSync(base); if (real !== rb && !real.startsWith(rb + path.sep)) throw new Error('x'); } catch (e) { if (e.message === 'x') throw new Error('Verweise (Symlinks) nach außen sind nicht erlaubt.'); }
  return full;
}
function list(root) {
  const out = [];
  (function walk(dir, depth) {
    let es; try { es = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of es) {
      if (SKIP.has(e.name) || e.name.startsWith('.')) continue;
      const p = path.join(dir, e.name), rel = path.relative(root, p).split(path.sep).join('/');
      if (e.isDirectory()) { if (depth < 2) walk(p, depth + 1); continue; }
      if (!e.isFile() || !EDIT_EXT.has(path.extname(e.name).toLowerCase())) continue;
      let st; try { st = fs.statSync(p); } catch { continue; } if (st.size > MAX) continue;
      out.push({ file: rel, size: st.size, mtime: st.mtimeMs });
    }
  })(root, 0);
  // wichtige Dateien nach oben
  const prio = ['app.js', 'site.js', 'pass.js', 'quests.js', 'status.js', 'mail.js', 'stripe.js', 'keyreq.js', 'server.js'];
  return out.sort((a, b) => { const x = prio.indexOf(a.file), y = prio.indexOf(b.file); if (x >= 0 || y >= 0) return (x < 0 ? 99 : x) - (y < 0 ? 99 : y); return a.file.localeCompare(b.file); });
}
// Syntax pruefen, ohne den Code auszufuehren. -> null oder { line, message }
function check(rel, text) {
  const ext = path.extname(rel).toLowerCase();
  if (ext === '.js') {
    try { new vm.Script(String(text).replace(/^#!.*/, ''), { filename: rel }); return null; }
    catch (e) { const m = /:(\d+)/.exec(String(e.stack || '').split('\n')[0] || '') || /:(\d+)/.exec(String(e.stack || '')); return { line: m ? +m[1] : 0, message: String(e.message) }; }
  }
  if (ext === '.json') { try { JSON.parse(text); return null; } catch (e) { return { line: 0, message: String(e.message) }; } }
  return null;
}
function history(root) { return path.join(root, '.history'); }
function snapshot(root, rel) { // alte Fassung sichern, bevor sie ueberschrieben wird
  const full = safe(root, rel); if (!fs.existsSync(full)) return;
  const dir = path.join(history(root), rel.replace(/[\\/]/g, '__')); fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(full, path.join(dir, Date.now() + '.bak'));
  const all = fs.readdirSync(dir).sort(); for (const f of all.slice(0, Math.max(0, all.length - KEEP))) { try { fs.unlinkSync(path.join(dir, f)); } catch {} }
}
function versions(root, rel) {
  safe(root, rel); const dir = path.join(history(root), rel.replace(/[\\/]/g, '__'));
  try { return fs.readdirSync(dir).filter(f => f.endsWith('.bak')).map(f => ({ id: f, time: +f.replace('.bak', '') })).sort((a, b) => b.time - a.time); } catch { return []; }
}
function readVersion(root, rel, id) {
  safe(root, rel); if (!/^\d+\.bak$/.test(id)) throw new Error('Ungültige Version.');
  return fs.readFileSync(path.join(history(root), rel.replace(/[\\/]/g, '__'), id), 'utf8');
}
function read(root, rel) { const f = safe(root, rel); const st = fs.statSync(f); if (st.size > MAX) throw new Error('Datei ist zu groß.'); return fs.readFileSync(f, 'utf8'); }
// Schreibt atomar (erst Temp-Datei, dann umbenennen), nach Syntaxpruefung und Sicherung. force = trotz Fehler speichern.
function write(root, rel, text, force) {
  const full = safe(root, rel); text = String(text);
  if (Buffer.byteLength(text) > MAX) throw new Error('Datei ist zu groß.');
  const err = check(rel, text); if (err && !force) { const e = new Error(`Syntaxfehler${err.line ? ' in Zeile ' + err.line : ''}: ${err.message}`); e.syntax = err; throw e; }
  fs.mkdirSync(path.dirname(full), { recursive: true }); snapshot(root, rel);
  const tmp = full + '.tmp-' + process.pid; fs.writeFileSync(tmp, text); fs.renameSync(tmp, full);
  return { ok: true, syntax: err };
}

// ---- Mitgelieferte Dateien (server-default) und Nutzer-Aenderungen ----
// baseline.json merkt sich je Datei den Hash der zuletzt kopierten mitgelieferten Fassung. Unveraenderte Dateien werden bei einem App-Update automatisch erneuert,
// vom Nutzer geaenderte bleiben unangetastet (Hinweis "neue Version vorhanden").
function walkDefault(dir, base = dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name) || e.name.endsWith('.command')) continue;
    const p = path.join(dir, e.name); if (e.isDirectory()) walkDefault(p, base, acc); else acc.push(path.relative(base, p).split(path.sep).join('/'));
  } return acc;
}
function syncDefaults(root, defDir) {
  const bf = path.join(root, '.baseline.json'); let base = {}; try { base = JSON.parse(fs.readFileSync(bf, 'utf8')); } catch {}
  const res = { copied: [], updated: [], kept: [], pending: [] };
  if (!fs.existsSync(defDir)) return res;
  fs.mkdirSync(root, { recursive: true });
  for (const rel of walkDefault(defDir)) {
    const src = path.join(defDir, rel), dst = path.join(root, rel), sb = fs.readFileSync(src), sh = sha(sb);
    if (!fs.existsSync(dst)) { fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.writeFileSync(dst, sb); base[rel] = sh; res.copied.push(rel); continue; }
    if (base[rel] === sh) continue; // mitgelieferte Fassung unveraendert
    const cur = sha(fs.readFileSync(dst));
    if (cur === sh) { base[rel] = sh; continue; } // Nutzer hat schon genau diese Fassung
    if (!base[rel] || cur === base[rel]) { // Datei unveraendert gegenueber der alten mitgelieferten (oder unbekannt = alter Ordner): erneuern
      if (!base[rel]) { res.pending.push(rel); continue; } // unbekannte Herkunft: nichts ueberschreiben
      try { snapshot(root, rel); } catch {} fs.writeFileSync(dst, sb); base[rel] = sh; res.updated.push(rel);
    } else res.pending.push(rel); // Nutzer hat geaendert -> behalten
  }
  fs.writeFileSync(bf, JSON.stringify(base, null, 1)); return res;
}
function defaultText(defDir, rel) { const p = path.resolve(defDir, rel); if (!p.startsWith(path.resolve(defDir) + path.sep)) throw new Error('Ungültig.'); return fs.readFileSync(p, 'utf8'); }
function resetToDefault(root, defDir, rel) {
  safe(root, rel); const t = defaultText(defDir, rel); write(root, rel, t, true);
  const bf = path.join(root, '.baseline.json'); let base = {}; try { base = JSON.parse(fs.readFileSync(bf, 'utf8')); } catch {} base[rel] = sha(Buffer.from(t)); fs.writeFileSync(bf, JSON.stringify(base, null, 1));
}
module.exports = { safe, list, read, write, check, versions, readVersion, snapshot, syncDefaults, resetToDefault, defaultText, EDIT_EXT };
