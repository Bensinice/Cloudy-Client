/* Cloudy – Erweiterungen der Oberfläche: Themes, Updater, Einführung, Ressourcen-Manager.
   Nutzt die Helfer aus index.html ($, $$, st, esc, go, play, openMod, chips, catName, version). */

// ---------- Themes ----------
const THEMES = [
  { id: 'light', name: 'Cloudy Blau', bg: ['#eaf5ff', '#a9d4ff'], c: '#4aa3ff' },
  { id: 'dark', name: 'Cloudy Nacht', bg: ['#11244a', '#0a1328'], c: '#4aa3ff' },
  { id: 'pink-light', name: 'Light Pink', bg: ['#fff3f8', '#ffbfdc'], c: '#ff5fa2' },
  { id: 'pink-dark', name: 'Dark Pink', bg: ['#2e0f21', '#1c0a14'], c: '#ff5fa2' },
  { id: 'purple-light', name: 'Light Purple', bg: ['#f5eeff', '#cdb0ff'], c: '#8b5cf6' },
  { id: 'purple-dark', name: 'Dark Purple', bg: ['#1e1040', '#120a24'], c: '#9d6bff' },
  { id: 'lavender', name: 'Lavender', bg: ['#f7f3ff', '#d6c8f3'], c: '#a58be0' },
  { id: 'midnight', name: 'Midnight Purple', bg: ['#120b26', '#07050f'], c: '#7c5cff' },
  { id: 'lunar', name: 'Lunar (Slate)', bg: ['#0d1422', '#070b14'], c: '#38bdf8' },
  { id: 'ember', name: 'Ember', bg: ['#42200f', '#150a07'], c: '#ff7a3c' },
  { id: 'forest', name: 'Forest', bg: ['#143823', '#07140d'], c: '#3fd08a' },
  { id: 'paper', name: 'Paper', bg: ['#fafaf7', '#e2e0d6'], c: '#2b2b2b' },
  { id: 'mono', name: 'Dark', bg: ['#232325', '#0b0b0c'], c: '#f2f2f2' },
  { id: 'glass', name: 'Glas (durchsichtig)', bg: ['#6fa8dc', '#1b3350'], c: '#8ccbff' },
  { id: 'system', name: 'System', bg: ['#eaf5ff', '#11244a'], c: '#4aa3ff' }
];
const PAIR = { light: 'dark', dark: 'light', 'pink-light': 'pink-dark', 'pink-dark': 'pink-light', 'purple-light': 'purple-dark', 'purple-dark': 'purple-light', lavender: 'midnight', midnight: 'lavender', lunar: 'paper', paper: 'mono', mono: 'paper', glass: 'light', ember: 'light', forest: 'light' };
const sysDark = matchMedia('(prefers-color-scheme: dark)');
function themeId() {
  const t = st.get('theme', 'light');
  if (t === 'system') return sysDark.matches ? 'dark' : 'light';
  return THEMES.some(x => x.id === t && x.id !== 'system') ? t : 'light';
}
function applyTheme() {
  const id = themeId(), root = document.documentElement;
  root.dataset.theme = id;
  const cs = getComputedStyle(root), dark = cs.getPropertyValue('--mode').trim() === 'dark';
  $('#themeBtn span').textContent = dark ? 'Heller Modus' : 'Dunkler Modus';
  $$('.th').forEach(b => b.classList.toggle('on', b.dataset.id === st.get('theme', 'light')));
  const th = THEMES.find(x => x.id === id) || THEMES[0];
  window.cloudy.themeColor({ bg: cs.getPropertyValue('--title-bg').trim(), fg: cs.getPropertyValue('--ink').trim(), id, sky: [th.bg[1], th.bg[0]], accent: th.c, dark }).catch(() => {});
}
$('#themeGrid').innerHTML = THEMES.map(t => `<button class="th" data-id="${t.id}"><i style="background:linear-gradient(135deg,${t.bg[0]},${t.bg[1]});--sw:${t.c}"></i>${t.name}</button>`).join('');
$$('.th').forEach(b => b.onclick = () => { st.set('theme', b.dataset.id); applyTheme(); });
$('#themeBtn').onclick = () => { st.set('theme', PAIR[themeId()] || 'light'); applyTheme(); };
sysDark.onchange = () => { if (st.get('theme', 'light') === 'system') applyTheme(); };
applyTheme();

// ---------- Fensterknöpfe (Windows) ----------
if (/Windows/i.test(navigator.userAgent)) document.documentElement.classList.add('win');
$('#wcMin').onclick = () => window.cloudy.winCtl('min'); $('#wcMax').onclick = () => window.cloudy.winCtl('max'); $('#wcX').onclick = () => window.cloudy.winCtl('close');

// ---------- Schnellzugriff ----------
$$('[data-go]').forEach(b => b.onclick = () => go(b.dataset.go));
$('#heroPlay').onclick = () => play();

// ---------- Updates ----------
let upd = null, updBusy = false;
const MB = n => (n / 1048576).toFixed(1);
const setUpd = t => { $('#updMsg').textContent = t; $('#updBS').textContent = t; };
const bars = (on, pct) => $$('.ubar').forEach(b => { b.classList.toggle('on', on); if (pct != null) b.firstElementChild.style.width = pct + '%'; });
async function repoName() { const i = await window.cloudy.appVersion(); return i.repo || st.get('repo', ''); }
let updCool = 0;
async function checkUpd(manual) {
  if (manual && Date.now() < updCool) { setUpd(L('Bitte kurz warten …') + ' (' + Math.ceil((updCool - Date.now()) / 1000) + ' s)'); return; }
  const repo = await repoName();
  if (!repo) { if (manual) setUpd('Online-Updates sind nicht eingerichtet. Wähle unten „Update-Datei wählen …“ und nimm die neueste Update-ZIP.'); return; }
  if (manual) { $('#upd').disabled = true; setUpd('Prüfe …'); }
  const r = await window.cloudy.checkUpdate(repo);
  $('#upd').disabled = false;
  if (manual && !(r.ok && r.newer)) { updCool = Date.now() + 10000; $('#upd').disabled = true; setTimeout(() => { if (!updBusy) $('#upd').disabled = false; }, 10000); } // Wartezeit gegen Spammen (nicht, wenn ein Update bereitliegt)
  if (!r.ok) { if (manual) setUpd(r.error); return; }
  upd = r;
  if (r.newer) {
    $('#updBT').textContent = `Cloudy ${r.latest} ist verfügbar`;
    setUpd(`Neue Version ${r.latest} (du hast ${r.current})${r.size ? ' · ' + MB(r.size) + ' MB' : ''}`);
    $('#updBanner').classList.add('on');
    $('#upd').textContent = r.canInstall ? 'Jetzt aktualisieren' : 'Download-Seite öffnen';
    $('#updNow').textContent = $('#updHome').textContent = $('#upd').textContent;
  } else { $('#updBanner').classList.remove('on'); $('#upd').textContent = 'Nach Updates suchen'; if (manual) setUpd(`Cloudy ${r.current} ist aktuell.`); }
}
async function runUpdate() {
  if (updBusy) return;
  updBusy = true; $('#upd').disabled = $('#updNow').disabled = $('#updHome').disabled = true; bars(true, 0); setUpd('Lade Update …');
  const r = await window.cloudy.updateInstall();
  if (!r.ok) { updBusy = false; $('#upd').disabled = $('#updNow').disabled = $('#updHome').disabled = false; bars(false); setUpd(r.error || 'Update fehlgeschlagen.'); }
}
$('#upd').onclick = () => upd && upd.newer ? runUpdate() : checkUpd(true);
$('#updNow').onclick = runUpdate;
$('#updForce').onclick = async () => { // lädt das neueste GitHub-Release und installiert es, auch wenn es nicht neuer ist (Downgrade möglich)
  if (updBusy) return; if (!confirm(L('Das neueste Release von GitHub jetzt erzwingen? Es wird installiert, auch wenn es nicht neuer oder sogar älter ist.'))) return;
  const repo = await repoName(); if (!repo) { setUpd('Keine GitHub-Quelle gesetzt.'); return; }
  updBusy = true; $('#upd').disabled = $('#updForce').disabled = true; bars(true, 0); setUpd('Suche Release …');
  const c = await window.cloudy.checkUpdate(repo);
  if (!c.ok) { updBusy = false; $('#upd').disabled = $('#updForce').disabled = false; bars(false); setUpd(c.error || 'Update fehlgeschlagen.'); return; }
  setUpd(`Erzwinge ${c.latest} (installiert: ${c.current}) …`);
  const r = await window.cloudy.updateInstall({ force: true });
  if (!r.ok) { updBusy = false; $('#upd').disabled = $('#updForce').disabled = false; bars(false); setUpd(r.error || 'Update fehlgeschlagen.'); }
};
$('#updHome').onclick = async () => { // Update-Knopf auf der Startseite
  if (upd && upd.newer) return runUpdate();
  const b = $('#updHome'); b.disabled = true; b.textContent = 'Prüfe …';
  await checkUpd(true);
  b.disabled = false;
  if (upd && upd.newer) return;
  b.textContent = 'Nach Updates suchen';
  $('#updBT').textContent = 'Update-Prüfung'; $('#updBS').textContent = $('#updMsg').textContent;
  $('#updNow').style.display = 'none'; $('#updBanner').classList.add('on');
  setTimeout(() => { $('#updBanner').classList.remove('on'); $('#updNow').style.display = ''; }, 6000);
};
$('#repo').value = st.get('repo', '');
$('#repo').onchange = e => st.set('repo', e.target.value.trim());
window.cloudy.on('update-progress', p => {
  if (p.phase === 'download') { bars(true, p.pct); setUpd(`Lade herunter … ${Math.round(p.pct)} % (${MB(p.got)} / ${MB(p.total)} MB)`); }
  else { bars(true, 100); setUpd('Installiere und starte Cloudy neu …'); }
});
window.cloudy.appVersion().then(i => {
  $('#updMsg').textContent = 'Cloudy ' + i.v;
  if (i.repo) $('#repoRow').style.display = 'none';
  $('#heroVer').textContent = 'Cloudy ' + i.v + (i.suffix ? ' ' + i.suffix : '');
  $('#updMsg').textContent = 'Cloudy ' + i.v + (i.suffix ? ' ' + i.suffix : '');
  try { const dc = window.cloudy.discordGet; if (dc && $('#dcId')) { dc().then(c => { $('#dcOn').checked = c.on; $('#dcId').value = c.id; });
    const sv = async () => { const c = await window.cloudy.discordSet({ on: $('#dcOn').checked, id: $('#dcId').value }); $('#dcId').value = c.id; $('#dcMsg').textContent = !c.on ? 'Aus.' : c.id ? 'Gespeichert – ist Discord offen, steht gleich „Spielt mit Cloudy“ da.' : 'Noch keine ID eingetragen.'; };
    $('#dcOn').onchange = sv; $('#dcId').onchange = sv; $('#dcLink').onclick = e => { e.preventDefault(); window.cloudy.openExternal('https://discord.com/developers/applications'); }; } } catch {}
  window.cloudy.autoUpdGet().then(on => { // Beim Start prüfen; mit Auto-Accept gleich installieren, sonst nach 10 s nachfragen
    $('#autoUpd').checked = on;
    setTimeout(async () => { await checkUpd(false); if (upd && upd.newer && upd.mandatory) return forceUpd(); if (upd && upd.newer && upd.canInstall) offerUpdate('Cloudy ' + upd.latest, runUpdate); await checkUrlUpd(); }, 2500);
    // Alle 10 Minuten bei GitHub nachsehen; mit Auto-Accept wird ein neues Update sofort installiert (nicht während Minecraft läuft – dann beim nächsten Durchlauf)
    setInterval(async () => { await checkUpd(false); if (upd && upd.newer) { if (upd.mandatory) forceUpd(); else if (upd.canInstall && !updBusy && await window.cloudy.autoUpdGet()) runUpdate(); } else await checkUrlUpd(); }, 10 * 60 * 1000);
  });
});
// Pflicht-Update: nach 24 Stunden wird eine neuere Version ohne Rückfrage installiert (Zurückgehen auf ältere Versionen gibt es nicht)
let forcing = false;
function forceUpd(url) {
  if (forcing || updBusy) return; forcing = true;
  const d = document.createElement('div'); d.style.cssText = 'position:fixed;inset:0;z-index:99998;display:grid;place-items:center;background:rgba(8,16,34,.55);backdrop-filter:blur(8px)';
  d.innerHTML = '<div class="glass set" style="padding:22px 26px;max-width:420px;text-align:center"><h3 style="margin:0 0 6px">Pflicht-Update</h3><p class="muted" id="fuMsg">Eine neue Cloudy-Version ist seit über einem Tag verfügbar und wird jetzt installiert …</p><div class="ubar on"><i style="width:0"></i></div></div>';
  document.body.appendChild(d);
  (async () => {
    let r; if (url) { r = await window.cloudy.updateFromUrl(url); if (!r.ok) r.error = r.msg; } else r = await window.cloudy.updateInstall();
    if (r && !r.ok) { $('#fuMsg').textContent = (r.error || 'Update fehlgeschlagen.') + ' Cloudy versucht es später erneut.'; setTimeout(() => { d.remove(); forcing = false; }, 6000); }
  })();
}
async function checkUrlUpd() { const u = st.get('updUrl', ''); if (!u) return; const r = await window.cloudy.updateCheckUrl(u); if (r && r.ok && r.newer) { if (r.mandatory) forceUpd(u); else offerUpdate('Cloudy ' + r.latest, () => window.cloudy.updateFromUrl(u)); } }
// Rückfrage: 10 Sekunden warten, dann fragen. „Immer automatisch“ schaltet Auto-Accept ein (in den Einstellungen wieder aus).
let askBusy = null;
function askUpdate(label) { // Apple-artige Abfrage: erst 10 s Hinweis, dann „Update verfügbar“ mit Jetzt / Später
  if (askBusy) return askBusy;
  askBusy = new Promise(res => {
    const en = (document.documentElement.lang || 'de') !== 'de', tx = (d, e) => en ? e : d;
    const toast = document.createElement('div'); toast.className = 'updt'; document.body.appendChild(toast);
    let n = 10; const paint = () => { toast.textContent = tx(`${label} gefunden – Rückfrage in ${n} s`, `${label} found – asking in ${n} s`); }; paint();
    const tick = setInterval(() => {
      n--; if (n > 0) return paint(); clearInterval(tick); toast.remove();
      const box = document.createElement('div'); box.className = 'updq'; box.setAttribute('role', 'alertdialog');
      box.innerHTML = `<div class="updsheet"><div class="uph"><b>${tx('Update verfügbar', 'Update Available')}</b><p>${esc(label)} ${tx('kann jetzt installiert werden. Cloudy startet danach neu.', 'can be installed now. Cloudy restarts afterwards.')}</p></div><div class="upr"><button data-a="n">${tx('Später', 'Later')}</button><button data-a="y" class="p">${tx('Jetzt aktualisieren', 'Update Now')}</button></div><div class="upr one"><button data-a="auto">${tx('Immer automatisch', 'Always Automatic')}</button></div></div>`;
      document.body.appendChild(box);
      box.querySelectorAll('[data-a]').forEach(b => b.onclick = async () => { const a = b.dataset.a; if (a === 'auto') { await window.cloudy.autoUpdSet(true); $('#autoUpd').checked = true; } box.classList.add('out'); setTimeout(() => box.remove(), 180); askBusy = null; res(a !== 'n'); });
    }, 1000);
  });
  return askBusy;
}
// Auto-Accept: sofort. Sonst fragen; bei „Später“ nach 10 Minuten noch einmal.
async function offerUpdate(label, go) { if (await window.cloudy.autoUpdGet()) return go(); if (await askUpdate(label)) go(); else setTimeout(() => offerUpdate(label, go), 600000); }
window.cloudy.on('updateFound', d => offerUpdate(d && d.name ? d.name.replace(/\.zip$/i, '') : 'Update', () => window.cloudy.localUpdateRun({})));
$('#autoUpd').onchange = e => window.cloudy.autoUpdSet(e.target.checked);

// ---------- Einführung (nur beim ersten Start) ----------
const ICO = {
  cloud: '<path d="M17.5 19a4.5 4.5 0 1 0-1.7-8.7A6 6 0 1 0 5 14.5 4 4 0 0 0 6.5 19z"/>',
  play: '<circle cx="12" cy="12" r="9"/><path d="M10 8.5l6 3.5-6 3.5z"/>',
  mods: '<path d="M12 2l9 5v10l-9 5-9-5V7zM12 12l9-5M12 12v10M12 12L3 7"/>',
  pack: '<rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/>',
  style: '<circle cx="12" cy="12" r="9"/><circle cx="8.5" cy="10" r="1.2"/><circle cx="12" cy="7.5" r="1.2"/><circle cx="15.5" cy="10" r="1.2"/><path d="M12 21c-1.5 0-2-1.2-1.4-2.3.6-1 .2-2.2-1-2.2H8"/>'
};
const OB = [
  { i: ICO.cloud, t: 'Willkommen bei Cloudy', p: 'Dein Minecraft-Launcher in Wolkenoptik. In einer Minute zeigen wir dir, wie alles funktioniert.' },
  { i: ICO.play, t: 'Version wählen und spielen', p: 'Unter „Versionen“ suchst du dir eine Minecraft-Version aus. Der große Spielen-Knopf startet das Spiel. Java und alle Dateien lädt Cloudy automatisch.' },
  { i: ICO.mods, t: 'Mods mit Fabric', p: 'Im Tab „Mods“ findest du Mods von Modrinth. Fabric richtet Cloudy selbst ein. In der „Bibliothek“ schaltest du Mods ein oder aus, suchst und löschst sie.' },
  { i: ICO.pack, t: 'Ressourcenpakete und Shader', p: 'Im Tab „Ressourcen“ verwaltest du Ressourcenpakete und Shader. Für Shader installiert Cloudy bei Bedarf Fabric und Iris dazu.' },
  { i: ICO.style, t: 'Dein Stil, dein Konto', p: 'In den Einstellungen wählst du eines von vielen Farbthemen, meldest dich mit Microsoft an und hältst Cloudy mit einem Klick aktuell.' }
];
let obStep = 0;
function obDone() { st.set('onboarded', true); $('#onb').classList.remove('on'); }
function obDraw() {
  const s = OB[obStep], last = obStep === OB.length - 1;
  $('#obBox').innerHTML = `<div class="slide" key="${obStep}"><div class="art"><svg viewBox="0 0 24 24">${s.i}</svg></div><h2>${s.t}</h2><p>${s.p}</p></div>
    <div class="dots">${OB.map((_, i) => `<i class="${i === obStep ? 'on' : ''}"></i>`).join('')}</div>
    <div class="go"><button class="btn ghost" id="obSkip">Überspringen</button><button class="btn" id="obNext">${last ? 'Los geht’s' : 'Weiter'}</button></div>`;
  $('#obSkip').onclick = obDone;
  $('#obNext').onclick = () => { if (last) obDone(); else { obStep++; obDraw(); } };
}
function showOnb() { obStep = 0; obDraw(); $('#onb').classList.add('on'); }
$('#onbAgain').onclick = showOnb;


// ---------- Ressourcen-Manager (Ressourcenpakete + Shader) ----------
let ptype = 'resourcepack', pver = '', pcat = 'all', pq = '', pdata = [];
async function loadPacks() {
  const lib = await window.cloudy.libList();
  const ids = [...new Set([version, ...lib.map(x => x.id)].filter(Boolean))];
  if (!pver || !ids.includes(pver)) pver = version || ids[0] || '';
  $('#pver').innerHTML = ids.map(i => `<option value="${esc(i)}" ${i === pver ? 'selected' : ''}>${esc(iname(i))}</option>`).join(''); paintPCats();
  $('#phint').textContent = ptype === 'shader' ? 'Shader laufen mit Fabric und Iris. Cloudy installiert beide beim Herunterladen eines Shaders automatisch.' : 'Ausgeschaltete Pakete bleiben gespeichert, erscheinen aber nicht im Spiel.';
  await refreshPacks();
  searchPacks();
}
async function refreshPacks() {
  if (!pver) { $('#plist').innerHTML = '<p class="muted">Wähle zuerst eine Version.</p>'; return; }
  paintPacks(await window.cloudy.packList(pver, ptype));
  const v = pver, t = ptype;
  window.cloudy.packEnrich(v, t).then(m => { if (v === pver && t === ptype) paintPacks(m); }).catch(() => {});
}
function paintPacks(m) {
  pdata = m;
  const cats = [...new Set(m.flatMap(x => x.cats || []))].sort();
  if (!['all', 'on', 'off', ...cats].includes(pcat)) pcat = 'all';
  $('#pcats').innerHTML = chips([['all', 'Alle (' + m.length + ')'], ['on', 'Aktiv'], ['off', 'Ausgeschaltet'], ...cats.map(c => [c, catName(c)])], pcat);
  $$('#pcats [data-c]').forEach(b => b.onclick = () => { pcat = b.dataset.c; paintPacks(pdata); });
  const q = pq.trim().toLowerCase();
  const list = m.filter(x => (pcat === 'all' || (pcat === 'on' ? x.enabled : pcat === 'off' ? !x.enabled : (x.cats || []).includes(pcat))) && (!q || (x.name + ' ' + x.file + ' ' + (x.desc || '') + ' ' + (x.cats || []).map(c => c + ' ' + catName(c)).join(' ')).toLowerCase().includes(q)));
  $('#plist').innerHTML = list.map(x => {
    const ic = x.icon ? `<img class="mi" src="${esc(x.icon)}" alt="">` : `<span class="ph">${esc((x.name[0] || '?').toUpperCase())}</span>`;
    return `<div class="glass srv">${ic}<div class="tx"><b ${x.project ? `class="clk" data-o="${esc(x.project)}"` : ''}>${esc(x.name)}</b>${x.desc ? `<small class="d">${esc(x.desc)}</small>` : ''}<small>${esc(x.file)}${x.folder ? ' · Ordner' : ''}${x.enabled ? '' : ' · ausgeschaltet'}</small></div><label class="sw" title="An/Aus"><input type="checkbox" data-t="${esc(x.file)}" ${x.enabled ? 'checked' : ''}><i></i></label><button class="btn ghost" data-rm="${esc(x.file)}">Löschen</button></div>`;
  }).join('') || `<p class="muted" style="margin-top:12px">${m.length ? 'Nichts gefunden.' : ptype === 'shader' ? 'Noch keine Shader installiert.' : 'Noch keine Ressourcenpakete installiert.'}</p>`;
  $$('#plist [data-t]').forEach(c => c.onchange = async () => { await window.cloudy.packToggle(pver, ptype, c.dataset.t); refreshPacks(); });
  $$('#plist [data-rm]').forEach(b => b.onclick = async () => { if (!confirm('Dieses Paket löschen?')) return; await window.cloudy.packRemove(pver, ptype, b.dataset.rm); refreshPacks(); });
  $$('#plist [data-o]').forEach(n => n.onclick = () => openMod(n.dataset.o, { type: ptype, ver: pver }));
}
let pPage = 0;
async function searchPacks(pg) {
  if (!pver) return; pPage = typeof pg === 'number' ? pg : 0;
  $('#pmres').innerHTML = '<p class="muted">Suche …</p>';
  try {
    const qq = catFromQuery($('#pmq').value.trim(), PACK_CATS[ptype] || []); const r = await window.cloudy.packSearch({ q: qq.q, version: pver, type: ptype, cat: pSearchCat || qq.cat, offset: pPage * 20 });
    $('#pmres').innerHTML = r.map(m => `<div class="glass srv" data-p="${esc(m.id)}"><img class="mi" src="${esc(m.icon || '')}" alt=""><div class="tx"><b>${esc(m.title)}</b> <small style="display:inline">von ${esc(m.author)} · ${fmt(m.downloads)} Downloads</small><small class="d">${esc(m.desc)}</small></div><button class="btn" data-i="${esc(m.id)}">Installieren</button></div>`).join('') || '<p class="muted">Nichts für diese Version gefunden.</p>';
    $$('#pmres > .srv').forEach((el, i) => { const c = r[i] && r[i].cats; if (c && c.length && el.querySelector('.tx')) el.querySelector('.tx').insertAdjacentHTML('beforeend', '<small class="cats">' + c.map(x => esc(catName(x))).join(' · ') + '</small>'); });
    $$('#pmres [data-i]').forEach(b => b.onclick = async () => { b.disabled = true; b.textContent = 'Lädt …'; const ok = await window.cloudy.packInstall(b.dataset.i, pver, ptype); b.textContent = ok ? 'Installiert ✓' : 'Nicht verfügbar'; if (ok) refreshPacks(); });
    $$('#pmres [data-p]').forEach(r => r.onclick = e => { if (!e.target.closest('button')) openMod(r.dataset.p, { type: ptype, ver: pver }); });
    window.pager($('#pmres'), pPage, r.length >= 20, searchPacks);
  } catch (e) { const d = String((e && e.message) || e || '').replace(/^Error invoking remote method '[^']+': (Error: )?/, '').slice(0, 140); $('#pmres').innerHTML = '<p class="muted">' + L('Modrinth ist nicht erreichbar.') + (d ? ' <small>(' + esc(d) + ')</small>' : '') + '</p><button class="btn ghost" id="pmRetry">' + L('Erneut versuchen') + '</button>'; const rb = $('#pmRetry'); if (rb) rb.onclick = () => searchPacks(pPage); }
}
const PACK_CATS = { resourcepack: ['decoration', 'utility', 'vanilla-like', 'realistic', 'simplistic', 'themed', 'tweaks', 'combat', 'cursed', 'fantasy', 'gui', 'audio', 'modded'], shader: ['semi-realistic', 'realistic', 'cartoon', 'fantasy', 'vanilla-like', 'cursed', 'atmosphere', 'shadows', 'reflections', 'path-tracing', 'colored-lighting'] };
let pSearchCat = '';
function paintPCats() { $('#pmCats').innerHTML = chips([['', 'Alle Kategorien'], ...(PACK_CATS[ptype] || []).map(c => [c, catName(c)])], pSearchCat); $$('#pmCats [data-c]').forEach(b => b.onclick = () => { pSearchCat = b.dataset.c; paintPCats(); searchPacks(); }); }
$$('[data-pt]').forEach(b => b.onclick = () => { ptype = b.dataset.pt; pcat = 'all'; pSearchCat = ''; paintPCats(); $$('[data-pt]').forEach(x => x.classList.toggle('on', x === b)); $('#pmres').innerHTML = ''; loadPacks(); });
$('#pver').onchange = e => { pver = e.target.value; $('#pmres').innerHTML = ''; refreshPacks(); searchPacks(); };
$('#pq').oninput = e => { pq = e.target.value; paintPacks(pdata); };
$('#pfolder').onclick = () => pver && window.cloudy.packFolder(pver, ptype);
$('#pmsearch').onclick = () => searchPacks(0); $('#pmq').onkeydown = e => { if (e.key === 'Enter') searchPacks(0); };
$('#pmq').onkeydown = e => { if (e.key === 'Enter') searchPacks(); };

// ---------- Screenshot-Manager ----------
let sver = '';
async function loadShots() {
  const lib = await window.cloudy.libList();
  const ids = [...new Set([version, ...lib.map(x => x.id)].filter(Boolean))];
  if (!sver || !ids.includes(sver)) sver = version || ids[0] || '';
  $('#sver').innerHTML = ids.map(i => `<option ${i === sver ? 'selected' : ''}>${esc(i)}</option>`).join('');
  if (!sver) { $('#sgrid').innerHTML = '<p class="muted">Wähle zuerst eine Version.</p>'; return; }
  const l = await window.cloudy.shotList(sver);
  $('#sgrid').innerHTML = l.map(x => `<div class="glass tile" data-sf="${esc(x.file)}" style="padding:10px">${x.thumb ? `<img src="${x.thumb}" alt="" style="width:100%;border-radius:14px;display:block">` : ''}<div style="display:flex;align-items:center;gap:8px;margin-top:8px"><small class="muted" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(x.file)}</small><button class="chip" data-sd="${esc(x.file)}" title="In den Papierkorb">Löschen</button></div></div>`).join('') || '<p class="muted" style="margin-top:14px">Noch keine Screenshots. Im Spiel mit F2 aufnehmen.</p>';
  $$('#sgrid [data-sf]').forEach(t => t.onclick = e => { if (!e.target.closest('[data-sd]')) window.cloudy.shotOpen(sver, t.dataset.sf); });
  $$('#sgrid [data-sd]').forEach(b => b.onclick = async () => { await window.cloudy.shotDelete(sver, b.dataset.sd); loadShots(); });
}
$('#sver').onchange = e => { sver = e.target.value; loadShots(); };
$('#sfolder').onclick = () => sver && window.cloudy.shotFolder(sver);

// ---------- Performance-Presets ----------
const PRE = {
  lowend: { ram: 2, jvm: '-XX:+UseG1GC -XX:MaxGCPauseMillis=100' },
  performance: { ram: 4, jvm: '-XX:+UseG1GC -XX:MaxGCPauseMillis=50 -XX:+ParallelRefProcEnabled' },
  balanced: { ram: 4, jvm: '' },
  quality: { ram: 8, jvm: '-XX:+UseG1GC -XX:MaxGCPauseMillis=50' }
};
$('#preset').value = st.get('preset', '');
$('#preset').onchange = e => {
  const k = e.target.value; st.set('preset', k);
  const p = PRE[k]; if (!p) return;
  st.set('ram', p.ram); $('#ram').value = p.ram; $('#ramv').textContent = p.ram + ' GB';
  st.set('jvm', p.jvm); $('#jvm').value = p.jvm;
  st.set('perf', true); $('#perf').checked = true;
};

// ---------- Konfiguration exportieren / importieren ----------
$('#cfgExp').onclick = async () => {
  const ls = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); ls[k] = localStorage.getItem(k); }
  const r = await window.cloudy.cfgExport(JSON.stringify({ cloudy: 1, ls }, null, 2));
  $('#status').textContent = r.ok ? 'Einstellungen exportiert ✓' : (r.error || '');
};
$('#cfgImp').onclick = async () => {
  const r = await window.cloudy.cfgImport();
  if (!r.ok) { if (!r.cancel) $('#status').textContent = r.error; return; }
  for (const [k, v] of Object.entries(r.data.ls)) if (typeof v === 'string' && v.length < 200000) localStorage.setItem(k, v);
  location.reload();
};

// ---------- Systemanzeige (Startseite) ----------
const GB = n => (n / 1073741824).toFixed(1);
function sysRow(label, pct, text) { return `<div><div style="display:flex;justify-content:space-between;font-size:13px;font-weight:600;color:var(--ink2)"><span>${label}</span><span>${text}</span></div><div class="bar"><i style="width:${Math.min(100, pct)}%"></i></div></div>`; }
async function pollSys() {
  if (document.hidden || !$('#p-home').classList.contains('on')) return;
  try {
    const s = await window.cloudy.sysStats();
    let h = sysRow('CPU', s.cpu, s.cpu + ' %') + sysRow('Arbeitsspeicher', s.ramUsed / s.ramTotal * 100, `${GB(s.ramUsed)} / ${GB(s.ramTotal)} GB`);
    if (s.gpu) h += sysRow('GPU (' + esc(s.gpu.name) + ')', s.gpu.util, `${s.gpu.util} % · ${(s.gpu.memUsed / 1024).toFixed(1)} / ${(s.gpu.memTotal / 1024).toFixed(1)} GB`);
    if (s.mc) h += sysRow('Minecraft', s.mc / s.ramTotal * 100, GB(s.mc) + ' GB RAM');
    $('#sysRows').innerHTML = h;
  } catch {}
}
pollSys(); setInterval(pollSys, 2500);

// ---------- Glas einstellen ----------
function applyGlass() {
  const op = st.get('glassOp', null), bl = st.get('glassBlur', null), r = document.documentElement.style;
  if (op === null) r.removeProperty('--gm'); else r.setProperty('--gm', op / 100);
  if (bl === null) r.removeProperty('--glass-blur'); else r.setProperty('--glass-blur', bl + 'px');
  const gm = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--gm')) || .76;
  { const w = st.get('glassWin', 0); r.setProperty('--win-a', ((100 - w) / 100 * 0.9).toFixed(3)); const gw = $('#glassWin'); if (gw) gw.value = w; }
  $('#glassOp').value = Math.round(gm * 100); $('#glassBlur').value = bl === null ? 30 : bl;
}
$('#glassOp').oninput = e => { st.set('glassOp', +e.target.value); applyGlass(); };
$('#glassBlur').oninput = e => { st.set('glassBlur', +e.target.value); applyGlass(); };
$('#glassWin').oninput = e => { st.set('glassWin', +e.target.value); applyGlass(); };
$('#glassReset').onclick = () => { st.set('glassWin', 0); st.set('glassOp', null); st.set('glassBlur', null); applyGlass(); };
$$('.th').forEach(b => b.addEventListener('click', () => setTimeout(applyGlass, 50)));
$('#themeBtn').addEventListener('click', () => setTimeout(applyGlass, 50));
applyGlass();

// ---------- Eigenes Theme: Hintergrundbild + Akzentfarbe ----------
const rootEl = document.documentElement;
function applyBg(data) {
  rootEl.classList.toggle('has-bg', !!data);
  if (data) rootEl.style.setProperty('--bg-img', `url("${data}")`); else rootEl.style.removeProperty('--bg-img');
}
function applyBgLook() {
  rootEl.style.setProperty('--bg-dim', st.get('bgDim', 35) / 100);
  rootEl.style.setProperty('--bg-blur', st.get('bgBlur', 0) + 'px');
}
function applyAccent() {
  const c = st.get('accent', '');
  for (const k of ['--accent', '--accent2', '--accent3']) rootEl.style.removeProperty(k);
  if (!c) return;
  rootEl.style.setProperty('--accent', c);
  rootEl.style.setProperty('--accent2', `color-mix(in srgb, ${c} 55%, white)`);
  rootEl.style.setProperty('--accent3', `color-mix(in srgb, ${c} 70%, #6d5cff)`);
}
$('#bgDim').value = st.get('bgDim', 35); $('#bgBlur').value = st.get('bgBlur', 0);
$('#bgDim').oninput = e => { st.set('bgDim', +e.target.value); applyBgLook(); };
$('#bgBlur').oninput = e => { st.set('bgBlur', +e.target.value); applyBgLook(); };
$('#bgPick').onclick = async () => { const r = await window.cloudy.bgPick(); if (r.ok) { applyBg(r.data); $('#bgMsg').textContent = ''; } else if (!r.cancel) $('#bgMsg').textContent = r.error; };
$('#bgClear').onclick = async () => { await window.cloudy.bgClear(); applyBg(null); };
$('#accCol').value = st.get('accent', '') || '#4aa3ff';
$('#accCol').oninput = e => { st.set('accent', e.target.value); applyAccent(); };
$('#accReset').onclick = () => { st.set('accent', ''); applyAccent(); $('#accCol').value = '#4aa3ff'; };
applyBgLook(); applyAccent();
window.cloudy.bgGet().then(applyBg);

let autoRetry = true; // pro Klick auf „Spielen“ gibt es einen automatischen zweiten Versuch (sicher, ohne Mods)
$('#play').addEventListener('click', () => autoRetry = true); $('#heroPlay').addEventListener('click', () => autoRetry = true);
// ---------- Absturz-Hilfe (Windows-Code 3221225477 = 0xC0000005 = Absturz im Grafiktreiber/nativer Code) ----------
window.cloudy.on('closed', ({ code, hs, safe }) => {
  if (Date.now() - (window.__cancelAt || 0) < 10000) return; // vom Nutzer abgebrochen: kein Absturz-Hinweis, kein Neustart-Versuch
  const el = $('#crashHint'); if (!el) return;
  const native = code === 3221225477 || code === -1073741819;
  if (native && autoRetry && !safe) { // Absturz beim Start: einmal automatisch ohne Mods neu starten
    autoRetry = false; $('#modal').style.display = 'none'; $('#status').textContent = 'Absturz beim Start – Cloudy versucht es automatisch sicher (ohne Mods) noch einmal …';
    setTimeout(() => play(undefined, { safe: 1 }), 1500); return;
  }
  if (!native && !hs) { el.style.display = 'none'; return; }
  const frame = hs && hs.frame ? `<br><small>Problemstelle: <code>${esc(hs.frame)}</code></small>` : '';
  const gpu = hs && /nvoglv|nvd3|nvwgf|atio|amdxx|ig\d+icd|ig9icd|igd/i.test(hs.frame || '');
  el.style.display = 'block';
  el.innerHTML = (gpu ? 'Der <b>Grafiktreiber</b> ist abgestürzt. Installiere den neuesten Treiber (bei NVIDIA „Clean Installation“) und schließe Overlays wie Discord, GeForce Experience oder MSI Afterburner. '
    : 'Minecraft ist im nativen Code abgestürzt (Code ' + code + '), meist Grafiktreiber, Overlay oder Mod. ') + frame +
    '<div class="tools" style="margin:10px 0 0"><button class="chip" id="crSafe">Sicherer Modus (Einstellungen zurücksetzen)</button><button class="chip" id="crStable">Mit Minecraft 1.21.4 spielen</button><button class="chip" id="noIF">Mods ausschalten &amp; neu starten</button></div>';
  $('#crSafe').onclick = () => { $('#modal').style.display = 'none'; play(undefined, { safe: 2 }); };
  $('#crStable').onclick = () => { version = '1.21.4'; st.set('version', version); paintVersion(); $('#modal').style.display = 'none'; play(undefined, {}); };
  $('#noIF').onclick = () => { $('#modal').style.display = 'none'; play(undefined, { safe: 1 }); };
});

// ---------- Lokales Update (Update-Ordner) ----------
$('#luOpen').onclick = () => window.cloudy.localUpdateFolder();
$('#luPick').onclick = async () => { const r = await window.cloudy.updatePickFile(); if (r.none && !r.msg) return; $('#luMsg').textContent = r.ok ? `Update ${r.version} installiert – Cloudy startet neu …` : r.msg; };
if ($('#updUrl')) { $('#updUrl').value = st.get('updUrl', ''); $('#updUrl').onchange = () => st.set('updUrl', $('#updUrl').value.trim()); }
if ($('#luUrl')) $('#luUrl').onclick = async () => { st.set('updUrl', $('#updUrl').value.trim()); $('#luMsg').textContent = 'Lade …'; const r = await window.cloudy.updateFromUrl($('#updUrl').value); $('#luMsg').textContent = r.ok ? `Update ${r.version} installiert – Cloudy startet neu …` : r.msg; };
$('#luRun').onclick = async () => { const r = await window.cloudy.localUpdateRun(); $('#luMsg').textContent = r.ok ? `Update ${r.version} installiert – Cloudy startet neu …` : r.msg; };

// ---------- Cloudy-Konto: Anmelden / Registrieren / Admin (lokal) ----------
let lgMode = 'in';
const L = s => (window.t ? window.t(s) : s);
function lgSet(m, hint) {
  lgMode = m; const chg = m === 'chg';
  $$('[data-lt]').forEach(b => { b.classList.toggle('on', b.dataset.lt === m); b.parentElement.style.display = chg ? 'none' : ''; });
  $('#lgUserRow').style.display = chg ? 'none' : ''; $('#lgRemRow').style.display = chg ? 'none' : '';
  $('#lgPass2Row').style.display = m === 'in' ? 'none' : 'grid';
  $('#lgGo').textContent = m === 'up' ? 'Konto erstellen' : chg ? 'Passwort speichern' : 'Anmelden';
  $('#lgPass').autocomplete = m === 'in' ? 'current-password' : 'new-password'; $('#lgMsg').textContent = '';
  const h = $('#lgHint'); h.style.display = hint ? '' : 'none'; h.textContent = hint || '';
  if (window.setLang) window.setLang(document.documentElement.lang || 'de');
}
$$('[data-lt]').forEach(b => b.onclick = () => lgSet(b.dataset.lt, lgFresh && b.dataset.lt === 'in' ? FRESH_HINT : ''));
const FRESH_HINT = 'Tester-Konto: Melde dich mit Tester / 12345 an. Du musst das Passwort danach sofort ändern.';
let lgFresh = false;
function askText(q) { // prompt() gibt es in Electron nicht – kleines eigenes Eingabefeld
  return new Promise(res => { const d = document.createElement('div'); d.style.cssText = 'position:fixed;inset:0;z-index:99999;display:grid;place-items:center;background:rgba(0,0,0,.35)';
    d.innerHTML = `<div class="glass set" style="padding:18px;min-width:300px"><b>${esc(q)}</b><input class="field" style="margin:10px 0;width:100%" autocomplete="off"><div class="tools" style="margin:0"><button class="btn" data-o>OK</button><button class="btn ghost" data-c>Abbrechen</button></div></div>`;
    document.body.appendChild(d); const i = d.querySelector('input'); i.focus(); const done = v => { d.remove(); res(v); };
    d.querySelector('[data-o]').onclick = () => done(i.value); d.querySelector('[data-c]').onclick = () => done(null); i.onkeydown = e => { if (e.key === 'Enter') done(i.value); if (e.key === 'Escape') done(null); }; });
}

// ---------- Item-Auswahl mit 3D-Vorschau (Admin: Items vergeben/entfernen, Codes) ----------
async function shopCat() { if (!window.shopCatalog) { try { const n = await window.cloudy.shopState(); if (n) window.shopCatalog = n.catalog; } catch {} } return window.shopCatalog || []; }
async function pickItems(title, ids, opts) { // opts: { multi, allLabel } -> Promise<null | string[] | '__all'>
  opts = opts || {}; const cat = await shopCat(), list = ids.map(id => cat.find(c => c.id === id) || { id, name: id });
  return new Promise(res => {
    const d = document.createElement('div'); d.style.cssText = 'position:fixed;inset:0;z-index:10001;display:grid;place-items:center;background:var(--overlay,rgba(10,25,50,.35));backdrop-filter:blur(8px)'; const sel = new Set();
    d.innerHTML = `<div class="glass set" style="padding:18px;width:min(720px,94vw);max-height:84vh;display:flex;flex-direction:column;gap:10px"><b>${esc(L(title))}</b>
      <div class="row" style="overflow:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px;padding:2px">${list.length ? list.map(i => `<button type="button" class="glass shi" data-pk="${esc(i.id)}" style="padding:8px 8px 12px;gap:6px"><div class="i3h" data-pv="${esc(i.id)}" style="height:118px;overflow:hidden"></div><b style="margin-top:4px">${esc(i.name)}</b></button>`).join('') : `<p class="muted">${esc(L('Keine Items vorhanden.'))}</p>`}</div>
      <div class="tools" style="margin:0">${opts.multi ? `<button class="btn" data-ok>${esc(L('Fertig'))}</button>` : ''}${opts.allLabel ? `<button class="btn ghost" data-all>${esc(L(opts.allLabel))}</button>` : ''}<button class="btn ghost" data-c>${esc(L('Abbrechen'))}</button></div></div>`;
    document.body.appendChild(d); const done = v => { d.remove(); res(v); };
    d.querySelectorAll('[data-pv]').forEach(h => { try { if (window.cloudyItem3d) h.appendChild(window.cloudyItem3d(h.dataset.pv)); } catch {} });
    d.querySelectorAll('[data-pk]').forEach(b => b.onclick = () => { if (!opts.multi) return done([b.dataset.pk]); b.classList.toggle('sel'); if (sel.has(b.dataset.pk)) sel.delete(b.dataset.pk); else sel.add(b.dataset.pk); });
    const ok = d.querySelector('[data-ok]'); if (ok) ok.onclick = () => done([...sel]); const al = d.querySelector('[data-all]'); if (al) al.onclick = () => done('__all');
    d.querySelector('[data-c]').onclick = () => done(null); d.onclick = e => { if (e.target === d) done(null); };
    if (window.setLang) window.setLang(document.documentElement.lang || 'de');
  });
}
const BAN_OPTS = [['1 Stunde', 3600e3], ['1 Tag', 864e5], ['7 Tage', 6048e5], ['30 Tage', 2592e6], ['Dauerhaft', 0]];
let admTabOn = false;
function setSetTab(t) { const pg = $('#p-settings'); if (!pg) return; if (t === 'adm' && !admTabOn) t = 'gen'; pg.dataset.tab = t; $$('#setTabs [data-st]').forEach(b => b.classList.toggle('on', b.dataset.st === t)); }
$$('#setTabs [data-st]').forEach(b => b.onclick = () => setSetTab(b.dataset.st));
setSetTab('gen');
function askChoice(q, opts) {
  return new Promise(res => { const d = document.createElement('div'); d.style.cssText = 'position:fixed;inset:0;z-index:10001;display:grid;place-items:center;background:var(--overlay,rgba(10,25,50,.35));backdrop-filter:blur(8px)';
    d.innerHTML = `<div class="glass set" style="padding:18px;min-width:300px;max-width:92vw"><b>${esc(L(q))}</b><div class="tools" style="margin:12px 0 0">${opts.map((o, i) => `<button class="btn ghost" data-k="${i}">${esc(L(o[0]))}</button>`).join('')}<button class="btn" data-c>${esc(L('Abbrechen'))}</button></div></div>`;
    document.body.appendChild(d); const done = v => { d.remove(); res(v); };
    d.querySelectorAll('[data-k]').forEach(b => b.onclick = () => done(opts[+b.dataset.k][1])); d.querySelector('[data-c]').onclick = () => done(null); });
}
const fmtLeft = ms => { const m = Math.ceil(ms / 60000); return m >= 1440 ? Math.ceil(m / 1440) + ' d' : m >= 60 ? Math.ceil(m / 60) + ' h' : m + ' min'; };
async function paintAdmin(on) {
  admTabOn = !!on; { const t = $('#admTab'); if (t) t.style.display = on ? '' : 'none'; } if (!on) setSetTab('gen');
  { const sc = $('#srvCard'); if (sc) sc.style.display = on ? '' : 'none'; } if (!on) return;
  const box = $('#admList'); box.textContent = L('Lade …');
  const us = await window.cloudy.authListFull().catch(() => []);
  const catName = id => { try { const c = (window.shopCatalog || []).find(x => x.id === id); return c ? c.name : id; } catch { return id; } };
  box.innerHTML = us.length ? us.map(u => {
    const left = u.banned && u.until ? u.until - Date.now() : 0, n = esc(u.name);
    const tag = u.paused ? ` · <b>PAUSIERT</b>` : u.banned ? ` · <b>${u.until ? 'GESPERRT' : 'PERMANENT GESPERRT'}</b>${u.until ? ' (' + fmtLeft(left) + ')' : ''}${u.reason ? ': ' + esc(u.reason) : ''}` : '';
    return `<div class="arow" style="${u.banned || u.paused ? 'opacity:.8' : ''}"><b>${n} <small class="muted">${u.coins} CC · ${u.owned} Items${tag}</small></b>
      <button class="btn ghost" data-ab="${n}" data-bn="${u.banned ? 0 : 1}">${u.banned ? L('Entsperren') : L('Sperren …')}</button>
      <button class="btn ghost" data-ap="${n}" data-pv="${u.paused ? 0 : 1}">${u.paused ? L('Aktivieren') : L('Pausieren')}</button>
      <button class="btn ghost" data-aa="${n}">${L('Item hinzufügen …')}</button><button class="btn ghost" data-ai="${n}" ${u.owned ? '' : 'disabled'}>${L('Items entfernen …')}</button>
      <button class="btn ghost" data-an="${n}" data-on="${u.inf ? 0 : 1}">${u.inf ? L('∞ CC: an') : L('∞ CC: aus')}</button><button class="btn ghost" data-ac="${n}">${L('CC setzen')}</button><button class="btn ghost" data-ag="${n}">+500 CC</button><button class="btn ghost" data-ar="${n}">${L('Passwort → 12345')}</button><button class="btn ghost" data-ad="${n}">${L('Konto löschen')}</button>${[['owner', 'Owner'], ['tester', 'Tester'], ['plus', 'Cloudy+'], ['mod', 'Moderator']].map(([k, l]) => `<button class="btn ghost ${(u.tags || []).includes(k) ? 'tagon' : ''}" data-tg="${n}|${k}|${(u.tags || []).includes(k) ? 0 : 1}" title="Tag ${l} ${(u.tags || []).includes(k) ? 'entfernen' : 'vergeben'}">${(u.tags || []).includes(k) ? '✓ ' : ''}${l}</button>`).join('')}${u.gate ? `<button class="btn ghost" data-ax="${n}" title="${esc(u.gate)}">${L('Zugangscode entziehen')}</button>` : ''}</div>`;
  }).join('') : L('Keine weiteren Konten.');
  const A = window.cloudy, rp = () => paintAdmin(true), admNote = t => { const e = $('#admStat'); if (e) { e.textContent = L(t); clearTimeout(admNote.t); admNote.t = setTimeout(() => { e.textContent = ''; }, 6000); } };
  $$('#admList [data-ab]').forEach(b => b.onclick = async () => {
    const ban = b.dataset.bn === '1'; let reason = '', until = 0;
    if (ban) { const d = await askChoice('Wie lange sperren?', BAN_OPTS); if (d === null) return; until = d ? Date.now() + d : 0; reason = (await askText(L('Grund für die Sperre (optional)'))) || ''; }
    await A.authAdminBan({ name: b.dataset.ab, banned: ban, reason, until }); rp(); });
  $$('#admList [data-tg]').forEach(b => b.onclick = async () => { const [name, tag, on] = b.dataset.tg.split('|'); const ok = await A.admTag({ name, tag, on: on === '1' }); admNote(ok ? 'Tag gespeichert.' : 'Tag konnte nicht gespeichert werden (nur mit Konto-Server).'); rp(); });
  $$('#admList [data-ap]').forEach(b => b.onclick = async () => { await A.authAdminPause({ name: b.dataset.ap, paused: b.dataset.pv === '1' }); rp(); });
  $$('#admList [data-ai]').forEach(b => b.onclick = async () => {
    const row = us.find(x => x.name === b.dataset.ai), items = (row && row.items) || [];
    const o = await pickItems('Welches Item entfernen?', items, { allLabel: 'Alle Items' }); if (o === null) return;
    const ok = await A.authAdminRemoveItem(o === '__all' ? { name: b.dataset.ai, all: true } : { name: b.dataset.ai, id: o[0] }); admNote(ok ? (o === '__all' ? 'Alle Items entfernt.' : 'Item entfernt.') : 'Entfernen hat nicht geklappt – läuft auf dem Server die neueste app.js?'); rp(); });
  $$('#admList [data-aa]').forEach(b => b.onclick = async () => {
    const row = us.find(x => x.name === b.dataset.aa), have = (row && row.items) || [], all = (await shopCat()).map(c => c.id).filter(id => !have.includes(id));
    const o = await pickItems('Welches Item hinzufügen?', all, {}); if (o === null || !o[0]) return;
    const ok = await A.authAdminAddItem({ name: b.dataset.aa, id: o[0] }); admNote(ok ? 'Item hinzugefügt.' : 'Hinzufügen hat nicht geklappt.'); rp(); });
  $$('#admList [data-ax]').forEach(b => b.onclick = async () => { if (!confirm(b.dataset.ax + ' – ' + L('Zugangscode entziehen? Der Launcher fragt dann wieder nach einem gültigen Code.'))) return; const n = await A.gateRevokeUser(b.dataset.ax); admNote(n > 0 ? 'Zugang entzogen.' : n === 0 ? 'Kein Zugang gefunden.' : 'Geht nur mit Konto-Server.'); rp(); });
  $$('#admList [data-an]').forEach(b => b.onclick = async () => { await A.authAdminInf({ name: b.dataset.an, on: b.dataset.on === '1' }); rp(); });
  $$('#admList [data-ac]').forEach(b => b.onclick = async () => { const v = await askText(L('Neuer CC-Stand für ') + b.dataset.ac); if (v == null || v === '') return; await A.authAdminCoins({ name: b.dataset.ac, amount: v }); rp(); });
  $$('#admList [data-ar]').forEach(b => b.onclick = async () => { await A.authAdminReset(b.dataset.ar); rp(); });
  $$('#admList [data-ag]').forEach(b => b.onclick = async () => { await A.authAdminGrant({ name: b.dataset.ag, amount: 500 }); b.textContent = '✓ +500 CC'; });
  $$('#admList [data-ad]').forEach(b => b.onclick = async () => { if (confirm(b.dataset.ad + ' – ' + L('Löschen') + '?')) { await A.authAdminDelete(b.dataset.ad); rp(); } });
  if (window.paintCodes) window.paintCodes();
  if (window.setLang) window.setLang(document.documentElement.lang || 'de');
}
{ const r = $('#admRef'); if (r) r.onclick = () => { paintAdmin(true); if (window.paintCodes) window.paintCodes(); if (window.paintGate) window.paintGate(); }; }
setInterval(() => { try { if (admTabOn && !document.hidden && $('#p-settings').classList.contains('on') && $('#p-settings').dataset.tab === 'adm' && !document.querySelector('.news-ov,[style*="z-index:10001"]')) paintAdmin(true); } catch {} }, 20000); // Admin-Liste hält sich selbst aktuell
window.cloudy.on('acctLocked', async msg => { try { await window.cloudy.authLogout(); } catch {} $('#login').classList.remove('off'); lgSet('in', ''); paintAdmin(false); $('#lgMsg').textContent = L(msg || 'Konto gesperrt.'); });

// ---------- Codes: einlösen (alle) und erstellen (Admin) ----------
(function () {
  const go = $('#rdGo'); if (!go) return; let picked = [];
  const msg = (el, t, ok) => { el.textContent = t; el.style.color = ok ? 'var(--accent)' : ''; };
  const redeem = async () => {
    const m = $('#rdMsg'), code = $('#rdCode').value.trim(); if (!code) { msg(m, L('Bitte einen Code eingeben.')); return; }
    go.disabled = true; msg(m, L('Prüfe …')); const r = await window.cloudy.codeRedeem(code).catch(() => ({ ok: false, error: 'Der Konto-Server ist nicht erreichbar.' })); go.disabled = false;
    if (!r.ok) { msg(m, L(r.error)); return; }
    const cat = await shopCat(), names = (r.items || []).map(id => (cat.find(c => c.id === id) || {}).name || id), bits = [];
    if (r.coins) bits.push('+' + r.coins + ' CC'); if (names.length) bits.push(names.join(', '));
    msg(m, '🎉 ' + L('Eingelöst:') + ' ' + (bits.join(' · ') || L('nichts Neues (du besitzt alles schon)')) + (r.skipped ? ' · ' + r.skipped + ' ' + L('schon vorhanden') : ''), true); $('#rdCode').value = '';
    if (r.state) window.shopCatalog = r.state.catalog;
    try { window.rewardAnim({ coins: r.coins || 0, items: (r.items || []).map(id => ({ id, name: (cat.find(c => c.id === id) || {}).name || id })) }); } catch {}
  };
  go.onclick = redeem; $('#rdCode').onkeydown = e => { if (e.key === 'Enter') redeem(); };
  async function paintCodes() {
    const box = $('#cdList'); if (!box) return; const cs = await window.cloudy.codeList().catch(() => []), cat = await shopCat();
    box.innerHTML = cs.length ? cs.map(c => `<div class="arow"><b><code>${esc(c.code)}</code> <small class="muted">${c.coins ? c.coins + ' CC' : ''}${c.coins && c.items.length ? ' + ' : ''}${c.items.map(id => esc((cat.find(x => x.id === id) || {}).name || id)).join(', ')} · ${c.used}/${c.uses || '∞'} ${L('eingelöst')}${c.exp ? ' · ' + (c.exp > Date.now() ? L('gültig bis') + ' ' + new Date(c.exp).toLocaleDateString(document.documentElement.lang === 'de' ? 'de-DE' : 'en-GB') : L('abgelaufen')) : ''}</small></b><button class="btn ghost" data-cc="${esc(c.code)}">${L('Kopieren')}</button><button class="btn ghost" data-cd="${esc(c.code)}">${L('Löschen')}</button></div>`).join('') : `<p class="muted">${L('Noch keine Codes.')}</p>`;
    $$('#cdList [data-cc]').forEach(b => b.onclick = () => { try { navigator.clipboard.writeText(b.dataset.cc); b.textContent = L('Kopiert ✓'); } catch {} });
    $$('#cdList [data-cd]').forEach(b => b.onclick = async () => { if (confirm(b.dataset.cd + ' – ' + L('Löschen') + '?')) { await window.cloudy.codeDelete(b.dataset.cd); paintCodes(); } });
    if (window.setLang) window.setLang(document.documentElement.lang || 'de');
  }
  window.paintCodes = paintCodes;
  const sel = () => { $('#cdSel').textContent = picked.length ? L('Items:') + ' ' + picked.map(id => ((window.shopCatalog || []).find(c => c.id === id) || {}).name || id).join(', ') : ''; };
  $('#cdItems').onclick = async () => { const o = await pickItems('Items für den Code wählen', (await shopCat()).map(c => c.id), { multi: true }); if (o) { picked = o; sel(); } };
  $('#cdMake').onclick = async () => {
    const m = $('#cdMsg'); msg(m, '');
    const r = await window.cloudy.codeCreate({ code: $('#cdName').value, coins: $('#cdCoins').value, uses: $('#cdUses').value, exp: $('#cdExp').value ? new Date($('#cdExp').value + 'T23:59:59').getTime() : 0, items: picked }).catch(() => ({ ok: false, error: 'Der Konto-Server ist nicht erreichbar.' }));
    if (!r.ok) { msg(m, L(r.error)); return; }
    msg(m, L('Code erstellt:') + ' ' + r.code, true); $('#cdName').value = $('#cdCoins').value = $('#cdUses').value = $('#cdExp').value = ''; picked = []; sel(); paintCodes();
  };
  const t = document.getElementById('admTab'); if (t) t.addEventListener('click', paintCodes);
  setTimeout(() => { try { if (admTabOn) paintCodes(); } catch {} }, 1500);
})();
// ---------- Zugangscodes für den Launcher (Admin) ----------
(function () {
  const go = $('#gcMake'); if (!go) return; const msg = (t, ok) => { const m = $('#gcMsg'); m.textContent = t; m.style.color = ok ? 'var(--accent)' : ''; };
  async function paintGate() {
    const box = $('#gcList'); if (!box) return; const cs = await window.cloudy.gateList().catch(() => []), now = Date.now();
    box.innerHTML = cs.length ? cs.map(c => `<div class="arow"><b><code>${esc(c.code)}</code> <small class="muted">${c.used}/${c.uses || '∞'} ${L('Einlösungen')}${c.active ? ' · ' + c.active + ' ' + L('Zugänge aktiv') : ''}${c.exp ? ' · ' + (c.exp > now ? L('gültig bis') + ' ' + new Date(c.exp).toLocaleDateString(document.documentElement.lang === 'de' ? 'de-DE' : 'en-GB') : L('abgelaufen')) : ''}</small></b><button class="btn ghost" data-gcc="${esc(c.code)}">${L('Kopieren')}</button><button class="btn ghost" data-gcd="${esc(c.code)}">${L('Löschen')}</button>${c.active ? `<button class="btn ghost" data-gcr="${esc(c.code)}">${L('Zugang entziehen')}</button>` : ''}</div>`).join('') : `<p class="muted">${L('Noch keine Zugangscodes – der alte feste Code gilt noch.')}</p>`;
    $$('#gcList [data-gcc]').forEach(b => b.onclick = () => { try { navigator.clipboard.writeText(b.dataset.gcc); b.textContent = L('Kopiert ✓'); } catch {} });
    $$('#gcList [data-gcd]').forEach(b => b.onclick = async () => { if (confirm(b.dataset.gcd + ' – ' + L('Löschen') + '?')) { await window.cloudy.gateDelete(b.dataset.gcd); paintGate(); } });
    $$('#gcList [data-gcr]').forEach(b => b.onclick = async () => { if (confirm(b.dataset.gcr + ' – ' + L('Code löschen und allen den Zugang entziehen, die ihn benutzt haben?'))) { await window.cloudy.gateDelete(b.dataset.gcr, true); paintGate(); } });
    if (window.setLang) window.setLang(document.documentElement.lang || 'de');
  }
  window.paintGate = paintGate;
  go.onclick = async () => {
    msg(''); const r = await window.cloudy.gateCreate({ code: $('#gcName').value, uses: $('#gcUses').value, days: $('#gcDays').value }).catch(() => ({ ok: false, error: 'Der Konto-Server ist nicht erreichbar.' }));
    if (!r.ok) { msg(L(r.error || 'Fehlgeschlagen.')); return; }
    msg(L('Zugangscode erstellt:') + ' ' + r.code, true); $('#gcName').value = $('#gcUses').value = $('#gcDays').value = ''; paintGate();
  };
  const t = document.getElementById('admTab'); if (t) t.addEventListener('click', paintGate);
  setTimeout(() => { try { if (admTabOn) paintGate(); } catch {} }, 1600);
})();
function lgDone(name, first, admin) {
  $('#login').classList.add('off'); $('#lgPass').value = $('#lgPass2').value = '';
  if (first) { st.set('name', name); $('#name').value = name; paintUser(); }
  $('#delBtn').style.display = admin ? 'none' : ''; $('#delRow').style.display = 'none';
  paintAdmin(!!admin); if (window.onLoggedIn) window.onLoggedIn();
  if (!st.get('onboarded', false)) showOnb();
}
$('#lgForm').onsubmit = async e => {
  e.preventDefault();
  const user = $('#lgUser').value.trim(), pass = $('#lgPass').value, msg = $('#lgMsg');
  if (lgMode !== 'chg' && (!user || !pass)) { msg.textContent = L('Bitte Benutzername und Passwort eingeben.'); return; }
  if (lgMode !== 'in' && pass !== $('#lgPass2').value) { msg.textContent = L('Die Passwörter sind nicht gleich.'); return; }
  $('#lgGo').disabled = true; msg.textContent = '';
  const c = window.cloudy, r = lgMode === 'chg' ? await c.authChangePass({ pass }) : await c[lgMode === 'up' ? 'authRegister' : 'authLogin']({ user, pass, remember: $('#lgRem').checked });
  $('#lgGo').disabled = false;
  if (!r.ok) { msg.textContent = L(r.error); return; }
  if (r.mustChange) { $('#lgPass').value = ''; lgSet('chg', 'Du nutzt ein vorläufiges Passwort. Lege jetzt ein neues fest.'); return; }
  lgFresh = false; lgDone(r.user, !!r.first, r.admin);
};
$('#lgForgot').onclick = async e => {
  e.preventDefault();
  if (confirm(L('Das Tester-Konto auf Tester / 12345 zurücksetzen? Andere Konten (auch Admin) bleiben erhalten. Das Passwort muss danach sofort neu gesetzt werden.'))) { await window.cloudy.authReset(); lgFresh = true; lgSet('in', FRESH_HINT); }
};
$('#authOut').onclick = async () => { await window.cloudy.authLogout(); const s = await window.cloudy.authState(); lgFresh = s.fresh; $('#login').classList.remove('off'); lgSet('in', s.fresh ? FRESH_HINT : ''); $('#lgPass').value = ''; paintAdmin(false); };
window.cloudy.authState().then(s => { lgFresh = s.fresh; if (s.user) lgDone(s.user, false, s.admin); else lgSet('in', s.fresh ? FRESH_HINT : ''); });

// ---------- Notfall: Neu laden / Update erzwingen (auch per F5 bzw. Strg+Umschalt+U) ----------
$('#reloadBtn').onclick = () => window.cloudy.appReload();
$('#forceUpd').onclick = async () => { const r = await window.cloudy.forceUpdate(); $('#luMsg').textContent = r && r.ok ? `Update ${r.version} installiert – Cloudy startet neu …` : (window.t ? window.t((r && r.msg) || 'Kein Update im Update-Ordner gefunden.') : ((r && r.msg) || '')); };

// ---------- Reiter: Versionen | Bibliothek, Mods | Ressourcen, Einstellungen | Screenshots ----------
(function () {
  const G = [[['versions', 'Versionen'], ['lib', 'Bibliothek']], [['mods', 'Mods'], ['packs', 'Ressourcen']], [['settings', 'Einstellungen'], ['shots', 'Screenshots']]];
  G.forEach(g => g.forEach(([id]) => {
    const pg = $('#p-' + id); if (!pg) return;
    const bar = document.createElement('div'); bar.className = 'tools subtabs';
    bar.innerHTML = g.map(([k, n]) => `<button class="chip" data-sg="${k}">${n}</button>`).join('');
    pg.insertBefore(bar, pg.firstChild);
    bar.querySelectorAll('[data-sg]').forEach(b => b.onclick = () => go(b.dataset.sg));
  }));
  window.paintSub = p => $$('.subtabs [data-sg]').forEach(b => b.classList.toggle('on', b.dataset.sg === p));
  window.paintSub($('.page.on') ? $('.page.on').id.slice(2) : 'home');
})();

// ---------- Konto löschen ----------
$('#delBtn').onclick = () => { const r = $('#delRow'); r.style.display = r.style.display === 'none' ? 'flex' : 'none'; $('#delMsg').textContent = ''; $('#delPass').value = ''; };
$('#delGo').onclick = async () => {
  if (!confirm(L('Willst du dein Konto wirklich endgültig löschen? Coins und Items gehen verloren.'))) return;
  const r = await window.cloudy.authDelete({ pass: $('#delPass').value });
  if (!r.ok) { $('#delMsg').textContent = window.t ? window.t(r.error) : r.error; return; }
  $('#delRow').style.display = 'none'; $('#authOut').onclick();
};
window.showOnb = showOnb;

// ---------- Konto-Server (Einstellungen) ----------
(function () {
  const inp = document.getElementById('srvUrl'), btn = document.getElementById('srvSave'), msg = document.getElementById('srvMsg'); if (!inp || !btn || !window.cloudy.srvGet) return;
  window.cloudy.srvGet().then(u => { inp.value = u || ''; msg.textContent = u ? 'Verbunden mit diesem Server.' : 'Kein Server: Konten nur auf diesem PC.'; }).catch(() => {});
  btn.onclick = async () => {
    btn.disabled = true; msg.textContent = 'Prüfe …'; const r = await window.cloudy.srvSet(inp.value); btn.disabled = false;
    if (!r.ok) { msg.textContent = r.error; return; }
    msg.textContent = r.off ? 'Server entfernt. Bitte neu anmelden …' : 'Server gespeichert. Bitte neu anmelden …';
    setTimeout(() => location.reload(), 900);
  };
})();

// ---------- Knopfform (Theme-Standard / rund / eckig) ----------
(function () {
  const sel = document.getElementById('shape'), OK = ['auto', 'round', 'square'];
  const apply = v => { if (v === 'auto') delete document.documentElement.dataset.shape; else document.documentElement.dataset.shape = v; };
  let v = 'auto'; try { v = localStorage.getItem('cloudy.shape2') || 'auto'; } catch {}
  if (!OK.includes(v)) v = 'auto';
  apply(v); if (sel) { sel.value = v; sel.onchange = () => { apply(sel.value); try { localStorage.setItem('cloudy.shape2', sel.value); } catch {} }; }
})();

// ---------- Layout (Cloudy / Lunar / Kompakt / Oben) ----------
(function () {
  const sel = document.getElementById('layout'), OK = ['cloudy', 'lunar', 'compact', 'top'];
  const apply = v => { document.documentElement.dataset.layout = OK.includes(v) ? v : 'cloudy'; };
  let v = 'cloudy'; try { v = localStorage.getItem('cloudy.layout') || 'cloudy'; } catch {}
  apply(v); if (sel) { sel.value = OK.includes(v) ? v : 'cloudy'; sel.onchange = () => { apply(sel.value); try { localStorage.setItem('cloudy.layout', sel.value); } catch {} }; }
  document.querySelectorAll('.nav[data-p]').forEach(n => { if (!n.title) n.title = n.textContent.trim(); });
})();


// ---------- Wolke / Logo anklicken = alles neu laden (Konto, Shop, Admin, Anzeige) ----------
(function () {
  const b = document.querySelector('.brand'); if (!b) return; b.title = 'Refresh'; let busy = false;
  b.addEventListener('click', async () => {
    if (busy) return; busy = true; b.classList.add('spinning');
    try { await window.cloudy.accRefresh(); } catch {}
    try { if (window.refreshAccount) await window.refreshAccount(); } catch {}
    try { if (window.pollShop) await window.pollShop(); } catch {}
    try { const a = document.getElementById('admRef'); if (a && a.offsetParent) a.click(); } catch {}
    try { if (window.refreshAcc) window.refreshAcc(); } catch {}
    setTimeout(() => { b.classList.remove('spinning'); busy = false; }, 700);
  });
})();


// ---------- Zufallscodes: 12 Zeichen ----------
window.randCode = () => { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', b = crypto.getRandomValues(new Uint8Array(12)); return [...b].map(x => A[x % A.length]).join('').replace(/(.{4})(?=.)/g, '$1-'); };
[['#cdRnd', '#cdName'], ['#gcRnd', '#gcName']].forEach(([b, f]) => { const bt = document.querySelector(b), fi = document.querySelector(f); if (bt && fi) bt.onclick = () => { fi.value = window.randCode(); fi.focus(); }; });


// ---------- Belohnungs-Animation beim Code einlösen (Lichtstrahlen, Karte dreht sich auf, Coins zählen hoch) ----------
window.rewardAnim = function (o) {
  const steps = []; if (o.coins) steps.push({ coins: o.coins }); (o.items || []).forEach(i => steps.push({ item: i })); if (!steps.length || document.getElementById('cdReward')) return;
  const d = document.createElement('div'); d.id = 'cdReward'; let i = -1, timer = 0, closed = false;
  d.innerHTML = '<div class="rw-rays"></div><div class="rw-glow"></div><div class="rw-stage"></div><div class="rw-title"></div><div class="rw-hint"></div>';
  document.body.appendChild(d); const st = d.querySelector('.rw-stage'), ti = d.querySelector('.rw-title'), hi = d.querySelector('.rw-hint');
  const close = () => { if (closed) return; closed = true; clearTimeout(timer); d.classList.add('out'); setTimeout(() => d.remove(), 450); document.removeEventListener('keydown', key); };
  const key = e => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') next(); };
  function next() {
    clearTimeout(timer); i++; if (i >= steps.length) return close(); const s = steps[i];
    st.innerHTML = ''; st.classList.remove('in'); void st.offsetWidth;
    if (s.coins) {
      st.innerHTML = '<div class="rw-coin"><i></i><b>0</b><small>CC</small></div>'; ti.textContent = L('Cloudy Coins'); const b = st.querySelector('b'), t0 = performance.now(), dur = 1100;
      const tick = t => { const k = Math.min(1, (t - t0) / dur); b.textContent = '+' + Math.round(s.coins * (1 - Math.pow(1 - k, 3))); if (k < 1 && !closed) requestAnimationFrame(tick); }; requestAnimationFrame(tick);
    } else {
      const card = document.createElement('div'); card.className = 'rw-card'; const v = document.createElement('div'); v.className = 'i3h rw-i3'; card.appendChild(v);
      const nm = document.createElement('b'); nm.textContent = s.item.name; card.appendChild(nm); st.appendChild(card);
      try { if (window.cloudyItem3d) v.appendChild(window.cloudyItem3d(s.item.id)); } catch {}
      ti.textContent = L('Neues Item!');
    }
    st.classList.add('in'); hi.textContent = (i + 1 < steps.length ? L('Klicken für weiter') : L('Klicken zum Schließen')) + (steps.length > 1 ? '  ·  ' + (i + 1) + '/' + steps.length : '');
    timer = setTimeout(next, s.coins ? 2600 : 3600);
  }
  d.onclick = next; document.addEventListener('keydown', key); if (window.setLang) window.setLang(document.documentElement.lang || 'de'); next();
};

// Schimpfwoerter zensieren: Schalter in den Einstellungen (Standard: an), gilt fuer Chat und Lyrics im Spiel
(function () { const cb = document.getElementById('censorOn'); if (!cb) return; window.cloudy.censorGet().then(v => { cb.checked = v !== false; }).catch(() => { cb.checked = true; }); cb.onchange = () => { window.cloudy.censorSet(cb.checked).catch(() => {}); try { if (window.frRepaint) window.frRepaint(); } catch {} }; })();

// Admin: Server-Statistik und Ankündigung an alle; Spieler sehen die Ankündigung einmal als Leiste oben
(function () {
  const $ = s => document.querySelector(s), esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  async function stats() { const el = $('#admStats'); if (!el) return; let r = null; try { r = await window.cloudy.admStats(); } catch {} if (!r) { el.textContent = ''; return; } el.innerHTML = `<b>${r.users}</b> Konten · <b>${r.online}</b> online · <b>${r.new7}</b> neu (7 Tage) · <b>${r.banned}</b> gesperrt · <b>${r.paused}</b> pausiert · <b>${r.coins}</b> Coins im Umlauf · <b>${r.codes}</b> Codes · <b>${r.gate}</b> Zugangscodes` + (r.announce && r.announce.text ? `<br>Aktive Ankündigung: „${esc(r.announce.text)}“` : ''); }
  const rf = $('#admRef'); if (rf) rf.addEventListener('click', stats); setInterval(() => { try { if (!document.hidden && $('#p-settings').classList.contains('on') && $('#p-settings').dataset.tab === 'adm') stats(); } catch {} }, 20000);
  const tab = $('#admTab'); if (tab) tab.addEventListener('click', () => setTimeout(stats, 200));
  const sendA = async clear => { const t = clear ? '' : ($('#annText').value || '').trim(); if (!clear && !t) return; const ok = await window.cloudy.admAnnounce(t).catch(() => false); const n = $('#admStat'); if (n) n.textContent = ok ? (clear ? 'Ankündigung zurückgenommen.' : 'Ankündigung gesendet – Spieler sehen sie beim nächsten Abruf (bis 5 Min).') : 'Senden fehlgeschlagen (Server erreichbar?).'; if (ok && !clear) $('#annText').value = ''; stats(); };
  if ($('#annSend')) { $('#annSend').onclick = () => sendA(false); $('#annClear').onclick = () => sendA(true); }
  async function poll() {
    try {
      const a = await window.cloudy.announceGet(); if (!a || !a.text) return;
      let seen = 0; try { seen = +localStorage.getItem('cloudy.annSeen') || 0; } catch {}
      if (a.t <= seen || document.getElementById('annBar')) return;
      const d = document.createElement('div'); d.id = 'annBar'; d.innerHTML = `<span>📢 ${esc(a.text)}</span><button type="button" aria-label="Schließen">✕</button>`;
      d.querySelector('button').onclick = () => { try { localStorage.setItem('cloudy.annSeen', String(a.t)); } catch {} d.remove(); }; document.body.appendChild(d);
    } catch {}
  }
  setTimeout(poll, 6000); setInterval(poll, 300000);
})();

// Tags (Tester, Cloudy+, Moderator, Admin) als kleine Abzeichen
window.cloudyTags = tags => (tags || []).map(k => { const m = /^clan:([A-Z0-9]{1,4})(?::([0-9a-f]{6}))?$/i.exec(String(k)); if (m) return [m[1], 'clan', m[2] ? '#' + m[2] : '']; const t = ({ owner: ['Owner', 'owner'], admin: ['Admin', 'admin'], manager: ['Manager', 'manager'], mod: ['Moderator', 'mod'], plus: ['Cloudy+', 'plus'], tester: ['Tester', 'tester'] })[k]; return t ? [t[0], t[1], ''] : null; }).filter(Boolean).map(([l, c, col]) => `<span class="ctag ${c}"${col ? ` style="background:${col}40;border-color:${col};color:#fff"` : ''}>${l}</span>`).join('');
