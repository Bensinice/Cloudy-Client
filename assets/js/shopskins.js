// Shop: Bereiche „Skins“ (Skin-Seite eingebettet), „Cloudy+“ (Kollektion mit Vorschau) und „Quests“ (Quest-Seite eingebettet).
// Die Reiter selbst baut shop.js (#shopNav) und ruft window.shopOpenTab(name) auf.
(function () {
  const $ = s => document.querySelector(s), L = t => (window.t ? window.t(t) : t), en = () => (document.documentElement.lang || 'de') !== 'de';
  let wrap = null, plus = null, qw = null, moved = false, qMoved = false;
  function ensure() {
    const box = $('#shopItems'); if (!box) return false;
    if (!wrap) { wrap = document.createElement('div'); wrap.id = 'shopSkins'; wrap.style.display = 'none'; box.parentNode.insertBefore(wrap, box.nextSibling); }
    if (!plus) { plus = document.createElement('div'); plus.id = 'shopPlus'; plus.style.display = 'none'; box.parentNode.insertBefore(plus, box.nextSibling); }
    if (!qw) { qw = document.createElement('div'); qw.id = 'shopQuests'; qw.style.display = 'none'; box.parentNode.insertBefore(qw, box.nextSibling); }
    return true;
  }
  function openTab(name) { // 'skins' | 'plus' | 'quests' | null (normale Items)
    if (!ensure()) return; const box = $('#shopItems'), sk = $('#p-skins');
    if (name === 'skins' && !moved && sk) { while (sk.firstChild) wrap.appendChild(sk.firstChild); moved = true; const h = wrap.querySelector('h2'); if (h) h.style.display = 'none'; }
    if (name === 'quests' && !qMoved) { const q = $('#p-quests'); if (q) { q.classList.remove('page'); q.classList.add('on'); qw.appendChild(q); qMoved = true; } }
    wrap.style.display = name === 'skins' ? '' : 'none'; plus.style.display = name === 'plus' ? '' : 'none'; qw.style.display = name === 'quests' ? '' : 'none'; box.style.display = name ? 'none' : '';
    if (name === 'skins') { try { window.paintSub && window.paintSub('skins'); } catch {} }
    if (name === 'quests' && openTab.last !== 'quests') { try { window.paintSub && window.paintSub('quests'); } catch {} }
    openTab.last = name;
  }
  window.shopOpenTab = openTab;
  const ps = window.paintSub; window.paintSub = p => { if (p === 'shop') openTab.last = null; if (ps) ps(p); };
  const esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // Cloudy+-Bereich: was man bekommt (mit 3D-Vorschaubildern und Anprobieren)
  window.paintPlusTab = (shop, card) => {
    if (!ensure()) return;
    const items = shop.catalog.filter(i => i.plus), on = !!shop.plus || shop.admin, T = (de, e) => (en() ? e : de);
    const grp = [['wings', T('Flügel', 'Wings')], ['cape', T('Umhänge (animiert)', 'Capes (animated)')], ['hat', T('Hüte', 'Hats')]];
    plus.innerHTML = `<div class="glass plushero ${on ? 'on' : ''}"><div><b>✨ Cloudy+</b><span>${on ? T('Aktiv – die ganze Kollektion gehört dir. Einfach anlegen!', 'Active – the whole collection is yours. Just equip it!') : T('Die Cloudy+-Kollektion kann man nicht kaufen: Mit Cloudy+ gehört sie dir automatisch, solange das Abo läuft. Dazu gibt es die Premium-Reihe im Cloudy Pass.', 'The Cloudy+ collection can’t be bought: with Cloudy+ it’s yours automatically while your subscription runs. You also get the premium track in the Cloudy Pass.')}</span></div>${on ? '' : `<button class="btn" id="plusGet">${T('Cloudy+ holen', 'Get Cloudy+')}</button>`}</div>` +
      grp.map(([c, n]) => { const L0 = items.filter(i => i.cat === c); return L0.length ? `<h3 class="shc">${n}</h3><div class="row shrow">${L0.map(i => card(i, c)).join('')}</div>` : ''; }).join('');
    const g = plus.querySelector('#plusGet'); if (g) g.onclick = () => { if (window.go) window.go('pass'); };
  };
})();
