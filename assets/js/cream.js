// Cloudy Creamkeys – Tastatur- und Mausklänge im Launcher (im Spiel übernimmt die Client-Mod)
(function () {
  const L = s => (window.t ? window.t(s) : s);
  let D = null; const cache = {};
  const bank = k => { // k: 'kb' | 'ms' -> {base, files, default} | null
    if (!D) return null; const id = D.settings[k]; if (!id || id === 'off') return null;
    if (id === 'custom') { const c = D.custom[k === 'kb' ? 'keyboard' : 'mouse']; return c ? { base: c.base, files: {}, default: c.default } : null; }
    return D.packs.find(p => p.id === id) || null;
  };
  function play(k, code) {
    const s = D && D.settings; if (!s || !s.enabled || !s.launcher || !(k === 'kb' ? s.kbOn : s.msOn)) return;
    const b = bank(k); if (!b) return; const f = (b.files && b.files[code]) || b.default; if (!f) return;
    const url = b.base + encodeURIComponent(f).replace(/%2F/g, '/');
    try { const a = (cache[url] = cache[url] || new Audio(url)).cloneNode(); a.volume = Math.max(0, Math.min(1, k === 'kb' ? s.kbVol : s.msVol)); a.play().catch(() => {}); } catch {}
  }
  document.addEventListener('keydown', e => { if (!e.repeat) play('kb', e.code); }, true);
  document.addEventListener('mousedown', e => play('ms', e.button === 0 ? 'MouseLeft' : e.button === 2 ? 'MouseRight' : 'MouseMiddle'), true);

  const $q = s => document.querySelector(s);
  function fill(sel, kind, cur) {
    const el = $q(sel), c = D.custom[kind];
    el.innerHTML = [`<option value="off">${L('Aus')}</option>`, ...D.packs.filter(p => p.kind === kind).map(p => `<option value="${p.id}">${p.name}</option>`), c ? `<option value="custom">${L('Eigener Sound')}: ${c.name}</option>` : ''].join('');
    el.value = [...el.options].some(o => o.value === cur) ? cur : 'off';
  }
  function paint() {
    if (!D || !D.settings) return;
    const s = D.settings;
    $q('#lgKb').checked = s.kbOn; $q('#lgMs').checked = s.msOn;
    $q('#crOn').checked = s.enabled; $q('#crGame').checked = s.ingame; $q('#crLaun').checked = s.launcher;
    fill('#crKb', 'keyboard', s.kb); fill('#crMs', 'mouse', s.ms);
    $q('#crKbV').value = Math.round(s.kbVol * 100); $q('#crMsV').value = Math.round(s.msVol * 100);
    $q('#crKbDel').style.display = D.custom.keyboard ? '' : 'none'; $q('#crMsDel').style.display = D.custom.mouse ? '' : 'none';
    const warn = [D.custom.keyboard, D.custom.mouse].some(c => c && !c.wav);
    $q('#crNote').textContent = warn ? L('Hinweis: Im Spiel werden eigene Sounds nur als WAV-Datei abgespielt. MP3/OGG funktionieren nur im Launcher.') : '';
    const pk = D.packs.find(p => p.id === s.kb); $q('#crAuthor').textContent = pk && pk.author ? L('Sound von:') + ' ' + pk.author : '';
  }
  async function load() { D = await window.cloudy.soundsGet(); paint(); if (window.setLang) window.setLang(document.documentElement.lang || 'de'); }
  const set = async p => { const s = await window.cloudy.soundsSet(p); D.settings = s; paint(); };
  $q('#crOn').onchange = e => set({ enabled: e.target.checked }); $q('#crGame').onchange = e => set({ ingame: e.target.checked }); $q('#crLaun').onchange = e => set({ launcher: e.target.checked });
  $q('#lgKb').onchange = e => set({ kbOn: e.target.checked }); $q('#lgMs').onchange = e => set({ msOn: e.target.checked });
  $q('#crKb').onchange = e => set({ kb: e.target.value }); $q('#crMs').onchange = e => set({ ms: e.target.value });
  $q('#crKbV').oninput = e => { D.settings.kbVol = e.target.value / 100; }; $q('#crKbV').onchange = e => set({ kbVol: e.target.value / 100 });
  $q('#crMsV').oninput = e => { D.settings.msVol = e.target.value / 100; }; $q('#crMsV').onchange = e => set({ msVol: e.target.value / 100 });
  $q('#crKbTest').onclick = () => { const s = D.settings, w = [s.launcher, s.kbOn, s.enabled]; s.launcher = s.kbOn = s.enabled = true; play('kb', 'KeyA'); [s.launcher, s.kbOn, s.enabled] = w; };
  $q('#crMsTest').onclick = () => { const s = D.settings, w = [s.launcher, s.msOn, s.enabled]; s.launcher = s.msOn = s.enabled = true; play('ms', 'MouseLeft'); [s.launcher, s.msOn, s.enabled] = w; };
  const pick = (kind, id) => async () => { const r = await window.cloudy.soundsCustom(kind); if (r.error) { $q('#crNote').textContent = L(r.error); return; } if (r.ok) { await load(); await set({ [id]: 'custom' }); } };
  $q('#crKbAdd').onclick = pick('keyboard', 'kb'); $q('#crMsAdd').onclick = pick('mouse', 'ms');
  const clr = (kind, id) => async () => { await window.cloudy.soundsClearCustom(kind); await load(); if (D.settings[id] === 'custom') await set({ [id]: 'off' }); };
  $q('#crKbDel').onclick = clr('keyboard', 'kb'); $q('#crMsDel').onclick = clr('mouse', 'ms');
  load();
})();
