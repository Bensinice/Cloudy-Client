// Shop: Mini-Tab „Skins“ (die Skin-Seite wird dort eingebettet) + Schalter, den Skins-Reiter im Menü auszublenden
(function () {
  const $ = s => document.querySelector(s), en = () => { try { return (document.documentElement.lang || 'de') !== 'de'; } catch { return false; } };
  const get = (k, d) => { try { const v = localStorage.getItem('cloudy.x.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } };
  const set = (k, v) => { try { localStorage.setItem('cloudy.x.' + k, JSON.stringify(v)); } catch {} };
  let wrap = null, moved = false;
  const navApply = () => { const n = document.querySelector('.nav[data-p="skins"]'); if (n) n.style.display = get('navSkins', true) ? '' : 'none'; };
  function ensureWrap() {
    if (wrap) return wrap; const box = $('#shopItems'); if (!box) return null;
    wrap = document.createElement('div'); wrap.id = 'shopSkins'; wrap.style.display = 'none'; box.parentNode.insertBefore(wrap, box.nextSibling); return wrap;
  }
  function openSkins(on) {
    const w = ensureWrap(), box = $('#shopItems'), sk = $('#p-skins'); if (!w || !box || !sk) return;
    if (on && !moved) { while (sk.firstChild) w.appendChild(sk.firstChild); moved = true; }
    w.style.display = on ? '' : 'none'; box.style.display = on ? 'none' : '';
    const fb = $('#shopFilt'); if (fb) fb.querySelectorAll('[data-sf]').forEach(b => b.classList.toggle('on', on ? b.dataset.sf === 'skins' : b.dataset.sf === (localStorage.getItem('cloudy.shopFilt') || 'all')));
    if (on) { try { window.paintAll && window.paintAll(); } catch {} const h = w.querySelector('h2'); if (h) h.style.display = 'none'; }
  }
  function inject() {
    const fb = $('#shopFilt'); if (!fb || fb.querySelector('[data-sf="skins"]')) return;
    try { mo.disconnect(); } catch {}
    const b = document.createElement('button'); b.className = 'chip'; b.dataset.sf = 'skins'; b.textContent = '👤 ' + (en() ? 'Skins' : 'Skins');
    fb.appendChild(b);
    fb.addEventListener('click', e => { const t = e.target.closest('[data-sf]'); if (!t) return; if (t.dataset.sf === 'skins') { e.stopImmediatePropagation(); openSkins(true); } else openSkins(false); }, true);
  }
  function settingUi() {
    const h = [...document.querySelectorAll('#p-settings h3')].find(x => /Darstellung|Appearance/.test(x.textContent)); if (!h || $('#navSkinsCb')) return;
    const l = document.createElement('label'); l.className = 'cb'; l.style.marginTop = '10px';
    l.innerHTML = `<input type="checkbox" id="navSkinsCb"> ${en() ? 'Show “Skins” in the top menu (skins are always in the Shop under “Skins”)' : '„Skins“ im Menü oben zeigen (Skins gibt es immer auch im Shop unter „Skins“)'}`;
    h.parentElement.appendChild(l); const cb = l.querySelector('input'); cb.checked = get('navSkins', true); cb.onchange = () => { set('navSkins', cb.checked); navApply(); };
  }
  navApply(); settingUi(); setTimeout(settingUi, 1500);
  let mo = new MutationObserver(() => inject()); const ps = $('#p-shop'); if (ps) mo.observe(ps, { childList: true, subtree: true }); inject();
})();
