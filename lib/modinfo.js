// Liest Name, Version und Icon direkt aus der Mod-Datei und macht aus Dateinamen lesbare Namen.
const { openZip } = require('./zipread');

const WORDS = /^(fabric|forge|neoforge|quilt|loader|mod|mods|jar|release|snapshot|beta|alpha)$/i;
function prettyName(file) {
  const base = file.replace(/\.disabled$/, '').replace(/\.jar$/i, '');
  const parts = base.split(/[-_+\s]+/).filter(Boolean);
  const keep = [];
  for (const p of parts) {
    if (/^v?\d/.test(p) || /^mc\d/i.test(p) || /^\d/.test(p)) break;
    if (keep.length && WORDS.test(p)) continue;
    keep.push(p);
  }
  const words = (keep.length ? keep : [base]).map(w => /^api$/i.test(w) ? 'API' : w.charAt(0).toUpperCase() + w.slice(1));
  return words.join(' ');
}

const parseJSON = b => { try { return JSON.parse(b.toString('utf8').replace(/^\uFEFF/, '')); } catch { return null; } };
const toData = b => b && b.length < 300 * 1024 ? 'data:image/png;base64,' + b.toString('base64') : null;
const real = v => typeof v === 'string' && v && !v.includes('${') ? v : undefined;

function readJarInfo(file) {
  let z;
  try { z = openZip(file); } catch { return {}; }
  try {
    let name, version, desc, icon;
    const fab = z.has('fabric.mod.json') && parseJSON(z.read('fabric.mod.json'));
    const qlt = !fab && z.has('quilt.mod.json') && parseJSON(z.read('quilt.mod.json'));
    if (fab) {
      name = real(fab.name); version = real(fab.version); desc = real(fab.description);
      icon = typeof fab.icon === 'string' ? fab.icon : fab.icon && Object.entries(fab.icon).sort((a, b) => b[0] - a[0])[0]?.[1];
    } else if (qlt && qlt.quilt_loader) {
      const m = qlt.quilt_loader.metadata || {};
      name = real(m.name); version = real(qlt.quilt_loader.version); desc = real(m.description);
      icon = typeof m.icon === 'string' ? m.icon : m.icon && Object.values(m.icon).pop();
    } else {
      const t = ['META-INF/neoforge.mods.toml', 'META-INF/mods.toml'].map(n => z.read(n)).find(Boolean);
      if (t) {
        const s = t.toString('utf8');
        name = real((s.match(/displayName\s*=\s*"([^"]+)"/) || [])[1]);
        version = real((s.match(/^\s*version\s*=\s*"([^"]+)"/m) || [])[1]);
        desc = real((s.match(/description\s*=\s*'''([\s\S]*?)'''|description\s*=\s*"([^"]+)"/) || []).slice(1).find(Boolean));
        icon = (s.match(/logoFile\s*=\s*"([^"]+)"/) || [])[1];
      }
    }
    return { name, version, desc, icon: icon ? toData(z.read(icon.replace(/^\//, ''))) : null };
  } catch { return {}; } finally { z.close(); }
}
module.exports = { readJarInfo, prettyName };
