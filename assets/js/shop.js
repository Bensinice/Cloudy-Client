// Cloudy – Skins & Cosmetics-Shop (Cloudy Coins = CC). Nutzt $, $$, esc, st, go aus index.html.
(function () {
  const L = s => (window.t ? window.t(s) : s);
  const cc = n => (n == null ? '∞' : n) + ' CC';
  let shop = null, skins = [], sel = st.get('skinSel', '');

  // ---------- Zeichnen: Spielfigur (Vorderseite) + Cosmetics, Einheit = 1 Skin-Pixel ----------
  const img = new Map();
  const load = d => img.get(d) || (() => { const i = new Image(); i.onload = () => window.paintAll && window.paintAll(); i.src = d; img.set(d, i); return i; })();
  function avatar(ctx, im, slim) {
    const part = (sx, sy, sw, sh, dx, dy, dw) => { try { ctx.drawImage(im, sx, sy, sw, sh, dx, dy, dw || sw, sh); } catch {} };
    if (!im || !im.complete || !im.naturalWidth) { // Platzhalter-Figur ohne Skin
      ctx.fillStyle = '#f0c7a0'; ctx.fillRect(4, 0, 8, 8); ctx.fillStyle = '#4aa3ff'; ctx.fillRect(4, 8, 8, 12); ctx.fillRect(0, 8, 4, 12); ctx.fillRect(12, 8, 4, 12);
      ctx.fillStyle = '#3b4a8a'; ctx.fillRect(4, 20, 4, 12); ctx.fillRect(8, 20, 4, 12); ctx.fillStyle = '#5a3b22'; ctx.fillRect(4, 0, 8, 2); return;
    }
    const tall = im.naturalHeight >= 64, aw = slim ? 3 : 4;
    part(8, 8, 8, 8, 4, 0); part(20, 20, 8, 12, 4, 8);
    part(44, 20, aw, 12, 4 - aw, 8); part(4, 20, 4, 12, 4, 20);
    if (tall) { part(36, 52, aw, 12, 12, 8); part(20, 52, 4, 12, 8, 20); } else { // altes 64×32-Format: links = gespiegelt rechts
      ctx.save(); ctx.translate(16, 0); ctx.scale(-1, 1); part(44, 20, 4, 12, 0, 8); ctx.restore(); ctx.save(); ctx.translate(16, 0); ctx.scale(-1, 1); part(4, 20, 4, 12, 4, 20); ctx.restore();
    }
    if (tall) { part(20, 36, 8, 12, 4, 8); part(44, 36, aw, 12, 4 - aw, 8); part(52, 52, aw, 12, 12, 8); part(4, 36, 4, 12, 4, 20); part(4, 52, 4, 12, 8, 20); }
    part(40, 8, 8, 8, 3.6, -0.4, 8.8);
  }
  const ITEMS = {
    'cape-cloud': { b: [0, 8, 16, 24], c: ['#d6edff', '#3d8fee'] }, 'cape-aurora': { b: [0, 8, 16, 24], c: ['#27e1a0', '#7c5cff'] },
    'wings-angel': { b: [-9, 0, 34, 24], c: ['#ffffff', '#bcd9ff'] }, 'wings-neon': { b: [-9, 0, 34, 24], c: ['#00e5ff', '#ff3dd0'] },
    'shield-cloud': { b: [-7, 10, 12, 18], c: ['#9bd2ff', '#2f7fe0'] }, 'shield-sun': { b: [-7, 10, 12, 18], c: ['#ffd24a', '#e8741a'] },
    'hat-top': { b: [1, -9, 14, 11], c: ['#2a2a3c', '#4aa3ff'] }, 'hat-wizard': { b: [0, -12, 16, 14], c: ['#8b5cf6', '#ffd24a'] },
    'cape-sunset': { b: [0, 8, 16, 24], c: ['#ffb36b', '#ff4f8b'] }, 'cape-galaxy': { b: [0, 8, 16, 24], c: ['#3a2a9b', '#0a0a2a'] }, 'cape-fire': { b: [0, 8, 16, 24], c: ['#ffd23a', '#e23b1a'] },
    'wings-fire': { b: [-9, 0, 34, 24], c: ['#ffd23a', '#e23b1a'] }, 'wings-bat': { b: [-9, 0, 34, 24], c: ['#4a2a6a', '#14081f'] },
    'shield-dragon': { b: [-7, 10, 12, 18], c: ['#e23b3b', '#3a0a0a'] }, 'shield-forest': { b: [-7, 10, 12, 18], c: ['#5bd98a', '#1b6a45'] },
    'hat-gold': { b: [1, -9, 14, 11], c: ['#f4c430', '#e23b3b'] }, 'hat-santa': { b: [0, -12, 16, 14], c: ['#e0262e', '#ffffff'], brim: '#ffffff' }, 'hat-witch': { b: [0, -12, 16, 14], c: ['#2b2b38', '#ff8a1f'] },
    'cape-ocean': { b: [0, 8, 16, 24], c: ['#5ee7ff', '#0a4fa3'] }, 'cape-sakura': { b: [0, 8, 16, 24], c: ['#ffd1e3', '#e0577f'] },
    'wings-crystal': { b: [-9, 0, 34, 24], c: ['#b9f6ff', '#6a7bff'] }, 'wings-shadow': { b: [-9, 0, 34, 24], c: ['#3b2a55', '#07050d'] },
    'shield-ice': { b: [-7, 10, 12, 18], c: ['#d9f6ff', '#4aa8d8'] }, 'hat-party': { b: [0, -12, 16, 14], c: ['#ff4fa3', '#ffe14a'] }, 'hat-frost': { b: [0, -12, 16, 14], c: ['#8fe3ff', '#ffffff'], brim: '#ffffff' },
    'cape-nebula': { b: [0, 8, 16, 24], c: ['#b06bff', '#2a0b6b'] }, 'cape-emerald': { b: [0, 8, 16, 24], c: ['#6dffb0', '#0b6b45'] }, 'cape-royal': { b: [0, 8, 16, 24], c: ['#ffd24a', '#7a1fb3'] },

    'totem-zz': { b: [0, 0, 16, 16], c: ['#e8c34a', '#5a3b0a'], tot: 'assets/cosmetics/totem-zz.png' }, 'hotbar-zz': { b: [0, 0, 16, 16], c: ['#5aa2f5', '#0de1e5'], hb: 'assets/cosmetics/hotbar-zz.png' },
    'sky-sunset': { b: [0, 0, 16, 16], c: ['#ff8a5c', '#ffd9a0'], sky: 1 }, 'sky-aurora': { b: [0, 0, 16, 16], c: ['#0b1f3a', '#2fe6a8'], sky: 1 }, 'sky-galaxy': { b: [0, 0, 16, 16], c: ['#12062e', '#a055ff'], sky: 1 },
    'wings-zv': { b: [-9, 0, 34, 24], c: ['#b05cff','#3b1a8a'], img: 'assets/cosmetics/zz-zv-wings.png', ar: 0.787, sc: 0.62 }, 'wings-zb': { b: [-9, 0, 34, 24], c: ['#3b9bff','#0a3a8a'], img: 'assets/cosmetics/zz-zb-wings.png', ar: 0.775, sc: 0.62 }, 'wings-zs': { b: [-9, 0, 34, 24], c: ['#3a3a44','#0a0a0e'], img: 'assets/cosmetics/zz-zs-wings.png', ar: 0.763, sc: 0.62 }, 'wings-zf': { b: [-9, 0, 34, 24], c: ['#4fd8ff','#0a4a7a'], img: 'assets/cosmetics/zz-zf-wings.png', ar: 0.694, sc: 0.62 },
    'cape-zbs': { b: [0, 8, 16, 24], c: ['#3b9bff','#0a1a4a'], img: 'assets/cosmetics/zz-zbs-cape.png', ar: 1.6 }, 'cape-ghg': { b: [0, 8, 16, 24], c: ['#8a3cff','#111118'], img: 'assets/cosmetics/zz-ghg-cape.png', ar: 1.6 },
    'cape-zz4': { b: [0, 8, 16, 24], c: ['#c04bff','#2a0b6b'], img: 'assets/cosmetics/zz-zz4-cape.png', ar: 336 / 200 }, 'wings-zz4': { b: [-9, 0, 34, 24], c: ['#c04bff','#2a0b6b'], img: 'assets/cosmetics/zz-zz4-wings.png', ar: 340 / 520 }, 'shield-zz4': { b: [-7, 10, 12, 18], c: ['#c04bff','#2a0b6b'], img: 'assets/cosmetics/zz-zz4-shield.png', ar: 0.6484 },
    'cape-zz4m': { b: [0, 8, 16, 24], c: ['#e8e8f0','#2a2a34'], img: 'assets/cosmetics/zz-zz4m-cape.png', ar: 336 / 200 }, 'wings-zz4m': { b: [-9, 0, 34, 24], c: ['#e8e8f0','#2a2a34'], img: 'assets/cosmetics/zz-zz4m-wings.png', ar: 340 / 520 }, 'shield-zz4m': { b: [-7, 10, 12, 18], c: ['#e8e8f0','#2a2a34'], img: 'assets/cosmetics/zz-zz4m-shield.png', ar: 0.6484 },
    'cape-zz3': { b: [0, 8, 16, 24], c: ['#ff4a4a','#5a0a0a'], img: 'assets/cosmetics/zz-zz3-cape.png', ar: 336 / 200 }, 'wings-zz3': { b: [-9, 0, 34, 24], c: ['#ff4a4a','#5a0a0a'], img: 'assets/cosmetics/zz-zz3-wings.png', ar: 340 / 520 }, 'shield-zz3': { b: [-7, 10, 12, 18], c: ['#ff4a4a','#5a0a0a'], img: 'assets/cosmetics/zz-zz3-shield.png', ar: 1.0000 },
    'cape-zz3s': { b: [0, 8, 16, 24], c: ['#ffd24a','#8a5a0a'], img: 'assets/cosmetics/zz-zz3s-cape.png', ar: 336 / 200 }, 'wings-zz3s': { b: [-9, 0, 34, 24], c: ['#ffd24a','#8a5a0a'], img: 'assets/cosmetics/zz-zz3s-wings.png', ar: 340 / 520 }, 'shield-zz3s': { b: [-7, 10, 12, 18], c: ['#ffd24a','#8a5a0a'], img: 'assets/cosmetics/zz-zz3s-shield.png', ar: 1.0000 },
    'cape-zz5': { b: [0, 8, 16, 24], c: ['#ff4a4a','#ffd24a'], img: 'assets/cosmetics/zz-zz5-cape.png', ar: 336 / 200 }, 'wings-zz5': { b: [-9, 0, 34, 24], c: ['#ff4a4a','#ffd24a'], img: 'assets/cosmetics/zz-zz5-wings.png', ar: 340 / 520 }, 'shield-zz5': { b: [-7, 10, 12, 18], c: ['#ff4a4a','#ffd24a'], img: 'assets/cosmetics/zz-zz5-shield.png', ar: 1.0240 },
    'cape-zk5': { b: [0, 8, 16, 24], c: ['#ffffff','#9aa0b0'], img: 'assets/cosmetics/zz-zk5-cape.png', ar: 336 / 200 }, 'wings-zk5': { b: [-9, 0, 34, 24], c: ['#ffffff','#9aa0b0'], img: 'assets/cosmetics/zz-zk5-wings.png', ar: 340 / 520 },
    'cape-yy': { b: [0, 8, 16, 24], c: ['#f2f2f2', '#14141a'], img: 'assets/cosmetics/zz-yy-cape.png', ar: 336 / 200 }, 'shield-yy': { b: [-7, 10, 12, 18], c: ['#f2f2f2', '#14141a'], img: 'assets/cosmetics/zz-yy-shield.png', ar: 1 },
    'hat-crown': { b: [3, -6, 10, 6], c: ['#ffd24a', '#e23b3b'] }, 'hat-halo': { b: [3, -9, 10, 5], c: ['#fff7b0', '#ffd24a'] }
  };
  const lt = (hex, k) => { const n = parseInt(hex.slice(1), 16), f = c => Math.round(c + (255 - c) * k); return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(f).map(x => x.toString(16).padStart(2, '0')).join(''); };
  const grad = (ctx, x0, y0, x1, y1, c) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, c[0]); g.addColorStop(1, c[1]); return g; };
  const outline = ctx => { ctx.lineWidth = 0.5; ctx.strokeStyle = 'rgba(20,30,60,.55)'; ctx.stroke(); };
  function drawItem(ctx, id) {
    const c = ITEMS[id].c; ctx.save();
    if (id.startsWith('cape')) {
      ctx.beginPath(); ctx.moveTo(3, 9); ctx.lineTo(13, 9); ctx.lineTo(15.5, 31); ctx.lineTo(0.5, 31); ctx.closePath(); ctx.fillStyle = grad(ctx, 0, 9, 0, 31, c); ctx.fill(); outline(ctx);
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      if (id === 'cape-galaxy') { ctx.fillStyle = '#fff'; [[4, 12], [10, 14], [7, 18], [12, 22], [5, 25], [9, 28], [3, 20]].forEach(([x, y]) => ctx.fillRect(x, y, .9, .9)); }
      else if (id === 'cape-cloud') { [[6, 15, 2], [8.2, 14.2, 2.6], [10.4, 15, 2], [8, 16, 3]].forEach(([x, y, r]) => { ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); }); }
      else for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(2 + i * 3.4, 10); ctx.lineTo(4.4 + i * 3.4, 10); ctx.lineTo(3 + i * 3.8 - 2, 31); ctx.lineTo(1 + i * 3.8 - 2, 31); ctx.fill(); }
    } else if (id.startsWith('wings')) {
      for (const s of [-1, 1]) for (let i = 0; i < 5; i++) {
        ctx.save(); ctx.translate(s < 0 ? 4 : 12, 11); ctx.scale(s, 1); ctx.rotate((-72 + i * 30) * Math.PI / 180); const len = 15 - i * 1.6;
        ctx.beginPath(); ctx.ellipse(len / 2 + 1, 0, len / 2, 2.7, 0, 0, 7); ctx.fillStyle = grad(ctx, 0, 0, len, 0, c); if (id === 'wings-neon' || id === 'wings-fire' || id === 'wings-crystal' || id === 'wings-shadow') { ctx.shadowColor = c[0]; ctx.shadowBlur = 4; } ctx.fill(); ctx.shadowBlur = 0; outline(ctx); ctx.restore();
      }
    } else if (id.startsWith('shield')) {
      ctx.beginPath(); ctx.moveTo(-5.5, 12); ctx.lineTo(2.5, 12); ctx.lineTo(2.5, 19); ctx.quadraticCurveTo(2.5, 24, -1.5, 26.5); ctx.quadraticCurveTo(-5.5, 24, -5.5, 19); ctx.closePath();
      ctx.fillStyle = grad(ctx, -5, 12, 2, 26, c); ctx.fill(); outline(ctx); ctx.fillStyle = 'rgba(255,255,255,.85)';
      if (id === 'shield-cloud') [[-3, 19, 1.5], [-1.5, 18, 2], [0, 19, 1.5], [-1.5, 19.6, 2.4]].forEach(([x, y, r]) => { ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); });
      else if (id === 'shield-sun') { ctx.beginPath(); ctx.arc(-1.5, 18.5, 2.2, 0, 7); ctx.fill(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; ctx.fillRect(-1.5 + Math.cos(a) * 3.4 - .4, 18.5 + Math.sin(a) * 3.4 - .4, .8, .8); } }
      else { ctx.fillStyle = c[2] || '#ffd24a'; ctx.beginPath(); ctx.arc(-1.5, 18.5, 2.2, 0, 7); ctx.fill(); ctx.fillRect(-2.1, 14.5, 1.2, 1.6); ctx.fillRect(-2.1, 21, 1.2, 1.6); }
    } else if (id === 'hat-crown') {
      ctx.fillStyle = grad(ctx, 0, -6, 0, 0, c); ctx.beginPath(); ctx.moveTo(3.5, 0); ctx.lineTo(3.5, -5); ctx.lineTo(6, -2.6); ctx.lineTo(8, -5.6); ctx.lineTo(10, -2.6); ctx.lineTo(12.5, -5); ctx.lineTo(12.5, 0); ctx.closePath(); ctx.fill(); outline(ctx);
      ctx.fillStyle = '#e23b3b'; [[5, -1.4], [8, -1.4], [11, -1.4]].forEach(([x, y]) => ctx.fillRect(x - .5, y, 1, 1));
    } else if (id === 'hat-halo') {
      ctx.strokeStyle = c[1]; ctx.lineWidth = 1.1; ctx.shadowColor = c[0]; ctx.shadowBlur = 4; ctx.beginPath(); ctx.ellipse(8, -5, 5, 1.4, 0, 0, 7); ctx.stroke(); ctx.shadowBlur = 0;
    } else if (id === 'hat-top' || id === 'hat-gold') {
      ctx.fillStyle = c[0]; ctx.fillRect(4.5, -7, 7, 7); ctx.fillRect(2.5, -1, 11, 1.6); ctx.fillStyle = c[1]; ctx.fillRect(4.5, -2.6, 7, 1.6);
      ctx.strokeStyle = 'rgba(255,255,255,.2)'; ctx.lineWidth = .4; ctx.strokeRect(4.5, -7, 7, 7);
    } else {
      ctx.beginPath(); ctx.ellipse(8, 0, 7.2, 1.5, 0, 0, 7); ctx.fillStyle = ITEMS[id].brim || c[0]; ctx.fill(); outline(ctx);
      ctx.beginPath(); ctx.moveTo(4.2, -.3); ctx.quadraticCurveTo(7, -4, 10, -10); ctx.quadraticCurveTo(11, -4, 11.8, -.3); ctx.closePath(); ctx.fillStyle = grad(ctx, 0, -10, 0, 0, [lt(c[0], .35), c[0]]); ctx.fill(); outline(ctx);
      ctx.fillStyle = c[1]; [[7, -3], [9, -5.5], [8.8, -1.8]].forEach(([x, y]) => ctx.fillRect(x, y, .9, .9)); ctx.fillRect(4.4, -1.6, 7.4, 1);
    }
    ctx.restore();
  }
  function paintPreview(cv, equip) {
    const s = cv.width / 32, ctx = cv.getContext('2d'); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.imageSmoothingEnabled = false;
    ctx.setTransform(s, 0, 0, s, 8 * s, 12 * s); const sk = skins.find(x => x.id === sel) || skins[0];
    if (equip.cape) drawItem(ctx, equip.cape); if (equip.wings) drawItem(ctx, equip.wings);
    avatar(ctx, sk && load(sk.data), sk && sk.model === 'slim');
    if (equip.hat) drawItem(ctx, equip.hat); if (equip.shield) drawItem(ctx, equip.shield);
  }
  function paintIcon(cv, id) {
    const ctx = cv.getContext('2d'), [bx, by, bw, bh] = ITEMS[id].b, s = Math.min(cv.width / bw, cv.height / bh) * .9;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.setTransform(s, 0, 0, s, (cv.width - bw * s) / 2 - bx * s, (cv.height - bh * s) / 2 - by * s); drawItem(ctx, id);
  }
  function capeCv(id) { // 64×32-Umhang-Textur
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 32; const x = cv.getContext('2d'), c = ITEMS[id].c;
    x.fillStyle = grad(x, 0, 0, 0, 17, c); x.fillRect(0, 0, 22, 17); x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(12, 1, 10, 16);
    x.fillStyle = 'rgba(255,255,255,.4)';
    if (id === 'cape-galaxy') [[2, 3], [5, 6], [8, 2], [3, 9], [7, 11], [9, 14], [2, 14], [5, 15]].forEach(([a, b]) => x.fillRect(a, b, 1, 1)); else if (id === 'cape-cloud') [[4, 5, 2], [6, 4.4, 2.4], [8, 5, 2], [6, 6, 2.6]].forEach(([a, b, r]) => { x.beginPath(); x.arc(a + 0, b + 0, r, 0, 7); x.fill(); }); else for (let i = 0; i < 5; i++) x.fillRect(1 + i * 2, 1, 1, 16);
    x.strokeStyle = 'rgba(0,0,0,.35)'; x.strokeRect(1.5, 1.5, 9, 15); return cv;
  }
  const capeTex = id => capeCv(id).toDataURL('image/png');
  async function capeTexHi(id) { // Bild-Umhänge: 256×128 (4× Auflösung), das Bild liegt auf der Außenseite (1,1,10,16)
    const I = ITEMS[id]; if (!I.img) return capeTex(id);
    const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = I.img; });
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128; const g = cv.getContext('2d'); g.fillStyle = I.c[1]; g.fillRect(0, 0, 88, 68);
    g.drawImage(im, 4, 4, 40, 64); g.save(); g.translate(88, 0); g.scale(-1, 1); g.drawImage(im, 4, 4, 40, 64); g.restore();
    return cv.toDataURL('image/png');
  }
  // ---------- 3D-Vorschau (CSS-3D, ohne Bibliothek): Skin + Umhang + Flügel + Hut + Schild ----------
  const S3 = 8; let ang3 = 28, drag3 = false, raf3 = 0;
  const texC = new Map(); // Texturen nur einmal erzeugen (toDataURL ist teuer und lief bei jedem Neuzeichnen)
  const imgId = new WeakMap(); let imgN = 0;
  const tex = (im, x, y, w, h) => { let id = imgId.get(im); if (!id) { id = ++imgN; imgId.set(im, id); } const k = id + ':' + (im.src ? im.src.length : 0) + ':' + x + ',' + y + ',' + w + ',' + h; let v = texC.get(k); if (v) return v; const c = document.createElement('canvas'); c.width = w; c.height = h; try { c.getContext('2d').drawImage(im, x, y, w, h, 0, 0, w, h); } catch {} v = c.toDataURL(); if (texC.size > 400) texC.clear(); texC.set(k, v); return v; };
  function box3(w, h, d, cx, cy, cz, faces) {
    const el = document.createElement('div'); el.className = 'b3'; el.style.transform = `translate3d(${cx * S3}px,${(cy - 16) * S3}px,${cz * S3}px)`;
    const mk = (n, fw, fh, tf) => { const f = document.createElement('i'); f.className = 'f3 ' + n; f.style.cssText = `width:${fw * S3}px;height:${fh * S3}px;margin:${-fh * S3 / 2}px 0 0 ${-fw * S3 / 2}px;transform:${tf}`; const v = faces[n]; if (v) { if (v.startsWith('data:')) f.style.backgroundImage = `url(${v})`; else if (v.startsWith('img:')) { const [u, r] = v.slice(4).split('@'); f.style.backgroundImage = `url(${u})`; f.style.imageRendering = 'auto'; if (r) { const [x, y, w, h] = r.split(',').map(Number); f.style.backgroundSize = `${100 / w}% ${100 / h}%`; f.style.backgroundPosition = `${w >= 1 ? 0 : x / (1 - w) * 100}% ${h >= 1 ? 0 : y / (1 - h) * 100}%`; } } else f.style.background = v; } el.appendChild(f); };
    mk('front', w, h, `translateZ(${d * S3 / 2}px)`); mk('back', w, h, `rotateY(180deg) translateZ(${d * S3 / 2}px)`); mk('right', d, h, `rotateY(-90deg) translateZ(${w * S3 / 2}px)`);
    mk('left', d, h, `rotateY(90deg) translateZ(${w * S3 / 2}px)`); mk('top', w, d, `rotateX(90deg) translateZ(${h * S3 / 2}px)`); mk('bottom', w, d, `rotateX(-90deg) translateZ(${h * S3 / 2}px)`);
    return el;
  }
  const solid = c => ({ front: c, back: c, left: c, right: c, top: c, bottom: c });
  function skinBox(im, u, v, w, h, d, cx, cy, cz, grow = 0) {
    const f = im ? { top: tex(im, u + d, v, w, d), bottom: tex(im, u + d + w, v, w, d), right: tex(im, u, v + d, d, h), front: tex(im, u + d, v + d, w, h), left: tex(im, u + d + w, v + d, d, h), back: tex(im, u + 2 * d + w, v + d, w, h) } : solid('#8fb8e8');
    return box3(w + grow, h + grow, d + grow, cx, cy, cz, f);
  }
  function steve() { // Standard-Figur (nicht blau), falls noch kein Skin geladen ist
    const c = document.createElement('canvas'); c.width = 64; c.height = 64; const g = c.getContext('2d'), R = (col, x, y, w, h) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    R('#b98862', 8, 8, 8, 8); R('#4b2f1c', 8, 8, 8, 2); R('#4b2f1c', 8, 10, 1, 2); R('#4b2f1c', 15, 10, 1, 2); R('#fff', 9, 12, 2, 1); R('#fff', 13, 12, 2, 1); R('#5b3dd1', 10, 12, 1, 1); R('#5b3dd1', 13, 12, 1, 1); R('#7a4a2e', 11, 14, 2, 1);
    R('#4b2f1c', 0, 8, 8, 8); R('#4b2f1c', 16, 8, 8, 8); R('#4b2f1c', 24, 8, 8, 8); R('#4b2f1c', 8, 0, 8, 8); R('#4b2f1c', 16, 0, 8, 8);
    R('#00a8a8', 20, 20, 8, 12); R('#00a8a8', 16, 20, 4, 12); R('#00a8a8', 28, 20, 4, 12); R('#00a8a8', 32, 20, 8, 12);
    R('#b98862', 44, 20, 4, 12); R('#b98862', 40, 20, 4, 12); R('#b98862', 48, 20, 4, 12); R('#b98862', 52, 20, 4, 12); R('#00a8a8', 44, 20, 4, 4);
    R('#3d3a8c', 4, 20, 4, 12); R('#3d3a8c', 0, 20, 4, 12); R('#3d3a8c', 8, 20, 4, 12); R('#3d3a8c', 12, 20, 4, 12);
    R('#b98862', 36, 52, 4, 12); R('#00a8a8', 36, 52, 4, 4); R('#3d3a8c', 20, 52, 4, 12); R('#b98862', 32, 52, 4, 12); R('#b98862', 40, 52, 4, 12); R('#b98862', 44, 52, 4, 12);
    R('#3d3a8c', 16, 52, 4, 12); R('#3d3a8c', 24, 52, 4, 12); R('#3d3a8c', 28, 52, 4, 12); R('#00a8a8', 16, 52, 0, 0);
    return c;
  }
  function itemCanvas(id, x0, y0, w, h, k) { const c = document.createElement('canvas'); c.width = w * k; c.height = h * k; const g = c.getContext('2d'); g.setTransform(k, 0, 0, k, -x0 * k, -y0 * k); drawItem(g, id); return c.toDataURL(); }
  function paint3d(equip, hostSel) {
    const host = $(hostSel || '#shop3d'); if (!host) return; host.innerHTML = ''; const rig = document.createElement('div'); rig.className = 'rig3'; host.appendChild(rig);
    const sk = skins.find(x => x.id === sel) || skins[0], im0 = sk && load(sk.data), ok = im0 && im0.complete && im0.naturalWidth, im = ok ? im0 : steve(), tall = ok ? im0.naturalHeight >= 64 : true, slim = sk && sk.model === 'slim', aw = slim ? 3 : 4;
    const add = e => rig.appendChild(e);
    add(skinBox(im, 0, 0, 8, 8, 8, 0, 4, 0)); add(skinBox(im, 16, 16, 8, 12, 4, 0, 14, 0));
    add(skinBox(im, 40, 16, aw, 12, 4, -(4 + aw / 2), 14, 0)); add(skinBox(im, tall ? 32 : 40, tall ? 48 : 16, aw, 12, 4, 4 + aw / 2, 14, 0));
    add(skinBox(im, 0, 16, 4, 12, 4, -2, 26, 0)); add(skinBox(im, tall ? 16 : 0, tall ? 48 : 16, 4, 12, 4, 2, 26, 0));
    if (ok) { add(skinBox(im, 32, 0, 8, 8, 8, 0, 4, 0, 1.1));
      if (tall) { add(skinBox(im, 16, 32, 8, 12, 4, 0, 14, 0, 0.6)); add(skinBox(im, 40, 32, aw, 12, 4, -(4 + aw / 2), 14, 0, 0.6)); add(skinBox(im, 48, 48, aw, 12, 4, 4 + aw / 2, 14, 0, 0.6)); add(skinBox(im, 0, 32, 4, 12, 4, -2, 26, 0, 0.6)); add(skinBox(im, 0, 48, 4, 12, 4, 2, 26, 0, 0.6)); } }
    if (equip.cape && ITEMS[equip.cape].img) { const g = grp('translate3d(0,0,0)'); capeImg(equip.cape, g); add(g); }
    else if (equip.cape) { // Umhang hängt leicht schräg am Rücken
      const cv = capeCv(equip.cape), g = document.createElement('div'); g.className = 'b3'; g.style.transform = `translate3d(0,${(8 - 16) * S3}px,${-2.3 * S3}px) rotateX(-5deg)`;
      const b = box3(10, 16, 1, 0, 24, 0, { back: tex(cv, 1, 1, 10, 16), front: tex(cv, 12, 1, 10, 16), top: tex(cv, 1, 0, 10, 1), bottom: tex(cv, 11, 0, 10, 1), right: tex(cv, 0, 1, 1, 16), left: tex(cv, 11, 1, 1, 16) });
      b.style.transform = `translate3d(0,${8 * S3}px,0)`; g.appendChild(b); add(g);
    }
    if (equip.wings && ITEMS[equip.wings].img) { const g = grp('translate3d(0,0,0)'); wingsImg(equip.wings, g); add(g); }
    else if (equip.wings) { const g = grp(`translate3d(0,${-3 * S3}px,${-2.8 * S3}px) scale(.68)`); wings3(equip.wings, e => g.appendChild(e), 38); add(g); }
    if (false && equip.shield) { const g = grp(`translate3d(${(4 + aw / 2) * S3}px,${-3.5 * S3}px,${3.9 * S3}px) scale(${ITEMS[equip.shield].img ? .5 : .62})`); shield3(equip.shield, e => g.appendChild(e)); add(g); } // wie in Minecraft: vor dem Arm gehalten
    hat3(equip.hat, add);
    const apply = () => { rig.style.transform = `rotateX(-10deg) rotateY(${ang3}deg)`; }; apply(); host._apply = apply;
  }
  // ---------- Start-Banner: dein Skin mit Cosmetics, schaut dem Mauszeiger nach und dreht sich sonst langsam hin und her ----------
  let heroOn = true, heroAng = -18, heroTgt = -18, heroMouse = 0, heroRaf = 0, heroT = 0;
  try { heroOn = localStorage.getItem('cloudy.heroSkin') !== '0'; } catch {}
  function paintHero() {
    const host = $('#heroSkin'); if (!host) return; host.style.display = heroOn ? '' : 'none'; if (!heroOn || !shop) { host.innerHTML = ''; return; }
    paint3d(shop.equip, '#heroSkin'); const rig = host.firstChild; if (!rig) return;
    host._apply = () => { rig.style.transform = `rotateX(-6deg) rotateY(${heroAng}deg)`; }; host._apply(); loopHero();
  }
  function loopHero() {
    cancelAnimationFrame(heroRaf); const host = $('#heroSkin'); if (!host || !heroOn || !host.offsetParent || document.hidden) return;
    const now = performance.now(); heroT = now;
    if (now - heroMouse > 2500) heroTgt = -18 + Math.sin(now / 2600) * 32; // ohne Maus: langsam umschauen
    heroAng += (heroTgt - heroAng) * 0.07; if (!(perfOn && (perfN = (perfN + 1) % 3))) { if (host._apply) host._apply(); }
    heroRaf = requestAnimationFrame(loopHero);
  }
  document.addEventListener('pointermove', e => { const w = window.innerWidth || 1; heroTgt = -18 + Math.max(-1, Math.min(1, (e.clientX / w - 0.62) * 2.2)) * 55; heroMouse = performance.now(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) loopHero(); });
  window.paintHero = paintHero; window.restartHero = loopHero;
  setTimeout(() => { const cb = $('#heroSkinOn'); if (cb) { cb.checked = heroOn; cb.onchange = () => { heroOn = cb.checked; try { localStorage.setItem('cloudy.heroSkin', heroOn ? '1' : '0'); } catch {} paintHero(); }; } }, 0);
  function hat3(H, add) {
    const hc = H && ITEMS[H] && ITEMS[H].c;
    if (H === 'hat-top' || H === 'hat-gold') { add(box3(7, 7, 7, 0, -3.9, 0, solid(hc[0]))); add(box3(7.2, 1.6, 7.2, 0, -2.4, 0, solid(hc[1]))); add(box3(11, 1.2, 11, 0, -0.5, 0, solid(hc[0]))); }
    else if (H === 'hat-wizard' || H === 'hat-santa' || H === 'hat-witch' || H === 'hat-party' || H === 'hat-frost') { const brim = ITEMS[H].brim || hc[0]; add(box3(14, 1, 14, 0, -0.5, 0, solid(brim))); let y = -1; [[9, 3, hc[0]], [7, 3, lt(hc[0], .15)], [5, 3, lt(hc[0], .3)], [3, 3, lt(hc[0], .45)], [1.6, 2, H === 'hat-santa' || H === 'hat-frost' ? '#ffffff' : hc[1]]].forEach(([w, h, col]) => { add(box3(w, h, w, 0, y - h / 2, 0, solid(col))); y -= h; }); if (H !== 'hat-santa' && H !== 'hat-frost') add(box3(9.2, 0.9, 9.2, 0, -1.9, 0, solid(hc[1]))); }
    else if (H === 'hat-crown') { add(box3(8.6, 2, 8.6, 0, -1.2, 0, solid(hc[0]))); [[-3.3, -3.3], [3.3, -3.3], [-3.3, 3.3], [3.3, 3.3]].forEach(([x, z]) => add(box3(2, 3, 2, x, -3.7, z, solid(hc[0])))); add(box3(1.2, 1.2, 0.3, 0, -1.2, 4.4, solid(hc[1]))); }
    else if (H === 'hat-halo') { [[0, 3.6, 8, 0.8], [0, -3.6, 8, 0.8], [3.6, 0, 0.8, 8], [-3.6, 0, 0.8, 8]].forEach(([x, z, w, d]) => add(box3(w, 0.7, d, x, -6.5, z, solid(hc[1])))); }
  }
  // ---------- 3D-Karten: jedes Item als drehbares Objekt (Hüte aus Quadern, Flaches mit echter Tiefe durch Schichten) ----------

  // ---------- Echte 3D-Modelle aus Quadern (Umhang mit Falten, Flügel mit Federn, Schild mit Rand und Buckel) ----------
  const mixc = (a, b, t) => { const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16), f = sh => Math.round(((A >> sh) & 255) * (1 - t) + ((B >> sh) & 255) * t); return '#' + [16, 8, 0].map(sh => f(sh).toString(16).padStart(2, '0')).join(''); };
  const grp = tf => { const g = document.createElement('div'); g.className = 'b3'; g.style.transform = tf; return g; };
  function cape3(id, add) {
    if (ITEMS[id].img) { const g = grp('translate3d(0,0,0)'); capeImg(id, g); add(g); return; }
    const cv = capeCv(id), c = ITEMS[id].c, g = grp('translate3d(0,0,0)');
    for (let i = 0; i < 4; i++) {
      const edge = mixc(c[0], c[1], i / 3), seg = grp(`rotateX(${-i * 2.2}deg)`);
      seg.appendChild(box3(10, 4.1, 1.1, 0, 16 - 6 + i * 4, -i * 0.45, { back: tex(cv, 1, 1 + i * 4, 10, 4), front: tex(cv, 12, 1 + i * 4, 10, 4), left: edge, right: edge, top: edge, bottom: edge }));
      g.appendChild(seg);
    }
    add(g);
  }
  function wings3(id, add, sw = 0, lite = false) {
    if (ITEMS[id].img) { const g = grp(`translate3d(0,${4 * S3}px,0)`); wingsImg(id, g); add(g); return; }
    const c = ITEMS[id].c, g = grp('translate3d(0,0,0)');
    for (const s of [-1, 1]) {
      const side = grp(`translate3d(${s * 2.5 * S3}px,${-3 * S3}px,0) rotateY(${s * sw}deg) rotateY(${s < 0 ? 180 : 0}deg)`); side.classList.add('wsd'); side.style.setProperty('--ws', String(s));
      for (let i = 0; i < 6; i++) {
        const L = 17 - i * 1.7, f = grp(`rotateZ(${-78 + i * 27}deg)`); f.classList.add('wfe'); f.style.setProperty('--fi', String(i)); const _f = f, col = mixc(c[0], c[1], i / 5);
        f.appendChild(box3(L, 3.2, 0.9, L / 2 + 1, 16, i * 0.12, solid(col)));
        if (!lite) f.appendChild(box3(L * 0.7, 1.4, 0.5, L * 0.42 + 1, 16, 0.7 + i * 0.12, solid(lt(col, .35))));
        side.appendChild(f);
      }
      g.appendChild(side);
    }
    g.appendChild(box3(2.2, 7, 1.4, 0, 16 - 3, 0, solid(mixc(c[1], '#000000', .25))));
    add(g);
  }
  function shield3(id, add) {
    if (ITEMS[id].img) { const g = grp('translate3d(0,0,0)'); shieldImg(id, g); add(g); return; }
    const c = ITEMS[id].c, edge = mixc(c[1], '#000000', .15), gold = c[2] || '#ffd24a', g = grp('translate3d(0,0,0)');
    [[10, 9, -3], [8.4, 3, 3.5], [5.6, 2.6, 6.4], [2.6, 2.2, 8.6]].forEach(([w, h, y]) => g.appendChild(box3(w, h, 1.5, 0, 16 + y, 0, solid(edge))));
    [[8.4, 7.4, -3], [6.8, 2.6, 3.4], [4.2, 2.2, 6.3]].forEach(([w, h, y], i) => g.appendChild(box3(w, h, 0.5, 0, 16 + y, 0.9, solid(mixc(c[0], c[1], (y + 3) / 12)))));
    g.appendChild(box3(3.4, 3.4, 1.2, 0, 16 - 2, 1.5, solid(gold))); g.appendChild(box3(1.6, 1.6, 0.6, 0, 16 - 2, 2.3, solid(lt(gold, .5))));
    add(g);
  }

  // ---------- Bild-Items als echte 3D-Modelle mit Gelenken: Flügel aus 3 Gliedern, Umhang aus 4 Streifen, Schild mit schlagenden Flügeln ----------
  function nest(parent, tf, cls, vars) { const g = grp(tf); g.classList.add(cls); for (const k in vars) g.style.setProperty(k, vars[k]); parent.appendChild(g); return g; }
  // Die 3D-Modelle (BastiGHG) werden im Spiel als echte Meshes gerendert; im Launcher zeigt die Vorschau flache Sprites der Modelle (Rückansicht).
  const spr = (f, sx) => { const o = { front: 'img:' + f, back: 'img:' + f, left: 'transparent', right: 'transparent', top: 'transparent', bottom: 'transparent' }; return o; };
  function flat(el) { el.classList.add('spr'); return el; }
  function wingsImg(id, root) { // zwei Hälften, die am Rücken ansetzen und schlagen
    const I = ITEMS[id], W = 41.6 * (I.sc || 1), H = W * I.ar;
    for (const s of [-1, 1]) {
      const j = nest(root, `translate3d(0,0,0)`, 'wj', { '--ws': s, '--wd': 0 }), b = flat(box3(W / 2, H, .1, s * W / 4, 12, -3.4, spr(I.img)));
      b.querySelectorAll('.f3').forEach(f => { if (!f.classList.contains('front') && !f.classList.contains('back')) return; const left = f.classList.contains('front') ? s < 0 : s > 0; f.style.backgroundSize = '200% 100%'; f.style.backgroundPosition = left ? '0 0' : '100% 0'; });
      j.appendChild(b);
    }
  }
  function capeImg(id, root) { // normal dicker Umhang (1 Pixel), pendelt am Rücken
    const I = ITEMS[id], h = 10 * I.ar, e = I.c[1], TH = 2, par = nest(root, `translate3d(0,${-8 * S3}px,0)`, 'cj', { '--cd': 0 });
    par.appendChild(flat(box3(10, h, TH, 0, 16 + h / 2, -2.5 - TH / 2 + .5, { front: 'img:' + I.img, back: 'img:' + I.img, left: e, right: e, top: e, bottom: e })));
  }
  function shieldImg(id, root) { // Bild in dünnen Lagen gestapelt = echte Tiefe (Dicke ~2 Pixel), Ränder dunkler
    const I = ITEMS[id], W = 14, N = 9;
    for (let i = 0; i < N; i++) { const z = (i - (N - 1) / 2) * .26, b = flat(box3(W, W * I.ar, .1, 0, 16, z, spr(I.img))); if (i === 0 || i === N - 1) b.style.filter = 'brightness(.78)'; else if (i === 1 || i === N - 2) b.style.filter = 'brightness(.9)'; root.appendChild(b); }
  }
  function item3d(id) {
    const wrap = document.createElement('div'); wrap.className = 'i3'; const rig = document.createElement('div'); rig.className = 'rig3 i3r'; wrap.appendChild(rig);
    const add = e => rig.appendChild(e), cat = id.split('-')[0];
    if (cat === 'totem') {
      const g = grp('translate3d(0,0,0)'); const u = 'img:' + ITEMS[id].tot; for (const z of [-1.2, -0.4, 0.4, 1.2]) g.appendChild(box3(16, 16, 0.8, 0, 16, z, { front: u, back: u })); add(g); rig.style.setProperty('--sc', '.9');
    } else if (cat === 'hotbar') {
      const im = document.createElement('img'); im.src = ITEMS[id].hb; im.style.cssText = 'width:150px;image-rendering:pixelated;filter:drop-shadow(0 4px 8px rgba(0,0,0,.25))'; const w = document.createElement('div'); w.style.cssText = 'transform:translateY(40px)'; w.appendChild(im); add(w); rig.style.setProperty('--sc', '1');
    } else if (cat === 'sky') {
      const d = document.createElement('div'); d.style.cssText = `width:100px;height:100px;border-radius:50%;transform:translateY(20px);background:linear-gradient(${ITEMS[id].c[0]},${ITEMS[id].c[1]});box-shadow:0 0 30px ${ITEMS[id].c[1]}`; add(d); rig.style.setProperty('--sc', '1');
    } else if (cat === 'hat') {
      const dy = { 'hat-top': 20, 'hat-gold': 20, 'hat-crown': 19, 'hat-halo': 22.5 }[id] || 27, g = grp(`translate3d(0,${dy * S3}px,0)`);
      hat3(id, e => g.appendChild(e)); add(g); rig.style.setProperty('--sc', '.6');
    } else if (cat === 'cape') { cape3(id, add); rig.style.setProperty('--sc', '.78'); }
    else if (cat === 'wings') { wings3(id, add, 14, true); rig.style.setProperty('--sc', ITEMS[id].img ? '.62' : '.52'); }
    else { shield3(id, add); rig.style.setProperty('--sc', '.85'); }
    if (ITEMS[id].img) rig.classList.add('i3flat');
    return wrap;
  }
  const i3s = new Set(); let i3raf = 0, i3a = 0;
  window.cloudyItem3d = id => { const w = item3d(id); try { i3s.add(w.firstChild); } catch {} return w; };
  function loopI3() {} // Karten stehen still; nur die Karte unter dem Mauszeiger dreht sich (reine CSS-Animation, keine JS-Last)
  let perfOn = false, perfN = 0;
  try { perfOn = localStorage.getItem('cloudy.shopPerf') === '1'; } catch {}
  setTimeout(() => { const b = $('#shopPerf'), pg = $('#p-shop'); if (!b || !pg) return; const paint = () => { pg.classList.toggle('perf', perfOn); b.textContent = 'Performance: ' + (perfOn ? 'an' : 'aus'); if (window.setLang) window.setLang(document.documentElement.lang || 'de'); }; paint(); b.onclick = () => { perfOn = !perfOn; try { localStorage.setItem('cloudy.shopPerf', perfOn ? '1' : '0'); } catch {} paint(); }; }, 0);
  function loop3() {
    cancelAnimationFrame(raf3); const host = $('#shop3d'); if (!host || !host.offsetParent || document.hidden) return;
    if (!drag3) ang3 = (ang3 + 0.5) % 360; if (!(perfOn && (perfN = (perfN + 1) % 6))) { if (host._apply) host._apply(); } raf3 = requestAnimationFrame(loop3);
  }
  (function () {
    const host = $('#shop3d'); if (!host) return; let lx = 0;
    host.onpointerdown = e => { drag3 = true; lx = e.clientX; try { host.setPointerCapture(e.pointerId); } catch {} host.style.cursor = 'grabbing'; };
    host.onpointermove = e => { if (!drag3) return; ang3 = (ang3 + (e.clientX - lx) * 0.8) % 360; lx = e.clientX; if (host._apply) host._apply(); };
    host.onpointerup = host.onpointercancel = () => { drag3 = false; host.style.cursor = 'grab'; };
  })();


  // ---------- Skins-Seite ----------
  function paintHead(cv, sk) {
    const ctx = cv.getContext('2d'), i = load(sk.data); ctx.imageSmoothingEnabled = false; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.setTransform(cv.width / 16, 0, 0, cv.height / 32, 0, 0); avatar(ctx, i, sk.model === 'slim');
  }
  let disc = null;
  async function loadSkins() {
    skins = await window.cloudy.skinList(); if (!skins.find(s => s.id === sel)) sel = skins[0] ? skins[0].id : ''; paintSkins();
    if (disc) paintDisc(); else { $('#skDiscMsg').textContent = L('Lade beliebte Skins …'); window.cloudy.skinDiscover().then(d => { disc = d; $('#skDiscMsg').textContent = d.length ? '' : L('Beliebte Skins konnten nicht geladen werden (keine Verbindung?).'); paintDisc(); }).catch(() => { $('#skDiscMsg').textContent = L('Beliebte Skins konnten nicht geladen werden (keine Verbindung?).'); }); }
  }
  function paintDisc() {
    const g = $('#skDisc'); if (!g || !disc) return;
    g.innerHTML = disc.map(s => `<div class="glass sk" data-n="${esc(s.name)}"><canvas width="80" height="160"></canvas><b>${esc(s.name)}</b><div class="skb"><button class="btn" data-add>Hinzufügen</button></div></div>`).join('');
    $$('#skDisc .sk').forEach(el => {
      const s = disc.find(x => x.name === el.dataset.n); paintHead(el.querySelector('canvas'), s);
      const have = skins.some(k => k.name === s.name), b = el.querySelector('[data-add]');
      if (have) { b.textContent = L('In Bibliothek ✓'); b.disabled = true; }
      b.onclick = async () => { b.disabled = true; const r = await window.cloudy.skinAddName(s.name); if (r.ok) await loadSkins(); else { msg(L(r.error)); b.disabled = false; } };
    });
    if (window.setLang) window.setLang(document.documentElement.lang || 'de');
  }
  function paintSkins() {
    const g = $('#skGrid'); if (!g) return;
    g.innerHTML = skins.length ? skins.map(s => `<div class="glass sk ${s.id === sel ? 'sel' : ''}" data-id="${s.id}"><canvas width="80" height="160"></canvas><b>${esc(s.name)}</b>
      <div class="skb"><button class="chip ${s.model !== 'slim' ? 'on' : ''}" data-m="classic">Classic</button><button class="chip ${s.model === 'slim' ? 'on' : ''}" data-m="slim">Slim</button></div>
      <div class="skb"><button class="btn" data-ap>Anwenden</button><button class="btn ghost" data-rm>Löschen</button></div></div>`).join('') : '<p class="muted">Noch keine Skins. Hole dir oben einen Skin über den Spielernamen, einen Link oder eine PNG-Datei.</p>';
    $$('#skGrid .sk').forEach(el => {
      const s = skins.find(x => x.id === el.dataset.id); paintHead(el.querySelector('canvas'), s);
      el.onclick = e => { if (e.target.closest('button')) return; sel = s.id; st.set('skinSel', sel); paintSkins(); paintShop(); };
      el.querySelectorAll('[data-m]').forEach(b => b.onclick = async () => { await window.cloudy.skinModel({ id: s.id, model: b.dataset.m }); s.model = b.dataset.m; paintSkins(); paintShop(); });
      el.querySelector('[data-rm]').onclick = async () => { if (confirm(s.name + ' – ' + L('Löschen') + '?')) { await window.cloudy.skinRemove(s.id); loadSkins(); } };
      el.querySelector('[data-ap]').onclick = async e => { const b = e.target; b.disabled = true; msg(L('Lade Skin zu Minecraft hoch …')); const r = await window.cloudy.skinApply(s.id); b.disabled = false; msg(r.ok ? L('Skin angewendet ✓ – gilt beim nächsten Spielstart.') : L(r.error)); };
    });
    if (window.setLang) window.setLang(document.documentElement.lang || 'de');
  }
  const msg = t => { const e = $('#skMsg'); if (e) e.textContent = t; };
  async function add(p) { msg(L('Lade …')); const r = await p; if (r.ok) { msg(L('Skin hinzugefügt ✓')); await loadSkins(); } else if (!r.cancel) msg(L(r.error)); else msg(''); }
  $('#skName').onkeydown = e => { if (e.key === 'Enter') $('#skNameGo').click(); };
  $('#skNameGo').onclick = () => { const v = $('#skName').value.trim(); if (v) { add(window.cloudy.skinAddName(v)); $('#skName').value = ''; } };
  $('#skUrlGo').onclick = () => { const v = $('#skUrl').value.trim(); if (v) { add(window.cloudy.skinAddUrl(v)); $('#skUrl').value = ''; } };
  $('#skFile').onclick = () => add(window.cloudy.skinPick());
  $$('[data-site]').forEach(b => b.onclick = () => window.cloudy.openExternal(b.dataset.site));
  $$('[data-skn]').forEach(b => b.onclick = () => add(window.cloudy.skinAddName(b.dataset.skn)));

  // ---------- Shop ----------
  const CATS = [['cape', 'Umhänge'], ['wings', 'Flügel'], ['shield', 'Schilde'], ['hat', 'Hüte']];
  function paintCoins() {
    const t = shop ? cc(shop.coins) : ''; const a = $('#accCC'); if (a) a.textContent = t; const b = $('#shopCC'); if (b) b.textContent = t;
    const d = $('#shopDaily'); if (d) { d.style.display = shop && !shop.admin ? '' : 'none'; d.disabled = !shop || !shop.dailyReady; }
  }
  function regCustom() { // eigene Admin-Items in die Vorschau-Tabelle eintragen
    let again = false;
    for (const i of shop.catalog) {
      if (!i.custom || ITEMS[i.id]) continue;
      if (i.cat === 'sky') { ITEMS[i.id] = { b: [0, 0, 16, 16], c: i.sky, sky: 1 }; continue; }
      if (i.cat === 'cape') {
        ITEMS[i.id] = { b: [0, 8, 16, 24], c: ['#8fa2c4', '#3a4a6a'], raw: i.file }; again = true;
        const im = new Image(); im.onload = () => { const cv = document.createElement('canvas'), k = Math.max(1, Math.round(im.width / 64)); cv.width = 10 * k * 4; cv.height = 16 * k * 4; const g = cv.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(im, k, k, 10 * k, 16 * k, 0, 0, cv.width, cv.height); ITEMS[i.id].img = cv.toDataURL('image/png'); ITEMS[i.id].ar = 1.6; if (window.paintAll) paintShop(); }; im.src = i.file;
      }
    }
  }
  async function rawCape(id) { const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = ITEMS[id].raw; }); const cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height; cv.getContext('2d').drawImage(im, 0, 0); return cv.toDataURL('image/png'); }
  let shopFilt = 'all'; try { shopFilt = localStorage.getItem('cloudy.shopFilt') || 'all'; } catch {}

  // ---------- Limited-Items (Admin legt fest: Coins oder Code, Anzahl, Preis, Dauer) ----------
  const escL = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function limHtml() {
    const list = shop.limited || [], fmt = t => new Date(t).toLocaleString();
    const card = o => {
      const own = shop.owned.includes(o.id), done = o.over && !own;
      return `<div class="glass shi ${own ? 'sel' : ''}"><div class="i3h" data-i3="${o.id}"></div><b>${escL(o.name)}</b>
        <small>${o.mode === 'coins' ? cc(o.price) : 'Nur mit Code'} · ${o.left}/${o.stock} übrig${o.until ? ' · bis ' + fmt(o.until) : ''}</small>${o.note ? `<small>${escL(o.note)}</small>` : ''}
        ${own ? '<button class="btn ghost" disabled>Gehört dir</button>' : done ? '<button class="btn ghost" disabled>Vorbei / ausverkauft</button>' : o.mode === 'code' ? `<input class="field" data-lim-code="${o.id}" placeholder="Code" autocomplete="off" spellcheck="false"><button class="btn" data-lim-get="${o.id}">Einlösen</button>` : `<button class="btn" data-lim-get="${o.id}">${shop.admin ? 'Holen (gratis)' : 'Kaufen'}</button>`}
        ${shop.admin ? `<small>Verkauft: ${o.sold || 0}${o.mode === 'code' && o.codes ? '</small><small style="user-select:text">Codes (je 1×): ' + o.codes.map(x => x.used ? '<s>' + escL(x.c) + '</s>' : '<b>' + escL(x.c) + '</b>').join(' · ') + '</small>' : o.code ? ' · Code: <b>' + escL(o.code) + '</b></small>' : '</small>'}<button class="btn ghost" data-lim-edit="${o.id}">Bearbeiten</button><button class="btn ghost" data-lim-del="${o.id}">Beenden</button>` : ''}</div>`;
    };
    let h = `<h3 class="shc">⏳ Limited</h3>`;
    h += list.length ? `<div class="row shrow">${list.map(card).join('')}</div>` : `<p class="muted">${shop.admin ? 'Noch kein Limited-Item – lege unten eins fest.' : 'Gerade gibt es keine Limited-Items.'}</p>`;
const row = (lab, help, field) => `<div class="limrow" style="margin:8px 0"><div style="display:flex;align-items:center;gap:8px;margin-bottom:4px"><b style="font-size:13px">${lab}</b><button type="button" class="chip" data-help style="padding:0 8px;min-width:22px" title="Erklärung">?</button></div><small class="muted lhelp" style="display:none;margin-bottom:6px">${help}</small>${field}</div>`;
    if (shop.admin) h += `<div class="glass set wide" id="limForm"><h3>Limited-Item festlegen</h3><p class="muted">Das Item verschwindet aus dem normalen Shop und gibt es nur noch hier. Tippe bei jeder Zeile auf das <b>?</b>, dann steht dort, was sie macht.</p>
      <div class="i3h" id="limPrev" style="height:170px;margin:6px 0"></div>
      ${row('Item', 'Welches Item als Limited verkauft wird. Unter dem Namen siehst du gleich die 3D-Vorschau. „Zufälliges Item“ wählt eins aus, das du noch nicht als Limited hast.', '<div class="tools"><select id="limId" class="field">' + shop.catalog.map(i => `<option value="${i.id}">${escL(i.name)} (${i.id})</option>`).join('') + '</select><button class="btn ghost" id="limRndItem">🎲 Zufälliges Item</button></div>')}
      ${row('Wie bekommt man es?', '„Für Coins“: Spieler kaufen es mit CC (Admins gratis). „Mit Code“: Spieler geben einen geheimen Code ein, den du weitergibst – Coins kostet es dann nichts.', '<select id="limMode" class="field"><option value="coins">Für Coins</option><option value="code">Mit Code</option></select>')}
      ${row('Preis (CC)', 'Was das Item in Coins kostet. Gilt nur bei „Für Coins“; bei „Mit Code“ wird der Preis ignoriert.', '<input id="limPrice" class="field" type="number" min="0" placeholder="Preis in CC" value="500">')}
      ${row('Wie viele gibt es?', 'Die Gesamtmenge. Jeder Spieler kann es nur einmal holen; ist die Menge weg, ist das Angebot ausverkauft. Der Server zählt mit.', '<input id="limStock" class="field" type="number" min="1" placeholder="Anzahl" value="10">')}
      ${row('Dauer (Stunden)', 'Wie lange das Angebot läuft, ab dem Speichern. 0 = ohne Zeitlimit. Danach lässt es sich nicht mehr holen (wer es hat, behält es).', '<input id="limHours" class="field" type="number" min="0" placeholder="0 = unbegrenzt" value="0">')}
      ${row('Code', 'Nur bei „Mit Code“: Jeder Code gilt nur für EINEN Spieler – bei Menge 5 gibt es 5 Codes. Leer lassen = der Server würfelt alle Codes. Eigene Codes: mit Komma trennen. „🎲 Code“ trägt einen zufälligen ein. Alle Codes (benutzte durchgestrichen) siehst du danach beim Angebot.', '<div class="tools"><input id="limCode" class="field" placeholder="leer = zufällig" autocomplete="off"><button class="btn ghost" id="limRndCode">🎲 Code</button></div>')}
      ${row('Hinweis', 'Kurzer Text, der bei dem Angebot steht, z. B. „Event-Belohnung“. Optional.', '<input id="limNote" class="field" placeholder="optional">')}
      ${row('Bestand zurücksetzen', 'Haken setzen und speichern: Verkäufe auf 0, alle, die es schon geholt haben, dürfen es noch einmal holen. Ohne Haken bleibt der Stand beim Bearbeiten erhalten.', '<label class="muted"><input id="limReset" type="checkbox"> Zurücksetzen</label>')}
      <div class="tools"><button class="btn" id="limSave">Speichern</button></div></div>`;
    return h;
  }
  function wireLim() {
    const msg = t => { const m = $('#shopMsg'); if (m) m.textContent = t || ''; }, take = r => { if (r && r.state) { shop = r.state; window.shopCatalog = shop.catalog; } msg(r && !r.ok ? L(r.error || 'Fehler') : ''); paintShop(); };
    $$('[data-lim-get]').forEach(b => b.onclick = async () => { const id = b.dataset.limGet, inp = document.querySelector(`[data-lim-code="${id}"]`); b.disabled = true; take(await window.cloudy.limClaim({ id, code: inp ? inp.value : '' })); });
    $$('[data-lim-code]').forEach(i => i.onkeydown = e => { if (e.key === 'Enter') { const b = document.querySelector(`[data-lim-get="${i.dataset.limCode}"]`); b && b.click(); } });
    $$('[data-lim-del]').forEach(b => b.onclick = async () => { const o = (shop.limited || []).find(x => x.id === b.dataset.limDel); if (o && confirm(o.name + ' – ' + L('Limited-Angebot beenden?'))) take(await window.cloudy.limAdmin({ id: o.id, del: true })); });
    $$('[data-lim-edit]').forEach(b => b.onclick = () => { const o = (shop.limited || []).find(x => x.id === b.dataset.limEdit); if (!o) return; $('#limId').value = o.id; $('#limMode').value = o.mode; $('#limPrice').value = o.price; $('#limStock').value = o.stock; $('#limCode').value = o.codes ? o.codes.map(x => x.c).join(', ') : (o.code || ''); $('#limNote').value = o.note || ''; $('#limHours').value = 0; $('#limForm').scrollIntoView({ block: 'center' }); });
    $$('#limForm [data-help]').forEach(b => b.onclick = () => { const t = b.closest('.limrow').querySelector('.lhelp'); t.style.display = t.style.display === 'none' ? '' : 'none'; });
    const prev = () => { const h = $('#limPrev'), id = $('#limId') && $('#limId').value; if (!h || !id) return; h.innerHTML = ''; try { const w = item3d(id); h.appendChild(w); i3s.add(w.firstChild); } catch {} };
    if ($('#limId')) { $('#limId').onchange = prev; prev(); }
    const rc = $('#limRndCode'); if (rc) rc.onclick = () => { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let c = ''; const r = crypto.getRandomValues(new Uint8Array(8)); for (const b of r) c += A[b % A.length]; $('#limMode').value = 'code'; $('#limCode').value = ($('#limCode').value ? $('#limCode').value + ', ' : '') + c; };
    const ri = $('#limRndItem'); if (ri) ri.onclick = () => { const o = [...$('#limId').options], taken = new Set((shop.limited || []).map(x => x.id)), pool = o.filter(x => !taken.has(x.value) && !shop.owned.includes(x.value)); const l = pool.length ? pool : o; $('#limId').value = l[Math.floor(Math.random() * l.length)].value; prev(); };
    const sv = $('#limSave'); if (sv) sv.onclick = async () => { sv.disabled = true; take(await window.cloudy.limAdmin({ id: $('#limId').value, mode: $('#limMode').value, price: +$('#limPrice').value, stock: +$('#limStock').value, hours: +$('#limHours').value, code: $('#limCode').value, note: $('#limNote').value, reset: $('#limReset').checked })); };
  }
  function paintShop() {
    paintCoins(); paintCl(); const box = $('#shopItems'); if (!box || !shop) return; regCustom();
    const adm = $('#shopAdmin'); if (adm) adm.style.display = shop.admin ? '' : 'none';
    paint3d(shop.equip); loop3(); paintHero();
    let fb = $('#shopFilt'); if (!fb) { fb = document.createElement('div'); fb.id = 'shopFilt'; fb.className = 'tools'; fb.style.margin = '4px 0 6px'; fb.innerHTML = '<button class="chip" data-sf="all">Alle</button><button class="chip" data-sf="new">Nicht gekauft</button><button class="chip" data-sf="own">Gekauft</button><button class="chip" data-sf="lim">⏳ Limited</button>'; box.parentNode.insertBefore(fb, box); fb.querySelectorAll('[data-sf]').forEach(b => b.onclick = () => { shopFilt = b.dataset.sf; try { localStorage.setItem('cloudy.shopFilt', shopFilt); } catch {} paintShop(); }); if (window.setLang) window.setLang(document.documentElement.lang || 'de'); }
    fb.querySelectorAll('[data-sf]').forEach(b => b.classList.toggle('on', b.dataset.sf === shopFilt));
    const fl = cat => shopFilt === 'lim' ? [] : shop.catalog.filter(i => i.cat === cat && (shopFilt === 'all' || (shopFilt === 'own') === shop.owned.includes(i.id)));
    box.innerHTML = CATS.filter(([cat]) => shopFilt === 'all' || fl(cat).length).map(([cat, name]) => `<h3 class="shc">${name}</h3><div class="row shrow">${fl(cat).map(i => {
      const own = shop.owned.includes(i.id), on = shop.equip[cat] === i.id;
      return `<div class="glass shi ${on ? 'sel' : ''}"><div class="i3h" data-i3="${i.id}"></div><b ${shop.admin ? `contenteditable="plaintext-only" spellcheck="false" title="Admin: Namen anklicken und ändern" data-rn="${i.id}"` : ''}>${i.name}</b><small>${cc(i.price)}${shop.admin ? ' · gratis (Admin)' : ''}</small>
        ${shop.admin ? `<button class="btn ghost ${i.hidden ? 'tagon' : ''}" data-hide="${i.id}|${i.hidden ? 0 : 1}" title="Admin: ${i.hidden ? 'Wieder im Shop anzeigen' : 'Im Shop verstecken (niemand kann es mehr kaufen)'}">${i.hidden ? '🙈 Versteckt – zeigen' : '👁 Verstecken'}</button>` : ''}        ${shop.admin && i.custom ? `<button class="btn ghost" data-ci-del="${i.id}">Löschen</button>` : ''}${own ? `<button class="btn ${on ? 'ghost' : ''}" data-eq="${i.id}" data-cat="${cat}">${on ? 'Ablegen' : 'Anlegen'}</button>${!shop.admin && !i.custom ? `<button class="btn ghost" data-gift="${i.id}">🎁 Verschenken</button>` : ''}` : `<button class="btn" data-buy="${i.id}">Kaufen</button>`}</div>`;
    }).join('')}</div>`).join('');
    if (shopFilt === 'all' || shopFilt === 'lim') box.insertAdjacentHTML('beforeend', limHtml());
    wireLim();
    $$('#shopItems [data-i3]').forEach(h => { const w = item3d(h.dataset.i3); h.appendChild(w); i3s.add(w.firstChild); });
    $$('[data-rn]').forEach(b => { b.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); b.blur(); } }; b.onblur = async () => { const n = b.textContent.trim(), it = shop.catalog.find(c => c.id === b.dataset.rn); if (!it || n === it.name) return; const r = await window.cloudy.shopRename({ id: it.id, name: n }); if (r.state) { shop = r.state; window.shopCatalog = shop.catalog; } $('#shopMsg').textContent = r.ok ? '' : L(r.error); paintShop(); }; });
    $$('[data-hide]').forEach(b => b.onclick = async () => { const [id, on] = b.dataset.hide.split('|'); const r = await window.cloudy.shopHide({ id, on: on === '1' }); if (r.state) { shop = r.state; window.shopCatalog = shop.catalog; } $('#shopMsg').textContent = r.ok ? '' : L(r.error); paintShop(); });
    $$('[data-ci-del]').forEach(b => b.onclick = async () => { if (confirm((shop.catalog.find(c => c.id === b.dataset.ciDel) || {}).name + ' – ' + L('Löschen') + '?')) { const r = await window.cloudy.itemDelete(b.dataset.ciDel); if (r.state) shop = r.state; paintShop(); } });
    $$('[data-gift]').forEach(b => b.onclick = async () => {
      const it = shop.catalog.find(c => c.id === b.dataset.gift); if (!it) return;
      const to = await askText(L('Wem möchtest du das schenken? (Benutzername)') + ' – ' + it.name); if (!to || !to.trim()) return;
      if (!confirm(L('Wirklich verschenken?') + ' ' + it.name + ' → ' + to.trim())) return;
      const r = await window.cloudy.shopGift({ to: to.trim(), id: it.id }); if (r.state) { shop = r.state; window.shopCatalog = shop.catalog; }
      $('#shopMsg').textContent = r.ok ? L('Geschenk gesendet an') + ' ' + r.to + ' 🎁' : L(r.error); paintShop();
    });
    $$('[data-buy]').forEach(b => b.onclick = async () => { const r = await act(window.cloudy.shopBuy(b.dataset.buy)); if (r && r.ok) buySound(); });
    $$('[data-eq]').forEach(b => b.onclick = () => equip(b.dataset.cat, shop.equip[b.dataset.cat] === b.dataset.eq ? null : b.dataset.eq));
    if (window.setLang) window.setLang(document.documentElement.lang || 'de');
  }
  async function paintCl() {
    const el = $('#shopCl'); if (!el) return;
    const c = await window.cloudy.clientStatus(version), L2 = x => L(x); let msg, btn = '', cls = '';
    if (building || c.building) { msg = buildStatus || 'Die Client-Mod wird gebaut …'; }
    else if (!c.jar || !c.cosmetics) { msg = !c.jar ? 'Die Client-Mod für diese Version fehlt noch – ohne sie zeigt Minecraft keine Cosmetics.' : 'Deine Client-Mod ist veraltet und kennt die Cosmetics noch nicht.' + ` (Stand ${c.have || '?'}, nötig ${c.want || '?'})`; btn = c.src ? '<button class="btn" id="clBuild">Client-Mod jetzt bauen</button>' : '<span class="muted">Quellen fehlen – installiere die komplette Cloudy-Version neu.</span>'; }
    else if (!c.supported.includes(bvr(version))) { msg = `Cosmetics gibt es im Spiel ab Minecraft 1.21.4 (gewählt: ${version}).`; btn = `<button class="btn" id="clVer">Auf 1.21.4 wechseln</button>`; }
    else { msg = `✓ Bereit: Deine Cosmetics erscheinen in Minecraft ${version} (mit Fabric).`; cls = 'ok'; }
    el.innerHTML = `<div style="font-weight:700">${L2(msg)}</div>${buildLog ? `<small class="muted" style="white-space:pre-wrap;word-break:break-all">${esc(buildLog)}</small>` : ''}${btn}`;
    const b = $('#clBuild'); if (b) b.onclick = buildCl;
    const v = $('#clVer'); if (v) v.onclick = () => { version = '1.21.4'; st.set('version', version); paintVersion(); paintCl(); };
    if (window.setLang) window.setLang(document.documentElement.lang || 'de');
  }
  let building = false, buildStatus = '', buildLog = '';
  async function buildCl() {
    building = true; buildLog = ''; buildStatus = 'Starte Bau …'; paintCl();
    const r = await window.cloudy.clientBuild(version); building = false; buildStatus = '';
    buildLog = r.ok ? '' : (r.error + '\n' + (r.log || '')); paintCl();
  }
  window.cloudy.on('clientBuild', d => { if (d.status) buildStatus = d.status; if (d.line) buildLog = d.line; paintCl(); });
  function buySound() { // sauberer Kauf-Klang: drei weiche Glockentöne + leises Klimpern, komplett synthetisch
    try {
      const A = new (window.AudioContext || window.webkitAudioContext)(), t = A.currentTime, out = A.createGain(); out.gain.value = .9; out.connect(A.destination);
      [[880, 0], [1318.5, .08], [1760, .17]].forEach(([f, d]) => { const o = A.createOscillator(), g = A.createGain(), o2 = A.createOscillator(); o.type = 'sine'; o.frequency.value = f; o2.type = 'triangle'; o2.frequency.value = f * 2; o2.detune.value = 4;
        g.gain.setValueAtTime(0, t + d); g.gain.linearRampToValueAtTime(.15, t + d + .012); g.gain.exponentialRampToValueAtTime(.0001, t + d + .5); const g2 = A.createGain(); g2.gain.value = .12; o2.connect(g2).connect(g); o.connect(g).connect(out); o.start(t + d); o2.start(t + d); o.stop(t + d + .55); o2.stop(t + d + .55); });
      setTimeout(() => { try { A.close(); } catch {} }, 1400);
    } catch {}
  }
  async function act(p) { const r = await p; if (r.state) { shop = r.state; window.shopCatalog = shop.catalog; } $('#shopMsg').textContent = r.ok ? '' : L(r.error); paintShop(); return r; }
  async function equip(cat, id) {
    const r = await act(window.cloudy.shopEquip({ cat, id }));
    if (cat === 'cape' && r.ok) { if (id && ITEMS[id] && ITEMS[id].raw) await window.cloudy.capeSave(await rawCape(id)); else if (id && ITEMS[id] && ITEMS[id].img) await window.cloudy.capeClear(); else if (id) await window.cloudy.capeSave(await capeTexHi(id)); else await window.cloudy.capeClear(); $('#shopMsg').textContent = L('Umhang gesetzt – gilt beim nächsten Spielstart (mit der Cloudy-Client-Mod).'); }
  }
  { const cat = $('#ciCat'), add = $('#ciAdd'); if (cat) {
    cat.onchange = () => { $('#ciSky').style.display = cat.value === 'sky' ? 'inline-flex' : 'none'; };
    add.onclick = async () => { const r = await window.cloudy.itemAdd({ name: $('#ciName').value, cat: cat.value, price: $('#ciPrice').value, sky: [$('#ciC1').value, $('#ciC2').value] }); $('#ciMsg').textContent = r.ok ? 'Item erstellt ✓' : (r.error || ''); if (r.ok) { $('#ciName').value = ''; if (r.state) shop = r.state; paintShop(); } };
  } }
  $('#shopFriends').onclick = () => { if (window.go) window.go('friends'); };
  $('#shopDaily').onclick = async () => { const r = await act(window.cloudy.shopDaily()); if (r.ok) $('#shopMsg').textContent = L('+50 CC Tagesbonus ✓'); };
  async function refresh() { shop = await window.cloudy.shopState(); if (shop) window.shopCatalog = shop.catalog; skins = await window.cloudy.skinList(); if (!skins.length) { try { const nm = (window.who && who()) || ''; if (nm) { await window.cloudy.skinAddName(nm); skins = await window.cloudy.skinList(); } } catch {} } sel = st.get('skinSel', sel); if (!skins.find(s => s.id === sel)) sel = skins[0] ? skins[0].id : ''; paintShop(); setTimeout(() => { try { window.pushHead(); } catch {} }, 1500); }
  // Kopf des gewählten Skins (32×32) – steht im Chat vor den Nachrichten; wird auch an den Konto-Server geschickt, damit Freunde ihn sehen
  window.cloudyHeadMine = () => {
    try { const sk = skins.find(x => x.id === sel) || skins[0], im = sk && load(sk.data); if (!im || !im.complete || !im.naturalWidth) return null;
      const cv = document.createElement('canvas'); cv.width = cv.height = 32; const g = cv.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(im, 8, 8, 8, 8, 0, 0, 32, 32); if (im.naturalHeight >= 64) g.drawImage(im, 40, 8, 8, 8, 0, 0, 32, 32); return cv.toDataURL('image/png'); } catch { return null; }
  };
  let headSent = '';
  window.pushHead = () => { const h = window.cloudyHeadMine && window.cloudyHeadMine(); if (!h || h === headSent) return; headSent = h; try { window.cloudy.frApi({ method: 'POST', path: '/avatar', body: { img: h } }); } catch {} };
  window.paintAll = () => { setTimeout(() => { try { window.pushHead(); } catch {} }, 400); if (disc) paintDisc(); if (shop) { paint3d(shop.equip); paintHero(); } $$('#skGrid .sk').forEach(el => { const s = skins.find(x => x.id === el.dataset.id); if (s) paintHead(el.querySelector('canvas'), s); }); };
  window.onLoggedIn = refresh;
  let lastShop = '';
  const pollShop = async () => { if (document.hidden) return; try { const n = await window.cloudy.shopState(); if (!n) return; const sig = JSON.stringify([n.coins, n.owned, n.equip, n.catalog.map(c => c.name)]); shop = n; window.shopCatalog = n.catalog; if (sig !== lastShop) { lastShop = sig; if ($('#p-shop').classList.contains('on')) paintShop(); else paintCoins(); } else paintCoins(); } catch {} }; // alle 15 s: Coins, Items, Namen vom Server (Admin-Änderungen, Geschenke) ohne Neustart
  window.pollShop = pollShop;
  setInterval(pollShop, 15000); window.addEventListener('focus', pollShop);
  window.cloudy.on('coins', d => { shop = d.state; paintShop(); const m = $('#shopMsg'); if (m) m.textContent = `+${d.gain} CC ${L('fürs Spielen')} ✓`; });
  const ps = window.paintSub; window.paintSub = p => { if (ps) ps(p); if (p === 'shop') refresh(); if (p === 'skins') loadSkins(); }; // jedes Öffnen der Seiten lädt sie neu
  const iv = setInterval(() => { if (shop) paintCoins(); }, 5000); void iv;
  document.addEventListener('visibilitychange', () => { if (!document.hidden && shop) { loop3(); loopI3(); } });
})();
