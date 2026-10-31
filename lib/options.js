// Übernimmt Minecraft-Einstellungen (Maus, Lautstärke, Tasten …) in neue/andere Versionen.
const fs = require('fs'), path = require('path');

// Nur diese Schlüssel werden zwischen Versionen abgeglichen – alles andere bleibt je Version eigen.
const SYNC = /^(mouseSensitivity|mouseWheelSensitivity|invertYMouse|rawMouseInput|discreteMouseScroll|touchscreen|fov|fovEffectScale|gamma|renderDistance|simulationDistance|maxFps|enableVsync|guiScale|autoJump|toggleCrouch|toggleSprint|lang|showSubtitles|chatOpacity|chatScale|chatWidth|chatHeightFocused|chatHeightUnfocused|chatLineSpacing|textBackgroundOpacity|soundCategory_.+|key_.+)$/;

const parse = t => t.split(/\r?\n/).filter(l => l.includes(':')).map(l => { const i = l.indexOf(':'); return [l.slice(0, i), l.slice(i + 1)]; });
const exists = f => { try { return fs.statSync(f).isFile(); } catch { return false; } };

// nach dem Spielen: Stand der Version als gemeinsamen Stand merken
function snapshot(gameDir, sharedDir) {
  fs.mkdirSync(sharedDir, { recursive: true });
  for (const f of ['options.txt', 'servers.dat'])
    if (exists(path.join(gameDir, f))) fs.copyFileSync(path.join(gameDir, f), path.join(sharedDir, f));
}

// vor dem Spielen: neue Version bekommt alles, bestehende nur die abgleichbaren Werte
function apply(gameDir, sharedDir) {
  const sOpt = path.join(sharedDir, 'options.txt'), opt = path.join(gameDir, 'options.txt');
  fs.mkdirSync(gameDir, { recursive: true });
  const sSrv = path.join(sharedDir, 'servers.dat'), srv = path.join(gameDir, 'servers.dat');
  if (exists(sSrv) && !exists(srv)) fs.copyFileSync(sSrv, srv);
  if (!exists(sOpt)) return 'none';
  if (!exists(opt)) { fs.copyFileSync(sOpt, opt); return 'copied'; }
  const shared = new Map(parse(fs.readFileSync(sOpt, 'utf8')).filter(([k]) => SYNC.test(k)));
  const seen = new Set();
  const lines = fs.readFileSync(opt, 'utf8').split(/\r?\n/).map(l => {
    const i = l.indexOf(':'); if (i < 0) return l;
    const k = l.slice(0, i); seen.add(k);
    return shared.has(k) ? k + ':' + shared.get(k) : l;
  }).filter((l, i, a) => l !== '' || i < a.length - 1);
  for (const [k, v] of shared) if (!seen.has(k)) lines.push(k + ':' + v);
  fs.writeFileSync(opt, lines.join('\n') + '\n');
  return 'merged';
}
module.exports = { snapshot, apply, SYNC };
