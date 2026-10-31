// Liest Name/Beschreibung/Icon von Ressourcenpaketen (Ordner oder .zip).
const fs = require('fs'), path = require('path');
const { openZip } = require('./zipread');

const flat = d => typeof d === 'string' ? d : Array.isArray(d) ? d.map(flat).join('') : d && typeof d === 'object' ? (d.text || '') + (d.extra ? flat(d.extra) : '') : '';
const clean = s => String(s || '').replace(/§./g, '').replace(/\s+/g, ' ').trim();
const toData = b => b && b.length < 300 * 1024 ? 'data:image/png;base64,' + b.toString('base64') : null;

function readPackInfo(p) {
  try {
    let meta, png;
    if (fs.statSync(p).isDirectory()) {
      const rd = f => { try { return fs.readFileSync(path.join(p, f)); } catch { return null; } };
      meta = rd('pack.mcmeta'); png = rd('pack.png');
    } else {
      const z = openZip(p);
      try { meta = z.read('pack.mcmeta'); png = z.read('pack.png'); } finally { z.close(); }
    }
    let desc = '';
    if (meta) try { desc = clean(flat(JSON.parse(meta.toString('utf8').replace(/^﻿/, '')).pack.description)); } catch {}
    return { desc, icon: toData(png) };
  } catch { return {}; }
}
module.exports = { readPackInfo };
