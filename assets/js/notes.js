// Cloudy Notes – Notizen (Server), ChatGPT-Prompts, Claude-Code-Umsetzung, AI Connections, Tour. Alle Texte DE/EN ueber T(de,en).
(function () {
  const root = document.getElementById('p-notes'); if (!root || !window.cloudy || !window.cloudy.notesApi) return;
  const en = () => (document.documentElement.lang || 'de') !== 'de', T = (d, e) => en() ? e : d;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const $ = s => root.querySelector(s), api = (p, b) => window.cloudy.notesApi(p, b);
  const lg = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch { return d; } }, ls = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  const hex = n => { const a = new Uint8Array(n / 2); crypto.getRandomValues(a); return [...a].map(x => x.toString(16).padStart(2, '0')).join(''); };
  const when = t => { try { return new Date(t).toLocaleString(en() ? undefined : 'de-DE', { dateStyle: 'short', timeStyle: 'short' }); } catch { return ''; } };
  const S = { notes: [], sel: '', q: '', sort: 'upd', view: 'notes', cfg: null, srv: null, conn: {}, build: {}, edit: false, busy: '', sync: 'idle', last: 0, trash: [], loaded: false, err: '' };
  const timers = {}; let pollT = null;
  const user = () => { try { return (document.querySelector('#accName') || {}).textContent || 'u'; } catch { return 'u'; } };
  const cacheKey = () => 'cloudy.notes.cache';
  const cur = () => S.notes.find(n => n.id === S.sel);
  const toast = m => { if (window.toast) window.toast(m); else { const d = document.createElement('div'); d.className = 'nt-toast'; d.textContent = m; document.body.appendChild(d); setTimeout(() => d.remove(), 3200); } };

  // ---------- Daten ----------
  function load() { S.notes = lg(cacheKey(), []).filter(n => !n.deleted); S.last = 0; if (!S.sel && S.notes.length) S.sel = sorted()[0].id; }
  const persist = () => ls(cacheKey(), S.notes.map(n => ({ id: n.id, title: n.title, body: n.body, prompt: n.prompt, promptAt: n.promptAt, build: n.build, created: n.created, updated: n.updated, _dirty: n._dirty })));
  function merge(list) {
    let changed = false;
    for (const s of list) {
      const i = S.notes.findIndex(n => n.id === s.id), l = S.notes[i];
      if (s.deleted) { if (i >= 0) { S.notes.splice(i, 1); changed = true; if (S.sel === s.id) S.sel = ''; } continue; }
      if (!l) { S.notes.push(s); changed = true; continue; }
      if (l._dirty) { if (s.updated > l.updated && (s.body !== l.body || s.title !== l.title)) conflict(l, s); continue; }
      if (s.updated > l.updated || s.prompt !== l.prompt || JSON.stringify(s.build) !== JSON.stringify(l.build)) { Object.assign(l, s); changed = true; }
    }
    if (changed) { if (!S.sel || !cur()) S.sel = (sorted()[0] || {}).id || ''; persist(); }
    return changed;
  }
  async function sync(full) {
    if (S.sync === 'run') return; S.sync = 'run';
    const r = await api('/notes/list', { since: full ? 0 : S.last }).catch(() => ({ ok: false }));
    if (r.ok) { S.last = r.now - 5000; merge(r.notes); S.sync = 'ok'; S.err = ''; S.loaded = true; await flushAll(); } else { S.sync = r.offline ? 'off' : 'err'; S.err = r.error || ''; }
    paint();
  }
  async function conflict(local, server) { // zwei Geraete haben dieselbe Notiz geaendert: lokale Fassung als Kopie behalten, Server-Fassung uebernehmen
    const copy = { id: hex(18), title: local.title + ' (' + T('Konflikt-Kopie', 'conflict copy') + ')', body: local.body, prompt: '', created: Date.now(), updated: Date.now(), _dirty: true };
    Object.assign(local, server, { _dirty: false }); S.notes.push(copy); persist(); toast(T('Die Notiz wurde auf einem anderen Gerät geändert – deine Fassung liegt als Kopie vor.', 'The note was changed on another device – your version was kept as a copy.')); queue(copy.id);
  }
  function queue(id, ms) { clearTimeout(timers[id]); const n = S.notes.find(x => x.id === id); if (n) { n._dirty = true; persist(); } setStat(); timers[id] = setTimeout(() => save(id), ms == null ? 800 : ms); }
  async function save(id) {
    const n = S.notes.find(x => x.id === id); if (!n || !n._dirty) return true; clearTimeout(timers[id]);
    const body = { id, title: n.title, body: n.body, base: n.created === n.updated && !n._known ? undefined : n.updated }; const t0 = n.title + '\u0000' + n.body;
    const r = await api('/notes/save', body).catch(() => ({ ok: false, offline: true }));
    if (r.ok) { n._known = true; n.updated = r.note.updated; n.id = r.note.id; if (n.title + '\u0000' + n.body === t0) n._dirty = false; if (S.sel === id) S.sel = n.id; S.sync = 'ok'; persist(); setStat(); return true; }
    if (r.conflict) { await conflict(n, r.note); paint(); return false; }
    S.sync = r.offline ? 'off' : 'err'; S.err = r.error || ''; setStat(); return false;
  }
  const flushAll = async () => { for (const n of S.notes.filter(x => x._dirty)) await save(n.id); };
  const sorted = () => {
    let l = S.notes.slice(); const q = S.q.trim().toLowerCase(); if (q) l = l.filter(n => (n.title + '\n' + n.body).toLowerCase().includes(q));
    const k = S.view === 'recent' ? 'upd' : S.sort; l.sort((a, b) => k === 'title' ? a.title.localeCompare(b.title) : k === 'cre' ? b.created - a.created : b.updated - a.updated);
    return S.view === 'recent' ? l.slice(0, 15) : l;
  };

  // ---------- Layout ----------
  const NAV = [['notes', T('Alle Notizen', 'All notes'), 'M4 5h16M4 12h16M4 19h10'], ['recent', T('Zuletzt bearbeitet', 'Recently edited'), 'M12 7v5l3 2M21 12a9 9 0 1 1-3-6.7M21 4v4h-4'], ['ai', 'AI Connections', 'M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8'], ['settings', T('Einstellungen', 'Settings'), 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z']];
  const dot = c => `<i class="nt-dot ${c === true ? 'ok' : c === false ? 'bad' : ''}"></i>`;
  function paint() {
    if (!root.classList.contains('on')) return;
    const side = `<div class="nt-side glass"><div class="nt-brand"><svg viewBox="0 0 24 24"><path d="M9 4h9a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H9zM9 4v16M5 8h4M5 12h4M5 16h4"/></svg><b>Cloudy Notes</b></div>` +
      NAV.map(([k, t, p]) => `<button class="nt-nav${S.view === k ? ' on' : ''}" data-v="${k}"><svg viewBox="0 0 24 24"><path d="${p}"/></svg>${esc(t)}</button>`).join('') +
      `<div class="nt-sp"></div><div class="nt-conn" id="ntConnMini">${connMini()}</div><button class="nt-nav" id="ntTourBtn"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01"/></svg>${T('Tour', 'Tour')}</button></div>`;
    let main = ''; if (S.view === 'ai') main = aiView(); else if (S.view === 'settings') main = setView(); else main = notesView();
    root.innerHTML = `<div class="nt">${side}<div class="nt-main">${main}</div></div>`; bind(); setStat(); if (S.view === 'notes' || S.view === 'recent') fillEditor();
  }
  const connMini = () => [['ChatGPT', S.conn.openai], ['Claude', S.conn.claude], ['Backend', S.conn.backend], [T('Projekt', 'Project'), S.conn.project]].map(([n, c]) => `<div>${dot(c && c.ok)}<span>${n}</span></div>`).join('');
  function notesView() {
    const l = sorted(), n = cur();
    const list = `<div class="nt-list glass"><div class="nt-tools"><input class="field" id="ntQ" placeholder="${T('Notizen durchsuchen …', 'Search notes …')}" value="${esc(S.q)}"><button class="btn" id="ntNew" title="${T('Neue Notiz', 'New note')}">＋</button></div>` +
      (S.view === 'notes' ? `<select class="field nt-sort" id="ntSort"><option value="upd"${S.sort === 'upd' ? ' selected' : ''}>${T('Zuletzt geändert', 'Last modified')}</option><option value="cre"${S.sort === 'cre' ? ' selected' : ''}>${T('Erstellt', 'Created')}</option><option value="title"${S.sort === 'title' ? ' selected' : ''}>${T('Titel A–Z', 'Title A–Z')}</option></select>` : '') +
      `<div class="nt-items">${l.length ? l.map(x => `<button class="nt-item${x.id === S.sel ? ' on' : ''}" data-id="${x.id}"><b>${esc(x.title || T('Ohne Titel', 'Untitled'))}${x._dirty ? ' •' : ''}</b><small>${esc((x.body || '').replace(/\s+/g, ' ').slice(0, 70)) || '…'}</small><small class="nt-d">${T('geändert', 'edited')} ${when(x.updated)}${x.prompt ? ' · ✦' : ''}</small></button>`).join('') : `<p class="muted nt-empty">${S.loaded || S.notes.length ? T('Keine Notizen gefunden.', 'No notes found.') : T('Lädt …', 'Loading …')}</p>`}</div></div>`;
    if (!n) return `<div class="nt-grid">${list}<div class="nt-edit glass nt-blank"><h3>${T('Willkommen bei Cloudy Notes', 'Welcome to Cloudy Notes')}</h3><p class="muted">${T('Schreibe deine Ideen auf, lass ChatGPT daraus einen Prompt machen und Claude daraus ein Update bauen.', 'Write down your ideas, let ChatGPT turn them into a prompt and Claude into an update.')}</p><button class="btn" id="ntNew2">${T('Erste Notiz erstellen', 'Create first note')}</button></div></div>`;
    return `<div class="nt-grid">${list}<div class="nt-col"><div class="nt-edit glass"><div class="nt-bar"><input class="field nt-title" id="ntTitle" maxlength="120" placeholder="${T('Titel', 'Title')}"><span class="nt-stat" id="ntStat"></span></div>
      <textarea class="field nt-body" id="ntBody" placeholder="${T('Beschreibe hier deine Idee, Anforderungen und Änderungen …', 'Describe your idea, requirements and changes here …')}"></textarea>
      <div class="nt-bar"><small class="muted">${T('Erstellt', 'Created')} ${when(n.created)} · ${T('Geändert', 'Edited')} ${when(n.updated)}</small><span class="nt-sp"></span><button class="btn ghost" id="ntHist">${T('Versionen', 'Versions')}</button><button class="btn ghost" id="ntDel">${T('Löschen', 'Delete')}</button><button class="btn" id="ntToPrompt"${S.busy === 'prompt' ? ' disabled' : ''}>${S.busy === 'prompt' ? T('ChatGPT arbeitet …', 'ChatGPT is working …') : T('In Prompt umwandeln', 'Convert to prompt')}</button></div><div id="ntHistBox"></div></div>${promptPanel(n)}</div></div>`;
  }
  function promptPanel(n) {
    if (!n.prompt && S.busy !== 'prompt') return `<div class="nt-prompt glass nt-hint" id="ntPrompt"><b>${T('Prompt', 'Prompt')}</b><p class="muted">${T('Hier erscheint der Claude-Prompt, den ChatGPT aus deiner Notiz erstellt. Deine Notiz bleibt dabei unverändert.', 'The Claude prompt ChatGPT creates from your note appears here. Your note stays unchanged.')}</p></div>`;
    return `<div class="nt-prompt glass" id="ntPrompt"><div class="nt-bar"><b>${T('Generierter Prompt', 'Generated prompt')}</b><span class="nt-sp"></span><small class="muted">${n.promptAt ? when(n.promptAt) : ''}</small></div>
      <textarea class="field nt-ptxt" id="ntPtxt" ${S.edit ? '' : 'readonly'} placeholder="…">${esc(n.prompt || '')}</textarea>
      <div class="nt-bar nt-wrap"><button class="btn ghost" id="ntCopy">${T('Prompt kopieren', 'Copy prompt')}</button><button class="btn ghost" id="ntRegen"${S.busy ? ' disabled' : ''}>${T('Prompt erneut generieren', 'Regenerate prompt')}</button><button class="btn ghost" id="ntEdit">${S.edit ? T('Bearbeitung speichern', 'Save edits') : T('Prompt bearbeiten', 'Edit prompt')}</button><span class="nt-sp"></span><button class="btn" id="ntBuild"${S.busy || buildRunning() ? ' disabled' : ''}>${T('Als Cloudy Update bauen', 'Build as Cloudy update')}</button></div>${buildPanel(n)}</div>`;
  }
  const buildRunning = () => { const b = S.build[S.sel]; return b && ['starting', 'planning', 'exploring', 'running', 'testing'].includes(b.state); };
  const STEPS = [['starting', T('Prompt übertragen', 'Prompt sent')], ['planning', T('Anforderungen analysieren', 'Analyze requirements')], ['exploring', T('Projekt untersuchen', 'Inspect project')], ['running', T('Implementierung', 'Implementation')], ['testing', T('Testen', 'Testing')], ['done', T('Fertig', 'Done')]];
  function buildPanel(n) {
    const b = S.build[n.id] || (n.build && n.build.state && n.build.state !== 'idle' ? n.build : null); if (!b) return '';
    const idx = STEPS.findIndex(s => s[0] === b.state), cls = b.state === 'error' ? 'bad' : b.state === 'done' ? 'ok' : '';
    const running = ['starting', 'planning', 'exploring', 'running', 'testing'].includes(b.state);
    return `<div class="nt-build ${cls}" id="ntBuildBox"><div class="nt-bar"><b>${esc(b.name || stName(b.state))}</b><span class="nt-sp"></span>${running ? `<button class="btn ghost" id="ntCancel">${T('Abbrechen', 'Cancel')}</button>` : ''}</div>
      <div class="nt-prog"><i style="width:${Math.max(3, Math.min(100, b.progress || 0))}%"></i></div><div class="nt-steps">${STEPS.map((s, i) => `<span class="${i < idx || b.state === 'done' ? 'dn' : i === idx ? 'cr' : ''}">${s[1]}</span>`).join('')}</div>
      ${b.task && running ? `<p class="muted nt-task">▸ ${esc(b.task)}</p>` : ''}
      ${b.state === 'awaiting' ? `<div class="nt-plan"><b>${T('Claudes Plan – bitte bestätigen', 'Claude’s plan – please confirm')}</b><pre>${esc(b.summary || '')}</pre><div class="nt-bar"><button class="btn" id="ntGo">${T('Bestätigen & umsetzen', 'Confirm & implement')}</button><button class="btn ghost" id="ntNo">${T('Verwerfen', 'Discard')}</button></div></div>` : ''}
      ${b.error ? `<p class="nt-err">${esc(b.error)}</p><div class="nt-bar">${b.canResume ? `<button class="btn ghost" id="ntResume">${T('Fortsetzen', 'Resume')}</button>` : ''}<button class="btn ghost" id="ntRetry">${T('Neu starten', 'Restart')}</button>${/angemeldet|logged|installiert|Projekt/i.test(b.error) ? `<button class="btn ghost" data-goto="ai">AI Connections</button>` : ''}</div>` : ''}
      ${b.files && b.files.length ? `<details open><summary>${T('Betroffene Dateien', 'Affected files')} (${b.files.length})</summary><ul class="nt-files">${b.files.map(f => `<li>${esc(f)}</li>`).join('')}</ul></details>` : ''}
      ${b.state === 'done' && b.summary ? `<details open><summary>${T('Zusammenfassung', 'Summary')}</summary><pre>${esc(b.summary)}</pre></details><p class="muted">${T('Die Änderungen liegen in deinem Projektordner. Prüfe sie und veröffentliche sie mit dem normalen Cloudy-Update-Ablauf – Claude committet und pusht nicht.', 'The changes are in your project folder. Review and publish them with the usual Cloudy update flow – Claude does not commit or push.')}</p>` : ''}
      ${b.log && b.log.length ? `<details><summary>${T('Protokoll', 'Log')}</summary><pre class="nt-log">${esc(b.log.join('\n'))}</pre></details>` : ''}</div>`;
  }
  const stName = s => ({ starting: T('Prompt wird übertragen', 'Sending prompt'), planning: T('Claude analysiert die Anforderungen', 'Claude is analyzing requirements'), exploring: T('Projekt wird untersucht', 'Inspecting project'), awaiting: T('Wartet auf Bestätigung', 'Waiting for confirmation'), running: T('Implementierung läuft', 'Implementing'), testing: T('Änderungen werden getestet', 'Testing changes'), done: T('Update erfolgreich abgeschlossen', 'Update completed'), error: T('Fehler bei der Implementierung', 'Implementation error'), cancelled: T('Abgebrochen', 'Cancelled') }[s] || s);

  // ---------- AI Connections / Einstellungen ----------
  const stat = (c, ok, bad) => !c ? `<span class="nt-badge">${T('Nicht geprüft', 'Not checked')}</span>` : c.ok ? `<span class="nt-badge ok">${ok}</span>` : `<span class="nt-badge bad">${bad}</span>`;
  function aiView() {
    const o = (S.srv && S.srv.openai) || {}, c = S.cfg || {}, cl = S.conn.claude, pr = S.conn.project;
    return `<div class="nt-pad"><h2>AI Connections</h2><p class="muted">${T('Verbinde ChatGPT (erstellt die Prompts) und Claude Code (setzt sie um). API Keys werden verschlüsselt gespeichert und nie in der Oberfläche angezeigt.', 'Connect ChatGPT (creates prompts) and Claude Code (implements them). API keys are stored encrypted and never shown in the interface.')}</p>
    <div class="glass nt-card" id="ntConn"><table class="nt-tab"><tr><th>${T('Verbindung', 'Connection')}</th><th>${T('Status', 'Status')}</th><th></th></tr>
      <tr><td>ChatGPT / OpenAI</td><td>${o.set ? stat(S.conn.openai, T('Verbunden', 'Connected'), T('Nicht verbunden', 'Not connected')) : `<span class="nt-badge bad">${T('Nicht verbunden', 'Not connected')}</span>`}</td><td><button class="btn ghost" data-test="openai">${T('Testen', 'Test')}</button></td></tr>
      <tr><td>Claude</td><td>${stat(cl, T('Verbunden', 'Connected'), T('Nicht verbunden', 'Not connected'))}</td><td><button class="btn ghost" data-test="claude">${T('Testen', 'Test')}</button></td></tr>
      <tr><td>Cloudy Backend</td><td>${stat(S.conn.backend, T('Verbunden', 'Connected'), T('Nicht verbunden', 'Not connected'))}</td><td><button class="btn ghost" data-test="backend">${T('Testen', 'Test')}</button></td></tr>
      <tr><td>${T('Cloudy Projektzugriff', 'Cloudy project access')}</td><td>${stat(pr, T('Verfügbar', 'Available'), T('Nicht verfügbar', 'Unavailable'))}</td><td><button class="btn ghost" data-test="project">${T('Prüfen', 'Check')}</button></td></tr></table>
      ${[S.conn.openai, cl, S.conn.backend, pr].filter(x => x && !x.ok && x.msg).map(x => `<p class="nt-err">${esc(x.msg)}</p>`).join('')}</div>
    <div class="glass nt-card" id="ntOpenai"><h3>ChatGPT</h3><p class="muted">${T('Die Umwandlung läuft über die echte OpenAI-API. Erstelle deinen Key hier:', 'The conversion uses the real OpenAI API. Create your key here:')} <a href="#" data-link="https://platform.openai.com/api-keys">platform.openai.com/api-keys</a></p>
      <div class="nt-bar nt-wrap"><input class="field" type="password" id="ntKey" autocomplete="off" placeholder="${o.set ? T('Gespeichert (' + esc(o.last4) + ') – zum Ersetzen neuen Key einfügen', 'Saved (' + esc(o.last4) + ') – paste a new key to replace') : 'sk-…'}" style="flex:1;min-width:220px"><button class="btn" id="ntKeySave">${T('Speichern', 'Save')}</button>${o.set ? `<button class="btn ghost" id="ntKeyDel">${T('Entfernen', 'Remove')}</button>` : ''}</div>
      <div class="nt-bar nt-wrap" style="margin-top:8px"><label class="muted">${T('Modell', 'Model')}</label><input class="field" id="ntModel" list="ntModels" value="${esc(o.model || '')}" placeholder="${esc(o.default || 'gpt-4.1')}" style="width:220px"><datalist id="ntModels">${((S.conn.openai && S.conn.openai.models) || []).map(m => `<option value="${esc(m)}">`).join('')}</datalist><button class="btn ghost" id="ntModelSave">${T('Modell speichern', 'Save model')}</button><button class="btn" id="ntOpenaiTest" data-test="openai">${T('Verbindung testen', 'Test connection')}</button></div></div>
    <div class="glass nt-card" id="ntClaude"><h3>Claude</h3><p class="muted">${T('Claude arbeitet über <b>Claude Code</b> direkt in deinem Projektordner auf diesem Computer. Installiere Claude Code (', 'Claude works through <b>Claude Code</b> directly in your project folder on this computer. Install Claude Code (')}<a href="#" data-link="https://claude.com/claude-code">claude.com/claude-code</a>${T(') und melde dich einmal an (Terminal: „claude“). Optional kannst du stattdessen einen Anthropic API Key nutzen (', ') and sign in once (terminal: “claude”). Optionally use an Anthropic API key instead (')}<a href="#" data-link="https://console.anthropic.com/">console.anthropic.com</a>).</p>
      <div class="nt-bar nt-wrap"><span class="nt-badge ${c.claudeBin ? 'ok' : 'bad'}">${c.claudeBin ? T('Claude Code gefunden', 'Claude Code found') : T('Claude Code nicht gefunden', 'Claude Code not found')}</span></div>
      <label class="muted" style="display:block;margin-top:10px">${T('Cloudy-Projektordner', 'Cloudy project folder')}</label><div class="nt-bar nt-wrap"><input class="field" id="ntDir" readonly value="${esc(c.projectDir || '')}" placeholder="${T('Noch kein Ordner gewählt', 'No folder selected')}" style="flex:1;min-width:220px"><button class="btn ghost" id="ntPick">${T('Ordner wählen …', 'Choose folder …')}</button></div>
      <div class="nt-bar nt-wrap" style="margin-top:8px"><input class="field" type="password" id="ntAKey" autocomplete="off" placeholder="${c.anthropic && c.anthropic.set ? T('Anthropic Key gespeichert (' + esc(c.anthropic.last4) + ')', 'Anthropic key saved (' + esc(c.anthropic.last4) + ')') : T('Anthropic API Key (optional)', 'Anthropic API key (optional)')}" style="flex:1;min-width:220px"><button class="btn ghost" id="ntAKeySave">${T('Speichern', 'Save')}</button>${c.anthropic && c.anthropic.set ? `<button class="btn ghost" id="ntAKeyDel">${T('Entfernen', 'Remove')}</button>` : ''}<button class="btn" id="ntClaudeTest" data-test="claude">${T('Verbindung testen', 'Test connection')}</button></div>
      <details class="nt-perm" open><summary>${T('Berechtigungen', 'Permissions')}</summary><ul>${Object.values(c.perms || {}).map(x => `<li>${esc(x)}</li>`).join('')}</ul></details></div></div>`;
  }
  function setView() {
    const c = S.cfg || {};
    return `<div class="nt-pad"><h2>${T('Einstellungen', 'Settings')}</h2>
    <div class="glass nt-card"><h3>${T('Entwicklung', 'Development')}</h3><label class="cb nt-cb"><input type="checkbox" id="ntConfirm" ${c.confirm !== false ? 'checked' : ''}> ${T('Vor Änderungen zuerst einen Plan zeigen und meine Bestätigung abwarten (empfohlen)', 'Show a plan first and wait for my confirmation before changing anything (recommended)')}</label>
      <p class="muted">${T('Claude kann nur im gewählten Projektordner arbeiten, committet und pusht nicht, löscht nichts und lädt nichts aus dem Internet. Jede Aufgabe lässt sich abbrechen.', 'Claude can only work in the selected project folder, does not commit or push, deletes nothing and downloads nothing. Every task can be cancelled.')}</p></div>
    <div class="glass nt-card"><h3>${T('Tour', 'Tour')}</h3><button class="btn" id="ntTour2">${T('Tour erneut starten', 'Restart tour')}</button></div>
    <div class="glass nt-card"><h3>${T('Sicherung', 'Backup')}</h3><div class="nt-bar nt-wrap"><button class="btn ghost" id="ntExport">${T('Alle Notizen exportieren (.json)', 'Export all notes (.json)')}</button><button class="btn ghost" id="ntTrash">${T('Gelöschte Notizen anzeigen', 'Show deleted notes')}</button></div><div id="ntTrashBox"></div></div></div>`;
  }

  // ---------- Verhalten ----------
  const setStat = () => { const e = $('#ntStat'); if (!e) return; const n = cur(); const t = S.sync === 'off' ? T('Offline – lokal gespeichert', 'Offline – saved locally') : S.sync === 'err' ? T('Sync-Fehler', 'Sync error') : n && n._dirty ? T('Speichert …', 'Saving …') : T('Gespeichert ✓', 'Saved ✓'); e.textContent = t; e.title = S.err || ''; e.className = 'nt-stat' + (S.sync === 'off' || S.sync === 'err' ? ' bad' : ''); const m = $('#ntConnMini'); if (m) m.innerHTML = connMini(); };
  function fillEditor() { const n = cur(); if (!n) return; const t = $('#ntTitle'), b = $('#ntBody'); if (t) t.value = n.title; if (b) b.value = n.body; }
  function newNote(body) { const t = Date.now(), n = { id: hex(18), title: T('Neue Notiz', 'New note'), body: body || '', prompt: '', created: t, updated: t, _dirty: true }; S.notes.push(n); S.sel = n.id; S.view = 'notes'; persist(); paint(); const e = $('#ntTitle'); if (e) { e.focus(); e.select(); } queue(n.id, 200); return n; }
  function pickNote(id) { S.sel = id; S.edit = false; paint(); }
  async function convert(extra) {
    const n = cur(); if (!n || S.busy) return; if (!n.body.trim()) return toast(T('Die Notiz ist leer.', 'The note is empty.')); S.busy = 'prompt'; await save(n.id); paint();
    const r = await api('/notes/prompt', { id: n.id, extra }).catch(() => ({ ok: false, error: T('Keine Verbindung zum Cloudy-Server.', 'No connection to the Cloudy server.') })); S.busy = '';
    if (r.ok) { Object.assign(n, r.note, { _dirty: n._dirty }); S.build[n.id] = null; S.edit = false; persist(); if (r.truncated) toast(T('Der Prompt wurde evtl. gekürzt.', 'The prompt may have been truncated.')); }
    else { paint(); const box = $('#ntPrompt'); if (box) box.insertAdjacentHTML('afterbegin', `<p class="nt-err">${esc(r.error || 'Fehler')} ${r.setup === 'openai' ? `<button class="btn ghost" data-goto="ai">AI Connections</button>` : ''} ${r.retry ? `<button class="btn ghost" id="ntRetryP">${T('Erneut versuchen', 'Try again')}</button>` : ''}</p>`); bindDyn(); return; }
    paint();
  }
  async function savePrompt() { const n = cur(), t = $('#ntPtxt'); if (!n || !t) return true; if (t.value === n.prompt) return true; const r = await api('/notes/prompt-save', { id: n.id, prompt: t.value }); if (r.ok) { n.prompt = r.note.prompt; n.promptAt = r.note.promptAt; persist(); return true; } toast(r.error || 'Fehler'); return false; }
  async function build(resume) {
    const n = cur(); if (!n) return; if (S.edit) { if (!await savePrompt()) return; S.edit = false; }
    const r = await window.cloudy.notesBuildStart({ id: n.id, prompt: n.prompt, resume: !!resume }); if (!r.ok) { S.build[n.id] = { state: 'error', error: r.error, progress: 0, files: [], log: [], canResume: false }; paint(); if (r.setup) { /* Hinweis fuehrt per Button zu AI Connections */ } }
  }
  async function test(what) {
    S.conn[what] = { ok: null, msg: '' }; paint(); const btn = root.querySelector(`[data-test="${what}"]`); if (btn) { btn.disabled = true; btn.textContent = T('Teste …', 'Testing …'); }
    const r = await window.cloudy.notesCheck(what).catch(e => ({ ok: false, error: String(e.message || e) }));
    S.conn[what] = { ok: !!r.ok, msg: r.ok ? '' : (r.error || (r.reasons && r.reasons[0]) || T('Fehlgeschlagen', 'Failed')), models: r.models, version: r.version };
    if (what === 'project' && r.ok) S.conn.project.msg = ''; ls('cloudy.notes.conn', Object.fromEntries(Object.entries(S.conn).map(([k, v]) => [k, { ok: v.ok }]))); await loadCfg(); paint(); return r.ok;
  }
  async function loadCfg() { S.cfg = await window.cloudy.notesCfgGet().catch(() => null); const r = await api('/notes/settings', {}).catch(() => null); if (r && r.ok) S.srv = r; return r; }
  function bind() {
    root.querySelectorAll('[data-v]').forEach(b => b.onclick = () => { S.view = b.dataset.v; S.edit = false; paint(); if (S.view === 'ai') { loadCfg().then(() => { paint(); }); test('backend'); test('project'); } });
    root.querySelectorAll('[data-goto]').forEach(b => b.onclick = () => { S.view = b.dataset.goto; paint(); });
    root.querySelectorAll('[data-link]').forEach(a => a.onclick = e => { e.preventDefault(); if (window.cloudy.openExternal) window.cloudy.openExternal(a.dataset.link); else window.open(a.dataset.link); });
    root.querySelectorAll('[data-test]').forEach(b => b.onclick = () => test(b.dataset.test));
    const q = $('#ntQ'); if (q) q.oninput = () => { S.q = q.value; const p = q.selectionStart; paint(); const x = $('#ntQ'); if (x) { x.focus(); x.setSelectionRange(p, p); } };
    const so = $('#ntSort'); if (so) so.onchange = () => { S.sort = so.value; paint(); };
    root.querySelectorAll('.nt-item').forEach(b => b.onclick = () => pickNote(b.dataset.id));
    const nn = $('#ntNew'); if (nn) nn.onclick = () => newNote(); const n2 = $('#ntNew2'); if (n2) n2.onclick = () => newNote();
    const ti = $('#ntTitle'), bo = $('#ntBody');
    if (ti) ti.oninput = () => { const n = cur(); n.title = ti.value; n.updated = n.updated; queue(n.id); }; if (bo) bo.oninput = () => { const n = cur(); n.body = bo.value; queue(n.id); };
    const tp = $('#ntToPrompt'); if (tp) tp.onclick = () => convert();
    const dl = $('#ntDel'); if (dl) dl.onclick = async () => { const n = cur(); if (!n || !confirm(T('Diese Notiz löschen? (Sie bleibt auf dem Server in der Sicherung und lässt sich unter Einstellungen wiederherstellen.)', 'Delete this note? (It stays in the server backup and can be restored under Settings.)'))) return; clearTimeout(timers[n.id]); const r = await api('/notes/delete', { id: n.id }); if (r.ok || !n._known) { S.notes = S.notes.filter(x => x.id !== n.id); S.sel = (sorted()[0] || {}).id || ''; persist(); paint(); } else toast(r.error || ''); };
    const hs = $('#ntHist'); if (hs) hs.onclick = async () => { const n = cur(), box = $('#ntHistBox'); if (box.innerHTML) { box.innerHTML = ''; return; } await save(n.id); const r = await api('/notes/history', { id: n.id }); box.innerHTML = r.ok && r.history.length ? `<div class="nt-hist">${r.history.map(h => `<button data-h="${h.hid}"><b>${when(h.t)}</b> ${esc(h.title)} – <small>${esc(h.body.replace(/\s+/g, ' ').slice(0, 80))}</small></button>`).join('')}</div>` : `<p class="muted">${T('Noch keine früheren Versionen.', 'No earlier versions yet.')}</p>`; box.querySelectorAll('[data-h]').forEach(b => b.onclick = async () => { if (!confirm(T('Diese Version wiederherstellen? Die aktuelle bleibt im Verlauf.', 'Restore this version? The current one stays in history.'))) return; const x = await api('/notes/restore', { id: n.id, hid: +b.dataset.h }); if (x.ok) { Object.assign(n, x.note, { _dirty: false }); persist(); paint(); } else toast(x.error || ''); }); };
    bindDyn();
    const ks = $('#ntKeySave'); if (ks) ks.onclick = async () => { const v = $('#ntKey').value.trim(); if (!v) return toast(T('Bitte Key einfügen.', 'Please paste a key.')); const r = await api('/notes/settings', { openaiKey: v }); if (r.ok) { S.srv = r; S.conn.openai = null; toast(T('Gespeichert. Teste jetzt die Verbindung.', 'Saved. Now test the connection.')); paint(); test('openai'); } else toast(r.error || ''); };
    const kd = $('#ntKeyDel'); if (kd) kd.onclick = async () => { if (!confirm(T('OpenAI-Key vom Server entfernen?', 'Remove the OpenAI key from the server?'))) return; const r = await api('/notes/settings', { clearKey: true }); if (r.ok) { S.srv = r; S.conn.openai = null; paint(); } };
    const ms = $('#ntModelSave'); if (ms) ms.onclick = async () => { const r = await api('/notes/settings', { model: $('#ntModel').value.trim() }); if (r.ok) { S.srv = r; toast(T('Modell gespeichert.', 'Model saved.')); } };
    const pk = $('#ntPick'); if (pk) pk.onclick = async () => { const r = await window.cloudy.notesPickProject(); if (r && r.ok) { await loadCfg(); S.conn.project = { ok: true }; paint(); } else if (r && r.reasons) { S.conn.project = { ok: false, msg: r.reasons[0] }; paint(); } };
    const as = $('#ntAKeySave'); if (as) as.onclick = async () => { const v = $('#ntAKey').value.trim(); if (!v) return; const r = await window.cloudy.notesCfgSet({ anthropicKey: v }); if (r.ok) { S.cfg = r; toast(T('Gespeichert.', 'Saved.')); paint(); } else toast(r.error); };
    const ad = $('#ntAKeyDel'); if (ad) ad.onclick = async () => { S.cfg = await window.cloudy.notesCfgSet({ clearAnthropic: true }); paint(); };
    const cf = $('#ntConfirm'); if (cf) cf.onchange = async () => { S.cfg = await window.cloudy.notesCfgSet({ confirm: cf.checked }); };
    const tb = $('#ntTourBtn'), t2 = $('#ntTour2'); if (tb) tb.onclick = () => tour(true); if (t2) t2.onclick = () => tour(true);
    const ex = $('#ntExport'); if (ex) ex.onclick = async () => { const r = await api('/notes/export', {}); if (!r.ok) return toast(r.error || ''); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(r.notes, null, 2)], { type: 'application/json' })); a.download = 'cloudy-notes.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); };
    const tr = $('#ntTrash'); if (tr) tr.onclick = async () => { const r = await api('/notes/list', { since: 0 }); const box = $('#ntTrashBox'); const d = r.ok ? r.notes.filter(x => x.deleted) : []; box.innerHTML = d.length ? d.map(x => `<div class="nt-bar"><span>${esc(x.title)} <small class="muted">${when(x.updated)}</small></span><span class="nt-sp"></span><button class="btn ghost" data-undo="${x.id}">${T('Wiederherstellen', 'Restore')}</button></div>`).join('') : `<p class="muted">${T('Keine gelöschten Notizen.', 'No deleted notes.')}</p>`; box.querySelectorAll('[data-undo]').forEach(b => b.onclick = async () => { const x = await api('/notes/delete', { id: b.dataset.undo, undo: true }); if (x.ok) { merge([x.note]); b.closest('.nt-bar').remove(); } }); };
  }
  function bindDyn() {
    const c = $('#ntCopy'); if (c) c.onclick = async () => { const t = $('#ntPtxt'); try { await navigator.clipboard.writeText(t.value); } catch { t.select(); document.execCommand('copy'); } toast(T('Prompt kopiert.', 'Prompt copied.')); };
    const r = $('#ntRegen'); if (r) r.onclick = () => { if (confirm(T('Den Prompt neu von ChatGPT erstellen lassen? Der aktuelle Prompt wird ersetzt.', 'Have ChatGPT create the prompt again? The current prompt will be replaced.'))) convert(); };
    const rp = $('#ntRetryP'); if (rp) rp.onclick = () => convert();
    const e = $('#ntEdit'); if (e) e.onclick = async () => { if (S.edit) { if (!await savePrompt()) return; S.edit = false; paint(); toast(T('Prompt gespeichert.', 'Prompt saved.')); } else { S.edit = true; paint(); const t = $('#ntPtxt'); if (t) t.focus(); } };
    const b = $('#ntBuild'); if (b) b.onclick = () => build(false);
    const ca = $('#ntCancel'); if (ca) ca.onclick = () => window.cloudy.notesBuildCancel();
    const go = $('#ntGo'); if (go) go.onclick = () => { const n = cur(), st = S.build[n.id]; window.cloudy.notesBuildGo({ id: n.id, prompt: n.prompt, plan: st && st.summary }); };
    const no = $('#ntNo'); if (no) no.onclick = () => { S.build[S.sel] = null; paint(); };
    const re = $('#ntResume'); if (re) re.onclick = () => build(true); const rt = $('#ntRetry'); if (rt) rt.onclick = () => build(false);
    root.querySelectorAll('[data-goto]').forEach(x => x.onclick = () => { S.view = x.dataset.goto; paint(); });
  }
  window.cloudy.onNotesBuild && window.cloudy.onNotesBuild(st => { S.build[st.id] = st; if (st.id === S.sel && ['notes', 'recent'].includes(S.view) && root.classList.contains('on')) { const n = cur(), old = $('#ntBuildBox'); if (old && n) { const tmp = document.createElement('div'); tmp.innerHTML = buildPanel(n); old.replaceWith(tmp.firstElementChild); bindDyn(); const bb = $('#ntBuild'); if (bb) bb.disabled = buildRunning(); } else paint(); } });

  // ---------- Tour (8 Schritte, hebt echte Elemente hervor) ----------
  let tov = null, ti = 0;
  const done = () => lg('cloudy.notes.tour', {}).done;
  const TS = () => [
    { t: T('Willkommen bei Cloudy Notes!', 'Welcome to Cloudy Notes!'), d: T('Hier schreibst du Ideen auf. ChatGPT macht daraus einen ausführlichen Prompt, Claude Code setzt ihn direkt in deinem Cloudy-Projekt um.', 'Write down ideas here. ChatGPT turns them into a detailed prompt, Claude Code implements it directly in your Cloudy project.'), flow: true, view: 'notes' },
    { t: T('ChatGPT verbinden', 'Connect ChatGPT'), d: T('Erstelle auf platform.openai.com/api-keys einen API Key, füge ihn hier ein, speichere und teste die Verbindung. Der Key wird verschlüsselt auf dem Cloudy-Server gespeichert.', 'Create an API key at platform.openai.com/api-keys, paste it here, save and test the connection. The key is stored encrypted on the Cloudy server.'), s: '#ntOpenai', view: 'ai', test: 'openai', skip: () => S.conn.openai && S.conn.openai.ok },
    { t: T('Claude verbinden', 'Connect Claude'), d: T('Claude arbeitet über Claude Code auf diesem Computer. Installiere es, melde dich an, wähle deinen Cloudy-Projektordner und teste die Verbindung. Claude darf nur in diesem Ordner arbeiten, nicht committen oder pushen.', 'Claude works through Claude Code on this computer. Install it, sign in, choose your Cloudy project folder and test the connection. Claude may only work in that folder and cannot commit or push.'), s: '#ntClaude', view: 'ai', test: 'claude', skip: () => S.conn.claude && S.conn.claude.ok && S.conn.project && S.conn.project.ok },
    { t: T('Verbindungen überprüfen', 'Check connections'), d: T('ChatGPT erstellt Prompts, Claude programmiert, das Backend speichert Notizen und Status, der Projektzugriff erlaubt Claude die Arbeit im Ordner. Rot? Dann zu den passenden Einstellungen.', 'ChatGPT creates prompts, Claude codes, the backend stores notes and status, project access lets Claude work in the folder. Red? Go to the matching settings.'), s: '#ntConn', view: 'ai', all: true },
    { t: T('Erste Notiz erstellen', 'Create your first note'), d: T('Vergib einen Titel und beschreibe Anforderungen und Änderungen. Gespeichert wird automatisch und auf allen Geräten synchronisiert.', 'Give it a title and describe requirements and changes. It saves automatically and syncs across devices.'), s: '#ntNew', view: 'notes', sample: true },
    { t: T('In Prompt umwandeln', 'Convert to prompt'), d: T('Dieser Knopf schickt die Notiz an ChatGPT, das daraus einen ausführlichen Claude-Prompt erstellt. Du kannst ihn danach lesen, bearbeiten und kopieren. Deine Notiz bleibt unverändert.', 'This button sends the note to ChatGPT, which creates a detailed Claude prompt. You can then read, edit and copy it. Your note stays unchanged.'), s: '#ntToPrompt', view: 'notes' },
    { t: T('Als Cloudy Update bauen', 'Build as Cloudy update'), d: T('Der Prompt geht automatisch an Claude Code. Du siehst Status, Fortschritt, betroffene Dateien und Fehler, kannst jederzeit abbrechen und bestätigst vorher Claudes Plan. Am Ende gibt es eine Zusammenfassung.', 'The prompt goes to Claude Code automatically. You see status, progress, affected files and errors, can cancel anytime and confirm Claude’s plan first. A summary follows at the end.'), s: '#ntBuild', view: 'notes', status: true },
    { t: T('Du bist bereit!', 'You’re ready!'), d: T('Mit Cloudy Notes kannst du deine Ideen direkt in neue Cloudy-Updates verwandeln. ChatGPT erstellt deine Prompts und Claude setzt deine Ideen um.', 'With Cloudy Notes you can turn your ideas directly into new Cloudy updates. ChatGPT creates your prompts and Claude implements your ideas.'), last: true, view: 'notes' }];
  async function tourSave(d) { ls('cloudy.notes.tour', { ...lg('cloudy.notes.tour', {}), ...d }); api('/notes/settings', { tour: { done: !!lg('cloudy.notes.tour', {}).done, step: ti, skipped: !!d.skipped } }).catch(() => {}); }
  function tour(force) {
    if (tov) return; if (!force && done()) return; ti = 0; tov = document.createElement('div'); tov.className = 'nt-tour'; document.body.appendChild(tov);
    addEventListener('resize', tplace); tstep(0, 1);
  }
  async function tstep(i, dir) {
    const L = TS(); if (i < 0) i = 0; if (i >= L.length) return tend(false); ti = i; const st = L[i];
    if (st.view && S.view !== st.view) { S.view = st.view; paint(); if (st.view === 'ai') { await loadCfg(); paint(); } }
    if (st.skip && st.skip()) return tstep(i + dir, dir); // schon eingerichtet -> automatisch ueberspringen
    tov.innerHTML = `<div class="ct-hole"></div><div class="ct-card"><small class="ct-n">${i + 1} / ${L.length}</small><h3 class="ct-t">${esc(st.t)}</h3><p class="ct-d">${esc(st.d)}</p>${extra(st)}<div class="ct-btns"><button class="btn ghost" data-a="skip">${T('Überspringen', 'Skip')}</button><span style="flex:1"></span><button class="btn ghost" data-a="prev"${i ? '' : ' disabled'}>${T('Zurück', 'Back')}</button><button class="btn" data-a="next">${st.last ? T('Cloudy Notes starten', 'Start Cloudy Notes') : T('Weiter', 'Next')}</button></div></div>`;
    tov.querySelector('[data-a=skip]').onclick = () => tend(true); tov.querySelector('[data-a=prev]').onclick = () => tstep(i - 1, -1); tov.querySelector('[data-a=next]').onclick = () => st.last ? tend(false) : tstep(i + 1, 1);
    const tt = tov.querySelector('[data-t]'); if (tt) tt.onclick = async () => { tt.disabled = true; tt.textContent = T('Teste …', 'Testing …'); const ok = await test(st.test); await tstep(ti, 1); if (ok) toast(T('Verbunden ✓', 'Connected ✓')); };
    const sm = tov.querySelector('[data-sample]'); if (sm) sm.onclick = () => { newNote(T('Idee: Im Shop soll ich Items nach Preis sortieren können.\n\n- Sortier-Knopf oben im Shop\n- „Preis ↑“ und „Preis ↓“\n- Auswahl merken', 'Idea: let me sort shop items by price.\n\n- Sort button at the top of the shop\n- “Price ↑” and “Price ↓”\n- Remember the choice')); tstep(ti, 1); };
    const gt = tov.querySelector('[data-goto]'); if (gt) gt.onclick = () => { S.view = 'ai'; tend(true); paint(); };
    if (st.all) Promise.all(['backend', 'project'].map(w => window.cloudy.notesCheck(w).then(r => { S.conn[w] = { ok: !!r.ok, msg: r.ok ? '' : r.error || (r.reasons || [])[0] }; }))).then(() => { const c = $('#ntConn'); if (c && tov) { const m = tov.querySelector('.ct-conn'); if (m) m.innerHTML = connRows(); } paint(); tplace(); });
    tplace(); setTimeout(tplace, 380); tourSave({ step: i });
  }
  const connRows = () => [['ChatGPT / OpenAI', S.conn.openai], ['Claude', S.conn.claude], ['Cloudy Backend', S.conn.backend], [T('Cloudy Projektzugriff', 'Cloudy project access'), S.conn.project]].map(([n, c]) => `<div class="nt-crow">${dot(c && c.ok)}<span>${n}</span><small>${c ? (c.ok ? 'OK' : esc(c.msg || '')) : T('nicht geprüft', 'not checked')}</small></div>`).join('');
  function extra(st) {
    if (st.flow) return `<div class="nt-flow"><span>${T('Notizen', 'Notes')}</span>→<span>ChatGPT</span>→<span>Claude</span>→<span>Cloudy Update</span></div>`;
    if (st.test) return `<div class="ct-btns"><button class="btn" data-t>${T('Verbindung testen', 'Test connection')}</button></div><div class="ct-conn nt-conn2">${connRows()}</div>`;
    if (st.all) return `<div class="ct-conn nt-conn2">${connRows()}</div><div class="ct-btns"><button class="btn ghost" data-goto>${T('Zu den Einstellungen', 'Go to settings')}</button></div>`;
    if (st.sample) return `<div class="ct-btns"><button class="btn ghost" data-sample>${T('Beispielnotiz anlegen', 'Add a sample note')}</button></div>`;
    if (st.status) return `<div class="nt-sample"><small class="muted">${T('Beispiel (nicht echt) – so sieht der Status später aus:', 'Example (not real) – this is what the status looks like later:')}</small><div class="nt-prog"><i style="width:62%"></i></div><div class="nt-steps"><span class="dn">${T('Prompt übertragen', 'Prompt sent')}</span><span class="dn">${T('Projekt untersuchen', 'Inspect project')}</span><span class="cr">${T('Implementierung', 'Implementation')}</span><span>${T('Testen', 'Testing')}</span></div></div>`;
    return '';
  }
  function tplace() {
    if (!tov) return; const st = TS()[ti]; if (!st) return; const tgt = st.s ? root.querySelector(st.s) : null, hole = tov.querySelector('.ct-hole'), card = tov.querySelector('.ct-card'); if (!hole || !card) return;
    if (tgt) tgt.scrollIntoView({ block: 'nearest' }); const r = tgt && tgt.getBoundingClientRect();
    if (r && r.width) { hole.style.cssText = `left:${r.left - 6}px;top:${r.top - 6}px;width:${r.width + 12}px;height:${r.height + 12}px`; hole.hidden = false; } else hole.hidden = true;
    const cw = card.offsetWidth || 340, ch = card.offsetHeight || 200; let x = r && r.width ? r.right + 18 : innerWidth / 2 - cw / 2, y = r && r.width ? r.top : innerHeight / 2 - ch / 2;
    if (r && r.width && x + cw > innerWidth - 12) { x = Math.max(12, Math.min(innerWidth - cw - 12, r.left)); y = r.bottom + 14; if (y + ch > innerHeight - 12) y = Math.max(12, r.top - ch - 14); }
    card.style.left = Math.max(12, x) + 'px'; card.style.top = Math.max(12, Math.min(innerHeight - ch - 12, y)) + 'px';
  }
  function tend(skipped) { if (!tov) return; tov.remove(); tov = null; removeEventListener('resize', tplace); tourSave({ done: true, skipped: !!skipped }); S.view = 'notes'; paint(); }

  // ---------- Start ----------
  async function init() {
    load(); paint(); await loadCfg(); const pc = lg('cloudy.notes.conn', {}); for (const k in pc) if (pc[k] && pc[k].ok) S.conn[k] = { ok: true };
    await sync(true); if (S.srv && S.srv.tour && S.srv.tour.done) ls('cloudy.notes.tour', { ...lg('cloudy.notes.tour', {}), done: true });
    const bs = await window.cloudy.notesBuildState().catch(() => null); if (bs && bs.state) { S.build[bs.id] = bs.state; }
    paint(); if (!done()) setTimeout(() => tour(false), 500);
    clearInterval(pollT); pollT = setInterval(() => { if (root.classList.contains('on') && !document.hidden && !S.busy) sync(false); }, 20000);
  }
  let started = false; const ps = window.paintSub;
  window.paintSub = p => { if (ps) ps(p); if (p === 'notes') setTimeout(() => { if (!started) { started = true; init(); } else { paint(); sync(false); } }, 0); };
  addEventListener('online', () => sync(false)); addEventListener('beforeunload', () => { for (const n of S.notes.filter(x => x._dirty)) api('/notes/save', { id: n.id, title: n.title, body: n.body, base: n._known ? n.updated : undefined }); });
  window.cloudyNotes = { state: S, sync, tour: () => tour(true) };
})();
