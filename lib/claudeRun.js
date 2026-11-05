// Cloudy Notes: Claude Code (offizielle CLI) als Entwicklungsumgebung. Cloudy startet "claude -p" im ausgewaehlten Projektordner,
// liest den Ereignisstrom (stream-json) und uebersetzt ihn in Status, Fortschritt, betroffene Dateien und Fehlermeldungen.
// Sicherheit: Rechte kommen aus einer eigenen settings-Datei (Positivliste + Sperrliste), kein git commit/push, kein Netzwerk-Download, keine Geheimnis-Dateien.
const { spawn, execFile } = require('child_process'), fs = require('fs'), os = require('os'), path = require('path');
const WIN = process.platform === 'win32';

const READ_TOOLS = ['Read', 'Glob', 'Grep'];
const DENY = ['Bash(git push:*)', 'Bash(git commit:*)', 'Bash(git reset:*)', 'Bash(git checkout:*)', 'Bash(git clean:*)', 'Bash(rm:*)', 'Bash(del:*)', 'Bash(rmdir:*)', 'Bash(curl:*)', 'Bash(wget:*)', 'Bash(sudo:*)', 'Bash(ssh:*)', 'Bash(scp:*)', 'WebFetch', 'WebSearch',
  'Bash(cat *.env*)', 'Bash(type *.env*)', 'Bash(head *.env*)', 'Bash(tail *.env*)', 'Bash(grep * *.env*)', 'Bash(* .env*)', 'Bash(* *cloudy.env*)', 'Read(**/cloudy.env)', 'Read(**/.env)', 'Read(**/.env.*)', 'Read(**/*.pem)', 'Read(**/*.key)', 'Read(**/secrets*)', 'Edit(**/.git/**)', 'Write(**/.git/**)', 'Edit(**/cloudy.env)', 'Write(**/cloudy.env)', 'Edit(**/.env*)', 'Write(**/.env*)'];
const SAFE_BASH = ['Bash(node --check:*)', 'Bash(node test:*)', 'Bash(node tests:*)', 'Bash(node /tmp:*)', 'Bash(npm test:*)', 'Bash(npm run test:*)', 'Bash(git status:*)', 'Bash(git diff:*)', 'Bash(git log:*)', 'Bash(git show:*)', 'Bash(ls:*)', 'Bash(dir:*)', 'Bash(javac -proc:none:*)'];
const settingsFor = phase => ({ permissions: { allow: phase === 'plan' ? READ_TOOLS.slice() : [...READ_TOOLS, 'Edit', 'Write', ...SAFE_BASH], deny: DENY } });
const PERMS = { read: 'Projektdateien lesen (außer cloudy.env, .env, Schlüssel)', write: 'Dateien im Projektordner ändern und anlegen', tests: 'Nur Prüfbefehle: node --check, node test…, npm test, git status/diff/log', no: 'Nicht erlaubt: git commit/push, Dateien löschen, Downloads, Internet, sudo, Zugriff außerhalb des Projektordners' };

function exists(p) { try { return fs.statSync(p).isFile(); } catch { return false; } }
function findClaude(extra) {
  const H = os.homedir(), names = WIN ? ['claude.exe', 'claude.cmd'] : ['claude'];
  const dirs = [...(process.env.PATH || '').split(path.delimiter), ...(WIN ? [path.join(process.env.APPDATA || '', 'npm'), path.join(H, '.local', 'bin'), path.join(H, '.claude', 'local'), path.join(process.env.LOCALAPPDATA || '', 'Programs', 'claude')] : [path.join(H, '.local', 'bin'), path.join(H, '.claude', 'local'), '/opt/homebrew/bin', '/usr/local/bin', path.join(H, '.npm-global', 'bin'), path.join(H, '.volta', 'bin'), '/usr/bin'])].filter(Boolean);
  if (extra && exists(extra)) return extra;
  for (const d of dirs) for (const n of names) { const f = path.join(d, n); if (exists(f)) return f; }
  return '';
}
const q = a => '"' + String(a).replace(/"/g, '') + '"';
// Startet claude. Windows-.cmd (npm-Installation) braucht cmd.exe; der Prompt geht nie ueber die Kommandozeile, sondern ueber stdin.
function augEnv(bin, extra) { // aus dem Finder gestartete Apps haben nur einen kurzen PATH; claude braucht "node"
  const H = os.homedir(), add = WIN ? [] : [path.dirname(bin), '/opt/homebrew/bin', '/usr/local/bin', path.join(H, '.volta', 'bin'), path.join(H, '.local', 'bin')];
  if (!WIN) try { const v = path.join(H, '.nvm', 'versions', 'node'); for (const d of fs.readdirSync(v)) add.push(path.join(v, d, 'bin')); } catch {}
  return { ...process.env, ...(extra || {}), PATH: [...add, process.env.PATH || ''].filter(Boolean).join(path.delimiter), NO_COLOR: '1' };
}
function launch(bin, args, o) {
  const opt = { cwd: o.cwd, env: augEnv(bin, o.env), stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true, detached: !WIN };
  if (o.node) return spawn(process.execPath, [bin, ...args], { ...opt, env: { ...opt.env, ELECTRON_RUN_AS_NODE: '1' } }); // nur fuer Tests (Fake-Claude)
  if (WIN && /\.(cmd|bat)$/i.test(bin)) return spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', '"' + [bin, ...args].map(q).join(' ') + '"'], { ...opt, windowsVerbatimArguments: true });
  return spawn(bin, args, opt);
}
function killTree(p) {
  if (!p || p.exitCode != null) return;
  try { if (WIN) execFile('taskkill', ['/pid', String(p.pid), '/T', '/F'], () => {}); else { process.kill(-p.pid, 'SIGTERM'); setTimeout(() => { try { process.kill(-p.pid, 'SIGKILL'); } catch {} }, 4000); } } catch { try { p.kill('SIGKILL'); } catch {} }
}
function version(bin, o) { return new Promise(res => { const p = launch(bin, ['--version'], { cwd: os.tmpdir(), node: o && o.node }); let s = ''; p.stdout.on('data', d => s += d); p.on('error', () => res('')); p.on('exit', () => res(s.trim().split('\n')[0])); setTimeout(() => { killTree(p); res(s.trim()); }, 15000); p.stdin.end(); }); }

// ---- Projektordner pruefen ----
function checkProject(dir) {
  const out = { ok: false, dir: dir || '', reasons: [], info: {} };
  if (!dir) { out.reasons.push('Kein Projektordner gewählt.'); return out; }
  let st; try { st = fs.statSync(dir); } catch { out.reasons.push('Der Ordner existiert nicht.'); return out; }
  if (!st.isDirectory()) { out.reasons.push('Das ist kein Ordner.'); return out; }
  try { fs.accessSync(dir, fs.constants.R_OK | fs.constants.W_OK); } catch { out.reasons.push('Cloudy hat keine Lese- und Schreibrechte für diesen Ordner.'); return out; }
  const has = f => fs.existsSync(path.join(dir, f));
  let pkg = null; try { pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')); } catch {}
  if (!pkg || !has('main.js') || !has('preload.js') || !has('index.html')) out.reasons.push('Das sieht nicht nach dem Cloudy-Projektordner aus (package.json, main.js, preload.js, index.html erwartet).');
  else { out.info.name = pkg.name; out.info.version = pkg.version; out.info.git = has('.git'); out.info.server = has('server'); out.info.mod = has('client-src'); }
  if (path.resolve(dir) === path.parse(path.resolve(dir)).root || path.resolve(dir) === os.homedir()) out.reasons.push('Wähle den Cloudy-Projektordner selbst, nicht dein Benutzer- oder Hauptverzeichnis.');
  out.ok = out.reasons.length === 0; return out;
}

// ---- Ereignisstrom -> Status ----
const NAMES = { starting: 'Prompt wird übertragen', planning: 'Claude analysiert die Anforderungen', exploring: 'Projekt wird untersucht', awaiting: 'Wartet auf deine Bestätigung', running: 'Implementierung läuft', testing: 'Änderungen werden getestet', done: 'Update erfolgreich abgeschlossen', error: 'Fehler bei der Implementierung', cancelled: 'Abgebrochen' };
const rel = (f, cwd) => { f = String(f || ''); try { const r = path.relative(cwd, f); return r && !r.startsWith('..') && !path.isAbsolute(r) ? r.split(path.sep).join('/') : f; } catch { return f; } };
const AUTH = /(not logged in|please run \/login|invalid api key|authentication|unauthorized|401|oauth)/i, LIMIT = /(rate limit|usage limit|credit balance|quota|overloaded|429)/i;
function friendly(text) {
  const t = String(text || '');
  if (AUTH.test(t)) return 'Claude ist nicht angemeldet oder der Zugang ist ungültig. Öffne ein Terminal, gib „claude“ ein und melde dich an – oder hinterlege unter AI Connections einen Anthropic API Key.';
  if (LIMIT.test(t)) return 'Das Nutzungslimit oder Guthaben deines Claude-Zugangs ist erreicht. Warte etwas oder prüfe dein Konto auf console.anthropic.com bzw. claude.ai.';
  return t.slice(0, 600) || 'Unbekannter Fehler von Claude.';
}
function newState(phase, cwd) { return { state: 'starting', phase, progress: 5, task: NAMES.starting, files: [], error: '', summary: '', log: [], session: '', cost: 0, edits: 0, cwd, denied: [] }; }
const pushLog = (s, line) => { line = String(line).replace(/\s+/g, ' ').trim().slice(0, 190); if (line) { s.log.push(line); if (s.log.length > 60) s.log.shift(); } };
function toolLabel(name, inp, cwd) { inp = inp || {}; const f = rel(inp.file_path || inp.path || inp.pattern || '', cwd); return name + (f ? ' ' + f : (inp.command ? ': ' + String(inp.command).slice(0, 80) : '')); }
// Verarbeitet ein Ereignis; gibt true zurueck, wenn sich etwas fuer die Anzeige geaendert hat.
function reduce(s, ev) {
  if (!ev || typeof ev !== 'object') return false;
  if (ev.session_id && !s.session) s.session = ev.session_id;
  if (ev.type === 'system' && ev.subtype === 'init') { s.state = s.phase === 'plan' ? 'planning' : 'exploring'; s.progress = s.phase === 'plan' ? 15 : 25; s.task = NAMES[s.state]; pushLog(s, 'Verbunden mit Claude Code (' + (ev.model || 'Modell unbekannt') + ')'); return true; }
  if (ev.type === 'assistant' && ev.message && Array.isArray(ev.message.content)) {
    let ch = false;
    for (const c of ev.message.content) {
      if (c.type === 'text' && c.text) { pushLog(s, c.text); s.last = c.text; ch = true; }
      if (c.type === 'tool_use') {
        const n = c.name, inp = c.input || {}; pushLog(s, '▸ ' + toolLabel(n, inp, s.cwd)); ch = true;
        if (['Read', 'Glob', 'Grep', 'LS'].includes(n)) { if (s.state !== 'running' && s.state !== 'testing') { s.state = s.phase === 'plan' ? 'planning' : 'exploring'; s.progress = Math.max(s.progress, s.phase === 'plan' ? 20 : 30); } s.task = 'Untersucht: ' + (rel(inp.file_path || inp.path || inp.pattern, s.cwd) || n); }
        else if (['Edit', 'Write', 'NotebookEdit', 'MultiEdit'].includes(n)) { const f = rel(inp.file_path || inp.notebook_path, s.cwd); if (f && !s.files.includes(f)) s.files.push(f); s.edits++; s.state = 'running'; s.progress = Math.min(85, 40 + s.edits * 5); s.task = 'Ändert: ' + f; }
        else if (n === 'Bash') { const cmd = String(inp.command || ''); s.state = s.phase === 'plan' ? 'planning' : /check|test|javac|diff|status/i.test(cmd) ? 'testing' : s.state === 'exploring' ? 'exploring' : 'running'; if (s.state === 'testing') s.progress = Math.max(s.progress, 88); s.task = (s.state === 'testing' ? 'Prüft: ' : 'Befehl: ') + cmd.slice(0, 90); }
        else s.task = n;
      }
    }
    return ch;
  }
  if (ev.type === 'user' && ev.message && Array.isArray(ev.message.content)) { let ch = false; for (const c of ev.message.content) if (c.type === 'tool_result' && c.is_error) { pushLog(s, '⚠ ' + String(Array.isArray(c.content) ? c.content.map(x => x.text || '').join(' ') : c.content).slice(0, 160)); ch = true; } return ch; }
  if (ev.type === 'result') {
    s.cost = +ev.total_cost_usd || s.cost; s.denied = Array.isArray(ev.permission_denials) ? ev.permission_denials.map(d => d.tool_name + (d.tool_input && d.tool_input.command ? ': ' + String(d.tool_input.command).slice(0, 60) : '')).slice(0, 10) : [];
    if (ev.is_error || (ev.subtype && ev.subtype !== 'success')) { s.state = 'error'; s.error = friendly(ev.subtype === 'error_max_turns' ? 'Claude hat die maximale Schrittzahl erreicht, bevor er fertig war. Starte erneut oder teile die Aufgabe auf.' : ev.result || ev.subtype); s.task = NAMES.error; }
    else if (s.phase === 'plan') { s.state = 'awaiting'; s.progress = 40; s.summary = String(ev.result || s.last || ''); s.task = NAMES.awaiting; }
    else { s.state = 'done'; s.progress = 100; s.summary = String(ev.result || s.last || ''); s.task = NAMES.done; }
    s.final = true; pushLog(s, s.state === 'error' ? 'Fehler: ' + s.error : 'Fertig'); return true;
  }
  return false;
}

// ---- Runner ----
function wrap(phase, task, plan) {
  const rules = `Regeln: Arbeite ausschließlich im aktuellen Projektordner. Untersuche zuerst die bestehende Architektur und die betroffenen Dateien und verwende vorhandene Muster. Verändere bestehende Funktionen nicht unnötig. Keine Platzhalter und keine Fake-Funktionen. Keine Geheimnisse in Dateien oder Ausgaben. Du darfst NICHT committen oder pushen und nichts löschen – der Besitzer veröffentlicht selbst.`;
  if (phase === 'plan') return `AUFGABE (aus Notizen von ChatGPT erstellt):\n-----\n${task}\n-----\n\nPHASE 1 – NUR PLANEN. Untersuche das Projekt (nur lesen) und antworte dann kurz und klar mit: 1) betroffene Dateien, 2) geplante Änderungen, 3) Risiken/offene Fragen, 4) wie du testen wirst. Ändere NICHTS.\n\n${rules}`;
  return `AUFGABE (aus Notizen von ChatGPT erstellt):\n-----\n${task}\n-----\n${plan ? '\nDer Besitzer hat diesen Plan bestätigt:\n' + plan + '\n' : ''}\nSetze die Aufgabe jetzt vollständig um. Prüfe deine Änderungen (z. B. node --check für geänderte .js-Dateien, vorhandene Tests). Wenn eine Prüfung fehlschlägt, finde die Ursache und behebe sie selbst, prüfe erneut. Beende mit einer ehrlichen Zusammenfassung: geänderte Dateien, was getestet wurde, was NICHT getestet werden konnte, offene Punkte.\n\n${rules}`;
}
function createRunner() {
  let proc = null, st = null, cancelled = false, timers = [];
  const busy = () => !!proc;
  async function start(o) { // o: { bin, cwd, prompt, phase, plan, resume, env, model, onUpdate, node, maxTurns, idleMs, totalMs }
    if (proc) throw new Error('Es läuft bereits eine Entwicklungsaufgabe.');
    cancelled = false; st = newState(o.phase, o.cwd); const emit = () => { try { o.onUpdate && o.onUpdate(publicState()); } catch {} }; emit();
    const sf = path.join(os.tmpdir(), 'cloudy-notes-perm-' + process.pid + '-' + Date.now() + '.json'); fs.writeFileSync(sf, JSON.stringify(settingsFor(o.phase)));
    const args = ['-p', '--output-format', 'stream-json', '--verbose', '--permission-mode', o.phase === 'plan' ? 'plan' : 'acceptEdits', '--settings', sf, '--max-turns', String(o.maxTurns || (o.phase === 'plan' ? 25 : 80))];
    if (o.model) args.push('--model', o.model); if (o.resume) args.push('--resume', o.resume);
    const text = o.resume ? 'Mach genau dort weiter, wo du aufgehört hast (die Verbindung wurde unterbrochen), und beende die Aufgabe.' : wrap(o.phase, o.prompt, o.plan);
    return new Promise(resolve => {
      let buf = '', errText = '', last = Date.now(), over = false;
      const fin = () => { if (over) return; over = true; timers.forEach(clearTimeout); timers = []; try { fs.unlinkSync(sf); } catch {} proc = null; const r = publicState(); emit(); resolve(r); };
      try { proc = launch(o.bin, args, { cwd: o.cwd, env: o.env, node: o.node }); } catch (e) { st.state = 'error'; st.error = 'Claude konnte nicht gestartet werden: ' + e.message; proc = null; return fin(); }
      proc.on('error', e => { st.state = 'error'; st.error = e.code === 'ENOENT' ? 'Claude Code wurde nicht gefunden.' : 'Claude konnte nicht gestartet werden: ' + e.message; st.final = true; if (!proc || !proc.pid) fin(); });
      proc.stdin.on('error', () => {}); proc.stdin.end(text);
      const idle = o.idleMs || 10 * 60000, total = o.totalMs || 60 * 60000;
      timers.push(setInterval(() => { if (Date.now() - last > idle && proc) { st.state = 'error'; st.error = 'Claude antwortet seit ' + (idle >= 60000 ? Math.round(idle / 60000) + ' Minuten' : Math.round(idle / 1000) + ' Sekunden') + ' nicht mehr (Verbindung unterbrochen?). Du kannst „Fortsetzen“ versuchen.'; st.final = true; st.canResume = !!st.session; killTree(proc); } }, 5000));
      timers.push(setTimeout(() => { if (proc) { st.state = 'error'; st.error = 'Zeitlimit erreicht (' + Math.max(1, Math.round(total / 60000)) + ' Minuten).'; st.final = true; killTree(proc); } }, total));
      proc.stdout.on('data', d => { last = Date.now(); buf += d.toString('utf8'); let i; while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (!line) continue; let ev; try { ev = JSON.parse(line); } catch { continue; } if (reduce(st, ev)) emit(); } });
      proc.stderr.on('data', d => { last = Date.now(); errText = (errText + d.toString('utf8')).slice(-2000); });
      proc.on('exit', code => {
        if (cancelled) { st.state = 'cancelled'; st.task = NAMES.cancelled; st.error = ''; }
        else if (!st.final) { st.state = 'error'; st.error = friendly(errText || (code ? 'Claude wurde unerwartet beendet (Code ' + code + ').' : 'Claude hat keine Antwort geliefert.')); st.canResume = !!st.session; }
        if (st.state === 'error') st.canResume = st.canResume || !!st.session; fin();
      });
    });
  }
  const publicState = () => st && ({ state: st.state, name: NAMES[st.state] || '', phase: st.phase, progress: st.progress, task: st.task, files: st.files.slice(), error: st.error, summary: st.summary, log: st.log.slice(-30), session: st.session, cost: st.cost, denied: st.denied, canResume: !!st.canResume, t: Date.now() });
  return { start, cancel() { if (!proc) return false; cancelled = true; killTree(proc); return true; }, busy, state: publicState };
}

// ---- Geaenderte Dateien (auch wenn Claude sie per Shell geschrieben hat): git-Stand vorher/nachher vergleichen ----
function gitSnap(cwd) {
  return new Promise(res => execFile('git', ['status', '--porcelain', '-uall'], { cwd, timeout: 20000, maxBuffer: 8 * 1024 * 1024 }, (e, out) => {
    const m = new Map(); if (e) return res(null);
    for (const l of String(out).split('\n')) { if (l.length < 4) continue; const f = l.slice(3).replace(/^"|"$/g, '').replace(/.* -> /, ''); let sig = l.slice(0, 2); try { const st = fs.statSync(path.join(cwd, f)); sig += ':' + st.size + ':' + Math.round(st.mtimeMs); } catch { sig += ':gone'; } m.set(f, sig); }
    res(m);
  }));
}
const gitDiffFiles = (a, b) => !a || !b ? null : [...b].filter(([f, sig]) => a.get(f) !== sig).map(([f]) => f).concat([...a].filter(([f]) => !b.has(f)).map(([f]) => f)).slice(0, 100);

// ---- Verbindung testen ----
async function testClaude(o) { // o: { bin, cwd, env, node }
  if (!o.bin) return { ok: false, error: 'Claude Code ist nicht installiert. Installiere es von https://claude.com/claude-code und melde dich einmal an.' };
  const ver = await version(o.bin, o);
  return new Promise(res => {
    let out = '', err = ''; let p; try { p = launch(o.bin, ['-p', '--output-format', 'json', '--max-turns', '1', '--permission-mode', 'plan'], { cwd: o.cwd || os.tmpdir(), env: o.env, node: o.node }); } catch (e) { return res({ ok: false, version: ver, error: e.message }); }
    const to = setTimeout(() => { killTree(p); res({ ok: false, version: ver, error: 'Keine Antwort von Claude innerhalb von 90 Sekunden.' }); }, o.ms || 90000);
    p.stdout.on('data', d => out += d); p.stderr.on('data', d => err += d); p.stdin.on('error', () => {}); p.stdin.end('Antworte nur mit dem Wort: OK');
    p.on('error', e => { clearTimeout(to); res({ ok: false, version: ver, error: e.message }); });
    p.on('exit', () => { clearTimeout(to); let j = null; try { j = JSON.parse(out.trim().split('\n').pop()); } catch {} if (j && !j.is_error && /ok/i.test(String(j.result || ''))) res({ ok: true, version: ver, cost: j.total_cost_usd || 0 }); else res({ ok: false, version: ver, error: friendly((j && j.result) || err || out || 'Claude hat nicht geantwortet.') }); });
  });
}
module.exports = { gitSnap, gitDiffFiles, findClaude, checkProject, createRunner, testClaude, reduce, newState, settingsFor, friendly, wrap, PERMS, NAMES, killTree, version };
