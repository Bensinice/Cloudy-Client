// Modpacks: eigener Mini-Tab in "Mods" – Modrinth-Modpacks suchen, installieren und .mrpack-Dateien importieren
(() => {
  const $ = s => document.querySelector(s), esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const page = $('#p-mods'); if (!page || !window.cloudy || !window.cloudy.mpSearch) return;
  const fmt = n => n >= 1e6 ? (n / 1e6).toFixed(1) + ' Mio.' : n >= 1e3 ? Math.round(n / 1e3) + ' Tsd.' : String(n || 0);
  const h2 = page.querySelector('h2'), old = [...page.children].filter(el => el !== h2 && el.tagName !== 'P' && !el.classList.contains('mpx'));
  const tabs = document.createElement('div'); tabs.className = 'tools mpx'; tabs.innerHTML = '<button class="chip on" data-mpt="mods">Mods</button><button class="chip" data-mpt="packs">Modpacks</button>';
  const box = document.createElement('div'); box.className = 'mpx'; box.style.display = 'none';
  box.innerHTML = `<p class="muted">Komplette Modpacks von Modrinth (nur Fabric). Jedes Modpack bekommt eine eigene Instanz – deine anderen Mods bleiben unberührt. Das Spiel selbst (Minecraft-Version) muss unter „Versionen“ installiert sein.</p>
    <div class="tools"><input id="mpq" class="field" style="flex:1;min-width:180px" placeholder="Modpacks suchen …" autocomplete="off"><select id="mpsort" class="field"><option value="relevance">Beste Treffer</option><option value="downloads">Meiste Downloads</option><option value="follows">Beliebteste</option><option value="newest">Neueste</option><option value="updated">Zuletzt aktualisiert</option></select><button class="btn" id="mpgo">Suchen</button><button class="btn ghost" id="mpfile">.mrpack importieren …</button></div>
    <p class="muted" id="mpmsg"></p><div id="mpres"></div>`;
  page.querySelector('p').after(tabs);
  tabs.after(box);
  let pg = 0, busy = false;
  const msg = t => { $('#mpmsg').textContent = t || ''; };
  const show = w => { tabs.querySelectorAll('[data-mpt]').forEach(b => b.classList.toggle('on', b.dataset.mpt === w)); old.forEach(el => { if (el !== tabs) el.style.display = w === 'mods' ? '' : 'none'; }); box.style.display = w === 'packs' ? '' : 'none'; if (w === 'packs' && !$('#mpres').children.length) search(0); };
  tabs.querySelectorAll('[data-mpt]').forEach(b => b.onclick = () => show(b.dataset.mpt));
  window.cloudy.onMpProgress(t => msg(t));
  function done(r, btn) {
    busy = false; if (btn) btn.disabled = false;
    if (!r || !r.ok) { msg(r && r.error ? r.error : (r ? '' : 'Das hat nicht geklappt.')); if (btn) btn.textContent = 'Installieren'; return; }
    try { const m = { ...(st.get('instNames', {}) || {}) }; m[r.key] = r.name; st.set('instNames', m); } catch {}
    msg(`✓ „${r.name}“ installiert (Minecraft ${r.mc}, ${r.files} Dateien)` + (r.failed && r.failed.length ? ` – ${r.failed.length} Datei(en) fehlgeschlagen: ${r.failed.slice(0, 3).join(', ')}` : '') + (r.needMc ? `. Installiere noch Minecraft ${r.mc} unter „Versionen“, dann erscheint das Modpack in der Bibliothek.` : '. Du findest es in der Bibliothek.'));
    if (btn) btn.textContent = 'Installiert ✓';
    try { if (typeof loadLib === 'function') loadLib(); } catch {}
  }
  async function search(p) {
    pg = typeof p === 'number' ? p : 0; $('#mpres').innerHTML = '<p class="muted">Suche …</p>';
    try {
      const r = await window.cloudy.mpSearch({ q: $('#mpq').value.trim(), offset: pg * 20, index: $('#mpsort').value });
      $('#mpres').innerHTML = r.map(m => `<div class="glass srv">${m.icon ? `<img class="mi" src="${esc(m.icon)}" alt="">` : `<span class="ph">${esc((m.title[0] || '?').toUpperCase())}</span>`}<div class="tx"><b>${esc(m.title)}</b> <small>von ${esc(m.author)} · ${fmt(m.downloads)} Downloads${m.versions ? ' · bis MC ' + esc(m.versions) : ''}</small><small>${esc(m.desc)}</small></div><button class="btn" data-mpi="${esc(m.id)}">Installieren</button></div>`).join('') || '<p class="muted">Keine Modpacks gefunden.</p>';
      $('#mpres').querySelectorAll('[data-mpi]').forEach(b => b.onclick = async () => { if (busy) return; busy = true; b.disabled = true; b.textContent = 'Lädt …'; done(await window.cloudy.mpInstall({ id: b.dataset.mpi }), b); });
      if (window.pager) window.pager($('#mpres'), pg, r.length >= 20, search);
    } catch { $('#mpres').innerHTML = '<p class="muted">Modrinth ist nicht erreichbar.</p>'; }
  }
  $('#mpgo').onclick = () => search(0); $('#mpq').onkeydown = e => { if (e.key === 'Enter') search(0); }; $('#mpsort').onchange = () => search(0);
  $('#mpfile').onclick = async () => { if (busy) return; busy = true; msg('Importiere …'); done(await window.cloudy.mpImportFile()); };
})();
