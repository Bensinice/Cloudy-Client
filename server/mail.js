// E-Mail-Versand ohne Zusatzpaket (reines SMTP). Einstellungen über Umgebungsvariablen:
//   SMTP_HOST, SMTP_PORT (465 = SSL, sonst STARTTLS), SMTP_USER, SMTP_PASS, SMTP_FROM (optional), MAIL_TO (Empfänger, Standard: Owner)
//   SMTP_SECURE=none schaltet die Verschlüsselung ab (nur für Tests im eigenen Netz).
// Ohne SMTP_HOST wird nichts gesendet; ein Fehler beim Senden bricht nie die Anfrage ab.
const net = require('net'), tls = require('tls');

const cfg = () => ({ host: process.env.SMTP_HOST || '', port: +process.env.SMTP_PORT || 465, user: process.env.SMTP_USER || '', pass: process.env.SMTP_PASS || '', from: process.env.SMTP_FROM || process.env.SMTP_USER || '', to: process.env.MAIL_TO || 'ben.haertel29@gmail.com', secure: process.env.SMTP_SECURE || '' });
const enabled = () => !!cfg().host;

function send({ subject, text, to }) {
  const c = cfg(); to = to || c.to;
  return new Promise((resolve, reject) => {
    if (!c.host) return reject(new Error('SMTP_HOST ist nicht gesetzt'));
    const mode = c.secure === 'none' ? 'none' : (c.secure === 'starttls' || (c.secure !== 'ssl' && c.port !== 465)) ? 'starttls' : 'ssl';
    let sock, buf = '', waiter = null, done = false;
    const fail = e => { if (done) return; done = true; try { sock.destroy(); } catch {} reject(e instanceof Error ? e : new Error(String(e))); };
    const timer = setTimeout(() => fail(new Error('SMTP-Zeitüberschreitung')), 20000);
    const attach = s => {
      sock = s; s.setEncoding('utf8'); s.on('error', fail); s.on('close', () => { if (!done) fail(new Error('SMTP-Verbindung geschlossen')); });
      s.on('data', d => { buf += d; check(); });
    };
    const check = () => {
      const lines = buf.split('\r\n'); // eine Antwort ist fertig, wenn eine Zeile "123 " (ohne Bindestrich) vorkommt
      for (let i = 0; i < lines.length - 1; i++) if (/^\d{3} /.test(lines[i]) && waiter) { const w = waiter; waiter = null; const r = lines.slice(0, i + 1).join('\r\n'); buf = lines.slice(i + 1).join('\r\n'); w(r); return; }
    };
    const reply = () => new Promise(r => { waiter = r; check(); });
    const cmd = async (line, ok) => { sock.write(line + '\r\n'); const r = await reply(); if (!String(ok).split(',').some(p => r.startsWith(p))) throw new Error('SMTP: ' + r.split('\r\n').pop().slice(0, 120)); return r; };
    const b64 = s => Buffer.from(String(s)).toString('base64');
    const enc = s => /^[\x20-\x7e]*$/.test(s) ? s : '=?UTF-8?B?' + b64(s) + '?=';
    (async () => {
      attach(mode === 'ssl' ? tls.connect({ host: c.host, port: c.port, servername: c.host }) : net.connect({ host: c.host, port: c.port }));
      const g = await reply(); if (!g.startsWith('220')) throw new Error('SMTP: ' + g.slice(0, 100));
      let r = await cmd('EHLO cloudy', '250');
      if (mode === 'starttls') {
        await cmd('STARTTLS', '220');
        const plain = sock; plain.removeAllListeners('data'); plain.removeAllListeners('close'); plain.removeAllListeners('error');
        attach(tls.connect({ socket: plain, servername: c.host })); buf = '';
        await new Promise((ok, no) => { sock.once('secureConnect', ok); sock.once('error', no); });
        r = await cmd('EHLO cloudy', '250');
      }
      if (c.user) { await cmd('AUTH LOGIN', '334'); await cmd(b64(c.user), '334'); await cmd(b64(c.pass), '235'); }
      const from = c.from || c.user || 'cloudy@localhost', addr = (from.match(/<([^>]+)>/) || [null, from])[1];
      await cmd('MAIL FROM:<' + addr + '>', '250'); await cmd('RCPT TO:<' + to + '>', '250,251'); await cmd('DATA', '354');
      const body = String(text).replace(/\r?\n/g, '\r\n'); // Base64-Inhalt: kein Punkt-Stuffing nötig
      const msg = ['From: ' + from, 'To: ' + to, 'Subject: ' + enc(subject), 'Date: ' + new Date().toUTCString(), 'MIME-Version: 1.0', 'Content-Type: text/plain; charset=utf-8', 'Content-Transfer-Encoding: base64', '', Buffer.from(body, 'utf8').toString('base64').replace(/(.{76})/g, '$1\r\n')].join('\r\n');
      sock.write(msg + '\r\n.\r\n'); const d = await reply(); if (!d.startsWith('250')) throw new Error('SMTP: ' + d.slice(0, 100));
      try { sock.write('QUIT\r\n'); } catch {}
      done = true; clearTimeout(timer); try { sock.end(); } catch {} resolve(true);
    })().catch(e => { clearTimeout(timer); fail(e); });
  });
}

module.exports = { send, enabled };
