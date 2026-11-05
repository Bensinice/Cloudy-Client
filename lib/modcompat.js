// Prueft Mods gegen die gewaehlte Minecraft-Version. Gelesen wird nur, was der Mod selbst in fabric.mod.json / quilt.mod.json / mods.toml angibt ("depends").
// Ergebnis je Mod: kritisch (laeuft sicher nicht mit dieser Version oder diesem Lader) oder Warnung (unklar/veraltet). Nichts wird veraendert.
const { openZip } = require('./zipread');

const parseJSON = b => { try { return JSON.parse(b.toString('utf8').replace(/^﻿/, '')); } catch { return null; } };
const nums = v => String(v).split(/[.\-+]/).map(x => (/^\d+$/.test(x) ? +x : x));
function cmp(a, b) { // -1/0/1; "x" und "*" in b sind Joker
  const x = nums(a), y = nums(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const p = x[i] === undefined ? 0 : x[i], q = y[i] === undefined ? 0 : y[i];
    if (q === 'x' || q === 'X' || q === '*') return 0;
    if (typeof p === 'number' && typeof q === 'number') { if (p !== q) return p < q ? -1 : 1; } else if (String(p) !== String(q)) return String(p) < String(q) ? -1 : 1;
  }
  return 0;
}
// Ein Ausdruck wie ">=1.21 <1.22", "~1.21.4", "1.21.x", "1.21.4" oder "*". Mehrere durch Leerzeichen = UND.
function matchOne(ver, expr) {
  expr = String(expr).trim(); if (!expr || expr === '*') return true;
  return expr.split(/\s+/).filter(Boolean).every(t => {
    const m = /^(>=|<=|>|<|=|~|\^)?(.+)$/.exec(t); if (!m) return true; const op = m[1] || '=', w = m[2];
    if (op === '>=') return cmp(ver, w) >= 0; if (op === '>') return cmp(ver, w) > 0; if (op === '<=') return cmp(ver, w) <= 0; if (op === '<') return cmp(ver, w) < 0;
    if (op === '~') { const p = nums(w); const hi = p.length >= 3 ? [p[0], p[1] + 1] : [p[0] + 1]; return cmp(ver, w) >= 0 && cmp(ver, hi.join('.')) < 0; }
    if (op === '^') { const p = nums(w); return cmp(ver, w) >= 0 && cmp(ver, String((p[0] || 0) + 1)) < 0; }
    return cmp(ver, w) === 0;
  });
}
function matches(ver, spec) { // spec: Text oder Liste (ODER)
  const l = Array.isArray(spec) ? spec : [spec]; return l.some(e => matchOne(ver, e));
}
// -> { ok:true } oder { level:'critical'|'warn', reason }
function checkJar(file, mc) {
  let z; try { z = openZip(file); } catch { return { ok: true }; }
  try {
    if (z.has('fabric.mod.json')) {
      const j = parseJSON(z.read('fabric.mod.json')); if (!j) return { level: 'warn', reason: 'Die Mod-Beschreibung (fabric.mod.json) ist nicht lesbar.' };
      const d = j.depends || {};
      if (d.minecraft !== undefined && !matches(mc, d.minecraft)) return { level: 'critical', reason: `Dieser Mod ist für Minecraft ${[].concat(d.minecraft).join(' oder ')} gebaut, du spielst ${mc}. Er wird mit ${mc} wahrscheinlich nicht starten.` };
      return { ok: true, name: j.name, version: j.version };
    }
    if (z.has('quilt.mod.json')) return { level: 'warn', reason: 'Quilt-Mod: läuft nur mit Quilt oder mit Fabric, wenn der Autor es erlaubt. Cloudy nutzt Fabric.' };
    if (z.has('META-INF/neoforge.mods.toml') || z.has('META-INF/mods.toml')) return { level: 'critical', reason: 'Das ist ein Forge-/NeoForge-Mod. Cloudy startet Minecraft mit Fabric, dieser Mod läuft darin nicht.' };
    return { level: 'warn', reason: 'In der Datei steht nicht, für welche Minecraft-Version oder welchen Lader sie gebaut ist.' };
  } catch { return { ok: true }; } finally { z.close(); }
}
module.exports = { checkJar, matches, cmp };
