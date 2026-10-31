// Sucht ein bereits installiertes Java mit genau der benötigten Hauptversion (Windows, macOS, Linux).
const fs = require('fs'), path = require('path');
const { spawnSync } = require('child_process');

function majorOf(bin) {
  try {
    const r = spawnSync(bin, ['-version'], { encoding: 'utf8', timeout: 6000, windowsHide: true });
    const m = /version "(\d+)(?:\.(\d+))?/.exec((r.stderr || '') + (r.stdout || ''));
    if (!m) return 0;
    return m[1] === '1' ? +m[2] : +m[1];
  } catch { return 0; }
}

function candidates(major) {
  const win = process.platform === 'win32', exe = win ? 'java.exe' : 'java', out = [];
  if (process.env.JAVA_HOME) out.push(path.join(process.env.JAVA_HOME, 'bin', exe));
  if (win) {
    for (const base of [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs')].filter(Boolean))
      for (const vendor of ['Eclipse Adoptium', 'Java', 'Microsoft', 'Zulu', 'BellSoft', 'Amazon Corretto', 'Eclipse Foundation']) {
        let dirs = []; try { dirs = fs.readdirSync(path.join(base, vendor)); } catch {}
        for (const d of dirs) if (new RegExp('(^|[^\\d])' + major + '([^\\d]|$)').test(d)) out.push(path.join(base, vendor, d, 'bin', exe));
      }
  } else if (process.platform === 'darwin') {
    try {
      const r = spawnSync('/usr/libexec/java_home', ['-v', String(major)], { encoding: 'utf8', timeout: 4000 });
      if (r.status === 0 && r.stdout.trim()) out.push(path.join(r.stdout.trim(), 'bin', exe));
    } catch {}
  }
  out.push(exe); // PATH
  return out;
}

// gibt den Pfad zu java (macOS/Linux) bzw. javaw.exe (Windows) zurück, oder null
function findSystemJava(major) {
  for (const c of candidates(major)) {
    if (path.isAbsolute(c) && !fs.existsSync(c)) continue;
    if (majorOf(c) === major) return process.platform === 'win32' && path.isAbsolute(c) ? c.replace(/java\.exe$/i, 'javaw.exe') : c;
  }
  return null;
}
module.exports = { findSystemJava };
