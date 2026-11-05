// Startet und ueberwacht einen Prozess (Server oder Tunnel): Neustart bei Absturz mit Bremse, Log-Puffer, Gesundheitscheck.
const { spawn } = require('child_process'), { EventEmitter } = require('events'), http = require('http');
class Manager extends EventEmitter {
  constructor(name, spec, opt = {}) {
    super(); this.name = name; this.spec = spec; this.opt = Object.assign({ autoRestart: true, backoffMs: 2500, maxCrashes: 5, crashWindowMs: 60000 }, opt);
    this.proc = null; this.want = false; this.state = 'stopped'; this.since = 0; this.restarts = 0; this.crashes = []; this.lastError = ''; this.timer = null; this.logs = [];
  }
  log(line, kind = 'out') { const l = { t: Date.now(), k: kind, s: String(line).replace(/\r/g, '') }; this.logs.push(l); if (this.logs.length > 2000) this.logs.splice(0, this.logs.length - 2000); this.emit('log', l); }
  info() { return { name: this.name, state: this.state, pid: this.proc ? this.proc.pid : 0, since: this.since, restarts: this.restarts, error: this.lastError }; }
  _set(s) { if (this.state !== s) { this.state = s; this.emit('state', this.info()); } }
  start() {
    if (this.proc) return; this.want = true; clearTimeout(this.timer);
    let s; try { s = this.spec(); } catch (e) { this.lastError = e.message; this.log(e.message, 'err'); this._set('error'); this.want = false; return; }
    this.lastError = ''; this._set('starting'); this.log(`▶ Start: ${s.cmd} ${(s.args || []).join(' ')}`, 'sys');
    let p; try { p = spawn(s.cmd, s.args || [], { cwd: s.cwd, env: s.env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }); } catch (e) { this.lastError = e.message; this.log(e.message, 'err'); this._set('error'); this.want = false; return; }
    this.proc = p; this.since = Date.now();
    const feed = k => { let buf = ''; return d => { buf += d.toString('utf8'); const parts = buf.split('\n'); buf = parts.pop(); parts.forEach(x => x && this.log(x, k)); }; };
    p.stdout.on('data', feed('out')); p.stderr.on('data', feed('err'));
    p.on('error', e => { this.lastError = e.code === 'ENOENT' ? 'Programm nicht gefunden: ' + s.cmd : e.message; this.log(this.lastError, 'err'); });
    p.on('spawn', () => this._set('running'));
    p.on('exit', (code, sig) => {
      this.proc = null; const up = Date.now() - this.since; this.log(`■ Beendet (Code ${code == null ? '–' : code}${sig ? ', Signal ' + sig : ''}) nach ${Math.round(up / 1000)} s`, 'sys');
      if (!this.want) { this._set('stopped'); return; }
      const now = Date.now(); this.crashes = this.crashes.filter(t => now - t < this.opt.crashWindowMs); if (up < 15000) this.crashes.push(now);
      if (!this.opt.autoRestart) { this._set('stopped'); this.want = false; return; }
      if (this.crashes.length >= this.opt.maxCrashes) { this.lastError = `Startet immer wieder neu und stürzt ab (${this.crashes.length}× in einer Minute). Automatischer Neustart gestoppt – sieh in die Logs.`; this.log(this.lastError, 'err'); this._set('error'); this.want = false; return; }
      this.restarts++; this._set('restarting'); this.log(`↻ Neustart in ${Math.round(this.opt.backoffMs / 1000)} s …`, 'sys'); this.timer = setTimeout(() => this.start(), this.opt.backoffMs);
    });
  }
  stop() {
    this.want = false; clearTimeout(this.timer); const p = this.proc; if (!p) { this._set('stopped'); return Promise.resolve(); }
    return new Promise(res => {
      const done = () => res(); p.once('exit', done);
      try { p.kill('SIGTERM'); } catch {}
      setTimeout(() => { try { p.kill('SIGKILL'); } catch {} }, 4000); setTimeout(done, 6000);
    });
  }
  async restart() { await this.stop(); this.crashes = []; this.start(); }
}
// einfache Gesundheitsabfrage
function ping(port, pathName = '/health', timeout = 2500) {
  return new Promise(res => { const r = http.get({ host: '127.0.0.1', port, path: pathName, timeout }, x => { x.resume(); res(x.statusCode >= 200 && x.statusCode < 500); }); r.on('error', () => res(false)); r.on('timeout', () => { r.destroy(); res(false); }); });
}
module.exports = { Manager, ping };
