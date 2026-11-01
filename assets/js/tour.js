// Start-Intro (ueberspringbar, abschaltbar) und interaktive Tour (erster Start, in den Einstellungen wiederholbar). Nutzt nur Theme-Variablen.
(function () {
  const get = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch { return d; } };
  const set = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  const q = s => document.querySelector(s);

  // ---------- Intro ----------
  function intro(force) {
    if (!force && !get('introOn', true)) return Promise.resolve();
    if (q('#cdIntro')) return Promise.resolve();
    return new Promise(res => {
      const el = document.createElement('div'); el.id = 'cdIntro';
      el.innerHTML = '<div class="ci-blob b1"></div><div class="ci-blob b2"></div><div class="ci-box"><svg width="84" height="84" viewBox="0 0 32 32"><path d="M9 24a6 6 0 0 1-.6-12A8 8 0 0 1 24 10a7 7 0 0 1-1 14z" fill="currentColor"/></svg><div class="ci-word">' + [...'Cloudy'].map((c, i) => '<span style="animation-delay:' + (0.55 + i * 0.07) + 's">' + c + '</span>').join('') + '</div><div class="ci-bar"><i></i></div></div><button class="ci-skip">Überspringen</button>';
      const sk = document.createElement('div'); sk.className = 'ci-skip'; sk.innerHTML = '<button type="button" data-k="1">' + (window.t ? window.t('Überspringen') : 'Überspringen') + '</button><button type="button" data-k="2">' + (window.t ? window.t('Nicht mehr zeigen') : 'Nicht mehr zeigen') + '</button>'; el.appendChild(sk);
      document.body.appendChild(el);
      let done = false;
      const end = () => { if (done) return; done = true; el.classList.add('out'); document.removeEventListener('keydown', key); setTimeout(() => { el.remove(); res(); }, 420); };
      const key = e => { if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') end(); };
      document.addEventListener('keydown', key); el.onclick = e => { const k = e.target.closest && e.target.closest('[data-k]'); if (k && k.dataset.k === '2') { set('introOn', false); const cb = q('#introOn'); if (cb) cb.checked = true; } end(); }; setTimeout(end, 2300);
    });
  }

  // ---------- Tour ----------
  const STEPS = [
    { s: '.nav[data-p="home"]', t: 'Start', d: 'Deine Startseite: schneller Zugriff auf Spielen, Neuigkeiten und deinen Skin mit Cosmetics.', p: 'home' },
    { s: '.nav[data-p="versions"]', t: 'Versionen – warum 1.21.4?', d: 'Hier wählst du, welche Minecraft-Version du spielst. Vorausgewählt ist 1.21.4, weil der Cloudy Client (Cosmetics, Anzeigen, Tags) aktuell genau dafür gebaut ist. Andere Versionen kannst du auch spielen, dann aber ohne Cosmetics. Der Client wird automatisch geladen und aktuell gehalten.', p: 'versions' },
    { s: '.nav[data-p="servers"]', t: 'Server', d: 'Speichere Server, tritt mit einem Klick bei oder starte einen eigenen Server für deine Freunde.', p: 'servers' },
    { s: '.nav[data-p="friends"]', t: 'Freunde', d: 'Füge Freunde hinzu, chatte, gründe Gruppen mit Clan-Tag und telefoniere. Ein ▶ neben dem Namen bringt dich auf den Server deines Freundes.', p: 'friends' },
    { s: '.nav[data-p="mods"]', t: 'Mods', d: 'Suche Mods auf Modrinth und installiere sie mit einem Klick, auch komplette Modpacks. Ressourcenpakete und Shader findest du unter Ressourcen.', p: 'mods' },
    { s: '.nav[data-p="shop"]', t: 'Shop & Cosmetics', d: 'Umhänge, Flügel, Hüte und Schilde siehst du in der 3D-Vorschau und im Spiel mit 1.21.4. Andere Spieler sehen Hüte, Flügel und Spezial-Umhänge nur, wenn sie auch den Cloudy Client nutzen. Schild und normale Umhänge sieht nur du. Deine Skins findest du hier unter „Skins“.', p: 'shop' },
    { s: '.nav[data-p="settings"]', t: 'Einstellungen', d: 'Themes, Arbeitsspeicher, Spotify, Discord, Sprache und mehr. Diese Tour kannst du dort jederzeit wiederholen.', p: 'settings' },
    { s: '#themeBtn', t: 'Hell / Dunkel', d: 'Wechsle schnell zwischen hellem und dunklem Modus. Weitere Themes wählst du in den Einstellungen.' },
    { s: '#play', t: 'Spielen', d: 'Mit diesem Knopf startest du Minecraft mit der gewählten Version. Tipp: Strg + Enter.' }
  ];
  let idx = 0, ov;
  function place() {
    const st = STEPS[idx], tgt = q(st.s); if (!ov) return;
    if (st.p && window.go) window.go(st.p);
    const r = tgt && tgt.getBoundingClientRect(), hole = ov.querySelector('.ct-hole'), card = ov.querySelector('.ct-card');
    if (r && r.width) { hole.style.cssText = `left:${r.left - 6}px;top:${r.top - 6}px;width:${r.width + 12}px;height:${r.height + 12}px`; hole.hidden = false; } else hole.hidden = true;
    ov.querySelector('.ct-t').textContent = st.t; ov.querySelector('.ct-d').textContent = st.d; ov.querySelector('.ct-n').textContent = (idx + 1) + ' / ' + STEPS.length;
    ov.querySelector('[data-a="prev"]').disabled = idx === 0; ov.querySelector('[data-a="next"]').textContent = idx === STEPS.length - 1 ? 'Fertig' : 'Weiter';
    const cw = card.offsetWidth || 320, ch = card.offsetHeight || 170;
    let x = r && r.width ? r.right + 18 : innerWidth / 2 - cw / 2, y = r && r.width ? r.top + r.height / 2 - ch / 2 : innerHeight / 2 - ch / 2;
    if (x + cw > innerWidth - 12) x = Math.max(12, (r ? r.left : 0) - cw - 18);
    y = Math.max(12, Math.min(innerHeight - ch - 12, y)); card.style.left = x + 'px'; card.style.top = y + 'px';
  }
  function tour() {
    if (ov) return; idx = 0;
    ov = document.createElement('div'); ov.id = 'cdTour';
    ov.innerHTML = '<div class="ct-hole"></div><div class="ct-card"><small class="ct-n"></small><h3 class="ct-t"></h3><p class="ct-d"></p><div class="ct-btns"><button class="btn ghost" data-a="skip">Überspringen</button><span style="flex:1"></span><button class="btn ghost" data-a="prev">Zurück</button><button class="btn" data-a="next">Weiter</button></div></div>';
    document.body.appendChild(ov);
    const close = () => { set('tourDone', true); ov.remove(); ov = null; removeEventListener('resize', place); document.removeEventListener('keydown', key); if (window.go) window.go('home'); };
    const key = e => { if (e.key === 'Escape') close(); else if (e.key === 'ArrowRight') nxt(); else if (e.key === 'ArrowLeft' && idx) { idx--; place(); } };
    const nxt = () => { if (idx >= STEPS.length - 1) close(); else { idx++; place(); } };
    ov.querySelector('[data-a="skip"]').onclick = close; ov.querySelector('[data-a="next"]').onclick = nxt; ov.querySelector('[data-a="prev"]').onclick = () => { if (idx) { idx--; place(); } };
    addEventListener('resize', place); document.addEventListener('keydown', key); place(); setTimeout(place, 350);
  }
  window.cloudyTour = () => { if (window.showOnb) window.showOnb(); }; window.cloudyIntro = () => intro(true);

  // ---------- Einstellungen und Start ----------
  function wire() {
    const cb = q('#introOn'); if (cb) { cb.checked = !get('introOn', true); cb.onchange = () => set('introOn', !cb.checked); }
    if (window.cloudy && window.cloudy.texCfg) {
      const ids = { toolTex: '#toolTexOn', texTotem: '#texTotemOn', texInv: '#texInvOn', texTheme: '#texThemeOn' }, col = q('#texColor');
      window.cloudy.texCfg().then(c => { for (const k in ids) { const e = q(ids[k]); if (e) e.checked = !!c[k]; } if (col) { col.value = c.texColor; col.disabled = c.texTheme; } }).catch(() => {});
      for (const k in ids) { const e = q(ids[k]); if (e) e.onchange = () => { window.cloudy.texCfg({ [k]: e.checked }); if (k === 'texTheme' && col) col.disabled = e.checked; }; }
      if (col) col.onchange = () => window.cloudy.texCfg({ texColor: col.value });
    }
    const t = q('#tourBtn'); if (t) t.onclick = () => { if (window.go) window.go('home'); if (window.showOnb) window.showOnb(); };
    const i = q('#introBtn'); if (i) i.onclick = () => intro(true);
  }
  function afterLogin() {
    return; // alte Spotlight-Tour wird nicht mehr automatisch gestartet (es gibt nur noch die Willkommens-Einführung)
    if (get('tourDone', false)) return;
    const lg = q('#login'); const go = () => setTimeout(() => { if (!get('tourDone', false) && !ov) tour(); }, 700);
    if (!lg || lg.classList.contains('off') || getComputedStyle(lg).display === 'none') return go();
    const mo = new MutationObserver(() => { if (lg.classList.contains('off')) { mo.disconnect(); go(); } }); mo.observe(lg, { attributes: true, attributeFilter: ['class'] });
  }
  wire();
  const startAll = () => {
    const run = () => intro(false);
    if (window.cloudyGatePending) window.addEventListener('cloudy-gate-ok', run, { once: true }); else run();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startAll); else startAll();
})();
