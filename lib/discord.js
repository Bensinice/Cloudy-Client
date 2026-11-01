// Discord Rich Presence ueber die lokale Discord-App (IPC), ohne Zusatzpakete.
const net = require('net'), os = require('os'), path = require('path');
function pipePaths(i) {
  if (process.platform === 'win32') return ['\\\\?\\pipe\\discord-ipc-' + i];
  const dirs = [process.env.XDG_RUNTIME_DIR, process.env.TMPDIR, process.env.TMP, process.env.TEMP, '/tmp'].filter(Boolean);
  return dirs.flatMap(d => [path.join(d, 'discord-ipc-' + i), path.join(d, 'snap.discord', 'discord-ipc-' + i), path.join(d, 'app', 'com.discordapp.Discord', 'discord-ipc-' + i)]);
}
function frame(op, obj) { const j = Buffer.from(JSON.stringify(obj)), b = Buffer.alloc(8 + j.length); b.writeInt32LE(op, 0); b.writeInt32LE(j.length, 4); j.copy(b, 8); return b; }
function tryConnect(p) { return new Promise(res => { const s = net.createConnection(p); const t = setTimeout(() => { s.destroy(); res(null); }, 1500); s.once('connect', () => { clearTimeout(t); res(s); }); s.once('error', () => { clearTimeout(t); res(null); }); }); }
function create() {
  let sock = null, ready = false, cid = '', want = null, buf = Buffer.alloc(0), timer = null, busy = false, n = 0;
  const push = () => { if (!sock || !ready) return; try { sock.write(frame(1, { cmd: 'SET_ACTIVITY', args: { pid: process.pid, activity: want || null }, nonce: String(++n) })); } catch {} };
  const drop = () => { try { sock && sock.destroy(); } catch {} sock = null; ready = false; buf = Buffer.alloc(0); };
  async function connect() {
    if (busy || sock || !cid) return; busy = true;
    try {
      for (let i = 0; i < 10 && !sock; i++) for (const p of pipePaths(i)) { const s = await tryConnect(p); if (s) { sock = s; break; } }
      if (!sock) return;
      sock.on('data', d => { buf = Buffer.concat([buf, d]); while (buf.length >= 8) { const len = buf.readInt32LE(4); if (buf.length < 8 + len) break; let m = null; try { m = JSON.parse(buf.slice(8, 8 + len).toString()); } catch {} buf = buf.slice(8 + len); if (m && m.evt === 'READY') { ready = true; push(); } } });
      sock.on('close', drop); sock.on('error', drop);
      sock.write(frame(0, { v: 1, client_id: cid }));
    } finally { busy = false; }
  }
  return {
    // id: Discord-Anwendungs-ID, activity: Objekt oder null (loescht die Anzeige)
    set(id, activity) {
      id = String(id || '').trim(); if (!/^\d{15,22}$/.test(id)) { this.stop(); return false; }
      if (id !== cid) { drop(); cid = id; }
      want = activity || null; if (ready) push();
      if (!timer) timer = setInterval(() => { if (!sock) connect(); }, 15000);
      connect(); return true;
    },
    stop() { if (timer) clearInterval(timer); timer = null; try { if (sock && ready) sock.write(frame(1, { cmd: 'SET_ACTIVITY', args: { pid: process.pid, activity: null }, nonce: String(++n) })); } catch {} setTimeout(drop, 100); want = null; cid = ''; }
  };
}
module.exports = { create };
