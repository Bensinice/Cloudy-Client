// Shop: Mini-Tabs „Skins“ (die Skin-Seite wird dort eingebettet) und „Cloudy+“ (vorerst leer)
(function () {
  const $ = s => document.querySelector(s), en = () => (document.documentElement.lang || 'de') !== 'de';
  let wrap = null, plus = null, moved = false;
  function ensure() {
    const box = $('#shopItems'); if (!box) return false;
    if (!wrap) { wrap = document.createElement('div'); wrap.id = 'shopSkins'; wrap.style.display = 'none'; box.parentNode.insertBefore(wrap, box.nextSibling); }
    if (!plus) { plus = document.createElement('div'); plus.id = 'shopPlus'; plus.style.display = 'none'; plus.innerHTML = '<h3 class="shc">Cloudy+</h3>'; box.parentNode.insertBefore(plus, box.nextSibling); }
    return true;
  }
  function openTab(name) { // name: 'skins' | 'plus' | null (normaler Shop)
    if (!ensure()) return; const box = $('#shopItems'), sk = $('#p-skins');
    if (name === 'skins' && !moved && sk) { while (sk.firstChild) wrap.appendChild(sk.firstChild); moved = true; const h = wrap.querySelector('h2'); if (h) h.style.display = 'none'; }
    wrap.style.display = name === 'skins' ? '' : 'none'; plus.style.display = name === 'plus' ? '' : 'none'; box.style.display = name ? 'none' : '';
    const fb = $('#shopFilt'); if (fb) fb.querySelectorAll('[data-sf]').forEach(b => b.classList.toggle('on', name ? b.dataset.sf === name : b.dataset.sf === (localStorage.getItem('cloudy.shopFilt') || 'all')));
    if (name === 'skins') { try { window.paintSub && window.paintSub('skins'); } catch {} }
  }
  function inject() {
    const fb = $('#shopFilt'); if (!fb || fb.querySelector('[data-sf="skins"]')) return;
    try { mo.disconnect(); } catch {}
    for (const [k, label] of [['skins', '👤 Skins'], ['plus', '✨ Cloudy+']]) { const b = document.createElement('button'); b.className = 'chip'; b.dataset.sf = k; b.textContent = label; fb.appendChild(b); }
    fb.addEventListener('click', e => { const t = e.target.closest('[data-sf]'); if (!t) return; if (t.dataset.sf === 'skins' || t.dataset.sf === 'plus') { e.stopImmediatePropagation(); openTab(t.dataset.sf); } else openTab(null); }, true);
  }
  let mo = new MutationObserver(() => inject()); const ps = $('#p-shop'); if (ps) mo.observe(ps, { childList: true, subtree: true }); inject();
})();
